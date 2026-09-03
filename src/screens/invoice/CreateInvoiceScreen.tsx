import React, { useEffect, useMemo, useState } from 'react';
import { Box, HStack, Text, Pressable } from '@gluestack-ui/themed';
import { AlertTriangle, ChevronRight } from 'lucide-react-native';
import { Alert, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { addOrder, updateInvoiceOrder, fetchShopDetails, clearUserData, decrementCatalogStock, uploadInvoiceOrnamentPhotos, uploadAllItemPhotos, uploadAllExchangePhotos, uploadPurchaseOldGoldPhotos, removeItemPhoto, removeExchangePhoto } from '../../store/data/dataSlice';
import DeclarationDetailsModal from '../../components/oldGold/DeclarationDetailsModal';
import DeclarationGeneratedSheet from '../../components/oldGold/DeclarationGeneratedSheet';
import { generateDeclaration as saveDeclarationRecord, buildExchangeDeclarationPrefill } from '../../utils/declarationHelpers';
import { printDeclarationAction, shareDeclarationAction } from '../../print/declarationActions';
import type { DeclarationFormValues, PurchaseOldGold } from '../../types';
import { endImpersonation } from '../../store/auth/authSlice';
import { toast } from '../../components/common/Toast';
import ImpersonationBlockModal from '../../components/ImpersonationBlockModal';
import { parseApiErrorList } from '../../utils/errorUtils';

import InvoiceCreationScreen from '../../components/InvoiceCreationScreen';
import InvoicePreviewScreen from '../../components/InvoicePreviewScreen';
import InvoiceSuccessScreen from '../../components/InvoiceSuccessScreen';
import ValidationErrorModal from '../../components/ValidationErrorModal';
import DiscardChangesModal from '../../components/DiscardChangesModal';
import { useDiscardGuard } from '../../hooks/useDiscardGuard';

import { JewelleryFormValues, BillItem, ExchangeItem } from '../../types';
import { calculateItemValues, optionalNumberField } from '../../utils/calculations';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

import { buildBillHTML } from '../../print/billTemplate';
import { useTranslation } from '../../hooks/useTranslation';
import { usePrintBill } from '../../hooks/usePrintBill';
import { prepareShopForPrint, prepareBillForPrint } from '../../utils/imageUtils';
import { openWhatsApp } from '../../utils/whatsappUtils';
import Share from 'react-native-share';
import {
  buildPdfFileName,
  generateInvoicePDF,
  sharePDF,
  downloadPDFToDevice,
} from '../../utils/pdfService';

type Step = 'create' | 'preview' | 'success';

const mapMakingType = (raw?: string): BillItem['makingChargeType'] => {
  const t = (raw || '').toLowerCase();
  if (t === 'pergram' || t === 'per gram') return 'Per Gram';
  if (t === 'percentage' || t === 'percent' || t === '%') return 'Percentage';
  return 'Fixed';
};

const mapDiscountType = (raw?: string): BillItem['discountType'] => {
  const t = (raw || '').toLowerCase();
  return t === 'percentage' || t === 'percent' || t === '%' ? 'Percentage' : 'Fixed';
};

// Maps a persisted invoice (Order with type 'full') back into the form's
// JewelleryFormValues shape so InvoiceCreationScreen's existing `initialData`
// prefill mechanism (built for restoring an in-progress form) can also drive
// edit mode.
/**
 * @param hasDeclaration whether a declaration already exists for this bill.
 *   Passed in rather than looked up here, because this is a pure mapper and
 *   the declarations live in the store.
 */
const mapStoredInvoiceToFormValues = (
  order: any,
  customer: any,
  hasDeclaration = false,
): JewelleryFormValues => {
  const items: BillItem[] = (order.items || []).map((it: any, idx: number) => {
    const base: BillItem = {
      id: it.id || it._id || `edit_${idx}`,
      itemName: it.name || '',
      sourceItemId: it.sourceItemId,
      huid: it.huid || '',
      metalType: it.itemType || 'Gold',
      purity: it.purity || '22K',
      pcs: String(it.pieces ?? 1),
      // Zero-as-blank for the optional numeric fields, same as the
      // catalog-product autofill. A persisted item stores 0 for anything left
      // empty, so without this, editing an invoice puts a literal "0" in
      // Making Charges / Discount that has to be cleared before typing.
      // Gross weight and rate are effectively always set on a real invoice, but
      // go through the same helper so the rule is uniform.
      grossWt: optionalNumberField(it.grossWeight),
      lessWt: optionalNumberField(it.lessWeight),
      netWt: String(it.netWeight ?? (Number(it.grossWeight || 0) - Number(it.lessWeight || 0))),
      ratePerGm: optionalNumberField(it.rate),
      makingChargeType: mapMakingType(it.makingType),
      makingCharges: optionalNumberField(it.makingCharge),
      otherChargesDescription: it.chargeDescription || '',
      otherChargesAmount: optionalNumberField(it.chargeAmount),
      discountType: mapDiscountType(it.discountType),
      discount: optionalNumberField(it.discount),
      itemTotal: '',
      hsnCode: it.hsnCode || '7113',
      // Already uploaded against this invoice. Seeded so an edit shows the
      // photos the item has rather than an empty picker that reads as "no
      // photos were taken" — and so the picker opens rather than hiding them
      // behind a collapsed switch.
      photos: it.photos || [],
    };
    return { ...base, ...calculateItemValues(base) };
  });

  const exchanges: ExchangeItem[] = (order.exchanges || []).map((ex: any) => ({
    ...ex,
    amount: String(ex.amount ?? 0),
  }));

  return {
    invoiceDate: order.date
      ? new Date(order.date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    customerId: order.customerId,
    customerName: customer?.name || '',
    address: customer?.address || '',
    phone: customer?.phone || '',
    includeGst: !!order.includeGST,
    customerGstin: order.customerGstin || '',
    paymentMethod: order.paymentMethod || 'cash',
    onlinePaymentType: order.onlinePaymentType,
    items,
    exchanges,
    enableExchange: !!order.isOrnamentExchanges,
    includeItemPhotosOnBill: !!(order as any).includeItemPhotosOnBill,
    subtotal: String(order.subTotal ?? 0),
    gst: String(order.gstAmount ?? 0),
    gstPercentage: order.gstRate,
    // Reopened bills showed this off even when the exchange had produced a
    // declaration, because the flag is an instruction ("make one after
    // saving") and was never read back from what actually happened. On an
    // edit it is purely a statement of fact - generation only runs on the
    // create path - so reflecting reality here cannot produce a second
    // declaration.
    generateDeclaration: hasDeclaration,
    grandTotal: String(order.amount ?? 0),
  };
};

const CreateInvoiceScreen = () => {
  const navigation = useNavigation();
  const route =
    useRoute<
      NativeStackScreenProps<RootStackParamList, 'CreateInvoice'>['route']
    >();
  const dispatch = useAppDispatch();
  const editOrderId = (route.params as any)?.editOrderId as string | undefined;
  const { orders, customers, purchaseOldGold } = useAppSelector(s => s.data);
  const originalOrder = useMemo(
    () => (editOrderId ? orders.find(o => o.id === editOrderId) : undefined),
    [editOrderId, orders],
  );
  const { shopDetails } = useAppSelector(s => s.data);
  // Share/Download build their own PDF rather than going through printBill, so
  // they have to pick up the shop's paper themselves — otherwise a shop on
  // custom stationery would get a correctly-placed print and a full-A4 share.
  const paper = useAppSelector(s => s.printPrefs.paper);
  const { impersonateUserId, impersonatePhone } = useAppSelector(s => s.auth);
  const [blockModalVisible, setBlockModalVisible] = useState(false);

  const handleEndSession = () => {
    dispatch(endImpersonation());
    dispatch(clearUserData());
    (navigation as any).navigate('AdminDashboard');
  };
  const { t, invoiceLanguage, invoiceTemplate, declarationLanguage } = useTranslation();

  /**
   * Removes a photo already uploaded against a saved bill.
   *
   * The DELETE route, the thunk and its reducer all existed; nothing ever
   * called them, so the X on a saved tile stayed hidden and a wrong photo could
   * be added but never taken back. Adding a replacement already worked - the
   * edit path uploads pending item photos on save - so this was the missing
   * half, not the whole feature.
   */
  /** Removes a photo from one gold/silver exchange row on a saved bill. */
  const handleDeleteExchangePhoto = React.useCallback(
    async (exchangeIndex: number, fileId: string): Promise<boolean> => {
      if (!editOrderId) return false;
      if (impersonateUserId) {
        setBlockModalVisible(true);
        return false;
      }
      const action = await dispatch(
        removeExchangePhoto({ id: editOrderId, kind: 'invoice', exchangeIndex, fileId }),
      );
      if (removeExchangePhoto.fulfilled.match(action)) return true;
      toast.error(
        String((action as any).payload || '') ||
          t('declaration.photos.deleteFailed') ||
          'Photo could not be removed.',
      );
      return false;
    },
    [dispatch, editOrderId, impersonateUserId, t],
  );

  const handleDeleteItemPhoto = React.useCallback(
    async (itemIndex: number, fileId: string): Promise<boolean> => {
      if (!editOrderId) return false;
      if (impersonateUserId) {
        setBlockModalVisible(true);
        return false;
      }
      const action = await dispatch(
        removeItemPhoto({ id: editOrderId, kind: 'invoice', itemIndex, fileId }),
      );
      if (removeItemPhoto.fulfilled.match(action)) return true;
      toast.error(
        String((action as any).payload || '') ||
          t('declaration.photos.deleteFailed') ||
          'Photo could not be removed.',
      );
      return false;
    },
    [dispatch, impersonateUserId, t],
  );


  const {
    print: printBill,
    openChooser,
    targetLabel,
    canChoosePrinter,
    chooser: printerChooser,
  } = usePrintBill(invoiceLanguage, invoiceTemplate);

  useEffect(() => {
    dispatch(fetchShopDetails());
  }, [dispatch]);

  const [step, setStep] = useState<Step>('create');
  const [invoiceData, setInvoiceData] = useState<JewelleryFormValues | null>(
    null,
  );

  // Nothing on this screen is persisted until the preview is confirmed, so a
  // back press (header arrow, Android hardware back or iOS swipe) before that
  // throws the whole bill away. Reaching the preview always means items exist;
  // on the form step InvoiceCreationScreen reports whether anything was typed.
  const [formHasInput, setFormHasInput] = useState(false);
  const discardGuard = useDiscardGuard(
    step === 'preview' || (step === 'create' && formHasInput),
  );

  const [invoiceNo, setInvoiceNo] = useState<string>('---');

  // Declaration generated inline, right after this invoice saves — see the
  // "Generate Declaration" checkbox in the exchange section. Neither modal
  // can ever block or undo the invoice save: both open only after it has
  // already succeeded.
  const [declarationPrefill, setDeclarationPrefill] = useState<DeclarationFormValues | null>(null);
  const [declarationSaving, setDeclarationSaving] = useState(false);
  const [savedDeclaration, setSavedDeclaration] = useState<PurchaseOldGold | null>(null);
  const [declarationPhotosFailed, setDeclarationPhotosFailed] = useState(false);
  // Kept separately from declarationPrefill (which clears once saved) so a
  // failed upload can be retried without the source photos being lost.
  const [declarationRetryPhotos, setDeclarationRetryPhotos] = useState<
    JewelleryFormValues['ornamentPhotos']
  >([]);
  // Set once the invoice this declaration attaches to actually has an id —
  // editOrderId for an edit save, newly.id for a fresh one. The "Declaration /
  // Affidavit" button on the success screen needs this even when the
  // "Generate Declaration" checkbox was never ticked.
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | undefined>(editOrderId);

  useEffect(() => {
    // We can fetch the next invoice number from backend for display if we want,
    // but the backend will generate it anyway on save.
    setInvoiceNo(editOrderId ? (originalOrder?.invoiceNumber || '---') : 'PENDING');
  }, [editOrderId, originalOrder?.invoiceNumber]);

  useEffect(() => {
    if (!route.params?.customerId) {
      (navigation as any).replace('SelectCustomer', { next: 'CreateInvoice' });
    }
  }, [navigation, route.params?.customerId]);

  // Edit mode: prefill the form from the persisted invoice once it (and its
  // customer) are available in the store.
  useEffect(() => {
    if (!editOrderId || !originalOrder) return;
    const customer = customers.find(c => c.id === originalOrder.customerId);
    const hasDeclaration = (purchaseOldGold || []).some(
      (d: any) => d.orderId && String(d.orderId) === String(originalOrder.id),
    );
    setInvoiceData(
      mapStoredInvoiceToFormValues(originalOrder, customer, hasDeclaration),
    );
  }, [editOrderId, originalOrder, customers, purchaseOldGold]);

  useEffect(() => {
    const preserved = (route as any)?.params?.preservedInvoiceForm;
    if (!preserved) return;
    try {
      const parsed = JSON.parse(preserved) as JewelleryFormValues;
      setInvoiceData(parsed);
      setStep('create');
    } catch {
      // ignore
    }
  }, [(route as any)?.params?.preservedInvoiceForm]);

  //  PRINT — usePrintBill owns the first-run chooser, the saved preference and
  //  failure recovery, so this only has to supply the bill.
  const handlePrint = async () => {
    if (!invoiceData) return;
    const [printableShop, printableBill] = await Promise.all([
      prepareShopForPrint(shopDetails),
      prepareBillForPrint(invoiceData),
    ]);
    printBill(printableBill, {
      billNo: invoiceNo,
      billDate: new Date().toLocaleDateString(),
      mode: 'print',
      shopDetails: printableShop,
    });
  };

  // ✅ SHARE PDF ON WHATSAPP
  const handleShare = async () => {
    if (!invoiceData) return;

    try {
      const shopName =
        shopDetails?.shopName || shopDetails?.name || 'Gold Khata Book';

      const message =
        `🧾 Invoice from ${shopName}\n` +
        `Invoice No: ${invoiceNo}\n` +
        `Date: ${new Date().toLocaleDateString('en-IN')}\n` +
        `Customer: ${invoiceData.customerName}\n` +
        `Amount: ₹${invoiceData.grandTotal}\n\n` +
        `Thank you for your purchase! 🙏`;

      const [printableShop, printableBill] = await Promise.all([
        prepareShopForPrint(shopDetails),
        prepareBillForPrint(invoiceData),
      ]);
      const html = buildBillHTML(printableBill, {
        billNo: invoiceNo,
        billDate: new Date().toLocaleDateString('en-IN'),
        mode: 'print',
        shopDetails: printableShop,
        paper,
      }, invoiceLanguage, invoiceTemplate);
      const fileName = buildPdfFileName(invoiceNo, invoiceData.customerName);

      if (Platform.OS === 'web') {
        // react-native-html-to-pdf / react-native-share are stubbed out on the
        // web build (see webpack.config.js aliases). openWhatsApp's web
        // variant (whatsappUtils.web.ts) makes a best-effort attempt to
        // render this HTML to a PDF and attach it via the Web Share API,
        // falling back to a text-only wa.me link if that isn't supported.
        await openWhatsApp(invoiceData.phone, message, { html, fileName });
        return;
      }

      // Step 1 — generate the PDF
      const filePath = await generateInvoicePDF(html, fileName);
      if (!filePath) {
        toast.error('Could not generate invoice PDF');
        return;
      }

      const fileUri = filePath.startsWith('file://')
        ? filePath
        : `file://${filePath}`;

      try {
        // Step 2a — send PDF directly to WhatsApp.
        // Requires the <queries> entry in AndroidManifest for package visibility
        // on Android 11+, otherwise WhatsApp can't be resolved and this throws.
        await Share.shareSingle({
          social: (Share as any).Social?.WHATSAPP ?? 'whatsapp',
          url: fileUri,
          type: 'application/pdf',
          filename: fileName,
          message,
          failOnCancel: false,
        } as any);
      } catch (directShareError) {
        console.log('Direct WhatsApp share failed, falling back to share sheet:', directShareError);
        // Step 2b — fallback: open generic share sheet (user can pick WhatsApp)
        await sharePDF(filePath, 'Share Invoice');
      }
    } catch (err) {
      console.log('Share error:', err);
      toast.error('Could not share invoice');
    }
  };

  // Optional declaration for the old ornaments taken in on this invoice.
  // Hands the exchange rows to the shared declaration screen prefilled, so the
  // shopkeeper only has to add the ID proof and (optionally) photos.
  // The "Declaration / Affidavit" button on the success screen — for when
  // "Generate Declaration" was not ticked during creation but the shopkeeper
  // wants one anyway. Opens the same modal the checkbox opens automatically,
  // rather than navigating to a separate screen: the exchange already has
  // everything a declaration needs except what the modal asks for.
  const handleDeclaration = () => {
    if (!invoiceData || !savedInvoiceId) return;
    const customer = customers.find(c => c.id === invoiceData.customerId);
    setDeclarationPrefill(
      buildExchangeDeclarationPrefill({
        orderId: savedInvoiceId,
        customer,
        customerId: invoiceData.customerId || '',
        invoiceDate: invoiceData.invoiceDate,
        exchanges: invoiceData.exchanges,
        grandTotal: Number(invoiceData.grandTotal) || 0,
        pendingPhotos: invoiceData.ornamentPhotos,
        language: declarationLanguage,
      }),
    );
  };

  const handleGenerateDeclaration = async (values: DeclarationFormValues) => {
    setDeclarationSaving(true);
    try {
      const { declaration, photosFailed, idPhotosFailed, customerPhotoFailed } =
        await saveDeclarationRecord(dispatch, values);
      setDeclarationPrefill(null);
      setSavedDeclaration(declaration);
      setDeclarationPhotosFailed(photosFailed);
      setDeclarationRetryPhotos(photosFailed ? values.pendingPhotos : []);
      // Toasts rather than a retry banner: the retry above re-sends ornament
      // photos only, and the declaration itself is saved either way.
      if (idPhotosFailed) {
        toast.error(
          t('declaration.idProof.photos.uploadFailed') ||
            'ID photos could not be uploaded. The declaration was saved.',
        );
      }
      if (customerPhotoFailed) {
        toast.error(
          t('declaration.customer.photoUploadFailed') ||
            'The customer photo could not be uploaded. The declaration was saved without it.',
        );
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save declaration');
    } finally {
      setDeclarationSaving(false);
    }
  };

  const handleRetryDeclarationPhotos = async () => {
    if (!savedDeclaration || (declarationRetryPhotos?.length ?? 0) === 0) return;
    const action = await dispatch(
      uploadPurchaseOldGoldPhotos({
        declarationId: savedDeclaration.id,
        photos: declarationRetryPhotos!,
      }),
    );
    if (uploadPurchaseOldGoldPhotos.fulfilled.match(action) && action.payload) {
      setSavedDeclaration(action.payload as PurchaseOldGold);
      setDeclarationPhotosFailed(false);
      setDeclarationRetryPhotos([]);
    } else {
      toast.error('Photos could not be uploaded.');
    }
  };

  const handlePrintDeclaration = async () => {
    if (!savedDeclaration) return;
    await printDeclarationAction(savedDeclaration, shopDetails, declarationLanguage, t);
  };

  const handleShareDeclaration = async () => {
    if (!savedDeclaration) return;
    await shareDeclarationAction(savedDeclaration, shopDetails, declarationLanguage, t);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invoiceErrors, setInvoiceErrors] = useState<string[]>([]);
  const [showInvoiceErrorModal, setShowInvoiceErrorModal] = useState(false);

  const shopNameMissing = !String(shopDetails?.shopName || shopDetails?.name || '').trim();

  return (
    <Box flex={1} bg="$white">
      <Box flex={1}>
        {/* The one place a missing shop name has a real consequence: it is the
            header of the bill the customer keeps. Registration can be skipped
            now, so this is where the app asks again — motivated, and at the
            moment it matters, rather than as a wall between the OTP and the app.
            Non-blocking: the bill still saves, it just prints "Gold Khata Book". */}
        {step === 'create' && shopNameMissing && (
          <Pressable onPress={() => navigation.navigate('AddShopDetails' as never)}>
            <Box
              mx="$4" mt="$3" px="$4" py="$3" rounded="$xl" borderWidth={1}
              style={{ backgroundColor: 'rgba(217, 119, 6, 0.08)', borderColor: 'rgba(217, 119, 6, 0.25)' }}
            >
              <HStack alignItems="center" space="sm">
                <AlertTriangle size={16} color="#D97706" />
                <Text flex={1} fontSize={12} color="#92400E" fontWeight="$medium">
                  {t('invoice.shopNameMissing')}
                </Text>
                <ChevronRight size={14} color="#D97706" />
              </HStack>
            </Box>
          </Pressable>
        )}

        {step === 'create' && (
          <InvoiceCreationScreen
            onBack={() => navigation.goBack()}
            initialCustomerId={route.params?.customerId}
            initialData={invoiceData}
            isEditMode={!!editOrderId}
            // Only in edit mode: nothing is uploaded yet while creating, so
            // there is nothing for this to address.
            onDeleteItemPhoto={editOrderId ? handleDeleteItemPhoto : undefined}
            onDeleteExchangePhoto={editOrderId ? handleDeleteExchangePhoto : undefined}
            onDirtyChange={setFormHasInput}
            onCalculate={(data: JewelleryFormValues) => {
              setInvoiceData(data);
              setStep('preview');
            }}
          />
        )}

        {step === 'preview' && invoiceData && (
          <InvoicePreviewScreen
            data={invoiceData}
            isLoading={isSubmitting}
            onBack={() => setStep('create')}
            onConfirm={async () => {
              if (impersonateUserId) { setBlockModalVisible(true); return; }
              if (isSubmitting) return;

              const submitInvoice = async () => {
                setInvoiceErrors([]);
                setIsSubmitting(true);
                try {
                  if (editOrderId) {
                    const resultAction = await dispatch(
                      updateInvoiceOrder({
                        invoiceId: editOrderId,
                        order: {
                          customerId: invoiceData.customerId,
                          grandTotal: invoiceData.grandTotal,
                          subtotal: invoiceData.subtotal,
                          gst: invoiceData.gst,
                          includeGst: invoiceData.includeGst,
                          gstRate: (shopDetails as any)?.gstPercentage ?? 3,
                          customerGstin: invoiceData.customerGstin || '',
                          paymentMethod: invoiceData.paymentMethod,
                          onlinePaymentType: invoiceData.onlinePaymentType,
                          items: (invoiceData as any).items || [],
                          enableExchange: invoiceData.enableExchange,
                          ornamentExchanges: invoiceData.exchanges,
                          includeItemPhotosOnBill: invoiceData.includeItemPhotosOnBill,
                        },
                      }),
                    );

                    if (!updateInvoiceOrder.fulfilled.match(resultAction)) {
                      throw new Error(String((resultAction as any).payload || 'Failed to update invoice'));
                    }

                    // Photos added during the edit. The server preserves any
                    // already-uploaded ones across the item-list replacement,
                    // so only the new local picks go up here.
                    const editedItemPhotos = ((invoiceData as any).items || [])
                      .map((it: any, itemIndex: number) => ({
                        itemIndex,
                        photos: (it.pendingPhotos || []) as any[],
                      }))
                      .filter((entry: any) => entry.photos.length > 0);
                    const editedExchangePhotos = ((invoiceData as any).exchanges || [])
                      .map((ex: any, exchangeIndex: number) => ({
                        exchangeIndex,
                        photos: (ex.pendingPhotos || []) as any[],
                      }))
                      .filter((entry: any) => entry.photos.length > 0);

                    // Sequenced for the same reason as the create path: two
                    // writers on one document buy nothing.
                    const uploadEditedPhotos = async () => {
                      if (editOrderId && editedExchangePhotos.length > 0) {
                        await dispatch(
                          uploadAllExchangePhotos({ id: editOrderId, kind: 'invoice', exchangePhotos: editedExchangePhotos }),
                        );
                      }
                      if (editOrderId && editedItemPhotos.length > 0) {
                        await dispatch(
                          uploadAllItemPhotos({ id: editOrderId, kind: 'invoice', itemPhotos: editedItemPhotos }),
                        );
                      }
                    };
                    uploadEditedPhotos();

                    // Reconcile stock: there's no server-side stock tracking,
                    // so an edit has to undo the original items' decrement
                    // before reapplying it for the edited items, or stock
                    // quietly drifts every time an invoice is edited.
                    if (originalOrder?.items?.length) {
                      await dispatch(decrementCatalogStock({ items: originalOrder.items, direction: 'restock' }));
                    }
                    const stockRes = await dispatch(
                      decrementCatalogStock((invoiceData as any).items || []),
                    );
                    const depleted = (stockRes as any)?.payload?.depleted;
                    if (Array.isArray(depleted) && depleted.length > 0) {
                      Alert.alert(
                        'Stock updated',
                        depleted
                          .map((d: any) =>
                            d.remaining < 0
                              ? `${d.name} is oversold (stock now ${d.remaining})`
                              : `${d.name} is now out of stock`,
                          )
                          .join('\n'),
                      );
                    }
                    setStep('success');
                    return;
                  }

                  const resultAction = await dispatch(
                    addOrder({
                      customerId: invoiceData.customerId || 'guest',
                      type: 'full',
                      amount: parseFloat(invoiceData.grandTotal) || 0,
                      subTotal: parseFloat(invoiceData.subtotal) || 0,
                      gstAmount: parseFloat(invoiceData.gst) || 0,
                      includeGST: invoiceData.includeGst,
                      gstRate: (shopDetails as any)?.gstPercentage ?? 3,
                      customerGstin: invoiceData.customerGstin || '',
                      paymentMethod: invoiceData.paymentMethod,
                      onlinePaymentType: invoiceData.onlinePaymentType,
                      // Use the form's invoice date — GST periods are filed by
                      // invoice date, not creation time.
                      date: invoiceData.invoiceDate
                        ? new Date(invoiceData.invoiceDate).toISOString()
                        : new Date().toISOString(),
                      items: (invoiceData as any).items || [],
                      status: 'completed',
                      isOrnamentExchanges: invoiceData.enableExchange,
                      ornamentExchanges: invoiceData.exchanges,
                      // Never sent on create, so ticking "print item photos on
                      // the bill" did nothing until the bill was edited and
                      // saved again: addOrder read undefined and stored false.
                      // The advance-order path has always sent it.
                      includeItemPhotosOnBill: invoiceData.includeItemPhotosOnBill,
                    }),
                  );

                  const result = (resultAction as any).payload;
                  if (result && Array.isArray(result) && result.length > 0) {
                    const newly = result[0];
                    if (newly && newly.invoiceNumber) {
                      setInvoiceNo(newly.invoiceNumber);
                    }
                    if (newly?.id) setSavedInvoiceId(newly.id);
                    // Attach any ornament photos to the saved invoice so a
                    // declaration written later can reuse them. Deliberately not
                    // awaited into the failure path: the invoice is saved and
                    // printable, and a photo upload problem must not read as
                    // "the bill did not save".
                    //
                    // uploadInvoiceOrnamentPhotos, not uploadOrderOrnamentPhotos —
                    // a full-payment sale creates an Invoice (this screen posts to
                    // /api/invoice), never an Order. Posting an invoice id to the
                    // orders endpoint 404s; this was silently broken until fixed.
                    // Ornament photos first, then the item photos below, and
                    // one after the other rather than both at once. Fired
                    // together they raced on the same invoice: each spends
                    // seconds in ImageKit before writing, so both loaded the
                    // document at the same version and the second lost a
                    // version conflict. The server no longer allows that to
                    // destroy anything, but there is nothing to gain from two
                    // writers on one document, and this keeps the order the
                    // shopkeeper sees deterministic.
                    //
                    // Still off the critical path - the wrapper is not awaited,
                    // so the bill is saved and navigable while this runs.
                    const uploadPhotos = async () => {
                      if (newly?.id && (invoiceData.ornamentPhotos?.length ?? 0) > 0) {
                        await dispatch(
                          uploadInvoiceOrnamentPhotos({
                            invoiceId: newly.id,
                            photos: invoiceData.ornamentPhotos!,
                          }),
                        );
                      }

                    // Photos of the items sold. Same non-blocking rule as the
                    // ornament photos above, and same reason: the bill is saved
                    // and printable, so a failed upload must not read as "the
                    // bill did not save".
                    //
                    // Indices come from the form's item order, which is the order
                    // posted to the server and therefore the order stored — the
                    // upload route addresses items by position because invoice
                    // items carry no _id.
                    const itemPhotos = ((invoiceData as any).items || [])
                      .map((it: any, itemIndex: number) => ({
                        itemIndex,
                        photos: (it.pendingPhotos || []) as any[],
                      }))
                      .filter((entry: any) => entry.photos.length > 0);
                      // Photos of the old ornaments taken in, per gold/silver row.
                      const exchangePhotos = ((invoiceData as any).exchanges || [])
                        .map((ex: any, exchangeIndex: number) => ({
                          exchangeIndex,
                          photos: (ex.pendingPhotos || []) as any[],
                        }))
                        .filter((entry: any) => entry.photos.length > 0);
                      if (newly?.id && exchangePhotos.length > 0) {
                        await dispatch(
                          uploadAllExchangePhotos({ id: newly.id, kind: 'invoice', exchangePhotos }),
                        );
                      }

                      if (newly?.id && itemPhotos.length > 0) {
                        const photoAction = await dispatch(
                          uploadAllItemPhotos({ id: newly.id, kind: 'invoice', itemPhotos }),
                        );
                        // Surfaced, not swallowed. These uploads failed with a
                        // 500 for three days and nobody knew, because the only
                        // record of it was failedIndices and nothing read it.
                        const failed =
                          (photoAction as any)?.payload?.failedIndices ?? [];
                        if (failed.length > 0) {
                          toast.error(
                            t('itemPhotos.uploadFailed') ||
                              'Some item photos could not be uploaded. Open the bill and add them again.',
                          );
                        }
                      }
                    };
                    uploadPhotos();

                    // "Generate Declaration" was ticked — open the modal for
                    // whatever the exchange itself couldn't already supply.
                    // Non-blocking: the invoice above is saved either way.
                    if (
                      newly?.id &&
                      invoiceData.generateDeclaration &&
                      invoiceData.enableExchange &&
                      invoiceData.exchanges.length > 0
                    ) {
                      const customer = customers.find(c => c.id === invoiceData.customerId);
                      setDeclarationPrefill(
                        buildExchangeDeclarationPrefill({
                          orderId: newly.id,
                          customer,
                          customerId: invoiceData.customerId || '',
                          invoiceDate: invoiceData.invoiceDate,
                          exchanges: invoiceData.exchanges,
                          grandTotal: Number(invoiceData.grandTotal) || 0,
                          pendingPhotos: invoiceData.ornamentPhotos,
                          language: declarationLanguage,
                        }),
                      );
                    }
                  }
                  // Deduct stock for tracked catalog products (non-blocking).
                  if (addOrder.fulfilled.match(resultAction)) {
                    const stockRes = await dispatch(
                      decrementCatalogStock((invoiceData as any).items || []),
                    );
                    const depleted = (stockRes as any)?.payload?.depleted;
                    if (Array.isArray(depleted) && depleted.length > 0) {
                      Alert.alert(
                        'Stock updated',
                        depleted
                          .map((d: any) =>
                            d.remaining < 0
                              ? `${d.name} is oversold (stock now ${d.remaining})`
                              : `${d.name} is now out of stock`,
                          )
                          .join('\n'),
                      );
                    }
                  }
                  setStep('success');
                } catch (err: any) {
                  console.error('Order save failed:', err);
                  setInvoiceErrors(parseApiErrorList(err?.message || err));
                  setShowInvoiceErrorModal(true);
                } finally {
                  setIsSubmitting(false);
                }
              };

              // GST reports are computed live from current invoice data with
              // no audit trail (see backend), so silently editing a past
              // period's invoice would change already-filed numbers with no
              // record of it. Warn, but don't block — the dukandar may be
              // fixing a genuine mistake.
              if (editOrderId && originalOrder?.date) {
                const orig = new Date(originalOrder.date);
                const now = new Date();
                const isPastPeriod =
                  orig.getFullYear() !== now.getFullYear() ||
                  orig.getMonth() !== now.getMonth();
                if (isPastPeriod) {
                  Alert.alert(
                    'Editing a past invoice',
                    'This invoice is from a previous month and may already be included in a filed GST report. Editing it will change those numbers. Continue?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Continue', style: 'destructive', onPress: submitInvoice },
                    ],
                  );
                  return;
                }
              }

              await submitInvoice();
            }}
          />
        )}

        {step === 'success' && invoiceData && (
          <InvoiceSuccessScreen
            invoiceNo={invoiceNo}
            amount={invoiceData.grandTotal}
            onPrint={handlePrint}
            printTargetLabel={targetLabel}
            onChangePrinter={canChoosePrinter ? openChooser : undefined}
            // Only offered when old ornaments were actually taken in. Optional
            // by design: the plain "name + amount deducted" exchange flow is
            // untouched and never asks for any of the declaration's fields.
            onDeclaration={
              invoiceData.enableExchange && invoiceData.exchanges?.length
                ? handleDeclaration
                : undefined
            }
            // onDownload={handleDownload}
            onShare={handleShare}
            onDone={() =>
              (navigation as any).reset({
                index: 0,
                routes: [
                  {
                    name: 'MainTabs',
                    state: {
                      routes: [{ name: 'Orders' }],
                    },
                  },
                ],
              })
            }
          />
        )}
      </Box>

      <DiscardChangesModal
        visible={discardGuard.promptVisible}
        onCancel={discardGuard.cancelDiscard}
        onDiscard={discardGuard.confirmDiscard}
        title={
          editOrderId
            ? t('common.discard.editTitle')
            : t('common.discard.invoiceTitle')
        }
      />
      <ValidationErrorModal
        isOpen={showInvoiceErrorModal}
        errors={invoiceErrors}
        onClose={() => setShowInvoiceErrorModal(false)}
      />
      <ImpersonationBlockModal
        isOpen={blockModalVisible}
        phone={impersonatePhone || ''}
        onEndSession={handleEndSession}
        onClose={() => setBlockModalVisible(false)}
      />
      {printerChooser}

      {declarationPrefill && (
        <DeclarationDetailsModal
          isOpen={!!declarationPrefill}
          onClose={() => setDeclarationPrefill(null)}
          initialValues={declarationPrefill}
          isSubmitting={declarationSaving}
          onSubmit={handleGenerateDeclaration}
        />
      )}

      {savedDeclaration && (
        <DeclarationGeneratedSheet
          isOpen={!!savedDeclaration}
          declarationNumber={savedDeclaration.declarationNumber}
          photosFailed={declarationPhotosFailed}
          onRetryPhotos={handleRetryDeclarationPhotos}
          onPrint={handlePrintDeclaration}
          onShare={handleShareDeclaration}
          onDone={() => setSavedDeclaration(null)}
        />
      )}
    </Box>
  );
};

export default CreateInvoiceScreen;
