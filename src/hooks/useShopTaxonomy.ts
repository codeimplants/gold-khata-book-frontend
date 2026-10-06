import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EMPTY_SHOP_TAXONOMY,
  createLocalStore,
  makeCustomCode,
  type CustomItemType,
  type ShopTaxonomy,
} from '@codeimplants/jewellery-catalog';

/**
 * The ornaments this shop added to the master list, on top of the list itself
 * (`@codeimplants/jewellery-catalog`: 16 groups, 127 ornaments, named in en,
 * hi, mr and gu, spelling variants included).
 *
 * Kept on the device, as SoneBill keeps it. The package's server half is not
 * mounted in the backend yet, so there is nothing to sync with; moving this
 * onto `createRestStore` when it is is the whole change.
 */
const store = createLocalStore({
  storage: AsyncStorage,
  taxonomyKey: '@catalog_taxonomy',
});

export const useShopTaxonomy = () => {
  const [taxonomy, setTaxonomy] = useState<ShopTaxonomy>(EMPTY_SHOP_TAXONOMY);

  const reload = useCallback(async () => {
    try {
      setTaxonomy(await store.getTaxonomy());
    } catch {
      // A shop with nothing of its own is the normal case, and an unreadable
      // store must still leave the master list usable.
      setTaxonomy(EMPTY_SHOP_TAXONOMY);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const taken = (t: ShopTaxonomy) => [
    ...t.customGroups.map(g => g.code),
    ...t.customItemTypes.map(i => i.code),
  ];

  /**
   * An ornament the master list does not carry, filed under a group. Its code
   * is always `x-` prefixed, so a master code added in a later release can
   * never collide with it.
   */
  const addCustomItemType = useCallback(
    async (name: string, group: string): Promise<CustomItemType> => {
      const entry: CustomItemType = { code: makeCustomCode(name, taken(taxonomy)), group, name: name.trim() };
      const next: ShopTaxonomy = { ...taxonomy, customItemTypes: [...taxonomy.customItemTypes, entry] };
      setTaxonomy(next);
      await store.saveTaxonomy(next);
      return entry;
    },
    [taxonomy],
  );

  /**
   * A group of the shop's own AND the ornament going into it, in one save:
   * both codes come from the same "taken" list, so "Antique" as a group and
   * "Antique" as an ornament cannot both become `x-antique`.
   */
  const addCustomCategory = useCallback(
    async (groupName: string, typeName: string): Promise<CustomItemType> => {
      const used = taken(taxonomy);
      const groupCode = makeCustomCode(groupName, used);
      const entry: CustomItemType = {
        code: makeCustomCode(typeName, [...used, groupCode]),
        group: groupCode,
        name: typeName.trim(),
      };
      const next: ShopTaxonomy = {
        ...taxonomy,
        customGroups: [...taxonomy.customGroups, { code: groupCode, name: groupName.trim() }],
        customItemTypes: [...taxonomy.customItemTypes, entry],
      };
      setTaxonomy(next);
      await store.saveTaxonomy(next);
      return entry;
    },
    [taxonomy],
  );

  return { taxonomy, addCustomItemType, addCustomCategory };
};
