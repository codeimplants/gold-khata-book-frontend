import { StyleSheet, TouchableOpacity, Text, ActivityIndicator, View, Platform } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useAppSelector } from '../../store/hooks';

interface GradientButtonProps {
    label: string;
    onPress: () => void;
    colors?: string[];
    style?: any;
    loading?: boolean;
    disabled?: boolean;
}

const GradientButton = ({
    label,
    onPress,
    colors = ['#A855F7', '#D946EF'],
    style,
    loading: localLoading,
    disabled: localDisabled,
}: GradientButtonProps) => {
    const isGlobalLoading = useAppSelector(state => state.ui.isGlobalLoading);
    const isLoading = localLoading || isGlobalLoading;
    const isDisabled = localDisabled || isLoading;

    return (
        <TouchableOpacity
            onPress={isDisabled ? undefined : onPress}
            activeOpacity={isDisabled ? 1 : 0.8}
            style={[
                styles.container,
                style,
                isDisabled && styles.disabled,
                Platform.OS === 'web' && {
                    backgroundImage: isDisabled ? 'none' : 'linear-gradient(135deg, hsl(252 100% 67%), hsl(330 85% 60%))',
                    backgroundColor: isDisabled ? '#9CA3AF' : '#6D5EF7',
                }
            ]}
        >
            {Platform.OS !== 'web' ? (
                <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
                    <Defs>
                        <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
                            <Stop offset="0" stopColor={isDisabled ? '#9CA3AF' : colors[0]} stopOpacity="1" />
                            <Stop offset="1" stopColor={isDisabled ? '#6B7280' : colors[1]} stopOpacity="1" />
                        </LinearGradient>
                    </Defs>
                    <Rect x="0" y="0" width="100%" height="100%" fill="url(#grad)" rx={12} ry={12} />
                </Svg>
            ) : null}
            {isLoading ? (
                <ActivityIndicator color="white" size="small" />
            ) : (
                <Text style={styles.text}>{label}</Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 56,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    disabled: {
        opacity: 0.7,
    },
    text: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default GradientButton;
