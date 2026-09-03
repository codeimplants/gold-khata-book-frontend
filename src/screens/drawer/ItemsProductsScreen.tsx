import React, { useMemo, useState, useEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import {
  Box,
  Center,
  HStack,
  Icon,
  Input,
  InputField,
  Pressable,
  ScrollView,
  Text,
  VStack,
  Select,
  SelectTrigger,
  SelectInput,
  SelectPortal,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectItem,
  SelectIcon,
} from "@gluestack-ui/themed";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView as RNScrollView,
  View,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Plus,
  Search,
  Package,
  Pencil,
  Trash2,
  X,
  ArrowLeft,
  ChevronDown,
} from "lucide-react-native";
import { useTranslation } from "../../hooks/useTranslation";
import { capitalizeWords } from "../../utils/textUtils";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  fetchCatalogProducts,
  addCatalogProduct,
  deleteCatalogProduct,
  updateCatalogProduct,
  clearUserData,
} from "../../store/data/dataSlice";
import { endImpersonation } from "../../store/auth/authSlice";
import { toast } from "../../components/common/Toast";
import ImpersonationBlockModal from "../../components/ImpersonationBlockModal";
import SelectField from "../../components/common/SelectField";
import { LAYOUT } from "../../constants/layout";
import { GOLD_PURITY_OPTIONS, SILVER_PURITY_OPTIONS } from "../../constants/bill";
import { INPUT_LIMITS, validateText } from "../../constants/inputLimits";
import CharCounter from "../../components/common/CharCounter";

const PURPLE = "#6D5EF7";
const PINK = "#D946EF";
const BORDER = "#E5E7EB";
const BG = "#F9FAFB";
const ICON_TINT = "#F1E9FF";

type ItemCategory = "Gold" | "Silver" | "Others";
type MakingChargeType = "Per Gram" | "%" | "Fix";
type DiscountType = "Fixed" | "%";

interface DraftItem {
  name: string;
  category: ItemCategory;
  purity: string;
  makingChargeType: MakingChargeType;
  makingCharges: string;
  discountType: DiscountType;
  discount: string;
  grossWt: string;
  lessWt: string;
  pcs: string;
  stockQty: string;
  huid: string;
  otherChargeDesc: string;
  otherChargeAmount: string;
}

const DEFAULT_DRAFT: DraftItem = {
  name: "",
  category: "Gold",
  purity: "22K - 91.6%",
  makingChargeType: "Per Gram",
  makingCharges: "",
  discountType: "Fixed",
  discount: "",
  grossWt: "",
  lessWt: "",
  pcs: "",
  stockQty: "",
  huid: "",
  otherChargeDesc: "",
  otherChargeAmount: "",
};

/* ─── Gradient Pill Button (header Add Item) ─── */
const GradientButtonPill = ({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) => {
  const gid = useMemo(() => `pill_${Math.random().toString(16).slice(2)}`, []);
  return (
    <Pressable onPress={onPress}>
      <Box style={{ width: 124, height: 44, borderRadius: 14, overflow: "hidden" }}>
        <Svg width="100%" height="100%" style={{ position: "absolute" }}>
          <Defs>
            <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={PURPLE} stopOpacity="1" />
              <Stop offset="1" stopColor={PINK} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" rx="14" ry="14" fill={`url(#${gid})`} />
        </Svg>
        <HStack flex={1} alignItems="center" justifyContent="center" space="sm">
          <Icon as={Plus} size="lg" color="$white" />
          <Text color="$white" fontWeight="$bold" style={{ fontSize: 16 }}>
            {label}
          </Text>
        </HStack>
      </Box>
    </Pressable>
  );
};

/* ─── Gradient Full-Width Button (modal Save/Add) ─── */
const GradientFullButton = ({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) => {
  const gid = useMemo(() => `full_${Math.random().toString(16).slice(2)}`, []);
  return (
    <Pressable onPress={onPress}>
      <Box style={{ height: 52, borderRadius: 14, overflow: "hidden" }}>
        <Svg width="100%" height="100%" style={{ position: "absolute" }}>
          <Defs>
            <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={PURPLE} stopOpacity="1" />
              <Stop offset="1" stopColor={PINK} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" rx="14" ry="14" fill={`url(#${gid})`} />
        </Svg>
        <Center flex={1}>
          <Text color="$white" fontWeight="$bold" style={{ fontSize: 16 }}>
            {label}
          </Text>
        </Center>
      </Box>
    </Pressable>
  );
};

/* ─── Stock badge (products with no numeric stockQty are "Not tracked") ─── */
const getStockBadge = (qty?: number): { label: string; bg: string; color: string } => {
  if (typeof qty !== "number") return { label: "Not tracked", bg: "#F3F4F6", color: "#6B7280" };
  if (qty <= 0) return { label: "Out of stock", bg: "#FEE2E2", color: "#DC2626" };
  if (qty <= 3) return { label: `Low: ${qty}`, bg: "#FEF3C7", color: "#B45309" };
  return { label: `In stock: ${qty}`, bg: "#D1FAE5", color: "#047857" };
};

/* ─── Labeled field wrapper ─── */
const FieldLabel = ({ children }: { children: string }) => (
  <Text
    style={{ fontSize: 13, marginBottom: 6, color: "#374151", fontWeight: "600" }}
  >
    {children}
  </Text>
);

/* ─── Styled text input ─── */
const StyledInput = ({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoFocus,
  maxLength,
  showCounter,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  autoFocus?: boolean;
  maxLength?: number;
  /** Only worth showing on the free-text fields; numbers hit their cap rarely. */
  showCounter?: boolean;
}) => (
  <>
    <Box
      rounded="$2xl"
      borderWidth={1}
      borderColor={BORDER}
      bg="$white"
      style={{ height: 50, paddingHorizontal: 14 }}
    >
      <Input bg="transparent" borderWidth={0} flex={1} p={0}>
        <InputField
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboardType}
          autoFocus={autoFocus}
          maxLength={maxLength}
          style={{ fontSize: 15 }}
          placeholderTextColor="#9CA3AF"
        />
      </Input>
    </Box>
    {showCounter && maxLength ? <CharCounter value={value} limit={maxLength} /> : null}
  </>
);

/* ─── Styled Select ─── */
const StyledSelect = ({
  value,
  onValueChange,
  items,
  placeholder,
}: {
  value: string;
  onValueChange: (v: any) => void;
  items: { label: string; value: string }[];
  placeholder?: string;
}) => {
  // SelectInput renders `label || value`, and label is seeded from
  // selectedLabel on mount only — without this the closed trigger showed the
  // raw value ("%", or an English metal name on a translated device) until the
  // user reopened the list. key re-seeds it on external value changes.
  const selectedLabel = items.find((i) => i.value === value)?.label;

  return (
  <Box h={50} w="$full" rounded="$2xl" borderWidth={1} borderColor={BORDER} bg="$white">
    <Select key={value} selectedValue={value} selectedLabel={selectedLabel} onValueChange={onValueChange}>
      <SelectTrigger variant="outline" style={{ height: 44, borderWidth: 0, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <SelectInput style={{ flex: 1, fontSize: 15, color: "#111827" }} placeholder={placeholder} pointerEvents="none" />
        <SelectIcon pointerEvents="none">
          <Icon as={ChevronDown} size="sm" color="#6B7280" />
        </SelectIcon>
      </SelectTrigger>
      <SelectPortal>
        <SelectBackdrop />
        <SelectContent pb="$10" zIndex={9999} style={{ width: '100%' }}>
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

/* ═══════════════════════════════════════════════════════ */
/*                   MAIN SCREEN                          */
/* ═══════════════════════════════════════════════════════ */
const ItemsProductsScreen = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { catalogProducts: items } = useAppSelector((s) => s.data);
  const { impersonateUserId, impersonatePhone } = useAppSelector(s => s.auth);
  const [blockModalVisible, setBlockModalVisible] = useState(false);

  const handleEndSession = () => {
    dispatch(endImpersonation());
    dispatch(clearUserData());
    (navigation as any).navigate('AdminDashboard');
  };

  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Sub-page state
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftItem>(DEFAULT_DRAFT);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchCatalogProducts());
  }, []);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchCatalogProducts({ force: true }));
    setRefreshing(false);
  }, [dispatch]);

  const countLabel = `${items.length} ${t("items.count")}`;
  const selectPlaceholder = t("items.form.selectPlaceholder");

  const categoryOptions = useMemo(
    () => [
      { label: t("metals.gold"), value: "Gold" },
      { label: t("metals.silver"), value: "Silver" },
      { label: t("metals.others"), value: "Others" },
    ],
    [t]
  );

  const getCategoryLabel = (category?: string) => {
    if (category === "Gold") return t("metals.gold");
    if (category === "Silver") return t("metals.silver");
    if (category === "Others") return t("metals.others");
    return category || "—";
  };

  const getPurityLabel = (purity?: string) => {
    switch (purity) {
      case "24K - 99.5%":
        return t("metals.purity.gold24k995gw");
      case "23K - 95.8%":
        return t("metals.purity.gold23k") || "23K - 95.8%";
      case "22K - 91.6%":
        return t("metals.purity.gold22k");
      case "21K - 87.5%":
        return t("metals.purity.gold21k") || "21K - 87.5%";
      case "20K - 83.3%":
        return t("metals.purity.gold20k") || "20K - 83.3%";
      case "18K - 75%":
        return t("metals.purity.gold18k");
      case "17K - 70.8%":
        return t("metals.purity.gold17k") || "17K - 70.8%";
      case "14K - 58.5%":
        return t("metals.purity.gold14k");
      case "9K - 37.5%":
        return t("metals.purity.gold9k") || "9K - 37.5%";
      case "Silver":
        return t("metals.purity.silver");
      case "Silver Coin":
        return t("metals.purity.silverCoin");
      default:
        return purity || "";
    }
  };

  const purityOptionsGold = useMemo(
    () => GOLD_PURITY_OPTIONS.map((p) => ({ label: getPurityLabel(p), value: p })),
    [t]
  );
  const purityOptionsSilver = useMemo(
    () => SILVER_PURITY_OPTIONS.map((p) => ({ label: getPurityLabel(p), value: p })),
    [t]
  );
  const makingChargeOptions = useMemo(
    () => [
      { label: t("invoice.dropdown.perGram"), value: "Per Gram" },
      { label: t("invoice.dropdown.percentage"), value: "%" },
      { label: t("invoice.dropdown.fixed"), value: "Fix" },
    ],
    [t]
  );
  const discountOptions = useMemo(
    () => [
      { label: t("invoice.dropdown.fixed"), value: "Fixed" },
      { label: t("invoice.dropdown.percentage"), value: "%" },
    ],
    [t]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.name.toLowerCase().includes(q));
  }, [items, query]);

  /* ── Helpers ── */
  const updateDraft = <K extends keyof DraftItem>(key: K, val: DraftItem[K]) =>
    setDraft((prev) => ({ ...prev, [key]: val }));

  const openAdd = () => {
    setDraft(DEFAULT_DRAFT);
    setEditId(null);
    setOpen(true);
  };

  const openEdit = (it: any) => {
    setDraft({
      name: it.name || "",
      category: (it.category as ItemCategory) || "Gold",
      purity: it.purity || "22K - 91.6%",
      makingChargeType: (it.makingChargeType as MakingChargeType) || "Per Gram",
      makingCharges: String(it.makingCharges ?? 0),
      discountType: (it.discountType as DiscountType) || "Fixed",
      discount: String(it.discount ?? 0),
      grossWt: String(it.grossWt ?? ""),
      lessWt: String(it.lessWt ?? 0),
      pcs: String(it.pcs ?? 1),
      stockQty: it.stockQty != null ? String(it.stockQty) : "",
      huid: it.huid || "",
      otherChargeDesc: it.otherChargeDesc || "",
      otherChargeAmount: String(it.otherChargeAmount ?? 0),
    });
    setEditId(it.id);
    setOpen(true);
  };

  const closeForm = () => setOpen(false);

  const submit = async () => {
    if (impersonateUserId) { setBlockModalVisible(true); return; }
    const name = draft.name.trim();
    if (!name) {
      toast.warning(t("items.alerts.nameRequired"));
      return;
    }

    const lengthError =
      validateText(name, { label: t("items.form.fields.itemName") || "Item name", limit: INPUT_LIMITS.itemName }) ??
      validateText(draft.huid, { label: t("items.form.fields.huid") || "HUID", limit: INPUT_LIMITS.hsnCode }) ??
      validateText(draft.otherChargeDesc, { label: t("items.form.fields.otherChargeDesc") || "Other charge description", limit: INPUT_LIMITS.itemDescription });
    if (lengthError) {
      toast.warning(lengthError);
      return;
    }

    // Duplicate name check
    const duplicate = items.some(
      (it) =>
        it.name.toLowerCase() === name.toLowerCase() && it.id !== editId
    );
    if (duplicate) {
      toast.warning(t("items.alerts.nameDuplicate"));
      return;
    }

    const payload = {
      name,
      category: draft.category,
      purity: draft.category === "Gold" ? draft.purity : "",
      makingChargeType: draft.makingChargeType,
      makingCharges: parseFloat(draft.makingCharges) || 0,
      discountType: draft.discountType,
      discount: parseFloat(draft.discount) || 0,
      grossWt: parseFloat(draft.grossWt) || 0,
      lessWt: parseFloat(draft.lessWt) || 0,
      pcs: parseInt(draft.pcs) || 1,
      stockQty: draft.stockQty.trim() === "" ? undefined : Math.max(0, parseInt(draft.stockQty) || 0),
      huid: draft.huid.trim() || "",
      otherChargeDesc: draft.otherChargeDesc.trim() || "",
      otherChargeAmount: parseFloat(draft.otherChargeAmount) || 0,
    };

    const result = !editId
      ? await dispatch(addCatalogProduct(payload))
      : await dispatch(updateCatalogProduct({ id: editId, ...payload }));

    const succeeded = !editId
      ? addCatalogProduct.fulfilled.match(result)
      : updateCatalogProduct.fulfilled.match(result);

    if (succeeded) {
      toast.success(editId ? 'Item updated' : 'Item added');
      closeForm();
    } else {
      toast.error((result as any).payload || 'Failed to save item');
    }
  };

  const confirmDelete = (id: string, name: string) => {
    if (impersonateUserId) { setBlockModalVisible(true); return; }
    const deleteMessage = t("items.alerts.deleteMessage").replace("{name}", name);
    Alert.alert(
      t("items.alerts.deleteTitle"),
      deleteMessage,
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("items.alerts.deleteConfirm"),
          style: "destructive",
          onPress: async () => {
            const result = await dispatch(deleteCatalogProduct(id));
            if (deleteCatalogProduct.fulfilled.match(result)) {
              toast.success('Item deleted');
            } else {
              toast.error((result.payload as string) || 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  const isEditing = !!editId;

  // --------------------------------------------------------------------------
  // ADD / EDIT FULL SCREEN RENDER
  // --------------------------------------------------------------------------
  if (open) {
    return (
      <Box flex={1} bg={BG}>
        <SafeAreaView edges={["top"]} style={{ backgroundColor: "#FFFFFF" }}>
          <Box bg="$white" borderBottomWidth={1} borderBottomColor={BORDER}>
            <HStack 
              alignItems="center" 
              px="$4" 
              py="$3.5"
              style={LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}}
            >
              <Pressable onPress={closeForm} p="$2" rounded="$lg">
                <ArrowLeft color="#111827" />
              </Pressable>
              <Text fontWeight="$bold" color="$coolGray900" style={{ fontSize: 20, marginLeft: 10 }}>
                {isEditing ? t("items.modal.editTitle") : t("items.modal.addTitle")}
              </Text>
            </HStack>
          </Box>
        </SafeAreaView>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <RNScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ 
              padding: 16, 
              paddingBottom: 60,
              ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {})
            }}
          >
            <VStack space="md">
              <Box>
                <FieldLabel>{t("items.form.fields.itemName")}</FieldLabel>
                <StyledInput
                  value={draft.name}
                  onChangeText={(v) => updateDraft("name", capitalizeWords(v))}
                  placeholder={t("items.form.placeholders.itemName")}
                  maxLength={INPUT_LIMITS.itemName}
                  showCounter
                />
              </Box>

              <HStack space="md">
                <Box flex={1}>
                  <FieldLabel>{t("items.form.fields.type")}</FieldLabel>
                  <StyledSelect
                    value={draft.category}
                    onValueChange={(v: ItemCategory) => {
                      updateDraft("category", v);
                      if (v === "Gold") updateDraft("purity", "22K - 91.6%");
                      else if (v === "Silver") updateDraft("purity", "Silver");
                      else updateDraft("purity", "");
                    }}
                    items={categoryOptions}
                    placeholder={selectPlaceholder}
                  />
                </Box>

                {draft.category !== "Others" && (
                  <Box flex={1}>
                    <FieldLabel>{t("items.form.fields.purity")}</FieldLabel>
                    <SelectField
                      value={draft.purity}
                      onValueChange={(v) => updateDraft("purity", v)}
                      items={
                        draft.category === "Gold"
                          ? purityOptionsGold
                          : purityOptionsSilver
                      }
                      placeholder={selectPlaceholder}
                      title={t("items.form.fields.purity")}
                      height={50}
                    />
                  </Box>
                )}
              </HStack>

              <HStack space="md">
                <Box flex={1}>
                  <FieldLabel>{t("items.form.fields.makingChargeType")}</FieldLabel>
                  <StyledSelect
                    value={draft.makingChargeType}
                    onValueChange={(v) => updateDraft("makingChargeType", v)}
                    items={makingChargeOptions}
                    placeholder={selectPlaceholder}
                  />
                </Box>
                <Box flex={1}>
                  <FieldLabel>{t("items.form.fields.makingCharges")}</FieldLabel>
                  <StyledInput
                    value={draft.makingCharges}
                    onChangeText={(v) => updateDraft("makingCharges", v)}
                    keyboardType="numeric"
                    maxLength={INPUT_LIMITS.amount}
                    placeholder={t("items.form.placeholders.makingCharges")}
                  />
                </Box>
              </HStack>

              <HStack space="md">
                <Box flex={1}>
                  <FieldLabel>{t("items.form.fields.discountType")}</FieldLabel>
                  <StyledSelect
                    value={draft.discountType}
                    onValueChange={(v) => updateDraft("discountType", v)}
                    items={discountOptions}
                    placeholder={selectPlaceholder}
                  />
                </Box>
                <Box flex={1}>
                  <FieldLabel>{t("items.form.fields.discount")}</FieldLabel>
                  <StyledInput
                    value={draft.discount}
                    onChangeText={(v) => updateDraft("discount", v)}
                    keyboardType="numeric"
                    maxLength={INPUT_LIMITS.amount}
                    placeholder={t("items.form.placeholders.discount")}
                  />
                </Box>
              </HStack>

              <HStack space="md">
                <Box flex={1}>
                  <FieldLabel>{t("items.form.fields.grossWeight")}</FieldLabel>
                  <StyledInput
                    value={draft.grossWt}
                    onChangeText={(v) => updateDraft("grossWt", v)}
                    keyboardType="numeric"
                    maxLength={INPUT_LIMITS.weight}
                    placeholder={t("items.form.placeholders.grossWeight")}
                  />
                </Box>
                <Box flex={1}>
                  <FieldLabel>{t("items.form.fields.lessWeight")}</FieldLabel>
                  <StyledInput
                    value={draft.lessWt}
                    onChangeText={(v) => updateDraft("lessWt", v)}
                    keyboardType="numeric"
                    maxLength={INPUT_LIMITS.weight}
                    placeholder={t("items.form.placeholders.lessWeight")}
                  />
                </Box>
              </HStack>

              <HStack space="md">
                <Box flex={1}>
                  <FieldLabel>{t("items.form.fields.huid")}</FieldLabel>
                  <StyledInput
                    value={draft.huid}
                    onChangeText={(v) => updateDraft("huid", v)}
                    placeholder={t("items.form.placeholders.huid")}
                    maxLength={INPUT_LIMITS.hsnCode}
                  />
                </Box>
                <Box flex={1}>
                  <FieldLabel>{t("items.form.fields.pieces")}</FieldLabel>
                  <StyledInput
                    value={draft.pcs}
                    onChangeText={(v) => updateDraft("pcs", v.replace(/[^0-9]/g, ""))}
                    keyboardType="number-pad"
                    maxLength={INPUT_LIMITS.quantity}
                    placeholder={t("items.form.placeholders.pieces")}
                  />
                </Box>
              </HStack>

              <HStack space="md">
                <Box flex={1}>
                  <FieldLabel>{t("items.form.fields.stockQty") || "Stock Qty (pieces)"}</FieldLabel>
                  <StyledInput
                    value={draft.stockQty}
                    onChangeText={(v) => updateDraft("stockQty", v.replace(/[^0-9]/g, ""))}
                    keyboardType="number-pad"
                    maxLength={INPUT_LIMITS.quantity}
                    placeholder={t("items.form.placeholders.stockQty") || "Blank = not tracked"}
                  />
                </Box>
                <Box flex={1} />
              </HStack>

              <HStack space="md">
                <Box flex={1}>
                  <FieldLabel>{t("items.form.fields.otherChargeDesc")}</FieldLabel>
                  <StyledInput
                    value={draft.otherChargeDesc}
                    onChangeText={(v) => updateDraft("otherChargeDesc", v)}
                    placeholder={t("items.form.placeholders.otherChargeDesc")}
                    maxLength={INPUT_LIMITS.itemDescription}
                  />
                </Box>
                <Box flex={1}>
                  <FieldLabel>{t("items.form.fields.otherChargeAmount")}</FieldLabel>
                  <StyledInput
                    value={draft.otherChargeAmount}
                    onChangeText={(v) => updateDraft("otherChargeAmount", v)}
                    keyboardType="numeric"
                    maxLength={INPUT_LIMITS.amount}
                    placeholder={t("items.form.placeholders.otherChargeAmount")}
                  />
                </Box>
              </HStack>

              <Box mt="$6">
                <GradientFullButton
                  label={
                    isEditing
                      ? t("items.modal.saveBtn")
                      : t("items.modal.addBtn")
                  }
                  onPress={submit}
                />
              </Box>
            </VStack>
          </RNScrollView>
        </KeyboardAvoidingView>
        <ImpersonationBlockModal
          isOpen={blockModalVisible}
          phone={impersonatePhone || ''}
          onEndSession={handleEndSession}
          onClose={() => setBlockModalVisible(false)}
        />
      </Box>
    );
  }

  // --------------------------------------------------------------------------
  // LIST RENDERING
  // --------------------------------------------------------------------------
  return (
    <Box flex={1} bg={BG}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#FFFFFF" }}>
        <Box bg="$white" borderBottomWidth={1} borderBottomColor={BORDER}>
          <HStack
            alignItems="center"
            justifyContent="space-between"
            style={[
              { paddingHorizontal: 16, paddingVertical: 14 },
              LAYOUT.isWeb && LAYOUT.contentContainerStyle
            ]}
          >
            <Pressable onPress={() => navigation.goBack()} p="$2">
              <ArrowLeft />
            </Pressable>

            <Box flex={1} ml="$2">
              <Text
                fontWeight="$bold"
                color="$coolGray900"
                style={{ fontSize: 20, lineHeight: 26 }}
              >
                {t("items.title")}
              </Text>
              <Text color="$coolGray500" style={{ fontSize: 14, marginTop: 2 }}>
                {countLabel}
              </Text>
            </Box>

            <GradientButtonPill
              label={t("items.addItem")}
              onPress={openAdd}
            />
          </HStack>
        </Box>
      </SafeAreaView>

      <Box px="$4" pt="$4" style={LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}}>
        <Box
          bg="$white"
          rounded="$2xl"
          borderWidth={1}
          borderColor={BORDER}
          style={{ height: 52, paddingHorizontal: 14 }}
        >
          <HStack alignItems="center" space="sm" flex={1}>
            <Icon as={Search} size="lg" color="#6B7280" />
            <Input flex={1} bg="transparent" borderWidth={0} p={0}>
              <InputField
                placeholder={t("items.searchPlaceholder")}
                value={query}
                onChangeText={setQuery}
                style={{ fontSize: 16 }}
                placeholderTextColor="#9CA3AF"
              />
            </Input>
          </HStack>
        </Box>
      </Box>

      <ScrollView
        flex={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 100,
          ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {})
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        keyboardShouldPersistTaps="handled"
      >
        {items.length === 0 ? (
          <Center mt={70}>
            <Center
              style={{
                width: 78,
                height: 78,
                borderRadius: 39,
                backgroundColor: "#E5E7EB",
              }}
            >
              <Icon as={Package} size="xl" color="#6B7280" />
            </Center>

            <Text
              mt="$5"
              fontWeight="$bold"
              color="$coolGray700"
              style={{ fontSize: 18 }}
            >
              {t("items.emptyTitle")}
            </Text>

            <Text
              mt="$2"
              color="$coolGray500"
              textAlign="center"
              style={{ fontSize: 14, lineHeight: 20, maxWidth: 290 }}
            >
              {t("items.emptySubtitle")}
            </Text>
          </Center>
        ) : (
          <VStack space="md">
            {filtered.map((it: any, index: number) => (
              <Box
                key={it.id || index}
                bg="$white"
                rounded="$2xl"
                borderWidth={1}
                borderColor={BORDER}
                hardShadow="1"
                style={{ padding: 14 }}
              >
                <HStack alignItems="center" justifyContent="space-between">
                  <HStack alignItems="center" space="md" flex={1}>
                    <Center
                      style={{
                        width: 54,
                        height: 54,
                        borderRadius: 18,
                        backgroundColor: ICON_TINT,
                      }}
                    >
                      <Icon as={Package} size="lg" color={PURPLE} />
                    </Center>

                    <VStack flex={1}>
                      <HStack alignItems="center" space="sm">
                        <Text
                          fontWeight="$bold"
                          color="$coolGray900"
                          style={{ fontSize: 16, flexShrink: 1 }}
                          numberOfLines={1}
                        >
                          {it.name}
                        </Text>
                        {(() => {
                          const b = getStockBadge(it.stockQty);
                          return (
                            <Box style={{ backgroundColor: b.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                              <Text style={{ fontSize: 10, fontWeight: "700", color: b.color }}>
                                {b.label}
                              </Text>
                            </Box>
                          );
                        })()}
                      </HStack>
                      <Text color="$coolGray500" style={{ fontSize: 13, marginTop: 2 }}>
                        {getCategoryLabel(it.category)}
                        {it.category === "Gold" && it.purity
                          ? ` • ${getPurityLabel(it.purity)}`
                          : ""}
                      </Text>
                    </VStack>
                  </HStack>

                  <HStack alignItems="center" space="md">
                    <Pressable onPress={() => openEdit(it)} p="$2">
                      <Icon as={Pencil} size="lg" color="#6B7280" />
                    </Pressable>
                    <Pressable
                      onPress={() => confirmDelete(it.id, it.name)}
                      p="$2"
                    >
                      <Icon as={Trash2} size="lg" color="#EF4444" />
                    </Pressable>
                  </HStack>
                </HStack>
              </Box>
            ))}
          </VStack>
        )}
      </ScrollView>
      <ImpersonationBlockModal
        isOpen={blockModalVisible}
        phone={impersonatePhone || ''}
        onEndSession={handleEndSession}
        onClose={() => setBlockModalVisible(false)}
      />
    </Box>
  );
};

export default ItemsProductsScreen;
