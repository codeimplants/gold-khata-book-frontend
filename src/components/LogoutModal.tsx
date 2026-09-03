import React from 'react';
import { Modal, StyleSheet } from 'react-native';
import {
    Box,
    VStack,
    HStack,
    Text,
    Pressable,
    Icon,
} from '@gluestack-ui/themed';
import { LogOut, AlertTriangle, X } from 'lucide-react-native';
import { useTranslation } from '../hooks/useTranslation';
import GradientSurface from './common/GradientSurface';

interface LogoutModalProps {
    visible: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

const LogoutModal: React.FC<LogoutModalProps> = ({
    visible,
    onConfirm,
    onCancel,
}) => {
    const { t } = useTranslation();

    const title = (t('settings.logoutConfirm') || 'Logout Confirmation');

    const message = (t('settings.logoutMessage') || 'Are you sure you want to logout?');

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onCancel}
        >
            <Box flex={1} bg="rgba(0,0,0,0.5)" justifyContent="center" alignItems="center" px="$4">
                <Box
                    w="100%"
                    bg="$white"
                    rounded="$3xl"
                    p="$6"
                    style={{ maxWidth: 400 }}
                    hardShadow="4"
                >
                    <VStack space="xl" alignItems="center">
                        <Box style={styles.iconCircle}>
                            <GradientSurface colors={['#F472B6', '#DC2626']} borderRadius={35} />
                            <Icon
                                as={LogOut}
                                size={32}
                                color="$white"
                            />
                        </Box>

                        <VStack space="sm" alignItems="center">
                            <Text fontSize={20} fontWeight="$bold" textAlign="center" color={"$coolGray900"}>
                                {title}
                            </Text>
                            <Text fontSize={15} color="$coolGray500" textAlign="center" px="$2">
                                {message}
                            </Text>
                        </VStack>

                        <HStack space="md" w="100%" mt="$2">
                            <Pressable
                                flex={1}
                                onPress={onCancel}
                            >
                                <Box
                                    rounded="$2xl"
                                    borderWidth={1}
                                    borderColor="#A7F3D0"
                                    py="$3.5"
                                    alignItems="center"
                                    bg="#ECFDF5"
                                >
                                    <Text fontWeight="$bold" color="#047857">
                                        {t('common.cancel') || 'Cancel'}
                                    </Text>
                                </Box>
                            </Pressable>

                            <Pressable
                                flex={1}
                                onPress={onConfirm}
                            >
                                <Box
                                    rounded="$2xl"
                                    borderWidth={1}
                                    borderColor="#FECACA"
                                    py="$3.5"
                                    alignItems="center"
                                    bg="#FEF2F2"
                                >
                                    <Text fontWeight="$bold" color="#DC2626">
                                        {t('settings.logout') || 'Logout'}
                                    </Text>
                                </Box>
                            </Pressable>
                        </HStack>
                    </VStack>
                </Box>
            </Box>
        </Modal>
    );
};

const styles = StyleSheet.create({
    iconCircle: {
        width: 70,
        height: 70,
        borderRadius: 35,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default LogoutModal;
