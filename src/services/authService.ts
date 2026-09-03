import { API_BASE_URL } from '@config';
import { apiClient } from '../api/apiClient';
import { withCoreRetry } from '../api/request';
import type { DevicePayload } from '../utils/deviceInfo';

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms);
  });

export interface ApiDukandarStats {
  _id: string;
  phone: string;
  shopName?: string;
  totalInvoices: number;
  totalSalesValue: number;
  customersCount: number;
  advanceOrdersCount: number;
  pendingOrdersCount: number;
  registrationDate: string;
  lastActivity: string | null;
  contactCount: number;
  deviceInfo?: {
    platform?: string;
    make?: string;
    model?: string;
    /** Absent for shops that have not opened a build new enough to report it. */
    appVersion?: string;
    buildNumber?: string;
  } | null;
}

/** Per-shop record counts, mirrored from the backend's ShopDataCounts. */
export interface AdminShopDataCounts {
  customers: number;
  invoices: number;
  orders: number;
  purchaseOldGold: number;
  communications: number;
}

/**
 * A shop the server declined to delete because it still holds real billing
 * records.
 *
 * This is not an error. It is the guard added after 21 Aug 2026, when a bulk
 * cleanup aimed at empty test accounts destroyed 31 real shops — 57 invoices
 * and ~Rs 68 lakh of billing — with no way to recover any of it. The server
 * hands these back so the admin can see exactly what they are about to lose
 * and decide, rather than the whole batch failing and inviting a blind retry.
 */
export interface AdminSkippedShop {
  id: string;
  phone: number | null;
  shopName: string;
  counts: AdminShopDataCounts;
}

export interface AdminBulkDeleteResult {
  deletedCount: number;
  /**
   * What the server actually deleted. Use this directly — deletions must not
   * be inferred from failedIds, because skipped shops appear in neither list.
   */
  deletedIds: string[];
  failedIds: string[];
  skipped: AdminSkippedShop[];
  /** Path of the JSON export written for each deleted shop, before deletion. */
  exports: string[];
  exportDir: string;
}

export interface AdminDeletedUserLog {
  _id: string;
  phone: number;
  shopName: string;
  registrationDate: string | null;
  deletedAt: string;
  /**
   * 'self' means the shopkeeper deleted their own account from inside the app —
   * this is the churn signal. 'manual' and 'bulk' are admin-side cleanup.
   */
  deletionReason: 'manual' | 'bulk' | 'self';
  totalInvoices: number;
  totalSalesValue: number;
  customersCount: number;
  contactCount: number;
}

export interface AdminCommunicationLog {
  _id: string;
  dukandarId: string;
  loggedBy: string;
  type: 'call' | 'whatsapp' | 'note';
  notes: string;
  createdAt: string;
}

export interface AdminAnalytics {
  dailyRegistrations: Array<{ date: string; count: number }>;
  lastRegisteredAt: string | null;
  lastRegisteredUser: { phone: string; shopName: string } | null;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  dailyInvoices: Array<{ date: string; count: number }>;
  invoicesToday: number;
  invoicesThisWeek: number;
  invoicesThisMonth: number;
  churnedUsers: Array<{
    _id: string;
    phone: string;
    shopName?: string;
    lastActivity: string | null;
    registrationDate: string;
    daysSinceActivity: number | null;
  }>;
  activeUsersLast30Days: number;
  neverActiveCount: number;
  /** Shops that finished or skipped registration — everyone except the below. */
  shopCount: number;
  /**
   * Signups that never became shops: no shop name AND no activity, ever. The
   * account is created at OTP verification, before a name is asked for, so
   * closing the app on the registration screen leaves one of these.
   *
   * Kept out of every shop figure above and surfaced on its own as a lead-gen
   * queue — the phone and device are exactly what is needed to ask someone what
   * put them off.
   */
  pendingRegistrations: Array<{
    _id: string;
    phone: string;
    registrationDate: string | null;
    deviceInfo?: { platform?: string; make?: string; model?: string } | null;
    daysSinceRegistered: number | null;
  }>;
  devicesByPlatform: Array<{ platform: string; count: number }>;
  topDeviceModels: Array<{ make: string; model: string; count: number }>;
}

/**
 * What the app still needs from the admin API: the shop list behind
 * AdminHomeScreen's picker.
 *
 * The analytics, deletion, deleted-log and communication calls were removed
 * with the in-app admin dashboard. Their BACKEND routes stay exactly where
 * they are — Nexus federates every one of them through its proxy, and the
 * console is now the only client. Deleting them server-side would take the
 * dashboard down with them.
 */
export const adminService = {
  async listUsersWithStats(): Promise<{ data: ApiDukandarStats[] }> {
    const res = await apiClient.get<{ data: ApiDukandarStats[] }>('/api/dukandar/stats');
    return res.data;
  },
};

export const authService = {
  async validateSession(token: string): Promise<{ success: boolean; userType?: 'admin' | 'dukandar'; needsRegistration?: boolean }> {
    try {
      const res = await apiClient.get<{ success: boolean; userType: 'admin' | 'dukandar'; needsRegistration?: boolean }>(
        '/api/login/me',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data;
    } catch {
      return { success: false };
    }
  },

  async requestOtp(phone: string) {
    if (!API_BASE_URL) {
      console.error("CRITICAL: API_BASE_URL is missing!");
      throw new Error("Application configuration error: API URL missing");
    }

    const res = await withCoreRetry(
      async () =>
        apiClient.post<{ success: boolean; fullhash?: string; sessionId?: string }>(
          '/api/login/send-otp',
          { phone },
          { headers: { 'Content-Type': 'application/json' } }
        ),
      { action: 'send_otp', component: 'authService', metadata: { phone } }
    );
    return res.data;
  },
  async verifyOtp(phone: string, otp: string, fullhash?: string, sessionId?: string, deviceInfo?: DevicePayload) {
    if (!API_BASE_URL) {
      await delay(800);
      if (otp === '123456') return { success: true, token: 'dummy-token' };
      return { success: false, message: 'Invalid OTP' };
    }

    const res = await withCoreRetry(
      async () =>
        apiClient.post<{ success: boolean; token?: string; message?: string; userType?: string; needsRegistration?: boolean }>(
          '/api/login/verify-otp',
          { phone, otp, fullhash, sessionId, deviceInfo },
          { headers: { 'Content-Type': 'application/json' } }
        ),
      { action: 'verify_otp', component: 'authService', metadata: { phone } }
    );
    return res.data;
  },
  async recordAppOpen(token: string, deviceInfo: DevicePayload) {
    try {
      const res = await apiClient.post<{ success: boolean; data?: { openCount: number } }>(
        '/api/dukandar/app-open',
        { deviceInfo },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data;
    } catch {
      return { success: false };
    }
  },
  /**
   * Permanently deletes the signed-in user's own account.
   *
   * The server derives the account from the JWT, so no id is sent — this can
   * only ever delete the caller. Required by App Store Guideline 5.1.1(v):
   * an app offering account creation must offer in-app deletion.
   *
   * Deletion cascades on the server (invoices, customers, shop details and
   * uploaded images) and cannot be undone. Errors are surfaced to the caller
   * so the UI can keep the user signed in rather than silently logging out.
   */
  async deleteOwnAccount(): Promise<void> {
    await apiClient.delete('/api/dukandar/me');
  },
};
