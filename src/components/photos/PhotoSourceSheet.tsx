import React, { useCallback, useRef } from 'react';
import { Modal, Platform, StyleSheet } from 'react-native';
import { Box, HStack, Pressable, Text, VStack, Icon } from '@gluestack-ui/themed';
import { Camera, ImagePlus, Trash2, X } from 'lucide-react-native';

import { useTranslation } from '../../hooks/useTranslation';
import { useSheetBottomInset } from '../../hooks/useSheetBottomInset';

interface PhotoSourceSheetProps {
  visible: boolean;
  onClose: () => void;
  onPick: (mode: 'camera' | 'library') => void;
  /** Optional title; defaults to "Add Photos". */
  title?: string;
  /**
   * A destructive third option, e.g. removing the photo that is already there.
   * Only meaningful where the field holds a single image and the sheet is the
   * only place to act on it — the grid fields delete from the tile instead.
   */
  onRemove?: () => void;
  removeLabel?: string;
}

/**
 * Asks where a photo should come from.
 *
 * Deliberately not ActionSheetIOS: that has no Android or web equivalent, so the
 * app would carry three implementations of one decision. A Modal covers all
 * three, and the only per-platform difference is where the panel sits — anchored
 * to the bottom on a phone, centred on desktop web where a bottom sheet on a wide
 * viewport reads as a mistake.
 *
 * Android specifics: `onRequestClose` is what makes the hardware back button
 * dismiss this rather than the screen behind it, and `statusBarTranslucent`
 * extends the scrim behind the status bar on the edge-to-edge builds this app
 * ships. Without the latter the scrim stops short and the bar keeps the app's
 * colour, which looks like a rendering fault.
 */
const PhotoSourceSheet = ({
  visible,
  onClose,
  onPick,
  title,
  onRemove,
  removeLabel,
}: PhotoSourceSheetProps) => {
  const { t } = useTranslation();
  const isWeb = Platform.OS === 'web';
  const bottomInset = useSheetBottomInset();

  /**
   * The pick this sheet is closing in order to make.
   *
   * A ref, not state: nothing renders from it, and it must survive the
   * re-render that closing the sheet causes without scheduling another.
   */
  const pendingMode = useRef<'camera' | 'library' | null>(null);

  const launchPending = useCallback(() => {
    const mode = pendingMode.current;
    pendingMode.current = null;
    if (mode) onPick(mode);
  }, [onPick]);

  const choose = (mode: 'camera' | 'library') => {
    // Deferred, not fired here. onPick opens a native picker, and on iOS
    // react-native-image-picker presents it on RCTPresentedViewController() -
    // which, in the same tick as onClose(), is this sheet's own view
    // controller on its way out. UIKit drops a presentation onto a dismissing
    // controller silently: no picker appears, and the promise the caller is
    // awaiting never settles, so the form sits there looking broken.
    pendingMode.current = mode;
    onClose();
    // Android and web have no onDismiss, and their pickers do not contend with
    // a dismissing presentation - one frame is enough to let the close flush.
    if (Platform.OS !== 'ios') requestAnimationFrame(launchPending);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isWeb ? 'fade' : 'slide'}
      statusBarTranslucent
      onRequestClose={onClose}
      // iOS only, and exactly the guarantee this needs: it fires once the
      // sheet has actually finished going away, so the picker is presented
      // onto the view controller underneath rather than onto a corpse.
      onDismiss={Platform.OS === 'ios' ? launchPending : undefined}
    >
      <Pressable
        style={[styles.backdrop, isWeb ? styles.backdropCentred : styles.backdropBottom]}
        onPress={onClose}
        accessibilityLabel={t('common.cancel') || 'Cancel'}
      >
        {/* Swallows taps so a press inside the panel does not close it. */}
        <Pressable onPress={() => {}} style={isWeb ? styles.panelWebWrap : styles.panelWrap}>
          <Box
            bg="$white"
            style={isWeb ? styles.panelWeb : [styles.panel, { paddingBottom: bottomInset }]}
          >
            <HStack alignItems="center" justifyContent="space-between" mb="$3">
              <Text fontSize={15} fontWeight="$bold" color="$coolGray900">
                {title || t('declaration.photos.addPhotos') || 'Add Photos'}
              </Text>
              <Pressable
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel={t('common.cancel') || 'Cancel'}
              >
                <Icon as={X} size="sm" color="$coolGray400" />
              </Pressable>
            </HStack>

            <VStack space="sm">
              <Pressable onPress={() => choose('camera')}>
                <HStack space="md" alignItems="center" style={styles.option}>
                  <Box style={styles.optionIcon}>
                    <Icon as={Camera} size="md" color="#6D5EF7" />
                  </Box>
                  <Text fontSize={15} color="$coolGray800">
                    {t('declaration.photos.takePhoto') || 'Take Photo'}
                  </Text>
                </HStack>
              </Pressable>

              <Pressable onPress={() => choose('library')}>
                <HStack space="md" alignItems="center" style={styles.option}>
                  <Box style={styles.optionIcon}>
                    <Icon as={ImagePlus} size="md" color="#6D5EF7" />
                  </Box>
                  <Text fontSize={15} color="$coolGray800">
                    {t('declaration.photos.choosePhoto') || 'Choose Photo'}
                  </Text>
                </HStack>
              </Pressable>

              {!!onRemove && (
                <Pressable
                  onPress={() => {
                    onClose();
                    onRemove();
                  }}
                >
                  <HStack space="md" alignItems="center" style={styles.optionDanger}>
                    <Box style={styles.optionIconDanger}>
                      <Icon as={Trash2} size="md" color="#DC2626" />
                    </Box>
                    <Text fontSize={15} color="#DC2626">
                      {removeLabel || t('customers.photo.remove') || 'Remove photo'}
                    </Text>
                  </HStack>
                </Pressable>
              )}
            </VStack>
          </Box>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(17, 12, 46, 0.45)' },
  backdropBottom: { justifyContent: 'flex-end' },
  backdropCentred: { justifyContent: 'center', alignItems: 'center', padding: 20 },
  panelWrap: { width: '100%' },
  panelWebWrap: { width: '100%', maxWidth: 360 },
  panel: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 18,
    // paddingBottom comes from useSheetBottomInset at the call site: a constant
    // here cannot clear an Android three-button nav bar, which is what hid the
    // "Choose Photo" row on a real device.
    ...Platform.select({ android: { elevation: 16 }, default: {} }),
  },
  panelWeb: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  option: {
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 14,
  },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(109, 94, 247, 0.12)',
  },
  optionDanger: {
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 14,
  },
  optionIconDanger: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.10)',
  },
});

export default PhotoSourceSheet;
