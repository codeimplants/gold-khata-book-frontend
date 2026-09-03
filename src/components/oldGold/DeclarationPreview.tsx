import React from 'react';
import { Image, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, HStack, VStack, Text, Icon, ArrowLeftIcon, Divider } from '@gluestack-ui/themed';

import GradientButton from '../common/GradientButton';
import { PRINT_LANGUAGES } from '../common/LanguagePicker';
import { useTranslation } from '../../hooks/useTranslation';
import { LAYOUT } from '../../constants/layout';
import type { DeclarationFormValues } from '../../types';

interface DeclarationPreviewProps {
  values: DeclarationFormValues;
  isSubmitting?: boolean;
  onBack: () => void;
  onConfirm: () => void;
}

const Row = ({ label, value }: { label: string; value?: string }) => {
  if (!value) return null;
  return (
    <HStack justifyContent="space-between" alignItems="flex-start" space="md" py="$1">
      <Text fontSize={12} color="$coolGray500" flexShrink={0}>
        {label}
      </Text>
      <Text fontSize={13} color="$coolGray900" textAlign="right" flex={1}>
        {value}
      </Text>
    </HStack>
  );
};

/** Read-back of what will be printed, before anything is saved. */
const DeclarationPreview = ({
  values,
  isSubmitting,
  onBack,
  onConfirm,
}: DeclarationPreviewProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const totals = values.items.reduce(
    (acc, i) => ({
      grams: acc.grams + (Number(i.grams) || 0),
      amount: acc.amount + (Number(i.amount) || 0),
    }),
    { grams: 0, amount: 0 },
  );

  // One row per document, so a second ID is visible before saving rather than
  // appearing for the first time on the printed page.
  const idProofRows = (values.idProofs || [])
    .filter(e => e.number.trim())
    .map(e => ({
      label:
        e.type === 'other'
          ? e.otherLabel || t('declaration.idProof.types.other')
          : t(`declaration.idProof.types.${e.type}`),
      number: e.number,
      // Shown under the row it belongs to, so a scan taken for the second ID
      // cannot look as though it belongs to the first.
      photos: e.pendingPhotos || [],
    }));

  const payoutLabel =
    values.payout.method === 'online'
      ? `${t('declaration.payout.online')}${
          values.payout.onlineType
            ? ` · ${t(`declaration.payout.${values.payout.onlineType}`)}`
            : ''
        }`
      : t(`declaration.payout.${values.payout.method}`);

  return (
    <Box flex={1} bg="$coolGray50">
      <Box
        bg="$white"
        pt="$12"
        pb="$4"
        px="$4"
        borderBottomWidth={1}
        borderBottomColor="$coolGray200"
        shadowColor="$coolGray300"
        shadowOpacity={0.1}
        shadowRadius={4}
        elevation={2}
      >
        {/* Contents capped to the same column as the body on desktop web, which
            is what InvoicePreviewScreen's header does — without it this header
            ran the full window width while the cards below it did not. */}
        <HStack alignItems="center" space="md" style={LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}}>
          <TouchableOpacity onPress={onBack} disabled={isSubmitting}>
            <Box p="$2" rounded="$lg" bg="$coolGray100" opacity={isSubmitting ? 0.5 : 1}>
              <Icon as={ArrowLeftIcon} size="xl" color="$coolGray700" />
            </Box>
          </TouchableOpacity>
          <VStack>
            <Text fontSize="$xl" fontWeight="$bold" color="$coolGray900">
              {t('declaration.title') || 'Declaration / Affidavit'}
            </Text>
            <Text fontSize="$sm" color="$coolGray600">
              {values.customerName}
            </Text>
          </VStack>
        </HStack>
      </Box>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          LAYOUT.contentContainerStyle,
          // The footer bar below carries the safe-area inset now, so this only
          // needs its own breathing room above it.
          { paddingBottom: 24 },
        ]}
      >
        <Box
          bg="$white"
          p="$5"
          rounded="$xl"
          borderWidth={1}
          borderColor="#E5E7EB"
          shadowColor="#000"
          shadowOffset={{ width: 0, height: 1 }}
          shadowOpacity={0.05}
          elevation={2}
        >
          <Text fontWeight="$bold" fontSize={15} color="$coolGray800" mb="$2">
            {values.customerName}
          </Text>
          <Row label={t('declaration.doc.mobile') || 'Mobile'} value={values.customerPhone} />
          <Row label={t('declaration.doc.address') || 'Address'} value={values.customerAddress} />
          <Row label={t('declaration.doc.date') || 'Date'} value={values.declarationDate} />
          {/* This preview is built from RN components and so renders in the app
              language, while the printed document follows the choice below.
              Stating it here is what stops the two reading as a bug. */}
          <Row
            label={t('declaration.language.title') || 'Declaration Language'}
            value={
              PRINT_LANGUAGES.find(l => l.code === values.language)?.label ||
              values.language
            }
          />
          <Divider my="$2" />
          <Row
            label={t('declaration.ownership.title') || 'Ownership'}
            value={
              values.ownerIsSelf
                ? t('declaration.ownership.isSelf')
                : `${t('declaration.ownership.isFamily')} — ${values.familyMemberName}`
            }
          />
          {idProofRows.map((row, i) => (
            <VStack key={`${row.label}_${i}`}>
              <Row label={row.label} value={row.number} />
              {/* Shown here but never on the printed sheet — this is the shop's
                  own record, and the PDF gets shared onward. Same rule as the
                  witness ID proof below. */}
              {row.photos.length > 0 && (
                <HStack space="sm" flexWrap="wrap" mb="$2">
                  {row.photos.map((p, pi) => (
                    <Image
                      key={`${p.uri}_${pi}`}
                      source={{ uri: p.uri }}
                      style={styles.thumb}
                    />
                  ))}
                </HStack>
              )}
            </VStack>
          ))}
          <Row
            label={t('declaration.receipt.details') || 'Receipt'}
            value={values.purchaseReceiptDetails}
          />
          <Row
            label={t('declaration.receipt.noReason') || 'Reason'}
            value={values.noReceiptReason}
          />
        </Box>

        <Box
          bg="$white"
          p="$5"
          rounded="$xl"
          borderWidth={1}
          borderColor="#E5E7EB"
          shadowColor="#000"
          shadowOffset={{ width: 0, height: 1 }}
          shadowOpacity={0.05}
          elevation={2}
        >
          <Text fontWeight="$bold" fontSize={15} color="$coolGray800" mb="$3">
            {t('declaration.ornaments.title') || 'Old Ornaments'}
          </Text>
          <VStack space="sm">
            {values.items.map((item, index) => (
              <HStack key={item.id} justifyContent="space-between" space="md">
                <VStack flex={1}>
                  <Text fontSize={13} color="$coolGray900">
                    {index + 1}. {item.description}
                  </Text>
                  {(item.metalType || item.purity) && (
                    <Text fontSize={11} color="$coolGray500">
                      {[item.metalType, item.purity].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                </VStack>
                <VStack alignItems="flex-end">
                  <Text fontSize={13} color="$coolGray900">
                    {Number(item.grams || 0).toFixed(3)} gm
                  </Text>
                  {!!Number(item.amount) && (
                    <Text fontSize={12} color="$coolGray500">
                      ₹{Number(item.amount).toFixed(2)}
                    </Text>
                  )}
                </VStack>
              </HStack>
            ))}
          </VStack>

          <Divider my="$3" />
          <HStack justifyContent="space-between">
            <Text fontSize={13} fontWeight="$bold" color="$coolGray700">
              {t('declaration.ornaments.totalGrams') || 'Total Grams'}
            </Text>
            <Text fontSize={13} fontWeight="$bold" color="$coolGray900">
              {totals.grams.toFixed(3)} gm
            </Text>
          </HStack>
          {totals.amount > 0 && (
            <HStack justifyContent="space-between" mt="$1">
              <Text fontSize={13} fontWeight="$bold" color="$coolGray700">
                {t('declaration.ornaments.totalAmount') || 'Total Amount'}
              </Text>
              <Text fontSize={13} fontWeight="$bold" color="$coolGray900">
                ₹{totals.amount.toFixed(2)}
              </Text>
            </HStack>
          )}
        </Box>

        <Box
          bg="$white"
          p="$5"
          rounded="$xl"
          borderWidth={1}
          borderColor="#E5E7EB"
          shadowColor="#000"
          shadowOffset={{ width: 0, height: 1 }}
          shadowOpacity={0.05}
          elevation={2}
        >
          <Text fontWeight="$bold" fontSize={15} color="$coolGray800" mb="$2">
            {t('declaration.payout.title') || 'Payment to Retailer'}
          </Text>
          <Row label={t('declaration.payout.method') || 'Mode'} value={payoutLabel} />
          <Row
            label={t('declaration.payout.reference') || 'Reference'}
            value={values.payout.reference}
          />
          <Row
            label={t('declaration.payout.bankName') || 'Bank'}
            value={values.payout.bankName}
          />
          <Row
            label={t('declaration.payout.bankAccountNumber') || 'Account'}
            value={values.payout.bankAccountNumber}
          />
          <Row label={t('declaration.payout.upiId') || 'UPI'} value={values.payout.upiId} />
        </Box>

        {values.pendingPhotos.length > 0 && (
          <Box
          bg="$white"
          p="$5"
          rounded="$xl"
          borderWidth={1}
          borderColor="#E5E7EB"
          shadowColor="#000"
          shadowOffset={{ width: 0, height: 1 }}
          shadowOpacity={0.05}
          elevation={2}
        >
            <Text fontWeight="$bold" fontSize={15} color="$coolGray800" mb="$3">
              {t('declaration.photos.title') || 'Ornament Photos'}
            </Text>
            <HStack space="sm" flexWrap="wrap">
              {values.pendingPhotos.map((p, i) => (
                <Image key={`${p.uri}_${i}`} source={{ uri: p.uri }} style={styles.thumb} />
              ))}
            </HStack>
          </Box>
        )}

        {values.witnesses.some(w => w.name?.trim()) && (
          <Box
          bg="$white"
          p="$5"
          rounded="$xl"
          borderWidth={1}
          borderColor="#E5E7EB"
          shadowColor="#000"
          shadowOffset={{ width: 0, height: 1 }}
          shadowOpacity={0.05}
          elevation={2}
        >
            <Text fontWeight="$bold" fontSize={15} color="$coolGray800" mb="$2">
              {t('declaration.witnesses.title') || 'Witnesses'}
            </Text>
            {values.witnesses
              .filter(w => w.name?.trim())
              .map((w, i) => (
                <VStack key={i} space="xs" mb="$1">
                  <Text fontSize={13} color="$coolGray900">
                    {i + 1}. {w.name}
                    {w.phone ? ` · ${w.phone}` : ''}
                  </Text>
                  {/* Shown here but never on the printed sheet — this is the
                      shop's own record, and the PDF gets shared onward. */}
                  {(w.pendingPhotos?.length || 0) > 0 && (
                    <HStack space="sm" flexWrap="wrap">
                      {w.pendingPhotos!.map((p, pi) => (
                        <Image
                          key={`${p.uri}_${pi}`}
                          source={{ uri: p.uri }}
                          style={styles.thumb}
                        />
                      ))}
                    </HStack>
                  )}
                </VStack>
              ))}
          </Box>
        )}

      </ScrollView>

      {/* Footer bar, matching InvoicePreviewScreen: full-bleed so the border
          reads as a page edge, contents capped to the body's column on web.

          The confirm used to sit inside the ScrollView, which left the one
          action that commits the declaration floating in whitespace below the
          last card — and gave this step no Cancel at all, while the invoice
          preview it mirrors has had both pinned to the bottom throughout. */}
      <Box
        p="$4"
        pb={Math.max(insets.bottom, 16)}
        bg="$white"
        borderTopWidth={1}
        borderTopColor="$coolGray100"
      >
        <HStack space="md" style={LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}}>
          <TouchableOpacity
            onPress={onBack}
            disabled={isSubmitting}
            style={[styles.button, styles.cancelButton, isSubmitting && { opacity: 0.5 }]}
          >
            <Text color="#D946EF" fontWeight="$bold">{t('common.cancel') || 'Cancel'}</Text>
          </TouchableOpacity>
          <Box flex={2}>
            <GradientButton
              label={
                isSubmitting
                  ? t('common.loading') || 'Loading…'
                  : t('declaration.saveAndPrint') || 'Save Declaration'
              }
              onPress={onConfirm}
              disabled={isSubmitting}
            />
          </Box>
        </HStack>
      </Box>
    </Box>
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  // Same 56/12 geometry and the same pink outline as the invoice preview's
  // Cancel, so the two confirm steps read as one screen in two flows.
  button: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D946EF',
  },
  thumb: {
    width: 76,
    height: 76,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
});

export default DeclarationPreview;
