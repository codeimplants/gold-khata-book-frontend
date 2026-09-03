import React, { useMemo, useState, useCallback } from "react";
import {
  RefreshControl,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  View,
  Platform,
} from "react-native";
import {
  Box,
  HStack,
  Text,
  VStack,
  ScrollView,
  Center,
  Icon,
  Pressable,
} from "@gluestack-ui/themed";
import { useNavigation } from "@react-navigation/native";
import {
  ChevronDown,
  Check,
  Calendar,
  FileSpreadsheet,
  Share2,
  Download,
  Landmark,
  ShoppingCart,
  ReceiptText,
} from "lucide-react-native";
import CommonHeader from "../../components/CommonHeader";
import { toast } from "../../components/common/Toast";
import DatePickerModal from "../../components/common/DatePickerModal";
import { useAppSelector, useAppDispatch } from "../../store/hooks";
import { useTranslation } from "../../hooks/useTranslation";
import {
  fetchOrders,
  fetchPurchases,
  fetchGstReport,
  fetchShopDetails,
} from "../../store/data/dataSlice";
import { buildLocalGstReport } from "../../utils/gst";
import {
  GstPeriodPreset,
  getGstPeriod,
  toApiDate,
  toDisplayDate,
} from "../../utils/gstPeriods";
import { buildGstReportCsv, shareGstReportCsv } from "../../utils/csvService";
import { buildGstReportHTML } from "../../print/gstReportTemplate";
import { printHTML } from "../../print/printService";
import {
  generateInvoicePDF,
  sharePDF,
  downloadPDFToDevice,
} from "../../utils/pdfService";
import { LAYOUT } from "../../constants/layout";
import { useSheetBottomInset } from "../../hooks/useSheetBottomInset";

const money = (n: unknown) =>
  `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/* ─── Period bottom-sheet picker (same pattern as SalesReport RangePicker) ─── */
const PeriodPicker = ({
  value,
  onChange,
  options,
  selectLabel,
}: {
  value: GstPeriodPreset;
  onChange: (v: GstPeriodPreset) => void;
  options: { label: string; value: GstPeriodPreset }[];
  selectLabel: string;
}) => {
  const [open, setOpen] = useState(false);
  const bottomInset = useSheetBottomInset(36);
  const label = options.find((o) => o.value === value)?.label ?? value;

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        style={pickerStyles.trigger}
      >
        <Text style={pickerStyles.triggerText}>{label}</Text>
        <Icon as={ChevronDown} size="sm" color="#D946EF" />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={pickerStyles.overlay}>
            <TouchableWithoutFeedback>
              <View style={[pickerStyles.sheet, { paddingBottom: bottomInset }]}>
                <View style={pickerStyles.handle} />
                <Text style={pickerStyles.sheetTitle}>{selectLabel}</Text>
                {options.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={pickerStyles.option}
                    onPress={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        pickerStyles.optionText,
                        opt.value === value && pickerStyles.optionTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {opt.value === value && (
                      <Icon as={Check} size="sm" color="#6D5EF7" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

const pickerStyles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D946EF",
    backgroundColor: "rgba(217, 70, 239, 0.05)",
    gap: 6,
  },
  triggerText: { color: "#9333EA", fontWeight: "700", fontSize: 13 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 36,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  optionText: { fontSize: 15, color: "#374151" },
  optionTextActive: { color: "#6D5EF7", fontWeight: "700" },
});

/* ─── Small tax-head chip ─── */
const TaxChip = ({ label, value }: { label: string; value: string }) => (
  <Box
    flex={1}
    bg="$white"
    rounded="$xl"
    p="$3"
    borderWidth={1}
    borderColor="$coolGray100"
    style={{ minWidth: "30%" }}
  >
    <Text color="$coolGray500" fontSize={11}>{label}</Text>
    <Text fontWeight="$bold" fontSize="$md" color="$coolGray900" mt="$0.5">
      {value}
    </Text>
  </Box>
);

/* ─── Main Screen ─── */
const GstReportScreen = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const { orders, purchases, customers, shopDetails, gstReport } = useAppSelector(
    (s) => s.data,
  );
  const { isGuest } = useAppSelector((s) => s.auth);

  const [preset, setPreset] = useState<GstPeriodPreset>("lastMonth");
  const [customFrom, setCustomFrom] = useState<string>(
    toApiDate(getGstPeriod("lastMonth").startDate),
  );
  const [customTo, setCustomTo] = useState<string>(
    toApiDate(getGstPeriod("lastMonth").endDate),
  );
  const [fromPickerOpen, setFromPickerOpen] = useState(false);
  const [toPickerOpen, setToPickerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const presetOptions = useMemo<{ label: string; value: GstPeriodPreset }[]>(
    () => [
      { label: t("gstReport.presets.thisMonth") || "This Month", value: "thisMonth" },
      { label: t("gstReport.presets.lastMonth") || "Last Month", value: "lastMonth" },
      { label: t("gstReport.presets.thisQuarter") || "This Quarter", value: "thisQuarter" },
      { label: t("gstReport.presets.lastQuarter") || "Last Quarter", value: "lastQuarter" },
      { label: t("gstReport.presets.thisFY") || "This FY (Apr–Mar)", value: "thisFY" },
      { label: t("gstReport.presets.lastFY") || "Last FY", value: "lastFY" },
      { label: t("gstReport.presets.custom") || "Custom Range", value: "custom" },
    ],
    [t],
  );

  const period = useMemo(() => {
    if (preset === "custom") {
      const start = new Date(customFrom);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customTo);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
    return getGstPeriod(preset);
  }, [preset, customFrom, customTo]);

  const customRangeInvalid =
    preset === "custom" && period.startDate.getTime() > period.endDate.getTime();

  const loadData = useCallback(
    async (force = false) => {
      if (customRangeInvalid) return;
      if (isGuest) {
        await Promise.all([
          dispatch(fetchOrders(force ? { force } : undefined)),
          dispatch(fetchPurchases(force ? { force } : undefined)),
        ]);
      } else {
        await Promise.all([
          dispatch(fetchShopDetails()),
          dispatch(fetchOrders(force ? { force } : undefined)),
          dispatch(fetchPurchases(force ? { force } : undefined)),
          dispatch(
            fetchGstReport({
              startDate: toApiDate(period.startDate),
              endDate: toApiDate(period.endDate),
            }),
          ),
        ]);
      }
    },
    [dispatch, isGuest, period, customRangeInvalid],
  );

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  }, [loadData]);

  const customersById = useMemo(() => {
    const map: Record<string, { name?: string }> = {};
    customers.forEach((c) => {
      if (c?.id) map[c.id] = { name: c.name };
    });
    return map;
  }, [customers]);

  // Guest (or server-miss) fallback computes the identical shape locally
  const localReport = useMemo(
    () =>
      buildLocalGstReport({
        orders,
        purchases,
        startDate: period.startDate,
        endDate: period.endDate,
        shopName: (shopDetails as any)?.name || (shopDetails as any)?.shopName,
        shopGstin: (shopDetails as any)?.gst || undefined,
        shopGstRate: (shopDetails as any)?.gstPercentage ?? 3,
        customersById,
      }),
    [orders, purchases, period, shopDetails, customersById],
  );

  const report = !isGuest && gstReport ? gstReport : localReport;

  const os = report?.outward?.summary || {};
  const is = report?.inward?.summary || {};
  const net = report?.net || {};
  const outwardRows = report?.outward?.rows || [];
  const inwardRows = report?.inward?.rows || [];
  const hasLegacy = outwardRows.some((r: any) => r.legacyDerived);

  const reportFileName = `GST_Report_${toApiDate(period.startDate)}_${toApiDate(period.endDate)}`;

  const handleShareCsv = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await shareGstReportCsv(buildGstReportCsv(report), reportFileName);
    } catch (err: any) {
      toast.error(err?.message || String(err));
    } finally {
      setExporting(false);
    }
  }, [report, reportFileName, exporting, t]);

  const handlePdf = useCallback(
    async (mode: "share" | "download") => {
      if (exporting) return;
      setExporting(true);
      try {
        const html = buildGstReportHTML(report);
        if (Platform.OS === "web") {
          await printHTML(html);
          return;
        }
        const filePath = await generateInvoicePDF(html, reportFileName);
        if (!filePath) throw new Error("PDF generation failed");
        if (mode === "share") {
          await sharePDF(filePath, t("gstReport.title") || "GST Report");
        } else {
          await downloadPDFToDevice(filePath, reportFileName);
        }
      } catch (err: any) {
        // A blocked pop-up is the web build's commonest print failure and the
        // only one the user can fix; its raw message is English-only, so it
        // gets the translated wording the bill screens use.
        toast.error(
          (err as any)?.name === 'PrintPopupBlockedError'
            ? t('printerChoice.popupBlockedBody')
            : err?.message || String(err),
        );
      } finally {
        setExporting(false);
      }
    },
    [report, reportFileName, exporting, t],
  );

  const DateField = ({
    label,
    value,
    onPress,
  }: {
    label: string;
    value: string;
    onPress: () => void;
  }) => (
    <Box flex={1}>
      <Text color="$coolGray500" fontSize={11} mb="$1">{label}</Text>
      <Pressable onPress={onPress}>
        <Box
          bg="$white"
          rounded="$xl"
          borderWidth={1}
          borderColor="$coolGray200"
          px="$3"
          style={{
            height: 44,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text fontSize="$sm" color="$coolGray900">{toDisplayDate(value)}</Text>
          <Icon as={Calendar} size="sm" color="#6B7280" />
        </Box>
      </Pressable>
    </Box>
  );

  return (
    <Box flex={1} bg="#F9FAFB">
      <CommonHeader
        variant="light"
        title={t("gstReport.title") || "GST Report"}
        subtitle={t("gstReport.headerSubtitle") || "CA-ready summary for filing"}
        showBack
        onPressBack={() => navigation.goBack()}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 120,
          ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}),
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Box p="$4" style={LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}}>
          {/* Period selection */}
          <HStack justifyContent="space-between" alignItems="center">
            <VStack flex={1} mr="$3">
              <Text fontWeight="$bold" fontSize="$xl" color="$coolGray900">
                {t("gstReport.periodTitle") || "Filing Period"}
              </Text>
              <Text color="$coolGray500" fontSize="$sm">
                {toDisplayDate(period.startDate)} – {toDisplayDate(period.endDate)}
              </Text>
            </VStack>
            <PeriodPicker
              value={preset}
              onChange={setPreset}
              options={presetOptions}
              selectLabel={t("gstReport.selectPeriod") || "Select period"}
            />
          </HStack>

          {preset === "custom" && (
            <HStack mt="$3" space="md">
              <DateField
                label={t("gstReport.from") || "From"}
                value={customFrom}
                onPress={() => setFromPickerOpen(true)}
              />
              <DateField
                label={t("gstReport.to") || "To"}
                value={customTo}
                onPress={() => setToPickerOpen(true)}
              />
            </HStack>
          )}
          {customRangeInvalid && (
            <Text color="$red500" fontSize="$xs" mt="$2">
              {t("gstReport.invalidRange") || "\"From\" date must be before \"To\" date"}
            </Text>
          )}

          {/* Net summary — the number the Dukandar cares about */}
          <Box
            mt="$5"
            rounded="$2xl"
            p="$5"
            borderWidth={1}
            borderColor="#6D5EF7"
            bg="#EEF2FF"
          >
            <HStack justifyContent="space-between" alignItems="center">
              <VStack flex={1}>
                <Text color="#4F46E5" fontSize="$sm" fontWeight="$medium">
                  {t("gstReport.netPayable") || "Net GST Payable"}
                </Text>
                <Text fontWeight="$black" fontSize={30} color="#312E81" mt="$1">
                  {money(net?.netPayable?.total)}
                </Text>
                <Text color="#6B7280" fontSize={11} mt="$1">
                  {(t("gstReport.netFormula") || "Output {output} − ITC {itc}")
                    .replace("{output}", money(net?.outputTax?.total))
                    .replace("{itc}", money(net?.itc?.total))}
                </Text>
              </VStack>
              <Center w={44} h={44} rounded="$full" bg="#6D5EF715">
                <Icon as={Landmark} size="md" color="#6D5EF7" />
              </Center>
            </HStack>
          </Box>

          {/* Export actions */}
          <HStack mt="$4" space="md">
            <Pressable flex={1} onPress={handleShareCsv} disabled={exporting}>
              <Box
                bg="#111827"
                rounded="$xl"
                py="$3"
                opacity={exporting ? 0.6 : 1}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <Icon as={FileSpreadsheet} size="sm" color="$white" />
                <Text color="$white" fontWeight="$bold" fontSize="$sm">
                  {t("gstReport.shareCsv") || "Share CSV"}
                </Text>
              </Box>
            </Pressable>
            <Pressable flex={1} onPress={() => handlePdf("share")} disabled={exporting}>
              <Box
                bg="#6D5EF7"
                rounded="$xl"
                py="$3"
                opacity={exporting ? 0.6 : 1}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <Icon as={Share2} size="sm" color="$white" />
                <Text color="$white" fontWeight="$bold" fontSize="$sm">
                  {t("gstReport.sharePdf") || "Share PDF"}
                </Text>
              </Box>
            </Pressable>
            {Platform.OS !== "web" && (
              <Pressable onPress={() => handlePdf("download")} disabled={exporting}>
                <Box
                  bg="$white"
                  rounded="$xl"
                  py="$3"
                  px="$3.5"
                  borderWidth={1}
                  borderColor="$coolGray200"
                  opacity={exporting ? 0.6 : 1}
                  style={{ alignItems: "center", justifyContent: "center" }}
                >
                  <Icon as={Download} size="sm" color="#111827" />
                </Box>
              </Pressable>
            )}
          </HStack>

          {/* Part A — outward */}
          <HStack mt="$6" mb="$2" alignItems="center" space="sm">
            <Icon as={ReceiptText} size="sm" color="#6D5EF7" />
            <Text fontWeight="$bold" fontSize="$md" color="$coolGray900">
              {t("gstReport.outwardTitle") || "Part A — Sales (Outward)"}
            </Text>
          </HStack>
          <Text color="$coolGray500" fontSize="$xs" mb="$2">
            {(t("gstReport.outwardMeta") || "{bills} bills • {b2b} B2B • {b2c} B2C")
              .replace("{bills}", String(os.billCount || 0))
              .replace("{b2b}", String(os.b2bCount || 0))
              .replace("{b2c}", String(os.b2cCount || 0))}
          </Text>
          <HStack space="sm" flexWrap="wrap" style={{ gap: 8 }}>
            <TaxChip
              label={t("gstReport.taxableValue") || "Taxable Value"}
              value={money(os.taxableValue)}
            />
            <TaxChip label="CGST" value={money(os.cgst)} />
            <TaxChip label="SGST" value={money(os.sgst)} />
            <TaxChip label="IGST" value={money(os.igst)} />
            <TaxChip
              label={t("gstReport.totalTax") || "Total Tax"}
              value={money(os.totalTax)}
            />
            <TaxChip
              label={t("gstReport.invoiceTotal") || "Invoice Total"}
              value={money(os.invoiceTotal)}
            />
          </HStack>

          {outwardRows.length === 0 ? (
            <Box mt="$3" bg="$white" p="$4" rounded="$2xl" borderWidth={1} borderColor="$coolGray100">
              <Text color="$coolGray500" fontSize="$sm" textAlign="center">
                {t("gstReport.noSales") || "No GST bills in this period"}
              </Text>
            </Box>
          ) : (
            <VStack mt="$3" space="sm">
              {outwardRows.map((r: any) => (
                <Box
                  key={r.invoiceId}
                  bg="$white"
                  rounded="$xl"
                  p="$3"
                  borderWidth={1}
                  borderColor="$coolGray100"
                >
                  <HStack justifyContent="space-between" alignItems="center">
                    <VStack flex={1} mr="$2">
                      <HStack alignItems="center" space="sm">
                        <Text fontWeight="$bold" fontSize="$sm" color="$coolGray900">
                          {r.invoiceNumber}
                          {r.legacyDerived ? " *" : ""}
                        </Text>
                        <Box
                          bg={r.billType === "B2B" ? "#DBEAFE" : "#F3F4F6"}
                          px="$1.5"
                          rounded="$full"
                        >
                          <Text
                            fontSize={9}
                            fontWeight="$bold"
                            color={r.billType === "B2B" ? "#1D4ED8" : "#6B7280"}
                          >
                            {r.billType}
                          </Text>
                        </Box>
                      </HStack>
                      <Text color="$coolGray500" fontSize={11} mt="$0.5">
                        {toDisplayDate(r.invoiceDate)}
                        {r.customerName ? ` • ${r.customerName}` : ""}
                      </Text>
                    </VStack>
                    <VStack alignItems="flex-end">
                      <Text fontWeight="$bold" fontSize="$sm" color="$coolGray900">
                        {money(r.invoiceTotal)}
                      </Text>
                      <Text color="$coolGray500" fontSize={10}>
                        {r.supplyType === "inter"
                          ? `IGST ${money(r.igst)}`
                          : `C+S ${money(r.cgst + r.sgst)}`}
                      </Text>
                    </VStack>
                  </HStack>
                </Box>
              ))}
            </VStack>
          )}

          {/* Part B — inward */}
          <HStack mt="$6" mb="$2" alignItems="center" space="sm">
            <Icon as={ShoppingCart} size="sm" color="#D946EF" />
            <Text fontWeight="$bold" fontSize="$md" color="$coolGray900">
              {t("gstReport.inwardTitle") || "Part B — Purchases (ITC)"}
            </Text>
          </HStack>
          <Text color="$coolGray500" fontSize="$xs" mb="$2">
            {(t("gstReport.inwardMeta") ||
              "{count} purchases • {reg} registered • {unreg} unregistered")
              .replace("{count}", String(is.purchaseCount || 0))
              .replace("{reg}", String(is.registeredCount || 0))
              .replace("{unreg}", String(is.unregisteredCount || 0))}
          </Text>
          <HStack space="sm" flexWrap="wrap" style={{ gap: 8 }}>
            <TaxChip
              label={t("gstReport.purchaseTaxable") || "Purchase Value"}
              value={money(is.taxableValue)}
            />
            <TaxChip
              label={t("gstReport.eligibleItc") || "Eligible ITC"}
              value={money(is.eligibleItc?.total)}
            />
          </HStack>

          {inwardRows.length === 0 ? (
            <Box mt="$3" bg="$white" p="$4" rounded="$2xl" borderWidth={1} borderColor="$coolGray100">
              <Text color="$coolGray500" fontSize="$sm" textAlign="center">
                {t("gstReport.noPurchases") || "No purchases recorded in this period"}
              </Text>
              <Pressable onPress={() => navigation.navigate("Purchases")} mt="$2">
                <Text color="#6D5EF7" fontWeight="$bold" fontSize="$sm" textAlign="center">
                  {t("gstReport.recordPurchases") || "Record purchases →"}
                </Text>
              </Pressable>
            </Box>
          ) : (
            <VStack mt="$3" space="sm">
              {inwardRows.map((r: any) => (
                <Box
                  key={r.purchaseId}
                  bg="$white"
                  rounded="$xl"
                  p="$3"
                  borderWidth={1}
                  borderColor="$coolGray100"
                  opacity={r.registered ? 1 : 0.6}
                >
                  <HStack justifyContent="space-between" alignItems="center">
                    <VStack flex={1} mr="$2">
                      <Text fontWeight="$bold" fontSize="$sm" color="$coolGray900">
                        {r.supplierName}
                      </Text>
                      <Text color="$coolGray500" fontSize={11} mt="$0.5">
                        {r.purchaseInvoiceNumber} • {toDisplayDate(r.purchaseDate)}
                        {!r.registered
                          ? ` • ${t("purchases.unregistered") || "Unregistered"}`
                          : ""}
                      </Text>
                    </VStack>
                    <VStack alignItems="flex-end">
                      <Text fontWeight="$bold" fontSize="$sm" color="$coolGray900">
                        {money(r.total)}
                      </Text>
                      <Text color="$coolGray500" fontSize={10}>
                        {r.supplyType === "inter"
                          ? `IGST ${money(r.igst)}`
                          : `C+S ${money(r.cgst + r.sgst)}`}
                      </Text>
                    </VStack>
                  </HStack>
                </Box>
              ))}
            </VStack>
          )}

          {(hasLegacy || (is.unregisteredCount || 0) > 0) && (
            <Text color="$coolGray400" fontSize={10} mt="$4" lineHeight={15}>
              {hasLegacy
                ? (t("gstReport.legacyNote") ||
                    "* GST split derived from invoice total (created before the CGST/SGST breakdown).") + "\n"
                : ""}
              {(is.unregisteredCount || 0) > 0
                ? t("gstReport.unregisteredNote") ||
                  "Unregistered purchases: ITC eligibility to be confirmed by your CA."
                : ""}
            </Text>
          )}
        </Box>
      </ScrollView>

      <DatePickerModal
        isOpen={fromPickerOpen}
        onClose={() => setFromPickerOpen(false)}
        date={customFrom}
        onSelect={(d: string) => {
          setCustomFrom(d);
          setFromPickerOpen(false);
        }}
      />
      <DatePickerModal
        isOpen={toPickerOpen}
        onClose={() => setToPickerOpen(false)}
        date={customTo}
        onSelect={(d: string) => {
          setCustomTo(d);
          setToPickerOpen(false);
        }}
      />
    </Box>
  );
};

export default GstReportScreen;
