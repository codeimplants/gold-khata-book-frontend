import React from 'react';
import { HStack, Icon, Pressable, Text } from '@gluestack-ui/themed';
import { PlayCircle } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { useTranslation } from '../../hooks/useTranslation';
import { useHasTutorialsForTopic } from '../../hooks/useHasTutorialsForTopic';

type Props = {
  /** A HELP_TOPICS value from src/tutorials/catalog.ts. */
  topic?: string;
  /** Overrides the default "New here? Watch a short video" wording. */
  label?: string;
};

const PURPLE = '#6D5EF7';

/**
 * "New here? Watch a short video" — for empty states.
 *
 * An empty list is the strongest signal the app has that someone is new and has
 * not managed to do the thing yet, which makes it the cheapest, best-placed
 * prompt in the app. Cheaper than the header "?" too: nothing competes for the
 * space.
 *
 * Renders nothing when no tutorial covers the topic, so it can be dropped into an
 * empty state before the video exists.
 */
const WatchTutorialLink: React.FC<Props> = ({ topic, label }) => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const hasHelp = useHasTutorialsForTopic(topic);

  if (!hasHelp) return null;

  return (
    <Pressable
      onPress={() => navigation.navigate('Tutorials', { topic })}
      px="$3"
      py="$2"
      rounded="$xl"
      accessibilityRole="button"
    >
      <HStack space="xs" alignItems="center">
        <Icon as={PlayCircle} size="sm" color={PURPLE} />
        <Text fontSize={13} fontWeight="$medium" style={{ color: PURPLE }}>
          {label || t('tutorials.newHere') || 'New here? Watch a short video'}
        </Text>
      </HStack>
    </Pressable>
  );
};

export default WatchTutorialLink;
