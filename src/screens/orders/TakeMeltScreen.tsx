import React from 'react';
import { StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import {
  Box, HStack, VStack, Text, Pressable, Icon,
} from '@gluestack-ui/themed';
import { ArrowLeft, Calendar } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { LAYOUT } from '../../constants/layout';
import CustomerInfoCard from '../../components/common/CustomerInfoCard';
import GradientSurface from '../../components/common/GradientSurface';
import DatePickerModal from '../../components/common/DatePickerModal';
import FloatingLabelInput from '../../components/common/FloatingLabelInput';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { createMeltLot, fetchCustomers, fetchRetailerAccount } from '../../store/data/dataSlice';
import { toast, ToastViewport } from '../../components/common/Toast';
import { formatGrams } from '../../utils/dues';

const PURPLE = '#6366F1';

const num = (v: string) => Number(String(v ?? '').trim()) || 0;

/**
 * Opening a melt lot — stage one of three, and the only one that happens at
 * the counter.
 *
 * This screen used to ask for all four readings at once and credit the retailer
 * on save. It could not work: the ornaments go into the pot, the lagdi is
 * tested hours later, and the same device raises other bills in between. The
 * lot is now a record that gets picked up again — melted weight, then test —
 * from the Old Gold list.
 *
 * Nothing is credited here. A lot in the pot is ornaments the shop is holding,
 * not credit the retailer has: the fine weight is not knowable until the purity
 * is, and quoting one before the test would be inventing a number.
 */
const TakeMeltScreen = () => {
  const navigation: any = useNavigation();
  const route: any = useRoute();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const customers = useAppSelector(s => s.data.customers);
  const gramShort = t('common.gramShort') || 'gm';

  const [customerId, setCustomerId] = React.useState<string | undefined>(route.params?.customerId);
  /** Stage 1: what actually goes into the pot, stones and lac already off. */
  const [potWeight, setPotWeight] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [date, setDate] = React.useState(() => new Date().toISOString().split('T')[0]);
  const [datePickerOpen, setDatePickerOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    dispatch(fetchCustomers());
  }, [dispatch]);

  // SelectCustomer hands its answer back on params, the same as the order
  // screen — it navigates back to this route rather than returning a value.
  React.useEffect(() => {
    const chosen = route.params?.customerId;
    if (chosen && chosen !== customerId) setCustomerId(chosen);
  }, [route.params?.customerId, customerId]);

  // Retailer first: whose ornaments these are cannot be filled in later,
  // because the lot has to belong to somebody from the moment it is opened.
  // `replace` so Back from the picker leaves rather than bouncing back in.
  React.useEffect(() => {
    if (!customerId) {
      navigation.replace('SelectCustomer', { next: 'TakeMelt' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!customerId) return;
    dispatch(fetchRetailerAccount({ customerId }));
  }, [dispatch, customerId]);

  const retailer = customers.find((c: any) => c.id === customerId);

  /** What this retailer already holds, so a new lot lands on top of a running
   *  balance rather than in isolation. */
  const heldCredit = useAppSelector(
    s => (customerId ? s.data.retailerAccounts[customerId]?.meltCredit : 0) || 0,
  );

  const entered = num(potWeight);
  const canSave = !!customerId && entered > 0 && !saving;

  const onSave = async () => {
    if (!customerId) {
      toast.error(t('orders.selectRetailerFirst') || 'Choose a retailer first');
      return;
    }
    if (entered <= 0) {
      toast.error(t('melt.needPotWeight') || 'Enter the weight going into the pot');
      return;
    }

    setSaving(true);
    const action = await dispatch(createMeltLot({
      customerId,
      potWeight: entered,
      receivedAt: date,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    }) as any);
    setSaving(false);

    if (createMeltLot.fulfilled.match(action)) {
      toast.success(t('melt.lotOpened') || 'Lot opened');
      // Into the lot rather than back out: someone who has just taken ornamentsin
      // usually wants to see the record they now have to come back to.
      navigation.replace('MeltLot', { lotId: (action.payload as any).id });
    } else {
      toast.error(String(action.payload || t('melt.failed') || 'Could not open the lot'));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>
      <ToastViewport />

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
            {t('melt.newLot') || 'New Melt Lot'}
          </Text>
          <Text fontSize={12} color="$coolGray500">
            {t('melt.newLotSub') || 'Step 1 of 3 — weigh into the pot'}
          </Text>
        </VStack>
      </HStack>

      {/* `height` on Android, never undefined — see the note in NewOrderScreen. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 140,
            ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}),
          }}
        >
          <Box mb="$4">
            <CustomerInfoCard
              customer={retailer as any}
              onChangeCustomer={() =>
                navigation.navigate('SelectCustomer', { next: 'TakeMelt' })
              }
            />
          </Box>

          {/* Back-dating: ornaments are often written up after the counter has
              quietened down, and the lot belongs to the day it came in. */}
          <Pressable onPress={() => setDatePickerOpen(true)} mb="$4">
            <HStack alignItems="center" justifyContent="space-between" px="$1">
              <Text fontSize={12} color="$coolGray500" fontWeight="$semibold">
                {t('melt.receivedOn') || 'Received on'}
              </Text>
              <HStack alignItems="center" space="xs">
                <Icon as={Calendar} size="xs" color="$coolGray600" />
                <Text fontSize={14} fontWeight="$bold" color="#111827">
                  {date === new Date().toISOString().split('T')[0]
                    ? (t('common.today') || 'Today')
                    : new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
              </HStack>
            </HStack>
          </Pressable>

          <Box bg="$white" p="$4" rounded="$2xl" borderWidth={1} borderColor="#E5E7EB" style={styles.card}>
            <Text fontWeight="$bold" mb="$1">{t('melt.lotTitle') || 'Melt lot'}</Text>
            <Text fontSize={12} color="$coolGray500" mb="$3">
              {t('melt.stage1Hint') || 'The melted and tested weights are recorded later, from the Old Gold list'}
            </Text>

            <FloatingLabelInput
              label={`${t('melt.potWeight') || 'Into the pot'} (${gramShort})`}
              required
              keyboardType="decimal-pad"
              value={potWeight}
              onChangeText={setPotWeight}
            />
            <Text fontSize={11} color="$coolGray400" mt="$1" ml="$1">
              {t('melt.potHint') || 'After stones, lac and attachments are off'}
            </Text>

            {/* What the lot actually was. The weights carry the balance, but a
                lot with no description is unarguable months later, which is
                exactly when it gets argued about. */}
            <Box mt="$3">
              <FloatingLabelInput
                label={t('melt.notes') || 'Notes'}
                value={notes}
                onChangeText={setNotes}
              />
              <Text fontSize={11} color="$coolGray400" mt="$1" ml="$1">
                {t('melt.notesHint') || 'e.g. 3 bangles, tested 91.6'}
              </Text>
            </Box>
          </Box>

          {heldCredit > 0 && (
            <Box mt="$3" px="$1">
              <Text fontSize={12} color="$coolGray500">
                {t('melt.alreadyHolding') || 'Already holding'} {formatGrams(heldCredit, gramShort)}
              </Text>
            </Box>
          )}
        </ScrollView>

        <Box
          bg="$white" px="$4" pt="$3" borderTopWidth={1} borderColor="#E5E7EB"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <Box style={LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}}>
            <HStack justifyContent="space-between" alignItems="center" mb="$3">
              <VStack>
                <Text fontSize={11} color="$coolGray500">
                  {t('melt.intoPot') || 'INTO THE POT'}
                </Text>
                <Text fontSize={19} fontWeight="$black" color={PURPLE}>
                  {formatGrams(entered, gramShort)}
                </Text>
              </VStack>
            </HStack>

            <Pressable onPress={onSave} disabled={!canSave}>
              <Box height={54} rounded="$2xl" overflow="hidden" justifyContent="center" alignItems="center">
                {canSave
                  ? <GradientSurface colors={['#6366F1', '#D946EF']} borderRadius={16} />
                  : <Box position="absolute" top={0} left={0} right={0} bottom={0} bg="#E5E7EB" />}
                <Text color={canSave ? '$white' : '$coolGray400'} fontWeight="$bold" fontSize={16}>
                  {saving
                    ? (t('common.saving') || 'Saving…')
                    : (t('melt.openLot') || 'Open Lot')}
                </Text>
              </Box>
            </Pressable>
          </Box>
        </Box>
      </KeyboardAvoidingView>

      <DatePickerModal
        isOpen={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        date={date}
        onSelect={(d: string) => { setDate(d); setDatePickerOpen(false); }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  card: { elevation: 2, shadowOpacity: 0.06 },
});

export default TakeMeltScreen;
