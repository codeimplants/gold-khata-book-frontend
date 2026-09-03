import React, { useState } from 'react';
import { Linking, Platform } from 'react-native';
import { Box, Text, VStack, HStack, Pressable, Icon } from '@gluestack-ui/themed';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Headphones, PlayCircle } from 'lucide-react-native';
import { useAppSelector } from '../../store/hooks';
import { useTranslation } from '../../hooks/useTranslation';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { LAYOUT } from '../../constants/layout';
import { PhoneCallIcon, WhatsAppIcon } from '../icons/ContactIcons';
import { buildSupportWhatsAppUrl } from '../../utils/supportContact';

// Leaf route names where the bottom tab bar (MainTabs/CustomTabBar) is visible.
// The button needs extra bottom clearance there so it doesn't sit on top of it.
const TAB_SCREENS = ['Dashboard', 'Orders', 'Customers', 'Settings'];

// Screens where this button should never appear — internal/admin views, not
// the shop-owner experience this button is meant for.
const HIDDEN_ROUTES = ['AdminDashboard', 'AdminUserDetail'];

// Matches CustomTabBar's own height calc (MainTabs.tsx: 96 + insets.bottom on
// native; content-driven with no explicit height on web).
const TAB_BAR_HEIGHT = LAYOUT.isWeb ? 80 : 96;

interface GlobalSupportButtonProps {
  currentRouteName?: string;
  /**
   * Navigate callback rather than useNavigation(): this button is rendered
   * *outside* NavigationContainer in App.tsx, so there is no navigation context
   * here. App.tsx passes a wrapper around its navigationRef.
   */
  onNavigate?: (screen: string, params?: object) => void;
}

export default function GlobalSupportButton({
  currentRouteName,
  onNavigate,
}: GlobalSupportButtonProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tutorialsEnabled = useFeatureFlag('tutorials');
  const [open, setOpen] = useState(false);

  const { isLoggedIn, isGuest, impersonateUserId } = useAppSelector(s => s.auth);
  const isAuthenticated = isLoggedIn || isGuest;
  const { supportPhone, supportWhatsapp } = useAppSelector(s => s.config);
  const shopDetails = useAppSelector(s => s.data.shopDetails);

  const hidden =
    !isAuthenticated ||
    !!impersonateUserId ||
    (currentRouteName != null && HIDDEN_ROUTES.includes(currentRouteName));

  if (hidden) return null;

  const isTabScreen = currentRouteName != null && TAB_SCREENS.includes(currentRouteName);
  const bottom = insets.bottom + (isTabScreen ? TAB_BAR_HEIGHT + 20 : 20);

  const handleCall = () => {
    setOpen(false);
    Linking.openURL(`tel:${supportPhone}`);
  };

  const handleWhatsApp = () => {
    setOpen(false);
    Linking.openURL(buildSupportWhatsAppUrl(supportWhatsapp, shopDetails));
  };

  // Offered above call and WhatsApp on purpose: a shopkeeper who can answer their
  // own question in 60 seconds is better served than one who waits for a callback,
  // and every deflected call is a real cost saved.
  const handleTutorials = () => {
    setOpen(false);
    onNavigate?.('Tutorials');
  };

  return (
    <>
      {open && (
        <Pressable
          position="absolute"
          top={0}
          bottom={0}
          left={0}
          right={0}
          bg="rgba(0,0,0,0.25)"
          onPress={() => setOpen(false)}
        />
      )}

      <Box position="absolute" bottom={bottom} left={20} alignItems="flex-start">
        {open && (
          <Box
            mb="$3"
            bg="$white"
            rounded="$2xl"
            p="$2"
            hardShadow="1"
            borderWidth={1}
            borderColor="$coolGray100"
            minWidth={220}
          >
            <Text px="$2" pt="$1" pb="$2" fontWeight="$bold" fontSize="$sm" color="$coolGray900">
              {t('contact.introTitle') || 'Get in Touch'}
            </Text>

            <VStack space="xs">
              {!!onNavigate && tutorialsEnabled && (
                <Pressable onPress={handleTutorials} p="$2" rounded="$xl">
                  <HStack space="sm" alignItems="center">
                    <Box
                      w={32}
                      h={32}
                      rounded="$full"
                      bg="$purple50"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Icon as={PlayCircle} size="sm" color="#6D5EF7" />
                    </Box>
                    <VStack flex={1}>
                      <Text fontWeight="$medium" fontSize="$sm" color="$coolGray900">
                        {t('tutorials.watch') || 'Watch a tutorial'}
                      </Text>
                      <Text fontSize="$xs" color="$coolGray500">
                        {t('tutorials.watchSub') || 'Short how-to videos'}
                      </Text>
                    </VStack>
                  </HStack>
                </Pressable>
              )}

              <Pressable onPress={handleCall} p="$2" rounded="$xl">
                <HStack space="sm" alignItems="center">
                  <PhoneCallIcon size={32} />
                  <VStack flex={1}>
                    <Text fontWeight="$medium" fontSize="$sm" color="$coolGray900">
                      {t('contact.phone') || 'Phone Support'}
                    </Text>
                    <Text fontSize="$xs" color="$coolGray500">{supportPhone}</Text>
                  </VStack>
                </HStack>
              </Pressable>

              <Pressable onPress={handleWhatsApp} p="$2" rounded="$xl">
                <HStack space="sm" alignItems="center">
                  <WhatsAppIcon size={32} />
                  <VStack flex={1}>
                    <Text fontWeight="$medium" fontSize="$sm" color="$coolGray900">
                      {t('contact.whatsapp') || 'WhatsApp Support'}
                    </Text>
                    <Text fontSize="$xs" color="$coolGray500">{supportWhatsapp}</Text>
                  </VStack>
                </HStack>
              </Pressable>
            </VStack>
          </Box>
        )}

        <Pressable
          onPress={() => setOpen(!open)}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            justifyContent: 'center',
            alignItems: 'center',
            ...(Platform.OS !== 'web' ? { elevation: 6 } : {}),
          }}
        >
          <Svg width="56" height="56">
            <Defs>
              <LinearGradient id="supportFabGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#2DD4BF" />
                <Stop offset="1" stopColor="#10B981" />
              </LinearGradient>
            </Defs>
            <Rect width="56" height="56" rx="28" fill="url(#supportFabGrad)" />
          </Svg>
          <Box position="absolute">
            <Icon as={Headphones} color="$white" size="lg" />
          </Box>
        </Pressable>
      </Box>
    </>
  );
}
