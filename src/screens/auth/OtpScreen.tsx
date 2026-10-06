import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { clearError, requestOtp, verifyOtp, resetOtpState } from '../../store/auth/authSlice';
import GradientButton from '../../components/GradientButton';
import { useTranslation } from '../../hooks/useTranslation';
import * as AnalyticsSDK from '@codeimplants/analytics';
import AuthLayout from '../../components/ledger/AuthLayout';
import { Brand } from '../../theme/brand';

const { Analytics } = AnalyticsSDK;

type Props = NativeStackScreenProps<AuthStackParamList, 'Otp'>;

/**
 * Second step of sign-in: the 6-digit code.
 *
 * Laid out on AuthLayout, the same green cover as the login screen. It
 * replaced SoneBill's centred card (see AuthLayout for why). The behaviour is
 * unchanged: a 30 second resend timer measured from when the code was
 * requested, and Change number going back to Login. There is no guest mode;
 * see LoginScreen for why it was removed.
 */
const OtpScreen: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const { loading, error, phone: reduxPhone, otpRequestedAt } = useAppSelector(s => s.auth);

  const phone = route.params?.phone || reduxPhone;
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(30);

  const { t } = useTranslation();

  useEffect(() => {
    if (!otpRequestedAt) {
      setTimer(0);
      return;
    }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - otpRequestedAt) / 1000);
      const remaining = Math.max(0, 30 - elapsed);
      setTimer(remaining);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [otpRequestedAt]);

  useEffect(() => {
    if (!phone) {
      navigation.replace('Login');
    }
  }, [navigation, phone]);

  const onVerify = async () => {
    if (!phone) return;
    dispatch(clearError());
    const resultAction = await dispatch(verifyOtp({ phone, otp }));

    if (verifyOtp.fulfilled.match(resultAction)) {
      // No Analytics.setUser here — the analytics identity is derived from auth
      // state by a single effect in App.tsx, which also covers session restore
      // and logout. Setting it here too would duplicate that in one path only.
      await Analytics.track('LOGIN_SUCCESS', { method: 'otp' });
      // Admins land on AdminHome via RootNavigator; no extra choice step.
    } else {
      const reason =
        (resultAction.payload as string | undefined) ?? 'Invalid OTP';
      await Analytics.track('LOGIN_FAILURE', { reason });
    }
  };

  const onResend = async () => {
    if (!phone) return;
    const result = await dispatch(requestOtp(phone));
    if (requestOtp.fulfilled.match(result)) {
      setTimer(30);
    }
  };

  return (
    <AuthLayout
      appName={t('appName') || 'Gold Khata Book'}
      tagline={t('welcome.tagline') || 'Wholesale gold khata'}
    >
      <Text style={styles.title}>{t('welcome.enterCode') || 'Enter the code'}</Text>
      <View style={styles.sentRow}>
        <Text style={styles.hint}>
          {t('auth.sentTo') || 'Sent to'} +91 {phone}
        </Text>
        <Pressable
          onPress={() => {
            dispatch(resetOtpState());
            navigation.navigate('Login');
          }}
          hitSlop={8}
        >
          <Text style={styles.change}>{t('welcome.change') || 'Change'}</Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.code}
        placeholder="••••••"
        placeholderTextColor={Brand.lineStrong}
        keyboardType="number-pad"
        value={otp}
        maxLength={6}
        onChangeText={setOtp}
        returnKeyType="done"
        onSubmitEditing={onVerify}
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        accessibilityLabel={t('auth.enterOtp') || 'Enter 6-digit OTP'}
      />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={{ marginTop: 16 }}>
        <GradientButton
          label={loading ? (t('auth.verifying') || 'Verifying...') : (t('welcome.verify') || 'Verify & continue')}
          onPress={onVerify}
          disabled={loading || otp.length !== 6}
          showArrow
        />
      </View>

      <Pressable
        onPress={onResend}
        disabled={timer > 0 || loading}
        style={styles.resend}
      >
        <Text style={[styles.resendText, { color: timer > 0 ? Brand.inkFaint : Brand.primary }]}>
          {timer > 0
            ? `${t('auth.resendIn') || 'Resend code in'} ${timer}s`
            : (t('auth.resend') || 'Resend code')}
        </Text>
      </Pressable>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: Brand.ink,
  },
  sentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 18,
  },
  hint: {
    fontSize: 14,
    color: Brand.inkMuted,
  },
  change: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.primary,
  },
  code: {
    height: 56,
    borderWidth: 1,
    borderColor: Brand.lineStrong,
    borderRadius: 8,
    backgroundColor: Brand.card,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 12,
    // In the style, not the textAlign prop: react-native-web ignores the prop.
    textAlign: 'center',
    color: Brand.ink,
  },
  error: {
    color: Brand.due,
    fontSize: 13,
    marginTop: 8,
  },
  resend: {
    alignSelf: 'center',
    marginTop: 18,
    padding: 6,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default OtpScreen;
