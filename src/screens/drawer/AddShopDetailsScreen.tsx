import React, { useState, useEffect } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  Keyboard,
  Alert,
} from "react-native";
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
import { Store, Image as ImageIcon, PenLine, Eye, X, Camera, Pencil, Trash2, RotateCw } from "lucide-react-native";
import { SvgXml } from 'react-native-svg';
import SignatureCaptureModal from '../../components/common/SignatureCaptureModal';
import PhotoSourceSheet from '../../components/photos/PhotoSourceSheet';
import { pickPhotos } from '../../utils/photoPicker';
import { rotateSignatureSvg, canRotateSignature } from '../../utils/signature';

import CommonHeader from "../../components/CommonHeader";
import { HELP_TOPICS } from "../../tutorials/catalog";
import GradientButton from "../../components/GradientButton";
import { useTranslation } from "../../hooks/useTranslation";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchShopDetails, updateShopDetails, clearUserData } from "../../store/data/dataSlice";
import { endImpersonation, logout } from "../../store/auth/authSlice";
import { toast } from "../../components/common/Toast";
import ImpersonationBlockModal from "../../components/ImpersonationBlockModal";
import LoginRequiredModal from "../../components/LoginRequiredModal";
import { getFullImageUrl } from "../../utils/imageUtils";
import { capitalizeWords } from "../../utils/textUtils";
import { parseApiErrorList } from "../../utils/errorUtils";
import ValidationErrorModal from "../../components/ValidationErrorModal";
import { LAYOUT } from "../../constants/layout";
import { INPUT_LIMITS, validateText } from "../../constants/inputLimits";
import CharCounter from "../../components/common/CharCounter";

/**
 * Ceiling for a branding image, matching the backend's multer limit for the
 * shop-details routes (`uploadShopImages`, 10 MB per file).
 *
 * The logo and header are now uploaded at full resolution, so this is a real
 * limit rather than a backstop — a 48MP phone photo of a printed board can
 * exceed it. Checked here so the shopkeeper is told before waiting through the
 * upload, instead of getting multer's opaque LIMIT_FILE_SIZE at the end of it.
 * Keep the two numbers in step; a client cap above the server's just moves the
 * failure later.
 */
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

/* ─── Styles ─── */
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    width: "100%",
    overflow: "hidden",
    maxHeight: "80%",
  },
  modalHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  closeBtn: {
    padding: 4,
  },
  modalImage: {
    width: "100%",
    height: 280,
    backgroundColor: "#F9FAFB",
  },
  modalPlaceholder: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
  },
  replaceBtn: {
    margin: 16,
    backgroundColor: "#6D5EF7",
    borderRadius: 12,
    paddingVertical: 14,
  },
});

/* ─── Helpers ─── */
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

const Field = (props: React.ComponentProps<typeof InputField>) => (
  <Input bg="$coolGray100" borderWidth={0} rounded="$lg" h="$11">
    <InputField {...props} placeholderTextColor="#9CA3AF" />
  </Input>
);

/* ─── Image Preview Modal ─── */
interface ImagePreviewModalProps {
  visible: boolean;
  uri: string | null;
  title: string;
  noImageText: string;
  replaceLabel: string;
  onClose: () => void;
  onReplace: () => void;
}
const ImagePreviewModal = ({ visible, uri, title, noImageText, replaceLabel, onClose, onReplace }: ImagePreviewModalProps) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback>
          <View style={styles.modalCard}>
            {/* Header */}
            <HStack justifyContent="space-between" alignItems="center" style={styles.modalHeader}>
              <Text fontWeight="$bold" fontSize="$lg" color="$coolGray900">{title}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Icon as={X} size="md" color="$coolGray700" />
              </TouchableOpacity>
            </HStack>

            {/* Image */}
            {uri ? (
              <Image
                source={{ uri }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.modalPlaceholder}>
                <Text color="$coolGray400">{noImageText}</Text>
              </View>
            )}

            {/* Replace button */}
            <TouchableOpacity onPress={onReplace} style={styles.replaceBtn}>
              <HStack space="sm" alignItems="center" justifyContent="center">
                <Icon as={Camera} size="sm" color="$white" />
                <Text color="$white" fontWeight="$semibold">{replaceLabel}</Text>
              </HStack>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  </Modal>
);

/* ─── Image Picker Row ─── */
interface ImagePickerRowProps {
  label: string;
  icon: any;
  placeholder: string;
  value: any | null;        // null | { uri, ... } (new pick) | string (existing URL)
  onPick: () => void;
  onPreview: () => void;
  onRemove?: () => void;
}
const ImagePickerRow = ({ label, icon, placeholder, value, onPick, onPreview, onRemove }: ImagePickerRowProps) => {
  const uri = getFullImageUrl(value);
  return (
    <VStack space="xs">
      <Label>{label}</Label>
      <HStack space="sm" alignItems="center">
        {/* Picker / Thumbnail button */}
        <Box
          flex={1}
          bg="$white"
          borderWidth={1}
          borderColor={uri ? "$purple300" : "$coolGray200"}
          borderStyle={uri ? "solid" : "dashed"}
          rounded="$xl"
          style={{ height: 100, overflow: "hidden" }}
        >
          <Pressable
            flex={1}
            onPress={onPick}
            justifyContent="center"
            alignItems="center"
          >
            {uri ? (
              <Image
                source={{ uri }}
                style={{ width: "90%", height: "90%" }}
                resizeMode="contain"
              />
            ) : (
              <VStack space="xs" alignItems="center">
                <Box bg="$coolGray100" p="$2" rounded="$full">
                  <Icon as={icon} size="md" color="$coolGray500" />
                </Box>
                <Text color="$coolGray400" fontSize="$xs" fontWeight="$medium">{placeholder}</Text>
              </VStack>
            )}
          </Pressable>
        </Box>

        {/* View / Delete buttons — only shown when an image is selected */}
        {uri && (
          <VStack space="xs">
            <Pressable
              bg="$white"
              borderWidth={1}
              borderColor="$purple600"
              rounded="$xl"
              w="$12"
              h="$12"
              alignItems="center"
              justifyContent="center"
              onPress={onPreview}
            >
              <Icon as={Eye} size="md" color="$purple600" />
            </Pressable>
            {onRemove && (
              <Pressable
                bg="$white"
                borderWidth={1}
                borderColor="$red400"
                rounded="$xl"
                w="$12"
                h="$12"
                alignItems="center"
                justifyContent="center"
                onPress={onRemove}
              >
                <Icon as={Trash2} size="md" color="$red400" />
              </Pressable>
            )}
          </VStack>
        )}
      </HStack>
    </VStack>
  );
};

/* ─── Main Screen ─── */
const AddShopDetailsScreen = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const shopDetails = useAppSelector((s) => s.data.shopDetails);
  const isEdit = !!shopDetails;
  const loading = useAppSelector((s) => s.data.loading);
  const { impersonateUserId, impersonatePhone, isGuest } = useAppSelector(s => s.auth);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [showLoginRequiredModal, setShowLoginRequiredModal] = useState(false);

  const handleEndSession = () => {
    dispatch(endImpersonation());
    dispatch(clearUserData());
    (navigation as any).navigate('AdminDashboard');
  };

  const [form, setForm] = useState({
    shopName: "",
    shopDesc: "",
    addr1: "",
    addr2: "",
    city: "",
    state: "",
    zipcode: "",
    phone: "",
    email: "",
    website: "",
    gst: "",
    logo: null as any,
    shopHeader: null as any,
    signature: null as any,
  });

  // Preview modal state
  const [preview, setPreview] = useState<{
    visible: boolean;
    field: "logo" | "shopHeader" | "signature" | null;
    title: string;
  }>({ visible: false, field: null, title: "" });

  const [fieldErrors, setFieldErrors] = useState<{
    shopName?: boolean; phone?: boolean; addr1?: boolean; email?: boolean; gst?: boolean;
  }>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showSignatureDrawModal, setShowSignatureDrawModal] = useState(false);
  // Signature is the one branding image worth photographing — a shop often has
  // it signed on paper rather than as a file.
  const [showSignatureSourceSheet, setShowSignatureSourceSheet] = useState(false);

  useEffect(() => {
    dispatch(fetchShopDetails());
  }, []);

  useEffect(() => {
    if (shopDetails) {
      setForm({
        shopName: String(shopDetails.shopName || shopDetails.name || ''),
        shopDesc: String(shopDetails.shopDesc || ''),
        addr1: typeof shopDetails.address === 'object'
          ? String((shopDetails.address as any)?.line1 || (shopDetails as any).addr1 || '')
          : String(shopDetails.address || (shopDetails as any).addr1 || ''),
        addr2: typeof shopDetails.address === 'object'
          ? String((shopDetails.address as any)?.line2 || (shopDetails as any).addr2 || '')
          : String((shopDetails as any).addr2 || ''),
        city: String((shopDetails as any).city || (shopDetails.address as any)?.city || ''),
        state: String((shopDetails as any).state || (shopDetails.address as any)?.state || ''),
        zipcode: String((shopDetails as any).zipcode || (shopDetails.address as any)?.zipcode || ''),
        phone: String(shopDetails.phone || ''),
        email: String(shopDetails.email || ''),
        website: String((shopDetails as any).website || ''),
        gst: String(shopDetails.gst || ''),
        logo: shopDetails.logo || null,
        shopHeader: shopDetails.shopHeader || null,
        signature: shopDetails.signature || null,
      });
    }
  }, [shopDetails]);

  const set = (k: keyof typeof form, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  /**
   * Branding images go through the shared pickPhotos rather than calling the
   * picker directly, so one place owns picker options, cancellation and errors.
   *
   * The logo and the header opt OUT of that helper's resize-and-compress pass.
   * Both are printed — the header stretched across the full width of a bill —
   * so the 1600px / quality-0.6 JPEG that is invisible on an ornament photo is
   * plainly visible on a shop name in Devanagari. They upload at full
   * resolution and the server does the one downsize, to print resolution.
   *
   * The signature stays compressed: it prints in a 90x32 box, where the
   * original resolution buys nothing and the smaller upload is worth having.
   */
  const pickImage = async (
    field: "logo" | "shopHeader" | "signature",
    mode: "camera" | "library" = "library",
  ) => {
    if (isGuest) {
      setShowLoginRequiredModal(true);
      return;
    }

    const outcome = await pickPhotos(
      mode,
      1,
      {
        capture: t("declaration.photos.capture") || "Capture",
        done: t("common.done") || "Done",
        cancel: t("common.cancel") || "Cancel",
      },
      { fullResolution: field !== "signature" },
    );

    if (outcome.status === "cancelled") return;
    if (outcome.status === "unavailable") {
      setValidationErrors([parseApiErrorList(t("shop.add.alerts.imageLibraryUnavailable"))[0]]);
      setShowValidationModal(true);
      return;
    }
    if (outcome.status === "error") {
      setValidationErrors(parseApiErrorList(outcome.message));
      setShowValidationModal(true);
      return;
    }

    const asset = outcome.photos[0];
    if (!asset) return;

    // Full-resolution originals make this a live check rather than a backstop:
    // nothing has shrunk the file by the time it gets here, on any platform.
    if (asset.fileSize && asset.fileSize > MAX_IMAGE_SIZE_BYTES) {
      setValidationErrors([t("shop.add.alerts.imageTooLarge") || "Image size should be less than 10MB"]);
      setShowValidationModal(true);
      return;
    }

    if (field === "shopHeader" && asset.width && asset.height) {
      const idealRatio = 2480 / 700;
      const actualRatio = asset.width / asset.height;
      const deviation = Math.abs(actualRatio - idealRatio) / idealRatio;
      if (deviation > 0.15) {
        Alert.alert(
          "Recommended Size",
          "This image doesn't match the recommended banner size (2480×700px). It will be stretched to fit.",
        );
      }
    }

    setForm((prev) => ({ ...prev, [field]: asset }));
    setPreview((prev) => ({ ...prev, visible: false }));
  };

  const openPreview = (field: "logo" | "shopHeader" | "signature") => {
    setPreview({
      visible: true,
      field,
      title: field === "logo" ? (t("shop.add.preview.shopLogoTitle") || "Shop Logo") : field === "shopHeader" ? (t("shop.add.preview.shopHeaderTitle") || "Shop Header") : (t("shop.add.preview.signatureTitle") || "Signature"),
    });
  };

  const handleSave = async () => {
    if (impersonateUserId) { setBlockModalVisible(true); return; }
    const shopName = String(form.shopName || "").trim();
    const phone = String(form.phone || "").trim();
    const email = String(form.email || "").trim();
    const address = `${form.addr1} ${form.addr2}`.trim();
    const gst = String(form.gst || "").trim();

    const errors: string[] = [];
    const fields: typeof fieldErrors = {};

    if (!shopName) { errors.push(t("shop.add.alerts.shopNameRequired") || 'Shop name is required'); fields.shopName = true; }
    if (!phone) { errors.push(t("shop.add.alerts.phoneRequired") || 'Phone is required'); fields.phone = true; }
    if (!form.addr1?.trim()) { errors.push(t("shop.add.alerts.addressRequired") || 'Address is required'); fields.addr1 = true; }

    // maxLength blocks typing/paste, but a value restored from an older record
    // (saved before these caps existed) can still be over the limit — surface it
    // here rather than letting the server reject the whole save.
    const lengthChecks: Array<[string | undefined, string, number, keyof typeof fields | undefined]> = [
      [shopName, t("shop.add.shopName") || 'Shop name', INPUT_LIMITS.shopName, 'shopName'],
      [form.shopDesc, t("shop.add.shopDesc") || 'Shop description', INPUT_LIMITS.shopDescription, undefined],
      [form.addr1, t("shop.add.addr1") || 'Address line 1', INPUT_LIMITS.addressLine, 'addr1'],
      [form.addr2, t("shop.add.addr2") || 'Address line 2', INPUT_LIMITS.addressLine, undefined],
      [form.city, t("shop.add.city") || 'City', INPUT_LIMITS.city, undefined],
      [form.state, t("shop.add.state") || 'State', INPUT_LIMITS.state, undefined],
      [email, t("shop.add.email") || 'Email', INPUT_LIMITS.email, 'email'],
      [form.website, t("shop.add.website") || 'Website', INPUT_LIMITS.website, undefined],
    ];
    lengthChecks.forEach(([value, label, limit, fieldKey]) => {
      const msg = validateText(value, { label, limit });
      if (msg) {
        errors.push(msg);
        if (fieldKey) fields[fieldKey] = true;
      }
    });

    if (phone && (phone.length !== 10 || !/^\d+$/.test(phone))) {
      errors.push(t("shop.add.alerts.phoneInvalid") || 'Enter a valid 10-digit phone number');
      fields.phone = true;
    }
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) { errors.push(t("shop.add.alerts.emailInvalid") || 'Enter a valid email address'); fields.email = true; }
    }
    if (gst) {
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstRegex.test(gst.toUpperCase())) { errors.push(t("shop.add.alerts.gstInvalid") || 'Enter a valid 15-character GST number'); fields.gst = true; }
    }

    setFieldErrors(fields);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setShowValidationModal(true);
      return;
    }

    const payload = {
      id: shopDetails?.id,
      name: shopName,
      shopName: shopName,
      shopDesc: form.shopDesc,
      phone: phone,
      email: email,
      address: form.addr1,
      addr1: form.addr1,
      addr2: form.addr2,
      city: form.city,
      state: form.state,
      zipcode: form.zipcode,
      gst: gst.toUpperCase(),
      logo: form.logo,
      shopHeader: form.shopHeader,
      signature: form.signature,
      // Flag a removal only when an existing image was cleared (had one, now empty)
      removeShopLogo: !form.logo && !!shopDetails?.logo,
      removeShopHeader: !form.shopHeader && !!shopDetails?.shopHeader,
      removeSignature: !form.signature && !!shopDetails?.signature,
    };

    const result = await dispatch(updateShopDetails(payload));

    if (updateShopDetails.fulfilled.match(result)) {
      toast.success(t("shop.add.alerts.saveSuccess") || 'Saved successfully!');
      navigation.goBack();
    } else {
      const apiErrors = parseApiErrorList(result.payload);
      toast.error(apiErrors[0] || 'Failed to save shop details');
    }
  };

  const previewUri = preview.field ? getFullImageUrl(form[preview.field]) : null;

  return (
    <Box flex={1} bg="$coolGray50">
      <CommonHeader
        variant="light"
        title={isEdit ? t("shop.add.headerTitleEdit") : t("shop.add.headerTitle")}
        subtitle={t("shop.add.headerSubtitle")}
        showBack
        onPressBack={() => navigation.goBack()}
        helpTopic={HELP_TOPICS.shopDetails}
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
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 100,
            ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {})
          }}
        >
          <Pressable onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss}>
            <>
              {/* ===== Shop Information Card ===== */}
              <Card>
                <HStack space="md" alignItems="center">
                  <Box
                    w="$12" h="$12"
                    rounded="$full"
                    bg="$purple600"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Icon as={Store} size="xl" color="$white" />
                  </Box>
                  <VStack flex={1}>
                    <Text fontWeight="$bold" fontSize="$md" color="$coolGray900">
                      {t("shop.add.infoTitle")}
                    </Text>
                    <Text fontSize="$sm" color="$coolGray500">
                      {t("shop.add.infoSubtitle")}
                    </Text>
                  </VStack>
                </HStack>

                <VStack mt="$4" space="md">
                  <VStack space="xs">
                    <Label>{t("shop.add.shopName")}<Text color="$red500"> *</Text></Label>
                    <Input bg={fieldErrors.shopName ? "$red50" : "$coolGray100"} borderWidth={fieldErrors.shopName ? 1 : 0} borderColor={fieldErrors.shopName ? "$red400" : "transparent"} rounded="$lg" h="$11">
                      <InputField
                        placeholder={t("shop.add.placeholders.shopName")}
                        value={form.shopName}
                        onChangeText={(v) => { set("shopName", capitalizeWords(v)); setFieldErrors(e => ({ ...e, shopName: undefined })); }}
                        maxLength={INPUT_LIMITS.shopName}
                        returnKeyType="next"
                        placeholderTextColor="#9CA3AF"
                      />
                    </Input>
                    <CharCounter value={form.shopName} limit={INPUT_LIMITS.shopName} />
                  </VStack>

                  <VStack space="xs">
                    <Label>{t("shop.add.shopDesc")}</Label>
                    <Field
                      placeholder={t("shop.add.placeholders.shopDesc")}
                      value={form.shopDesc}
                      onChangeText={(v) => set("shopDesc", capitalizeWords(v))}
                      maxLength={INPUT_LIMITS.shopDescription}
                      returnKeyType="next"
                    />
                    <CharCounter value={form.shopDesc} limit={INPUT_LIMITS.shopDescription} />
                  </VStack>

                  <VStack space="xs">
                    <Label>{t("shop.add.addr1")}<Text color="$red500"> *</Text></Label>
                    <Input bg={fieldErrors.addr1 ? "$red50" : "$coolGray100"} borderWidth={fieldErrors.addr1 ? 1 : 0} borderColor={fieldErrors.addr1 ? "$red400" : "transparent"} rounded="$lg" h="$11">
                      <InputField
                        placeholder={t("shop.add.placeholders.addr1")}
                        value={form.addr1}
                        onChangeText={(v) => { set("addr1", capitalizeWords(v)); setFieldErrors(e => ({ ...e, addr1: undefined })); }}
                        maxLength={INPUT_LIMITS.addressLine}
                        returnKeyType="next"
                        placeholderTextColor="#9CA3AF"
                      />
                    </Input>
                    <CharCounter value={form.addr1} limit={INPUT_LIMITS.addressLine} />
                  </VStack>

                  <VStack space="xs">
                    <Label>{t("shop.add.addr2")}</Label>
                    <Field
                      placeholder={t("shop.add.placeholders.addr2")}
                      value={form.addr2}
                      onChangeText={(v) => set("addr2", capitalizeWords(v))}
                      maxLength={INPUT_LIMITS.addressLine}
                      returnKeyType="next"
                    />
                    <CharCounter value={form.addr2} limit={INPUT_LIMITS.addressLine} />
                  </VStack>

                  <HStack space="sm">
                    <Box flex={1}>
                      <VStack space="xs">
                        <Label>{t("shop.add.city")}</Label>
                        <Field
                          placeholder={t("shop.add.placeholders.city")}
                          value={form.city}
                          onChangeText={(v) => set("city", capitalizeWords(v))}
                          maxLength={INPUT_LIMITS.city}
                          returnKeyType="next"
                        />
                      </VStack>
                    </Box>
                    <Box flex={1}>
                      <VStack space="xs">
                        <Label>{t("shop.add.state")}</Label>
                        <Field
                          placeholder={t("shop.add.placeholders.state")}
                          value={form.state}
                          onChangeText={(v) => set("state", capitalizeWords(v))}
                          maxLength={INPUT_LIMITS.state}
                          returnKeyType="next"
                        />
                      </VStack>
                    </Box>
                  </HStack>

                  <VStack space="xs">
                    <Label>{t("shop.add.zipcode")}</Label>
                    <Field
                      placeholder={t("shop.add.placeholders.zipcode")}
                      value={form.zipcode}
                      onChangeText={(v) => set("zipcode", v.replace(/[^0-9]/g, ""))}
                      keyboardType="number-pad"
                      maxLength={INPUT_LIMITS.zipcode}
                      returnKeyType="next"
                    />
                  </VStack>

                  <VStack space="xs">
                    <Label>{t("shop.add.phone")}<Text color="$red500"> *</Text></Label>
                    <Input bg={fieldErrors.phone ? "$red50" : "$coolGray100"} borderWidth={fieldErrors.phone ? 1 : 0} borderColor={fieldErrors.phone ? "$red400" : "transparent"} rounded="$lg" h="$11">
                      <InputField
                        placeholder={t("shop.add.placeholders.phone")}
                        value={form.phone}
                        onChangeText={(v) => { set("phone", v); setFieldErrors(e => ({ ...e, phone: undefined })); }}
                        keyboardType="phone-pad"
                        maxLength={INPUT_LIMITS.phone}
                        returnKeyType="next"
                        placeholderTextColor="#9CA3AF"
                      />
                    </Input>
                  </VStack>

                  <VStack space="xs">
                    <Label>{t("shop.add.email")}</Label>
                    <Input bg={fieldErrors.email ? "$red50" : "$coolGray100"} borderWidth={fieldErrors.email ? 1 : 0} borderColor={fieldErrors.email ? "$red400" : "transparent"} rounded="$lg" h="$11">
                      <InputField
                        placeholder={t("shop.add.placeholders.email")}
                        value={form.email}
                        onChangeText={(v) => { set("email", v); setFieldErrors(e => ({ ...e, email: undefined })); }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        maxLength={INPUT_LIMITS.email}
                        returnKeyType="next"
                        placeholderTextColor="#9CA3AF"
                      />
                    </Input>
                    <CharCounter value={form.email} limit={INPUT_LIMITS.email} />
                  </VStack>

                  <VStack space="xs">
                    <Label>{t("shop.add.website")}</Label>
                    <Field
                      placeholder={t("shop.add.placeholders.website")}
                      value={form.website}
                      onChangeText={(v) => set("website", v)}
                      autoCapitalize="none"
                      maxLength={INPUT_LIMITS.website}
                      returnKeyType="next"
                    />
                    <CharCounter value={form.website} limit={INPUT_LIMITS.website} />
                  </VStack>

                  <VStack space="xs">
                    <Label>{t("shop.add.gst")}</Label>
                    <Input bg={fieldErrors.gst ? "$red50" : "$coolGray100"} borderWidth={fieldErrors.gst ? 1 : 0} borderColor={fieldErrors.gst ? "$red400" : "transparent"} rounded="$lg" h="$11">
                      <InputField
                        placeholder={t("shop.add.placeholders.gst")}
                        value={form.gst}
                        onChangeText={(v) => { set("gst", v); setFieldErrors(e => ({ ...e, gst: undefined })); }}
                        autoCapitalize="characters"
                        maxLength={INPUT_LIMITS.gstin}
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                        placeholderTextColor="#9CA3AF"
                      />
                    </Input>
                  </VStack>
                </VStack>
              </Card>

              {/* ===== Branding Card ===== */}
              <Box mt="$4">
                <Card>
                  <Text fontWeight="$bold" fontSize="$md" color="$coolGray900">
                    {t("shop.add.brandingTitle")}
                  </Text>
                  <Text fontSize="$sm" color="$coolGray500" mt="$1">
                    {t("shop.add.brandingHint")}
                  </Text>

                  <VStack mt="$4" space="lg">
                    <ImagePickerRow
                      label={t("shop.add.shopLogo")}
                      icon={ImageIcon}
                      placeholder={t("shop.add.chooseLogo")}
                      value={form.logo}
                      onPick={() => pickImage("logo")}
                      onPreview={() => openPreview("logo")}
                      onRemove={() => setForm(prev => ({ ...prev, logo: null }))}
                    />

                    {/* Signature — supports draw or upload */}
                    <VStack space="xs">
                      <Label>{t("shop.add.signature")}</Label>
                      {form.signature ? (
                        <HStack space="sm" alignItems="center">
                          <Box
                            flex={1}
                            bg="$white"
                            borderWidth={1}
                            borderColor="$purple300"
                            rounded="$xl"
                            style={{ height: 100, overflow: "hidden" }}
                            justifyContent="center"
                            alignItems="center"
                            px="$2"
                          >
                            {typeof form.signature === "string" && form.signature.startsWith("<svg") ? (
                              <SvgXml xml={form.signature} width="100%" height="90" />
                            ) : (
                              <Image
                                source={{ uri: typeof form.signature === "string" ? form.signature : form.signature?.uri }}
                                style={{ width: "90%", height: "90%" }}
                                resizeMode="contain"
                              />
                            )}
                          </Box>
                          <VStack space="xs">
                            {/* Only a drawn signature rotates here. A
                                photographed one is an image, and turning
                                pixels needs a real image pass - it belongs
                                with the crop work, not a second one-off. */}
                            {canRotateSignature(form.signature) && (
                              <Pressable
                                bg="$white"
                                borderWidth={1}
                                borderColor="$coolGray300"
                                rounded="$xl"
                                w="$12"
                                h="$12"
                                alignItems="center"
                                justifyContent="center"
                                onPress={() =>
                                  setForm(prev => ({
                                    ...prev,
                                    signature: rotateSignatureSvg(prev.signature as string),
                                  }))
                                }
                                accessibilityLabel={t("shop.add.signatureRotate") || "Rotate"}
                              >
                                <Icon as={RotateCw} size="md" color="$coolGray600" />
                              </Pressable>
                            )}
                            <Pressable
                              bg="$white"
                              borderWidth={1}
                              borderColor="$purple600"
                              rounded="$xl"
                              w="$12"
                              h="$12"
                              alignItems="center"
                              justifyContent="center"
                              onPress={() => setShowSignatureDrawModal(true)}
                            >
                              <Icon as={Pencil} size="md" color="$purple600" />
                            </Pressable>
                            <Pressable
                              bg="$white"
                              borderWidth={1}
                              borderColor="$red400"
                              rounded="$xl"
                              w="$12"
                              h="$12"
                              alignItems="center"
                              justifyContent="center"
                              onPress={() => setForm(prev => ({ ...prev, signature: null }))}
                            >
                              <Icon as={Trash2} size="md" color="$red400" />
                            </Pressable>
                          </VStack>
                        </HStack>
                      ) : (
                        <HStack space="sm">
                          <Pressable
                            flex={1}
                            onPress={() => setShowSignatureDrawModal(true)}
                          >
                            <Box
                              bg="$white"
                              borderWidth={1}
                              borderColor="$purple400"
                              borderStyle="dashed"
                              rounded="$xl"
                              style={{ height: 60 }}
                              justifyContent="center"
                              alignItems="center"
                              flexDirection="row"
                            >
                              <Icon as={Pencil} size="sm" color="$purple500" style={{ marginRight: 6 }} />
                              <Text color="$purple600" fontSize="$sm" fontWeight="$medium">
                                Draw Signature
                              </Text>
                            </Box>
                          </Pressable>
                          <Pressable
                            flex={1}
                            onPress={() => setShowSignatureSourceSheet(true)}
                          >
                            <Box
                              bg="$white"
                              borderWidth={1}
                              borderColor="$coolGray200"
                              borderStyle="dashed"
                              rounded="$xl"
                              style={{ height: 60 }}
                              justifyContent="center"
                              alignItems="center"
                              flexDirection="row"
                            >
                              <Icon as={PenLine} size="sm" color="$coolGray500" style={{ marginRight: 6 }} />
                              <Text color="$coolGray500" fontSize="$sm" fontWeight="$medium">
                                Upload
                              </Text>
                            </Box>
                          </Pressable>
                        </HStack>
                      )}
                    </VStack>

                    <ImagePickerRow
                      label={t("shop.add.shopHeader") || "Shop Header (recommended 2480×700px)"}
                      icon={ImageIcon}
                      placeholder={t("shop.add.chooseHeader") || "Choose Shop Header"}
                      value={form.shopHeader}
                      onPick={() => pickImage("shopHeader")}
                      onPreview={() => openPreview("shopHeader")}
                      onRemove={() => setForm(prev => ({ ...prev, shopHeader: null }))}
                    />

                  </VStack>
                </Card>
              </Box>

              {/* ===== Save Button ===== */}
              <Box mt="$6">
                <GradientButton
                  label={loading ? t("shop.add.saving") : isEdit ? t("shop.add.saveBtnEdit") : t("shop.add.saveBtn")}
                  onPress={handleSave}
                  disabled={loading}
                />
              </Box>
            </>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ===== Image Preview Modal ===== */}
      <ImagePreviewModal
        visible={preview.visible}
        uri={previewUri}
        title={preview.title}
        noImageText={t("shop.add.preview.noImage")}
        replaceLabel={t("shop.add.preview.replaceImage")}
        onClose={() => setPreview((prev) => ({ ...prev, visible: false }))}
        onReplace={() => preview.field && pickImage(preview.field)}
      />

      <PhotoSourceSheet
        visible={showSignatureSourceSheet}
        onClose={() => setShowSignatureSourceSheet(false)}
        onPick={mode => pickImage("signature", mode)}
        title={t('shop.add.signature') || 'Signature'}
      />

      {/* ===== Signature Draw Modal ===== */}
      <SignatureCaptureModal
        isOpen={showSignatureDrawModal}
        onClose={() => setShowSignatureDrawModal(false)}
        title={t('signature.shopTitle') || 'Your signature'}
        onSave={(svgData) => {
          setForm(prev => ({ ...prev, signature: svgData }));
          setShowSignatureDrawModal(false);
        }}
      />

      <ValidationErrorModal
        isOpen={showValidationModal}
        errors={validationErrors}
        onClose={() => setShowValidationModal(false)}
      />
      <ImpersonationBlockModal
        isOpen={blockModalVisible}
        phone={impersonatePhone || ''}
        onEndSession={handleEndSession}
        onClose={() => setBlockModalVisible(false)}
      />
      <LoginRequiredModal
        visible={showLoginRequiredModal}
        onCancel={() => setShowLoginRequiredModal(false)}
        onConfirm={() => { setShowLoginRequiredModal(false); dispatch(logout()); }}
      />
    </Box>
  );
};

export default AddShopDetailsScreen;
