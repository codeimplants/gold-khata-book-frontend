import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import PhotoField from '../photos/PhotoField';
import type { PendingDeclarationPhoto } from '../../types';

/** Mirrors MAX_ORNAMENT_PHOTOS on the backend. */
export const MAX_PHOTOS = 6;

interface OrnamentPhotoPickerProps {
  photos: PendingDeclarationPhoto[];
  onChange: (photos: PendingDeclarationPhoto[]) => void;
  /** Already uploaded against a saved record. Empty while creating one. */
  saved?: { url: string; fileId?: string }[];
  /** Deletes an uploaded photo server-side; omitted hides the affordance. */
  onDeleteSaved?: (fileId: string) => Promise<boolean>;
}

/**
 * Optional camera/gallery capture for the old ornaments.
 *
 * The switch that used to guard this is gone. It was a disclosure dressed up as
 * a setting: nothing was being configured, and whether there are photos is
 * already answered by whether there are photos — which is why its initial
 * position had to be *derived* from the data it guarded. Needing to compute a
 * control's state from the thing it controls means the control is redundant.
 * Removing it also removes a Collapsible, an interaction step, and the piece of
 * state that made "is this on?" a question worth asking.
 *
 * Both entry points still work on web: the image-picker mock maps them onto a
 * file input on a phone browser (with `capture="environment"`, so the camera
 * opens directly) and onto a getUserMedia overlay on desktop.
 */
const OrnamentPhotoPicker = ({
  photos,
  onChange,
  saved = [],
  onDeleteSaved,
}: OrnamentPhotoPickerProps) => {
  const { t } = useTranslation();

  return (
    <PhotoField
      saved={saved}
      pending={photos}
      onChangePending={onChange}
      onDeleteSaved={onDeleteSaved}
      max={MAX_PHOTOS}
      addLabel={t('declaration.photos.addPhotos') || 'Add Photos'}
    />
  );
};

export default OrnamentPhotoPicker;
