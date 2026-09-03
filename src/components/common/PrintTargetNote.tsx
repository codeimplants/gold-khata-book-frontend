import React, { useState } from 'react';
import { Box, Text } from '@gluestack-ui/themed';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from '../../hooks/useTranslation';
import ConfirmModal from '../ConfirmModal';

const PURPLE = '#6D5EF7';

interface PrintTargetNoteProps {
    mt?: string;
    /**
     * Overrides the caption. Bills pass `usePrintBill`'s label, which names the
     * actual thermal printer when one is paired; everything else prints A4 and
     * takes the default.
     */
    label?: string;
    /**
     * Handles Change without leaving the screen — the bill screens' inline
     * chooser sheet. No confirmation is shown when set, because nothing is
     * lost. Pass `undefined` where the sheet cannot help (on web there is
     * nothing to choose between) and Change falls back to Print Settings.
     */
    onChangeInPlace?: () => void;
    /**
     * Runs after the shopkeeper confirms, before navigating. Hosts inside a
     * `Modal` must close themselves here: a navigation from under an open modal
     * pushes Print Settings *behind* it, so the tap looks like it did nothing.
     */
    onBeforeNavigate?: () => void;
}

/**
 * "Printing to: …" under a Print button, with a Change link.
 *
 * Every Print button in the app carries one, so tapping Print is never a coin
 * flip. Without it a shop set to thermal, with the printer off, taps Print,
 * gets an error it did not expect, and has no idea the setting was ever
 * thermal.
 *
 * The default caption is fixed at A4 because most documents genuinely always
 * print full-page: `printDeclaration` and the blank forms call `printHTML`
 * directly and never touch the thermal path, since an affidavit on a 2-inch
 * till roll is not something anyone can sign. Bills pass their own label.
 *
 * Change confirms before navigating, since following it leaves a screen the
 * shopkeeper is mid-way through — but not when it opens a chooser in place.
 */
const PrintTargetNote: React.FC<PrintTargetNoteProps> = ({
    mt = '$2',
    label,
    onChangeInPlace,
    onBeforeNavigate,
}) => {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const [confirmVisible, setConfirmVisible] = useState(false);

    const handleChangePress = () => {
        if (onChangeInPlace) {
            onChangeInPlace();
            return;
        }
        setConfirmVisible(true);
    };

    const goToSettings = () => {
        setConfirmVisible(false);
        if (onBeforeNavigate) onBeforeNavigate();
        navigation.navigate('PrintSettings');
    };

    return (
        <Box mt={mt as any} alignItems="center">
            <Text color="$coolGray500" fontSize="$xs">
                {label || t('printerChoice.printingToStandard')}
                <Text
                    color={PURPLE}
                    fontWeight="$medium"
                    fontSize="$xs"
                    onPress={handleChangePress}
                >
                    {'  ·  ' + (t('printerChoice.change') || 'Change')}
                </Text>
            </Text>

            <ConfirmModal
                visible={confirmVisible}
                onClose={() => setConfirmVisible(false)}
                tone="warning"
                icon="alert"
                title={t('printerChoice.changeConfirm.title')}
                description={t('printerChoice.changeConfirm.description')}
                confirmLabel={t('printerChoice.changeConfirm.confirm')}
                cancelLabel={t('common.cancel')}
                onConfirm={goToSettings}
            />
        </Box>
    );
};

export default PrintTargetNote;
