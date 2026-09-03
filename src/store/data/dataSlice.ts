import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AnalyticsSDK from '@codeimplants/analytics';
import { AppReview } from '@codeimplants/app-review';
import { RootState } from '../index';
import { apiClient } from '../../api/apiClient';
import { splitGstAmount } from '../../utils/gst';
import type {
    PurchaseOldGold,
    DeclarationFormValues,
    PendingDeclarationPhoto,
    IdProofType,
    InvoiceTemplate,
} from '../../types';
import type { Language } from '../../localization';

const { Analytics } = AnalyticsSDK;

/**
 * Appends a freshly-picked image to a multipart FormData in a way that works on
 * BOTH native and web.
 *
 * React Native's polyfilled FormData accepts a `{ uri, name, type }` file
 * descriptor. The browser's native FormData (react-native-web) does NOT — it
 * stringifies the plain object to the literal "[object Object]", which the
 * backend then stores as a broken image and never uploads to ImageKit. On web we
 * must resolve the picker's (blob:/data:) uri into a real Blob and append that.
 */
const appendPickedImage = async (
    formData: FormData,
    field: string,
    asset: any,
    fallbackName: string,
): Promise<void> => {
    const name = asset?.fileName || fallbackName;
    if (Platform.OS === 'web') {
        const res = await fetch(asset.uri);
        const blob = await res.blob();
        formData.append(field, blob, name);
    } else {
        formData.append(field, {
            uri: asset.uri,
            name,
            type: asset?.type || 'image/jpeg',
        } as any);
    }
};

// ─── Helpers for consistent state mapping from backend to frontend ───
const mapBackendOrder = (ord: any): any => ({
    id: ord.id || ord._id,
    customerId: ord.customerId?.id || ord.customerId?._id || ord.customerId,
    invoiceNumber: ord.orderNumber,
    orderNumber: ord.orderNumber,
    date: ord.orderDate || ord.date,
    createdAt: ord.createdAt,
    status: ord.status,
    type: 'advance',
    amount: ord.status === 'completed'
        ? (ord.totalPaid || 0)
        : (ord.totalPaid || 0) + (ord.estimatedBalance || 0),
    items: ord.items || [],
    totalWeight: ord.totalWeight || 0,
    weightPaid: ord.weightPaid || 0,
    // Grams still owed on the order. Server-computed and stored
    // (max(0, totalWeight - weightPaid)); carried rather than re-derived here so
    // one definition of "still owed" serves everywhere. Every other write path
    // already set it - createOrder from the API response, and
    // updateOrderStatus.fulfilled, which patches it explicitly - so leaving it
    // out here meant an order fetched from the server had no remainingWeight
    // until something happened to change its status.
    remainingWeight: ord.remainingWeight || 0,
    payments: ord.payments || [],
    totalPaid: ord.totalPaid || 0,
    estimatedBalance: ord.estimatedBalance || 0,
    finalInvoiceId: ord.finalInvoiceId,
    bookingRate: ord.bookingRate || 0,
    includeGST: ord.includeGST,
    subTotal: ord.subTotal,
    gstAmount: ord.gstAmount,
    gstRate: ord.gstRate,
    isOrnamentExchanges: ord.isOrnamentExchanges,
    exchanges: mapOrnamentExchangesFromApi(ord.ornamentExchanges),
    // Derived server-side: grams the old gold settled, and any surplus owed back
    // when it was worth more than the order.
    exchangeWeightCovered: ord.exchangeWeightCovered,
    exchangeExcess: ord.exchangeExcess,
    ornamentPhotos: ord.ornamentPhotos || [],
    includeItemPhotosOnBill: !!ord.includeItemPhotosOnBill,
});

// Reads the backend's `ornamentExchanges` field, which is either:
//  - an array of per-item exchange rows (invoices created after the
//    per-item exchange extension), or
//  - the legacy { gold: {weight, amount}, silver: {weight, amount} }
//    aggregate (invoices created before it — never migrated).
// Either way, normalize to the row array the UI renders.
const mapOrnamentExchangesFromApi = (raw: any): any[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) {
        return raw.map((ex: any, idx: number) => ({
            id: `ex_${idx}_${Math.random().toString(36).substr(2, 9)}`,
            type: ex.type,
            itemName: ex.itemName || '',
            grossWt: ex.grossWeight != null ? String(ex.grossWeight) : '',
            lessWt: ex.lessWeight != null ? String(ex.lessWeight) : '',
            netWt: ex.netWeight != null ? String(ex.netWeight) : '',
            purity: ex.purity || '',
            ratePerGm: ex.ratePerGram != null ? String(ex.ratePerGram) : '',
            amount: ex.amount ?? 0,
            // Uploaded against this row after the bill saved. Carried through
            // so the detail screen and the edit form both show what is there
            // rather than an empty picker reading as "no photos were taken".
            photos: ex.photos || [],
        }));
    }
    return [
        { type: 'Gold', weight: raw.gold?.weight || 0, amount: raw.gold?.amount || 0 },
        { type: 'Silver', weight: raw.silver?.weight || 0, amount: raw.silver?.amount || 0 },
    ]
        .filter((ex: any) => ex.weight > 0 || ex.amount > 0)
        .map((ex, idx) => ({ id: `ex_legacy_${idx}`, ...ex }));
};

const mapBackendInvoice = (inv: any): any => ({
    id: inv.id || inv._id,
    invoiceNumber: inv.invoiceNumber,
    date: inv.invoiceDate || inv.date,
    createdAt: inv.createdAt,
    customerId: inv.customerId?.id || inv.customerId?._id || inv.customerId,
    amount: inv.totalAmount || inv.amount || 0,
    items: inv.items || [],
    type: 'full',
    status: 'completed', // Invoices are always completed
    orderId: inv.orderId,
    subTotal: inv.subTotal,
    gstAmount: inv.gstAmount,
    includeGST: inv.includeGST,
    gstRate: inv.gstRate,
    cgstAmount: inv.cgstAmount,
    sgstAmount: inv.sgstAmount,
    igstAmount: inv.igstAmount,
    shopGstin: inv.shopGstin,
    customerGstin: inv.customerGstin,
    supplyType: inv.supplyType,
    placeOfSupply: inv.placeOfSupply,
    // Every consumer gates exchange UI on this flag, not on exchanges.length —
    // omitting it here meant a refetch silently stripped it off invoices that
    // had it set at creation, hiding the exchange badge and the whole
    // declaration button group once the user navigated away and back.
    isOrnamentExchanges: inv.isOrnamentExchanges,
    exchanges: mapOrnamentExchangesFromApi(inv.ornamentExchanges),
    paymentMethod: inv.paymentMethod,
    onlinePaymentType: inv.onlinePaymentType,
    // Whether the shopkeeper chose to print item photos on this bill.
    includeItemPhotosOnBill: !!inv.includeItemPhotosOnBill,
    // Was missing entirely — the backend has carried Invoice.ornamentPhotos
    // since it was added, but nothing read it back into the client Order shape,
    // so a full-payment invoice's ornament photos could never be displayed
    // regardless of whether the upload itself succeeded.
    ornamentPhotos: inv.ornamentPhotos || [],
});

// ─── Shared item/payload mappers — used by both create (addOrder) and
// edit (updateInvoiceOrder / updateAdvanceOrderItems) so the two paths
// can't drift on how a form's `order` shape is translated to the API. ───
const mapInvoiceItemsForApi = (order: any) =>
    (order.items || order.products || []).map((it: any) => ({
        name: it.itemName || it.name || 'Jewelry Item',
        pieces: parseInt(it.pcs || it.pieces) || 1,
        itemType: it.metalType || it.itemType || 'Gold',
        purity: it.purity || '22K',
        grossWeight: parseFloat(it.grossWt || it.grossWeight) || 0,
        lessWeight: parseFloat(it.lessWt || it.lessWeight) || 0,
        rate: parseFloat(it.ratePerGm || it.rate) || 0,
        makingType: (it.makingChargeType || it.makingType)?.toLowerCase().replace(' ', '') || 'fixed',
        makingCharge: parseFloat(it.makingCharges || it.makingCharge || it.makingChargeValue) || 0,
        chargeDescription: it.chargeDescription || it.otherChargesDescription || it.otherChargeDesc || 'Charges',
        chargeAmount: parseFloat(it.chargeAmount || it.otherChargesAmount || it.otherChargeAmount) || 0,
        discountType: (it.discountType || 'fixed').toLowerCase(),
        discount: parseFloat(it.discount) || 0,
        huid: it.huid || '',
        hsnCode: it.hsnCode || '7113',
    }));

/**
 * Coerces a money field to the number the API schema demands.
 *
 * The invoice form holds its totals as formatted strings, so whether a payload
 * field arrived as a number depended entirely on whether its call site
 * remembered to parse. It did on create and did not on edit, which sent
 * gstAmount as "540.00" into a z.number() and failed the whole PUT with
 * "Invalid input: expected number, received string" - taking the item-photo
 * upload that runs after the save down with it.
 *
 * Applied inside the shared payload builders rather than at the call sites, so
 * a future screen cannot reintroduce the same drift.
 */
const toApiNumber = (...values: any[]): number => {
    for (const value of values) {
        if (value === undefined || value === null || value === '') continue;
        const n = typeof value === 'number' ? value : parseFloat(String(value));
        if (Number.isFinite(n)) return n;
    }
    return 0;
};

const mapOrnamentExchangesForApi = (order: any) => {
    const exchanges = order.ornamentExchanges || [];
    return Array.isArray(exchanges)
        ? exchanges.map((ex: any) => ({
            type: ex.type,
            itemName: ex.itemName || undefined,
            grossWeight: ex.grossWt !== '' && ex.grossWt != null ? parseFloat(ex.grossWt) : undefined,
            lessWeight: ex.lessWt !== '' && ex.lessWt != null ? parseFloat(ex.lessWt) : undefined,
            netWeight: ex.netWt !== '' && ex.netWt != null ? parseFloat(ex.netWt) : undefined,
            purity: ex.purity || undefined,
            ratePerGram: ex.ratePerGm !== '' && ex.ratePerGm != null ? parseFloat(ex.ratePerGm) : undefined,
            amount: parseFloat(ex.amount) || 0,
        }))
        : [];
};

// Only forward a syntactically valid customer GSTIN — the backend rejects
// malformed ones with a 400.
const mapValidCustomerGstin = (order: any): string | undefined => {
    const customerGstin = String(order.customerGstin || '').trim().toUpperCase();
    return /^[0-9]{2}[A-Z0-9]{13}$/.test(customerGstin) ? customerGstin : undefined;
};

const mapAdvanceOrderItemsForApi = (order: any) =>
    (order.items || []).map((it: any) => ({
        itemName: it.itemName || it.name || 'Jewelry Item',
        itemType: it.itemType || it.metalType || 'Gold',
        purity: it.purity || '22K - 91.6%',
        weight: parseFloat(it.netWt || it.weight || it.netWeight) || 0,
        grossWeight: parseFloat(it.grossWt || it.grossWeight || it.netWt) || 0,
        lessWeight: parseFloat(it.lessWt || it.lessWeight) || 0,
        rate: parseFloat(it.ratePerGm || it.rate) || 0,
        makingChargeType: it.makingChargeType || '%',
        makingChargeValue: parseFloat(it.makingChargeValue || it.makingCharge || it.makingCharges) || 0,
        chargeDescription: it.otherChargesDescription || it.chargeDescription || '',
        chargeAmount: parseFloat(it.otherChargesAmount || it.chargeAmount) || 0,
        discountType: it.discountType || 'Fixed',
        discount: parseFloat(it.discount) || 0,
    }));

export interface Customer {
    id: string;
    _id?: string;
    /** Per-shop display code, "C-42". What tells two customers with the same
     *  name and no phone number apart. Assigned by the server (or locally in
     *  guest mode); absent on customers created before the field existed,
     *  until the backfill migration has run on that environment. */
    customerCode?: string;
    name: string;
    /** Optional — a walk-in buying a small item routinely will not give one.
     *  An old-gold declaration is the single place that still requires it. */
    phone?: string;
    email?: string;
    address?: string;
    /** Optional, prefills a declaration's ID proof — never locks it, since the
     *  seller on a given exchange may be a family member, not the customer. */
    idProofType?: IdProofType;
    idProofNumber?: string;
    /** Optional profile photo, reused on the old-gold declaration so the
     *  document carries a picture of who sold the gold. */
    profilePhoto?: { url: string; fileId: string };
};

export type Order = {
    id: string;
    customerId: string;
    type: 'full' | 'advance';
    amount: number;
    date: string;
    items?: any[];
    isOrnamentExchanges?: boolean;
    exchanges?: any[];
    /** Grams the old gold settled — counts toward weightPaid like a payment. */
    exchangeWeightCovered?: number;
    /** Surplus owed back when old gold exceeded the order value. */
    exchangeExcess?: number;
    /** Photos of the old ornaments taken in against this order. */
    ornamentPhotos?: { url: string; fileId: string }[];
    status: 'pending' | 'completed';
    // Extended invoice fields
    invoiceNumber?: string;
    subTotal?: number;
    gstAmount?: number;
    includeGST?: boolean;
    // GST breakdown (absent on invoices created before the GST extension)
    gstRate?: number;
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
    shopGstin?: string;
    customerGstin?: string;
    supplyType?: 'intra' | 'inter';
    placeOfSupply?: string;
    paymentMethod?: 'cash' | 'online';
    onlinePaymentType?: 'upi' | 'bank_transfer' | 'cheque' | 'card' | 'other';
    // Advance order fields
    orderNumber?: string;
    totalPaid?: number;
    estimatedBalance?: number;
    totalWeight?: number;
    remainingWeight?: number;
    weightPaid?: number;
    completedAt?: string;
    payments?: any[];
    createdAt?: string;
    dukandarId?: string;
    bookingRate?: number;
    // Soft delete
    deletedAt?: string;
};

export type CatalogProduct = {
    id: string;
    name: string;
    category?: string;
    purity?: string;
    makingChargeType?: string;
    makingCharges?: number;
    discountType?: string;
    discount?: number;
    grossWt?: number;
    lessWt?: number;
    pcs?: number;
    huid?: string;
    otherChargeDesc?: string;
    otherChargeAmount?: number;
    stockQty?: number;
};

// Stock purchase recorded for GST/ITC (inward supply). No stock-quantity
// logic in v1 — description/category/weightGrams are future inventory hooks.
export type Purchase = {
    id: string;
    supplierName: string;
    supplierGstin?: string; // absent => unregistered supplier (ITC ineligible)
    purchaseInvoiceNumber: string;
    purchaseDate: string;
    taxableValue: number;
    gstRate?: number;
    gstAmount: number;
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
    supplyType?: 'intra' | 'inter';
    shopGstin?: string;
    hsnCode?: string;
    description?: string;
    category?: string;
    weightGrams?: number;
    createdAt?: string;
};

export type ShopDetails = {
    id?: string;
    name: string;
    phone: string;
    email: string;
    address: string;
    gst?: string;
    gstPercentage?: number;
    shopName?: string;
    ownerName?: string;
    shopDesc?: string;
    logo?: any;
    shopHeader?: any;
    signature?: any;
    /**
     * Shop-wide preferences, stored on the shop record rather than on the
     * device. Undefined for a shop that has not saved one since the feature
     * shipped — LanguageProvider then keeps using that device's local value,
     * so nothing changes under an existing shop until it chooses to.
     */
    invoiceTemplate?: InvoiceTemplate;
    appLanguage?: Language;
    declarationLanguage?: Language;
};

export type MetalRates = {
    gold: {
        goldPrice24K995GW: number;
        goldPrice22K: number;
        goldPrice18K: number;
        goldPrice14K: number;
    };
    silver: {
        silverPrice: number;
        silverBarPrice: number;
    };
    lastUpdated?: string;
};

export type SalesData = {
    summary: {
        totalSales: number;
        totalInvoices: number;
        avgOrderValue: number;
        itemsSold: number;
        goldItems: number;
        silverItems: number;
        uniqueCustomers: number;
    };
    topCustomers: {
        customerId: string;
        amount: number;
    }[];
};

interface DataState {
    customers: Customer[];
    orders: Order[];
    shopDetails: ShopDetails | null;
    metalRates: MetalRates | null;
    catalogProducts: CatalogProduct[];
    purchases: Purchase[];
    /** Old gold bought from customers. Never feeds salesReport/gstReport — a purchase
     * from a customer is not a sale. */
    purchaseOldGold: PurchaseOldGold[];
    salesReport: SalesData | null;
    gstReport: any | null;
    loading: boolean;
    deletedOrderIds: Record<string, string>;
    lastFetched: {
        customers: number | null;
        orders: number | null;
        shopDetails: number | null;
        metalRates: number | null;
        catalogProducts: number | null;
        purchases: number | null;
        purchaseOldGold: number | null;
        salesReport: Record<string, number>;
    };
    error?: string;
}

const initialState: DataState = {
    customers: [],
    orders: [],
    shopDetails: null,
    metalRates: null,
    catalogProducts: [],
    purchases: [],
    purchaseOldGold: [],
    salesReport: null,
    gstReport: null,
    loading: false,
    deletedOrderIds: {},
    lastFetched: {
        customers: null,
        orders: null,
        shopDetails: null,
        metalRates: null,
        catalogProducts: null,
        purchases: null,
        purchaseOldGold: null,
        salesReport: {},
    },
};

// Keys for AsyncStorage
const CUSTOMERS_KEY = '@customers';
const ORDERS_KEY = '@orders';
const SHOP_DETAILS_KEY = '@shop_details';
const METAL_RATES_KEY = '@metal_rates';
const CATALOG_PRODUCTS_KEY = '@catalog_products';
const PURCHASES_KEY = '@purchases';
const DECLARATIONS_KEY = '@old_gold_declarations';
const DELETED_ORDERS_KEY = '@deleted_orders';

type FetchArgs = { force?: boolean; staleTimeMs?: number };
type SalesReportArgs = string | { range: string; force?: boolean; staleTimeMs?: number };

const STALE_TIMES_MS = {
    customers: 30_000,
    orders: 30_000,
    shopDetails: 60_000,
    metalRates: 60_000,
    catalogProducts: 60_000,
    purchases: 60_000,
    purchaseOldGold: 60_000,
    salesReport: 60_000,
};

const shouldFetch = (
    lastFetched: number | null,
    args: FetchArgs | undefined,
    staleTimeMs: number,
) => {
    if (args?.force) return true;
    if (!lastFetched) return true;
    const ttl = args?.staleTimeMs ?? staleTimeMs;
    return Date.now() - lastFetched > ttl;
};

const normalizeSalesReportArgs = (arg: SalesReportArgs) =>
    typeof arg === 'string' ? { range: arg } : arg;

export const fetchCustomers = createAsyncThunk(
    'data/fetchCustomers',
    async (args: FetchArgs | undefined, { getState, rejectWithValue }) => {
        const state = getState() as RootState;
        const { isGuest } = state.auth;

        if (isGuest) {
            const data = await AsyncStorage.getItem(CUSTOMERS_KEY);
            return data ? JSON.parse(data) : [];
        } else {
            try {
                const response = await apiClient.get<any>('/api/customer');
                const result = response.data;
                // Handle { success: true, data: [...] }
                const list = result && typeof result === 'object' && 'data' in result ? result.data : result;
                const data = Array.isArray(list) ? list : [];
                return data.map((c: any) => ({
                    ...c,
                    id: c._id || c.id
                }));
            } catch (err: any) {
                return rejectWithValue(err.message || 'Failed to fetch retailers');
            }
        }
    },
    {
        condition: (arg, { getState }) => {
            const state = getState() as RootState;
            return shouldFetch(
                state.data.lastFetched.customers,
                arg,
                STALE_TIMES_MS.customers,
            );
        },
    }
);

export const addCustomer = createAsyncThunk(
    'data/addCustomer',
    async (customer: Omit<Customer, 'id'>, { getState, rejectWithValue }) => {
        const state = getState() as RootState;
        const { isGuest } = state.auth;

        if (isGuest) {
            const currentData = await AsyncStorage.getItem(CUSTOMERS_KEY);
            const customers = currentData ? JSON.parse(currentData) : [];
            // Guest data never reaches the server, so the code the pre-save hook
            // would have minted has to be minted here instead. Same "C-n" shape,
            // continuing past the highest already on the device rather than
            // counting the list — a deleted customer must not free its number for
            // reuse, or two records end up carrying the same code.
            const nextCode = `C-${customers.reduce(
                (max: number, c: any) => Math.max(max, Number(/^C-(\d+)$/.exec(c?.customerCode || "")?.[1] || 0)),
                0,
            ) + 1}`;
            const newCustomer = { customerCode: nextCode, ...customer, id: Date.now().toString() };
            const updatedCustomers = [newCustomer, ...customers];
            await AsyncStorage.setItem(CUSTOMERS_KEY, JSON.stringify(updatedCustomers));
            return updatedCustomers;
        } else {
            try {
                const response = await apiClient.post<any>('/api/customer', customer);
                if (response.data?.success === false) {
                    return rejectWithValue(response.data.message || 'Failed to add retailer');
                }
                const newCustomer = response.data?.data || response.data;
                if (!newCustomer || (!newCustomer._id && !newCustomer.id) || !newCustomer.name) {
                    return rejectWithValue('Invalid server response: Missing retailer data');
                }
                const mappedCustomer = {
                    ...newCustomer,
                    id: newCustomer._id || newCustomer.id
                };
                const currentData = (getState() as RootState).data.customers;
                return [mappedCustomer, ...currentData];
            } catch (err: any) {
                return rejectWithValue(err.message || 'Failed to add retailer');
            }
        }
    }
);

export const updateCustomer = createAsyncThunk(
    'data/updateCustomer',
    async (customer: Customer, { getState, rejectWithValue }) => {
        const state = getState() as RootState;
        const { isGuest } = state.auth;

        if (isGuest) {
            const currentData = await AsyncStorage.getItem(CUSTOMERS_KEY);
            const customers: Customer[] = currentData ? JSON.parse(currentData) : [];
            const updated = customers.map(c => c.id === customer.id ? customer : c);
            await AsyncStorage.setItem(CUSTOMERS_KEY, JSON.stringify(updated));
            return updated;
        } else {
            try {
                // Strip unnecessary/internal fields that might confuse Mongoose findOneAndUpdate
                const { _id, id, __v, createdAt, updatedAt, dukandarId, invoices, ...cleanPayload } = customer as any;

                console.log('[dataSlice] updateCustomer payload:', JSON.stringify(cleanPayload, null, 2));
                const response = await apiClient.put<any>(`/api/customer/${customer.id}`, cleanPayload);
                console.log('[dataSlice] updateCustomer response:', response.data);
                const responseData = response.data?.data || response.data;
                const updatedCustomer = {
                    ...customer,
                    ...(typeof responseData === 'object' ? responseData : {}),
                    id: responseData?._id || responseData?.id || customer.id
                };
                const current = (getState() as RootState).data.customers;
                return current.map(c => c.id === updatedCustomer.id ? updatedCustomer : c);
            } catch (err: any) {
                return rejectWithValue(err.message || 'Failed to update retailer');
            }
        }
    }
);

/**
 * Deletes a customer and everything filed under them — bills, orders and
 * old-gold declarations. The API cascades server-side; guest mode has to do the
 * same to its three AsyncStorage keys, or the local copy keeps records the
 * logged-in version would have removed.
 *
 * Returns the customer id alongside the new list so the reducer can drop their
 * orders and declarations from the store immediately, rather than leaving the
 * Dashboard counting purchases from someone who no longer exists until the next
 * refetch.
 */
export const deleteCustomer = createAsyncThunk(
    'data/deleteCustomer',
    async (customerId: string, { getState, rejectWithValue }) => {
        const state = getState() as RootState;
        const { isGuest } = state.auth;

        if (isGuest) {
            const [currentData, orderData, declarationData] = await Promise.all([
                AsyncStorage.getItem(CUSTOMERS_KEY),
                AsyncStorage.getItem(ORDERS_KEY),
                AsyncStorage.getItem(DECLARATIONS_KEY),
            ]);
            const customers: Customer[] = currentData ? JSON.parse(currentData) : [];
            const orders: Order[] = orderData ? JSON.parse(orderData) : [];
            const declarations: PurchaseOldGold[] = declarationData
                ? JSON.parse(declarationData)
                : [];
            const updated = customers.filter(c => c.id !== customerId);
            await Promise.all([
                AsyncStorage.setItem(CUSTOMERS_KEY, JSON.stringify(updated)),
                AsyncStorage.setItem(
                    ORDERS_KEY,
                    JSON.stringify(orders.filter(o => o.customerId !== customerId)),
                ),
                AsyncStorage.setItem(
                    DECLARATIONS_KEY,
                    JSON.stringify(declarations.filter(d => d.customerId !== customerId)),
                ),
            ]);
            return { customers: updated, customerId };
        } else {
            try {
                await apiClient.delete(`/api/customer/${customerId}`);
                const current = (getState() as RootState).data.customers;
                return { customers: current.filter(c => c.id !== customerId), customerId };
            } catch (err: any) {
                return rejectWithValue(err.message || 'Failed to delete retailer');
            }
        }
    }
);

/**
 * Attaches (or replaces) a customer's profile photo.
 *
 * Separate from `updateCustomer` because a new customer has no id to upload
 * against until it has been saved — the forms create first, then send the photo.
 *
 * Native fetch rather than ApiClient for the same reason as the declaration
 * photos: ApiClient JSON.stringifies every body, which destroys multipart.
 *
 * Guest mode keeps the local picker uri. There is no backend to upload to, and
 * a uri is enough to render the avatar and the declaration.
 */
export const uploadCustomerPhoto = createAsyncThunk(
    'data/uploadCustomerPhoto',
    async (
        args: { customerId: string; photo: { uri: string; fileName?: string; type?: string } },
        { getState, rejectWithValue },
    ) => {
        const state = getState() as RootState;
        const { isGuest, token } = state.auth;

        if (isGuest) {
            const currentData = await AsyncStorage.getItem(CUSTOMERS_KEY);
            const customers: Customer[] = currentData ? JSON.parse(currentData) : [];
            const updated = customers.map(c =>
                c.id === args.customerId
                    ? { ...c, profilePhoto: { url: args.photo.uri, fileId: args.photo.uri } }
                    : c,
            );
            await AsyncStorage.setItem(CUSTOMERS_KEY, JSON.stringify(updated));
            return updated.find(c => c.id === args.customerId)!;
        }

        try {
            const baseURL = apiClient.getConfig().baseURL.replace(/\/$/, '');
            const fullUrl = `${baseURL}/api/customer/${args.customerId}/photo`;

            const formData = new FormData();
            await appendPickedImage(formData, 'photo', args.photo, 'profile.jpg');

            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(fullUrl, { method: 'POST', headers, body: formData });
            const text = await response.text();
            let json: any;
            try {
                json = JSON.parse(text);
            } catch {
                json = {
                    message: response.status === 413
                        ? 'Photo is too large. Please choose a smaller image.'
                        : `Something went wrong (HTTP ${response.status}). Please try again.`,
                };
            }
            if (!response.ok) {
                return rejectWithValue(json?.message || `HTTP ${response.status}`);
            }
            const raw = json?.data ?? json;
            return { ...raw, id: raw._id || raw.id } as Customer;
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to upload photo');
        }
    }
);

export const removeCustomerPhoto = createAsyncThunk(
    'data/removeCustomerPhoto',
    async (customerId: string, { getState, rejectWithValue }) => {
        const state = getState() as RootState;
        const { isGuest } = state.auth;

        if (isGuest) {
            const currentData = await AsyncStorage.getItem(CUSTOMERS_KEY);
            const customers: Customer[] = currentData ? JSON.parse(currentData) : [];
            const updated = customers.map(c =>
                c.id === customerId ? { ...c, profilePhoto: undefined } : c,
            );
            await AsyncStorage.setItem(CUSTOMERS_KEY, JSON.stringify(updated));
            return updated.find(c => c.id === customerId)!;
        }

        try {
            const response = await apiClient.delete<any>(`/api/customer/${customerId}/photo`);
            const raw = (response.data as any)?.data ?? response.data;
            return { ...raw, id: raw._id || raw.id } as Customer;
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to remove photo');
        }
    }
);

/**
 * Writes the phone number and portrait collected on a declaration form back to
 * the customer's profile, before the declaration itself is created.
 *
 * Order matters and is the whole reason this exists as its own step: the server
 * builds `customerSnapshot` by reading the *customer record* at create time, so
 * a number or a photo that has not landed on the profile by then never reaches
 * the document. It also rejects a declaration for a customer with no phone at
 * all, which is the error this flow exists to prevent rather than report.
 *
 * The phone is the blocking half — without it the declaration cannot be saved,
 * so a failure here is returned as a rejection and the caller stops. The photo
 * is not: a portrait that fails to upload costs the document a picture, not its
 * validity, so it comes back as `photoFailed` for the caller to surface as a
 * toast while the declaration goes ahead.
 *
 * Both writes are skipped when there is nothing to do, so reopening a form and
 * saving it unchanged makes no customer requests at all.
 */
export const syncCustomerForDeclaration = createAsyncThunk(
    'data/syncCustomerForDeclaration',
    async (
        args: {
            customerId: string;
            phone: string;
            /** A newly picked portrait; absent when the profile photo is unchanged. */
            photo?: { uri: string; fileName?: string; type?: string };
        },
        { dispatch, getState, rejectWithValue },
    ) => {
        const state = getState() as RootState;
        const customer = state.data.customers.find(c => c.id === args.customerId);
        if (!customer) {
            return rejectWithValue('Retailer not found');
        }

        const phone = args.phone?.trim() || '';
        if (phone && phone !== (customer.phone || '').trim()) {
            // Empty optionals are dropped rather than forwarded: a customer
            // fetched from the API can carry a null email or ID-proof type, and
            // the update endpoint validates those as an email and an enum — so
            // passing them straight back would fail a write that only ever
            // intends to change the phone. The rest of the record is still sent
            // whole, which guest mode needs: its branch replaces the stored
            // customer with whatever it is handed.
            const cleaned = Object.fromEntries(
                Object.entries({ ...customer, phone }).filter(
                    ([, value]) => value !== null && value !== undefined && value !== '',
                ),
            ) as unknown as Customer;

            const action = await dispatch(updateCustomer(cleaned));
            if (!updateCustomer.fulfilled.match(action)) {
                return rejectWithValue(
                    String((action as any).payload || 'Failed to save the phone number'),
                );
            }
        }

        let photoFailed = false;
        if (args.photo) {
            const action = await dispatch(
                uploadCustomerPhoto({ customerId: args.customerId, photo: args.photo }),
            );
            if (!uploadCustomerPhoto.fulfilled.match(action)) photoFailed = true;
        }

        return { photoFailed };
    }
);

export const deleteInvoice = createAsyncThunk(
    'data/deleteInvoice',
    async (invoiceId: string, { getState, rejectWithValue }) => {
        const state = getState() as RootState;
        const { isGuest } = state.auth;

        if (isGuest) {
            const currentData = await AsyncStorage.getItem(ORDERS_KEY);
            const orders = currentData ? JSON.parse(currentData) : [];
            const updated = orders.filter((o: any) => o.id !== invoiceId);
            await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
            return updated;
        } else {
            try {
                await apiClient.delete(`/api/invoice/${invoiceId}`);
                Analytics.track('INVOICE_DELETED');
                const current = (getState() as RootState).data.orders;
                return current.filter(o => o.id !== invoiceId);
            } catch (err: any) {
                return rejectWithValue(err.message || 'Failed to delete invoice');
            }
        }
    }
);

// ─── Soft-delete helpers ──────────────────────────────────────────────────────

const getDeletedMap = async (): Promise<Record<string, string>> => {
    const raw = await AsyncStorage.getItem(DELETED_ORDERS_KEY);
    return raw ? JSON.parse(raw) : {};
};

const saveDeletedMap = (map: Record<string, string>) =>
    AsyncStorage.setItem(DELETED_ORDERS_KEY, JSON.stringify(map));

export const loadDeletedOrderIds = createAsyncThunk(
    'data/loadDeletedOrderIds',
    async () => {
        const map = await getDeletedMap();
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const valid: Record<string, string> = {};
        Object.entries(map).forEach(([id, deletedAt]) => {
            if (new Date(deletedAt).getTime() > cutoff) valid[id] = deletedAt;
        });
        await saveDeletedMap(valid);
        return valid;
    }
);

export const softDeleteOrder = createAsyncThunk(
    'data/softDeleteOrder',
    async ({ id, type }: { id: string; type: 'full' | 'advance' }, { getState }) => {
        const { isGuest } = (getState() as any).auth;
        if (!isGuest) {
            const endpoint = type === 'full' ? `/api/invoice/${id}/trash` : `/api/orders/${id}/trash`;
            await apiClient.patch(endpoint);
        }
        const deletedAt = new Date().toISOString();
        const map = await getDeletedMap();
        map[id] = deletedAt;
        await saveDeletedMap(map);
        return { id, deletedAt, map };
    }
);

export const restoreOrder = createAsyncThunk(
    'data/restoreOrder',
    async ({ id, type }: { id: string; type: 'full' | 'advance' }, { getState }) => {
        const { isGuest } = (getState() as any).auth;
        if (!isGuest) {
            const endpoint = type === 'full' ? `/api/invoice/${id}/restore` : `/api/orders/${id}/restore`;
            await apiClient.patch(endpoint);
        }
        const map = await getDeletedMap();
        delete map[id];
        await saveDeletedMap(map);
        return { id, map };
    }
);

export const fetchTrashedOrders = createAsyncThunk(
    'data/fetchTrashedOrders',
    async (_, { getState }) => {
        const { isGuest } = (getState() as any).auth;
        if (isGuest) return [];
        const [invRes, ordRes] = await Promise.all([
            apiClient.get<any>('/api/invoice/trash').catch(() => ({ data: { data: [] } })),
            apiClient.get<any>('/api/orders/trash').catch(() => ({ data: { data: [] } })),
        ]);
        const invoiceList = invRes.data?.data ?? invRes.data ?? [];
        const ordersList = ordRes.data?.data ?? ordRes.data ?? [];
        const invoices = (Array.isArray(invoiceList) ? invoiceList : []).map((raw: any) => ({
            ...mapBackendInvoice(raw),
            deletedAt: raw.deletedAt || null,
        }));
        const orders = (Array.isArray(ordersList) ? ordersList : []).map((raw: any) => ({
            ...mapBackendOrder(raw),
            deletedAt: raw.deletedAt || null,
        }));
        return [...invoices, ...orders];
    }
);

export const purgeExpiredDeleted = createAsyncThunk(
    'data/purgeExpiredDeleted',
    async (_, { getState }) => {
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const map = await getDeletedMap();
        const expired = Object.entries(map).filter(([, d]) => new Date(d).getTime() <= cutoff);
        const valid: Record<string, string> = {};
        Object.entries(map).forEach(([id, d]) => {
            if (new Date(d).getTime() > cutoff) valid[id] = d;
        });
        const { isGuest } = (getState() as any).auth;
        if (!isGuest && expired.length > 0) {
            const orders = (getState() as any).data.orders as Order[];
            await Promise.allSettled(expired.map(([id]) => {
                const order = orders.find(o => o.id === id);
                if (!order) return Promise.resolve();
                const url = order.type === 'full' ? `/api/invoice/${id}` : `/api/orders/${id}`;
                return apiClient.delete(url);
            }));
        }
        await saveDeletedMap(valid);
        return valid;
    }
);

export const permanentDeleteAdvanceOrder = createAsyncThunk(
    'data/permanentDeleteAdvanceOrder',
    async (id: string, { getState }) => {
        const { isGuest } = (getState() as any).auth;
        if (isGuest) {
            const raw = await AsyncStorage.getItem(ORDERS_KEY);
            const orders = raw ? JSON.parse(raw) : [];
            const updated = orders.filter((o: any) => o.id !== id);
            await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
        } else {
            await apiClient.delete(`/api/orders/${id}`);
        }
        const map = await getDeletedMap();
        delete map[id];
        await saveDeletedMap(map);
        return { id, map };
    }
);

export const fetchOrders = createAsyncThunk(
    'data/fetchOrders',
    async (args: FetchArgs | undefined, { getState, rejectWithValue }) => {
        const state = getState() as RootState;
        const { isGuest } = state.auth;

        if (isGuest) {
            const data = await AsyncStorage.getItem(ORDERS_KEY);
            return data ? JSON.parse(data) : [];
        } else {
            try {
                // Fetch both full invoices and advance orders
                const [invoiceResponse, ordersResponse] = await Promise.all([
                    apiClient.get<any>('/api/invoice').catch(() => ({ data: { data: [] } })),
                    apiClient.get<any>('/api/orders').catch(() => ({ data: { data: [] } }))
                ]);

                // Handle { success: true, data: [...] } for invoices
                const invoiceResult = invoiceResponse.data;
                const invoiceList = invoiceResult && typeof invoiceResult === 'object' && 'data' in invoiceResult ? invoiceResult.data : invoiceResult;
                const invoices = Array.isArray(invoiceList) ? invoiceList : [];

                // Handle { success: true, data: [...] } for orders
                const ordersResult = ordersResponse.data;
                const ordersList = ordersResult && typeof ordersResult === 'object' && 'data' in ordersResult ? ordersResult.data : ordersResult;
                const ordersData = Array.isArray(ordersList) ? ordersList : [];

                const mappedInvoices = invoices.map(mapBackendInvoice);
                const mappedOrders = ordersData.map(mapBackendOrder);

                // Deduplicate: If an invoice is a completion of an advance order, 
                // we keep the order as the primary record for that transaction in the 'Orders' list
                // to preserve the payment history view, and filter out the technical invoice record.
                const completionInvoiceIds = new Set(
                    mappedOrders
                        .filter(o => o.status === 'completed' && o.finalInvoiceId)
                        .map(o => o.finalInvoiceId.toString())
                );

                const filteredInvoices = mappedInvoices.filter(inv => !completionInvoiceIds.has(inv.id.toString()));

                const combined = [...filteredInvoices, ...mappedOrders];
                combined.sort((a, b) => {
                    const dateA = new Date(a.createdAt || a.date || 0).getTime();
                    const dateB = new Date(b.createdAt || b.date || 0).getTime();
                    return dateB - dateA;
                });

                return combined;
            } catch (err: any) {
                return rejectWithValue(err.message || 'Failed to fetch orders');
            }
        }
    },
    {
        condition: (arg, { getState }) => {
            const state = getState() as RootState;
            return shouldFetch(
                state.data.lastFetched.orders,
                arg,
                STALE_TIMES_MS.orders,
            );
        },
    }
);

export const fetchSalesReport = createAsyncThunk(
    'data/fetchSalesReport',
    async (arg: SalesReportArgs, { getState, rejectWithValue }) => {
        const { range } = normalizeSalesReportArgs(arg);
        const state = getState() as RootState;
        const { isGuest } = state.auth;

        if (isGuest) {
            return null;
        } else {
            try {
                const response = await apiClient.get<any>(`/api/sales?range=${range.toLowerCase()}`);
                const result = response.data;
                return result && typeof result === 'object' && 'data' in result ? result.data : result;
            } catch (err: any) {
                return rejectWithValue(err.message || 'Failed to fetch sales report');
            }
        }
    },
    {
        condition: (arg, { getState }) => {
            const { range, force, staleTimeMs } = normalizeSalesReportArgs(arg);
            const state = getState() as RootState;
            if (force) return true;
            const key = String(range || '').toLowerCase();
            const last = state.data.lastFetched.salesReport[key] ?? null;
            return shouldFetch(last, { staleTimeMs }, STALE_TIMES_MS.salesReport);
        },
    }
);

export const addOrder = createAsyncThunk(
    'data/addOrder',
    async (order: any, { getState, rejectWithValue }) => {
        const state = getState() as RootState;
        const { isGuest } = state.auth;

        if (isGuest) {
            const currentData = await AsyncStorage.getItem(ORDERS_KEY);
            const orders = currentData ? JSON.parse(currentData) : [];
            const newOrder: any = { ...order, id: Date.now().toString() };
            // Mirror the backend's GST snapshot/split for guest invoices so
            // the badge, filter and local GST report work offline.
            if (order.type === 'full') {
                const shopGstin = state.data.shopDetails?.gst || undefined;
                const rawGstin = String(order.customerGstin || '').trim().toUpperCase();
                const customerGstin = /^[0-9]{2}[A-Z0-9]{13}$/.test(rawGstin)
                    ? rawGstin
                    : undefined;
                const gstAmount = parseFloat(order.gst || order.gstAmount) || 0;
                const includeGST = order.includeGst ?? order.includeGST ?? false;
                const split = includeGST
                    ? splitGstAmount(gstAmount, shopGstin, customerGstin)
                    : { cgstAmount: 0, sgstAmount: 0, igstAmount: 0, supplyType: 'intra' as const, placeOfSupply: undefined };
                Object.assign(newOrder, {
                    includeGST,
                    gstAmount,
                    subTotal: parseFloat(order.subtotal || order.subTotal) || 0,
                    gstRate: order.gstRate ?? state.data.shopDetails?.gstPercentage ?? 3,
                    cgstAmount: split.cgstAmount,
                    sgstAmount: split.sgstAmount,
                    igstAmount: split.igstAmount,
                    supplyType: split.supplyType,
                    placeOfSupply: split.placeOfSupply,
                    shopGstin,
                    customerGstin,
                    paymentMethod: order.paymentMethod || 'cash',
                    onlinePaymentType: order.paymentMethod === 'online' ? order.onlinePaymentType : undefined,
                });
            }
            const updatedOrders = [newOrder, ...orders];
            await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(updatedOrders));
            return updatedOrders;
        } else {
            try {
                const currentData = (getState() as RootState).data.orders;

                // ── ADVANCE ORDER → POST /api/orders ──────────────────────────────
                if (order.type === 'advance') {
                    // Map items to what the Order backend expects
                    const orderItems = mapAdvanceOrderItemsForApi(order);

                    const advanceMappedExchanges = mapOrnamentExchangesForApi(order);

                    const advancePayload = {
                        customerId: order.customerId,
                        orderDate: order.date || new Date().toISOString(),
                        paymentMode: 'advance' as const,
                        items: orderItems,
                        bookingRate: order.initialPayment?.goldRate ?? 0,
                        includeGST: order.includeGST ?? true,
                        isOrnamentExchanges: order.isOrnamentExchanges || false,
                        ornamentExchanges: advanceMappedExchanges,
                        // Photos go up separately once the order has an id.
                        includeItemPhotosOnBill: !!order.includeItemPhotosOnBill,
                        ...(typeof order.gstRate === 'number' ? { gstRate: order.gstRate } : {}),
                        initialPayment: {
                            amount: order.initialPayment?.amount ?? order.amount ?? 0,
                            goldRate: order.initialPayment?.goldRate ?? 0,
                            notes: order.initialPayment?.notes || 'Initial advance payment',
                        },
                    };

                    console.log('[addOrder] Advance order payload for /api/orders:', JSON.stringify(advancePayload, null, 2));

                    const response = await apiClient.post<any>('/api/orders', advancePayload, {
                        headers: { 'Content-Type': 'application/json' },
                    });

                    const raw = response.data?.data ?? response.data;

                    const newOrder: Order = {
                        id: raw._id || raw.id || Date.now().toString(),
                        customerId: order.customerId,
                        type: 'advance',
                        amount: raw.amount ?? advancePayload.initialPayment.amount,
                        date: order.date || new Date().toISOString(),
                        status: 'pending',
                        items: order.items,
                        payments: raw.payments || [],
                        totalWeight: raw.totalWeight,
                        weightPaid: raw.weightPaid,
                        remainingWeight: raw.remainingWeight,
                        estimatedBalance: raw.estimatedBalance,
                        subTotal: raw.subTotal,
                        gstAmount: raw.gstAmount,
                        includeGST: raw.includeGST,
                        gstRate: raw.gstRate,
                        isOrnamentExchanges: raw.isOrnamentExchanges,
                        exchanges: mapOrnamentExchangesFromApi(raw.ornamentExchanges),
                        bookingRate: raw.bookingRate,
                        orderNumber: raw.orderNumber,
                        invoiceNumber: raw.orderNumber,
                        createdAt: raw.createdAt,
                    };

                    Analytics.track('ADVANCE_ORDER_CREATED');
                    AppReview.recordMilestone();
                    return [newOrder, ...currentData];
                }

                // ── FULL / INVOICE ORDER → POST /api/invoice ──────────────────────
                const itemsList = mapInvoiceItemsForApi(order);
                const mappedExchanges = mapOrnamentExchangesForApi(order);
                const validCustomerGstin = mapValidCustomerGstin(order);

                const invoicePayload = {
                    customerId: order.customerId,
                    invoiceNumber: order.invoiceNumber, // Let backend generate if empty
                    invoiceDate: order.date?.split('T')[0] || new Date().toISOString().split('T')[0],
                    items: itemsList,
                    totalAmount: toApiNumber(order.grandTotal, order.amount),
                    subTotal: toApiNumber(order.subtotal, order.subTotal),
                    gstAmount: toApiNumber(order.gst, order.gstAmount),
                    includeGST: order.includeGst || order.includeGST || false,
                    ...(typeof order.gstRate === 'number' ? { gstRate: order.gstRate } : {}),
                    ...(validCustomerGstin ? { customerGstin: validCustomerGstin } : {}),
                    isOrnamentExchanges: order.enableExchange || order.isOrnamentExchanges || false,
                    ornamentExchanges: mappedExchanges,
                    // The photos themselves go up separately once the invoice has
                    // an id; only the print preference travels with creation.
                    includeItemPhotosOnBill: !!order.includeItemPhotosOnBill,
                    paymentMethod: order.paymentMethod || 'cash',
                    ...(order.paymentMethod === 'online' && order.onlinePaymentType
                        ? { onlinePaymentType: order.onlinePaymentType }
                        : {}),
                };

                console.log('[addOrder] FINAL Invoice payload for /api/invoice:', JSON.stringify(invoicePayload, null, 2));

                const response = await apiClient.post<any>('/api/invoice', invoicePayload, {
                    headers: { 'Content-Type': 'application/json' },
                });

                const raw = response.data?.data ?? response.data;

                const newOrder: Order = {
                    id: raw._id || raw.id || Date.now().toString(),
                    customerId: order.customerId,
                    type: order.type,
                    amount: raw.totalAmount || raw.amount || order.amount,
                    date: order.date,
                    status: order.status,
                    items: raw.items || raw.products || order.items,
                    isOrnamentExchanges: raw.isOrnamentExchanges || order.isOrnamentExchanges,
                    invoiceNumber: raw.invoiceNumber,
                    createdAt: raw.createdAt,
                    subTotal: raw.subTotal,
                    gstAmount: raw.gstAmount,
                    includeGST: raw.includeGST,
                    gstRate: raw.gstRate,
                    cgstAmount: raw.cgstAmount,
                    sgstAmount: raw.sgstAmount,
                    igstAmount: raw.igstAmount,
                    shopGstin: raw.shopGstin,
                    customerGstin: raw.customerGstin,
                    supplyType: raw.supplyType,
                    placeOfSupply: raw.placeOfSupply,
                    exchanges: mapOrnamentExchangesFromApi(raw.ornamentExchanges),
                    paymentMethod: raw.paymentMethod,
                    onlinePaymentType: raw.onlinePaymentType,
                };

                Analytics.track('INVOICE_CREATED', { include_gst: order.includeGst || order.includeGST });
                AppReview.recordMilestone();
                return [newOrder, ...currentData];
            } catch (err: any) {
                return rejectWithValue(err.message || 'Failed to add order');
            }
        }
    }
);

// Edits an existing full invoice's items/GST — reuses the exact same
// item/GSTIN mapping as create (addOrder) so the two paths can't drift.
// Scope is intentionally items/quantities/rates/making-charges/GST only —
// the backend's own PUT /api/invoice/:id silently ignores customerId, so
// reassigning the customer isn't supported here either.
export const updateInvoiceOrder = createAsyncThunk(
    'data/updateInvoiceOrder',
    async ({ invoiceId, order }: { invoiceId: string; order: any }, { getState, rejectWithValue }) => {
        const state = getState() as RootState;
        const { isGuest } = state.auth;

        if (isGuest) {
            const currentData = await AsyncStorage.getItem(ORDERS_KEY);
            const orders = currentData ? JSON.parse(currentData) : [];
            const index = orders.findIndex((o: any) => o.id === invoiceId);
            if (index === -1) return rejectWithValue('Invoice not found');

            const shopGstin = state.data.shopDetails?.gst || undefined;
            const validCustomerGstin = mapValidCustomerGstin(order);
            const gstAmount = parseFloat(order.gst || order.gstAmount) || 0;
            const includeGST = order.includeGst ?? order.includeGST ?? false;
            const split = includeGST
                ? splitGstAmount(gstAmount, shopGstin, validCustomerGstin)
                : { cgstAmount: 0, sgstAmount: 0, igstAmount: 0, supplyType: 'intra' as const, placeOfSupply: undefined };

            orders[index] = {
                ...orders[index],
                items: order.items,
                isOrnamentExchanges: order.enableExchange || order.isOrnamentExchanges || false,
                includeGST,
                gstAmount,
                subTotal: parseFloat(order.subtotal || order.subTotal) || 0,
                gstRate: order.gstRate ?? state.data.shopDetails?.gstPercentage ?? 3,
                cgstAmount: split.cgstAmount,
                sgstAmount: split.sgstAmount,
                igstAmount: split.igstAmount,
                supplyType: split.supplyType,
                placeOfSupply: split.placeOfSupply,
                shopGstin,
                customerGstin: validCustomerGstin,
                ...(order.paymentMethod ? { paymentMethod: order.paymentMethod } : {}),
                ...(order.paymentMethod === 'online' ? { onlinePaymentType: order.onlinePaymentType } : {}),
            };
            await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
            return orders;
        }

        try {
            const itemsList = mapInvoiceItemsForApi(order);
            const mappedExchanges = mapOrnamentExchangesForApi(order);
            const validCustomerGstin = mapValidCustomerGstin(order);

            const invoicePayload = {
                items: itemsList,
                gstAmount: toApiNumber(order.gst, order.gstAmount),
                includeGST: order.includeGst || order.includeGST || false,
                ...(typeof order.gstRate === 'number' ? { gstRate: order.gstRate } : {}),
                ...(validCustomerGstin ? { customerGstin: validCustomerGstin } : {}),
                isOrnamentExchanges: order.enableExchange || order.isOrnamentExchanges || false,
                ornamentExchanges: mappedExchanges,
                // Only sent when the form actually carried a value — the server
                // leaves the stored preference alone on `undefined`, so an edit
                // from a screen that does not surface the toggle cannot silently
                // turn printing off.
                ...(order.includeItemPhotosOnBill !== undefined
                    ? { includeItemPhotosOnBill: !!order.includeItemPhotosOnBill }
                    : {}),
                ...(order.paymentMethod ? { paymentMethod: order.paymentMethod } : {}),
                ...(order.paymentMethod === 'online' && order.onlinePaymentType
                    ? { onlinePaymentType: order.onlinePaymentType }
                    : {}),
            };

            const response = await apiClient.put<any>(`/api/invoice/${invoiceId}`, invoicePayload, {
                headers: { 'Content-Type': 'application/json' },
            });
            const raw = response.data?.data ?? response.data;

            Analytics.track('INVOICE_UPDATED');
            return mapBackendInvoice(raw);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to update invoice');
        }
    }
);

// Edits an existing advance order's items — the backend's PATCH
// /api/orders/:id only accepts items/status (no customer/payment-mode),
// which matches the decided scope of this feature exactly.
export const updateAdvanceOrderItems = createAsyncThunk(
    'data/updateAdvanceOrderItems',
    async ({ orderId, order }: { orderId: string; order: any }, { getState, rejectWithValue }) => {
        const state = getState() as RootState;
        const { isGuest } = state.auth;

        if (isGuest) {
            return rejectWithValue('Guest mode does not support editing advance orders.');
        }

        try {
            const orderItems = mapAdvanceOrderItemsForApi(order);
            const response = await apiClient.patch<any>(`/api/orders/${orderId}`, { items: orderItems });
            const raw = response.data?.data ?? response.data;

            Analytics.track('ADVANCE_ORDER_UPDATED');
            return mapBackendOrder(raw);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to update order');
        }
    }
);

export const addPaymentToAdvanceOrder = createAsyncThunk(
    'data/addPaymentToAdvanceOrder',
    async (payload: { orderId: string, amount: number, goldRate: number, notes?: string, date?: string, purity?: string, weightCovered?: number }, { getState, rejectWithValue }) => {
        const state = getState() as RootState;
        const { isGuest } = state.auth;

        if (isGuest) {
            return rejectWithValue('Guest mode does not support payments on advance orders.');
        } else {
            try {
                console.log('[dataSlice] addPaymentToAdvanceOrder payload:', JSON.stringify(payload, null, 2));
                const response = await apiClient.post<any>(`/api/orders/${payload.orderId}/payments`, {
                    amount: payload.amount,
                    goldRate: payload.goldRate,
                    notes: payload.notes || 'Additional Payment',
                    date: payload.date || new Date().toISOString(),
                    purity: payload.purity,
                    weightCovered: payload.weightCovered
                });
                return response.data?.data || response.data;
            } catch (err: any) {
                return rejectWithValue(err.message || 'Failed to add payment');
            }
        }
    }
);

export const updateOrderStatus = createAsyncThunk(
    'data/updateOrderStatus',
    async ({ orderId, status }: { orderId: string, status: 'completed' | 'cancelled' | 'pending' }, { getState, rejectWithValue }) => {
        const state = getState() as RootState;
        const { isGuest } = state.auth;

        if (isGuest) {
            return rejectWithValue('Guest mode does not support order status updates.');
        } else {
            try {
                const response = await apiClient.patch<any>(`/api/orders/${orderId}`, {
                    status
                });
                return response.data?.data || response.data;
            } catch (err: any) {
                return rejectWithValue(err.message || 'Failed to update order status');
            }
        }
    }
);

export const updatePaymentInAdvanceOrder = createAsyncThunk(
    'data/updatePaymentInAdvanceOrder',
    async (payload: { orderId: string, paymentId: string, amount: number, goldRate: number, notes?: string, date?: string, purity?: string, weightCovered?: number }, { getState, rejectWithValue }) => {
        const state = getState() as RootState;
        const { isGuest } = state.auth;

        if (isGuest) {
            return rejectWithValue('Guest mode does not support payments on advance orders.');
        } else {
            try {
                const response = await apiClient.put<any>(`/api/orders/${payload.orderId}/payments/${payload.paymentId}`, {
                    amount: payload.amount,
                    goldRate: payload.goldRate,
                    notes: payload.notes,
                    date: payload.date,
                    purity: payload.purity,
                    weightCovered: payload.weightCovered
                });
                return response.data?.data || response.data;
            } catch (err: any) {
                return rejectWithValue(err.message || 'Failed to update payment');
            }
        }
    }
);

export const deletePaymentFromAdvanceOrder = createAsyncThunk(
    'data/deletePaymentFromAdvanceOrder',
    async (payload: { orderId: string, paymentId: string }, { getState, rejectWithValue }) => {
        const state = getState() as RootState;
        const { isGuest } = state.auth;

        if (isGuest) {
            return rejectWithValue('Guest mode does not support payments on advance orders.');
        } else {
            try {
                const response = await apiClient.delete<any>(`/api/orders/${payload.orderId}/payments/${payload.paymentId}`);
                return response.data?.data || response.data;
            } catch (err: any) {
                return rejectWithValue(err.message || 'Failed to delete payment');
            }
        }
    }
);

export const completeAdvanceOrderUnified = createAsyncThunk(
    'data/completeAdvanceOrderUnified',
    async (payload: {
        orderId: string,
        payment?: { amount: number, goldRate: number, notes?: string, date?: string },
        invoice: any,
        dukandarId?: string
    }, { rejectWithValue }) => {
        try {
            const response = await apiClient.post<any>('/api/orders/complete-advance-order', payload);
            return response.data?.data || response.data;
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to complete order');
        }
    }
);

export const fetchShopDetails = createAsyncThunk(
    'data/fetchShopDetails',
    async (args: FetchArgs | undefined, { getState, rejectWithValue }) => {
        const state = getState() as RootState;
        const { isGuest } = state.auth;

        if (isGuest) {
            const data = await AsyncStorage.getItem(SHOP_DETAILS_KEY);
            return data ? JSON.parse(data) : null;
        } else {
            try {
                const response = await apiClient.get<any>('/api/shopDetails');
                const result = response.data;
                const shop = result && typeof result === 'object' && 'data' in result ? result.data : result;
                if (!shop || Array.isArray(shop)) return null;
                return {
                    ...shop,
                    id: String(shop._id || shop.id),
                    name: String(shop.name || ""),
                    shopName: String(shop.shopName || shop.name || ""),
                    ownerName: String(shop.ownerName || ""),
                    // Backend field: shopDescription.
                    //
                    // This read `shop.shopDesc`, which the API has never
                    // returned, so the description mapped to "" on every fetch.
                    // The write side was correct all along — it maps
                    // shopDesc -> shopDescription in both the multipart and
                    // JSON paths — so the text reached the database and was
                    // simply never read back. A shopkeeper saw "Saved
                    // successfully", returned to the screen to find the field
                    // empty, and reasonably concluded it had not saved.
                    //
                    // It is also why the description never appeared on a
                    // printed bill: the templates read shop.shopDesc off this
                    // mapped object, and it was always empty.
                    //
                    // Every other renamed field here already carries its
                    // backend name first — gstNo before gst, shopLogo before
                    // logo. This one was the exception.
                    shopDesc: String(shop.shopDescription || shop.shopDesc || ""),
                    phone: String(shop.phone || ""),
                    email: String(shop.email || ""),
                    address: typeof shop.address === 'object' ? String(shop.address?.line1 || "") : String(shop.address || ""),
                    addr2: String(shop.address?.line2 || ''),
                    city: String(shop.city || shop.address?.city || ''),
                    state: String(shop.state || shop.address?.state || ''),
                    zipcode: String(shop.zipcode || shop.address?.zipcode || ''),
                    // Backend field: gstNo
                    gst: String(shop.gstNo || shop.gst || ''),
                    // Backend field: shopLogo (not logoUrl)
                    logo: shop.shopLogo || shop.logo || shop.logoUrl || null,
                    shopHeader: shop.shopHeader || shop.header || shop.headerUrl || null,
                    signature: shop.signature || shop.signatureUrl || null,
                };
            } catch (err: any) {
                return rejectWithValue(err.message || 'Failed to fetch shop details');
            }
        }
    },
    {
        condition: (arg, { getState }) => {
            const state = getState() as RootState;
            return shouldFetch(
                state.data.lastFetched.shopDetails,
                arg,
                STALE_TIMES_MS.shopDetails,
            );
        },
    }
);

export const updateShopDetails = createAsyncThunk(
    'data/updateShopDetails',
    async (details: ShopDetails, { getState, rejectWithValue }) => {
        const state = getState() as RootState;
        const { isGuest, token } = state.auth;

        if (isGuest) {
            await AsyncStorage.setItem(SHOP_DETAILS_KEY, JSON.stringify(details));
            return details;
        } else {
            try {
                // A freshly-picked image is an object with a `.uri` (from
                // react-native-image-picker). Do NOT gate on the `file://`
                // scheme — the OS/picker can return `content://`, `ph://`, or
                // `asset-library://` URIs, which would otherwise fall into the
                // JSON branch and get silently dropped (never uploaded).
                const isPicked = (v: any) => !!(v && typeof v === 'object' && v.uri);
                const hasNewLogo = isPicked(details.logo);
                const hasNewHeader = isPicked(details.shopHeader);
                const hasNewSignature = isPicked(details.signature);
                const hasNewImage = hasNewLogo || hasNewHeader || hasNewSignature;

                // Build address object expected by backend
                const addr1 = (details as any).addr1 || details.address || '';
                const addr2 = (details as any).addr2 || '';
                const city = (details as any).city || '';
                const state = (details as any).state || '';
                const zipcode = parseInt(String((details as any).zipcode || '0'), 10) || 0;

                // Get base URL from apiClient config - strip trailing slash
                const baseConfig = apiClient.getConfig();
                const baseURL = baseConfig.baseURL.replace(/\/$/, '');
                const endpoint = details.id ? `/api/shopDetails/${details.id}` : '/api/shopDetails';
                const method = details.id ? 'PUT' : 'POST';
                const fullUrl = `${baseURL}${endpoint}`;

                let raw: any;

                if (hasNewImage) {
                    // IMPORTANT: ApiClient.js always JSON.stringifies body, which breaks FormData.
                    // We must use native fetch() for multipart uploads.
                    const formData = new FormData();

                    // Correct backend field names.
                    //
                    // The optional text fields are sent whenever the screen
                    // supplied them, empty string included, so that clearing
                    // one actually clears it. Guarding on truthiness meant an
                    // emptied field was simply left out of the request and the
                    // old value stayed in the database — the shopkeeper saw
                    // "Saved successfully" and the text they had just deleted
                    // still there when they came back.
                    //
                    // `undefined` still skips the field: that means the caller
                    // never touched it, which is not the same as clearing it.
                    const sendIfPresent = (key: string, value: any) => {
                        if (value !== undefined && value !== null) formData.append(key, String(value));
                    };

                    if (details.shopName || details.name) formData.append('shopName', String(details.shopName || details.name));
                    sendIfPresent('ownerName', details.ownerName);
                    sendIfPresent('shopDescription', details.shopDesc);
                    if (details.phone) formData.append('phone', String(parseInt(String(details.phone), 10)));
                    sendIfPresent('email', details.email);
                    sendIfPresent('gstNo', details.gst);
                    if (details.gstPercentage !== undefined) formData.append('gstPercentage', String(details.gstPercentage));
                    if (details.id) formData.append('id', String(details.id));
                    // Address — Multer/Busboy does NOT unflatten `address[line1]`
                    // bracket keys into a nested object, so send `address` as a
                    // JSON string (parseMulterPayload on the backend parses it)
                    // plus flat city/state/zipcode for any callers that read them.
                    if (addr1) {
                        formData.append('address', JSON.stringify({ line1: addr1, line2: addr2, city, state, zipcode }));
                    }
                    if (city) formData.append('city', city);
                    if (state) formData.append('state', state);
                    if (zipcode) formData.append('zipcode', String(zipcode));

                    // Logo — backend field is 'shopLogo', signature is 'signature'
                    if (hasNewLogo) {
                        await appendPickedImage(formData, 'shopLogo', details.logo, 'logo.jpg');
                    } else if (typeof details.logo === 'string' && details.logo.length > 0) {
                        formData.append('shopLogo', details.logo);
                    }

                    if (hasNewHeader) {
                        await appendPickedImage(formData, 'shopHeader', details.shopHeader, 'header.jpg');
                    } else if (typeof details.shopHeader === 'string' && details.shopHeader.length > 0) {
                        formData.append('shopHeader', details.shopHeader);
                    }

                    if (hasNewSignature) {
                        await appendPickedImage(formData, 'signature', details.signature, 'signature.jpg');
                    } else if (typeof details.signature === 'string' && details.signature.length > 0) {
                        formData.append('signature', details.signature);
                    }

                    // Removal flags — clear an existing image on the backend
                    if ((details as any).removeShopLogo) formData.append('removeShopLogo', 'true');
                    if ((details as any).removeShopHeader) formData.append('removeShopHeader', 'true');
                    if ((details as any).removeSignature) formData.append('removeSignature', 'true');

                    const headers: Record<string, string> = {};
                    if (token) headers['Authorization'] = `Bearer ${token}`;

                    console.log('[dataSlice] updateShopDetails multipart url:', fullUrl, 'method:', method);
                    const nativeResponse = await fetch(fullUrl, { method, headers, body: formData });
                    const text = await nativeResponse.text();
                    let json: any;
                    try {
                        json = JSON.parse(text);
                    } catch {
                        json = {
                            message: nativeResponse.status === 413
                                ? 'Image is too large. Please choose a smaller photo.'
                                : `Something went wrong (HTTP ${nativeResponse.status}). Please try again.`,
                        };
                    }
                    console.log('[dataSlice] updateShopDetails multipart response:', json);

                    if (!nativeResponse.ok) {
                        return rejectWithValue(json?.message || `HTTP ${nativeResponse.status}`);
                    }
                    raw = json?.data ?? json;
                } else {
                    // No new local images — use apiClient with JSON
                    const jsonPayload: Record<string, any> = {
                        shopName: details.shopName || details.name,
                        ownerName: details.ownerName || '',
                        shopDescription: details.shopDesc || '',
                        phone: parseInt(String(details.phone || '0'), 10),
                        email: details.email || '',
                        gstNo: details.gst || '',
                        gstPercentage: details.gstPercentage,
                        city,
                        state,
                        zipcode,
                    };

                    // The nested object is the only place these are stored:
                    // city, state and zipcode exist on the backend's address
                    // sub-schema and nowhere else, so the flat copies sent
                    // alongside are discarded by Mongoose's strict mode. Sent
                    // whenever ANY part is filled rather than only when line 1
                    // is, because gating on line 1 silently dropped the city,
                    // state and pincode of a shop that had not entered a
                    // street address.
                    if (addr1 || addr2 || city || state || zipcode) {
                        jsonPayload.address = { line1: addr1, line2: addr2, city, state, zipcode };
                    }

                    if (typeof details.logo === 'string' && details.logo.length > 0) jsonPayload.shopLogo = details.logo;
                    if (typeof details.shopHeader === 'string' && details.shopHeader.length > 0) jsonPayload.shopHeader = details.shopHeader;
                    if (typeof details.signature === 'string' && details.signature.length > 0) jsonPayload.signature = details.signature;

                    // Removal flags — clear an existing image on the backend
                    if ((details as any).removeShopLogo) jsonPayload.removeShopLogo = true;
                    if ((details as any).removeShopHeader) jsonPayload.removeShopHeader = true;
                    if ((details as any).removeSignature) jsonPayload.removeSignature = true;

                    console.log('[dataSlice] updateShopDetails JSON payload:', JSON.stringify(jsonPayload, null, 2));

                    const response = method === 'PUT'
                        ? await apiClient.put<any>(endpoint, jsonPayload, { headers: { 'Content-Type': 'application/json' } })
                        : await apiClient.post<any>(endpoint, jsonPayload, { headers: { 'Content-Type': 'application/json' } });

                    console.log('[dataSlice] updateShopDetails response received:', JSON.stringify(response.data, null, 2));
                    raw = response.data?.data ?? response.data;
                }

                return {
                    ...raw,
                    id: String(raw._id || raw.id || details.id),
                    name: String(raw.name || details.name || ""),
                    shopName: String(raw.shopName || details.shopName || ""),
                    ownerName: String(raw.ownerName || details.ownerName || ""),
                    shopDesc: String(raw.shopDesc || details.shopDesc || ""),
                    phone: String(raw.phone || details.phone || ""),
                    email: String(raw.email || details.email || ""),
                    address: typeof raw.address === 'object' ? String(raw.address?.line1 || "") : String(raw.address || details.address || ""),
                    city: String(raw.city || raw.address?.city || (details as any).city || ''),
                    state: String(raw.state || raw.address?.state || (details as any).state || ''),
                    zipcode: String(raw.zipcode || raw.address?.zipcode || (details as any).zipcode || ''),
                    gst: String(raw.gstNo || details.gst || ''),
                    logo: raw.shopLogo || (hasNewImage ? undefined : details.logo) || null,
                    shopHeader: raw.shopHeader || (hasNewImage ? undefined : details.shopHeader) || null,
                    signature: raw.signature || raw.signatureUrl || (hasNewImage ? undefined : details.signature),
                };
            } catch (err: any) {
                return rejectWithValue(err.message || 'Failed to update shop details');
            }
        }
    }
);


export const fetchMetalRates = createAsyncThunk(
    'data/fetchMetalRates',
    async (args: FetchArgs | undefined, { rejectWithValue }) => {
        try {
            const response = await apiClient.get<any>('/api/metal-rates');
            const result = response.data;
            return result && typeof result === 'object' && 'data' in result ? result.data : result;
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to fetch metal rates');
        }
    },
    {
        condition: (arg, { getState }) => {
            const state = getState() as RootState;
            return shouldFetch(
                state.data.lastFetched.metalRates,
                arg,
                STALE_TIMES_MS.metalRates,
            );
        },
    }
);

export const updateMetalRates = createAsyncThunk(
    'data/updateMetalRates',
    async (_rates: MetalRates, { rejectWithValue }) => {
        // Manual edit disabled — rates come from the external live API
        try {
            const response = await apiClient.get<any>('/api/metal-rates');
            const result = response.data;
            return result && typeof result === 'object' && 'data' in result ? result.data : result;
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to fetch metal rates');
        }
    }
);

// ─── Catalog Products ─────────────────────────────────────────────────────────
// Guests → AsyncStorage, Logged-in → /api/catalog (new standalone catalog model)

const mapProduct = (p: any): CatalogProduct => ({
    id: String(p._id || p.id || Date.now()),
    name: String(p.name || ''),
    category: String(p.category || 'Gold'),
    purity: p.purity,
    makingChargeType: p.makingChargeType,
    makingCharges: p.makingCharges,
    discountType: p.discountType,
    discount: p.discount,
    grossWt: p.grossWt,
    lessWt: p.lessWt,
    pcs: p.pcs,
    huid: p.huid,
    otherChargeDesc: p.otherChargeDesc,
    otherChargeAmount: p.otherChargeAmount,
    stockQty: typeof p.stockQty === 'number' ? p.stockQty : undefined,
});

export const fetchCatalogProducts = createAsyncThunk(
    'data/fetchCatalogProducts',
    async (args: FetchArgs | undefined, { getState, rejectWithValue }) => {
        const { isGuest } = (getState() as RootState).auth;
        if (isGuest) {
            const data = await AsyncStorage.getItem(CATALOG_PRODUCTS_KEY);
            return data ? JSON.parse(data) : [];
        }
        try {
            const response = await apiClient.get<any>('/api/products');
            const result = response.data;
            const list = result?.data ?? result;
            const arr = Array.isArray(list) ? list : [];
            console.log('[dataSlice] fetchCatalogProducts:', arr.length, 'items');
            return arr.map(mapProduct);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to fetch products');
        }
    },
    {
        condition: (arg, { getState }) => {
            const state = getState() as RootState;
            return shouldFetch(
                state.data.lastFetched.catalogProducts,
                arg,
                STALE_TIMES_MS.catalogProducts,
            );
        },
    }
);

export const addCatalogProduct = createAsyncThunk(
    'data/addCatalogProduct',
    async (product: Omit<CatalogProduct, 'id'>, { getState, rejectWithValue }) => {
        const { isGuest } = (getState() as RootState).auth;
        if (isGuest) {
            const current = await AsyncStorage.getItem(CATALOG_PRODUCTS_KEY);
            const products = current ? JSON.parse(current) : [];
            const newP: CatalogProduct = { ...product, id: Date.now().toString() };
            const updated = [newP, ...products];
            await AsyncStorage.setItem(CATALOG_PRODUCTS_KEY, JSON.stringify(updated));
            return updated;
        } else {
            try {
                const payload = {
                    name: product.name,
                    category: product.category || 'Gold',
                    purity: product.purity || "",
                    makingChargeType: product.makingChargeType || "Per Gram",
                    makingCharges: product.makingCharges ?? 0,
                    discountType: product.discountType || "Fixed",
                    discount: product.discount ?? 0,
                    grossWt: product.grossWt ?? 0,
                    lessWt: product.lessWt ?? 0,
                    pcs: product.pcs ?? 1,
                    huid: product.huid || "",
                    otherChargeDesc: product.otherChargeDesc || "",
                    otherChargeAmount: product.otherChargeAmount ?? 0,
                    ...(typeof product.stockQty === 'number' ? { stockQty: product.stockQty } : {}),
                };
                console.log('[dataSlice] addCatalogProduct payload:', payload);
                const response = await apiClient.post<any>('/api/products', payload, { headers: { 'Content-Type': 'application/json' } });
                console.log('[dataSlice] addCatalogProduct response:', response.data);
                const raw = response.data && typeof response.data === 'object' && 'data' in response.data
                    ? response.data.data : response.data;
                const newProduct: CatalogProduct = {
                    id: String(raw._id || raw.id || Date.now().toString()),
                    name: raw.name,
                    category: raw.productType || raw.category || product.category,
                    purity: raw.purity ?? product.purity,
                    makingChargeType: raw.makingChargeType ?? product.makingChargeType,
                    makingCharges: raw.makingCharges ?? product.makingCharges,
                    discountType: raw.discountType ?? product.discountType,
                    discount: raw.discount ?? product.discount,
                    grossWt: raw.grossWt ?? product.grossWt,
                    lessWt: raw.lessWt ?? product.lessWt,
                    pcs: raw.pcs ?? product.pcs,
                    huid: raw.huid ?? product.huid,
                    otherChargeDesc: raw.otherChargeDesc ?? product.otherChargeDesc,
                    otherChargeAmount: raw.otherChargeAmount ?? product.otherChargeAmount,
                    stockQty: typeof raw.stockQty === 'number' ? raw.stockQty : product.stockQty,
                };
                const current = (getState() as RootState).data.catalogProducts;
                return [newProduct, ...current];
            } catch (err: any) {
                return rejectWithValue(err.message || 'Failed to add product');
            }
        }
    }
);

export const deleteCatalogProduct = createAsyncThunk(
    'data/deleteCatalogProduct',
    async (id: string, { getState, rejectWithValue }) => {
        const { isGuest } = (getState() as RootState).auth;
        if (isGuest) {
            const current = await AsyncStorage.getItem(CATALOG_PRODUCTS_KEY);
            const products = current ? JSON.parse(current) : [];
            const updated = products.filter((p: any) => p.id !== id);
            await AsyncStorage.setItem(CATALOG_PRODUCTS_KEY, JSON.stringify(updated));
            return updated;
        }
        try {
            await apiClient.delete(`/api/products/${id}`);
            const current = (getState() as RootState).data.catalogProducts;
            return current.filter(p => p.id !== id);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to delete product');
        }
    }
);

export const updateCatalogProduct = createAsyncThunk(
    'data/updateCatalogProduct',
    async (product: CatalogProduct, { getState, rejectWithValue }) => {
        const { isGuest } = (getState() as RootState).auth;
        if (isGuest) {
            const current = await AsyncStorage.getItem(CATALOG_PRODUCTS_KEY);
            const products: CatalogProduct[] = current ? JSON.parse(current) : [];
            const updated = products.map((p) => p.id === product.id ? { ...p, ...product } : p);
            await AsyncStorage.setItem(CATALOG_PRODUCTS_KEY, JSON.stringify(updated));
            return updated;
        } else {
            try {
                const payload = {
                    name: product.name,
                    productType: product.category || 'Gold',
                    purity: product.purity,
                    makingChargeType: product.makingChargeType,
                    makingCharges: product.makingCharges,
                    discountType: product.discountType,
                    discount: product.discount,
                    grossWt: product.grossWt,
                    lessWt: product.lessWt,
                    pcs: product.pcs,
                    huid: product.huid,
                    otherChargeDesc: product.otherChargeDesc,
                    otherChargeAmount: product.otherChargeAmount,
                    ...(typeof product.stockQty === 'number' ? { stockQty: product.stockQty } : {}),
                };
                console.log('[dataSlice] updateCatalogProduct payload:', payload);
                const response = await apiClient.put<any>(`/api/products/${product.id}`, payload, { headers: { 'Content-Type': 'application/json' } });
                console.log('[dataSlice] updateCatalogProduct response:', response.data);
                const raw = response.data && typeof response.data === 'object' && 'data' in response.data
                    ? response.data.data : response.data;
                const current = (getState() as RootState).data.catalogProducts;
                return current.map(p => p.id === product.id ? {
                    ...product,
                    name: raw.name || product.name,
                    category: raw.productType || raw.category || product.category,
                    purity: raw.purity ?? product.purity,
                    makingChargeType: raw.makingChargeType ?? product.makingChargeType,
                    makingCharges: raw.makingCharges ?? product.makingCharges,
                    discountType: raw.discountType ?? product.discountType,
                    discount: raw.discount ?? product.discount,
                    grossWt: raw.grossWt ?? product.grossWt,
                    huid: raw.huid ?? product.huid,
                    stockQty: typeof raw.stockQty === 'number' ? raw.stockQty : product.stockQty,
                } : p);
            } catch (err: any) {
                return rejectWithValue(err.message || 'Failed to update product');
            }
        }
    }
);

// ─── Purchases (stock purchases for GST/ITC) ─────────────────────────────────
// Guests → AsyncStorage, Logged-in → /api/purchases

const mapPurchase = (p: any): Purchase => ({
    id: String(p._id || p.id || Date.now()),
    supplierName: String(p.supplierName || ''),
    supplierGstin: p.supplierGstin || undefined,
    purchaseInvoiceNumber: String(p.purchaseInvoiceNumber || ''),
    purchaseDate: p.purchaseDate,
    taxableValue: Number(p.taxableValue) || 0,
    gstRate: p.gstRate,
    gstAmount: Number(p.gstAmount) || 0,
    cgstAmount: p.cgstAmount,
    sgstAmount: p.sgstAmount,
    igstAmount: p.igstAmount,
    supplyType: p.supplyType,
    shopGstin: p.shopGstin,
    hsnCode: p.hsnCode,
    description: p.description,
    category: p.category,
    weightGrams: p.weightGrams,
    createdAt: p.createdAt,
});

export const fetchPurchases = createAsyncThunk(
    'data/fetchPurchases',
    async (args: FetchArgs | undefined, { getState, rejectWithValue }) => {
        const { isGuest } = (getState() as RootState).auth;
        if (isGuest) {
            const data = await AsyncStorage.getItem(PURCHASES_KEY);
            return data ? JSON.parse(data) : [];
        }
        try {
            const response = await apiClient.get<any>('/api/purchases');
            const result = response.data;
            const list = result?.data ?? result;
            const arr = Array.isArray(list) ? list : [];
            return arr.map(mapPurchase);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to fetch purchases');
        }
    },
    {
        condition: (arg, { getState }) => {
            const state = getState() as RootState;
            return shouldFetch(
                state.data.lastFetched.purchases,
                arg,
                STALE_TIMES_MS.purchases,
            );
        },
    }
);

export const addPurchase = createAsyncThunk(
    'data/addPurchase',
    async (purchase: Omit<Purchase, 'id'>, { getState, rejectWithValue }) => {
        const state = getState() as RootState;
        const { isGuest } = state.auth;
        if (isGuest) {
            // Mirror the backend: derive the CGST/SGST/IGST split locally
            const shopGstin = state.data.shopDetails?.gst || undefined;
            const split = splitGstAmount(
                purchase.gstAmount,
                shopGstin,
                purchase.supplierGstin,
            );
            const newPurchase: Purchase = {
                ...purchase,
                ...split,
                shopGstin,
                hsnCode: purchase.hsnCode || '7113',
                id: Date.now().toString(),
                createdAt: new Date().toISOString(),
            };
            const current = await AsyncStorage.getItem(PURCHASES_KEY);
            const purchases = current ? JSON.parse(current) : [];
            const updated = [newPurchase, ...purchases];
            await AsyncStorage.setItem(PURCHASES_KEY, JSON.stringify(updated));
            return updated;
        }
        try {
            const payload = {
                supplierName: purchase.supplierName,
                supplierGstin: purchase.supplierGstin || '',
                purchaseInvoiceNumber: purchase.purchaseInvoiceNumber,
                purchaseDate: purchase.purchaseDate,
                taxableValue: purchase.taxableValue,
                gstRate: purchase.gstRate,
                gstAmount: purchase.gstAmount,
                ...(purchase.hsnCode ? { hsnCode: purchase.hsnCode } : {}),
                ...(purchase.description ? { description: purchase.description } : {}),
                ...(purchase.category ? { category: purchase.category } : {}),
                ...(typeof purchase.weightGrams === 'number'
                    ? { weightGrams: purchase.weightGrams }
                    : {}),
            };
            const response = await apiClient.post<any>('/api/purchases', payload, {
                headers: { 'Content-Type': 'application/json' },
            });
            const raw = response.data && typeof response.data === 'object' && 'data' in response.data
                ? response.data.data : response.data;
            const current = (getState() as RootState).data.purchases;
            return [mapPurchase(raw), ...current];
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to add purchase');
        }
    }
);

export const updatePurchase = createAsyncThunk(
    'data/updatePurchase',
    async (purchase: Purchase, { getState, rejectWithValue }) => {
        const state = getState() as RootState;
        const { isGuest } = state.auth;
        if (isGuest) {
            const split = splitGstAmount(
                purchase.gstAmount,
                purchase.shopGstin || state.data.shopDetails?.gst || undefined,
                purchase.supplierGstin,
            );
            const merged = { ...purchase, ...split };
            const current = await AsyncStorage.getItem(PURCHASES_KEY);
            const purchases: Purchase[] = current ? JSON.parse(current) : [];
            const updated = purchases.map(p => (p.id === purchase.id ? { ...p, ...merged } : p));
            await AsyncStorage.setItem(PURCHASES_KEY, JSON.stringify(updated));
            return updated;
        }
        try {
            const payload = {
                supplierName: purchase.supplierName,
                supplierGstin: purchase.supplierGstin || '',
                purchaseInvoiceNumber: purchase.purchaseInvoiceNumber,
                purchaseDate: purchase.purchaseDate,
                taxableValue: purchase.taxableValue,
                gstRate: purchase.gstRate,
                gstAmount: purchase.gstAmount,
                ...(purchase.hsnCode ? { hsnCode: purchase.hsnCode } : {}),
                ...(purchase.description !== undefined ? { description: purchase.description } : {}),
                ...(purchase.category !== undefined ? { category: purchase.category } : {}),
                ...(typeof purchase.weightGrams === 'number'
                    ? { weightGrams: purchase.weightGrams }
                    : {}),
            };
            const response = await apiClient.put<any>(`/api/purchases/${purchase.id}`, payload, {
                headers: { 'Content-Type': 'application/json' },
            });
            const raw = response.data && typeof response.data === 'object' && 'data' in response.data
                ? response.data.data : response.data;
            const current = (getState() as RootState).data.purchases;
            return current.map(p => (p.id === purchase.id ? mapPurchase(raw) : p));
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to update purchase');
        }
    }
);

export const deletePurchase = createAsyncThunk(
    'data/deletePurchase',
    async (id: string, { getState, rejectWithValue }) => {
        const { isGuest } = (getState() as RootState).auth;
        if (isGuest) {
            const current = await AsyncStorage.getItem(PURCHASES_KEY);
            const purchases: Purchase[] = current ? JSON.parse(current) : [];
            const updated = purchases.filter(p => p.id !== id);
            await AsyncStorage.setItem(PURCHASES_KEY, JSON.stringify(updated));
            return updated;
        }
        try {
            await apiClient.delete(`/api/purchases/${id}`);
            const current = (getState() as RootState).data.purchases;
            return current.filter(p => p.id !== id);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to delete purchase');
        }
    }
);

// ─── Old-gold purchaseOldGold / affidavits ──────────────────────────────────────
// Deliberately absent from salesReport and gstReport: buying old gold from a
// customer is an outflow, not a sale, and folding it into either report would
// misstate both. These records exist only for the shop's own audit trail.

/** Drops blank rows and the client-only `id` before the list leaves the app. */
const mapIdProofsForApi = (form: DeclarationFormValues) =>
    (form.idProofs || [])
        .filter(e => e.number.trim())
        .map(e => ({
            // Sent so scans of this document can be addressed by it straight
            // after the save, exactly like an ornament's id. The API keeps the
            // id it is given (see reconcileIdProofs), which is what lets the
            // upload run without a second round trip.
            ...(e.id ? { id: e.id } : {}),
            type: e.type,
            number: e.number.trim(),
            ...(e.type === 'other' && e.otherLabel ? { otherLabel: e.otherLabel } : {}),
        }));

const mapPurchaseOldGold = (d: any): PurchaseOldGold => ({
    id: d.id || d._id,
    declarationNumber: d.declarationNumber,
    declarationDate: d.declarationDate,
    customerId: d.customerId?.id || d.customerId?._id || d.customerId,
    mode: d.mode,
    orderId: d.orderId?.id || d.orderId?._id || d.orderId,
    // Absent on declarations written before the language was recorded; call
    // sites fall back to the reader's own setting for those.
    language: d.language,
    customerSnapshot: d.customerSnapshot || { name: '', phone: '' },
    ownerIsSelf: d.ownerIsSelf ?? true,
    familyMemberName: d.familyMemberName,
    idProofType: d.idProofType,
    idProofNumber: d.idProofNumber,
    idProofOtherLabel: d.idProofOtherLabel,
    // Absent on records saved before multi-ID — those keep only the singular
    // fields, which the print template falls back to.
    idProofs: Array.isArray(d.idProofs) && d.idProofs.length ? d.idProofs : undefined,
    hasPurchaseReceipt: d.hasPurchaseReceipt,
    purchaseReceiptDetails: d.purchaseReceiptDetails,
    noReceiptReason: d.noReceiptReason,
    items: d.items || [],
    totalGrams: d.totalGrams ?? 0,
    totalAmount: d.totalAmount ?? 0,
    payout: d.payout || { method: 'cash' },
    photos: d.photos || [],
    witnesses: d.witnesses || [],
    // Absent on declarations signed on paper, and on every record written
    // before on-device signing existed — the template falls back to a blank
    // ruled line for those, exactly as before.
    // Absent on records written before the field, and those should keep
    // printing their photos - so the default lives at every read site.
    includePhotosOnDeclaration: d.includePhotosOnDeclaration !== false,
    customerSignature: d.customerSignature,
    customerSignedAt: d.customerSignedAt,
    createdAt: d.createdAt,
});

/** Strips the client-only form fields the API does not accept. */
const buildPurchaseOldGoldPayload = (form: DeclarationFormValues) => ({
    customerId: form.customerId,
    declarationDate: form.declarationDate,
    mode: form.mode,
    ...(form.orderId ? { orderId: form.orderId } : {}),
    language: form.language,
    ownerIsSelf: form.ownerIsSelf,
    familyMemberName: form.familyMemberName || '',
    // The array is the real record; the singular fields carry the first entry
    // so declarations saved before multi-ID, and any older client reading this
    // API, keep working unchanged.
    idProofs: mapIdProofsForApi(form),
    idProofType: form.idProofs?.[0]?.type || 'aadhaar',
    idProofNumber: form.idProofs?.[0]?.number || '',
    idProofOtherLabel: form.idProofs?.[0]?.otherLabel || '',
    ...(form.hasPurchaseReceipt === undefined
      ? {}
      : { hasPurchaseReceipt: form.hasPurchaseReceipt }),
    purchaseReceiptDetails: form.purchaseReceiptDetails || '',
    noReceiptReason: form.noReceiptReason || '',
    items: form.items.map(i => ({
        // Sent so ornament photos can be addressed by it straight after the
        // save. The API keeps the id it is given (see reconcileItems), which is
        // what lets the upload below run without a second round trip.
        ...(i.id ? { id: i.id } : {}),
        description: i.description,
        grams: Number(i.grams) || 0,
        ...(i.metalType ? { metalType: i.metalType } : {}),
        ...(i.purity ? { purity: i.purity } : {}),
        ...(i.ratePerGm ? { ratePerGm: Number(i.ratePerGm) || 0 } : {}),
        ...(i.amount ? { amount: Number(i.amount) || 0 } : {}),
    })),
    payout: {
        method: form.payout.method,
        ...(form.payout.onlineType ? { onlineType: form.payout.onlineType } : {}),
        reference: form.payout.reference || '',
        ...(form.payout.paidAt ? { paidAt: form.payout.paidAt } : {}),
        bankName: form.payout.bankName || '',
        bankAccountName: form.payout.bankAccountName || '',
        bankAccountNumber: form.payout.bankAccountNumber || '',
        bankIfsc: form.payout.bankIfsc || '',
        upiId: form.payout.upiId || '',
    },
    // Only sent when one was actually taken. Omitting the key rather than
    // sending '' matters on edit: the API treats an explicit empty string as
    // "clear the signature", which is what the Remove control relies on, so a
    // blanket '' would silently wipe a signature on any unrelated edit.
    includePhotosOnDeclaration: form.includePhotosOnDeclaration !== false,
    ...(form.customerSignature ? { customerSignature: form.customerSignature } : {}),
    // `pendingPhotos` are local picks uploaded separately after the save, and
    // the API never accepts `photos` from a client at all — so send neither.
    witnesses: (form.witnesses || [])
        .filter(w => w.name?.trim())
        .map(w => ({
            ...(w.id ? { id: w.id } : {}),
            name: w.name,
            phone: w.phone || '',
        })),
});

export const fetchPurchaseOldGold = createAsyncThunk(
    'data/fetchPurchaseOldGold',
    async (args: FetchArgs | undefined, { getState, rejectWithValue }) => {
        const { isGuest } = (getState() as RootState).auth;
        if (isGuest) {
            const data = await AsyncStorage.getItem(DECLARATIONS_KEY);
            return data ? JSON.parse(data) : [];
        }
        try {
            const response = await apiClient.get<any>('/api/purchase-old-gold');
            const result = response.data;
            const list = result?.data ?? result;
            return (Array.isArray(list) ? list : []).map(mapPurchaseOldGold);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to fetch purchaseOldGold');
        }
    },
    {
        condition: (arg, { getState }) => {
            const state = getState() as RootState;
            return shouldFetch(
                state.data.lastFetched.purchaseOldGold,
                arg,
                STALE_TIMES_MS.purchaseOldGold,
            );
        },
    }
);

export const addPurchaseOldGold = createAsyncThunk(
    'data/addPurchaseOldGold',
    async (form: DeclarationFormValues, { getState, rejectWithValue }) => {
        const state = getState() as RootState;
        const { isGuest } = state.auth;

        if (isGuest) {
            const totals = form.items.reduce(
                (acc, i) => ({
                    grams: acc.grams + (Number(i.grams) || 0),
                    amount: acc.amount + (Number(i.amount) || 0),
                }),
                { grams: 0, amount: 0 },
            );
            const current = await AsyncStorage.getItem(DECLARATIONS_KEY);
            const existing: PurchaseOldGold[] = current ? JSON.parse(current) : [];

            // Same rule the server applies, so a guest who signs up later does
            // not watch their numbering change shape. An exchange takes the
            // bill's number; a standalone purchase takes the next POG-n, and
            // counts only standalone ones so exchanges never consume a serial.
            //
            // Was `DEC-${existing.length + 1}` for both — a third scheme that
            // matched neither the server's POG-n nor anything printed on a bill.
            const linkedOrder = form.orderId
                ? state.data.orders.find((o: any) => o.id === form.orderId)
                : undefined;
            const declarationNumber =
                form.mode === 'exchange'
                    ? (linkedOrder as any)?.invoiceNumber ||
                      (linkedOrder as any)?.orderNumber ||
                      form.orderId ||
                      ''
                    : `POG-${existing.filter(d => d.mode !== 'exchange').length + 1}`;

            const created: PurchaseOldGold = {
                id: Date.now().toString(),
                declarationNumber,
                declarationDate: form.declarationDate,
                customerId: form.customerId,
                mode: form.mode,
                orderId: form.orderId,
                language: form.language,
                customerSnapshot: {
                    name: form.customerName,
                    phone: form.customerPhone,
                    address: form.customerAddress,
                    // Guest mode has no server to snapshot from, so read the
                    // photo off the local customer record.
                    photoUrl: state.data.customers.find(c => c.id === form.customerId)
                        ?.profilePhoto?.url,
                },
                ownerIsSelf: form.ownerIsSelf,
                familyMemberName: form.familyMemberName,
                idProofs: mapIdProofsForApi(form).map(e => ({
                    ...e,
                    // Same as the witness and ornament photos below — no
                    // backend to upload to, so the local picker uris stand in.
                    photos: (form.idProofs || [])
                        .find(src => src.id === e.id)
                        ?.pendingPhotos?.map(p => ({ url: p.uri, fileId: p.uri })),
                })),
                idProofType: form.idProofs?.[0]?.type || 'aadhaar',
                idProofNumber: form.idProofs?.[0]?.number || '',
                idProofOtherLabel: form.idProofs?.[0]?.otherLabel,
                hasPurchaseReceipt: form.hasPurchaseReceipt,
                purchaseReceiptDetails: form.purchaseReceiptDetails,
                noReceiptReason: form.noReceiptReason,
                items: form.items.map(i => ({
                    description: i.description,
                    grams: Number(i.grams) || 0,
                    metalType: i.metalType,
                    purity: i.purity,
                    ratePerGm: i.ratePerGm ? Number(i.ratePerGm) : undefined,
                    amount: i.amount ? Number(i.amount) : undefined,
                })),
                totalGrams: Number(totals.grams.toFixed(3)),
                totalAmount: Number(totals.amount.toFixed(3)),
                payout: form.payout,
                // Guest mode has no backend to upload to, so photos stay as the
                // local picker uris — enough to render the preview and the PDF.
                photos: form.pendingPhotos.map(p => ({ url: p.uri, fileId: p.uri })),
                witnesses: form.witnesses
                    .filter(w => w.name?.trim())
                    .map(w => ({
                        id: w.id,
                        name: w.name,
                        phone: w.phone,
                        // Same as the photos above — nothing to upload to, so
                        // the local picker uris stand in.
                        photos: (w.pendingPhotos || []).map(p => ({
                            url: p.uri,
                            fileId: p.uri,
                        })),
                    })),
                createdAt: new Date().toISOString(),
            };
            const updated = [created, ...existing];
            await AsyncStorage.setItem(DECLARATIONS_KEY, JSON.stringify(updated));
            return created;
        }

        try {
            const response = await apiClient.post<any>(
                '/api/purchase-old-gold',
                buildPurchaseOldGoldPayload(form),
                { headers: { 'Content-Type': 'application/json' } },
            );
            const raw = response.data && typeof response.data === 'object' && 'data' in response.data
                ? response.data.data : response.data;
            return mapPurchaseOldGold(raw);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to save declaration');
        }
    }
);

export const updatePurchaseOldGold = createAsyncThunk(
    'data/updatePurchaseOldGold',
    async (
        args: { id: string; form: DeclarationFormValues },
        { getState, rejectWithValue },
    ) => {
        const { isGuest } = (getState() as RootState).auth;
        if (isGuest) {
            const current = await AsyncStorage.getItem(DECLARATIONS_KEY);
            const list: PurchaseOldGold[] = current ? JSON.parse(current) : [];
            const updated = list.map(d =>
                d.id === args.id
                    ? { ...d, ...buildPurchaseOldGoldPayload(args.form), id: d.id } as any
                    : d,
            );
            await AsyncStorage.setItem(DECLARATIONS_KEY, JSON.stringify(updated));
            return updated.find(d => d.id === args.id)!;
        }
        try {
            const { customerId, mode, orderId, ...editable } = buildPurchaseOldGoldPayload(args.form);
            const response = await apiClient.put<any>(
                `/api/purchase-old-gold/${args.id}`,
                editable,
                { headers: { 'Content-Type': 'application/json' } },
            );
            const raw = response.data && typeof response.data === 'object' && 'data' in response.data
                ? response.data.data : response.data;
            return mapPurchaseOldGold(raw);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to update declaration');
        }
    }
);

export const deletePurchaseOldGold = createAsyncThunk(
    'data/deletePurchaseOldGold',
    async (id: string, { getState, rejectWithValue }) => {
        const { isGuest } = (getState() as RootState).auth;
        if (isGuest) {
            const current = await AsyncStorage.getItem(DECLARATIONS_KEY);
            const list: PurchaseOldGold[] = current ? JSON.parse(current) : [];
            const updated = list.filter(d => d.id !== id);
            await AsyncStorage.setItem(DECLARATIONS_KEY, JSON.stringify(updated));
            return id;
        }
        try {
            await apiClient.delete(`/api/purchase-old-gold/${id}`);
            return id;
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to delete declaration');
        }
    }
);

/**
 * Uploads ornament photos to an already-saved declaration.
 *
 * Native fetch, not apiClient: ApiClient.js always JSON.stringifies the body,
 * which destroys multipart. `appendPickedImage` handles the RN-vs-browser
 * FormData difference (see its comment near the top of this file).
 *
 * Failure here is non-fatal by design — the declaration is already saved and
 * printable, and photos are an optional extra. The caller surfaces a retry
 * rather than blocking the flow.
 */
export const uploadPurchaseOldGoldPhotos = createAsyncThunk(
    'data/uploadPurchaseOldGoldPhotos',
    async (
        args: { declarationId: string; photos: PendingDeclarationPhoto[] },
        { getState, rejectWithValue },
    ) => {
        const state = getState() as RootState;
        const { isGuest, token } = state.auth;
        if (isGuest || args.photos.length === 0) return null;

        try {
            const baseURL = apiClient.getConfig().baseURL.replace(/\/$/, '');
            const fullUrl = `${baseURL}/api/purchase-old-gold/${args.declarationId}/photos`;

            const formData = new FormData();
            for (let i = 0; i < args.photos.length; i++) {
                await appendPickedImage(
                    formData,
                    'photos',
                    args.photos[i],
                    `ornament_${i + 1}.jpg`,
                );
            }

            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const nativeResponse = await fetch(fullUrl, {
                method: 'POST',
                headers,
                body: formData,
            });
            const text = await nativeResponse.text();
            let json: any;
            try {
                json = JSON.parse(text);
            } catch {
                json = {
                    message: nativeResponse.status === 413
                        ? 'Photos are too large. Please choose smaller images.'
                        : `Something went wrong (HTTP ${nativeResponse.status}). Please try again.`,
                };
            }

            if (!nativeResponse.ok) {
                return rejectWithValue(json?.message || `HTTP ${nativeResponse.status}`);
            }
            return mapPurchaseOldGold(json?.data ?? json);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to upload photos');
        }
    }
);

/**
 * Attaches photos to one ornament on a saved declaration.
 *
 * Addressed by the ornament's own id rather than its position: removing the
 * first of three ornaments would otherwise re-point the remaining two at each
 * other's photos. The id is the one the client generated and sent with the save,
 * which the API preserves.
 *
 * Native fetch rather than ApiClient for the same reason as the declaration
 * upload — ApiClient always JSON.stringifies the body, which destroys multipart.
 */
export const uploadDeclarationItemPhotos = createAsyncThunk(
    'data/uploadDeclarationItemPhotos',
    async (
        args: { declarationId: string; itemId: string; photos: PendingDeclarationPhoto[] },
        { getState, rejectWithValue },
    ) => {
        const state = getState() as RootState;
        const { isGuest, token } = state.auth;
        if (isGuest || args.photos.length === 0) return null;

        try {
            const baseURL = apiClient.getConfig().baseURL.replace(/\/$/, '');
            const fullUrl =
                `${baseURL}/api/purchase-old-gold/${args.declarationId}` +
                `/items/${args.itemId}/photos`;

            const formData = new FormData();
            for (let i = 0; i < args.photos.length; i++) {
                await appendPickedImage(
                    formData,
                    'photos',
                    args.photos[i],
                    `ornament_${i + 1}.jpg`,
                );
            }

            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const nativeResponse = await fetch(fullUrl, {
                method: 'POST',
                headers,
                body: formData,
            });
            const text = await nativeResponse.text();
            let json: any;
            try {
                json = JSON.parse(text);
            } catch {
                json = {
                    message: nativeResponse.status === 413
                        ? 'Photos are too large. Please choose smaller images.'
                        : `Something went wrong (HTTP ${nativeResponse.status}). Please try again.`,
                };
            }

            if (!nativeResponse.ok) {
                return rejectWithValue(json?.message || `HTTP ${nativeResponse.status}`);
            }
            return mapPurchaseOldGold(json?.data ?? json);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to upload photos');
        }
    }
);

/**
 * Attaches ornament photos to a saved order (invoice or advance order).
 *
 * The photos belong to the acquisition, not to the declaration: a shopkeeper may
 * photograph the goods and never print a declaration, and a declaration written
 * days later must be able to reuse them rather than ask for them again.
 *
 * Native fetch for the same reason as the declaration upload — ApiClient always
 * JSON.stringifies the body, which destroys multipart. Failure is non-fatal: the
 * order is already saved, so the caller surfaces a retry rather than an error
 * implying nothing was recorded.
 */
export const uploadOrderOrnamentPhotos = createAsyncThunk(
    'data/uploadOrderOrnamentPhotos',
    async (
        args: { orderId: string; photos: PendingDeclarationPhoto[] },
        { getState, rejectWithValue },
    ) => {
        const state = getState() as RootState;
        const { isGuest, token } = state.auth;
        if (isGuest || args.photos.length === 0) return null;

        try {
            const baseURL = apiClient.getConfig().baseURL.replace(/\/$/, '');
            const fullUrl = `${baseURL}/api/orders/${args.orderId}/ornament-photos`;

            const formData = new FormData();
            for (let i = 0; i < args.photos.length; i++) {
                await appendPickedImage(
                    formData,
                    'photos',
                    args.photos[i],
                    `ornament_${i + 1}.jpg`,
                );
            }

            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(fullUrl, { method: 'POST', headers, body: formData });
            const text = await response.text();
            let json: any;
            try {
                json = JSON.parse(text);
            } catch {
                json = {
                    message: response.status === 413
                        ? 'Photos are too large. Please choose smaller images.'
                        : `Something went wrong (HTTP ${response.status}). Please try again.`,
                };
            }

            if (!response.ok) {
                return rejectWithValue(json?.message || `HTTP ${response.status}`);
            }
            return mapBackendOrder(json?.data ?? json);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to upload photos');
        }
    }
);

/**
 * Attaches ornament photos to a saved full-payment invoice.
 *
 * A separate thunk, not a parameter on uploadOrderOrnamentPhotos, because a
 * full-payment sale creates an Invoice via /api/invoice, never an Order — the
 * two live in different collections with different endpoints
 * (/api/invoice/:id/ornament-photos vs /api/orders/:id/ornament-photos), and
 * posting an invoice id to the orders endpoint 404s. That mismatch is exactly
 * what silently broke this for full payment before this endpoint existed.
 */
export const uploadInvoiceOrnamentPhotos = createAsyncThunk(
    'data/uploadInvoiceOrnamentPhotos',
    async (
        args: { invoiceId: string; photos: PendingDeclarationPhoto[] },
        { getState, rejectWithValue },
    ) => {
        const state = getState() as RootState;
        const { isGuest, token } = state.auth;
        if (isGuest || args.photos.length === 0) return null;

        try {
            const baseURL = apiClient.getConfig().baseURL.replace(/\/$/, '');
            const fullUrl = `${baseURL}/api/invoice/${args.invoiceId}/ornament-photos`;

            const formData = new FormData();
            for (let i = 0; i < args.photos.length; i++) {
                await appendPickedImage(
                    formData,
                    'photos',
                    args.photos[i],
                    `ornament_${i + 1}.jpg`,
                );
            }

            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(fullUrl, { method: 'POST', headers, body: formData });
            const text = await response.text();
            let json: any;
            try {
                json = JSON.parse(text);
            } catch {
                json = {
                    message: response.status === 413
                        ? 'Photos are too large. Please choose smaller images.'
                        : `Something went wrong (HTTP ${response.status}). Please try again.`,
                };
            }

            if (!response.ok) {
                return rejectWithValue(json?.message || `HTTP ${response.status}`);
            }
            return mapBackendInvoice(json?.data ?? json);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to upload photos');
        }
    }
);

/**
 * Attaches photos to ONE item on a saved order or invoice.
 *
 * `kind` here rather than two thunks (unlike the ornament uploads above): the
 * item endpoints differ only in their base path, and both return the same
 * document shape their own mapper already handles.
 *
 * Items are addressed by index because neither invoice nor order items carry an
 * `_id` — they are value objects in the order the client sent, which is also the
 * order they print in. The index must therefore be the item's position in the
 * SAVED document, not in some filtered view of it.
 *
 * Native fetch for the same reason as every other upload here: ApiClient always
 * JSON.stringifies the body, which destroys multipart. Failure is non-fatal —
 * the bill is already saved, so the caller surfaces a retry rather than an
 * error implying the sale was not recorded.
 */
export const uploadItemPhotos = createAsyncThunk(
    'data/uploadItemPhotos',
    async (
        args: {
            id: string;
            kind: 'order' | 'invoice';
            itemIndex: number;
            photos: PendingDeclarationPhoto[];
        },
        { getState, rejectWithValue },
    ) => {
        const state = getState() as RootState;
        const { isGuest, token } = state.auth;
        if (isGuest || args.photos.length === 0) return null;

        try {
            const baseURL = apiClient.getConfig().baseURL.replace(/\/$/, '');
            const base = args.kind === 'invoice' ? 'invoice' : 'orders';
            const fullUrl = `${baseURL}/api/${base}/${args.id}/items/${args.itemIndex}/photos`;

            const formData = new FormData();
            for (let i = 0; i < args.photos.length; i++) {
                await appendPickedImage(
                    formData,
                    'photos',
                    args.photos[i],
                    `item_${args.itemIndex + 1}_${i + 1}.jpg`,
                );
            }

            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(fullUrl, { method: 'POST', headers, body: formData });
            const text = await response.text();
            let json: any;
            try {
                json = JSON.parse(text);
            } catch {
                json = {
                    message: response.status === 413
                        ? 'Photos are too large. Please choose smaller images.'
                        : `Something went wrong (HTTP ${response.status}). Please try again.`,
                };
            }

            if (!response.ok) {
                return rejectWithValue(json?.message || `HTTP ${response.status}`);
            }
            const doc = json?.data ?? json;
            return args.kind === 'invoice' ? mapBackendInvoice(doc) : mapBackendOrder(doc);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to upload photos');
        }
    }
);

/** Removes one photo from one item. apiClient, not fetch — no multipart body. */
export const removeItemPhoto = createAsyncThunk(
    'data/removeItemPhoto',
    async (
        args: { id: string; kind: 'order' | 'invoice'; itemIndex: number; fileId: string },
        { getState, rejectWithValue },
    ) => {
        const state = getState() as RootState;
        if (state.auth.isGuest) return null;

        try {
            const base = args.kind === 'invoice' ? '/api/invoice' : '/api/orders';
            const response = await apiClient.delete<any>(
                `${base}/${args.id}/items/${args.itemIndex}/photos/${encodeURIComponent(args.fileId)}`,
            );
            // Two levels: apiClient hands back an axios-shaped response whose
            // body is the {success, data} envelope, so the record sits one
            // deeper than it looks. Same unwrapping as removeOrnamentPhoto.
            const doc = response.data && typeof response.data === 'object' && 'data' in response.data
                ? response.data.data : response.data;
            return args.kind === 'invoice' ? mapBackendInvoice(doc) : mapBackendOrder(doc);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to remove photo');
        }
    }
);

/**
 * Uploads photos against ONE gold or silver row of an exchange.
 *
 * Distinct from uploadOrderOrnamentPhotos / uploadInvoiceOrnamentPhotos, which
 * attach a single set to the bill as a whole - how every exchange was recorded
 * before rows could carry their own. Those still exist and still display; this
 * is what new photos use, so a bill taking in a nose ring and a chain can say
 * which photo is of which.
 *
 * Native fetch rather than apiClient, for the reason every upload here does:
 * ApiClient always JSON.stringifies the body, which destroys multipart.
 */
export const uploadExchangePhotos = createAsyncThunk(
    'data/uploadExchangePhotos',
    async (
        args: {
            id: string;
            kind: 'order' | 'invoice';
            exchangeIndex: number;
            photos: PendingDeclarationPhoto[];
        },
        { getState, rejectWithValue },
    ) => {
        const state = getState() as RootState;
        const { isGuest, token } = state.auth;
        if (isGuest || args.photos.length === 0) return null;

        try {
            const baseURL = apiClient.getConfig().baseURL.replace(/\/$/, '');
            const base = args.kind === 'invoice' ? 'invoice' : 'orders';
            const fullUrl =
                `${baseURL}/api/${base}/${args.id}` +
                `/exchanges/${args.exchangeIndex}/photos`;

            const formData = new FormData();
            for (let i = 0; i < args.photos.length; i++) {
                await appendPickedImage(
                    formData,
                    'photos',
                    args.photos[i],
                    `exchange_${args.exchangeIndex + 1}_${i + 1}.jpg`,
                );
            }

            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(fullUrl, { method: 'POST', headers, body: formData });
            const text = await response.text();
            let json: any;
            try {
                json = JSON.parse(text);
            } catch {
                json = {
                    message: response.status === 413
                        ? 'Photos are too large. Please choose smaller images.'
                        : `Something went wrong (HTTP ${response.status}). Please try again.`,
                };
            }
            if (!response.ok) {
                return rejectWithValue(json?.message || `HTTP ${response.status}`);
            }
            const doc = json?.data ?? json;
            return args.kind === 'invoice' ? mapBackendInvoice(doc) : mapBackendOrder(doc);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to upload photos');
        }
    }
);

/** Removes one photo from one exchange row. apiClient - no multipart body. */
export const removeExchangePhoto = createAsyncThunk(
    'data/removeExchangePhoto',
    async (
        args: {
            id: string;
            kind: 'order' | 'invoice';
            exchangeIndex: number;
            fileId: string;
        },
        { getState, rejectWithValue },
    ) => {
        const state = getState() as RootState;
        if (state.auth.isGuest) return null;

        try {
            const base = args.kind === 'invoice' ? '/api/invoice' : '/api/orders';
            const response = await apiClient.delete<any>(
                `${base}/${args.id}/exchanges/${args.exchangeIndex}` +
                `/photos/${encodeURIComponent(args.fileId)}`,
            );
            // Two levels: apiClient hands back an axios-shaped response whose
            // body is the {success, data} envelope.
            const doc = response.data && typeof response.data === 'object' && 'data' in response.data
                ? response.data.data : response.data;
            return args.kind === 'invoice' ? mapBackendInvoice(doc) : mapBackendOrder(doc);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to remove photo');
        }
    }
);

/**
 * Uploads every exchange row's pending photos for a bill that has just saved.
 *
 * Sequential, like uploadAllItemPhotos and for the same reason: each request
 * returns the whole updated record, so running them together would have each
 * response overwrite the last in the store.
 */
export const uploadAllExchangePhotos = createAsyncThunk(
    'data/uploadAllExchangePhotos',
    async (
        args: {
            id: string;
            kind: 'order' | 'invoice';
            exchangePhotos: { exchangeIndex: number; photos: PendingDeclarationPhoto[] }[];
        },
        { dispatch },
    ) => {
        const failedIndices: number[] = [];
        for (const entry of args.exchangePhotos) {
            if (!entry.photos?.length) continue;
            const action = await dispatch(
                uploadExchangePhotos({
                    id: args.id,
                    kind: args.kind,
                    exchangeIndex: entry.exchangeIndex,
                    photos: entry.photos,
                }),
            );
            if (uploadExchangePhotos.rejected.match(action)) failedIndices.push(entry.exchangeIndex);
        }
        return { failedIndices };
    }
);
/**
 * Uploads every item's pending photos for a bill that has just been saved.
 *
 * Sequential, not `Promise.all`: each request re-saves the same document, and
 * concurrent writes would race on `items` and lose photos. A handful of small
 * uploads in series is imperceptible next to the pick-and-crop that preceded
 * them.
 *
 * Returns the indices that failed so the caller can offer a targeted retry
 * rather than re-uploading photos that already landed.
 */
export const uploadAllItemPhotos = createAsyncThunk(
    'data/uploadAllItemPhotos',
    async (
        args: {
            id: string;
            kind: 'order' | 'invoice';
            itemPhotos: { itemIndex: number; photos: PendingDeclarationPhoto[] }[];
        },
        { dispatch },
    ) => {
        const failedIndices: number[] = [];
        for (const entry of args.itemPhotos) {
            if (!entry.photos?.length) continue;
            const action = await dispatch(
                uploadItemPhotos({
                    id: args.id,
                    kind: args.kind,
                    itemIndex: entry.itemIndex,
                    photos: entry.photos,
                }),
            );
            if (uploadItemPhotos.rejected.match(action)) failedIndices.push(entry.itemIndex);
        }
        return { failedIndices };
    }
);

/**
 * Removes one ornament photo from a saved order or invoice.
 *
 * `kind` rather than two thunks, unlike the uploads: those had to differ in
 * body handling and mapper, while this is one path parameter and one mapper
 * choice. The endpoints still diverge (/api/orders vs /api/invoice), which is
 * exactly why the caller must pass which collection the id belongs to.
 *
 * apiClient here, not native fetch — there is no multipart body to protect.
 */
export const removeOrnamentPhoto = createAsyncThunk(
    'data/removeOrnamentPhoto',
    async (
        args: { id: string; fileId: string; kind: 'order' | 'invoice' },
        { getState, rejectWithValue },
    ) => {
        const state = getState() as RootState;
        if (state.auth.isGuest) return null;

        try {
            const base = args.kind === 'invoice' ? '/api/invoice' : '/api/orders';
            const response = await apiClient.delete<any>(
                `${base}/${args.id}/ornament-photos/${encodeURIComponent(args.fileId)}`,
            );
            // Same unwrapping as removePurchaseOldGoldPhoto: the client hands
            // back an axios-shaped response whose body is the {success,data}
            // envelope, so the record is one level deeper than it looks.
            const raw = response.data && typeof response.data === 'object' && 'data' in response.data
                ? response.data.data : response.data;
            return args.kind === 'invoice'
                ? mapBackendInvoice(raw)
                : mapBackendOrder(raw);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to remove photo');
        }
    }
);

/**
 * Attaches ID proof to one witness on a saved declaration.
 *
 * Addressed by the witness's own id — never by array position. An edit
 * replaces the whole witnesses array, so an index would point at a different
 * person the moment a row is removed.
 *
 * Same native-fetch reasoning and same non-fatal failure contract as
 * uploadPurchaseOldGoldPhotos above.
 */
export const uploadWitnessPhotos = createAsyncThunk(
    'data/uploadWitnessPhotos',
    async (
        args: {
            declarationId: string;
            witnessId: string;
            photos: PendingDeclarationPhoto[];
        },
        { getState, rejectWithValue },
    ) => {
        const state = getState() as RootState;
        const { isGuest, token } = state.auth;
        if (isGuest || args.photos.length === 0) return null;

        try {
            const baseURL = apiClient.getConfig().baseURL.replace(/\/$/, '');
            const fullUrl =
                `${baseURL}/api/purchase-old-gold/${args.declarationId}` +
                `/witnesses/${encodeURIComponent(args.witnessId)}/photos`;

            const formData = new FormData();
            for (let i = 0; i < args.photos.length; i++) {
                await appendPickedImage(
                    formData,
                    'photos',
                    args.photos[i],
                    `witness_${i + 1}.jpg`,
                );
            }

            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const nativeResponse = await fetch(fullUrl, {
                method: 'POST',
                headers,
                body: formData,
            });
            const text = await nativeResponse.text();
            let json: any;
            try {
                json = JSON.parse(text);
            } catch {
                json = {
                    message: nativeResponse.status === 413
                        ? 'Photos are too large. Please choose smaller images.'
                        : `Something went wrong (HTTP ${nativeResponse.status}). Please try again.`,
                };
            }

            if (!nativeResponse.ok) {
                return rejectWithValue(json?.message || `HTTP ${nativeResponse.status}`);
            }
            return mapPurchaseOldGold(json?.data ?? json);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to upload photos');
        }
    }
);

/**
 * Uploads the scans of one ID document on an already-saved declaration.
 *
 * Addressed by the entry's own id — never by array position, for the same
 * reason as the witness photos above: an edit replaces the whole idProofs
 * array, so an index would file one document's scans under another the moment a
 * row is removed.
 *
 * Same native-fetch reasoning and same non-fatal failure contract as
 * uploadPurchaseOldGoldPhotos above.
 */
export const uploadIdProofPhotos = createAsyncThunk(
    'data/uploadIdProofPhotos',
    async (
        args: {
            declarationId: string;
            idProofId: string;
            photos: PendingDeclarationPhoto[];
        },
        { getState, rejectWithValue },
    ) => {
        const state = getState() as RootState;
        const { isGuest, token } = state.auth;
        if (isGuest || args.photos.length === 0) return null;

        try {
            const baseURL = apiClient.getConfig().baseURL.replace(/\/$/, '');
            const fullUrl =
                `${baseURL}/api/purchase-old-gold/${args.declarationId}` +
                `/id-proofs/${encodeURIComponent(args.idProofId)}/photos`;

            const formData = new FormData();
            for (let i = 0; i < args.photos.length; i++) {
                await appendPickedImage(
                    formData,
                    'photos',
                    args.photos[i],
                    `id_proof_${i + 1}.jpg`,
                );
            }

            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const nativeResponse = await fetch(fullUrl, {
                method: 'POST',
                headers,
                body: formData,
            });
            const text = await nativeResponse.text();
            let json: any;
            try {
                json = JSON.parse(text);
            } catch {
                json = {
                    message: nativeResponse.status === 413
                        ? 'Photos are too large. Please choose smaller images.'
                        : `Something went wrong (HTTP ${nativeResponse.status}). Please try again.`,
                };
            }

            if (!nativeResponse.ok) {
                return rejectWithValue(json?.message || `HTTP ${nativeResponse.status}`);
            }
            return mapPurchaseOldGold(json?.data ?? json);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to upload photos');
        }
    }
);

/** Deletes one scan from one ID document, addressed by the entry's own id. */
export const removeIdProofPhoto = createAsyncThunk(
    'data/removeIdProofPhoto',
    async (
        args: { declarationId: string; idProofId: string; fileId: string },
        { getState, rejectWithValue },
    ) => {
        const { isGuest } = (getState() as RootState).auth;
        if (isGuest) return null;
        try {
            const response = await apiClient.delete<any>(
                `/api/purchase-old-gold/${args.declarationId}` +
                `/id-proofs/${encodeURIComponent(args.idProofId)}` +
                `/photos/${encodeURIComponent(args.fileId)}`,
            );
            const raw = response.data && typeof response.data === 'object' && 'data' in response.data
                ? response.data.data : response.data;
            return mapPurchaseOldGold(raw);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to remove photo');
        }
    }
);

/** Deletes one photo from one ornament, addressed by the ornament's own id. */
export const removeDeclarationItemPhoto = createAsyncThunk(
    'data/removeDeclarationItemPhoto',
    async (
        args: { declarationId: string; itemId: string; fileId: string },
        { getState, rejectWithValue },
    ) => {
        const { isGuest } = (getState() as RootState).auth;
        if (isGuest) return null;
        try {
            const response = await apiClient.delete<any>(
                `/api/purchase-old-gold/${args.declarationId}` +
                `/items/${encodeURIComponent(args.itemId)}` +
                `/photos/${encodeURIComponent(args.fileId)}`,
            );
            const raw = response.data && typeof response.data === 'object' && 'data' in response.data
                ? response.data.data : response.data;
            return mapPurchaseOldGold(raw);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to remove photo');
        }
    }
);

export const removeWitnessPhoto = createAsyncThunk(
    'data/removeWitnessPhoto',
    async (
        args: { declarationId: string; witnessId: string; fileId: string },
        { getState, rejectWithValue },
    ) => {
        const { isGuest } = (getState() as RootState).auth;
        if (isGuest) return null;
        try {
            const response = await apiClient.delete<any>(
                `/api/purchase-old-gold/${args.declarationId}` +
                `/witnesses/${encodeURIComponent(args.witnessId)}` +
                `/photos/${encodeURIComponent(args.fileId)}`,
            );
            const raw = response.data && typeof response.data === 'object' && 'data' in response.data
                ? response.data.data : response.data;
            return mapPurchaseOldGold(raw);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to remove photo');
        }
    }
);

export const removePurchaseOldGoldPhoto = createAsyncThunk(
    'data/removePurchaseOldGoldPhoto',
    async (
        args: { declarationId: string; fileId: string },
        { getState, rejectWithValue },
    ) => {
        const { isGuest } = (getState() as RootState).auth;
        if (isGuest) return null;
        try {
            const response = await apiClient.delete<any>(
                `/api/purchase-old-gold/${args.declarationId}/photos/${encodeURIComponent(args.fileId)}`,
            );
            const raw = response.data && typeof response.data === 'object' && 'data' in response.data
                ? response.data.data : response.data;
            return mapPurchaseOldGold(raw);
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to remove photo');
        }
    }
);

// ─── GST report ──────────────────────────────────────────────────────────────
// Logged-in → GET /api/sales/gst-report. Guest fallback is computed in the
// screen via utils/gst.ts buildLocalGstReport (needs orders+purchases+shop).

export const fetchGstReport = createAsyncThunk(
    'data/fetchGstReport',
    async (
        args: { startDate: string; endDate: string },
        { getState, rejectWithValue },
    ) => {
        const { isGuest } = (getState() as RootState).auth;
        if (isGuest) return null;
        try {
            const response = await apiClient.get<any>(
                `/api/sales/gst-report?startDate=${args.startDate}&endDate=${args.endDate}`,
            );
            const result = response.data;
            return result && typeof result === 'object' && 'data' in result ? result.data : result;
        } catch (err: any) {
            return rejectWithValue(err.message || 'Failed to fetch GST report');
        }
    }
);

// Deduct pcs from matching tracked products when a full invoice is created.
// Non-blocking: untracked / free-form lines are ignored. Returns the updated
// catalog plus the products that reached <= 0 so the UI can warn.
export const decrementCatalogStock = createAsyncThunk(
    'data/decrementCatalogStock',
    // Accepts either a plain items array (legacy call shape, decrements as
    // before) or { items, direction } — 'restock' is used to reverse a
    // stock decrement when editing an invoice's items (there's no
    // server-side stock tracking to fall back on, so an edit must undo the
    // old line items' decrement before applying the new ones, or stock
    // quietly drifts every time an order is edited).
    async (arg: any[] | { items: any[]; direction?: 'decrement' | 'restock' }, { getState }) => {
        const { items, direction } = Array.isArray(arg)
            ? { items: arg, direction: 'decrement' as const }
            : { items: arg.items, direction: arg.direction ?? 'decrement' };
        const sign = direction === 'restock' ? 1 : -1;

        const state = getState() as RootState;
        const { isGuest } = state.auth;
        const products = state.data.catalogProducts.map(p => ({ ...p }));
        const depleted: { name: string; remaining: number }[] = [];
        const changed: CatalogProduct[] = [];

        for (const line of (items || [])) {
            const sourceId = line?.sourceItemId;
            const lineName = String(line?.itemName || line?.name || '').trim().toLowerCase();
            const pcs = parseInt(line?.pcs ?? line?.pieces) || 1;
            const match = products.find(p =>
                sourceId ? p.id === sourceId : (!!lineName && p.name.trim().toLowerCase() === lineName)
            );
            if (!match || typeof match.stockQty !== 'number') continue;
            match.stockQty = match.stockQty + sign * pcs;
            changed.push(match);
            if (direction === 'decrement' && match.stockQty <= 0) depleted.push({ name: match.name, remaining: match.stockQty });
        }

        if (changed.length === 0) return { products: state.data.catalogProducts, depleted };

        if (isGuest) {
            await AsyncStorage.setItem(CATALOG_PRODUCTS_KEY, JSON.stringify(products));
        } else {
            await Promise.allSettled(changed.map(p =>
                apiClient.put(`/api/products/${p.id}`, {
                    name: p.name,
                    productType: p.category || 'Gold',
                    purity: p.purity,
                    makingChargeType: p.makingChargeType,
                    makingCharges: p.makingCharges,
                    discountType: p.discountType,
                    discount: p.discount,
                    grossWt: p.grossWt,
                    lessWt: p.lessWt,
                    pcs: p.pcs,
                    huid: p.huid,
                    otherChargeDesc: p.otherChargeDesc,
                    otherChargeAmount: p.otherChargeAmount,
                    stockQty: p.stockQty,
                }, { headers: { 'Content-Type': 'application/json' } }).catch(() => null)
            ));
        }
        return { products, depleted };
    }
);


const dataSlice = createSlice({
    name: 'data',
    initialState,
    reducers: {
        removeOrderLocally: (state, action: PayloadAction<string>) => {
            delete state.deletedOrderIds[action.payload];
            state.orders = state.orders.filter(o => o.id !== action.payload);
        },
        clearUserData(state) {
            state.customers = [];
            state.orders = [];
            state.shopDetails = null;
            state.purchases = [];
            // Declarations carry customer ID-proof numbers and bank details —
            // they must not survive a logout or the end of an impersonation
            // session into the next user's view.
            state.purchaseOldGold = [];
            state.gstReport = null;
            state.lastFetched = {
                customers: null,
                orders: null,
                shopDetails: null,
                metalRates: null,
                catalogProducts: null,
                purchases: null,
                purchaseOldGold: null,
                salesReport: {},
            };
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchCustomers.pending, (state) => {
                state.loading = true;
            })
            .addCase(fetchCustomers.fulfilled, (state, action: PayloadAction<Customer[]>) => {
                state.loading = false;
                state.customers = action.payload;
                state.lastFetched.customers = Date.now();
            })
            .addCase(addCustomer.fulfilled, (state, action: PayloadAction<Customer[]>) => {
                state.customers = action.payload;
            })
            .addCase(updateCustomer.fulfilled, (state, action: PayloadAction<Customer[]>) => {
                state.customers = action.payload;
            })
            .addCase(
                deleteCustomer.fulfilled,
                (state, action: PayloadAction<{ customers: Customer[]; customerId: string }>) => {
                    state.customers = action.payload.customers;
                    // Their records went with them server-side; drop the local
                    // copies too so every count updates in the same tick.
                    state.orders = state.orders.filter(
                        o => o.customerId !== action.payload.customerId,
                    );
                    state.purchaseOldGold = state.purchaseOldGold.filter(
                        d => d.customerId !== action.payload.customerId,
                    );
                },
            )
            .addCase(uploadCustomerPhoto.fulfilled, (state, action: PayloadAction<Customer>) => {
                state.customers = state.customers.map(c =>
                    c.id === action.payload.id ? action.payload : c,
                );
            })
            .addCase(removeCustomerPhoto.fulfilled, (state, action: PayloadAction<Customer>) => {
                state.customers = state.customers.map(c =>
                    c.id === action.payload.id ? action.payload : c,
                );
            })
            .addCase(deleteInvoice.fulfilled, (state, action: PayloadAction<Order[]>) => {
                state.orders = action.payload;
                const invoiceId = (action as any).meta.arg as string;
                if (invoiceId) delete state.deletedOrderIds[invoiceId];
            })
            .addCase(fetchOrders.fulfilled, (state, action: PayloadAction<Order[]>) => {
                const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
                const valid: Record<string, string> = {};
                Object.entries(state.deletedOrderIds).forEach(([id, deletedAt]) => {
                    if (new Date(deletedAt).getTime() > cutoff) valid[id] = deletedAt;
                });
                state.deletedOrderIds = valid;
                state.orders = action.payload.map(o =>
                    valid[o.id] ? { ...o, deletedAt: valid[o.id] } : o
                );
                state.lastFetched.orders = Date.now();
            })
            .addCase(loadDeletedOrderIds.fulfilled, (state, action) => {
                state.deletedOrderIds = action.payload;
                state.orders = state.orders.map(o =>
                    action.payload[o.id] ? { ...o, deletedAt: action.payload[o.id] } : o
                );
            })
            .addCase(softDeleteOrder.fulfilled, (state, action) => {
                const { id, deletedAt, map } = action.payload;
                state.deletedOrderIds = map;
                const idx = state.orders.findIndex(o => o.id === id);
                if (idx !== -1) state.orders[idx] = { ...state.orders[idx], deletedAt };
            })
            .addCase(restoreOrder.fulfilled, (state, action) => {
                const { id, map } = action.payload;
                state.deletedOrderIds = map;
                const idx = state.orders.findIndex(o => o.id === id);
                if (idx !== -1) state.orders[idx] = { ...state.orders[idx], deletedAt: undefined };
            })
            .addCase(purgeExpiredDeleted.fulfilled, (state, action) => {
                state.deletedOrderIds = action.payload;
                const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
                state.orders = state.orders.filter(o =>
                    !o.deletedAt || new Date(o.deletedAt).getTime() > cutoff
                );
            })
            .addCase(permanentDeleteAdvanceOrder.fulfilled, (state, action) => {
                const { id, map } = action.payload;
                state.deletedOrderIds = map;
                state.orders = state.orders.filter(o => o.id !== id);
            })
            .addCase(fetchTrashedOrders.fulfilled, (state, action) => {
                const trashed: Order[] = action.payload;
                const existingIds = new Set(state.orders.map(o => o.id));
                const incoming = trashed.filter(o => !existingIds.has(o.id));
                state.orders = [...state.orders, ...incoming];
                trashed.forEach(o => {
                    if (o.deletedAt) state.deletedOrderIds[o.id] = o.deletedAt;
                });
            })
            .addCase(addOrder.fulfilled, (state, action: PayloadAction<Order[]>) => {
                state.orders = action.payload;
            })
            // Neither photo-upload thunk had a reducer case at all until now —
            // the upload could succeed and the store would never reflect it, so
            // the photos stayed invisible everywhere until an unrelated refetch
            // happened to reload the order. Resolves to null in guest mode
            // (nothing to upload to) or when there were no photos to send.
            .addCase(uploadOrderOrnamentPhotos.fulfilled, (state, action: PayloadAction<Order | null>) => {
                if (!action.payload) return;
                const index = state.orders.findIndex(o => o.id === action.payload!.id);
                if (index !== -1) state.orders[index] = action.payload;
            })
            .addCase(uploadInvoiceOrnamentPhotos.fulfilled, (state, action: PayloadAction<Order | null>) => {
                if (!action.payload) return;
                const index = state.orders.findIndex(o => o.id === action.payload!.id);
                if (index !== -1) state.orders[index] = action.payload;
            })
            // Item photos were the one upload family with no reducer at all.
            // The request succeeded and the server stored the photos, but the
            // updated record it returned was thrown away, so nothing on screen
            // ever showed them - an advance order saved with item photos came
            // back looking as though the upload had silently done nothing.
            .addCase(uploadItemPhotos.fulfilled, (state, action: PayloadAction<Order | null>) => {
                if (!action.payload) return;
                const index = state.orders.findIndex(o => o.id === action.payload!.id);
                if (index !== -1) state.orders[index] = action.payload;
            })
            .addCase(removeItemPhoto.fulfilled, (state, action: PayloadAction<Order | null>) => {
                if (!action.payload) return;
                const index = state.orders.findIndex(o => o.id === action.payload!.id);
                if (index !== -1) state.orders[index] = action.payload;
            })
            .addCase(uploadExchangePhotos.fulfilled, (state, action: PayloadAction<Order | null>) => {
                if (!action.payload) return;
                const index = state.orders.findIndex(o => o.id === action.payload!.id);
                if (index !== -1) state.orders[index] = action.payload;
            })
            .addCase(removeExchangePhoto.fulfilled, (state, action: PayloadAction<Order | null>) => {
                if (!action.payload) return;
                const index = state.orders.findIndex(o => o.id === action.payload!.id);
                if (index !== -1) state.orders[index] = action.payload;
            })
            .addCase(removeOrnamentPhoto.fulfilled, (state, action: PayloadAction<Order | null>) => {
                if (!action.payload) return;
                const index = state.orders.findIndex(o => o.id === action.payload!.id);
                if (index !== -1) state.orders[index] = action.payload;
            })
            .addCase(updateInvoiceOrder.fulfilled, (state, action: any) => {
                // Guest branch returns the whole rewritten list (mirrors addOrder's
                // guest branch); the real-backend branch returns just the one
                // updated invoice, mapped through mapBackendInvoice.
                if (Array.isArray(action.payload)) {
                    state.orders = action.payload;
                } else if (action.payload) {
                    const mapped = action.payload;
                    const index = state.orders.findIndex(o => o.id === mapped.id);
                    if (index !== -1) state.orders[index] = mapped;
                }
            })
            .addCase(updateAdvanceOrderItems.fulfilled, (state, action) => {
                const updatedOrder: any = action.payload;
                if (updatedOrder) {
                    const mappedOrder = mapBackendOrder(updatedOrder);
                    const index = state.orders.findIndex(o => o.id === mappedOrder.id);
                    if (index !== -1) state.orders[index] = mappedOrder;
                }
            })
            .addCase(fetchShopDetails.pending, (state) => {
                // Do not set global loading for fetch, it's confusing on the Shop Details screen
            })
            .addCase(fetchShopDetails.fulfilled, (state, action: PayloadAction<ShopDetails>) => {
                state.loading = false;
                state.shopDetails = action.payload;
                state.lastFetched.shopDetails = Date.now();
            })
            .addCase(fetchShopDetails.rejected, (state) => {
                state.loading = false;
            })
            .addCase(updateShopDetails.pending, (state) => {
                state.loading = true;
            })
            .addCase(updateShopDetails.fulfilled, (state, action: PayloadAction<ShopDetails>) => {
                state.loading = false;
                state.shopDetails = action.payload;
            })
            .addCase(updateShopDetails.rejected, (state) => {
                state.loading = false;
            })
            .addCase(fetchMetalRates.fulfilled, (state, action: PayloadAction<MetalRates>) => {
                state.metalRates = action.payload;
                state.lastFetched.metalRates = Date.now();
            })
            .addCase(updateMetalRates.fulfilled, (state, action: PayloadAction<MetalRates>) => {
                state.metalRates = action.payload;
            })
            .addCase(fetchCatalogProducts.fulfilled, (state, action: PayloadAction<CatalogProduct[]>) => {
                state.catalogProducts = action.payload;
                state.lastFetched.catalogProducts = Date.now();
            })
            .addCase(addCatalogProduct.fulfilled, (state, action: PayloadAction<CatalogProduct[]>) => {
                state.catalogProducts = action.payload;
            })
            .addCase(deleteCatalogProduct.fulfilled, (state, action: PayloadAction<CatalogProduct[]>) => {
                state.catalogProducts = action.payload;
            })
            .addCase(updateCatalogProduct.fulfilled, (state, action: PayloadAction<CatalogProduct[]>) => {
                state.catalogProducts = action.payload;
            })
            .addCase(decrementCatalogStock.fulfilled, (state, action: any) => {
                if (action.payload?.products) state.catalogProducts = action.payload.products;
            })
            .addCase(fetchPurchases.fulfilled, (state, action: PayloadAction<Purchase[]>) => {
                state.purchases = action.payload;
                state.lastFetched.purchases = Date.now();
            })
            .addCase(addPurchase.fulfilled, (state, action: PayloadAction<Purchase[]>) => {
                state.purchases = action.payload;
            })
            .addCase(updatePurchase.fulfilled, (state, action: PayloadAction<Purchase[]>) => {
                state.purchases = action.payload;
            })
            .addCase(deletePurchase.fulfilled, (state, action: PayloadAction<Purchase[]>) => {
                state.purchases = action.payload;
            })
            .addCase(fetchPurchaseOldGold.fulfilled, (state, action: PayloadAction<PurchaseOldGold[]>) => {
                state.purchaseOldGold = action.payload;
                state.lastFetched.purchaseOldGold = Date.now();
            })
            .addCase(addPurchaseOldGold.fulfilled, (state, action: PayloadAction<PurchaseOldGold>) => {
                state.purchaseOldGold = [action.payload, ...state.purchaseOldGold];
            })
            .addCase(updatePurchaseOldGold.fulfilled, (state, action: PayloadAction<PurchaseOldGold>) => {
                state.purchaseOldGold = state.purchaseOldGold.map(d =>
                    d.id === action.payload.id ? action.payload : d,
                );
            })
            .addCase(deletePurchaseOldGold.fulfilled, (state, action: PayloadAction<string>) => {
                state.purchaseOldGold = state.purchaseOldGold.filter(d => d.id !== action.payload);
            })
            // Photo thunks resolve to null in guest mode (nothing to upload to),
            // so only replace the row when a real record came back.
            .addCase(uploadPurchaseOldGoldPhotos.fulfilled, (state, action: PayloadAction<PurchaseOldGold | null>) => {
                if (!action.payload) return;
                state.purchaseOldGold = state.purchaseOldGold.map(d =>
                    d.id === action.payload!.id ? action.payload! : d,
                );
            })
            .addCase(uploadDeclarationItemPhotos.fulfilled, (state, action: PayloadAction<PurchaseOldGold | null>) => {
                if (!action.payload) return;
                state.purchaseOldGold = state.purchaseOldGold.map(d =>
                    d.id === action.payload!.id ? action.payload! : d,
                );
            })
            .addCase(removeDeclarationItemPhoto.fulfilled, (state, action: PayloadAction<PurchaseOldGold | null>) => {
                if (!action.payload) return;
                state.purchaseOldGold = state.purchaseOldGold.map(d =>
                    d.id === action.payload!.id ? action.payload! : d,
                );
            })
            .addCase(removePurchaseOldGoldPhoto.fulfilled, (state, action: PayloadAction<PurchaseOldGold | null>) => {
                if (!action.payload) return;
                state.purchaseOldGold = state.purchaseOldGold.map(d =>
                    d.id === action.payload!.id ? action.payload! : d,
                );
            })
            .addCase(uploadWitnessPhotos.fulfilled, (state, action: PayloadAction<PurchaseOldGold | null>) => {
                if (!action.payload) return;
                state.purchaseOldGold = state.purchaseOldGold.map(d =>
                    d.id === action.payload!.id ? action.payload! : d,
                );
            })
            .addCase(removeWitnessPhoto.fulfilled, (state, action: PayloadAction<PurchaseOldGold | null>) => {
                if (!action.payload) return;
                state.purchaseOldGold = state.purchaseOldGold.map(d =>
                    d.id === action.payload!.id ? action.payload! : d,
                );
            })
            .addCase(uploadIdProofPhotos.fulfilled, (state, action: PayloadAction<PurchaseOldGold | null>) => {
                if (!action.payload) return;
                state.purchaseOldGold = state.purchaseOldGold.map(d =>
                    d.id === action.payload!.id ? action.payload! : d,
                );
            })
            .addCase(removeIdProofPhoto.fulfilled, (state, action: PayloadAction<PurchaseOldGold | null>) => {
                if (!action.payload) return;
                state.purchaseOldGold = state.purchaseOldGold.map(d =>
                    d.id === action.payload!.id ? action.payload! : d,
                );
            })
            .addCase(fetchGstReport.fulfilled, (state, action: any) => {
                state.gstReport = action.payload;
            })
            .addCase(fetchSalesReport.fulfilled, (state, action: any) => {
                state.salesReport = action.payload;
                const arg = action.meta.arg as SalesReportArgs;
                const range = typeof arg === 'string' ? arg : arg?.range;
                const key = String(range || '').toLowerCase();
                if (key) state.lastFetched.salesReport[key] = Date.now();
            })
            .addCase(addPaymentToAdvanceOrder.fulfilled, (state, action) => {
                const updatedOrder: any = action.payload;
                if (updatedOrder) {
                    const mappedOrder = mapBackendOrder(updatedOrder);
                    const index = state.orders.findIndex(o => o.id === mappedOrder.id);
                    if (index !== -1) {
                        state.orders[index] = mappedOrder;
                    }
                }
            })
            .addCase(updatePaymentInAdvanceOrder.fulfilled, (state, action) => {
                const updatedOrder: any = action.payload;
                if (updatedOrder) {
                    const mappedOrder = mapBackendOrder(updatedOrder);
                    const index = state.orders.findIndex(o => o.id === mappedOrder.id);
                    if (index !== -1) {
                        state.orders[index] = mappedOrder;
                    }
                }
            })
            .addCase(deletePaymentFromAdvanceOrder.fulfilled, (state, action) => {
                const updatedOrder: any = action.payload;
                if (updatedOrder) {
                    const mappedOrder = mapBackendOrder(updatedOrder);
                    const index = state.orders.findIndex(o => o.id === mappedOrder.id);
                    if (index !== -1) {
                        state.orders[index] = mappedOrder;
                    }
                }
            });

        // updateOrderStatus
        builder.addCase(updateOrderStatus.fulfilled, (state, action) => {
            const updatedOrder: any = action.payload;
            if (updatedOrder) {
                const id = updatedOrder._id || updatedOrder.id;
                const index = state.orders.findIndex(o => o.id === id);
                if (index !== -1) {
                    state.orders[index] = {
                        ...state.orders[index],
                        status: updatedOrder.status || state.orders[index].status,
                        completedAt: updatedOrder.completedAt || state.orders[index].completedAt,
                        remainingWeight: updatedOrder.remainingWeight !== undefined ? updatedOrder.remainingWeight : state.orders[index].remainingWeight,
                        estimatedBalance: updatedOrder.estimatedBalance !== undefined ? updatedOrder.estimatedBalance : state.orders[index].estimatedBalance,
                    };
                }
            }
        });

        // completeAdvanceOrderUnified
        builder.addCase(completeAdvanceOrderUnified.fulfilled, (state, action) => {
            const { order, invoice } = action.payload || {};
            if (order) {
                const mappedOrder = mapBackendOrder(order);
                const idx = state.orders.findIndex(o => o.id === mappedOrder.id);
                if (idx !== -1) {
                    state.orders[idx] = mappedOrder;
                } else {
                    state.orders.unshift(mappedOrder);
                }
            }

            // Re-sort the orders list to ensure consistency
            state.orders.sort((a, b) => {
                const da = new Date(a.createdAt || a.date || 0).getTime();
                const db = new Date(b.createdAt || b.date || 0).getTime();
                return db - da;
            });

            state.loading = false;
        });
    },
});

export const { removeOrderLocally, clearUserData } = dataSlice.actions;
export default dataSlice.reducer;
