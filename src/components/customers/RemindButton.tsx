import React from 'react';
import { HStack, Text, Pressable, Icon } from '@gluestack-ui/themed';
import { MessageCircle } from 'lucide-react-native';
import { useTranslation } from '../../hooks/useTranslation';
import { useRetailerReminder } from '../../hooks/useRetailerReminder';

/**
 * "Remind on WhatsApp", small enough to sit on a list row.
 *
 * One component for every placement — the dashboard dues list, a retailer card
 * and an order card — because the thing it does is identical in all three and
 * three hand-rolled buttons would drift in label, colour and behaviour.
 *
 * `stopPropagation` on the press is the whole reason this is a component rather
 * than an inline Pressable: every one of those rows is itself tappable and
 * navigates away, so without it the tap opens WhatsApp AND leaves the screen
 * behind it, and the shopkeeper comes back from WhatsApp somewhere they did not
 * choose to be.
 */
export const RemindButton = ({
  customerId,
  compact,
}: {
  customerId?: string;
  /** Icon only — for a dense row that has no width for a label. */
  compact?: boolean;
}) => {
  const { t } = useTranslation();
  const { remind } = useRetailerReminder();
  const [sending, setSending] = React.useState(false);

  if (!customerId) return null;

  const onPress = async (e?: any) => {
    e?.stopPropagation?.();
    if (sending) return;
    setSending(true);
    try {
      await remind(customerId);
    } finally {
      setSending(false);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityLabel={t('statement.sendWhatsApp') || 'Remind on WhatsApp'}
      opacity={sending ? 0.5 : 1}
    >
      <HStack
        bg="#25D366"
        rounded="$lg"
        alignItems="center"
        justifyContent="center"
        space="xs"
        px={compact ? '$2' : '$3'}
        py={compact ? '$2' : '$1.5'}
      >
        <Icon as={MessageCircle} size="xs" color="$white" />
        {!compact && (
          <Text color="$white" fontWeight="$bold" fontSize={12}>
            {t('statement.remind') || 'Remind'}
          </Text>
        )}
      </HStack>
    </Pressable>
  );
};

export default RemindButton;
