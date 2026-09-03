import React from 'react';
import { StyleSheet } from 'react-native';
import { Box, HStack, Text, Pressable } from '@gluestack-ui/themed';
import { Printer, Download, Share2 } from 'lucide-react-native';
import { WhatsAppIcon } from '../icons/ContactIcons';
import { useTranslation } from '../../hooks/useTranslation';

interface DocumentActionsRowProps {
  onPrint: () => void;
  onDownload: () => void;
  onShare: () => void;
  /**
   * Optional fourth action: hand the document straight to WhatsApp instead of
   * the generic OS share sheet. Left out by documents that have no customer to
   * send to — the declaration is a shop record, not something a customer gets.
   */
  onWhatsApp?: () => void;
}

/**
 * Print / Download / Share for one document, as a single compact row.
 *
 * Shared because every document the app produces offers exactly these three
 * actions — the invoice and the declaration today, advance orders next — and
 * they were previously hand-rolled per document, which is how the declaration
 * ended up labelled "Download" while wired to share.
 *
 * Each action carries its own colour so the three read as distinct at a glance
 * rather than as one green button plus two grey ones. Icon sits beside the
 * label rather than above it: stacking them pushed each button to roughly 60pt
 * tall for no extra information.
 */
const DocumentActionsRow = ({
  onPrint,
  onDownload,
  onShare,
  onWhatsApp,
}: DocumentActionsRowProps) => {
  const { t } = useTranslation();

  const actions = [
    {
      key: 'print',
      icon: Printer,
      label: t('orders.details.print') || 'Print',
      onPress: onPrint,
      style: styles.printButton,
    },
    {
      key: 'download',
      icon: Download,
      label: t('orders.details.download') || 'Download',
      onPress: onDownload,
      style: styles.downloadButton,
    },
    {
      key: 'share',
      icon: Share2,
      label: t('orders.details.share') || 'Share',
      onPress: onShare,
      style: styles.shareButton,
    },
  ];

  return (
    <HStack space="sm">
      {actions.map(action => {
        const ActionIcon = action.icon;
        return (
          <Pressable key={action.key} flex={1} onPress={action.onPress}>
            <Box style={action.style}>
              <ActionIcon size={15} color="#FFFFFF" />
              <Text
                fontSize="$2xs"
                fontWeight="$bold"
                color="$white"
                ml="$1.5"
                // Translated labels run longer than the English ones; clipping
                // one word beats reflowing the row to two lines.
                numberOfLines={1}
              >
                {action.label}
              </Text>
            </Box>
          </Pressable>
        );
      })}

      {/* Icon-only and on a light background, unlike the three coloured blocks
          beside it. The WhatsApp mark is a full-colour brand SVG that cannot be
          tinted white, and a fourth green button would read as a duplicate of
          Share. Keeping it narrow also stops the row wrapping once the labels
          are translated. */}
      {onWhatsApp && (
        <Pressable onPress={onWhatsApp} accessibilityLabel={t('orders.details.sendOnWhatsApp') || 'Send on WhatsApp'}>
          <Box style={styles.whatsAppButton}>
            <WhatsAppIcon size={28} />
          </Box>
        </Pressable>
      )}
    </HStack>
  );
};

// Fixed rather than left to each button's content: the three labelled buttons
// sit inside flex:1 pressables and stretch to the row, while the icon-only
// WhatsApp button sized to its glyph and came out visibly shorter. Pinning the
// height makes all four match regardless of what is inside them.
const ACTION_HEIGHT = 40;

// Backgrounds are named styles rather than an inline `backgroundColor` so the
// row stays clear of the repo's no-inline-styles rule.

const base = {
  height: ACTION_HEIGHT,
  paddingHorizontal: 6,
  borderRadius: 10,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

const styles = StyleSheet.create({
  printButton: { ...base, backgroundColor: '#0EA5E9' },
  downloadButton: { ...base, backgroundColor: '#8B5CF6' },
  shareButton: { ...base, backgroundColor: '#22C55E' },
  whatsAppButton: {
    ...base,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    // Tighter than the others: with no label to sit beside, the glyph should
    // fill the button rather than float in it.
    paddingHorizontal: 8,
  },
});

export default DocumentActionsRow;
