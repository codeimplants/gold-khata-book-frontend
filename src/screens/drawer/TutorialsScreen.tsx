import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, HStack, VStack, Text, Pressable, Icon } from '@gluestack-ui/themed';
import { ChevronRight, PlayCircle, Languages, ListVideo } from 'lucide-react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';

import CommonHeader from '../../components/CommonHeader';
import { useTranslation } from '../../hooks/useTranslation';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { LAYOUT } from '../../constants/layout';
import type { RootStackParamList } from '../../navigation/types';
import {
  getGroupedTutorials,
  getTutorialsForTopic,
  onTutorialsChange,
  refreshTutorials,
} from '../../utils/tutorialsCatalog';
import {
  formatDuration,
  pickText,
  pickVideo,
  type Tutorial,
} from '../../tutorials/catalog';

const PURPLE = '#6D5EF7';

/**
 * The video tutorial library.
 *
 * Content is server-driven (see utils/tutorialsCatalog.ts) so videos can be
 * added, re-ordered or retired without a store release. This screen renders
 * whatever the catalog resolves to and knows nothing about any particular video.
 *
 * With a `topic` route param it shows only the tutorials tagged for one screen —
 * that is what the "?" icon in CommonHeader opens. A Help menu is opt-in and the
 * users who need it most do not go looking, so the contextual entry point is the
 * one that actually reaches them.
 */
const TutorialsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'Tutorials'>>();
  const { t, language } = useTranslation();
  const insets = useSafeAreaInsets();

  const topic = route.params?.topic;
  const enabled = useFeatureFlag('tutorials');

  // Rendered from the cache immediately, then re-read when a refresh lands.
  const [, setVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = onTutorialsChange(() => setVersion(v => v + 1));
    // Fire-and-forget: a failed fetch leaves the cached library in place, and
    // refreshTutorials already swallows its own errors.
    void refreshTutorials();
    return unsubscribe;
  }, [enabled]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshTutorials(true);
    setRefreshing(false);
  }, []);

  /**
   * Reachable with the flag off, because React Navigation restores the last route
   * on relaunch — a user sitting here when the flag is switched off comes back to
   * this screen. Rendering the empty state is the honest answer; the entry points
   * are already gone, so there is no way back in.
   */
  const groups = !enabled
    ? []
    : topic
      ? [{ category: null, tutorials: getTutorialsForTopic(topic) }]
      : getGroupedTutorials();

  const isEmpty = groups.length === 0 || groups.every(g => g.tutorials.length === 0);

  const openTutorial = (tutorial: Tutorial) => {
    navigation.navigate('TutorialDetail', {
      slug: tutorial.slug,
      from: topic ? 'help-icon' : 'library',
    });
  };

  const renderRow = (tutorial: Tutorial) => {
    const title = pickText(tutorial.title, language).text;
    const description = pickText(tutorial.description, language).text;
    const { video, isFallback } = pickVideo(tutorial.video, language);
    const duration = formatDuration(video.durationSec);

    return (
      <Pressable key={tutorial.slug} onPress={() => openTutorial(tutorial)}>
        <Box style={styles.card}>
          <HStack space="md" alignItems="center">
            <Box style={styles.iconBox}>
              <Icon as={PlayCircle} color={PURPLE} size="lg" />
            </Box>
            <VStack flex={1} space="xs">
              <Text fontWeight="$bold" fontSize={15} color="$coolGray800">
                {title}
              </Text>
              {!!description && (
                <Text fontSize={12} color="$coolGray500">
                  {description}
                </Text>
              )}
              <HStack space="sm" alignItems="center">
                {/* Duration is shown because these users are on mobile data and
                    deserve to know the cost before the video starts. */}
                {!!duration && (
                  <Text fontSize={11} color="$coolGray400">
                    {duration}
                  </Text>
                )}
                {/* Said out loud rather than silently playing the wrong language:
                    most users here read Marathi, Hindi or Gujarati, and an
                    unexplained switch to English looks like a broken video. */}
                {isFallback && (
                  <HStack space="xs" alignItems="center">
                    <Icon as={Languages} size="xs" color="$coolGray400" />
                    <Text fontSize={11} color="$coolGray400">
                      {t('tutorials.inEnglish') || 'In English'}
                    </Text>
                  </HStack>
                )}
              </HStack>
            </VStack>
            <Icon as={ChevronRight} size="md" color="$coolGray400" />
          </HStack>
        </Box>
      </Pressable>
    );
  };

  return (
    <Box flex={1} bg="$coolGray50">
      <CommonHeader
        variant="light"
        showBack
        onPressBack={() => navigation.goBack()}
        title={t('tutorials.title') || 'Video Tutorials'}
        subtitle={
          topic
            ? t('tutorials.forThisScreen') || 'Help for this screen'
            : t('tutorials.subtitle') || 'Short videos on how to use the app'
        }
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PURPLE} />
        }
        contentContainerStyle={[
          styles.content,
          LAYOUT.contentContainerStyle,
          { paddingBottom: 24 + insets.bottom },
        ]}
      >
        {isEmpty ? (
          <Box style={styles.card}>
            <VStack space="xs">
              <Text fontWeight="$bold" fontSize={15} color="$coolGray800">
                {topic
                  ? t('tutorials.emptyTopicTitle') || 'No tutorial for this screen yet'
                  : t('tutorials.emptyTitle') || 'Tutorials coming soon'}
              </Text>
              <Text fontSize={12} color="$coolGray500">
                {t('tutorials.emptyHint') ||
                  'We are recording these now. Contact support any time for help.'}
              </Text>
            </VStack>
          </Box>
        ) : (
          groups.map(group => (
            <VStack key={group.category?.slug ?? 'topic'} space="sm">
              {!!group.category && (
                <Text style={styles.sectionTitle}>
                  {pickText(group.category.title, language).text.toUpperCase()}
                </Text>
              )}
              {group.tutorials.map(renderRow)}
            </VStack>
          ))
        )}

        {/* Escape hatch out of the filtered view: the tutorial someone needs is
            often not the one tagged for the screen they happen to be on. */}
        {!!topic && (
          <Pressable onPress={() => navigation.navigate('Tutorials')}>
            <HStack style={styles.outlineButton} space="xs">
              <Icon as={ListVideo} size="sm" color="$coolGray700" />
              <Text color="$coolGray800" fontWeight="$medium">
                {t('tutorials.seeAll') || 'See all tutorials'}
              </Text>
            </HStack>
          </Pressable>
        )}
      </ScrollView>
    </Box>
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 16,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.6,
    marginTop: 4,
  },
  outlineButton: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
});

export default TutorialsScreen;
