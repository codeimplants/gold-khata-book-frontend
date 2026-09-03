import React, { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import {
  Box,
  HStack,
  Input,
  InputField,
  Pressable,
  ScrollView,
  Text,
  VStack,
  Icon,
  Center,
} from "@gluestack-ui/themed";
import {
  Alert,
  Platform,
  Switch as RNSwitch,
  KeyboardAvoidingView,
} from "react-native";
import CommonHeader from "../../components/CommonHeader";
import { HELP_TOPICS } from "../../tutorials/catalog";
import { Printer, Check, Bluetooth, ChevronRight, Settings } from "lucide-react-native";
import { useTranslation } from "../../hooks/useTranslation";
import { LAYOUT } from "../../constants/layout";
import { INPUT_LIMITS } from "../../constants/inputLimits";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { setPrintMode, setPaperPrefs } from "../../store/printPrefs/printPrefsSlice";
import {
  BILL_PAGE,
  DEFAULT_PAPER,
  MAX_CUSTOM_WIDTH_MM,
  PaperPosition,
  PaperPrefs,
} from "../../constants/bill";
import { printHTML } from "../../print/printService";
import { printErrorMessage } from "../../print/thermal";
import { buildPaperTestHTML } from "../../print/paperTestPage";

const Card = ({ children }: { children: React.ReactNode }) => (
  <Box
    bg="$white"
    rounded="$2xl"
    borderWidth={1}
    borderColor="$coolGray100"
    hardShadow="1"
    // Cards are plain siblings in the ScrollView, so the separation has to come
    // from here — they sat flush against each other otherwise.
    style={{ padding: 16, marginBottom: 16 }}
  >
    {children}
  </Box>
);

const PrintSettingsScreen = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const printMode = useAppSelector(s => s.printPrefs.mode);
  const thermalDevice = useAppSelector(s => s.printPrefs.device);

  // Seeded from what is saved, not from hardcoded A4. This card used to open on
  // "210 x 297, custom off" no matter what the shop had chosen, because nothing
  // was ever persisted — Save only called goBack().
  const savedPaper = useAppSelector(s => s.printPrefs.paper);
  const [useCustom, setUseCustom] = useState(savedPaper.mode === "custom");
  const [w, setW] = useState(String(savedPaper.widthMm));
  const [h, setH] = useState(String(savedPaper.heightMm));
  const [reserve, setReserve] = useState(String(savedPaper.headerReserveMm));
  const [position, setPosition] = useState<PaperPosition>(savedPaper.position);

  // The reserve applies in both modes — A4 letterhead is the common case — so it
  // is read outside the branch rather than only for a custom sheet.
  const draftPaper: PaperPrefs = useCustom
    ? {
        mode: "custom",
        widthMm: Number(w),
        heightMm: Number(h),
        headerReserveMm: Number(reserve) || 0,
        position,
      }
    : { ...DEFAULT_PAPER, headerReserveMm: Number(reserve) || 0 };

  // Checked before saving AND before the test print: an out-of-range value
  // produces a negative @page margin, which prints blank rather than wrong —
  // the hardest kind of failure for a shopkeeper to diagnose.
  const validationError: string | null = (() => {
    const res = Number(reserve) || 0;

    if (!useCustom) {
      // A4's height is the only bound that applies when there is no custom sheet.
      return res < 0 || res >= BILL_PAGE.HEIGHT_MM ? t("print.errReserve") : null;
    }

    const width = Number(w);
    const height = Number(h);
    // Letter-width, not A4-width — an ordinary home printer takes a 216mm sheet
    // and a shop using one should not be refused. See MAX_CUSTOM_WIDTH_MM.
    if (!(width > 0) || width > MAX_CUSTOM_WIDTH_MM) return t("print.errWidth");
    if (!(height > 0) || height > BILL_PAGE.HEIGHT_MM) return t("print.errHeight");
    if (res < 0 || res >= height) return t("print.errReserve");
    return null;
  })();

  /**
   * Whether the draft differs from what is stored.
   *
   * Only the page-size card is staged like this. The printer-type toggle above
   * dispatches on press and is already saved, so it deliberately does not count
   * as an unsaved change — greying Save out while that toggle sat on a fresh
   * value would suggest the choice had not taken effect.
   *
   * Dimensions are compared only in custom mode: switching back to A4 replaces
   * them with the defaults anyway, so a leftover "95" in the width box is not a
   * pending change.
   */
  const isDirty =
    draftPaper.mode !== savedPaper.mode ||
    draftPaper.headerReserveMm !== savedPaper.headerReserveMm ||
    (draftPaper.mode === "custom" &&
      (draftPaper.widthMm !== savedPaper.widthMm ||
        draftPaper.heightMm !== savedPaper.heightMm ||
        draftPaper.position !== savedPaper.position));

  const canSave = isDirty && !validationError;

  const positionLabel = (id: PaperPosition) =>
    id === "left" ? t("print.posLeft") : id === "right" ? t("print.posRight") : t("print.posCenter");

  const handleSave = () => {
    if (!canSave) return;
    dispatch(setPaperPrefs(draftPaper));
    navigation.goBack();
  };

  // Deliberately prints the DRAFT, not the saved value — the whole point is to
  // try a setting before committing the shop to it.
  const handleTestPrint = async () => {
    if (validationError) return;
    const summary = useCustom
      ? `${w} × ${h} mm  ·  ${positionLabel(position)}  ·  ${t(
          "print.headerReserveLabel",
        )}: ${Number(reserve) || 0}`
      : `A4 — ${BILL_PAGE.WIDTH_MM} × ${BILL_PAGE.HEIGHT_MM} mm`;

    // The one button in the app whose entire job is to prove printing works,
    // and it was the only print call site with no catch at all: a failure was
    // an unhandled rejection, so the button did nothing and said nothing —
    // which reads as "the test print is broken", i.e. the exact thing the
    // shopkeeper came here to rule out.
    try {
      await printHTML(
        buildPaperTestHTML(draftPaper, {
          title: t("print.testPrintBtn"),
          summary,
          hint: t("print.testPrintHint"),
        }),
      );
    } catch (err) {
      console.warn("[print] test page failed:", err);
      const { title, body } = printErrorMessage(err, t, "standard");
      Alert.alert(title, body);
    }
  };

  // Thermal printing needs Bluetooth/TCP and an off-screen raster capture, all
  // of which are webpack mocks in the web bundle — `usePrintBill` forces the A4
  // path there regardless of this setting. Offering the option anyway let a
  // shopkeeper pick Thermal, return to the bill, and still read
  // "Printing to: Regular printer (A4)" with nothing explaining why.
  const isWeb = Platform.OS === "web";

  const lightRowBorder = "#E5E7EB";
  const purple = "#6D5EF7";
  const tint = "#F1E9FF";

  return (
    <Box flex={1} bg="$coolGray50">
      <CommonHeader
        title={t("print.headerTitle")}
        subtitle={t("print.headerSubtitle")}
        variant="light"
        showBack
        onPressBack={() => navigation.goBack()}
        helpTopic={HELP_TOPICS.printSettings}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          flex={1}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 28,
            ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}),
          }}
        >
          {/* ---- Printer type card ---- */}
          <Card>
            <HStack alignItems="center" space="md">
              <Center rounded="$full" bg={purple} style={{ width: 54, height: 54 }}>
                <Icon as={Printer} size="xl" color="$white" />
              </Center>
              <VStack flex={1} style={{ gap: 2 }}>
                <Text fontWeight="$bold" color="$coolGray900" style={{ fontSize: 18, lineHeight: 22 }}>
                  {t("print.printerTypeTitle")}
                </Text>
                <Text color="$coolGray500" style={{ fontSize: 14, lineHeight: 18 }}>
                  {t("print.printerTypeSubtitle")}
                </Text>
              </VStack>
            </HStack>

            <HStack mt="$4" space="sm">
              <Pressable
                flex={1}
                onPress={() => dispatch(setPrintMode("standard"))}
                rounded="$xl"
                borderWidth={2}
                borderColor={printMode === "standard" ? purple : lightRowBorder}
                bg={printMode === "standard" ? tint : "$white"}
                alignItems="center"
                style={{ paddingVertical: 14 }}
              >
                <HStack space="xs" alignItems="center">
                  <Icon
                    as={Printer}
                    size="sm"
                    color={printMode === "standard" ? purple : "$coolGray700"}
                  />
                  <Text
                    fontWeight="$bold"
                    color={printMode === "standard" ? purple : "$coolGray700"}
                    style={{ fontSize: 14 }}
                  >
                    {t("print.standardOption")}
                  </Text>
                </HStack>
              </Pressable>
              <Pressable
                flex={1}
                disabled={isWeb}
                onPress={() => dispatch(setPrintMode("thermal"))}
                rounded="$xl"
                borderWidth={2}
                borderColor={printMode === "thermal" && !isWeb ? purple : lightRowBorder}
                bg={isWeb ? "$coolGray100" : printMode === "thermal" ? tint : "$white"}
                alignItems="center"
                style={{ paddingVertical: 14 }}
                opacity={isWeb ? 0.6 : 1}
              >
                <HStack space="xs" alignItems="center">
                  <Icon
                    as={Bluetooth}
                    size="sm"
                    color={
                      isWeb
                        ? "$coolGray400"
                        : printMode === "thermal"
                          ? purple
                          : "$coolGray700"
                    }
                  />
                  <Text
                    fontWeight="$bold"
                    color={
                      isWeb
                        ? "$coolGray400"
                        : printMode === "thermal"
                          ? purple
                          : "$coolGray700"
                    }
                    style={{ fontSize: 14 }}
                  >
                    {t("print.thermalOption")}
                  </Text>
                </HStack>
              </Pressable>
            </HStack>

            {isWeb ? (
              <Text mt="$3" color="$coolGray500" style={{ fontSize: 13, lineHeight: 18 }}>
                {t("print.thermalWebUnavailable")}
              </Text>
            ) : null}

            {printMode === "thermal" && !isWeb ? (
              <Pressable
                mt="$4"
                rounded="$2xl"
                borderWidth={1}
                borderColor={lightRowBorder}
                bg="$coolGray50"
                onPress={() => navigation.navigate("ThermalPrinterSetup" as never)}
                style={{ padding: 16 }}
              >
                <HStack alignItems="center" justifyContent="space-between">
                  <VStack style={{ gap: 2 }}>
                    <Text fontWeight="$bold" color="$coolGray900" style={{ fontSize: 15 }}>
                      {thermalDevice ? thermalDevice.name : t("print.noPrinterSelected")}
                    </Text>
                    <Text color="$coolGray500" style={{ fontSize: 13 }}>
                      {t("print.changePairPrinter")}
                    </Text>
                  </VStack>
                  <Icon as={ChevronRight} size="sm" color="$coolGray400" />
                </HStack>
              </Pressable>
            ) : null}
          </Card>

          {/* ---- Page size card ---- */}
          <Card>
            <HStack alignItems="center" space="md">
              <Center rounded="$full" bg={purple} style={{ width: 54, height: 54 }}>
                <Icon as={Settings} size="xl" color="$white" />
              </Center>
              <VStack flex={1} style={{ gap: 2 }}>
                <Text fontWeight="$bold" color="$coolGray900" style={{ fontSize: 18, lineHeight: 22 }}>
                  {t("print.configTitle")}
                </Text>
                <Text color="$coolGray500" style={{ fontSize: 14, lineHeight: 18 }}>
                  {t("print.configSubtitle")}
                </Text>
              </VStack>
            </HStack>

            <Box
              mt="$4"
              rounded="$2xl"
              borderWidth={1}
              borderColor={lightRowBorder}
              bg="$coolGray50"
              style={{ padding: 16 }}
            >
              <HStack alignItems="center" justifyContent="space-between">
                <VStack flex={1} style={{ gap: 6 }} pr="$3">
                  <Text fontWeight="$bold" color="$coolGray900" style={{ fontSize: 16, lineHeight: 20 }}>
                    {t("print.useCustomTitle")}
                  </Text>
                  <Text color="$coolGray500" style={{ fontSize: 14, lineHeight: 18 }}>
                    {useCustom ? t("print.customEnabled") : t("print.defaultInfo")}
                  </Text>
                </VStack>
                <RNSwitch
                  value={useCustom}
                  onValueChange={setUseCustom}
                  trackColor={{ false: "#E5E7EB", true: purple }}
                  thumbColor={"#FFFFFF"}
                  ios_backgroundColor="#E5E7EB"
                />
              </HStack>
            </Box>

            {!useCustom ? (
              <Box
                mt="$4"
                rounded="$2xl"
                borderWidth={1}
                borderColor="#BFE7E2"
                bg="#E9F7F4"
                style={{ padding: 16 }}
              >
                <HStack space="sm" alignItems="flex-start">
                  <Center style={{ width: 22, height: 22 }} rounded="$full" bg={tint}>
                    <Icon as={Check} size="sm" color={purple} />
                  </Center>
                  <VStack flex={1} style={{ gap: 6 }}>
                    <Text fontWeight="$bold" color="$coolGray900" style={{ fontSize: 16, lineHeight: 20 }}>
                      {t("print.defaultRecommendedTitle")}
                    </Text>
                    <Text color="$coolGray600" style={{ fontSize: 14, lineHeight: 18 }}>
                      {t("print.defaultRecommendedDesc")}
                    </Text>
                  </VStack>
                </HStack>
              </Box>
            ) : (
              <Box
                mt="$4"
                rounded="$2xl"
                borderWidth={1}
                borderColor={lightRowBorder}
                bg="$white"
                style={{ padding: 16 }}
              >
                <Text fontWeight="$bold" color="$coolGray900" style={{ fontSize: 16, lineHeight: 20 }}>
                  {t("print.customDimensionsTitle")}
                </Text>
                <HStack mt="$4" space="md">
                  <Box flex={1}>
                    <Text color="$coolGray700" style={{ fontSize: 14, lineHeight: 18 }}>
                      {t("print.widthLabel")}
                    </Text>
                    <Input
                      mt="$2"
                      bg="$coolGray50"
                      rounded="$xl"
                      borderWidth={1}
                      borderColor={lightRowBorder}
                      style={{ height: 50 }}
                    >
                      <InputField
                        keyboardType="numeric"
                        value={w}
                        onChangeText={setW}
                        maxLength={INPUT_LIMITS.quantity}
                        style={{ fontSize: 18 }}
                      />
                    </Input>
                  </Box>
                  <Box flex={1}>
                    <Text color="$coolGray700" style={{ fontSize: 14, lineHeight: 18 }}>
                      {t("print.heightLabel")}
                    </Text>
                    <Input
                      mt="$2"
                      bg="$coolGray50"
                      rounded="$xl"
                      borderWidth={1}
                      borderColor={lightRowBorder}
                      style={{ height: 50 }}
                    >
                      <InputField
                        keyboardType="numeric"
                        value={h}
                        onChangeText={setH}
                        maxLength={INPUT_LIMITS.quantity}
                        style={{ fontSize: 18 }}
                      />
                    </Input>
                  </Box>
                </HStack>
                <Text mt="$4" color="$coolGray500" style={{ fontSize: 13, lineHeight: 18 }}>
                  {t("print.sizeHint")}
                </Text>

                <Box mt="$5">
                  <Text fontWeight="$bold" color="$coolGray900" style={{ fontSize: 16, lineHeight: 20 }}>
                    {t("print.positionTitle")}
                  </Text>
                  <HStack mt="$3" space="sm">
                    {(["left", "center", "right"] as PaperPosition[]).map(id => {
                      const active = position === id;
                      return (
                        <Pressable
                          key={id}
                          flex={1}
                          onPress={() => setPosition(id)}
                          bg={active ? tint : "$coolGray50"}
                          borderWidth={active ? 2 : 1}
                          borderColor={active ? purple : lightRowBorder}
                          rounded="$xl"
                          alignItems="center"
                          justifyContent="center"
                          style={{ height: 52, paddingHorizontal: 6 }}
                        >
                          <Text
                            color={active ? purple : "$coolGray700"}
                            fontWeight={active ? "$bold" : "$normal"}
                            style={{ fontSize: 14, textAlign: "center" }}
                          >
                            {positionLabel(id)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </HStack>
                  <Text mt="$3" color="$coolGray500" style={{ fontSize: 13, lineHeight: 18 }}>
                    {t("print.positionHint")}
                  </Text>
                </Box>
              </Box>
            )}
          </Card>

          {/* ---- Header Space card ---- */}
          {/* A card of its own rather than a row inside the page-size one. The
              reserve is not a property of a custom sheet: most pre-printed
              letterhead is ordinary A4, and this field is also what unlocks the
              Pre-Printed Bill template on the Invoice/Bill Settings screen.
              Sitting directly under the custom-dimensions box it read as a
              setting the size toggle owned, which is exactly backwards. */}
          <Card>
            <Text fontWeight="$bold" color="$coolGray900" style={{ fontSize: 16, lineHeight: 20 }}>
              {t("print.headerReserveLabel")}
            </Text>
            <Input
              mt="$3"
              bg="$coolGray50"
              rounded="$xl"
              borderWidth={1}
              borderColor={lightRowBorder}
              style={{ height: 50 }}
            >
              <InputField
                keyboardType="numeric"
                value={reserve}
                onChangeText={setReserve}
                maxLength={INPUT_LIMITS.quantity}
                style={{ fontSize: 18 }}
              />
            </Input>
            <Text mt="$3" color="$coolGray500" style={{ fontSize: 13, lineHeight: 18 }}>
              {t("print.headerReserveHint")}
            </Text>
          </Card>

          {/* Below both cards rather than inside either one: the error, the test
              print and Save all cover the page size AND the header reserve, so
              they would misstate their scope nested in one card above the other. */}
          {validationError ? (
            <Text mb="$3" color="$red600" style={{ fontSize: 14, lineHeight: 18 }}>
              {validationError}
            </Text>
          ) : null}

          {/* Where the paper sits is a property of the printer's tray that no
              API exposes, so the only honest way to settle it is to print one
              and look. Offered above Save so it is tried before committing. */}
          <Pressable
            bg="$white"
            borderWidth={2}
            borderColor={purple}
            rounded="$xl"
            alignItems="center"
            justifyContent="center"
            opacity={validationError ? 0.5 : 1}
            disabled={Boolean(validationError)}
            style={{ height: 56 }}
            onPress={handleTestPrint}
          >
            <Text color={purple} fontWeight="$bold" style={{ fontSize: 18 }}>
              {t("print.testPrintBtn")}
            </Text>
          </Pressable>

          <Box
            mt="$4"
            rounded="$2xl"
            borderWidth={1}
            borderColor="#BFE7E2"
            bg="#E9F7F4"
            style={{ padding: 16 }}
          >
            <Text fontWeight="$bold" color="$coolGray900" style={{ fontSize: 15, lineHeight: 20 }}>
              {t("print.driverTipTitle")}
            </Text>
            <Text mt="$2" color="$coolGray600" style={{ fontSize: 13, lineHeight: 18 }}>
              {t("print.driverTipDesc")}
            </Text>
          </Box>

          <Pressable
            mt="$4"
            bg={canSave ? purple : "$coolGray200"}
            rounded="$xl"
            alignItems="center"
            justifyContent="center"
            disabled={!canSave}
            style={{ height: 56 }}
            onPress={handleSave}
          >
            <Text
              color={canSave ? "$white" : "$coolGray500"}
              fontWeight="$bold"
              style={{ fontSize: 20 }}
            >
              {t("print.saveBtn")}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Box>
  );
};

export default PrintSettingsScreen;
