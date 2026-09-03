import React, { useEffect, useRef, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import {
  Box,
  Pressable,
  ScrollView,
  Text,
  VStack,
  Icon,
} from "@gluestack-ui/themed";
import {
  Modal,
  Platform,
  TouchableOpacity,
  View,
  StyleSheet,
  Image as RNImage,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import CommonHeader from "../../components/CommonHeader";
import ConfirmModal from "../../components/ConfirmModal";
import { Check, Eye, X, ImageOff } from "lucide-react-native";
import { useTranslation } from "../../hooks/useTranslation";
import { useAppSelector } from "../../store/hooks";
import { buildBillHTML } from "../../print/billTemplate";
import { InvoiceTemplate, JewelleryFormValues } from "../../types";
import type { Language } from "../../localization";
import { LAYOUT } from "../../constants/layout";
import { getFullImageUrl } from "../../utils/imageUtils";

/**
 * The templates that print the shop's header themselves, onto blank paper.
 *
 * The picker is grouped by WHO puts the shop's details on the page — us in one
 * of these styles, the press onto the shop's own stationery, or us from a banner
 * the shop uploaded. Grouping by that rather than by looks is what makes the
 * choice answerable: the three options are otherwise near-indistinguishable in a
 * flat grid, and picking wrong produces a bill with no shop name on it.
 *
 * Style names stay in English as labels; `descKey` points at translated copy.
 */
const STYLED_TEMPLATES: Array<{
  id: InvoiceTemplate;
  label: string;
  descKey: string;
  color: string;
}> = [
  { id: "minimal",     label: "Minimal",        descKey: "descMinimal",     color: "#1a1a1a" },
  { id: "traditional", label: "Traditional",    descKey: "descTraditional", color: "#c85a00" },
  { id: "modern",      label: "Modern Premium", descKey: "descModern",      color: "#b8870a" },
  { id: "classic",     label: "Classic",        descKey: "descClassic",     color: "#1e3a5f" },
  // The formal GST layout, in the two treatments a shop actually chooses between.
  { id: "taxInvoiceColor", label: "Professional",      descKey: "descTaxColor", color: "#1e3a5f" },
  { id: "taxInvoiceBold",  label: "Professional Bold", descKey: "descTaxBold",  color: "#000000" },
];

const LANGS: Array<{ id: Language; label: string }> = [
  { id: "en", label: "EN" },
  { id: "mr", label: "मराठी" },
  { id: "hi", label: "हिंदी" },
  { id: "gu", label: "ગુ" },
];

const SAMPLE_VALUES: JewelleryFormValues = {
  invoiceDate: new Date().toLocaleDateString("en-IN"),
  customerName: "Ramesh Patil",
  address: "Pune, Maharashtra",
  phone: "9876543210",
  includeGst: true,
  items: [
    {
      id: "i1",
      itemName: "Gold Necklace",
      metalType: "Gold",
      purity: "22K",
      pcs: "1",
      grossWt: "12.500",
      lessWt: "1.300",
      netWt: "11.200",
      ratePerGm: "6500",
      makingChargeType: "Per Gram",
      // 320, not 350, so `itemTotal` below is a figure the real calculator would
      // actually produce from these inputs. getItemComponents charges per-gram
      // making on GROSS weight, so this is 12.500 x 320 = 4,000 — and note the
      // preview prints the metal value and the making separately above the
      // subtotal, so a rate that does not reconcile is visible on the page.
      makingCharges: "320",
      otherChargesDescription: "Hallmark",
      otherChargesAmount: "2000",
      discountType: "Fixed",
      discount: "100",
      // 72,800 metal (11.200 x 6500) + 4,000 making + 2,000 hallmark - 100
      // discount. Every figure below is derived from this one, so changing any
      // weight or rate above means recomputing the whole chain.
      itemTotal: "78700",
    },
  ],
  // The sample deliberately carries one of everything — other charges, a
  // discount, an old-gold exchange and two advance payments — because the
  // preview is where a shopkeeper decides which template to print on, and they
  // cannot judge that from a bill showing only an item and a total. Every line
  // type they will ever see has to be on the page.
  exchanges: [
    {
      id: "x1",
      itemName: "Old Gold Bangle",
      type: "Gold",
      netWt: "5.000",
      purity: "22K",
      ratePerGm: "6000",
      // 5.000 x 6,000 = 30,000, so the deduction reconciles with its own detail.
      amount: "30000",
    } as any,
  ],
  enableExchange: true,
  // 78,700 items - 30,000 exchange. This is the figure GST is charged on:
  // calculateFormTotals taxes the post-exchange amount, not the item total.
  subtotal: "48700",
  gst: "1461",
  // Must match `gst` above, or every preview prints a rate that contradicts the
  // amount beside it. 3% is the app's GST_RATE (src/constants/bill.ts) and the
  // default in every real bill path, and 1,461 is 3% of the 48,700 subtotal.
  gstPercentage: 3,
  // 48,700 + 1,461.
  grandTotal: "50161",
  // One instalment, not several. The sample carries one of each LINE TYPE so a
  // shopkeeper can see how every kind of row prints, but a second payment only
  // repeats a row they have already seen — it is the one line here that adds
  // length without adding information.
  //
  // `estimatedBalance` is left at 0 on purpose: advanceBalanceDue then falls
  // back to grandTotal - paid = 20,161, which is the arithmetic already on the
  // page rather than a second figure to keep in step with it.
  paymentSummary: {
    amountPaid: "30000",
    bookingRate: "6500",
    weightCovered: "4.615",
    remainingWeight: "6.585",
    totalWeight: "11.200",
    estimatedBalance: "0",
    payments: [{ id: "p1", amount: "30000", date: "01/08/2026" }],
  },
};

const Card = ({ children }: { children: React.ReactNode }) => (
  <Box
    bg="$white"
    rounded="$2xl"
    borderWidth={1}
    borderColor="$coolGray100"
    hardShadow="1"
    style={{ padding: 16 }}
  >
    {children}
  </Box>
);

/** Heading + explanation for one of the three "who prints the header" groups. */
const SectionHeading = ({ title, desc }: { title: string; desc: string }) => (
  <VStack style={{ gap: 4, marginBottom: 12 }}>
    <Text fontWeight="$bold" color="$coolGray900" style={{ fontSize: 16, lineHeight: 21 }}>
      {title}
    </Text>
    <Text color="$coolGray500" style={{ fontSize: 13, lineHeight: 18 }}>
      {desc}
    </Text>
  </VStack>
);

const InvoiceBillSettingsScreen = () => {
  const navigation = useNavigation();
  const { t, invoiceLanguage, invoiceTemplate, setInvoiceTemplate } =
    useTranslation();
  const { shopDetails } = useAppSelector((s) => s.data);
  // The pre-printed template suppresses the shop header entirely, so choosing it
  // without telling us where the printed header ends produces a bill with no shop
  // name or GSTIN — not a lesser invoice, an invalid one. Header Space is the
  // measurement that makes it usable, so it is what unlocks it. Gated on the
  // reserve rather than on custom page size because most letterhead is plain A4.
  const paper = useAppSelector((s) => s.printPrefs.paper);
  const hasHeaderReserve = paper.headerReserveMm > 0;
  // A tax invoice is a legal document carrying a GSTIN and a declaration. Guest
  // data lives only on the device and is lost with the app, which is the wrong
  // footing for the one bill a shop may have to produce for an assessment — so
  // these templates require an account.
  const isGuest = useAppSelector((s) => s.auth.isGuest);

  const tt = (key: string) => t(`invoiceTemplates.${key}`);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<InvoiceTemplate>("minimal");
  const [previewLang, setPreviewLang] = useState<Language>("en");

  /**
   * Template edits are staged here rather than committed on tap.
   *
   * They used to persist the instant a card was pressed, which left the Save
   * button doing nothing but goBack() — it looked like a commit step while the
   * change had already happened, so there was no way to change your mind and
   * nothing for the button to actually do.
   */
  const [draftTemplate, setDraftTemplate] = useState<InvoiceTemplate>(invoiceTemplate);
  const [saving, setSaving] = useState(false);
  const [discardVisible, setDiscardVisible] = useState(false);

  // The template arrives from AsyncStorage after first paint, so the draft has
  // to pick it up once it lands — otherwise the screen opens on "minimal" and
  // reports itself dirty against the shop's real choice.
  useEffect(() => {
    setDraftTemplate(invoiceTemplate);
  }, [invoiceTemplate]);

  const isDirty = draftTemplate !== invoiceTemplate;

  /**
   * Lets a navigation we triggered ourselves through the beforeRemove guard.
   * A ref rather than state because the guard reads it in the same tick the
   * navigation is dispatched, before a re-render could deliver a new value.
   */
  const bypassGuard = useRef(false);
  const pendingAction = useRef<any>(null);

  useEffect(() => {
    // beforeRemove rather than the header's back handler alone: this also
    // covers the Android hardware button and the iOS swipe-back gesture, which
    // would otherwise drop the edit silently.
    const unsubscribe = (navigation as any).addListener('beforeRemove', (e: any) => {
      if (!isDirty || bypassGuard.current) return;
      e.preventDefault();
      pendingAction.current = e.data?.action;
      setDiscardVisible(true);
    });
    return unsubscribe;
  }, [navigation, isDirty]);

  /**
   * Completes whatever navigation the guard interrupted. Replays the original
   * action when there was one — a hardware back or a swipe may have been
   * heading somewhere other than the previous screen, and goBack() would send
   * the shopkeeper to the wrong place.
   */
  const leave = () => {
    bypassGuard.current = true;
    const action = pendingAction.current;
    pendingAction.current = null;
    if (action) {
      (navigation as any).dispatch(action);
    } else {
      navigation.goBack();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await setInvoiceTemplate(draftTemplate);
    setSaving(false);
    leave();
  };

  const handleDiscard = () => {
    setDiscardVisible(false);
    setDraftTemplate(invoiceTemplate);
    leave();
  };

  const lightRowBorder = "#E5E7EB";
  const purple = "#6D5EF7";

  const hasShopHeader = Boolean(shopDetails?.shopHeader);
  const shopHeaderUri = getFullImageUrl(shopDetails?.shopHeader);

  /** Both options that depend on something being configured elsewhere. */
  const isTaxInvoice = (id: InvoiceTemplate) =>
    id === "taxInvoiceColor" || id === "taxInvoiceBold" || id === "taxInvoiceLetterhead";

  const isLocked = (id: InvoiceTemplate) =>
    (isTaxInvoice(id) && isGuest) ||
    (id === "shopHeader" && !hasShopHeader) ||
    ((id === "letterhead" || id === "taxInvoiceLetterhead") && !hasHeaderReserve);

  /** Why a tile is locked, so the shopkeeper knows what to go and do. */
  const lockedReason = (id: InvoiceTemplate) =>
    isTaxInvoice(id) && isGuest ? tt("loginRequired") : tt("prePrintedLocked");

  const selectTemplate = (id: InvoiceTemplate) => {
    if (isLocked(id)) return;
    setDraftTemplate(id);
  };

  const openPreview = (template: InvoiceTemplate) => {
    if (isLocked(template)) return;
    setPreviewTemplate(template);
    setPreviewLang(invoiceLanguage);
    setPreviewOpen(true);
  };

  /**
   * One tile. Shared by all three groups so a locked option looks and behaves
   * identically whichever section it is in — the banner tile used to compare
   * against `invoiceTemplate` while the others used `draftTemplate`, so its tick
   * moved a beat out of step with the rest.
   */
  const renderTile = (opts: {
    id: InvoiceTemplate;
    label: string;
    desc: string;
    swatch: React.ReactNode;
    locked?: boolean;
    wide?: boolean;
  }) => {
    const { id, label, desc, swatch, locked = false, wide = false } = opts;
    const selected = draftTemplate === id;
    return (
      <TouchableOpacity
        key={id}
        activeOpacity={locked ? 1 : 0.8}
        onPress={() => selectTemplate(id)}
        style={[
          styles.templateCard,
          wide && styles.wideCard,
          locked && { opacity: 0.6 },
          selected && !locked && { borderColor: purple, borderWidth: 2 },
        ]}
      >
        {swatch}
        <View style={styles.templateCardBody}>
          <View style={styles.templateCardHeader}>
            <Text fontWeight="$semibold" color="$coolGray900" style={{ fontSize: 13 }}>
              {label}
            </Text>
            {selected && !locked && <Icon as={Check} size="sm" color={purple} />}
          </View>
          <Text color="$coolGray500" style={{ fontSize: 11, lineHeight: 14, marginTop: 2 }}>
            {desc}
          </Text>
          {locked ? (
            <View style={styles.previewBtn}>
              <Icon as={ImageOff} size="xs" color="#9CA3AF" />
              <Text color="#9CA3AF" style={{ fontSize: 11, marginLeft: 3, fontWeight: "600" }}>
                {tt("notAvailable")}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.previewBtn}
              onPress={() => openPreview(id)}
              activeOpacity={0.7}
            >
              <Icon as={Eye} size="xs" color={purple} />
              <Text color={purple} style={{ fontSize: 11, marginLeft: 3, fontWeight: "600" }}>
                {tt("preview")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const previewHTML = buildBillHTML(
    SAMPLE_VALUES,
    {
      billNo: "SB-0001",
      billDate: new Date().toLocaleDateString("en-IN"),
      mode: "preview",
      shopDetails,
    },
    previewLang,
    previewTemplate,
  );

  return (
    <Box flex={1} bg="$coolGray50">
      <CommonHeader
        title={tt("screenTitle")}
        subtitle={tt("screenSubtitle")}
        variant="light"
        showBack
        onPressBack={() => navigation.goBack()}
      />

      <ScrollView
        flex={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 28,
          ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}),
        }}
      >
        {/* ---- 1. Blank paper — we print the shop's header ---- */}
        <Card>
          <SectionHeading
            title={tt("groupStandardTitle")}
            desc={tt("groupStandardDesc")}
          />
          <View style={styles.templateGrid}>
            {STYLED_TEMPLATES.map((tpl) =>
              renderTile({
                id: tpl.id,
                label: tpl.label,
                desc: isLocked(tpl.id) ? lockedReason(tpl.id) : tt(tpl.descKey),
                swatch: <View style={[styles.swatch, { backgroundColor: tpl.color }]} />,
                locked: isLocked(tpl.id),
              }),
            )}
          </View>
        </Card>

        <Box mt="$4" />

        {/* ---- 2. The shop's own pre-printed stationery ---- */}
        <Card>
          <SectionHeading
            title={tt("groupPrePrintedTitle")}
            desc={tt("groupPrePrintedDesc")}
          />
          <View style={styles.templateGrid}>
            {renderTile({
              id: "letterhead",
              label: tt("prePrintedLabel"),
              desc: isLocked("letterhead") ? lockedReason("letterhead") : tt("prePrintedDesc"),
              swatch: <View style={[styles.swatch, { backgroundColor: "#4b5563" }]} />,
              locked: isLocked("letterhead"),
            })}
            {renderTile({
              id: "taxInvoiceLetterhead",
              label: tt("prePrintedTaxLabel"),
              desc: isLocked("taxInvoiceLetterhead")
                ? lockedReason("taxInvoiceLetterhead")
                : tt("prePrintedTaxDesc"),
              swatch: <View style={[styles.swatch, { backgroundColor: "#000000" }]} />,
              locked: isLocked("taxInvoiceLetterhead"),
            })}
          </View>
          {!hasHeaderReserve ? (
            <>
              <Text color="$coolGray500" style={{ fontSize: 12, lineHeight: 17, marginTop: 10 }}>
                {tt("prePrintedHint")}
              </Text>
              {/* The hint alone left shopkeepers hunting for a screen they had
                  arguably already visited — page size and header space are
                  different fields, and setting the first does not unlock this. */}
              <TouchableOpacity
                onPress={() => navigation.navigate("PrintSettings" as never)}
                activeOpacity={0.7}
                style={{ marginTop: 10, alignSelf: "flex-start" }}
              >
                <Text color={purple} style={{ fontSize: 13, fontWeight: "700" }}>
                  {tt("openPrintSettings")}
                </Text>
              </TouchableOpacity>
            </>
          ) : null}
        </Card>

        <Box mt="$4" />

        {/* ---- 3. Blank paper — we print the shop's own header IMAGE ---- */}
        <Card>
          <SectionHeading
            title={tt("groupBannerTitle")}
            desc={tt("groupBannerDesc")}
          />
          <View style={styles.templateGrid}>
            {renderTile({
              id: "shopHeader",
              label: tt("bannerLabel"),
              desc: hasShopHeader ? tt("bannerDescHas") : tt("bannerDescMissing"),
              swatch:
                hasShopHeader && shopHeaderUri ? (
                  <RNImage
                    source={{ uri: shopHeaderUri }}
                    style={styles.swatch}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.swatch, { backgroundColor: "#E5E7EB" }]} />
                ),
              locked: !hasShopHeader,
              wide: true,
            })}
          </View>
          {!hasShopHeader ? (
            <TouchableOpacity
              onPress={() => navigation.navigate("AddShopDetails" as never)}
              activeOpacity={0.7}
              style={{ marginTop: 10, alignSelf: "flex-start" }}
            >
              <Text color={purple} style={{ fontSize: 13, fontWeight: "700" }}>
                {tt("openShopDetails")}
              </Text>
            </TouchableOpacity>
          ) : null}
        </Card>

        <Box mt="$4" />

        <Pressable
          bg={isDirty ? purple : "#C7C9D9"}
          rounded="$xl"
          alignItems="center"
          justifyContent="center"
          style={{ height: 56 }}
          disabled={!isDirty || saving}
          onPress={handleSave}
        >
          <Text color="$white" fontWeight="$bold" style={{ fontSize: 20 }}>
            {saving ? tt("saving") : tt("saveBtn")}
          </Text>
        </Pressable>
      </ScrollView>

      {/* Template Preview Modal */}
      <Modal
        visible={previewOpen}
        animationType="slide"
        onRequestClose={() => setPreviewOpen(false)}
      >
        <SafeAreaView style={styles.modal} edges={["top", "bottom"]}>
          {/* Modal header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>
                {previewTemplate === "shopHeader"
                  ? tt("bannerLabel")
                  : previewTemplate === "letterhead"
                    ? tt("prePrintedLabel")
                    : STYLED_TEMPLATES.find((tpl) => tpl.id === previewTemplate)?.label}{" "}
                — {tt("preview")}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setPreviewOpen(false)} style={styles.closeBtn}>
              <Icon as={X} size="md" color="#374151" />
            </TouchableOpacity>
          </View>

          {/* Language switcher */}
          <View style={styles.langRow}>
            {LANGS.map((lang) => (
              <TouchableOpacity
                key={lang.id}
                onPress={() => setPreviewLang(lang.id)}
                style={[
                  styles.langChip,
                  previewLang === lang.id
                    ? { backgroundColor: purple, borderColor: purple }
                    : { backgroundColor: "#fff", borderColor: lightRowBorder },
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.langChipText,
                    { color: previewLang === lang.id ? "#fff" : "#374151" },
                  ]}
                >
                  {lang.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* WebView (native) / iframe (web) */}
          <View style={styles.webviewContainer}>
            {Platform.OS === 'web' ? (
              <iframe
                key={`${previewTemplate}-${previewLang}`}
                srcDoc={previewHTML}
                style={{ flex: 1, border: 'none', width: '100%', height: '100%' } as any}
                title={tt("previewFrameTitle")}
              />
            ) : (
              <WebView
                key={`${previewTemplate}-${previewLang}`}
                source={{ html: previewHTML }}
                style={{ flex: 1 }}
                scrollEnabled
                originWhitelist={["*"]}
              />
            )}
          </View>

          {/* Action buttons */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.footerBtn, { backgroundColor: purple }]}
              onPress={() => {
                setInvoiceTemplate(previewTemplate);
                setPreviewOpen(false);
              }}
              activeOpacity={0.85}
            >
              <Icon as={Check} size="sm" color="#fff" />
              <Text style={[styles.footerBtnText, { color: "#fff", marginLeft: 6 }]}>
                {tt("useThisTemplate")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.footerBtn, { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" }]}
              onPress={() => setPreviewOpen(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.footerBtnText, { color: "#374151" }]}>{tt("close")}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Leaving with an unsaved template choice. Offers the save as the
          primary action rather than only "discard": someone who reached the
          back button with a change pending almost always meant to keep it. */}
      <ConfirmModal
        visible={discardVisible}
        onClose={() => setDiscardVisible(false)}
        tone="destructive"
        icon="alert"
        title={tt("discardTitle")}
        description={
          <Text style={{ fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 20 }}>
            {tt("discardBody")}
          </Text>
        }
        confirmLabel={tt("discardConfirm")}
        cancelLabel={tt("discardCancel")}
        onConfirm={handleDiscard}
        tertiaryLabel={tt("discardSave")}
        onTertiary={async () => {
          setDiscardVisible(false);
          await handleSave();
        }}
      />
    </Box>
  );
};

const styles = StyleSheet.create({
  templateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  // The two grouped-alone options (pre-printed, banner) sit one per section, so
  // they take the full width rather than leaving a gap beside them.
  wideCard: {
    width: "100%",
  },
  templateCard: {
    width: "48%",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  swatch: {
    height: 10,
  },
  templateCardBody: {
    padding: 10,
  },
  templateCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  langChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  langChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  langRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexWrap: "wrap",
  },
  modal: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  closeBtn: {
    padding: 6,
  },
  webviewContainer: {
    flex: 1,
    margin: 12,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  modalFooter: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  footerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
  },
  footerBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
});

export default InvoiceBillSettingsScreen;
