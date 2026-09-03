import React from 'react';
import { VStack } from '@gluestack-ui/themed';

import { useTranslation } from '../../hooks/useTranslation';
import PhotoField from '../photos/PhotoField';
import type { PendingDeclarationPhoto } from '../../types';

/** Mirrors MAX_WITNESS_PHOTOS on the backend — front and back of one card. */
export const MAX_WITNESS_PHOTOS = 2;

interface WitnessPhotoPickerProps {
  photos: PendingDeclarationPhoto[];
  onChange: (photos: PendingDeclarationPhoto[]) => void;
  /** Already uploaded against this witness on a saved declaration. */
  saved?: { url: string; fileId?: string }[];
  onDeleteSaved?: (fileId: string) => Promise<boolean>;
}

/**
 * Optional ID proof for one witness.
 *
 * Deliberately has no switch of its own, unlike OrnamentPhotoPicker: the whole
 * Witnesses section already sits behind one, and a third level of toggles to
 * hide two buttons costs more attention than it saves. The buttons appear only
 * once the witness is named, so an unused witness row stays as short as before.
 */
const WitnessPhotoPicker = ({
  photos,
  onChange,
  saved = [],
  onDeleteSaved,
}: WitnessPhotoPickerProps) => {
  const { t } = useTranslation();
  return (
    <VStack space="xs">
      <PhotoField
        saved={saved}
        pending={photos}
        onChangePending={onChange}
        onDeleteSaved={onDeleteSaved}
        max={MAX_WITNESS_PHOTOS}
        compact
        addLabel={t('declaration.witnesses.photos.label') || 'ID proof (optional)'}
        limitMessage={
          t('declaration.witnesses.photos.limitReached') ||
          'You can add up to {count} photos per witness'
        }
      />
    </VStack>
  );
};

export default WitnessPhotoPicker;
