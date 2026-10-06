import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  lookupItemType,
  normalise,
  resolveTaxonomy,
  type CustomItemGroup,
  type CustomItemType,
  type LanguageCode,
  type ResolvedItemType,
} from '@codeimplants/jewellery-catalog';

import { useTranslation } from '../../hooks/useTranslation';
import { useShopTaxonomy } from '../../hooks/useShopTaxonomy';
import { Brand } from '../../theme/brand';

/** The slice of a saved catalogue product the picker shows and searches. */
export interface PickerProduct {
  id: string;
  name: string;
  purity?: string;
  category?: string;
}

/** What a sale line gets back. */
export type ItemPick =
  | { kind: 'product'; productId: string; name: string }
  | { kind: 'itemType'; code: string; name: string }
  | { kind: 'text'; name: string };

type Row =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'product'; key: string; product: PickerProduct; score: number }
  | { kind: 'type'; key: string; type: ResolvedItemType; score: number }
  | { kind: 'useText'; key: string; text: string }
  | { kind: 'create'; key: string; text: string };

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Exact beats a leading match beats a word start beats anywhere in the word. */
const scoreText = (haystack: string | undefined, needle: string): number => {
  if (!haystack) return 0;
  const text = normalise(haystack);
  if (!text) return 0;
  if (text === needle) return 100;
  if (text.startsWith(needle)) return 80;
  if (new RegExp(`(^|\\s)${escapeRegExp(needle)}`, 'u').test(text)) return 60;
  if (text.includes(needle)) return 40;
  return 0;
};

const bestScore = (candidates: (string | undefined)[], needle: string) =>
  candidates.reduce((best, candidate) => Math.max(best, scoreText(candidate, needle)), 0);

/**
 * The item-name field's list: the shop's own catalogue first, then the master
 * list of ornaments, then whatever was typed.
 *
 * The search and the shop's own additions are SoneBill's ItemTypePicker logic
 * over the same shared package (`@codeimplants/jewellery-catalog`), which is
 * what the owner asked for. The screen is this app's own: the green Ledger
 * band, underlined group tabs, flat rows. App Review rejected the app as a
 * SoneBill copy under 4.3(a), so nothing here may look like SoneBill's
 * purple-chip picker.
 *
 * Read and searched in the shop's language. A Marathi shop sees "झुमका";
 * typing English letters ("jhumka") still finds it, because that is how most
 * shopkeepers type their own language on a phone. Nothing is compulsory:
 * "Use what I typed" is always offered.
 */
export default function ItemPicker({
  visible,
  onClose,
  products = [],
  onPick,
  initialQuery,
}: {
  visible: boolean;
  onClose: () => void;
  products?: PickerProduct[];
  onPick: (pick: ItemPick) => void;
  /** What is already in the field, so reopening continues the search. */
  initialQuery?: string;
}) {
  const { t, language } = useTranslation();
  const insets = useSafeAreaInsets();
  const { taxonomy, addCustomItemType, addCustomCategory } = useShopTaxonomy();
  const [query, setQuery] = useState('');
  const [pendingName, setPendingName] = useState<string | null>(null);
  /** Non-null while a group of the shop's own is being named. */
  const [newGroup, setNewGroup] = useState<string | null>(null);
  /** Narrows to one group. Works with the search, not instead of it. */
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const tx = (key: string, fallback: string, name?: string) =>
    ((t(`itemPicker.${key}`) as string) || fallback).replace('{name}', name ?? '');

  useEffect(() => {
    if (!visible) return;
    setQuery(initialQuery?.trim() ?? '');
    setActiveGroup(null);
    setPendingName(null);
    setNewGroup(null);
  }, [visible, initialQuery]);

  // A desktop browser gets a centred panel with wrapped group tabs (a row that
  // scrolls sideways has no affordance with a mouse). A phone, or a browser as
  // narrow as one, gets the full-screen list with tabs that swipe.
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const panel = isWeb && width >= 640;
  const lang = (['en', 'hi', 'mr', 'gu'].includes(language as string) ? language : 'en') as LanguageCode;

  const { groups, itemTypes } = useMemo(() => resolveTaxonomy(taxonomy, lang), [taxonomy, lang]);

  const rows = useMemo<Row[]>(() => {
    const typed = query.trim();
    const needle = normalise(typed);
    const typeInScope = (type: ResolvedItemType) => !activeGroup || type.group === activeGroup;

    if (needle) {
      const typeHits = itemTypes
        .filter(typeInScope)
        .map(type => ({ type, score: bestScore([type.name, type.names?.en, ...type.aliases], needle) }))
        .filter(hit => hit.score > 0);
      // Catalogue products carry no ornament type, so a group filter hides them.
      const productHits = activeGroup
        ? []
        : products
            .map(product => ({ product, score: bestScore([product.name, product.category], needle) }))
            .filter(hit => hit.score > 0);

      // The shop's own catalogue leads at an equal match: picking one fills the
      // line's purity and weight, which is why it was saved.
      const out: Row[] = [
        ...productHits.map<Row>(hit => ({ kind: 'product', key: `p-${hit.product.id}`, product: hit.product, score: hit.score + 5 })),
        ...typeHits.map<Row>(hit => ({ kind: 'type', key: `t-${hit.type.code}`, type: hit.type, score: hit.score })),
      ].sort((a, b) => {
        const sa = 'score' in a ? a.score : 0;
        const sb = 'score' in b ? b.score : 0;
        const la = a.kind === 'product' ? a.product.name : a.kind === 'type' ? a.type.name : '';
        const lb = b.kind === 'product' ? b.product.name : b.kind === 'type' ? b.type.name : '';
        return sb - sa || la.localeCompare(lb);
      });

      const exactType = out.some(r => r.kind === 'type' && normalise(r.type.name) === needle);
      const exactProduct = out.some(r => r.kind === 'product' && normalise(r.product.name) === needle);
      // "Use what I typed" first: the fastest way to fill a line, and it must
      // never be below a long list of near misses.
      const head: Row[] = exactProduct || exactType ? [] : [{ kind: 'useText', key: '__use__', text: typed }];
      const tail: Row[] = exactType ? [] : [{ kind: 'create', key: '__create__', text: typed }];
      return [...head, ...out, ...tail];
    }

    const out: Row[] = [];
    if (!activeGroup && products.length) {
      out.push({ kind: 'header', key: 'h-catalogue', label: tx('catalogue', 'Your catalogue') });
      for (const product of [...products].sort((a, b) => a.name.localeCompare(b.name))) {
        out.push({ kind: 'product', key: `p-${product.id}`, product, score: 0 });
      }
    }
    for (const group of groups) {
      if (activeGroup && group.code !== activeGroup) continue;
      const inGroup = itemTypes.filter(type => type.group === group.code);
      if (!inGroup.length) continue;
      if (!activeGroup) out.push({ kind: 'header', key: `h-${group.code}`, label: group.name });
      for (const type of inGroup) out.push({ kind: 'type', key: `t-${type.code}`, type, score: 0 });
    }
    return out;
    // tx reads t, which follows `language`, already covered by `lang`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, groups, itemTypes, lang, activeGroup, products]);

  const finish = () => {
    setQuery('');
    setActiveGroup(null);
    setPendingName(null);
    setNewGroup(null);
    onClose();
  };

  const pick = (p: ItemPick) => {
    onPick(p);
    finish();
  };

  const chooseType = (type: ResolvedItemType) => pick({ kind: 'itemType', code: type.code, name: type.name });

  /** Hands back the ornament just added, resolved against the saved list. */
  const finishWithNewType = (entry: CustomItemType, group?: CustomItemGroup) => {
    const resolved = lookupItemType(
      entry.code,
      {
        ...taxonomy,
        customGroups: group ? [...taxonomy.customGroups, group] : taxonomy.customGroups,
        customItemTypes: [...taxonomy.customItemTypes, entry],
      },
      lang,
    );
    if (resolved) chooseType(resolved);
    else pick({ kind: 'text', name: entry.name });
  };

  const createOwn = async (groupCode: string, name?: string) => {
    const label = (name ?? pendingName ?? '').trim();
    if (!label) return;
    finishWithNewType(await addCustomItemType(label, groupCode));
  };

  const createOwnGroup = async () => {
    const groupName = (newGroup ?? '').trim();
    const label = (pendingName ?? '').trim();
    if (!groupName || !label) return;
    const entry = await addCustomCategory(groupName, label);
    finishWithNewType(entry, { code: entry.group, name: groupName });
  };

  const groupTabs = (
    <>
      {[{ code: null as string | null, name: tx('all', 'All') }, ...groups].map(group => {
        const on = activeGroup === group.code;
        return (
          <Pressable
            key={group.code ?? '__all__'}
            // Tapping the active tab clears it, so a filter is never a trap.
            onPress={() => setActiveGroup(on || group.code === null ? null : group.code)}
            style={styles.tab}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.tabText, on && styles.tabTextOn]}>{group.name}</Text>
            <View style={[styles.tabLine, on && styles.tabLineOn]} />
          </Pressable>
        );
      })}
    </>
  );

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === 'header') return <Text style={styles.header}>{item.label}</Text>;

    if (item.kind === 'useText') {
      return (
        <Pressable style={styles.action} onPress={() => pick({ kind: 'text', name: item.text })}>
          <Text style={styles.actionText}>{tx('useTyped', 'Use “{name}”', item.text)}</Text>
          <Text style={styles.actionHint}>{tx('useTypedSub', 'This sale only')}</Text>
        </Pressable>
      );
    }

    if (item.kind === 'create') {
      return (
        <Pressable
          style={styles.action}
          // With a group already chosen, asking which group to file it under
          // is a question the shop has just answered.
          onPress={() => (activeGroup ? createOwn(activeGroup, item.text) : setPendingName(item.text))}
        >
          <Text style={styles.actionText}>{tx('saveOwn', '+ Add “{name}” to the list', item.text)}</Text>
          <Text style={styles.actionHint}>{tx('saveOwnSub', 'Not in the list. It is saved as your own ornament.')}</Text>
        </Pressable>
      );
    }

    if (item.kind === 'product') {
      const { product } = item;
      const detail = [product.purity, product.category].filter(Boolean).join(' · ');
      return (
        <Pressable style={styles.row} onPress={() => pick({ kind: 'product', productId: product.id, name: product.name })}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowName}>{product.name}</Text>
            {!!detail && <Text style={styles.rowAlt}>{detail}</Text>}
          </View>
          <Text style={styles.badge}>{tx('inCatalogue', 'Catalogue')}</Text>
        </Pressable>
      );
    }

    const { type } = item;
    const english = type.names?.en && lang !== 'en' && type.names.en !== type.name ? type.names.en : undefined;
    return (
      <Pressable style={styles.row} onPress={() => chooseType(type)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowName}>{type.name}</Text>
          {!!english && <Text style={styles.rowAlt}>{english}</Text>}
        </View>
        {type.custom && <Text style={styles.badge}>{tx('yours', 'Yours')}</Text>}
      </Pressable>
    );
  };

  const body = (
    <>
      {/* The Ledger band: green, with the gold rule under it, as every header. */}
      <View style={[styles.band, !panel && { paddingTop: insets.top + 10 }]}>
        <Text style={styles.title} numberOfLines={1}>{tx('title', 'Item name')}</Text>
        <Pressable onPress={finish} hitSlop={10} accessibilityLabel={tx('close', 'Close')} style={styles.close}>
          <X size={20} color="#FFFFFF" />
        </Pressable>
      </View>
      <View style={styles.rule} />

      {pendingName ? (
        <View style={styles.pane}>
          <Text style={styles.paneTitle}>{tx('whichCategory', 'Which group is “{name}” in?', pendingName)}</Text>
          {newGroup === null ? (
            <>
              <Pressable style={styles.action} onPress={() => setNewGroup('')}>
                <Text style={styles.actionText}>{tx('newCategory', '+ A new group of your own')}</Text>
                <Text style={styles.actionHint}>{tx('newCategorySub', 'For ornaments that fit none of these')}</Text>
              </Pressable>
              <FlatList
                data={groups}
                keyExtractor={g => g.code}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable style={styles.row} onPress={() => createOwn(item.code)}>
                    <Text style={[styles.rowName, { flex: 1 }]}>{item.name}</Text>
                    {item.custom && <Text style={styles.badge}>{tx('yours', 'Yours')}</Text>}
                  </Pressable>
                )}
              />
            </>
          ) : (
            <View>
              <View style={styles.searchBox}>
                <TextInput
                  value={newGroup}
                  onChangeText={setNewGroup}
                  placeholder={tx('newCategoryPlaceholder', 'Group name, e.g. Antique')}
                  placeholderTextColor={Brand.inkFaint}
                  style={styles.searchInput}
                  autoFocus
                  onSubmitEditing={createOwnGroup}
                />
              </View>
              <Pressable
                style={[styles.action, !newGroup.trim() && { opacity: 0.4 }]}
                disabled={!newGroup.trim()}
                onPress={createOwnGroup}
              >
                <Text style={styles.actionText}>{tx('createCategory', 'Create “{name}” and add this ornament to it', newGroup.trim())}</Text>
              </Pressable>
            </View>
          )}
          <Pressable style={styles.back} onPress={() => (newGroup === null ? setPendingName(null) : setNewGroup(null))}>
            <Text style={styles.backText}>{tx('back', 'Back')}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.searchBox}>
            <Search size={18} color={Brand.inkFaint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={tx('search', 'Search your catalogue or the ornament list')}
              placeholderTextColor={Brand.inkFaint}
              style={styles.searchInput}
              autoCorrect={false}
              autoFocus
              // Enter on a typed name uses it as-is: the fastest path for a
              // shop that just wants the line filled.
              onSubmitEditing={() => { if (query.trim()) pick({ kind: 'text', name: query.trim() }); }}
              returnKeyType="done"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel={tx('clear', 'Clear')}>
                <X size={16} color={Brand.inkFaint} />
              </Pressable>
            )}
          </View>

          {/* Wrapped on web, scrolled on a phone: a sideways-scrolling row has
              no affordance with a mouse. */}
          <View style={styles.tabsBar}>
            {panel ? (
              <View style={styles.tabsWrap}>{groupTabs}</View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow} keyboardShouldPersistTaps="handled">
                {groupTabs}
              </ScrollView>
            )}
          </View>

          <FlatList
            data={rows}
            keyExtractor={r => r.key}
            renderItem={renderRow}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: (panel ? 16 : insets.bottom) + 24 }}
          />
        </>
      )}
    </>
  );

  if (!panel) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={finish}>
        <View style={styles.screen}>{body}</View>
      </Modal>
    );
  }

  // On a desktop the phone layout would span the viewport, so it becomes a
  // centred panel. The backdrop WRAPS the panel: a sibling click-catcher would
  // paint above it whatever the DOM order.
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={finish} transparent>
      <Pressable style={styles.backdrop} onPress={finish} accessibilityLabel={tx('close', 'Close')}>
        <Pressable style={styles.panel} onPress={() => {}}>
          {body}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.paper },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(29, 27, 22, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  panel: {
    // Sized by flex, not by a height: inside RNW's Modal every ancestor is a
    // flex item, so a percentage or a not-yet-measured height clips to zero.
    flex: 1,
    width: '100%',
    maxWidth: 560,
    minHeight: 320,
    backgroundColor: Brand.paper,
    borderRadius: 12,
    overflow: 'hidden',
  },
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  title: { flex: 1, color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  rule: { height: 3, backgroundColor: Brand.goldFill },
  close: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 48,
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.lineStrong,
    borderRadius: 8,
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: 16, color: Brand.ink, paddingVertical: 0 },
  tabsBar: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Brand.line },
  tabsRow: { paddingHorizontal: 12, flexDirection: 'row' },
  tabsWrap: { paddingHorizontal: 12, flexDirection: 'row', flexWrap: 'wrap' },
  tab: { paddingHorizontal: 8, paddingTop: 8 },
  tabText: { fontSize: 14, color: Brand.inkMuted, fontWeight: '600' },
  tabTextOn: { color: Brand.primary },
  tabLine: { height: 2, marginTop: 6, borderRadius: 1, backgroundColor: 'transparent' },
  tabLineOn: { backgroundColor: Brand.goldFill },
  header: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 6,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Brand.goldDark,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: Brand.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.line,
  },
  rowName: { fontSize: 15, color: Brand.ink, fontWeight: '600' },
  rowAlt: { fontSize: 12, color: Brand.inkMuted, marginTop: 2 },
  badge: {
    fontSize: 10,
    color: Brand.goldDark,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: Brand.goldLight,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 8,
    textTransform: 'uppercase',
  },
  action: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: Brand.primaryTint,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.line,
  },
  actionText: { fontSize: 15, color: Brand.primary, fontWeight: '700' },
  actionHint: { fontSize: 12, color: Brand.inkMuted, marginTop: 2 },
  pane: { flex: 1 },
  paneTitle: { padding: 16, fontSize: 15, fontWeight: '700', color: Brand.ink },
  back: { padding: 16, alignItems: 'center' },
  backText: { color: Brand.inkMuted, fontSize: 15, fontWeight: '600' },
});
