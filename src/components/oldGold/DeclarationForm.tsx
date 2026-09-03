import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Box,
  HStack,
  VStack,
  Text,
  Pressable,
  Icon,
  Input,
  InputField,
  Switch,
} from '@gluestack-ui/themed';
import { Formik, FieldArray } from 'formik';
import { ArrowLeft, Calendar, Plus, Trash2, ChevronDown, ChevronUp, PenLine, RotateCw } from 'lucide-react-native';
import { SvgXml } from 'react-native-svg';
import SignatureCaptureModal from '../common/SignatureCaptureModal';
import { rotateSignatureSvg, canRotateSignature } from '../../utils/signature';

import GradientButton from '../common/GradientButton';
import LanguagePicker from '../common/LanguagePicker';
import SelectField from '../common/SelectField';
import DatePickerModal from '../common/DatePickerModal';
import DeclarationCustomerSection, {
  useDeclarationPhoneValidation,
} from './DeclarationCustomerSection';
import PhotoField from '../photos/PhotoField';
import { MAX_ITEM_PHOTOS } from '../items/ItemPhotoPicker';
import WitnessPhotoPicker from './WitnessPhotoPicker';
import Collapsible from '../common/Collapsible';
import ValidationErrorModal from '../ValidationErrorModal';
import { makeEmptyWitness } from '../../utils/witness';
import { useTranslation } from '../../hooks/useTranslation';
import { LAYOUT } from '../../constants/layout';
import { INPUT_LIMITS } from '../../constants/inputLimits';
import { GOLD_PURITY_OPTIONS, SILVER_PURITY_OPTIONS } from '../../constants/bill';
import type {
  DeclarationFormValues,
  DeclarationItem,
  IdProofEntry,
  IdProofType,
  PayoutMethod,
  PurchaseOldGold,
} from '../../types';
import { ID_PROOF_TYPES } from '../../constants/idProof';

const PURPLE = '#6D5EF7';

/** A seller rarely produces more than a couple of documents. */
const MAX_ID_PROOFS = 3;

/** The printed declaration has exactly two witness lines. */
const MAX_WITNESSES = 2;

/**
 * An ornament counts once it is named and weighed — the two things the
 * document cannot be written without.
 *
 * Shared by validation and by the gate that reveals the rest of the form, and
 * that is the point: gate on anything stricter than what validation demands
 * and a form that passes validation could still be hiding the fields its
 * errors refer to.
 */
export const isOrnamentComplete = (item: DeclarationItem): boolean =>
  !!item.description.trim() && Number(item.grams) > 0;

export const makeEmptyOrnament = (metalType: 'Gold' | 'Silver' = 'Gold'): DeclarationItem => ({
  id: `orn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  description: '',
  grams: '',
  grossWt: '',
  lessWt: '',
  metalType,
  purity: '',
  ratePerGm: '',
  amount: '',
});

export const makeInitialDeclaration = (
  overrides: Partial<DeclarationFormValues> = {},
): DeclarationFormValues => ({
  declarationDate: new Date().toISOString().split('T')[0],
  customerId: '',
  customerName: '',
  customerPhone: '',
  customerAddress: '',
  mode: 'standalone',
  // Overridden by every real caller with the shop's declaration-language
  // setting; 'en' only stands in for a caller that forgets, which the form's
  // own language card then makes visible rather than silent.
  language: 'en',
  ownerIsSelf: true,
  familyMemberName: '',
  idProofs: [makeEmptyIdProof()],
  purchaseReceiptDetails: '',
  noReceiptReason: '',
  // Empty until the shopkeeper picks a metal — an ornament row cannot be
  // created without knowing whether it is gold or silver, since that decides
  // which purity list it offers.
  items: [],
  payout: { method: 'cash' },
  // Empty by default — the witness block is opt-in, and a filtered-out blank
  // row was reaching the document as an empty signature line.
  witnesses: [],
  // On by default, the opposite of the bill's photo toggle. A bill is the
  // customer's copy, where photos are a nicety the shop opts into; a
  // declaration is the shop's record of what it took in, and the photograph
  // is the evidence the document exists to hold. Switching it off is the
  // deliberate act here.
  includePhotosOnDeclaration: true,
  pendingPhotos: [],
  ...overrides,
});

interface SectionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export const Section = ({ title, subtitle, children }: SectionProps) => (
  <Box
    bg="$white"
    p="$5"
    rounded="$xl"
    borderWidth={1}
    borderColor="#E5E7EB"
    shadowColor="#000"
    shadowOffset={{ width: 0, height: 1 }}
    shadowOpacity={0.05}
    elevation={2}
  >
    <VStack mb="$3">
      <Text fontWeight="$bold" fontSize={15} color="$coolGray800">
        {title}
      </Text>
      {!!subtitle && (
        <Text fontSize={12} color="$coolGray500">
          {subtitle}
        </Text>
      )}
    </VStack>
    {children}
  </Box>
);

interface FieldProps {
  label: string;
  value?: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'characters' | 'words';
  multiline?: boolean;
}

export const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  maxLength,
  autoCapitalize = 'sentences',
  multiline,
}: FieldProps) => (
  <VStack space="xs" flex={1}>
    <Text fontSize={12} color="$coolGray600">
      {label}
    </Text>
    <Input h={multiline ? 72 : 44} borderColor="$coolGray200" rounded="$lg" bg="$white">
      <InputField
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        fontSize={14}
        style={multiline ? styles.multilineInput : undefined}
      />
    </Input>
  </VStack>
);

/**
 * Segmented single-choice row, styled like the payout-method selector.
 * `value` may be undefined, which leaves every option unselected — used where
 * pre-answering on the customer's behalf would be wrong.
 */
export const ChoiceRow = ({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value?: string;
  onChange: (v: string) => void;
}) => (
  <HStack space="sm">
    {options.map(o => {
      const selected = value === o.value;
      return (
        <Pressable key={o.value} flex={1} onPress={() => onChange(o.value)}>
          <Box
            rounded="$lg"
            borderWidth={1}
            borderColor={selected ? PURPLE : '$coolGray200'}
            bg={selected ? '#EEF2FF' : '$white'}
            py="$3"
            alignItems="center"
          >
            <Text
              fontSize={13}
              fontWeight="$bold"
              color={selected ? '#4F46E5' : '$coolGray600'}
            >
              {o.label}
            </Text>
          </Box>
        </Pressable>
      );
    })}
  </HStack>
);

/** Mirrors MAX_ID_PROOF_PHOTOS on the backend — front and back of one card. */
export const MAX_ID_PROOF_PHOTOS = 2;

export const makeEmptyIdProof = (type: IdProofType = 'aadhaar'): IdProofEntry => ({
  id: `idp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  type,
  number: '',
  otherLabel: '',
  pendingPhotos: [],
});

/**
 * The declaration's list of ID documents.
 *
 * Shared by the full form and the exchange modal so the two cannot drift — the
 * modal previously duplicated the single-ID markup, which is how it kept its
 * own copy of every fix.
 */
export const IdProofList = ({
  entries,
  onChange,
  savedPhotosFor,
  onDeleteSavedPhoto,
}: {
  entries: IdProofEntry[];
  onChange: (next: IdProofEntry[]) => void;
  /**
   * The scans already uploaded against one entry. Read through a lookup rather
   * than off the form value, for the same reason the witness picker does: the
   * saved record is what a delete updates, so a form value copied at open time
   * would keep showing a photo that is no longer there. Omitted while the
   * declaration is new, where nothing is uploaded yet.
   */
  savedPhotosFor?: (entry: IdProofEntry) => { url: string; fileId?: string }[] | undefined;
  /** Deletes an already-uploaded scan; omitted while the declaration is new. */
  onDeleteSavedPhoto?: (idProofId: string, fileId: string) => Promise<boolean>;
}) => {
  const { t } = useTranslation();
  const list = entries.length ? entries : [makeEmptyIdProof()];

  const update = (index: number, patch: Partial<IdProofEntry>) =>
    onChange(list.map((e, i) => (i === index ? { ...e, ...patch } : e)));

  // Another ID is only useful once the current one is filled in.
  const canAdd = list.every(e => e.number.trim()) && list.length < MAX_ID_PROOFS;

  /**
   * A document type already spoken for by another row.
   *
   * One person has one Aadhaar and one PAN, so offering a type a second time
   * only invites a row that duplicates the one above it — and two rows sharing
   * a type print as two identical-looking ID lines on the declaration.
   *
   * `other` is deliberately exempt: it is not a document, it is a placeholder
   * for one named in its own free-text field, so two `other` rows are two
   * different documents ("Ration Card", "Voter Slip") and excluding it would
   * cap the shopkeeper at a single miscellaneous ID.
   */
  const typeTakenElsewhere = (type: IdProofType, exceptIndex: number) =>
    type !== 'other' && list.some((e, i) => i !== exceptIndex && e.type === type);

  // The row's own current type always stays listed, or the picker would show a
  // blank selection for the value it is actually holding.
  const typesFor = (index: number) =>
    ID_PROOF_TYPES.filter(v => !typeTakenElsewhere(v, index));

  // `other` is never taken, so this always resolves — a new row can never open
  // on a type that is already used above it.
  const firstFreeType = ID_PROOF_TYPES.find(v => !typeTakenElsewhere(v, -1)) || 'other';

  return (
    <VStack space="md">
      {list.map((entry, index) => (
        <VStack key={entry.id} space="sm">
          {list.length > 1 && (
            <HStack justifyContent="space-between" alignItems="center">
              <Text fontSize={12} fontWeight="$bold" color="$coolGray500">
                {(t('declaration.idProof.rowLabel') || 'ID {number}').replace(
                  '{number}',
                  String(index + 1),
                )}
              </Text>
              <Pressable onPress={() => onChange(list.filter((_, i) => i !== index))} p="$1">
                <Icon as={Trash2} size="sm" color="#EF4444" />
              </Pressable>
            </HStack>
          )}

          <VStack space="xs">
            <Text fontSize={12} color="$coolGray600">
              {t('declaration.idProof.type') || 'ID Proof Type *'}
            </Text>
            <SelectField
              value={entry.type}
              items={typesFor(index).map(v => ({
                label: t(`declaration.idProof.types.${v}`) || v,
                value: v,
              }))}
              title={t('declaration.idProof.title') || 'ID Proof'}
              onValueChange={v => update(index, { type: v as IdProofType })}
            />
          </VStack>

          {entry.type === 'other' && (
            <Field
              label={t('declaration.idProof.otherLabel') || 'Name of Document *'}
              value={entry.otherLabel}
              placeholder={t('declaration.idProof.otherPlaceholder')}
              maxLength={INPUT_LIMITS.idProofOtherLabel}
              onChangeText={v => update(index, { otherLabel: v })}
            />
          )}

          <Field
            label={t('declaration.idProof.number') || 'ID Proof Number *'}
            value={entry.number}
            placeholder={t('declaration.idProof.numberPlaceholder')}
            maxLength={INPUT_LIMITS.idProofNumber}
            autoCapitalize="characters"
            onChangeText={v => update(index, { number: v })}
          />

          {/* Only once the document is identified, exactly like the witness
              picker: a blank row is never sent to the server, so it has no
              entry for scans to hang on and offering the button would promise
              an upload that silently could not happen. */}
          {!!entry.number.trim() && (
            <PhotoField
              saved={savedPhotosFor?.(entry)}
              pending={entry.pendingPhotos || []}
              onChangePending={next => update(index, { pendingPhotos: next })}
              onDeleteSaved={
                onDeleteSavedPhoto && entry.id
                  ? fileId => onDeleteSavedPhoto(entry.id, fileId)
                  : undefined
              }
              max={MAX_ID_PROOF_PHOTOS}
              compact
              addLabel={t('declaration.idProof.photos.label') || 'Photo of ID (optional)'}
              limitMessage={
                t('declaration.idProof.photos.limitReached') ||
                'You can add up to {count} photos per ID'
              }
            />
          )}
        </VStack>
      ))}

      {list.length < MAX_ID_PROOFS && (
        <TouchableOpacity
          disabled={!canAdd}
          onPress={() => onChange([...list, makeEmptyIdProof(firstFreeType)])}
          style={[styles.addWitnessButton, !canAdd && styles.addWitnessButtonDisabled]}
        >
          <Icon as={Plus} size="xs" color={canAdd ? PURPLE : '$coolGray400'} mr="$1" />
          <Text fontSize={13} fontWeight="$bold" color={canAdd ? PURPLE : '$coolGray400'}>
            {t('declaration.idProof.add') || 'Add another ID'}
          </Text>
        </TouchableOpacity>
      )}
    </VStack>
  );
};

/**
 * Purity picker with the same "Custom" escape hatch the invoice exchange row
 * has: old gold often carries no standard grade ("916 hallmark", "mixed"), and
 * purity here is descriptive text, not an input to any calculation.
 */
const PurityField = ({
  value,
  metalType,
  useCustom,
  onChangeValue,
  onChangeUseCustom,
}: {
  value: string;
  metalType?: string;
  useCustom?: boolean;
  onChangeValue: (v: string) => void;
  onChangeUseCustom: (next: boolean, keepsValue: boolean) => void;
}) => {
  const { t } = useTranslation();
  const options = (metalType === 'Silver' ? SILVER_PURITY_OPTIONS : GOLD_PURITY_OPTIONS).map(
    p => ({ label: p, value: p }),
  );
  // Derived, so a saved row whose purity is not a preset reopens in custom mode
  // rather than showing a blank dropdown.
  const isCustom =
    useCustom ?? (!!value && !(options.map(o => o.value) as string[]).includes(value));

  return (
    <VStack space="xs" flex={1}>
      <HStack justifyContent="space-between" alignItems="center">
        <Text fontSize={12} color="$coolGray600">
          {t('invoice.exchange.purity') || 'Purity'}
        </Text>
        <HStack alignItems="center" space="xs">
          <Text fontSize={10} color="$coolGray400">
            {t('invoice.exchange.customPurity') || 'Custom'}
          </Text>
          <Switch
            size="sm"
            value={isCustom}
            onValueChange={(next: boolean) =>
              onChangeUseCustom(
                next,
                next || (options.map(o => o.value) as string[]).includes(value),
              )
            }
            trackColor={{ false: '#E2E8F0', true: '#8B5CF6' }}
          />
        </HStack>
      </HStack>
      {isCustom ? (
        <Input h={44} borderColor="$coolGray200" rounded="$lg" bg="$white">
          <InputField
            value={value}
            onChangeText={onChangeValue}
            placeholder={t('invoice.exchange.customPurityPlaceholder') || 'e.g. 916 hallmark'}
            maxLength={INPUT_LIMITS.purity}
            fontSize={14}
          />
        </Input>
      ) : (
        <SelectField
          value={value}
          items={options}
          title={t('invoice.exchange.purity') || 'Purity'}
          onValueChange={onChangeValue}
        />
      )}
    </VStack>
  );
};

interface OrnamentCardProps {
  item: DeclarationItem;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  canRemove: boolean;
  setFieldValue: (field: string, value: any) => void;
  /** Deletes an already-uploaded photo from this ornament; omitted while the
   *  declaration is still unsaved and there is nothing on the server yet. */
  onDeletePhoto?: (itemId: string | undefined, fileId: string) => Promise<boolean>;
}

const DeclarationOrnamentCard = ({
  item,
  index,
  isExpanded,
  onToggle,
  onRemove,
  canRemove,
  setFieldValue,
  onDeletePhoto,
}: OrnamentCardProps) => {
  const { t } = useTranslation();
  return (
    <Box bg="$white" rounded="$xl" borderWidth={1} borderColor="$coolGray100" overflow="hidden">
      <Pressable onPress={onToggle}>
        <Box p="$3">
          <HStack justifyContent="space-between" alignItems="center">
            <VStack flex={1} space="xs">
              <HStack alignItems="center" space="sm">
                <Text fontWeight="$bold" fontSize="$md" color="$coolGray900" numberOfLines={1}>
                  {item.description?.trim()
                    ? item.description
                    : `${t(`metals.${(item.metalType || 'Gold').toLowerCase()}`) || item.metalType || 'Gold'} ${
                        t('declaration.ornaments.itemLabel') || 'Ornament'
                      } ${index + 1}`}
                </Text>
                {isExpanded && <Icon as={ChevronUp} size="md" color="$coolGray400" />}
              </HStack>
              {!isExpanded && (
                <Text color="$coolGray500" fontSize={12} numberOfLines={1}>
                  {`${t('declaration.ornaments.grams') || 'Grams'}: ${item.grams || '0'}${
                    Number(item.amount) > 0
                      ? ` | ${t('declaration.ornaments.amount') || 'Amount'}: ₹${Number(
                          item.amount,
                        ).toLocaleString('en-IN')}`
                      : ''
                  }`}
                </Text>
              )}
            </VStack>
            <HStack space="md" alignItems="center">
              {canRemove && (
                <TouchableOpacity
                  onPress={e => {
                    e.stopPropagation();
                    onRemove();
                  }}
                  style={{ padding: 4 }}
                >
                  <Icon as={Trash2} color="$red400" size="md" />
                </TouchableOpacity>
              )}
              {!isExpanded && <Icon as={ChevronDown} size="md" color="$coolGray400" />}
            </HStack>
          </HStack>
        </Box>
      </Pressable>

      {isExpanded && (
        <VStack space="sm" p="$3" pt={0}>
          <Field
            label={t('invoice.exchange.itemName') || 'Item Name'}
            value={item.description}
            placeholder={t('declaration.ornaments.descriptionPlaceholder')}
            maxLength={INPUT_LIMITS.declarationItemDescription}
            onChangeText={v => setFieldValue(`items[${index}].description`, v)}
          />

          {/* Gross/less feed net, matching the invoice exchange row. Net stays
              directly editable too, so a shopkeeper who only weighed the
              finished figure can still type it straight in. */}
          <HStack space="sm">
            <Field
              label={t('invoice.exchange.grossWt') || 'Gross Wt (gm)'}
              value={item.grossWt}
              keyboardType="decimal-pad"
              maxLength={INPUT_LIMITS.weight}
              onChangeText={v => {
                const gross = Number(v) || 0;
                const less = Number(item.lessWt) || 0;
                setFieldValue(`items[${index}].grossWt`, v);
                if (v || item.lessWt) {
                  setFieldValue(`items[${index}].grams`, String(gross - less));
                }
              }}
            />
            <Field
              label={t('invoice.exchange.lessWt') || 'Less Wt (gm)'}
              value={item.lessWt}
              keyboardType="decimal-pad"
              maxLength={INPUT_LIMITS.weight}
              onChangeText={v => {
                const gross = Number(item.grossWt) || 0;
                const less = Number(v) || 0;
                setFieldValue(`items[${index}].lessWt`, v);
                if (item.grossWt || v) {
                  setFieldValue(`items[${index}].grams`, String(gross - less));
                }
              }}
            />
          </HStack>

          <HStack space="sm">
            <Field
              label={t('invoice.exchange.netWt') || 'Net Wt (gm) *'}
              value={item.grams}
              keyboardType="decimal-pad"
              maxLength={INPUT_LIMITS.weight}
              onChangeText={v => setFieldValue(`items[${index}].grams`, v)}
            />
            <PurityField
              value={item.purity || ''}
              metalType={item.metalType}
              useCustom={item.useCustomPurity}
              onChangeValue={v => setFieldValue(`items[${index}].purity`, v)}
              onChangeUseCustom={(next, keepsValue) => {
                setFieldValue(`items[${index}].useCustomPurity`, next);
                if (!keepsValue) setFieldValue(`items[${index}].purity`, '');
              }}
            />
          </HStack>

          <HStack space="sm">
            <Field
              label={t('invoice.exchange.ratePerGm') || 'Rate/gm (₹)'}
              value={item.ratePerGm}
              keyboardType="decimal-pad"
              maxLength={INPUT_LIMITS.rate}
              onChangeText={v => setFieldValue(`items[${index}].ratePerGm`, v)}
            />
            <Field
              label={t('invoice.exchange.amount') || 'Total Amount (₹)'}
              value={item.amount}
              keyboardType="decimal-pad"
              maxLength={INPUT_LIMITS.amount}
              onChangeText={v => setFieldValue(`items[${index}].amount`, v)}
            />
          </HStack>

          {/* Photos of this ornament, not of the declaration. A declaration can
              cover several pieces, and one shared set could not say which photo
              was of which — the question the photos exist to answer. Addressed
              by item.id server-side, so removing an ornament takes its own
              photos with it rather than shifting them onto its neighbour. */}
          <Box pt="$1">
            <PhotoField
              saved={item.photos}
              pending={item.pendingPhotos || []}
              onChangePending={next => setFieldValue(`items[${index}].pendingPhotos`, next)}
              onDeleteSaved={onDeletePhoto ? fileId => onDeletePhoto(item.id, fileId) : undefined}
              max={MAX_ITEM_PHOTOS}
              compact
              addLabel={t('declaration.photos.addPhotos') || 'Add Photos'}
            />
          </Box>
        </VStack>
      )}
    </Box>
  );
};

/**
 * Whether anything has been entered that leaving would throw away.
 *
 * Not Formik's `dirty`: the form is re-seeded from the carried-over values on
 * the way back from the customer picker, which would report a half-written
 * declaration as untouched. The customer block is excluded on purpose — it is
 * prefilled from the picked customer, not typed here.
 */
const hasDeclarationInput = (v: DeclarationFormValues) =>
  v.items.length > 0 ||
  (v.pendingPhotos?.length ?? 0) > 0 ||
  (v.witnesses?.length ?? 0) > 0 ||
  !v.ownerIsSelf ||
  !!v.familyMemberName?.trim() ||
  !!v.purchaseReceiptDetails?.trim() ||
  !!v.noReceiptReason?.trim() ||
  (v.idProofs || []).some(e => !!e.number?.trim()) ||
  v.payout.method !== 'cash';

/**
 * Reports form emptiness up to the screen that owns the back guard. A child
 * component rather than a hook call inside Formik's render prop, which would
 * nest hooks in a render callback.
 */
const DirtyReporter = ({
  dirty,
  onChange,
}: {
  dirty: boolean;
  onChange?: (dirty: boolean) => void;
}) => {
  useEffect(() => {
    onChange?.(dirty);
  }, [dirty, onChange]);
  return null;
};

interface DeclarationFormProps {
  initialValues: DeclarationFormValues;
  isSubmitting?: boolean;
  isEditMode?: boolean;
  onBack: () => void;
  onSubmit: (values: DeclarationFormValues) => void;
  /** Fires when the form crosses between empty and filled, so the hosting
   *  screen can confirm before a back press throws the declaration away. */
  onDirtyChange?: (dirty: boolean) => void;
  /**
   * Reassign the declaration to a different customer. Receives the current
   * values so the caller can carry the half-filled form across the customer
   * picker. Omitted (or in edit mode) hides the Change action, matching how an
   * existing order/invoice refuses to change counterparty.
   */
  onChangeCustomer?: (values: DeclarationFormValues) => void;
  /**
   * The saved record being edited, read only for photos it already holds.
   * Absent while creating, where nothing is uploaded yet.
   *
   * Deliberately not folded into `initialValues`: those are Formik's, and
   * uploaded photos are not form fields — deleting one takes effect on the
   * server immediately rather than on Save, so treating them as form state
   * would promise a Cancel that cannot be honoured.
   */
  savedDeclaration?: PurchaseOldGold;
  /** Addressed by the ornament's own id, never by row index — same contract as
   *  the witness one below, and for the same reason. */
  onDeleteItemPhoto?: (itemId: string | undefined, fileId: string) => Promise<boolean>;
  /** Addressed by the witness's own id, never by row index. */
  onDeleteWitnessPhoto?: (witnessId: string, fileId: string) => Promise<boolean>;
  /** Addressed by the ID entry's own id, for the same reason. */
  onDeleteIdProofPhoto?: (idProofId: string, fileId: string) => Promise<boolean>;
}

/**
 * The declaration capture form.
 *
 * Shared by the standalone "Old Gold Purchase" flow and the optional
 * declaration attached to an invoice exchange — the only difference between
 * them is `mode` and what the caller prefills.
 *
 * Nothing here is reachable from the ordinary exchange flow. A shopkeeper who
 * just notes an old ornament's name and the amount deducted on the bill never
 * sees this screen.
 */
const DeclarationForm = ({
  initialValues,
  isSubmitting,
  isEditMode,
  onBack,
  onSubmit,
  onChangeCustomer,
  onDirtyChange,
  savedDeclaration,
  onDeleteItemPhoto,
  onDeleteWitnessPhoto,
  onDeleteIdProofPhoto,
}: DeclarationFormProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  // Outlives showErrors deliberately: that one goes false the moment the error
  // dialog is dismissed, which is exactly when the shopkeeper starts looking
  // for the field it was complaining about.
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [expandedItems, setExpandedItems] = useState<number[]>([]);
  // Open when reopening a declaration that already names a witness.
  const [showWitnesses, setShowWitnesses] = useState(() =>
    (initialValues.witnesses || []).some(w => w.name?.trim()),
  );
  const [showSignature, setShowSignature] = useState(false);
  const validatePhone = useDeclarationPhoneValidation(initialValues.customerId);

  const validate = (values: DeclarationFormValues): string[] => {
    const list: string[] = [];

    // A customer's phone number is optional everywhere else — a walk-in buying
    // a small item does not have to give one. A declaration is the exception:
    // it is the shop's legal record of who sold them gold, and a seller with no
    // way to be reached is not a record worth keeping. The backend enforces the
    // same rule; this is here so the shopkeeper is told before filling in the
    // whole form rather than after.
    //
    // Skipped when editing: the section is read-only there, because the signed
    // document's snapshot is fixed server-side. Validating a number nothing on
    // screen can change would block the edit with no way out of it.
    if (!isEditMode) {
      const phoneMessage = validatePhone(values.customerPhone);
      if (phoneMessage) list.push(phoneMessage);
    }

    if (!values.items.some(isOrnamentComplete)) {
      list.push(
        t('declaration.ornaments.required') ||
          'Description and grams are required for every ornament',
      );
    }

    if (!values.ownerIsSelf && !values.familyMemberName?.trim()) {
      list.push(
        t('declaration.ownership.familyMemberRequired') ||
          'Please name the family member who owns the ornaments',
      );
    }

    // At least one ID must be complete; any extra rows must be complete too,
    // so a half-typed second document cannot reach a signed declaration.
    const idProofs = values.idProofs || [];
    if (!idProofs.some(e => e.number.trim())) {
      list.push(
        t('declaration.idProof.required') || 'ID proof type and number are required',
      );
    } else if (idProofs.some(e => !e.number.trim())) {
      list.push(
        t('declaration.idProof.incomplete') || 'Please complete or remove the blank ID proof',
      );
    }

    if (idProofs.some(e => e.type === 'other' && !e.otherLabel?.trim())) {
      list.push(
        t('declaration.idProof.otherRequired') || 'Please name the ID proof document',
      );
    }

    if (values.payout.method === 'online' && !values.payout.onlineType) {
      list.push(
        t('declaration.payout.onlineTypeRequired') ||
          'Please select an online payment type',
      );
    }

    return list;
  };

  return (
    <Box flex={1} bg="$coolGray50">
      <Box bg="$white" borderBottomWidth={1} borderBottomColor="$coolGray100">
        <SafeAreaView edges={['top']}>
          <HStack
            px="$4"
            py="$3"
            alignItems="center"
            space="md"
            style={LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}}
          >
            <TouchableOpacity onPress={onBack} style={{ padding: 8 }}>
              <Icon as={ArrowLeft} size="xl" color="$coolGray800" />
            </TouchableOpacity>
            <VStack flex={1}>
              <Text fontSize="$lg" fontWeight="$bold" color="$coolGray900">
                {isEditMode
                  ? t('declaration.editTitle') || 'Edit Declaration'
                  : t('declaration.createTitle') || 'Old Gold Purchase'}
              </Text>
            </VStack>
          </HStack>
        </SafeAreaView>
      </Box>

      <Formik
        initialValues={initialValues}
        enableReinitialize
        onSubmit={values => {
          const found = validate(values);
          if (found.length > 0) {
            setErrors(found);
            setShowErrors(true);
            setSubmitAttempted(true);
            return;
          }
          // Drop the placeholder rows the form starts with so blank ornaments
          // and unnamed witnesses never reach the document.
          onSubmit({
            ...values,
            items: values.items.filter(
              i => i.description.trim() && Number(i.grams) > 0,
            ),
            witnesses: values.witnesses.filter(w => w.name?.trim()),
          });
        }}
      >
        {({ values, setFieldValue, handleSubmit, dirty }) => {
          // Every existing row must be named before another can be added,
          // otherwise blank rows stack up and get filtered away on submit.
          const canAddWitness =
            values.witnesses.length > 0 &&
            values.witnesses.every(w => !!w.name?.trim());
          // Everything below Ownership describes the transaction rather than
          // the goods, so it stays out of the way until there is an ornament to
          // transact. Same test validation uses — see isOrnamentComplete.
          const hasOrnament = values.items.some(isOrnamentComplete);
          // Only ever used to tint the field once a submit has failed, so it
          // does not scold someone halfway through typing a number.
          const phoneError = isEditMode ? null : validatePhone(values.customerPhone);
          const totals = values.items.reduce(
            (acc, i) => ({
              grams: acc.grams + (Number(i.grams) || 0),
              amount: acc.amount + (Number(i.amount) || 0),
            }),
            { grams: 0, amount: 0 },
          );

          return (
            <KeyboardAvoidingView
              style={styles.flex}
              // Never `undefined` on Android: edgeToEdgeEnabled makes the
              // manifest's adjustResize insufficient on its own.
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              {/* Edit mode opens on a full declaration, so "has anything been
                  typed" would report unsaved work before it is touched — it
                  compares against what was loaded instead. */}
              <DirtyReporter
                dirty={isEditMode ? dirty : hasDeclarationInput(values)}
                onChange={onDirtyChange}
              />
              <ScrollView
                // Without this the first tap on any field only dismisses the
                // keyboard, which is indistinguishable from a dead input.
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[
                  styles.scrollContent,
                  LAYOUT.contentContainerStyle,
                  // Real inset, not a hardcoded pad — the submit button has to
                  // clear the home indicator on a button-less iPhone.
                  { paddingBottom: 24 + insets.bottom },
                ]}
              >
                {/* Customer. The phone and the portrait are collected here and
                    written to the profile on save — see
                    DeclarationCustomerSection for why they cannot be collected
                    onto the declaration alone. */}
                <DeclarationCustomerSection
                  customerId={values.customerId}
                  name={values.customerName}
                  phone={values.customerPhone}
                  onChangePhone={v => setFieldValue('customerPhone', v)}
                  photo={values.customerPhoto}
                  onChangePhoto={p => setFieldValue('customerPhoto', p)}
                  hasPhoneError={submitAttempted && !!phoneError}
                  // Editing an existing declaration cannot change who signed it,
                  // and its snapshot is fixed server-side — so there is nothing
                  // a phone or photo edit here could reach.
                  readOnly={isEditMode}
                  onChangeCustomer={
                    onChangeCustomer ? () => onChangeCustomer(values) : undefined
                  }
                />
                {!!values.customerAddress && (
                  <Text fontSize={12} color="$coolGray500" px="$1">
                    {values.customerAddress}
                  </Text>
                )}

                {/* Date */}
                <HStack justifyContent="space-between" alignItems="center" py="$2" px="$1">
                  <Text color="$coolGray400" fontWeight="$bold" fontSize="$xs">
                    {/* declaration.doc.date, not doc.date — t() returns the key
                        itself when one is missing, so the `|| fallback` never
                        fires and the raw key rendered on screen. */}
                    {t('declaration.doc.date') || 'Date'}
                  </Text>
                  <TouchableOpacity onPress={() => setDatePickerOpen(true)}>
                    <HStack space="xs" alignItems="center">
                      <Icon as={Calendar} size="xs" color="$coolGray800" />
                      <Text fontWeight="$bold" color="$coolGray800">
                        {values.declarationDate}
                      </Text>
                    </HStack>
                  </TouchableOpacity>
                </HStack>

                {/* Ornaments */}
                <Box
                  bg="$white"
                  p="$5"
                  rounded="$xl"
                  borderWidth={1}
                  borderColor="#E5E7EB"
                  shadowColor="#000"
                  shadowOffset={{ width: 0, height: 1 }}
                  shadowOpacity={0.05}
                  elevation={2}
                >
                  <VStack mb="$3">
                    <Text fontWeight="$bold" fontSize={15} color="$coolGray800">
                      {t('declaration.ornaments.title') || 'Old Ornaments'}
                    </Text>
                    {!!t('declaration.ornaments.subtitle') && (
                      <Text fontSize={12} color="$coolGray500">
                        {t('declaration.ornaments.subtitle')}
                      </Text>
                    )}
                  </VStack>

                  <FieldArray name="items">
                    {({ push, remove }) => (
                      <VStack space="sm">
                        {values.items.length === 0 && (
                          <Box
                            rounded="$xl"
                            p="$6"
                            alignItems="center"
                            justifyContent="center"
                            borderWidth={1}
                            borderColor="$coolGray200"
                            borderStyle="dashed"
                          >
                            <Text
                              color="$coolGray500"
                              fontSize={14}
                              fontWeight="$semibold"
                              textAlign="center"
                            >
                              {t('declaration.ornaments.emptyTitle') || 'No ornaments added yet'}
                            </Text>
                            <Text color="$coolGray400" fontSize={13} textAlign="center" mt="$1">
                              {t('declaration.ornaments.emptySubtitle') ||
                                'Tap Add Gold or Add Silver to begin'}
                            </Text>
                          </Box>
                        )}

                        {values.items.map((item, index) => (
                          <DeclarationOrnamentCard
                            key={item.id}
                            item={item}
                            index={index}
                            isExpanded={expandedItems.includes(index)}
                            onToggle={() =>
                              setExpandedItems(prev =>
                                prev.includes(index)
                                  ? prev.filter(i => i !== index)
                                  : [...prev, index],
                              )
                            }
                            onRemove={() => remove(index)}
                            // Removing the last row is fine now that the empty
                            // state offers a way back.
                            canRemove
                            setFieldValue={setFieldValue}
                            onDeletePhoto={onDeleteItemPhoto}
                          />
                        ))}

                        {/* Metal is chosen when the row is created rather than
                            inside it, matching the invoice exchange section —
                            it decides which purity list the row offers. */}
                        <HStack space="md">
                          <TouchableOpacity
                            style={styles.addGoldButton}
                            onPress={() => {
                              const newIndex = values.items.length;
                              push(makeEmptyOrnament('Gold'));
                              setExpandedItems([newIndex]);
                            }}
                          >
                            <Icon as={Plus} size="xs" color="#F59E0B" mr="$2" />
                            <Text color="#F59E0B" fontWeight="$bold" fontSize={13}>
                              {t('invoice.exchange.addGold') || 'Add Gold'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.addSilverButton}
                            onPress={() => {
                              const newIndex = values.items.length;
                              push(makeEmptyOrnament('Silver'));
                              setExpandedItems([newIndex]);
                            }}
                          >
                            <Icon as={Plus} size="xs" color="#6B7280" mr="$2" />
                            <Text color="#6B7280" fontWeight="$bold" fontSize={13}>
                              {t('invoice.exchange.addSilver') || 'Add Silver'}
                            </Text>
                          </TouchableOpacity>
                        </HStack>

                        {/* Both totals stay hidden until there is something to
                            total — a "0.000" against an empty list is noise. */}
                        {totals.grams > 0 && (
                          <HStack justifyContent="space-between" pt="$2">
                            <Text fontSize={13} color="$coolGray600">
                              {t('declaration.ornaments.totalGrams') || 'Total Grams'}
                            </Text>
                            <Text fontSize={13} fontWeight="$bold" color="$coolGray900">
                              {totals.grams.toFixed(3)}
                            </Text>
                          </HStack>
                        )}
                        {totals.amount > 0 && (
                          <HStack justifyContent="space-between">
                            <Text fontSize={13} color="$coolGray600">
                              {t('declaration.ornaments.totalAmount') || 'Total Amount'}
                            </Text>
                            <Text fontSize={13} fontWeight="$bold" color="$coolGray900">
                              ₹{totals.amount.toFixed(2)}
                            </Text>
                          </HStack>
                        )}
                      </VStack>
                    )}
                  </FieldArray>

                  {/* Photos used to live here as one set for the whole
                      declaration, which could not say which of several
                      ornaments a photo was of — the only question they exist to
                      answer. Each ornament card carries its own set now. */}
                </Box>

                {/* Everything from here to the payout block describes the
                    transaction rather than the goods, so it is withheld as one
                    run until an ornament exists to transact. Asking who owns
                    the ornaments, who the seller is and how they were paid all
                    read as noise on a form that does not yet say what was
                    bought. */}
                {hasOrnament && (
                  <>
                {/* Ownership */}
                <Section title={t('declaration.ownership.title') || 'Ownership'}>
                  <VStack space="md">
                    <Text fontSize={12} color="$coolGray600">
                      {t('declaration.ownership.question') ||
                        'Who do the ornaments belong to?'}
                    </Text>
                    <ChoiceRow
                      value={values.ownerIsSelf ? 'self' : 'family'}
                      options={[
                        {
                          label: t('declaration.ownership.optionSelf') || 'The customer',
                          value: 'self',
                        },
                        {
                          label: t('declaration.ownership.optionFamily') || 'A family member',
                          value: 'family',
                        },
                      ]}
                      onChange={v => {
                        const isSelf = v === 'self';
                        setFieldValue('ownerIsSelf', isSelf);
                        // Drop the name once the goods are the seller's own, so
                        // a changed mind cannot leave a stray name on the
                        // document's central assertion.
                        if (isSelf) setFieldValue('familyMemberName', '');
                      }}
                    />

                    {!values.ownerIsSelf && (
                      <Field
                        label={t('declaration.ownership.familyMemberName') || 'Family Member Name *'}
                        value={values.familyMemberName}
                        placeholder={t('declaration.ownership.familyMemberPlaceholder')}
                        maxLength={INPUT_LIMITS.familyMemberName}
                        onChangeText={v => setFieldValue('familyMemberName', v)}
                      />
                    )}
                  </VStack>
                </Section>

                {/* ID proof — a seller may need to produce more than one. */}
                <Section title={t('declaration.idProof.title') || 'ID Proof'}>
                  <IdProofList
                    entries={values.idProofs}
                    onChange={next => setFieldValue('idProofs', next)}
                    // Matched on the entry's own id, not the row position:
                    // removing a row would otherwise show one document another's
                    // scans. Same rule as the witness pickers below.
                    savedPhotosFor={entry =>
                      savedDeclaration?.idProofs?.find(s => s.id && s.id === entry.id)
                        ?.photos
                    }
                    onDeleteSavedPhoto={onDeleteIdProofPhoto}
                  />
                </Section>

                {/* Purchase receipt — only one of the two fields can ever apply,
                    so the answer decides which is asked for. */}
                <Section title={t('declaration.receipt.title') || 'Purchase Receipt'}>
                  <VStack space="md">
                    <Text fontSize={12} color="$coolGray600">
                      {t('declaration.receipt.question') ||
                        'Does the customer have the purchase receipt?'}
                    </Text>
                    <ChoiceRow
                      value={
                        values.hasPurchaseReceipt === undefined
                          ? undefined
                          : values.hasPurchaseReceipt
                            ? 'yes'
                            : 'no'
                      }
                      options={[
                        { label: t('common.yes') || 'Yes', value: 'yes' },
                        { label: t('common.no') || 'No', value: 'no' },
                      ]}
                      onChange={v => {
                        const yes = v === 'yes';
                        setFieldValue('hasPurchaseReceipt', yes);
                        // Drop the answer that no longer applies, so a changed
                        // mind cannot leave contradictory text on the document.
                        setFieldValue(yes ? 'noReceiptReason' : 'purchaseReceiptDetails', '');
                      }}
                    />

                    {values.hasPurchaseReceipt === true && (
                      <Field
                        label={t('declaration.receipt.details') || 'Details of Purchase Receipt'}
                        value={values.purchaseReceiptDetails}
                        placeholder={t('declaration.receipt.detailsPlaceholder')}
                        maxLength={INPUT_LIMITS.purchaseReceiptDetails}
                        onChangeText={v => setFieldValue('purchaseReceiptDetails', v)}
                      />
                    )}

                    {values.hasPurchaseReceipt === false && (
                      <Field
                        label={t('declaration.receipt.noReason') || 'Reason for not having a receipt'}
                        value={values.noReceiptReason}
                        placeholder={t('declaration.receipt.noReasonPlaceholder')}
                        maxLength={INPUT_LIMITS.noReceiptReason}
                        multiline
                        onChangeText={v => setFieldValue('noReceiptReason', v)}
                      />
                    )}
                  </VStack>
                </Section>

                {/* Witnesses — off by default. Two rows of empty inputs were
                    permanently on screen for something most declarations never
                    use, so the block now opens only when asked for and starts
                    with a single row. */}
                <Box
                  bg="$white"
                  p="$5"
                  rounded="$xl"
                  borderWidth={1}
                  borderColor="#E5E7EB"
                  shadowColor="#000"
                  shadowOffset={{ width: 0, height: 1 }}
                  shadowOpacity={0.05}
                  elevation={2}
                >
                  <HStack justifyContent="space-between" alignItems="center">
                    <VStack flex={1} pr="$3">
                      <Text fontWeight="$bold" fontSize={15} color="$coolGray800">
                        {t('declaration.witnesses.title') || 'Witnesses'}
                      </Text>
                      <Text fontSize={12} color="$coolGray500">
                        {t('declaration.witnesses.subtitle')}
                      </Text>
                    </VStack>
                    <Switch
                      value={showWitnesses}
                      onValueChange={next => {
                        setShowWitnesses(next);
                        // Opening with no rows yet gives one to fill; closing
                        // drops them so nothing half-typed reaches the document.
                        setFieldValue('witnesses', next ? [makeEmptyWitness()] : []);
                      }}
                      trackColor={{ false: '#E2E8F0', true: '#8B5CF6' }}
                    />
                  </HStack>

                  <Collapsible expanded={showWitnesses}>
                    <VStack space="md" mt="$4">
                      {values.witnesses.map((w, index) => (
                        // Keyed by the witness's own id so removing a row does
                        // not shuffle inputs (and their photos) between rows.
                        <VStack key={w.id || index} space="sm">
                          <HStack justifyContent="space-between" alignItems="center">
                            <Text fontSize={12} fontWeight="$bold" color="$coolGray500">
                              {(t('declaration.witnesses.rowLabel') || 'Witness {number}').replace(
                                '{number}',
                                String(index + 1),
                              )}
                            </Text>
                            {values.witnesses.length > 1 && (
                              <Pressable
                                onPress={() =>
                                  setFieldValue(
                                    'witnesses',
                                    values.witnesses.filter((_, i) => i !== index),
                                  )
                                }
                                p="$1"
                              >
                                <Icon as={Trash2} size="sm" color="#EF4444" />
                              </Pressable>
                            )}
                          </HStack>
                          <HStack space="sm">
                            <Field
                              label={t('declaration.witnesses.nameLabel') || 'Name'}
                              value={w.name || ''}
                              maxLength={INPUT_LIMITS.witnessName}
                              onChangeText={v => setFieldValue(`witnesses[${index}].name`, v)}
                            />
                            <Field
                              label={t('declaration.witnesses.phoneLabel') || 'Phone'}
                              value={w.phone || ''}
                              keyboardType="number-pad"
                              maxLength={INPUT_LIMITS.phone}
                              onChangeText={v => setFieldValue(`witnesses[${index}].phone`, v)}
                            />
                          </HStack>

                          {/* Only once the witness is named — there is nobody
                              for the ID to belong to before that, and it keeps
                              an unused row as short as it was before. */}
                          {!!w.name?.trim() && (
                            <WitnessPhotoPicker
                              photos={w.pendingPhotos || []}
                              onChange={next =>
                                setFieldValue(`witnesses[${index}].pendingPhotos`, next)
                              }
                              // Matched on the witness's own id, not the row
                              // position: reordering or removing a row would
                              // otherwise show one witness another's ID proof.
                              saved={
                                savedDeclaration?.witnesses?.find(sw => sw.id && sw.id === w.id)
                                  ?.photos
                              }
                              onDeleteSaved={
                                onDeleteWitnessPhoto && w.id
                                  ? fileId => onDeleteWitnessPhoto(w.id!, fileId)
                                  : undefined
                              }
                            />
                          )}
                        </VStack>
                      ))}

                      {/* Capped at two: the printed declaration has exactly two
                          witness lines. Disabled until the existing rows are
                          named, so a blank row cannot be stacked on a blank row. */}
                      {values.witnesses.length < MAX_WITNESSES && (
                        <TouchableOpacity
                          disabled={!canAddWitness}
                          onPress={() =>
                            setFieldValue('witnesses', [
                              ...values.witnesses,
                              makeEmptyWitness(),
                            ])
                          }
                          style={[
                            styles.addWitnessButton,
                            !canAddWitness && styles.addWitnessButtonDisabled,
                          ]}
                        >
                          <Icon
                            as={Plus}
                            size="xs"
                            color={canAddWitness ? PURPLE : '$coolGray400'}
                            mr="$1"
                          />
                          <Text
                            fontSize={13}
                            fontWeight="$bold"
                            color={canAddWitness ? PURPLE : '$coolGray400'}
                          >
                            {t('declaration.witnesses.add') || 'Add Witness'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </VStack>
                  </Collapsible>
                </Box>

                {/* Payout */}
                <Section
                  title={t('declaration.payout.title') || 'Payment to Customer'}
                  subtitle={t('declaration.payout.subtitle')}
                >
                  <VStack space="md">
                    <HStack space="sm">
                      {(['cash', 'online', 'none'] as PayoutMethod[]).map(method => {
                        const selected = values.payout.method === method;
                        return (
                          <Pressable
                            key={method}
                            flex={1}
                            onPress={() => {
                              setFieldValue('payout.method', method);
                              if (method !== 'online') {
                                setFieldValue('payout.onlineType', undefined);
                              }
                            }}
                          >
                            <Box
                              rounded="$lg"
                              borderWidth={1}
                              borderColor={selected ? PURPLE : '$coolGray200'}
                              bg={selected ? '#EEF2FF' : '$white'}
                              py="$3"
                              alignItems="center"
                            >
                              <Text
                                fontSize={13}
                                fontWeight="$bold"
                                color={selected ? '#4F46E5' : '$coolGray600'}
                              >
                                {t(`declaration.payout.${method}`) || method}
                              </Text>
                            </Box>
                          </Pressable>
                        );
                      })}
                    </HStack>

                    {values.payout.method === 'none' && (
                      <Text fontSize={12} color="$coolGray500">
                        {t('declaration.payout.noneHint')}
                      </Text>
                    )}

                    {values.payout.method === 'online' && (
                      <VStack space="xs">
                        <Text fontSize={12} color="$coolGray600">
                          {t('declaration.payout.onlineType') || 'Online Type'}
                        </Text>
                        <SelectField
                          value={values.payout.onlineType || ''}
                          items={(
                            ['upi', 'bank_transfer', 'cheque', 'card', 'other'] as const
                          ).map(v => ({
                            label: t(`declaration.payout.${v}`) || v,
                            value: v,
                          }))}
                          placeholder={t('declaration.payout.selectType')}
                          title={t('declaration.payout.onlineType') || 'Online Type'}
                          onValueChange={v => setFieldValue('payout.onlineType', v)}
                        />
                      </VStack>
                    )}

                    {/* Online only. A cash payout has no transaction reference
                        and no bank account to record, so asking for either is
                        dead space on the form. */}
                    {values.payout.method === 'online' && (
                      <>
                        <Field
                          label={t('declaration.payout.reference') || 'Transaction / Cheque No.'}
                          value={values.payout.reference}
                          placeholder={t('declaration.payout.referencePlaceholder')}
                          maxLength={INPUT_LIMITS.payoutReference}
                          onChangeText={v => setFieldValue('payout.reference', v)}
                        />

                        <Pressable onPress={() => setShowBankDetails(v => !v)}>
                          <HStack justifyContent="space-between" alignItems="center" py="$2">
                            <VStack flex={1}>
                              <Text fontSize={13} fontWeight="$medium" color="$coolGray700">
                                {t('declaration.payout.bankDetails') || 'Customer Bank Details'}
                              </Text>
                              <Text fontSize={11} color="$coolGray500">
                                {t('declaration.payout.bankDetailsHint')}
                              </Text>
                            </VStack>
                            <Icon
                              as={showBankDetails ? ChevronUp : ChevronDown}
                              size="sm"
                              color="$coolGray500"
                            />
                          </HStack>
                        </Pressable>

                        <Collapsible expanded={showBankDetails}>
                          <VStack space="sm">
                            <Field
                              label={t('declaration.payout.bankName') || 'Bank Name'}
                              value={values.payout.bankName}
                              maxLength={INPUT_LIMITS.bankName}
                              onChangeText={v => setFieldValue('payout.bankName', v)}
                            />
                            <Field
                              label={t('declaration.payout.bankAccountName') || 'Account Holder Name'}
                              value={values.payout.bankAccountName}
                              maxLength={INPUT_LIMITS.bankAccountName}
                              onChangeText={v => setFieldValue('payout.bankAccountName', v)}
                            />
                            <HStack space="sm">
                              <Field
                                label={t('declaration.payout.bankAccountNumber') || 'Account Number'}
                                value={values.payout.bankAccountNumber}
                                keyboardType="number-pad"
                                maxLength={INPUT_LIMITS.bankAccountNumber}
                                onChangeText={v =>
                                  setFieldValue('payout.bankAccountNumber', v)
                                }
                              />
                              <Field
                                label={t('declaration.payout.bankIfsc') || 'IFSC Code'}
                                value={values.payout.bankIfsc}
                                maxLength={INPUT_LIMITS.ifsc}
                                autoCapitalize="characters"
                                onChangeText={v => setFieldValue('payout.bankIfsc', v)}
                              />
                            </HStack>
                            <Field
                              label={t('declaration.payout.upiId') || 'UPI ID'}
                              value={values.payout.upiId}
                              autoCapitalize="none"
                              maxLength={INPUT_LIMITS.upiId}
                              onChangeText={v => setFieldValue('payout.upiId', v)}
                            />
                          </VStack>
                        </Collapsible>
                      </>
                    )}
                  </VStack>
                </Section>
                  </>
                )}

                {/* On by default, unlike the bill's photo toggle: a declaration is the
                    shop's record of what it took in, and the photograph is the evidence
                    it exists to hold. Offered so it can be turned off - a shopkeeper
                    printing a short affidavit may not want six pictures on it - but the
                    useful position is on. */}
                <Section
                  title={t('declaration.photosOnDoc.title') || 'Print photos on the declaration'}
                  subtitle={
                    t('declaration.photosOnDoc.subtitle') ||
                    'On by default — the photos are the record of what came in'
                  }
                >
                  <HStack alignItems="center" justifyContent="space-between" space="md">
                    <Text fontSize={13} color="$coolGray500" flex={1}>
                      {t('declaration.photosOnDoc.hint') ||
                        'Ornament photos are printed under the declaration'}
                    </Text>
                    <Switch
                      value={values.includePhotosOnDeclaration !== false}
                      onValueChange={next => {
        setFieldValue('includePhotosOnDeclaration', next);
      }}
                    />
                  </HStack>
                </Section>
                {/* Signing. This existed only on DeclarationDetailsModal - the
                    path that generates a declaration from an invoice or an
                    advance order - so a declaration written on this screen,
                    which is the standalone Old Gold Purchase flow, could never
                    be signed at all. Same block and same optionality: a
                    declaration printed and signed by hand is exactly as valid. */}
                {hasOrnament && (
                  <Section
                    title={t('declaration.signature.title') || 'Customer Signature'}
                    subtitle={
                      t('declaration.signature.hint') ||
                      'Optional. Hand the device to the customer to sign.'
                    }
                  >
                    {values.customerSignature ? (
                      <VStack space="sm">
                        <Box
                          bg="$white"
                          borderWidth={1}
                          borderColor="$coolGray200"
                          rounded="$xl"
                          h={110}
                          alignItems="center"
                          justifyContent="center"
                          p="$2"
                        >
                          <SvgXml
                            xml={values.customerSignature}
                            width="100%"
                            height="100%"
                          />
                        </Box>
                        <HStack space="sm">
                          {/* People turn the phone sideways to sign, which
                              stores the signature at ninety degrees to the
                              line it has to sit on in the printed document. */}
                          {canRotateSignature(values.customerSignature) && (
                            <Pressable
                              onPress={() =>
                                setFieldValue(
                                  'customerSignature',
                                  rotateSignatureSvg(values.customerSignature as string),
                                )
                              }
                              accessibilityLabel={t('declaration.signature.rotate') || 'Rotate'}
                            >
                              <Box
                                rounded="$xl"
                                borderWidth={1}
                                borderColor="$coolGray300"
                                py="$3"
                                px="$4"
                                alignItems="center"
                              >
                                <RotateCw size={18} color="#4B5563" />
                              </Box>
                            </Pressable>
                          )}
                          <Pressable flex={1} onPress={() => setShowSignature(true)}>
                            <Box
                              rounded="$xl"
                              borderWidth={1}
                              borderColor="$coolGray300"
                              py="$3"
                              alignItems="center"
                            >
                              <Text fontWeight="$medium" color="$coolGray700">
                                {t('declaration.signature.redo') || 'Sign again'}
                              </Text>
                            </Box>
                          </Pressable>
                          <Pressable
                            flex={1}
                            onPress={() => setFieldValue('customerSignature', undefined)}
                          >
                            <Box
                              rounded="$xl"
                              borderWidth={1}
                              borderColor="#FECACA"
                              py="$3"
                              alignItems="center"
                            >
                              <Text fontWeight="$medium" color="#DC2626">
                                {t('common.remove') || 'Remove'}
                              </Text>
                            </Box>
                          </Pressable>
                        </HStack>
                      </VStack>
                    ) : (
                      <Pressable onPress={() => setShowSignature(true)}>
                        <Box
                          rounded="$xl"
                          borderWidth={1}
                          borderColor="$coolGray300"
                          borderStyle="dashed"
                          py="$5"
                          alignItems="center"
                        >
                          <HStack space="sm" alignItems="center">
                            <PenLine size={18} color="#6D5EF7" />
                            <Text fontWeight="$medium" color="#6D5EF7">
                              {t('declaration.signature.take') ||
                                'Take customer signature'}
                            </Text>
                          </HStack>
                        </Box>
                      </Pressable>
                    )}

                    <SignatureCaptureModal
                      isOpen={showSignature}
                      onClose={() => setShowSignature(false)}
                      title={t('declaration.signature.title') || 'Customer Signature'}
                      signerLabel={values.customerName}
                      onSave={svg => {
                        setFieldValue('customerSignature', svg);
                        setShowSignature(false);
                      }}
                    />
                  </Section>
                )}
                {/* Last card before the button, not the first: the form itself
                    stays in the app language and only the printed document
                    changes, so a language control at the top reads as an app
                    setting and invites "I picked Marathi but the screen is
                    still English". */}
                {hasOrnament && (
                  <Section
                    title={t('declaration.language.title') || 'Declaration Language'}
                    subtitle={t('declaration.language.hint')}
                  >
                    <LanguagePicker
                      value={values.language}
                      onChange={lang => setFieldValue('language', lang)}
                    />
                  </Section>
                )}

                <Box mt="$2">
                  <GradientButton
                    label={
                      isSubmitting
                        ? t('common.loading') || 'Loading…'
                        : t('declaration.save') || 'Save & Preview'
                    }
                    onPress={handleSubmit as any}
                    // Stays visible while disabled: the ornament card above it,
                    // with its "Tap Add Gold or Add Silver to begin" empty
                    // state, is the only thing left to act on, so a greyed
                    // button is clearer than a form that ends abruptly.
                    disabled={isSubmitting || !hasOrnament}
                  />
                </Box>
              </ScrollView>

              <DatePickerModal
                isOpen={datePickerOpen}
                onClose={() => setDatePickerOpen(false)}
                date={values.declarationDate}
                onSelect={d => {
                  setFieldValue('declarationDate', d);
                  setDatePickerOpen(false);
                }}
              />
            </KeyboardAvoidingView>
          );
        }}
      </Formik>

      <ValidationErrorModal
        isOpen={showErrors}
        errors={errors}
        onClose={() => setShowErrors(false)}
      />
    </Box>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  multilineInput: { textAlignVertical: 'top', paddingTop: 8 },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  addWitnessButton: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#C7D2FE',
    backgroundColor: '#F5F3FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
  },
  addWitnessButtonDisabled: {
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    opacity: 0.7,
  },
  // Matches the exchange section in the advance-order / invoice flows: same
  // radius, same amber and grey pairing, so the two ways of adding an old
  // ornament do not look like different controls.
  addGoldButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSilverButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6B7280',
    backgroundColor: '#F9FAFB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default DeclarationForm;
