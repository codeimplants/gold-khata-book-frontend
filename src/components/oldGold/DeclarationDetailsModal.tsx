import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Box,
  HStack,
  VStack,
  Text,
  Pressable,
  Icon,
  Switch,
} from '@gluestack-ui/themed';
import { ChevronDown, ChevronUp, X, PenLine, RotateCw } from 'lucide-react-native';
import { SvgXml } from 'react-native-svg';

import { Section, Field, ChoiceRow, IdProofList } from './DeclarationForm';
import DeclarationCustomerSection, {
  useDeclarationPhoneValidation,
} from './DeclarationCustomerSection';
import WitnessPhotoPicker from './WitnessPhotoPicker';
import Collapsible from '../common/Collapsible';
import { ToastViewport } from '../common/Toast';
import GradientButton from '../common/GradientButton';
import LanguagePicker from '../common/LanguagePicker';
import SelectField from '../common/SelectField';
import ValidationErrorModal from '../ValidationErrorModal';
import SignatureCaptureModal from '../common/SignatureCaptureModal';
import { rotateSignatureSvg, canRotateSignature } from '../../utils/signature';
import { useTranslation } from '../../hooks/useTranslation';
import { INPUT_LIMITS } from '../../constants/inputLimits';
import { LAYOUT } from '../../constants/layout';
import type { DeclarationFormValues, PayoutMethod } from '../../types';

const PURPLE = '#6D5EF7';

interface DeclarationDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Fully prefilled: date, customer, ornament items and any photos already
   * captured in the exchange section are all fixed by the time this opens.
   * This modal only collects what those don't already cover — ownership,
   * ID proof, purchase receipt, payout, witnesses — so `idProofType` /
   * `idProofNumber` should already carry the customer's saved ID proof when
   * available (prefill, not lock: the actual seller may be a family member).
   */
  initialValues: DeclarationFormValues;
  isSubmitting?: boolean;
  onSubmit: (values: DeclarationFormValues) => void;
}

/**
 * Bottom-sheet capture for the fields a declaration needs beyond what the
 * exchange itself already supplies.
 *
 * Reachable from two places, both non-blocking: right after an invoice or
 * advance order with "Generate Declaration" ticked finishes saving, and later
 * from Order Details' "Generate Declaration" button if it was skipped the
 * first time. Neither path can fail the underlying sale — the order or
 * invoice is already saved by the time this ever opens.
 *
 * This is the DeclarationDetailsModal originally planned for the invoice-
 * exchange path before a full-screen prefilled navigation was built instead
 * (see OldGoldPurchaseScreen). Built now because a standalone declaration
 * still needs its own screen (ornaments, photos, date — nothing to prefill
 * from), but an exchange's declaration has everything except these few
 * fields, and asking for those via a full-screen navigation was the exact
 * "separate fill step" friction this replaces.
 */
const DeclarationDetailsModal = ({
  isOpen,
  onClose,
  initialValues,
  isSubmitting,
  onSubmit,
}: DeclarationDetailsModalProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [values, setValues] = useState(initialValues);
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  // Outlives showErrors deliberately: that one goes false the moment the error
  // dialog is dismissed, which is exactly when the shopkeeper starts looking
  // for the field it was complaining about.
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const validatePhone = useDeclarationPhoneValidation(initialValues.customerId);

  // Reseed whenever a fresh prefill arrives (e.g. reopened later from Order
  // Details with the customer's ID proof now on file where it wasn't before).
  React.useEffect(() => {
    if (isOpen) setValues(initialValues);
  }, [isOpen, initialValues]);

  const set = <K extends keyof DeclarationFormValues>(key: K, value: DeclarationFormValues[K]) =>
    setValues(v => ({ ...v, [key]: value }));

  const setPayout = (patch: Partial<DeclarationFormValues['payout']>) =>
    setValues(v => ({ ...v, payout: { ...v.payout, ...patch } }));

  const phoneError = validatePhone(values.customerPhone);

  const validate = (): string[] => {
    const list: string[] = [];
    // First, because it is the one field here that decides whether the
    // declaration can be saved at all: the server snapshots the customer record
    // and refuses a declaration for a customer with no number. Collected on this
    // sheet rather than sent back to the customer screen — an exchange's
    // declaration is filled in with the customer standing at the counter.
    if (phoneError) list.push(phoneError);
    if (!values.ownerIsSelf && !values.familyMemberName?.trim()) {
      list.push(
        t('declaration.ownership.familyMemberRequired') ||
          'Please name the family member who owns the ornaments',
      );
    }
    const idProofs = values.idProofs || [];
    if (!idProofs.some(e => e.number.trim())) {
      list.push(
        t('declaration.idProof.required') || 'ID proof type and number are required',
      );
    } else if (idProofs.some(e => !e.number.trim())) {
      list.push(
        t('declaration.idProof.incomplete') || 'Please complete or remove the blank ID proof',
      );
    }
    if (idProofs.some(e => e.type === 'other' && !e.otherLabel?.trim())) {
      list.push(
        t('declaration.idProof.otherRequired') || 'Please name the ID proof document',
      );
    }
    if (values.payout.method === 'online' && !values.payout.onlineType) {
      list.push(
        t('declaration.payout.onlineTypeRequired') ||
          'Please select an online payment type',
      );
    }
    return list;
  };

  const handleSubmit = () => {
    const found = validate();
    if (found.length > 0) {
      setErrors(found);
      setShowErrors(true);
      setSubmitAttempted(true);
      return;
    }
    onSubmit(values);
  };

  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
      <Box flex={1} bg="rgba(0,0,0,0.45)" justifyContent="flex-end">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheetWrapper}
        >
          <Box bg="$coolGray50" style={styles.sheet}>
            <HStack justifyContent="space-between" alignItems="center" px="$5" pt="$4" pb="$2">
              <VStack>
                <Text fontWeight="$bold" fontSize={17} color="$coolGray900">
                  {t('declaration.title') || 'Declaration / Affidavit'}
                </Text>
                <Text fontSize={12} color="$coolGray500">
                  {values.customerName}
                </Text>
              </VStack>
              <Pressable onPress={onClose} p="$2">
                <Icon as={X} size="md" color="$coolGray500" />
              </Pressable>
            </HStack>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                styles.content,
                { paddingBottom: 24 + insets.bottom },
              ]}
            >
              {/* Customer. The phone and portrait collected here are written to
                  the profile before the declaration is created — see
                  DeclarationCustomerSection. */}
              <DeclarationCustomerSection
                customerId={values.customerId}
                name={values.customerName}
                phone={values.customerPhone}
                onChangePhone={v => set('customerPhone', v)}
                photo={values.customerPhoto}
                onChangePhoto={p => set('customerPhoto', p)}
                hasPhoneError={submitAttempted && !!phoneError}
              />

              {/* Ownership */}
              <Section title={t('declaration.ownership.title') || 'Ownership'}>
                <VStack space="md">
                  <Text fontSize={12} color="$coolGray600">
                    {t('declaration.ownership.question') ||
                      'Who do the ornaments belong to?'}
                  </Text>
                  <ChoiceRow
                    value={values.ownerIsSelf ? 'self' : 'family'}
                    options={[
                      {
                        label: t('declaration.ownership.optionSelf') || 'The customer',
                        value: 'self',
                      },
                      {
                        label: t('declaration.ownership.optionFamily') || 'A family member',
                        value: 'family',
                      },
                    ]}
                    onChange={v => {
                      const isSelf = v === 'self';
                      set('ownerIsSelf', isSelf);
                      // Drop the name once the goods are the seller's own, so a
                      // changed mind cannot leave a stray name on the
                      // document's central assertion.
                      if (isSelf) set('familyMemberName', '');
                    }}
                  />

                  {!values.ownerIsSelf && (
                    <Field
                      label={t('declaration.ownership.familyMemberName') || 'Family Member Name *'}
                      value={values.familyMemberName}
                      placeholder={t('declaration.ownership.familyMemberPlaceholder')}
                      maxLength={INPUT_LIMITS.familyMemberName}
                      onChangeText={v => set('familyMemberName', v)}
                    />
                  )}
                </VStack>
              </Section>

              {/* ID proof */}
              <Section title={t('declaration.idProof.title') || 'ID Proof'}>
                <IdProofList
                  entries={values.idProofs}
                  onChange={next => set('idProofs', next)}
                />
              </Section>

              {/* Purchase receipt */}
              <Section title={t('declaration.receipt.title') || 'Purchase Receipt'}>
                <VStack space="md">
                  <Text fontSize={12} color="$coolGray600">
                    {t('declaration.receipt.question') ||
                      'Does the customer have the purchase receipt?'}
                  </Text>
                  <ChoiceRow
                    value={
                      values.hasPurchaseReceipt === undefined
                        ? undefined
                        : values.hasPurchaseReceipt
                          ? 'yes'
                          : 'no'
                    }
                    options={[
                      { label: t('common.yes') || 'Yes', value: 'yes' },
                      { label: t('common.no') || 'No', value: 'no' },
                    ]}
                    onChange={v => {
                      const yes = v === 'yes';
                      setValues(prev => ({
                        ...prev,
                        hasPurchaseReceipt: yes,
                        // Clear whichever answer no longer applies.
                        ...(yes
                          ? { noReceiptReason: '' }
                          : { purchaseReceiptDetails: '' }),
                      }));
                    }}
                  />

                  {values.hasPurchaseReceipt === true && (
                    <Field
                      label={t('declaration.receipt.details') || 'Details of Purchase Receipt'}
                      value={values.purchaseReceiptDetails}
                      placeholder={t('declaration.receipt.detailsPlaceholder')}
                      maxLength={INPUT_LIMITS.purchaseReceiptDetails}
                      onChangeText={v => set('purchaseReceiptDetails', v)}
                    />
                  )}

                  {values.hasPurchaseReceipt === false && (
                    <Field
                      label={t('declaration.receipt.noReason') || 'Reason for not having a receipt'}
                      value={values.noReceiptReason}
                      placeholder={t('declaration.receipt.noReasonPlaceholder')}
                      maxLength={INPUT_LIMITS.noReceiptReason}
                      multiline
                      onChangeText={v => set('noReceiptReason', v)}
                    />
                  )}
                </VStack>
              </Section>

              {/* Witnesses */}
              <Section
                title={t('declaration.witnesses.title') || 'Witnesses'}
                subtitle={t('declaration.witnesses.subtitle')}
              >
                <VStack space="md">
                  {[0, 1].map(index => (
                    <VStack key={index} space="sm">
                      <HStack space="sm">
                        <Field
                          label={(t('declaration.witnesses.name') || 'Witness {number} Name').replace(
                            '{number}',
                            String(index + 1),
                          )}
                          value={values.witnesses[index]?.name || ''}
                          maxLength={INPUT_LIMITS.witnessName}
                          onChangeText={v => {
                            const next = [...values.witnesses];
                            next[index] = { ...next[index], name: v };
                            set('witnesses', next);
                          }}
                        />
                        <Field
                          label={(t('declaration.witnesses.phone') || 'Witness {number} Phone').replace(
                            '{number}',
                            String(index + 1),
                          )}
                          value={values.witnesses[index]?.phone || ''}
                          keyboardType="number-pad"
                          maxLength={INPUT_LIMITS.phone}
                          onChangeText={v => {
                            const next = [...values.witnesses];
                            next[index] = { ...next[index], phone: v };
                            set('witnesses', next);
                          }}
                        />
                      </HStack>

                      {/* Only once the witness is named — same rule as the
                          standalone declaration form. */}
                      {!!values.witnesses[index]?.name?.trim() && (
                        <WitnessPhotoPicker
                          photos={values.witnesses[index]?.pendingPhotos || []}
                          onChange={photos => {
                            const next = [...values.witnesses];
                            next[index] = { ...next[index], pendingPhotos: photos };
                            set('witnesses', next);
                          }}
                        />
                      )}
                    </VStack>
                  ))}
                </VStack>
              </Section>

              {/* Payout */}
              <Section
                title={t('declaration.payout.title') || 'Payment to Customer'}
                subtitle={t('declaration.payout.subtitle')}
              >
                <VStack space="md">
                  <HStack space="sm">
                    {(['cash', 'online', 'none'] as PayoutMethod[]).map(method => {
                      const selected = values.payout.method === method;
                      return (
                        <Pressable
                          key={method}
                          flex={1}
                          onPress={() => {
                            setPayout({
                              method,
                              onlineType: method === 'online' ? values.payout.onlineType : undefined,
                            });
                          }}
                        >
                          <Box
                            rounded="$lg"
                            borderWidth={1}
                            borderColor={selected ? PURPLE : '$coolGray200'}
                            bg={selected ? '#EEF2FF' : '$white'}
                            py="$3"
                            alignItems="center"
                          >
                            <Text
                              fontSize={13}
                              fontWeight="$bold"
                              color={selected ? '#4F46E5' : '$coolGray600'}
                            >
                              {t(`declaration.payout.${method}`) || method}
                            </Text>
                          </Box>
                        </Pressable>
                      );
                    })}
                  </HStack>

                  {values.payout.method === 'none' && (
                    <Text fontSize={12} color="$coolGray500">
                      {t('declaration.payout.noneHint')}
                    </Text>
                  )}

                  {values.payout.method === 'online' && (
                    <VStack space="xs">
                      <Text fontSize={12} color="$coolGray600">
                        {t('declaration.payout.onlineType') || 'Online Type'}
                      </Text>
                      <SelectField
                        value={values.payout.onlineType || ''}
                        items={(
                          ['upi', 'bank_transfer', 'cheque', 'card', 'other'] as const
                        ).map(v => ({
                          label: t(`declaration.payout.${v}`) || v,
                          value: v,
                        }))}
                        placeholder={t('declaration.payout.selectType')}
                        title={t('declaration.payout.onlineType') || 'Online Type'}
                        onValueChange={v => setPayout({ onlineType: v as any })}
                      />
                    </VStack>
                  )}

                  {/* Online only — cash has no reference or bank details. */}
                  {values.payout.method === 'online' && (
                    <>
                      <Field
                        label={t('declaration.payout.reference') || 'Transaction / Cheque No.'}
                        value={values.payout.reference}
                        placeholder={t('declaration.payout.referencePlaceholder')}
                        maxLength={INPUT_LIMITS.payoutReference}
                        onChangeText={v => setPayout({ reference: v })}
                      />

                      <Pressable onPress={() => setShowBankDetails(v => !v)}>
                        <HStack justifyContent="space-between" alignItems="center" py="$2">
                          <VStack flex={1}>
                            <Text fontSize={13} fontWeight="$medium" color="$coolGray700">
                              {t('declaration.payout.bankDetails') || 'Customer Bank Details'}
                            </Text>
                            <Text fontSize={11} color="$coolGray500">
                              {t('declaration.payout.bankDetailsHint')}
                            </Text>
                          </VStack>
                          <Icon
                            as={showBankDetails ? ChevronUp : ChevronDown}
                            size="sm"
                            color="$coolGray500"
                          />
                        </HStack>
                      </Pressable>

                      <Collapsible expanded={showBankDetails}>
                        <VStack space="sm">
                          <Field
                            label={t('declaration.payout.bankName') || 'Bank Name'}
                            value={values.payout.bankName}
                            maxLength={INPUT_LIMITS.bankName}
                            onChangeText={v => setPayout({ bankName: v })}
                          />
                          <Field
                            label={t('declaration.payout.bankAccountName') || 'Account Holder Name'}
                            value={values.payout.bankAccountName}
                            maxLength={INPUT_LIMITS.bankAccountName}
                            onChangeText={v => setPayout({ bankAccountName: v })}
                          />
                          <HStack space="sm">
                            <Field
                              label={t('declaration.payout.bankAccountNumber') || 'Account Number'}
                              value={values.payout.bankAccountNumber}
                              keyboardType="number-pad"
                              maxLength={INPUT_LIMITS.bankAccountNumber}
                              onChangeText={v => setPayout({ bankAccountNumber: v })}
                            />
                            <Field
                              label={t('declaration.payout.bankIfsc') || 'IFSC Code'}
                              value={values.payout.bankIfsc}
                              maxLength={INPUT_LIMITS.ifsc}
                              autoCapitalize="characters"
                              onChangeText={v => setPayout({ bankIfsc: v })}
                            />
                          </HStack>
                          <Field
                            label={t('declaration.payout.upiId') || 'UPI ID'}
                            value={values.payout.upiId}
                            autoCapitalize="none"
                            maxLength={INPUT_LIMITS.upiId}
                            onChangeText={v => setPayout({ upiId: v })}
                          />
                        </VStack>
                      </Collapsible>
                    </>
                  )}
                </VStack>
              </Section>

              {/* On by default, unlike the bill's photo toggle: a declaration is the
                  shop's record of what it took in, and the photograph is the evidence
                  it exists to hold. Offered so it can be turned off - a shopkeeper
                  printing a short affidavit may not want six pictures on it - but the
                  useful position is on. */}
              <Section
                title={t('declaration.photosOnDoc.title') || 'Print photos on the declaration'}
                subtitle={
                  t('declaration.photosOnDoc.subtitle') ||
                  'On by default — the photos are the record of what came in'
                }
              >
                <HStack alignItems="center" justifyContent="space-between" space="md">
                  <Text fontSize={13} color="$coolGray500" flex={1}>
                    {t('declaration.photosOnDoc.hint') ||
                      'Ornament photos are printed under the declaration'}
                  </Text>
                  <Switch
                    value={values.includePhotosOnDeclaration !== false}
                    onValueChange={(next: boolean) => set('includePhotosOnDeclaration', next)}
                  />
                </HStack>
              </Section>
              {/* Optional throughout. A declaration printed and signed by hand
                  is exactly as valid, and is how every one of them worked
                  before this existed — so this offers the signature, it never
                  demands it. */}
              <Section
                title={t('declaration.signature.title') || 'Customer Signature'}
                subtitle={
                  t('declaration.signature.hint') ||
                  'Optional. Hand the device to the customer to sign.'
                }
              >
                {values.customerSignature ? (
                  <VStack space="sm">
                    <Box
                      bg="$white"
                      borderWidth={1}
                      borderColor="$coolGray200"
                      rounded="$xl"
                      h={110}
                      alignItems="center"
                      justifyContent="center"
                      p="$2"
                    >
                      <SvgXml
                        xml={values.customerSignature}
                        width="100%"
                        height="100%"
                      />
                    </Box>
                    <HStack space="sm">
                      {/* People turn the phone sideways to sign, which stores
                          the signature at ninety degrees to the line it has
                          to sit on in the printed document. Lossless: the
                          value is a cropped SVG, so this transforms its
                          viewBox rather than re-rendering the ink. */}
                      {canRotateSignature(values.customerSignature) && (
                        <Pressable
                          onPress={() =>
                            set(
                              'customerSignature',
                              rotateSignatureSvg(values.customerSignature as string),
                            )
                          }
                          accessibilityLabel={t('declaration.signature.rotate') || 'Rotate'}
                        >
                          <Box
                            rounded="$xl"
                            borderWidth={1}
                            borderColor="$coolGray300"
                            py="$3"
                            px="$4"
                            alignItems="center"
                          >
                            <RotateCw size={18} color="#4B5563" />
                          </Box>
                        </Pressable>
                      )}
                      <Pressable flex={1} onPress={() => setShowSignature(true)}>
                        <Box
                          rounded="$xl"
                          borderWidth={1}
                          borderColor="$coolGray300"
                          py="$3"
                          alignItems="center"
                        >
                          <Text fontWeight="$medium" color="$coolGray700">
                            {t('declaration.signature.redo') || 'Sign again'}
                          </Text>
                        </Box>
                      </Pressable>
                      <Pressable
                        flex={1}
                        onPress={() => set('customerSignature', undefined)}
                      >
                        <Box
                          rounded="$xl"
                          borderWidth={1}
                          borderColor="#FECACA"
                          py="$3"
                          alignItems="center"
                        >
                          <Text fontWeight="$medium" color="#DC2626">
                            {t('common.remove') || 'Remove'}
                          </Text>
                        </Box>
                      </Pressable>
                    </HStack>
                  </VStack>
                ) : (
                  <Pressable onPress={() => setShowSignature(true)}>
                    <Box
                      rounded="$xl"
                      borderWidth={1}
                      borderColor="$coolGray300"
                      borderStyle="dashed"
                      py="$5"
                      alignItems="center"
                    >
                      <HStack space="sm" alignItems="center">
                        <PenLine size={18} color="#6D5EF7" />
                        <Text fontWeight="$medium" color="#6D5EF7">
                          {t('declaration.signature.take') ||
                            'Take customer signature'}
                        </Text>
                      </HStack>
                    </Box>
                  </Pressable>
                )}
              </Section>

              {/* Last card before the button, matching DeclarationForm: the
                  modal itself stays in the app language and only the printed
                  document changes. */}
              <Section
                title={t('declaration.language.title') || 'Declaration Language'}
                subtitle={t('declaration.language.hint')}
              >
                <LanguagePicker
                  value={values.language}
                  onChange={lang => set('language', lang)}
                />
              </Section>

              <Box mt="$2">
                <GradientButton
                  label={
                    isSubmitting
                      ? t('common.loading') || 'Loading…'
                      : t('declaration.saveAndPrint') || 'Save Declaration'
                  }
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                />
              </Box>
            </ScrollView>
          </Box>
        </KeyboardAvoidingView>
      </Box>

      <ValidationErrorModal
        isOpen={showErrors}
        errors={errors}
        onClose={() => setShowErrors(false)}
      />

      <SignatureCaptureModal
        isOpen={showSignature}
        onClose={() => setShowSignature(false)}
        title={t('declaration.signature.title') || 'Customer Signature'}
        signerLabel={values.customerName}
        onSave={svg => {
          set('customerSignature', svg);
          setShowSignature(false);
        }}
      />

      {/* The photo pickers in here report a failed pick with a toast, and the
          root viewport is under this modal's own native layer. Without one of
          its own, a pick that fails is silent. */}
      <ToastViewport />
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheetWrapper: {
    maxHeight: '88%',
    ...LAYOUT.sheetSurfaceStyle,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '100%',
    overflow: 'hidden',
  },
  content: {
    padding: 16,
    gap: 12,
  },
});

export default DeclarationDetailsModal;
