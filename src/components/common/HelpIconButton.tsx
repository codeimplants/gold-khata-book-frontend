import React from 'react';
import { Icon, Pressable } from '@gluestack-ui/themed';
import { HelpCircle } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { useHasTutorialsForTopic } from '../../hooks/useHasTutorialsForTopic';

type Props = {
  /** A HELP_TOPICS value from src/tutorials/catalog.ts. */
  topic?: string;
  /** Match the surrounding header: light headers want grey, purple ones white. */
  color?: string;
};

/**
 * The contextual "?" that opens the tutorials filtered to one screen.
 *
 * This is the entry point that actually reaches confused users. The Settings
 * menu is opt-in, and someone stuck halfway through an invoice does not go
 * hunting for it — they phone support. Putting the question mark where the
 * confusion happens is the whole point of the feature.
 *
 * Lives in its own component rather than only inside CommonHeader because the
 * screens that need it most — invoice creation, advance orders, order details —
 * all have hand-rolled headers.
 *
 * Renders nothing when no tutorial covers the topic, so a "?" is never a dead
 * end and a screen can be tagged before its video exists.
 */
const HelpIconButton: React.FC<Props> = ({ topic, color = '$coolGray500' }) => {
  const navigation = useNavigation<any>();
  const hasHelp = useHasTutorialsForTopic(topic);

  if (!hasHelp) return null;

  return (
    <Pressable
      onPress={() => navigation.navigate('Tutorials', { topic })}
      p="$2"
      rounded="$full"
      accessibilityRole="button"
      accessibilityLabel="Help for this screen"
    >
      <Icon as={HelpCircle} size="xl" color={color} />
    </Pressable>
  );
};

export default HelpIconButton;
