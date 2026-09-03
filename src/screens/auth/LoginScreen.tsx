import React, { useState } from 'react';
import { useSheetBottomInset } from '../../hooks/useSheetBottomInset';
import {
  Keyboard,
  Platform,
  KeyboardAvoidingView,
  Image,
  Modal,
  Pressable as RNPressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Box, HStack, Input, InputField, Pressable, Text, VStack } from '@gluestack-ui/themed';
import type { Language } from '../../localization';
import { Globe, Check, Smartphone } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { clearError, loginAsGuest, requestOtp, setPhone } from '../../store/auth/authSlice';
import SoftGradientBackground from '../../components/SoftGradientBackground';
import GradientButton from '../../components/GradientButton';
import { useTranslation } from '../../hooks/useTranslation';
import GuestModeModal from '../../components/GuestModeModal';
import { LAYOUT, useLoginContainerStyle } from '../../constants/layout';
import { useLegalDocument } from '../legal/documents';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const LANGUAGES: { code: Language; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिंदी' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
];

const TRIGGER_TOP = LAYOUT.isWeb ? 16 : 52;
const DROPDOWN_TOP = LAYOUT.isWeb ? 60 : 104;

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  // Caps the login card on iPad instead of stretching it across the screen.
  const loginContainerStyle = useLoginContainerStyle();
  const { loading, error, phone } = useAppSelector(s => s.auth);
  const legalSheetInset = useSheetBottomInset(32);
  const [localPhone, setLocalPhone] = useState(phone || '');
  const [localError, setLocalError] = useState<string | undefined>();
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState<null | 'terms' | 'privacy'>(null);
  // Same source as the standalone Terms/Privacy screens, so the login modal
  // cannot drift from them — and so its "Last Updated" line gets the composed
  // month/year rather than the bare label the translation now holds.
  const termsDoc = useLegalDocument('terms');
  const privacyDoc = useLegalDocument('privacy');
  const legalDoc = showLegalModal === 'terms' ? termsDoc : privacyDoc;

  const { t, language, setLanguage } = useTranslation();
  const dismissKeyboardOnPress =
    Platform.OS === 'web' ? undefined : Keyboard.dismiss;

  const activeLang = LANGUAGES.find(l => l.code === language) ?? LANGUAGES[0];

  const onSendOtp = async () => {
    dispatch(clearError());
    setLocalError(undefined);
    const p = localPhone.trim();
    if (!p) {
      setLocalError('Phone is required');
      return;
    }
    if (p.length !== 10) {
      setLocalError('Please enter a valid 10-digit phone number');
      return;
    }
    dispatch(setPhone(p));
    const result = await dispatch(requestOtp(p));
    if (requestOtp.fulfilled.match(result)) {
      navigation.navigate('Otp', { phone: p });
    }
  };

  return (
    <Box flex={1}>
      <SoftGradientBackground />

      {/* Language trigger — top right, above all content */}
      <View style={[styles.langTriggerWrap, { top: TRIGGER_TOP }]}>
        <RNPressable
          onPress={() => setShowLangModal(true)}
          style={({ pressed }) => [
            styles.langTrigger,
            pressed && styles.langTriggerPressed,
          ]}
        >
          <Globe size={16} color="#14B8A6" />
          <Text style={styles.langTriggerText}>{activeLang.native}</Text>
        </RNPressable>
      </View>

      {/* Language dropdown modal */}
      <Modal
        visible={showLangModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLangModal(false)}
      >
        {/* Backdrop — tap to close */}
        <RNPressable
          style={StyleSheet.absoluteFillObject}
          onPress={() => setShowLangModal(false)}
        />

        {/* Dropdown card (sibling of backdrop so taps don't bubble) */}
        <View style={[styles.dropdown, { top: DROPDOWN_TOP }]}>
          <Text style={styles.dropdownLabel}>Select language</Text>
          <View style={styles.dropdownDivider} />
          {LANGUAGES.map((lang, index) => {
            const selected = language === lang.code;
            return (
              <RNPressable
                key={lang.code}
                onPress={() => {
                  setLanguage(lang.code);
                  setShowLangModal(false);
                }}
                style={({ pressed }) => [
                  styles.langItem,
                  index !== 0 && styles.langItemBorder,
                  pressed && styles.langItemPressed,
                ]}
              >
                <View>
                  <Text style={styles.langNative}>{lang.native}</Text>
                  {lang.native !== lang.label && (
                    <Text style={styles.langEnglish}>{lang.label}</Text>
                  )}
                </View>
                {selected && <Check size={16} color="#14B8A6" />}
              </RNPressable>
            );
          })}
        </View>
      </Modal>

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

          <Text mt="$4" fontSize="$3xl" fontWeight="$bold" fontFamily="$heading">
            {t('appName')}
          </Text>

          <Text color="$coolGray500" mt="$2">
            {t('auth.tagline')}
          </Text>

          {/* Card */}
          <Box
            mt="$6"
            w="100%"
            bg="$white"
            rounded="$2xl"
            p="$6"
            borderWidth={1}
            borderColor="$coolGray200"
            hardShadow={LAYOUT.isWeb ? undefined : '2'}
          >
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
                <Text fontWeight="$semibold">{t('auth.enterPhone')}</Text>
                <Text color="$coolGray500" fontSize="$sm">
                  {t('auth.otpInfo')}
                </Text>
              </VStack>
            </HStack>

            <VStack style={{ gap: 16 }}>
              <HStack space="sm" alignItems="center">
                <Box bg="$coolGray100" rounded="$xl" px="$3" py="$2">
                  <Text color="$coolGray700" fontSize="$sm" fontWeight="$medium">
                    +91
                  </Text>
                </Box>

                <Input flex={1} bg="$white" rounded="$xl" borderColor="$coolGray300">
                  <InputField
                    placeholder={t('auth.phonePlaceholder')}
                    keyboardType="phone-pad"
                    value={localPhone}
                    maxLength={10}
                    onChangeText={setLocalPhone}
                    returnKeyType="done"
                    onSubmitEditing={onSendOtp}
                  />
                </Input>
              </HStack>

              {!!(localError || error) && (
                <Text color="$red600" fontSize="$sm">
                  {localError || error}
                </Text>
              )}

              <GradientButton
                label={loading ? t('auth.sending') : t('auth.sendOtp')}
                onPress={onSendOtp}
                disabled={loading}
                showArrow
              />
            </VStack>
          </Box>

          {/* Offered unconditionally, including on a device where a real
              registration has already completed and then logged out. Gating it
              on `hasRegisteredDevice` left that device with the OTP flow as its
              only way in — and needing to bill a walk-in customer without
              waiting on an SMS is exactly what guest mode is for. */}
          <Pressable mt="$6" onPress={() => setShowGuestModal(true)}>
            <Text color="$coolGray500" textDecorationLine="underline">
              {t('auth.skip')}
            </Text>
          </Pressable>

          <View style={styles.termsRow}>
            <Text style={styles.termsText}>By continuing, you agree to our </Text>
            <RNPressable onPress={() => setShowLegalModal('terms')}>
              <Text style={styles.termsLink}>{t('settings.menu.terms') || 'Terms & Conditions'}</Text>
            </RNPressable>
            <Text style={styles.termsText}> & </Text>
            <RNPressable onPress={() => setShowLegalModal('privacy')}>
              <Text style={styles.termsLink}>{t('settings.menu.privacy') || 'Privacy Policy'}</Text>
            </RNPressable>
          </View>

          <GuestModeModal
            visible={showGuestModal}
            onCancel={() => setShowGuestModal(false)}
            onConfirm={() => {
              setShowGuestModal(false);
              dispatch(loginAsGuest());
            }}
          />

          {/* Terms & Privacy Policy modal */}
          <Modal
            visible={showLegalModal !== null}
            transparent
            animationType="slide"
            onRequestClose={() => setShowLegalModal(null)}
          >
            <View style={styles.legalModalOverlay}>
              <View style={styles.legalModalContainer}>
                <View style={styles.legalModalHeader}>
                  <Text style={styles.legalModalTitle}>{legalDoc.title}</Text>
                  <RNPressable onPress={() => setShowLegalModal(null)} style={styles.legalModalClose}>
                    <Text style={styles.legalModalCloseText}>✕</Text>
                  </RNPressable>
                </View>
                <ScrollView
                  style={styles.legalModalScroll}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: legalSheetInset }}
                >
                  {legalDoc.sections.map((item, index) => (
                    <View key={index} style={styles.legalSection}>
                      <Text style={styles.legalSectionTitle}>{item.title}</Text>
                      <Text style={styles.legalSectionContent}>{item.content}</Text>
                    </View>
                  ))}
                  {!!legalDoc.lastUpdated && (
                    <Text style={styles.legalLastUpdated}>
                      {legalDoc.lastUpdated}
                    </Text>
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>
        </Pressable>
      </KeyboardAvoidingView>
    </Box>
  );
};

const styles = StyleSheet.create({
  langTriggerWrap: {
    position: 'absolute',
    right: 16,
    zIndex: 20,
  },
  langTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  langTriggerPressed: {
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  langTriggerText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  dropdown: {
    position: 'absolute',
    right: 16,
    width: 200,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  dropdownLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  langItemBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F9FAFB',
  },
  langItemPressed: {
    backgroundColor: '#F9FAFB',
  },
  langNative: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  langEnglish: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1,
  },
  termsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  termsText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  termsLink: {
    fontSize: 11,
    color: '#14B8A6',
    textDecorationLine: 'underline',
  },
  legalModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  legalModalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  legalModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  legalModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  legalModalClose: {
    padding: 4,
  },
  legalModalCloseText: {
    fontSize: 18,
    color: '#6B7280',
  },
  legalModalScroll: {
    flexGrow: 0,
  },
  legalSection: {
    marginBottom: 20,
  },
  legalSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  legalSectionContent: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
  },
  legalLastUpdated: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default LoginScreen;
