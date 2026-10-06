// src/components/CommonHeader.tsx
import React from "react";
import { StyleSheet } from "react-native";
import { Box, HStack, Icon, Pressable, Text, VStack } from "@gluestack-ui/themed";
import { Menu, ArrowLeft, X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LAYOUT } from "../constants/layout";
import { BannerHeightContext } from "../navigation/MainTabs";
import HelpIconButton from "./common/HelpIconButton";
import { useHasTutorialsForTopic } from "../hooks/useHasTutorialsForTopic";
import { Brand } from "../theme/brand";

type Props = {
  title?: string;
  subtitle?: string;

  onPressMenu?: () => void;
  onPressBack?: () => void;
  showMenu?: boolean;
  showBack?: boolean;
  onPressClose?: () => void;

  /**
   * A HELP_TOPICS value (src/tutorials/catalog.ts). Renders a "?" that opens the
   * tutorials filtered to this screen.
   *
   * This is the entry point that actually reaches confused users: the menu is
   * opt-in, and someone stuck mid-sale does not go looking for it; they phone
   * support. The icon hides itself when no tutorial covers the topic, so a
   * screen can declare one before the video exists.
   */
  helpTopic?: string;

  /** Accepted so existing callers compile. There is one header style now (see below). */
  variant?: "light";
};

/**
 * The header for screens pushed from More (shop details, printing, language,
 * help, legal): white, with a hairline under it, and a back arrow and title
 * on the left.
 *
 * It had a second, default "purple" variant inherited from SoneBill. That was
 * a gradient-gold SVG title over the dark band, a diamond badge and a globe
 * button, with the default title "Jewellery Bill". Every caller had already
 * opted out of it, so it was removed in the 4.3(a) rework
 * (APP_STORE_4.3_REWORK.md) rather than left in the bundle.
 */
const CommonHeader: React.FC<Props> = ({
  title = "",
  subtitle,
  onPressMenu,
  onPressBack,
  showMenu,
  showBack,
  onPressClose,
  helpTopic,
}) => {
  const bannerHeight = React.useContext(BannerHeightContext);

  // Asked here as well as inside HelpIconButton because the right-hand slot needs
  // a spacer when nothing occupies it, and a component returning null is still a
  // truthy element — the layout cannot be decided from the element alone.
  const hasHelp = useHasTutorialsForTopic(helpTopic);
  const helpButton = hasHelp ? (
    <HelpIconButton topic={helpTopic} color={Brand.inkMuted} />
  ) : null;
  // When the impersonation banner is active the Tab.Navigator frame already
  // starts below it, so SafeAreaView must NOT add extra top padding here.
  const safeEdges = (bannerHeight > 0
    ? ['left', 'right']
    : ['top', 'left', 'right']) as ('top' | 'left' | 'right')[];

  return (
    <Box bg={Brand.card} borderBottomWidth={1} borderBottomColor={Brand.line} zIndex={30}>
      <SafeAreaView edges={safeEdges} style={styles.safeArea}>
        <HStack px="$4" py="$3" alignItems="center" space="md" style={LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}}>
          {showBack ? (
            <Pressable onPress={onPressBack} p="$2" rounded="$full" accessibilityLabel="Back">
              <Icon as={ArrowLeft} size="xl" color={Brand.ink} />
            </Pressable>
          ) : showMenu ? (
            <Pressable onPress={onPressMenu} p="$2" rounded="$full">
              <Icon as={Menu} size="xl" color={Brand.ink} />
            </Pressable>
          ) : (
            <Box w="$10" />
          )}

          <VStack flex={1} space="xs">
            <Text fontSize="$lg" fontWeight="$bold" color={Brand.ink}>
              {title}
            </Text>
            {!!subtitle && (
              <Text fontSize="$sm" color={Brand.inkMuted}>
                {subtitle}
              </Text>
            )}
          </VStack>

          {hasHelp || onPressClose ? (
            <HStack alignItems="center">
              {helpButton}
              {!!onPressClose && (
                <Pressable onPress={onPressClose} p="$2" rounded="$full">
                  <Icon as={X} size="xl" color={Brand.inkMuted} />
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
};

const styles = StyleSheet.create({
  safeArea: { overflow: "hidden" },
});

export default CommonHeader;
