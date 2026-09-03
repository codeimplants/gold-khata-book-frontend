import React from 'react';
import { Box, HStack, VStack, Text, Pressable, Icon } from '@gluestack-ui/themed';
import { User, Phone, RefreshCw } from 'lucide-react-native';
import { useTranslation } from '../../hooks/useTranslation';
import CustomerCodeBadge from '../customers/CustomerCodeBadge';

interface CustomerInfoCardProps {
  customer: {
    name: string;
    /** Optional — a walk-in may not have given one. */
    phone?: string;
    /** Per-shop code. Confirms which of two same-named customers this
     *  document is being raised against. */
    customerCode?: string;
  } | null | undefined;
  onChangeCustomer: () => void;
  /** Hides the "Change" action — customer reassignment isn't supported when editing an existing order/invoice. */
  readOnly?: boolean;
}

const CustomerInfoCard = ({ customer, onChangeCustomer, readOnly }: CustomerInfoCardProps) => {
  const { t } = useTranslation();

  if (!customer) return null;

  return (
    <Box bg="$white" rounded="$2xl" p="$4" mb="$0" borderWidth={1} borderColor="$coolGray100" shadowColor="#000" shadowOffset={{ width: 0, height: 1 }} shadowOpacity={0.05} elevation={2}>
      <HStack alignItems="center" justifyContent="space-between">
        {/* flex + shrink so a long name yields to the Change button instead of
            pushing it off the card. */}
        <HStack alignItems="center" space="md" flex={1} mr="$2">
          <Box w={44} h={44} rounded="$full" bg="#f0edff" alignItems="center" justifyContent="center">
            <Icon as={User} size="md" color="#7857ff" />
          </Box>
          <VStack flexShrink={1}>
            <HStack alignItems="center" space="xs">
              <Text fontWeight="$bold" color="$coolGray900" fontSize={16} flexShrink={1} numberOfLines={1}>
                {customer.name}
              </Text>
              <CustomerCodeBadge code={customer.customerCode} />
            </HStack>
            <HStack alignItems="center" space="xs">
              <Icon as={Phone} size={12} color="$coolGray400" />
              {customer.phone ? (
                <Text fontSize={13} color="$coolGray500">
                  {customer.phone}
                </Text>
              ) : (
                <Text fontSize={13} color="$coolGray400" fontStyle="italic">
                  {t('customers.noPhone') || 'No phone number'}
                </Text>
              )}
            </HStack>
          </VStack>
        </HStack>

        {!readOnly && (
          <Pressable
            onPress={onChangeCustomer}
            bg="$coolGray50"
            px="$3"
            py="$1.5"
            rounded="$lg"
            borderWidth={1}
            borderColor="$coolGray200"
          >
            <HStack alignItems="center" space="xs">
              {/* <Icon as={RefreshCw} size="xs" color="#6B7280" /> */}
              <Text fontSize={12} color="$primary" fontWeight="$medium">
                {t('common.change') || 'Change'}
              </Text>
            </HStack>
          </Pressable>
        )}
      </HStack>
    </Box>
  );
};

export default CustomerInfoCard;
