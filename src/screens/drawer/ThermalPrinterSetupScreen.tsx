import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import {
  Box,
  HStack,
  Pressable,
  ScrollView,
  Text,
  VStack,
  Icon,
  Center,
  Spinner,
  Input,
  InputField,
} from "@gluestack-ui/themed";
import { Alert, KeyboardAvoidingView, Platform } from "react-native";
import CommonHeader from "../../components/CommonHeader";
import { Printer, Bluetooth, Check, Wifi, RefreshCw } from "lucide-react-native";
import { useTranslation } from "../../hooks/useTranslation";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { setThermalDevice } from "../../store/printPrefs/printPrefsSlice";
import {
  requestBlePermissions,
  startScan,
  connectAndDiscoverPrinter,
  ScanResultDevice,
  ScanFailureReason,
} from "../../print/thermal/bleTransport";
import {
  getBondedDevices,
  makeSppPrinter,
  sppTransport,
  BondedDevice,
} from "../../print/thermal/sppTransport";
import {
  probePrinter,
  makeTcpPrinter,
  DEFAULT_PRINTER_PORT,
} from "../../print/thermal/tcpTransport";
import { ensureBluetoothEnabled } from "../../print/thermal/bluetoothEnable";
import { sendToPrinter } from "../../print/thermal";
import { SavedPrinter } from "../../print/thermal/transport";
import * as escpos from "../../print/thermal/escpos";
import { LAYOUT } from "../../constants/layout";

const PURPLE = "#6D5EF7";
const ROW_BORDER = "#E5E7EB";

const buildTestPrintBytes = (): number[] =>
  escpos.concat(
    escpos.init(),
    escpos.setAlign("center"),
    escpos.setBold(true),
    escpos.textLine("Gold Khata Book"),
    escpos.setBold(false),
    escpos.textLine("Test Print"),
    escpos.divider(),
    escpos.setAlign("left"),
    escpos.textLine("Printer connected successfully."),
    escpos.textLine("Your bills will look like this."),
    escpos.cut()
  );

/** One row in the merged printer list. `kind` is internal only — the UI deliberately
 * never says "BLE" or "Classic", since a shopkeeper has no reason to know or care
 * which flavour of Bluetooth their printer speaks. */
type Candidate = { key: string; name: string; make: () => Promise<SavedPrinter> };

const ThermalPrinterSetupScreen = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const savedDevice = useAppSelector(s => s.printPrefs.device);

  const [scanning, setScanning] = useState(false);
  const [bleDevices, setBleDevices] = useState<ScanResultDevice[]>([]);
  const [bondedDevices, setBondedDevices] = useState<BondedDevice[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [testPrinting, setTestPrinting] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [host, setHost] = useState("");
  const [port, setPort] = useState(String(DEFAULT_PRINTER_PORT));
  const stopScanRef = useRef<(() => void) | null>(null);

  const stopScanning = useCallback(() => {
    stopScanRef.current?.();
    stopScanRef.current = null;
    setScanning(false);
  }, []);

  const scanFailureMessage = useCallback(
    (reason: ScanFailureReason): string => {
      switch (reason) {
        case "bluetooth-off":
          return t("thermalPrinter.bluetoothOff");
        case "permission":
          return t("thermalPrinter.permissionDenied");
        default:
          return t("thermalPrinter.connectFailedBody");
      }
    },
    [t]
  );

  const beginScan = useCallback(async () => {
    setScanError(null);
    setBleDevices([]);
    const ok = await requestBlePermissions();
    if (!ok) {
      setScanError(t("thermalPrinter.permissionDenied"));
      return;
    }

    // Android only, and a no-op when Bluetooth is already on. iOS raises its own
    // power alert during the scan, so both platforms end up offering the same thing
    // instead of Android silently failing with "Bluetooth is switched off".
    await ensureBluetoothEnabled();

    // Classic printers are bonded in Android's Bluetooth settings rather than
    // discovered here, so they are fetched once rather than streamed in.
    if (sppTransport.isSupported()) {
      try {
        setBondedDevices(await getBondedDevices());
      } catch {
        // Bluetooth off or permission refused — the BLE scan below reports it.
      }
    }

    setScanning(true);
    stopScanRef.current = startScan(
      device =>
        setBleDevices(prev => (prev.some(d => d.id === device.id) ? prev : [...prev, device])),
      reason => {
        setScanError(scanFailureMessage(reason));
        stopScanning();
      }
    );
  }, [stopScanning, t, scanFailureMessage]);

  useFocusEffect(
    useCallback(() => {
      beginScan();
      return () => stopScanning();
    }, [beginScan, stopScanning])
  );

  const save = async (printer: SavedPrinter) => {
    dispatch(setThermalDevice(printer));
    Alert.alert(t("thermalPrinter.connectedTitle"), t("thermalPrinter.connectedBody"));
  };

  const handlePick = async (candidate: Candidate) => {
    stopScanning();
    setBusyKey(candidate.key);
    try {
      await save(await candidate.make());
    } catch {
      Alert.alert(t("thermalPrinter.connectFailedTitle"), t("thermalPrinter.connectFailedBody"));
    } finally {
      setBusyKey(null);
    }
  };

  const handleAddWifi = async () => {
    const trimmedHost = host.trim();
    const parsedPort = Number(port.trim()) || DEFAULT_PRINTER_PORT;
    if (!trimmedHost) return;

    setBusyKey("wifi");
    try {
      const reachable = await probePrinter(trimmedHost, parsedPort);
      if (!reachable) {
        Alert.alert(t("thermalPrinter.connectFailedTitle"), t("thermalPrinter.wifiUnreachable"));
        return;
      }
      await save(makeTcpPrinter(trimmedHost, parsedPort));
    } finally {
      setBusyKey(null);
    }
  };

  const handleTestPrint = async () => {
    if (!savedDevice) return;
    setTestPrinting(true);
    try {
      await sendToPrinter(savedDevice, buildTestPrintBytes());
    } catch {
      Alert.alert(
        t("thermalPrinter.testPrintFailedTitle"),
        t("thermalPrinter.testPrintFailedBody")
      );
    } finally {
      setTestPrinting(false);
    }
  };

  // BLE results and OS-bonded classic devices merged into one list, de-duplicated by
  // name so a dual-mode printer (the Veer advertises both) appears once.
  const candidates: Candidate[] = [
    ...bleDevices.map(d => ({
      key: `ble:${d.id}`,
      name: d.name,
      make: () => connectAndDiscoverPrinter(d.id) as Promise<SavedPrinter>,
    })),
    ...bondedDevices
      .filter(b => !bleDevices.some(d => d.name === b.name))
      .map(b => ({
        key: `spp:${b.id}`,
        name: b.name,
        make: async () => makeSppPrinter(b),
      })),
  ];

  return (
    <Box flex={1} bg="$coolGray50">
      <CommonHeader
        title={t("thermalPrinter.headerTitle")}
        subtitle={t("thermalPrinter.headerSubtitle")}
        variant="light"
        showBack
        onPressBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          flex={1}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 28, ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}) }}
        >
          {savedDevice ? (
            <Box
              bg="$white"
              rounded="$2xl"
              borderWidth={1}
              borderColor="#BFE7E2"
              style={{ padding: 16, marginBottom: 16 }}
            >
              <HStack alignItems="center" space="md">
                <Center rounded="$full" bg="#E9F7F4" style={{ width: 44, height: 44 }}>
                  <Icon as={Check} size="lg" color="#1F9D82" />
                </Center>
                <VStack flex={1} style={{ gap: 2 }}>
                  <Text fontWeight="$bold" color="$coolGray900">
                    {savedDevice.name}
                  </Text>
                  <Text color="$coolGray500" style={{ fontSize: 13 }}>
                    {t("thermalPrinter.currentlySelected")}
                  </Text>
                </VStack>
              </HStack>
              <Pressable
                mt="$4"
                bg={PURPLE}
                rounded="$xl"
                alignItems="center"
                justifyContent="center"
                style={{ height: 48 }}
                disabled={testPrinting}
                onPress={handleTestPrint}
              >
                {testPrinting ? (
                  <Spinner color="$white" />
                ) : (
                  <Text color="$white" fontWeight="$bold">
                    {t("thermalPrinter.sendTestPrint")}
                  </Text>
                )}
              </Pressable>
            </Box>
          ) : null}

          {/* Bluetooth printers */}
          <Box
            bg="$white"
            rounded="$2xl"
            borderWidth={1}
            borderColor="$coolGray100"
            style={{ padding: 16 }}
          >
            <HStack alignItems="center" justifyContent="space-between" mb="$3">
              <HStack alignItems="center" space="sm">
                <Icon as={Bluetooth} size="md" color={PURPLE} />
                <Text fontWeight="$bold" color="$coolGray900">
                  {t("thermalPrinter.nearbyDevices")}
                </Text>
              </HStack>

              {/* The scan only starts on screen focus, so without this a printer
                  switched on *after* arriving here could never be found without
                  leaving and returning. */}
              {scanning ? (
                <Spinner size="small" color={PURPLE} />
              ) : (
                <Pressable
                  onPress={beginScan}
                  hitSlop={12}
                  accessibilityLabel={t("thermalPrinter.refresh")}
                >
                  <HStack alignItems="center" space="xs">
                    <Icon as={RefreshCw} size="sm" color={PURPLE} />
                    <Text color={PURPLE} fontWeight="$bold" style={{ fontSize: 13 }}>
                      {t("thermalPrinter.refresh")}
                    </Text>
                  </HStack>
                </Pressable>
              )}
            </HStack>

            {scanError ? (
              <Text color="$error600" style={{ fontSize: 13, marginBottom: 8 }}>
                {scanError}
              </Text>
            ) : null}

            {candidates.length === 0 && !scanError ? (
              <Text color="$coolGray500" style={{ fontSize: 14 }}>
                {t("thermalPrinter.scanning")}
              </Text>
            ) : null}

            {candidates.map(candidate => (
              <Pressable
                key={candidate.key}
                onPress={() => handlePick(candidate)}
                disabled={busyKey !== null}
                borderWidth={1}
                borderColor={ROW_BORDER}
                rounded="$xl"
                style={{ padding: 14, marginTop: 10 }}
              >
                <HStack alignItems="center" justifyContent="space-between">
                  <HStack alignItems="center" space="sm" flex={1}>
                    <Icon as={Printer} size="sm" color="$coolGray600" />
                    <Text color="$coolGray900">{candidate.name}</Text>
                  </HStack>
                  {busyKey === candidate.key ? (
                    <Spinner size="small" color={PURPLE} />
                  ) : (
                    <Text color={PURPLE} fontWeight="$bold" style={{ fontSize: 13 }}>
                      {t("thermalPrinter.connect")}
                    </Text>
                  )}
                </HStack>
              </Pressable>
            ))}

            {Platform.OS === "ios" ? (
              <Text color="$coolGray500" style={{ fontSize: 12, marginTop: 12 }}>
                {t("thermalPrinter.iosBluetoothNote")}
              </Text>
            ) : (
              <Text color="$coolGray500" style={{ fontSize: 12, marginTop: 12 }}>
                {t("thermalPrinter.pairInSettingsHint")}
              </Text>
            )}
          </Box>

          {/* WiFi printer */}
          <Box
            bg="$white"
            rounded="$2xl"
            borderWidth={1}
            borderColor="$coolGray100"
            style={{ padding: 16, marginTop: 16 }}
          >
            <HStack alignItems="center" space="sm" mb="$1">
              <Icon as={Wifi} size="md" color={PURPLE} />
              <Text fontWeight="$bold" color="$coolGray900">
                {t("thermalPrinter.wifiTitle")}
              </Text>
            </HStack>
            <Text color="$coolGray500" style={{ fontSize: 13, marginBottom: 12 }}>
              {t("thermalPrinter.wifiSubtitle")}
            </Text>

            <HStack space="md">
              <Box flex={2}>
                <Text color="$coolGray700" style={{ fontSize: 13 }}>
                  {t("thermalPrinter.wifiIpLabel")}
                </Text>
                <Input
                  mt="$1"
                  bg="$coolGray50"
                  rounded="$xl"
                  borderWidth={1}
                  borderColor={ROW_BORDER}
                  style={{ height: 48 }}
                >
                  <InputField
                    keyboardType="numbers-and-punctuation"
                    placeholder="192.168.1.50"
                    value={host}
                    onChangeText={setHost}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </Input>
              </Box>
              <Box flex={1}>
                <Text color="$coolGray700" style={{ fontSize: 13 }}>
                  {t("thermalPrinter.wifiPortLabel")}
                </Text>
                <Input
                  mt="$1"
                  bg="$coolGray50"
                  rounded="$xl"
                  borderWidth={1}
                  borderColor={ROW_BORDER}
                  style={{ height: 48 }}
                >
                  <InputField
                    keyboardType="number-pad"
                    value={port}
                    onChangeText={setPort}
                  />
                </Input>
              </Box>
            </HStack>

            <Pressable
              mt="$4"
              bg={host.trim() ? PURPLE : "$coolGray300"}
              rounded="$xl"
              alignItems="center"
              justifyContent="center"
              style={{ height: 48 }}
              disabled={!host.trim() || busyKey !== null}
              onPress={handleAddWifi}
            >
              {busyKey === "wifi" ? (
                <Spinner color="$white" />
              ) : (
                <Text color="$white" fontWeight="$bold">
                  {t("thermalPrinter.wifiConnect")}
                </Text>
              )}
            </Pressable>
          </Box>
        </ScrollView>
      </KeyboardAvoidingView>
    </Box>
  );
};

export default ThermalPrinterSetupScreen;
