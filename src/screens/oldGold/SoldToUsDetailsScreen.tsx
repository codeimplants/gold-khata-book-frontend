import React, { useMemo } from 'react';
import { Image, Pressable as RNPressable, RefreshControl, StyleSheet } from 'react-native';
import {
  Box,
  HStack,
  VStack,
  Text,
  Pressable,
  Icon,
  ScrollView,
  Center,
  Divider,
  ScrollView as GSScrollView,
} from '@gluestack-ui/themed';
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  FileText,
  Pencil,
  Scale,
  Trash2,
  User,
} from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../navigation/types';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { useTranslation } from '../../hooks/useTranslation';
import {
  deletePurchaseOldGold,
  fetchCustomers,
  fetchPurchaseOldGold,
  fetchShopDetails,
  clearUserData,
} from '../../store/data/dataSlice';
import {
  printDeclarationAction,
  shareDeclarationAction,
  downloadDeclarationAction,
} from '../../print/declarationActions';
import DocumentActionsRow from '../../components/common/DocumentActionsRow';
import PrintTargetNote from '../../components/common/PrintTargetNote';
import OrnamentPhotoViewer from '../../components/oldGold/OrnamentPhotoViewer';
import OrderDocumentView from '../../components/orders/OrderDocumentView';
import { MAX_PHOTOS } from '../../components/oldGold/OrnamentPhotoPicker';
import CustomerCodeBadge from '../../components/customers/CustomerCodeBadge';
import ConfirmModal from '../../components/ConfirmModal';
import ImpersonationBlockModal from '../../components/ImpersonationBlockModal';
import { toast } from '../../components/common/Toast';
import { endImpersonation } from '../../store/auth/authSlice';
import { formatCurrencyValue, formatNumber, formatOrderDateTime } from '../../utils/formatter';
import { getFullImageUrl } from '../../utils/imageUtils';
import { LAYOUT } from '../../constants/layout';

type RouteProps = NativeStackScreenProps<RootStackParamList, 'SoldToUsDetails'>['route'];

const PURPLE = '#6D5EF7';
/** Indigo, matching the dashboard's "Sold to Us" tile — this is the same fact. */
const INDIGO = '#4338CA';

/**
 * Detail view for one "Sold to Us" record — an old-gold purchase and the
 * declaration signed against it.
 *
 * Named for what the whole UI calls these ("Sold to us" on the dashboard tile,
 * the customer tabs and the stat cards) rather than for the stored type
 * (`purchaseOldGold`) or the edit route (`OldGoldPurchase`), because the route
 * name is what the next person reads next to `OrderDetails` when wondering
 * where a tapped card goes.
 *
 * Deliberately shaped like OrderDetailsScreen rather than like the declaration
 * form: same header (back, number + customer, then edit/delete/…), same card
 * rhythm down the page, and the same Print/Download/Share row at the bottom. A
 * shopkeeper who has learned one of these two screens has learned both, and
 * until now a Sold to Us card was the only card in the app that could not be
 * opened at all — its edit and print icons on the row were the whole of what
 * you could do with it.
 */
export default function SoldToUsDetailsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProps>();
  const { declarationId } = route.params;

  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { t, declarationLanguage } = useTranslation();

  const purchaseOldGold = useAppSelector(s => s.data.purchaseOldGold);
  const customers = useAppSelector(s => s.data.customers);
  const orders = useAppSelector(s => s.data.orders);
  const shopDetails = useAppSelector(s => s.data.shopDetails);
  const { impersonateUserId, impersonatePhone } = useAppSelector(s => s.auth);

  const [refreshing, setRefreshing] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [blockModalVisible, setBlockModalVisible] = React.useState(false);
  const [photoViewerIndex, setPhotoViewerIndex] = React.useState<number | null>(null);

  // ID scans get their own viewer state rather than sharing the ornament one:
  // every document and every witness has their own set, so the viewer has to be
  // told WHICH list to page through, not just where to start in a single list.
  // Same split OrderDetailsScreen makes between exchange and item photos.
  //
  // One piece of state covers both the seller's documents and the witnesses'
  // because it is handed the list outright — the two never need to be open at
  // once, and a second identical copy would only be a second thing to keep in
  // step.
  const [idPhotoViewer, setIdPhotoViewer] = React.useState<
    { photos: { url: string; fileId?: string }[]; index: number } | null
  >(null);

  // Each ornament carries its own set too, for the same reason as a witness:
  // the viewer has to be told WHICH list to page through. Photos taken while
  // filling in the declaration land here, not on declaration.photos.
  const [itemPhotoViewer, setItemPhotoViewer] = React.useState<
    { photos: { url: string; fileId?: string }[]; index: number } | null
  >(null);

  const declaration = useMemo(
    () => purchaseOldGold.find(d => d.id === declarationId),
    [purchaseOldGold, declarationId],
  );

  const customer = useMemo(
    () => customers.find(c => c.id === declaration?.customerId),
    [customers, declaration?.customerId],
  );

  // The bill this old gold came in against, when it did. An exchange belongs to
  // an order; a cash purchase stands alone.
  const linkedOrder = useMemo(
    () => (declaration?.orderId ? orders.find((o: any) => o.id === declaration.orderId) : undefined),
    [orders, declaration?.orderId],
  );

  // Declarations are not part of the dashboard's initial load, and this screen
  // is reachable by a deep link, so pull everything it reads rather than
  // assuming a particular screen was visited first. All three are stale-guarded.
  React.useEffect(() => {
    dispatch(fetchPurchaseOldGold());
    dispatch(fetchShopDetails());
    dispatch(fetchCustomers());
  }, [dispatch]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        dispatch(fetchPurchaseOldGold({ force: true })),
        dispatch(fetchShopDetails({ force: true })),
        dispatch(fetchCustomers({ force: true })),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [dispatch]);

  // Print / Share / Download, with failure handling and the signed-language
  // rule — see print/declarationActions.
  const handlePrint = () =>
    declaration && printDeclarationAction(declaration, shopDetails, declarationLanguage, t);

  const handleShare = () =>
    declaration && shareDeclarationAction(declaration, shopDetails, declarationLanguage, t);

  const handleDownload = () =>
    declaration && downloadDeclarationAction(declaration, shopDetails, declarationLanguage, t);

  const handleEndSession = () => {
    dispatch(endImpersonation());
    dispatch(clearUserData());
    navigation.navigate('AdminDashboard');
  };

  const handleEdit = () => {
    if (impersonateUserId) { setBlockModalVisible(true); return; }
    navigation.navigate('OldGoldPurchase', { editId: declarationId });
  };

  const handleDelete = () => {
    if (impersonateUserId) { setBlockModalVisible(true); return; }
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await dispatch(deletePurchaseOldGold(declarationId)).unwrap();
      setShowDeleteModal(false);
      toast.success(t('declaration.deleted') || 'Declaration deleted');
      navigation.goBack();
    } catch (error: any) {
      toast.error(error || t('declaration.deleteFailed') || 'Failed to delete the declaration');
    } finally {
      setDeleting(false);
    }
  };

  const header = (title: string, subtitle?: string, actions?: React.ReactNode) => (
    <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
      <Box bg="$white" borderBottomWidth={1} borderBottomColor="$coolGray100">
        <HStack
          px="$4"
          py="$4"
          alignItems="center"
          justifyContent="space-between"
          style={{ ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}) }}
        >
          <HStack alignItems="center" space="md" flex={1} mr="$2">
            <Pressable onPress={() => navigation.goBack()} p="$2" rounded="$lg">
              <ArrowLeft size={20} color="#111827" />
            </Pressable>
            <VStack flexShrink={1}>
              <Text fontWeight="$black" color="$coolGray900" fontSize="$md" numberOfLines={1}>
                {title}
              </Text>
              {!!subtitle && (
                <Text fontSize="$xs" color="$coolGray500" numberOfLines={1}>
                  {subtitle}
                </Text>
              )}
            </VStack>
          </HStack>
          {actions}
        </HStack>
      </Box>
    </SafeAreaView>
  );

  if (!declaration) {
    return (
      <Box flex={1} bg="#F8FAFC">
        {header(t('dashboard.soldToUs') || 'Sold to Us')}
        <Center flex={1} px="$6">
          <Text color="$coolGray500" textAlign="center">
            {t('declaration.notFound') || 'This record could not be found'}
          </Text>
        </Center>
      </Box>
    );
  }

  const isExchange = declaration.mode === 'exchange';
  const photos = (declaration.photos || []) as { url: string; fileId?: string }[];
  const idProofEntries =
    declaration.idProofs?.length
      ? declaration.idProofs
      : declaration.idProofNumber
        ? [{
            type: declaration.idProofType,
            number: declaration.idProofNumber,
            otherLabel: declaration.idProofOtherLabel,
          }]
        : [];
  const witnesses = (declaration.witnesses || []).filter(w => w.name?.trim());
  const payout = declaration.payout;
  // Amounts are optional per ornament — a pure exchange may record only weight.
  const showAmounts = (declaration.items || []).some(i => Number(i.amount) > 0);

  return (
    <Box flex={1} bg="#F8FAFC">
      {header(
        declaration.declarationNumber,
        customer?.name || declaration.customerSnapshot?.name,
        <HStack alignItems="center" space="sm">
          <Box px="$3" py="$1" rounded="$full" bg={isExchange ? '#EEF2FF' : '#FEF3C7'}>
            <Text
              fontSize="$2xs"
              fontWeight="$bold"
              color={isExchange ? '#4F46E5' : '#92400E'}
            >
              {isExchange
                ? t('customers.detailsScreen.badges.exchange') || 'Exchange'
                : t('customers.detailsScreen.badges.cashPurchase') || 'Cash'}
            </Text>
          </Box>
          <Pressable
            onPress={handleEdit}
            p="$2"
            rounded="$lg"
            bg="#EEF2FF"
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            accessibilityLabel={t('common.edit') || 'Edit'}
          >
            <Pencil size={16} color={PURPLE} />
          </Pressable>
          <Pressable
            onPress={handleDelete}
            p="$2"
            rounded="$lg"
            bg="#FEF2F2"
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            accessibilityLabel={t('common.delete') || 'Delete'}
          >
            <Trash2 size={16} color="#EF4444" />
          </Pressable>
        </HStack>,
      )}

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: Math.max(insets.bottom, 40) + 60,
          ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}),
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PURPLE} />
        }
      >
        {/* One card, not nine.

            Every section here describes the same single transaction — what came
            in, who brought it, what was paid, what was photographed — so nine
            separate cards separated by grey gutters implied nine separate things
            and turned a short record into a long scroll. Hairlines between the
            sections carry the same grouping at a fraction of the height.

            The rules are drawn by each section as a top border rather than as
            dividers between them, because most of these sections are optional:
            a divider element would have to know whether anything follows it,
            and a declaration with no payout and no witnesses would end on a
            stray line. A section that does not render draws nothing, and the
            first section always renders, so the card can never open with a
            rule. */}
        <Box bg="$white" rounded="$2xl" style={styles.card}>
          {/* ── What came in ─────────────────────────────────────────────── */}
          <Box p="$5">
            <HStack alignItems="center" space="xs" mb="$3">
              <Icon as={Calendar} size="xs" color="#6B7280" />
              <Text color="$coolGray500" fontSize="$xs">
                {formatOrderDateTime(declaration.declarationDate, declaration.createdAt)}
              </Text>
            </HStack>

            <HStack space="md">
              <VStack flex={1}>
                <Text fontSize="$2xs" fontWeight="$bold" color="$coolGray400" textTransform="uppercase">
                  {t('declaration.ornaments.totalGrams') || 'Total Grams'}
                </Text>
                <Text fontSize={22} fontWeight="$black" color={INDIGO}>
                  {formatNumber(declaration.totalGrams)} {t('common.gm') || 'gm'}
                </Text>
              </VStack>
              {/* Hidden rather than shown as zero: an exchange settled purely in
                  weight has no rupee figure, and "₹0" reads as a mistake. */}
              {Number(declaration.totalAmount) > 0 && (
                <VStack flex={1} alignItems="flex-end">
                  <Text fontSize="$2xs" fontWeight="$bold" color="$coolGray400" textTransform="uppercase">
                    {t('declaration.ornaments.totalAmount') || 'Total Amount'}
                  </Text>
                  <Text fontSize={22} fontWeight="$black" color="#059669">
                    {formatCurrencyValue(Number(declaration.totalAmount))}
                  </Text>
                </VStack>
              )}
            </HStack>
          </Box>

          {/* ── Customer ─────────────────────────────────────────────────── */}
          <Pressable
            onPress={() =>
              declaration.customerId &&
              navigation.navigate('CustomerDetails', {
                customerId: declaration.customerId,
                customer,
              })
            }
          >
            <Box p="$5" borderTopWidth={1} borderTopColor="$coolGray100">
              <HStack alignItems="center" justifyContent="space-between" space="md">
                <HStack alignItems="center" space="md" flex={1} mr="$2">
                  <Box w={44} h={44} rounded="$full" bg="#F0EDFF" alignItems="center" justifyContent="center" overflow="hidden">
                    {/* The snapshot, not the profile: this document carries the
                        face that was on it when signed. */}
                    {declaration.customerSnapshot?.photoUrl ? (
                      <Image
                        source={{ uri: getFullImageUrl(declaration.customerSnapshot.photoUrl) || undefined }}
                        style={styles.avatar}
                      />
                    ) : (
                      <Icon as={User} size="md" color={PURPLE} />
                    )}
                  </Box>
                  <VStack flexShrink={1}>
                    <HStack alignItems="center" space="xs">
                      <Text fontWeight="$bold" color="$coolGray900" fontSize={16} flexShrink={1} numberOfLines={1}>
                        {declaration.customerSnapshot?.name || customer?.name}
                      </Text>
                      <CustomerCodeBadge code={customer?.customerCode} />
                    </HStack>
                    {!!declaration.customerSnapshot?.phone && (
                      <Text fontSize={13} color="$coolGray500">
                        {declaration.customerSnapshot.phone}
                      </Text>
                    )}
                    {!!declaration.customerSnapshot?.address && (
                      <Text fontSize={12} color="$coolGray400" numberOfLines={2}>
                        {declaration.customerSnapshot.address}
                      </Text>
                    )}
                  </VStack>
                </HStack>
                <Icon as={ChevronRight} color="$coolGray400" size="sm" />
              </HStack>

              {/* Who the gold belonged to, and the ID produced for it — the two
                  facts the clauses on the printed page turn on. */}
              {(!declaration.ownerIsSelf || idProofEntries.length > 0) && (
                <VStack mt="$4" pt="$4" borderTopWidth={1} borderTopColor="$coolGray100" space="sm">
                  {!declaration.ownerIsSelf && (
                    <DetailRow
                      label={t('declaration.ownership.familyMemberName') || 'Family Member Name'}
                      value={declaration.familyMemberName}
                    />
                  )}
                  {idProofEntries.map((entry, i) => {
                    const scans = ((entry as any).photos || []) as {
                      url: string;
                      fileId?: string;
                    }[];
                    return (
                      <VStack key={`${entry.type}_${entry.number}_${i}`} space="xs">
                        <DetailRow
                          label={
                            entry.type === 'other'
                              ? entry.otherLabel || t('declaration.idProof.types.other') || 'Other'
                              : t(`declaration.idProof.types.${entry.type}`) || String(entry.type)
                          }
                          value={entry.number}
                        />
                        {/* The document itself. Shown here and kept as the
                            shop's own record, but never printed — same rule as
                            the witness ID below, and for the same reason: the
                            PDF is the copy the customer walks away with. */}
                        {scans.length > 0 && (
                          <GSScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <HStack space="sm">
                              {scans.map((photo, k) => (
                                <RNPressable
                                  key={photo.fileId || `${photo.url}_${k}`}
                                  onPress={() =>
                                    setIdPhotoViewer({ photos: scans, index: k })
                                  }
                                  accessibilityLabel={
                                    t('declaration.idProof.photos.label') || 'Photo of ID'
                                  }
                                >
                                  <Image
                                    source={{ uri: getFullImageUrl(photo.url) || photo.url }}
                                    style={styles.witnessThumb}
                                  />
                                </RNPressable>
                              ))}
                            </HStack>
                          </GSScrollView>
                        )}
                      </VStack>
                    );
                  })}
                </VStack>
              )}
            </Box>
          </Pressable>

          {/* ── Ornaments ────────────────────────────────────────────────── */}
          <Box p="$5" borderTopWidth={1} borderTopColor="$coolGray100">
            <HStack alignItems="center" space="xs" mb="$4">
              <Icon as={Scale} size="sm" color={INDIGO} />
              <Text fontWeight="$bold" fontSize="$md" color="$coolGray900">
                {t('declaration.ornaments.title') || 'Old Ornaments'}
              </Text>
            </HStack>

            {/* The same item table a bill uses, so an ornament reads the same
                way here as an item does on INV-6 - including its photos, which
                this screen previously did not show at all. Totals stay below:
                a purchase totals in grams as well as rupees, and weight is the
                figure that matters when the shop is buying metal. */}
            <OrderDocumentView
              customer={{
                name: declaration.customerSnapshot?.name,
                phone: declaration.customerSnapshot?.phone,
              }}
              partyLabel={t('declaration.doc.boughtFrom') || 'Bought From'}
              date={declaration.declarationDate}
              items={(declaration.items || []).map((item: any, i: number) => ({
                id: item.id || `orn_${i}`,
                name: item.description,
                purity: [item.metalType, item.purity].filter(Boolean).join(' - '),
                netWeight: Number(item.grams) || 0,
                rate: Number(item.ratePerGm) || 0,
                photos: item.photos || [],
              }))}
              showTotals={false}
              onPhotoPress={(item, photoIndex) => {
                const source = (declaration.items || []).find(
                  (o: any, i: number) => (o.id || `orn_${i}`) === item.id,
                ) as any;
                setItemPhotoViewer({
                  photos: (source?.photos || []) as any,
                  index: photoIndex,
                });
              }}
            />

            <Divider my="$3" bg="$coolGray100" />

            <HStack justifyContent="space-between" alignItems="center">
              <Text fontWeight="$bold" color="$coolGray900">
                {t('declaration.doc.total') || 'Total'}
              </Text>
              <HStack space="md" alignItems="center">
                <Text fontWeight="$black" color={INDIGO}>
                  {formatNumber(declaration.totalGrams)} {t('common.gm') || 'gm'}
                </Text>
                {Number(declaration.totalAmount) > 0 && (
                  <Text fontWeight="$black" color="#059669">
                    {formatCurrencyValue(Number(declaration.totalAmount))}
                  </Text>
                )}
              </HStack>
            </HStack>
          </Box>

          {/* ── Payout ───────────────────────────────────────────────────── */}
          {!!payout && payout.method !== 'none' && (
            <Box p="$5" borderTopWidth={1} borderTopColor="$coolGray100">
              <Text fontWeight="$bold" fontSize="$md" color="$coolGray900" mb="$3">
                {t('declaration.payout.title') || 'Payment to Retailer'}
              </Text>
              <VStack space="sm">
                <DetailRow
                  label={t('declaration.payout.method') || 'Payment Mode'}
                  value={
                    payout.method === 'online'
                      ? `${t('declaration.payout.online') || 'Online'}${
                          payout.onlineType
                            ? ` · ${t(`declaration.payout.${payout.onlineType}`) || payout.onlineType}`
                            : ''
                        }`
                      : t('declaration.payout.cash') || 'Cash'
                  }
                />
                <DetailRow
                  label={t('declaration.payout.reference') || 'Transaction / Cheque No.'}
                  value={payout.reference}
                />
                <DetailRow
                  label={t('declaration.payout.bankName') || 'Bank Name'}
                  value={payout.bankName}
                />
                <DetailRow
                  label={t('declaration.payout.bankAccountNumber') || 'Account Number'}
                  value={payout.bankAccountNumber}
                />
                <DetailRow
                  label={t('declaration.payout.bankIfsc') || 'IFSC Code'}
                  value={payout.bankIfsc}
                />
                <DetailRow
                  label={t('declaration.payout.upiId') || 'UPI ID'}
                  value={payout.upiId}
                />
              </VStack>
            </Box>
          )}

          {/* ── Ornament photos ──────────────────────────
              A record of what came in, not a place to change it. Adding photos
              belongs to Edit, reached from the pencil in the header, where the
              picker sits on the ornament it belongs to — offering it here meant
              tapping "Add Photos" only to be asked to add photos a second time
              in a modal, and attached them to the declaration as a whole rather
              than to any one piece.

              The block itself still renders with none, so a record with no
              photos reads as empty rather than as a section that failed to
              load. */}
          {photos.length > 0 && (
          <Box p="$5" borderTopWidth={1} borderTopColor="$coolGray100">
            <HStack alignItems="center" justifyContent="space-between" mb="$3">
              <Text fontWeight="$bold" fontSize="$md" color="$coolGray900">
                {t('declaration.photos.title') || 'Ornament Photos'}
              </Text>
              <Text fontSize="$2xs" color="$coolGray400">
                {(t('declaration.photos.uploadedCount') || '{used} of {max} added')
                  .replace('{used}', String(photos.length))
                  .replace('{max}', String(MAX_PHOTOS))}
              </Text>
            </HStack>

            <GSScrollView horizontal showsHorizontalScrollIndicator={false}>
              <HStack space="sm">
                {photos.map((photo, i) => (
                  <RNPressable
                    key={photo.fileId || `${photo.url}_${i}`}
                    onPress={() => setPhotoViewerIndex(i)}
                    accessibilityLabel={t('declaration.photos.title') || 'Ornament photo'}
                  >
                    <Image
                      source={{ uri: getFullImageUrl(photo.url) || photo.url }}
                      style={styles.thumb}
                    />
                  </RNPressable>
                ))}
              </HStack>
            </GSScrollView>

            <Text fontSize="$2xs" color="$coolGray400" mt="$2">
              {t('declaration.photos.tapToEnlarge') || 'Tap a photo to enlarge'}
            </Text>
          </Box>
          )}

          {/* ── Witnesses ─────────────────────────────── */}
          {witnesses.length > 0 && (
            <Box p="$5" borderTopWidth={1} borderTopColor="$coolGray100">
              <Text fontWeight="$bold" fontSize="$md" color="$coolGray900" mb="$3">
                {t('declaration.witnesses.title') || 'Witnesses'}
              </Text>
              <VStack space="md">
                {witnesses.map((w, i) => {
                  const idPhotos = (w.photos || []) as { url: string; fileId?: string }[];
                  return (
                    <VStack key={w.id || `${w.name}_${i}`} space="xs">
                      <DetailRow
                        label={`${i + 1}.`}
                        value={[w.name, w.phone].filter(Boolean).join(' · ')}
                      />
                      {/* Their ID proof. Kept as the shop’s own record and shown
                          here, but deliberately never printed — the declaration
                          PDF is the copy the customer walks away with. */}
                      {idPhotos.length > 0 && (
                        <GSScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <HStack space="sm">
                            {idPhotos.map((photo, k) => (
                              <RNPressable
                                key={photo.fileId || `${photo.url}_${k}`}
                                onPress={() =>
                                  setIdPhotoViewer({ photos: idPhotos, index: k })
                                }
                                accessibilityLabel={
                                  t('declaration.witnesses.photos.label') || 'ID proof'
                                }
                              >
                                <Image
                                  source={{ uri: getFullImageUrl(photo.url) || photo.url }}
                                  style={styles.witnessThumb}
                                />
                              </RNPressable>
                            ))}
                          </HStack>
                        </GSScrollView>
                      )}
                    </VStack>
                  );
                })}
              </VStack>
            </Box>
          )}

          {/* ── Customer signature ───────────────────────
              Stored as raw SVG XML by the in-app signature pad, so it needs
              SvgXml rather than Image. Absent on declarations signed on paper
              or saved before on-device signing existed. */}
          {!!declaration.customerSignature && (
            <Box p="$5" borderTopWidth={1} borderTopColor="$coolGray100">
              <Text fontWeight="$bold" fontSize="$md" color="$coolGray900" mb="$3">
                {t('declaration.signature.title') || 'Retailer Signature'}
              </Text>
              <Box
                borderWidth={1}
                borderColor="$coolGray200"
                rounded="$xl"
                h={110}
                alignItems="center"
                justifyContent="center"
                p="$2"
              >
                <SvgXml xml={declaration.customerSignature} width="100%" height="100%" />
              </Box>
            </Box>
          )}

          {/* ── The bill this came in against ────────────────────────────── */}
          {!!linkedOrder && (
            <Pressable
              onPress={() => navigation.navigate('OrderDetails', { orderId: linkedOrder.id })}
            >
              <Box p="$5" borderTopWidth={1} borderTopColor="$coolGray100">
                <HStack alignItems="center" justifyContent="space-between">
                  <HStack alignItems="center" space="md" flex={1} mr="$2">
                    <Icon as={FileText} size="sm" color={PURPLE} />
                    <VStack flexShrink={1}>
                      <Text fontWeight="$bold" color="$coolGray900" fontSize={14}>
                        {t('declaration.linkedOrder') || 'Bill this was exchanged against'}
                      </Text>
                      <Text fontSize={12} color="$coolGray500">
                        {linkedOrder.invoiceNumber || linkedOrder.orderNumber || linkedOrder.id}
                      </Text>
                    </VStack>
                  </HStack>
                  <Icon as={ChevronRight} color="$coolGray400" size="sm" />
                </HStack>
              </Box>
            </Pressable>
          )}

          {/* ── The document ─────────────────────────────────────────────── */}
          <Box p="$5" borderTopWidth={1} borderTopColor="$coolGray100">
            <Text fontWeight="$bold" fontSize="$md" color="$coolGray900" mb="$4">
              {t('declaration.title') || 'Declaration / Affidavit'}
            </Text>
            <DocumentActionsRow
              onPrint={handlePrint}
              onDownload={handleDownload}
              onShare={handleShare}
            />
            <PrintTargetNote />
          </Box>
        </Box>
      </ScrollView>

      <OrnamentPhotoViewer
        photos={photos}
        initialIndex={photoViewerIndex ?? 0}
        isOpen={photoViewerIndex !== null}
        onClose={() => setPhotoViewerIndex(null)}
      />

      {/* A second viewer, not a shared one: an ID proof is a different list per
          document and per witness, so the viewer has to be handed the list as
          well as the index. Same split OrderDetailsScreen makes for item
          photos. */}
      <OrnamentPhotoViewer
        photos={idPhotoViewer?.photos ?? []}
        initialIndex={idPhotoViewer?.index ?? 0}
        isOpen={idPhotoViewer !== null}
        onClose={() => setIdPhotoViewer(null)}
      />

      <OrnamentPhotoViewer
        photos={itemPhotoViewer?.photos ?? []}
        initialIndex={itemPhotoViewer?.index ?? 0}
        isOpen={itemPhotoViewer !== null}
        onClose={() => setItemPhotoViewer(null)}
      />

      <ConfirmModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        tone="destructive"
        icon="trash"
        title={t('declaration.deleteConfirm') || 'Delete this declaration?'}
        description={
          t('declaration.deleteConfirmDesc') ||
          'A signed declaration is a legal record. Delete it only if it was created by mistake.'
        }
        confirmLabel={t('common.delete') || 'Delete'}
        cancelLabel={t('common.cancel') || 'Cancel'}
        loading={deleting}
        onConfirm={confirmDelete}
      />

      <ImpersonationBlockModal
        isOpen={blockModalVisible}
        phone={impersonatePhone || ''}
        onEndSession={handleEndSession}
        onClose={() => setBlockModalVisible(false)}
      />
    </Box>
  );
}

/** Label on the left, value on the right. Renders nothing without a value, so
 *  the optional half of a declaration does not leave a column of empty rows. */
const DetailRow = ({ label, value }: { label: string; value?: string }) => {
  if (!value) return null;
  return (
    <HStack justifyContent="space-between" alignItems="flex-start" space="md">
      <Text fontSize={12} color="$coolGray500" flexShrink={0}>
        {label}
      </Text>
      <Text fontSize={13} color="$coolGray900" textAlign="right" flex={1}>
        {value}
      </Text>
    </HStack>
  );
};

const styles = StyleSheet.create({
  headerSafeArea: { backgroundColor: '#FFFFFF' },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: { width: '100%', height: '100%' },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  // Smaller than an ornament photo: a witness ID sits under a name in a list,
  // not in a strip of its own, and at 72px it dominated the row it belongs to.
  witnessThumb: {
    width: 56,
    height: 56,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
});
