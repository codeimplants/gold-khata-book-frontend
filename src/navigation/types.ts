import { NavigatorScreenParams } from "@react-navigation/native";
import type { FormId } from "../print/forms/catalog";


export type AuthStackParamList = {
  Login: undefined;
  Otp: { phone: string } | undefined;
};

export type AppStackParamList = {
  CompleteRegistration: undefined;
  Dashboard: undefined;
  MetalRates: undefined;
  CreateInvoice: { customerId?: string; editOrderId?: string } | undefined;
  AdvanceOrder: {
    customerId?: string;
    preservedState?: string;
    preservedItems?: string;
    editOrderId?: string;
  } | undefined;
  AdvanceOrderSuccess: { order: any };
  /** Standalone old-gold purchase + declaration.
   *  `prefill` is a JSON DeclarationFormValues patch — used by the invoice
   *  exchange path to carry the exchanged ornaments across. */
  OldGoldPurchase:
    | { customerId?: string; editId?: string; prefill?: string }
    | undefined;
  PendingOrders: undefined;
  BillHistory: undefined;
  SalesReport: undefined;
  Customers: undefined;
  CustomerDetails: { customerId?: string, customer?: any };
  OrderDetails: { orderId: string };
  /** One old-gold purchase ("Sold to us") and its declaration. `OldGoldPurchase`
   *  above is the form that creates and edits one; this is the read view a card
   *  opens into, mirroring OrderDetails. */
  SoldToUsDetails: { declarationId: string };
  CompleteAdvanceOrder: { orderId: string };
  SelectCustomer: { next: keyof AppStackParamList, isEdit?: boolean, customer?: any } & Record<string, any>;

  AddShopDetails: undefined;
  ItemsProducts: undefined;
  Purchases: undefined;
  GstReport: undefined;
  GST: undefined;
  PrintSettings: undefined;
  DownloadForms: undefined;
  FormDetail: { formId: FormId };
  ThermalPrinterSetup: undefined;
  InvoiceBillSettings: undefined;
  Language: undefined;

  AboutUs: undefined;
  PrivacyPolicy: undefined;
  ContactUs: undefined;
  Terms: undefined;
  /** Omit `topic` for the full library; pass one to filter to a screen's help. */
  Tutorials: { topic?: string } | undefined;
  TutorialDetail: { slug: string; from?: string };

  SidebarModal: undefined;
  SettingsScreen: undefined;

  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  AdminHome: undefined;
};

// types.ts

export type MainTabParamList = {
  Dashboard: undefined;
  Orders: { filter?: 'pending' | 'completed' | 'all' | 'gst' | 'nongst' } | undefined;
  Customers:
    | { filter?: 'all' | 'pending' | 'completed' | 'sellers' | 'noOrders' }
    | undefined;
  Settings: undefined;
};

/** Unified root stack — combines Auth + App routes for single-navigator auth flow */
export type RootStackParamList = AuthStackParamList & AppStackParamList;
