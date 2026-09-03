import React, { useMemo } from 'react';
import {
  StyleSheet,
  RefreshControl,
  Modal as RNModal,
  Alert,
  Keyboard,
  Platform,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import {
  Box,
  HStack,
  VStack,
  Text,
  Pressable,
  Icon,
  ScrollView,
  Center,
  Divider,
  Badge,
  BadgeText,
  Input,
  InputField,
  CheckIcon,
  Switch,
} from '@gluestack-ui/themed';
import {
  ArrowLeft,
  CheckCircle,
  ArrowRight,
  Plus,
  Calendar,
  Trash2,
  ChevronDown,
  CheckCircle2 as CheckCircleIcon,
  X,
  Clock,
  History,
  Pencil,
  FileSignature,
  Scale,
} from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../navigation/types';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { useTranslation } from '../../hooks/useTranslation';
import {
  fetchOrders,
  fetchShopDetails,
  fetchCustomers,
  addPaymentToAdvanceOrder,
  updatePaymentInAdvanceOrder,
  deletePaymentFromAdvanceOrder,
  fetchMetalRates,
  fetchPurchaseOldGold,
  uploadPurchaseOldGoldPhotos,
  uploadExchangePhotos,
  uploadOrderOrnamentPhotos,
  uploadInvoiceOrnamentPhotos,
  removeOrnamentPhoto,
  deleteInvoice,
  clearUserData,
} from '../../store/data/dataSlice';
import { endImpersonation } from '../../store/auth/authSlice';
import { toast } from '../../components/common/Toast';
import ImpersonationBlockModal from '../../components/ImpersonationBlockModal';
import { buildBillHTML } from '../../print/billTemplate';
import { usePrintBill } from '../../hooks/usePrintBill';
import {
  printDeclarationAction,
  shareDeclarationAction,
  downloadDeclarationAction,
} from '../../print/declarationActions';
import ExchangeTotalsRow from '../../components/oldGold/ExchangeTotalsRow';
import OrnamentPhotoViewer from '../../components/oldGold/OrnamentPhotoViewer';
import AddPhotosModal from '../../components/oldGold/AddPhotosModal';
import DocumentActionsRow from '../../components/common/DocumentActionsRow';
import PrintDetailsCard from '../../components/common/PrintDetailsCard';
import DeclarationDetailsModal from '../../components/oldGold/DeclarationDetailsModal';
import PrintTargetNote from '../../components/common/PrintTargetNote';
import DeclarationGeneratedSheet from '../../components/oldGold/DeclarationGeneratedSheet';
import {
  generateDeclaration as saveDeclarationRecord,
  buildExchangeDeclarationPrefill,
} from '../../utils/declarationHelpers';
import type {
  DeclarationFormValues,
  PendingDeclarationPhoto,
  PurchaseOldGold,
} from '../../types';
import DatePickerModal from '../../components/common/DatePickerModal';
import { buildPdfFileName, generateInvoicePDF, sharePDF, downloadPDFToDevice } from '../../utils/pdfService';
import Share from 'react-native-share';
import { openWhatsApp, formatWhatsAppPhone } from '../../utils/whatsappUtils';
import { downloadInvoiceA4Pdf } from '../../utils/invoicePdfWeb';
import { prepareShopForPrint, prepareBillForPrint, getFullImageUrl } from '../../utils/imageUtils';
import { calcItemTotal, calculateAdvanceMakingCharges, calculateAdvanceSettlement, calculateItemMakingCharge, formatOtherChargesLabel, getBillTotals, getItemComponents, normalizeMakingType } from '../../utils/calculations';
import { formatCurrencyValue, formatMakingChargeDetail, formatNumber } from '../../utils/formatter';
import { inspectItemEntry } from '../../utils/itemPlausibility';
import ItemPhotoThumbnails from '../../components/items/ItemPhotoThumbnails';
import OrderDocumentView from '../../components/orders/OrderDocumentView';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { LAYOUT } from '../../constants/layout';
import HelpIconButton from '../../components/common/HelpIconButton';
import { HELP_TOPICS } from '../../tutorials/catalog';
import { INPUT_LIMITS } from '../../constants/inputLimits';
import CharCounter from '../../components/common/CharCounter';

type RouteProps = NativeStackScreenProps<
  RootStackParamList,
  'OrderDetails'
>['route'];

const PURPLE = '#6D5EF7';

function getItemLabel(item: any, fallback: string): string {
  if (!item) return fallback;
  return (
    item.itemName || item.name || item.productName || item.title || fallback
  );
}

export default function OrderDetailsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProps>();
  const { orderId } = route.params;

  const insets = useSafeAreaInsets();
  const { t, invoiceLanguage, invoiceTemplate, declarationLanguage } = useTranslation();
  const {
    print: printBill,
    openChooser,
    targetLabel: printTargetLabel,
    canChoosePrinter,
    chooser: printerChooser,
  } = usePrintBill(
    invoiceLanguage,
    invoiceTemplate,
  );
  const dispatch = useAppDispatch();
  const orders = useAppSelector(s => s.data.orders);
  const customers = useAppSelector(s => s.data.customers);
  const shopDetails = useAppSelector(s => s.data.shopDetails);
  // Download/Share build the PDF here rather than via printBill, so the shop's
  // paper has to be applied on this path too or the shared file would be A4
  // while the printed one is not.
  const paper = useAppSelector(s => s.printPrefs.paper);
  const metalRates = useAppSelector(s => s.data.metalRates);
  const purchaseOldGold = useAppSelector(s => s.data.purchaseOldGold);
  const dataLoading = useAppSelector(s => s.data.loading);
  const { impersonateUserId, impersonatePhone } = useAppSelector(s => s.auth);
  const [blockModalVisible, setBlockModalVisible] = React.useState(false);

  const handleEndSession = () => {
    dispatch(endImpersonation());
    dispatch(clearUserData());
    navigation.navigate('AdminDashboard');
  };

  const [refreshing, setRefreshing] = React.useState(false);

  // Modal States
  const [showPaymentModal, setShowPaymentModal] = React.useState(false);
  const [paymentAmount, setPaymentAmount] = React.useState('');
  const [useCustomRate, setUseCustomRate] = React.useState(false);
  const [customGoldRate, setCustomGoldRate] = React.useState('');
  const [paymentNotes, setPaymentNotes] = React.useState('');
  const [paymentDate, setPaymentDate] = React.useState(new Date());
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [paymentLoading, setPaymentLoading] = React.useState(false);
  const [showPuritySelector, setShowPuritySelector] = React.useState(false);

  // New states for payment management
  const [selectedPayment, setSelectedPayment] = React.useState<any>(null);
  const [showPaymentDetailsModal, setShowPaymentDetailsModal] =
    React.useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] =
    React.useState(false);
  const [isEditingPayment, setIsEditingPayment] = React.useState(false);

  // One-off, per-export choice: collapse itemized advance payments into a
  // single anonymized line (for gift bills). Not persisted.
  const [combinePayments, setCombinePayments] = React.useState(false);

  React.useEffect(() => {
    dispatch(fetchOrders());
    dispatch(fetchShopDetails());
    dispatch(fetchCustomers());
    dispatch(fetchMetalRates());
    // Needed to know whether this order already has a declaration, so the
    // sheet can offer Print/Share rather than Create.
    dispatch(fetchPurchaseOldGold());
  }, [dispatch]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      dispatch(fetchOrders({ force: true })),
      dispatch(fetchShopDetails({ force: true })),
      dispatch(fetchCustomers({ force: true })),
    ]);
    setRefreshing(false);
  }, [dispatch]);

  const order = useMemo(
    () => orders.find(o => o.id === orderId),
    [orders, orderId],
  );

  /**
   * The invoice a completed advance order settled into.
   *
   * Matched on finalInvoiceId first, and on invoiceNumber as a fallback -
   * the settlement reuses the order number (ADV-80) as the invoice number
   * deliberately, so an order whose link predates that field is still
   * findable. Both records live in `orders`; an invoice is mapped into the
   * same shape with type "full".
   */
  const settledInvoice = useMemo(() => {
    if (!order || order.type !== 'advance' || order.status !== 'completed') return undefined;
    const byId = (order as any).finalInvoiceId;
    return (
      orders.find(o => o.type === 'full' && byId && o.id === String(byId)) ||
      orders.find(
        o => o.type === 'full' && (o as any).orderId && String((o as any).orderId) === order.id,
      )
    );
  }, [orders, order]);

  const customer = useMemo(() => {
    if (!order) return undefined;
    const direct = customers.find(c => c.id === order.customerId);
    if (direct) return direct;
    // Fallback: match by _id substring if needed
    return customers.find(
      c => order.customerId?.includes(c.id) || c.id?.includes(order.customerId),
    );
  }, [customers, order]);

  const items = useMemo(() => {
    if (!order?.items) return [];
    return Array.isArray(order.items) ? order.items : [];
  }, [order]);

  const invoiceTotals = useMemo(() => {
    return items.reduce(
      (acc, it) => {
        const comps = getItemComponents(it);
        return {
          gold: acc.gold + (comps.goldValue || 0),
          making: acc.making + (comps.makingTotal || 0),
        };
      },
      { gold: 0, making: 0 },
    );
  }, [items]);

  const getStatusLabel = (status?: string) => {
    if (status === 'completed') {
      return t('orders.status.completed') || 'Completed';
    }
    if (status === 'pending') {
      return t('orders.status.pending') || 'Pending';
    }
    return status || '';
  };

  const prepareInvoiceValues = () => {
    if (!order) return null;

    const payments = (order.payments || []).map((p: any, index: number) => ({
      id: p.id || p._id || `payment-${index}`,
      amount: Number(p.amount || 0).toFixed(2),
      date: p.date ? new Date(p.date).toLocaleDateString('en-IN') : '',
      goldRate: Number(p.goldRate || 0).toFixed(2),
      weightCovered: Number(p.weightCovered || 0).toFixed(3),
      purity: p.purity || '',
      notes: p.notes || p.remarks || '',
    }));

    const totalWeightValue = Number(order.totalWeight ?? 0);
    const weightPaidValue = Number(order.weightPaid ?? 0);
    const remainingWeightValue =
      order.remainingWeight ?? Math.max(0, totalWeightValue - weightPaidValue);

    const settlementRateForInvoice =
      bookingRate || defaultCurrentRatePerGram || 0;

    const paymentSummary = {
      amountPaid: Number(order.totalPaid ?? order.amount ?? 0).toFixed(2),
      bookingRate: Number(order.bookingRate ?? 0).toFixed(2),
      weightCovered: weightPaidValue.toFixed(3),
      totalWeight: totalWeightValue.toFixed(3),
      remainingWeight: remainingWeightValue.toFixed(3),
      estimatedBalance: Number(order.estimatedBalance ?? 0).toFixed(2),
      payments,
    };

    // Derived the same way the on-screen bill derives them, rather than read from
    // order.subTotal/order.amount: the screen computes from the items and subtracts
    // exchanges, and the two disagreed on paper.
    const itemsArray = order.items || [];
    const exchangeTotal = ((order as any).exchanges || []).reduce(
      (sum: number, ex: any) => sum + Number(ex.amount || 0),
      0,
    );
    const subtotalValue = Math.max(
      0,
      getBillTotals(itemsArray).itemsTotal - exchangeTotal,
    );
    // Zero when the bill excludes GST, so grandTotal below collapses to the subtotal.
    const gstAmountValue = Number(order.gstAmount || 0);

    return {
      invoiceDate: new Date(order.date).toISOString(),
      customerName: customer?.name || 'Walk-in Customer',
      address: customer?.address || '',
      phone: customer?.phone || '',
      includeGst: order.includeGST || false,
      items: (order.items || []).map((it: any, index: number) => {
        const computedMakingCharge =
          settlementRateForInvoice > 0
            ? calculateItemMakingCharge(it, settlementRateForInvoice)
            : Number(it.makingCharge || it.makingCharges || 0);
        return {
          id: it.id || it._id || String(index),
          itemName: it.itemName || it.name || 'Item',
          metalType: it.itemType || it.productType || 'Gold',
          purity: it.purity || '',
          pcs: String(it.pieces || it.pcs || 1),
          grossWt: String(
            Number(it.grossWeight || it.grossWt || it.weight || 0).toFixed(3),
          ),
          lessWt: String(Number(it.lessWeight || it.lessWt || 0).toFixed(3)),
          netWt: String(
            Number(it.netWeight || it.netWt || it.weight || 0).toFixed(3),
          ),
          ratePerGm: String(Number(it.rate || 0).toFixed(2)),
          // 'Fixed' because makingCharges below is already a resolved rupee amount,
          // not a per-gram or percentage input. Labelling it 'Per Gram' made anything
          // that recomputed from the type multiply by the weight a second time — the
          // printed Making Charges came out ~18x the real figure.
          makingChargeType: 'Fixed' as 'Per Gram' | 'Fixed' | 'Percentage' | '%',
          makingCharges: String(
            Number(computedMakingCharge).toFixed(2),
          ),
          // …but the customer agreed to "10%", not to a rupee figure, and the
          // bill has to say so. Display only — never recomputed from. Without
          // these the printed column read "₹28,336 Fixed" for a 10% charge,
          // since the flattening above is all the template could see.
          makingBasisType: it.makingType || it.makingChargeType || '',
          makingBasisValue: String(it.makingCharge ?? it.makingCharges ?? ''),
          // `chargeDescription` FIRST — that is the persisted field name, and a
          // saved order has no `otherChargesDescription` at all. Reading only
          // the form-shape name dropped the charge's name on every reprint, so
          // the bill said "Other Charges ₹2,000" where the shopkeeper had
          // written "Hallmark". Same fallback order as the invoice edit path.
          otherChargesDescription: it.chargeDescription || it.otherChargesDescription || '',
          otherChargesAmount: String(
            Number(it.chargeAmount || it.otherChargesAmount || 0).toFixed(2),
          ),
          discountType: (it.discountType as 'Percentage' | 'Fixed' | '%') || 'Fixed',
          discount: String(Number(it.discount || 0).toFixed(2)),
          itemTotal: String(Number(calcItemTotal(it)).toFixed(2)),
        };
      }),
      subtotal: String(subtotalValue.toFixed(2)),
      gst: String(gstAmountValue.toFixed(2)),
      gstPercentage: shopDetails?.gstPercentage || 3,
      // Mirrors how the on-screen bill derives its Grand Total (subtotal + GST); this
      // previously passed the backend's `order.amount` through, which disagreed — so a
      // printed bill showed a different total from the screen the shopkeeper had just
      // read. Affects the A4 path too, not only thermal.
      //
      // gstAmountValue is 0 for a non-GST bill, so this is simply the subtotal then —
      // the same expression covers both cases without branching.
      grandTotal: String((subtotalValue + gstAmountValue).toFixed(2)),
      orderType: order.type,
      orderNumber: order.orderNumber || order.invoiceNumber || '',
      orderStatus: order.status,
      exchanges: (order as any).exchanges || [],
      enableExchange: false,
      paymentSummary,
    };
  };

  // Builds the invoice bill HTML + a PDF file name for this order. Shared by
  // Print, Download and Share so the three actions render an identical bill.
  const buildInvoiceHtmlAndName = async (): Promise<{ html: string; fileName: string } | null> => {
    if (!order) return null;
    const mappedValues = prepareInvoiceValues();
    if (!mappedValues) return null;

    const [printableShop, printableBill] = await Promise.all([
      prepareShopForPrint(shopDetails),
      prepareBillForPrint(mappedValues),
    ]);
    const html = buildBillHTML(printableBill, {
      billNo: order?.invoiceNumber || order?.id || '',
      billDate: order?.date
        ? new Date(order.date).toLocaleDateString()
        : new Date().toLocaleDateString(),
      mode: 'print',
      shopDetails: printableShop,
      combinePayments,
      paper,
    }, invoiceLanguage, invoiceTemplate);

    const fileName = buildPdfFileName(
      order.invoiceNumber || order.orderNumber || order.id,
      customer?.name,
    );
    return { html, fileName };
  };

  /* ─── Declaration for the old ornaments taken in on this order ───
     Previously reachable only on the success screen straight after creating the
     order, so there was no way back to it. */

  // The API's `ornamentExchanges` is mapped to `exchanges` on the client Order
  // (see mapBackendOrder in dataSlice).
  const hasExchange = Boolean(
    order?.isOrnamentExchanges && (order?.exchanges?.length ?? 0) > 0,
  );

  const orderDeclaration = useMemo(
    () => purchaseOldGold.find(d => d.orderId === order?.id),
    [purchaseOldGold, order?.id],
  );

  // Photos are captured against the order, not against a single ornament, so
  // they surface once inside the first exchange line's expansion.
  const exchangePhotos = useMemo(
    () => (order?.ornamentPhotos || []) as { url: string; fileId?: string }[],
    [order?.ornamentPhotos],
  );
  const [photoViewerIndex, setPhotoViewerIndex] = React.useState<number | null>(null);
  const openPhotoViewer = React.useCallback(
    (index: number) => setPhotoViewerIndex(index),
    [],
  );

  // Item photos get their own viewer state rather than sharing the exchange
  // one: each item has its own set, so the viewer has to be told WHICH list to
  // page through, not just where to start in a single order-wide list.
  const [itemPhotoViewer, setItemPhotoViewer] = React.useState<
    { photos: { url: string; fileId?: string }[]; index: number } | null
  >(null);

  /**
   * The exchange row the add-photos sheet is attaching to, if any.
   *
   * null means the legacy bill-wide set. Kept as an index because that is
   * how the upload addresses a row - exchange rows carry no id.
   */
  const [addPhotosExchangeIndex, setAddPhotosExchangeIndex] = React.useState<number | null>(null);
  const [addPhotosOpen, setAddPhotosOpen] = React.useState(false);
  const openAddPhotos = React.useCallback(() => {
    if (impersonateUserId) {
      setBlockModalVisible(true);
      return;
    }
    setAddPhotosExchangeIndex(null);
    setAddPhotosOpen(true);
  }, [impersonateUserId]);

  /** Same sheet, aimed at one ornament rather than the bill-wide set. */
  const openAddOrnamentPhotos = React.useCallback(
    (_ornament: any, ornamentIndex: number) => {
      if (impersonateUserId) {
        setBlockModalVisible(true);
        return;
      }
      if (ornamentIndex < 0) return;
      setAddPhotosExchangeIndex(ornamentIndex);
      setAddPhotosOpen(true);
    },
    [impersonateUserId],
  );

  /**
   * A full-payment sale is an Invoice, not an Order — the two live in separate
   * collections behind separate endpoints, and posting an invoice id to the
   * orders route 404s. Same split the creation path already makes.
   */
  /** Attaches photos to the exchange row the sheet was opened from. */
  const handleUploadExchangeRowPhotos = React.useCallback(
    async (photos: PendingDeclarationPhoto[]): Promise<boolean> => {
      if (!order?.id || addPhotosExchangeIndex === null) return false;
      const action = await dispatch(
        uploadExchangePhotos({
          id: order.id,
          kind: order.type === 'full' ? 'invoice' : 'order',
          exchangeIndex: addPhotosExchangeIndex,
          photos,
        }),
      );
      if (uploadExchangePhotos.fulfilled.match(action)) return true;
      toast.error(
        String((action as any).payload || '') ||
          t('declaration.photos.uploadFailed') ||
          'Photos could not be uploaded.',
      );
      return false;
    },
    [dispatch, order, addPhotosExchangeIndex, t],
  );

  const handleUploadOrnamentPhotos = React.useCallback(
    async (photos: PendingDeclarationPhoto[]): Promise<boolean> => {
      if (!order?.id) return false;
      const action =
        order.type === 'full'
          ? await dispatch(uploadInvoiceOrnamentPhotos({ invoiceId: order.id, photos }))
          : await dispatch(uploadOrderOrnamentPhotos({ orderId: order.id, photos }));

      const ok =
        order.type === 'full'
          ? uploadInvoiceOrnamentPhotos.fulfilled.match(action)
          : uploadOrderOrnamentPhotos.fulfilled.match(action);
      if (!ok) {
        toast.error(
          String((action as any).payload || '') ||
            t('declaration.photos.uploadFailed') ||
            'Photos could not be uploaded.',
        );
        return false;
      }
      toast.success(t('declaration.photos.uploaded') || 'Photos added');
      return true;
    },
    [dispatch, order?.id, order?.type, t],
  );

  const handleDeleteOrnamentPhoto = React.useCallback(
    async (fileId: string): Promise<boolean> => {
      if (!order?.id) return false;
      const action = await dispatch(
        removeOrnamentPhoto({
          id: order.id,
          fileId,
          kind: order.type === 'full' ? 'invoice' : 'order',
        }),
      );
      if (!removeOrnamentPhoto.fulfilled.match(action)) {
        toast.error(
          String((action as any).payload || '') ||
            t('declaration.photos.deleteFailed') ||
            'Photo could not be removed.',
        );
        return false;
      }
      return true;
    },
    [dispatch, order?.id, order?.type, t],
  );

  const exchangeValue = useMemo(
    () =>
      (order?.exchanges || []).reduce(
        (sum: number, ex: any) => sum + (Number(ex?.amount) || 0),
        0,
      ),
    [order?.exchanges],
  );

  const handlePrintDeclaration = async () => {
    if (!orderDeclaration) return;
    await printDeclarationAction(orderDeclaration, shopDetails, declarationLanguage, t);
  };

  const handleShareDeclaration = async () => {
    if (!orderDeclaration) return;
    await shareDeclarationAction(orderDeclaration, shopDetails, declarationLanguage, t);
  };

  // Saves the PDF rather than opening the share sheet — the button says
  // "Download Declaration", so it must actually download.
  const handleDownloadDeclaration = async () => {
    if (!orderDeclaration) return;
    await downloadDeclarationAction(orderDeclaration, shopDetails, declarationLanguage, t);
  };

  // Declaration generated inline via a modal rather than a separate screen —
  // the order already has everything a declaration needs except ownership, ID
  // proof, receipt, payout and witnesses, which is exactly what the modal asks
  // for. Reuses the order's own photos, so nothing has to be recaptured.
  const [declarationPrefill, setDeclarationPrefill] = React.useState<DeclarationFormValues | null>(null);
  const [declarationSaving, setDeclarationSaving] = React.useState(false);
  const [generatedDeclaration, setGeneratedDeclaration] = React.useState<PurchaseOldGold | null>(null);
  const [generatedDeclarationPhotosFailed, setGeneratedDeclarationPhotosFailed] = React.useState(false);
  const [generatedDeclarationRetryPhotos, setGeneratedDeclarationRetryPhotos] = React.useState<
    DeclarationFormValues['pendingPhotos']
  >([]);

  const handleCreateDeclaration = () => {
    if (!order) return;
    const customer = customers.find(c => c.id === order.customerId);
    setDeclarationPrefill(
      buildExchangeDeclarationPrefill({
        orderId: order.id,
        customer,
        customerId: order.customerId || '',
        invoiceDate: order.date,
        exchanges: order.exchanges || [],
        grandTotal: Number(order.amount) || 0,
        pendingPhotos: (order.ornamentPhotos || []).map((p: any) => ({ uri: p.url })),
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
      setGeneratedDeclaration(declaration);
      setGeneratedDeclarationPhotosFailed(photosFailed);
      setGeneratedDeclarationRetryPhotos(photosFailed ? values.pendingPhotos : []);
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
      // Also fetch, so `orderDeclaration` below picks it up and the button
      // reads "Download Declaration" without waiting for a manual refresh.
      dispatch(fetchPurchaseOldGold({ force: true }));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save declaration');
    } finally {
      setDeclarationSaving(false);
    }
  };

  const handleRetryGeneratedDeclarationPhotos = async () => {
    if (!generatedDeclaration || (generatedDeclarationRetryPhotos?.length ?? 0) === 0) return;
    const action = await dispatch(
      uploadPurchaseOldGoldPhotos({
        declarationId: generatedDeclaration.id,
        photos: generatedDeclarationRetryPhotos!,
      }),
    );
    if (uploadPurchaseOldGoldPhotos.fulfilled.match(action) && action.payload) {
      setGeneratedDeclaration(action.payload as PurchaseOldGold);
      setGeneratedDeclarationPhotosFailed(false);
      setGeneratedDeclarationRetryPhotos([]);
    } else {
      toast.error('Photos could not be uploaded.');
    }
  };

  const handlePrintGeneratedDeclaration = async () => {
    if (!generatedDeclaration) return;
    await printDeclarationAction(generatedDeclaration, shopDetails, declarationLanguage, t);
  };

  const handleShareGeneratedDeclaration = async () => {
    if (!generatedDeclaration) return;
    await shareDeclarationAction(generatedDeclaration, shopDetails, declarationLanguage, t);
  };

  const handlePrint = async () => {
    if (!order) return;
    const mappedValues = prepareInvoiceValues();
    if (!mappedValues) return;

    const [printableShop, printableBill] = await Promise.all([
      prepareShopForPrint(shopDetails),
      prepareBillForPrint(mappedValues),
    ]);
    printBill(printableBill, {
      billNo: order?.invoiceNumber || order?.id || '',
      billDate: order?.date
        ? new Date(order.date).toLocaleDateString()
        : new Date().toLocaleDateString(),
      mode: 'print',
      shopDetails: printableShop,
      combinePayments,
    });
  };

  const handleDownload = async () => {
    const built = await buildInvoiceHtmlAndName();
    if (!built) return;
    try {
      if (Platform.OS === 'web') {
        // RN Web: render the bill to a portrait-A4 PDF and download it directly.
        await downloadInvoiceA4Pdf(built.html, built.fileName);
        return;
      }
      const filePath = await generateInvoicePDF(built.html, built.fileName);
      if (!filePath) {
        toast.error(t('orders.details.pdfGenerateFailed') || 'Failed to generate PDF');
        return;
      }
      await downloadPDFToDevice(filePath, built.fileName);
    } catch (error) {
      console.error('Download PDF error', error);
      toast.error(
        t('orders.details.pdfGenerateError') || 'An error occurred while generating the PDF',
      );
    }
  };

  const handleSharePDF = async () => {
    const built = await buildInvoiceHtmlAndName();
    if (!built) return;

    try {
      if (Platform.OS === 'web') {
        // RN Web: no native share module — hand the A4 PDF to the browser share
        // sheet, falling back to a PDF download + WhatsApp text on desktop.
        const shopName = shopDetails?.shopName || shopDetails?.name || 'Gold Khata Book';
        const message =
          `🧾 Invoice from ${shopName}\n` +
          `Invoice No: ${order?.invoiceNumber || order?.id}\n` +
          `Customer: ${customer?.name || ''}\n\n` +
          `Thank you! 🙏`;
        await openWhatsApp(customer?.phone, message, {
          html: built.html,
          fileName: built.fileName,
        });
        return;
      }

      const filePath = await generateInvoicePDF(built.html, built.fileName);
      if (!filePath) {
        toast.error(t('orders.details.pdfGenerateFailed') || 'Failed to generate PDF');
        return;
      }

      await sharePDF(filePath, t('orders.details.shareTitle') || 'Share Invoice');
    } catch (error) {
      console.error('Share PDF error', error);
      toast.error(
        t('orders.details.pdfGenerateError') || 'An error occurred while generating the PDF',
      );
    }
  };

  /**
   * The message that goes out with the bill. Signed with the shop's own name —
   * deliberately with no "Gold Khata Book" fallback, because a message a customer
   * receives should carry their jeweller's name or no name at all, never the
   * billing product's.
   */
  const buildOrderWhatsAppMessage = () => {
    const shopName = shopDetails?.shopName || (shopDetails as any)?.name || '';
    const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
    const ref =
      order?.orderNumber || order?.invoiceNumber || order?.id?.slice(-8)?.toUpperCase() || '';
    const firstItem = (order as any)?.items?.[0];

    const lines = [
      `🧾 *${t('orders.details.advanceOrder') || 'Advance Order'}${ref ? ` — ${ref}` : ''}*`,
      '',
      firstItem?.itemName
        ? `*${t('invoice.item') || 'Item'}:* ${firstItem.itemName} · ${orderTotalWeight.toFixed(3)} gm`
        : `*${t('advanceOrder.summary.totalWeightCount') || 'Total Weight'}:* ${orderTotalWeight.toFixed(3)} gm`,
      `*${t('orders.details.totalOrderCost') || 'Total Order Cost'}:* ${rupees(totalOrderCost)}`,
      `*${t('orders.details.advancePaid') || 'Advance Paid'}:* ${rupees(totalPaid)}`,
      `*${t('orders.details.estimatedTotalBalance') || 'Estimated Balance'}:* ${rupees(estimatedTotalBalance)}`,
      '',
      `_${t('orders.details.billAttached') || 'Full bill attached.'}_`,
    ];

    if (shopName) {
      lines.push('', `*${shopName}*`);
    }
    return lines.filter(l => l !== undefined).join('\n');
  };

  /**
   * Sends the order's PDF to WhatsApp.
   *
   * WhatsApp's URL scheme cannot carry a file and its share intent cannot
   * reliably target a number, so this asks for both and degrades rather than
   * failing: the customer's number goes along as a hint, and where WhatsApp
   * ignores it (always on iOS, sometimes on Android) the shop picks the contact
   * from WhatsApp's own list. The PDF is attached in every branch — that is the
   * part a text link can never replace.
   */
  const handleWhatsAppShare = async () => {
    const built = await buildInvoiceHtmlAndName();
    if (!built) return;

    const message = buildOrderWhatsAppMessage();

    try {
      if (Platform.OS === 'web') {
        // RN Web has no native share module. The web variant tries the browser
        // Web Share API with the PDF and otherwise downloads it and opens the
        // chat with the text, for the shop to drag the file in.
        await openWhatsApp(customer?.phone, message, {
          html: built.html,
          fileName: built.fileName,
        });
        return;
      }

      const filePath = await generateInvoicePDF(built.html, built.fileName);
      if (!filePath) {
        toast.error(t('orders.details.pdfGenerateFailed') || 'Failed to generate PDF');
        return;
      }
      const fileUri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;

      try {
        // Needs the <queries> entry for com.whatsapp in AndroidManifest, or
        // Android 11+ cannot resolve WhatsApp at all and this throws.
        await Share.shareSingle({
          social: (Share as any).Social?.WHATSAPP ?? 'whatsapp',
          whatsAppNumber: formatWhatsAppPhone(customer?.phone) || undefined,
          url: fileUri,
          type: 'application/pdf',
          filename: built.fileName,
          message,
          failOnCancel: false,
        } as any);
      } catch (whatsAppError) {
        console.log('Direct WhatsApp share failed, falling back to share sheet:', whatsAppError);
        // WhatsApp missing or refusing the file — the generic sheet still gets
        // the bill out via mail, Drive or another messenger.
        await sharePDF(filePath, t('orders.details.shareTitle') || 'Share Invoice');
      }
    } catch (error) {
      console.error('WhatsApp share error', error);
      toast.error(
        t('orders.details.pdfGenerateError') || 'An error occurred while generating the PDF',
      );
    }
  };

  const isCompleted = order?.status === 'completed';

  const weightPaid = useMemo(() => {
    if (!order) return 0;
    // Prefer stored weightPaid if available (especially for advance orders)
    if (order.type === 'advance' && (order as any).weightPaid !== undefined) {
      return Number((order as any).weightPaid);
    }

    const payments = (order as any).payments || (order as any).paymentSummary?.payments || [];
    if (!Array.isArray(payments)) return 0;
    return payments.reduce(
      (sum: number, p: any) => sum + Number(p.weightCovered || p.weight_covered || 0),
      0,
    );
  }, [order]);

  const orderTotalWeight = useMemo(() => {
    if (!order) return 0;
    // Prefer stored totalWeight if available
    if (order.type === 'advance' && (order as any).totalWeight !== undefined) {
      return Number((order as any).totalWeight);
    }

    const items = (order as any).items || (order as any).products || [];
    if (!Array.isArray(items)) return 0;
    return items.reduce(
      (sum: number, it: any) =>
        sum +
        (Number(it.netWt || it.netWeight || it.weight || 0) ||
          Number(it.grossWt || it.grossWeight || 0) -
          Number(it.lessWt || it.lessWeight || 0)),
      0,
    );
  }, [order]);

  const totalGrossWeight = useMemo(() => {
    if (!order) return 0;
    const items = (order as any).items || (order as any).products || [];
    if (!Array.isArray(items)) return 0;
    return items.reduce(
      (sum: number, it: any) =>
        sum + Number(it.grossWt || it.grossWeight || it.weight || it.netWt || 0),
      0,
    );
  }, [order]);

  const remainingWeight = isCompleted
    ? 0
    : Math.max(0, orderTotalWeight - weightPaid);

  const purity =
    (order as any)?.items?.[0]?.purity || (order as any)?.purity || '22K - 91.6%';

  const [paymentPurity, setPaymentPurity] = React.useState(purity);

  const purityOptions = [
    {
      value: '24K - 99.5%',
      label: t('metals.purity.gold24k995gw') || '24K - 99.5%',
    },
    { value: '22K - 91.6%', label: t('metals.purity.gold22k') || '22K - 91.6%' },
    { value: '18K - 75.01%', label: t('metals.purity.gold18k') || '18K - 75.01%' },
    { value: '14K - 58.3%', label: t('metals.purity.gold14k') || '14K - 58.3%' },
    { value: 'Silver', label: t('metals.purity.silver') || 'Silver' },
    {
      value: 'Silver Coin',
      label: t('metals.purity.silverCoin') || 'Silver Coin',
    },
  ];

  const getPurityLabel = (value: string) =>
    purityOptions.find(p => p.value === value)?.label || value;

  const bookingRate = useMemo(() => {
    if (!order) return null;
    // Always prioritize the stored booking rate from the backend
    if (order.bookingRate && order.bookingRate > 0) return order.bookingRate;

    if (!Array.isArray(order.payments) || order.payments.length === 0)
      return null;

    // Sort chronologically and take the first one with a rate
    const sorted = [...order.payments].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const firstWithRate = sorted.find(
      (p: any) => p.goldRate && Number(p.goldRate) > 0,
    );
    return firstWithRate ? Number(firstWithRate.goldRate) : null;
  }, [order]);

  const defaultCurrentRatePerGram = useMemo(() => {
    const p = paymentPurity || purity;
    if (p.includes('24K')) return metalRates?.gold?.goldPrice24K995GW;
    if (p.includes('18K')) return metalRates?.gold?.goldPrice18K;
    if (p.includes('14K')) return metalRates?.gold?.goldPrice14K;
    if (p.includes('Silver')) {
      return p.includes('Coin')
        ? metalRates?.silver?.silverBarPrice
        : metalRates?.silver?.silverPrice;
    }
    return metalRates?.gold?.goldPrice22K;
  }, [metalRates, paymentPurity, purity]);

  const currentRatePerGram =
    useCustomRate && customGoldRate
      ? Number(customGoldRate) || 0
      : defaultCurrentRatePerGram || bookingRate || 0;

  const balanceRatePerGram = bookingRate || defaultCurrentRatePerGram || 0;

  const makingChargeType =
    (order as any)?.items?.[0]?.makingChargeType ||
    (order as any)?.makingChargeType ||
    '%';
  const makingChargeValue =
    (order as any)?.items?.[0]?.makingChargeValue ||
    (order as any)?.makingChargeValue ||
    0;

  const estimatedGoldBalance = remainingWeight * balanceRatePerGram;

  const estimatedMakingCharges = useMemo(() => {
    const goldCostForTotalWeight = orderTotalWeight * balanceRatePerGram;
    const goldCostForGrossWeight = totalGrossWeight * balanceRatePerGram;

    switch (makingChargeType) {
      case '%':
        return (goldCostForTotalWeight * makingChargeValue) / 100;
      case 'Per Gram':
        return totalGrossWeight * makingChargeValue;
      case 'Fix':
      case 'Fixed':
        return Number(makingChargeValue);
      default:
        return 0;
    }
  }, [
    makingChargeType,
    makingChargeValue,
    balanceRatePerGram,
    orderTotalWeight,
    totalGrossWeight,
  ]);

  const totalDiscount = useMemo(() => {
    return (order?.items || []).reduce(
      (sum: number, it: any) => sum + (Number(it.discount) || 0),
      0,
    );
  }, [order?.items]);

  const totalOtherCharges = useMemo(() => {
    return (order?.items || []).reduce(
      (sum: number, it: any) =>
        sum + Number(it.chargeAmount || it.otherChargesAmount || 0),
      0,
    );
  }, [order?.items]);

  /**
   * GST quoted tentatively on the whole order at the booking rate, exactly as
   * the create-order screen quotes it before the customer pays. The backend
   * stores this figure and folds it into estimatedBalance, so leaving it out
   * here made the same order read Rs.39,555 lower on this screen than on its
   * own printed bill for a 3% order.
   */
  const orderIncludesGst = Boolean((order as any)?.includeGST);
  const orderGstAmount = orderIncludesGst
    ? Number((order as any)?.gstAmount || 0)
    : 0;

  const estimatedTotalBalance = Math.max(
    0,
    estimatedGoldBalance +
    estimatedMakingCharges +
    totalOtherCharges -
    totalDiscount +
    orderGstAmount,
  );

  /**
   * What the whole order costs at the rate it was booked at — the full weight
   * priced at `balanceRatePerGram` (the first rate the advance was created
   * with), plus the same charges the balance below carries.
   *
   * Shown so the shop can verify the balance by hand: totalOrderCost minus the
   * advance paid equals estimatedTotalBalance exactly, because
   * (totalWeight - paid/rate) * rate === totalWeight*rate - paid. That identity
   * only holds while weightPaid keeps full precision, which is why the backend
   * no longer rounds it — a customer reconciling these two routes against each
   * other is how the Rs.5 discrepancy was reported in the first place.
   */
  const totalOrderCost =
    orderTotalWeight * balanceRatePerGram +
    estimatedMakingCharges +
    totalOtherCharges -
    totalDiscount;

  const finalBill = React.useMemo(() => {
    if (!order || order.type !== 'advance') return null;
    const itemsArray = Array.isArray(order.items) ? order.items : [];
    const paidSoFar = (order.payments || []).reduce(
      (sum: number, p: any) => sum + (Number(p.amount) || 0),
      0,
    );

    // Once settled, the truth is the invoice, not a fresh estimate off the
    // order. This block is titled "Final Bill Calculation" and was the one
    // thing on screen that was not the final bill: ADV-80 showed GST 0 and
    // 2,45,157 while its invoice charged 7,354.71 on a total of 2,52,311.71.
    // GST is chosen at settlement, so the order carries includeGST false and
    // recomputing from it can only contradict what was actually billed.
    if (settledInvoice) {
      const inv: any = settledInvoice;
      const invItems = Array.isArray(inv.items) ? inv.items : [];
      const settledSubtotal = Number(inv.subTotal ?? 0);
      const settledGst = Number(inv.gstAmount ?? 0);
      const settledTotal = Number(inv.amount ?? 0) || settledSubtotal + settledGst;
      // The stored invoice holds the money, not the breakdown, so the gold
      // and making rows are re-derived from its own items and rate.
      const invRate = Number(invItems[0]?.rate ?? 0) || balanceRatePerGram || 0;
      const parts = calculateAdvanceSettlement(invItems, invRate, {
        includeGst: false,
        gstRatePercent: 0,
      });
      return {
        goldValue: parts.goldValue,
        makingCharges: parts.makingCharges,
        subtotal: settledSubtotal,
        gstAmount: settledGst,
        gstPercentage: Number(inv.gstRate ?? shopDetails?.gstPercentage ?? 3),
        grandTotal: settledTotal,
        totalPaid: paidSoFar,
        balanceDue: Math.max(0, settledTotal - paidSoFar),
      };
    }

    const settlementRate = balanceRatePerGram || 0;
    if (settlementRate <= 0) return null;

    // Still open: an estimate at today`s rate, from the same calculator the
    // completion screen uses, so the two cannot quote different numbers.
    const shouldIncludeGst = (order as any).includeGst ?? order.includeGST ?? true;
    const gstPercentage = shopDetails?.gstPercentage || 3;
    const est = calculateAdvanceSettlement(itemsArray, settlementRate, {
      includeGst: shouldIncludeGst,
      gstRatePercent: gstPercentage,
    });
    const goldValue = est.goldValue;
    const makingCharges = est.makingCharges;
    const subtotal = est.subtotal;
    const gstAmount = est.gstAmount;
    const grandTotal = est.grandTotal;
    const totalPaid = (order.payments || []).reduce(
      (sum: number, p: any) => sum + (Number(p.amount) || 0),
      0,
    );
    const balanceDue = Math.max(0, grandTotal - totalPaid);

    return {
      goldValue,
      makingCharges,
      subtotal,
      gstAmount,
      gstPercentage,
      grandTotal,
      totalPaid,
      balanceDue,
    };
  }, [order, balanceRatePerGram, shopDetails]);

  const handleAddPayment = async () => {
    if (impersonateUserId) { setBlockModalVisible(true); return; }
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.warning('Please enter a valid amount');
      return;
    }

    const rate = currentRatePerGram;
    if (rate <= 0) {
      toast.warning('Invalid gold rate');
      return;
    }

    setPaymentLoading(true);
    try {
      const payload = {
        orderId,
        amount: parseFloat(paymentAmount),
        goldRate: rate,
        notes: paymentNotes,
        date: paymentDate.toISOString(),
        purity: paymentPurity,
        weightCovered: Number((parseFloat(paymentAmount) / rate).toFixed(3)),
      };

      if (isEditingPayment && selectedPayment) {
        await dispatch(
          updatePaymentInAdvanceOrder({
            ...payload,
            paymentId: selectedPayment._id || selectedPayment.id,
          }),
        ).unwrap();
        toast.success('Payment updated successfully');
      } else {
        await dispatch(addPaymentToAdvanceOrder(payload)).unwrap();
        toast.success('Payment added successfully');
      }

      setShowPaymentModal(false);
      setIsEditingPayment(false);
      setSelectedPayment(null);
      // Reset form
      setPaymentAmount('');
      setPaymentNotes('');
      setUseCustomRate(false);
      setCustomGoldRate('');
      dispatch(fetchOrders({ force: true }));
    } catch (err: any) {
      toast.error(err || 'Failed to process payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleDeletePayment = async () => {
    if (impersonateUserId) { setBlockModalVisible(true); return; }
    if (!selectedPayment) return;

    setPaymentLoading(true);
    try {
      await dispatch(
        deletePaymentFromAdvanceOrder({
          orderId,
          paymentId: selectedPayment._id || selectedPayment.id,
        }),
      ).unwrap();
      setShowDeleteConfirmModal(false);
      setShowPaymentDetailsModal(false);
      setSelectedPayment(null);
      toast.success('Payment deleted successfully');
      dispatch(fetchOrders({ force: true }));
    } catch (err: any) {
      toast.error(err || 'Failed to delete payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  const openEditPayment = (p: any) => {
    setSelectedPayment(p);
    setPaymentAmount(String(p.amount));
    setPaymentNotes(p.notes || '');
    setPaymentDate(new Date(p.date));
    setPaymentPurity(p.purity || purity);

    setCustomGoldRate(String(p.goldRate));
    setUseCustomRate(true);

    setIsEditingPayment(true);
    setShowPaymentDetailsModal(false);
    setShowPaymentModal(true);
  };

  const handleCompleteOrder = () => {
    navigation.replace('CompleteAdvanceOrder', { orderId });
  };

  const handleEditOrder = () => {
    if (!order) return;
    if (order.type === 'full') {
      (navigation as any).navigate('CreateInvoice', { customerId: order.customerId, editOrderId: order.id });
    } else {
      (navigation as any).navigate('AdvanceOrder', { customerId: order.customerId, editOrderId: order.id });
    }
  };

  const handleDeleteInvoice = () => {
    const label = order?.invoiceNumber || orderId.slice(-6).toUpperCase();
    Alert.alert(
      'Delete Invoice',
      `Delete invoice ${label}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await dispatch(deleteInvoice(orderId));
            if (deleteInvoice.fulfilled.match(result)) {
              toast.success('Invoice deleted');
              navigation.goBack();
            } else {
              toast.error((result.payload as string) || 'Failed to delete invoice');
            }
          },
        },
      ],
    );
  };



  const totalPaid = useMemo(() => {
    if (!order) return 0;
    const payments = (order as any).payments || (order as any).paymentSummary?.payments || [];
    if (!Array.isArray(payments)) return 0;
    return payments.reduce(
      (sum: number, p: any) => sum + (p.amount || 0),
      0,
    );
  }, [order]);

  const paymentsSorted = useMemo(() => {
    if (!order) return [];
    const payments = (order as any).payments || (order as any).paymentSummary?.payments || [];
    if (!Array.isArray(payments)) return [];
    return [...payments].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [order]);

  if (!order) {
    if (dataLoading) {
      return (
        <Box flex={1} bg="$white">
          <Center flex={1}>
            <VStack space="md" alignItems="center">
              <RefreshControl refreshing={true} />
              <Text color="$coolGray500">
                {t('common.loading') || 'Loading...'}
              </Text>
            </VStack>
          </Center>
        </Box>
      );
    }

    return (
      <Box flex={1} bg="$white">
        <SafeAreaView edges={['top']} style={{ backgroundColor: '#FFFFFF' }}>
          <Box
            bg="$white"
            borderBottomWidth={1}
            borderBottomColor="$coolGray200"
          >
            <HStack 
              px="$4" 
              py="$3.5" 
              alignItems="center" 
              space="md"
              style={{ ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}) }}
            >
              <Pressable
                onPress={() => navigation.goBack()}
                p="$2"
                rounded="$lg"
              >
                <ArrowLeft size={22} color="#111827" />
              </Pressable>
              <Text
                fontWeight="$bold"
                color="$coolGray900"
                style={{ fontSize: 20 }}
              >
                {t('orders.detailsTitle') || 'Order Details'}
              </Text>
            </HStack>
          </Box>
        </SafeAreaView>
        <Center flex={1} px="$6">
          <Text color="$coolGray500">
            {t('orders.notFound') || 'Order not found'}
          </Text>
        </Center>
      </Box>
    );
  }

  return (
    <Box flex={1} bg="#F8FAFC">
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#FFFFFF' }}>
        <Box bg="$white" borderBottomWidth={1} borderBottomColor="$coolGray100">
          <HStack
            px="$4"
            py="$4"
            alignItems="center"
            justifyContent="space-between"
            style={{ ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}) }}
          >
            <HStack alignItems="center" space="md">
              <Pressable
                onPress={() => navigation.goBack()}
                p="$2"
                rounded="$lg"
              >
                <ArrowLeft size={20} color="#111827" />
              </Pressable>
              <VStack>
                <Text fontWeight="$black" color="$coolGray900" fontSize="$md">
                  {order.invoiceNumber || order.orderNumber}
                </Text>
                <Text fontSize="$xs" color="$coolGray500">
                  {customer?.name || 'Walk-in Customer'}
                </Text>
              </VStack>
            </HStack>
            <HStack alignItems="center" space="sm">
              <Badge
                variant="solid"
                rounded="$full"
                px="$3"
                ml="$1"
                bg={order.status === 'completed' ? '#DCFCE7' : '#FEF3C7'}
              >
                <BadgeText
                  fontSize="$2xs"
                  fontWeight="$bold"
                  color={order.status === 'completed' ? '#166534' : '#B45309'}
                  textTransform="capitalize"
                >
                  {getStatusLabel(order.status)}
                </BadgeText>
              </Badge>
              {!(order as any).deletedAt && (order.type === 'full' || order.status !== 'completed') && (
                <Pressable
                  onPress={handleEditOrder}
                  p="$2"
                  rounded="$lg"
                  bg="#EEF2FF"
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  <Pencil size={16} color={PURPLE} />
                </Pressable>
              )}
              {order.type === 'full' && (
                <Pressable
                  onPress={handleDeleteInvoice}
                  p="$2"
                  rounded="$lg"
                  bg="#FEF2F2"
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  <Trash2 size={16} color="#EF4444" />
                </Pressable>
              )}
              <HelpIconButton topic={HELP_TOPICS.orderDetails} />
            </HStack>
          </HStack>
        </Box>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ 
          padding: 16, 
          paddingBottom: 100,
          ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {})
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={PURPLE}
          />
        }
      >
        <VStack space="md" px="$0">
          {order.type === 'full' ? (
            <Box
              bg="$white"
              p="$6"
              rounded="$3xl"
              shadowColor="#000"
              shadowOffset={{ width: 0, height: 4 }}
              shadowOpacity={0.08}
              shadowRadius={12}
              elevation={5}
              borderWidth={1}
              borderColor="$coolGray100"
              style={styles.card}
            >
              {/* The same document component the advance order uses. This card
                  was the reference layout - shop header, Bill To, an item table
                  carrying photos, and a totals block - and the other two order
                  types each had their own partial copy of it. */}
              <OrderDocumentView
                shop={shopDetails as any}
                customer={customer as any}
                date={order.date}
                items={order.items || []}
                exchanges={order.exchanges || []}
                exchangePhotos={exchangePhotos}
                onExchangePhotoPress={openPhotoViewer}
                onOrnamentPhotoPress={(ornament, photoIndex) =>
                  setItemPhotoViewer({ photos: ornament.photos || [], index: photoIndex })
                }
                onAddOrnamentPhotos={openAddOrnamentPhotos}
                onAddExchangePhotos={openAddPhotos}
                gstAmount={Number(order.gstAmount || 0)}
                gstRatePercent={(order as any).gstRate}
                onPhotoPress={(item, photoIndex) =>
                  setItemPhotoViewer({ photos: item.photos || [], index: photoIndex })
                }
              />
            </Box>
          ) : (
            /* Advance order, in the same document layout as a full-payment
               bill. It used to be its own card with no shop header, no rate
               or amount column, no item photos and the totals in a separate
               "Final Bill Calculation" box below - three orders, three
               layouts, for what is the same document. */
            <Box bg="$white" p="$6" rounded="$2xl" mb="$4" style={styles.card}>
              {/* Once settled, the invoice's items carry the rate the order
                  actually closed at; the order's carry the booking rate. */}
              <OrderDocumentView
                shop={shopDetails as any}
                customer={customer as any}
                date={order.date}
                items={(settledInvoice as any)?.items || order.items || []}
                exchanges={order.exchanges || []}
                exchangePhotos={exchangePhotos}
                onExchangePhotoPress={openPhotoViewer}
                onOrnamentPhotoPress={(ornament, photoIndex) =>
                  setItemPhotoViewer({ photos: ornament.photos || [], index: photoIndex })
                }
                onAddOrnamentPhotos={openAddOrnamentPhotos}
                onAddExchangePhotos={openAddPhotos}
                gstAmount={finalBill?.gstAmount ?? Number(order.gstAmount || 0)}
                gstRatePercent={finalBill?.gstPercentage}
                totals={
                  finalBill
                    ? {
                        subTotal: finalBill.subtotal,
                        gstAmount: finalBill.gstAmount,
                        grandTotal: finalBill.grandTotal,
                      }
                    : undefined
                }
                onPhotoPress={(item, photoIndex) =>
                  setItemPhotoViewer({ photos: item.photos || [], index: photoIndex })
                }
              />
            </Box>
          )}

          {/* Payment & Weight Progress Card */}
          {order.type === 'advance' && !isCompleted && (
            <Box bg="$white" p="$5" rounded="$2xl" mb="$4" style={styles.card}>
              <Text
                fontSize="$xs"
                fontWeight="$black"
                color="$coolGray400"
                textTransform="uppercase"
                mb="$4"
              >
                {t('orders.details.paymentProgress') || 'Payment Progress'}
              </Text>

              {/* Progress Bar with Gradient */}
              <Box
                height={10}
                bg="$coolGray100"
                rounded="$full"
                overflow="hidden"
                mb="$5"
              >
                <Svg height="100%" width="100%">
                  <Defs>
                    <LinearGradient id="orderProgressGrad" x1="0" y1="0" x2="1" y2="0">
                      <Stop offset="0" stopColor="#8B5CF6" />
                      <Stop offset="1" stopColor="#6D5EF7" />
                    </LinearGradient>
                  </Defs>
                  <Rect
                    x="0"
                    y="0"
                    width={`${isCompleted
                      ? 100
                      : orderTotalWeight > 0
                        ? (weightPaid / orderTotalWeight) * 100
                        : 0}%`}
                    height="100%"
                    fill="url(#orderProgressGrad)"
                  />
                </Svg>
              </Box>

              {/* Three Blocks - Matching Web 3-column Grid */}
              <HStack space="sm">
                <Box
                  flex={1}
                  bg="#F5F3FF"
                  p="$3"
                  rounded="$xl"
                  borderWidth={1}
                  borderColor="#DDD6FE"
                  alignItems="center"
                >
                  <Text
                    fontSize={10}
                    color="#6D5EF7"
                    fontWeight="$bold"
                    textTransform="uppercase"
                    mb="$1"
                  >
                    {t('orders.details.weightPaid') || 'Weight Paid'}
                  </Text>
                  <Text fontWeight="$black" color="#6D5EF7" fontSize="$sm">
                    {isCompleted
                      ? (orderTotalWeight || 0).toFixed(3)
                      : (weightPaid || 0).toFixed(3)} gm
                  </Text>
                </Box>

                <Box
                  flex={1}
                  bg="#F9FAFB"
                  p="$3"
                  rounded="$xl"
                  borderWidth={1}
                  borderColor="#F3F4F6"
                  alignItems="center"
                >
                  <Text
                    fontSize={10}
                    color="$coolGray500"
                    fontWeight="$bold"
                    textTransform="uppercase"
                    mb="$1"
                  >
                    {t('orders.details.weightRemainingShort') || 'Remaining'}
                  </Text>
                  <Text fontWeight="$black" color="$coolGray800" fontSize="$sm">
                    {(orderTotalWeight - weightPaid).toFixed(3)} gm
                  </Text>
                </Box>

                <Box
                  flex={1}
                  bg="#F9FAFB"
                  p="$3"
                  rounded="$xl"
                  borderWidth={1}
                  borderColor="#F3F4F6"
                  alignItems="center"
                >
                  <Text
                    fontSize={10}
                    color="$coolGray500"
                    fontWeight="$bold"
                    textTransform="uppercase"
                    mb="$1"
                    textAlign='center'
                  >
                    {t('orders.details.totalAmountPaid') || 'Total Paid'}
                  </Text>
                  <Text fontWeight="$black" color="$coolGray800" fontSize="$sm">
                    ₹{(totalPaid || 0).toLocaleString()}
                  </Text>
                </Box>
              </HStack>
            </Box>
          )}

          {/* Outstanding Balance with Making Charges */}
          {order.type === 'advance' && !isCompleted && (
            <Box
              bg="#FFFBEB"
              p="$5"
              rounded="$2xl"
              mb="$4"
              borderWidth={1}
              borderColor="#FEF3C7"
              style={styles.card}
            >
              <Text fontSize="$md" fontWeight="$black" color="#B45309" mb="$3">
                {t('orders.details.outstandingBalance') ||
                  'Outstanding Balance (Estimated)'}
              </Text>
              <VStack space="sm">
                <HStack justifyContent="space-between">
                  <Text color="$coolGray600" fontSize="$sm">
                    {t('orders.details.totalOrderCost') || 'Total Order Cost'}{' '}
                    (@ ₹{balanceRatePerGram.toLocaleString()}/
                    {t('common.gramShort') || 'gm'})
                  </Text>
                  <Text fontWeight="$medium" color="$coolGray900">
                    ₹{Math.round(totalOrderCost).toLocaleString()}
                  </Text>
                </HStack>
                {/* Metal and labour split out beneath the total they make up,
                    matching the create and success screens. */}
                <VStack space="xs" pl="$3">
                  <HStack justifyContent="space-between">
                    <Text fontSize={12} color="$coolGray500">
                      {t('advanceOrder.summary.itemCost') || 'Item cost'}
                      {orderTotalWeight > 0
                        ? ` (${orderTotalWeight.toFixed(3)} ${t('common.gramShort') || 'gm'})`
                        : ''}
                    </Text>
                    <Text fontSize={13} color="$coolGray700" fontWeight="$bold">
                      ₹{Math.round(orderTotalWeight * balanceRatePerGram).toLocaleString()}
                    </Text>
                  </HStack>
                  {estimatedMakingCharges > 0 && (
                    <HStack justifyContent="space-between">
                      <Text fontSize={12} color="$coolGray500">
                        {t('orders.details.makingCharges') || 'Making Charges'}
                      </Text>
                      <Text fontSize={13} color="$coolGray700" fontWeight="$bold">
                        ₹{Math.round(estimatedMakingCharges).toLocaleString()}
                      </Text>
                    </HStack>
                  )}
                </VStack>
                <HStack justifyContent="space-between">
                  <Text color="$coolGray600" fontSize="$sm">
                    {t('orders.details.advancePaid') || 'Advance Paid'}
                  </Text>
                  <Text fontWeight="$medium" color="$red500">
                    - ₹{Math.round(totalPaid).toLocaleString()}
                  </Text>
                </HStack>
                {/* Old gold settles weight without cash changing hands, so it
                    has to appear here too — otherwise the subtraction above
                    lands short by the exchange value on any order that has
                    one, which is the exact "numbers don't add up" complaint
                    this block exists to prevent. */}
                {exchangeValue > 0 && (
                  <HStack justifyContent="space-between">
                    <Text color="$coolGray600" fontSize="$sm">
                      {t('orders.details.oldOrnamentsAdjusted') ||
                        'Old Ornaments Adjusted'}
                    </Text>
                    <Text fontWeight="$medium" color="$red500">
                      - ₹{Math.round(exchangeValue).toLocaleString()}
                    </Text>
                  </HStack>
                )}
                <Divider bg="#FDE68A" my="$2" />
                <HStack justifyContent="space-between">
                  <Text color="$coolGray600" fontSize="$sm">
                    {t('orders.details.remainingWeight') || 'Remaining Weight'}
                  </Text>
                  <Text fontWeight="$medium" color="$coolGray900">
                    {remainingWeight.toFixed(3)} {t('common.gramShort') || 'gm'}
                  </Text>
                </HStack>
                <HStack justifyContent="space-between">
                  <Text color="$coolGray600" fontSize="$sm">
                    {t('orders.details.goldCost') || 'Gold Cost'} (@ ₹
                    {balanceRatePerGram.toLocaleString()}/
                    {t('common.gramShort') || 'gm'})
                  </Text>
                  <Text fontWeight="$medium" color="$coolGray900">
                    ₹{Math.round(estimatedGoldBalance).toLocaleString()}
                  </Text>
                </HStack>
                {estimatedMakingCharges > 0 && (
                  <HStack justifyContent="space-between">
                    <Text color="$coolGray600" fontSize="$sm">
                      {t('orders.details.makingCharges') || 'Making Charges'}
                    </Text>
                    <Text fontWeight="$medium" color="$coolGray900">
                      ₹{Math.round(estimatedMakingCharges).toLocaleString()}
                    </Text>
                  </HStack>
                )}
                {totalOtherCharges > 0 && (
                  <HStack justifyContent="space-between">
                    <Text color="$coolGray600" fontSize="$sm" flex={1} mr="$2">
                      {formatOtherChargesLabel(
                        t('orders.details.otherCharges') || 'Other Charges',
                        order?.items || [],
                      )}
                    </Text>
                    <Text fontWeight="$medium" color="$coolGray900">
                      ₹{totalOtherCharges.toLocaleString()}
                    </Text>
                  </HStack>
                )}
                {totalDiscount > 0 && (
                  <HStack justifyContent="space-between">
                    <Text fontSize="$sm">
                      {t('orders.details.totalDiscount') || 'Total Discount'}
                    </Text>
                    <Text fontWeight="$medium" color="$red500">
                      -  ₹{totalDiscount.toLocaleString()}
                    </Text>
                  </HStack>
                )}
                {orderGstAmount > 0 && (
                  <HStack justifyContent="space-between">
                    <Text color="$coolGray600" fontSize="$sm">
                      {t('invoicePreview.gst') || 'GST'} (
                      {shopDetails?.gstPercentage || 3}%)
                    </Text>
                    <Text fontWeight="$medium" color="$coolGray900">
                      ₹{Math.round(orderGstAmount).toLocaleString()}
                    </Text>
                  </HStack>
                )}
                <Divider bg="#FDE68A" my="$2" />
                <HStack justifyContent="space-between" alignItems="center">
                  <Text fontWeight="$bold" color="#92400E" fontSize="$sm">
                    {t('orders.details.estimatedTotalBalance') ||
                      'Estimated Total Balance'}
                  </Text>
                  <Text fontWeight="$black" color="#92400E" fontSize="$lg">
                    ₹{Math.round(estimatedTotalBalance).toLocaleString()}
                  </Text>
                </HStack>
              </VStack>
              <Text fontSize={10} color="$coolGray500" mt="$3" italic>
                {orderGstAmount > 0
                  ? t('advanceOrder.summary.balanceIncludesGstNote') ||
                  '* Includes estimated GST at current rate; recalculated at final settlement.'
                  : t('orders.details.gstFinalSettlementNote') ||
                  '* GST will be applied at final settlement'}
              </Text>
            </Box>
          )}

          {/* Payment History Card */}
          {order.type === 'advance' && (
            <Box bg="$white" p="$5" rounded="$2xl" mb="$4" style={styles.card}>
              <VStack space="sm">
                <HStack
                  justifyContent="space-between"
                  alignItems="center"
                  mb="$2"
                >
                  <Text
                    fontSize="$md"
                    fontWeight="$bold"
                    color="$coolGray900"
                  >
                    {t('orders.details.paymentHistory') || 'Payment History'}
                  </Text>
                  {order.status === 'pending' && (
                    <Pressable
                      onPress={() => {
                        setIsEditingPayment(false);
                        setPaymentDate(new Date());
                        setPaymentAmount('');
                        setPaymentNotes('');
                        setShowPaymentModal(true);
                      }}
                      bg="$white"
                      px="$4"
                      py="$2"
                      rounded="$lg"
                      borderWidth={1}
                      borderColor="$coolGray200"
                      flexDirection="row"
                      alignItems="center"
                    >
                      <Plus size={16} color="#374151" />
                      <Text
                        ml="$2"
                        fontSize="$sm"
                        fontWeight="$medium"
                        color="#374151"
                      >
                        {t('orders.details.addPayment') || 'Add Payment'}
                      </Text>
                    </Pressable>
                  )}
                </HStack>

                {/* Old gold settles weight like a payment does, but is NOT one —
                    no money changed hands, so it sits outside the payment list
                    and outside totalPaid. Shown here because this is where a
                    shopkeeper looks to understand how the order got settled. */}
                {hasExchange && (order?.exchangeWeightCovered ?? 0) > 0 && (
                  <HStack
                    bg="#EEF2FF"
                    p="$3"
                    rounded="$xl"
                    mb="$3"
                    alignItems="center"
                    justifyContent="space-between"
                    borderWidth={1}
                    borderColor="#C7D2FE"
                  >
                    <HStack alignItems="center" space="sm" flex={1}>
                      <Icon as={Scale} size="sm" color="#4F46E5" />
                      <VStack flex={1}>
                        <Text fontWeight="$bold" fontSize="$sm" color="#3730A3">
                          {t('orders.details.oldOrnamentSettled') || 'Old ornament'}
                        </Text>
                        <Text fontSize="$xs" color="#4F46E5">
                          {Number(order?.exchangeWeightCovered || 0).toFixed(3)} gm
                          {' · '}
                          ₹{exchangeValue.toLocaleString('en-IN')}
                        </Text>
                      </VStack>
                    </HStack>
                  </HStack>
                )}

                {/* Old gold worth more than the order — the shop owes the
                    difference back rather than it silently disappearing. */}
                {(order?.exchangeExcess ?? 0) > 0 && (
                  <HStack
                    bg="#FEF3C7"
                    p="$3"
                    rounded="$xl"
                    mb="$3"
                    alignItems="center"
                    justifyContent="space-between"
                    borderWidth={1}
                    borderColor="#FDE68A"
                  >
                    <Text fontWeight="$bold" fontSize="$sm" color="#92400E" flex={1}>
                      {t('orders.details.payableToCustomer') || 'Payable to customer'}
                    </Text>
                    <Text fontWeight="$black" fontSize="$md" color="#92400E">
                      ₹{Number(order?.exchangeExcess || 0).toLocaleString('en-IN')}
                    </Text>
                  </HStack>
                )}

                {paymentsSorted.length > 0 ? (
                  <Box style={{ maxHeight: 320 }}>
                    <ScrollView
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                    >
                      <VStack space="sm">
                        {paymentsSorted.map((p: any, i: number) => {
                          const payIndex = paymentsSorted.length - i;
                          return (
                            <Pressable
                              key={p._id || i}
                              onPress={() => {
                                setSelectedPayment(p);
                                setShowPaymentDetailsModal(true);
                              }}
                            >
                              <HStack
                                space="md"
                                bg="#F9FAFB"
                                p="$4"
                                rounded="$xl"
                                alignItems="center"
                              >
                                <Box
                                  width={32}
                                  height={32}
                                  bg="#F5F3FF"
                                  rounded="$full"
                                  alignItems="center"
                                  justifyContent="center"
                                  borderWidth={1}
                                  borderColor="#DDD6FE"
                                >
                                  <Text
                                    color="#6D5EF7"
                                    fontWeight="$bold"
                                    fontSize="$xs"
                                  >
                                    {payIndex}
                                  </Text>
                                </Box>
                                <VStack flex={1}>
                                  <HStack justifyContent="space-between" alignItems="center">
                                    <Text
                                      fontSize="$md"
                                      fontWeight="$bold"
                                      color="$coolGray900"
                                    >
                                      ₹{(p.amount || 0).toLocaleString()}
                                    </Text>
                                    <Text fontSize={12} color="$coolGray500">
                                      {new Date(p.date).toLocaleDateString(
                                        'en-GB',
                                        { day: '2-digit', month: 'short', year: 'numeric' },
                                      )}
                                    </Text>
                                  </HStack>
                                  <Text fontSize={13} color="$coolGray600" mt="$1" fontWeight="$medium">
                                    {Number(p.weightCovered || 0).toFixed(3)} gm @ ₹{(p.goldRate || 0).toLocaleString()}/gm
                                  </Text>
                                  {!!p.notes && (
                                    <Text fontSize={12} color="$coolGray400" mt="$1" italic>
                                      {p.notes}
                                    </Text>
                                  )}
                                </VStack>
                              </HStack>
                            </Pressable>
                          );
                        })}
                      </VStack>
                    </ScrollView>
                  </Box>
                ) : (
                  <Center py="$4">
                    <Text fontSize="$xs" color="$coolGray400">
                      {t('orders.details.noPaymentHistory') ||
                        'No payment history yet'}
                    </Text>
                  </Center>
                )}
              </VStack>
            </Box>
          )}

          {/* One card, one document chooser. These were two stacked cards -
              each with its own heading, its own Print/Download/Share row and
              its own printer note - which spent a lot of a small screen
              saying the same thing twice. Without an exchange there is only
              the order, and PrintDetailsCard drops the tab strip rather than
              offering a choice of one. */}
          <PrintDetailsCard
            tabs={[
              {
                key: 'order',
                label: t('orders.details.orderDetailsTitle') || 'Order Details',
                content: (
                  <>
                    {order.type === 'advance' && (order.payments?.length ?? 0) > 1 && (
                      <HStack alignItems="center" justifyContent="space-between" mb="$4" space="md">
                        <VStack flex={1}>
                          <Text fontSize="$sm" fontWeight="$medium" color="$coolGray800">
                            {t('orders.details.combinePaymentsTitle') || 'Combine payments as single (gift bill)'}
                          </Text>
                          <Text fontSize="$xs" color="$coolGray500" mt="$1">
                            {t('orders.details.combinePaymentsDesc') || "Hides individual installments on this copy only — your records stay itemized"}
                          </Text>
                        </VStack>
                        <Switch
                          value={combinePayments}
                          onValueChange={setCombinePayments}
                        />
                      </HStack>
                    )}

                    <DocumentActionsRow
                      onPrint={handlePrint}
                      onDownload={handleDownload}
                      onShare={handleSharePDF}
                      // Only offered when there is a number to send to; without
                      // one WhatsApp opens on its contact list with no hint,
                      // which the generic Share button already does better.
                      onWhatsApp={customer?.phone ? handleWhatsAppShare : undefined}
                    />

                    {/* Which printer Print will actually use. Without it the
                        button is a coin flip: a shop set to thermal with the
                        printer off taps Print and gets an error it did not
                        expect, with no idea the setting was ever thermal. */}
                    {printTargetLabel ? (
                      <PrintTargetNote
                        label={printTargetLabel}
                        onChangeInPlace={canChoosePrinter ? openChooser : undefined}
                      />
                    ) : null}
                  </>
                ),
              },
              // Only where there is something to declare. An ordinary sale
              // has nothing, and this collapses back to a single plain card.
              ...(hasExchange
                ? [{
                    key: 'declaration',
                    label: t('declaration.title') || 'Declaration / Affidavit',
                    content: orderDeclaration ? (
                      <>
                        <DocumentActionsRow
                          onPrint={handlePrintDeclaration}
                          onDownload={handleDownloadDeclaration}
                          onShare={handleShareDeclaration}
                        />
                        {/* Edit rides the printer note rather than taking a
                            line of its own. Both are small print under the
                            buttons, and on a phone a lone Edit on its own row
                            below a centred caption reads as a stray link. */}
                        <HStack alignItems="center" mt="$2" space="sm">
                          <Box flex={1}>
                            <PrintTargetNote mt="$0" />
                          </Box>
                          {/* Corrections after the fact - a wrong ID number or
                              the wrong language is otherwise unfixable. */}
                          <Pressable
                            onPress={() =>
                              navigation.navigate('OldGoldPurchase', { editId: orderDeclaration.id })
                            }
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <HStack alignItems="center" space="xs">
                              <Icon as={Pencil} size="xs" color={PURPLE} />
                              <Text color={PURPLE} fontWeight="$medium" fontSize="$xs">
                                {t('declaration.editDeclaration') || t('common.edit') || 'Edit'}
                              </Text>
                            </HStack>
                          </Pressable>
                        </HStack>
                      </>
                    ) : (
                      /* Nothing declared yet - the capture modal was never
                         completed. Understated on purpose, so it does not read
                         as a document that already exists. */
                      <VStack space="sm">
                        <Text fontSize="$xs" color="$coolGray500">
                          {t('declaration.notGeneratedHint') ||
                            'No declaration has been generated for this exchange yet.'}
                        </Text>
                        <Pressable onPress={handleCreateDeclaration} alignSelf="flex-start">
                          <HStack alignItems="center" space="xs" py="$1">
                            <FileSignature size={16} color={PURPLE} />
                            <Text fontSize="$sm" fontWeight="$bold" color={PURPLE}>
                              {t('declaration.generateButton') || 'Generate Declaration'}
                            </Text>
                          </HStack>
                        </Pressable>
                      </VStack>
                    ),
                  }]
                : []),
            ]}
          />

          {/* Customer history sits last: it navigates away from this order, so
              it belongs after the actions that act on the order itself. */}
          {(order.type === 'full' || order.status === 'completed') && order.customerId && (
            <Pressable
              onPress={() =>
                navigation.navigate('CustomerDetails', {
                  customerId: order.customerId,
                  customer: customer
                })
              }
            >
              <Box bg="$white" p="$4" rounded="$2xl" mb="$4" style={styles.card} borderWidth={1} borderColor="$coolGray100">
                <HStack justifyContent="space-between" alignItems="center">
                  <HStack space="md" alignItems="center">
                    <Box bg="rgba(109, 94, 247, 0.1)" p="$2.5" rounded="$xl">
                      <History size={20} color={PURPLE} />
                    </Box>
                    <VStack>
                      <Text fontWeight="$bold" color="$coolGray900" fontSize="$md">
                        {t('orders.details.viewFullTimeline') || 'View Customer History'}
                      </Text>
                      <Text fontSize="$xs" color="$coolGray500">
                        {t('orders.details.timelineSubtitle') || 'See all orders and payments for this customer'}
                      </Text>
                    </VStack>
                  </HStack>
                  <ArrowRight size={20} color={PURPLE} />
                </HStack>
              </Box>
            </Pressable>
          )}

          {/* Action Button: Mark as Completed */}
          {order.type === 'advance' && order.status === 'pending' && (
            <VStack space="xs" mb="$10" alignItems="center">
              <Pressable onPress={handleCompleteOrder} w="100%">
                <Box
                  bg={PURPLE}
                  p="$4"
                  rounded="$xl"
                  flexDirection="row"
                  justifyContent="center"
                  alignItems="center"
                >
                  <CheckCircle size={20} color="white" style={{ marginRight: 8 }} />
                  <Text fontWeight="$black" color="white" fontSize={16}>
                    {t('completeAdvance.completeAndGenerate')}
                  </Text>
                </Box>
              </Pressable>
              <Text fontSize={11} color="$coolGray400" textAlign="center" mt="$2">
                {t('orders.details.completeOrderNote') || 'Complete when ready to generate final bill with all charges'}
              </Text>
            </VStack>
          )}

        </VStack>
      </ScrollView>

      {/* Add Payment Modal */}
      <RNModal visible={showPaymentModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <Pressable
          flex={1}
          bg="rgba(15, 23, 42, 0.7)"
          justifyContent="flex-end"
          onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss}
        >
          <Pressable
            bg="$white"
            borderTopLeftRadius="$3xl"
            borderTopRightRadius="$3xl"
            p="$6"
            w="100%"
            maxHeight="85%"
            // No-op off web, so the sheet is unchanged on phones and tablets.
            // paddingBottom clears the Android nav bar; 40 keeps the old spacing
            // where there is no bar to clear.
            style={[LAYOUT.sheetSurfaceStyle, { paddingBottom: Math.max(insets.bottom, 40) }]}
            onPress={e => e.stopPropagation()}
          >
            <HStack justifyContent="space-between" alignItems="center" mb="$6">
              <VStack>
                <Text fontSize={20} fontWeight="$black" color="$coolGray900">
                  {isEditingPayment
                    ? t('orders.details.editInstallment') || 'Edit Installment'
                    : t('orders.details.addInstallment') || 'Add Installment'}
                </Text>
                <Text fontSize="$xs" color="$coolGray400">
                  {t('orders.details.recordingPaymentFor') ||
                    'Recording payment for'}{' '}
                  {customer?.name}
                </Text>
              </VStack>
              <Pressable
                onPress={() => !paymentLoading && setShowPaymentModal(false)}
                p="$2"
                bg="$coolGray50"
                rounded="$full"
              >
                <Text fontSize={16} fontWeight="$bold" color="$coolGray500">
                  ✕
                </Text>
              </Pressable>
            </HStack>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <VStack space="lg">
              <Box>
                <Text
                  fontSize={12}
                  color="$coolGray500"
                  mb="$2"
                  fontWeight="$bold"
                  textTransform="uppercase"
                >
                  {t('orders.details.paymentDate') || 'Payment Date'}
                </Text>
                <Pressable onPress={() => setShowDatePicker(true)}>
                  <Box
                    h={50}
                    bg="$coolGray50"
                    rounded="$full"
                    borderWidth={1}
                    borderColor="$coolGray200"
                    px="$4"
                    flexDirection="row"
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Text color="$coolGray800" fontWeight="600">
                      {paymentDate.toLocaleDateString('en-IN')}
                    </Text>
                    <Calendar size={18} color={PURPLE} />
                  </Box>
                </Pressable>
              </Box>

              <Box>
                <Text
                  fontSize={12}
                  color="$coolGray500"
                  mb="$2"
                  fontWeight="$bold"
                  textTransform="uppercase"
                >
                  {t('orders.details.amountReceived') ||
                    'Amount Received (₹) *'}
                </Text>
                <Input
                  variant="outline"
                  h={50}
                  bg="$coolGray50"
                  borderColor="$coolGray200"
                  rounded="$full"
                >
                  <InputField
                    placeholder={
                      t('orders.details.amountPlaceholder') ||
                      'Enter amount eg. 10000'
                    }
                    keyboardType="numeric"
                    value={paymentAmount}
                    onChangeText={setPaymentAmount}
                    maxLength={INPUT_LIMITS.amount}
                    style={{ fontSize: 16, fontWeight: '600' }}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </Input>
              </Box>

              <Box>
                <HStack
                  justifyContent="space-between"
                  alignItems="center"
                  mb="$2"
                >
                  <Text
                    fontSize={12}
                    color="$coolGray500"
                    fontWeight="$bold"
                    textTransform="uppercase"
                  >
                    {t('orders.details.goldRate') || 'Gold Rate'}
                  </Text>
                  <HStack space="md">
                    {bookingRate && (
                      <Pressable
                        onPress={() => {
                          setCustomGoldRate(String(bookingRate));
                          setUseCustomRate(true);
                        }}
                        bg="$blue50"
                        px="$2"
                        py="$0.5"
                        rounded="$md"
                      >
                        <Text
                          fontSize="$2xs"
                          color="$blue600"
                          fontWeight="$bold"
                        >
                          {t('orders.details.useBookingRate') ||
                            'Use Booking Rate'}{' '}
                          (₹{bookingRate})
                        </Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => setUseCustomRate(!useCustomRate)}
                      flexDirection="row"
                      alignItems="center"
                    >
                      <Box
                        w="$5"
                        h="$5"
                        rounded="$md"
                        borderWidth={2}
                        borderColor={useCustomRate ? PURPLE : '$coolGray300'}
                        bg={useCustomRate ? PURPLE : 'transparent'}
                        alignItems="center"
                        justifyContent="center"
                        mr="$2"
                      >
                        {useCustomRate && <CheckIcon size="xs" color="white" />}
                      </Box>
                      <Text fontSize="$xs" color="$coolGray700">
                        {t('orders.details.customRate') || 'Custom rate'}
                      </Text>
                    </Pressable>
                  </HStack>
                </HStack>

                {!useCustomRate && (
                  <Pressable
                    onPress={() => setShowPuritySelector(true)}
                    mb="$3"
                  >
                    <Box
                      h={44}
                      bg="$coolGray50"
                      rounded="$xl"
                      borderWidth={1}
                      borderColor="$coolGray200"
                      px="$4"
                      flexDirection="row"
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Text color="$coolGray800" fontWeight="600">
                        {getPurityLabel(paymentPurity)}
                      </Text>
                      <ChevronDown size={16} color="$coolGray400" />
                    </Box>
                  </Pressable>
                )}

                {useCustomRate ? (
                  <Input
                    variant="outline"
                    h={50}
                    bg="$coolGray50"
                    borderColor="$coolGray200"
                    rounded="$full"
                  >
                    <InputField
                      placeholder={String(defaultCurrentRatePerGram)}
                      keyboardType="numeric"
                      value={customGoldRate}
                      onChangeText={setCustomGoldRate}
                      maxLength={INPUT_LIMITS.rate}
                      style={{ fontSize: 16, fontWeight: '600' }}
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />
                  </Input>
                ) : (
                  <Box
                    h={50}
                    bg="$coolGray50"
                    rounded="$full"
                    px="$4"
                    justifyContent="center"
                  >
                    <HStack alignItems="baseline" space="xs">
                      <VStack>
                        <Text
                          fontSize={18}
                          fontWeight="$black"
                          color="$coolGray900"
                        >
                          ₹{currentRatePerGram.toLocaleString()}
                        </Text>
                      </VStack>
                      <Text fontSize={13} color="$coolGray500">
                        {t('orders.details.perGram') || 'per gram'}
                      </Text>
                    </HStack>
                  </Box>
                )}
              </Box>

              {paymentAmount && parseFloat(paymentAmount) > 0 ? (
                <Box bg="#6D5EF710" p="$3" rounded="$xl">
                  <Text fontSize={12} color="$coolGray500" mb="$1">
                    {t('orders.details.weightCovered') ||
                      'Weight covered by this payment:'}
                  </Text>
                  <Text fontSize={18} fontWeight="$black" color={PURPLE}>
                    {(currentRatePerGram > 0
                      ? parseFloat(paymentAmount) / currentRatePerGram
                      : 0
                    ).toFixed(3)}{' '}
                    {t('common.gramShort') || 'gm'}
                  </Text>
                </Box>
              ) : null}

              <Box>
                <Text
                  fontSize={12}
                  color="$coolGray500"
                  mb="$2"
                  fontWeight="$bold"
                  textTransform="uppercase"
                >
                  {t('orders.details.paymentNotes') || 'Payment Notes'}
                </Text>
                <Input
                  variant="outline"
                  h={50}
                  bg="$coolGray50"
                  borderColor="$coolGray200"
                  rounded="$full"
                >
                  <InputField
                    placeholder={
                      t('orders.details.paymentNotesPlaceholder') ||
                      'e.g. UPI, Cash, Cheque'
                    }
                    value={paymentNotes}
                    onChangeText={setPaymentNotes}
                    maxLength={INPUT_LIMITS.paymentNote}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </Input>
                <CharCounter value={paymentNotes} limit={INPUT_LIMITS.paymentNote} />
              </Box>

              <Pressable
                mt="$4"
                h={54}
                bg={paymentLoading || !paymentAmount ? '$coolGray200' : PURPLE}
                rounded="$2xl"
                onPress={handleAddPayment}
                disabled={paymentLoading || !paymentAmount}
                style={{ justifyContent: 'center', alignItems: 'center' }}
              >
                {paymentLoading ? (
                  <Text color="$white" fontWeight="$bold">
                    {t('orders.details.processing') || 'Processing...'}
                  </Text>
                ) : (
                  <Text color="$white" fontWeight="$black" fontSize={16}>
                    {t('orders.details.confirmPayment') || 'Confirm Payment'}
                  </Text>
                )}
              </Pressable>
            </VStack>
            </ScrollView>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </RNModal>

      <DatePickerModal
        isOpen={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        date={paymentDate.toISOString().split('T')[0]}
        onSelect={d => {
          setPaymentDate(new Date(d));
          setShowDatePicker(false);
        }}
      />

      {/* Purity Selector Modal */}
      <RNModal visible={showPuritySelector} transparent animationType="fade">
        <Pressable
          flex={1}
          bg="rgba(0,0,0,0.5)"
          justifyContent="center"
          p="$6"
          onPress={() => setShowPuritySelector(false)}
        >
          <Box bg="$white" rounded="$2xl" p="$4">
            <Text fontWeight="$bold" mb="$4" fontSize="$lg">
              {t('orders.details.selectPurity') || 'Select Purity'}
            </Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {purityOptions.map(p => (
                <Pressable
                  key={p.value}
                  p="$3"
                  borderBottomWidth={1}
                  borderBottomColor="$coolGray100"
                  onPress={() => {
                    setPaymentPurity(p.value);
                    setShowPuritySelector(false);
                  }}
                >
                  <HStack justifyContent="space-between" alignItems="center">
                    <Text
                      color={
                        paymentPurity === p.value ? PURPLE : '$coolGray800'
                      }
                      fontWeight={
                        paymentPurity === p.value ? '$bold' : '$normal'
                      }
                    >
                      {p.label}
                    </Text>
                    {paymentPurity === p.value && (
                      <CheckCircle size={16} color={PURPLE} />
                    )}
                  </HStack>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              mt="$4"
              onPress={() => setShowPuritySelector(false)}
              p="$3"
              bg="$coolGray100"
              rounded="$xl"
              alignItems="center"
            >
              <Text fontWeight="$bold">{t('common.cancel') || 'Cancel'}</Text>
            </Pressable>
          </Box>
        </Pressable>
      </RNModal>
      {/* Payment Details Modal */}
      <RNModal
        visible={showPaymentDetailsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPaymentDetailsModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setShowPaymentDetailsModal(false)}
        >
          <Box
            bg="$white"
            p="$6"
            borderTopLeftRadius={30}
            borderTopRightRadius={30}
            pb={insets.bottom + 10}
          >
            <HStack justifyContent="space-between" alignItems="center" mb="$6">
              <Text fontSize={22} fontWeight="$black" color="$coolGray900">
                {t('orders.details.paymentDetails') || 'Payment Details'}
              </Text>
              <Pressable onPress={() => setShowPaymentDetailsModal(false)}>
                <Box bg="$coolGray100" p="$2" rounded="$full">
                  <X size={22} />
                </Box>
              </Pressable>
            </HStack>

            {selectedPayment && (
              <VStack space="xl">
                <HStack
                  space="md"
                  alignItems="center"
                  bg="$slate50"
                  p="$4"
                  rounded="$2xl"
                >
                  <Box bg={PURPLE} p="$3" rounded="$2xl">
                    <Text color="white" fontWeight="$bold">
                      ₹
                    </Text>
                  </Box>
                  <VStack>
                    <Text
                      fontSize="$2xl"
                      fontWeight="$black"
                      color="$coolGray900"
                    >
                      ₹{selectedPayment.amount.toLocaleString()}
                    </Text>
                    <Text fontSize="$xs" color="$coolGray400">
                      {new Date(selectedPayment.date).toLocaleDateString(
                        'en-IN',
                        {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        },
                      )}
                    </Text>
                  </VStack>
                </HStack>

                <Box
                  bg="$coolGray50"
                  p="$4"
                  rounded="$2xl"
                  borderWidth={1}
                  borderColor="$coolGray100"
                >
                  <VStack space="md">
                    <HStack justifyContent="space-between">
                      <Text color="$coolGray500">
                        {t('invoice.labels.purity') || 'Purity'}
                      </Text>
                      <Text fontWeight="$bold" color="$coolGray800">
                        {getPurityLabel(selectedPayment.purity || '22K - 91.6%')}
                      </Text>
                    </HStack>
                    <HStack justifyContent="space-between">
                      <Text color="$coolGray500">
                        {t('orders.details.goldRate') || 'Gold Rate'}
                      </Text>
                      <Text fontWeight="$bold" color="$coolGray800">
                        ₹{selectedPayment.goldRate.toLocaleString()}/gm
                      </Text>
                    </HStack>
                    <HStack justifyContent="space-between">
                      <Text color="$coolGray500">
                        {t('orders.details.weightCovered') || 'Weight Covered'}
                      </Text>
                      <Text fontWeight="$bold" color={PURPLE}>
                        {(selectedPayment.weightCovered || 0).toFixed(3)} gm
                      </Text>
                    </HStack>
                    {selectedPayment.notes && (
                      <VStack space="xs" mt="$2">
                        <Text color="$coolGray500">
                          {t('orders.details.paymentNotes') || 'Notes'}
                        </Text>
                        <Text color="$coolGray800" italic>
                          {selectedPayment.notes}
                        </Text>
                      </VStack>
                    )}
                  </VStack>
                </Box>

                {!isCompleted && (
                  <HStack space="md" w="$full" mt="$2">
                    <Pressable
                      flex={1}
                      onPress={() => openEditPayment(selectedPayment)}
                      bg="$slate100"
                      p="$4"
                      rounded="$2xl"
                      flexDirection="row"
                      justifyContent="center"
                      alignItems="center"
                    >
                      <Text fontWeight="$bold" color="$coolGray700">
                        {t('dashboard.edit')}
                      </Text>
                    </Pressable>
                    <Pressable
                      flex={1}
                      onPress={() => setShowDeleteConfirmModal(true)}
                      bg="$red50"
                      p="$4"
                      rounded="$2xl"
                      flexDirection="row"
                      justifyContent="center"
                      alignItems="center"
                    >
                      <Text fontWeight="$bold" color="$red500">
                        {t('items.alerts.deleteConfirm')}
                      </Text>
                    </Pressable>
                  </HStack>
                )}
              </VStack>
            )}
          </Box>
        </Pressable>
      </RNModal>

      {/* Delete Confirmation Modal */}
      <RNModal
        visible={showDeleteConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirmModal(false)}
      >
        <Center flex={1} bg="rgba(0,0,0,0.5)" p="$6">
          <Box bg="$white" p="$6" rounded="$3xl" w="$full">
            <VStack space="lg" alignItems="center">
              <Box bg="$red100" p="$5" rounded="$full">
                <Trash2 size={28} />
              </Box>
              <VStack space="xs" alignItems="center">
                <Text fontSize="$lg" fontWeight="$black" color="$coolGray900">
                  {t('orders.details.deletePayment')}
                </Text>
                <Text fontSize="$sm" color="$coolGray500" textAlign="center">
                  {t('orders.details.deleteConfirmShort')}
                </Text>
              </VStack>
              <HStack space="md" w="$full">
                <Pressable
                  flex={1}
                  onPress={() => setShowDeleteConfirmModal(false)}
                  bg="$coolGray100"
                  p="$4"
                  rounded="$2xl"
                  alignItems="center"
                >
                  <Text fontWeight="$bold" color="$coolGray700">
                    {t('items.modal.cancelBtn')}
                  </Text>
                </Pressable>
                <Pressable
                  flex={1}
                  onPress={handleDeletePayment}
                  disabled={paymentLoading}
                  bg="$red500"
                  p="$4"
                  rounded="$2xl"
                  alignItems="center"
                >
                  {paymentLoading ? (
                    <Text color="white" fontWeight="$bold">
                      {t('orders.details.processing')}
                    </Text>
                  ) : (
                    <Text color="white" fontWeight="$bold">
                      {t('items.alerts.deleteConfirm')}
                    </Text>
                  )}
                </Pressable>
              </HStack>
            </VStack>
          </Box>
        </Center>
      </RNModal>
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

      {generatedDeclaration && (
        <DeclarationGeneratedSheet
          isOpen={!!generatedDeclaration}
          declarationNumber={generatedDeclaration.declarationNumber}
          photosFailed={generatedDeclarationPhotosFailed}
          onRetryPhotos={handleRetryGeneratedDeclarationPhotos}
          onPrint={handlePrintGeneratedDeclaration}
          onShare={handleShareGeneratedDeclaration}
          onDone={() => setGeneratedDeclaration(null)}
        />
      )}

      <OrnamentPhotoViewer
        photos={exchangePhotos}
        initialIndex={photoViewerIndex ?? 0}
        isOpen={photoViewerIndex !== null}
        onClose={() => setPhotoViewerIndex(null)}
      />

      <OrnamentPhotoViewer
        photos={itemPhotoViewer?.photos ?? []}
        initialIndex={itemPhotoViewer?.index ?? 0}
        isOpen={itemPhotoViewer !== null}
        onClose={() => setItemPhotoViewer(null)}
      />

      <AddPhotosModal
        isOpen={addPhotosOpen}
        onClose={() => setAddPhotosOpen(false)}
        existing={
          addPhotosExchangeIndex === null
            ? exchangePhotos
            : ((order?.exchanges || [])[addPhotosExchangeIndex] as any)?.photos || []
        }
        onUpload={
          addPhotosExchangeIndex === null
            ? handleUploadOrnamentPhotos
            : handleUploadExchangeRowPhotos
        }
        onDelete={
          addPhotosExchangeIndex === null ? handleDeleteOrnamentPhoto : undefined
        }
      />
    </Box>
  );
}

const styles = StyleSheet.create({
  card: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  shopLogo: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginBottom: 8,
  },
});
