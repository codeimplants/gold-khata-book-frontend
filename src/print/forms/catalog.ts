import type { ComponentType } from 'react';
import { FileSignature } from 'lucide-react-native';

import {
  printBlankDeclaration,
  shareBlankDeclaration,
} from '../declarationService';
import type { MobileLang } from '../templates/shared';

export type FormId = 'declaration';

/** Everything a blank form needs in order to be produced. */
export type BlankFormContext = {
  shopDetails: any;
  /** Language the form itself is printed in — not the app language. */
  lang: MobileLang;
  includeShopDetails: boolean;
};

export type BlankFormDefinition = {
  id: FormId;
  /** Dotted translation key for the form's name, read in the app language. */
  titleKey: string;
  descKey: string;
  icon: ComponentType<any>;
  print: (ctx: BlankFormContext) => Promise<void>;
  /** Resolves false when the form could not be produced. */
  share: (ctx: BlankFormContext) => Promise<boolean>;
};

/**
 * The blank forms offered under Download Forms, in the order they are listed.
 *
 * Adding a form means adding an entry here — neither the list screen nor the
 * detail screen knows about any particular form. Both currently assume every
 * form takes the same two options (print language, shop letterhead); when a
 * form turns up that needs different controls, that is the point to let a
 * definition declare its own, rather than guessing now.
 */
export const FORM_CATALOG: BlankFormDefinition[] = [
  {
    id: 'declaration',
    titleKey: 'declaration.title',
    descKey: 'forms.items.declaration.desc',
    icon: FileSignature,
    print: ({ shopDetails, lang, includeShopDetails }) =>
      printBlankDeclaration(shopDetails, lang, includeShopDetails),
    share: ({ shopDetails, lang, includeShopDetails }) =>
      shareBlankDeclaration(shopDetails, lang, includeShopDetails),
  },
];

export const getForm = (id?: string): BlankFormDefinition | undefined =>
  FORM_CATALOG.find(f => f.id === id);
