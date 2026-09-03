import React from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
} from "react-native";
import { ShieldAlert } from "lucide-react-native";

interface Props {
    isOpen: boolean;
    phone: string;
    onEndSession: () => void;
    onClose: () => void;
}

export default function ImpersonationBlockModal({ isOpen, phone, onEndSession, onClose }: Props) {
    return (
        <Modal
            visible={isOpen}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.card}>
                    <View style={styles.iconRow}>
                        <View style={styles.iconBadge}>
                            <ShieldAlert size={28} color="#4F46E5" />
                        </View>
                    </View>

                    <Text style={styles.title}>Action Blocked</Text>

                    <Text style={styles.body}>
                        You are viewing this account as{" "}
                        <Text style={styles.phone}>+91 {phone}</Text>
                        {". "}
                        Admin sessions are read-only — you can navigate and explore the full app but cannot save or create data.
                    </Text>

                    <TouchableOpacity style={styles.endBtn} onPress={onEndSession}>
                        <Text style={styles.endBtnText}>End Session</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.keepBtn} onPress={onClose}>
                        <Text style={styles.keepBtnText}>Keep Viewing</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 24,
        width: "100%",
        maxWidth: 360,
        alignItems: "center",
    },
    iconRow: {
        marginBottom: 12,
    },
    iconBadge: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "#EEF2FF",
        alignItems: "center",
        justifyContent: "center",
    },
    title: {
        fontSize: 18,
        fontWeight: "700",
        color: "#111827",
        marginBottom: 10,
        textAlign: "center",
    },
    body: {
        fontSize: 14,
        color: "#4B5563",
        textAlign: "center",
        lineHeight: 22,
        marginBottom: 24,
    },
    phone: {
        fontWeight: "700",
        color: "#111827",
    },
    endBtn: {
        width: "100%",
        backgroundColor: "#4F46E5",
        borderRadius: 10,
        paddingVertical: 13,
        alignItems: "center",
        marginBottom: 10,
    },
    endBtnText: {
        color: "#FFFFFF",
        fontSize: 15,
        fontWeight: "700",
    },
    keepBtn: {
        width: "100%",
        backgroundColor: "#F3F4F6",
        borderRadius: 10,
        paddingVertical: 13,
        alignItems: "center",
    },
    keepBtnText: {
        color: "#374151",
        fontSize: 15,
        fontWeight: "600",
    },
});
