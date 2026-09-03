import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Box, HStack, Pressable, Text, VStack } from '@gluestack-ui/themed';

import { useTranslation } from '../../hooks/useTranslation';

const PURPLE = '#6D5EF7';

export interface PrintDetailsTab {
  /** Stable identity, so the selection survives a re-render. */
  key: string;
  label: string;
  content: React.ReactNode;
}

interface PrintDetailsCardProps {
  tabs: PrintDetailsTab[];
  /** Overrides the card heading. */
  title?: string;
}

/**
 * The documents a record can produce, in one card.
 *
 * An order with an exchange used to end in two stacked cards - "Order Details"
 * and "Declaration / Affidavit" - each with its own heading, its own row of
 * Print / Download / Share, and its own printer note. Three near-identical
 * green-purple-blue button rows on one screen, and a lot of vertical space
 * spent saying the same thing twice.
 *
 * They are the same question - which document do you want, and what do you want
 * done with it - so the document becomes a tab and the actions are drawn once.
 *
 * A single tab renders as a plain card with no strip: a tab control that offers
 * no choice is furniture. That is what an ordinary sale with nothing to declare
 * gets, and it is why this is worth sharing with the declaration screen, which
 * only ever has one document.
 */
const PrintDetailsCard = ({ tabs, title }: PrintDetailsCardProps) => {
  const { t } = useTranslation();
  const visible = tabs.filter(Boolean);
  const [activeKey, setActiveKey] = useState(visible[0]?.key);

  if (visible.length === 0) return null;

  // Falls back to the first tab if the active one disappears - a declaration
  // can be generated or deleted while this screen is open.
  const active =
    visible.find(tab => tab.key === activeKey) ?? visible[0];

  return (
    <Box bg="$white" p="$5" rounded="$2xl" mb="$4" style={styles.card}>
      <Text fontWeight="$bold" fontSize="$md" color="$coolGray900" mb="$4">
        {title || t('printDetails.title') || 'Print Details'}
      </Text>

      {visible.length > 1 && (
        <HStack style={styles.strip} mb="$4">
          {visible.map(tab => {
            const isActive = tab.key === active.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveKey(tab.key)}
                style={[styles.tab, isActive && styles.tabActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  fontSize="$xs"
                  fontWeight={isActive ? '$bold' : '$medium'}
                  color={isActive ? PURPLE : '$coolGray500'}
                  textAlign="center"
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </HStack>
      )}

      <VStack>{active.content}</VStack>
    </Box>
  );
};

const styles = StyleSheet.create({
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  /** A track the tabs sit in, so the selected one reads as raised rather than
   *  as the only one present. */
  strip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
});

export default PrintDetailsCard;
