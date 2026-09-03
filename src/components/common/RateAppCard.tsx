import React from 'react';
import { Platform } from 'react-native';
import { Box, HStack, VStack, Text, Pressable, Icon } from '@gluestack-ui/themed';
import { Star, X } from 'lucide-react-native';
import { AppReview } from '@codeimplants/app-review';

import { useTranslation } from '../../hooks/useTranslation';

/**
 * The recurring "rate us" card on the dashboard.
 *
 * This exists because the native review prompt cannot be shown often: Apple caps it at
 * three times a year per device and Play has its own hidden quota, and calls beyond that
 * are silently dropped. This card is our own UI opening the store listing, which is the
 * on-demand path both stores explicitly sanction — so it can come back every few days for
 * someone who is actively billing, where the native prompt cannot.
 *
 * It deliberately asks no question. Play's policy forbids any opinion or predictive
 * question around a rating flow ("Do you like the app?", "Would you rate us 5 stars?"),
 * which is what makes the old rate-gate pattern a violation today. This states what it is
 * and lets the user decide.
 *
 * Every frequency rule lives in @codeimplants/app-review, not here — this component only
 * asks whether to render, and reports what the user did.
 */
const RateAppCard = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    // No store to send anyone to on web.
    if (Platform.OS === 'web') return;

    let cancelled = false;

    (async () => {
      const decision = await AppReview.shouldShowNudge();
      if (cancelled || !decision.show) return;

      setVisible(true);
      // Marks the interval as started the moment it appears, so a card that is simply
      // scrolled past still waits its turn before coming back. Only the explicit dismiss
      // below counts toward giving up for good.
      AppReview.markNudgeShown();
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  const handleDismiss = () => {
    setVisible(false);
    AppReview.dismissNudge();
  };

  const handleAccept = () => {
    setVisible(false);
    AppReview.acceptNudge();
  };

  return (
    <Box
      bg="#FFFBEB"
      p="$4"
      rounded="$2xl"
      borderWidth={1}
      borderColor="#FDE68A"
    >
      <HStack space="sm" alignItems="flex-start">
        <Icon as={Star} color="#D97706" size="sm" mt="$1" />

        <VStack flex={1} space="xs">
          <Text color="#B45309" fontWeight="$bold">
            {t('rateApp.title') || 'Enjoying Gold Khata Book?'}
          </Text>
          <Text fontSize={13} color="#B45309" opacity={0.9}>
            {t('rateApp.body') ||
              'A rating helps other jewellers find the app.'}
          </Text>

          <Pressable onPress={handleAccept} alignSelf="flex-start" mt="$2">
            <Box bg="#D97706" px="$4" py="$2" rounded="$lg">
              <Text color="$white" fontWeight="$medium" fontSize={13}>
                {t('rateApp.action') || 'Rate now'}
              </Text>
            </Box>
          </Pressable>
        </VStack>

        {/* Generous hit area — this is the escape route, and a card you cannot
            comfortably dismiss is the definition of nagging. */}
        <Pressable onPress={handleDismiss} p="$2" m="-$2">
          <Icon as={X} color="#B45309" size="sm" />
        </Pressable>
      </HStack>
    </Box>
  );
};

export default RateAppCard;
