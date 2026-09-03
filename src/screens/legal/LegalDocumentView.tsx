import React from 'react';
import { Box, Text, VStack, ScrollView } from '@gluestack-ui/themed';
import CommonHeader from '../../components/CommonHeader';
import { LAYOUT } from '../../constants/layout';

export interface LegalSection {
  title: string;
  content: string;
}

interface LegalDocumentViewProps {
  title: string;
  sections: LegalSection[];
  lastUpdated?: string;
  /** Omitted on the public web routes, where there is no app history to pop. */
  onBack?: () => void;
  /** Rendered above the "last updated" line — e.g. the public page's app links. */
  footer?: React.ReactNode;
}

const Section = ({ title, content }: LegalSection) => (
  <VStack space="xs">
    <Text fontWeight="$bold" fontSize="$lg" color="$coolGray900">
      {title}
    </Text>
    <Text color="$coolGray600" lineHeight="$md">
      {content}
    </Text>
  </VStack>
);

/**
 * Shared body for every legal document (privacy policy, terms, account
 * deletion). Deliberately free of navigation and auth: the same component
 * renders inside the authenticated app stack and standalone on the public web
 * routes, where no NavigationContainer is mounted at all.
 */
const LegalDocumentView = ({
  title,
  sections,
  lastUpdated,
  onBack,
  footer,
}: LegalDocumentViewProps) => (
  <Box flex={1} bg="$coolGray50">
    <CommonHeader
      title={title}
      variant="light"
      showBack={!!onBack}
      onPressBack={onBack}
      onPressClose={onBack}
    />

    <ScrollView
      flex={1}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        padding: 16,
        paddingBottom: 100,
        ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}),
      }}
    >
      <VStack space="lg">
        <Box
          bg="$white"
          rounded="$2xl"
          p="$5"
          hardShadow="1"
          borderWidth={1}
          borderColor="$coolGray100"
        >
          <VStack space="xl">
            {sections.map((item, index) => (
              <Section key={index} title={item.title} content={item.content} />
            ))}
          </VStack>
        </Box>

        {footer}

        {!!lastUpdated && (
          <Text color="$coolGray500" textAlign="center" fontSize="$sm" mt="$2">
            {lastUpdated}
          </Text>
        )}
      </VStack>
    </ScrollView>
  </Box>
);

export default LegalDocumentView;
