import React from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { Brand } from '../../theme/brand';
import { KeriMotif } from './Motifs';

type Props = {
  appName: string;
  tagline: string;
  /** Short lines under the tagline saying what the app does. Login shows them; OTP does not. */
  points?: string[];
  /** Pinned to the panel's top-right corner, e.g. the language picker. */
  topRight?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * The frame for the sign-in screens.
 *
 * It replaced SoneBill's layout, which App Review saw as the same app (4.3(a),
 * APP_STORE_4.3_REWORK.md): a logo, name and "Jewellery Billing Made Simple"
 * stacked in the centre of a tinted gradient, over a floating white card. The
 * Ledger version opens like a khata book. A green cover panel carries the
 * name, what the app is for and a gold binding rule. The form sits on the
 * ivory page below it.
 *
 * Keyboard handling follows CLAUDE.md's pre-deploy checklist, which calls a
 * blocked login an automatic store rejection. It uses a KeyboardAvoidingView
 * with `padding` on iOS and `height` on Android (edge-to-edge means Android no
 * longer resizes on its own), and a ScrollView with
 * `keyboardShouldPersistTaps="handled"` so the first tap on the button while
 * the keyboard is up presses it, rather than only closing the keyboard. The
 * ScrollView also keeps the button reachable on the smallest phones.
 */
export default function AuthLayout({ appName, tagline, points, topRight, children }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={Brand.primaryDark} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
          bounces={false}
        >
          <View style={[styles.cover, { paddingTop: insets.top + 20 }]}>
            {/* The keri, large and faint, behind the cover's words. */}
            <KeriMotif size={250} opacity={0.14} rotate={-14} style={styles.keri} />
            <View style={styles.cap}>
              {topRight ? <View style={styles.topRight}>{topRight}</View> : null}
              <Image
                source={require('../../../assets/logo.png')}
                style={styles.logo}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
              <Text style={styles.appName}>{appName}</Text>
              <Text style={styles.tagline}>{tagline}</Text>
              {points?.length ? (
                <View style={styles.points}>
                  {points.map(p => (
                    <View key={p} style={styles.point}>
                      <View style={styles.pointMark}>
                        <Check size={12} color={Brand.primaryDeep} strokeWidth={3} />
                      </View>
                      <Text style={styles.pointText}>{p}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.rule} />

          <View style={[styles.page, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.cap}>{children}</View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.paper,
  },
  cover: {
    backgroundColor: Brand.primary,
    paddingHorizontal: 24,
    paddingBottom: 28,
    overflow: 'hidden',
  },
  keri: {
    position: 'absolute',
    right: -40,
    bottom: -60,
  },
  // Caps the content at the login width on iPad and wide web, the same 424
  // that useLoginContainerStyle uses. Not that hook itself: its native style
  // carries flex: 1, which collapses a child of an auto-height ScrollView.
  cap: {
    width: '100%',
    maxWidth: 424,
    alignSelf: 'center',
  },
  topRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 2,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Brand.goldFill,
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    marginTop: 18,
    letterSpacing: 0.2,
  },
  tagline: {
    color: Brand.goldLight,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  points: {
    marginTop: 18,
    gap: 10,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pointMark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Brand.goldLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointText: {
    color: '#E7F0EC',
    fontSize: 14,
    flex: 1,
  },
  rule: {
    height: 4,
    backgroundColor: Brand.goldFill,
  },
  page: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
});
