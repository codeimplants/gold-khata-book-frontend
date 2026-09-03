import React, { useEffect, useState } from 'react';
import { Modal, ActivityIndicator } from 'react-native';
import { Box, VStack, HStack, Text, Pressable, Icon } from '@gluestack-ui/themed';
import { Camera } from 'lucide-react-native';

import { useTranslation } from '../../hooks/useTranslation';
import { ToastViewport } from '../common/Toast';
import PhotoField from '../photos/PhotoField';
import { MAX_PHOTOS } from './OrnamentPhotoPicker';
import type { PendingDeclarationPhoto } from '../../types';

const PURPLE = '#6D5EF7';

interface AddPhotosModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Photos already stored against the record. Shown so the cap is visible. */
  existing: { url: string; fileId?: string }[];
  max?: number;
  title?: string;
  /** Resolves false to keep the modal open with the picks intact. */
  onUpload: (photos: PendingDeclarationPhoto[]) => Promise<boolean>;
  /** Omitted where the record type has no delete endpoint. */
  onDelete?: (fileId: string) => Promise<boolean>;
}

/**
 * Attaches photos to a record that is already saved.
 *
 * The creation forms capture photos as part of the form, which leaves no way to
 * add them afterwards — the case that matters on desktop web, where a bill is
 * finished at the counter's PC and the ornaments are photographed on a phone
 * minutes later. The upload endpoints have always accepted a saved record's id;
 * only this affordance was missing.
 *
 * Picks are staged rather than uploaded per photo: six separate multipart
 * requests over a shop's connection is six chances to half-succeed, and the
 * backend appends per request anyway.
 */
const AddPhotosModal = ({
  isOpen,
  onClose,
  existing,
  max = MAX_PHOTOS,
  title,
  onUpload,
  onDelete,
}: AddPhotosModalProps) => {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<PendingDeclarationPhoto[]>([]);
  const [busy, setBusy] = useState(false);

  // Reopening after a cancel must not resurrect the previous picks — they were
  // abandoned deliberately.
  useEffect(() => {
    if (isOpen) setPicked([]);
  }, [isOpen]);

  // The server's cap (it appends and rejects past MAX_ORNAMENT_PHOTOS) is now
  // enforced inside PhotoField, which is given `max` and counts both the stored
  // and the not-yet-uploaded halves against it — so a seventh photo is refused
  // here rather than by a 400 after the shopkeeper has waited out the upload.

  const handleUpload = async () => {
    if (picked.length === 0 || busy) return;
    setBusy(true);
    try {
      const ok = await onUpload(picked);
      if (ok) {
        setPicked([]);
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  const closeDisabled = busy;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={closeDisabled ? undefined : onClose}
    >
      <Box flex={1} bg="rgba(0,0,0,0.5)" justifyContent="center" alignItems="center" px="$4">
        <Box
          w="100%"
          bg="$white"
          rounded="$3xl"
          overflow="hidden"
          style={{ maxWidth: 400 }}
          hardShadow="5"
        >
          <VStack px="$5" pt="$6" pb="$4" space="md">
            <HStack space="sm" alignItems="center">
              <Box
                w={40}
                h={40}
                rounded="$full"
                bg="#EEF2FF"
                alignItems="center"
                justifyContent="center"
              >
                <Icon as={Camera} size="sm" color={PURPLE} />
              </Box>
              <VStack flex={1}>
                <Text fontSize={16} fontWeight="$bold" color="$coolGray900">
                  {title || t('declaration.photos.addPhotosTitle') || 'Add Photos'}
                </Text>
                <Text fontSize={12} color="$coolGray400">
                  {(t('declaration.photos.uploadedCount') || '{used} of {max} added')
                    .replace('{used}', String(existing.length + picked.length))
                    .replace('{max}', String(max))}
                </Text>
              </VStack>
            </HStack>

            <PhotoField
              saved={existing}
              pending={picked}
              onChangePending={setPicked}
              onDeleteSaved={onDelete}
              max={max}
              addLabel={t('declaration.photos.addPhotos') || 'Add Photos'}
            />
          </VStack>

          <HStack space="md" p="$4" pt="$1" bg="$white">
            <Pressable flex={1} onPress={onClose} disabled={closeDisabled}>
              <Box
                rounded="$2xl"
                borderWidth={1}
                borderColor="$coolGray200"
                py="$3.5"
                alignItems="center"
                bg="$white"
              >
                <Text fontWeight="$bold" color="$coolGray600">
                  {t('common.cancel') || 'Cancel'}
                </Text>
              </Box>
            </Pressable>
            <Pressable
              flex={1}
              onPress={handleUpload}
              disabled={busy || picked.length === 0}
            >
              <Box
                rounded="$2xl"
                py="$3.5"
                alignItems="center"
                style={{
                  backgroundColor: picked.length === 0 ? '#C7C3F5' : PURPLE,
                }}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text fontWeight="$bold" color="$white">
                    {t('declaration.photos.upload') || 'Upload'}
                  </Text>
                )}
              </Box>
            </Pressable>
          </HStack>
        </Box>
      </Box>

      {/* PhotoField reports a failed pick or a hit cap with a toast, and the
          root viewport sits under this modal's own native layer where nothing
          would see it. A pick that fails would then look exactly like the bug
          this modal used to have: tap, nothing happens, no reason given. */}
      <ToastViewport />
    </Modal>
  );
};

export default AddPhotosModal;
