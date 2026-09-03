import React from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { Box, HStack, Text, VStack, Pressable, Icon } from '@gluestack-ui/themed';
import { ExternalLink, Mail } from 'lucide-react-native';
import LegalDocumentView from '../screens/legal/LegalDocumentView';
import { useLegalDocument, type LegalDocId } from '../screens/legal/documents';
import { supportEmail } from '@config';

/**
 * Public, unauthenticated web pages.
 *
 * These exist because Google Play and the App Store both require legal URLs
 * that a reviewer (or a crawler, or a user who has already uninstalled the app)
 * can open cold, with no account:
 *
 *   /privacy-policy        — Play Console + App Store Connect privacy policy URL
 *   /terms-and-conditions  — store listing / EULA link
 *   /account-deletion      — Play Console "Data deletion" URL, required by the
 *                            Play Data safety form for any app with accounts
 *
 * They are resolved from the URL *before* NavigationContainer mounts, rather
 * than through React Navigation linking, for two reasons:
 *
 *  1. PrivacyPolicy/Terms are only registered in RootNavigator's authenticated
 *     branch, so a signed-out visitor could never reach them via linking.
 *  2. NavigationContainer gives the `initialState` prop priority over any deep
 *     link, and this app always passes persisted state restored from
 *     AsyncStorage — so a returning visitor's saved screen would silently win
 *     over the requested URL.
 *
 * Firebase Hosting already rewrites ** to /index.html, so every path below is
 * served by the same bundle with no hosting change.
 */
const ROUTES: Record<string, LegalDocId> = {
  '/privacy-policy': 'privacy',
  '/terms-and-conditions': 'terms',
  '/account-deletion': 'accountDeletion',
};

const DOCUMENT_TITLES: Record<LegalDocId, string> = {
  privacy: 'Privacy Policy — Gold Khata Book',
  terms: 'Terms & Conditions — Gold Khata Book',
  accountDeletion: 'Account & Data Deletion — Gold Khata Book',
};

/** Normalises a pathname so /privacy-policy/ and /Privacy-Policy also match. */
const normalise = (pathname: string) => {
  const trimmed = pathname.replace(/\/+$/, '').toLowerCase();
  return trimmed === '' ? '/' : trimmed;
};

/**
 * The public document requested by the current URL, or null for the app itself.
 * Always null on native — there is no URL bar to read.
 */
export const getPublicRoute = (): LegalDocId | null => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return ROUTES[normalise(window.location.pathname)] ?? null;
};

/**
 * Same-tab navigation. Deliberately not RN's Linking.openURL, which on
 * react-native-web routes through window.open('_blank') — that would bounce
 * "Open the Gold Khata Book app" into a second tab and can be swallowed by popup
 * blockers for the mailto: link.
 */
const navigate = (url: string) => {
  if (typeof window !== 'undefined') window.location.href = url;
};

const FooterLink = ({
  icon,
  label,
  onPress,
}: {
  icon: any;
  label: string;
  onPress: () => void;
}) => (
  <Pressable onPress={onPress}>
    <HStack alignItems="center" space="sm">
      <Icon as={icon} size="sm" color="#6366F1" />
      <Text color="#6366F1" fontWeight="$semibold">
        {label}
      </Text>
    </HStack>
  </Pressable>
);

const PublicDocumentPage = ({ id }: { id: LegalDocId }) => {
  const doc = useLegalDocument(id);

  // Pin the page to the viewport so the inner ScrollView actually scrolls.
  //
  // In the app these documents sit inside a react-navigation screen container,
  // which gives the flex chain a definite height. Standalone there is nothing
  // bounding it: #root only sets min-height, so `flex: 1` resolves to the
  // content height, the ScrollView never overflows, and `body{overflow:hidden}`
  // in public/index.html silently clips everything past the fold — the policy
  // looked complete but its last sections were unreachable.
  //
  // Measured rather than '100vh' so the layout tracks a mobile browser's
  // collapsing URL bar, and re-renders on rotation.
  const { height } = useWindowDimensions();

  // The tab title is what a reviewer sees pinned next to the URL they pasted
  // into the console, so name the document rather than the app.
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = DOCUMENT_TITLES[id];
    }
  }, [id]);

  const footer = (
    <Box
      bg="$white"
      rounded="$2xl"
      p="$5"
      borderWidth={1}
      borderColor="$coolGray100"
    >
      <VStack space="md">
        <Text fontWeight="$bold" color="$coolGray900">
          Need help?
        </Text>
        <FooterLink
          icon={Mail}
          label={supportEmail}
          onPress={() =>
            navigate(
              `mailto:${supportEmail}?subject=${encodeURIComponent(
                id === 'accountDeletion'
                  ? 'Gold Khata Book — account deletion request'
                  : 'Gold Khata Book — support request',
              )}`,
            )
          }
        />
        <FooterLink
          icon={ExternalLink}
          label="Open the Gold Khata Book app"
          onPress={() => navigate('/')}
        />
      </VStack>
    </Box>
  );

  return (
    <View style={{ height }}>
      <LegalDocumentView {...doc} footer={footer} />
    </View>
  );
};

export default PublicDocumentPage;
