import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Box, HStack, Text, Pressable } from '@gluestack-ui/themed';
import { X, Undo2, Trash2, Check } from 'lucide-react-native';

import SignaturePad, { SignaturePadHandle } from './SignaturePad';
import { useTranslation } from '../../hooks/useTranslation';

interface SignatureCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (svg: string) => void;
  title?: string;
  /** Shown under the signing line — typically who is being asked to sign. */
  signerLabel?: string;
}

/**
 * The one signature capture surface in the app.
 *
 * Deliberately a single component for both the shop's signature and a
 * customer's: they are the same interaction with different framing, and the
 * previous split meant the shop pad silently kept an older, cruder drawing
 * implementation.
 *
 * The layout follows what document-signing apps settled on — the screen is
 * given over entirely to a white field with a ruled baseline and an ✕ marking
 * where to start, minimal chrome, and the destructive controls (undo, clear)
 * kept away from the confirm. Save stays disabled until there is ink, so an
 * empty signature cannot be recorded against a declaration.
 *
 * Always full-screen, including for the shop's own signature: a signature drawn
 * in a small box is a worse signature, and there is no reason to keep a cramped
 * variant alive just because that is how settings used to do it.
 */
const SignatureCaptureModal: React.FC<SignatureCaptureModalProps> = ({
  isOpen,
  onClose,
  onSave,
  title,
  signerLabel,
}) => {
  const { t } = useTranslation();
  const padRef = React.useRef<SignaturePadHandle>(null);
  const [hasInk, setHasInk] = React.useState(false);

  // The pad unmounts with the modal, so its strokes go with it. Resetting the
  // flag keeps Save disabled when the modal is reopened.
  React.useEffect(() => {
    if (!isOpen) setHasInk(false);
  }, [isOpen]);

  const handleSave = () => {
    const svg = padRef.current?.toSvg();
    if (svg) onSave(svg);
    onClose();
  };

  const heading = title || t('signature.title') || 'Signature';

  const canvas = (
    <Box flex={1} position="relative">
      <SignaturePad
        ref={padRef}
        onDrawingChange={setHasInk}
        style={styles.canvasFull}
      />

      {/* Baseline sits behind the ink and never takes touches, so a stroke that
          crosses it is unaffected. */}
      <View style={styles.baselineLayer} pointerEvents="none">
        <HStack alignItems="center" px="$6">
          <Text color="$coolGray400" fontSize={18} mr="$2">
            ✕
          </Text>
          <Box flex={1} h={1} bg="$coolGray300" />
        </HStack>
        {!!signerLabel && (
          <Text color="$coolGray400" fontSize={12} mt="$2" px="$6">
            {signerLabel}
          </Text>
        )}
      </View>
    </Box>
  );

  const controls = (
    <HStack space="sm" alignItems="center">
      <Pressable
        onPress={() => padRef.current?.undo()}
        disabled={!hasInk}
        opacity={hasInk ? 1 : 0.4}
        px="$3"
        py="$3"
      >
        <HStack space="xs" alignItems="center">
          <Undo2 size={16} color="#6B7280" />
          <Text fontWeight="$medium" color="$coolGray700" fontSize={14}>
            {t('signature.undo') || 'Undo'}
          </Text>
        </HStack>
      </Pressable>

      <Pressable
        onPress={() => padRef.current?.clear()}
        disabled={!hasInk}
        opacity={hasInk ? 1 : 0.4}
        px="$3"
        py="$3"
      >
        <HStack space="xs" alignItems="center">
          <Trash2 size={16} color="#6B7280" />
          <Text fontWeight="$medium" color="$coolGray700" fontSize={14}>
            {t('signature.clear') || 'Clear'}
          </Text>
        </HStack>
      </Pressable>

      <Box flex={1} />

      <Pressable onPress={handleSave} disabled={!hasInk}>
        <Box
          rounded="$xl"
          px="$6"
          py="$3"
          bg={hasInk ? '#6D5EF7' : '$coolGray200'}
          flexDirection="row"
          alignItems="center"
        >
          <Check size={16} color="white" style={{ marginRight: 6 }} />
          <Text fontWeight="$bold" color="$white">
            {t('signature.save') || 'Save'}
          </Text>
        </Box>
      </Pressable>
    </HStack>
  );

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      onRequestClose={onClose}
      // Covers the whole screen on iOS rather than the inset sheet a page-sheet
      // presentation gives — the point is maximum room to sign.
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={styles.fullScreenRoot} edges={['top', 'bottom']}>
        <HStack
          alignItems="center"
          justifyContent="space-between"
          px="$4"
          py="$3"
        >
          <Pressable onPress={onClose} p="$2" m="-$2">
            <X size={22} color="#6B7280" />
          </Pressable>
          <Text fontWeight="$bold" fontSize={16} color="$coolGray900">
            {heading}
          </Text>
          {/* Balances the close button so the title stays centred. */}
          <Box w={22} />
        </HStack>

        {canvas}

        <Box px="$4" py="$3">
          {controls}
        </Box>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullScreenRoot: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  canvasFull: {
    flex: 1,
  },
  // Anchored near the foot of the field, where a signature naturally sits.
  baselineLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '18%',
  },
});

export default SignatureCaptureModal;
