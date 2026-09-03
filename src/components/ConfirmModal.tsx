import React, { ReactNode } from 'react';
import { Modal, ActivityIndicator } from 'react-native';
import { Box, VStack, HStack, Text, Pressable, Icon } from '@gluestack-ui/themed';
import { Trash2, Clock, AlertTriangle, Pencil } from 'lucide-react-native';

import { ToastViewport } from './common/Toast';

type Tone = 'warning' | 'destructive';

interface ConfirmModalProps {
    visible: boolean;
    onClose: () => void;
    tone?: Tone;
    icon?: 'trash' | 'clock' | 'alert';
    title: string;
    description: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    loading?: boolean;
    onConfirm: () => void;
    /** Optional third, lower-emphasis action (e.g. "Edit rate manually")
     * rendered as a text link below the main button row. */
    tertiaryLabel?: string;
    onTertiary?: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    visible,
    onClose,
    tone = 'warning',
    icon = 'alert',
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    loading,
    onConfirm,
    tertiaryLabel,
    onTertiary,
}) => {
    const IconComponent = icon === 'trash' ? Trash2 : icon === 'clock' ? Clock : AlertTriangle;
    const isDestructive = tone === 'destructive';

    const iconBg = isDestructive ? '#FEF2F2' : '#FFFBEB';
    const iconColor = isDestructive ? '#DC2626' : '#D97706';
    const glowBg = isDestructive ? '#FEF2F2' : '#FFFBEB';
    const btnBg = isDestructive ? '#DC2626' : '#F59E0B';

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={loading ? undefined : onClose}
        >
            <Box flex={1} bg="rgba(0,0,0,0.5)" justifyContent="center" alignItems="center" px="$4">
                <Box
                    w="100%"
                    bg="$white"
                    rounded="$3xl"
                    overflow="hidden"
                    style={{ maxWidth: 400 }}
                    hardShadow="5"
                >
                    {/* Top glow section */}
                    <Box px="$6" pt="$8" pb="$4" style={{ backgroundColor: glowBg }}>
                        <VStack space="md" alignItems="center">
                            <Box
                                w={64}
                                h={64}
                                rounded="$full"
                                style={{ backgroundColor: iconBg, borderWidth: 8, borderColor: isDestructive ? '#FEE2E2' : '#FEF3C7' }}
                                alignItems="center"
                                justifyContent="center"
                            >
                                <IconComponent size={28} color={iconColor} strokeWidth={2.2} />
                            </Box>
                            <Text fontSize={18} fontWeight="$bold" textAlign="center" color="$coolGray900">
                                {title}
                            </Text>
                            <Box>
                                {typeof description === 'string' ? (
                                    <Text fontSize={14} color="$coolGray500" textAlign="center" lineHeight={20}>
                                        {description}
                                    </Text>
                                ) : (
                                    description
                                )}
                            </Box>
                        </VStack>
                    </Box>

                    {/* Button row */}
                    <HStack space="md" p="$4" pt="$3" bg="$white">
                        <Pressable flex={1} onPress={onClose} disabled={loading}>
                            <Box
                                rounded="$2xl"
                                borderWidth={1}
                                borderColor="$coolGray200"
                                py="$3.5"
                                alignItems="center"
                                bg="$white"
                            >
                                <Text fontWeight="$bold" color="$coolGray600">
                                    {cancelLabel}
                                </Text>
                            </Box>
                        </Pressable>
                        <Pressable flex={1} onPress={onConfirm} disabled={loading}>
                            <Box
                                rounded="$2xl"
                                py="$3.5"
                                alignItems="center"
                                style={{ backgroundColor: btnBg }}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text fontWeight="$bold" color="$white">
                                        {confirmLabel}
                                    </Text>
                                )}
                            </Box>
                        </Pressable>
                    </HStack>

                    {tertiaryLabel && onTertiary && (
                        <Box alignItems="center" pb="$5">
                            <Pressable onPress={onTertiary} disabled={loading}>
                                <HStack
                                    space="xs"
                                    alignItems="center"
                                    bg="#EEF2FF"
                                    borderWidth={1}
                                    borderColor="#C7D2FE"
                                    rounded="$full"
                                    px="$4"
                                    py="$2"
                                >
                                    <Icon as={Pencil} size="xs" color="#4F46E5" />
                                    <Text fontWeight="$bold" color="#4F46E5" fontSize="$sm">
                                        {tertiaryLabel}
                                    </Text>
                                </HStack>
                            </Pressable>
                        </Box>
                    )}
                </Box>
            </Box>

            {/* A confirm that fails stays open and reports the failure with a
                toast — the delete flows all do this. Without a viewport of its
                own that toast renders under this modal's native layer, so the
                shopkeeper taps Delete, the row stays, and nothing says why. */}
            <ToastViewport />
        </Modal>
    );
};

export default ConfirmModal;
