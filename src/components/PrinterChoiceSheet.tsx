import React from "react";
import { Modal, Pressable as RNPressable } from "react-native";
import { Box, HStack, VStack, Text, Icon, Center, Pressable } from "@gluestack-ui/themed";
import { Printer, Receipt, ChevronRight, X } from "lucide-react-native";
import { useTranslation } from "../hooks/useTranslation";
import { LAYOUT } from "../constants/layout";
import { useSheetBottomInset } from "../hooks/useSheetBottomInset";

const PURPLE = "#6D5EF7";
const ROW_BORDER = "#E5E7EB";

type Props = {
  visible: boolean;
  /** Shown as the title when the user is switching rather than choosing for the
   * first time — the question is the same, the framing differs. */
  isChanging?: boolean;
  onChooseStandard: () => void;
  onChooseThermal: () => void;
  onClose: () => void;
};

/**
 * Asks how the shop prints bills. Shown once, the first time Print is tapped — which
 * is both the moment the question is relevant and the only realistic way a user
 * discovers thermal printing exists (Print Settings is otherwise unvisited). Reused
 * for the "Change" affordance so there is one chooser rather than two.
 */
const PrinterChoiceSheet = ({
  visible,
  isChanging = false,
  onChooseStandard,
  onChooseThermal,
  onClose,
}: Props) => {
  const { t } = useTranslation();
  const bottomInset = useSheetBottomInset(32);

  const Option = ({
    icon,
    title,
    subtitle,
    onPress,
  }: {
    icon: any;
    title: string;
    subtitle: string;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      borderWidth={1}
      borderColor={ROW_BORDER}
      rounded="$2xl"
      bg="$white"
      style={{ padding: 16, marginTop: 12 }}
    >
      <HStack alignItems="center" space="md">
        <Center rounded="$full" bg="#F1E9FF" style={{ width: 48, height: 48 }}>
          <Icon as={icon} size="xl" color={PURPLE} />
        </Center>
        <VStack flex={1} style={{ gap: 2 }}>
          <Text fontWeight="$bold" color="$coolGray900" style={{ fontSize: 16 }}>
            {title}
          </Text>
          <Text color="$coolGray500" style={{ fontSize: 13, lineHeight: 18 }}>
            {subtitle}
          </Text>
        </VStack>
        <Icon as={ChevronRight} size="sm" color="$coolGray400" />
      </HStack>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Box flex={1} justifyContent="flex-end" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
        {/* Tapping the dimmed area dismisses, matching the platform expectation for
            a bottom sheet. */}
        <RNPressable style={{ flex: 1 }} onPress={onClose} />

        <Box
          bg="$coolGray50"
          style={{
            padding: 20,
            paddingBottom: bottomInset,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            ...LAYOUT.sheetSurfaceStyle,
          }}
        >
          <HStack alignItems="center" justifyContent="space-between">
            <VStack flex={1} style={{ gap: 2 }} pr="$3">
              <Text fontWeight="$bold" color="$coolGray900" style={{ fontSize: 20 }}>
                {isChanging ? t("printerChoice.changeTitle") : t("printerChoice.title")}
              </Text>
              <Text color="$coolGray500" style={{ fontSize: 14, lineHeight: 19 }}>
                {t("printerChoice.subtitle")}
              </Text>
            </VStack>
            <Pressable onPress={onClose} hitSlop={12}>
              <Icon as={X} size="lg" color="$coolGray400" />
            </Pressable>
          </HStack>

          <Option
            icon={Printer}
            title={t("printerChoice.standardTitle")}
            subtitle={t("printerChoice.standardSubtitle")}
            onPress={onChooseStandard}
          />
          <Option
            icon={Receipt}
            title={t("printerChoice.thermalTitle")}
            subtitle={t("printerChoice.thermalSubtitle")}
            onPress={onChooseThermal}
          />

          <Text color="$coolGray400" style={{ fontSize: 12, marginTop: 16, textAlign: "center" }}>
            {t("printerChoice.changeLaterHint")}
          </Text>
        </Box>
      </Box>
    </Modal>
  );
};

export default PrinterChoiceSheet;
