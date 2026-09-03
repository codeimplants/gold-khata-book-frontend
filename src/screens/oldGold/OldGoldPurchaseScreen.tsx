import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import {
  Box,
  VStack,
  Text,
  Center,
  Icon,
  CheckCircleIcon,
} from '@gluestack-ui/themed';
import { Printer, Share2, RefreshCw } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  addPurchaseOldGold,
  updatePurchaseOldGold,
  fetchPurchaseOldGold,
  fetchShopDetails,
  uploadPurchaseOldGoldPhotos,
  removeDeclarationItemPhoto,
  removeWitnessPhoto,
  removeIdProofPhoto,
  syncCustomerForDeclaration,
  clearUserData,
} from '../../store/data/dataSlice';
import { endImpersonation } from '../../store/auth/authSlice';
import { useTranslation } from '../../hooks/useTranslation';
import { toast } from '../../components/common/Toast';
import { parseApiErrorList } from '../../utils/errorUtils';
import {
  uploadPendingItemPhotos,
  uploadPendingWitnessPhotos,
  uploadPendingIdProofPhotos,
  mapDeclarationToFormValues,
} from '../../utils/declarationHelpers';

import DeclarationForm, {
  makeInitialDeclaration,
} from '../../components/oldGold/DeclarationForm';
import DeclarationPreview from '../../components/oldGold/DeclarationPreview';
import GradientButton from '../../components/common/GradientButton';
import ValidationErrorModal from '../../components/ValidationErrorModal';
import ImpersonationBlockModal from '../../components/ImpersonationBlockModal';
import DiscardChangesModal from '../../components/DiscardChangesModal';
import PrintTargetNote from '../../components/common/PrintTargetNote';
import { useDiscardGuard } from '../../hooks/useDiscardGuard';

import { printDeclarationAction, shareDeclarationAction } from '../../print/declarationActions';
import { LAYOUT } from '../../constants/layout';
import type { RootStackParamList } from '../../navigation/types';
import type {
  DeclarationFormValues,
  PurchaseOldGold,
  PendingDeclarationPhoto,
} from '../../types';

type Step = 'form' | 'preview' | 'success';

/**
 * Standalone "buy old gold for cash" flow, and the host for the optional
 * declaration attached to an invoice exchange (the caller passes `prefill`).
 *
 * Mirrors CreateInvoiceScreen's form → preview → success shape so the two
 * transaction types behave the same way.
 */
const OldGoldPurchaseScreen = () => {
  const navigation = useNavigation<any>();
  const route =
    useRoute<NativeStackScreenProps<RootStackParamList, 'OldGoldPurchase'>['route']>();
  const dispatch = useAppDispatch();
  const { t, declarationLanguage } = useTranslation();

  const customerId = route.params?.customerId;
  const prefillRaw = route.params?.prefill;
  /** Set when reopening a saved declaration to correct it. */
  const editId = route.params?.editId;

  const { customers, shopDetails, purchaseOldGold } = useAppSelector(s => s.data);
  const editing = useMemo(
    () => (editId ? purchaseOldGold.find(d => d.id === editId) : undefined),
    [editId, purchaseOldGold],
  );
  const { impersonateUserId, impersonatePhone } = useAppSelector(s => s.auth);

  const [step, setStep] = useState<Step>('form');
  const [values, setValues] = useState<DeclarationFormValues | null>(null);
  const [saved, setSaved] = useState<PurchaseOldGold | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  /** Photos that failed to upload, kept so the success screen can offer a retry. */
  const [failedPhotos, setFailedPhotos] = useState<PendingDeclarationPhoto[]>([]);

  // The declaration only exists locally until it saves, so a back press —
  // header arrow, Android hardware back or iOS swipe — throws it away.
  // Reaching the preview always means ornaments were entered; on the form step
  // DeclarationForm reports whether anything was typed.
  const [formHasInput, setFormHasInput] = useState(false);
  const discardGuard = useDiscardGuard(
    step === 'preview' || (step === 'form' && formHasInput),
  );

  useEffect(() => {
    dispatch(fetchShopDetails());
    // Edit mode can be deep-linked from a customer or an order without the
    // declarations having been loaded yet.
    if (editId) dispatch(fetchPurchaseOldGold());
  }, [dispatch, editId]);

  // Same guard as CreateInvoiceScreen: a declaration needs a customer, so send
  // the user to pick one rather than rendering an unusable form. Edit mode is
  // exempt — the saved record already carries its customer, and the picker
  // would reassign a counterparty that is not reassignable.
  useEffect(() => {
    if (!customerId && !editId) {
      navigation.replace('SelectCustomer', { next: 'OldGoldPurchase' });
    }
  }, [navigation, customerId, editId]);

  const customer = useMemo(
    () => customers.find(c => c.id === customerId),
    [customers, customerId],
  );

  /**
   * Re-seeding is keyed on the declaration's *id*, not the record object.
   *
   * DeclarationForm runs Formik with `enableReinitialize`, so a new
   * `initialValues` identity resets every field. Deleting an uploaded photo
   * returns the refreshed declaration into the store, which would hand back a
   * new object here and silently throw away everything typed since the form was
   * opened. Keying on the id re-seeds exactly once — when the record first
   * arrives from `fetchPurchaseOldGold` — and never again for the same record.
   */
  const editingId = editing?.id;

  const initialValues = useMemo(() => {
    // Editing reads the saved record back rather than building a new form.
    if (editing) return mapDeclarationToFormValues(editing, declarationLanguage);

    let prefill: Partial<DeclarationFormValues> = {};
    if (prefillRaw) {
      try {
        prefill = JSON.parse(prefillRaw);
      } catch {
        // A malformed prefill should not block the flow — fall back to a blank
        // form the shopkeeper can fill in by hand.
      }
    }
    return makeInitialDeclaration({
      customerId: customerId || '',
      customerName: customer?.name || '',
      customerPhone: customer?.phone || '',
      customerAddress: (customer as any)?.address || '',
      // Before the spread, so a form carried back from the customer picker
      // keeps whatever language was already chosen on it.
      language: declarationLanguage,
      ...prefill,
    });
    // `editingId` rather than `editing` — see the comment above the memo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, customer, prefillRaw, declarationLanguage, editingId]);

  /**
   * Sends the shopkeeper back to the customer picker without losing the form.
   *
   * The customer fields are stripped from the carried-over values on purpose:
   * `initialValues` spreads the prefill *after* the newly picked customer, so
   * leaving them in would have the old customer overwrite the new one.
   */
  const handleChangeCustomer = (current: DeclarationFormValues) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { customerId: _, customerName: __, customerPhone: ___, customerAddress: ____, ...rest } =
      current;
    setValues(null);
    navigation.navigate('SelectCustomer', {
      next: 'OldGoldPurchase',
      prefill: JSON.stringify(rest),
    });
  };


  const handleSave = async () => {
    if (impersonateUserId) {
      setBlockModalVisible(true);
      return;
    }
    if (!values || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // An edit updates in place; everything downstream — photo upload, the
      // success step, print and share — is identical either way.
      // The customer's phone and portrait are written to their profile before
      // the declaration is created, and only on create: the server builds the
      // snapshot by reading the customer record at that moment, and refuses a
      // declaration for a customer with no number at all. On an edit the
      // snapshot is already fixed server-side, so there would be nothing for
      // this to reach.
      let customerPhotoFailed = false;
      if (!editId) {
        const syncAction = await dispatch(
          syncCustomerForDeclaration({
            customerId: values.customerId,
            phone: values.customerPhone,
            photo: values.customerPhoto,
          }),
        );
        if (!syncCustomerForDeclaration.fulfilled.match(syncAction)) {
          throw new Error(
            String((syncAction as any).payload || 'Failed to save the retailer details'),
          );
        }
        customerPhotoFailed = !!syncAction.payload?.photoFailed;
      }

      const action = editId
        ? await dispatch(updatePurchaseOldGold({ id: editId, form: values }))
        : await dispatch(addPurchaseOldGold(values));
      const thunk = editId ? updatePurchaseOldGold : addPurchaseOldGold;
      if (!thunk.fulfilled.match(action as any)) {
        throw new Error(String((action as any).payload || 'Failed to save declaration'));
      }

      const created = (action as any).payload as PurchaseOldGold;
      setSaved(created);
      setStep('success');

      // Reported only now that the declaration exists — the photo is a missing
      // face on a saved document, not a failed save.
      if (customerPhotoFailed) {
        toast.error(
          t('declaration.customer.photoUploadFailed') ||
            'The retailer photo could not be uploaded. The declaration was saved without it.',
        );
      }

      // Tracked locally as well as in state: each upload response carries the
      // whole declaration, so the witness pass below has to build on what the
      // ornament pass returned rather than on the pre-upload record.
      let latest = created;

      // Photos are a non-blocking extra: the declaration is already saved and
      // printable, so a failed upload surfaces a retry rather than an error
      // that implies nothing was recorded.
      // Per ornament rather than one declaration-wide set: each is addressed by
      // its own id, so a failure on one leaves the others attached.
      const itemPhotoResult = await uploadPendingItemPhotos(
        dispatch,
        latest,
        values.items,
      );
      latest = itemPhotoResult.declaration;
      setSaved(latest);
      if (itemPhotoResult.failed) {
        toast.error(
          t('declaration.photos.uploadFailed') ||
            'Photos could not be uploaded. The declaration was saved.',
        );
      }

      // Scans of the seller's own ID documents, same non-blocking contract and
      // addressed per document.
      const idProofResult = await uploadPendingIdProofPhotos(
        dispatch,
        latest,
        values.idProofs,
      );
      latest = idProofResult.declaration;
      setSaved(latest);
      if (idProofResult.failed) {
        toast.error(
          t('declaration.idProof.photos.uploadFailed') ||
            'ID photos could not be uploaded. The declaration was saved.',
        );
      }

      // Witness ID proof, same non-blocking contract. No retry banner: that
      // one re-sends ornament photos, and these are addressed per witness.
      const witnessResult = await uploadPendingWitnessPhotos(
        dispatch,
        latest,
        values.witnesses,
      );
      if (witnessResult.declaration !== latest) {
        setSaved(witnessResult.declaration);
      }
      if (witnessResult.failed) {
        toast.error(
          t('declaration.witnesses.photos.uploadFailed') ||
            'Witness photos could not be uploaded. The declaration was saved.',
        );
      }
    } catch (err: any) {
      console.error('Declaration save failed:', err);
      setErrors(parseApiErrorList(err?.message || err));
      setShowErrors(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Deletes take effect on the server the moment they are confirmed, unlike
   * every other field on this form, which waits for Save. There is no staging
   * to be had: the photo lives on the saved record, and the endpoint addresses
   * it there. PhotoField confirms first for exactly that reason.
   *
   * The refreshed declaration lands in the store, and `editing` feeds the
   * pickers — so the thumbnail disappears without this screen tracking it.
   */
  const handleDeleteItemPhoto = async (
    itemId: string | undefined,
    fileId: string,
  ): Promise<boolean> => {
    if (!editId || !itemId) return false;
    if (impersonateUserId) {
      setBlockModalVisible(true);
      return false;
    }
    const action = await dispatch(
      removeDeclarationItemPhoto({ declarationId: editId, itemId, fileId }),
    );
    if (removeDeclarationItemPhoto.fulfilled.match(action)) return true;
    toast.error(
      String((action as any).payload || '') ||
        t('declaration.photos.deleteFailed') ||
        'Photo could not be removed.',
    );
    return false;
  };

  const handleDeleteIdProofPhoto = async (
    idProofId: string,
    fileId: string,
  ): Promise<boolean> => {
    if (!editId) return false;
    if (impersonateUserId) {
      setBlockModalVisible(true);
      return false;
    }
    const action = await dispatch(
      removeIdProofPhoto({ declarationId: editId, idProofId, fileId }),
    );
    if (removeIdProofPhoto.fulfilled.match(action)) return true;
    toast.error(
      String((action as any).payload || '') ||
        t('declaration.photos.deleteFailed') ||
        'Photo could not be removed.',
    );
    return false;
  };

  const handleDeleteWitnessPhoto = async (
    witnessId: string,
    fileId: string,
  ): Promise<boolean> => {
    if (!editId) return false;
    if (impersonateUserId) {
      setBlockModalVisible(true);
      return false;
    }
    const action = await dispatch(
      removeWitnessPhoto({ declarationId: editId, witnessId, fileId }),
    );
    if (removeWitnessPhoto.fulfilled.match(action)) return true;
    toast.error(
      String((action as any).payload || '') ||
        t('declaration.photos.deleteFailed') ||
        'Photo could not be removed.',
    );
    return false;
  };

  const handleRetryPhotos = async () => {
    if (!saved || failedPhotos.length === 0) return;
    const action = await dispatch(
      uploadPurchaseOldGoldPhotos({ declarationId: saved.id, photos: failedPhotos }),
    );
    if (uploadPurchaseOldGoldPhotos.fulfilled.match(action) && action.payload) {
      setSaved(action.payload as PurchaseOldGold);
      setFailedPhotos([]);
    } else {
      toast.error(t('declaration.photos.uploadFailed') || 'Photos could not be uploaded.');
    }
  };

  const handlePrint = async () => {
    if (!saved) return;
    await printDeclarationAction(saved, shopDetails, declarationLanguage, t);
  };

  const handleShare = async () => {
    if (!saved) return;
    await shareDeclarationAction(saved, shopDetails, declarationLanguage, t);
  };

  const handleEndSession = () => {
    dispatch(endImpersonation());
    dispatch(clearUserData());
    navigation.navigate('AdminDashboard');
  };

  return (
    <Box flex={1} bg="$white">
      <Box flex={1}>
        {step === 'form' && (
          <DeclarationForm
            // Preserved values win for everything the shopkeeper typed, but the
            // customer's phone is re-read from the store: a trip to add the
            // missing number has to come back with the number, not with the
            // blank that was captured on the way out.
            initialValues={
              values
                ? { ...values, customerPhone: customer?.phone || values.customerPhone }
                : initialValues
            }
            isSubmitting={isSubmitting}
            isEditMode={!!editId}
            onBack={() => navigation.goBack()}
            // A saved declaration's counterparty is fixed — the backend's
            // update endpoint ignores customerId, so offering the picker would
            // promise a change that never happens.
            onChangeCustomer={editId ? undefined : handleChangeCustomer}
            onDirtyChange={setFormHasInput}
            // Only in edit mode: nothing is uploaded yet while creating, so
            // there is nothing for these to address.
            savedDeclaration={editing}
            onDeleteItemPhoto={editId ? handleDeleteItemPhoto : undefined}
            onDeleteWitnessPhoto={editId ? handleDeleteWitnessPhoto : undefined}
            onDeleteIdProofPhoto={editId ? handleDeleteIdProofPhoto : undefined}
            onSubmit={next => {
              setValues(next);
              setStep('preview');
            }}
          />
        )}

        {step === 'preview' && values && (
          <DeclarationPreview
            values={values}
            isSubmitting={isSubmitting}
            onBack={() => setStep('form')}
            onConfirm={handleSave}
          />
        )}

        {step === 'success' && saved && (
          <Box flex={1} bg="$coolGray50" p="$6" justifyContent="center">
            <VStack space="xl" style={LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}}>
              <Center>
                <Box bg="$green100" p="$4" rounded="$full" mb="$4">
                  <Icon as={CheckCircleIcon} size="xl" color="$green600" />
                </Box>
                <Text fontWeight="$bold" fontSize="$2xl" color="$coolGray800">
                  {t('declaration.saved') || 'Declaration Saved'}
                </Text>
                <Text color="$coolGray500" mt="$1">
                  {saved.declarationNumber}
                </Text>
                <Text color="$coolGray600" mt="$2" textAlign="center">
                  {(t('declaration.savedFor') || 'Declaration for {name}').replace(
                    '{name}',
                    saved.customerSnapshot?.name || '',
                  )}
                </Text>
              </Center>

              <VStack space="md" mt="$8">
                {failedPhotos.length > 0 && (
                  <TouchableOpacity style={styles.warningButton} onPress={handleRetryPhotos}>
                    <Icon as={RefreshCw} size="sm" mr="$2" color="#B45309" />
                    <Text color="#B45309">
                      {t('declaration.photos.retryUpload') || 'Retry photo upload'}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.outlineButton} onPress={handlePrint}>
                  <Icon as={Printer} size="sm" mr="$2" />
                  <Text>{t('declaration.print') || 'Print Declaration'}</Text>
                </TouchableOpacity>
                <PrintTargetNote mt="$0" />

                <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                  <Icon as={Share2} size="sm" mr="$2" color="$white" />
                  <Text color="$white" fontWeight="$medium">
                    {t('declaration.share') || 'Share Declaration'}
                  </Text>
                </TouchableOpacity>

                <GradientButton
                  label={t('common.done') || 'Done'}
                  // Reset rather than goBack: this screen is reached through
                  // the customer picker, so going back one step landed the
                  // shopkeeper in SelectCustomer, mid-way through choosing a
                  // customer for a purchase they had just finished. The whole
                  // flow is done, so the stack it was built on goes with it -
                  // the same thing AdvanceOrderSuccessScreen does when its
                  // flow ends.
                  onPress={() =>
                    navigation.reset({
                      index: 0,
                      routes: [{ name: 'MainTabs', params: { screen: 'Dashboard' } }],
                    })
                  }
                  style={styles.doneButton}
                />
              </VStack>
            </VStack>
          </Box>
        )}
      </Box>

      <DiscardChangesModal
        visible={discardGuard.promptVisible}
        onCancel={discardGuard.cancelDiscard}
        onDiscard={discardGuard.confirmDiscard}
        title={t('common.discard.declarationTitle')}
      />
      <ValidationErrorModal
        isOpen={showErrors}
        errors={errors}
        onClose={() => setShowErrors(false)}
      />
      <ImpersonationBlockModal
        isOpen={blockModalVisible}
        phone={impersonatePhone || ''}
        onEndSession={handleEndSession}
        onClose={() => setBlockModalVisible(false)}
      />
    </Box>
  );
};

const styles = StyleSheet.create({
  doneButton: { marginTop: 8 },
  outlineButton: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareButton: {
    height: 56,
    borderRadius: 12,
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default OldGoldPurchaseScreen;
