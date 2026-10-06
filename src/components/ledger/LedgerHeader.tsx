import React from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { BannerHeightContext } from '../../navigation/MainTabs';
import { LAYOUT, useContentContainerStyle } from '../../constants/layout';
import { Brand } from '../../theme/brand';
import { KeriMotif } from './Motifs';

type Props = {
  title: string;
  /** One line under the title: the shop's name, or a count such as "5 retailers". */
  subtitle?: string;
  /** Actions on the right. Use LedgerHeaderAction for plain icon or text buttons. */
  right?: React.ReactNode;
  /** Shows a back arrow before the title. For a ledger screen pushed onto the stack, not a tab. */
  onBack?: () => void;
};

/**
 * The one header every tab uses.
 *
 * Each tab used to draw its own header, inherited from SoneBill: an 84pt
 * gradient band in a different colour per tab (violet-pink, teal, orange,
 * slate), with a centred title and translucent pill buttons. That per-tab
 * rainbow was a large part of why App Review saw this app as SoneBill
 * repackaged (guideline 4.3(a), APP_STORE_4.3_REWORK.md).
 *
 * The Ledger header is the same on every tab. It is solid emerald with a
 * left-aligned title and a subtitle, a faint gold keri (paisley) on the right
 * (components/ledger/Motifs), and a thin gold rule along the bottom, like the
 * binding edge of a khata book. Tabs differ by their content, not by colour.
 *
 * The rule is plain on purpose. A chain of gold beads replaced it for an
 * afternoon on 2026-10-06 and the owner did not like it.
 *
 * Top padding follows the formula the old headers used. It clears the status
 * bar, except when the admin impersonation banner is showing: the banner
 * already pushed the tab navigator down, so adding the inset again would leave
 * a gap.
 */
export default function LedgerHeader({ title, subtitle, right, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const bannerHeight = React.useContext(BannerHeightContext);
  // Must match the scroll content below, or the header sits off-centre from
  // the body on iPad and wide web.
  const contentStyle = useContentContainerStyle();
  const topPad = LAYOUT.isWeb ? 0 : bannerHeight > 0 ? 0 : insets.top;

  return (
    <View style={[styles.band, { paddingTop: topPad }]}>
      <StatusBar barStyle="light-content" backgroundColor={Brand.primaryDark} />
      {/* Behind everything, cropped by the band. */}
      <KeriMotif size={132} rotate={-18} style={styles.keri} />
      <View style={[styles.row, contentStyle]}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.back}
          >
            <ArrowLeft size={22} color="#FFFFFF" />
          </Pressable>
        ) : null}
        <View style={styles.titles}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {!!subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        {right ? <View style={styles.actions}>{right}</View> : null}
      </View>
      <View style={styles.rule} />
    </View>
  );
}

/**
 * A plain header action: an icon, optionally with a short label. It has a
 * white outline and no fill. SoneBill's header actions were frosted pills.
 */
export const LedgerHeaderAction = React.forwardRef<View, {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label?: string;
  onPress: () => void;
  accessibilityLabel?: string;
}>(function LedgerHeaderAction({ icon: IconComp, label, onPress, accessibilityLabel }, ref) {
  // The ref lets a caller measure the button, e.g. to hang a popover off it.
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      hitSlop={6}
      style={({ pressed }) => [
        styles.action,
        !label && styles.actionIconOnly,
        pressed && styles.actionPressed,
      ]}
    >
      <IconComp size={16} color="#FFFFFF" />
      {label ? <Text style={styles.actionLabel}>{label}</Text> : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  band: {
    backgroundColor: Brand.primary,
    overflow: 'hidden',
  },
  keri: {
    position: 'absolute',
    right: -18,
    bottom: -46,
  },
  row: {
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  back: {
    marginRight: 10,
    marginLeft: -4,
    padding: 4,
  },
  titles: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  subtitle: {
    color: '#C3DDD2',
    fontSize: 13,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 36,
  },
  actionIconOnly: {
    width: 36,
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  actionPressed: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  rule: {
    height: 3,
    backgroundColor: Brand.goldFill,
  },
});
