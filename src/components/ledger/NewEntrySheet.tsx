import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Flame, UserPlus } from 'lucide-react-native';
import { useTranslation } from '../../hooks/useTranslation';
import { useSheetBottomInset } from '../../hooks/useSheetBottomInset';
import { useOldGoldMelt } from '../../hooks/useOldGoldMelt';
import { LAYOUT } from '../../constants/layout';
import { Brand } from '../../theme/brand';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** The add-retailer modal is owned by the tab host, so the sheet asks rather than renders it. */
  onAddRetailer: () => void;
};

type Option = {
  key: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  tone: 'out' | 'in' | 'melt' | 'neutral';
  label: string;
  hint: string;
  onPress: () => void;
};

const TONES = {
  out: { bg: Brand.dueSoft, fg: Brand.due },
  in: { bg: Brand.receivedSoft, fg: Brand.received },
  melt: { bg: Brand.goldSoft, fg: Brand.gold },
  neutral: { bg: Brand.primarySoft, fg: Brand.primary },
};

/**
 * What the centre New Entry button opens: every kind of entry a wholesaler
 * writes into the khata, from any tab.
 *
 * It replaced SoneBill's floating purple "+" on the dashboard, which offered
 * only New Order and New Customer and existed on one tab. A ledger is written
 * in many places, so the entry point lives in the tab bar.
 *
 * Arrows follow the khata: metal and cash going out to a retailer (a sale)
 * point up and away and are the colour of a due. What comes back in points
 * down and is green.
 *
 * Receiving is recorded against a sale, on the order screen. So "Receive"
 * picks the retailer first and opens their account, where the pending sales
 * are listed.
 */
export default function NewEntrySheet({ visible, onClose, onAddRetailer }: Props) {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const meltEnabled = useOldGoldMelt();
  // Bottom-anchored sheet: the padding must come from the inset, or the last
  // row sits under Android's three-button navigation bar (see CLAUDE.md).
  const bottomInset = useSheetBottomInset(20);

  const go = (fn: () => void) => () => {
    onClose();
    fn();
  };

  const options: Option[] = [
    {
      key: 'sale',
      icon: ArrowUpRight,
      tone: 'out',
      label: t('newEntry.sale') || 'New sale',
      hint: t('newEntry.saleHint') || 'Ornaments given to a retailer on account',
      onPress: go(() => navigation.navigate('NewOrder')),
    },
    {
      key: 'receive',
      icon: ArrowDownLeft,
      tone: 'in',
      label: t('newEntry.receive') || 'Receive gold or cash',
      hint: t('newEntry.receiveHint') || 'Record what a retailer paid against a sale',
      onPress: go(() => navigation.navigate('SelectCustomer', { next: 'CustomerDetails' })),
    },
    ...(meltEnabled
      ? [{
          key: 'melt',
          icon: Flame,
          tone: 'melt' as const,
          label: t('newEntry.melt') || 'Take old gold to melt',
          hint: t('newEntry.meltHint') || 'Weigh it now, credit it after testing',
          onPress: go(() => navigation.navigate('TakeMelt')),
        }]
      : []),
    {
      key: 'retailer',
      icon: UserPlus,
      tone: 'neutral',
      label: t('newEntry.retailer') || 'Add retailer',
      hint: t('newEntry.retailerHint') || 'A jewellery shop you supply',
      onPress: go(onAddRetailer),
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close') || 'Close'}>
        <View style={[styles.wrap, LAYOUT.isWeb && styles.wrapWeb]}>
          {/* Claims the touch so a press inside the sheet never reaches the
              backdrop's onClose. React Native has no event bubbling to stop. */}
          <Pressable style={[styles.sheet, { paddingBottom: bottomInset }]} onPress={() => {}}>
            <View style={styles.grabber} />
            <Text style={styles.title}>{t('newEntry.title') || 'New entry'}</Text>
            <Text style={styles.subtitle}>{t('newEntry.subtitle') || 'What do you want to record?'}</Text>
            {options.map((o, i) => {
              const tone = TONES[o.tone];
              const Icon = o.icon;
              return (
                <Pressable
                  key={o.key}
                  onPress={o.onPress}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.row,
                    i < options.length - 1 && styles.rowDivider,
                    pressed && styles.rowPressed,
                  ]}
                >
                  <View style={[styles.iconBox, { backgroundColor: tone.bg }]}>
                    <Icon size={20} color={tone.fg} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>{o.label}</Text>
                    <Text style={styles.rowHint}>{o.hint}</Text>
                  </View>
                  <ChevronRight size={18} color={Brand.inkFaint} />
                </Pressable>
              );
            })}
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(29, 27, 22, 0.45)',
  },
  wrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  wrapWeb: {
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: Brand.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Brand.line,
    marginBottom: 14,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: Brand.ink,
  },
  subtitle: {
    fontSize: 14,
    color: Brand.inkMuted,
    marginTop: 2,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.line,
  },
  rowPressed: {
    opacity: 0.6,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.ink,
  },
  rowHint: {
    fontSize: 13,
    color: Brand.inkMuted,
    marginTop: 2,
  },
});
