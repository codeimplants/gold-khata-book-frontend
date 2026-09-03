import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, HStack, VStack, Text, Pressable, Icon } from '@gluestack-ui/themed';
import { ChevronRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import CommonHeader from '../../components/CommonHeader';
import { useTranslation } from '../../hooks/useTranslation';
import { LAYOUT } from '../../constants/layout';
import { FORM_CATALOG } from '../../print/forms/catalog';

const PURPLE = '#6D5EF7';

/**
 * Catalogue of blank forms a shopkeeper can print, download or send on.
 *
 * Two jobs it does that the in-app flow cannot:
 *  - hand a form to a shopkeeper who does not use the app at all
 *  - keep trading when the app cannot produce a bill — print blanks and fill
 *    them in by hand
 *
 * This screen only lists what is in FORM_CATALOG; picking a form pushes
 * FormDetailScreen, which owns that form's options and actions. Keeping the
 * two apart is what lets a second form be added without redesigning either.
 */
const DownloadFormsScreen = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Box flex={1} bg="$coolGray50">
      <CommonHeader
        variant="light"
        showBack
        onPressBack={() => navigation.goBack()}
        title={t('forms.title')}
        subtitle={t('forms.subtitle')}
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          LAYOUT.contentContainerStyle,
          { paddingBottom: 24 + insets.bottom },
        ]}
      >
        {FORM_CATALOG.map(form => (
          <Pressable
            key={form.id}
            onPress={() => navigation.navigate('FormDetail', { formId: form.id })}
          >
            <Box style={styles.card}>
              <HStack space="md" alignItems="center">
                <Box style={styles.iconBox}>
                  <Icon as={form.icon} color={PURPLE} size="lg" />
                </Box>
                <VStack flex={1}>
                  <Text fontWeight="$bold" fontSize={15} color="$coolGray800">
                    {t(form.titleKey)}
                  </Text>
                  <Text fontSize={12} color="$coolGray500">
                    {t(form.descKey)}
                  </Text>
                </VStack>
                <Icon as={ChevronRight} size="md" color="$coolGray400" />
              </HStack>
            </Box>
          </Pressable>
        ))}
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
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default DownloadFormsScreen;
