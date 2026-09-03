import React from 'react';
import { StyleSheet } from 'react-native';
import { Box, HStack, Text, Pressable } from '@gluestack-ui/themed';
import type { MobileLang } from '../../print/templates/shared';

const PURPLE = '#6D5EF7';

/** Every language the app ships, in the order the Language screen lists them. */
export const PRINT_LANGUAGES: Array<{ code: MobileLang; label: string }> = [
    { code: 'en', label: 'English' },
    { code: 'mr', label: 'मराठी' },
    { code: 'hi', label: 'हिंदी' },
    { code: 'gu', label: 'ગુજરાતી' },
];

interface LanguagePickerProps {
    value: MobileLang;
    onChange: (lang: MobileLang) => void;
    /** Heading above the rows. Omit when the surrounding card already has one. */
    title?: string;
    /** One line saying what the choice affects — worth stating, since it is not
     *  the app language and users assume it is. */
    hint?: string;
}

/**
 * The "which language should this print in" chooser, shared by the blank-form
 * downloads and the old-gold declaration so the two are identical rather than
 * merely similar.
 *
 * Renders heading and rows only — the caller supplies its own card, because the
 * two hosts have different card treatments.
 *
 * Deliberately separate from the app language: the shopkeeper reads the app,
 * the customer signs the document, and those are routinely different people
 * reading different languages.
 */
const LanguagePicker: React.FC<LanguagePickerProps> = ({
    value,
    onChange,
    title,
    hint,
}) => (
    <>
        {!!title && (
            <Text fontWeight="$bold" fontSize={15} color="$coolGray800" mb="$1">
                {title}
            </Text>
        )}
        {!!hint && (
            <Text fontSize={12} color="$coolGray500" mb="$3">
                {hint}
            </Text>
        )}

        {/* Four short labels side by side rather than stacked: as full-width
            rows this control ate a third of the declaration form for a choice
            most shops make once. The tick is dropped — at chip width the tinted
            fill and bold text already read as selected, and the icon only
            squeezed the label. */}
        <HStack space="xs">
            {PRINT_LANGUAGES.map(lang => {
                const selected = value === lang.code;
                return (
                    <Pressable key={lang.code} flex={1} onPress={() => onChange(lang.code)}>
                        <Box style={[styles.langChip, selected && styles.langChipSelected]}>
                            <Text
                                fontSize={14}
                                numberOfLines={1}
                                textAlign="center"
                                fontWeight={selected ? '$bold' : '$normal'}
                                color={selected ? PURPLE : '$coolGray700'}
                            >
                                {lang.label}
                            </Text>
                        </Box>
                    </Pressable>
                );
            })}
        </HStack>
    </>
);

const styles = StyleSheet.create({
    langChip: {
        height: 44,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
        // Horizontal padding stays small: four chips share the row, and on a
        // narrow phone the Gujarati label is the first thing to get clipped.
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    langChipSelected: {
        borderColor: PURPLE,
        backgroundColor: '#EEF2FF',
    },
});

export default LanguagePicker;
