import React from 'react';
import { Text } from '@gluestack-ui/themed';
import { shouldShowCounter } from '../../constants/inputLimits';

interface Props {
  value: string | undefined | null;
  limit: number;
  /** Force the counter to stay visible regardless of how full the field is. */
  always?: boolean;
  /** Right-aligns by default; pass false inside a row that already positions it. */
  align?: 'right' | 'left';
}

/**
 * Shows "48/60" under a capped field, but only once the value is close to the
 * cap — otherwise every form turns into a wall of counters. Turns red at the
 * limit so a paste that got truncated is visibly explained rather than silent.
 */
const CharCounter: React.FC<Props> = ({ value, limit, always = false, align = 'right' }) => {
  const length = (value ?? '').length;
  if (!always && !shouldShowCounter(length, limit)) return null;
  const atLimit = length >= limit;
  return (
    <Text
      fontSize="$xs"
      mt="$0.5"
      textAlign={align}
      color={atLimit ? '$red500' : '$coolGray400'}
    >
      {length}/{limit}
      {atLimit ? ' · limit reached' : ''}
    </Text>
  );
};

export default CharCounter;
