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
import { LogIn } from 'lucide-react-native';
import { useTranslation } from '../hooks/useTranslation';

interface LoginRequiredModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const LoginRequiredModal: React.FC<LoginRequiredModalProps> = ({
  visible,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();

  const title = t('loginRequiredTitle') || 'Login Required';
  const description =
    t('loginRequiredDescription') ||
    'Uploading a logo, header, or signature image requires an account so it can be saved securely to your shop.';
  const cancelLabel = t('common.cancel') || 'Cancel';
  const confirmLabel = t('loginRequiredConfirm') || 'Login';

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
              bg="$purple100"
              alignItems="center"
              justifyContent="center"
            >
              <Icon as={LogIn} size="lg" color="$purple600" />
            </Box>
            <Text fontSize={18} fontWeight="$bold" flex={1}>
              {title}
            </Text>
          </HStack>

          <Text fontSize={14} color="$coolGray600">
            {description}
          </Text>

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

export default LoginRequiredModal;
