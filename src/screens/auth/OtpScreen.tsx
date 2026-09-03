import React, { useEffect, useState } from 'react';
import { Keyboard, Platform, KeyboardAvoidingView, Image } from 'react-native';
import { Box, HStack, Input, InputField, Pressable, Text, VStack } from '@gluestack-ui/themed';
import { Smartphone } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { clearError, requestOtp, verifyOtp, loginAsGuest, resetOtpState } from '../../store/auth/authSlice';
import SoftGradientBackground from '../../components/SoftGradientBackground';
import GradientButton from '../../components/GradientButton';
import { useTranslation } from '../../hooks/useTranslation';
import * as AnalyticsSDK from '@codeimplants/analytics';
import GuestModeModal from '../../components/GuestModeModal';
import { LAYOUT, useLoginContainerStyle } from '../../constants/layout';

const { Analytics } = AnalyticsSDK;

type Props = NativeStackScreenProps<AuthStackParamList, 'Otp'>;

const OtpScreen: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  // Caps the OTP card on iPad instead of stretching it across the screen.
  const loginContainerStyle = useLoginContainerStyle();
  const { loading, error, phone: reduxPhone, otpRequestedAt } = useAppSelector(s => s.auth);

  const phone = route.params?.phone || reduxPhone;
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(30);
  const [showGuestModal, setShowGuestModal] = useState(false);

  const { t } = useTranslation();
  const dismissKeyboardOnPress =
    Platform.OS === 'web' ? undefined : Keyboard.dismiss;

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
    <Box flex={1}>
      <SoftGradientBackground />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Pressable
          flex={1}
          px="$5"
          justifyContent="center"
          alignItems="center"
          onPress={dismissKeyboardOnPress}
          style={loginContainerStyle}
        >
          {/* Logo */}
          <Image
            source={require('../../../assets/logo.png')}
            style={{ width: 80, height: 80, borderRadius: 16 }}
            resizeMode="contain"
          />

          {/* text-3xl font-display font-bold */}
          <Text mt="$4" fontSize="$3xl" fontWeight="$bold" fontFamily="$heading">
            {t("appName")}
          </Text>

          {/* text-muted-foreground mt-2 */}
          <Text color="$coolGray500" mt="$2">
            {t("auth.tagline")}
          </Text>

          {/* Card: p-6, border */}
          <Box
            mt="$6"
            w="100%"
            bg="$white"
            rounded="$2xl"
            p="$6"
            borderWidth={1}
            borderColor="$coolGray200"
            hardShadow={LAYOUT.isWeb ? undefined : "2"}
          >
            {/* Header: flex items-center gap-3 mb-6 */}
            <HStack alignItems="center" space="sm" style={{ marginBottom: 24 }}>
              <Box
                w={40}
                h={40}
                rounded="$xl"
                alignItems="center"
                justifyContent="center"
                bg="$teal500"
              >
                <Smartphone size={20} color="white" />
              </Box>
              <VStack>
                {/* font-semibold text-foreground */}
                <Text fontWeight="$semibold">
                  {t("auth.verifyOtp")}
                </Text>
                {/* text-sm text-muted-foreground */}
                <Text color="$coolGray500" fontSize="$sm">
                  {t("auth.sentTo")} +91 {phone}
                </Text>
              </VStack>
            </HStack>

            {/* Content: space-y-4 = gap 16px */}
            <VStack style={{ gap: 16 }}>
              <Input bg="$white" rounded="$xl" borderColor="$coolGray300" borderWidth={1}>
                <InputField
                  placeholder="Enter 6-digit OTP"
                  keyboardType="numeric"
                  value={otp}
                  maxLength={6}
                  onChangeText={setOtp}
                  returnKeyType="done"
                  onSubmitEditing={onVerify}
                  textAlign="center"
                />
              </Input>

              {/* text-xs text-center text-muted-foreground */}
              <Text color="$coolGray500" fontSize="$xs" textAlign="center">
                Enter the 6-digit code sent to your phone
              </Text>

              {!!error && <Text color="$red600" fontSize="$sm">{error}</Text>}

              <GradientButton
                label={loading ? t("auth.verifying") : t("auth.verifyLogin")}
                onPress={onVerify}
                disabled={loading || otp.length !== 6}
                showArrow
              />

              {/* ghost button: Change Phone Number */}
              <Pressable
                onPress={() => {
                  dispatch(resetOtpState());
                  navigation.navigate('Login');
                }}
              >
                <Text color="$coolGray600" textAlign="center" fontSize="$sm">
                  {t("auth.changePhone")}
                </Text>
              </Pressable>

              {/* Resend OTP */}
              <Pressable
                onPress={onResend}
                disabled={timer > 0 || loading}
                alignItems="center"
              >
                <Text
                  color={timer > 0 ? '$coolGray400' : '$purple700'}
                  fontWeight="$semibold"
                  fontSize="$sm"
                  textAlign="center"
                >
                  {timer > 0
                    ? `${t("auth.resendIn")} ${timer}s`
                    : t("auth.resend")}
                </Text>
              </Pressable>
            </VStack>
          </Box>

          {/* Ungated for the same reason as the login screen's: hiding it on a
              previously registered device made guest mode unreachable halfway
              through the flow, so the two steps now agree. */}
          <Pressable mt="$6" onPress={() => setShowGuestModal(true)}>
            <Text color="$coolGray500">
              {t("auth.skip")}
            </Text>
          </Pressable>

          <Text mt="$8" color="$coolGray400" fontSize="$xs" textAlign="center">
            {t("auth.terms")}
          </Text>

          <GuestModeModal
            visible={showGuestModal}
            onCancel={() => setShowGuestModal(false)}
            onConfirm={() => {
              setShowGuestModal(false);
              dispatch(loginAsGuest());
            }}
          />

        </Pressable>
      </KeyboardAvoidingView>
    </Box>
  );
};

export default OtpScreen;
