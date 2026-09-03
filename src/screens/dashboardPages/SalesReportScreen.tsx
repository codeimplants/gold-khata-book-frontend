import React, { useMemo, useState, useCallback } from "react";
import {
  RefreshControl,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  View,
} from "react-native";
import {
  Box,
  HStack,
  Text,
  VStack,
  ScrollView,
  Center,
  Icon,
} from "@gluestack-ui/themed";
import { useNavigation } from "@react-navigation/native";
import { TrendingUp, Users, Package, Banknote, ChevronDown, Check } from "lucide-react-native";
import CommonHeader from "../../components/CommonHeader";
import { useAppSelector, useAppDispatch } from "../../store/hooks";
import { useTranslation } from "../../hooks/useTranslation";
import { fetchOrders, fetchSalesReport } from "../../store/data/dataSlice";
import { LAYOUT } from "../../constants/layout";
import { useSheetBottomInset } from "../../hooks/useSheetBottomInset";

type TimeRange = "Today" | "Week" | "Month" | "Year" | "Lifetime";

const SvgIcon = ({ name, color }: { name: any; color: string }) => (
  <Center w={40} h={40} rounded="$full" bg={`${color}15`}>
    <Icon as={name} size="md" color={color} />
  </Center>
);

const StatCard = ({ title, value, sub, icon, color }: any) => (
  <Box
    flex={1}
    bg="$white"
    rounded="$2xl"
    p="$4"
    borderWidth={1}
    borderColor="$coolGray100"
    style={{ minWidth: "48%", marginBottom: 12 }}
  >
    <HStack justifyContent="space-between" alignItems="flex-start" mb="$3">
      <SvgIcon name={icon} color={color} />
    </HStack>
    <Text color="$coolGray500" fontSize="$xs" fontWeight="$medium">
      {title}
    </Text>
    <Text fontWeight="$bold" fontSize="$xl" mt="$1" color="$coolGray900">
      {value}
    </Text>
    <Text color="$coolGray400" fontSize={11} mt="$1">
      {sub}
    </Text>
  </Box>
);

/* ─── Custom Bottom-Sheet Range Picker ─── */
const RangePicker = ({
  value,
  onChange,
  options,
  selectLabel,
}: {
  value: TimeRange;
  onChange: (v: TimeRange) => void;
  options: { label: string; value: TimeRange }[];
  selectLabel: string;
}) => {
  const [open, setOpen] = useState(false);
  const bottomInset = useSheetBottomInset(36);
  const label = options.find((o) => o.value === value)?.label ?? value;

  return (
    <>
      {/* Trigger button */}
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        style={rangeStyles.trigger}
      >
        <Text style={rangeStyles.triggerText}>{label}</Text>
        <Icon as={ChevronDown} size="sm" color="#D946EF" />
      </TouchableOpacity>

      {/* Full native Modal — slides from bottom, no glitchy jump */}
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={rangeStyles.overlay}>
            <TouchableWithoutFeedback>
              <View style={[rangeStyles.sheet, { paddingBottom: bottomInset }]}>
                <View style={rangeStyles.handle} />
                <Text style={rangeStyles.sheetTitle}>{selectLabel}</Text>
                {options.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={rangeStyles.option}
                    onPress={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        rangeStyles.optionText,
                        opt.value === value && rangeStyles.optionTextActive,
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

const rangeStyles = StyleSheet.create({
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
  triggerText: {
    color: "#9333EA",
    fontWeight: "700",
    fontSize: 13,
  },
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
  optionText: {
    fontSize: 15,
    color: "#374151",
  },
  optionTextActive: {
    color: "#6D5EF7",
    fontWeight: "700",
  },
});

/* ─── Main Screen ─── */
const SalesReportScreen = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const { orders, salesReport } = useAppSelector((state) => state.data);
  const { isGuest } = useAppSelector((s) => s.auth);
  const [range, setRange] = useState<TimeRange>("Month");
  const [refreshing, setRefreshing] = useState(false);
  const rangeOptions = useMemo<{ label: string; value: TimeRange }[]>(
    () => [
      { label: t("salesReport.range.today"), value: "Today" },
      { label: t("salesReport.range.week"), value: "Week" },
      { label: t("salesReport.range.month"), value: "Month" },
      { label: t("salesReport.range.year"), value: "Year" },
      { label: t("salesReport.range.lifetime"), value: "Lifetime" },
    ],
    [t]
  );
  const rangeLabel = rangeOptions.find((o) => o.value === range)?.label ?? range;

  React.useEffect(() => {
    if (isGuest) {
      dispatch(fetchOrders());
    } else {
      dispatch(fetchSalesReport(range));
    }
  }, [dispatch, range, isGuest]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (isGuest) {
      await dispatch(fetchOrders({ force: true }));
    } else {
      await dispatch(fetchSalesReport({ range, force: true }));
    }
    setRefreshing(false);
  }, [dispatch, range, isGuest]);

  const filteredOrders = useMemo(() => {
    if (range === "Lifetime") return orders;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return orders.filter((o) => {
      const orderDate = new Date(o.date);
      if (range === "Today") return orderDate >= startOfToday;
      if (range === "Week") {
        const lastWeek = new Date(now);
        lastWeek.setDate(now.getDate() - 7);
        return orderDate >= lastWeek;
      }
      if (range === "Month") {
        const lastMonth = new Date(now);
        lastMonth.setMonth(now.getMonth() - 1);
        return orderDate >= lastMonth;
      }
      if (range === "Year") {
        const lastYear = new Date(now);
        lastYear.setFullYear(now.getFullYear() - 1);
        return orderDate >= lastYear;
      }
      return true;
    });
  }, [orders, range]);

  const {
    totalSales,
    totalInvoices,
    uniqueCustomers,
    avgOrderValue,
    goldItems,
    silverItems,
  } = useMemo(() => {
    if (!isGuest && salesReport) {
      return {
        totalSales: salesReport.summary.totalSales,
        totalInvoices: salesReport.summary.totalInvoices,
        uniqueCustomers: salesReport.summary.uniqueCustomers,
        avgOrderValue: salesReport.summary.avgOrderValue,
        goldItems: salesReport.summary.goldItems,
        silverItems: salesReport.summary.silverItems,
      };
    }

    const totalSalesLocal = filteredOrders.reduce(
      (acc, curr) => acc + (curr.amount || 0),
      0,
    );
    const totalInvoicesLocal = filteredOrders.length;
    const uniqueCustomersLocal = new Set(
      filteredOrders.map(o => o.customerId),
    ).size;
    const avgOrderValueLocal =
      totalInvoicesLocal > 0
        ? Math.round(totalSalesLocal / totalInvoicesLocal)
        : 0;

    let goldItemsLocal = 0;
    let silverItemsLocal = 0;
    filteredOrders.forEach(o => {
      (o.items || []).forEach((item: any) => {
        if (item.metalType === "Gold" || item.itemType === "Gold") {
          goldItemsLocal += 1;
        } else if (item.metalType === "Silver" || item.itemType === "Silver") {
          silverItemsLocal += 1;
        }
      });
    });

    return {
      totalSales: totalSalesLocal,
      totalInvoices: totalInvoicesLocal,
      uniqueCustomers: uniqueCustomersLocal,
      avgOrderValue: avgOrderValueLocal,
      goldItems: goldItemsLocal,
      silverItems: silverItemsLocal,
    };
  }, [filteredOrders, isGuest, salesReport]);

  return (
    <Box flex={1} bg="#F9FAFB">
      <CommonHeader
        variant="light"
        title={t("salesReport.title")}
        subtitle={t("salesReport.headerSubtitle")}
        showBack
        onPressBack={() => navigation.goBack()}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 100,
          ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {})
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Box p="$4" style={LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}}>
          <HStack justifyContent="space-between" alignItems="center">
            <VStack>
              <Text fontWeight="$bold" fontSize="$xl" color="$coolGray900">{t("salesReport.analyticsTitle")}</Text>
              <Text color="$coolGray500" fontSize="$sm">{t("salesReport.analyticsSubtitle")}</Text>
            </VStack>
            <RangePicker
              value={range}
              onChange={setRange}
              options={rangeOptions}
              selectLabel={t("salesReport.range.selectPeriod")}
            />
          </HStack>

          {/* Master Highlight Card */}
          <Box
            mt="$5" rounded="$2xl" p="$5"
            borderWidth={1} borderColor="$coolGray200" bg="$white"
            shadowColor="#000" shadowOffset={{ width: 0, height: 2 }} shadowOpacity={0.06}
          >
            <HStack justifyContent="space-between" alignItems="center">
              <VStack>
                <Text color="$coolGray500" fontSize="$sm" fontWeight="$medium">{t("salesReport.summary.totalSalesVolume")}</Text>
                <Text fontWeight="$black" fontSize={32} color="$coolGray900" mt="$1">
                  ₹{totalSales.toLocaleString()}
                </Text>
              </VStack>
              <SvgIcon name={Banknote} color="#10B981" />
            </HStack>
            <Box h={1} bg="$coolGray100" my="$4" />
            <Text color="$coolGray500" fontSize="$xs">
              {t("salesReport.summary.generatedAcross").replace("{count}", totalInvoices.toString())}
            </Text>
          </Box>

          <HStack mt="$4" space="md" flexWrap="wrap" justifyContent="space-between">
            <StatCard
              title={t("salesReport.stats.itemsSold")}
              value={(goldItems + silverItems).toString()}
              sub={t("salesReport.stats.itemsSoldSub")
                .replace("{gold}", goldItems.toString())
                .replace("{silver}", silverItems.toString())}
              icon={Package}
              color="#F59E0B"
            />
            <StatCard
              title={t("salesReport.stats.customers")}
              value={uniqueCustomers.toString()}
              sub={t("salesReport.stats.customersSub")}
              icon={Users}
              color="#3B82F6"
            />
            <StatCard
              title={t("salesReport.stats.avgOrderValue")}
              value={`₹${avgOrderValue.toLocaleString()}`}
              sub={t("salesReport.stats.avgOrderValueSub")}
              icon={TrendingUp}
              color="#6366F1"
            />
            <StatCard
              title={t("salesReport.stats.period")}
              value={
                range === "Week"
                  ? t("salesReport.stats.periodValueWeek")
                  : range === "Month"
                    ? t("salesReport.stats.periodValueMonth")
                    : range === "Year"
                      ? t("salesReport.stats.periodValueYear")
                      : rangeLabel
              }
              sub={t("salesReport.stats.periodSub")}
              icon={Banknote}
              color="#D946EF"
            />
          </HStack>

          {totalInvoices === 0 && (
            <VStack mt="$10" alignItems="center" space="sm" bg="$white" p="$6" rounded="$2xl" borderWidth={1} borderColor="$coolGray100">
              <Text color="$coolGray300" fontSize={42}>📈</Text>
              <Text color="$coolGray600" fontWeight="$medium" fontSize="$md" mt="$2">{t("salesReport.empty.title")}</Text>
              <Text color="$coolGray400" fontSize="$sm" textAlign="center">
                {t("salesReport.empty.subtitle").replace("{range}", rangeLabel)}
              </Text>
            </VStack>
          )}
        </Box>
      </ScrollView>
    </Box>
  );
};

export default SalesReportScreen;
