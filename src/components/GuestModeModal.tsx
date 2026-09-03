import React from 'react';
import { Modal } from 'react-native';
import {
  Box,
  VStack,
  HStack,
  Text,
  Pressable,
  Icon,
} from '@gluestack-ui/themed';
import { AlertCircle } from 'lucide-react-native';
import { useTranslation } from '../hooks/useTranslation';

interface GuestModeModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const GuestModeModal: React.FC<GuestModeModalProps> = ({
  visible,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();

  const title =
    t('guestModeNotice') || 'Using Gold Khata Book in Guest Mode';
  const description =
    t('guestModeNoticeDescription') ||
    'In guest mode, your shop, retailer and order data is stored only on this device and is not backed up to any server.';
  const dataStorageTitle =
    t('guestModeDataStorage') || 'How guest mode stores your data';
  const point1 =
    t('guestModeDataLocalOnly') ||
    'All data is stored locally on this device only.';
  const point2 =
    t('guestModeDataTemporary') ||
    'If the app is uninstalled or device data is cleared, your records will be lost.';
  const point3 =
    t('guestModeDataDeleted') ||
    'To keep your data long term, create an account and login later.';
  const cancelLabel = t('common.cancel') || 'Cancel';
  const confirmLabel =
    t('okayLetMeContinue') || 'Okay, continue as guest';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Box flex={1} bg="rgba(0,0,0,0.4)" justifyContent="center" alignItems="center">
        <Box
          w="90%"
          bg="$white"
          rounded="$2xl"
          p="$5"
          style={{ maxWidth: 400 }}
        >
          <HStack space="md" alignItems="center" mb="$3">
            <Box
              w={48}
              h={48}
              rounded="$full"
              bg="$amber100"
              alignItems="center"
              justifyContent="center"
            >
              <Icon as={AlertCircle} size="lg" color="$amber600" />
            </Box>
            <Text fontSize={18} fontWeight="$bold" flex={1}>
              {title}
            </Text>
          </HStack>

          <VStack space="md">
            <Text fontSize={14} color="$coolGray600">
              {description}
            </Text>

            <Box bg="$coolGray100" rounded="$lg" p="$3">
              <Text fontSize={14} fontWeight="$semibold" mb="$2">
                {dataStorageTitle}
              </Text>
              <VStack space="xs">
                <Text fontSize={13} color="$coolGray700">
                  • {point1}
                </Text>
                <Text fontSize={13} color="$coolGray700">
                  • {point2}
                </Text>
                <Text fontSize={13} color="$coolGray700">
                  • {point3}
                </Text>
              </VStack>
            </Box>
          </VStack>

          <HStack mt="$5" space="md">
            <Pressable
              flex={1}
              onPress={onCancel}
            >
              <Box
                rounded="$xl"
                borderWidth={1}
                borderColor="$coolGray300"
                py="$3"
                alignItems="center"
              >
                <Text fontWeight="$medium" color="$coolGray800">
                  {cancelLabel}
                </Text>
              </Box>
            </Pressable>

            <Pressable
              flex={1}
              onPress={onConfirm}
            >
              <Box
                rounded="$xl"
                py="$3"
                alignItems="center"
                bg="$purple600"
              >
                <Text fontWeight="$bold" color="$white">
                  {confirmLabel}
                </Text>
              </Box>
            </Pressable>
          </HStack>
        </Box>
      </Box>
    </Modal>
  );
};

export default GuestModeModal;

