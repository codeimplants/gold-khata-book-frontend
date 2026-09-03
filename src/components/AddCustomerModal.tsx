import React, { useState } from "react";
import { Modal, StyleSheet, Platform, Keyboard, KeyboardAvoidingView } from "react-native";
import {
  Box,
  Text,
  HStack,
  VStack,
  Pressable,
  Input,
  InputField,
  Icon,
} from "@gluestack-ui/themed";
import { X, Contact, ChevronDown, ChevronUp, ChevronLeft } from "lucide-react-native";
import SelectField from "./common/SelectField";
import CustomerPhotoPicker from "./common/CustomerPhotoPicker";
import { ToastViewport } from "./common/Toast";
import { ID_PROOF_TYPES } from "../constants/idProof";
import type { IdProofType, PendingDeclarationPhoto } from "../types";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "../hooks/useTranslation";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { addCustomer, clearUserData, uploadCustomerPhoto } from "../store/data/dataSlice";
import { endImpersonation } from "../store/auth/authSlice";
import { useSheetBottomInset } from "../hooks/useSheetBottomInset";
import ImpersonationBlockModal from "./ImpersonationBlockModal";
import ConfirmModal from "./ConfirmModal";
import OrderTypeModal from "./OrderTypeModal";
import { parseApiErrorList } from "../utils/errorUtils";
import { capitalizeWords } from "../utils/textUtils";
import ValidationErrorModal from "./ValidationErrorModal";
import { toast } from "./common/Toast";
import { LAYOUT } from "../constants/layout";
import { INPUT_LIMITS, clampToLimit, validateText } from "../constants/inputLimits";
import CharCounter from "./common/CharCounter";
import ContactsStep from "./customers/ContactsStep";

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddCustomerModal = ({ isOpen, onClose }: AddCustomerModalProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  // Lifts the sheet clear of the Android navigation bar — without it the Cancel
  // button sits underneath the three-button controls. See useSheetBottomInset.
  const bottomInset = useSheetBottomInset(24);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    idProofType: "" as IdProofType | "",
    idProofNumber: "",
  });
  // Collapsed by default — most shopkeepers never touch this, and it exists
  // purely so a repeat customer's declaration does not have to ask for ID
  // proof again. See declarationHelpers.buildExchangeDeclarationPrefill.
  const [showIdProof, setShowIdProof] = useState(false);
  // Held locally until the customer exists — there is no id to upload against
  // until the save succeeds.
  const [pendingPhoto, setPendingPhoto] = useState<PendingDeclarationPhoto | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [newCustomerId, setNewCustomerId] = useState<string | undefined>(undefined);
  const [fieldErrors, setFieldErrors] = useState<{ name?: boolean; phone?: boolean }>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showValidationModal, setShowValidationModal] = useState(false);
  // The name of an existing customer this one collides with, when saving
  // without a phone number. Set → the advisory prompt is open.
  const [duplicateNameMatch, setDuplicateNameMatch] = useState<string | null>(null);
  // Sticky for this form: once the shopkeeper has said "yes, different person",
  // fixing an unrelated field and saving again must not ask a second time.
  const [confirmedDuplicateName, setConfirmedDuplicateName] = useState(false);

  const { phone: userPhone, impersonateUserId, impersonatePhone } = useAppSelector((state) => state.auth);
  const { customers, shopDetails } = useAppSelector((state) => state.data);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  // Two views inside one Modal rather than two Modals. iOS presents a single
  // modal at a time from the root view controller, so the old picker-over-form
  // arrangement never appeared at all.
  // Web never gets the contact step — there is no phone book to read — so it
  // opens straight onto the form exactly as it always did.
  const [step, setStep] = useState<'contacts' | 'form'>(
    LAYOUT.isWeb ? 'form' : 'contacts',
  );

  const navigation = useNavigation<any>();

  React.useEffect(() => {
    if (isOpen) setStep(LAYOUT.isWeb ? 'form' : 'contacts');
  }, [isOpen]);

  const handleEndSession = () => {
    dispatch(endImpersonation());
    dispatch(clearUserData());
    navigation.navigate('AdminDashboard');
  };

  const handleAddCustomer = () => {
    if (impersonateUserId) { setBlockModalVisible(true); return; }
    const errors: string[] = [];
    const fields: { name?: boolean; phone?: boolean } = {};

    if (!form.name.trim()) {
      errors.push(t('customers.validation.nameRequired') || 'Name is required');
      fields.name = true;
    } else {
      // The contact picker can drop in a name longer than the field allows, so
      // the cap has to be re-checked here and not just on the input.
      const nameError = validateText(form.name, { label: t('customers.name') || 'Name', limit: INPUT_LIMITS.customerName });
      if (nameError) { errors.push(nameError); fields.name = true; }
    }

    const emailError = validateText(form.email, { label: t('customers.email') || 'Email', limit: INPUT_LIMITS.email });
    if (emailError) errors.push(emailError);
    const addressError = validateText(form.address, { label: t('customers.address') || 'Address', limit: INPUT_LIMITS.customerAddress });
    if (addressError) errors.push(addressError);

    // Optional: a walk-in buying a small item routinely will not give a number,
    // and the shopkeeper still has to bill them. Everything below only applies
    // once one has actually been entered — an optional field still has to be a
    // valid number when it is filled in.
    const trimmedPhone = form.phone.trim();
    if (!trimmedPhone) {
      // Nothing to validate, and nothing to check for duplicates against. The
      // duplicate-name warning below is what stands in for the phone check.
    } else if (trimmedPhone.length !== 10) {
      errors.push(t('customers.validation.phoneLengthError') || 'Please enter a valid 10-digit phone number');
      fields.phone = true;
    } else {
      const shopPhone = shopDetails?.phone ? String(shopDetails.phone).trim() : "";
      const regPhone = userPhone ? String(userPhone).trim() : "";

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

    // Without a phone number there is nothing left to detect a duplicate with,
    // so a matching name is all there is. Advisory, never a block: two
    // customers really can be called Ramesh Patel, and the shopkeeper is the
    // one who knows whether this is the same person.
    if (!trimmedPhone && !confirmedDuplicateName) {
      const clash = customers.find(
        (c) => c.name.trim().toLowerCase() === form.name.trim().toLowerCase(),
      );
      if (clash) {
        setDuplicateNameMatch(clash.name.trim());
        return;
      }
    }

    saveCustomer(trimmedPhone);
  };

  /** The save itself, split out so the duplicate-name prompt can re-enter it. */
  const saveCustomer = (trimmedPhone: string) => {
    dispatch(addCustomer({
      name: form.name,
      // Omitted rather than sent as "" — the backend stores an absent phone and
      // an empty one differently (see the partial unique index on the model).
      ...(trimmedPhone ? { phone: trimmedPhone } : {}),
      email: form.email,
      address: form.address,
      ...(form.idProofType ? { idProofType: form.idProofType } : {}),
      ...(form.idProofNumber.trim() ? { idProofNumber: form.idProofNumber.trim() } : {}),
    })).unwrap()
      .then((updatedCustomers) => {
        const newest = updatedCustomers[0];
        setNewCustomerId(newest.id);
        // Not awaited into the failure path: the customer is saved, and a photo
        // that fails to upload must not read as "the customer was not added".
        if (pendingPhoto && newest?.id) {
          dispatch(uploadCustomerPhoto({ customerId: newest.id, photo: pendingPhoto }));
        }
        setPendingPhoto(null);
        setForm({ name: "", phone: "", email: "", address: "", idProofType: "", idProofNumber: "" });
        setShowIdProof(false);
        setFieldErrors({});
        setValidationErrors([]);
        setDuplicateNameMatch(null);
        setConfirmedDuplicateName(false);
        toast.success('Retailer added');
        onClose();
        setShowOrderModal(true);
      })
      .catch((err) => {
        const apiErrors = parseApiErrorList(err);
        toast.error(apiErrors[0] || 'Failed to add retailer');
      });
  };

  const handleCloseAll = () => {
    setShowOrderModal(false);
  };

  return (
    <>
      {/* Stood down while the order-type modal is up. iOS presents each RN Modal
          on the root view controller and presents only one at a time, so a
          sibling modal raised while this one is open never appears. The contact
          picker no longer needs this guard: it is a step inside this modal now,
          which is what stopped it being a second modal in the first place.

          Standing down is only right for the order-type modal, because that is
          a hand-off: this form is finished and handleCloseAll closes it. The
          validation, duplicate-name and impersonation modals interrupt a form
          the shopkeeper is still filling in, so they are nested inside this
          Modal instead - see the bottom of it. */}
      <Modal
        visible={isOpen && !showOrderModal}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
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
            style={[
              styles.modalSheet,
              { paddingBottom: bottomInset },
              LAYOUT.isWeb && LAYOUT.contentContainerStyle,
              LAYOUT.isWeb && { alignSelf: 'center', width: '100%', borderBottomLeftRadius: 25, borderBottomRightRadius: 25 }
            ]}
            onPress={(e) => e.stopPropagation()}
          >

            {/* Header. The back arrow only exists on the form, and returns to
                the contact list rather than closing — someone who picked the
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
                {step === 'contacts' ? t('customers.pickFromContacts') : t('customers.addNew')}
              </Text>

              <Pressable
                position="absolute"
                right={0}
                onPress={onClose}
              >
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

            {/* Optional portrait. Above the fields because it is the one thing
                here that identifies the person at a glance. */}
            <HStack mb="$4">
              <CustomerPhotoPicker
                value={pendingPhoto}
                name={form.name}
                onPick={setPendingPhoto}
                onRemove={() => setPendingPhoto(null)}
              />
            </HStack>

            {/* Form */}
            <VStack space="md">

              {/* Name */}
              <VStack space="xs">
                <Text fontWeight="$semibold" color={fieldErrors.name ? "$red500" : "$coolGray800"}>{t("customers.name")}</Text>
                <Input
                  borderWidth={1} rounded="$xl" style={{ borderColor: fieldErrors.name ? '#EF4444' : '#c5c5c5' }}
                >
                  <InputField
                    placeholder={t("customers.placeholders.name")}
                    value={form.name}
                    onChangeText={(text) => { setForm({ ...form, name: text }); setFieldErrors(e => ({ ...e, name: undefined })); }}
                    // Title-cased once the field is done rather than on every
                    // keystroke, which re-cases mid-word and makes a deliberate
                    // lower-case letter impossible to keep.
                    onBlur={() => setForm(f => ({ ...f, name: capitalizeWords(f.name) }))}
                    maxLength={INPUT_LIMITS.customerName}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </Input>
                <CharCounter value={form.name} limit={INPUT_LIMITS.customerName} />
              </VStack>

              {/* Phone */}
              <VStack space="xs">
                <Text fontWeight="$semibold" color={fieldErrors.phone ? "$red500" : "$coolGray800"}> {t("customers.phoneOptional") || t("customers.phone")}</Text>
                <Input borderWidth={1} rounded="$xl" style={{ borderColor: fieldErrors.phone ? '#EF4444' : '#c5c5c5' }}>
                  <InputField
                    placeholder={t("customers.placeholders.phone")}
                    keyboardType="phone-pad"
                    value={form.phone}
                    maxLength={INPUT_LIMITS.phone}
                    onChangeText={(text) => { setForm({ ...form, phone: text }); setFieldErrors(e => ({ ...e, phone: undefined })); }}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                  {!LAYOUT.isWeb && (
                    <Pressable onPress={() => setStep('contacts')} pr="$3" pl="$2" alignItems="center" justifyContent="center">
                      <Icon as={Contact} size="sm" color="#6366F1" />
                    </Pressable>
                  )}
                </Input>
              </VStack>

              {/* Address */}
              <VStack space="xs">
                <Text fontWeight="$semibold">{t("customers.address")}</Text>
                <Input borderWidth={1} rounded="$xl" style={{ borderColor: '#c5c5c5' }}>
                  <InputField
                    placeholder={t("customers.placeholders.address")}
                    value={form.address}
                    onChangeText={(text) => setForm({ ...form, address: text })}
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
                    {t("customers.moreDetails") || "More details (optional)"}
                  </Text>
                  <Icon as={showIdProof ? ChevronUp : ChevronDown} size="sm" color="$coolGray500" />
                </HStack>
              </Pressable>

              {showIdProof && (
                <VStack space="sm">
                  <VStack space="xs">
                    <Text fontSize={12} color="$coolGray600">{t("customers.email")}</Text>
                    <Input borderWidth={1} rounded="$xl" style={{ borderColor: '#c5c5c5' }}>
                      <InputField
                        placeholder={t("customers.placeholders.email")}
                        value={form.email}
                        onChangeText={(text) => setForm({ ...form, email: text })}
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
                      {t("customers.idProof.type") || "ID Proof Type"}
                    </Text>
                    <SelectField
                      value={form.idProofType}
                      items={ID_PROOF_TYPES.map(v => ({
                        label: t(`declaration.idProof.types.${v}`) || v,
                        value: v,
                      }))}
                      placeholder={t("customers.idProof.selectType") || "Select..."}
                      title={t("customers.idProof.title") || "ID Proof"}
                      onValueChange={v => setForm(f => ({ ...f, idProofType: v as IdProofType }))}
                    />
                  </VStack>
                  <VStack space="xs">
                    <Text fontSize={12} color="$coolGray600">
                      {t("customers.idProof.number") || "ID Proof Number"}
                    </Text>
                    <Input borderWidth={1} rounded="$xl" style={{ borderColor: '#c5c5c5' }}>
                      <InputField
                        placeholder={t("customers.idProof.numberPlaceholder") || "e.g. ABCDE1234F"}
                        value={form.idProofNumber}
                        maxLength={INPUT_LIMITS.idProofNumber}
                        autoCapitalize="characters"
                        onChangeText={(text) => setForm(f => ({ ...f, idProofNumber: text }))}
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                      />
                    </Input>
                  </VStack>
                </VStack>
              )}

            </VStack>

            {/* Error banner for unexpected errors — removed, now handled by ValidationErrorModal */}

            {/* Gradient Button */}
            <Pressable onPress={handleAddCustomer} style={{ marginTop: 24 }}>
              <Box rounded="$xl" overflow="hidden">
                <Svg height="50" width="100%">
                  <Defs>
                    <LinearGradient id="addCustGrad" x1="0" y1="0" x2="1" y2="0">
                      <Stop offset="0%" stopColor="#6366F1" />
                      <Stop offset="100%" stopColor="#D946EF" />
                    </LinearGradient>
                  </Defs>
                  <Rect width="100%" height="50" rx="16" fill="url(#addCustGrad)" />
                </Svg>

                <Box position="absolute" top={0} bottom={0} left={0} right={0} alignItems="center" justifyContent="center">
                  <Text color="$white" fontWeight="$bold" fontSize={16}>
                    {t("customers.addAndCreateOrder") || "Add Retailer & Create Order"}
                  </Text>
                </Box>
              </Box>
            </Pressable>

            {/* Cancel */}
            <Pressable onPress={onClose} style={{ marginTop: 12 }}>
              <Box
                bg="$coolGray100"
                rounded="$xl"
                py="$3"
                alignItems="center"
              >
                <Text fontWeight="$medium">{t("customers.cancel")}</Text>
              </Box>
            </Pressable>
            </>
            )}

          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>

        {/* Nested, not siblings. As siblings none of these three was ever
            presented on iOS: submitting an invalid form set showValidationModal
            and nothing appeared, so the only feedback was the red field outline
            the same code path sets. Nested they present on top of this Modal,
            which is what the photo source sheet in here already relies on. */}
        <ValidationErrorModal
          isOpen={showValidationModal}
          errors={validationErrors}
          onClose={() => setShowValidationModal(false)}
        />

        <ConfirmModal
          visible={Boolean(duplicateNameMatch)}
          title={t('customers.validation.duplicateNameTitle') || 'Retailer with this name exists'}
          description={
            (t('customers.validation.duplicateNameMessage') ||
              'You already have a retailer named {name}. Without a phone number there is no way to tell them apart later. Add anyway?'
            ).replace('{name}', duplicateNameMatch || '')
          }
          confirmLabel={t('customers.validation.duplicateNameConfirm') || 'Add anyway'}
          cancelLabel={t('customers.cancel') || 'Cancel'}
          onClose={() => setDuplicateNameMatch(null)}
          onConfirm={() => {
            setDuplicateNameMatch(null);
            setConfirmedDuplicateName(true);
            saveCustomer(form.phone.trim());
          }}
        />

        <ImpersonationBlockModal
          isOpen={blockModalVisible}
          phone={impersonatePhone || ''}
          onEndSession={handleEndSession}
          onClose={() => setBlockModalVisible(false)}
        />

        {/* The photo picker reports a failed pick with a toast, and the root
            viewport sits under this modal's own native layer. */}
        <ToastViewport />
      </Modal>

      <OrderTypeModal
        isOpen={showOrderModal}
        onClose={handleCloseAll}
        preSelectedCustomerId={newCustomerId}
      />
    </>
  );
};

const styles = StyleSheet.create({
  modalSheet: {
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 -6px 20px rgba(0,0,0,0.15)" }
      : { elevation: 20 }),
  },
});

export default AddCustomerModal;
