import { NavigatorScreenParams } from "@react-navigation/native";


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
  /** The one order screen. Full vs part payment is inferred from what is
   *  actually paid, so there is no type to pass in. */
  NewOrder: { customerId?: string } | undefined;
  /** Taking old ornaments in for melt, against no particular bill. Credit is
   *  spent from the order screen — see TakeMeltScreen for why they are apart. */
  TakeMelt: { customerId?: string } | undefined;
  /** Every lot still waiting on a reading, plus the credited ones as history. */
  MeltLots: undefined;
  /** One lot, and whatever stage it is waiting on. */
  MeltLot: { lotId: string };
  PendingOrders: undefined;
  BillHistory: undefined;
  SalesReport: undefined;
  Customers: undefined;
  CustomerDetails: { customerId?: string, customer?: any };
  OrderDetails: { orderId: string };
  CompleteAdvanceOrder: { orderId: string };
  SelectCustomer: { next: keyof AppStackParamList, isEdit?: boolean, customer?: any } & Record<string, any>;

  AddShopDetails: undefined;
  ItemsProducts: undefined;
  Purchases: undefined;
  GstReport: undefined;
  GST: undefined;
  PrintSettings: undefined;
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
    | { filter?: 'all' | 'pending' | 'completed' | 'owing' | 'noOrders' }
    | undefined;
  Settings: undefined;
};

/** Unified root stack — combines Auth + App routes for single-navigator auth flow */
export type RootStackParamList = AuthStackParamList & AppStackParamList;
