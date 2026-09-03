import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Box,
  HStack,
  VStack,
  Text,
  Pressable,
  Icon,
  Switch,
} from '@gluestack-ui/themed';
import { Printer, Share2 } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

import CommonHeader from '../../components/CommonHeader';
import LanguagePicker from '../../components/common/LanguagePicker';
import PrintTargetNote from '../../components/common/PrintTargetNote';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppSelector } from '../../store/hooks';
import { toast } from '../../components/common/Toast';
import { LAYOUT } from '../../constants/layout';
import { getForm } from '../../print/forms/catalog';
import type { RootStackParamList } from '../../navigation/types';
import type { MobileLang } from '../../print/templates/shared';

const PURPLE = '#6D5EF7';

/**
 * Options and actions for one blank form, reached by tapping it on
 * DownloadFormsScreen. Which form is decided by the route param alone — the
 * printing itself belongs to the catalog entry.
 */
const FormDetailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'FormDetail'>>();
  const { t, language } = useTranslation();
  const insets = useSafeAreaInsets();
  const shopDetails = useAppSelector(s => s.data.shopDetails);

  const form = getForm(route.params?.formId);

  // Starts at the app language rather than always English, since that is what
  // the shop prints in. Still overridable here, because a blank form is often
  // for someone else — another shop, or a customer who reads a different
  // language — which is the one place a per-print choice genuinely earns itself.
  const [selectedLang, setSelectedLang] = useState<MobileLang>(language as MobileLang);
  const [includeShopDetails, setIncludeShopDetails] = useState(true);
  const [busy, setBusy] = useState(false);

  // A form id that is not in the catalog can only come from a stale route —
  // say the app was reloaded onto a form that has since been removed.
  if (!form) {
    return (
      <Box flex={1} bg="$coolGray50">
        <CommonHeader
          variant="light"
          showBack
          onPressBack={() => navigation.goBack()}
          title={t('forms.title')}
        />
        <Box p="$4">
          <Text fontSize={14} color="$coolGray500">
            {t('forms.notFound')}
          </Text>
        </Box>
      </Box>
    );
  }

  const run = async (action: 'print' | 'share') => {
    if (busy) return;
    setBusy(true);
    try {
      const ctx = { shopDetails, lang: selectedLang, includeShopDetails };
      if (action === 'print') {
        await form.print(ctx);
      } else {
        const ok = await form.share(ctx);
        if (!ok) toast.error(t('forms.failed'));
      }
    } catch (err) {
      console.warn(`[FormDetail] ${form.id} failed:`, err);
      toast.error(t('forms.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box flex={1} bg="$coolGray50">
      <CommonHeader
        variant="light"
        showBack
        onPressBack={() => navigation.goBack()}
        title={t(form.titleKey)}
        subtitle={t(form.descKey)}
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          LAYOUT.contentContainerStyle,
          { paddingBottom: 24 + insets.bottom },
        ]}
      >
        {/* Language */}
        <Box style={styles.card}>
          <LanguagePicker
            value={selectedLang}
            onChange={setSelectedLang}
            title={t('forms.language')}
            hint={t('forms.languageHint')}
          />
        </Box>

        {/* Letterhead */}
        <Box style={styles.card}>
          <HStack alignItems="center" justifyContent="space-between" space="md">
            <VStack flex={1}>
              <Text fontWeight="$bold" fontSize={15} color="$coolGray800">
                {t('forms.includeShop')}
              </Text>
              <Text fontSize={12} color="$coolGray500">
                {t('forms.includeShopHint')}
              </Text>
            </VStack>
            <Switch
              value={includeShopDetails}
              onValueChange={setIncludeShopDetails}
            />
          </HStack>
        </Box>

        {/* Actions */}
        <VStack space="md">
          <Pressable onPress={() => run('print')} disabled={busy}>
            <HStack style={styles.outlineButton} space="xs">
              <Icon as={Printer} size="sm" color="$coolGray700" />
              <Text color="$coolGray800" fontWeight="$medium">
                {t('forms.print')}
              </Text>
            </HStack>
          </Pressable>
          <PrintTargetNote mt="$0" />

          <Pressable onPress={() => run('share')} disabled={busy}>
            <HStack style={styles.shareButton} space="xs">
              <Icon as={Share2} size="sm" color="$white" />
              <Text color="$white" fontWeight="$medium">
                {t('forms.share')}
              </Text>
            </HStack>
          </Pressable>
        </VStack>
      </ScrollView>
    </Box>
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 16,
  },
  outlineButton: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default FormDetailScreen;
