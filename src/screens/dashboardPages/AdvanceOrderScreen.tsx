import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  Box,
  HStack,
  VStack,
  Text,
  Pressable,
  Input,
  InputField,
  ScrollView,
  Icon,
  Select,
  SelectTrigger,
  SelectInput,
  SelectPortal,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicatorWrapper,
  SelectDragIndicator,
  SelectItem,
  Checkbox,
  CheckboxIndicator,
  CheckboxIcon,
  CheckboxLabel,
  CheckIcon,
  SelectIcon,
  Divider,
  Switch,
} from "@gluestack-ui/themed";
import { ArrowLeft, Calendar, Plus, Trash2, Clock, ChevronDown, ChevronUp, TrendingUp } from "lucide-react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { useTranslation } from "../../hooks/useTranslation";
import { capitalizeWords } from "../../utils/textUtils";
import DatePickerModal from "../../components/common/DatePickerModal";
import CustomerInfoCard from "../../components/common/CustomerInfoCard";
import Collapsible from "../../components/common/Collapsible";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { addOrder, updateAdvanceOrderItems, fetchCustomers, fetchMetalRates, fetchCatalogProducts, MetalRates, clearUserData, uploadOrderOrnamentPhotos, uploadAllItemPhotos, uploadAllExchangePhotos, removeItemPhoto, removeExchangePhoto } from "../../store/data/dataSlice";
import { endImpersonation } from "../../store/auth/authSlice";
import ImpersonationBlockModal from "../../components/ImpersonationBlockModal";
import { Platform, KeyboardAvoidingView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { parseApiErrorList } from "../../utils/errorUtils";
import ValidationErrorModal from "../../components/ValidationErrorModal";
import CatalogOverwriteModal from "../../components/CatalogOverwriteModal";
import { mergeCatalogNumber, mergeCatalogText, overwrittenLabels } from "../../utils/catalogAutofill";
import { toast } from "../../components/common/Toast";
import ConfirmModal from "../../components/ConfirmModal";
import DiscardChangesModal from "../../components/DiscardChangesModal";
import { useDiscardGuard } from "../../hooks/useDiscardGuard";
import GradientSurface from '../../components/common/GradientSurface';
import GradientButton from '../../components/GradientButton';
import SelectField from '../../components/common/SelectField';
import { LAYOUT } from "../../constants/layout";
import HelpIconButton from "../../components/common/HelpIconButton";
import { HELP_TOPICS } from "../../tutorials/catalog";
import { GOLD_PURITY_OPTIONS, SILVER_PURITY_OPTIONS } from "../../constants/bill";
import { INPUT_LIMITS } from "../../constants/inputLimits";
import { formatNumber } from "../../utils/formatter";
import { formatOtherChargesLabel, optionalNumberField } from "../../utils/calculations";
import { getRateForPurity } from "../../utils/rateForPurity";
import { inspectItemEntry, asKilogramHint, type ItemFinding } from "../../utils/itemPlausibility";
import { describeItemFinding } from "../../utils/itemFindingCopy";
import type { ExchangeItem, PendingDeclarationPhoto, DeclarationPhoto } from "../../types";
import ItemPhotoPicker from "../../components/items/ItemPhotoPicker";

const PURPLE = "#6D5EF7";
const PINK = "#D946EF";
const BORDER = "#E5E7EB";
const BG = "#F9FAFB";

interface OrderItem {
  id: string;
  name: string;
  huid?: string;
  pcs: string;
  itemType: "Gold" | "Silver";
  purity: string;
  grossWt: string;
  lessWt: string;
  netWt: string;
  rate: string;
  useCustomRate?: boolean;
  rateSourcePurity?: string;
  makingChargeType: string;
  makingChargeValue: string;
  otherChargesDescription: string;
  otherChargesAmount: string;
  discountType: string;
  discount: string;
  /** Local picks, uploaded once the order is saved and has an id. */
  pendingPhotos?: PendingDeclarationPhoto[];
  /** Already uploaded — only present when editing a saved order. */
  photos?: DeclarationPhoto[];
}

const FieldLabel = ({ children }: { children: string }) => (
  <Text style={{ fontSize: 13, marginBottom: 6, color: "#374151", fontWeight: "600" }}>{children}</Text>
);

const nonEmpty = (s: any) => (typeof s === "string" && s.trim().length > 0 ? s : "");

/**
 * The two money components of a single item: the metal itself, and the making
 * charge by whichever type the item uses.
 *
 * One implementation deliberately, read by the collapsed item summary, the order
 * total and the balance alike. Separate copies of this arithmetic quietly
 * drifting apart is how the order screen and the printed bill ended up quoting
 * different totals for the same order.
 */
const itemGoldAndMaking = (item: OrderItem) => {
  const netWt = parseFloat(item.netWt) || 0;
  const grossWt = parseFloat(item.grossWt) || 0;
  const rate = parseFloat(item.rate) || 0;
  const makingValue = parseFloat(item.makingChargeValue) || 0;

  let making = 0;
  if (item.makingChargeType === "Per Gram") {
    making = grossWt * makingValue;
  } else if (item.makingChargeType === "%") {
    making = (grossWt * rate * makingValue) / 100;
  } else {
    making = makingValue; // Fixed / "Fix"
  }

  return { goldCost: netWt * rate, making };
};

const StyledSelect = ({
  value,
  onValueChange,
  items,
  placeholder = "Select...",
  readOnly = false,
}: {
  value: string;
  onValueChange: (v: string) => void;
  items: { label: string; value: string }[];
  placeholder?: string;
  readOnly?: boolean;
}) => {
  // gluestack renders the raw `selectedValue` on the trigger until the user
  // picks something, so a value like "%" or "Fix" showed instead of its label —
  // and in Marathi/Hindi/Gujarati the untranslated value showed. Resolving the
  // label here makes the closed trigger match the open list.
  const selectedLabel = items.find((i) => i.value === value)?.label;

  return (
  <Box h={44} w="$full" rounded="$xl" borderWidth={1} borderColor={BORDER} bg="$white">
    <Select
      // SelectInput renders `label || value`, and `label` lives in Select's own
      // state — seeded once from selectedLabel. Without this the trigger showed
      // the raw value ("%", "Fix") until the user opened the list and picked.
      //
      // key forces a remount when the value changes from outside (catalog
      // autofill, metal-type switch resetting purity); that state is
      // initialised only on first render, so it would otherwise go stale and
      // display the previous option's label.
      key={value}
      selectedValue={value}
      selectedLabel={selectedLabel}
      onValueChange={(v) => onValueChange(v as string)}
      isDisabled={readOnly}
    >
      <SelectTrigger variant="outline" style={{ height: 44, borderWidth: 0, paddingRight: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <SelectInput placeholder={selectedLabel || placeholder} style={{ height: '100%', flex: 1, fontSize: 14, color: "#111827" }} pointerEvents="none" />
        <SelectIcon pointerEvents="none">
          <Icon as={ChevronDown} size="sm" color="#6B7280" />
        </SelectIcon>
      </SelectTrigger>
      <SelectPortal>
        <SelectBackdrop />
        <SelectContent
          pb="$10"
          zIndex={9999}
          style={{ width: '100%', top: 'auto', bottom: 0 }}
        >
          <SelectDragIndicatorWrapper>
            <SelectDragIndicator />
          </SelectDragIndicatorWrapper>
          {items.map((it) => (
            <SelectItem key={it.value} label={it.label} value={it.value} />
          ))}
        </SelectContent>
      </SelectPortal>
    </Select>
  </Box>
  );
};

const AdvanceOrderScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<NativeStackScreenProps<RootStackParamList, "AdvanceOrder">["route"]>();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { customers, metalRates, catalogProducts, orders, shopDetails } = useAppSelector((state) => state.data);
  const { impersonateUserId, impersonatePhone } = useAppSelector(s => s.auth);
  const [blockModalVisible, setBlockModalVisible] = useState(false);

  /**
   * Removes a photo already uploaded against a saved order.
   *
   * The DELETE route, the thunk and its reducer all existed; nothing ever
   * called them, so the X on a saved tile stayed hidden and a wrong photo could
   * be added but never taken back. Adding a replacement already worked - the
   * edit path uploads pending item photos on save - so this was the missing
   * half, not the whole feature.
   */
  const handleDeleteItemPhoto = React.useCallback(
    async (itemIndex: number, fileId: string): Promise<boolean> => {
      if (!editOrderId) return false;
      if (impersonateUserId) {
        setBlockModalVisible(true);
        return false;
      }
      const action = await dispatch(
        removeItemPhoto({ id: editOrderId, kind: 'order', itemIndex, fileId }),
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



  const editOrderId = route.params?.editOrderId;
  const originalOrder = useMemo(
    () => (editOrderId ? orders.find(o => o.id === editOrderId) : undefined),
    [editOrderId, orders],
  );
  /** Removes a photo from one gold/silver row on a saved order. */
  const handleDeleteExchangePhoto = React.useCallback(
    async (exchangeIndex: number, fileId: string): Promise<boolean> => {
      if (!editOrderId) return false;
      if (impersonateUserId) {
        setBlockModalVisible(true);
        return false;
      }
      const action = await dispatch(
        removeExchangePhoto({ id: editOrderId, kind: "order", exchangeIndex, fileId }),
      );
      if (removeExchangePhoto.fulfilled.match(action)) return true;
      toast.error(
        String((action as any).payload || "") ||
          t("declaration.photos.deleteFailed") ||
          "Photo could not be removed.",
      );
      return false;
    },
    [dispatch, editOrderId, impersonateUserId, t],
  );


  const handleEndSession = () => {
    dispatch(endImpersonation());
    dispatch(clearUserData());
    navigation.navigate('AdminDashboard');
  };

  const getPurityLabel = (value: string) => {
    switch (value) {
      case "24K - 99.5%":
        return t("metals.purity.gold24k995gw") || "24K - 99.5%";
      case "23K - 95.8%":
        return t("metals.purity.gold23k") || "23K - 95.8%";
      case "22K - 91.6%":
        return t("metals.purity.gold22k") || "22K - 91.6%";
      case "21K - 87.5%":
        return t("metals.purity.gold21k") || "21K - 87.5%";
      case "20K - 83.3%":
        return t("metals.purity.gold20k") || "20K - 83.3%";
      case "18K - 75%":
        return t("metals.purity.gold18k") || "18K - 75%";
      case "17K - 70.8%":
        return t("metals.purity.gold17k") || "17K - 70.8%";
      case "14K - 58.5%":
        return t("metals.purity.gold14k") || "14K - 58.5%";
      case "9K - 37.5%":
        return t("metals.purity.gold9k") || "9K - 37.5%";
      case "Silver":
        return t("metals.purity.silver") || "Silver";
      case "Silver Coin":
        return t("metals.purity.silverCoin") || "Silver Coin";
      default:
        return value;
    }
  };

  const goldPurityItems = GOLD_PURITY_OPTIONS.map((p) => ({ label: getPurityLabel(p), value: p }));
  const silverPurityItems = SILVER_PURITY_OPTIONS.map((p) => ({ label: getPurityLabel(p), value: p }));

  const metalOptions = [
    { label: t("metals.gold") || "Gold", value: "Gold" },
    { label: t("metals.silver") || "Silver", value: "Silver" },
  ];

  const customerId = route.params?.customerId;
  const customer = useMemo(() => {
    if (!customerId || !Array.isArray(customers)) return undefined;
    return customers.find((c) => c.id === customerId);
  }, [customers, customerId]);

  useEffect(() => {
    dispatch(fetchCustomers());
    dispatch(fetchMetalRates());
    dispatch(fetchCatalogProducts());
  }, [dispatch]);

  useEffect(() => {
    if (!customerId) {
      navigation.replace("SelectCustomer", { next: "AdvanceOrder" });
    }
  }, [customerId, navigation]);

  const preservedStateRaw = route.params?.preservedState as string | undefined;
  const preservedState = useMemo(() => {
    if (!preservedStateRaw) return null as null | any;
    try {
      return JSON.parse(preservedStateRaw);
    } catch {
      return null;
    }
  }, [preservedStateRaw]);

  const preservedItemsParam = route.params?.preservedItems;
  const [items, setItems] = useState<OrderItem[]>(() => {
    if (preservedState?.items) return preservedState.items as OrderItem[];
    if (preservedItemsParam) {
      try { return JSON.parse(preservedItemsParam) as OrderItem[]; } catch { /* ignore */ }
    }
    return [];
  });

  // Edit mode: prefill items from the persisted order once it's available.
  // Only stock the net weight (`weight`) is stored server-side for advance
  // order items, so gross/less default to weight/0 — there's no original
  // gross/less split to recover.
  const editItemsLoaded = useRef(false);
  /** What edit mode started with, so the back guard can tell an untouched
   *  prefilled form from one the shopkeeper has actually changed. */
  const loadedItems = useRef<string | null>(null);
  useEffect(() => {
    if (!editOrderId || editItemsLoaded.current || !originalOrder?.items?.length) return;
    editItemsLoaded.current = true;
    const loaded: OrderItem[] = originalOrder.items.map((it: any, idx: number) => ({
      id: it.id || it._id || `edit_${idx}`,
      name: it.itemName || it.name || '',
      huid: it.huid || '',
      pcs: String(it.pcs ?? 1),
      itemType: (it.itemType || 'Gold') as 'Gold' | 'Silver',
      purity: it.purity || '22K - 91.6%',
      grossWt: String(it.grossWeight ?? it.weight ?? 0),
      lessWt: String(it.lessWeight ?? 0),
      netWt: String(it.weight ?? it.netWeight ?? 0),
      rate: String(it.rate ?? ''),
      // Editing an already-persisted item: freeze the rate that was
      // recorded rather than silently re-deriving it from today's live
      // metal rate, which may have moved since the order was created.
      useCustomRate: true,
      rateSourcePurity: it.purity || '22K - 91.6%',
      makingChargeType: it.makingChargeType || '%',
      makingChargeValue: String(it.makingChargeValue ?? 0),
      otherChargesDescription: it.chargeDescription || '',
      otherChargesAmount: String(it.chargeAmount ?? 0),
      discountType: it.discountType || 'Fixed',
      discount: String(it.discount ?? 0),
    }));
    setItems(loaded);
    loadedItems.current = JSON.stringify(loaded);
  }, [editOrderId, originalOrder]);

  const [orderDate, setOrderDate] = useState(() => {
    const iso = preservedState?.orderDate;
    if (typeof iso === "string" && iso) {
      const d = new Date(iso);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState(() => String(preservedState?.advanceAmount ?? ""));
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "online">(() => preservedState?.paymentMethod || "cash");
  const [onlinePaymentType, setOnlinePaymentType] = useState<string | undefined>(() => preservedState?.onlinePaymentType);
  // Was `rateWarningItemId` — a rate-only flag. It could only ever say "the rate
  // looks wrong", which is the wrong field to name when the mistake is a weight
  // typed in milligrams. Now carries the finding itself; see
  // utils/itemPlausibility.ts for the production case that forced the change.
  const [itemFinding, setItemFinding] = useState<{ itemId: string; finding: ItemFinding } | null>(null);
  const rateInputRefs = useRef<Map<string, any>>(new Map());
  const [enableExchange, setEnableExchange] = useState(() => !!preservedState?.enableExchange);
  // Item photos are the shop's own record by default; printing them on the
  // customer's copy is a deliberate opt-in, per order.
  const [includeItemPhotosOnBill, setIncludeItemPhotosOnBill] = useState(
    () => !!preservedState?.includeItemPhotosOnBill,
  );
  // Optional photos of the old ornaments. Local until a declaration is created;
  // never required, and never blocks saving the order.
  const [ornamentPhotos, setOrnamentPhotos] = useState<PendingDeclarationPhoto[]>(
    () => preservedState?.ornamentPhotos || [],
  );
  const [generateDeclaration, setGenerateDeclaration] = useState(
    () => !!preservedState?.generateDeclaration,
  );
  const [exchanges, setExchanges] = useState<ExchangeItem[]>(() => preservedState?.exchanges || []);
  const [includeGst, setIncludeGst] = useState(() => preservedState?.includeGst ?? false);
  const [customerGstin, setCustomerGstin] = useState(() => String(preservedState?.customerGstin ?? ""));
  const [submitting, setSubmitting] = useState(false);
  const [expandedItemIds, setExpandedItemIds] = useState<string[]>(() => Array.isArray(preservedState?.expandedItemIds) ? preservedState.expandedItemIds : []);
  const [expandedExchangeIds, setExpandedExchangeIds] = useState<string[]>(() => Array.isArray(preservedState?.expandedExchangeIds) ? preservedState.expandedExchangeIds : []);
  const [exchangeAmountAlert, setExchangeAmountAlert] = useState(false);
  const [showItemErrors, setShowItemErrors] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [overwrittenFields, setOverwrittenFields] = useState<string[]>([]);
  const [showValidationModal, setShowValidationModal] = useState(false);

  // Nothing here is persisted until "Create Order", so a back press — header
  // arrow, Android hardware back or iOS swipe — throws the whole order away.
  // Edit mode opens on the persisted items, so it compares against what it
  // loaded rather than reading a prefilled form as unsaved input.
  const hasOrderInput = editOrderId
    ? loadedItems.current !== null && JSON.stringify(items) !== loadedItems.current
    : items.length > 0 ||
      advanceAmount.trim() !== "" ||
      enableExchange ||
      exchanges.length > 0 ||
      ornamentPhotos.length > 0 ||
      exchanges.some((ex: any) => (ex.pendingPhotos?.length ?? 0) > 0) ||
      includeGst ||
      customerGstin.trim() !== "" ||
      paymentMethod !== "cash";
  const discardGuard = useDiscardGuard(hasOrderInput);

  const totalWeight = useMemo(() => {
    return items.reduce((sum, item) => sum + (parseFloat(item.netWt) || 0), 0);
  }, [items]);

  // Weighted-average rate across items (Σ netWt·rate / Σ netWt) — items now
  // carry their own rate, so there's no single "booking rate" input anymore;
  // this is the effective rate used for Weight Covered.
  const effectiveRate = useMemo(() => {
    const totalNetWt = items.reduce((s, i) => s + (parseFloat(i.netWt) || 0), 0);
    if (totalNetWt <= 0) return 0;
    const weighted = items.reduce((s, i) => s + (parseFloat(i.netWt) || 0) * (parseFloat(i.rate) || 0), 0);
    return weighted / totalNetWt;
  }, [items]);

  const advanceAmountNum = parseFloat(advanceAmount) || 0;

  // Declared here rather than beside the other money totals below, because the
  // weight calculation now depends on it.
  const exchangeTotal = useMemo(() => {
    return enableExchange ? exchanges.reduce((sum, ex) => sum + (Number(ex.amount) || 0), 0) : 0;
  }, [enableExchange, exchanges]);

  // Old gold settles weight exactly as cash does. Previously only the advance
  // amount fed this, so an exchange reduced what the customer owed in rupees
  // while leaving the grams they still owed untouched — the money and weight
  // halves of the same order disagreed. Mirrors order.model.ts's pre-save hook.
  const exchangeWeightCovered = useMemo(() => {
    return effectiveRate > 0 ? exchangeTotal / effectiveRate : 0;
  }, [exchangeTotal, effectiveRate]);

  const cashWeightCovered = useMemo(() => {
    return effectiveRate > 0 ? advanceAmountNum / effectiveRate : 0;
  }, [advanceAmountNum, effectiveRate]);

  const weightCovered = useMemo(
    () => cashWeightCovered + exchangeWeightCovered,
    [cashWeightCovered, exchangeWeightCovered],
  );

  /**
   * Whether anything covers weight at all. Old gold settles weight on its own,
   * so this is deliberately not `advanceAmountNum > 0`: an order paid entirely
   * in old ornaments used to render no coverage and no summary, leaving the
   * grams it had already settled invisible.
   */
  const hasCoverage = advanceAmountNum > 0 || exchangeTotal > 0;

  /**
   * The split only needs spelling out when old gold is in play. With no
   * exchange the whole covered weight came from the amount typed directly
   * above it, and a lone breakdown row restating the total is noise.
   */
  const showCoverageSplit = exchangeTotal > 0;

  const remainingWeight = useMemo(() => {
    return Math.max(0, totalWeight - weightCovered);
  }, [totalWeight, weightCovered]);

  // Per-item value using each item's own rate — mirrors calculateItemValues
  // in utils/calculations.ts (Full payment) and the backend's Order pre-save
  // hook, so the number shown here matches what gets persisted.
  const itemsSubtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const { goldCost, making } = itemGoldAndMaking(item);
      const other = parseFloat(item.otherChargesAmount) || 0;
      const discount = parseFloat(item.discount) || 0;

      let itemSubtotal = goldCost + making + other;
      if (item.discountType === "%") {
        itemSubtotal = itemSubtotal - (itemSubtotal * discount) / 100;
      } else {
        itemSubtotal = itemSubtotal - discount;
      }

      return sum + Math.max(0, itemSubtotal);
    }, 0);
  }, [items]);

  // Components of itemsSubtotal, so the summary can show what the total is made
  // of rather than a lump sum the shop has to reverse-engineer.
  const itemsGoldValue = useMemo(
    () => items.reduce((s, it) => s + itemGoldAndMaking(it).goldCost, 0),
    [items],
  );
  const itemsMakingTotal = useMemo(
    () => items.reduce((s, it) => s + itemGoldAndMaking(it).making, 0),
    [items],
  );
  const itemsOtherCharges = useMemo(
    () => items.reduce((s, it) => s + (parseFloat(it.otherChargesAmount) || 0), 0),
    [items],
  );
  /**
   * Taken as the residual rather than recomputed, because a percentage discount
   * applies to the item's own subtotal and each item clamps at zero. Deriving it
   * this way means the displayed lines always add up to the displayed total —
   * they cannot disagree even on inputs this screen has not anticipated.
   */
  const itemsDiscountTotal = useMemo(
    () =>
      Math.max(
        0,
        itemsGoldValue + itemsMakingTotal + itemsOtherCharges - itemsSubtotal,
      ),
    [itemsGoldValue, itemsMakingTotal, itemsOtherCharges, itemsSubtotal],
  );

  const subtotalBeforeGst = useMemo(() => Math.max(0, itemsSubtotal - exchangeTotal), [itemsSubtotal, exchangeTotal]);

  const gstAmount = useMemo(() => {
    const gstRate = ((shopDetails as any)?.gstPercentage || 3) / 100;
    return includeGst ? subtotalBeforeGst * gstRate : 0;
  }, [includeGst, subtotalBeforeGst, shopDetails]);

  // Kept for the payload/edit-mode display: total item value before the GST
  // add-on, matching what used to be called "estimatedTotalAmount".
  const estimatedTotalAmount = subtotalBeforeGst;

  const estimatedBalance = useMemo(() => {
    return Math.max(0, subtotalBeforeGst + gstAmount - advanceAmountNum);
  }, [subtotalBeforeGst, gstAmount, advanceAmountNum]);

  const addItem = () => {
    // Validate current items before adding a new one
    const hasIncomplete = items.some(
      (item) => !item.name.trim() || !item.grossWt || parseFloat(item.grossWt) <= 0
    );

    if (hasIncomplete) {
      setShowItemErrors(true);
      // Expand the first incomplete item
      const firstIncompleteId = items.find(
        (item) => !item.name.trim() || !item.grossWt || parseFloat(item.grossWt) <= 0
      )?.id;
      if (firstIncompleteId) setExpandedItemIds([firstIncompleteId]);
      return;
    }

    setShowItemErrors(false);

    const newId = Date.now().toString();
    const defaultPurity = "22K - 91.6%";
    setItems((prev) => [
      ...prev,
      {
        id: newId,
        name: "",
        huid: "",
        pcs: "1",
        itemType: "Gold",
        purity: defaultPurity,
        grossWt: "",
        lessWt: "",
        netWt: "",
        rate: String(getRateForPurity(defaultPurity, metalRates)),
        useCustomRate: false,
        rateSourcePurity: defaultPurity,
        makingChargeType: "%",
        makingChargeValue: "",
        otherChargesDescription: "",
        otherChargesAmount: "",
        discountType: "Fixed",
        discount: "",
      },
    ]);
    setExpandedItemIds([newId]);
  };

  const toggleItem = (id: string) => {
    setExpandedItemIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const validateNumericInput = (text: string, decimalPlaces = 10) => {
    if (text === "" || text === ".") return true;
    const regex = new RegExp(`^\\d*\\.?\\d{0,${decimalPlaces}}$`);
    return regex.test(text);
  };

  const updateItem = (id: string, field: keyof OrderItem, value: any) => {
    // Numeric validation
    if (field === "pcs") {
      const sanitized = String(value).replace(/[^0-9]/g, "");
      value = sanitized;
    } else if (["grossWt", "lessWt", "otherChargesAmount", "discount", "makingChargeValue", "rate"].includes(field as string)) {
      if (!validateNumericInput(String(value))) return;
    }

    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === "itemType") {
            const nextPurity = value === "Silver" ? "Silver" : "22K - 91.6%";
            updated.purity = nextPurity;
            updated.rateSourcePurity = nextPurity;
            if (!item.useCustomRate) {
              updated.rate = String(getRateForPurity(nextPurity, metalRates));
            }
          }
          if (field === "purity") {
            updated.rateSourcePurity = value;
            if (!item.useCustomRate) {
              updated.rate = String(getRateForPurity(value, metalRates));
            }
          }
          if (field === "useCustomRate") {
            updated.rate = value
              ? ""
              : String(getRateForPurity(item.rateSourcePurity || item.purity, metalRates));
          }
          if (field === "grossWt" || field === "lessWt") {
            const gross = parseFloat(String(field === "grossWt" ? value : item.grossWt)) || 0;
            const less = parseFloat(String(field === "lessWt" ? value : item.lessWt)) || 0;
            const net = Math.max(0, gross - less);
            // formatNumber, not toFixed: a whole net weight reads "19", not
            // "19.000". Blank until a weight is actually entered, so the field
            // never sits at "0" waiting to be cleared.
            const entered =
              String(field === "grossWt" ? value : item.grossWt ?? "").trim() !== "" ||
              String(field === "lessWt" ? value : item.lessWt ?? "").trim() !== "";
            updated.netWt = entered ? formatNumber(net) : "";
          }
          return updated;
        }
        return item;
      })
    );
  };

  /** Runs on blur of any weight or rate field. Silent unless the pair is
   *  physically impossible — see utils/itemPlausibility.ts. */
  const checkItemEntry = (item: OrderItem) => {
    const net = (parseFloat(item.grossWt) || 0) - (parseFloat(item.lessWt) || 0);
    const liveRate = getRateForPurity(item.rateSourcePurity || item.purity, metalRates);
    const found = inspectItemEntry({
      itemType: item.itemType,
      purity: item.purity,
      weight: net,
      rate: item.rate,
    });

    // Bounds catch the impossible; the live rate catches the merely improbable.
    if (!found && liveRate > 0) {
      const entered = parseFloat(item.rate) || 0;
      if (entered > 0 && (entered > liveRate * 3 || entered < liveRate / 3)) {
        setItemFinding({
          itemId: item.id,
          finding: {
            kind: entered > liveRate ? 'rate-too-high' : 'rate-too-low',
            metal: item.itemType === 'Silver' ? 'Silver' : 'Gold',
            weight: net,
            rate: entered,
            enteredTotal: net * entered,
            suggestedRate: liveRate,
            suggestedWeight: net,
            suggestedTotal: net * liveRate,
          },
        });
        return;
      }
    }

    setItemFinding(found ? { itemId: item.id, finding: found } : null);
  };

  const applyItemFinding = () => {
    if (!itemFinding) return;
    const { itemId, finding } = itemFinding;
    const item = items.find((i) => i.id === itemId);
    if (!item) return setItemFinding(null);

    if (finding.suggestedWeight !== undefined) {
      const net = (parseFloat(item.grossWt) || 0) - (parseFloat(item.lessWt) || 0);
      if (finding.suggestedWeight !== net) {
        // Onto gross: less weight is a stone deduction measured separately, and
        // scaling it would invent a figure the shopkeeper never entered.
        const less = parseFloat(item.lessWt) || 0;
        updateItem(itemId, "grossWt", String(Number((finding.suggestedWeight + less).toFixed(3))));
      }
    }
    if (finding.suggestedRate !== undefined) {
      updateItem(itemId, "useCustomRate", true);
      updateItem(itemId, "rate", String(finding.suggestedRate));
    }
    setItemFinding(null);
  };

  // Keep non-custom-rate items' rate synced with live metal rates (e.g. rates
  // finish loading after items were already added, or change mid-session).
  useEffect(() => {
    if (!metalRates) return;
    setItems((prev) =>
      prev.map((item) => {
        if (item.useCustomRate) return item;
        const liveRate = getRateForPurity(item.rateSourcePurity || item.purity, metalRates);
        if (liveRate <= 0) return item;
        const currentRate = Number(item.rate || 0);
        if (Math.abs(currentRate - liveRate) < 0.001) return item;
        return { ...item, rate: String(liveRate) };
      })
    );
  }, [metalRates]);

  /** Field labels carry "*" and line breaks for the form; a sentence list wants neither. */
  const fieldLabel = (key: string, fallback: string) =>
    (t(key) || fallback).replace(/\s*\*\s*$/, "").replace(/\n/g, " ").trim();

  const autoFillFromCatalog = (id: string, catalogItemId: string) => {
    const saved = catalogProducts.find((p) => p.id === catalogItemId);
    const current = items.find((i) => i.id === id);
    if (!saved || !current) return;

    // A saved item never overrides a field it has nothing for — every numeric
    // field on a catalogue product is `default: 0`, so a stored 0 means "not
    // set" and must leave a typed value alone. Where the item does carry a value
    // it wins, and whatever the shopkeeper had typed there is reported
    // afterwards rather than disappearing. Same rule and same helpers as the
    // invoice form's handleAutoFill.
    //
    // Worked out here rather than inside the updater below: a state updater can
    // be called more than once for a single update, so it is the wrong place to
    // build a list of what changed.
    const purity = saved.purity || (saved.category === "Silver" ? "Silver" : "22K - 91.6%");
    const catalogRate = String(getRateForPurity(purity, metalRates));

    const merged = {
      name: mergeCatalogText(saved.name, current.name),
      huid: mergeCatalogText(saved.huid, current.huid),
      grossWt: mergeCatalogNumber(saved.grossWt, current.grossWt),
      lessWt: mergeCatalogNumber(saved.lessWt, current.lessWt),
      makingChargeValue: mergeCatalogNumber(saved.makingCharges, current.makingChargeValue),
      otherChargesDescription: mergeCatalogText(
        saved.otherChargeDesc,
        current.otherChargesDescription
      ),
      otherChargesAmount: mergeCatalogNumber(saved.otherChargeAmount, current.otherChargesAmount),
      discount: mergeCatalogNumber(saved.discount, current.discount),
    };

    const lost = overwrittenLabels([
      { label: fieldLabel("advanceOrder.fields.itemName", "Item Name"), merged: merged.name },
      { label: fieldLabel("advanceOrder.fields.huid", "HUID"), merged: merged.huid },
      { label: fieldLabel("advanceOrder.fields.grossWt", "Gross Wt"), merged: merged.grossWt },
      { label: fieldLabel("advanceOrder.fields.lessWt", "Less Wt"), merged: merged.lessWt },
      { label: fieldLabel("advanceOrder.fields.charges", "Charges"), merged: merged.makingChargeValue },
      { label: fieldLabel("advanceOrder.fields.otherChargeDesc", "Other Charge Desc"), merged: merged.otherChargesDescription },
      { label: fieldLabel("advanceOrder.fields.chargeAmount", "Charge Amount"), merged: merged.otherChargesAmount },
      { label: fieldLabel("advanceOrder.fields.discount", "Discount"), merged: merged.discount },
    ]);

    // A hand-typed rate is a typed value too, and picking a saved item drops
    // back to the catalogue purity's rate.
    if (
      current.useCustomRate &&
      String(current.rate ?? "") !== "" &&
      String(current.rate) !== catalogRate
    ) {
      lost.push(fieldLabel("advanceOrder.fields.rate", "Rate"));
    }

    const gross = merged.grossWt.value;
    const less = merged.lessWt.value;
    const grossNum = parseFloat(gross) || 0;
    const lessNum = parseFloat(less) || 0;

    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              name: merged.name.value,
              huid: merged.huid.value,
              pcs: String(saved.pcs || 1),
              itemType: (saved.category === "Others" ? "Gold" : saved.category) as "Gold" | "Silver",
              purity,
              grossWt: gross,
              lessWt: less,
              netWt: gross === "" && less === "" ? "" : formatNumber(Math.max(0, grossNum - lessNum)),
              rate: catalogRate,
              useCustomRate: false,
              rateSourcePurity: purity,
              makingChargeType: saved.makingChargeType || "%",
              makingChargeValue: merged.makingChargeValue.value,
              otherChargesDescription: merged.otherChargesDescription.value,
              otherChargesAmount: merged.otherChargesAmount.value,
              discountType: saved.discountType || "Fixed",
              discount: merged.discount.value,
            }
          : item
      )
    );
    setOverwrittenFields(lost);
  };

  const addExchange = (type: "Gold" | "Silver") => {
    const newExId = `ex_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    setExchanges((prev) => [
      ...prev,
      {
        id: newExId,
        type,
        itemName: "",
        grossWt: "",
        lessWt: "",
        netWt: "",
        purity: type === "Silver" ? "Silver" : "22K - 91.6%",
        ratePerGm: "",
        amount: "",
      },
    ]);
    setExpandedExchangeIds([newExId]);
    setExchangeAmountAlert(false);
  };

  const handleAddExchange = (type: "Gold" | "Silver") => {
    const incomplete = exchanges.find((ex) => !(Number(ex.amount) > 0));
    if (incomplete) {
      setExpandedExchangeIds([incomplete.id]);
      setExchangeAmountAlert(true);
      toast.error(
        t("invoice.exchange.fillAmountFirst") ||
          "Please enter the Total Amount for the previous exchange item before adding another."
      );
      return;
    }
    addExchange(type);
  };

  const removeExchange = (id: string) => {
    setExchanges((prev) => prev.filter((ex) => ex.id !== id));
  };

  const updateExchange = (id: string, field: keyof ExchangeItem, value: any) => {
    if (["grossWt", "lessWt", "ratePerGm", "amount"].includes(field as string) && !validateNumericInput(String(value))) {
      return;
    }
    setExchanges((prev) =>
      prev.map((ex) => {
        if (ex.id !== id) return ex;
        const updated = { ...ex, [field]: value };
        if (field === "grossWt" || field === "lessWt") {
          const gross = parseFloat(String(field === "grossWt" ? value : ex.grossWt)) || 0;
          const less = parseFloat(String(field === "lessWt" ? value : ex.lessWt)) || 0;
          const entered =
            String(field === "grossWt" ? value : ex.grossWt ?? "").trim() !== "" ||
            String(field === "lessWt" ? value : ex.lessWt ?? "").trim() !== "";
          updated.netWt = entered ? formatNumber(Math.max(0, gross - less)) : "";
        }
        return updated;
      })
    );
  };

  const handleSave = async () => {
    if (impersonateUserId) { setBlockModalVisible(true); return; }
    if (!customerId) return;
    if (items.length === 0) {
      setValidationErrors([t("advanceOrder.alerts.noItemsMessage") || "Please add at least one item before creating the order."]);
      setShowValidationModal(true);
      return;
    }
    if (items.some((i) => !i.name || !i.grossWt || parseFloat(i.grossWt) <= 0)) {
      setShowItemErrors(true);
      // Collect per-item errors
      const errors: string[] = [];
      items.forEach((i, idx) => {
        if (!i.name) errors.push(`Item ${idx + 1}: ${t('advanceOrder.fields.itemName') || 'Item Name'} is required`);
        else if (!i.grossWt || parseFloat(i.grossWt) <= 0) errors.push(`Item ${idx + 1} (${i.name || '…'}): ${t('advanceOrder.fields.grossWt') || 'Gross Weight'} must be greater than 0`);
      });
      setValidationErrors(errors.length ? errors : [t("advanceOrder.alerts.validationMessage") || "Please fill in item names and weights for all items."]);
      setShowValidationModal(true);
      // Expand all invalid items
      const invalidIds = items
        .filter((i) => !i.name || !i.grossWt || parseFloat(i.grossWt) <= 0)
        .map((i) => i.id);
      setExpandedItemIds((prev) => Array.from(new Set([...prev, ...invalidIds])));
      return;
    }
    if (enableExchange && exchanges.some((ex) => !(Number(ex.amount) > 0))) {
      setShowItemErrors(true);
      const errors = exchanges
        .map((ex, idx) => (!(Number(ex.amount) > 0)
          ? `${t(`invoice.dropdown.${ex.type.toLowerCase()}`) || ex.type} exchange ${idx + 1}: ${t('invoice.exchange.amountRequired') || 'Total Amount is required'}`
          : null))
        .filter((e): e is string => !!e);
      setValidationErrors(errors);
      setShowValidationModal(true);
      return;
    }
    if (paymentMethod === "online" && !onlinePaymentType) {
      setValidationErrors([t("invoice.paymentMethod.onlineTypeRequired") || "Please select an online payment type"]);
      setShowValidationModal(true);
      return;
    }
    setShowItemErrors(false);
    setValidationErrors([]);

    if (editOrderId) {
      setSubmitting(true);
      try {
        const resultAction = await dispatch(
          updateAdvanceOrderItems({ orderId: editOrderId, order: { items } }),
        );
        if (updateAdvanceOrderItems.rejected.match(resultAction)) {
          const apiErrors = parseApiErrorList(
            (resultAction.payload as string) || 'Failed to update order. Please try again.',
          );
          setValidationErrors(apiErrors);
          setShowValidationModal(true);
          setSubmitting(false);
          return;
        }
        // Saved — leaving now loses nothing, so skip the discard prompt.
        discardGuard.allowNextNavigation();
        navigation.goBack();
      } catch (e: any) {
        setValidationErrors(parseApiErrorList(e?.message || e));
        setShowValidationModal(true);
        setSubmitting(false);
      }
      return;
    }

    const orderData = {
      customerId,
      type: "advance" as const,
      amount: estimatedTotalAmount,
      date: orderDate.toISOString(),
      status: "pending" as const,
      items: items.map((i) => ({
        itemName: i.name.trim(),
        huid: i.huid,
        pcs: parseInt(i.pcs) || 1,
        itemType: i.itemType,
        purity: i.purity,
        grossWt: parseFloat(i.grossWt) || 0,
        lessWt: parseFloat(i.lessWt) || 0,
        netWt: parseFloat(i.netWt) || 0,
        weight: parseFloat(i.netWt) || 0,
        rate: parseFloat(i.rate) || 0,
        makingChargeType: i.makingChargeType,
        makingChargeValue: parseFloat(i.makingChargeValue) || 0,
        chargeDescription: i.otherChargesDescription || "Charges",
        chargeAmount: parseFloat(i.otherChargesAmount) || 0,
        discountType: i.discountType,
        discount: parseFloat(i.discount) || 0,
      })),
      initialPayment: {
        amount: advanceAmountNum,
        goldRate: effectiveRate,
        notes: "Initial advance payment",
        paymentMethod,
        onlinePaymentType: paymentMethod === "online" ? onlinePaymentType : undefined,
      },
      totalWeight,
      weightPaid: weightCovered,
      remainingWeight,
      estimatedBalance,
      includeGST: includeGst,
      isOrnamentExchanges: enableExchange,
      ornamentExchanges: exchanges,
      includeItemPhotosOnBill,
      gstRate: (shopDetails as any)?.gstPercentage ?? 3,
    };

    setSubmitting(true);
    try {
      const resultAction = await dispatch(addOrder(orderData));
      if (addOrder.rejected.match(resultAction)) {
        const apiErrors = parseApiErrorList((resultAction.payload as string) ||
          t("advanceOrder.alerts.createFailed") ||
          "Failed to create advance order. Please try again.");
        setValidationErrors(apiErrors);
        setShowValidationModal(true);
        setSubmitting(false);
        return;
      }
      const created = (resultAction.payload as any)[0];

      // Attach ornament photos to the saved order so a declaration written later
      // can reuse them. Not awaited into the failure path — the order is saved,
      // and a photo problem must not read as "the order did not save".
      // Sequenced, not fired together: both write the same order document and
      // each spends seconds in ImageKit first, so run concurrently they loaded
      // the same version and the second lost a version conflict - silently,
      // since nothing reads the result. The server no longer lets that destroy
      // anything, but one writer at a time is still the right shape.
      //
      // Not awaited by the caller: the order is saved and the screen moves on.
      const uploadPhotos = async () => {
        if (created?.id && ornamentPhotos.length > 0) {
          await dispatch(
            uploadOrderOrnamentPhotos({ orderId: created.id, photos: ornamentPhotos }),
          );
        }

        const exchangePhotos = exchanges
          .map((ex: any, exchangeIndex: number) => ({
            exchangeIndex,
            photos: (ex.pendingPhotos || []) as any[],
          }))
          .filter((entry: any) => entry.photos.length > 0);
        if (created?.id && exchangePhotos.length > 0) {
          await dispatch(
            uploadAllExchangePhotos({ id: created.id, kind: "order", exchangePhotos }),
          );
        }

      // Photos of the items being made. Same non-blocking rule as above. The
      // index is the item's position in `items`, which is the order posted and
      // therefore the order stored — order items carry no _id, so position is
      // the handle the upload route uses.
      const itemPhotos = items
        .map((it, itemIndex) => ({ itemIndex, photos: it.pendingPhotos || [] }))
        .filter(entry => entry.photos.length > 0);
        if (created?.id && itemPhotos.length > 0) {
          const photoAction = await dispatch(
            uploadAllItemPhotos({ id: created.id, kind: 'order', itemPhotos }),
          );
          const failed = (photoAction as any)?.payload?.failedIndices ?? [];
          if (failed.length > 0) {
            toast.error(
              t('itemPhotos.uploadFailed') ||
                'Some item photos could not be uploaded. Open the order and add them again.',
            );
          }
        }
      };
      uploadPhotos();

      discardGuard.allowNextNavigation();
      navigation.replace("AdvanceOrderSuccess", {
        order: created,
        bookingRate: effectiveRate,
        // Tells the success screen to auto-open the declaration modal once —
        // it already has everything else it needs from `order` and `customers`.
        generateDeclaration: enableExchange && generateDeclaration,
      });
    } catch (e: any) {
      setValidationErrors(parseApiErrorList(e?.message || e));
      setShowValidationModal(true);
      setSubmitting(false);
    }
  };

  const canCreateOrder =
    customerId && items.length > 0 && items.every((i) => i.name && parseFloat(i.grossWt) > 0) && advanceAmountNum >= 0;

  return (
    <Box flex={1} bg="$coolGray50">
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#FFFFFF" }}>
        <Box bg="$white" borderBottomWidth={1} borderBottomColor={BORDER}>
          <HStack 
            px="$4" 
            py="$3.5" 
            alignItems="center" 
            space="md"
            style={LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}}
          >
            <Pressable onPress={() => navigation.goBack()} p="$2" rounded="$lg">
              <ArrowLeft size={22} color="#111827" />
            </Pressable>
            <VStack flex={1}>
              <Text fontWeight="$bold" color="$coolGray900" style={{ fontSize: 20 }}>
                {editOrderId
                  ? (t("advanceOrder.editTitle") || "Edit Order Items")
                  : (t("advanceOrder.createTitle") || "Order Details")}
              </Text>
            </VStack>
            <HelpIconButton topic={HELP_TOPICS.advanceOrder} />
          </HStack>
        </Box>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        flex={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 100,
          ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {})
        }}
        keyboardShouldPersistTaps="handled"
      >
        <VStack space="lg">
          <CustomerInfoCard
            customer={customer}
            readOnly={!!editOrderId}
            onChangeCustomer={() =>
              navigation.navigate('SelectCustomer', {
                next: 'AdvanceOrder',
                preservedState: JSON.stringify({
                  items,
                  orderDate: orderDate.toISOString(),
                  advanceAmount,
                  paymentMethod,
                  onlinePaymentType,
                  enableExchange,
                  exchanges,
                  includeGst,
                  customerGstin,
                  expandedItemIds,
                  expandedExchangeIds,
                }),
              })
            }
          />

          {/* Order Date Section */}
          <Box p="$4" pt="$0" pb="$0" shadowColor="#000" >
            <HStack justifyContent="space-between" alignItems="center">
              <HStack space="xs" alignItems="center">
                <Text fontSize={14} color="$coolGray600">
                  {t("advanceOrder.orderDate") || "Order Date"}
                </Text>
              </HStack>
              <Pressable onPress={() => setIsDatePickerOpen(true)}>
                <Box px="$3" py="$1.5" rounded="$lg" flexDirection="row"
                  alignItems="center" gap={4}>
                  <Icon as={Calendar} size="sm" color="$coolGray500" />
                  <Text fontWeight="$bold" color="$coolGray900" fontSize={13}>
                    {orderDate.toISOString().split('T')[0] === new Date().toISOString().split('T')[0]
                      ? t("common.today") || "Today"
                      : orderDate.toISOString().split('T')[0]}
                  </Text>
                </Box>
              </Pressable>
            </HStack>
          </Box>

          {/* Items Section */}
          <Box bg="$white" p="$4" py="$6" rounded="$xl" shadowColor="#000" shadowOffset={{ width: 0, height: 4 }} shadowOpacity={0.08} shadowRadius={12} elevation={5} borderWidth={1} borderColor="$coolGray100">
            <VStack space="md">
              {(() => {
                const hasIncompleteItem = items.some(
                  (item) => !item.name.trim() || !item.grossWt || parseFloat(item.grossWt) <= 0
                );
                const addItemBg = hasIncompleteItem ? "#baabff" : "#7857ff";
                return (
                  <HStack alignItems="center" justifyContent="space-between" mb="$2" >
                    <Text fontWeight="$bold" color="$coolGray900" style={{ fontSize: 18 }}>
                      {t("advanceOrder.itemsTitle") || "Items"}
                      ({items.length})
                    </Text>
                    <Pressable
                      onPress={addItem}
                      px="$3"
                      py="$2"
                      rounded="$lg"
                      bg={addItemBg}
                    >
                      <HStack space="xs" alignItems="center" >
                        <Icon as={Plus} size="sm" color="white" />
                        <Text color="white" fontWeight="$bold" fontSize={13}>
                          {t("items.addItem") || "Add Item"}
                        </Text>
                      </HStack>
                    </Pressable>
                  </HStack>
                );
              })()}

              {items.length === 0 ? (
                <Box
                  bg="$white"
                  rounded="$xl"
                  p="$6"
                  alignItems="center"
                  justifyContent="center"
                  borderWidth={2}
                  borderColor={BORDER}
                  borderStyle="dashed"
                >
                  <VStack space="xs" alignItems="center">
                    <Text color="$coolGray500" fontSize={14} textAlign="center" fontWeight="$semibold">
                      {t("items.noItemsYetTitle") || "No items added yet"}
                    </Text>
                    <Text color={PURPLE} fontSize={13} textAlign="center">
                      {t("items.noItemsYetSubtitle") || 'Click "Add Item" to add items'}
                    </Text>
                  </VStack>
                </Box>
              ) : (
                items.map((item, index) => {
                  const isExpanded = expandedItemIds.includes(item.id);
                  const itemLiveRate = getRateForPurity(item.rateSourcePurity || item.purity, metalRates);
                  return (
                    <Box key={item.id} bg="$white" rounded="$xl" shadowColor="#000" shadowOffset={{ width: 0, height: 1 }} shadowOpacity={0.05} padding="$1" position="relative" mb="$4" borderWidth={1} borderColor={BORDER}>
                      <Pressable onPress={() => toggleItem(item.id)}>
                        <HStack p="$2" alignItems="center" justifyContent="space-between">
                          <VStack flex={1} pr="$3">
                            <HStack space="sm" alignItems="center" flexWrap="wrap">
                              <Text fontWeight="$bold" fontSize={16} color="$coolGray900" numberOfLines={1}>
                                {item.name?.trim() ? item.name : `${t("invoice.item") || "Item"} ${index + 1}`}
                              </Text>
                              {!isExpanded && (
                                <Box
                                  bg="rgba(109, 94, 247, 0.12)"
                                  px="$2"
                                  py="$0.5"
                                  rounded="$full"
                                >
                                  <Text color={PURPLE} fontSize={11} fontWeight="$bold">
                                    {(item.itemType || "Gold").toUpperCase()}
                                  </Text>
                                </Box>
                              )}
                            </HStack>

                            {!isExpanded && (

                              <VStack mt="$2" space="xs">
                                <Text color="$coolGray500" fontSize={12} numberOfLines={1}>
                                  {`${t('orders.details.piecesShort') || 'Pcs'}:${item.pcs || '1'} | ${t('invoice.fields.grossWt') || 'Gross'}: ${item.grossWt || '0'} | ${t('invoice.fields.netWt') || 'Net'}: ${item.netWt || '0'}`}
                                </Text>
                                {/* Second row so what the item actually costs is
                                    visible without expanding it — on a
                                    multi-item order the totals below are
                                    otherwise impossible to attribute. */}
                                {(() => {
                                  const { goldCost, making } = itemGoldAndMaking(item);
                                  if (goldCost <= 0 && making <= 0) return null;
                                  return (
                                    <Text color="$coolGray500" fontSize={12} numberOfLines={1}>
                                      {`${t('advanceOrder.summary.itemCostShort') || 'Item'}: ₹${Math.round(goldCost).toLocaleString()} | ${t('advanceOrder.summary.makingShort') || 'Making'}: ₹${Math.round(making).toLocaleString()}`}
                                    </Text>
                                  );
                                })()}
                              </VStack>
                            )}
                          </VStack>
                          <HStack space="md" alignItems="center">
                            <Pressable onPress={() => removeItem(item.id)}>
                              <Icon as={Trash2} color="#EF4444" size="md" />
                            </Pressable>
                            <Icon as={isExpanded ? ChevronUp : ChevronDown} color="$coolGray400" size="md" />
                          </HStack>
                        </HStack>
                      </Pressable>

                      {isExpanded && (
                        <VStack space="md" p="$2" py="$4">
                          {catalogProducts.length > 0 && (
                            <Box>
                              <FieldLabel>{t("items.selectSaved") || "Select Saved Item"}</FieldLabel>
                              <StyledSelect
                                value=""
                                onValueChange={(val) => autoFillFromCatalog(item.id, val)}
                                items={Array.isArray(catalogProducts) ? catalogProducts.map((p) => ({ label: p.name, value: p.id })) : []}
                                placeholder={t("advanceOrder.chooseFromCatalog") || "Choose from catalog..."}
                              />
                            </Box>
                          )}

                          <Box>
                            <FieldLabel>{t("advanceOrder.fields.itemName") || "Item Name *"}</FieldLabel>
                            <Input rounded="$xl" borderWidth={1} borderColor={showItemErrors && !item.name.trim() ? '#EF4444' : BORDER} h={45} bg="transparent" $focus={{ borderColor: PURPLE }}>
                              <InputField value={item.name} onChangeText={(v) => updateItem(item.id, "name", capitalizeWords(v))} placeholder={t("advanceOrder.placeholders.itemName") || "e.g. Gold Chain"} maxLength={INPUT_LIMITS.itemName} fontSize={14} />
                            </Input>
                          </Box>

                          <HStack space="md">
                            <Box flex={1}>
                              <FieldLabel>{t("advanceOrder.fields.huid") || "HUID"}</FieldLabel>
                              <Input rounded="$xl" borderWidth={1} borderColor={BORDER} h={44} $focus={{ borderColor: PURPLE }}>
                                <InputField value={item.huid} onChangeText={(v) => updateItem(item.id, "huid", v.toUpperCase())} placeholder={t("advanceOrder.placeholders.huid") || "ABC123"} maxLength={INPUT_LIMITS.hsnCode} fontSize={14} />
                              </Input>
                            </Box>
                            <Box flex={1}>
                              <FieldLabel>{t("advanceOrder.fields.pieces") || "Pieces"}</FieldLabel>
                              <Input rounded="$xl" borderWidth={1} borderColor={BORDER} h={44} pr="$3" $focus={{ borderColor: PURPLE }}>
                                <InputField keyboardType="number-pad" value={item.pcs} onChangeText={(v) => updateItem(item.id, "pcs", v.replace(/[^0-9]/g, ""))} maxLength={INPUT_LIMITS.quantity} fontSize={14} />
                              </Input>
                            </Box>
                          </HStack>

                          <HStack space="md">
                            <Box flex={1}>
                              <FieldLabel>{t("advanceOrder.fields.itemType") || "Item Type"}</FieldLabel>
                              <StyledSelect
                                value={item.itemType}
                                onValueChange={(v) => updateItem(item.id, "itemType", v)}
                                items={metalOptions}
                              />
                            </Box>
                            <Box flex={1}>
                              <FieldLabel>{t("advanceOrder.fields.purity") || "Purity"}</FieldLabel>
                              <SelectField
                                value={item.purity}
                                onValueChange={(v) => updateItem(item.id, "purity", v)}
                                items={item.itemType === "Gold" ? goldPurityItems : silverPurityItems}
                                title={t("advanceOrder.fields.purity") || "Purity"}
                              />
                            </Box>
                          </HStack>

                          <HStack space="md">
                            <Box flex={1}>
                              <FieldLabel>{t("advanceOrder.fields.grossWt") || "Gross Wt *"}</FieldLabel>
                              <Input rounded="$xl" borderWidth={1} borderColor={showItemErrors && (!item.grossWt || parseFloat(item.grossWt) <= 0) ? '#EF4444' : BORDER} h={44} $focus={{ borderColor: PURPLE }}>
                                <InputField keyboardType="decimal-pad" value={item.grossWt} onChangeText={(v) => updateItem(item.id, "grossWt", v)} onBlur={() => checkItemEntry(item)} placeholder={t("advanceOrder.placeholders.grossWt") || "e.g. 2.030"} maxLength={INPUT_LIMITS.weight} fontSize={14} />
                                {/* The unit, always visible — a weight box with no unit is
                                    what let "2.030 gm" be typed as "2030". */}
                                <Box pr="$3" justifyContent="center">
                                  <Text color="$coolGray400" fontSize={12}>{t('common.gramShort') || 'gm'}</Text>
                                </Box>
                              </Input>
                              {!!asKilogramHint(parseFloat(item.grossWt) || 0) && (
                                <Text fontSize={11} color="$amber700" mt="$1" px="$1">
                                  {asKilogramHint(parseFloat(item.grossWt) || 0)}
                                </Text>
                              )}
                            </Box>
                            <Box flex={1}>
                              <FieldLabel>{t("advanceOrder.fields.lessWt") || "Less Wt"}</FieldLabel>
                              <Input rounded="$xl" borderWidth={1} borderColor={BORDER} h={44} $focus={{ borderColor: PURPLE }}>
                                <InputField keyboardType="decimal-pad" value={item.lessWt} onChangeText={(v) => updateItem(item.id, "lessWt", v)} onBlur={() => checkItemEntry(item)} placeholder={nonEmpty(t("advanceOrder.placeholders.lessWt")) || "Enter less weight"} maxLength={INPUT_LIMITS.weight} fontSize={14} />
                              </Input>
                            </Box>
                          </HStack>

                          <HStack space="md">
                            <Box flex={1}>
                              <FieldLabel>{t("advanceOrder.fields.netWt") || "Net Wt"}</FieldLabel>
                              <Box rounded="$xl" borderWidth={1} borderColor={BORDER} h={44} px="$3" bg="$coolGray50" justifyContent="center">
                                {/* Guarded before formatNumber, not just around
                                    the `|| "0"`: formatNumber("") parses to NaN
                                    and returns "0" too, so both layers had to
                                    go for the field to read blank. */}
                                <Text color="$coolGray800" fontSize={14} fontWeight="$medium">
                                  {item.netWt ? formatNumber(item.netWt) : ""}
                                </Text>
                              </Box>
                            </Box>

                          </HStack>
                          <HStack space="md">
                            <Box flex={1}>
                              <FieldLabel>{t("advanceOrder.fields.makingChargeType") || "Making Charge Type"}</FieldLabel>
                              <StyledSelect
                                value={item.makingChargeType}
                                onValueChange={(v) => updateItem(item.id, "makingChargeType", v)}
                                // Same labels and order as the full-payment flow,
                                // read from the same keys so the two cannot
                                // drift. The *values* stay as they are: the
                                // order API's enum is ["Per Gram", "%", "Fix"],
                                // which differs from the invoice API's.
                                items={[
                                  { label: t("invoice.dropdown.perGram") || "Per Gram", value: "Per Gram" },
                                  { label: t("invoice.dropdown.percentage") || "Percentage (%)", value: "%" },
                                  { label: t("invoice.dropdown.fixed") || "Fixed", value: "Fix" }
                                ]}
                              />
                            </Box>
                            <Box flex={1}>
                              <FieldLabel>{t("advanceOrder.fields.charges") || "Charges"}</FieldLabel>
                              <Input rounded="$xl" borderWidth={1} borderColor={BORDER} h={44} $focus={{ borderColor: PURPLE }}>
                                <InputField keyboardType="decimal-pad" value={item.makingChargeValue} onChangeText={(v) => updateItem(item.id, "makingChargeValue", v)} placeholder={nonEmpty(t("advanceOrder.placeholders.charges")) || "Enter charges"} maxLength={INPUT_LIMITS.amount} fontSize={14} />
                              </Input>
                            </Box>
                          </HStack>

                          <HStack space="md">
                            <Box flex={1}>
                              <FieldLabel>{t("advanceOrder.fields.otherChargeDesc") || "Other Charge Desc"}</FieldLabel>
                              <Input rounded="$xl" borderWidth={1} borderColor={BORDER} h={44} $focus={{ borderColor: PURPLE }}>
                                <InputField value={item.otherChargesDescription} onChangeText={(v) => updateItem(item.id, "otherChargesDescription", v)} placeholder={t("advanceOrder.placeholders.otherChargeDesc") || "e.g. Meena"} maxLength={INPUT_LIMITS.itemDescription} fontSize={14} />
                              </Input>
                            </Box>
                            <Box flex={1}>
                              <FieldLabel>{t("advanceOrder.fields.chargeAmount") || "Charge Amount"}</FieldLabel>
                              <Input rounded="$xl" borderWidth={1} borderColor={BORDER} h={44} $focus={{ borderColor: PURPLE }}>
                                <InputField keyboardType="decimal-pad" value={item.otherChargesAmount} onChangeText={(v) => updateItem(item.id, "otherChargesAmount", v)} placeholder={nonEmpty(t("advanceOrder.placeholders.chargeAmount")) || "Enter charge amount"} maxLength={INPUT_LIMITS.amount} fontSize={14} />
                              </Input>
                            </Box>
                          </HStack>

                          <HStack space="md">
                            <Box flex={1}>
                              <FieldLabel>{t("advanceOrder.fields.discountType") || "Discount Type"}</FieldLabel>
                              <StyledSelect
                                value={item.discountType}
                                onValueChange={(v) => updateItem(item.id, "discountType", v)}
                                // Percentage first, matching the full-payment
                                // discount dropdown.
                                items={[
                                  { label: t("invoice.dropdown.percentage") || "Percentage (%)", value: "%" },
                                  { label: t("invoice.dropdown.fixed") || "Fixed", value: "Fixed" }
                                ]}
                              />
                            </Box>
                            <Box flex={1}>
                              <FieldLabel>{t("advanceOrder.fields.discount") || "Discount"}</FieldLabel>
                              <Input rounded="$xl" borderWidth={1} borderColor={BORDER} h={44} $focus={{ borderColor: PURPLE }}>
                                <InputField keyboardType="decimal-pad" value={item.discount} onChangeText={(v) => updateItem(item.id, "discount", v)} placeholder={t("advanceOrder.placeholders.discount")} maxLength={INPUT_LIMITS.amount} fontSize={14} />
                              </Input>
                            </Box>
                          </HStack>

                          {/* Rate Section — per-item rate, mirrors Full payment's Rate Section */}
                          <Box bg="#F5F3FF" rounded="$xl" p="$3" borderWidth={1} borderColor="#DDD6FE">
                            <HStack justifyContent="space-between" alignItems="center" mb="$2">
                              <Text fontSize={13} color={PURPLE} fontWeight="$bold">
                                {t("invoice.fields.rate") || "Rate"}
                              </Text>
                              <Checkbox
                                size="sm"
                                value="custom_rate"
                                isChecked={!!item.useCustomRate}
                                onChange={(checked) => {
                                  updateItem(item.id, "useCustomRate", checked);
                                  if (checked) {
                                    setTimeout(() => rateInputRefs.current.get(item.id)?.focus?.(), 50);
                                  }
                                }}
                              >
                                <CheckboxIndicator mr="$2" borderColor={PURPLE} $checked-backgroundColor={PURPLE} $checked-borderColor={PURPLE}>
                                  <CheckboxIcon as={CheckIcon} />
                                </CheckboxIndicator>
                                <CheckboxLabel fontSize="$xs" color="$coolGray700">
                                  {t("advanceOrder.payment.customRate") || "Custom rate"}
                                </CheckboxLabel>
                              </Checkbox>
                            </HStack>

                            {!item.useCustomRate && (
                              <HStack justifyContent="space-between" alignItems="center" mb="$2">
                                <Text fontSize={12} color="$coolGray600" fontWeight="$medium">
                                  {t("invoice.ratePurity") || "Rate Purity"}
                                </Text>
                                <Box w={160}>
                                  <SelectField
                                    value={item.rateSourcePurity || item.purity}
                                    items={item.itemType === "Silver" ? silverPurityItems : goldPurityItems}
                                    placeholder={t("orders.details.selectPurity") || "Select purity"}
                                    title={t("invoice.ratePurity") || "Rate Purity"}
                                    onValueChange={(v) => {
                                      updateItem(item.id, "rateSourcePurity", v);
                                      updateItem(item.id, "rate", String(getRateForPurity(v, metalRates)));
                                    }}
                                  />
                                </Box>
                              </HStack>
                            )}

                            {item.useCustomRate ? (
                              <VStack>
                                <Input
                                  bg="$white"
                                  borderWidth={1}
                                  borderColor={showItemErrors && !item.rate ? "$red500" : "#DDD6FE"}
                                  rounded="$xl"
                                  h={44}
                                  $focus={{ borderColor: PURPLE }}
                                >
                                  <Box pl="$3" justifyContent="center">
                                    <Text color="$coolGray400">₹</Text>
                                  </Box>
                                  <InputField
                                    ref={(el: any) => { if (el) rateInputRefs.current.set(item.id, el); else rateInputRefs.current.delete(item.id); }}
                                    keyboardType="decimal-pad"
                                    value={item.rate}
                                    onChangeText={(v) => updateItem(item.id, "rate", v)}
                                    maxLength={INPUT_LIMITS.rate}
                                    onBlur={() => checkItemEntry(item)}
                                    placeholder={String(itemLiveRate)}
                                    fontSize={14}
                                  />
                                </Input>
                                {itemLiveRate > 0 && (
                                  <Text fontSize={11} color="$coolGray500" mt="$1" px="$1">
                                    Today's rate: ₹{Number(itemLiveRate).toLocaleString()}/g
                                  </Text>
                                )}
                              </VStack>
                            ) : (
                              <HStack alignItems="baseline" space="xs" px="$1">
                                <Text fontSize={20} fontWeight="$bold" color="$coolGray900">
                                  ₹{Number(itemLiveRate).toLocaleString()}
                                </Text>
                                <Text fontSize={13} color="$coolGray500">
                                  {t("advanceOrder.payment.perGram") || "per gram"}
                                </Text>
                              </HStack>
                            )}
                          </Box>

                          {/* Last in the card, after the rate — photographing
                              the piece must never stand between the shopkeeper
                              and the numbers that decide the order. */}
                          <ItemPhotoPicker
                            pending={item.pendingPhotos || []}
                            onChangePending={(photos) => updateItem(item.id, "pendingPhotos", photos)}
                            saved={item.photos || []}
                            onDeleteSaved={
                              editOrderId
                                ? (fileId) => handleDeleteItemPhoto(index, fileId)
                                : undefined
                            }
                          />
                        </VStack>
                      )}
                    </Box>
                  )
                }))}
            </VStack>
          </Box>

          {/* Only offered once an item actually has photos — a switch
              controlling where nothing appears is noise on every other order. */}
          {items.some(it => (it.pendingPhotos?.length || 0) > 0 || (it.photos?.length || 0) > 0) && (
            <Box bg="$white" rounded="$2xl" borderWidth={1} borderColor="$coolGray100" p="$4" mb="$4" shadowColor="#000" shadowOffset={{ width: 0, height: 1 }} shadowOpacity={0.05} elevation={2}>
              <HStack alignItems="center" justifyContent="space-between">
                <VStack flex={1} pr="$3">
                  <Text fontWeight="$bold" color="$coolGray900">{t('itemPhotos.onBillTitle')}</Text>
                  <Text fontSize="$xs" color="$coolGray400">{t('itemPhotos.onBillSubtitle')}</Text>
                </VStack>
                <Switch
                  value={includeItemPhotosOnBill}
                  onValueChange={setIncludeItemPhotosOnBill}
                  trackColor={{ false: "#E2E8F0", true: PURPLE }}
                />
              </HStack>
            </Box>
          )}

          {/* Old Ornament Exchange + Include GST — not applicable in edit
              mode, same reasoning as the Advance Payment section below. */}
          {editOrderId ? null : items.length === 0 ? null : (
            <>
              <Box bg="$white" rounded="$2xl" borderWidth={1} borderColor="$coolGray100" p="$4" shadowColor="#000" shadowOffset={{ width: 0, height: 1 }} shadowOpacity={0.05} elevation={2}>
                <HStack alignItems="center" justifyContent="space-between">
                  <VStack flex={1} pr="$3">
                    <Text fontWeight="$bold" color="$coolGray900">
                      {t("invoice.exchange.title") || "Old Ornament Exchange"}
                    </Text>
                    <Text fontSize="$xs" color="$coolGray400">
                      {t("invoice.exchange.subtitle") || "Add old ornaments for exchange"}
                    </Text>
                  </VStack>
                  <Switch
                    value={enableExchange}
                    onValueChange={(next: boolean) => { setEnableExchange(next); if (next) setExpandedItemIds([]); }}
                    trackColor={{ false: "#E2E8F0", true: PURPLE }}
                  />
                </HStack>
              </Box>

              <Collapsible expanded={enableExchange}>
                <Box bg="$white" rounded="$2xl" borderWidth={1} borderColor="$coolGray100" p="$4" shadowColor="#000" shadowOffset={{ width: 0, height: 1 }} shadowOpacity={0.05} elevation={2}>
                  <HStack space="md" mb="$3">
                    <Pressable onPress={() => handleAddExchange("Gold")} style={{ flex: 1 }}>
                      <Box borderWidth={1} borderColor="#F59E0B" bg="#FFFBEB" rounded="$lg" h={44} flexDirection="row" alignItems="center" justifyContent="center">
                        <Icon as={Plus} size="xs" color="#F59E0B" mr="$2" />
                        <Text color="#F59E0B" fontWeight="$bold" fontSize={13}>{t("invoice.exchange.addGold") || "Add Gold"}</Text>
                      </Box>
                    </Pressable>
                    <Pressable onPress={() => handleAddExchange("Silver")} style={{ flex: 1 }}>
                      <Box borderWidth={1} borderColor="#6B7280" bg="#F9FAFB" rounded="$lg" h={44} flexDirection="row" alignItems="center" justifyContent="center">
                        <Icon as={Plus} size="xs" color="#6B7280" mr="$2" />
                        <Text color="#6B7280" fontWeight="$bold" fontSize={13}>{t("invoice.exchange.addSilver") || "Add Silver"}</Text>
                      </Box>
                    </Pressable>
                  </HStack>

                  {exchanges.map((ex, exIdx) => {
                    const isExchangeExpanded = expandedExchangeIds.includes(ex.id);
                    return (
                    <Box key={ex.id} bg={BG} rounded="$xl" p="$3" mb="$3" borderWidth={1} borderColor={BORDER}>
                      <Pressable onPress={() => setExpandedExchangeIds((prev) => prev.includes(ex.id) ? [] : [ex.id])}>
                        <HStack justifyContent="space-between" alignItems="center" mb={isExchangeExpanded ? "$2" : 0}>
                          <VStack flex={1}>
                            <HStack alignItems="center" space="sm">
                              <Text fontWeight="$bold" fontSize={13} color="$coolGray700">
                                {(t(`invoice.dropdown.${ex.type.toLowerCase()}`) || ex.type)} {t("invoice.exchange.exchange_short") || "Exchange"} {exIdx + 1}
                              </Text>
                              <Icon as={isExchangeExpanded ? ChevronUp : ChevronDown} size="sm" color="$coolGray400" />
                            </HStack>
                            {!isExchangeExpanded && (
                              <Text color="$coolGray500" fontSize={12} numberOfLines={1}>
                                {ex.itemName?.trim() ? ex.itemName : (t("invoice.exchange.title") || "Old Ornament Exchange")}
                                {ex.amount ? ` · ₹${Number(ex.amount).toLocaleString("en-IN")}` : ""}
                              </Text>
                            )}
                          </VStack>
                          <Pressable onPress={() => removeExchange(ex.id)}>
                            <Icon as={Trash2} color="#EF4444" size="sm" />
                          </Pressable>
                        </HStack>
                      </Pressable>
                      {isExchangeExpanded && (
                      <>
                      <Box mb="$2">
                        <FieldLabel>{t("invoice.exchange.itemName") || "Item Name"}</FieldLabel>
                        <Input rounded="$lg" borderWidth={1} borderColor={BORDER} h={40} bg="$white">
                          <InputField value={ex.itemName} onChangeText={(v) => updateExchange(ex.id, "itemName", v)} placeholder={t("invoice.exchange.itemNamePlaceholder") || "e.g. Old Gold Ring"} maxLength={INPUT_LIMITS.itemName} fontSize={13} />
                        </Input>
                      </Box>
                      <HStack space="md" mb="$2">
                        <Box flex={1}>
                          <FieldLabel>{t("invoice.exchange.grossWt") || "Gross Wt (gm)"}</FieldLabel>
                          <Input rounded="$lg" borderWidth={1} borderColor={BORDER} h={40} bg="$white">
                            <InputField keyboardType="decimal-pad" value={ex.grossWt} onChangeText={(v) => updateExchange(ex.id, "grossWt", v)} maxLength={INPUT_LIMITS.weight} fontSize={13} />
                          </Input>
                        </Box>
                        <Box flex={1}>
                          <FieldLabel>{t("invoice.exchange.lessWt") || "Less Wt (gm)"}</FieldLabel>
                          <Input rounded="$lg" borderWidth={1} borderColor={BORDER} h={40} bg="$white">
                            <InputField keyboardType="decimal-pad" value={ex.lessWt} onChangeText={(v) => updateExchange(ex.id, "lessWt", v)} maxLength={INPUT_LIMITS.weight} fontSize={13} />
                          </Input>
                        </Box>
                      </HStack>
                      <HStack space="md" mb="$2">
                        <Box flex={1}>
                          <FieldLabel>{t("invoice.exchange.netWt") || "Net Wt (gm)"}</FieldLabel>
                          <Input isDisabled rounded="$lg" borderWidth={0} bg="#E5E7EB" h={40}>
                            <InputField value={ex.netWt || ""} editable={false} fontWeight="$bold" color="$coolGray900" fontSize={13} />
                          </Input>
                        </Box>
                        <Box flex={1}>
                          {(() => {
                            const purityItems =
                              ex.type === "Silver" ? silverPurityItems : goldPurityItems;
                            // Derived, not stored, so a row whose saved purity isn't a
                            // preset reopens in custom mode rather than showing blank.
                            const isCustomPurity =
                              ex.useCustomPurity ??
                              (!!ex.purity &&
                                !(purityItems.map((o: any) => o.value) as string[]).includes(
                                  ex.purity,
                                ));
                            return (
                              <>
                                <HStack justifyContent="space-between" alignItems="center">
                                  <FieldLabel>
                                    {t("invoice.exchange.purity") || "Purity"}
                                  </FieldLabel>
                                  <HStack alignItems="center" space="xs" mb="$1">
                                    <Text fontSize={10} color="$coolGray400">
                                      {t("invoice.exchange.customPurity") || "Custom"}
                                    </Text>
                                    <Switch
                                      size="sm"
                                      value={isCustomPurity}
                                      onValueChange={(next: boolean) => {
                                        // Turning custom off clears a free-typed value so
                                        // the dropdown never shows an option it lacks.
                                        const keepsValue =
                                          next ||
                                          (purityItems.map((o: any) => o.value) as string[]).includes(
                                            ex.purity || "",
                                          );
                                        setExchanges((prev) =>
                                          prev.map((row) =>
                                            row.id === ex.id
                                              ? {
                                                  ...row,
                                                  useCustomPurity: next,
                                                  purity: keepsValue ? row.purity : "",
                                                }
                                              : row,
                                          ),
                                        );
                                      }}
                                      trackColor={{ false: "#E2E8F0", true: "#8B5CF6" }}
                                    />
                                  </HStack>
                                </HStack>
                                {isCustomPurity ? (
                                  <Input rounded="$lg" borderWidth={1} borderColor={BORDER} h={40} bg="$white">
                                    <InputField
                                      value={ex.purity || ""}
                                      onChangeText={(v) => updateExchange(ex.id, "purity", v)}
                                      placeholder={
                                        t("invoice.exchange.customPurityPlaceholder") ||
                                        "e.g. 916 hallmark"
                                      }
                                      maxLength={INPUT_LIMITS.purity}
                                      fontSize={13}
                                    />
                                  </Input>
                                ) : (
                                  <SelectField
                                    value={ex.purity || ""}
                                    onValueChange={(v) => updateExchange(ex.id, "purity", v)}
                                    items={purityItems}
                                    title={t("invoice.exchange.purity") || "Purity"}
                                  />
                                )}
                              </>
                            );
                          })()}
                        </Box>
                      </HStack>
                      <HStack space="md" mb="$2">
                        <Box flex={1}>
                          <FieldLabel>{t("invoice.exchange.ratePerGm") || "Rate/gm (₹)"}</FieldLabel>
                          <Input rounded="$lg" borderWidth={1} borderColor={BORDER} h={40} bg="$white">
                            <InputField keyboardType="decimal-pad" value={ex.ratePerGm} onChangeText={(v) => updateExchange(ex.id, "ratePerGm", v)} maxLength={INPUT_LIMITS.rate} fontSize={13} />
                          </Input>
                        </Box>
                        <Box flex={1}>
                          <FieldLabel>{t("invoice.exchange.amount") || "Total Amount (₹)"}</FieldLabel>
                          <Input rounded="$lg" borderWidth={1} borderColor={(showItemErrors || exchangeAmountAlert) && !(Number(ex.amount) > 0) ? "$red500" : BORDER} h={40} bg="$white">
                            <Box pl="$3" justifyContent="center">
                              <Text color="$coolGray400">₹</Text>
                            </Box>
                            <InputField keyboardType="decimal-pad" value={ex.amount} onChangeText={(v) => updateExchange(ex.id, "amount", v)} maxLength={INPUT_LIMITS.amount} fontSize={13} />
                          </Input>
                        </Box>
                      </HStack>
                      </>
                      )}

                      {/* This ornament's own photos, matching the invoice form.
                          The exchange used to have one set for the whole order,
                          which could not say which photo was of which piece. */}
                      <Box mt="$3">
                        <ItemPhotoPicker
                          pending={(ex as any).pendingPhotos || []}
                          onChangePending={(photos) =>
                            updateExchange(ex.id, "pendingPhotos", photos as any)
                          }
                          saved={(ex as any).photos || []}
                          addLabel={t("declaration.photos.addPhotos") || "Add Photos"}
                          onDeleteSaved={
                            editOrderId
                              ? (fileId) => handleDeleteExchangePhoto(exIdx, fileId)
                              : undefined
                          }
                        />
                      </Box>
                    </Box>
                    );
                  })}

                  {/* The order-wide photo set is gone from this form, as it is
                      from the invoice one: photos now hang off the gold or
                      silver row they are of, above. Orders saved before that
                      keep theirs and still display them on the order screen. */}

                  {/* Optional, off by default. Ticking this does not collect
                      any new information here — it just asks, right after the
                      order saves, whether to generate the declaration this
                      exchange already has everything else for. */}
                  <Box
                    mt="$4"
                    pt="$4"
                    borderTopWidth={1}
                    borderColor="$coolGray100"
                  >
                    <HStack justifyContent="space-between" alignItems="center">
                      <VStack flex={1} pr="$3">
                        <Text fontWeight="$bold" fontSize="$sm" color="$coolGray900">
                          {t('declaration.generateButton') || 'Generate Declaration'}
                        </Text>
                        <Text fontSize="$xs" color="$coolGray400">
                          {t('invoice.exchange.generateDeclarationSubtitle') ||
                            'Affidavit for this exchange'}
                        </Text>
                      </VStack>
                      <Switch
                        value={generateDeclaration}
                        onValueChange={setGenerateDeclaration}
                        trackColor={{ false: '#E2E8F0', true: '#8B5CF6' }}
                      />
                    </HStack>
                  </Box>
                </Box>
              </Collapsible>

              <Box bg="$white" rounded="$2xl" borderWidth={1} borderColor="$coolGray100" p="$4" shadowColor="#000" shadowOffset={{ width: 0, height: 1 }} shadowOpacity={0.05} elevation={2}>
                <HStack alignItems="center" justifyContent="space-between">
                  <VStack flex={1} pr="$3">
                    <Text fontWeight="$bold" color="$coolGray900">
                      {t("invoice.includeGst") || "Include GST in the bill"}
                    </Text>
                    {includeGst && (
                      <Box bg="#EEF2FF" px="$2" py="$1" rounded="$full" alignSelf="flex-start" mt="$1">
                        <Text color="#4F46E5" fontSize={10} fontWeight="$black">
                          {(shopDetails as any)?.gstPercentage || 3}% {t("invoice.gstApplied") || "GST APPLIED"}
                        </Text>
                      </Box>
                    )}
                  </VStack>
                  <Switch
                    value={includeGst}
                    onValueChange={(next: boolean) => { setIncludeGst(next); if (next) setExpandedItemIds([]); }}
                    trackColor={{ false: "#E2E8F0", true: PURPLE }}
                  />
                </HStack>
              </Box>

              {includeGst && (
                <Box bg="$white" rounded="$2xl" borderWidth={1} borderColor="$coolGray100" p="$4" shadowColor="#000" shadowOffset={{ width: 0, height: 1 }} shadowOpacity={0.05} elevation={2}>
                  <FieldLabel>{t("invoice.customerGstin") || "Retailer GSTIN (for B2B)"}</FieldLabel>
                  <Input rounded="$xl" borderWidth={1} borderColor={BORDER} h={44} bg={BG}>
                    <InputField
                      value={customerGstin}
                      onChangeText={(v) => setCustomerGstin(v.toUpperCase().replace(/\s/g, ""))}
                      placeholder={t("invoice.customerGstinPlaceholder") || "e.g., 27AAAAA0000A1Z5 (optional)"}
                      autoCapitalize="characters"
                      maxLength={INPUT_LIMITS.gstin}
                      fontSize={14}
                    />
                  </Input>
                </Box>
              )}
            </>
          )}

          {/* Advance Payment Section — not applicable in edit mode: the
              backend's item-edit endpoint doesn't touch payments/booking
              rate, those are managed separately via Add Payment on the
              order detail screen. */}
          {editOrderId ? null : items.length === 0 ? ('') :
            (<Box bg="$white" p="$4" py="$6" rounded="$2xl" shadowColor="#000" shadowOffset={{ width: 0, height: 4 }} shadowOpacity={0.08} shadowRadius={12} elevation={5} borderWidth={1} borderColor="$coolGray100">
              <Text fontWeight="$black" color="#6D5EF7" style={{ fontSize: 18, marginBottom: 12 }}>
                {t("advanceOrder.payment.title") || "Advance Payment"}
              </Text>

              <Box bg="rgba(109, 94, 247, 0.05)" rounded="$xl" p="$3" mb="$4" mt="$2" borderWidth={1} borderColor="rgba(109, 94, 247, 0.1)">
                <Text fontSize={12} color="$coolGray500" fontWeight="$bold" textTransform="uppercase">
                  {t("advanceOrder.payment.effectiveRate") || "Effective Rate (weighted avg.)"}
                </Text>
                <HStack alignItems="baseline" space="xs" mt="$1">
                  <Text fontSize={22} fontWeight="$bold" color="$coolGray900">₹{Number(effectiveRate).toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                  <Text fontSize={13} color="$coolGray500">
                    {t("advanceOrder.payment.perGram") || "per gram"}
                  </Text>
                </HStack>
              </Box>

              <Box>
                <FieldLabel>{t("advanceOrder.payment.advanceAmountPaid") || "Advance Amount (₹) *"}</FieldLabel>
                <Input rounded="$xl" borderWidth={1} borderColor={BORDER} h={52} px="$3" bg="#f6f7f9" $focus={{ borderColor: PURPLE }}>
                  <InputField
                    keyboardType="decimal-pad"
                    value={advanceAmount}
                    onFocus={() => setExpandedItemIds([])}
                    onChangeText={(v) => { if (validateNumericInput(v)) setAdvanceAmount(v); }}
                    maxLength={INPUT_LIMITS.amount}
                    placeholder={t("advanceOrder.placeholders.advanceAmount") || "20000"}
                    fontSize={18}
                    fontWeight="$bold"
                  />
                </Input>

                {hasCoverage && (
                  <Box bg="rgba(109, 94, 247, 0.05)" p="$5" rounded="$2xl" mt="$4" borderWidth={1} borderColor="rgba(109, 94, 247, 0.1)">
                    <VStack space="xs">
                      <Text fontSize={12} color="$coolGray500" fontWeight="$bold" textTransform="uppercase">
                        {t("advanceOrder.summary.weightCoveredPurity") || "Weight Covered"}
                      </Text>
                      <HStack alignItems="baseline" space="xs">
                        <Text fontSize={28} fontWeight="$black" color={PURPLE}>
                          {weightCovered.toFixed(3)}
                        </Text>
                        <Text display="flex" alignItems="center" justifyContent="center">
                          <Text fontSize={14} fontWeight="$bold" color={PURPLE} pr="$2">{t("common.gramShort") + ' ' || "gm"}</Text>
                        </Text>
                      </HStack>

                      {/* Where those grams came from. Both sources settle weight
                          at the same effective rate, so the total alone cannot
                          say how much of it the customer actually paid in cash. */}
                      {showCoverageSplit && (
                        <VStack space="xs" mt="$2" pt="$3" borderTopWidth={1} borderColor="rgba(109, 94, 247, 0.15)">
                          <HStack justifyContent="space-between" alignItems="center">
                            <Text fontSize={12} color="$coolGray600">
                              {t("advanceOrder.summary.coveredByExchange") || "From old ornaments"}
                            </Text>
                            <Text fontSize={13} fontWeight="$bold" color="$coolGray800">
                              {exchangeWeightCovered.toFixed(3)} gm
                              <Text fontSize={12} color="$coolGray500">
                                {`  ₹${Math.round(exchangeTotal).toLocaleString()}`}
                              </Text>
                            </Text>
                          </HStack>

                          {advanceAmountNum > 0 && (
                            <HStack justifyContent="space-between" alignItems="center">
                              <Text fontSize={12} color="$coolGray600">
                                {t("advanceOrder.summary.coveredByAdvance") || "From advance paid"}
                              </Text>
                              <Text fontSize={13} fontWeight="$bold" color="$coolGray800">
                                {cashWeightCovered.toFixed(3)} gm
                                <Text fontSize={12} color="$coolGray500">
                                  {`  ₹${Math.round(advanceAmountNum).toLocaleString()}`}
                                </Text>
                              </Text>
                            </HStack>
                          )}
                        </VStack>
                      )}
                    </VStack>
                  </Box>
                )}

                <Box mt="$4">
                  <Text fontWeight="$bold" color="$coolGray900" mb="$3">
                    {t("invoice.paymentMethod.title") || "Payment Mode"}
                  </Text>
                  <HStack space="md">
                    {(["cash", "online"] as const).map((mode) => (
                      <Pressable
                        key={mode}
                        flex={1}
                        onPress={() => {
                          setPaymentMethod(mode);
                          if (mode === "cash") setOnlinePaymentType(undefined);
                        }}
                      >
                        <Box
                          rounded="$xl"
                          borderWidth={1}
                          borderColor={paymentMethod === mode ? "#6366F1" : "$coolGray200"}
                          bg={paymentMethod === mode ? "#EEF2FF" : "$white"}
                          py="$3"
                          alignItems="center"
                        >
                          <Text fontWeight="$bold" color={paymentMethod === mode ? "#4F46E5" : "$coolGray600"}>
                            {t(`invoice.paymentMethod.${mode}`) || (mode === "cash" ? "Cash" : "Online")}
                          </Text>
                        </Box>
                      </Pressable>
                    ))}
                  </HStack>

                  {paymentMethod === "online" && (
                    <Box mt="$3">
                      <SelectField
                        value={onlinePaymentType || ""}
                        items={(["upi", "bank_transfer", "cheque", "card", "other"] as const).map((v) => ({
                          label: t(`invoice.paymentMethod.${v}`) || v,
                          value: v,
                        }))}
                        placeholder={t("invoice.paymentMethod.selectType") || "Select payment type"}
                        title={t("invoice.paymentMethod.title") || "Payment Mode"}
                        onValueChange={(v) => setOnlinePaymentType(v)}
                      />
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>)}

          {/* Summary Section - Premium Table Look */}
          {totalWeight > 0 && hasCoverage && (
            <Box bg="$white" p="$6" rounded="$3xl" shadowColor="#000" shadowOffset={{ width: 0, height: 4 }} shadowOpacity={0.08} shadowRadius={12} elevation={5} borderWidth={1} borderColor="$coolGray100">
              <Text fontWeight="$black" color="#6D5EF7" style={{ fontSize: 18, marginBottom: 16 }}>
                {t("advanceOrder.summary.title") || "Order Summary"}
              </Text>

              <VStack space="md">
                <HStack justifyContent="space-between" alignItems="center">
                  <Text fontSize={14} color="$coolGray500" fontWeight="$bold" textTransform="uppercase">
                    {t("advanceOrder.summary.totalWeightCount") || `Total Weight`}
                  </Text>
                  <Text fontSize={16} fontWeight="$black" color="$coolGray900">{totalWeight.toFixed(3)} gm</Text>
                </HStack>


                <HStack justifyContent="space-between" alignItems="center">
                  <Text fontSize={14} color="$coolGray500" fontWeight="$bold" textTransform="uppercase">
                    {t("advanceOrder.summary.weightCoveredPurity") || `Weight Covered`}
                  </Text>
                  <Text fontSize={16} fontWeight="$black" color="#16A34A">{weightCovered.toFixed(3)} gm</Text>
                </HStack>

                {/* Indented under the total they add up to, rather than as peers
                    of it — the summary is read top to bottom and these two are
                    a breakdown, not two more independent figures. */}
                {showCoverageSplit && (
                  <VStack space="xs" pl="$3">
                    <HStack justifyContent="space-between" alignItems="center">
                      <Text fontSize={12} color="$coolGray500">
                        {t("advanceOrder.summary.coveredByExchange") || "From old ornaments"}
                      </Text>
                      <Text fontSize={13} color="$coolGray700" fontWeight="$bold">
                        {exchangeWeightCovered.toFixed(3)} gm
                        <Text fontSize={12} color="$coolGray500">
                          {`  ₹${Math.round(exchangeTotal).toLocaleString()}`}
                        </Text>
                      </Text>
                    </HStack>

                    {advanceAmountNum > 0 && (
                      <HStack justifyContent="space-between" alignItems="center">
                        <Text fontSize={12} color="$coolGray500">
                          {t("advanceOrder.summary.coveredByAdvance") || "From advance paid"}
                        </Text>
                        <Text fontSize={13} color="$coolGray700" fontWeight="$bold">
                          {cashWeightCovered.toFixed(3)} gm
                          <Text fontSize={12} color="$coolGray500">
                            {`  ₹${Math.round(advanceAmountNum).toLocaleString()}`}
                          </Text>
                        </Text>
                      </HStack>
                    )}
                  </VStack>
                )}

                <HStack justifyContent="space-between" alignItems="center">
                  <Text fontSize={14} color="$coolGray500" fontWeight="$bold" textTransform="uppercase">{t("orders.details.remainingWeight") || "Remaining Weight"}</Text>
                  <Text fontSize={16} fontWeight="$black" color="#EF4444">{remainingWeight.toFixed(3)} gm</Text>
                </HStack>


                <Divider my="$2" bg="$coolGray100" />

                {/* What the order is worth in full at the rate it is being
                    booked at, before anything already covered is taken off.
                    Shops reconcile the balance by hand as (total - advance),
                    so the total they are subtracting from has to be on screen
                    and has to name its rate. */}
                <HStack justifyContent="space-between" alignItems="center">
                  <Text flex={1} fontSize={14} color="$coolGray500" fontWeight="$bold" textTransform="uppercase">
                    {t("advanceOrder.summary.totalOrderCost") || "Total Order Cost"}
                    <Text fontSize={12} color="$coolGray400" fontWeight="$bold">
                      {`  @ ₹${Math.round(effectiveRate).toLocaleString()}/gm`}
                    </Text>
                  </Text>
                  <Text fontSize={16} fontWeight="$black" color="$coolGray900">
                    ₹{Math.round(itemsSubtotal).toLocaleString()}
                  </Text>
                </HStack>

                {/* Indented under the total they add up to, the same way the
                    coverage split sits under Weight Covered. A shop reconciling
                    a bill by hand needs to see metal and labour separately —
                    one lump sum is the number they end up questioning. */}
                <VStack space="xs" pl="$3">
                  <HStack justifyContent="space-between" alignItems="center">
                    <Text fontSize={12} color="$coolGray500">
                      {t("advanceOrder.summary.itemCost") || "Item cost"}
                      {totalWeight > 0 ? ` (${totalWeight.toFixed(3)} gm)` : ""}
                    </Text>
                    <Text fontSize={13} color="$coolGray700" fontWeight="$bold">
                      ₹{Math.round(itemsGoldValue).toLocaleString()}
                    </Text>
                  </HStack>
                  {itemsMakingTotal > 0 && (
                    <HStack justifyContent="space-between" alignItems="center">
                      <Text fontSize={12} color="$coolGray500">
                        {t("orders.details.makingCharges") || "Making Charges"}
                      </Text>
                      <Text fontSize={13} color="$coolGray700" fontWeight="$bold">
                        ₹{Math.round(itemsMakingTotal).toLocaleString()}
                      </Text>
                    </HStack>
                  )}
                  {itemsOtherCharges > 0 && (
                    <HStack justifyContent="space-between" alignItems="center">
                      <Text fontSize={12} color="$coolGray500" flex={1} mr="$2">
                        {formatOtherChargesLabel(
                          t("orders.details.otherCharges") || "Other Charges",
                          items,
                        )}
                      </Text>
                      <Text fontSize={13} color="$coolGray700" fontWeight="$bold">
                        ₹{Math.round(itemsOtherCharges).toLocaleString()}
                      </Text>
                    </HStack>
                  )}
                  {itemsDiscountTotal > 0 && (
                    <HStack justifyContent="space-between" alignItems="center">
                      <Text fontSize={12} color="$coolGray500">
                        {t("orders.details.totalDiscount") || "Total Discount"}
                      </Text>
                      <Text fontSize={13} color="#EF4444" fontWeight="$bold">
                        - ₹{Math.round(itemsDiscountTotal).toLocaleString()}
                      </Text>
                    </HStack>
                  )}
                </VStack>

                {includeGst && (
                  <HStack justifyContent="space-between" alignItems="center">
                    <Text fontSize={14} color="$coolGray500" fontWeight="$bold" textTransform="uppercase">
                      {t("advanceOrder.summary.gstAmount") || "GST Amount (At Current Rate)"}
                    </Text>
                    <Text fontSize={16} fontWeight="$black" color="$coolGray900">
                      ₹{Math.round(gstAmount).toLocaleString()}
                    </Text>
                  </HStack>
                )}

                <HStack justifyContent="space-between" alignItems="center">
                  <VStack display="flex" flexDirection="row" alignItems="center" space="md">
                    <Text flex={1} fontSize={12} color="$coolGray400" fontWeight="$bold" textTransform="uppercase" maxWidth={700}>{t("orders.details.estimatedTotalBalance") || "Est. Balance"}</Text>
                    <Text fontSize={22} fontWeight="$black" color="#6D5EF7">
                      ₹{Math.max(0, Math.round(subtotalBeforeGst + gstAmount - advanceAmountNum)).toLocaleString()}
                    </Text>
                  </VStack>
                </HStack>

                {includeGst && (
                  <Text fontSize={11} color="$coolGray500" fontStyle="italic">
                    {t("advanceOrder.summary.balanceIncludesGstNote") || "* Includes estimated GST at current rate; recalculated at final settlement."}
                  </Text>
                )}

                <Box mt="$2" bg="$coolGray50" p="$3" rounded="$xl" borderWidth={1} borderColor="$coolGray100">
                  <Text fontSize={11} color="$coolGray500" fontStyle="italic" textAlign="center">
                    {t("advanceOrder.summary.finalSettlementNote") || "* Final settlement depends on actual weight and rates at delivery."}
                  </Text>
                </Box>
              </VStack>
            </Box>
          )}

          <Box mt="$2" mb="$6">
            <GradientButton
              onPress={handleSave}
              disabled={!canCreateOrder || submitting}
              label={
                editOrderId
                  ? (submitting ? (t("advanceOrder.buttons.saving") || "Saving...") : (t("advanceOrder.buttons.saveChanges") || "Save Changes"))
                  : (submitting ? (t("advanceOrder.buttons.creating") || "Creating Order...") : (t("advanceOrder.buttons.create") || "Create Advance Order"))
              }
            />
          </Box>

          <DatePickerModal
            isOpen={isDatePickerOpen}
            onClose={() => setIsDatePickerOpen(false)}
            date={orderDate.toISOString().split('T')[0]}
            onSelect={(d) => setOrderDate(new Date(d))}
          />
        </VStack>
      </ScrollView>
      </KeyboardAvoidingView>

      <DiscardChangesModal
        visible={discardGuard.promptVisible}
        onCancel={discardGuard.cancelDiscard}
        onDiscard={discardGuard.confirmDiscard}
        title={
          editOrderId
            ? t("common.discard.editTitle")
            : t("common.discard.orderTitle")
        }
      />
      <ValidationErrorModal
        isOpen={showValidationModal}
        errors={validationErrors}
        onClose={() => setShowValidationModal(false)}
      />
      <CatalogOverwriteModal
        isOpen={overwrittenFields.length > 0}
        fields={overwrittenFields}
        onClose={() => setOverwrittenFields([])}
      />
      {(() => {
        if (!itemFinding) return null;
        const copy = describeItemFinding(itemFinding.finding, t);
        const focusRate = () => {
          const id = itemFinding.itemId;
          setItemFinding(null);
          setTimeout(() => rateInputRefs.current.get(id)?.focus?.(), 50);
        };
        return (
          <ConfirmModal
            visible
            onClose={() => setItemFinding(null)}
            tone="warning"
            icon="alert"
            title={copy.title}
            description={copy.description}
            cancelLabel={copy.cancelLabel}
            confirmLabel={copy.confirmLabel}
            onConfirm={() => (copy.canApply ? applyItemFinding() : focusRate())}
            tertiaryLabel={t("invoice.editRateManually") || "Edit"}
            onTertiary={focusRate}
          />
        );
      })()}
      <ImpersonationBlockModal
        isOpen={blockModalVisible}
        phone={impersonatePhone || ''}
        onEndSession={handleEndSession}
        onClose={() => setBlockModalVisible(false)}
      />
    </Box>
  );
};

export default AdvanceOrderScreen;
