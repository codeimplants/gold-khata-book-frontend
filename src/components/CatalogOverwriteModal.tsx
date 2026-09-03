import React from 'react';
import { Modal, StyleSheet, Platform } from 'react-native';
import { Box, Text, Pressable, VStack, HStack, Icon } from '@gluestack-ui/themed';
import { AlertTriangle } from 'lucide-react-native';
import { useTranslation } from '../hooks/useTranslation';

interface CatalogOverwriteModalProps {
  isOpen: boolean;
  /** Labels of the fields whose hand-entered values were replaced. */
  fields: string[];
  onClose: () => void;
}

/**
 * Tells the shopkeeper which fields a saved item just replaced.
 *
 * Deliberately not a ValidationErrorModal: nothing here is wrong, and the red
 * "Please Fix the Following" treatment would send someone hunting for a mistake
 * that does not exist. Amber, and a single OK — the change has already been
 * made, this says what it was.
 *
 * Only fields that held a value the shopkeeper typed appear. Filling an empty
 * row from the catalogue is the normal use and stays silent.
 */
const CatalogOverwriteModal = ({ isOpen, fields, onClose }: CatalogOverwriteModalProps) => {
  const { t } = useTranslation();

  if (fields.length === 0) return null;

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
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
          onPress={(e: any) => e.stopPropagation()}
        >
          <Box bg="#FFFBEB" px="$5" py="$4" style={styles.header}>
            <HStack alignItems="center" space="sm" flex={1}>
              <Box bg="#FDE68A" rounded="$full" p="$2" alignItems="center" justifyContent="center">
                <Icon as={AlertTriangle} size="sm" color="#D97706" />
              </Box>
              <Text fontWeight="$bold" fontSize={16} color="#B45309" flex={1}>
                {t('catalogOverwrite.title') || 'Some values were replaced'}
              </Text>
            </HStack>
          </Box>

          <VStack space="sm" px="$5" py="$4">
            <Text fontSize={13} color="#6B7280" mb="$1">
              {t('catalogOverwrite.subtitle') ||
                'You chose a saved item, so these fields now use the saved item’s values instead of what you had entered:'}
            </Text>
            {fields.map((field, idx) => (
              <HStack key={idx} space="sm" alignItems="flex-start">
                <Box
                  w={6}
                  h={6}
                  rounded="$full"
                  bg="#FEF3C7"
                  alignItems="center"
                  justifyContent="center"
                  mt="$0.5"
                  style={styles.bullet}
                >
                  <Text fontSize={10} fontWeight="$bold" color="#B45309">
                    {idx + 1}
                  </Text>
                </Box>
                <Text fontSize={14} color="#374151" flex={1} lineHeight={20}>
                  {field}
                </Text>
              </HStack>
            ))}
            <Text fontSize={12} color="#9CA3AF" mt="$1">
              {t('catalogOverwrite.hint') || 'You can edit any of them again before saving the bill.'}
            </Text>
          </VStack>

          <Box px="$5" pb="$5">
            <Pressable bg="#F59E0B" rounded="$xl" py="$3" alignItems="center" onPress={onClose}>
              <Text color="$white" fontWeight="$bold" fontSize={15}>
                {t('catalogOverwrite.okBtn') || 'OK'}
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
      : {
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.18,
          shadowRadius: 12,
        }),
  },
  header: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  bullet: {
    flexShrink: 0,
  },
});

export default CatalogOverwriteModal;
