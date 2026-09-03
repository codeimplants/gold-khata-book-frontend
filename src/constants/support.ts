import { SupportConfig } from "@codeimplants/support";
import { buildErrorContext, formatErrorForSupport } from "@codeimplants/ui-kit";
import type { SupportContact } from "@codeimplants/ui-kit";
import { supportEmail, supportPhone, supportWhatsapp } from "@config";

export const supportConfig: SupportConfig = {
    whatsapp: {
        number: supportWhatsapp,
        messageTemplate: 'Hello, I need help with the app.',
    },
    email: {
        address: supportEmail,
        subjectTemplate: 'App Support Request',
    },
    phone: {
        number: supportPhone,
    },
    platformOverrides: {
        web: {
            email: { address: supportEmail },
        },
    },
};

/**
 * The screens that can send a support request, spelled the way they appear on
 * the "Screen:" line support reads. Kept as a union so a call site can't
 * quietly invent a seventh name that nobody recognises on the other end.
 */
export type SupportScreen =
    | 'App Crash'
    | 'API Error'
    | 'Network Offline'
    | 'Slow Connection'
    | 'System Maintenance'
    | 'Force Update'
    | 'Soft Update';

/**
 * What goes on the report's "Error:" line when the screen has no real error
 * text of its own. Without these the line just repeated the screen name back.
 */
const DEFAULT_REASON: Record<SupportScreen, string> = {
    'App Crash': 'The app closed unexpectedly',
    'API Error': 'A request to the server failed',
    'Network Offline': 'No internet connection',
    'Slow Connection': 'Slow or unstable connection',
    'System Maintenance': 'The app is under maintenance',
    'Force Update': 'An update is required to continue',
    'Soft Update': 'An update is available',
};

/**
 * Support contacts for a ui-kit screen, with the WhatsApp chat and mail draft
 * pre-filled with which screen the user was on plus app version, platform, OS,
 * and time.
 *
 * Without this the tray opened an empty chat, so every conversation started
 * with support asking what happened and what version they were on — the two
 * things needed to reproduce anything, and the two things a user reporting a
 * crash is least able to answer.
 *
 * The report is built by the ui-kit's own `formatErrorForSupport` rather than a
 * local template, so the shape stays identical across every app using the kit.
 * It draws the version from `initializeUIKit()` in App.tsx — if that call ever
 * goes away, every report silently reverts to claiming "App Version: 1.0.0".
 */
export function buildSupportProp(
    screenName: SupportScreen,
    details?: { errorMessage?: string; errorCode?: string },
): SupportContact {
    const context = buildErrorContext(details?.errorMessage || DEFAULT_REASON[screenName], {
        screenName,
        errorCode: details?.errorCode,
    });
    const report = formatErrorForSupport(context);

    return {
        whatsapp: {
            number: supportWhatsapp,
            label: 'Chat Support',
            message: report,
        },
        email: {
            address: supportEmail,
            label: 'Email Us',
            subject: `App Support Request — ${screenName}`,
            // WhatsApp renders *text* as bold; a mail client shows the literal
            // asterisks, so drop them here.
            body: report.replace(/\*/g, ''),
        },
        phone: {
            number: supportPhone,
            label: 'Call Us',
        },
    };
}
