import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import {
  Box,
  VStack,
  Text,
  Center,
  Icon,
  CheckCircleIcon,
} from '@gluestack-ui/themed';
import { Printer, Download, Share2, FileSignature } from 'lucide-react-native';
import { AppReview } from '@codeimplants/app-review';
import GradientButton from './common/GradientButton';
import PrintTargetNote from './common/PrintTargetNote';
import { useTranslation } from '../hooks/useTranslation';
import { LAYOUT } from '../constants/layout';

interface InvoiceSuccessScreenProps {
  invoiceNo: string;
  amount: string;
  onPrint: () => void;
  // onDownload: () => void;
  onShare: () => void;
  onDone: () => void;
  /** "Printing to: <printer>" caption. Shown under Print so the user always knows
   * where a bill is going without being asked to confirm it every time. */
  printTargetLabel?: string;
  onChangePrinter?: () => void;
  /** Optional extra action, shown only when the invoice took in old ornaments.
   * Purely opt-in — a shopkeeper who only wants the exchange line on the bill
   * can ignore it, and nothing in the invoice flow depends on it. */
  onDeclaration?: () => void;
}

const InvoiceSuccessScreen = ({
  invoiceNo,
  amount,
  onPrint,
  // onDownload,
  onShare,
  onDone,
  printTargetLabel,
  onChangePrinter,
  onDeclaration,
}: InvoiceSuccessScreenProps) => {

  const { t } = useTranslation();

  // A bill just saved cleanly — the best moment this app has to ask for a rating.
  // The SDK decides whether to actually ask; most of the time it will not.
  //
  // Delayed on purpose. Apple's guidance is to ask at a moment of satisfaction without
  // interrupting, and a card thrown up the instant this mounts would cover the invoice
  // number and total the shopkeeper came here to read.
  React.useEffect(() => {
    const timer = setTimeout(() => {
      AppReview.requestIfEligible();
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Box flex={1} bg="$coolGray50" p="$6" justifyContent="center">

      <VStack space="xl" style={LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}}>

        <Center>
          <Box bg="$green100" p="$4" rounded="$full" mb="$4">
            <Icon as={CheckCircleIcon} size="xl" color="$green600" />
          </Box>

          <Text fontWeight="$bold" fontSize="$2xl" color="$coolGray800">
            {t("invoiceSuccess.title")}
          </Text>

          <Text color="$coolGray500" mt="$1">
            {invoiceNo}
          </Text>

          <Text fontWeight="$bold" fontSize="$3xl" mt="$4">
            ₹{amount}
          </Text>
        </Center>


        <VStack space="md" mt="$10">

          <TouchableOpacity
            style={styles.outlineButton}
            onPress={onPrint}
          >
            <Icon as={Printer} size="sm" mr="$2" />
            <Text>{t("invoiceSuccess.print")}</Text>
          </TouchableOpacity>

          {printTargetLabel ? (
            <PrintTargetNote
              mt="$0"
              label={printTargetLabel}
              // Absent on web, where the chooser has nothing to offer — Change
              // then falls through to Print Settings rather than disappearing.
              onChangeInPlace={onChangePrinter}
            />
          ) : null}


          {/* <TouchableOpacity
            style={styles.outlineButton}
            onPress={onDownload}
          >
            <Icon as={Download} size="sm" mr="$2" />
            <Text>{t("invoiceSuccess.download")}</Text>
          </TouchableOpacity> */}


          {onDeclaration ? (
            <TouchableOpacity
              style={styles.outlineButton}
              onPress={onDeclaration}
            >
              <Icon as={FileSignature} size="sm" mr="$2" />
              <Text>{t("declaration.generate") || "Declaration / Affidavit"}</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.shareButton}
            onPress={onShare}
          >
            <Icon as={Share2} size="sm" mr="$2" color="$white" />
            <Text color="$white" fontWeight="$medium">
              {t("invoiceSuccess.share")}
            </Text>
          </TouchableOpacity>


          <GradientButton
            label={t("common.done")}
            onPress={onDone}
            style={{ marginTop: 8 }}
          />

        </VStack>

      </VStack>

    </Box>
  );
};

const styles = StyleSheet.create({
  outlineButton: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareButton: {
    height: 56,
    borderRadius: 12,
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default InvoiceSuccessScreen;
