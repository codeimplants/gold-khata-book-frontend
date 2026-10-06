import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Platform, TouchableOpacity, View, Text, Pressable } from "react-native";
import { createBottomTabNavigator, BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BookOpen, Store, ScrollText, Menu, Plus, AlertTriangle } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { endImpersonation } from "../store/auth/authSlice";
import { clearUserData } from "../store/data/dataSlice";

import DashboardScreen from "../screens/dashboard/DashboardScreen";
import DayBookScreen from "../screens/dayBook/DayBookScreen";
import CustomersScreen from "../screens/dashboardPages/CustomersScreen";
import SettingsScreen from "../screens/dashboardPages/SettingsScreen";
import NewEntrySheet from "../components/ledger/NewEntrySheet";
import AddCustomerModal from "../components/AddCustomerModal";

import { MainTabParamList } from "./types";
import { useTranslation } from "../hooks/useTranslation";
import { LAYOUT } from "../constants/layout";
import { Brand } from "../theme/brand";

export const BannerHeightContext = React.createContext(0);

const Tab = createBottomTabNavigator<MainTabParamList>();

type TabName = "Dashboard" | "Orders" | "Customers" | "Settings";

/**
 * Route names are code (they are navigated to from across the app and typed in
 * MainTabParamList) and stay as they were. What the user sees is the khata's
 * own vocabulary: Khata, Retailers, Day Book, More.
 */
const TAB_ICONS: Record<TabName, React.ComponentType<{ size?: number; color?: string }>> = {
  Dashboard: BookOpen,
  Customers: Store,
  Orders: ScrollText,
  Settings: Menu,
};

/** The New Entry button sits between the second and third tabs. */
const CENTRE_AFTER_INDEX = 1;

/**
 * The tab bar of the Ledger design (src/theme/brand.ts).
 *
 * SoneBill's bar, inherited by the fork, gave each tab its own gradient colour.
 * The active icon sat in a gradient rounded square, with a gradient indicator
 * along the top edge. That was part of the look App Review rejected under
 * guideline 4.3(a) (APP_STORE_4.3_REWORK.md).
 *
 * This bar is flat and the same green for every tab. The active tab is marked
 * by colour and a short gold underline. A gold New Entry button sits in the
 * centre, so a sale, receipt or melt can be written from anywhere.
 */
function LedgerTabBar({ state, navigation, onNewEntry }: BottomTabBarProps & { onNewEntry: () => void }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const renderTab = (route: (typeof state.routes)[number], index: number) => {
    const focused = state.index === index;
    const Icon = TAB_ICONS[route.name as TabName] ?? Menu;
    const color = focused ? Brand.primary : Brand.inkMuted;
    const label = t(`tabs.${route.name.toLowerCase()}`) || route.name;

    return (
      <TouchableOpacity
        key={route.key}
        style={styles.tabItem}
        activeOpacity={0.7}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        onPress={() => {
          if (!focused) navigation.navigate(route.name as any);
        }}
      >
        <Icon size={22} color={color} />
        <Text style={[styles.label, { color }, focused && styles.labelActive]} numberOfLines={1}>
          {label}
        </Text>
        <View style={[styles.underline, focused && styles.underlineActive]} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[
      styles.bar,
      LAYOUT.isWeb
        ? null
        : {
            paddingBottom: Math.max(insets.bottom, 0),
            // Bar has no intrinsic height of its own (content is sized by
            // its children) - without an explicit height, the surrounding
            // Tab.Navigator layout collapses/clips this bar against the
            // Android system navigation bar instead of reserving real space
            // for it. 66 covers the icon/label content comfortably;
            // insets.bottom on top of that clears the system nav bar.
            height: 66 + Math.max(insets.bottom, 0),
          },
    ]}>
      <View style={[
        styles.inner,
        LAYOUT.isWeb ? LAYOUT.contentContainerStyle : { flex: 1 },
      ]}>
        {state.routes.slice(0, CENTRE_AFTER_INDEX + 1).map((r, i) => renderTab(r, i))}

        <View style={styles.centreSlot}>
          <Pressable
            onPress={onNewEntry}
            accessibilityRole="button"
            accessibilityLabel={t('tabs.newEntry') || 'New Entry'}
            style={({ pressed }) => [styles.centreButton, pressed && { opacity: 0.85 }]}
          >
            <Plus size={26} color="#FFFFFF" strokeWidth={2.5} />
          </Pressable>
        </View>

        {state.routes.slice(CENTRE_AFTER_INDEX + 1).map((r, i) => renderTab(r, i + CENTRE_AFTER_INDEX + 1))}
      </View>
    </View>
  );
}

function ImpersonateBanner({ phone, onEnd, topInset }: { phone: string; onEnd: () => void; topInset: number }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <View style={[styles.impersonateBanner, { paddingTop: topInset + 10 }]}>
      <View style={styles.impersonateBannerLeft}>
        {/* Icon in circle */}
        <View style={styles.impersonateIconCircle}>
          <AlertTriangle size={16} color="#451A03" />
          {/* Pulsing dot */}
          <Animated.View style={[styles.impersonatePulseDot, { opacity: pulseAnim }]} />
        </View>
        {/* Labels */}
        <View style={{ marginLeft: 8, flex: 1 }}>
          <Text style={styles.impersonateLabel}>Admin Impersonation</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.impersonatePhone}>+91 {phone}</Text>
            <View style={styles.viewOnlyBadge}>
              <Text style={styles.viewOnlyBadgeText}>View Only</Text>
            </View>
          </View>
        </View>
      </View>
      <TouchableOpacity style={styles.impersonateBannerButton} onPress={onEnd}>
        <Text style={styles.impersonateBannerButtonText}>End Session</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function MainTabs() {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const { impersonateUserId, impersonatePhone } = useAppSelector(s => s.auth);
  const insets = useSafeAreaInsets();
  const [bannerHeight, setBannerHeight] = useState(0);
  // Owned here, not by a screen, so New Entry works the same from every tab.
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const [addRetailerOpen, setAddRetailerOpen] = useState(false);

  useEffect(() => {
    if (!impersonateUserId) setBannerHeight(0);
  }, [impersonateUserId]);

  return (
    <BannerHeightContext.Provider value={impersonateUserId ? bannerHeight : 0}>
      <View style={{ flex: 1 }}>
        {/* Spacer pushes Tab.Navigator below the absolutely-positioned banner.
            Height is updated after the first onLayout measurement. */}
        {impersonateUserId ? <View style={{ height: bannerHeight }} /> : null}

        {/* Order here is the order in the bar: Khata, Retailers, [New Entry],
            Day Book, More. */}
        <Tab.Navigator
          initialRouteName="Dashboard"
          tabBar={(props) => <LedgerTabBar {...props} onNewEntry={() => setNewEntryOpen(true)} />}
          screenOptions={{ headerShown: false, lazy: true }}
        >
          <Tab.Screen name="Dashboard" component={DashboardScreen} />
          <Tab.Screen name="Customers" component={CustomersScreen} />
          <Tab.Screen name="Orders" component={DayBookScreen} />
          <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>

        <NewEntrySheet
          visible={newEntryOpen}
          onClose={() => setNewEntryOpen(false)}
          onAddRetailer={() => setAddRetailerOpen(true)}
        />
        <AddCustomerModal isOpen={addRetailerOpen} onClose={() => setAddRetailerOpen(false)} />

        {/* Absolutely positioned banner overlays the spacer area (covers status bar). */}
        {impersonateUserId && (
          <View
            style={styles.bannerWrapper}
            onLayout={(e) => setBannerHeight(e.nativeEvent.layout.height)}
          >
            <ImpersonateBanner
              phone={impersonatePhone ?? ''}
              topInset={insets.top}
              onEnd={() => {
                dispatch(endImpersonation());
                dispatch(clearUserData());
                navigation.navigate('AdminHome');
              }}
            />
          </View>
        )}
      </View>
    </BannerHeightContext.Provider>
  );
}

const styles = StyleSheet.create({
  bannerWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 10,
  },
  impersonateBanner: {
    backgroundColor: "#B08A3A",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(135, 102, 31,0.3)",
    paddingHorizontal: 16,
    paddingBottom: 10,
    // paddingTop is set dynamically via topInset prop to clear the status bar on both iOS and Android
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  impersonateBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  impersonateIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(69,26,3,0.1)",
    borderWidth: 2,
    borderColor: "rgba(69,26,3,0.2)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  impersonatePulseDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#F5ECD7",
    borderWidth: 2,
    borderColor: "#B08A3A",
  },
  impersonateLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "rgba(69,26,3,0.7)",
    fontWeight: "600",
  },
  impersonatePhone: {
    fontSize: 13,
    fontWeight: "700",
    color: "#451A03",
  },
  viewOnlyBadge: {
    backgroundColor: "rgba(69,26,3,0.1)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  viewOnlyBadgeText: {
    color: "#451A03",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  impersonateBannerButton: {
    backgroundColor: "#451A03",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginLeft: 8,
  },
  impersonateBannerButtonText: {
    color: "#FBF6EA",
    fontSize: 12,
    fontWeight: "700",
  },

  bar: {
    backgroundColor: Brand.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.lineStrong,
    // Flat: a hairline separates the bar from the page, not a drop shadow.
  },

  inner: {
    flexDirection: "row",
    alignItems: "stretch",
  },

  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
    paddingBottom: 4,
  },

  label: {
    fontSize: 11.5,
    marginTop: 3,
    textAlign: "center",
  },

  labelActive: {
    fontWeight: "700",
  },

  underline: {
    width: 18,
    height: 3,
    borderRadius: 1.5,
    marginTop: 4,
    backgroundColor: "transparent",
  },

  underlineActive: {
    backgroundColor: Brand.goldFill,
  },

  centreSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  centreButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Brand.goldFill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: Brand.goldSoft,
    ...(Platform.OS === "web" ? { cursor: "pointer" } as any : {}),
  },
});
