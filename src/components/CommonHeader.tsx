// src/components/CommonHeader.tsx
import React from "react";
import { StyleSheet } from "react-native";
import { Box, HStack, Icon, Pressable, Text, VStack } from "@gluestack-ui/themed";
import { Diamond, Globe, Menu, ArrowLeft, X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg";
import { LAYOUT } from "../constants/layout";
import { BannerHeightContext } from "../navigation/MainTabs";
import HelpIconButton from "./common/HelpIconButton";
import { useHasTutorialsForTopic } from "../hooks/useHasTutorialsForTopic";

type Props = {
  title?: string;
  subtitle?: string;

  onPressMenu?: () => void;
  onPressBack?: () => void;
  showMenu?: boolean;
  showBack?: boolean;
  onPressRight?: () => void;
  onPressClose?: () => void;

  /**
   * A HELP_TOPICS value (src/tutorials/catalog.ts). Renders a "?" that opens the
   * tutorials filtered to this screen.
   *
   * This is the entry point that actually reaches confused users: the Settings
   * menu is opt-in, and someone stuck mid-invoice does not go looking for it —
   * they phone support. The icon hides itself when no tutorial covers the topic,
   * so a screen can declare one before the video exists.
   */
  helpTopic?: string;

  variant?: "purple" | "light";
};

const CommonHeader: React.FC<Props> = ({
  title = "Jewellery Bill",
  subtitle,
  onPressMenu,
  onPressBack,
  showMenu,
  showBack,
  onPressRight,
  onPressClose,
  helpTopic,
  variant = "purple",
}) => {
  const isLight = variant === "light";
  const bannerHeight = React.useContext(BannerHeightContext);

  // Asked here as well as inside HelpIconButton because the right-hand slot needs
  // a spacer when nothing occupies it, and a component returning null is still a
  // truthy element — the layout cannot be decided from the element alone.
  const hasHelp = useHasTutorialsForTopic(helpTopic);
  const helpButton = hasHelp ? (
    <HelpIconButton topic={helpTopic} color={isLight ? "$coolGray500" : "$white"} />
  ) : null;
  // When the impersonation banner is active the Tab.Navigator frame already
  // starts below it, so SafeAreaView must NOT add extra top padding here.
  const safeEdges = (bannerHeight > 0
    ? ['left', 'right']
    : ['top', 'left', 'right']) as ('top' | 'left' | 'right')[];

  // ✅ LIGHT header matches SS (back arrow + title + subtitle under it)
  if (isLight) {
    return (
      <Box bg="$white" borderBottomWidth={1} borderBottomColor="$coolGray200" zIndex={30}>
        <SafeAreaView edges={safeEdges} style={styles.safeArea}>
          <HStack px="$4" py="$3" alignItems="center" space="md" style={LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}}>
            {showBack ? (
              <Pressable onPress={onPressBack} p="$2" rounded="$full">
                <Icon as={ArrowLeft} size="xl" color="$coolGray800" />
              </Pressable>
            ) : showMenu ? (
              <Pressable onPress={onPressMenu} p="$2" rounded="$full">
                <Icon as={Menu} size="xl" color="$coolGray800" />
              </Pressable>
            ) : (
              <Box w="$10" />
            )}

            <VStack flex={1} space="xs">
              <Text fontSize="$lg" fontWeight="$bold" color="$coolGray900">
                {title}
              </Text>
              {!!subtitle && (
                <Text fontSize="$sm" color="$coolGray500">
                  {subtitle}
                </Text>
              )}
            </VStack>

            {hasHelp || onPressClose ? (
              <HStack alignItems="center">
                {helpButton}
                {!!onPressClose && (
                  <Pressable onPress={onPressClose} p="$2" rounded="$full">
                    <Icon as={X} size="xl" color="$coolGray500" />
                  </Pressable>
                )}
              </HStack>
            ) : (
              <Box w="$10" />
            )}
          </HStack>
        </SafeAreaView>
      </Box>
    );
  }

  // ✅ PURPLE variant (keep as your existing style)
  return (
    <Box hardShadow="4" zIndex={30} bg="$purple900">
      <SafeAreaView edges={safeEdges} style={styles.safeArea}>
        <HStack px="$4" py="$3" alignItems="center" justifyContent="space-between" w="100%" style={LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}}>
          <HStack alignItems="center" space="sm">
            {showBack ? (
              <Pressable onPress={onPressBack} p="$2" rounded="$full">
                <Icon as={ArrowLeft} size="xl" color="$white" />
              </Pressable>
            ) : showMenu ? (
              <Pressable onPress={onPressMenu} p="$2" rounded="$full">
                <Icon as={Menu} size="xl" color="$white" />
              </Pressable>
            ) : (
              <Box w="$10" h="$10" bg="$white" rounded="$full" alignItems="center" justifyContent="center">
                <Icon as={Diamond} size="xl" color="#6b21a8" />
              </Box>
            )}
          </HStack>

          <Box alignItems="center" flex={1}>
            <Svg height="40" width="240">
              <Defs>
                <LinearGradient id="textGrad" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#fcd34d" stopOpacity="1" />
                  <Stop offset="0.5" stopColor="#facc15" stopOpacity="1" />
                  <Stop offset="1" stopColor="#f59e0b" stopOpacity="1" />
                </LinearGradient>
              </Defs>
              <SvgText
                fill="url(#textGrad)"
                fontSize="18"
                fontWeight="bold"
                x="120"
                y="25"
                textAnchor="middle"
              >
                {title}
              </SvgText>
            </Svg>
          </Box>

          <HStack alignItems="center">
            {helpButton}
            <Pressable p="$2" rounded="$full" onPress={onPressRight}>
              <Icon as={Globe} size="xl" color="$white" />
            </Pressable>
          </HStack>
        </HStack>
      </SafeAreaView>
    </Box>
  );
};

const styles = StyleSheet.create({
  safeArea: { overflow: "hidden" },
});

export default CommonHeader;
