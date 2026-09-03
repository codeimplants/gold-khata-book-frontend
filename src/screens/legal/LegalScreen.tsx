import React from 'react';
import { useNavigation } from '@react-navigation/native';
import LegalDocumentView from './LegalDocumentView';
import { useLegalDocument, type LegalDocId } from './documents';

/**
 * In-app wrapper around a legal document. The back action is guarded by
 * canGoBack(): these screens are also reachable as a direct URL on web, where
 * popping an empty history would leave the user on a blank page.
 */
const LegalScreen = ({ id }: { id: LegalDocId }) => {
  const navigation = useNavigation();
  const doc = useLegalDocument(id);

  return (
    <LegalDocumentView
      {...doc}
      onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
    />
  );
};

export default LegalScreen;
