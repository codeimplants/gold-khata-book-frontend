import React, { useCallback, useState } from 'react';
import { Box, HStack, VStack, Text, Pressable, Icon, Input, InputField } from '@gluestack-ui/themed';
import { Pencil, Phone, User } from 'lucide-react-native';
import { Image, StyleSheet } from 'react-native';

import CustomerPhotoPicker from '../common/CustomerPhotoPicker';
import CustomerCodeBadge from '../customers/CustomerCodeBadge';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppSelector } from '../../store/hooks';
import { INPUT_LIMITS } from '../../constants/inputLimits';
import { getFullImageUrl } from '../../utils/imageUtils';
import type { PendingDeclarationPhoto } from '../../types';

/**
 * Validates the phone number a declaration is about to write to the customer's
 * profile.
 *
 * A hook rather than a plain function because every rule needs store state, and
 * the two forms that collect this number — the exchange modal and the full
 * declaration form — must apply exactly the same ones. The rules mirror
 * AddCustomerModal's, minus its "optional" branch: a declaration is the one
 * document that cannot be written without a number.
 *
 * The duplicate check excludes the customer being written to, so re-saving a
 * number they already have is not a conflict. The backend enforces the same
 * rule (a partial unique index plus an explicit guard on update); this is here
 * so the shopkeeper is told while the form is still open.
 */
export const useDeclarationPhoneValidation = (customerId: string) => {
  const { t } = useTranslation();
  const { customers, shopDetails } = useAppSelector(state => state.data);
  const { phone: userPhone } = useAppSelector(state => state.auth);

  return useCallback(
    (phone: string): string | null => {
      const trimmed = (phone || '').trim();
      if (!trimmed) {
        return (
          t('declaration.customer.phoneRequired') ||
          'Enter the retailer phone number - a declaration cannot be saved without one.'
        );
      }
      // Everything below only applies to a number this form would actually
      // write. A number already on the customer's profile is left exactly as it
      // is — it is not being changed, the declaration has always been savable
      // with it, and rejecting it here would block a shopkeeper from a document
      // over a record they did not touch and cannot fix from this screen.
      const stored = (
        customers.find(c => c.id === customerId)?.phone || ''
      ).trim();
      if (stored && trimmed === stored) return null;

      if (trimmed.length !== 10) {
        return (
          t('customers.validation.phoneLengthError') ||
          'Please enter a valid 10-digit phone number'
        );
      }

      const shopPhone = shopDetails?.phone ? String(shopDetails.phone).trim() : '';
      const regPhone = userPhone ? String(userPhone).trim() : '';
      if (shopPhone && trimmed === shopPhone) {
        return (
          t('customers.validation.shopPhoneError') ||
          "You cannot use your shop's phone number"
        );
      }
      if (trimmed === regPhone) {
        return (
          t('customers.validation.ownPhoneError') ||
          'You cannot use your own registered number'
        );
      }
      if (customers.some(c => c.id !== customerId && c.phone === trimmed)) {
        return (
          t('customers.validation.phoneExists') ||
          'A retailer with this phone number already exists'
        );
      }
      return null;
    },
    [t, customers, shopDetails?.phone, userPhone, customerId],
  );
};

interface DeclarationCustomerSectionProps {
  customerId: string;
  name: string;
  phone: string;
  onChangePhone: (v: string) => void;
  /** A portrait picked here, not yet written to the profile. */
  photo?: PendingDeclarationPhoto;
  onChangePhoto: (photo?: PendingDeclarationPhoto) => void;
  /** Marks the phone field, after a failed submit. */
  hasPhoneError?: boolean;
  /** Editing a signed declaration: its counterparty cannot change. */
  readOnly?: boolean;
  /** Omitted where reassigning the customer isn't supported. */
  onChangeCustomer?: () => void;
}

/**
 * The customer's identity as a declaration needs it: a face, a name and a
 * number that is actually required.
 *
 * Replaces the read-only CustomerInfoCard on every path that *creates* a
 * declaration. That card stated the customer's phone; it could not collect one,
 * and the server refuses a declaration for a customer who has none — so a
 * shopkeeper who had billed a walk-in without a number reached the end of the
 * form and could go no further. The full form's answer was a warning telling
 * them to go and edit the profile first, which meant abandoning a half-filled
 * declaration; the exchange modal did not even warn, and simply failed on save
 * with the server's message.
 *
 * Both values are written to the customer's *profile* before the declaration is
 * created, not onto the declaration alone: the server snapshots the customer
 * record at create time, so that is the only route either has to the document —
 * and a number taken once at the counter should not have to be taken again on
 * the next sale.
 *
 * Additive only. It can put a face and a number on a profile that lacked them,
 * and correct one that was wrong, but it deliberately cannot delete the
 * customer's existing photo: that belongs on the customer's own screen, not
 * inside a form about a gold purchase.
 */
const DeclarationCustomerSection = ({
  customerId,
  name,
  phone,
  onChangePhone,
  photo,
  onChangePhoto,
  hasPhoneError,
  readOnly,
  onChangeCustomer,
}: DeclarationCustomerSectionProps) => {
  const { t } = useTranslation();
  const customer = useAppSelector(state =>
    state.data.customers.find(c => c.id === customerId),
  );

  const savedUrl = customer?.profilePhoto?.url;
  const shownUri = photo?.uri || getFullImageUrl(savedUrl) || undefined;

  /**
   * A number already on the customer's profile is a fact, not a question.
   *
   * The field used to open as an editable input either way, which asked every
   * shopkeeper to re-read and re-approve a number the shop already had — and an
   * input mid-form reads as something still to be filled in. So a stored number
   * shows as the record it is, behind an explicit Edit; only a customer without
   * one gets the input, focused, because that is the one case where the form
   * genuinely cannot continue until something is typed.
   *
   * Derived rather than seeded into state: `customer` arrives from the store and
   * can be undefined on the first render, so an initial-value-only flag would
   * latch "no phone" for a customer whose record simply had not loaded yet.
   */
  const storedPhone = (customer?.phone || '').trim();
  const [phoneEditRequested, setPhoneEditRequested] = useState(false);
  const showPhoneInput = !storedPhone || phoneEditRequested;

  return (
    <Box
      bg="$white"
      rounded="$2xl"
      p="$4"
      borderWidth={1}
      borderColor="$coolGray100"
      shadowColor="#000"
      shadowOffset={{ width: 0, height: 1 }}
      shadowOpacity={0.05}
      elevation={2}
    >
      <VStack space="md">
        <HStack alignItems="center" space="md">
          {readOnly ? (
            <Box style={styles.readOnlyAvatar}>
              {shownUri ? (
                <Image source={{ uri: shownUri }} style={styles.readOnlyAvatarImage} />
              ) : (
                <Icon as={User} size="md" color="#7857ff" />
              )}
            </Box>
          ) : (
            <CustomerPhotoPicker
              value={photo}
              url={savedUrl}
              name={name}
              onPick={picked => onChangePhoto(picked)}
              // Only ever clears a pick made here — see the note above on why
              // the customer's stored photo is not removable from this form.
              onRemove={photo ? () => onChangePhoto(undefined) : undefined}
            />
          )}

          {/* flex + shrink so a long name yields to the Change button rather
              than pushing it off the card. */}
          <VStack flex={1} flexShrink={1}>
            <HStack alignItems="center" space="xs">
              <Text
                fontWeight="$bold"
                color="$coolGray900"
                fontSize={16}
                flexShrink={1}
                numberOfLines={1}
              >
                {name}
              </Text>
              <CustomerCodeBadge code={customer?.customerCode} />
            </HStack>
            {!readOnly && !shownUri && (
              <Text fontSize={12} color="$coolGray500">
                {t('declaration.customer.photoHint') || 'Tap to add a photo (optional)'}
              </Text>
            )}
          </VStack>

          {!readOnly && onChangeCustomer && (
            <Pressable
              onPress={onChangeCustomer}
              bg="$coolGray50"
              px="$3"
              py="$1.5"
              rounded="$lg"
              borderWidth={1}
              borderColor="$coolGray200"
            >
              <Text fontSize={12} color="$primary" fontWeight="$medium">
                {t('common.change') || 'Change'}
              </Text>
            </Pressable>
          )}
        </HStack>

        {readOnly ? (
          <HStack alignItems="center" space="xs">
            <Icon as={Phone} size={12} color="$coolGray400" />
            <Text fontSize={13} color="$coolGray500">
              {phone || t('customers.noPhone') || 'No phone number'}
            </Text>
          </HStack>
        ) : showPhoneInput ? (
          <VStack space="xs">
            <Text fontSize={12} color={hasPhoneError ? '$red600' : '$coolGray600'}>
              {t('declaration.customer.phone') || 'Phone Number *'}
            </Text>
            <Input
              h={44}
              borderColor={hasPhoneError ? '$red500' : '$coolGray200'}
              rounded="$lg"
              bg="$white"
            >
              <InputField
                value={phone}
                onChangeText={onChangePhone}
                placeholder={t('customers.placeholders.phone') || '10-digit mobile number'}
                keyboardType="phone-pad"
                maxLength={INPUT_LIMITS.phone}
                fontSize={14}
                // The field the form cannot be saved without, and on the
                // no-number path it is the only thing being asked for — so the
                // caret is already in it rather than one tap away.
                autoFocus
              />
            </Input>
            <Text fontSize={11} color="$coolGray500" lineHeight={15}>
              {t('declaration.customer.savedToProfile') ||
                "Saved to this retailer's profile and printed on the declaration."}
            </Text>
          </VStack>
        ) : (
          <HStack alignItems="center" space="sm">
            <Icon as={Phone} size="sm" color="$coolGray400" />
            <VStack flex={1} flexShrink={1}>
              <Text fontSize={11} color="$coolGray500">
                {t('declaration.customer.phone') || 'Phone Number *'}
              </Text>
              <Text fontSize={14} fontWeight="$medium" color="$coolGray900">
                {phone || storedPhone}
              </Text>
            </VStack>
            <Pressable
              onPress={() => setPhoneEditRequested(true)}
              bg="$coolGray50"
              px="$3"
              py="$1.5"
              rounded="$lg"
              borderWidth={1}
              borderColor="$coolGray200"
              accessibilityRole="button"
              accessibilityLabel={t('common.edit') || 'Edit'}
            >
              <HStack alignItems="center" space="xs">
                <Icon as={Pencil} size="xs" color="$primary" />
                <Text fontSize={12} color="$primary" fontWeight="$medium">
                  {t('common.edit') || 'Edit'}
                </Text>
              </HStack>
            </Pressable>
          </HStack>
        )}
      </VStack>
    </Box>
  );
};

const styles = StyleSheet.create({
  readOnlyAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0edff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  readOnlyAvatarImage: { width: '100%', height: '100%' },
});

export default DeclarationCustomerSection;
