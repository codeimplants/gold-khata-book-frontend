import React from 'react';
import { Modal, StyleSheet } from 'react-native';
import {
  Box,
  HStack,
  VStack,
  Text,
  Pressable,
  Icon,
} from '@gluestack-ui/themed';
import { FileText, Clock, Scale } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from '../hooks/useTranslation';
import GradientSurface from './common/GradientSurface';
import { LAYOUT } from '../constants/layout';
import { Platform } from 'react-native';

interface OrderTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedCustomerId?: string;
}

const OrderTypeModal = ({ isOpen, onClose, preSelectedCustomerId }: OrderTypeModalProps) => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();

  const handleFullPayment = () => {
    onClose();
    if (preSelectedCustomerId) {
      navigation.navigate('CreateInvoice', { customerId: preSelectedCustomerId });
    } else {
      navigation.navigate('SelectCustomer', { next: 'CreateInvoice' });
    }
  };

  const handleAdvancePayment = () => {
    onClose();
    if (preSelectedCustomerId) {
      navigation.navigate('AdvanceOrder', { customerId: preSelectedCustomerId });
    } else {
      navigation.navigate('SelectCustomer', { next: 'AdvanceOrder' });
    }
  };

  // Buying old gold outright — nothing is sold in return, so this is neither a
  // full-payment invoice nor an advance order.
  const handleOldGoldPurchase = () => {
    onClose();
    if (preSelectedCustomerId) {
      navigation.navigate('OldGoldPurchase', { customerId: preSelectedCustomerId });
    } else {
      navigation.navigate('SelectCustomer', { next: 'OldGoldPurchase' });
    }
  };

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <Box
        flex={1}
        bg="rgba(0,0,0,0.45)"
        justifyContent="center"
        alignItems="center"
      >
        <Box
          bg="$white"
          style={[
            { borderRadius: 24, width: '90%' },
            LAYOUT.isWeb && { marginHorizontal: 'auto', width: '100%', maxWidth: 450 }
          ]}
          p="$6"
          pb="$2"
        >
          {/* Header */}
          <HStack justifyContent="center" alignItems="center" mb="$6">
            <Text fontSize={20} fontWeight="$bold">
              {t('orders.chooseType')}
            </Text>

            <Pressable
              position="absolute"
              right={0}
              onPress={onClose}
            >
              <Text fontSize={18}>✕</Text>
            </Pressable>
          </HStack>

          <VStack space="lg">
            {/* Full Payment */}
            <Pressable onPress={handleFullPayment}>
              <HStack
                bg="white"
                borderWidth={1}
                borderColor="$coolGray300"
                rounded="$2xl"
                p="$4"
                alignItems="center"
                space="md"
              >
                <Box style={styles.iconGradient}>
                  <GradientSurface colors={['#7B5CFF', '#FF4DA6']} borderRadius={16} />
                  <Icon as={FileText} color="$white" size="lg" />
                </Box>

                <VStack flex={1}>
                  <Text fontWeight="$bold" fontSize={16}>
                    {t('orders.fullPayment.title')}
                  </Text>
                  <Text color="$coolGray600" fontSize={13}>
                    {t('orders.fullPayment.desc')}
                  </Text>
                </VStack>
              </HStack>
            </Pressable>

            {/* Advance Payment */}
            <Pressable onPress={handleAdvancePayment}>
              <HStack
                bg="white"
                borderWidth={1}
                borderColor="$coolGray300"
                rounded="$2xl"
                p="$4"
                alignItems="center"
                space="md"
              >
                <Box style={styles.iconGradient}>
                  <GradientSurface colors={['#3EC7B7', '#2FAF8F']} borderRadius={16} />
                  <Icon as={Clock} color="$white" size="lg" />
                </Box>

                <VStack flex={1}>
                  <Text fontWeight="$bold" fontSize={16}>
                    {t('orders.advancePayment.title')}
                  </Text>
                  <Text color="$coolGray600" fontSize={13}>
                    {t('orders.advancePayment.desc')}
                  </Text>
                </VStack>
              </HStack>
            </Pressable>

            {/* Old Gold Purchase */}
            <Pressable onPress={handleOldGoldPurchase}>
              <HStack
                bg="white"
                borderWidth={1}
                borderColor="$coolGray300"
                rounded="$2xl"
                p="$4"
                alignItems="center"
                space="md"
              >
                <Box style={styles.iconGradient}>
                  <GradientSurface colors={['#F59E0B', '#D97706']} borderRadius={16} />
                  <Icon as={Scale} color="$white" size="lg" />
                </Box>

                <VStack flex={1}>
                  <Text fontWeight="$bold" fontSize={16}>
                    {t('declaration.entryTitle') || 'Old Gold Purchase'}
                  </Text>
                  <Text color="$coolGray600" fontSize={13}>
                    {t('declaration.entryDesc') || 'Buy old gold and print a declaration'}
                  </Text>
                </VStack>
              </HStack>
            </Pressable>
          </VStack>

          {/* Cancel */}
          <Pressable onPress={onClose} mt="$2" py="$2">
            <Box bg="$coolGray50" rounded="$xl" py="$3" alignItems="center">
              <Text fontWeight="$semibold" color="$coolGray800">
                {t('common.cancel')}
              </Text>
            </Box>
          </Pressable>
        </Box>
      </Box>
    </Modal>
  );
};

const styles = StyleSheet.create({
  iconGradient: {
    width: 56,
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullPaymentIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
  },
  advanceIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#14B8A6',
  },
});

export default OrderTypeModal;
