import React from 'react';
import { Modal, StyleSheet, useWindowDimensions } from 'react-native';
import { HStack, Text, Pressable, Icon } from '@gluestack-ui/themed';
import { Check } from 'lucide-react-native';
import { useTranslation } from '../../hooks/useTranslation';
import { PRINT_LANGUAGES } from './LanguagePicker';
import type { Language } from '../../localization';

const PURPLE = '#6D5EF7';

/** Fixed rather than intrinsic, so the card can be right-aligned to its anchor. */
const CARD_WIDTH = 190;

/** Smallest gap kept between the card and the window edge. */
const EDGE_MARGIN = 12;

/** Window-space rect of the control that opened the popover, from `measureInWindow`. */
export type PopoverAnchor = { x: number; y: number; width: number; height: number };

interface LanguagePopoverProps {
    isOpen: boolean;
    onClose: () => void;
    anchor: PopoverAnchor | null;
}

/**
 * The app-language menu hanging off the language control.
 *
 * A popover rather than a sheet: this is a four-item menu attached to the
 * control that opened it, and a full-width sheet rising from the bottom
 * overstated a change that takes one tap.
 *
 * Still a `Modal` underneath — that is what puts it above the ScrollView and
 * gives a backdrop that closes on an outside tap — but positioned against the
 * anchor rather than the screen edge. The caller measures the control instead of
 * this recomputing the header's height, which would duplicate the safe-area and
 * banner maths and drift the moment either changes.
 *
 * It is positioned from the anchor's own rect, not from a fixed inset off the
 * window edge. Those are the same thing on a phone, where the header spans the
 * full width — but not on a desktop browser, where the header content is capped
 * and centred and a window-anchored card lands hundreds of pixels away from the
 * globe that opened it.
 */
const LanguagePopover: React.FC<LanguagePopoverProps> = ({ isOpen, onClose, anchor }) => {
    const { language, setLanguage } = useTranslation();
    const { width: windowWidth } = useWindowDimensions();

    if (!anchor) return null;

    // Right-aligned to the anchor — menus grow away from the edge they hang off
    // — then clamped so a control near either edge cannot push the card out of
    // the window.
    const left = Math.min(
        Math.max(EDGE_MARGIN, anchor.x + anchor.width - CARD_WIDTH),
        Math.max(EDGE_MARGIN, windowWidth - CARD_WIDTH - EDGE_MARGIN),
    );
    const top = anchor.y + anchor.height + 8;

    return (
        <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable flex={1} bg="rgba(0,0,0,0.15)" onPress={onClose}>
                <Pressable
                    style={[styles.card, { top, left }]}
                    onPress={(e: any) => e.stopPropagation?.()}
                >
                    {PRINT_LANGUAGES.map((lang, idx) => {
                        const selected = language === lang.code;
                        return (
                            <Pressable
                                key={lang.code}
                                onPress={() => {
                                    setLanguage(lang.code as Language);
                                    onClose();
                                }}
                                px="$4"
                                py="$3"
                                borderTopWidth={idx === 0 ? 0 : 1}
                                borderColor="$coolGray100"
                                bg={selected ? '#EEF2FF' : 'transparent'}
                            >
                                <HStack alignItems="center" justifyContent="space-between" space="md">
                                    <Text
                                        fontSize={15}
                                        fontWeight={selected ? '$bold' : '$normal'}
                                        color={selected ? PURPLE : '$coolGray800'}
                                    >
                                        {lang.label}
                                    </Text>
                                    {selected && <Icon as={Check} size="sm" color={PURPLE} />}
                                </HStack>
                            </Pressable>
                        );
                    })}
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    card: {
        position: 'absolute',
        width: CARD_WIDTH,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
    },
});

export default LanguagePopover;
