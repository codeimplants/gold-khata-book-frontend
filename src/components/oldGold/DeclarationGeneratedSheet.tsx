import React from 'react';
import { Modal, StyleSheet, TouchableOpacity } from 'react-native';
import { Box, VStack, Text, Center, Icon, CheckCircleIcon } from '@gluestack-ui/themed';
import { Printer, Share2, RefreshCw } from 'lucide-react-native';
import { useTranslation } from '../../hooks/useTranslation';
import PrintTargetNote from '../common/PrintTargetNote';

interface DeclarationGeneratedSheetProps {
  isOpen: boolean;
  declarationNumber: string;
  /** Set when the declaration itself saved but its photos did not upload —
   *  offers a retry rather than silently dropping them. */
  photosFailed?: boolean;
  onRetryPhotos?: () => void;
  onPrint: () => void;
  onShare: () => void;
  onDone: () => void;
}

/**
 * "Right after saving it" — the print/share moment the standalone purchase
 * flow already gives on its own success screen, offered here too now that a
 * declaration can be generated inline from an invoice or advance order
 * instead of only through that separate screen.
 */
const DeclarationGeneratedSheet = ({
  isOpen,
  declarationNumber,
  photosFailed,
  onRetryPhotos,
  onPrint,
  onShare,
  onDone,
}: DeclarationGeneratedSheetProps) => {
  const { t } = useTranslation();

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onDone}>
      <Box flex={1} bg="rgba(0,0,0,0.45)" justifyContent="center" alignItems="center">
        <Box bg="$white" rounded="$3xl" p="$6" style={styles.card}>
          <Center mb="$4">
            <Box bg="$green100" p="$3" rounded="$full" mb="$3">
              <Icon as={CheckCircleIcon} size="lg" color="$green600" />
            </Box>
            <Text fontWeight="$bold" fontSize={17} color="$coolGray800">
              {t('declaration.saved') || 'Declaration Saved'}
            </Text>
            <Text color="$coolGray500" mt="$1">
              {declarationNumber}
            </Text>
          </Center>

          <VStack space="sm">
            {photosFailed && (
              <TouchableOpacity style={styles.warningButton} onPress={onRetryPhotos}>
                <Icon as={RefreshCw} size="sm" mr="$2" color="#B45309" />
                <Text color="#B45309">
                  {t('declaration.photos.retryUpload') || 'Retry photo upload'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.outlineButton} onPress={onPrint}>
              <Icon as={Printer} size="sm" mr="$2" />
              <Text>{t('declaration.print') || 'Print Declaration'}</Text>
            </TouchableOpacity>
            {/* Closes first: this sheet is a Modal, and navigating from under
                it would push Print Settings behind it. */}
            <PrintTargetNote mt="$0" onBeforeNavigate={onDone} />

            <TouchableOpacity style={styles.shareButton} onPress={onShare}>
              <Icon as={Share2} size="sm" mr="$2" color="$white" />
              <Text color="$white" fontWeight="$medium">
                {t('declaration.share') || 'Share Declaration'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.doneButton} onPress={onDone}>
              <Text color="$coolGray600" fontWeight="$medium">
                {t('common.done') || 'Done'}
              </Text>
            </TouchableOpacity>
          </VStack>
        </Box>
      </Box>
    </Modal>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '88%',
    maxWidth: 400,
  },
  outlineButton: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButton: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default DeclarationGeneratedSheet;
