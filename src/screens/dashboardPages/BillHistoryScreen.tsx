import React, { useMemo, useState, useCallback } from 'react';
import { Box, Input, InputField, Text, VStack, Center, Icon } from '@gluestack-ui/themed';
import { RefreshControl, FlatList, StyleSheet, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FileText, Search, User, Calendar, ChevronRight, Trash2 } from 'lucide-react-native';
import CommonHeader from '../../components/CommonHeader';
import WatchTutorialLink from '../../components/common/WatchTutorialLink';
import { HELP_TOPICS } from '../../tutorials/catalog';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { useTranslation } from '../../hooks/useTranslation';
import { fetchOrders, deleteInvoice } from '../../store/data/dataSlice';
import { toast } from '../../components/common/Toast';
import { INPUT_LIMITS } from '../../constants/inputLimits';
import { LAYOUT } from '../../constants/layout';
import { formatOrderDateTime } from '../../utils/formatter';

const BillItemCard = React.memo(({ bill, customerName, onPress, onDelete }: any) => {
  return (
    <Box style={{ position: 'relative', marginBottom: 12 }}>
      <Pressable onPress={onPress}>
        <Box
          bg="$white"
          rounded="$xl"
          p="$4"
          borderWidth={1}
          borderColor="$coolGray100"
          style={styles.card}
        >
          <HStack justifyContent="space-between" alignItems="center">
            <VStack space="xs" flex={1}>
              <Text fontWeight="$bold" fontSize={16} color="$coolGray900">
                {bill.invoiceNumber || bill.orderNumber || bill.id.slice(-6).toUpperCase()}
              </Text>
              <HStack alignItems="center" space="xs">
                <Icon as={User} size="xs" color="#6B7280" />
                <Text color="$coolGray600" fontSize={13}>
                  {customerName}
                </Text>
              </HStack>
            </VStack>
            <VStack alignItems="flex-end" space="xs" mr={bill.type === 'full' ? '$8' : '$2'}>
              <Text color="#059669" fontWeight="$black" fontSize={17}>
                ₹{(Number(bill.amount) || 0).toLocaleString('en-IN')}
              </Text>
              <HStack alignItems="center" space="xs">
                <Icon as={Calendar} size="xs" color="#6B7280" />
                <Text color="$coolGray500" fontSize={11}>
                  {formatOrderDateTime(bill.date, bill.createdAt)}
                </Text>
              </HStack>
            </VStack>
            <Icon as={ChevronRight} color="#D1D5DB" size="sm" />
          </HStack>
        </Box>
      </Pressable>
      {bill.type === 'full' && (
        <Pressable
          style={{ position: 'absolute', top: 12, right: 12, padding: 6 }}
          onPress={onDelete}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Trash2 size={16} color="#EF4444" />
        </Pressable>
      )}
    </Box>
  );
});

// Since HStack is from gluestack and I used it in OrderItemCard, I should make sure it's imported or use View
import { HStack } from '@gluestack-ui/themed';

const BillHistoryScreen = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [q, setQ] = useState('');
  const { orders, customers } = useAppSelector((state) => state.data);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchOrders({ force: true }));
    setRefreshing(false);
  }, [dispatch]);

  const getCustomerInfo = useCallback((id: string) => {
    const customer = customers.find(c => c.id === id);
    return {
      name: customer ? customer.name : 'Unknown',
      // `|| ''`, not `customer.phone` — a customer saved without a number would
      // otherwise put a literal "undefined" on the reprinted bill.
      phone: customer?.phone || ''
    };
  }, [customers]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return orders;
    return orders.filter(o => {
      const { name, phone } = getCustomerInfo(o.customerId);
      return (
        o.id.toLowerCase().includes(s) ||
        o.invoiceNumber?.toLowerCase().includes(s) ||
        o.orderNumber?.toLowerCase().includes(s) ||
        name.toLowerCase().includes(s) ||
        phone.includes(s)
      );
    });
  }, [q, orders, getCustomerInfo]);

  const handleDeleteInvoice = useCallback((invoiceId: string, invoiceNumber: string) => {
    Alert.alert(
      'Delete Invoice',
      `Delete invoice ${invoiceNumber}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await dispatch(deleteInvoice(invoiceId));
            if (deleteInvoice.fulfilled.match(result)) {
              toast.success('Invoice deleted');
            } else {
              toast.error((result.payload as string) || 'Failed to delete invoice');
            }
          },
        },
      ]
    );
  }, [dispatch]);

  const renderItem = useCallback(({ item }: { item: any }) => {
    const info = getCustomerInfo(item.customerId);
    return (
      <BillItemCard
        bill={item}
        customerName={info.name}
        onPress={() => navigation.navigate('OrderDetails', { orderId: item.id })}
        onDelete={() => handleDeleteInvoice(item.id, item.invoiceNumber || item.id.slice(-6).toUpperCase())}
        t={t}
      />
    );
  }, [getCustomerInfo, navigation, t, handleDeleteInvoice]);

  const keyExtractor = useCallback((item: any) => item.id, []);

  return (
    <Box flex={1} bg="#F9FAFB">
      <CommonHeader 
        title={t('orders.historyTitle')}
        showBack
        onPressBack={() => navigation.goBack()}
        helpTopic={HELP_TOPICS.billHistory}
      />

      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        // Bills stay tappable while the search keyboard is open.
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 100, ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}) }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <VStack space="md" mb="$4">
            <HStack justifyContent="space-between" alignItems="center">
              <Text color="$coolGray500" fontWeight="$medium">
                {orders.length} {t('orders.total')}
              </Text>
            </HStack>

            <Box bg="$white" rounded="$2xl" px="$4" py="$1" style={styles.card}>
              <HStack alignItems="center">
                <Icon as={Search} color="#9CA3AF" size="sm" />
                <Input variant="outline" flex={1} ml="$1" borderWidth={0}>
                  <InputField
                    placeholder={t('orders.search')}
                    value={q}
                    onChangeText={setQ}
                    maxLength={INPUT_LIMITS.searchQuery}
                    fontSize={14}
                  />
                </Input>
              </HStack>
            </Box>
          </VStack>
        }
        ListEmptyComponent={
          <Center mt="$20">
            <VStack space="md" alignItems="center">
              <Box p="$5" bg="$coolGray100" rounded="$full">
                <Icon as={FileText} size="xl" color="$coolGray400" />
              </Box>
              <Text color="$coolGray500" fontWeight="$bold">
                {t('orders.historyEmpty')}
              </Text>
              <WatchTutorialLink topic={HELP_TOPICS.billHistory} />
            </VStack>
          </Center>
        }
        initialNumToRender={15}
        windowSize={5}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
      />
    </Box>
  );
};

const styles = StyleSheet.create({
  card: {
    elevation: 2,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});

export default BillHistoryScreen;
