import React from 'react';
import { Modal, StyleSheet, Platform } from 'react-native';
import {
  Box,
  Text,
  Pressable,
  VStack,
  HStack,
  Icon,
} from '@gluestack-ui/themed';
import { AlertTriangle, X } from 'lucide-react-native';
import { useTranslation } from '../hooks/useTranslation';

interface ValidationErrorModalProps {
  isOpen: boolean;
  errors: string[];
  onClose: () => void;
}

const ValidationErrorModal = ({ isOpen, errors, onClose }: ValidationErrorModalProps) => {
  const { t } = useTranslation();

  if (errors.length === 0) return null;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        flex={1}
        bg="rgba(0,0,0,0.5)"
        justifyContent="center"
        alignItems="center"
        px="$6"
        onPress={onClose}
      >
        <Pressable
          bg="$white"
          rounded="$2xl"
          style={styles.card}
          w="$full"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <Box
            bg="#FEF2F2"
            px="$5"
            py="$4"
            style={styles.header}
          >
            <HStack alignItems="center" justifyContent="space-between">
              <HStack alignItems="center" space="sm" flex={1}>
                <Box
                  bg="#FCA5A5"
                  rounded="$full"
                  p="$2"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icon as={AlertTriangle} size="sm" color="#DC2626" />
                </Box>
                <Text fontWeight="$bold" fontSize={16} color="#DC2626" flex={1}>
                  {t('validationModal.title') || 'Please Fix the Following'}
                </Text>
              </HStack>
              <Pressable onPress={onClose} p="$1">
                <Icon as={X} size="sm" color="#6B7280" />
              </Pressable>
            </HStack>
          </Box>

          {/* Error list */}
          <VStack space="sm" px="$5" py="$4">
            <Text fontSize={13} color="#6B7280" mb="$1">
              {t('validationModal.subtitle') || 'Please correct the issues below before continuing:'}
            </Text>
            {errors.map((err, idx) => (
              <HStack key={idx} space="sm" alignItems="flex-start">
                <Box
                  w={6}
                  h={6}
                  rounded="$full"
                  bg="#FEE2E2"
                  alignItems="center"
                  justifyContent="center"
                  mt="$0.5"
                  style={{ flexShrink: 0 }}
                >
                  <Text fontSize={10} fontWeight="$bold" color="#DC2626">
                    {idx + 1}
                  </Text>
                </Box>
                <Text fontSize={14} color="#374151" flex={1} lineHeight={20}>
                  {err}
                </Text>
              </HStack>
            ))}
          </VStack>

          {/* Close button */}
          <Box px="$5" pb="$5">
            <Pressable
              bg="#DC2626"
              rounded="$xl"
              py="$3"
              alignItems="center"
              onPress={onClose}
            >
              <Text color="$white" fontWeight="$bold" fontSize={15}>
                {t('validationModal.closeBtn') || 'OK, Got it'}
              </Text>
            </Pressable>
          </Box>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  card: {
    maxWidth: 480,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }
      : { elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12 }),
  },
  header: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
});

export default ValidationErrorModal;
