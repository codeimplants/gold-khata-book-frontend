import React from "react";
import { ScrollView, StyleSheet, Switch, Platform } from "react-native";
import {
  Box,
  HStack,
  VStack,
  Text,
  Pressable,
  Icon,
  Center,
} from "@gluestack-ui/themed";


import {
  Store,
  Box as BoxIcon,
  Percent,
  Globe,
  Info,
  Shield,
  LogOut,
  LogIn,
  ChevronRight,
  BarChart3,
  FileText,
  FileSpreadsheet,
  HelpCircle,
  Lock,
  ShoppingCart,
  Trash2,
  Printer,
  FileSignature,
  Star,
  PlayCircle,
  Coins,
  TrendingUp,
} from "lucide-react-native";
import { AppReview } from "@codeimplants/app-review";

import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "../../hooks/useTranslation";
import { useFeatureFlag } from "../../hooks/useFeatureFlag";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { logout } from "../../store/auth/authSlice";
import { fetchShopDetails, updateShopPreferences } from "../../store/data/dataSlice";
import SetRateModal from "../../components/common/SetRateModal";
import { useShopRate } from "../../hooks/useShopRate";
import { formatCurrencyValue } from "../../utils/formatter";
import { toast } from "../../components/common/Toast";
import { setBiometricLockEnabled } from "../../store/security/securitySlice";
import { useBiometric } from "../../hooks/useBiometric";
import { BannerHeightContext } from "../../navigation/MainTabs";
import LogoutModal from "../../components/LogoutModal";
import ConfirmModal from "../../components/ConfirmModal";
import { authService } from "../../services/authService";
import GradientSurface from "../../components/common/GradientSurface";
import { LAYOUT, useContentContainerStyle } from "../../constants/layout";

const SectionTitle = ({
  children,
  first,
}: {
  children: string;
  /** The first title on the screen. Its top margin exists to separate a section
   *  from the card above it — there is no card above the first one, so it was
   *  stacking on the ScrollView's own padding and leaving a visible gap under
   *  the header. */
  first?: boolean;
}) => (
  <Text
    fontSize="$xs"
    color="$coolGray500"
    fontWeight="$bold"
    letterSpacing="$sm"
    mt={first ? '$1' : '$6'}
    mb="$3"
  >
    {children}
  </Text>
);


const SettingRow = ({ title, subtitle, icon, onPress }: any) => (
  <Pressable onPress={onPress}>
    <HStack alignItems="center" justifyContent="space-between" py="$4">
      <HStack alignItems="center" space="md" flex={1}>
        <Center w={44} h={44} rounded="$xl" bg="$coolGray100">
          <Icon as={icon} size="lg" color="$coolGray700" />
        </Center>

        <VStack flex={1}>
          <Text fontSize="$md" fontWeight="$bold">
            {title}
          </Text>
          <Text fontSize="$sm" color="$coolGray500">
            {subtitle}
          </Text>
        </VStack>
      </HStack>

      <Icon as={ChevronRight} size="lg" color="$coolGray400" />
    </HStack>
  </Pressable>
);

const SecurityToggleRow = ({
  title,
  subtitle,
  icon,
  value,
  onValueChange,
  disabled,
}: {
  title: string;
  subtitle: string;
  icon: any;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) => (
  <HStack alignItems="center" justifyContent="space-between" py="$4">
    <HStack alignItems="center" space="md" flex={1}>
      <Center w={44} h={44} rounded="$xl" bg="$coolGray100">
        <Icon as={icon} size="lg" color="$coolGray700" />
      </Center>
      <VStack flex={1}>
        <Text fontSize="$md" fontWeight="$bold">{title}</Text>
        <Text fontSize="$sm" color="$coolGray500">{subtitle}</Text>
      </VStack>
    </HStack>
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: '#E5E7EB', true: '#A855F7' }}
      thumbColor="#FFFFFF"
      ios_backgroundColor="#E5E7EB"
    />
  </HStack>
);

const SettingsScreen = () => {
  const nav = useNavigation<any>();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const tutorialsEnabled = useFeatureFlag('tutorials');
  /**
   * The flag decides whether the SETTING exists; the setting decides whether
   * the melt controls do. A shop that has not switched it on sees this row and
   * nothing else — no Take Old Gold on the FAB, no Melt field on an order.
   */
  const meltFlagEnabled = useFeatureFlag('oldGoldMelt');
  const [isTogglingMelt, setIsTogglingMelt] = React.useState(false);

  /** Today's rate, so this row can say which one is actually in force rather
   *  than just offering to change something unnamed. */
  const shopRate = useShopRate();
  const [rateModalOpen, setRateModalOpen] = React.useState(false);
  // Centres and caps content on iPad; no-op on phones.
  const contentStyle = useContentContainerStyle();
  const { isGuest, phone } = useAppSelector((s) => s.auth);
  const { biometricLockEnabled } = useAppSelector((s) => s.security);
  const shopDetails = useAppSelector((s) => s.data.shopDetails);

  const insets = useSafeAreaInsets();
  const bannerHeight = React.useContext(BannerHeightContext);
  // Same formula as the Dashboard header: clear the status bar dynamically
  // instead of a hardcoded height, so all tab headers stay the same size
  // relative to each other regardless of device/status-bar height.
  const topPad = LAYOUT.isWeb ? 0 : (bannerHeight > 0 ? 0 : insets.top);
  const hasShopDetails = !!shopDetails;
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = React.useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = React.useState(false);
  const [deleteAccountError, setDeleteAccountError] = React.useState<string | null>(null);
  const [biometryLabel, setBiometryLabel] = React.useState("Biometric Lock");
  const [isTogglingBiometric, setIsTogglingBiometric] = React.useState(false);
  const { checkAvailability, prompt } = useBiometric();

  React.useEffect(() => {
    dispatch(fetchShopDetails());
  }, [dispatch]);

  React.useEffect(() => {
    if (Platform.OS !== 'web') {
      checkAvailability().then((info) => {
        if (info.available) setBiometryLabel(info.label);
      });
    }
  }, []);

  const handleBiometricToggle = async (value: boolean) => {
    if (isTogglingBiometric || Platform.OS === 'web') return;
    setIsTogglingBiometric(true);
    try {
      if (value) {
        const info = await checkAvailability();
        if (!info.available) return;
        const result = await prompt("Confirm to enable biometric lock");
        if (result.success) {
          dispatch(setBiometricLockEnabled(true));
        }
      } else {
        dispatch(setBiometricLockEnabled(false));
      }
    } finally {
      setIsTogglingBiometric(false);
    }
  };

  const handleLogout = () => {
    setShowLogoutModal(false);
    dispatch(logout());
  };

  // Permanently deletes the account, then drops the local session. If the request
  // fails we keep the user signed in and leave the modal open — silently logging
  // them out would imply the account was deleted when it was not.
  const handleDeleteAccount = async () => {
    if (isDeletingAccount) return;
    setIsDeletingAccount(true);
    try {
      await authService.deleteOwnAccount();
      setShowDeleteAccountModal(false);
      dispatch(logout());
    } catch (e: any) {
      setDeleteAccountError(
        e?.response?.data?.message ||
          t("settings.deleteAccountError") ||
          "Could not delete your account. Please check your connection and try again."
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleLogin = () => {
    dispatch(logout());
  };

  return (
    <Box flex={1} bg="#F3F4F6">

      {/* HEADER */}
      <Box height={84 + topPad} overflow="hidden">
        <GradientSurface colors={["#6B7280", "#374151"]} />

        <VStack
          px="$5"
          justifyContent="center"
          flex={1}
          style={{
            ...contentStyle,
            paddingTop: topPad,
          }}
        >
          <Text color="$white" fontSize={22} fontWeight="$bold">
            {t("settings.title")}
          </Text>
          <Text color="$white" fontSize={13}>
            {t("settings.subtitle")}
          </Text>
        </VStack>
      </Box>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 100,
          ...contentStyle
        }}
      >
        {/* Who is signed in. Hidden in guest mode, which has no shop and no
            number — an "account" card there would be claiming something false.
            Sits above BUSINESS so the first thing on the screen answers "whose
            shop am I looking at?", which matters most right after an admin
            impersonation or on a shared device. */}
        {!isGuest && (
          <Box bg="$white" rounded="$2xl" p="$5" mb="$4" style={styles.card}>
            <Text
              color="$coolGray400" fontSize={11} fontWeight="$bold"
              textTransform="uppercase" letterSpacing={1} mb="$2"
            >
              {t("settings.loggedInAs")}
            </Text>
            <HStack space="md" alignItems="center">
              <Box
                w={44} h={44} rounded="$full" alignItems="center" justifyContent="center"
                style={{ backgroundColor: "#EDE9FE" }}
              >
                <Text color="#6D5EF7" fontWeight="$bold" fontSize={18}>
                  {(shopDetails?.shopName?.trim() || "?")[0].toUpperCase()}
                </Text>
              </Box>
              <VStack flex={1}>
                {shopDetails?.shopName?.trim() ? (
                  <Text fontWeight="$bold" fontSize={16} color="$coolGray900" numberOfLines={1}>
                    {shopDetails.shopName.trim()}
                  </Text>
                ) : (
                  // An account can exist with no shop name — it is created at OTP
                  // verification, before the name is ever asked for. Say so
                  // plainly instead of rendering an empty line; Edit Shop Details
                  // is the very next row.
                  <Text fontWeight="$medium" fontSize={15} color="$coolGray400" numberOfLines={1}>
                    {t("settings.noShopName")}
                  </Text>
                )}
                {!!phone && (
                  <Text color="$coolGray500" fontSize={13} mt="$0.5">
                    +91 {phone}
                  </Text>
                )}
              </VStack>
            </HStack>
          </Box>
        )}

        {/* Business */}
        <SectionTitle first>{t("settings.business") || "BUSINESS"}</SectionTitle>
        <Box bg="$white" rounded="$2xl" px="$5" style={styles.card}>
          {/* First in Business: it is the number every bill raised today is
              struck at, and the subtitle says which rate is in force so the
              answer is readable without opening anything. */}
          <SettingRow
            title={t("rate.title") || "Today's Rate"}
            subtitle={
              shopRate.isOverride
                ? `${t("rate.usingYours") || "Your rate for today"} · ${formatCurrencyValue(shopRate.rate)} / ${t("common.gramShort") || "gm"} (${t("rate.fineness") || "99.50"})`
                : (t("rate.usingLiveShort") || "Using the live rate")
            }
            icon={TrendingUp}
            onPress={() => setRateModalOpen(true)}
          />
          <Box h={1} bg="$coolGray100" />
          <SettingRow
            title={
              hasShopDetails
                ? t("settings.menu.shopEdit") || "Edit Shop Details"
                : t("settings.menu.shop") || "Add Shop Details"
            }
            subtitle={
              hasShopDetails
                ? t("settings.menu.shopEditSub") || "Update your shop info"
                : t("settings.menu.shopSub") || "Setup your shop"
            }
            icon={Store}
            onPress={() => nav.navigate("AddShopDetails")}
          />
          <Box h={1} bg="$coolGray100" />
          <SettingRow
            title={t("settings.menu.invoiceBill") || "Invoice / Bill Settings"}
            subtitle={t("settings.menu.invoiceBillSub") || "Template, language & shop header"}
            icon={FileText}
            onPress={() => nav.navigate("InvoiceBillSettings")}
          />
          {/* Does this wholesaler take old ornaments for melt at all.
              Off for a shop that has never answered, because a wholesaler who
              does not do melt should never meet a Melt field on an order.
              Guests are excluded: melt credit is a per-retailer balance that
              only exists on the server, and a guest install has neither a shop
              record to hold this nor an account to hold a balance. */}
          {meltFlagEnabled && !isGuest && (
            <>
              <Box h={1} bg="$coolGray100" />
              <SecurityToggleRow
                title={t("settings.menu.melt") || "Old Gold / Melt"}
                subtitle={
                  t("settings.menu.meltSub") ||
                  "Take old ornaments in and set them against a retailer's bills"
                }
                icon={Coins}
                value={shopDetails?.oldGoldMelt === true}
                disabled={isTogglingMelt || !hasShopDetails}
                onValueChange={async (next: boolean) => {
                  setIsTogglingMelt(true);
                  const action = await dispatch(
                    updateShopPreferences({ oldGoldMelt: next }) as any,
                  );
                  setIsTogglingMelt(false);
                  // Reported rather than swallowed: this changes what the order
                  // screen offers, so a silent failure would leave the shop
                  // believing melt is on until the next launch says otherwise.
                  if (!updateShopPreferences.fulfilled.match(action)) {
                    toast.error(
                      String(action.payload || t("settings.menu.meltFailed") || "Could not save the setting"),
                    );
                  }
                }}
              />
            </>
          )}
          <Box h={1} bg="$coolGray100" />
          <SettingRow
            title={t("settings.menu.items") || "Items / Products"}
            subtitle={t("settings.menu.itemsSub") || "Manage your item list"}
            icon={BoxIcon}
            onPress={() => nav.navigate("ItemsProducts")}
          />
          <Box h={1} bg="$coolGray100" />
          <SettingRow
            title={t("settings.menu.purchases") || "Purchases (GST)"}
            subtitle={t("settings.menu.purchasesSub") || "Record stock purchases & GST paid"}
            icon={ShoppingCart}
            onPress={() => nav.navigate("Purchases")}
          />
          <Box h={1} bg="$coolGray100" />
          <SettingRow
            title={t("settings.menu.salesReport") || "Sales Report"}
            subtitle={t("settings.menu.salesReportSub") || "View sales report"}
            icon={BarChart3}
            onPress={() => nav.navigate("SalesReport")}
          />
          <Box h={1} bg="$coolGray100" />
          <SettingRow
            title={t("settings.menu.gstReport") || "GST Report"}
            subtitle={t("settings.menu.gstReportSub") || "CA-ready GST summary (CSV & PDF)"}
            icon={FileSpreadsheet}
            onPress={() => nav.navigate("GstReport")}
          />
          <Box h={1} bg="$coolGray100" />
          <SettingRow
            title={t("settings.menu.gst") || "GST Settings"}
            subtitle={t("settings.menu.gstSub") || "Configure GST rates"}
            icon={Percent}
            onPress={() => nav.navigate("GST")}
          />
          <Box h={1} bg="$coolGray100" />
          <SettingRow
            title={t("settings.menu.print")}
            subtitle={t("settings.menu.printSub")}
            icon={Printer}
            onPress={() => nav.navigate("PrintSettings")}
          />
          <Box h={1} bg="$coolGray100" />
          <SettingRow
            title={t("settings.menu.language") || "Language"}
            subtitle={t("settings.menu.languageSub") || "Change app language"}
            icon={Globe}
            onPress={() => nav.navigate("Language")}
          />
          {tutorialsEnabled && (
            <>
              <Box h={1} bg="$coolGray100" />
              <SettingRow
                title={t("settings.menu.tutorials") || "Video Tutorials"}
                subtitle={
                  t("settings.menu.tutorialsSub") || "Short videos on how to use the app"
                }
                icon={PlayCircle}
                onPress={() => nav.navigate("Tutorials")}
              />
            </>
          )}
        </Box>

        {/* Security — mobile only */}
        {Platform.OS !== 'web' && (
          <>
            <SectionTitle>{t("settings.security") || "SECURITY"}</SectionTitle>
            <Box bg="$white" rounded="$2xl" px="$5" style={styles.card}>
              <SecurityToggleRow
                title={t("settings.menu.biometricLock") || "Biometric Lock"}
                subtitle={
                  biometricLockEnabled
                    ? `${biometryLabel} • ${t("settings.menu.biometricLockEnabledSub") || "Tap to disable"}`
                    : t("settings.menu.biometricLockSub") || "Lock app when switching away"
                }
                icon={Lock}
                value={biometricLockEnabled}
                onValueChange={handleBiometricToggle}
                disabled={isTogglingBiometric}
              />
            </Box>
          </>
        )}

        {/* Information */}
        <SectionTitle>{t("settings.information") || "INFORMATION"}</SectionTitle>
        <Box bg="$white" rounded="$2xl" px="$5" style={styles.card}>
          <SettingRow
            title={t("settings.menu.privacy") || "Privacy Policy"}
            subtitle={t("settings.menu.privacySub") || "How we handle your data"}
            icon={Shield}
            onPress={() => nav.navigate("PrivacyPolicy")}
          />
          <Box h={1} bg="$coolGray100" />
          <SettingRow
            title={t("settings.menu.terms") || "Terms & Conditions"}
            subtitle={t("settings.menu.termsSub") || "Read our terms of use"}
            icon={FileText}
            onPress={() => nav.navigate("Terms")}
          />
          <Box h={1} bg="$coolGray100" />
          <SettingRow
            title={t("settings.menu.contact") || "Help / Support"}
            subtitle={t("settings.menu.contactSub") || "Get help using the app"}
            icon={HelpCircle}
            onPress={() => nav.navigate("ContactUs")}
          />
          <Box h={1} bg="$coolGray100" />
          <SettingRow
            title={t("settings.menu.about") || "About Us"}
            subtitle={t("settings.menu.aboutSub") || "Learn more about Gold Khata Book"}
            icon={Info}
            onPress={() => nav.navigate("AboutUs")}
          />
          {/* Opens the store listing rather than the native review card. Both stores
              forbid wiring that card to a button — Play bans call-to-action buttons
              outright, and Apple's request can be silently ignored, so the row would
              simply appear dead. Hidden on web, which has no store. */}
          {Platform.OS !== "web" && (
            <>
              <Box h={1} bg="$coolGray100" />
              <SettingRow
                title={t("settings.menu.rate") || "Rate this app"}
                subtitle={
                  t("settings.menu.rateSub") || "Tell others what you think"
                }
                icon={Star}
                onPress={() => AppReview.openStoreForReview()}
              />
            </>
          )}
        </Box>

        {/* Danger Zone */}
        <Box mt="$8" mb="$8">
          {isGuest ? (
            <Pressable
              bg="$purple50"
              borderWidth={1}
              borderColor="$purple200"
              rounded="$2xl"
              p="$4"
              onPress={handleLogin}
            >
              <HStack alignItems="center" space="md" justifyContent="center">
                <Icon as={LogIn} color="$purple600" size="sm" />
                <Text color="$purple600" fontWeight="$bold">
                  {t("settings.login") || "Login"}
                </Text>
              </HStack>
            </Pressable>
          ) : (
            <>
              <Pressable
                bg="$red50"
                borderWidth={1}
                borderColor="$red100"
                rounded="$2xl"
                p="$4"
                onPress={() => setShowLogoutModal(true)}
              >
                <HStack alignItems="center" space="md" justifyContent="center">
                  <Icon as={LogOut} color="$red600" size="sm" />
                  <Text color="$red600" fontWeight="$bold">
                    {t("settings.logout")}
                  </Text>
                </HStack>
              </Pressable>

              {/*
                Permanent account deletion. Required by App Store Guideline
                5.1.1(v) for any app that offers account creation. Only shown to
                signed-in users — a guest has no account to delete.
              */}
              <Pressable
                bg="$red600"
                rounded="$2xl"
                p="$4"
                mt="$3"
                onPress={() => {
                  setDeleteAccountError(null);
                  setShowDeleteAccountModal(true);
                }}
              >
                <HStack alignItems="center" space="md" justifyContent="center">
                  <Icon as={Trash2} color="$white" size="sm" />
                  <Text color="$white" fontWeight="$bold">
                    {t("settings.deleteAccount") || "Delete Account"}
                  </Text>
                </HStack>
              </Pressable>
            </>
          )}
        </Box>
      </ScrollView>

      <SetRateModal
        isOpen={rateModalOpen}
        onClose={() => setRateModalOpen(false)}
        liveRate={shopRate.liveRate}
        currentOverride={shopRate.isOverride ? shopRate.rate : undefined}
      />

      <LogoutModal
        visible={showLogoutModal}
        onCancel={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
      />

      <ConfirmModal
        visible={showDeleteAccountModal}
        onClose={() => setShowDeleteAccountModal(false)}
        tone="destructive"
        icon="trash"
        loading={isDeletingAccount}
        title={t("settings.deleteAccount") || "Delete Account"}
        description={
          deleteAccountError
            ? deleteAccountError
            : t("settings.deleteAccountConfirm") ||
              "This permanently deletes your account along with your shop details, invoices, retailers and uploaded images. This cannot be undone."
        }
        confirmLabel={t("settings.deleteAccountConfirmLabel") || "Delete Permanently"}
        cancelLabel={t("common.cancel") || "Cancel"}
        onConfirm={handleDeleteAccount}
      />
    </Box>
  );
};

const styles = StyleSheet.create({
  card: {
    elevation: 2,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});

export default SettingsScreen;
