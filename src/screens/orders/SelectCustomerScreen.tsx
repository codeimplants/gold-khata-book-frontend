import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Keyboard, KeyboardAvoidingView, StyleSheet } from 'react-native';
import { useSheetBottomInset } from '../../hooks/useSheetBottomInset';
import {
  Box,
  HStack,
  VStack,
  Text,
  Pressable,
  Icon,
  Input,
  InputField,
  ScrollView,
  Center,
} from '@gluestack-ui/themed';
import { ArrowLeft, Plus, X, ChevronRight, Search, User, ChevronDown, ChevronUp, ChevronLeft, Contact } from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useTranslation } from '../../hooks/useTranslation';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { addCustomer, fetchCustomers, updateCustomer, uploadCustomerPhoto } from '../../store/data/dataSlice';
import CustomerPhotoPicker from '../../components/common/CustomerPhotoPicker';
import { ToastViewport } from '../../components/common/Toast';
import type { RootStackParamList } from '../../navigation/types';
import { parseApiErrorList } from '../../utils/errorUtils';
import { capitalizeWords } from '../../utils/textUtils';
import ValidationErrorModal from '../../components/ValidationErrorModal';
import GradientSurface from '../../components/common/GradientSurface';
import GradientButton from '../../components/GradientButton';
import SelectField from '../../components/common/SelectField';
import { LAYOUT } from "../../constants/layout";
import CustomerCodeBadge from '../../components/customers/CustomerCodeBadge';
import { INPUT_LIMITS, clampToLimit, validateText } from "../../constants/inputLimits";
import { ID_PROOF_TYPES } from "../../constants/idProof";
import type { IdProofType, PendingDeclarationPhoto } from "../../types";
import CharCounter from "../../components/common/CharCounter";
import ContactsStep from "../../components/customers/ContactsStep";

type RouteProps = NativeStackScreenProps<RootStackParamList, 'SelectCustomer'>['route'];

const emptyCustomerForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  idProofType: '' as IdProofType | '',
  idProofNumber: '',
};

export default function SelectCustomerScreen() {
  const bottomInset = useSheetBottomInset(16);
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProps>();
  const { next } = route.params;

  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { phone: userPhone } = useAppSelector(state => state.auth);
  const { customers, shopDetails } = useAppSelector(state => state.data);

  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyCustomerForm);
  // Collapsed by default — most shopkeepers never touch this, and it exists
  // purely so a repeat customer's declaration does not have to ask for ID
  // proof again. Mirrors AddCustomerModal, which is where customers added
  // outside the order flow get the same field.
  const [showIdProof, setShowIdProof] = useState(false);
  // Held locally until the customer exists — there is no id to upload against
  // until the save succeeds.
  const [pendingPhoto, setPendingPhoto] = useState<PendingDeclarationPhoto | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: boolean; phone?: boolean }>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showValidationModal, setShowValidationModal] = useState(false);
  // Two views inside the one Modal rather than two Modals, exactly as in
  // AddCustomerModal: iOS presents a single modal at a time from the root view
  // controller, so a picker raised over this sheet would never appear at all.
  // Web never gets the contact step — there is no phone book to read — so it
  // opens straight onto the form.
  const [step, setStep] = useState<'contacts' | 'form'>(
    LAYOUT.isWeb ? 'form' : 'contacts',
  );

  useEffect(() => {
    dispatch(fetchCustomers());
  }, [dispatch]);

  const filteredCustomers = useMemo(() => {
    const baseList = (customers || []).filter(c => c && (c.id || c._id) && c.name);
    const s = q.trim().toLowerCase();
    if (!s) return baseList;
    // Searchable by code as well as by name and number, because the code is
    // only worth showing if a shopkeeper who has one written down can type it
    // in and land on the one customer it belongs to.
    return baseList.filter(c =>
      c.name.toLowerCase().includes(s) ||
      (c.phone && c.phone.includes(s)) ||
      (c.customerCode && c.customerCode.toLowerCase().includes(s))
    );
  }, [customers, q]);

  const handleAddCustomer = () => {
    const errors: string[] = [];
    const fields: { name?: boolean; phone?: boolean } = {};

    if (!form.name.trim()) {
      errors.push(t('customers.validation.nameRequired') || 'Name is required');
      fields.name = true;
    } else {
      const nameError = validateText(form.name, { label: t('customers.name') || 'Name', limit: INPUT_LIMITS.customerName });
      if (nameError) { errors.push(nameError); fields.name = true; }
    }

    const emailError = validateText(form.email, { label: t('customers.email') || 'Email', limit: INPUT_LIMITS.email });
    if (emailError) errors.push(emailError);
    const addressError = validateText(form.address, { label: t('customers.address') || 'Address', limit: INPUT_LIMITS.customerAddress });
    if (addressError) errors.push(addressError);

    // Optional — see AddCustomerModal, which this form mirrors. A walk-in who
    // will not give a number still has to be billable. Everything below applies
    // only once one has been entered.
    const trimmedPhone = form.phone.trim();
    if (!trimmedPhone) {
      // Nothing to validate and nothing to check for duplicates against.
    } else if (trimmedPhone.length !== 10) {
      errors.push(t('customers.validation.phoneLengthError') || 'Please enter a valid 10-digit phone number');
      fields.phone = true;
    } else {
      const shopPhone = shopDetails?.phone ? String(shopDetails.phone).trim() : '';
      const regPhone = userPhone ? String(userPhone).trim() : '';

      if (trimmedPhone === regPhone || (shopPhone && trimmedPhone === shopPhone)) {
        errors.push(
          (shopPhone && trimmedPhone === shopPhone)
            ? (t('customers.validation.shopPhoneError') || "You cannot use your shop's phone number")
            : (t('customers.validation.ownPhoneError') || 'You cannot use your own registered number')
        );
        fields.phone = true;
      } else if (customers.some((c) => c.phone === trimmedPhone)) {
        errors.push(t('customers.validation.phoneExists') || 'A retailer with this phone number already exists');
        fields.phone = true;
      }
    }

    setFieldErrors(fields);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setShowValidationModal(true);
      return;
    }

    dispatch(
      addCustomer({
        name: form.name.trim(),
        // Omitted rather than sent as "" — an absent phone and an empty one are
        // stored differently (see the partial unique index on the model).
        ...(trimmedPhone ? { phone: trimmedPhone } : {}),
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        ...(form.idProofType ? { idProofType: form.idProofType } : {}),
        ...(form.idProofNumber.trim() ? { idProofNumber: form.idProofNumber.trim() } : {}),
      })
    ).unwrap()
      .then((updatedCustomers) => {
        // Not awaited into the failure path: the customer is saved, and a photo
        // that fails to upload must not read as "the customer was not added".
        const newest = updatedCustomers?.[0];
        if (pendingPhoto && newest?.id) {
          dispatch(uploadCustomerPhoto({ customerId: newest.id, photo: pendingPhoto }));
        }
        setPendingPhoto(null);
        setForm(emptyCustomerForm);
        setShowIdProof(false);
        setFieldErrors({});
        setValidationErrors([]);
        setOpen(false);
      })
      .catch((err) => {
        const apiErrors = parseApiErrorList(err);
        setValidationErrors(apiErrors);
        setShowValidationModal(true);
      });
  };

  /**
   * Every route into the sheet starts on the contact list again. Reset on open
   * rather than on close, so the sheet does not visibly flip back to the list
   * while it is fading out.
   */
  const openAddCustomer = () => {
    setStep(LAYOUT.isWeb ? 'form' : 'contacts');
    setOpen(true);
  };

  const handleCloseModal = () => {
    setOpen(false);
    setForm(emptyCustomerForm);
    setShowIdProof(false);
    setFieldErrors({});
    setValidationErrors([]);
  };

  const handleSelect = (customerId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { next: _, isEdit: __, customer: ___, ...extraParams } = route.params;
    navigation.navigate(next, { ...extraParams, customerId });
  };

  const Header = () => (
    <Box height={115} overflow="hidden">
      <GradientSurface colors={['#F97316', '#F59E0B']} />

      <HStack
        px="$5"
        pt="$12"
        pb="$5"
        justifyContent="space-between"
        alignItems="center"
        flex={1}
        style={LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}}
      >
        <Box 
          flexDirection="row" 
          alignItems="center" 
          justifyContent="space-between"
          flex={1}
          style={LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}}
        >
          <HStack alignItems="center" space="md">
            <Pressable onPress={() => navigation.goBack()} p="$2" rounded="$lg">
              <Icon as={ArrowLeft} color="$white" />
            </Pressable>
            <VStack>
              <Text color="$white" fontSize={20} fontWeight="$bold">
                {t('customers.title') || 'Retailers'}
              </Text>
              <Text color="$white" opacity={0.85}>
                {t('orders.selectCustomer') || 'Select retailer to continue'}
              </Text>
            </VStack>
          </HStack>
        </Box>

        <Pressable
          bg="rgba(255,255,255,0.2)"
          px="$4"
          py="$2"
          rounded="$xl"
          flexDirection="row"
          alignItems="center"
          onPress={openAddCustomer}
        >
          <Icon as={Plus} color="$white" size="sm" />
          <Text color="$white" ml="$2" fontWeight="$bold">
            {t('customers.add')}
          </Text>
        </Pressable>
      </HStack>
    </Box>
  );

  return (
    <Box flex={1} bg="#F3F4F6">
      <Header />

      {/* Search */}
      <Box px="$4" mt="$4" style={LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}}>
        <HStack bg="$white" rounded="$xl" px="$3" py="$2" alignItems="center" style={styles.card}>
          <Icon as={Search} color="#6B7280" />
          <Input variant="rounded" flex={1} ml="$2" borderWidth={0}>
            <InputField
              placeholder={t('customers.searchWithCode') || 'Search by name, phone or code'}
              value={q}
              onChangeText={setQ}
              maxLength={INPUT_LIMITS.searchQuery}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
          </Input>
        </HStack>
      </Box>

      {/* List */}
      <ScrollView
        flex={1}
        // Without this, tapping a customer while the search keyboard is open is
        // swallowed by the keyboard dismiss and the row does not select until a
        // second tap — which reads to users as the screen being unresponsive.
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 30,
          ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {})
        }}
      >
        <VStack px="$4" mt="$4" space="md">
          {filteredCustomers.map(c => (
            <Pressable key={c.id || c._id} onPress={() => handleSelect(c.id || c._id || '')}>
              <Box bg="$white" p="$4" rounded="$2xl" style={styles.card}>
                <HStack alignItems="center" justifyContent="space-between">
                  <VStack flex={1} mr="$3">
                    {/* The code matters most here. Everywhere else it is a
                        label; on this screen it is the only thing separating
                        two identical phoneless rows, and picking the wrong one
                        files the bill against the wrong person. */}
                    <HStack alignItems="center" space="xs">
                      <Text fontWeight="$bold" fontSize={16} numberOfLines={1} flexShrink={1}>
                        {c.name}
                      </Text>
                      <CustomerCodeBadge code={c.customerCode} />
                    </HStack>
                    {c.phone ? (
                      <Text color="$coolGray500">{c.phone}</Text>
                    ) : (
                      <Text color="$coolGray400" fontStyle="italic">
                        {t('customers.noPhone') || 'No phone number'}
                      </Text>
                    )}
                  </VStack>
                  <Icon as={ChevronRight} color="$coolGray400" />
                </HStack>
              </Box>
            </Pressable>
          ))}
          {filteredCustomers.length === 0 && (
            <Center mt="$10">
              <VStack space="md" alignItems="center">
                <Box p="$5" bg="$coolGray100" rounded="$full">
                  <Icon as={User} size="xl" color="$coolGray400" />
                </Box>
                <Text color="$coolGray400" fontWeight="$medium">
                  <Text style={{ fontSize: 16 }}>
                    {q.trim() ? t('customers.noResults') || 'No retailers match your search' : t('customers.noCustomers') || 'No retailers found'}
                  </Text>
                </Text>
                {!q.trim() && (
                  <>
                    <Text color="$coolGray400" fontWeight="$medium" style={{ marginTop: -4 }}>
                      <Text style={{ fontSize: 14 }}>{t('customers.emptySubHead') || "Add retailers manually or they're created when making invoices"}</Text>
                    </Text>
                    <Pressable
                      px="$4"
                      py="$2"
                      mt="$2"
                      rounded="$xl"
                      flexDirection="row"
                      alignItems="center"
                      style={{ backgroundColor: '#F97316' }}
                      onPress={openAddCustomer}
                    >
                      <Icon as={Plus} color="$white" size="sm" />
                      <Text color="$white" ml="$2" fontWeight="$bold">
                        {t('customers.addNew') || 'Add New Retailer'}
                      </Text>
                    </Pressable>
                  </>
                )}
              </VStack>
            </Center>
          )}
        </VStack>
      </ScrollView>

      {/* iOS presents only one RN Modal at a time from a given view
          controller, so anything raised from inside this one has to be nested
          within it rather than placed beside it — see the bottom of this
          Modal. The contact picker no longer needs a stand-down guard: it is a
          step inside this modal now. */}
      <Modal visible={open} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <Pressable
            flex={1}
            bg="rgba(0,0,0,0.45)"
            justifyContent={LAYOUT.isWeb ? "center" : "flex-end"}
            onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss}
          >
            <Pressable
              bg="$white"
              p="$6"
              pb="$4"
              style={[
                styles.modalSheet,
                { paddingBottom: bottomInset },
                LAYOUT.isWeb && { alignSelf: 'center', width: '100%', maxWidth: 450, borderRadius: 25 }
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              {/* The back arrow only exists on the form, and returns to the
                  contact list rather than closing — someone who picked the
                  wrong Prakash should not have to start over. */}
              <HStack justifyContent="center" alignItems="center" mb="$4">
                {step === 'form' && !LAYOUT.isWeb && (
                  <Pressable
                    position="absolute"
                    left={0}
                    onPress={() => setStep('contacts')}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityLabel={t('common.back') || 'Back'}
                  >
                    <Icon as={ChevronLeft} size="md" />
                  </Pressable>
                )}
                <Text fontSize={20} fontWeight="$bold">
                  {step === 'contacts'
                    ? t('customers.pickFromContacts')
                    : t('customers.addNew') || 'Add New Retailer'}
                </Text>
                <Pressable position="absolute" right={0} onPress={handleCloseModal}>
                  <Icon as={X} size="md" />
                </Pressable>
              </HStack>

              {step === 'contacts' && !LAYOUT.isWeb && (
                <ContactsStep
                  onPickContact={picked => {
                    setForm(f => ({
                      ...f,
                      name: picked.name ? clampToLimit(picked.name, INPUT_LIMITS.customerName) : f.name,
                      phone: picked.phone ? clampToLimit(picked.phone, INPUT_LIMITS.phone) : f.phone,
                    }));
                    setFieldErrors(e => ({ ...e, name: undefined, phone: undefined }));
                    setStep('form');
                  }}
                  onAddManually={() => setStep('form')}
                />
              )}

              {(step === 'form' || LAYOUT.isWeb) && (
              <>
              <VStack space="md">
                {/* Optional portrait, same as the Customers tab's Add modal. */}
                <CustomerPhotoPicker
                  value={pendingPhoto}
                  name={form.name}
                  onPick={setPendingPhoto}
                  onRemove={() => setPendingPhoto(null)}
                />
                <VStack space="xs">
                  <Text fontWeight="$semibold" color={fieldErrors.name ? "$red500" : "$coolGray800"}>{t('customers.name') || 'Name'}</Text>
                  <Input borderWidth={1} rounded="$xl" style={{ borderColor: fieldErrors.name ? '#EF4444' : '#c5c5c5' }}>
                    <InputField
                      placeholder={t('customers.placeholders.name') || 'Retailer name'}
                      value={form.name}
                      onChangeText={text => { setForm({ ...form, name: text }); setFieldErrors(e => ({ ...e, name: undefined })); }}
                      // Title-cased once the field is done rather than on every
                      // keystroke, which re-cases mid-word and makes a
                      // deliberate lower-case letter impossible to keep.
                      onBlur={() => setForm(f => ({ ...f, name: capitalizeWords(f.name) }))}
                      maxLength={INPUT_LIMITS.customerName}
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />
                  </Input>
                  <CharCounter value={form.name} limit={INPUT_LIMITS.customerName} />
                </VStack>

                <VStack space="xs">
                  <Text fontWeight="$semibold" color={fieldErrors.phone ? "$red500" : "$coolGray800"}>{t('customers.phoneOptional') || 'Phone (optional)'}</Text>
                  <Input borderWidth={1} rounded="$xl" style={{ borderColor: fieldErrors.phone ? '#EF4444' : '#c5c5c5' }}>
                    <InputField
                      placeholder={t('customers.placeholders.phone') || '10-digit mobile number'}
                      keyboardType="phone-pad"
                      value={form.phone}
                      maxLength={INPUT_LIMITS.phone}
                      onChangeText={text => { setForm({ ...form, phone: text }); setFieldErrors(e => ({ ...e, phone: undefined })); }}
                    />
                    {!LAYOUT.isWeb && (
                      <Pressable onPress={() => setStep('contacts')} pr="$3" pl="$2" alignItems="center" justifyContent="center">
                        <Icon as={Contact} size="sm" color="#6366F1" />
                      </Pressable>
                    )}
                  </Input>
                </VStack>

                <VStack space="xs">
                  <Text fontWeight="$semibold">{t('customers.address') || 'Address'}</Text>
                  <Input borderWidth={1} rounded="$xl" style={{ borderColor: '#c5c5c5' }}>
                    <InputField
                      placeholder={t('customers.placeholders.address') || 'Address (optional)'}
                      value={form.address}
                      onChangeText={text => setForm({ ...form, address: text })}
                      onBlur={() => setForm(f => ({ ...f, address: capitalizeWords(f.address) }))}
                      maxLength={INPUT_LIMITS.customerAddress}
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />
                  </Input>
                  <CharCounter value={form.address} limit={INPUT_LIMITS.customerAddress} />
                </VStack>

                {/* Rarely filled in at the counter: email, plus the ID proof that
                    only matters later if this customer ever brings in old gold.
                    Collapsed so the common case stays name, phone and address. */}
                <Pressable onPress={() => setShowIdProof(v => !v)}>
                  <HStack justifyContent="space-between" alignItems="center" py="$1">
                    <Text fontSize={13} fontWeight="$medium" color="$coolGray600">
                      {t('customers.moreDetails') || 'More details (optional)'}
                    </Text>
                    <Icon as={showIdProof ? ChevronUp : ChevronDown} size="sm" color="$coolGray500" />
                  </HStack>
                </Pressable>

                {showIdProof && (
                  <VStack space="sm">
                    <VStack space="xs">
                      <Text fontSize={12} color="$coolGray600">{t('customers.email') || 'Email'}</Text>
                      <Input borderWidth={1} rounded="$xl" style={{ borderColor: '#c5c5c5' }}>
                        <InputField
                          placeholder={t('customers.placeholders.email') || 'Email (optional)'}
                          value={form.email}
                          onChangeText={text => setForm({ ...form, email: text })}
                          maxLength={INPUT_LIMITS.email}
                          returnKeyType="done"
                          onSubmitEditing={Keyboard.dismiss}
                          keyboardType="email-address"
                        />
                      </Input>
                      <CharCounter value={form.email} limit={INPUT_LIMITS.email} />
                    </VStack>
                    <VStack space="xs">
                      <Text fontSize={12} color="$coolGray600">
                        {t('customers.idProof.type') || 'ID Proof Type'}
                      </Text>
                      <SelectField
                        value={form.idProofType}
                        items={ID_PROOF_TYPES.map(v => ({
                          label: t(`declaration.idProof.types.${v}`) || v,
                          value: v,
                        }))}
                        placeholder={t('customers.idProof.selectType') || 'Select...'}
                        title={t('customers.idProof.title') || 'ID Proof'}
                        onValueChange={v => setForm(f => ({ ...f, idProofType: v as IdProofType }))}
                      />
                    </VStack>
                    <VStack space="xs">
                      <Text fontSize={12} color="$coolGray600">
                        {t('customers.idProof.number') || 'ID Proof Number'}
                      </Text>
                      <Input borderWidth={1} rounded="$xl" style={{ borderColor: '#c5c5c5' }}>
                        <InputField
                          placeholder={t('customers.idProof.numberPlaceholder') || 'e.g. ABCDE1234F'}
                          value={form.idProofNumber}
                          maxLength={INPUT_LIMITS.idProofNumber}
                          autoCapitalize="characters"
                          onChangeText={text => setForm(f => ({ ...f, idProofNumber: text }))}
                          returnKeyType="done"
                          onSubmitEditing={Keyboard.dismiss}
                        />
                      </Input>
                    </VStack>
                  </VStack>
                )}
              </VStack>

              {/* general error now handled by ValidationErrorModal */}

              <GradientButton
                label={t('customers.addCustomer') || 'Add Retailer'}
                onPress={handleAddCustomer}
                style={{ marginTop: 18 }}
              />

              <Pressable onPress={handleCloseModal} style={{ marginTop: 12 }}>
                <Box
                  bg="$coolGray100"
                  rounded="$xl"
                  py="$3"
                  alignItems="center"
                >
                  <Text fontWeight="$medium">{t('common.cancel') || 'Cancel'}</Text>
                </Box>
              </Pressable>
              </>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>

        {/* Inside this Modal, not beside it. As a sibling it was never
            presented at all on iOS: submitting an invalid form set its flag,
            nothing appeared, and the only feedback was the red field outline
            the same code path sets. Nested, it presents on top of this one -
            which is what the photo source sheet in here already relies on. */}
        <ValidationErrorModal
          isOpen={showValidationModal}
          errors={validationErrors}
          onClose={() => setShowValidationModal(false)}
        />

        {/* The photo picker reports a failed pick with a toast, and the root
            viewport sits under this modal's own native layer. */}
        <ToastViewport />
      </Modal>
    </Box>
  );
}

const styles = StyleSheet.create({
  card: {
    elevation: 3,
    shadowOpacity: 0.08,
  },
  modalSheet: {
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 -6px 20px rgba(0,0,0,0.15)' }
      : { elevation: 20 }),
  },
});
