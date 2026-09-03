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
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Plus,
  Search,
  ShoppingCart,
  Pencil,
  Trash2,
  ArrowLeft,
  ChevronDown,
  Calendar,
} from "lucide-react-native";
import { useTranslation } from "../../hooks/useTranslation";
import { capitalizeWords } from "../../utils/textUtils";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  fetchPurchases,
  addPurchase,
  updatePurchase,
  deletePurchase,
  clearUserData,
  Purchase,
} from "../../store/data/dataSlice";
import { endImpersonation } from "../../store/auth/authSlice";
import { toast } from "../../components/common/Toast";
import ImpersonationBlockModal from "../../components/ImpersonationBlockModal";
import DatePickerModal from "../../components/common/DatePickerModal";
import { GSTIN_REGEX, splitGstAmount } from "../../utils/gst";
import { toDisplayDate } from "../../utils/gstPeriods";
import { LAYOUT } from "../../constants/layout";
import { INPUT_LIMITS, validateText } from "../../constants/inputLimits";
import CharCounter from "../../components/common/CharCounter";

const PURPLE = "#6D5EF7";
const PINK = "#D946EF";
const BORDER = "#E5E7EB";
const BG = "#F9FAFB";
const ICON_TINT = "#F1E9FF";

interface DraftPurchase {
  supplierName: string;
  supplierGstin: string;
  purchaseInvoiceNumber: string;
  purchaseDate: string; // YYYY-MM-DD
  taxableValue: string;
  gstRate: string;
  gstAmount: string;
  gstAmountEdited: boolean;
  category: string;
  description: string;
}

const todayIso = () => new Date().toISOString().split("T")[0];

const makeDefaultDraft = (gstRate: number): DraftPurchase => ({
  supplierName: "",
  supplierGstin: "",
  purchaseInvoiceNumber: "",
  purchaseDate: todayIso(),
  taxableValue: "",
  gstRate: String(gstRate),
  gstAmount: "",
  gstAmountEdited: false,
  category: "",
  description: "",
});

const GradientButtonPill = ({ label, onPress }: { label: string; onPress: () => void }) => {
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

const GradientFullButton = ({ label, onPress }: { label: string; onPress: () => void }) => {
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

const FieldLabel = ({ children }: { children: string }) => (
  <Text style={{ fontSize: 13, marginBottom: 6, color: "#374151", fontWeight: "600" }}>
    {children}
  </Text>
);

const StyledInput = ({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  maxLength,
  invalid,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  autoCapitalize?: any;
  maxLength?: number;
  invalid?: boolean;
}) => (
  <Box
    rounded="$2xl"
    borderWidth={1}
    borderColor={invalid ? "#EF4444" : BORDER}
    bg="$white"
    style={{ height: 50, paddingHorizontal: 14 }}
  >
    <Input bg="transparent" borderWidth={0} flex={1} p={0}>
      <InputField
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        style={{ fontSize: 15 }}
        placeholderTextColor="#9CA3AF"
      />
    </Input>
  </Box>
);

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
  // See ItemsProductsScreen: SelectInput renders `label || value`, and label is
  // seeded from selectedLabel on mount only.
  const selectedLabel = items.find((i) => i.value === value)?.label;

  return (
  <Box h={50} w="$full" rounded="$2xl" borderWidth={1} borderColor={BORDER} bg="$white">
    <Select key={value} selectedValue={value} selectedLabel={selectedLabel} onValueChange={onValueChange}>
      <SelectTrigger
        variant="outline"
        style={{
          height: 44,
          borderWidth: 0,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <SelectInput
          style={{ flex: 1, fontSize: 15, color: "#111827" }}
          placeholder={placeholder}
          pointerEvents="none"
        />
        <SelectIcon pointerEvents="none">
          <Icon as={ChevronDown} size="sm" color="#6B7280" />
        </SelectIcon>
      </SelectTrigger>
      <SelectPortal>
        <SelectBackdrop />
        <SelectContent pb="$10" zIndex={9999} style={{ width: "100%" }}>
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

const fmtMoney = (n: number) =>
  (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const PurchasesScreen = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { purchases, shopDetails } = useAppSelector((s) => s.data);
  const { impersonateUserId, impersonatePhone } = useAppSelector((s) => s.auth);
  const [blockModalVisible, setBlockModalVisible] = useState(false);

  const handleEndSession = () => {
    dispatch(endImpersonation());
    dispatch(clearUserData());
    (navigation as any).navigate("AdminDashboard");
  };

  const shopGstRate = (shopDetails as any)?.gstPercentage ?? 3;
  const shopGstin = (shopDetails as any)?.gst || undefined;

  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftPurchase>(makeDefaultDraft(shopGstRate));
  const [editId, setEditId] = useState<string | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchPurchases());
  }, [dispatch]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchPurchases({ force: true }));
    setRefreshing(false);
  }, [dispatch]);

  const categoryOptions = useMemo(
    () => [
      { label: t("metals.gold"), value: "Gold" },
      { label: t("metals.silver"), value: "Silver" },
      { label: t("metals.others"), value: "Others" },
    ],
    [t],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return purchases;
    return purchases.filter(
      (p) =>
        p.supplierName.toLowerCase().includes(q) ||
        p.purchaseInvoiceNumber.toLowerCase().includes(q) ||
        (p.supplierGstin || "").toLowerCase().includes(q),
    );
  }, [purchases, query]);

  const updateDraft = <K extends keyof DraftPurchase>(key: K, val: DraftPurchase[K]) =>
    setDraft((prev) => ({ ...prev, [key]: val }));

  // GST amount auto-suggests from taxable × rate unless the user edited it
  const recomputeGst = (taxable: string, rate: string, edited: boolean, current: string) => {
    if (edited) return current;
    const tv = parseFloat(taxable) || 0;
    const r = parseFloat(rate) || 0;
    return tv > 0 && r > 0 ? String(Number(((tv * r) / 100).toFixed(2))) : "";
  };

  const gstinTrimmed = draft.supplierGstin.trim().toUpperCase();
  const gstinInvalid = !!gstinTrimmed && !GSTIN_REGEX.test(gstinTrimmed);

  // Live preview of the CGST/SGST vs IGST split
  const splitPreview = useMemo(() => {
    const amount = parseFloat(draft.gstAmount) || 0;
    if (amount <= 0) return null;
    const gstin = GSTIN_REGEX.test(gstinTrimmed) ? gstinTrimmed : undefined;
    return splitGstAmount(amount, shopGstin, gstin);
  }, [draft.gstAmount, gstinTrimmed, shopGstin]);

  const openAdd = () => {
    setDraft(makeDefaultDraft(shopGstRate));
    setEditId(null);
    setOpen(true);
  };

  const openEdit = (p: Purchase) => {
    setDraft({
      supplierName: p.supplierName || "",
      supplierGstin: p.supplierGstin || "",
      purchaseInvoiceNumber: p.purchaseInvoiceNumber || "",
      purchaseDate: (p.purchaseDate || todayIso()).split("T")[0],
      taxableValue: String(p.taxableValue ?? ""),
      gstRate: String(p.gstRate ?? shopGstRate),
      gstAmount: String(p.gstAmount ?? ""),
      gstAmountEdited: true,
      category: p.category || "",
      description: p.description || "",
    });
    setEditId(p.id);
    setOpen(true);
  };

  const closeForm = () => setOpen(false);

  const submit = async () => {
    if (impersonateUserId) {
      setBlockModalVisible(true);
      return;
    }
    const supplierName = draft.supplierName.trim();
    const billNo = draft.purchaseInvoiceNumber.trim();
    const taxableValue = parseFloat(draft.taxableValue);
    const gstAmount = parseFloat(draft.gstAmount) || 0;

    const errors: string[] = [];
    if (!supplierName) errors.push(t("purchases.alerts.supplierRequired") || "Supplier name is required");
    if (!billNo) errors.push(t("purchases.alerts.billNoRequired") || "Purchase invoice number is required");
    if (!(taxableValue > 0)) errors.push(t("purchases.alerts.taxableRequired") || "Taxable value must be greater than 0");
    if (gstinInvalid) errors.push(t("purchases.alerts.gstinInvalid") || "Enter a valid 15-character GSTIN or leave it blank");
    [
      validateText(supplierName, { label: t("purchases.fields.supplierName") || "Supplier name", limit: INPUT_LIMITS.supplierName }),
      validateText(billNo, { label: t("purchases.fields.billNo") || "Purchase invoice number", limit: INPUT_LIMITS.invoiceNumber }),
      validateText(draft.description, { label: t("purchases.fields.description") || "Description", limit: INPUT_LIMITS.itemDescription }),
    ].forEach(msg => { if (msg) errors.push(msg); });
    if (errors.length) {
      toast.warning(errors.join("\n"));
      return;
    }

    const payload = {
      supplierName,
      supplierGstin: GSTIN_REGEX.test(gstinTrimmed) ? gstinTrimmed : undefined,
      purchaseInvoiceNumber: billNo,
      purchaseDate: draft.purchaseDate,
      taxableValue,
      gstRate: parseFloat(draft.gstRate) || shopGstRate,
      gstAmount,
      category: draft.category || undefined,
      description: draft.description.trim() || undefined,
    };

    const result = !editId
      ? await dispatch(addPurchase(payload as any))
      : await dispatch(updatePurchase({ id: editId, ...payload } as any));

    const succeeded = !editId
      ? addPurchase.fulfilled.match(result)
      : updatePurchase.fulfilled.match(result);

    if (succeeded) {
      toast.success(editId ? 'Purchase updated' : 'Purchase added');
      closeForm();
    } else {
      toast.error((result as any).payload || 'Failed to save purchase');
    }
  };

  const confirmDelete = (p: Purchase) => {
    if (impersonateUserId) {
      setBlockModalVisible(true);
      return;
    }
    const msg = (t("purchases.alerts.deleteMessage") || 'Delete purchase "{name}"? This cannot be undone.').replace(
      "{name}",
      `${p.supplierName} • ${p.purchaseInvoiceNumber}`,
    );
    Alert.alert(t("purchases.alerts.deleteTitle") || "Delete Purchase", msg, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("items.alerts.deleteConfirm") || "Delete",
        style: "destructive",
        onPress: async () => {
          const result = await dispatch(deletePurchase(p.id));
          if (deletePurchase.fulfilled.match(result)) {
            toast.success('Purchase deleted');
          } else {
            toast.error((result.payload as string) || 'Failed to delete purchase');
          }
        },
      },
    ]);
  };

  const isEditing = !!editId;
  const countLabel = `${purchases.length} ${t("purchases.count") || "purchases"}`;

  // ── ADD / EDIT FULL SCREEN ──
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
                {isEditing
                  ? t("purchases.editTitle") || "Edit Purchase"
                  : t("purchases.addTitle") || "Add Purchase"}
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
              ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}),
            }}
          >
            <VStack space="md">
              <Box>
                <FieldLabel>{t("purchases.fields.supplierName") || "Supplier Name *"}</FieldLabel>
                <StyledInput
                  value={draft.supplierName}
                  onChangeText={(v) => updateDraft("supplierName", capitalizeWords(v))}
                  placeholder={t("purchases.placeholders.supplierName") || "e.g., Ratanlal Bullion"}
                  maxLength={INPUT_LIMITS.supplierName}
                />
                <CharCounter value={draft.supplierName} limit={INPUT_LIMITS.supplierName} />
              </Box>

              <Box>
                <FieldLabel>{t("purchases.fields.supplierGstin") || "Supplier GSTIN (optional)"}</FieldLabel>
                <StyledInput
                  value={draft.supplierGstin}
                  onChangeText={(v) => updateDraft("supplierGstin", v.toUpperCase().replace(/\s/g, ""))}
                  placeholder={t("purchases.placeholders.supplierGstin") || "e.g., 27AAAAA0000A1Z5"}
                  autoCapitalize="characters"
                  maxLength={INPUT_LIMITS.gstin}
                  invalid={gstinInvalid}
                />
                {gstinInvalid ? (
                  <Text style={{ fontSize: 12, color: "#EF4444", marginTop: 4 }}>
                    {t("purchases.alerts.gstinInvalid") || "Enter a valid 15-character GSTIN or leave it blank"}
                  </Text>
                ) : (
                  <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                    {t("purchases.gstinHint") ||
                      "Needed to claim Input Tax Credit (registered supplier)"}
                  </Text>
                )}
              </Box>

              <HStack space="md">
                <Box flex={1}>
                  <FieldLabel>{t("purchases.fields.billNo") || "Purchase Invoice No *"}</FieldLabel>
                  <StyledInput
                    value={draft.purchaseInvoiceNumber}
                    onChangeText={(v) => updateDraft("purchaseInvoiceNumber", v)}
                    placeholder={t("purchases.placeholders.billNo") || "Supplier bill no."}
                    maxLength={INPUT_LIMITS.invoiceNumber}
                  />
                </Box>
                <Box flex={1}>
                  <FieldLabel>{t("purchases.fields.date") || "Purchase Date *"}</FieldLabel>
                  <Pressable onPress={() => setIsDatePickerOpen(true)}>
                    <Box
                      rounded="$2xl"
                      borderWidth={1}
                      borderColor={BORDER}
                      bg="$white"
                      style={{
                        height: 50,
                        paddingHorizontal: 14,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text style={{ fontSize: 15, color: "#111827" }}>
                        {toDisplayDate(draft.purchaseDate)}
                      </Text>
                      <Icon as={Calendar} size="sm" color="#6B7280" />
                    </Box>
                  </Pressable>
                </Box>
              </HStack>

              <HStack space="md">
                <Box flex={1}>
                  <FieldLabel>{t("purchases.fields.taxableValue") || "Taxable Value (₹) *"}</FieldLabel>
                  <StyledInput
                    value={draft.taxableValue}
                    onChangeText={(v) =>
                      setDraft((prev) => ({
                        ...prev,
                        taxableValue: v,
                        gstAmount: recomputeGst(v, prev.gstRate, prev.gstAmountEdited, prev.gstAmount),
                      }))
                    }
                    keyboardType="numeric"
                    maxLength={INPUT_LIMITS.amount}
                    placeholder="0.00"
                  />
                </Box>
                <Box flex={1}>
                  <FieldLabel>{t("purchases.fields.gstRate") || "GST Rate %"}</FieldLabel>
                  <StyledInput
                    value={draft.gstRate}
                    onChangeText={(v) =>
                      setDraft((prev) => ({
                        ...prev,
                        gstRate: v,
                        gstAmount: recomputeGst(prev.taxableValue, v, prev.gstAmountEdited, prev.gstAmount),
                      }))
                    }
                    keyboardType="numeric"
                    maxLength={INPUT_LIMITS.percentage}
                    placeholder="3"
                  />
                </Box>
              </HStack>

              <Box>
                <FieldLabel>{t("purchases.fields.gstAmount") || "GST Paid (₹)"}</FieldLabel>
                <StyledInput
                  value={draft.gstAmount}
                  onChangeText={(v) =>
                    setDraft((prev) => ({ ...prev, gstAmount: v, gstAmountEdited: true }))
                  }
                  keyboardType="numeric"
                  maxLength={INPUT_LIMITS.amount}
                  placeholder="0.00"
                />
                {splitPreview && (
                  <Box
                    mt="$2"
                    rounded="$xl"
                    style={{ backgroundColor: "#EEF2FF", paddingHorizontal: 12, paddingVertical: 8 }}
                  >
                    <Text style={{ fontSize: 12, color: "#4F46E5", fontWeight: "600" }}>
                      {splitPreview.supplyType === "inter"
                        ? `IGST ₹${fmtMoney(splitPreview.igstAmount)}`
                        : `CGST ₹${fmtMoney(splitPreview.cgstAmount)} + SGST ₹${fmtMoney(splitPreview.sgstAmount)}`}
                      {!GSTIN_REGEX.test(gstinTrimmed) &&
                        ` • ${t("purchases.unregistered") || "Unregistered"}`}
                    </Text>
                  </Box>
                )}
              </Box>

              <HStack space="md">
                <Box flex={1}>
                  <FieldLabel>{t("purchases.fields.category") || "Category (optional)"}</FieldLabel>
                  <StyledSelect
                    value={draft.category}
                    onValueChange={(v) => updateDraft("category", v)}
                    items={categoryOptions}
                    placeholder={t("items.form.selectPlaceholder")}
                  />
                </Box>
                <Box flex={1}>
                  <FieldLabel>{t("purchases.fields.description") || "Description (optional)"}</FieldLabel>
                  <StyledInput
                    value={draft.description}
                    onChangeText={(v) => updateDraft("description", v)}
                    placeholder={t("purchases.placeholders.description") || "e.g., 24K bullion 100g"}
                    maxLength={INPUT_LIMITS.itemDescription}
                  />
                </Box>
              </HStack>

              <Box mt="$6">
                <GradientFullButton
                  label={
                    isEditing
                      ? t("purchases.saveBtn") || "Save Changes"
                      : t("purchases.addBtn") || "Add Purchase"
                  }
                  onPress={submit}
                />
              </Box>
            </VStack>
          </RNScrollView>
        </KeyboardAvoidingView>

        <DatePickerModal
          isOpen={isDatePickerOpen}
          onClose={() => setIsDatePickerOpen(false)}
          date={draft.purchaseDate}
          onSelect={(d: string) => {
            updateDraft("purchaseDate", d);
            setIsDatePickerOpen(false);
          }}
        />
        <ImpersonationBlockModal
          isOpen={blockModalVisible}
          phone={impersonatePhone || ""}
          onEndSession={handleEndSession}
          onClose={() => setBlockModalVisible(false)}
        />
      </Box>
    );
  }

  // ── LIST ──
  return (
    <Box flex={1} bg={BG}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#FFFFFF" }}>
        <Box bg="$white" borderBottomWidth={1} borderBottomColor={BORDER}>
          <HStack
            alignItems="center"
            justifyContent="space-between"
            style={[
              { paddingHorizontal: 16, paddingVertical: 14 },
              LAYOUT.isWeb && LAYOUT.contentContainerStyle,
            ]}
          >
            <Pressable onPress={() => navigation.goBack()} p="$2">
              <ArrowLeft />
            </Pressable>

            <Box flex={1} ml="$2">
              <Text fontWeight="$bold" color="$coolGray900" style={{ fontSize: 20, lineHeight: 26 }}>
                {t("purchases.title") || "Purchases (GST)"}
              </Text>
              <Text color="$coolGray500" style={{ fontSize: 14, marginTop: 2 }}>
                {countLabel}
              </Text>
            </Box>

            <GradientButtonPill label={t("purchases.addShort") || "Add"} onPress={openAdd} />
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
                placeholder={t("purchases.searchPlaceholder") || "Search supplier or bill no."}
                value={query}
                onChangeText={setQuery}
                maxLength={INPUT_LIMITS.searchQuery}
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
          ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}),
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
      >
        {purchases.length === 0 ? (
          <Center mt={70}>
            <Center style={{ width: 78, height: 78, borderRadius: 39, backgroundColor: "#E5E7EB" }}>
              <Icon as={ShoppingCart} size="xl" color="#6B7280" />
            </Center>
            <Text mt="$5" fontWeight="$bold" color="$coolGray700" style={{ fontSize: 18 }}>
              {t("purchases.emptyTitle") || "No purchases yet"}
            </Text>
            <Text
              mt="$2"
              color="$coolGray500"
              textAlign="center"
              style={{ fontSize: 14, lineHeight: 20, maxWidth: 290 }}
            >
              {t("purchases.emptySubtitle") ||
                "Record stock purchases with GST paid to claim Input Tax Credit in your GST report."}
            </Text>
          </Center>
        ) : (
          <VStack space="md">
            {filtered.map((p, index) => (
              <Box
                key={p.id || index}
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
                      style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: ICON_TINT }}
                    >
                      <Icon as={ShoppingCart} size="lg" color={PURPLE} />
                    </Center>

                    <VStack flex={1}>
                      <HStack alignItems="center" space="sm">
                        <Text
                          fontWeight="$bold"
                          color="$coolGray900"
                          style={{ fontSize: 16, flexShrink: 1 }}
                          numberOfLines={1}
                        >
                          {p.supplierName}
                        </Text>
                        <Box
                          style={{
                            backgroundColor: p.supplierGstin ? "#D1FAE5" : "#F3F4F6",
                            borderRadius: 999,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: "700",
                              color: p.supplierGstin ? "#047857" : "#6B7280",
                            }}
                          >
                            {p.supplierGstin
                              ? t("purchases.registered") || "GST"
                              : t("purchases.unregistered") || "Unregistered"}
                          </Text>
                        </Box>
                      </HStack>
                      <Text color="$coolGray500" style={{ fontSize: 13, marginTop: 2 }}>
                        {p.purchaseInvoiceNumber} • {toDisplayDate(p.purchaseDate)}
                      </Text>
                      <Text color="$coolGray700" style={{ fontSize: 13, marginTop: 2 }}>
                        ₹{fmtMoney(p.taxableValue)} +{" "}
                        {(p.supplyType || "intra") === "inter"
                          ? `IGST ₹${fmtMoney(p.igstAmount ?? p.gstAmount)}`
                          : `GST ₹${fmtMoney(p.gstAmount)}`}
                      </Text>
                    </VStack>
                  </HStack>

                  <HStack alignItems="center" space="md">
                    <Pressable onPress={() => openEdit(p)} p="$2">
                      <Icon as={Pencil} size="lg" color="#6B7280" />
                    </Pressable>
                    <Pressable onPress={() => confirmDelete(p)} p="$2">
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
        phone={impersonatePhone || ""}
        onEndSession={handleEndSession}
        onClose={() => setBlockModalVisible(false)}
      />
    </Box>
  );
};

export default PurchasesScreen;
