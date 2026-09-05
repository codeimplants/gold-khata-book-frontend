import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Box, HStack, Icon, Text } from '@gluestack-ui/themed';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { getFullImageUrl } from '../../utils/imageUtils';

export interface ViewablePhoto {
  url: string;
  fileId?: string;
}

interface PhotoViewerProps {
  photos: ViewablePhoto[];
  /** Which photo the user tapped. */
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Fullscreen viewer for a set of photos.
 *
 * Lived under components/oldGold as OrnamentPhotoViewer, but nothing in it is
 * about old gold — it is a plain lightbox, and item photos use it too. Moved
 * here when the old-gold module was removed.
 *
 * These photos exist to prove what actually came across the counter, so a 64px
 * thumbnail cannot do the job — a dispute needs the full frame. Swiping moves
 * between shots without going back to the list.
 *
 * Deliberately built on Modal + a paged FlatList rather than a gallery package:
 * the app has no gesture-handler dependency, and adding one for this would mean
 * a native rebuild plus a store-guard review. That rules out pinch-to-zoom, but
 * full-bleed at device width is the part that carries the evidentiary value.
 */
const PhotoViewer = ({
  photos,
  initialIndex,
  isOpen,
  onClose,
}: PhotoViewerProps) => {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  const listRef = useRef<FlatList<ViewablePhoto> | null>(null);

  /**
   * Arrows as well as swiping. Swipe is the natural gesture on a phone, but this
   * same viewer runs on the web build where there is no touch surface and a
   * mouse has nothing to drag — without these, a desktop user can open the
   * viewer and never reach the second photo.
   */
  const go = (delta: number) => {
    const next = Math.min(Math.max(index + delta, 0), photos.length - 1);
    if (next === index) return;
    setIndex(next);
    listRef.current?.scrollToIndex({ index: next, animated: true });
  };

  // Reseed on each open, otherwise the viewer reopens on whichever photo was
  // last swiped to rather than the one just tapped.
  useEffect(() => {
    if (isOpen) setIndex(initialIndex);
  }, [isOpen, initialIndex]);

  if (photos.length === 0) return null;

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <Box flex={1} bg="rgba(0,0,0,0.94)">
        <HStack
          justifyContent="space-between"
          alignItems="center"
          px="$4"
          pt="$10"
          pb="$3"
        >
          <Text color="$white" fontSize={14} fontWeight="$medium">
            {photos.length > 1 ? `${index + 1} / ${photos.length}` : ''}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <Icon as={X} size="xl" color="$white" />
          </Pressable>
        </HStack>

        <FlatList
          ref={listRef}
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          // Required for initialScrollIndex to land on the right photo without
          // the list having measured its children first.
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={e =>
            setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
          }
          keyExtractor={(item, i) => item.fileId || `${item.url}_${i}`}
          renderItem={({ item }) => (
            <Box width={width} height={height * 0.78} justifyContent="center">
              <Image
                source={{ uri: getFullImageUrl(item.url) || item.url }}
                style={styles.photo}
                resizeMode="contain"
              />
            </Box>
          )}
        />

        {photos.length > 1 && (
          <>
            {index > 0 && (
              <Pressable
                onPress={() => go(-1)}
                style={[styles.arrow, styles.arrowLeft]}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Previous photo"
              >
                <Icon as={ChevronLeft} size="xl" color="$white" />
              </Pressable>
            )}
            {index < photos.length - 1 && (
              <Pressable
                onPress={() => go(1)}
                style={[styles.arrow, styles.arrowRight]}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Next photo"
              >
                <Icon as={ChevronRight} size="xl" color="$white" />
              </Pressable>
            )}
          </>
        )}
      </Box>
    </Modal>
  );
};

const styles = StyleSheet.create({
  photo: { width: '100%', height: '100%' },
  /** Over the image rather than beside it, so the photo keeps the full width. */
  arrow: {
    position: 'absolute',
    top: '50%',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  arrowLeft: { left: 12 },
  arrowRight: { right: 12 },
});

export default PhotoViewer;
