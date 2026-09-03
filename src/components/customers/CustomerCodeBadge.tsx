import React from 'react';
import { Box, Text } from '@gluestack-ui/themed';

interface CustomerCodeBadgeProps {
  /** The stored `customerCode` — "C-42". Absent on customers created before
   *  the field existed, until the backfill migration has run. */
  code?: string;
  /** Slightly larger treatment for a screen header, where the code sits beside
   *  a heading rather than inside a list row. */
  size?: 'sm' | 'md';
}

/**
 * A customer's per-shop code — the thing that tells two Ramesh Kumars apart
 * when neither gave a phone number.
 *
 * One component rather than the same three lines in the four places that show a
 * customer: the code is only useful if it looks identical everywhere, so that a
 * shopkeeper reading "C-42" off the customer list recognises the same token in
 * the picker when they come to raise a bill.
 *
 * Renders nothing without a code. Customers created before `customerCode`
 * existed have none until `npm run migrate:customer-code -- --apply` has run on
 * that environment, and a placeholder dash for those would read as a value.
 */
const CustomerCodeBadge = ({ code, size = 'sm' }: CustomerCodeBadgeProps) => {
  if (!code) return null;

  return (
    <Box
      px={size === 'md' ? '$2.5' : '$2'}
      py="$0.5"
      rounded="$full"
      bg="#EEF2FF"
      // Never let a long code squeeze the name it sits beside — the name is
      // what the shopkeeper reads first, the code only disambiguates it.
      flexShrink={0}
    >
      <Text
        fontSize={size === 'md' ? 11 : 10}
        fontWeight="$bold"
        color="#4338CA"
        // The digits are the whole point; keep them from being re-wrapped or
        // hyphenated across the badge.
        numberOfLines={1}
      >
        {code}
      </Text>
    </Box>
  );
};

export default CustomerCodeBadge;
