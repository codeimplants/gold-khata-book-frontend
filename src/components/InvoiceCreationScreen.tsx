import React, { useRef, useState, memo, useCallback } from 'react';
import {
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
    Modal,
    Keyboard,
    StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Box,
    VStack,
    HStack,
    Text,
    Input,
    InputField,
    FormControl,
    FormControlLabel,
    FormControlLabelText,
    Badge,
    BadgeText,
    Pressable,
    Menu,
    MenuItem,
    MenuItemLabel,
    Icon,
    AddIcon,
    Select,
    SelectTrigger,
    SelectInput,
    SelectPortal,
    SelectBackdrop,
    SelectContent,
    SelectDragIndicator,
    SelectDragIndicatorWrapper,
    SelectItem,
    SelectIcon,
    Checkbox,
    CheckboxIndicator,
    CheckboxIcon,
    CheckboxLabel,
    CheckIcon,
    Switch,
} from '@gluestack-ui/themed';
import {
    ArrowLeft,
    ChevronDown,
    ChevronUp,
    Calendar,
    Trash2,
    CheckCircle2,
    CircleCheck,
    Package,
    Plus,
    TrendingUp,
} from 'lucide-react-native';
import { LAYOUT } from '../constants/layout';
import { INPUT_LIMITS } from '../constants/inputLimits';
import { Formik, FieldArray } from 'formik';
import {
    METAL_TYPES,
    GOLD_PURITY_OPTIONS,
    SILVER_PURITY_OPTIONS,
} from '../constants/bill';
import { JewelleryFormValues, BillItem } from '../types';
import {
    calculateItemValues,
    calculateFormTotals,
} from '../utils/calculations';
import { getRateForPurity } from '../utils/rateForPurity';
import { inspectItemEntry, asKilogramHint, type ItemFinding } from '../utils/itemPlausibility';
import { describeItemFinding } from '../utils/itemFindingCopy';
import GradientButton from './common/GradientButton';
import DatePickerModal from './common/DatePickerModal';
import CustomerInfoCard from './common/CustomerInfoCard';
import Collapsible from './common/Collapsible';
import SelectField from './common/SelectField';
import ItemPhotoPicker from './items/ItemPhotoPicker';
import ValidationErrorModal from './ValidationErrorModal';
import CatalogOverwriteModal from './CatalogOverwriteModal';
import { mergeCatalogNumber, mergeCatalogText, overwrittenLabels } from '../utils/catalogAutofill';
import ConfirmModal from './ConfirmModal';
import { toast } from './common/Toast';
import { useTranslation } from '../hooks/useTranslation';
import HelpIconButton from './common/HelpIconButton';
import { HELP_TOPICS } from '../tutorials/catalog';
import { capitalizeWords } from '../utils/textUtils';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
    fetchCatalogProducts,
    fetchMetalRates,
    MetalRates,
} from '../store/data/dataSlice';

const styles = StyleSheet.create({
    /** Two lines at the label's size, so a pair of side-by-side fields starts its
     *  inputs at the same height whether or not each label happens to wrap. */
    pairedLabel: { minHeight: 30 },
});

const getPurityLabel = (t: any, value: string) => {
    switch (value) {
        case '24K - 99.5%':
            return t('metals.purity.gold24k995gw') || '24K - 99.5%';
        case '23K - 95.8%':
            return t('metals.purity.gold23k') || '23K - 95.8%';
        case '22K - 91.6%':
            return t('metals.purity.gold22k') || '22K - 91.6%';
        case '21K - 87.5%':
            return t('metals.purity.gold21k') || '21K - 87.5%';
        case '20K - 83.3%':
            return t('metals.purity.gold20k') || '20K - 83.3%';
        case '18K - 75%':
            return t('metals.purity.gold18k') || '18K - 75%';
        case '17K - 70.8%':
            return t('metals.purity.gold17k') || '17K - 70.8%';
        case '14K - 58.5%':
            return t('metals.purity.gold14k') || '14K - 58.5%';
        case '9K - 37.5%':
            return t('metals.purity.gold9k') || '9K - 37.5%';
        case 'Silver':
            return t('metals.purity.silver') || 'Silver';
        case 'Silver Coin':
            return t('metals.purity.silverCoin') || 'Silver Coin';
        default:
            return value;
    }
};

// --- Optimized Item Card Component ---
interface InvoiceItemCardProps {
    item: BillItem;
    index: number;
    isExpanded: boolean;
    onToggle: () => void;
    onRemove: () => void;
    setFieldValue: (field: string, value: any) => void;
    catalogProducts: any[];
    metalRates?: MetalRates | null;
    canRemove?: boolean;
    showErrors?: boolean;
    /** Only supplied when editing a saved bill — a new item has no server-side
     *  photos to delete, and the affordance is hidden without it. */
    onDeleteItemPhoto?: (itemIndex: number, fileId: string) => Promise<boolean>;
}

const InvoiceItemCard = memo(
    ({
        item,
        index,
        isExpanded,
        onToggle,
        onRemove,
        setFieldValue,
        catalogProducts,
        metalRates,
        canRemove = true,
        showErrors = false,
        onDeleteItemPhoto,
    }: InvoiceItemCardProps) => {
        const { t } = useTranslation();
        /** Fields a saved item just replaced, for the "these were replaced" dialog. */
        const [overwrittenFields, setOverwrittenFields] = useState<string[]>([]);
        const updateField = useCallback(
            (field: keyof BillItem, value: any) => {
                const newItem = { ...item, [field]: value };
                const res = calculateItemValues(newItem);
                setFieldValue(`items[${index}]`, { ...newItem, ...res });
            },
            [item, index, setFieldValue],
        );

        /** Field labels carry "*" and line breaks for the form; a sentence list wants neither. */
        const fieldLabel = (key: string, fallback: string) =>
            (t(key) || fallback).replace(/\s*\*\s*$/, '').replace(/\n/g, ' ').trim();

        const handleAutoFill = (catalogItemId: string) => {
            const saved = catalogProducts.find((p: any) => p.id === catalogItemId);
            if (!saved) return;

            const purity =
                saved.purity || (saved.category === 'Silver' ? 'Silver' : '22K - 91.6%');
            const catalogRate = String(getRateForPurity(purity, metalRates));

            // A saved item never overrides a field it has nothing for; where it
            // does have a value it wins, and anything the shopkeeper had typed
            // into that field is reported afterwards rather than vanishing.
            const merged = {
                itemName: mergeCatalogText(saved.name, item.itemName),
                huid: mergeCatalogText(saved.huid, item.huid),
                grossWt: mergeCatalogNumber(saved.grossWt, item.grossWt),
                lessWt: mergeCatalogNumber(saved.lessWt, item.lessWt),
                makingCharges: mergeCatalogNumber(saved.makingCharges, item.makingCharges),
                discount: mergeCatalogNumber(saved.discount, item.discount),
                otherChargesDescription: mergeCatalogText(
                    saved.otherChargeDesc,
                    item.otherChargesDescription,
                ),
                otherChargesAmount: mergeCatalogNumber(
                    saved.otherChargeAmount,
                    item.otherChargesAmount,
                ),
            };

            const lost = overwrittenLabels([
                { label: fieldLabel('invoice.fields.itemName', 'Item Name'), merged: merged.itemName },
                { label: fieldLabel('invoice.fields.huid', 'HUID'), merged: merged.huid },
                { label: fieldLabel('invoice.fields.grossWt', 'Gross Wt (gm)'), merged: merged.grossWt },
                { label: fieldLabel('invoice.fields.lessWt', 'Less Wt (gm)'), merged: merged.lessWt },
                { label: fieldLabel('invoice.fields.makingCharges', 'Making Charges'), merged: merged.makingCharges },
                { label: fieldLabel('invoice.fields.discount', 'Discount'), merged: merged.discount },
                { label: fieldLabel('invoice.fields.otherChargesDescription', 'Other Charges Description'), merged: merged.otherChargesDescription },
                { label: fieldLabel('invoice.fields.otherChargesAmount', 'Other Charges Amount'), merged: merged.otherChargesAmount },
            ]);

            // A hand-typed rate is a typed value too, and picking a saved item
            // drops back to the catalogue purity's rate.
            if (
                item.useCustomRate &&
                String(item.ratePerGm ?? '') !== '' &&
                String(item.ratePerGm) !== catalogRate
            ) {
                lost.push(fieldLabel('invoice.fields.rate', 'Rate (per gram)'));
            }

            const newItem: BillItem = {
                ...item,
                itemName: merged.itemName.value,
                sourceItemId: saved.id,
                metalType:
                    (saved.category === 'Others' ? 'Gold' : saved.category) || 'Gold',
                purity,
                ratePerGm: catalogRate,
                useCustomRate: false,
                rateSourcePurity: purity,
                makingChargeType:
                    saved.makingChargeType === 'Fix'
                        ? 'Fixed'
                        // Same default as a fresh row, for a catalog item saved
                        // without a charge type.
                        : saved.makingChargeType || 'Percentage',
                makingCharges: merged.makingCharges.value,
                discountType: saved.discountType === '%' ? 'Percentage' : 'Fixed',
                discount: merged.discount.value,
                grossWt: merged.grossWt.value,
                lessWt: merged.lessWt.value,
                huid: merged.huid.value,
                otherChargesDescription: merged.otherChargesDescription.value,
                otherChargesAmount: merged.otherChargesAmount.value,
            };
            const res = calculateItemValues(newItem);
            setFieldValue(`items[${index}]`, { ...newItem, ...res });
            setOverwrittenFields(lost);
        };

        const BottomSelect = ({
            label,
            value,
            options,
            onSelect,
        }: {
            label: string;
            value: string;
            options: { label: string; value: string }[];
            onSelect: (v: string) => void;
        }) => {
            // Show the option's label, not the stored value. Passing `value`
            // here rendered the raw enum ("Percentage") rather than its label
            // ("Percentage (%)"), and showed English on a translated device.
            const selectedLabel = options.find(o => o.value === value)?.label;
            return (
                <FormControl flex={1}>
                    <FormControlLabel mb="$1" px="$1">
                        <FormControlLabelText
                            fontSize="$xs"
                            fontWeight="$bold"
                            color="$coolGray800"
                        >
                            {label}
                        </FormControlLabelText>
                    </FormControlLabel>
                    <Box
                        h={48}
                        w="$full"
                        rounded="$xl"
                        borderWidth={1}
                        borderColor="#F3F4F6"
                        bg="#F9FAFB"
                    >
                        {/* selectedLabel drives what the closed trigger shows;
                            key re-seeds it when the value changes externally
                            (catalog autofill, metal-type switch). */}
                        <Select
                            key={value}
                            selectedValue={value}
                            selectedLabel={selectedLabel}
                            onValueChange={onSelect}
                        >
                            <SelectTrigger
                                variant="outline"
                                style={{
                                    height: 48,
                                    borderWidth: 0,
                                    paddingRight: 12,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                }}
                            >
                                <SelectInput
                                    placeholder={selectedLabel || value}
                                    style={{ height: '100%', fontSize: 14, color: '#374151' }}
                                    pointerEvents="none"
                                />
                                <SelectIcon pointerEvents="none">
                                    <Icon as={ChevronDown} size="sm" color="#6B7280" />
                                </SelectIcon>
                            </SelectTrigger>
                            <SelectPortal>
                                <SelectBackdrop />
                                <SelectContent pb="$10" zIndex={9999} style={{ width: '100%', top: 'auto', bottom: 0 }}>
                                    <SelectDragIndicatorWrapper>
                                        <SelectDragIndicator />
                                    </SelectDragIndicatorWrapper>
                                    {options.map(opt => (
                                        <SelectItem key={opt.value} label={opt.label} value={opt.value} />
                                    ))}
                                </SelectContent>
                            </SelectPortal>
                        </Select>
                    </Box>
                </FormControl>
            );
        };

        const metalOptions = METAL_TYPES.map(m => ({
            label: t(`metals.${m.toLowerCase()}`) || m,
            value: m,
        }));
        // Purity is derived from Rate Purity (below), not manually selected.
        const chargeTypeOptions = [
            { label: t('invoice.dropdown.perGram'), value: 'Per Gram' },
            { label: t('invoice.dropdown.percentage'), value: 'Percentage' },
            { label: t('invoice.dropdown.fixed'), value: 'Fixed' },
        ];
        const discountTypeOptions = [
            { label: t('invoice.dropdown.percentage'), value: 'Percentage' },
            { label: t('invoice.dropdown.fixed'), value: 'Fixed' },
        ];

        // liveRate for display in the Rate Section uses rateSourcePurity if set, else item purity
        const liveRate = getRateForPurity(
            item.rateSourcePurity || item.purity,
            metalRates,
        );

        // One finding at a time, whatever tripped it. Previously this was a
        // boolean scoped to the rate field alone, which could only ever say "the
        // rate looks wrong" — and the rate is the wrong field to point at when
        // the real mistake is a weight typed in milligrams. See
        // utils/itemPlausibility.ts for why that distinction is the whole fix.
        const [finding, setFinding] = useState<ItemFinding | null>(null);

        const netWtEntered =
            (Number(item.grossWt) || 0) - (Number(item.lessWt) || 0);

        const checkEntry = () => {
            const next = inspectItemEntry({
                itemType: item.metalType,
                purity: item.purity,
                weight: netWtEntered,
                rate: item.ratePerGm,
            });
            // A rate that merely disagrees with today's quote is still worth a
            // word even when it is physically possible — that is the per-10-gram
            // case on a metal whose bounds are wide. Bounds catch the impossible;
            // the live rate catches the improbable.
            if (!next && liveRate > 0) {
                const entered = Number(item.ratePerGm) || 0;
                if (entered > 0 && (entered > liveRate * 3 || entered < liveRate / 3)) {
                    setFinding({
                        kind: entered > liveRate ? 'rate-too-high' : 'rate-too-low',
                        metal: item.metalType === 'Silver' ? 'Silver' : 'Gold',
                        weight: netWtEntered,
                        rate: entered,
                        enteredTotal: netWtEntered * entered,
                        suggestedRate: liveRate,
                        suggestedWeight: netWtEntered,
                        suggestedTotal: netWtEntered * liveRate,
                    });
                    return;
                }
            }
            setFinding(next);
        };

        const applyFinding = () => {
            if (!finding) return;
            const patched = {
                ...item,
                ...(finding.suggestedWeight !== undefined && finding.suggestedWeight !== netWtEntered
                    // Corrections land on gross weight: less weight is a stone
                    // deduction the shopkeeper measured separately, so scaling it
                    // would invent a number they never entered.
                    ? { grossWt: String(Number((finding.suggestedWeight + (Number(item.lessWt) || 0)).toFixed(3))) }
                    : {}),
                ...(finding.suggestedRate !== undefined
                    ? { ratePerGm: String(finding.suggestedRate), useCustomRate: true }
                    : {}),
            };
            setFieldValue(`items[${index}]`, { ...patched, ...calculateItemValues(patched) });
            setFinding(null);
        };

        const handleMetalTypeSelect = (v: string) => {
            const nextPurity =
                v === 'Silver'
                    ? 'Silver'
                    : item.purity.includes('Silver')
                        ? '22K - 91.6%'
                        : item.purity;
            const newItem = {
                ...item,
                metalType: v,
                purity: nextPurity,
                rateSourcePurity: nextPurity,
            };
            if (!item.useCustomRate) {
                newItem.ratePerGm = String(getRateForPurity(nextPurity, metalRates));
            }
            const res = calculateItemValues(newItem);
            setFieldValue(`items[${index}]`, { ...newItem, ...res });
        };

        const rateInputRef = useRef<any>(null);
        React.useEffect(() => {
            if (!item.useCustomRate) return;
            const id = setTimeout(() => rateInputRef.current?.focus?.(), 50);
            return () => clearTimeout(id);
        }, [item.useCustomRate]);

        const handleCustomRateToggle = (checked: boolean) => {
            const newItem = { ...item, useCustomRate: checked };
            if (!checked) {
                const sourcePurity = item.rateSourcePurity || item.purity;
                const rate = getRateForPurity(sourcePurity, metalRates);
                newItem.ratePerGm = String(rate);
            } else {
                // Custom rate should start blank; user must enter manually.
                newItem.ratePerGm = '';
            }
            const res = calculateItemValues(newItem);
            setFieldValue(`items[${index}]`, { ...newItem, ...res });
        };

        React.useEffect(() => {
            if (item.useCustomRate) return;
            // Use rateSourcePurity if set independently, otherwise fall back to item purity
            const sourcePurity = item.rateSourcePurity || item.purity;
            const liveRate = getRateForPurity(sourcePurity, metalRates);
            const currentRate = Number(item.ratePerGm || 0);
            if (!item.ratePerGm || Math.abs(currentRate - liveRate) > 0.001) {
                const newItem = { ...item, ratePerGm: String(liveRate) };
                const res = calculateItemValues(newItem);
                setFieldValue(`items[${index}]`, { ...newItem, ...res });
            }
        }, [item, index, metalRates, setFieldValue]);

        return (
            <Box
                bg="$white"
                rounded="$xl"
                borderWidth={1}
                borderColor="$coolGray100"
                overflow="hidden"
                mb="$2"
            >
                <Pressable onPress={onToggle}>
                    <Box p="$3">
                        <HStack justifyContent="space-between" alignItems="center">
                            <VStack flex={1} space="xs">
                                <HStack alignItems="center" space="sm">
                                    <Text fontWeight="$bold" fontSize="$md" color="$coolGray900" numberOfLines={1}>
                                        {item.itemName?.trim() ? item.itemName : `${t('invoice.item')} ${index + 1}`}
                                    </Text>
                                    {/* up-down */}
                                    {isExpanded && (
                                        <Icon
                                            as={isExpanded ? ChevronUp : ChevronDown}
                                            size="md"
                                            color="$coolGray400"
                                        />
                                    )}

                                    {!isExpanded && (
                                        <Box bg="#EDE9FE" px="$2.5" py="$1" rounded="$full">
                                            <Text color="#8B5CF6" fontWeight="$bold" fontSize={10}>
                                                {(item.metalType || 'Gold').toUpperCase()}
                                            </Text>
                                        </Box>
                                    )}
                                </HStack>
                                {!isExpanded && (
                                    <VStack mt="$2" space="xs">
                                        <Text color="$coolGray500" fontSize={12} numberOfLines={1}>
                                            {`${t('orders.details.piecesShort') || 'Pcs'}:${item.pcs || '1'} | ${t('invoice.fields.grossWt') || 'Gross'}: ${item.grossWt || '0'} | ${t('invoice.fields.netWt') || 'Net'}: ${item.netWt || '0'}`}
                                        </Text>
                                        <Text color="$coolGray500" fontSize={12}>
                                            {`${t('orders.details.amountLabel') || 'Amount'}: ₹${Number(item.itemTotal || 0).toLocaleString('en-IN')}`}
                                        </Text>
                                    </VStack>
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
                                {!isExpanded && (
                                    <Icon
                                        as={isExpanded ? ChevronUp : ChevronDown}
                                        size="md"
                                        color="$coolGray400"
                                    />
                                )}
                            </HStack>
                        </HStack>
                    </Box>
                </Pressable>

                {isExpanded && (
                    <VStack space="lg" p="$4" pt={0}>
                        {catalogProducts.length > 0 && (
                            <VStack space="xs">
                                <FormControlLabel mb="$1" px="$1">
                                    <FormControlLabelText
                                        fontSize="$xs"
                                        fontWeight="$bold"
                                        color="#6D5EF7"
                                    >
                                        {t('items.selectSaved') || 'Select Saved Item'}
                                    </FormControlLabelText>
                                </FormControlLabel>
                                <Box
                                    h={48}
                                    w="$full"
                                    rounded="$xl"
                                    borderWidth={1}
                                    borderColor="#E5E7EB"
                                    bg="$coolGray50"
                                >
                                    <Select onValueChange={handleAutoFill}>
                                        <SelectTrigger
                                            variant="outline"
                                            style={{
                                                height: 48,
                                                borderWidth: 0,
                                                paddingRight: 15,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                            }}
                                        >
                                            <HStack space="sm" alignItems="center">
                                                <SelectInput
                                                    placeholder={
                                                        t('items.chooseFromCatalog') ||
                                                        'Choose from catalog...'
                                                    }
                                                    style={{ height: '100%', fontSize: 14, color: '#111827' }}
                                                    pointerEvents="none"
                                                />
                                            </HStack>
                                            <SelectIcon pointerEvents="none">
                                                <Icon as={ChevronDown} size="sm" color="#6B7280" />
                                            </SelectIcon>
                                        </SelectTrigger>
                                        <SelectPortal>
                                            <SelectBackdrop />
                                            <SelectContent pb="$10" zIndex={9999}>
                                                <SelectDragIndicatorWrapper>
                                                    <SelectDragIndicator />
                                                </SelectDragIndicatorWrapper>
                                                {catalogProducts.map((p: any) => (
                                                    <SelectItem key={p.id} label={p.name} value={p.id} />
                                                ))}
                                            </SelectContent>
                                        </SelectPortal>
                                    </Select>
                                </Box>
                            </VStack>
                        )}

                        <FormControl isInvalid={showErrors && !item.itemName.trim()}>
                            <FormControlLabel mb="$1" px="$1">
                                <FormControlLabelText
                                    fontSize="$xs"
                                    fontWeight="$bold"
                                    color={showErrors && !item.itemName.trim() ? "$red500" : "$coolGray800"}
                                >
                                    {t('invoice.fields.itemName')}{' '}
                                </FormControlLabelText>
                            </FormControlLabel>
                            <Input
                                bg="#F9FAFB"
                                borderWidth={1}
                                borderColor={showErrors && !item.itemName.trim() ? "$red500" : "#F3F4F6"}
                                $focus-borderColor="#8B5CF6"
                                $focus-borderWidth={2}
                                rounded="$xl"
                                h={48}
                            >
                                <InputField
                                    placeholder={t('invoice.placeholders.itemName')}
                                    value={item.itemName}
                                    onChangeText={v => {
                                        setFieldValue(`items[${index}].itemName`, capitalizeWords(v));
                                    }}
                                    maxLength={INPUT_LIMITS.itemName}
                                    fontSize="$sm"
                                    returnKeyType="done"
                                    onSubmitEditing={Keyboard.dismiss}
                                />
                            </Input>
                            {showErrors && !item.itemName.trim() && null}
                        </FormControl>
                        <HStack space="md">
                            <FormControl flex={1}>
                                <FormControlLabel mb="$1" px="$1">
                                    <FormControlLabelText
                                        fontSize="$xs"
                                        fontWeight="$bold"
                                        color="$coolGray800"
                                    >
                                        {t('invoice.fields.huid')}
                                    </FormControlLabelText>
                                </FormControlLabel>
                                <Input
                                    bg="#F9FAFB"
                                    borderWidth={1}
                                    borderColor="#F3F4F6"
                                    $focus-borderColor="#8B5CF6"
                                    $focus-borderWidth={2}
                                    rounded="$xl"
                                    h={48}
                                >
                                    <InputField
                                        placeholder={t('invoice.placeholders.huid')}
                                        value={item.huid}
                                        onChangeText={v => setFieldValue(`items[${index}].huid`, v)}
                                        maxLength={INPUT_LIMITS.hsnCode}
                                        fontSize="$sm"
                                        returnKeyType="done"
                                        onSubmitEditing={Keyboard.dismiss}
                                    />
                                </Input>
                            </FormControl>
                            <FormControl flex={1}>
                                <FormControlLabel mb="$1" px="$1">
                                    <FormControlLabelText
                                        fontSize="$xs"
                                        fontWeight="$bold"
                                        color="$coolGray800"
                                    >
                                        {t('invoice.fields.pieces')}
                                    </FormControlLabelText>
                                </FormControlLabel>
                                <Input
                                    bg="#F9FAFB"
                                    borderWidth={1}
                                    borderColor="#F3F4F6"
                                    $focus-borderColor="#8B5CF6"
                                    $focus-borderWidth={2}
                                    rounded="$xl"
                                    h={48}
                                >
                                    <InputField
                                        keyboardType="number-pad"
                                        value={item.pcs}
                                        onChangeText={v => {
                                            setFieldValue(`items[${index}].pcs`, v.replace(/[^0-9]/g, ''));
                                        }}
                                        maxLength={INPUT_LIMITS.quantity}
                                        fontSize="$sm"
                                        returnKeyType="done"
                                        onSubmitEditing={Keyboard.dismiss}
                                    />
                                </Input>
                            </FormControl>
                        </HStack>
                        <HStack space="md">
                            <BottomSelect
                                label={t('invoice.labels.metalType') || 'Metal Type'}
                                value={item.metalType}
                                options={metalOptions}
                                onSelect={(v: any) => handleMetalTypeSelect(v)}
                            />
                            <FormControl flex={1}>
                                <FormControlLabel mb="$1" px="$1">
                                    <FormControlLabelText fontSize="$xs" fontWeight="$bold" color="$coolGray800">
                                        {t('invoice.fields.purity') || 'Purity'}
                                    </FormControlLabelText>
                                </FormControlLabel>
                                <SelectField
                                    value={item.purity}
                                    items={(item.metalType === 'Silver' ? SILVER_PURITY_OPTIONS : GOLD_PURITY_OPTIONS).map(p => ({
                                        label: getPurityLabel(t, p),
                                        value: p
                                    }))}
                                    title={t('invoice.fields.purity') || 'Purity'}
                                    onValueChange={(v: any) => {
                                        const updated = { ...item, purity: v, rateSourcePurity: v };
                                        if (!item.useCustomRate) {
                                            updated.ratePerGm = String(getRateForPurity(v, metalRates));
                                        }
                                        const res = calculateItemValues(updated);
                                        setFieldValue(`items[${index}]`, { ...updated, ...res });
                                    }}
                                />
                            </FormControl>
                        </HStack>
                        <HStack space="md">
                            <FormControl flex={1} isInvalid={showErrors && !item.grossWt}>
                                <FormControlLabel mb="$1" px="$1">
                                    <FormControlLabelText
                                        fontSize="$xs"
                                        fontWeight="$bold"
                                        color={showErrors && !item.grossWt ? "$red500" : "$coolGray800"}
                                    >
                                        {t('invoice.fields.grossWt')}
                                    </FormControlLabelText>
                                </FormControlLabel>
                                <Input
                                    bg="#F9FAFB"
                                    borderWidth={1}
                                    borderColor={showErrors && !item.grossWt ? "$red500" : "#F3F4F6"}
                                    $focus-borderColor="#8B5CF6"
                                    $focus-borderWidth={2}
                                    rounded="$xl"
                                    h={48}
                                >
                                    <InputField
                                        keyboardType="decimal-pad"
                                        value={item.grossWt}
                                        onChangeText={v => updateField('grossWt', v)}
                                        onBlur={checkEntry}
                                        maxLength={INPUT_LIMITS.weight}
                                        placeholder={t('invoice.placeholders.grossWt') || 'e.g. 2.030'}
                                        fontSize="$sm"
                                        returnKeyType="done"
                                        onSubmitEditing={Keyboard.dismiss}
                                    />
                                    {/* The unit, always visible. A weight box with no unit is
                                        what let "2.030 gm" be typed as "2030" — the figure
                                        reads as an ordinary number until something names it. */}
                                    <Box pr="$3" justifyContent="center">
                                        <Text color="$coolGray400" fontSize="$xs">
                                            {t('common.gramShort') || 'gm'}
                                        </Text>
                                    </Box>
                                </Input>
                                {/* An absurd gram figure restated in the unit that makes it
                                    absurd. Nobody sells two kilograms of gold over a counter. */}
                                {!!asKilogramHint(Number(item.grossWt) || 0) && (
                                    <Text fontSize={11} color="$amber700" mt="$1" px="$1">
                                        {asKilogramHint(Number(item.grossWt) || 0)}
                                    </Text>
                                )}
                                {showErrors && !item.grossWt && null}
                            </FormControl>
                            <FormControl flex={1}>
                                <FormControlLabel mb="$1" px="$1">
                                    <FormControlLabelText
                                        fontSize="$xs"
                                        fontWeight="$bold"
                                        color="$coolGray800"
                                    >
                                        {t('invoice.fields.lessWt')}
                                    </FormControlLabelText>
                                </FormControlLabel>
                                <Input
                                    bg="#F9FAFB"
                                    borderWidth={1}
                                    borderColor="#F3F4F6"
                                    $focus-borderColor="#8B5CF6"
                                    $focus-borderWidth={2}
                                    rounded="$xl"
                                    h={48}
                                >
                                    <InputField
                                        keyboardType="decimal-pad"
                                        value={item.lessWt}
                                        onChangeText={v => updateField('lessWt', v)}
                                        onBlur={checkEntry}
                                        maxLength={INPUT_LIMITS.weight}
                                        placeholder={t('invoice.placeholders.lessWt') || 'Enter less weight'}
                                        fontSize="$sm"
                                        returnKeyType="done"
                                        onSubmitEditing={Keyboard.dismiss}
                                    />
                                </Input>
                            </FormControl>
                        </HStack>
                        <HStack space="md">
                            <FormControl flex={1}>
                                <FormControlLabel mb="$1" px="$1">
                                    <FormControlLabelText
                                        fontSize="$xs"
                                        fontWeight="$bold"
                                        color="$coolGray800"
                                    >
                                        {t('invoice.fields.netWt')}
                                    </FormControlLabelText>
                                </FormControlLabel>
                                <Input
                                    isDisabled
                                    bg="#E5E7EB"
                                    borderWidth={0}
                                    rounded="$xl"
                                    h={48}
                                >
                                    <InputField
                                        value={item.netWt}
                                        fontWeight="$bold"
                                        color="$coolGray900"
                                        fontSize="$sm"
                                    />
                                </Input>
                            </FormControl>
                        </HStack>

                        <HStack space="md">
                            <BottomSelect
                                label={t('invoice.fields.makingChargeType')}
                                value={item.makingChargeType}
                                options={chargeTypeOptions}
                                onSelect={(v: any) => updateField('makingChargeType', v)}
                            />
                            <FormControl flex={1}>
                                <FormControlLabel mb="$1" px="$1">
                                    <FormControlLabelText
                                        fontSize="$xs"
                                        fontWeight="$bold"
                                        color="$coolGray800"
                                    >
                                        {t('invoice.fields.makingCharges')}
                                    </FormControlLabelText>
                                </FormControlLabel>
                                <Input
                                    bg="#F9FAFB"
                                    borderWidth={1}
                                    borderColor="#F3F4F6"
                                    $focus-borderColor="#8B5CF6"
                                    $focus-borderWidth={2}
                                    rounded="$xl"
                                    h={48}
                                >
                                    <InputField
                                        keyboardType="decimal-pad"
                                        value={item.makingCharges}
                                        onChangeText={v => updateField('makingCharges', v)}
                                        maxLength={INPUT_LIMITS.amount}
                                        placeholder={t('invoice.placeholders.charges') || 'Enter charges'}
                                        fontSize="$sm"
                                        returnKeyType="done"
                                        onSubmitEditing={Keyboard.dismiss}
                                    />
                                </Input>
                            </FormControl>
                        </HStack>
                        <HStack space="md">
                            <FormControl flex={1}>
                                {/* Both labels in this pair are deliberately two
                                    lines ("Other Charges" / "Description" and
                                    "Other Charges" / "Amount"). Before, only the
                                    Amount one wrapped, so the two inputs below
                                    started at different heights. The minHeight
                                    holds that alignment in any language, even one
                                    whose first line does not wrap the same way. */}
                                <FormControlLabel mb="$1" px="$1" style={styles.pairedLabel}>
                                    <FormControlLabelText
                                        fontSize="$xs"
                                        fontWeight="$bold"
                                        color="$coolGray800"
                                    >
                                        {t('invoice.fields.otherChargesDescription')}
                                    </FormControlLabelText>
                                </FormControlLabel>
                                <Input
                                    bg="#F9FAFB"
                                    borderWidth={1}
                                    borderColor="#F3F4F6"
                                    $focus-borderColor="#8B5CF6"
                                    $focus-borderWidth={2}
                                    rounded="$xl"
                                    h={48}
                                >
                                    <InputField
                                        placeholder={t('invoice.placeholders.otherCharges')}
                                        value={item.otherChargesDescription}
                                        onChangeText={v =>
                                            setFieldValue(
                                                `items[${index}].otherChargesDescription`,
                                                v,
                                            )
                                        }
                                        maxLength={INPUT_LIMITS.itemDescription}
                                        fontSize="$sm"
                                        returnKeyType="done"
                                        onSubmitEditing={Keyboard.dismiss}
                                    />
                                </Input>
                            </FormControl>
                            <FormControl flex={1}>
                                <FormControlLabel mb="$1" px="$1" style={styles.pairedLabel}>
                                    <FormControlLabelText
                                        fontSize="$xs"
                                        fontWeight="$bold"
                                        color="$coolGray800"
                                    >
                                        {t('invoice.fields.otherChargesAmount')}
                                    </FormControlLabelText>
                                </FormControlLabel>
                                <Input
                                    bg="#F9FAFB"
                                    borderWidth={1}
                                    borderColor="#F3F4F6"
                                    $focus-borderColor="#8B5CF6"
                                    $focus-borderWidth={2}
                                    rounded="$xl"
                                    h={48}
                                >
                                    <InputField
                                        keyboardType="decimal-pad"
                                        value={item.otherChargesAmount}
                                        onChangeText={v => updateField('otherChargesAmount', v)}
                                        maxLength={INPUT_LIMITS.amount}
                                        placeholder={t('invoice.placeholders.chargeAmount') || 'Enter charge amount'}
                                        fontSize="$sm"
                                        returnKeyType="done"
                                        onSubmitEditing={Keyboard.dismiss}
                                    />
                                </Input>
                            </FormControl>
                        </HStack>
                        <HStack space="md">
                            <BottomSelect
                                label={t('invoice.fields.discountType')}
                                value={item.discountType}
                                options={discountTypeOptions}
                                onSelect={(v: any) => updateField('discountType', v)}
                            />
                            <FormControl flex={1}>
                                <FormControlLabel mb="$1" px="$1">
                                    <FormControlLabelText
                                        fontSize="$xs"
                                        fontWeight="$bold"
                                        color="$coolGray800"
                                    >
                                        {t('invoice.fields.discount')}
                                    </FormControlLabelText>
                                </FormControlLabel>
                                <Input
                                    bg="#F9FAFB"
                                    borderWidth={1}
                                    borderColor="#F3F4F6"
                                    $focus-borderColor="#8B5CF6"
                                    $focus-borderWidth={2}
                                    rounded="$xl"
                                    h={48}
                                >
                                    <InputField
                                        keyboardType="decimal-pad"
                                        value={item.discount}
                                        onChangeText={v => updateField('discount', v)}
                                        maxLength={INPUT_LIMITS.amount}
                                        placeholder={t('invoice.placeholders.discount') || 'Enter discount'}
                                        fontSize="$sm"
                                        returnKeyType="done"
                                        onSubmitEditing={Keyboard.dismiss}
                                    />
                                </Input>
                            </FormControl>
                        </HStack>
                        {/* Rate Section — full width, at bottom of item form */}
                        <Box
                            bg="#F5F3FF"
                            rounded="$xl"
                            p="$3"
                            borderWidth={1}
                            borderColor="#DDD6FE"
                        >
                            <HStack
                                justifyContent="space-between"
                                alignItems="center"
                                mb="$2"
                            >
                                <Text fontSize={13} color="#6D5EF7" fontWeight="$bold">
                                    {t('invoice.fields.rate') || 'Rate'}
                                </Text>
                                <Checkbox
                                    size="sm"
                                    value="custom_rate"
                                    isChecked={!!item.useCustomRate}
                                    onChange={handleCustomRateToggle}
                                >
                                    <CheckboxIndicator
                                        mr="$2"
                                        borderColor="#8B5CF6"
                                        $checked-backgroundColor="#8B5CF6"
                                        $checked-borderColor="#8B5CF6"
                                    >
                                        <CheckboxIcon as={CheckIcon} />
                                    </CheckboxIndicator>
                                    <CheckboxLabel fontSize="$xs" color="$coolGray700">
                                        {t('advanceOrder.payment.customRate') || 'Custom rate'}
                                    </CheckboxLabel>
                                </Checkbox>
                            </HStack>

                            {!item.useCustomRate && (
                                <HStack
                                    justifyContent="space-between"
                                    alignItems="center"
                                    mb="$2"
                                >
                                    <Text fontSize={12} color="$coolGray600" fontWeight="$medium">
                                        {t('invoice.ratePurity') || 'Rate Purity'}
                                    </Text>
                                    <Box w={160}>
                                        <SelectField
                                            value={item.rateSourcePurity || item.purity}
                                            items={(
                                                item.metalType === 'Silver'
                                                    ? SILVER_PURITY_OPTIONS
                                                    : GOLD_PURITY_OPTIONS
                                            ).map((p) => ({ label: getPurityLabel(t, p), value: p }))}
                                            placeholder={t('orders.details.selectPurity') || 'Select purity'}
                                            title={t('invoice.ratePurity') || 'Rate Purity'}
                                            height={40}
                                            onValueChange={(v) => {
                                                const updated = {
                                                    ...item,
                                                    purity: v,
                                                    rateSourcePurity: v,
                                                };
                                                if (!item.useCustomRate) {
                                                    updated.ratePerGm = String(getRateForPurity(v, metalRates));
                                                }
                                                const res = calculateItemValues(updated);
                                                setFieldValue(`items[${index}]`, { ...updated, ...res });
                                            }}
                                        />
                                    </Box>
                                </HStack>
                            )}

                            {item.useCustomRate ? (
                                <VStack>
                                    <Input
                                        bg="$white"
                                        borderWidth={1}
                                        borderColor={showErrors && !item.ratePerGm ? "$red500" : "#DDD6FE"}
                                        $focus-borderColor="#8B5CF6"
                                        $focus-borderWidth={2}
                                        rounded="$xl"
                                        h={48}
                                    >
                                        <Box pl="$3" justifyContent="center">
                                            <Text color="$coolGray400">₹</Text>
                                        </Box>
                                        <InputField
                                            ref={rateInputRef}
                                            keyboardType="decimal-pad"
                                            value={item.ratePerGm}
                                            onChangeText={v => updateField('ratePerGm', v)}
                                            onBlur={checkEntry}
                                            maxLength={INPUT_LIMITS.rate}
                                            fontSize="$sm"
                                            placeholder={String(liveRate)}
                                            returnKeyType="done"
                                            onSubmitEditing={Keyboard.dismiss}
                                        />
                                    </Input>
                                    {liveRate > 0 && (
                                        <Text fontSize={11} color="$coolGray500" mt="$1" px="$1">
                                            Today's rate: ₹{Number(liveRate).toLocaleString()}/g
                                        </Text>
                                    )}
                                    {showErrors && !item.ratePerGm && null}
                                </VStack>
                            ) : (
                                <HStack alignItems="baseline" space="xs" px="$1">
                                    <Text fontSize={22} fontWeight="$bold" color="$coolGray900">
                                        ₹{Number(liveRate).toLocaleString()}
                                    </Text>
                                    <Text fontSize={13} color="$coolGray500">
                                        {t('advanceOrder.payment.perGram') || 'per gram'}
                                    </Text>
                                </HStack>
                            )}
                        </Box>

                        {/* Last in the card, after the rate: photographing the
                            piece is the final thing that happens at the counter,
                            and it must never stand between the shopkeeper and
                            the numbers that decide the bill. */}
                        <ItemPhotoPicker
                            pending={item.pendingPhotos || []}
                            onChangePending={photos => updateField('pendingPhotos', photos)}
                            saved={item.photos || []}
                            onDeleteSaved={onDeleteItemPhoto ? fileId => onDeleteItemPhoto(index, fileId) : undefined}
                        />
                    </VStack>
                )}
                <CatalogOverwriteModal
                    isOpen={overwrittenFields.length > 0}
                    fields={overwrittenFields}
                    onClose={() => setOverwrittenFields([])}
                />
                {!!finding && (() => {
                    const copy = describeItemFinding(finding, t);
                    return (
                        <ConfirmModal
                            visible
                            onClose={() => setFinding(null)}
                            tone="warning"
                            icon="alert"
                            title={copy.title}
                            description={copy.description}
                            cancelLabel={copy.cancelLabel}
                            confirmLabel={copy.confirmLabel}
                            onConfirm={() => {
                                if (copy.canApply) {
                                    applyFinding();
                                    return;
                                }
                                setFinding(null);
                                setTimeout(() => rateInputRef.current?.focus?.(), 50);
                            }}
                        />
                    );
                })()}
            </Box>
        );
    },
);

const baseInitialValues: JewelleryFormValues = {
    invoiceDate: new Date().toISOString().split('T')[0],
    customerId: undefined,
    customerName: '',
    address: '',
    phone: '',
    includeGst: false,
    customerGstin: '',
    paymentMethod: 'cash',
    onlinePaymentType: undefined,
    items: [],
    exchanges: [],
    enableExchange: false,
    ornamentPhotos: [],
    generateDeclaration: false,
    // Photos are a shop-side record by default; putting them on the customer's
    // copy is a deliberate opt-in, per bill.
    includeItemPhotosOnBill: false,
    subtotal: '0.00',
    gst: '0.00',
    grandTotal: '0.00',
    advanceAmount: '',
    bookingPurity: '22K - 91.6%',
    useCustomBookingRate: false,
    bookingRate: '',
};

/**
 * Whether the shopkeeper has entered anything that would be lost on leaving.
 *
 * Deliberately not Formik's `dirty`: the form is re-seeded from `initialData`
 * on the way back from the customer picker, so a fully filled invoice reports
 * itself as untouched. Edit mode is the reverse case — it starts full — and
 * uses `dirty` instead (see the reporter below).
 */
const hasInvoiceInput = (v: JewelleryFormValues) =>
    v.items.length > 0 ||
    v.exchanges.length > 0 ||
    !!v.enableExchange ||
    // Legacy bill-wide set: no longer added from this form, but a restored
    // draft can still carry one, and that is still unsaved input.
    (v.ornamentPhotos?.length ?? 0) > 0 ||
    (v.exchanges ?? []).some((ex: any) => (ex.pendingPhotos?.length ?? 0) > 0) ||
    !!v.customerGstin?.trim() ||
    !!v.includeGst ||
    v.paymentMethod !== 'cash' ||
    v.invoiceDate !== baseInitialValues.invoiceDate;

/**
 * Reports form emptiness up to the screen that owns the back guard. A child
 * component rather than a hook call in Formik's render prop, which would nest
 * hooks inside a render callback.
 */
const DirtyReporter = ({
    dirty,
    onChange,
}: {
    dirty: boolean;
    onChange?: (dirty: boolean) => void;
}) => {
    React.useEffect(() => {
        onChange?.(dirty);
    }, [dirty, onChange]);
    return null;
};

interface InvoiceCreationScreenProps {
    onCalculate: (data: JewelleryFormValues) => void;
    onBack: () => void;
    initialCustomerId?: string;
    initialData?: JewelleryFormValues | null;
    /** True when editing an existing invoice — customer reassignment isn't supported in edit mode. */
    isEditMode?: boolean;
    /** Fires whenever the form crosses between empty and filled, so the hosting
     *  screen can confirm before a back press throws the invoice away. */
    onDirtyChange?: (dirty: boolean) => void;
    /** Deletes a photo already uploaded against a saved bill. Only supplied in
     *  edit mode - a bill being created has nothing on the server yet. The item
     *  card has accepted this since item photos landed, but nothing above ever
     *  declared or forwarded it, so the affordance was unreachable. */
    onDeleteItemPhoto?: (itemIndex: number, fileId: string) => Promise<boolean>;
    /** Same, for a photo on one gold/silver exchange row. */
    onDeleteExchangePhoto?: (exchangeIndex: number, fileId: string) => Promise<boolean>;
}

const InvoiceCreationScreen = ({
    onCalculate,
    onBack,
    initialCustomerId,
    initialData,
    isEditMode,
    onDirtyChange,
    onDeleteItemPhoto,
    onDeleteExchangePhoto,
}: InvoiceCreationScreenProps) => {
    const dismissKeyboardOnPress =
        Platform.OS === 'web' ? undefined : Keyboard.dismiss;
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const { customers, shopDetails, catalogProducts, metalRates } =
        useAppSelector((state: any) => state.data);
    const [expandedItems, setExpandedItems] = useState<number[]>([]);
    const [expandedExchanges, setExpandedExchanges] = useState<number[]>([]);
    const [exchangeAmountAlert, setExchangeAmountAlert] = useState(false);
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [showErrors, setShowErrors] = useState(false);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [showValidationModal, setShowValidationModal] = useState(false);

    React.useEffect(() => {
        dispatch(fetchCatalogProducts());
        dispatch(fetchMetalRates());
    }, [dispatch]);

    // Update booking rate when metal rates or booking purity change
    React.useEffect(() => {
        if (initialData?.useCustomBookingRate || !metalRates) return;

        const liveRate = getRateForPurity(initialValues.bookingPurity || '22K - 91.6%', metalRates);
        if (liveRate > 0) {
            // We use 'initialValues' here but if the user changes it in the form, 
            // the form's internal state (values) should be updated.
            // However, the useEffect should probably depend on 'values.bookingPurity'.
            // But 'values' is only available inside the Formik render prop.
        }
    }, [metalRates]);

    const initialValues = React.useMemo(() => {
        const custObj = initialCustomerId
            ? customers.find((c: any) => c.id === initialCustomerId)
            : undefined;

        if (initialData) {
            return {
                ...initialData,
                customerId: initialCustomerId,
                customerName: custObj?.name ?? initialData.customerName ?? '',
                phone: custObj?.phone ?? initialData.phone ?? '',
                address: custObj?.address ?? initialData.address ?? '',
            };
        }

        return {
            ...baseInitialValues,
            customerId: initialCustomerId,
            customerName: custObj?.name ?? '',
            phone: custObj?.phone ?? '',
            address: custObj?.address ?? '',
        };
    }, [initialCustomerId, customers, initialData]);

    const isItemValid = (item: BillItem | undefined) => {
        if (!item) return false;
        return (
            item.itemName.trim() !== '' &&
            item.metalType !== '' &&
            item.grossWt !== '' &&
            item.ratePerGm !== ''
        );
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: '#F9FAFB' }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <Formik<JewelleryFormValues>
                initialValues={initialValues}
                onSubmit={onCalculate}
                enableReinitialize
            >
                {({ values, setFieldValue, handleChange, dirty }) => {
                    const lastItem = values.items[values.items.length - 1];
                    const canAddItem = isItemValid(lastItem);

                    return (
                        <VStack flex={1}>
                            <DirtyReporter
                                dirty={isEditMode ? dirty : hasInvoiceInput(values)}
                                onChange={onDirtyChange}
                            />
                            <Box
                                bg="$white"
                                borderBottomWidth={1}
                                borderBottomColor="$coolGray100"
                            >
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
                                            <Text
                                                fontSize="$lg"
                                                fontWeight="$bold"
                                                color="$coolGray900"
                                            >
                                                {isEditMode ? (t('invoice.editTitle') || 'Edit Invoice') : t('invoice.title')}
                                            </Text>
                                            <Text fontSize="$xs" color="$coolGray400">
                                                {values.items.length} {t('invoice.items_count')}
                                            </Text>
                                        </VStack>
                                        {/* The screen users get stuck on most, and
                                            the one they phone about. */}
                                        <HelpIconButton topic={HELP_TOPICS.createInvoice} />
                                    </HStack>
                                </SafeAreaView>
                            </Box>

                            <ScrollView
                                keyboardShouldPersistTaps="handled"
                                contentContainerStyle={{
                                    padding: 16,
                                    paddingBottom: 120,
                                    ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {})
                                }}
                            >
                                <Pressable onPress={dismissKeyboardOnPress}>
                                    <Box p="$4">
                                        <VStack space="lg">


                                            <CustomerInfoCard
                                                customer={customers.find(
                                                    (c: any) => c.id === values.customerId,
                                                )}
                                                readOnly={isEditMode}
                                                onChangeCustomer={() =>
                                                    navigation.navigate('SelectCustomer', {
                                                        next: 'CreateInvoice',
                                                        preservedInvoiceForm: JSON.stringify(values),
                                                    })
                                                }
                                            />

                                            <HStack
                                                justifyContent="space-between"
                                                alignItems="center"
                                                py="$2"
                                                px="$1"
                                            >
                                                <Text
                                                    color="$coolGray400"
                                                    fontWeight="$bold"
                                                    fontSize="$xs"
                                                >
                                                    {t('invoice.invoiceDate')}
                                                </Text>
                                                <TouchableOpacity
                                                    onPress={() => setIsDatePickerOpen(true)}
                                                >
                                                    <HStack space="xs" alignItems="center">
                                                        <Icon
                                                            as={Calendar}
                                                            size="xs"
                                                            color="$coolGray800"
                                                        />
                                                        <Text fontWeight="$bold" color="$coolGray800">
                                                            {values.invoiceDate ===
                                                                new Date().toISOString().split('T')[0]
                                                                ? t('common.today')
                                                                : values.invoiceDate}
                                                        </Text>
                                                    </HStack>
                                                </TouchableOpacity>
                                            </HStack>

                                            <Box bg="$white" borderWidth={1} borderColor='#E5E7EB' rounded="$xl" p="$4" mb="$4">
                                                <HStack
                                                    justifyContent="space-between"
                                                    alignItems="center"
                                                    pb="$3.5"
                                                >
                                                    <Text
                                                        fontWeight="$bold"
                                                        fontSize="$lg"
                                                        color="$coolGray900"
                                                    >
                                                        {(t('items.titleShort') || t('items.title'))} ({values.items.length})
                                                    </Text>
                                                    <TouchableOpacity
                                                        disabled={!canAddItem && values.items.length > 0}
                                                        onPress={() => {
                                                            const newIndex = values.items.length;
                                                            setFieldValue('items', [
                                                                ...values.items,
                                                                {
                                                                    ...baseInitialValues.items[0] ?? {
                                                                        id: Math.random().toString(36).substr(2, 9),
                                                                        itemName: '',
                                                                        huid: '',
                                                                        metalType: 'Gold',
                                                                        purity: '22K - 91.6%',
                                                                        pcs: '1',
                                                                        grossWt: '',
                                                                        lessWt: '',
                                                                        netWt: '',
                                                                        ratePerGm: '',
                                                                        useCustomRate: false,
                                                                        rateSourcePurity: '22K - 91.6%',
                                                                        // Percentage by default, matching the advance-order
                                                                        // flow. 'Percentage' not '%': the invoice API's enum
                                                                        // differs from the order API's.
                                                                        makingChargeType: 'Percentage',
                                                                        makingCharges: '',
                                                                        otherChargesDescription: '',
                                                                        otherChargesAmount: '',
                                                                        discountType: 'Fixed',
                                                                        discount: '',
                                                                        itemTotal: '',
                                                                    },
                                                                    id: Math.random().toString(36).substr(2, 9),
                                                                    lessWt: '',
                                                                    makingCharges: '',
                                                                    otherChargesAmount: '',
                                                                    discount: '',
                                                                },
                                                            ]);
                                                            // Automatically collapse previous items when new one is added
                                                            setExpandedItems([newIndex]);
                                                        }}
                                                        style={{
                                                            backgroundColor: (canAddItem || values.items.length === 0) ? '#8B5CF6' : '#BBABFF',
                                                            paddingVertical: 8,
                                                            paddingHorizontal: 16,
                                                            borderRadius: 12,
                                                            flexDirection: 'row',
                                                            alignItems: 'center',
                                                            opacity: (canAddItem || values.items.length === 0) ? 1 : 0.6,
                                                        }}
                                                    >
                                                        <Icon as={AddIcon} size="xs" color="$white" mr="$1" />
                                                        <Text
                                                            color="$white"
                                                            fontWeight="$bold"
                                                            fontSize="$sm"
                                                        >
                                                            {t('items.addItem')}
                                                        </Text>
                                                    </TouchableOpacity>
                                                </HStack>

                                                <FieldArray name="items">
                                                    {({ remove }) => (
                                                        <VStack>
                                                            {values.items.length === 0 ? (
                                                                <Box
                                                                    bg="$white"
                                                                    rounded="$xl"
                                                                    p="$6"
                                                                    alignItems="center"
                                                                    justifyContent="center"
                                                                    borderWidth={1}
                                                                    borderColor="$coolGray200"
                                                                    borderStyle="dashed"
                                                                    mb="$2"
                                                                >
                                                                    <VStack space="xs" alignItems="center">
                                                                        <Text color="$coolGray500" fontSize={14} textAlign="center" fontWeight="$semibold">
                                                                            {t('items.noItemsYetTitle') || 'No items added yet'}
                                                                        </Text>
                                                                        <Text color="$coolGray400" fontSize={13} textAlign="center">
                                                                            {t('items.noItemsYetSubtitle') || 'Click \"Add Item\" to add items'}
                                                                        </Text>
                                                                    </VStack>
                                                                </Box>
                                                            ) : (
                                                                values.items.map((item, index) => (
                                                                    <InvoiceItemCard
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
                                                                        setFieldValue={setFieldValue}
                                                                        catalogProducts={catalogProducts}
                                                                        metalRates={metalRates}
                                                                        canRemove={values.items.length > 0}
                                                                        showErrors={showErrors}
                                                                        onDeleteItemPhoto={onDeleteItemPhoto}
                                                                    />
                                                                ))
                                                            )}
                                                        </VStack>
                                                    )}
                                                </FieldArray>
                                            </Box>

                                            {values.items.length !== 0 && (
                                                <>
                                                    {/* Only offered once at least one item actually
                                                        has photos — a switch controlling where
                                                        nothing appears is noise on every other bill. */}
                                                    {values.items.some(
                                                        it => (it.pendingPhotos?.length || 0) > 0 || (it.photos?.length || 0) > 0,
                                                    ) && (
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
                                                                        <Text fontWeight="$bold" fontSize="$md" color="$coolGray900">
                                                                            {t('itemPhotos.onBillTitle')}
                                                                        </Text>
                                                                        <Text fontSize="$xs" color="$coolGray400">
                                                                            {t('itemPhotos.onBillSubtitle')}
                                                                        </Text>
                                                                    </VStack>
                                                                    <Switch
                                                                        value={!!values.includeItemPhotosOnBill}
                                                                        onValueChange={(next: boolean) => {
                                                                            setFieldValue('includeItemPhotosOnBill', next);
                                                                        }}
                                                                        trackColor={{ false: '#E2E8F0', true: '#8B5CF6' }}
                                                                    />
                                                                </HStack>
                                                            </Box>
                                                        )}

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
                                                                <Text
                                                                    fontWeight="$bold"
                                                                    fontSize="$md"
                                                                    color="$coolGray900"
                                                                >
                                                                    {t('invoice.exchange.title')}
                                                                </Text>
                                                                <Text fontSize="$xs" color="$coolGray400">
                                                                    {t('invoice.exchange.subtitle') ||
                                                                        'Add old ornaments for exchange'}
                                                                </Text>
                                                            </VStack>
                                                            <Switch
                                                                value={values.enableExchange}
                                                                onValueChange={(next: boolean) => {
                                                                    setFieldValue('enableExchange', next);
                                                                    if (next) setExpandedItems([]);
                                                                }}
                                                                trackColor={{ false: '#E2E8F0', true: '#8B5CF6' }}
                                                            />
                                                        </HStack>
                                                        <Collapsible expanded={values.enableExchange}>
                                                            <FieldArray name="exchanges">
                                                                {({ push, remove }) => (
                                                                    <VStack space="md" mt="$4">
                                                                        <HStack space="md">
                                                                            <TouchableOpacity
                                                                                onPress={() => {
                                                                                    const incompleteIdx = values.exchanges.findIndex(
                                                                                        (ex: any) => !(Number(ex.amount) > 0),
                                                                                    );
                                                                                    if (incompleteIdx !== -1) {
                                                                                        setExpandedExchanges([incompleteIdx]);
                                                                                        setExchangeAmountAlert(true);
                                                                                        toast.error(
                                                                                            t('invoice.exchange.fillAmountFirst') ||
                                                                                                'Please enter the Total Amount for the previous exchange item before adding another.',
                                                                                        );
                                                                                        return;
                                                                                    }
                                                                                    setExpandedExchanges([values.exchanges.length]);
                                                                                    setExchangeAmountAlert(false);
                                                                                    push({
                                                                                        id: Math.random()
                                                                                            .toString(36)
                                                                                            .substr(2, 9),
                                                                                        type: 'Gold',
                                                                                        itemName: '',
                                                                                        grossWt: '',
                                                                                        lessWt: '',
                                                                                        netWt: '',
                                                                                        purity: '',
                                                                                        ratePerGm: '',
                                                                                        amount: '',
                                                                                    });
                                                                                }}
                                                                                style={{
                                                                                    flex: 1,
                                                                                    height: 44,
                                                                                    borderRadius: 12,
                                                                                    borderWidth: 1,
                                                                                    borderColor: '#F59E0B',
                                                                                    backgroundColor: '#FFFBEB',
                                                                                    alignItems: 'center',
                                                                                    justifyContent: 'center',
                                                                                    flexDirection: 'row',
                                                                                }}
                                                                            >
                                                                                <Icon
                                                                                    as={AddIcon}
                                                                                    size="xs"
                                                                                    color="#F59E0B"
                                                                                    mr="$2"
                                                                                />
                                                                                <Text color="#F59E0B" fontWeight="$bold">
                                                                                    {t('invoice.exchange.addGold')}
                                                                                </Text>
                                                                            </TouchableOpacity>
                                                                            <TouchableOpacity
                                                                                onPress={() => {
                                                                                    const incompleteIdx = values.exchanges.findIndex(
                                                                                        (ex: any) => !(Number(ex.amount) > 0),
                                                                                    );
                                                                                    if (incompleteIdx !== -1) {
                                                                                        setExpandedExchanges([incompleteIdx]);
                                                                                        setExchangeAmountAlert(true);
                                                                                        toast.error(
                                                                                            t('invoice.exchange.fillAmountFirst') ||
                                                                                                'Please enter the Total Amount for the previous exchange item before adding another.',
                                                                                        );
                                                                                        return;
                                                                                    }
                                                                                    setExpandedExchanges([values.exchanges.length]);
                                                                                    setExchangeAmountAlert(false);
                                                                                    push({
                                                                                        id: Math.random()
                                                                                            .toString(36)
                                                                                            .substr(2, 9),
                                                                                        type: 'Silver',
                                                                                        itemName: '',
                                                                                        grossWt: '',
                                                                                        lessWt: '',
                                                                                        netWt: '',
                                                                                        purity: '',
                                                                                        ratePerGm: '',
                                                                                        amount: '',
                                                                                    });
                                                                                }}
                                                                                style={{
                                                                                    flex: 1,
                                                                                    height: 44,
                                                                                    borderRadius: 12,
                                                                                    borderWidth: 1,
                                                                                    borderColor: '#6B7280',
                                                                                    backgroundColor: '#F9FAFB',
                                                                                    alignItems: 'center',
                                                                                    justifyContent: 'center',
                                                                                    flexDirection: 'row',
                                                                                }}
                                                                            >
                                                                                <Icon
                                                                                    as={AddIcon}
                                                                                    size="xs"
                                                                                    color="#6B7280"
                                                                                    mr="$2"
                                                                                />
                                                                                <Text color="#6B7280" fontWeight="$bold">
                                                                                    {t('invoice.exchange.addSilver')}
                                                                                </Text>
                                                                            </TouchableOpacity>
                                                                        </HStack>
                                                                        {values.exchanges.map((ex, exIdx) => {
                                                                            const purityOptions = (
                                                                                ex.type === 'Silver'
                                                                                    ? SILVER_PURITY_OPTIONS
                                                                                    : GOLD_PURITY_OPTIONS
                                                                            ).map(p => ({
                                                                                label: getPurityLabel(t, p),
                                                                                value: p,
                                                                            }));
                                                                            // Derived, not stored, so an existing row whose saved purity
                                                                            // isn't one of the presets reopens in custom mode instead of
                                                                            // silently showing a blank dropdown.
                                                                            const isCustomPurity =
                                                                                ex.useCustomPurity ??
                                                                                (!!ex.purity &&
                                                                                    !(purityOptions.map(o => o.value) as string[]).includes(
                                                                                        ex.purity,
                                                                                    ));
                                                                            const updateExchangeField = (
                                                                                field: keyof typeof ex,
                                                                                value: any,
                                                                            ) => {
                                                                                const updated = { ...ex, [field]: value };
                                                                                if (field === 'grossWt' || field === 'lessWt') {
                                                                                    const gross = Number(updated.grossWt) || 0;
                                                                                    const less = Number(updated.lessWt) || 0;
                                                                                    updated.netWt =
                                                                                        updated.grossWt || updated.lessWt
                                                                                            ? String(gross - less)
                                                                                            : '';
                                                                                }
                                                                                setFieldValue(`exchanges[${exIdx}]`, updated);
                                                                            };
                                                                            const amountMissing =
                                                                                (showErrors || exchangeAmountAlert) && !(Number(ex.amount) > 0);
                                                                            const isExchangeExpanded = expandedExchanges.includes(exIdx);
                                                                            return (
                                                                                <Box
                                                                                    key={ex.id}
                                                                                    bg="#F1F5F9"
                                                                                    p="$4"
                                                                                    rounded="$xl"
                                                                                    borderWidth={1}
                                                                                    borderColor="#E2E8F0"
                                                                                >
                                                                                    <Pressable
                                                                                        onPress={() =>
                                                                                            setExpandedExchanges(prev =>
                                                                                                prev.includes(exIdx) ? [] : [exIdx],
                                                                                            )
                                                                                        }
                                                                                    >
                                                                                        <HStack
                                                                                            justifyContent="space-between"
                                                                                            alignItems="center"
                                                                                            mb={isExchangeExpanded ? '$3' : 0}
                                                                                        >
                                                                                            <VStack flex={1}>
                                                                                                <HStack alignItems="center" space="sm">
                                                                                                    <Text
                                                                                                        fontSize="$xs"
                                                                                                        fontWeight="$bold"
                                                                                                        color="$coolGray500"
                                                                                                    >
                                                                                                        {t(
                                                                                                            `invoice.dropdown.${ex.type.toLowerCase()}`,
                                                                                                        )}{' '}
                                                                                                        {t('invoice.exchange.exchange_short')}
                                                                                                    </Text>
                                                                                                    <Icon
                                                                                                        as={isExchangeExpanded ? ChevronUp : ChevronDown}
                                                                                                        size="sm"
                                                                                                        color="$coolGray400"
                                                                                                    />
                                                                                                </HStack>
                                                                                                {!isExchangeExpanded && (
                                                                                                    <Text color="$coolGray500" fontSize={12} numberOfLines={1}>
                                                                                                        {ex.itemName?.trim() ? ex.itemName : t('invoice.exchange.title')}
                                                                                                        {ex.amount ? ` · ₹${Number(ex.amount).toLocaleString('en-IN')}` : ''}
                                                                                                    </Text>
                                                                                                )}
                                                                                            </VStack>
                                                                                            <TouchableOpacity onPress={() => remove(exIdx)}>
                                                                                                <Icon
                                                                                                    as={Trash2}
                                                                                                    color="$red400"
                                                                                                    size="md"
                                                                                                />
                                                                                            </TouchableOpacity>
                                                                                        </HStack>
                                                                                    </Pressable>
                                                                                    {isExchangeExpanded && (
                                                                                    <VStack space="md">
                                                                                        <FormControl>
                                                                                            <FormControlLabel mb="$1" px="$1">
                                                                                                <FormControlLabelText
                                                                                                    fontSize="$xs"
                                                                                                    fontWeight="$bold"
                                                                                                    color="$coolGray800"
                                                                                                >
                                                                                                    {t('invoice.exchange.itemName') || 'Item Name'}
                                                                                                </FormControlLabelText>
                                                                                            </FormControlLabel>
                                                                                            <Input
                                                                                                bg="$white"
                                                                                                borderWidth={1}
                                                                                                borderColor="#E2E8F0"
                                                                                                $focus-borderColor="#8B5CF6"
                                                                                                $focus-borderWidth={2}
                                                                                                rounded="$xl"
                                                                                                h={48}
                                                                                            >
                                                                                                <InputField
                                                                                                    value={ex.itemName || ''}
                                                                                                    onChangeText={v =>
                                                                                                        updateExchangeField('itemName', v)
                                                                                                    }
                                                                                                    placeholder={t(
                                                                                                        'invoice.exchange.itemNamePlaceholder',
                                                                                                    ) || 'e.g. Old Gold Ring'}
                                                                                                    maxLength={INPUT_LIMITS.itemName}
                                                                                                    fontSize="$sm"
                                                                                                    returnKeyType="done"
                                                                                                    onSubmitEditing={Keyboard.dismiss}
                                                                                                />
                                                                                            </Input>
                                                                                        </FormControl>
                                                                                        <HStack space="md">
                                                                                            <FormControl flex={1}>
                                                                                                <FormControlLabel mb="$1" px="$1">
                                                                                                    <FormControlLabelText
                                                                                                        fontSize="$xs"
                                                                                                        fontWeight="$bold"
                                                                                                        color="$coolGray800"
                                                                                                    >
                                                                                                        {t('invoice.exchange.grossWt') || 'Gross Wt (gm)'}
                                                                                                    </FormControlLabelText>
                                                                                                </FormControlLabel>
                                                                                                <Input
                                                                                                    bg="$white"
                                                                                                    borderWidth={1}
                                                                                                    borderColor="#E2E8F0"
                                                                                                    $focus-borderColor="#8B5CF6"
                                                                                                    $focus-borderWidth={2}
                                                                                                    rounded="$xl"
                                                                                                    h={48}
                                                                                                >
                                                                                                    <InputField
                                                                                                        keyboardType="decimal-pad"
                                                                                                        value={ex.grossWt || ''}
                                                                                                        onChangeText={v =>
                                                                                                            updateExchangeField('grossWt', v)
                                                                                                        }
                                                                                                        maxLength={INPUT_LIMITS.weight}
                                                                                                        fontSize="$sm"
                                                                                                        returnKeyType="done"
                                                                                                        onSubmitEditing={Keyboard.dismiss}
                                                                                                    />
                                                                                                </Input>
                                                                                            </FormControl>
                                                                                            <FormControl flex={1}>
                                                                                                <FormControlLabel mb="$1" px="$1">
                                                                                                    <FormControlLabelText
                                                                                                        fontSize="$xs"
                                                                                                        fontWeight="$bold"
                                                                                                        color="$coolGray800"
                                                                                                    >
                                                                                                        {t('invoice.exchange.lessWt') || 'Less Wt (gm)'}
                                                                                                    </FormControlLabelText>
                                                                                                </FormControlLabel>
                                                                                                <Input
                                                                                                    bg="$white"
                                                                                                    borderWidth={1}
                                                                                                    borderColor="#E2E8F0"
                                                                                                    $focus-borderColor="#8B5CF6"
                                                                                                    $focus-borderWidth={2}
                                                                                                    rounded="$xl"
                                                                                                    h={48}
                                                                                                >
                                                                                                    <InputField
                                                                                                        keyboardType="decimal-pad"
                                                                                                        value={ex.lessWt || ''}
                                                                                                        onChangeText={v =>
                                                                                                            updateExchangeField('lessWt', v)
                                                                                                        }
                                                                                                        maxLength={INPUT_LIMITS.weight}
                                                                                                        fontSize="$sm"
                                                                                                        returnKeyType="done"
                                                                                                        onSubmitEditing={Keyboard.dismiss}
                                                                                                    />
                                                                                                </Input>
                                                                                            </FormControl>
                                                                                        </HStack>
                                                                                        <HStack space="md">
                                                                                            <FormControl flex={1}>
                                                                                                <FormControlLabel mb="$1" px="$1">
                                                                                                    <FormControlLabelText
                                                                                                        fontSize="$xs"
                                                                                                        fontWeight="$bold"
                                                                                                        color="$coolGray800"
                                                                                                    >
                                                                                                        {t('invoice.exchange.netWt') || 'Net Wt (gm)'}
                                                                                                    </FormControlLabelText>
                                                                                                </FormControlLabel>
                                                                                                <Input
                                                                                                    isDisabled
                                                                                                    bg="#E5E7EB"
                                                                                                    borderWidth={0}
                                                                                                    rounded="$xl"
                                                                                                    h={48}
                                                                                                >
                                                                                                    <InputField
                                                                                                        value={ex.netWt || ''}
                                                                                                        fontWeight="$bold"
                                                                                                        color="$coolGray900"
                                                                                                        fontSize="$sm"
                                                                                                    />
                                                                                                </Input>
                                                                                            </FormControl>
                                                                                            <FormControl flex={1}>
                                                                                                <FormControlLabel mb="$1" px="$1">
                                                                                                    <HStack
                                                                                                        flex={1}
                                                                                                        justifyContent="space-between"
                                                                                                        alignItems="center"
                                                                                                    >
                                                                                                        <FormControlLabelText
                                                                                                            fontSize="$xs"
                                                                                                            fontWeight="$bold"
                                                                                                            color="$coolGray800"
                                                                                                        >
                                                                                                            {t('invoice.exchange.purity') || 'Purity'}
                                                                                                        </FormControlLabelText>
                                                                                                        <HStack alignItems="center" space="xs">
                                                                                                            <Text fontSize="$2xs" color="$coolGray400">
                                                                                                                {t('invoice.exchange.customPurity') || 'Custom'}
                                                                                                            </Text>
                                                                                                            <Switch
                                                                                                                size="sm"
                                                                                                                value={isCustomPurity}
                                                                                                                onValueChange={(next: boolean) => {
                                                                                                                    // Turning custom off clears a
                                                                                                                    // free-typed value so the dropdown
                                                                                                                    // never shows an option it lacks.
                                                                                                                    const keepsValue =
                                                                                                                        next ||
                                                                                                                        (purityOptions.map(o => o.value) as string[]).includes(
                                                                                                                            ex.purity || '',
                                                                                                                        );
                                                                                                                    setFieldValue(`exchanges[${exIdx}]`, {
                                                                                                                        ...ex,
                                                                                                                        useCustomPurity: next,
                                                                                                                        purity: keepsValue ? ex.purity : '',
                                                                                                                    });
                                                                                                                }}
                                                                                                                trackColor={{ false: '#E2E8F0', true: '#8B5CF6' }}
                                                                                                            />
                                                                                                        </HStack>
                                                                                                    </HStack>
                                                                                                </FormControlLabel>
                                                                                                {isCustomPurity ? (
                                                                                                    <Input
                                                                                                        bg="$white"
                                                                                                        borderWidth={1}
                                                                                                        borderColor="#E2E8F0"
                                                                                                        $focus-borderColor="#8B5CF6"
                                                                                                        $focus-borderWidth={2}
                                                                                                        rounded="$xl"
                                                                                                        h={48}
                                                                                                    >
                                                                                                        <InputField
                                                                                                            value={ex.purity || ''}
                                                                                                            onChangeText={v =>
                                                                                                                updateExchangeField('purity', v)
                                                                                                            }
                                                                                                            placeholder={
                                                                                                                t('invoice.exchange.customPurityPlaceholder') ||
                                                                                                                'e.g. 916 hallmark'
                                                                                                            }
                                                                                                            maxLength={INPUT_LIMITS.purity}
                                                                                                            fontSize="$sm"
                                                                                                            returnKeyType="done"
                                                                                                            onSubmitEditing={Keyboard.dismiss}
                                                                                                        />
                                                                                                    </Input>
                                                                                                ) : (
                                                                                                    <SelectField
                                                                                                        value={ex.purity || ''}
                                                                                                        items={purityOptions}
                                                                                                        title={t('invoice.exchange.purity') || 'Purity'}
                                                                                                        onValueChange={(v: any) =>
                                                                                                            updateExchangeField('purity', v)
                                                                                                        }
                                                                                                    />
                                                                                                )}
                                                                                            </FormControl>
                                                                                        </HStack>
                                                                                        <HStack space="md" alignItems="flex-end">
                                                                                            <FormControl flex={1}>
                                                                                                <FormControlLabel mb="$1" px="$1">
                                                                                                    <FormControlLabelText
                                                                                                        fontSize="$xs"
                                                                                                        fontWeight="$bold"
                                                                                                        color="$coolGray800"
                                                                                                    >
                                                                                                        {t('invoice.exchange.ratePerGm') || 'Rate/gm (₹)'}
                                                                                                    </FormControlLabelText>
                                                                                                </FormControlLabel>
                                                                                                <Input
                                                                                                    bg="$white"
                                                                                                    borderWidth={1}
                                                                                                    borderColor="#E2E8F0"
                                                                                                    $focus-borderColor="#8B5CF6"
                                                                                                    $focus-borderWidth={2}
                                                                                                    rounded="$xl"
                                                                                                    h={48}
                                                                                                >
                                                                                                    <InputField
                                                                                                        keyboardType="decimal-pad"
                                                                                                        value={ex.ratePerGm || ''}
                                                                                                        onChangeText={v =>
                                                                                                            updateExchangeField('ratePerGm', v)
                                                                                                        }
                                                                                                        maxLength={INPUT_LIMITS.rate}
                                                                                                        fontSize="$sm"
                                                                                                        returnKeyType="done"
                                                                                                        onSubmitEditing={Keyboard.dismiss}
                                                                                                    />
                                                                                                </Input>
                                                                                            </FormControl>
                                                                                            <FormControl flex={1} isInvalid={amountMissing}>
                                                                                                <FormControlLabel mb="$1" px="$1">
                                                                                                    <FormControlLabelText
                                                                                                        fontSize="$xs"
                                                                                                        fontWeight="$bold"
                                                                                                        color={
                                                                                                            amountMissing
                                                                                                                ? '$red500'
                                                                                                                : '$coolGray800'
                                                                                                        }
                                                                                                    >
                                                                                                        {t('invoice.exchange.amount')}
                                                                                                    </FormControlLabelText>
                                                                                                </FormControlLabel>
                                                                                                <Input
                                                                                                    bg="$white"
                                                                                                    borderWidth={1}
                                                                                                    borderColor={
                                                                                                        amountMissing
                                                                                                            ? '$red500'
                                                                                                            : '#E2E8F0'
                                                                                                    }
                                                                                                    $focus-borderColor="#8B5CF6"
                                                                                                    $focus-borderWidth={2}
                                                                                                    rounded="$xl"
                                                                                                    h={48}
                                                                                                >
                                                                                                    <Box pl="$3" justifyContent="center">
                                                                                                        <Text color="$coolGray400">₹</Text>
                                                                                                    </Box>
                                                                                                    <InputField
                                                                                                        keyboardType="decimal-pad"
                                                                                                        value={ex.amount}
                                                                                                        onChangeText={handleChange(
                                                                                                            `exchanges[${exIdx}].amount`,
                                                                                                        )}
                                                                                                        maxLength={INPUT_LIMITS.amount}
                                                                                                        fontSize="$sm"
                                                                                                        returnKeyType="done"
                                                                                                        onSubmitEditing={Keyboard.dismiss}
                                                                                                    />
                                                                                                </Input>
                                                                                            </FormControl>
                                                                                        </HStack>
                                                                                    </VStack>
                                                                                    )}

                                    {/* This ornament's own photos. The exchange used to have a single set
                                        for the whole bill, which could not say which photo was of which
                                        piece - the one question a photo of an ornament answers. Same
                                        control the declaration uses, so the two flows look alike. */}
                                    <Box mt="$3">
                                      <ItemPhotoPicker
                                        pending={(ex as any).pendingPhotos || []}
                                        onChangePending={photos =>
                                          setFieldValue(`exchanges[${exIdx}].pendingPhotos`, photos)
                                        }
                                        saved={(ex as any).photos || []}
                                      addLabel={t('declaration.photos.addPhotos') || 'Add Photos'}
                                        onDeleteSaved={
                                          onDeleteExchangePhoto
                                            ? fileId => onDeleteExchangePhoto(exIdx, fileId)
                                            : undefined
                                        }
                                      />
                                    </Box>
                                                                                </Box>
                                                                            );
                                                                        })}
                                                                    </VStack>
                                                                )}
                                                            </FieldArray>
                                                        </Collapsible>

                                                        {/* The bill-wide photo set is gone from this form: photos now
                                                            hang off the gold or silver row they are of, above. Bills
                                                            saved before that still hold theirs and still display them
                                                            on the order screen - nothing was migrated, because
                                                            reassigning them to a particular row would assert
                                                            something nobody recorded. */}

                                                        {/* Optional, off by default. Ticking this does not collect
                                                            any new information here — it just asks, right after the
                                                            bill saves, whether to generate the declaration this
                                                            exchange already has everything else for. */}
                                                        <Collapsible expanded={values.enableExchange}>
                                                            <Box
                                                                mt="$4"
                                                                pt="$4"
                                                                borderTopWidth={1}
                                                                borderColor="$coolGray100"
                                                            >
                                                                <HStack justifyContent="space-between" alignItems="center">
                                                                    <VStack flex={1} pr="$3">
                                                                        <Text fontWeight="$bold" fontSize="$sm" color="$coolGray900">
                                                                            {t('declaration.generateButton') || 'Generate Declaration'}
                                                                        </Text>
                                                                        <Text fontSize="$xs" color="$coolGray400">
                                                                            {t('invoice.exchange.generateDeclarationSubtitle') ||
                                                                                'Affidavit for this exchange'}
                                                                        </Text>
                                                                    </VStack>
                                                                    <Switch
                                                                        value={!!values.generateDeclaration}
                                                                        onValueChange={(next: boolean) => {
                                                                            setFieldValue('generateDeclaration', next);
                                                                        }}
                                                                        trackColor={{ false: '#E2E8F0', true: '#8B5CF6' }}
                                                                    />
                                                                </HStack>
                                                            </Box>
                                                        </Collapsible>
                                                    </Box>

                                                    <Box
                                                        bg="$white"
                                                        rounded="$2xl"
                                                        borderWidth={1}
                                                        borderColor="#E5E7EB"
                                                        p="$4"
                                                        shadowColor="#000"
                                                        shadowOffset={{ width: 0, height: 1 }}
                                                        shadowOpacity={0.05}
                                                        elevation={2}
                                                    >
                                                        <HStack
                                                            alignItems="center"
                                                            justifyContent="space-between"
                                                        >
                                                            <VStack flex={1} pr="$3">
                                                                <Text fontWeight="$bold" color="$coolGray900">
                                                                    {t('invoice.includeGst')}
                                                                </Text>
                                                                {values.includeGst && (
                                                                    <Badge bg="#EEF2FF" rounded="$full" alignSelf="flex-start" mt="$1">
                                                                        <BadgeText
                                                                            color="#4F46E5"
                                                                            fontSize={10}
                                                                            fontWeight="$black"
                                                                        >
                                                                            {(shopDetails as any)?.gstPercentage || 3}%{' '}
                                                                            {t('invoice.gstApplied') || 'GST APPLIED'}
                                                                        </BadgeText>
                                                                    </Badge>
                                                                )}
                                                            </VStack>
                                                            <Switch
                                                                value={values.includeGst}
                                                                onValueChange={(next: boolean) => {
                                                                    setFieldValue('includeGst', next);
                                                                    if (next) setExpandedItems([]);
                                                                }}
                                                                trackColor={{ false: '#E2E8F0', true: '#8B5CF6' }}
                                                            />
                                                        </HStack>
                                                    </Box>

                                                    {values.includeGst && (
                                                        <Box
                                                            bg="$white"
                                                            rounded="$2xl"
                                                            borderWidth={1}
                                                            borderColor="$coolGray100"
                                                            p="$4"
                                                            mt="$3"
                                                            shadowColor="#000"
                                                            shadowOffset={{ width: 0, height: 1 }}
                                                            shadowOpacity={0.05}
                                                            elevation={2}
                                                        >
                                                            <FormControlLabel mb="$1" px="$1">
                                                                <FormControlLabelText
                                                                    fontSize="$xs"
                                                                    fontWeight="$bold"
                                                                    color="$coolGray800"
                                                                >
                                                                    {t('invoice.customerGstin') || 'Customer GSTIN (for B2B)'}
                                                                </FormControlLabelText>
                                                            </FormControlLabel>
                                                            <Input
                                                                bg="#F9FAFB"
                                                                borderWidth={1}
                                                                borderColor={
                                                                    values.customerGstin &&
                                                                    !/^[0-9]{2}[A-Z0-9]{13}$/.test(
                                                                        values.customerGstin.trim().toUpperCase(),
                                                                    )
                                                                        ? '$red500'
                                                                        : '#F3F4F6'
                                                                }
                                                                $focus-borderColor="#8B5CF6"
                                                                $focus-borderWidth={2}
                                                                rounded="$xl"
                                                                h={48}
                                                            >
                                                                <InputField
                                                                    placeholder={
                                                                        t('invoice.customerGstinPlaceholder') ||
                                                                        'e.g., 27AAAAA0000A1Z5 (optional)'
                                                                    }
                                                                    value={values.customerGstin || ''}
                                                                    onChangeText={v =>
                                                                        setFieldValue(
                                                                            'customerGstin',
                                                                            v.toUpperCase().replace(/\s/g, ''),
                                                                        )
                                                                    }
                                                                    autoCapitalize="characters"
                                                                    maxLength={15}
                                                                    fontSize="$sm"
                                                                    returnKeyType="done"
                                                                    onSubmitEditing={Keyboard.dismiss}
                                                                />
                                                            </Input>
                                                            {!!values.customerGstin &&
                                                                !/^[0-9]{2}[A-Z0-9]{13}$/.test(
                                                                    values.customerGstin.trim().toUpperCase(),
                                                                ) && (
                                                                    <Text fontSize="$xs" color="$red500" mt="$1" px="$1">
                                                                        {t('invoice.customerGstinInvalid') ||
                                                                            'Enter a valid 15-character GSTIN'}
                                                                    </Text>
                                                                )}
                                                        </Box>
                                                    )}
                                                </>
                                            )}

                                            <Box
                                                bg="$white"
                                                rounded="$2xl"
                                                borderWidth={1}
                                                borderColor="$coolGray100"
                                                p="$4"
                                                mt="$3"
                                                shadowColor="#000"
                                                shadowOffset={{ width: 0, height: 1 }}
                                                shadowOpacity={0.05}
                                                elevation={2}
                                            >
                                                <Text fontWeight="$bold" color="$coolGray900" mb="$3">
                                                    {t('invoice.paymentMethod.title') || 'Payment Mode'}
                                                </Text>
                                                <HStack space="md">
                                                    {(['cash', 'online'] as const).map(mode => (
                                                        <Pressable
                                                            key={mode}
                                                            flex={1}
                                                            onPress={() => {
                                                                setFieldValue('paymentMethod', mode);
                                                                if (mode === 'cash') {
                                                                    setFieldValue('onlinePaymentType', undefined);
                                                                }
                                                            }}
                                                        >
                                                            <Box
                                                                rounded="$xl"
                                                                borderWidth={1}
                                                                borderColor={
                                                                    values.paymentMethod === mode
                                                                        ? '#6366F1'
                                                                        : '$coolGray200'
                                                                }
                                                                bg={
                                                                    values.paymentMethod === mode
                                                                        ? '#EEF2FF'
                                                                        : '$white'
                                                                }
                                                                py="$3"
                                                                alignItems="center"
                                                            >
                                                                <Text
                                                                    fontWeight="$bold"
                                                                    color={
                                                                        values.paymentMethod === mode
                                                                            ? '#4F46E5'
                                                                            : '$coolGray600'
                                                                    }
                                                                >
                                                                    {t(`invoice.paymentMethod.${mode}`) ||
                                                                        (mode === 'cash' ? 'Cash' : 'Online')}
                                                                </Text>
                                                            </Box>
                                                        </Pressable>
                                                    ))}
                                                </HStack>

                                                {values.paymentMethod === 'online' && (
                                                    <Box mt="$3">
                                                        <SelectField
                                                            value={values.onlinePaymentType || ''}
                                                            items={(
                                                                ['upi', 'bank_transfer', 'cheque', 'card', 'other'] as const
                                                            ).map(v => ({
                                                                label: t(`invoice.paymentMethod.${v}`) || v,
                                                                value: v,
                                                            }))}
                                                            placeholder={
                                                                t('invoice.paymentMethod.selectType') ||
                                                                'Select payment type'
                                                            }
                                                            title={t('invoice.paymentMethod.title') || 'Payment Mode'}
                                                            onValueChange={v =>
                                                                setFieldValue('onlinePaymentType', v)
                                                            }
                                                        />
                                                    </Box>
                                                )}
                                            </Box>

                                            <Box mt="$4">
                                                <GradientButton
                                                    label={t('invoice.buttons.calculatePreview')}
                                                    onPress={() => {
                                                        const allItemsValid =
                                                            values.items.length > 0 &&
                                                            values.items.every(isItemValid);
                                                        const allExchangesValid =
                                                            !values.enableExchange ||
                                                            values.exchanges.every(ex => Number(ex.amount) > 0);
                                                        const paymentMethodValid =
                                                            !!values.paymentMethod &&
                                                            (values.paymentMethod !== 'online' || !!values.onlinePaymentType);
                                                        if (!allItemsValid || !allExchangesValid || !paymentMethodValid) {
                                                            setShowErrors(true);
                                                            const invalidIndexes = values.items
                                                                .map((item, idx) => (!isItemValid(item) ? idx : -1))
                                                                .filter(idx => idx !== -1);
                                                            setExpandedItems(prev => Array.from(new Set([...prev, ...invalidIndexes])));
                                                            const errors = [];
                                                            if (values.items.length === 0) {
                                                                errors.push(t('advanceOrder.alerts.noItemsMessage') || 'Please add at least one item.');
                                                            } else {
                                                                values.items.forEach((item, idx) => {
                                                                    const label = item.itemName && item.itemName.trim() ? item.itemName.trim() : ('Item ' + (idx + 1));
                                                                    if (!item.itemName || !item.itemName.trim()) errors.push('Item ' + (idx + 1) + ': ' + (t('invoice.fields.itemName') || 'Item Name') + ' is required');
                                                                    if (!item.grossWt) errors.push(label + ': ' + (t('invoice.fields.grossWt') || 'Gross Weight') + ' is required');
                                                                    if (item.useCustomRate && !item.ratePerGm) errors.push(label + ': ' + (t('invoice.fields.rate') || 'Rate') + ' is required');
                                                                });
                                                            }
                                                            if (values.enableExchange) {
                                                                values.exchanges.forEach((ex, idx) => {
                                                                    if (!(Number(ex.amount) > 0)) {
                                                                        errors.push(
                                                                            t(`invoice.dropdown.${ex.type.toLowerCase()}`) +
                                                                                ' exchange ' + (idx + 1) + ': ' +
                                                                                (t('invoice.exchange.amountRequired') || 'Total Amount is required'),
                                                                        );
                                                                    }
                                                                });
                                                            }
                                                            if (!paymentMethodValid) {
                                                                errors.push(
                                                                    !values.paymentMethod
                                                                        ? (t('invoice.paymentMethod.required') || 'Please select a payment mode')
                                                                        : (t('invoice.paymentMethod.onlineTypeRequired') || 'Please select an online payment type'),
                                                                );
                                                            }
                                                            setValidationErrors(errors.length ? errors : [t('invoice.validation.missingFields') || 'Please fill in all required fields.']);
                                                            setShowValidationModal(true);
                                                            return;
                                                        }
                                                        setShowErrors(false);
                                                        const gstRate =
                                                            ((shopDetails as any)?.gstPercentage || 3) / 100;
                                                        const totals = calculateFormTotals(values, gstRate);
                                                        onCalculate({ ...values, ...totals });
                                                    }}
                                                />
                                            </Box>
                                        </VStack>
                                    </Box>
                                </Pressable>
                            </ScrollView>
                            <DatePickerModal
                                isOpen={isDatePickerOpen}
                                onClose={() => setIsDatePickerOpen(false)}
                                date={values.invoiceDate}
                                onSelect={d => {
                                    setFieldValue('invoiceDate', d);
                                }}
                            />
                        </VStack>
                    );
                }}
            </Formik>
            <ValidationErrorModal
                isOpen={showValidationModal}
                errors={validationErrors}
                onClose={() => setShowValidationModal(false)}
            />
        </KeyboardAvoidingView>
    );
};
export default InvoiceCreationScreen;
