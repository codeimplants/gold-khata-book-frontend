import React from 'react';
import ConfirmModal from './ConfirmModal';
import { useTranslation } from '../hooks/useTranslation';

interface DiscardChangesModalProps {
    visible: boolean;
    /** "Keep editing" — stay on the form. */
    onCancel: () => void;
    /** "Discard" — leave and lose what was entered. */
    onDiscard: () => void;
    /** Overrides the generic copy, e.g. "Discard this invoice?". */
    title?: string;
    description?: string;
}

/**
 * The single confirmation shown when someone backs out of a half-filled
 * creation form (invoice, advance order, old-gold purchase, order completion).
 * Wraps ConfirmModal so the wording and tone stay identical across all of them.
 *
 * Pair with `useDiscardGuard`, which decides *when* this appears.
 */
const DiscardChangesModal: React.FC<DiscardChangesModalProps> = ({
    visible,
    onCancel,
    onDiscard,
    title,
    description,
}) => {
    const { t } = useTranslation();

    return (
        <ConfirmModal
            visible={visible}
            onClose={onCancel}
            tone="destructive"
            icon="alert"
            title={title || t('common.discard.title') || 'Discard this bill?'}
            description={
                description ||
                t('common.discard.description') ||
                'The details you have entered have not been saved and will be lost.'
            }
            confirmLabel={t('common.discard.confirm') || 'Discard'}
            cancelLabel={t('common.discard.cancel') || 'Keep editing'}
            onConfirm={onDiscard}
        />
    );
};

export default DiscardChangesModal;
