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
import { X, Contact, ChevronLeft } from "lucide-react-native";
import { ToastViewport } from "./common/Toast";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "../hooks/useTranslation";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { addCustomer, clearUserData } from "../store/data/dataSlice";
import { endImpersonation } from "../store/auth/authSlice";
import { useSheetBottomInset } from "../hooks/useSheetBottomInset";
import ImpersonationBlockModal from "./ImpersonationBlockModal";
import ConfirmModal from "./ConfirmModal";
import { parseApiErrorList } from "../utils/errorUtils";
import { capitalizeWords } from "../utils/textUtils";
import ValidationErrorModal from "./ValidationErrorModal";
import { toast } from "./common/Toast";
import { LAYOUT } from "../constants/layout";
import { INPUT_LIMITS, clampToLimit, validateText } from "../constants/inputLimits";
import { retailerDisplayName } from "../utils/retailerName";
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

  /**
   * Owner name, shop name, phone. Nothing else.
   *
   * The OWNER is the required one: a wholesaler always knows who they are
   * dealing with, while plenty of small retailers trade under their own name
   * and have no shop name to record. `customer.name` — the identity everything
   * downstream reads — is derived from the two, never typed. See
   * `retailerDisplayName`.
   *
   * This form used to ask for address, email, ID proof and a portrait as well:
   * the shape of a RETAIL customer, which is what the app was before it became
   * a wholesaler's book. Someone adding a retailer mid-transaction, with a
   * counter full of gold, skipped past every one of them.
   */
  const [form, setForm] = useState({
    ownerName: "",
    shopName: "",
    phone: "",
  });
  const [fieldErrors, setFieldErrors] = useState<{ ownerName?: boolean; phone?: boolean }>({});
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

  /**
   * The phone book, opened from the Phone field rather than as a first step.
   *
   * It used to be the screen this modal OPENED on. It no longer is, because a
   * contact cannot fill the whole form — it holds a person and a number, which
   * is the owner name and the phone, but never the shop name. Opening on a
   * picker that can only ever fill part of the form put a step in front of
   * every retailer added by hand.
   *
   * From the field it is offered at the moment it can actually help.
   */
  const [pickingContact, setPickingContact] = useState(false);

  const navigation = useNavigation<any>();

  const handleEndSession = () => {
    dispatch(endImpersonation());
    dispatch(clearUserData());
    navigation.navigate('AdminDashboard');
  };

  const handleAddCustomer = () => {
    if (impersonateUserId) { setBlockModalVisible(true); return; }
    const errors: string[] = [];
    const fields: { ownerName?: boolean; phone?: boolean } = {};

    if (!form.ownerName.trim()) {
      errors.push(t('customers.validation.ownerNameRequired') || 'Owner name is required');
      fields.ownerName = true;
    } else {
      // The contact picker can drop in a value longer than the field allows, so
      // the cap has to be re-checked here and not just on the input.
      const ownerError = validateText(form.ownerName, { label: t('customers.ownerName') || 'Owner Name', limit: INPUT_LIMITS.customerName });
      if (ownerError) { errors.push(ownerError); fields.ownerName = true; }
    }

    // Optional, so only checked for length when something was actually typed.
    const shopError = validateText(form.shopName, { label: t('customers.shopName') || 'Shop Name', limit: INPUT_LIMITS.customerName });
    if (shopError) errors.push(shopError);

    /**
     * Optional, like it was before.
     *
     * A wholesaler adding a retailer mid-transaction may not have the number to
     * hand, and refusing to save the retailer over it would stop the order.
     * Everything below applies only once a number has actually been entered —
     * an optional field still has to be a valid number when it is filled in.
     */
    const trimmedPhone = form.phone.trim();
    if (!trimmedPhone) {
      // Nothing to validate, and nothing to check for duplicates against. The
      // duplicate shop-name warning below is what stands in for the phone check.
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

    /**
     * Without a number there is nothing stronger than the shop name to detect a
     * duplicate with, so a matching one is all there is.
     *
     * Advisory, never a block: two retailers really can both be "Krishna
     * Jewellers", and the shopkeeper is the one who knows whether this is the
     * same shop. The per-shop customer code is what tells them apart after.
     */
    const displayName = retailerDisplayName(form.shopName, form.ownerName);
    if (!trimmedPhone && !confirmedDuplicateName) {
      const clash = customers.find(
        (c) => c.name.trim().toLowerCase() === displayName.toLowerCase(),
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
      // Derived, never typed — see retailerDisplayName.
      name: retailerDisplayName(form.shopName, form.ownerName),
      ownerName: form.ownerName.trim(),
      // Omitted rather than sent as "" so an unnamed shop stays absent on the
      // record instead of being stored as an empty string.
      ...(form.shopName.trim() ? { shopName: form.shopName.trim() } : {}),
      // Same, and here it matters more than tidiness: the backend's unique
      // index is partial on `phone: {$type: "string"}`, so an empty string is a
      // VALUE — store it and the second phoneless retailer collides with the
      // first. See the index at the bottom of customer.model.ts.
      ...(trimmedPhone ? { phone: trimmedPhone } : {}),
    })).unwrap()
      .then((updatedCustomers) => {
        const newest = updatedCustomers[0];
        setForm({ ownerName: "", shopName: "", phone: "" });
        setFieldErrors({});
        setValidationErrors([]);
        setDuplicateNameMatch(null);
        setConfirmedDuplicateName(false);
        toast.success('Retailer added');
        onClose();
        // Straight into the order with the new retailer already chosen — the
        // step that used to ask "what kind of order?" is gone, since the
        // payment section answers that now.
        if (newest?.id) navigation.navigate('NewOrder', { customerId: newest.id });
      })
      .catch((err) => {
        const apiErrors = parseApiErrorList(err);
        toast.error(apiErrors[0] || 'Failed to add retailer');
      });
  };

  return (
    <>
      {/* The validation, duplicate-name and impersonation modals interrupt a
          form still being filled in, so they are nested inside this Modal
          rather than raised as siblings — iOS presents one modal at a time,
          and a sibling raised over this one never appears. */}
      <Modal
        visible={isOpen}
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

            {/* The back arrow exists only over the contact list, and returns to
                the form rather than closing — someone who opened the picker by
                mistake should not lose what they have already typed. */}
            <HStack justifyContent="center" alignItems="center" mb="$4">
              {pickingContact && (
                <Pressable
                  position="absolute"
                  left={0}
                  onPress={() => setPickingContact(false)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityLabel={t('common.back') || 'Back'}
                >
                  <Icon as={ChevronLeft} size="md" />
                </Pressable>
              )}
              <Text fontSize={20} fontWeight="$bold">
                {pickingContact ? t('customers.pickFromContacts') : t('customers.addNew')}
              </Text>

              <Pressable
                position="absolute"
                right={0}
                onPress={onClose}
              >
                <Icon as={X} size="md" />
              </Pressable>
            </HStack>

            {/* The picker fills the person and the number — the two fields a
                phone contact actually holds. The shop name is left alone: it is
                not in a contact, and clobbering a typed one would be worse than
                filling nothing. */}
            {pickingContact && !LAYOUT.isWeb && (
              <ContactsStep
                onPickContact={picked => {
                  setForm(f => ({
                    ...f,
                    ownerName: picked.name ? clampToLimit(picked.name, INPUT_LIMITS.customerName) : f.ownerName,
                    phone: picked.phone ? clampToLimit(picked.phone, INPUT_LIMITS.phone) : f.phone,
                  }));
                  setFieldErrors(e => ({ ...e, ownerName: undefined, phone: undefined }));
                  setPickingContact(false);
                }}
                onAddManually={() => setPickingContact(false)}
              />
            )}

            {/* Two fields, both about the shop. Everything else this form used
                to ask — address, email, ID proof, portrait — belonged to a
                retail customer, not to a retailer a wholesaler bills. */}
            <VStack space="md">

              {/* Owner name — the required one, and so the first one. */}
              <VStack space="xs">
                <Text fontWeight="$semibold" color={fieldErrors.ownerName ? "$red500" : "$coolGray800"}>
                  {t("customers.ownerName") || "Owner Name"}
                </Text>
                <Input
                  borderWidth={1} rounded="$xl" style={{ borderColor: fieldErrors.ownerName ? '#EF4444' : '#c5c5c5' }}
                >
                  <InputField
                    placeholder={t("customers.placeholders.ownerName") || "e.g. Ramesh Patel"}
                    value={form.ownerName}
                    onChangeText={(text) => { setForm({ ...form, ownerName: text }); setFieldErrors(e => ({ ...e, ownerName: undefined })); }}
                    // Title-cased once the field is done rather than on every
                    // keystroke, which re-cases mid-word and makes a deliberate
                    // lower-case letter impossible to keep.
                    onBlur={() => setForm(f => ({ ...f, ownerName: capitalizeWords(f.ownerName) }))}
                    maxLength={INPUT_LIMITS.customerName}
                    returnKeyType="next"
                  />
                </Input>
                <CharCounter value={form.ownerName} limit={INPUT_LIMITS.customerName} />
              </VStack>

              {/* Shop name. Optional — plenty of retailers trade under the
                  owner's own name, and there is nothing else to record. When
                  it is given it becomes the name on the bill; when it is not,
                  the owner's name is. See retailerDisplayName. */}
              <VStack space="xs">
                <Text fontWeight="$semibold" color="$coolGray800">
                  {t("customers.shopName") || "Shop Name"}
                </Text>
                <Input borderWidth={1} rounded="$xl" style={{ borderColor: '#c5c5c5' }}>
                  <InputField
                    placeholder={t("customers.placeholders.shopName") || "e.g. Krishna Jewellers"}
                    value={form.shopName}
                    onChangeText={(text) => setForm({ ...form, shopName: text })}
                    onBlur={() => setForm(f => ({ ...f, shopName: capitalizeWords(f.shopName) }))}
                    maxLength={INPUT_LIMITS.customerName}
                    returnKeyType="next"
                  />
                </Input>
                <CharCounter value={form.shopName} limit={INPUT_LIMITS.customerName} />
              </VStack>

              {/* Phone. Optional — a wholesaler adding a retailer mid-order may
                  not have the number to hand, and blocking the save over it
                  would stop the transaction. The contact button fills this and
                  the owner name together, which is what a phone contact holds. */}
              <VStack space="xs">
                <Text fontWeight="$semibold" color={fieldErrors.phone ? "$red500" : "$coolGray800"}>
                  {t("customers.phoneOptional") || "Phone (optional)"}
                </Text>
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
                  {/* Web has no phone book to read, so the button is native-only
                      — exactly as it was before. */}
                  {!LAYOUT.isWeb && (
                    <Pressable
                      onPress={() => setPickingContact(true)}
                      pr="$3" pl="$2"
                      alignItems="center" justifyContent="center"
                      accessibilityLabel={t('customers.pickFromContacts') || 'Pick from contacts'}
                    >
                      <Icon as={Contact} size="sm" color="#6366F1" />
                    </Pressable>
                  )}
                </Input>
              </VStack>

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
          title={t('customers.validation.duplicateShopTitle') || 'Retailer with this shop name exists'}
          description={
            (t('customers.validation.duplicateShopMessage') ||
              'You already have a retailer called {name}. Add this one anyway?'
            ).replace('{name}', duplicateNameMatch || '')
          }
          confirmLabel={t('customers.validation.duplicateNameConfirm') || 'Add anyway'}
          cancelLabel={t('customers.cancel') || 'Cancel'}
          onClose={() => setDuplicateNameMatch(null)}
          onConfirm={() => {
            setDuplicateNameMatch(null);
            setConfirmedDuplicateName(true);
            // This prompt only appears when the phone is blank, so there is
            // never a number to carry through here.
            saveCustomer('');
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
