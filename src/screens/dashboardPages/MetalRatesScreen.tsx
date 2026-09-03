import React, { useMemo, useState } from "react";
import {
  Box,
  HStack,
  Text,
  Pressable,
  ScrollView,
  Input,
  InputField,
  Center,
  Icon,
} from "@gluestack-ui/themed";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TrendingUp, Pencil, X, ArrowLeft } from "lucide-react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { Platform, RefreshControl } from "react-native";

import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchMetalRates, updateMetalRates, MetalRates } from "../../store/data/dataSlice";
import { useEffect } from "react";
import { useTranslation } from "../../hooks/useTranslation";
import { LAYOUT } from "../../constants/layout";
import { INPUT_LIMITS } from "../../constants/inputLimits";

const BORDER = "#E5E7EB";
const BG = "#F9FAFB";

const GradientTop = ({
  title,
  subtitle,
  colors,
}: {
  title: string;
  subtitle: string;
  colors: [string, string];
}) => {
  const gid = useMemo(() => `grad_${Math.random().toString(16).slice(2)}`, []);
  return (
    <Box style={{ height: 88, overflow: "hidden" }}>
      <Svg width="100%" height="100%" style={{ position: "absolute" }}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors[0]} stopOpacity="1" />
            <Stop offset="1" stopColor={colors[1]} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gid})`} />
      </Svg>

      <Box style={{ paddingHorizontal: 16, paddingTop: 18 }}>
        <HStack alignItems="center" space="sm">
          <TrendingUp size={18} color="#fff" />
          <Text color="$white" fontWeight="$bold" style={{ fontSize: 20, lineHeight: 24 }}>
            {title}
          </Text>
        </HStack>

        <Text color="rgba(255,255,255,0.85)" style={{ fontSize: 15, marginTop: 10 }}>
          {subtitle}
        </Text>
      </Box>
    </Box>
  );
};

const RightValueBox = ({
  value,
  editable,
  onChangeText,
}: {
  value: string;
  editable: boolean;
  onChangeText?: (v: string) => void;
}) => {
  if (!editable) {
    return (
      <Text fontWeight="$bold" color="$coolGray900" style={{ fontSize: 18, lineHeight: 30 }}>
        ₹{Number(value || 0).toLocaleString("en-IN")}
      </Text>
    );
  }

  return (
    <Box
      bg="#F9FAFB"
      borderWidth={1}
      borderColor={BORDER}
      rounded="$xl"
      style={{ width: 140, height: 44, paddingHorizontal: 12, justifyContent: "center" }}
    >
      <Input bg="transparent" borderWidth={0} p={0}>
        <InputField
          keyboardType="numeric"
          value={value}
          onChangeText={onChangeText}
          maxLength={INPUT_LIMITS.rate}
          style={{ fontSize: 18, textAlign: "right" }}
        />
      </Input>
    </Box>
  );
};

const RateRow = ({
  kTitle,
  kSub,
  value,
  editable,
  onChange,
  showDivider,
}: {
  kTitle: string;
  kSub: string;
  value: string;
  editable: boolean;
  onChange?: (v: string) => void;
  showDivider?: boolean;
}) => (
  <Box>
    <HStack alignItems="center" justifyContent="space-between" style={{ paddingVertical: 12 }}>
      <Box>
        <Text fontWeight="$bold" color="$coolGray900" style={{ fontSize: 16, lineHeight: 24 }}>
          {kTitle}
        </Text>
        <Text color="$coolGray500" style={{ fontSize: 15, marginTop: 6 }}>
          {kSub}
        </Text>
      </Box>

      <RightValueBox value={value} editable={editable} onChangeText={onChange} />
    </HStack>

    {showDivider ? <Box borderBottomWidth={1} borderBottomColor="#F3F4F6" /> : null}
  </Box>
);

const Header = ({
  title,
  subtitle,
  onBack,
  editMode,
  onEdit,
  onCancel,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  editMode: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) => {
  const insets = useSafeAreaInsets();

  return (
    <Box bg="$white" borderBottomWidth={1} borderBottomColor={BORDER}>
      <Box style={{ 
        paddingTop: insets.top + 8, 
        paddingBottom: 12, 
        paddingHorizontal: 16,
        ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {})
      }}>
        <HStack alignItems="center" justifyContent="space-between">
          {/* Left: back + titles */}
          <HStack alignItems="center" space="md" flex={1}>
            <Pressable onPress={onBack} p="$2" rounded="$lg">
              <ArrowLeft />
            </Pressable>

            <Box flex={1}>
              <Text fontWeight="$bold" color="$coolGray900" style={{ fontSize: 20 }}>
                {title}
              </Text>
              <Text color="$coolGray500" style={{ marginTop: 3 }}>
                {subtitle}
              </Text>
            </Box>
          </HStack>

          {/* Edit button commented out — rates are now live from the external API */}
          {/* <HStack alignItems="center" space="sm">
            {editMode ? (
              <Pressable
                onPress={onCancel}
                style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" }}
              >
                <Icon as={X} size="xl" color="$coolGray900" />
              </Pressable>
            ) : null}
            <Pressable
              onPress={onEdit}
              style={{
                height: 40, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1,
                borderColor: BORDER, backgroundColor: "#F9FAFB", flexDirection: "row",
                alignItems: "center", gap: 10,
              }}
            >
              <Icon as={Pencil} size="lg" color="$coolGray900" />
              <Text fontWeight="$bold" color="$coolGray900" style={{ fontSize: 16 }}>
                {editMode ? "Save" : "Edit"}
              </Text>
            </Pressable>
          </HStack> */}
        </HStack>
      </Box>
    </Box>
  );
};

const MetalRatesScreen = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const metalRates = useAppSelector(s => s.data.metalRates);
  const loading = useAppSelector(s => s.data.loading);
  const { t } = useTranslation();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchMetalRates({ force: true }));
    setRefreshing(false);
  }, [dispatch]);

  // saved values
  const [rates, setRates] = useState<MetalRates>({
    gold: {
      goldPrice24K995GW: 0,
      goldPrice22K: 0,
      goldPrice18K: 0,
      goldPrice14K: 0,
    },
    silver: {
      silverPrice: 0,
      silverBarPrice: 0,
    },
  });

  useEffect(() => {
    dispatch(fetchMetalRates());
  }, []);

  useEffect(() => {
    if (metalRates) {
      setRates(metalRates);
    }
  }, [metalRates]);

  return (
    <Box flex={1} bg={BG}>
      <Header
        title={t("metalRates.title") || "Metal Rates"}
        subtitle={t("metalRates.subtitle") || "Today's prices"}
        onBack={() => navigation.goBack()}
        editMode={false}
        onEdit={() => { }}
        onCancel={() => { }}
      />

      <ScrollView
        flex={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ 
          padding: 16, 
          paddingBottom: 100, 
          marginBottom: 24,
          ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {})
        }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Gold card */}
        <Box bg="$white" rounded="$2xl" borderWidth={1} borderColor={BORDER} hardShadow="1" overflow="hidden">
          <GradientTop title={t("metalRates.gold.title") || "Gold Rates"} subtitle={t("metalRates.pricePerGram") || "Price per gram"} colors={["#F59E0B", "#D97706"]} />

          <Box style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 }}>
            <RateRow
              kTitle={t("metals.purity.gold24k995gw") || "24K - 99.5%"}
              kSub={t("metalRates.gold.guaranteedWeight") || "Guaranteed Weight"}
              value={String(rates.gold.goldPrice24K995GW)}
              editable={false}
              showDivider
            />
            <RateRow
              kTitle={t("metals.purity.gold22k") || "22K - 91.6%"}
              kSub={t("metalRates.gold.ornament") || "Ornament Gold"}
              value={String(rates.gold.goldPrice22K)}
              editable={false}
              showDivider
            />
            <RateRow
              kTitle={t("metals.purity.gold18k") || "18K - 75.01%"}
              kSub={t("metalRates.gold.jewelry") || "Jewelry Gold"}
              value={String(rates.gold.goldPrice18K)}
              editable={false}
              showDivider
            />
            <RateRow
              kTitle={t("metals.purity.gold14k") || "14K - 58.3%"}
              kSub={t("metalRates.gold.lowPurity") || "Low Purity Gold"}
              value={String(rates.gold.goldPrice14K)}
              editable={false}
            />
          </Box>
        </Box>

        {/* Silver card */}
        <Box mt="$4" bg="$white" rounded="$2xl" borderWidth={1} borderColor={BORDER} hardShadow="1" overflow="hidden">
          <GradientTop title={t("metalRates.silver.title") || "Silver Rate"} subtitle={t("metalRates.pricePerGram") || "Price per gram"} colors={["#9CA3AF", "#6B7280"]} />
          <Box style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 }}>
            <RateRow
              kTitle={t("metals.purity.silver") || "Silver"}
              kSub={t("metals.purity.silver") || "Silver"}
              value={String(rates.silver.silverPrice)}
              editable={false}
              showDivider
            />
            <RateRow
              kTitle={t("metals.purity.silver") || "Silver"}
              kSub={t("metals.purity.silverCoin") || "Silver Coin"}
              value={String(rates.silver.silverBarPrice)}
              editable={false}
            />
          </Box>
        </Box>

        <Text mt="$5" color="$coolGray500" textAlign="center" style={{ fontSize: 14 }}>
          {t("metalRates.liveRatesNote") || "Live rates · updated just now"}
        </Text>
      </ScrollView>
    </Box>
  );
};

export default MetalRatesScreen;
