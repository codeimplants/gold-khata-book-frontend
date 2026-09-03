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
import { Fingerprint } from 'lucide-react-native';
import { useTranslation } from '../hooks/useTranslation';

interface BiometricsEnableModalProps {
  visible: boolean;
  onEnable: () => void;
  onSkip: () => void;
  loading?: boolean;
  biometryLabel?: string;
}

const BiometricsEnableModal: React.FC<BiometricsEnableModalProps> = ({
  visible,
  onEnable,
  onSkip,
  loading = false,
  biometryLabel,
}) => {
  const { t } = useTranslation();

  const title = t('biometricsPrompt.title') || 'Enable Biometric Lock?';
  const description = biometryLabel
    ? `Use ${biometryLabel} to protect your shop data so only you can open Gold Khata Book.`
    : t('biometricsPrompt.description') ||
      'Protect your shop data with Face ID or fingerprint so only you can open Gold Khata Book.';
  const skipLabel = t('biometricsPrompt.skip') || 'Skip for now';
  const enableLabel = t('biometricsPrompt.enable') || 'Enable';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onSkip}
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
              <Icon as={Fingerprint} size="lg" color="$purple600" />
            </Box>
            <Text fontSize={18} fontWeight="$bold" flex={1}>
              {title}
            </Text>
          </HStack>

          <VStack space="md">
            <Text fontSize={14} color="$coolGray600">
              {description}
            </Text>
          </VStack>

          <HStack mt="$5" space="md">
            <Pressable
              flex={1}
              onPress={onSkip}
              disabled={loading}
            >
              <Box
                rounded="$xl"
                borderWidth={1}
                borderColor="$coolGray300"
                py="$3"
                alignItems="center"
                opacity={loading ? 0.6 : 1}
              >
                <Text fontWeight="$medium" color="$coolGray800">
                  {skipLabel}
                </Text>
              </Box>
            </Pressable>

            <Pressable
              flex={1}
              onPress={onEnable}
              disabled={loading}
            >
              <Box
                rounded="$xl"
                py="$3"
                alignItems="center"
                bg="$purple600"
                opacity={loading ? 0.6 : 1}
              >
                <Text fontWeight="$bold" color="$white">
                  {enableLabel}
                </Text>
              </Box>
            </Pressable>
          </HStack>
        </Box>
      </Box>
    </Modal>
  );
};

export default BiometricsEnableModal;
