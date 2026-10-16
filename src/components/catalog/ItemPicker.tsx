import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { ChevronLeft, Clock, Plus, Search, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  lookupItemType,
  normalise,
  resolveTaxonomy,
  type CustomItemGroup,
  type CustomItemType,
  type LanguageCode,
  type MetalCode,
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

/** The pseudo-group the shop's own saved products are browsed under. */
const CATALOGUE = '__catalogue__';

/** How many recent picks the strip at the top keeps. */
const RECENT_MAX = 10;

/**
 * Recent picks are kept per METAL, because a silver line and a gold line are
 * reached for differently: the shop that sells payal in silver and chains in
 * gold should see each where it uses it. On the device, like the shop's own
 * additions to the list (useShopTaxonomy).
 */
const recentKey = (metal?: MetalCode) => `@itemPicker_recent_v1:${metal || 'any'}`;

const pickKey = (p: ItemPick) =>
  p.kind === 'product' ? `p:${p.productId}` : p.kind === 'itemType' ? `t:${p.code}` : `x:${normalise(p.name)}`;

const isPick = (v: any): v is ItemPick =>
  !!v && typeof v.name === 'string' && v.name.trim().length > 0 &&
  (v.kind === 'text' || (v.kind === 'product' && typeof v.productId === 'string') || (v.kind === 'itemType' && typeof v.code === 'string'));

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
 * The item-name field's picker: what this shop picked recently, the ornament
 * groups as tiles, and search over the shop's own catalogue and the master
 * list of ornaments, or whatever was typed.
 *
 * Browsing is two levels, the way the list is built: a group tile (Rings,
 * Payal, Utensils) opens to its ornaments as tiles. The owner asked for tiles
 * over the long grouped list this used to be, because a counter picks by
 * shape and a grid of a dozen groups is one glance where the list was a
 * scroll. Recent picks sit above them, because a wholesaler sells the same
 * few things all day.
 *
 * The search and the shop's own additions are SoneBill's ItemTypePicker logic
 * over the same shared package (`@codeimplants/jewellery-catalog`), which is
 * what the owner asked for. The screen is this app's own: the green Ledger
 * band, flat white tiles with a hairline, gold section labels. App Review
 * rejected the app as a SoneBill copy under 4.3(a), so nothing here may look
 * like SoneBill's purple-chip picker, and the reference the owner sent for the
 * tile layout was purple: the layout is taken, the colour is not.
 *
 * Read and searched in the shop's language. A Marathi shop sees "झुमका";
 * typing English letters ("jhumka") still finds it, because that is how most
 * shopkeepers type their own language on a phone. Nothing is compulsory:
 * "Use what I typed" is always offered.
 */
export default function ItemPicker({
  visible,
  onClose,
  products: allProducts = [],
  onPick,
  initialQuery,
  metal,
}: {
  visible: boolean;
  onClose: () => void;
  products?: PickerProduct[];
  onPick: (pick: ItemPick) => void;
  /** What is already in the field, so reopening continues the search. */
  initialQuery?: string;
  /**
   * Narrows the list to ornaments made in this metal: the package tags each
   * one (`metals`), so a silver line offers Payal, Thali and Silver Coin, not
   * Mangalsutra. Left out, nothing is filtered, which is how the gold line
   * has always behaved.
   */
  metal?: MetalCode;
}) {
  const { t, language } = useTranslation();
  const insets = useSafeAreaInsets();
  const { taxonomy, addCustomItemType, addCustomCategory } = useShopTaxonomy();
  const [query, setQuery] = useState('');
  const [pendingName, setPendingName] = useState<string | null>(null);
  /** Non-null while a group of the shop's own is being named. */
  const [newGroup, setNewGroup] = useState<string | null>(null);
  /** The group tile that is open. Search works inside it, not instead of it. */
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [recents, setRecents] = useState<ItemPick[]>([]);
  const searchRef = useRef<TextInput>(null);

  const tx = (key: string, fallback: string, name?: string) =>
    ((t(`itemPicker.${key}`) as string) || fallback).replace('{name}', name ?? '');

  useEffect(() => {
    if (!visible) return;
    setQuery(initialQuery?.trim() ?? '');
    setActiveGroup(null);
    setPendingName(null);
    setNewGroup(null);
  }, [visible, initialQuery]);

  // Read each time it opens, so a pick made on another line of this sale is
  // already at the front. An unreadable store leaves the strip empty, never
  // the picker broken.
  useEffect(() => {
    if (!visible) return;
    let live = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(recentKey(metal));
        const list = raw ? JSON.parse(raw) : [];
        if (live) setRecents(Array.isArray(list) ? list.filter(isPick).slice(0, RECENT_MAX) : []);
      } catch {
        if (live) setRecents([]);
      }
    })();
    return () => { live = false; };
  }, [visible, metal]);

  // A desktop browser gets a centred panel (and a chip strip that wraps, since
  // a row that scrolls sideways has no affordance with a mouse). A phone, or a
  // browser as narrow as one, gets the full-screen picker.
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const panel = isWeb && width >= 640;
  /** Three tiles across a phone as in the owner's reference; two on the
   *  narrowest, where a name like "Mangalsutra" would wrap mid-word. */
  const columns = panel ? 4 : width < 330 ? 2 : 3;
  const lang = (['en', 'hi', 'mr', 'gu'].includes(language as string) ? language : 'en') as LanguageCode;

  const { groups, itemTypes } = useMemo(() => {
    const resolved = resolveTaxonomy(taxonomy, lang);
    if (!metal) return resolved;
    // An ornament with no metals listed (the shop's own, and a couple in the
    // master list) could be anything, so it stays in.
    const types = resolved.itemTypes.filter(type => !type.metals?.length || type.metals.includes(metal));
    // A group left with nothing in it would be an empty tile.
    return { ...resolved, itemTypes: types, groups: resolved.groups.filter(g => types.some(type => type.group === g.code)) };
  }, [taxonomy, lang, metal]);

  /** The shop's saved products for this metal; their category is the metal.
   *  "Others" and uncategorised products stay in, as they could be either. */
  const products = useMemo(
    () => (metal
      ? allProducts.filter(p => {
        const c = String(p.category || '').toLowerCase();
        return !c || c === metal || c === 'others' || c === 'other';
      })
      : allProducts),
    [allProducts, metal],
  );

  const countIn = (code: string) =>
    code === CATALOGUE ? products.length : itemTypes.filter(type => type.group === code).length;

  const activeName = activeGroup === CATALOGUE
    ? tx('catalogue', 'Your catalogue')
    : groups.find(g => g.code === activeGroup)?.name;

  /** Search results. Only built while something is typed; browsing is tiles. */
  const rows = useMemo<Row[]>(() => {
    const typed = query.trim();
    const needle = normalise(typed);
    if (!needle) return [];

    const typeHits = activeGroup === CATALOGUE
      ? []
      : itemTypes
        .filter(type => !activeGroup || type.group === activeGroup)
        .map(type => ({ type, score: bestScore([type.name, type.names?.en, ...type.aliases], needle) }))
        .filter(hit => hit.score > 0);
    // Catalogue products carry no ornament type, so an ornament group hides them.
    const productHits = activeGroup && activeGroup !== CATALOGUE
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
  }, [query, itemTypes, activeGroup, products]);

  const finish = () => {
    setQuery('');
    setActiveGroup(null);
    setPendingName(null);
    setNewGroup(null);
    onClose();
  };

  /** Puts a pick at the front of the recent strip, once. Best-effort: a
   *  failed write costs the strip an entry, never the sale its line. */
  const remember = (p: ItemPick) => {
    const next = [p, ...recents.filter(r => pickKey(r) !== pickKey(p))].slice(0, RECENT_MAX);
    setRecents(next);
    AsyncStorage.setItem(recentKey(metal), JSON.stringify(next)).catch(() => {});
  };

  const pick = (p: ItemPick) => {
    remember(p);
    onPick(p);
    finish();
  };

  const chooseType = (type: ResolvedItemType) => pick({ kind: 'itemType', code: type.code, name: type.name });

  /**
   * A recent pick, re-resolved against today's data: an ornament shows in the
   * shop's current language, and a saved product deleted since is used as the
   * name it had, rather than handing the line an id that no longer exists.
   */
  const resolveRecent = (r: ItemPick): ItemPick => {
    if (r.kind === 'itemType') {
      const type = lookupItemType(r.code, taxonomy, lang);
      return type ? { kind: 'itemType', code: type.code, name: type.name } : { kind: 'text', name: r.name };
    }
    if (r.kind === 'product') {
      const product = allProducts.find(p => p.id === r.productId);
      return product ? { kind: 'product', productId: product.id, name: product.name } : { kind: 'text', name: r.name };
    }
    return r;
  };

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
          // Inside an ornament group, asking which group to file it under is
          // a question the shop has just answered.
          onPress={() => (activeGroup && activeGroup !== CATALOGUE
            ? createOwn(activeGroup, item.text)
            : setPendingName(item.text))}
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

  /** One tile of the grid. Width is a share of the row, so the grid holds on
   *  every screen without measuring it first. */
  const Tile = ({ title, sub, onPress, badge, add }: {
    title: string;
    sub?: string;
    onPress: () => void;
    badge?: string;
    add?: boolean;
  }) => (
    <View style={{ width: `${100 / columns}%`, padding: 4 }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [styles.tile, add && styles.tileAdd, pressed && styles.tilePressed]}
      >
        {add && <Plus size={18} color={Brand.primary} />}
        <Text style={[styles.tileTitle, add && styles.tileTitleAdd]} numberOfLines={2}>{title}</Text>
        {!!sub && <Text style={styles.tileSub} numberOfLines={1}>{sub}</Text>}
        {!!badge && <Text style={[styles.badge, styles.tileBadge]}>{badge}</Text>}
      </Pressable>
    </View>
  );

  const itemsLabel = (n: number) =>
    n === 1
      ? tx('oneItem', '1 item')
      : ((t('itemPicker.nItems') as string) || '{n} items').replace('{n}', String(n));

  const recentStrip = recents.length > 0 && !activeGroup && (
    <View>
      <View style={styles.labelRow}>
        <Clock size={13} color={Brand.goldDark} />
        <Text style={styles.label}>{tx('recent', 'Recent')}</Text>
      </View>
      {panel ? (
        <View style={styles.chipsWrap}>
          {recents.map(r => {
            const shown = resolveRecent(r);
            return (
              <Pressable key={pickKey(r)} onPress={() => pick(shown)} style={({ pressed }) => [styles.chip, pressed && styles.tilePressed]}>
                <Text style={styles.chipText} numberOfLines={1}>{shown.name}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow} keyboardShouldPersistTaps="handled">
          {recents.map(r => {
            const shown = resolveRecent(r);
            return (
              <Pressable key={pickKey(r)} onPress={() => pick(shown)} style={({ pressed }) => [styles.chip, pressed && styles.tilePressed]}>
                <Text style={styles.chipText} numberOfLines={1}>{shown.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );

  /** Nothing typed: the recent strip, then group tiles, or one group's ornaments. */
  const browse = (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: (panel ? 16 : insets.bottom) + 24 }}
    >
      {recentStrip}

      {activeGroup ? (
        <>
          <Pressable style={styles.crumb} onPress={() => setActiveGroup(null)} accessibilityRole="button">
            <ChevronLeft size={18} color={Brand.primary} />
            <Text style={styles.crumbBack}>{tx('allCategories', 'All categories')}</Text>
            <Text style={styles.crumbSep}>/</Text>
            <Text style={styles.crumbHere} numberOfLines={1}>{activeName}</Text>
          </Pressable>
          <View style={styles.grid}>
            {activeGroup === CATALOGUE
              ? [...products]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(product => (
                  <Tile
                    key={`p-${product.id}`}
                    title={product.name}
                    sub={[product.purity, product.category].filter(Boolean).join(' · ') || undefined}
                    onPress={() => pick({ kind: 'product', productId: product.id, name: product.name })}
                  />
                ))
              : itemTypes
                .filter(type => type.group === activeGroup)
                .map(type => {
                  const english = type.names?.en && lang !== 'en' && type.names.en !== type.name ? type.names.en : undefined;
                  return (
                    <Tile
                      key={`t-${type.code}`}
                      title={type.name}
                      sub={english}
                      badge={type.custom ? tx('yours', 'Yours') : undefined}
                      onPress={() => chooseType(type)}
                    />
                  );
                })}
            {/* Adding an ornament of the shop's own is typing its name: the
                search box below the band already offers "+ Add" for a name
                the list does not have, filed under this group. */}
            {activeGroup !== CATALOGUE && (
              <Tile
                add
                title={tx('addHere', 'Add your own')}
                onPress={() => searchRef.current?.focus()}
              />
            )}
          </View>
        </>
      ) : (
        <>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{tx('categories', 'Categories')}</Text>
          </View>
          <View style={styles.grid}>
            {products.length > 0 && (
              <Tile
                title={tx('catalogue', 'Your catalogue')}
                sub={itemsLabel(products.length)}
                onPress={() => setActiveGroup(CATALOGUE)}
              />
            )}
            {groups.map(group => (
              <Tile
                key={group.code}
                title={group.name}
                sub={itemsLabel(countIn(group.code))}
                badge={group.custom ? tx('yours', 'Yours') : undefined}
                onPress={() => setActiveGroup(group.code)}
              />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );

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
              ref={searchRef}
              value={query}
              onChangeText={setQuery}
              // Inside a group the box says so, since that is where a typed
              // name is searched and where "+ Add" would file it.
              placeholder={activeGroup && activeName
                ? tx('searchIn', 'Search or add in {name}', activeName)
                : tx('search', 'Search your catalogue or the ornament list')}
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

          {query.trim() ? (
            <>
              {/* Searching inside a group: say which, and how to leave it. */}
              {!!activeGroup && (
                <Pressable style={styles.crumb} onPress={() => setActiveGroup(null)} accessibilityRole="button">
                  <ChevronLeft size={18} color={Brand.primary} />
                  <Text style={styles.crumbBack}>{tx('allCategories', 'All categories')}</Text>
                  <Text style={styles.crumbSep}>/</Text>
                  <Text style={styles.crumbHere} numberOfLines={1}>{activeName}</Text>
                </Pressable>
              )}
              <FlatList
                data={rows}
                keyExtractor={r => r.key}
                renderItem={renderRow}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: (panel ? 16 : insets.bottom) + 24 }}
              />
            </>
          ) : browse}
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
  // Section labels: small gold capitals, the same as the old list's headers.
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Brand.goldDark,
  },
  // Recent picks: outlined green pills on the pearl ground. Not filled, and
  // never violet (see the component note).
  chipsRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  chipsWrap: { paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Brand.primary,
    backgroundColor: Brand.primaryTint,
    maxWidth: 220,
  },
  chipText: { fontSize: 14, fontWeight: '600', color: Brand.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  tile: {
    // Fills its cell, so a row whose neighbour wraps to two lines ("Articles
    // & Gifting") still reads as one row of equal tiles.
    flexGrow: 1,
    minHeight: 78,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Brand.line,
    backgroundColor: Brand.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileAdd: { borderStyle: 'dashed', borderColor: Brand.primary, backgroundColor: 'transparent' },
  tilePressed: { opacity: 0.6 },
  tileTitle: { fontSize: 15, fontWeight: '600', color: Brand.ink, textAlign: 'center' },
  tileTitleAdd: { color: Brand.primary, fontSize: 13, marginTop: 4 },
  tileSub: { fontSize: 11, color: Brand.inkMuted, marginTop: 4, textAlign: 'center' },
  tileBadge: { marginLeft: 0, marginTop: 6 },
  crumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  crumbBack: { fontSize: 14, fontWeight: '600', color: Brand.primary },
  crumbSep: { fontSize: 14, color: Brand.inkFaint, marginHorizontal: 2 },
  crumbHere: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: Brand.ink },
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
