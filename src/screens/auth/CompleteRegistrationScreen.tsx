import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Keyboard } from "react-native";
import {
  Box,
  HStack,
  Input,
  InputField,
  Pressable,
  ScrollView,
  Text,
  VStack,
  Icon,
} from "@gluestack-ui/themed";
import { useNavigation } from "@react-navigation/native";
import { Store, Info } from "lucide-react-native";

import CommonHeader from "../../components/CommonHeader";
import GradientButton from "../../components/GradientButton";
import ValidationErrorModal from "../../components/ValidationErrorModal";
import ConfirmModal from "../../components/ConfirmModal";
import { useTranslation } from "../../hooks/useTranslation";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchShopDetails, updateShopDetails } from "../../store/data/dataSlice";
import { completeRegistration, logout, skipRegistration } from "../../store/auth/authSlice";
import { capitalizeWords } from "../../utils/textUtils";
import { parseApiErrorList } from "../../utils/errorUtils";
import { useContentContainerStyle } from "../../constants/layout";
import { INPUT_LIMITS, validateText } from "../../constants/inputLimits";
import CharCounter from "../../components/common/CharCounter";

const Label = ({ children }: { children: React.ReactNode }) => (
  <Text fontSize="$sm" fontWeight="$bold" color="$coolGray700">
    {children}
  </Text>
);

const Card = ({ children }: { children: React.ReactNode }) => (
  <Box
    bg="$white"
    rounded="$2xl"
    p="$4"
    hardShadow="1"
    borderWidth={1}
    borderColor="$coolGray100"
  >
    {children}
  </Box>
);

const CompleteRegistrationScreen = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const contentContainerStyle = useContentContainerStyle();
  const shopDetails = useAppSelector((s) => s.data.shopDetails);
  const loading = useAppSelector((s) => s.data.loading);
  const authPhone = useAppSelector((s) => s.auth.phone);

  const [form, setForm] = useState({ ownerName: "", shopName: "", address: "" });
  const [fieldErrors, setFieldErrors] = useState<{ ownerName?: boolean; shopName?: boolean; address?: boolean }>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);

  useEffect(() => {
    dispatch(fetchShopDetails());
  }, []);

  useEffect(() => {
    if (shopDetails) {
      setForm((prev) => ({
        ...prev,
        ownerName: String((shopDetails as any).ownerName || ""),
        shopName: String(shopDetails.shopName === "My Jewelry Shop" ? "" : shopDetails.shopName || ""),
        address: String(shopDetails.address || ""),
      }));
    }
  }, [shopDetails]);

  const phone = String(shopDetails?.phone || authPhone || "");

  const set = (k: keyof typeof form, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async () => {
    const ownerName = form.ownerName.trim();
    const shopName = form.shopName.trim();
    const address = form.address.trim();

    const errors: string[] = [];
    const fields: typeof fieldErrors = {};

    if (!ownerName) { errors.push(t("auth.register.alerts.ownerNameRequired") || "Shop owner full name is required"); fields.ownerName = true; }
    if (!shopName) { errors.push(t("auth.register.alerts.shopNameRequired") || "Shop name is required"); fields.shopName = true; }
    if (!address) { errors.push(t("auth.register.alerts.addressRequired") || "Shop address is required"); fields.address = true; }

    // Values pre-filled from an existing record can predate these caps.
    ([
      ['ownerName', ownerName, t("auth.register.ownerName") || "Owner name", INPUT_LIMITS.ownerName],
      ['shopName', shopName, t("auth.register.shopName") || "Shop name", INPUT_LIMITS.shopName],
      ['address', address, t("auth.register.address") || "Shop address", INPUT_LIMITS.addressLine],
    ] as const).forEach(([key, value, label, limit]) => {
      const msg = validateText(value, { label, limit });
      if (msg) { errors.push(msg); fields[key] = true; }
    });

    setFieldErrors(fields);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setShowValidationModal(true);
      return;
    }

    const result = await dispatch(updateShopDetails({
      id: shopDetails?.id,
      name: shopName,
      shopName,
      ownerName,
      address,
      phone,
    } as any));

    if (updateShopDetails.fulfilled.match(result)) {
      dispatch(completeRegistration());
      (navigation as any).reset({ index: 0, routes: [{ name: "MainTabs" }] });
    } else {
      setValidationErrors(parseApiErrorList(result.payload));
      setShowValidationModal(true);
    }
  };

  return (
    <Box flex={1} bg="$coolGray50">
      <CommonHeader
        variant="light"
        title={t("auth.register.headerTitle")}
        subtitle={t("auth.register.headerSubtitle")}
        showBack
        onPressBack={() => setShowCancelModal(true)}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          flex={1}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 100, ...contentContainerStyle }}
        >
          <Pressable onPress={Platform.OS === "web" ? undefined : Keyboard.dismiss}>
            <>
              <Card>
                <HStack space="md" alignItems="center">
                  <Box w="$12" h="$12" rounded="$full" bg="$purple600" alignItems="center" justifyContent="center">
                    <Icon as={Store} size="xl" color="$white" />
                  </Box>
                  <VStack flex={1}>
                    <Text fontWeight="$bold" fontSize="$md" color="$coolGray900">
                      {t("auth.register.infoTitle")}
                    </Text>
                    <Text fontSize="$sm" color="$coolGray500">
                      {t("auth.register.infoSubtitle")}
                    </Text>
                  </VStack>
                </HStack>

                <VStack mt="$4" space="md">
                  <VStack space="xs">
                    <Label>{t("auth.register.phone")}</Label>
                    <Input isDisabled bg="$coolGray100" borderWidth={0} rounded="$lg" h="$11">
                      <InputField value={phone} keyboardType="phone-pad" editable={false} />
                    </Input>
                  </VStack>

                  <VStack space="xs">
                    <Label>{t("auth.register.ownerName")}<Text color="$red500"> *</Text></Label>
                    <Input bg={fieldErrors.ownerName ? "$red50" : "$coolGray100"} borderWidth={fieldErrors.ownerName ? 1 : 0} borderColor={fieldErrors.ownerName ? "$red400" : "transparent"} rounded="$lg" h="$11">
                      <InputField
                        placeholder={t("auth.register.placeholders.ownerName")}
                        value={form.ownerName}
                        onChangeText={(v) => { set("ownerName", capitalizeWords(v)); setFieldErrors((e) => ({ ...e, ownerName: undefined })); }}
                        maxLength={INPUT_LIMITS.ownerName}
                        returnKeyType="next"
                        placeholderTextColor="#9CA3AF"
                      />
                    </Input>
                    <CharCounter value={form.ownerName} limit={INPUT_LIMITS.ownerName} />
                  </VStack>

                  <VStack space="xs">
                    <Label>{t("auth.register.shopName")}<Text color="$red500"> *</Text></Label>
                    <Input bg={fieldErrors.shopName ? "$red50" : "$coolGray100"} borderWidth={fieldErrors.shopName ? 1 : 0} borderColor={fieldErrors.shopName ? "$red400" : "transparent"} rounded="$lg" h="$11">
                      <InputField
                        placeholder={t("auth.register.placeholders.shopName")}
                        value={form.shopName}
                        onChangeText={(v) => { set("shopName", capitalizeWords(v)); setFieldErrors((e) => ({ ...e, shopName: undefined })); }}
                        maxLength={INPUT_LIMITS.shopName}
                        returnKeyType="next"
                        placeholderTextColor="#9CA3AF"
                      />
                    </Input>
                    <CharCounter value={form.shopName} limit={INPUT_LIMITS.shopName} />
                  </VStack>

                  <VStack space="xs">
                    <Label>{t("auth.register.address")}<Text color="$red500"> *</Text></Label>
                    <Input bg={fieldErrors.address ? "$red50" : "$coolGray100"} borderWidth={fieldErrors.address ? 1 : 0} borderColor={fieldErrors.address ? "$red400" : "transparent"} rounded="$lg" h="$11">
                      <InputField
                        placeholder={t("auth.register.placeholders.address")}
                        value={form.address}
                        onChangeText={(v) => { set("address", capitalizeWords(v)); setFieldErrors((e) => ({ ...e, address: undefined })); }}
                        maxLength={INPUT_LIMITS.addressLine}
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                        placeholderTextColor="#9CA3AF"
                      />
                    </Input>
                    <CharCounter value={form.address} limit={INPUT_LIMITS.addressLine} />
                  </VStack>
                </VStack>
              </Card>

              <Box mt="$4" bg="$blue50" borderWidth={1} borderColor="$blue100" rounded="$xl" p="$3">
                <HStack space="sm" alignItems="flex-start">
                  <Icon as={Info} size="sm" color="$blue600" style={{ marginTop: 2 }} />
                  <Text flex={1} fontSize={13} color="$blue800" lineHeight={18}>
                    {t("auth.register.note")}
                  </Text>
                </HStack>
              </Box>

              <Box mt="$6">
                <GradientButton
                  label={loading ? t("auth.register.submitting") : t("auth.register.submit")}
                  onPress={handleSubmit}
                  disabled={loading}
                />
              </Box>

              {/* The escape hatch. Three mandatory fields between an OTP and
                  seeing anything is where people were closing the app for good —
                  and because the account is created at OTP verification, they
                  left a permanent empty record behind. Letting them in costs a
                  shop name we can ask for later; blocking them costs the user.

                  Deliberately a quiet text link under the primary button:
                  finishing now is still the encouraged path. */}
              <Pressable
                mt="$4"
                py="$2"
                alignItems="center"
                disabled={loading}
                onPress={() => setShowSkipModal(true)}
              >
                <Text fontSize={14} fontWeight="$medium" color="$coolGray500">
                  {t("auth.register.skip")}
                </Text>
              </Pressable>
            </>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <ValidationErrorModal
        isOpen={showValidationModal}
        errors={validationErrors}
        onClose={() => setShowValidationModal(false)}
      />

      <ConfirmModal
        visible={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        tone="warning"
        icon="alert"
        title={t("auth.register.cancelTitle") || "Cancel registration?"}
        description={
          t("auth.register.cancelDescription") ||
          "You haven't finished registering yet. Going back will take you to the login screen — you'll need to verify your phone number again to continue."
        }
        cancelLabel={t("auth.register.cancelStay") || "Stay here"}
        confirmLabel={t("auth.register.cancelConfirm") || "Go back to login"}
        onConfirm={() => {
          setShowCancelModal(false);
          dispatch(logout());
        }}
      />

      <ConfirmModal
        visible={showSkipModal}
        onClose={() => setShowSkipModal(false)}
        tone="warning"
        icon="alert"
        title={t("auth.register.skipTitle")}
        // States the one real consequence — bills carry the shop's name and
        // address — so skipping is an informed choice rather than a trapdoor.
        description={t("auth.register.skipDescription")}
        cancelLabel={t("auth.register.skipStay")}
        confirmLabel={t("auth.register.skipConfirm")}
        onConfirm={() => {
          setShowSkipModal(false);
          dispatch(skipRegistration());
        }}
      />
    </Box>
  );
};

export default CompleteRegistrationScreen;
