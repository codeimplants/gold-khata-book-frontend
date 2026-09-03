/**
 * ⚠ NOT MOUNTED — this navigator is dead code. Nothing imports it.
 *
 * The navigator the app actually runs is `RootNavigator.tsx` (mounted in
 * App.tsx), which combines the auth and app stacks so login/logout swaps the
 * whole tree. Register new screens THERE.
 *
 * Adding a screen here instead produces no error at build or type-check time —
 * it fails only at runtime, when navigating, with:
 *
 *   The action 'NAVIGATE' with payload {...} was not handled by any navigator.
 *   Do you have a screen named 'X'?
 *
 * That has already cost one round of build-and-test. This file is also visibly
 * stale: it is missing SelectCustomer, CustomerDetails, OrderDetails,
 * CompleteAdvanceOrder and both Admin screens, all of which the app has.
 *
 * Kept only in case the standalone app stack is ever revived. If you are
 * touching navigation and it is still unused, deleting it is the better fix.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AppStackParamList } from './types';

import DashboardScreen from '../screens/dashboard/DashboardScreen';
import CreateInvoiceScreen from '../screens/invoice/CreateInvoiceScreen';
import BillHistoryScreen from '../screens/dashboardPages/BillHistoryScreen';
import SalesReportScreen from '../screens/dashboardPages/SalesReportScreen';
import GstReportScreen from '../screens/dashboardPages/GstReportScreen';
import PurchasesScreen from '../screens/drawer/PurchasesScreen';
import CustomersScreen from '../screens/dashboardPages/CustomersScreen';
import AdvanceOrderSuccessScreen from '../screens/orders/AdvanceOrderSuccessScreen';
import OldGoldPurchaseScreen from '../screens/oldGold/OldGoldPurchaseScreen';

import AddShopDetailsScreen from '../screens/drawer/AddShopDetailsScreen';
import ItemsProductsScreen from '../screens/drawer/ItemsProductsScreen';
import GstScreen from '../screens/drawer/GstScreen';
import PrintSettingsScreen from '../screens/drawer/PrintSettingsScreen';
import ThermalPrinterSetupScreen from '../screens/drawer/ThermalPrinterSetupScreen';
import InvoiceBillSettingsScreen from '../screens/drawer/InvoiceBillSettingsScreen';
import LanguageScreen from '../screens/drawer/LanguageScreen';
import AboutUsScreen from '../screens/drawer/AboutUsScreen';
import PrivacyPolicyScreen from '../screens/drawer/PrivacyPolicyScreen';
import ContactScreen from '../screens/drawer/ContactScreen';
import TermsScreen from '../screens/drawer/TermsScreen';
import TutorialsScreen from '../screens/drawer/TutorialsScreen';
import TutorialDetailScreen from '../screens/drawer/TutorialDetailScreen';

import MetalRatesScreen from '../screens/dashboardPages/MetalRatesScreen';
import AdvanceOrderScreen from '../screens/dashboardPages/AdvanceOrderScreen';
import MainTabs from './MainTabs';
import SettingsScreen from '../screens/dashboardPages/SettingsScreen';

const Stack = createNativeStackNavigator<AppStackParamList>();

const AppNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* <Stack.Screen name="Dashboard" component={DashboardScreen} /> */}


      {/* 👇 MainTabs should be FIRST and DEFAULT */}
      <Stack.Screen name="MainTabs" component={MainTabs} />

      <Stack.Screen
        name="MetalRates"
        component={MetalRatesScreen}
      />

      <Stack.Screen name="CreateInvoice" component={CreateInvoiceScreen} />

      <Stack.Screen name="AdvanceOrder" component={AdvanceOrderScreen} />
      <Stack.Screen name="AdvanceOrderSuccess" component={AdvanceOrderSuccessScreen} />

      <Stack.Screen name="OldGoldPurchase" component={OldGoldPurchaseScreen} />

      <Stack.Screen name="BillHistory" component={BillHistoryScreen} />
      <Stack.Screen name="SalesReport" component={SalesReportScreen} />
      <Stack.Screen name="GstReport" component={GstReportScreen} />
      <Stack.Screen name="Customers" component={CustomersScreen} />

      <Stack.Screen name="AddShopDetails" component={AddShopDetailsScreen} />
      <Stack.Screen name="ItemsProducts" component={ItemsProductsScreen} />
      <Stack.Screen name="Purchases" component={PurchasesScreen} />
      <Stack.Screen name="GST" component={GstScreen} />
      <Stack.Screen name="PrintSettings" component={PrintSettingsScreen} />
      <Stack.Screen name="ThermalPrinterSetup" component={ThermalPrinterSetupScreen} />
      <Stack.Screen name="InvoiceBillSettings" component={InvoiceBillSettingsScreen} />
      <Stack.Screen name="Language" component={LanguageScreen} />
      <Stack.Screen name="AboutUs" component={AboutUsScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="ContactUs" component={ContactScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="Tutorials" component={TutorialsScreen} />
      <Stack.Screen name="TutorialDetail" component={TutorialDetailScreen} />
      <Stack.Screen name="SettingsScreen" component={SettingsScreen} />


      {/* <Stack.Screen
        name="SidebarModal"
        component={SidebarModal}
        options={{
          headerShown: false,
          presentation: "transparentModal",
          animation: "none",
        }}
      /> */}

    </Stack.Navigator>
  );
};

export default AppNavigator;
