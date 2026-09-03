import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Platform, TouchableOpacity, View, Text } from "react-native";
import { createBottomTabNavigator, BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Home, ShoppingBag, Users, Settings, AlertTriangle } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { endImpersonation } from "../store/auth/authSlice";
import { clearUserData } from "../store/data/dataSlice";

import DashboardScreen from "../screens/dashboard/DashboardScreen";
import OrdersScreen from "../screens/dashboardPages/OrdersScreen";
import CustomersScreen from "../screens/dashboardPages/CustomersScreen";
import SettingsScreen from "../screens/dashboardPages/SettingsScreen";

import { MainTabParamList } from "./types";
import { useTranslation } from "../hooks/useTranslation";
import { LAYOUT } from "../constants/layout";

export const BannerHeightContext = React.createContext(0);

const Tab = createBottomTabNavigator<MainTabParamList>();

type TabName = "Dashboard" | "Orders" | "Customers" | "Settings";

const TAB_CONFIG: Record<TabName, { colors: [string, string]; IconComp: React.ComponentType<any> }> = {
  Dashboard: { colors: ["#6366F1", "#D946EF"], IconComp: Home },
  Orders:    { colors: ["#14B8A6", "#0D9488"], IconComp: ShoppingBag },
  Customers: { colors: ["#F59E0B", "#EA580C"], IconComp: Users },
  Settings:  { colors: ["#9CA3AF", "#6B7280"], IconComp: Settings },
};

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

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
            // for it. 96 covers the icon/label content comfortably;
            // insets.bottom on top of that clears the system nav bar.
            height: 96 + Math.max(insets.bottom, 0),
          },
    ]}>
      <View style={[
        styles.inner,
        LAYOUT.isWeb ? LAYOUT.contentContainerStyle : { flex: 1 },
      ]}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const config = TAB_CONFIG[route.name as TabName] ?? TAB_CONFIG.Settings;
          const { colors, IconComp } = config;
          const label = t(`tabs.${route.name.toLowerCase()}`);

          return (
            <TouchableOpacity
              key={route.key}
              style={styles.tabItem}
              activeOpacity={0.7}
              onPress={() => {
                if (!focused) navigation.navigate(route.name as any);
              }}
            >
              {/* Indicator — absolute top-0, left-0/right-0 centered
                  Mirrors web: `absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1` */}
              {focused && (
                <View style={styles.indicator}>
                  <Svg width="48" height="4">
                    <Defs>
                      <LinearGradient id={`ind${index}`} x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0%" stopColor={colors[0]} />
                        <Stop offset="100%" stopColor={colors[1]} />
                      </LinearGradient>
                    </Defs>
                    <Rect width="48" height="4" rx="2" fill={`url(#ind${index})`} />
                  </Svg>
                </View>
              )}

              {/* Icon — SVG in normal flow sets the 40x40 size,
                  then a centered absoluteFill View overlays the icon on top */}
              {focused ? (
                <View style={styles.activeIconWrapper}>
                  <Svg width="40" height="40">
                    <Defs>
                      <LinearGradient id={`ic${index}`} x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0%" stopColor={colors[0]} />
                        <Stop offset="100%" stopColor={colors[1]} />
                      </LinearGradient>
                    </Defs>
                    <Rect width="40" height="40" rx="12" fill={`url(#ic${index})`} />
                  </Svg>
                  <View style={[StyleSheet.absoluteFill, styles.centered]}>
                    <IconComp size={18} color="#FFFFFF" />
                  </View>
                </View>
              ) : (
                <View style={styles.inactiveIconWrapper}>
                  <IconComp size={20} color="#6B7280" />
                </View>
              )}

              {/* Label */}
              <Text style={[styles.label, focused && { fontWeight: "700", color: colors[0] }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
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

  useEffect(() => {
    if (!impersonateUserId) setBannerHeight(0);
  }, [impersonateUserId]);

  return (
    <BannerHeightContext.Provider value={impersonateUserId ? bannerHeight : 0}>
      <View style={{ flex: 1 }}>
        {/* Spacer pushes Tab.Navigator below the absolutely-positioned banner.
            Height is updated after the first onLayout measurement. */}
        {impersonateUserId ? <View style={{ height: bannerHeight }} /> : null}

        <Tab.Navigator
          initialRouteName="Dashboard"
          tabBar={(props) => <CustomTabBar {...props} />}
          screenOptions={{ headerShown: false, lazy: true }}
        >
          <Tab.Screen name="Dashboard" component={DashboardScreen} />
          <Tab.Screen name="Orders" component={OrdersScreen} />
          <Tab.Screen name="Customers" component={CustomersScreen} />
          <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>

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
    backgroundColor: "#F59E0B",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(180,83,9,0.3)",
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
    backgroundColor: "#FEF3C7",
    borderWidth: 2,
    borderColor: "#F59E0B",
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
    color: "#FFFBEB",
    fontSize: 12,
    fontWeight: "700",
  },

  bar: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    ...(Platform.OS !== "web" ? { elevation: 15 } : {}),
  },

  inner: {
    flexDirection: "row",
  },

  // Each tab — mirrors web: `flex-1 flex-col items-center justify-center py-3 gap-1.5 relative`
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    position: "relative",
  },

  // Indicator — full width, centered child, absolute top-0
  // Mirrors web: `absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 rounded-b-full`
  indicator: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    alignItems: "center",
  },

  // SVG is in normal flow (40x40), absoluteFill View overlays icon on top
  activeIconWrapper: {
    width: 40,
    height: 40,
    marginBottom: 6,
  },

  inactiveIconWrapper: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },

  centered: {
    alignItems: "center",
    justifyContent: "center",
  },

  label: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
});
