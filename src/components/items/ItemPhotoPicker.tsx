import React from 'react';
import { VStack } from '@gluestack-ui/themed';
import { useTranslation } from '../../hooks/useTranslation';
import PhotoField from '../photos/PhotoField';
import type { PendingDeclarationPhoto, DeclarationPhoto } from '../../types';

/** Mirrors MAX_ITEM_PHOTOS in invoice.service.ts / order.service.ts. */
export const MAX_ITEM_PHOTOS = 4;

interface ItemPhotoPickerProps {
  /** Local picks, not yet uploaded — the bill has no id until it is saved. */
  pending: PendingDeclarationPhoto[];
  onChangePending: (photos: PendingDeclarationPhoto[]) => void;
  /** Already uploaded against a saved bill. Empty while creating one. */
  saved?: DeclarationPhoto[];
  /** Deletes an uploaded photo server-side; omitted hides the affordance. */
  onDeleteSaved?: (fileId: string) => Promise<boolean>;
  /**
   * Overrides the button text. This control is reused on old-gold exchange
   * rows, where "Item Photos" is wrong twice over: the piece is not an item
   * on the bill, and it is coming in rather than going out.
   */
  addLabel?: string;
}

/**
 * Optional photos of the item being sold, shown inside an item card.
 *
 * Answers a question the bill itself cannot: months later, which piece did this
 * customer actually buy? A weight, a purity and a name do not identify an
 * ornament, and shopkeepers reach for the bill precisely when someone comes
 * back about a specific piece.
 *
 * The switch that used to guard this is gone, as it is on the ornament picker:
 * it configured nothing, and its initial position had to be derived from whether
 * photos already existed — which is the tell that the data already answered the
 * question the control was asking. An "Add Item Photos" button is ignorable
 * enough on its own.
 *
 * The limit is per item, not per bill: a four-item invoice can hold sixteen
 * photos, and the message says so to stop the count reading as a bill-wide cap.
 */
const ItemPhotoPicker = ({
  pending,
  onChangePending,
  saved = [],
  onDeleteSaved,
  addLabel,
}: ItemPhotoPickerProps) => {
  const { t } = useTranslation();

  return (
    <VStack space="sm" mt="$2">
      <PhotoField
        saved={saved}
        pending={pending}
        onChangePending={onChangePending}
        onDeleteSaved={onDeleteSaved}
        max={MAX_ITEM_PHOTOS}
        compact
        addLabel={addLabel || t('itemPhotos.title')}
        limitMessage={t('itemPhotos.limit')}
      />
    </VStack>
  );
};

export default ItemPhotoPicker;
