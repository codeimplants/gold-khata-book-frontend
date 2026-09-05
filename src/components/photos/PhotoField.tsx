import React, { useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import { Box, HStack, Icon, Pressable, Text, VStack } from '@gluestack-ui/themed';
import { ActivityIndicator } from 'react-native';
import { Check, X } from 'lucide-react-native';

import { useTranslation } from '../../hooks/useTranslation';
import { toast } from '../common/Toast';
import ConfirmModal from '../ConfirmModal';
import { getFullImageUrl } from '../../utils/imageUtils';
import { pickPhotos } from '../../utils/photoPicker';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import PhotoSourceSheet from './PhotoSourceSheet';
import AddPhotosButton from './AddPhotosButton';
import PhotoViewer from './PhotoViewer';
import type { PendingDeclarationPhoto } from '../../types';

export interface SavedPhoto {
  url: string;
  fileId?: string;
}

interface PhotoFieldProps {
  /** Photos already stored against the record. */
  saved?: SavedPhoto[];
  /** Picked on this screen and not yet uploaded. */
  pending: PendingDeclarationPhoto[];
  onChangePending: (photos: PendingDeclarationPhoto[]) => void;
  /** Deletes an uploaded photo server-side; omitted hides that affordance. */
  onDeleteSaved?: (fileId: string) => Promise<boolean>;
  /** Total the record may hold, counting both halves. */
  max: number;
  /**
   * Names the button, e.g. "Add Ornament Photos". The button carries the name
   * rather than a separate heading above it — at an empty field that heading and
   * the button said the same thing twice, in two rows.
   */
  addLabel?: string;
  /** Replaces the "you can add up to {count}" wording. */
  limitMessage?: string;
  /** Smaller tiles, for a cramped row like a witness line. */
  compact?: boolean;
}

/**
 * The photos on a record, as one grid of tiles ending in a "+".
 *
 * Replaces the old pairing of a Take Photo / Choose Photo button row with a
 * separate strip of saved photos below it. Three things that arrangement got
 * wrong:
 *
 * - It read as two features. A shopkeeper thinks "the photos on this bill", not
 *   "uploaded ones and not-yet-uploaded ones", so they belong in one grid.
 * - The count was invisible. The server caps the total and drops the overflow
 *   *silently*, so someone adding a seventh ornament photo simply lost it. The
 *   grid states `n / max` and the "+" disappears at the cap, which makes that
 *   structurally impossible to hit rather than merely documented.
 * - Two side-by-side text buttons are fragile under translation: Marathi, Hindi
 *   and Gujarati labels are longer than "Take Photo" / "Choose Photo" and were
 *   one string away from wrapping inside a third-width control. Icon tiles do
 *   not care how long a word is.
 *
 * Merging the two halves does not merge what a tap means. Removing a pending
 * photo is an array splice; removing a saved one is an irreversible server call
 * that also drops the file from ImageKit. Saved tiles are badged and always
 * confirm; pending tiles remove immediately.
 */
const PhotoField = ({
  saved = [],
  pending,
  onChangePending,
  onDeleteSaved,
  max,
  addLabel,
  limitMessage,
  compact,
}: PhotoFieldProps) => {
  const { t } = useTranslation();
  const photoUploadEnabled = useFeatureFlag('photoUpload');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewerAt, setViewerAt] = useState<number | null>(null);
  /**
   * Saved photos this field has already deleted from the server.
   *
   * Tracked here rather than left to each caller. The screens that own a saved
   * record keep their photos in different places - one reads them straight off
   * the store, another off local form state seeded once at mount - so relying
   * on the parent to drop the tile meant the delete worked server-side while
   * the thumbnail stayed on screen. The file is gone either way; hiding it here
   * makes that true on every screen, and a parent that does update its own copy
   * simply agrees.
   */
  const [removedIds, setRemovedIds] = useState<string[]>([]);

  const visibleSaved = saved.filter(p => !p.fileId || !removedIds.includes(p.fileId));
  const used = visibleSaved.length + pending.length;

  /**
   * The viewer sees one list in the order the tiles are drawn, so tapping the
   * third tile opens the third photo whichever half it came from. A thumbnail
   * cannot settle a dispute about what crossed the counter; the full frame is
   * the point of taking these at all.
   */
  const viewable = [
    ...visibleSaved.map(p => ({ url: p.url, fileId: p.fileId })),
    ...pending.map(p => ({ url: p.uri })),
  ];
  const remaining = Math.max(0, max - used);
  const tile = compact ? styles.tileCompact : styles.tile;

  const capMessage = () =>
    (limitMessage || t('declaration.photos.limitReached') || 'You can add up to {count} photos')
      .replace('{count}', String(max));

  const pick = async (mode: 'camera' | 'library') => {
    if (remaining <= 0) {
      toast.error(capMessage());
      return;
    }

    // One trip through the picker per tap, camera included. This used to relaunch
    // the camera until the cap was reached, to save round trips when adding a full
    // set of ornament photos — but there was no way out except the camera's own X
    // button, so confirming a shot looked like the app had failed to accept it.
    // Six photos is now six taps of + Add Photo, which is what the button implies.
    // The library still returns a whole multi-selection in one go.
    const outcome = await pickPhotos(mode, remaining, {
      capture: t('declaration.photos.capture') || 'Capture',
      done: t('common.done') || 'Done',
      cancel: t('common.cancel') || 'Cancel',
    });

    if (outcome.status === 'cancelled') return;
    if (outcome.status === 'unavailable' || outcome.status === 'error') {
      toast.error(
        outcome.status === 'error' && outcome.message
          ? outcome.message
          : t('declaration.photos.cameraUnavailable') || 'Camera is not available',
      );
      return;
    }
    if (outcome.photos.length === 0) return;

    onChangePending([...pending, ...outcome.photos].slice(0, max - visibleSaved.length));
  };

  const confirmDelete = async () => {
    if (!onDeleteSaved || !pendingDelete) return;
    const fileId = pendingDelete;
    setPendingDelete(null);
    setDeletingId(fileId);
    try {
      // Only on a confirmed success: a failed delete must leave the photo
      // visible, because it is still on the server.
      if (await onDeleteSaved(fileId)) {
        setRemovedIds(prev => [...prev, fileId]);
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <VStack space="xs">
      {/* The count only means anything once there is something to count. An
          empty field is just an offer the shopkeeper can walk past. */}
      {used > 0 && (
        <HStack alignItems="center" justifyContent="flex-end">
          <Text fontSize={compact ? 11 : 12} color="$coolGray400">
            {used} / {max}
          </Text>
        </HStack>
      )}

      <HStack style={styles.grid}>
        {visibleSaved.map((photo, index) => (
          <Box key={photo.fileId || `${photo.url}_${index}`} style={[tile, styles.tileWrap]}>
            <Pressable
              onPress={() => setViewerAt(index)}
              accessibilityLabel={t('itemPhotos.viewPhoto') || 'View photo'}
            >
              <Image
                source={{ uri: getFullImageUrl(photo.url) || photo.url }}
                style={[tile, styles.thumb]}
              />
            </Pressable>
            <Box style={styles.savedBadge}>
              {deletingId === photo.fileId ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Icon as={Check} size="xs" color="$white" />
              )}
            </Box>
            {!!onDeleteSaved && !!photo.fileId && (
              <Pressable
                style={styles.remove}
                onPress={() => setPendingDelete(photo.fileId!)}
                disabled={!!deletingId}
                accessibilityLabel={t('declaration.photos.deletePhoto') || 'Delete photo'}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon as={X} size="xs" color="$white" />
              </Pressable>
            )}
          </Box>
        ))}

        {pending.map((photo, index) => (
          <Box key={`${photo.uri}_${index}`} style={[tile, styles.tileWrap]}>
            <Pressable
              onPress={() => setViewerAt(visibleSaved.length + index)}
              accessibilityLabel={t('itemPhotos.viewPhoto') || 'View photo'}
            >
              <Image source={{ uri: photo.uri }} style={[tile, styles.thumb]} />
            </Pressable>
            <Pressable
              style={styles.remove}
              onPress={() => onChangePending(pending.filter((_, i) => i !== index))}
              accessibilityLabel={t('declaration.photos.remove') || 'Remove'}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon as={X} size="xs" color="$white" />
            </Pressable>
          </Box>
        ))}

      </HStack>

      {/* Adding is gated on `photoUpload`; already-saved photos above are NOT.
          Hiding those would make existing records look like they lost data,
          when the only thing unavailable is putting new photos in. */}
      {photoUploadEnabled && remaining > 0 && (
        <AddPhotosButton
          label={addLabel || t('declaration.photos.addPhotos') || 'Add Photos'}
          onPress={() => setSheetOpen(true)}
          compact={compact}
        />
      )}

      {remaining <= 0 && (
        <Text fontSize={11} color="$coolGray400">
          {capMessage()}
        </Text>
      )}

      <PhotoSourceSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onPick={pick}
      />

      <PhotoViewer
        photos={viewable}
        initialIndex={viewerAt ?? 0}
        isOpen={viewerAt !== null}
        onClose={() => setViewerAt(null)}
      />

      <ConfirmModal
        visible={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        tone="destructive"
        icon="trash"
        title={t('declaration.photos.deleteConfirmTitle') || 'Delete this photo?'}
        description={
          t('declaration.photos.deleteConfirmBody') ||
          'It will be removed straight away, and cannot be recovered. You can take a new one afterwards.'
        }
        confirmLabel={t('declaration.photos.deletePhoto') || 'Delete photo'}
        cancelLabel={t('common.cancel') || 'Cancel'}
        onConfirm={confirmDelete}
      />
    </VStack>
  );
};

const styles = StyleSheet.create({
  // Wraps rather than scrolls: a horizontal strip hides the count it is meant to
  // make obvious, and at six tiles a second row is cheaper than a scroll gesture.
  grid: { flexWrap: 'wrap', gap: 8 },
  tile: { width: 64, height: 64, borderRadius: 10 },
  tileCompact: { width: 52, height: 52, borderRadius: 8 },
  tileWrap: { overflow: 'visible' },
  thumb: { borderWidth: 1, borderColor: '#E5E7EB', position: 'absolute' },
  /** Sized to its label rather than the row, so an ignorable offer stays small. */
  savedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0F9D76',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default PhotoField;
