import React, { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, HStack, VStack, Text, Pressable, Icon } from '@gluestack-ui/themed';
import { ExternalLink, Languages, Share2 } from 'lucide-react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import WebView from 'react-native-webview';

import CommonHeader from '../../components/CommonHeader';
import { useTranslation } from '../../hooks/useTranslation';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { LAYOUT } from '../../constants/layout';
import { openWhatsApp } from '../../utils/whatsappUtils';
import { trackPlatformEvent } from '../../utils/platformAnalytics';
import type { RootStackParamList } from '../../navigation/types';
import { getTutorial, onTutorialsChange, refreshTutorials } from '../../utils/tutorialsCatalog';
import {
  pickText,
  pickVideo,
  youtubeEmbedUrl,
  youtubeWatchUrl,
} from '../../tutorials/catalog';

const PURPLE = '#6D5EF7';

/**
 * Plays one tutorial. Which one is decided by the route param alone — the video
 * ids live in the server-driven catalog, so swapping a recording is a config
 * change rather than a release.
 */
const TutorialDetailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'TutorialDetail'>>();
  const { t, language } = useTranslation();
  const insets = useSafeAreaInsets();

  const slug = route.params?.slug;
  const enabled = useFeatureFlag('tutorials');
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = onTutorialsChange(() => setVersion(v => v + 1));
    // Covers a cold open straight onto this screen — React Navigation restores
    // the last route on relaunch, so the list screen may never have run.
    void refreshTutorials();
    return unsubscribe;
  }, [enabled]);

  // With the flag off this falls through to the "no longer available" state
  // below, which is what a restored route should show.
  const tutorial = enabled ? getTutorial(slug) : undefined;

  useEffect(() => {
    if (!tutorial) return;
    trackPlatformEvent('tutorial_open', {
      slug: tutorial.slug,
      language,
      from: route.params?.from ?? 'library',
    });
  }, [tutorial?.slug, language, route.params?.from]);

  /**
   * A slug not in the catalog is a stale route: a retired tutorial, a version
   * range that no longer covers this build, or a relaunch onto a restored route.
   */
  if (!tutorial) {
    return (
      <Box flex={1} bg="$coolGray50">
        <CommonHeader
          variant="light"
          showBack
          onPressBack={() => navigation.goBack()}
          title={t('tutorials.title') || 'Video Tutorials'}
        />
        <Box p="$4">
          <Text fontSize={14} color="$coolGray500">
            {t('tutorials.notFound') || 'This tutorial is no longer available.'}
          </Text>
        </Box>
      </Box>
    );
  }

  const title = pickText(tutorial.title, language).text;
  const description = pickText(tutorial.description, language).text;
  const { video, lang: videoLang, isFallback } = pickVideo(tutorial.video, language);
  const embedUrl = youtubeEmbedUrl(video.youtubeId, videoLang);
  const watchUrl = youtubeWatchUrl(video.youtubeId);

  const openInYouTube = () => {
    trackPlatformEvent('tutorial_play', { slug: tutorial.slug, target: 'youtube' });
    void Linking.openURL(watchUrl);
  };

  const shareOnWhatsApp = () => {
    // No phone number: WhatsApp opens its contact picker with the message
    // prefilled, which is what a shopkeeper forwarding this to staff wants.
    void openWhatsApp(undefined, `${title}\n${watchUrl}`);
  };

  return (
    <Box flex={1} bg="$coolGray50">
      <CommonHeader
        variant="light"
        showBack
        onPressBack={() => navigation.goBack()}
        title={title}
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          LAYOUT.contentContainerStyle,
          { paddingBottom: 24 + insets.bottom },
        ]}
      >
        {/* 16:9, the aspect every YouTube embed expects. */}
        <View style={styles.player}>
          {Platform.OS === 'web' ? (
            <iframe
              key={embedUrl}
              src={embedUrl}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ border: 'none', width: '100%', height: '100%' } as any}
            />
          ) : (
            <WebView
              key={embedUrl}
              source={{ uri: embedUrl }}
              style={styles.webview}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              // Without allowsInlineMediaPlayback iOS hijacks the screen with its
              // native fullscreen player instead of playing in place, and
              // mediaPlaybackRequiresUserAction={false} is what lets the
              // in-player tap start playback rather than being swallowed.
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              // Android needs this explicitly or the fullscreen button is inert.
              allowsFullscreenVideo
              // The embed only ever loads YouTube; anything else is a redirect we
              // did not ask for and belongs in the real browser, not in here.
              onShouldStartLoadWithRequest={req =>
                /(?:^|\.)(youtube(?:-nocookie)?|youtu|ytimg|google|gstatic)\.(?:com|be)$/i.test(
                  (() => {
                    try {
                      return new URL(req.url).hostname;
                    } catch {
                      return '';
                    }
                  })(),
                ) || req.url === 'about:blank'
              }
            />
          )}
        </View>

        {isFallback && (
          <HStack style={styles.notice} space="sm" alignItems="center">
            <Icon as={Languages} size="sm" color="$amber700" />
            <Text flex={1} fontSize={12} color="$amber800">
              {t('tutorials.onlyInEnglish') ||
                'This video is only available in English for now.'}
            </Text>
          </HStack>
        )}

        {!!description && (
          <Box style={styles.card}>
            <Text fontSize={14} color="$coolGray700" lineHeight={21}>
              {description}
            </Text>
          </Box>
        )}

        <VStack space="md">
          {/* The reliable path when an embed misbehaves, and it gets the user
              captions, quality control and offline save. */}
          <Pressable onPress={openInYouTube}>
            <HStack style={styles.outlineButton} space="xs">
              <Icon as={ExternalLink} size="sm" color="$coolGray700" />
              <Text color="$coolGray800" fontWeight="$medium">
                {t('tutorials.openInYouTube') || 'Open in YouTube'}
              </Text>
            </HStack>
          </Pressable>

          {/* WhatsApp is this audience's real channel — a shop owner forwards
              this to the staff member who actually does the billing. */}
          <Pressable onPress={shareOnWhatsApp}>
            <HStack style={styles.shareButton} space="xs">
              <Icon as={Share2} size="sm" color="$white" />
              <Text color="$white" fontWeight="$medium">
                {t('tutorials.share') || 'Share on WhatsApp'}
              </Text>
            </HStack>
          </Pressable>
        </VStack>
      </ScrollView>
    </Box>
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  player: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  webview: { flex: 1, backgroundColor: '#000000' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 16,
  },
  notice: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  outlineButton: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default TutorialDetailScreen;
