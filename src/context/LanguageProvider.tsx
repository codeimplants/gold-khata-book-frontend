import React, {
  createContext,
  useState,
  ReactNode,
  useEffect,
  useRef,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSelector } from "react-redux";
import { translations, Language } from "../localization";
import { InvoiceTemplate } from "../types";
import { apiClient } from "../api/apiClient";
import type { RootState } from "../store";

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  /**
   * Returns undefined when the key is in no locale at all — see the
   * implementation below.
   *
   * Declared as `T` rather than `T | undefined` deliberately. Every key used in
   * src/ resolves today (there is an audit note in the implementation), so the
   * undefined arm is reachable only through a runtime-built key. Widening the
   * type surfaces 70 call sites across 21 screens that feed `t()` straight into
   * a string-typed prop with no fallback; that is worth doing, but as its own
   * pass rather than riding along with a translation fix.
   */
  t: <T = any>(key: string) => T;
  /**
   * The language printed output uses — the PDF bill, the thermal receipt and
   * the old-gold declaration.
   *
   * Derived from the app language rather than settable on its own. It used to
   * be a separate setting, which meant switching the app to Marathi left every
   * printed document in English until you found a second control in Invoice /
   * Bill Settings; nobody expected that, and no shop was using the two
   * independently anyway.
   *
   * Kept as its own name rather than folded into `language` because call sites
   * saying "invoiceLanguage" state their intent, and this is exactly the seam a
   * per-print override would attach to if per-customer bill language is ever
   * wanted. That belongs on the print action, not back in global settings —
   * a shop-level setting is the wrong granularity for a per-customer choice.
   */
  invoiceLanguage: Language;
  /**
   * The language new declarations are written in, and the fallback for reading
   * back a declaration saved before the field existed.
   *
   * Unlike `invoiceLanguage` this IS settable on its own, because the two
   * genuinely differ: the shopkeeper reads the app, the customer signs the
   * declaration. A shop in Kolhapur runs the app in English and hands every
   * seller a Marathi affidavit — making them re-pick that per declaration would
   * be the wrong default. Follows the app language until explicitly set.
   */
  declarationLanguage: Language;
  setDeclarationLanguage: (lang: Language) => void;
  /** True once the shopkeeper has chosen a declaration language of their own,
   *  so Settings can show "Same as app language" rather than a false pick. */
  declarationLanguageIsExplicit: boolean;
  invoiceTemplate: InvoiceTemplate;
  setInvoiceTemplate: (template: InvoiceTemplate) => void;
};

export const LanguageContext = createContext<LanguageContextType>(
  {} as LanguageContextType
);

/**
 * Preferences that describe the SHOP, not the machine it is running on.
 *
 * These lived only in AsyncStorage — which is localStorage on web — so they
 * were per-device: a shop that picked a bill template on the counter PC still
 * saw the old one on the back-office PC, and no reload fixed it because nothing
 * ever sent them to a server. (A browser "Empty Cache and Hard Reload" does not
 * clear localStorage either, so that did not fix it and never could have.)
 *
 * They now live on the shop record. AsyncStorage is kept as the local mirror,
 * which is what makes the app usable offline, correct for guests who have no
 * shop record at all, and free of a flash of the wrong template on first paint
 * before the shop has loaded.
 *
 * The printer and paper settings deliberately stay device-local — see
 * store/printPrefs. A thermal printer is physically attached to one machine.
 */
const pushPreferences = async (prefs: {
  invoiceTemplate?: InvoiceTemplate;
  appLanguage?: Language;
  declarationLanguage?: Language;
}) => {
  try {
    await apiClient.put("/api/shopDetails/preferences", prefs);
  } catch (err) {
    // Deliberately swallowed. The local write has already happened, so this
    // device behaves exactly as it always did; only the sharing is lost, and
    // the next successful save carries it. Failing the whole settings save
    // because the shop's internet dropped would be a worse trade.
    console.warn("[LanguageProvider] could not save shop preferences:", err);
  }
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLangState] = useState<Language>("en");
  const [invoiceTemplate, setInvoiceTemplateState] = useState<InvoiceTemplate>("minimal");
  // `null` means "never chosen" — the declaration language then tracks the app
  // language, so an install that never opens this setting behaves exactly as it
  // did before the setting existed.
  const [declarationLangOverride, setDeclarationLangOverride] =
    useState<Language | null>(null);

  const shopDetails = useSelector((s: RootState) => s.data.shopDetails);
  const isGuest = useSelector((s: RootState) => s.auth.isGuest);

  /**
   * The last value each preference was seen to hold ON THE SERVER.
   *
   * Adopting "whenever the server value differs from local" would fight the
   * user: they pick a template, the push is in flight, redux still holds the
   * old shop, and the effect below would immediately put the old one back.
   * Comparing against the previous *server* value instead means a change is
   * adopted exactly once, when the server's answer actually changes — which is
   * precisely the other-computer case this exists for.
   */
  const lastServerValue = useRef<{
    invoiceTemplate?: string;
    appLanguage?: string;
    declarationLanguage?: string;
  }>({});

  useEffect(() => {
    const loadSettings = async () => {
      // `invoice_language` is deliberately not read. Installs that set it
      // before printed output followed the app language still carry the key;
      // it is left on disk rather than migrated because reading it would
      // reintroduce the split this change exists to remove.
      const [savedLang, savedTemplate, savedDeclarationLang] = await Promise.all([
        AsyncStorage.getItem("app_language"),
        AsyncStorage.getItem("invoice_template"),
        AsyncStorage.getItem("declaration_language"),
      ]);
      if (savedLang) setLangState(savedLang as Language);
      if (savedTemplate) setInvoiceTemplateState(savedTemplate as InvoiceTemplate);
      if (savedDeclarationLang) setDeclarationLangOverride(savedDeclarationLang as Language);
    };
    loadSettings();
  }, []);

  /**
   * Adopts the shop's stored preferences whenever the server's answer changes.
   *
   * This is the whole point of the feature: the other computer saved a bill
   * template, this one refetches the shop (on reload, or when a screen's
   * fetchShopDetails passes its staleness window) and picks the change up.
   *
   * A field the shop has never saved comes back undefined, and is skipped
   * rather than treated as "cleared" — an existing shop keeps whatever each
   * device already had until someone saves a preference, and that first save is
   * what makes the choice shared. Guests have no shop record, so nothing here
   * ever fires for them and AsyncStorage stays their only store.
   */
  useEffect(() => {
    if (isGuest || !shopDetails) return;

    const adopt = <T extends string>(
      key: "invoiceTemplate" | "appLanguage" | "declarationLanguage",
      value: T | undefined,
      apply: (v: T) => void,
      storageKey: string,
    ) => {
      if (!value) return;
      if (lastServerValue.current[key] === value) return;
      lastServerValue.current[key] = value;
      apply(value);
      AsyncStorage.setItem(storageKey, value).catch(() => {});
    };

    adopt("invoiceTemplate", shopDetails.invoiceTemplate, setInvoiceTemplateState, "invoice_template");
    adopt("appLanguage", shopDetails.appLanguage, setLangState, "app_language");
    adopt("declarationLanguage", shopDetails.declarationLanguage, setDeclarationLangOverride, "declaration_language");
  }, [
    isGuest,
    shopDetails?.invoiceTemplate,
    shopDetails?.appLanguage,
    shopDetails?.declarationLanguage,
  ]);

  // Each setter writes locally first, then shares. Local first because the
  // screen must respond at once and must keep working offline; the push is
  // what makes the choice reach the shop's other computers.
  const setLanguage = async (lang: Language) => {
    setLangState(lang);
    await AsyncStorage.setItem("app_language", lang);
    if (!isGuest) await pushPreferences({ appLanguage: lang });
  };

  const setDeclarationLanguage = async (lang: Language) => {
    setDeclarationLangOverride(lang);
    await AsyncStorage.setItem("declaration_language", lang);
    if (!isGuest) await pushPreferences({ declarationLanguage: lang });
  };

  const setInvoiceTemplate = async (template: InvoiceTemplate) => {
    setInvoiceTemplateState(template);
    await AsyncStorage.setItem("invoice_template", template);
    if (!isGuest) await pushPreferences({ invoiceTemplate: template });
  };

  /**
   * Reads a dotted key out of the active language, then English, then gives up.
   *
   * Two deliberate behaviours, both fixing raw dotted keys reaching the screen:
   *
   * English fallback — a string present in en.ts but not yet in hi/mr/gu used to
   * render as "orders.details.paymentDetails" for those shops. Half a screen in
   * English is a translation gap; a dotted key is a broken app. This mirrors
   * what the print templates already do (see `tp` in print/templates/shared.ts).
   *
   * `undefined` on a total miss — this used to return the key itself, which is
   * truthy, so the `t('k') || 'Fallback'` pattern used at 600+ call sites was
   * dead code and the key rendered instead of the fallback the author wrote.
   * Returning undefined makes every one of those fallbacks live. Callers that
   * pass no fallback render nothing rather than a dotted key; that only happens
   * when a key is missing from *every* locale, which is a code bug, so it warns
   * in development instead of failing quietly.
   */
  const t = <T = any>(key: string): T => {
    const read = (source: any) => {
      let value: any = source;
      key.split(".").forEach(k => { value = value?.[k]; });
      return value;
    };

    const value = read(translations[language]);
    if (value !== undefined && value !== null) return value as T;

    const english = read(translations.en);
    if (english !== undefined && english !== null) return english as T;

    // Reachable only for a key built at runtime: every literal key in src/ was
    // checked against all four locale files and resolves. Warns rather than
    // failing quietly, since the screen shows nothing at all in this case.
    if (__DEV__) {
      console.warn(`[i18n] missing key "${key}" — not in ${language} or en`);
    }
    return undefined as T;
  };

  return (
    <LanguageContext.Provider value={{
      language, setLanguage, t,
      invoiceLanguage: language,
      declarationLanguage: declarationLangOverride ?? language,
      setDeclarationLanguage,
      declarationLanguageIsExplicit: declarationLangOverride !== null,
      invoiceTemplate, setInvoiceTemplate,
    }}>
      {children}
    </LanguageContext.Provider>
  );
};
