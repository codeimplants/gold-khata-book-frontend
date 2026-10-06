import React, { useState } from 'react';
import { useSheetBottomInset } from '../../hooks/useSheetBottomInset';
import {
  Modal,
  Pressable as RNPressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Language } from '../../localization';
import { Globe, Check } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { clearError, requestOtp, setPhone } from '../../store/auth/authSlice';
import GradientButton from '../../components/GradientButton';
import { useTranslation } from '../../hooks/useTranslation';
import { LAYOUT } from '../../constants/layout';
import AuthLayout from '../../components/ledger/AuthLayout';
import { Brand } from '../../theme/brand';
import { useLegalDocument } from '../legal/documents';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const LANGUAGES: { code: Language; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिंदी' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
];

const DROPDOWN_TOP = LAYOUT.isWeb ? 60 : 104;

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { loading, error, phone } = useAppSelector(s => s.auth);
  const legalSheetInset = useSheetBottomInset(32);
  const [localPhone, setLocalPhone] = useState(phone || '');
  const [localError, setLocalError] = useState<string | undefined>();
  const [showLangModal, setShowLangModal] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState<null | 'terms' | 'privacy'>(null);
  // Same source as the standalone Terms/Privacy screens, so the login modal
  // cannot drift from them — and so its "Last Updated" line gets the composed
  // month/year rather than the bare label the translation now holds.
  const termsDoc = useLegalDocument('terms');
  const privacyDoc = useLegalDocument('privacy');
  const legalDoc = showLegalModal === 'terms' ? termsDoc : privacyDoc;

  const { t, language, setLanguage } = useTranslation();

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

  const languageTrigger = (
    <RNPressable
      onPress={() => setShowLangModal(true)}
      accessibilityLabel="Select language"
      style={({ pressed }) => [styles.langTrigger, pressed && styles.langTriggerPressed]}
    >
      <Globe size={15} color="#FFFFFF" />
      <Text style={styles.langTriggerText}>{activeLang.native}</Text>
    </RNPressable>
  );

  return (
    <AuthLayout
      appName={t('appName') || 'Gold Khata Book'}
      tagline={t('welcome.tagline') || 'Wholesale gold khata'}
      points={[
        t('welcome.point1') || 'Fine gold and cash dues for every retailer',
        t('welcome.point2') || 'A day book of sales and receipts',
        t('welcome.point3') || 'Statements and reminders on WhatsApp',
      ]}
      topRight={languageTrigger}
    >
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
                {selected && <Check size={16} color="#145F4A" />}
              </RNPressable>
            );
          })}
        </View>
      </Modal>

          <Text style={styles.formTitle}>{t('welcome.signIn') || 'Sign in with your mobile number'}</Text>
          <Text style={styles.formHint}>{t('welcome.signInHint') || 'We will text you a 6-digit code'}</Text>

          <View style={styles.phoneRow}>
            <View style={styles.prefix}>
              <Text style={styles.prefixText}>+91</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder={t('auth.phonePlaceholder') || 'Mobile number'}
              placeholderTextColor={Brand.inkFaint}
              keyboardType="phone-pad"
              value={localPhone}
              maxLength={10}
              onChangeText={setLocalPhone}
              returnKeyType="done"
              onSubmitEditing={onSendOtp}
              accessibilityLabel={t('auth.enterPhone') || 'Enter Phone Number'}
            />
          </View>

          {!!(localError || error) && (
            <Text style={styles.error}>{localError || error}</Text>
          )}

          <View style={{ marginTop: 16 }}>
            <GradientButton
              label={loading ? (t('auth.sending') || 'Sending...') : (t('welcome.getOtp') || 'Get OTP')}
              onPress={onSendOtp}
              disabled={loading}
              showArrow
            />
          </View>

          {/* No "Skip login & continue as guest". Guest mode came from
              SoneBill, where a shop could bill a walk-in customer without an
              account. A wholesale khata is only useful with the account that
              holds it, and App Review signs in with the demo account. Removed
              by the owner's decision of 2026-10-06 (APP_STORE_4.3_REWORK.md,
              section 9, question 3). */}
          <View style={styles.termsRow}>
            <Text style={styles.termsText}>{t('welcome.agree') || 'By continuing you agree to our'} </Text>
            <RNPressable onPress={() => setShowLegalModal('terms')}>
              <Text style={styles.termsLink}>{t('settings.menu.terms') || 'Terms & Conditions'}</Text>
            </RNPressable>
            <Text style={styles.termsText}> & </Text>
            <RNPressable onPress={() => setShowLegalModal('privacy')}>
              <Text style={styles.termsLink}>{t('settings.menu.privacy') || 'Privacy Policy'}</Text>
            </RNPressable>
          </View>

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
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  langTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  langTriggerPressed: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  langTriggerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  formTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: Brand.ink,
  },
  formHint: {
    fontSize: 14,
    color: Brand.inkMuted,
    marginTop: 4,
    marginBottom: 18,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 50,
    borderWidth: 1,
    borderColor: Brand.lineStrong,
    borderRadius: 8,
    backgroundColor: Brand.card,
    overflow: 'hidden',
  },
  prefix: {
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: Brand.sunken,
    borderRightWidth: 1,
    borderRightColor: Brand.lineStrong,
  },
  prefixText: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.inkSoft,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    fontSize: 17,
    color: Brand.ink,
    letterSpacing: 0.5,
  },
  error: {
    color: Brand.due,
    fontSize: 13,
    marginTop: 8,
  },
  dropdown: {
    position: 'absolute',
    right: 16,
    width: 200,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE2D8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  dropdownLabel: {
    fontSize: 12,
    color: '#A39E92',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#E8ECE5',
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
    borderTopColor: '#F2F4EF',
  },
  langItemPressed: {
    backgroundColor: '#F2F4EF',
  },
  langNative: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1D1B16',
  },
  langEnglish: {
    fontSize: 11,
    color: '#A39E92',
    marginTop: 1,
  },
  termsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  termsText: {
    fontSize: 11,
    color: '#A39E92',
  },
  termsLink: {
    fontSize: 11,
    color: '#145F4A',
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
    color: '#1D1B16',
    flex: 1,
  },
  legalModalClose: {
    padding: 4,
  },
  legalModalCloseText: {
    fontSize: 18,
    color: '#6B665B',
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
    color: '#1D1B16',
    marginBottom: 6,
  },
  legalSectionContent: {
    fontSize: 13,
    color: '#545047',
    lineHeight: 20,
  },
  legalLastUpdated: {
    fontSize: 12,
    color: '#A39E92',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default LoginScreen;
