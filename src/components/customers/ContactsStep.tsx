import React, { memo, useCallback, useDeferredValue, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { Box, Center, HStack, Icon, Input, InputField, Pressable, Text, VStack } from '@gluestack-ui/themed';
import { Contact as ContactIcon, Plus, Search, Settings, User } from 'lucide-react-native';

import { useTranslation } from '../../hooks/useTranslation';
import { useAppSelector } from '../../store/hooks';
import { capitalizeWords } from '../../utils/textUtils';
import { INPUT_LIMITS } from '../../constants/inputLimits';
import { usePhoneContacts, type ContactRow, type PickedContact } from '../../hooks/usePhoneContacts';

interface ContactsStepProps {
  onPickContact: (contact: PickedContact) => void;
  onAddManually: () => void;
}

/** Fixed so the list can skip measuring — the whole point of getItemLayout. */
const ROW_HEIGHT = 62;
const ACCENT = '#6D5EF7';

/**
 * Avatar colours. A phone book is a wall of near-identical rows, and a colour
 * plus an initial gives each one something to recognise at a glance — the same
 * trick every contacts app uses. Picked deterministically from the contact's own
 * id so a given person keeps their colour between openings and between sessions.
 */
const AVATAR_COLORS = [
  '#6D5EF7', '#0EA5E9', '#10B981', '#F59E0B',
  '#EC4899', '#8B5CF6', '#14B8A6', '#F43F5E',
];

const avatarColor = (key: string): string => {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

/**
 * First letter, when there is one worth showing. Contacts saved as a bare phone
 * number have no letter, and a lone digit reads as noise rather than an initial,
 * so those keep the generic person icon.
 */
const initialOf = (item: ContactRow): string | null => {
  const first = (item.name || '').trim().charAt(0).toUpperCase();
  return /[A-Zऀ-ॿ]/.test(first) ? first : null;
};

interface RowProps {
  item: ContactRow;
  taken: boolean;
  onPress: (c: ContactRow) => void;
  takenLabel: string;
}

/**
 * Memoised because the list re-renders on every keystroke of the search box,
 * and re-rendering two thousand rows to filter them is the cost we are avoiding.
 */
const ContactRowItem = memo(({ item, taken, onPress, takenLabel }: RowProps) => (
  <Pressable
    onPress={() => onPress(item)}
    disabled={taken}
    px="$1"
    style={styles.row}
    $active-bg={taken ? undefined : '$coolGray50'}
  >
    <HStack alignItems="center" space="md" opacity={taken ? 0.45 : 1}>
      {/* Already-a-customer rows go grey rather than coloured: the colour is
          there to help pick someone, and these cannot be picked. */}
      <Center
        style={[
          styles.avatar,
          { backgroundColor: taken ? '#D1D5DB' : avatarColor(item.id) },
        ]}
      >
        {initialOf(item) ? (
          <Text color="$white" fontWeight="$bold" fontSize={16}>
            {initialOf(item)}
          </Text>
        ) : (
          <Icon as={User} size="sm" color="#FFFFFF" />
        )}
      </Center>
      <VStack flex={1}>
        <Text fontWeight="$semibold" color="$coolGray900" numberOfLines={1}>
          {item.name || item.display}
        </Text>
        <Text color="$coolGray500" fontSize="$sm" numberOfLines={1}>
          {taken ? takenLabel : item.display}
        </Text>
      </VStack>
    </HStack>
  </Pressable>
));

const ContactsStep = ({ onPickContact, onAddManually }: ContactsStepProps) => {
  const { t } = useTranslation();
  const { status, contacts, limited, request, expandAccess, openSettings, pickViaSystem } =
    usePhoneContacts();
  const customers = useAppSelector(state => state.data.customers);

  /**
   * The list was capped at a flat 340px, which left the sheet sitting low with a
   * screenful of wasted space above it — on a tall phone that is barely five
   * contacts. Scaling to the window gives roughly twice the rows on a modern
   * handset while still shrinking on a small screen, where a fixed cap would
   * have pushed the search box off the top.
   */
  const { height: windowHeight } = useWindowDimensions();
  const listMaxHeight = Math.round(windowHeight * 0.52);

  const [q, setQ] = useState('');
  // Keeps typing responsive: the field updates immediately, the 2000-row filter
  // runs against the trailing value instead of blocking each keystroke.
  const deferredQ = useDeferredValue(q);

  /** Phones already on the books, so those rows can be shown as unavailable. */
  const takenPhones = useMemo(
    () => new Set(customers.map(c => c.phone).filter(Boolean)),
    [customers],
  );

  const filtered = useMemo(() => {
    const s = deferredQ.trim().toLowerCase();
    if (!s) return contacts;
    return contacts.filter(c => c.search.includes(s));
  }, [contacts, deferredQ]);

  const handlePick = useCallback(
    (c: ContactRow) => {
      Keyboard.dismiss();
      onPickContact({ name: capitalizeWords(c.name), phone: c.phone });
    },
    [onPickContact],
  );

  const handleSystemPicker = useCallback(async () => {
    const picked = await pickViaSystem();
    if (picked) onPickContact({ name: capitalizeWords(picked.name), phone: picked.phone });
  }, [pickViaSystem, onPickContact]);

  const takenLabel = t('customers.alreadyACustomer') || 'Already a customer';

  const renderItem = useCallback(
    ({ item }: { item: ContactRow }) => (
      <ContactRowItem
        item={item}
        taken={takenPhones.has(item.phone)}
        onPress={handlePick}
        takenLabel={takenLabel}
      />
    ),
    [takenPhones, handlePick, takenLabel],
  );

  const addNewRow = (
    <Pressable onPress={onAddManually} py="$3">
      <HStack space="md" alignItems="center">
        <Center style={styles.addAvatar}>
          <Icon as={Plus} size="sm" color={ACCENT} />
        </Center>
        <Text fontSize={15} fontWeight="$medium" color={ACCENT}>
          {t('customers.addNew')}
        </Text>
      </HStack>
    </Pressable>
  );

  return (
    <VStack space="xs">
      {addNewRow}
      <Box style={styles.divider} />

      {(status === 'checking' || status === 'loading') && (
        <Center py="$10">
          <ActivityIndicator size="small" color={ACCENT} />
          <Text color="$coolGray500" mt="$3">
            {t('customers.loadingContacts') || 'Loading your contacts…'}
          </Text>
        </Center>
      )}

      {/* One tap, one short line. The permission is deliberately kept behind a
          press rather than fired on open: iOS grants exactly one prompt per
          install, and a reflexive "Don't Allow" from someone who only meant to
          type a name by hand costs them contacts for good. */}
      {status === 'primer' && (
        <VStack space="sm" alignItems="center" py="$5" px="$2">
          <Center style={styles.primerIcon}>
            <Icon as={ContactIcon} size="xl" color={ACCENT} />
          </Center>
          <Text textAlign="center" color="$coolGray600" fontSize={14}>
            {t('customers.contactsPermissionShort') ||
              'Fill a customer in from your phone book. Contacts stay on this device.'}
          </Text>
          <Pressable onPress={request} w="100%" mt="$1">
            <Box bg={ACCENT} rounded="$xl" py="$3" alignItems="center">
              <Text color="$white" fontWeight="$bold">
                {t('customers.allowContacts') || 'Allow contacts access'}
              </Text>
            </Box>
          </Pressable>
        </VStack>
      )}

      {(status === 'denied' || status === 'error') && (
        <VStack space="md" alignItems="center" py="$5" px="$2">
          <Center style={styles.deniedIcon}>
            <Icon as={Settings} size="xl" color="#DC2626" />
          </Center>
          <Text color="$coolGray700" textAlign="center">
            {status === 'error'
              ? t('customers.contactPickFailed') || 'Could not open your contacts.'
              : t('customers.contactsPermissionDenied') ||
                'Contacts permission was denied. Enable it from your device settings to pick a contact.'}
          </Text>
          {/* iOS only: the system picker runs out of process and needs no
              permission, so it still works after ours has been refused. */}
          {Platform.OS === 'ios' && (
            <Pressable onPress={handleSystemPicker} w="100%">
              <Box bg={ACCENT} rounded="$xl" py="$3" alignItems="center">
                <Text color="$white" fontWeight="$bold">
                  {t('customers.pickFromContacts')}
                </Text>
              </Box>
            </Pressable>
          )}
          <Pressable onPress={openSettings}>
            <Text color={ACCENT} fontWeight="$semibold">
              {t('customers.openSettings') || 'Open Settings'}
            </Text>
          </Pressable>
        </VStack>
      )}

      {status === 'ready' && (
        <>
          {/* iOS 18 "Select Contacts": the list is short because the user chose
              a subset, not because anything failed. Say so, and offer the sheet. */}
          {limited && (
            <Pressable onPress={expandAccess} mb="$1">
              <HStack style={styles.limitedBanner} space="sm" alignItems="center">
                <Text flex={1} fontSize={12} color="#92400E">
                  {t('customers.limitedContacts') ||
                    'You shared only some contacts with Gold Khata Book.'}
                </Text>
                <Text fontSize={12} fontWeight="$bold" color="#92400E">
                  {t('customers.shareMore') || 'Share more'}
                </Text>
              </HStack>
            </Pressable>
          )}

          <HStack style={styles.searchBar} rounded="$xl" px="$3" py="$2" alignItems="center" mb="$1">
            <Icon as={Search} color={ACCENT} />
            <Input variant="rounded" flex={1} ml="$2" borderWidth={0}>
              <InputField
                placeholder={t('customers.search') || 'Search by name or phone'}
                value={q}
                onChangeText={setQ}
                maxLength={INPUT_LIMITS.searchQuery}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </Input>
          </HStack>

          {filtered.length === 0 ? (
            <Center py="$8">
              <Text color="$coolGray500">{t('customers.noContactsFound') || 'No contacts found'}</Text>
            </Center>
          ) : (
            <FlatList
              data={filtered}
              renderItem={renderItem}
              keyExtractor={item => item.id}
              style={{ maxHeight: listMaxHeight }}
              keyboardShouldPersistTaps="handled"
              // Every row is ROW_HEIGHT tall, so the list can place them without
              // measuring — this is what keeps scrolling smooth at 2000 rows.
              getItemLayout={(_, index) => ({
                length: ROW_HEIGHT,
                offset: ROW_HEIGHT * index,
                index,
              })}
              initialNumToRender={12}
              maxToRenderPerBatch={20}
              windowSize={7}
              removeClippedSubviews
            />
          )}
        </>
      )}
    </VStack>
  );
};

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: '#F3F4F6' },
  limitedBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  row: { height: ROW_HEIGHT, justifyContent: 'center' },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  /* Tinted rather than grey so the field reads as part of the app's accent
     rather than a disabled input. */
  searchBar: {
    backgroundColor: 'rgba(109, 94, 247, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(109, 94, 247, 0.18)',
  },
  addAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#C4B5FD',
  },
  primerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(109, 94, 247, 0.12)',
  },
  deniedIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF2F2',
  },
});

export default ContactsStep;
