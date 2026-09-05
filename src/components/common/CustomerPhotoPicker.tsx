import React, { useState } from 'react';
import { StyleSheet, Image } from 'react-native';
import { Box, Text, Pressable, Icon } from '@gluestack-ui/themed';
import { User, Pencil } from 'lucide-react-native';
import { useTranslation } from '../../hooks/useTranslation';
import { toast } from './Toast';
import { pickPhotos } from '../../utils/photoPicker';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { getFullImageUrl } from '../../utils/imageUtils';
import PhotoSourceSheet from '../photos/PhotoSourceSheet';
import type { PendingDeclarationPhoto } from '../../types';

const PURPLE = '#6D5EF7';

interface CustomerPhotoPickerProps {
    /** Local pick awaiting upload. */
    value?: PendingDeclarationPhoto | { uri: string } | null;
    /** The saved photo's url, when the customer already has one. */
    url?: string;
    onPick: (photo: PendingDeclarationPhoto) => void;
    onRemove?: () => void;
    /** Falls back to a letter avatar while there is no photo. */
    name?: string;
}

/**
 * One circular profile photo for a customer.
 *
 * The avatar is the whole control — tapping it opens the source choice. An
 * earlier version put "Camera" and "Gallery" buttons inline, which spent three
 * lines of a cramped modal on a field most shops leave empty.
 *
 * Deliberately not `OrnamentPhotoPicker`: that manages a *set* of evidence
 * photos in a collapsible section. This is a single portrait that stands in for
 * the person, so it renders as the avatar it will become.
 */
const CustomerPhotoPicker: React.FC<CustomerPhotoPickerProps> = ({
    value,
    url,
    onPick,
    onRemove,
    name,
}) => {
    const { t } = useTranslation();
    const photoUploadEnabled = useFeatureFlag('photoUpload');
    const [chooserOpen, setChooserOpen] = useState(false);

    const localUri = (value as any)?.uri;
    const shownUri = localUri || getFullImageUrl(url) || undefined;

    const pick = async (mode: 'camera' | 'library') => {
        setChooserOpen(false);
        const outcome = await pickPhotos(mode, 1, {
            capture: t('declaration.photos.capture') || 'Capture',
            done: t('common.done') || 'Done',
            cancel: t('common.cancel') || 'Cancel',
        });
        if (outcome.status === 'picked') {
            if (outcome.photos[0]) onPick(outcome.photos[0]);
            return;
        }
        if (outcome.status === 'cancelled') return;
        if (outcome.status === 'unavailable') {
            toast.error(t('customers.photo.unavailable'));
            return;
        }
        toast.error(outcome.message || t('customers.photo.failed'));
    };

    return (
        <>
            {/* Still shows the photo or the initial when `photoUpload` is off —
                only changing it is gated. Disabled rather than unmounted so the
                avatar keeps its place in the layout. */}
            <Pressable
                onPress={() => setChooserOpen(true)}
                disabled={!photoUploadEnabled}
                alignSelf="flex-start"
            >
                <Box style={styles.avatar}>
                    {shownUri ? (
                        <Image source={{ uri: shownUri }} style={styles.avatarImage} />
                    ) : (
                        <Box style={styles.avatarPlaceholder}>
                            {name?.trim() ? (
                                <Text color="$coolGray500" fontWeight="$bold" fontSize={24}>
                                    {name.trim().charAt(0).toUpperCase()}
                                </Text>
                            ) : (
                                <Icon as={User} size="xl" color="$coolGray400" />
                            )}
                        </Box>
                    )}

                    {/* Badge rather than a caption: it marks the avatar as
                        editable without spending a line on saying so. Which is
                        exactly why it must go when editing is switched off — a
                        pencil on a control that does nothing is a lie. */}
                    {photoUploadEnabled && (
                        <Box style={styles.badge}>
                            <Icon as={Pencil} size="xs" color="$white" />
                        </Box>
                    )}
                </Box>
            </Pressable>

            <PhotoSourceSheet
                visible={chooserOpen}
                onClose={() => setChooserOpen(false)}
                onPick={pick}
                title={t('customers.photo.title')}
                onRemove={shownUri && onRemove ? onRemove : undefined}
                removeLabel={t('customers.photo.remove')}
            />
        </>
    );
};

const styles = StyleSheet.create({
    avatar: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    avatarImage: { width: '100%', height: '100%', borderRadius: 34 },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    badge: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: PURPLE,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default CustomerPhotoPicker;
