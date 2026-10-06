import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppSelector } from '../store/hooks';
import type { RootStackParamList } from './types';
import { LAYOUT } from '../constants/layout';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import OtpScreen from '../screens/auth/OtpScreen';
import CompleteRegistrationScreen from '../screens/auth/CompleteRegistrationScreen';

// Admin screens
import AdminHomeScreen from '../screens/admin/AdminHomeScreen';

// App screens
import MainTabs from './MainTabs';
import CustomersScreen from '../screens/dashboardPages/CustomersScreen';
import OrdersScreen from '../screens/dashboardPages/OrdersScreen';
import NewOrderScreen from '../screens/orders/NewOrderScreen';
import TakeMeltScreen from '../screens/orders/TakeMeltScreen';
import MeltLotsScreen from '../screens/orders/MeltLotsScreen';
import MeltLotScreen from '../screens/orders/MeltLotScreen';
import SelectCustomerScreen from '../screens/orders/SelectCustomerScreen';
import CustomerDetailsScreen from '../screens/customers/CustomerDetailsScreen';
import OrderDetailsScreen from '../screens/orders/OrderDetailsScreen';
import AddShopDetailsScreen from '../screens/drawer/AddShopDetailsScreen';
import ItemsProductsScreen from '../screens/drawer/ItemsProductsScreen';
import PrintSettingsScreen from '../screens/drawer/PrintSettingsScreen';
import ThermalPrinterSetupScreen from '../screens/drawer/ThermalPrinterSetupScreen';
import LanguageScreen from '../screens/drawer/LanguageScreen';
import AboutUsScreen from '../screens/drawer/AboutUsScreen';
import PrivacyPolicyScreen from '../screens/drawer/PrivacyPolicyScreen';
import ContactScreen from '../screens/drawer/ContactScreen';
import TermsScreen from '../screens/drawer/TermsScreen';
import TutorialsScreen from '../screens/drawer/TutorialsScreen';
import TutorialDetailScreen from '../screens/drawer/TutorialDetailScreen';
import SettingsScreen from '../screens/dashboardPages/SettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator = () => {
  const { isLoggedIn, isGuest, phone, otpRequestedAt, userType, impersonateUserId, hydrated, needsRegistration, registrationSkipped } = useAppSelector(s => s.auth);
  const isAuthenticated = isLoggedIn || isGuest;
  const otpInProgress = !isAuthenticated && !!phone && !!otpRequestedAt;
  // Guests skip registration entirely — it only gates real (OTP-verified) dukandars.
  // `registrationSkipped` is what makes "Skip for now" mean anything: the details
  // are still missing and the server still says so, but re-showing the same form
  // at every launch is the trap that made people close the app instead. They get
  // in, and the app asks again where it actually matters (see SettingsScreen and
  // the create-invoice prompt).
  const registrationPending = isLoggedIn && !isGuest && needsRegistration && !registrationSkipped;

  // Wait for AsyncStorage hydration before mounting the navigator so that
  // initialRouteName is evaluated with the correct auth state (prevents admin
  // from being routed to MainTabs instead of AdminHome on reload).
  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#145F4A" />
      </View>
    );
  }

  const initialRoute = isAuthenticated
    ? (userType === 'admin' && !impersonateUserId
        ? 'AdminHome'
        : registrationPending ? 'CompleteRegistration' : 'MainTabs')
    : otpInProgress
      ? 'Otp'
      : 'Login';

  return (
    <Stack.Navigator
      screenOptions={{ 
        headerShown: false,
      }}
      initialRouteName={initialRoute}
    >
      {isAuthenticated ? (
        // ─── App Screens ───────────────────────────────────────────────────
        <>
          <Stack.Screen name="CompleteRegistration" component={CompleteRegistrationScreen} />
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen
            name="SelectCustomer"
            component={SelectCustomerScreen}
          />
          <Stack.Screen name="Customers" component={CustomersScreen} />
          <Stack.Screen name="SalesList" component={OrdersScreen} />
            <Stack.Screen name="NewOrder" component={NewOrderScreen} />
          <Stack.Screen name="TakeMelt" component={TakeMeltScreen} />
          <Stack.Screen name="MeltLots" component={MeltLotsScreen} />
          <Stack.Screen name="MeltLot" component={MeltLotScreen} />
          <Stack.Screen
            name="CustomerDetails"
            component={CustomerDetailsScreen}
          />
          <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} />
          <Stack.Screen
            name="AddShopDetails"
            component={AddShopDetailsScreen}
          />
          <Stack.Screen
            name="ItemsProducts"
            component={ItemsProductsScreen}
          />
          <Stack.Screen
            name="PrintSettings"
            component={PrintSettingsScreen}
          />
          <Stack.Screen
            name="ThermalPrinterSetup"
            component={ThermalPrinterSetupScreen}
          />
          <Stack.Screen name="Language" component={LanguageScreen} />
          <Stack.Screen name="AboutUs" component={AboutUsScreen} />
          <Stack.Screen
            name="PrivacyPolicy"
            component={PrivacyPolicyScreen}
          />
          <Stack.Screen name="ContactUs" component={ContactScreen} />
          <Stack.Screen name="Terms" component={TermsScreen} />
          <Stack.Screen name="Tutorials" component={TutorialsScreen} />
          <Stack.Screen name="TutorialDetail" component={TutorialDetailScreen} />
          <Stack.Screen
            name="SettingsScreen"
            component={SettingsScreen}
          />
          <Stack.Screen name="AdminHome" component={AdminHomeScreen} />
        </>
      ) : (
        // ─── Auth Screens ──────────────────────────────────────────────────
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Otp" component={OtpScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default RootNavigator;
