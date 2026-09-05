import React from 'react';
import { StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import {
  Box, HStack, VStack, Text, Pressable, Icon,
} from '@gluestack-ui/themed';
import { ArrowLeft, Check, Trash2 } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { LAYOUT } from '../../constants/layout';
import GradientSurface from '../../components/common/GradientSurface';
import FloatingLabelInput from '../../components/common/FloatingLabelInput';
import ConfirmModal from '../../components/ConfirmModal';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  fetchMeltLots, fetchCustomers, recordMeltStage, recordTestStage, deleteMeltLot,
} from '../../store/data/dataSlice';
import { toast, ToastViewport } from '../../components/common/Toast';
import { formatGrams } from '../../utils/dues';
import { priceMeltLot, SETTLEMENT_FINENESS } from '../../utils/goldPricing';

const num = (v: string) => Number(String(v ?? '').trim()) || 0;

/**
 * One melt lot, and whatever reading it is waiting on.
 *
 * The screen shows the stages already recorded and asks for exactly the next
 * one — a form that offered all three at once would invite someone to fill in a
 * test that has not happened yet, which is the failure this whole record exists
 * to prevent.
 *
 * The credit is issued by the TEST, on the server. Nothing here computes a
 * balance; the figures shown before saving are a preview of what the server
 * will work out, using the same inbound rule.
 */
const MeltLotScreen = () => {
  const navigation: any = useNavigation();
  const route: any = useRoute();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const lotId: string = route.params?.lotId;
  const lot = useAppSelector(s => s.data.meltLots.find(l => l.id === lotId));
  const customers = useAppSelector(s => s.data.customers);
  const gramShort = t('common.gramShort') || 'gm';

  const [afterMelt, setAfterMelt] = React.useState('');
  const [afterTesting, setAfterTesting] = React.useState('');
  const [purity, setPurity] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    // Arriving by deep link or after a cold start, the list may be empty.
    dispatch(fetchMeltLots({ status: undefined as any }));
    dispatch(fetchCustomers());
  }, [dispatch]);

  const retailerName = customers.find((c: any) => c.id === lot?.customerId)?.name || '—';

  /**
   * What the test WOULD credit, previewed as the figures are typed.
   *
   * Uses the same `priceMeltLot` the server's rule mirrors, so the number shown
   * before saving is the number that lands. The pot and melted weights come
   * from the record rather than the form — they were entered on other days.
   */
  const preview = React.useMemo(() => priceMeltLot({
    potWeight: lot?.potWeight || 0,
    afterMelt: lot?.afterMelt || 0,
    afterTesting: num(afterTesting),
    purity: num(purity),
  }), [lot, afterTesting, purity]);

  const stageError = React.useMemo(() => {
    if (!lot) return null;
    if (lot.status === 'received' && num(afterMelt) > 0 && num(afterMelt) > lot.potWeight) {
      return t('melt.meltAbovePot') || 'Weight after melting cannot exceed the pot weight';
    }
    if (lot.status === 'melted' && num(afterTesting) > 0 && num(afterTesting) > (lot.afterMelt || 0)) {
      return t('melt.testAboveMelt') || 'Weight after testing cannot exceed the melted weight';
    }
    if (num(purity) > 100) return t('melt.purityTooHigh') || 'Purity cannot exceed 100%';
    return null;
  }, [lot, afterMelt, afterTesting, purity, t]);

  const canSaveMelt = lot?.status === 'received' && num(afterMelt) > 0 && !stageError && !saving;
  const canSaveTest =
    lot?.status === 'melted' && num(afterTesting) > 0 && num(purity) > 0 && !stageError && !saving;

  const onRecordMelt = async () => {
    if (!lot || !canSaveMelt) return;
    setSaving(true);
    const action = await dispatch(recordMeltStage({ lotId: lot.id, afterMelt: num(afterMelt) }) as any);
    setSaving(false);
    if (recordMeltStage.fulfilled.match(action)) {
      setAfterMelt('');
      toast.success(t('melt.meltRecorded') || 'Melted weight recorded');
    } else {
      toast.error(String(action.payload || 'Could not record the melted weight'));
    }
  };

  const onRecordTest = async () => {
    if (!lot || !canSaveTest) return;
    setSaving(true);
    const action = await dispatch(recordTestStage({
      lotId: lot.id,
      customerId: lot.customerId,
      afterTesting: num(afterTesting),
      purity: num(purity),
    }) as any);
    setSaving(false);
    if (recordTestStage.fulfilled.match(action)) {
      toast.success(t('melt.credited') || 'Credited');
      navigation.goBack();
    } else {
      toast.error(String(action.payload || 'Could not record the test'));
    }
  };

  const onDelete = async () => {
    if (!lot) return;
    const action = await dispatch(deleteMeltLot(lot.id) as any);
    setConfirmDelete(false);
    if (deleteMeltLot.fulfilled.match(action)) {
      toast.success(t('melt.lotDeleted') || 'Lot deleted');
      navigation.goBack();
    } else {
      toast.error(String(action.payload || 'Could not delete the lot'));
    }
  };

  /** One recorded stage. Dashes for a reading that has not been taken. */
  const StageRow = ({ label, value, when }: { label: string; value?: number; when?: string }) => (
    <HStack justifyContent="space-between" alignItems="flex-start" py="$2">
      <VStack flex={1}>
        <Text fontSize={13} color="$coolGray700">{label}</Text>
        {!!when && (
          <Text fontSize={11} color="$coolGray400">
            {new Date(when).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </Text>
        )}
      </VStack>
      <Text fontSize={14} fontWeight="$bold" color={value != null ? '#111827' : '$coolGray300'}>
        {value != null ? formatGrams(value, gramShort) : '—'}
      </Text>
    </HStack>
  );

  if (!lot) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>
        <HStack alignItems="center" px="$4" py="$3" bg="$white">
          <Pressable onPress={() => navigation.goBack()} p="$2" mr="$1">
            <Icon as={ArrowLeft} size="lg" color="#111827" />
          </Pressable>
          <Text fontWeight="$bold" fontSize={18}>{t('melt.lotTitle') || 'Melt lot'}</Text>
        </HStack>
        <Box p="$6">
          <Text color="$coolGray500">{t('melt.lotNotFound') || 'This lot could not be found'}</Text>
        </Box>
      </SafeAreaView>
    );
  }

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
            {lot.lotNumber}
          </Text>
          <Text fontSize={12} color="$coolGray500" numberOfLines={1}>{retailerName}</Text>
        </VStack>
        {/* Only while open — the server refuses to delete a credited lot, and
            the button should not offer what the server will reject. */}
        {lot.status !== 'tested' && (
          <Pressable onPress={() => setConfirmDelete(true)} p="$2">
            <Icon as={Trash2} size="sm" color="#DC2626" />
          </Pressable>
        )}
      </HStack>

      {/* `height` on Android, never undefined — see the note in NewOrderScreen. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 40,
            ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}),
          }}
        >
          {/* The readings so far. Kept visible while the next one is typed —
              the melted weight is exactly what the tested weight gets sanity
              checked against at the bench. */}
          <Box bg="$white" p="$4" rounded="$2xl" borderWidth={1} borderColor="#E5E7EB" style={styles.card}>
            <Text fontWeight="$bold" mb="$2">{t('melt.stages') || 'Weighings'}</Text>
            <StageRow
              label={t('melt.potWeight') || 'Into the pot'}
              value={lot.potWeight}
              when={lot.receivedAt}
            />
            <Box h={1} bg="#F3F4F6" />
            <StageRow
              label={t('melt.afterMelt') || 'After melting'}
              value={lot.afterMelt}
              when={lot.meltedAt}
            />
            <Box h={1} bg="#F3F4F6" />
            <StageRow
              label={t('melt.afterTesting') || 'After testing'}
              value={lot.afterTesting}
              when={lot.testedAt}
            />

            {lot.status === 'tested' && (
              <Box mt="$3" pt="$3" borderTopWidth={1} borderColor="#F3F4F6">
                <HStack justifyContent="space-between">
                  <Text fontSize={13} color="$coolGray600">
                    {`${t('melt.fineAt999') || 'Fine 99.9'} (${lot.purity}%)`}
                  </Text>
                  <Text fontSize={13} fontWeight="$bold" color="#111827">
                    {formatGrams(lot.fine999 || 0, gramShort)}
                  </Text>
                </HStack>
                <HStack justifyContent="space-between" mt="$1">
                  <Text fontSize={13} color="$coolGray600">
                    {`${t('melt.creditAt995') || 'Credit'} (${SETTLEMENT_FINENESS})`}
                  </Text>
                  <Text fontSize={13} fontWeight="$bold" color="#15803D">
                    {formatGrams(lot.creditedWeight || 0, gramShort)}
                  </Text>
                </HStack>
              </Box>
            )}

            {!!lot.notes && (
              <Text fontSize={12} color="$coolGray400" mt="$3" fontStyle="italic">
                {lot.notes}
              </Text>
            )}
          </Box>

          {/* Stage 2 */}
          {lot.status === 'received' && (
            <Box bg="$white" p="$4" rounded="$2xl" mt="$4" borderWidth={1} borderColor="#E5E7EB" style={styles.card}>
              <Text fontWeight="$bold" mb="$1">{t('melt.recordMelt') || 'Record the melted weight'}</Text>
              <Text fontSize={12} color="$coolGray500" mb="$3">
                {t('melt.afterMeltHint') || 'The lagdi, once impurities have burnt off'}
              </Text>

              <FloatingLabelInput
                label={`${t('melt.afterMelt') || 'After melting'} (${gramShort})`}
                required
                keyboardType="decimal-pad"
                value={afterMelt}
                onChangeText={setAfterMelt}
              />

              {!!stageError && (
                <Text fontSize={12} color="#B91C1C" mt="$2">{stageError}</Text>
              )}

              <Pressable onPress={onRecordMelt} disabled={!canSaveMelt} style={{ marginTop: 16 }}>
                <Box height={50} rounded="$xl" overflow="hidden" justifyContent="center" alignItems="center">
                  {canSaveMelt
                    ? <GradientSurface colors={['#6366F1', '#D946EF']} borderRadius={12} />
                    : <Box position="absolute" top={0} left={0} right={0} bottom={0} bg="#E5E7EB" />}
                  <Text color={canSaveMelt ? '$white' : '$coolGray400'} fontWeight="$bold" fontSize={15}>
                    {saving ? (t('common.saving') || 'Saving…') : (t('melt.saveMelt') || 'Save melted weight')}
                  </Text>
                </Box>
              </Pressable>
            </Box>
          )}

          {/* Stage 3 — the one that closes the lot and moves metal onto an
              account, so what it will credit is spelled out before the tap. */}
          {lot.status === 'melted' && (
            <Box bg="$white" p="$4" rounded="$2xl" mt="$4" borderWidth={1} borderColor="#E5E7EB" style={styles.card}>
              <Text fontWeight="$bold" mb="$1">{t('melt.recordTest') || 'Record the test'}</Text>
              <Text fontSize={12} color="$coolGray500" mb="$3">
                {t('melt.afterTestingHint') || 'Skin test and rubbing take a little more off'}
              </Text>

              <HStack space="md">
                <FloatingLabelInput
                  label={`${t('melt.afterTesting') || 'After testing'} (${gramShort})`}
                  required
                  keyboardType="decimal-pad"
                  value={afterTesting}
                  onChangeText={setAfterTesting}
                />
                <FloatingLabelInput
                  label={t('melt.purity') || 'Purity (%)'}
                  required
                  keyboardType="decimal-pad"
                  value={purity}
                  onChangeText={setPurity}
                />
              </HStack>

              {!!stageError && (
                <Text fontSize={12} color="#B91C1C" mt="$2">{stageError}</Text>
              )}

              {num(afterTesting) > 0 && num(purity) > 0 && !stageError && (
                <Box mt="$4" pt="$3" borderTopWidth={1} borderColor="#F3F4F6">
                  <HStack justifyContent="space-between">
                    <Text fontSize={12} color="$coolGray500">{t('melt.meltLoss') || 'Lost in the pot'}</Text>
                    <Text fontSize={12} color="$coolGray600">−{formatGrams(preview.meltLoss, gramShort)}</Text>
                  </HStack>
                  <HStack justifyContent="space-between" mt="$1">
                    <Text fontSize={12} color="$coolGray500">{t('melt.testLoss') || 'Lost in testing'}</Text>
                    <Text fontSize={12} color="$coolGray600">−{formatGrams(preview.testLoss, gramShort)}</Text>
                  </HStack>
                  <HStack justifyContent="space-between" mt="$2">
                    <Text fontSize={13} color="$coolGray600">
                      {`${t('melt.fineAt999') || 'Fine 99.9'}  (${num(afterTesting)} × ${num(purity)}%)`}
                    </Text>
                    <Text fontSize={13} fontWeight="$bold" color="#111827">
                      {formatGrams(preview.fine999, gramShort)}
                    </Text>
                  </HStack>
                  {/* The account is denominated at 99.50 and metal bought IN
                      converts by a flat trade uplift, so the credit comes out
                      slightly ABOVE the tested fine weight. Shown rather than
                      done quietly — it looks wrong until you can see why. */}
                  <HStack justifyContent="space-between" mt="$1">
                    <Text fontSize={13} color="$coolGray600">
                      {`${t('melt.creditAt995') || 'Credit'} (${SETTLEMENT_FINENESS})`}
                    </Text>
                    <Text fontSize={13} fontWeight="$bold" color="#15803D">
                      {formatGrams(preview.fine995, gramShort)}
                    </Text>
                  </HStack>
                </Box>
              )}

              <Pressable onPress={onRecordTest} disabled={!canSaveTest} style={{ marginTop: 16 }}>
                <Box height={50} rounded="$xl" overflow="hidden" justifyContent="center" alignItems="center">
                  {canSaveTest
                    ? <GradientSurface colors={['#15803D', '#22C55E']} borderRadius={12} />
                    : <Box position="absolute" top={0} left={0} right={0} bottom={0} bg="#E5E7EB" />}
                  <HStack alignItems="center" space="sm">
                    {canSaveTest && <Icon as={Check} size="xs" color="$white" />}
                    <Text color={canSaveTest ? '$white' : '$coolGray400'} fontWeight="$bold" fontSize={15}>
                      {saving ? (t('common.saving') || 'Saving…') : (t('melt.saveTest') || 'Test & credit')}
                    </Text>
                  </HStack>
                </Box>
              </Pressable>
            </Box>
          )}

          {lot.status === 'tested' && (
            <Box mt="$4" px="$1">
              <Text fontSize={12} color="$coolGray500">
                {t('melt.lotClosed') || 'This lot is closed. The credit is on the retailer’s account.'}
              </Text>
            </Box>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmModal
        visible={confirmDelete}
        tone="warning"
        title={t('melt.deleteTitle') || 'Delete this lot?'}
        description={t('melt.deleteDesc') || 'The weighings recorded so far will be lost. Nothing has been credited yet.'}
        confirmLabel={t('common.delete') || 'Delete'}
        cancelLabel={t('common.cancel') || 'Cancel'}
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDelete}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  card: { elevation: 2, shadowOpacity: 0.06 },
});

export default MeltLotScreen;
