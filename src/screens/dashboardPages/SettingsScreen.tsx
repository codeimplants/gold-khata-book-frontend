// The More tab: the shop, today's rate, preferences, help and the account.
//
// It was SoneBill's Settings screen, a slate gradient header over a long
// BUSINESS card of retail tools: invoice templates, inventory, purchases,
// sales and GST reports, GST rates and video tutorials. Those belong to a shop
// billing walk-in customers. App Review rejected this app as a SoneBill copy
// under guideline 4.3(a) (APP_STORE_4.3_REWORK.md), and the retail rows were
// part of why.
//
// What is left is what a wholesaler keeping a khata uses. The rows are
// ledger-style, with hairline dividers and plain icons, not SoneBill's grey
// icon tiles.
import React from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Platform, Text, View } from "react-native";
import {
  Store,
  Globe,
  Info,
  Shield,
  LogOut,
  LogIn,
  ChevronRight,
  FileText,
  HelpCircle,
  Lock,
  Trash2,
  Printer,
  Star,
  Coins,
  Flame,
  TrendingUp,
  Package,
} from "lucide-react-native";
import { AppReview } from "@codeimplants/app-review";

import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "../../hooks/useTranslation";
import { useFeatureFlag } from "../../hooks/useFeatureFlag";
import { useOldGoldMelt } from "../../hooks/useOldGoldMelt";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { logout } from "../../store/auth/authSlice";
import { fetchShopDetails, updateShopPreferences } from "../../store/data/dataSlice";
import SetRateModal from "../../components/common/SetRateModal";
import { useShopRate } from "../../hooks/useShopRate";
import { formatCurrencyValue } from "../../utils/formatter";
import { toast } from "../../components/common/Toast";
import { setBiometricLockEnabled } from "../../store/security/securitySlice";
import { useBiometric } from "../../hooks/useBiometric";
import LogoutModal from "../../components/LogoutModal";
import ConfirmModal from "../../components/ConfirmModal";
import { authService } from "../../services/authService";
import LedgerHeader from "../../components/ledger/LedgerHeader";
import { useContentContainerStyle } from "../../constants/layout";
import { Brand } from "../../theme/brand";

type IconType = React.ComponentType<{ size?: number; color?: string }>;

const SectionTitle = ({ children }: { children: string }) => (
  <Text style={styles.section}>{children}</Text>
);

const Row = ({
  title,
  subtitle,
  icon: Icon,
  onPress,
  last,
}: {
  title: string;
  subtitle?: string;
  icon: IconType;
  onPress: () => void;
  last?: boolean;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    style={({ pressed }) => [styles.row, !last && styles.rowDivider, pressed && styles.rowPressed]}
  >
    <Icon size={20} color={Brand.primary} />
    <View style={styles.rowText}>
      <Text style={styles.rowTitle}>{title}</Text>
      {!!subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
    </View>
    <ChevronRight size={18} color={Brand.inkFaint} />
  </Pressable>
);

const ToggleRow = ({
  title,
  subtitle,
  icon: Icon,
  value,
  onValueChange,
  disabled,
  last,
}: {
  title: string;
  subtitle: string;
  icon: IconType;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  last?: boolean;
}) => (
  <View style={[styles.row, !last && styles.rowDivider]}>
    <Icon size={20} color={Brand.primary} />
    <View style={styles.rowText}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowSub}>{subtitle}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: Brand.line, true: Brand.primaryMid }}
      thumbColor="#FFFFFF"
      ios_backgroundColor={Brand.line}
    />
  </View>
);

const SettingsScreen = () => {
  const nav = useNavigation<any>();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  /**
   * The flag decides whether the SETTING exists; the setting decides whether
   * the melt controls do. A shop that has not switched it on sees this row and
   * nothing else: no Take Old Gold in New Entry, no Melt field on a sale.
   */
  const meltFlagEnabled = useFeatureFlag('oldGoldMelt');
  const meltEnabled = useOldGoldMelt();
  const [isTogglingMelt, setIsTogglingMelt] = React.useState(false);

  /** Today's rate, so the row can say which one is in force rather than just
   *  offering to change something unnamed. */
  const shopRate = useShopRate();
  const [rateModalOpen, setRateModalOpen] = React.useState(false);
  // Centres and caps content on iPad; no-op on phones.
  const contentStyle = useContentContainerStyle();
  const { isGuest, phone } = useAppSelector((s) => s.auth);
  const { biometricLockEnabled } = useAppSelector((s) => s.security);
  const shopDetails = useAppSelector((s) => s.data.shopDetails);

  const hasShopDetails = !!shopDetails;
  const shopName = shopDetails?.shopName?.trim();
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

  const toggleMelt = async (next: boolean) => {
    setIsTogglingMelt(true);
    const action = await dispatch(updateShopPreferences({ oldGoldMelt: next }) as any);
    setIsTogglingMelt(false);
    // Reported rather than swallowed: this changes what the sale screen
    // offers, so a silent failure would leave the shop believing melt is on
    // until the next launch says otherwise.
    if (!updateShopPreferences.fulfilled.match(action)) {
      toast.error(String(action.payload || t("settings.menu.meltFailed") || "Could not save the setting"));
    }
  };

  const rateSubtitle = shopRate.isOverride
    ? `${t("rate.usingYours") || "Your rate for today"} · ${formatCurrencyValue(shopRate.rate)} / ${t("common.gramShort") || "gm"} (${t("rate.fineness") || "99.50"})`
    : (t("rate.usingLiveShort") || "Using the live rate");

  return (
    <View style={styles.screen}>
      <LedgerHeader
        title={t("tabs.settings") || "More"}
        subtitle={shopName || (phone ? `+91 ${phone}` : undefined)}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, contentStyle]}
      >
        {/* Whose book this is. Hidden in guest mode, which has no shop and no
            number, so an account card there would claim something false. It
            comes first so the screen answers "whose shop am I looking at?",
            which matters after an admin impersonation or on a shared phone. */}
        {!isGuest && (
          <Pressable onPress={() => nav.navigate("AddShopDetails")} style={styles.account}>
            <View style={styles.monogram}>
              <Text style={styles.monogramText}>{(shopName || "?")[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>{t("settings.loggedInAs") || "Logged in as"}</Text>
              {shopName ? (
                <Text style={styles.accountName} numberOfLines={1}>{shopName}</Text>
              ) : (
                // An account can exist with no shop name: it is created at OTP
                // verification, before the name is asked for. Say so plainly.
                <Text style={[styles.accountName, { color: Brand.inkFaint }]} numberOfLines={1}>
                  {t("settings.noShopName")}
                </Text>
              )}
              {!!phone && <Text style={styles.rowSub}>+91 {phone}</Text>}
            </View>
            <ChevronRight size={18} color={Brand.inkFaint} />
          </Pressable>
        )}

        <SectionTitle>{t("more.sectionKhata") || "KHATA"}</SectionTitle>
        <View style={styles.group}>
          {/* First: it is the rate every sale today is struck at, and the
              subtitle says which rate is in force without opening anything. */}
          <Row
            title={t("rate.title") || "Today's Rate"}
            subtitle={rateSubtitle}
            icon={TrendingUp}
            onPress={() => setRateModalOpen(true)}
            last={!meltEnabled && !(meltFlagEnabled && !isGuest)}
          />
          {meltEnabled && (
            <Row
              title={t("more.meltLots") || "Melt lots"}
              subtitle={t("more.meltLotsSub") || "Old gold in the pot, and lots already credited"}
              icon={Flame}
              onPress={() => nav.navigate("MeltLots")}
              last={!(meltFlagEnabled && !isGuest)}
            />
          )}
          {/* Does this wholesaler take old ornaments for melt at all. Off for
              a shop that never answered, so a wholesaler who does not melt
              never meets a Melt field on a sale. Not for guests: melt credit is
              a per-retailer balance that only exists on the server. */}
          {meltFlagEnabled && !isGuest && (
            <ToggleRow
              title={t("settings.menu.melt") || "Old Gold / Melt"}
              subtitle={t("settings.menu.meltSub") || "Take old ornaments in and set them against a retailer's bills"}
              icon={Coins}
              value={shopDetails?.oldGoldMelt === true}
              disabled={isTogglingMelt || !hasShopDetails}
              onValueChange={toggleMelt}
              last
            />
          )}
        </View>

        <SectionTitle>{t("more.sectionShop") || "SHOP"}</SectionTitle>
        <View style={styles.group}>
          <Row
            title={
              hasShopDetails
                ? t("settings.menu.shopEdit") || "Edit Shop Details"
                : t("settings.menu.shop") || "Add Shop Details"
            }
            subtitle={t("more.shopSub") || "Name, address and GSTIN on your statements"}
            icon={Store}
            onPress={() => nav.navigate("AddShopDetails")}
          />
          {/* The names, purities and weights NewOrderScreen's "Choose from
              catalog" fills a sale line from. Not SoneBill's inventory: no stock
              counts or making charges unless retail billing is switched on. */}
          <Row
            title={t("more.catalog") || "Item catalogue"}
            subtitle={t("more.catalogSub") || "Ornaments you sell often, to fill a sale quickly"}
            icon={Package}
            onPress={() => nav.navigate("ItemsProducts")}
          />
          <Row
            title={t("more.print") || "Printing"}
            subtitle={t("more.printSub") || "Statement paper size and thermal printer"}
            icon={Printer}
            onPress={() => nav.navigate("PrintSettings")}
          />
          <Row
            title={t("settings.menu.language") || "Language"}
            subtitle={t("settings.menu.languageSub") || "Change app language"}
            icon={Globe}
            onPress={() => nav.navigate("Language")}
            last={Platform.OS === 'web'}
          />
          {/* Mobile only: there is no Face ID or fingerprint on the web build. */}
          {Platform.OS !== 'web' && (
            <ToggleRow
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
              last
            />
          )}
        </View>

        <SectionTitle>{t("more.sectionHelp") || "HELP & ABOUT"}</SectionTitle>
        <View style={styles.group}>
          <Row
            title={t("settings.menu.contact") || "Help / Support"}
            subtitle={t("more.helpSub") || "Call or WhatsApp us"}
            icon={HelpCircle}
            onPress={() => nav.navigate("ContactUs")}
          />
          <Row
            title={t("settings.menu.about") || "About Us"}
            subtitle={t("settings.menu.aboutSub") || "Learn more about Gold Khata Book"}
            icon={Info}
            onPress={() => nav.navigate("AboutUs")}
          />
          <Row
            title={t("settings.menu.privacy") || "Privacy Policy"}
            subtitle={t("settings.menu.privacySub") || "How we handle your data"}
            icon={Shield}
            onPress={() => nav.navigate("PrivacyPolicy")}
          />
          <Row
            title={t("settings.menu.terms") || "Terms & Conditions"}
            subtitle={t("settings.menu.termsSub") || "Read our terms of use"}
            icon={FileText}
            onPress={() => nav.navigate("Terms")}
            last={Platform.OS === "web"}
          />
          {/* Opens the store listing rather than the native review card. Both
              stores forbid wiring that card to a button: Play bans
              call-to-action buttons outright, and Apple's request can be
              silently ignored, so the row would appear dead. Hidden on web,
              which has no store. */}
          {Platform.OS !== "web" && (
            <Row
              title={t("settings.menu.rate") || "Rate this app"}
              subtitle={t("settings.menu.rateSub") || "Tell others what you think"}
              icon={Star}
              onPress={() => AppReview.openStoreForReview()}
              last
            />
          )}
        </View>

        <View style={styles.danger}>
          {isGuest ? (
            <Pressable style={[styles.button, styles.buttonOutline]} onPress={handleLogin}>
              <LogIn size={18} color={Brand.primary} />
              <Text style={[styles.buttonText, { color: Brand.primary }]}>{t("settings.login") || "Login"}</Text>
            </Pressable>
          ) : (
            <>
              <Pressable style={[styles.button, styles.buttonOutline]} onPress={() => setShowLogoutModal(true)}>
                <LogOut size={18} color={Brand.inkSoft} />
                <Text style={[styles.buttonText, { color: Brand.inkSoft }]}>{t("settings.logout") || "Logout"}</Text>
              </Pressable>

              {/* Permanent account deletion. Required by App Store Guideline
                  5.1.1(v) for any app that offers account creation. Only shown
                  to signed-in users: a guest has no account to delete. */}
              <Pressable
                style={[styles.button, styles.buttonDanger]}
                onPress={() => {
                  setDeleteAccountError(null);
                  setShowDeleteAccountModal(true);
                }}
              >
                <Trash2 size={18} color={Brand.due} />
                <Text style={[styles.buttonText, { color: Brand.due }]}>
                  {t("settings.deleteAccount") || "Delete Account"}
                </Text>
              </Pressable>
            </>
          )}
        </View>
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
              "This permanently deletes your account along with your shop details, sales, retailers and uploaded images. This cannot be undone."
        }
        confirmLabel={t("settings.deleteAccountConfirmLabel") || "Delete Permanently"}
        cancelLabel={t("common.cancel") || "Cancel"}
        onConfirm={handleDeleteAccount}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.paper,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  account: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Brand.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Brand.line,
    padding: 16,
  },
  monogram: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: Brand.primary,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 3,
    borderBottomColor: Brand.goldFill,
  },
  monogramText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  kicker: {
    fontSize: 11,
    fontWeight: "700",
    color: Brand.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  accountName: {
    fontSize: 17,
    fontWeight: "700",
    color: Brand.ink,
    marginTop: 2,
  },
  section: {
    fontSize: 12,
    fontWeight: "700",
    color: Brand.inkMuted,
    letterSpacing: 0.8,
    marginTop: 22,
    marginBottom: 8,
    marginLeft: 4,
  },
  group: {
    backgroundColor: Brand.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Brand.line,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.line,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Brand.ink,
  },
  rowSub: {
    fontSize: 13,
    color: Brand.inkMuted,
    marginTop: 2,
  },
  danger: {
    marginTop: 28,
    gap: 12,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 48,
    borderRadius: 8,
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: Brand.lineStrong,
    backgroundColor: Brand.card,
  },
  buttonDanger: {
    borderWidth: 1,
    borderColor: "#F3C6C1",
    backgroundColor: Brand.dueSoft,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "700",
  },
});

export default SettingsScreen;
