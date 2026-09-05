import React from 'react';
import { StyleSheet, RefreshControl, ScrollView } from 'react-native';
import {
  Box, HStack, VStack, Text, Pressable, Icon, Center,
} from '@gluestack-ui/themed';
import { ArrowLeft, Plus, Coins, ChevronRight, Flame, TestTube } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { LAYOUT } from '../../constants/layout';
import GradientSurface from '../../components/common/GradientSurface';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchMeltLots, fetchCustomers, type MeltLot } from '../../store/data/dataSlice';
import { formatGrams } from '../../utils/dues';

const PURPLE = '#6366F1';

/**
 * Every lot still waiting on a reading, and the way back into one.
 *
 * This list is the whole reason a lot is a record rather than a form. The
 * readings are hours apart and the device is used for other work in between, so
 * "what is in the pot right now" has to be a question the app can answer
 * without the shopkeeper remembering whose gold it was.
 *
 * Open lots lead; tested ones follow as history, because a lot that has already
 * been credited is something you look up rather than act on.
 */
const MeltLotsScreen = () => {
  const navigation: any = useNavigation();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const lots = useAppSelector(s => s.data.meltLots);
  const customers = useAppSelector(s => s.data.customers);
  const gramShort = t('common.gramShort') || 'gm';
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(() => {
    // Everything, not just the open ones: this screen shows history underneath,
    // and a second request for it would make the two halves arrive apart.
    dispatch(fetchMeltLots({ status: undefined as any }));
    dispatch(fetchCustomers());
  }, [dispatch]);

  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchMeltLots({ status: undefined as any }) as any);
    setRefreshing(false);
  }, [dispatch]);

  const nameOf = React.useCallback(
    (customerId: string) => customers.find((c: any) => c.id === customerId)?.name || '—',
    [customers],
  );

  const open = lots.filter(l => l.status !== 'tested');
  const done = lots.filter(l => l.status === 'tested');

  /** The stage a lot is waiting on, which is the only thing it needs to say. */
  const waitingOn = (lot: MeltLot) =>
    lot.status === 'received'
      ? (t('melt.awaitingMelt') || 'Waiting to be melted')
      : (t('melt.awaitingTest') || 'Waiting on the test');

  const LotRow = ({ lot }: { lot: MeltLot }) => (
    <Pressable onPress={() => navigation.navigate('MeltLot', { lotId: lot.id })}>
      <HStack alignItems="center" py="$3.5" space="md">
        <Box
          w={40} h={40} rounded="$full"
          alignItems="center" justifyContent="center"
          bg={lot.status === 'received' ? '#EEF2FF' : lot.status === 'melted' ? '#FEF3C7' : '#F0FDF4'}
        >
          <Icon
            as={lot.status === 'received' ? Coins : lot.status === 'melted' ? Flame : TestTube}
            size="sm"
            color={lot.status === 'received' ? PURPLE : lot.status === 'melted' ? '#B45309' : '#15803D'}
          />
        </Box>

        <VStack flex={1}>
          <HStack alignItems="center" space="xs">
            <Text fontWeight="$bold" fontSize={15} color="#111827" numberOfLines={1} flexShrink={1}>
              {nameOf(lot.customerId)}
            </Text>
            <Text fontSize={12} color="$coolGray500">{lot.lotNumber}</Text>
          </HStack>
          <Text fontSize={12} color="$coolGray500" numberOfLines={1}>
            {lot.status === 'tested'
              ? `${t('melt.credited') || 'Credited'} ${formatGrams(lot.creditedWeight || 0, gramShort)}`
              : waitingOn(lot)}
          </Text>
        </VStack>

        <VStack alignItems="flex-end">
          {/* The most recent weighing, because that is what the next one gets
              compared against at the bench. */}
          <Text fontSize={14} fontWeight="$bold" color="#111827">
            {formatGrams(lot.afterTesting ?? lot.afterMelt ?? lot.potWeight, gramShort)}
          </Text>
          <Text fontSize={11} color="$coolGray400">
            {lot.afterTesting != null
              ? (t('melt.afterTesting') || 'After testing')
              : lot.afterMelt != null
                ? (t('melt.afterMelt') || 'After melting')
                : (t('melt.potWeight') || 'Into the pot')}
          </Text>
        </VStack>

        <Icon as={ChevronRight} size="sm" color="$coolGray400" />
      </HStack>
    </Pressable>
  );

  const Section = ({ title, rows }: { title: string; rows: MeltLot[] }) => (
    <Box mb="$5">
      <Text fontSize={12} fontWeight="$bold" color="$coolGray500" mb="$1" ml="$1">
        {title} ({rows.length})
      </Text>
      <Box bg="$white" rounded="$2xl" px="$4" style={styles.card}>
        {rows.map((lot, i) => (
          <Box key={lot.id} borderTopWidth={i === 0 ? 0 : 1} borderColor="#F3F4F6">
            <LotRow lot={lot} />
          </Box>
        ))}
      </Box>
    </Box>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>
      <HStack
        alignItems="center" px="$4" py="$3" bg="$white"
        borderBottomWidth={1} borderColor="#F3F4F6"
        style={LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}}
      >
        <Pressable onPress={() => navigation.goBack()} p="$2" mr="$1">
          <Icon as={ArrowLeft} size="lg" color="#111827" />
        </Pressable>
        <VStack flex={1}>
          <Text fontWeight="$bold" fontSize={20} color="#111827">
            {t('melt.listTitle') || 'Old Gold'}
          </Text>
          <Text fontSize={12} color="$coolGray500">
            {open.length} {t('melt.openLots') || 'lots open'}
          </Text>
        </VStack>
      </HStack>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 120,
          ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}),
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {open.length === 0 && done.length === 0 ? (
          <Center mt="$20">
            <VStack space="md" alignItems="center">
              <Box p="$5" bg="$coolGray100" rounded="$full">
                <Icon as={Coins} size="xl" color="$coolGray400" />
              </Box>
              <Text color="$coolGray400" fontWeight="$medium">
                {t('melt.noLots') || 'No melt lots yet'}
              </Text>
              <Text color="$coolGray400" fontSize={13} textAlign="center">
                {t('melt.noLotsHint') || 'Open a lot when a retailer hands over old ornaments'}
              </Text>
            </VStack>
          </Center>
        ) : (
          <>
            {open.length > 0 && (
              <Section title={t('melt.openSection') || 'OPEN'} rows={open} />
            )}
            {done.length > 0 && (
              <Section title={t('melt.creditedSection') || 'CREDITED'} rows={done} />
            )}
          </>
        )}
      </ScrollView>

      <Box
        bg="$white" px="$4" pt="$3" borderTopWidth={1} borderColor="#E5E7EB"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <Box style={LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}}>
          <Pressable onPress={() => navigation.navigate('TakeMelt')}>
            <Box height={54} rounded="$2xl" overflow="hidden" justifyContent="center" alignItems="center">
              <GradientSurface colors={['#6366F1', '#D946EF']} borderRadius={16} />
              <HStack alignItems="center" space="sm">
                <Icon as={Plus} color="$white" size="sm" />
                <Text color="$white" fontWeight="$bold" fontSize={16}>
                  {t('melt.newLot') || 'New Melt Lot'}
                </Text>
              </HStack>
            </Box>
          </Pressable>
        </Box>
      </Box>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  card: { elevation: 2, shadowOpacity: 0.06 },
});

export default MeltLotsScreen;
