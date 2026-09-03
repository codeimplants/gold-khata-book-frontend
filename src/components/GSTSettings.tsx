import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { ArrowLeft, Save } from 'lucide-react-native';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { updateShopDetails } from '../store/data/dataSlice';
import { INPUT_LIMITS } from '../constants/inputLimits';
import { LAYOUT } from '../constants/layout';

interface GSTSettingsProps {
    onBack: () => void;
}

export const GSTSettings = ({ onBack }: GSTSettingsProps) => {
    const dispatch = useAppDispatch();
    const { shopDetails, loading } = useAppSelector((state) => state.data);

    const [gstPercentage, setGstPercentage] = useState('3');

    useEffect(() => {
        if (shopDetails) {
            setGstPercentage(String(shopDetails.gstPercentage || '3'));
        }
    }, [shopDetails]);

    const handleSave = async () => {
        if (!shopDetails) {
            Alert.alert('Error', 'Shop details not found. Please add shop details first.');
            return;
        }

        try {
            const payload = {
                ...shopDetails,
                gstPercentage: parseFloat(gstPercentage) || 0,
            };

            await dispatch(updateShopDetails(payload)).unwrap();
            Alert.alert('Success', 'GST settings saved successfully');
            onBack();
        } catch (err: any) {
            console.error('[GSTSettings] Save error:', err);
            Alert.alert('Error', err || 'Failed to save GST settings');
        }
    };

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, backgroundColor: '#f8fafc' }}
        >
            {/* Header */}
            <View style={{
                backgroundColor: '#ffffff',
                borderBottomWidth: 1,
                borderBottomColor: '#e5e7eb',
                paddingHorizontal: 16,
                paddingVertical: 16,
                zIndex: 10,
                elevation: 2
            }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}) }}>
                    <TouchableOpacity onPress={onBack} style={{ padding: 8 }}>
                        <ArrowLeft size={20} color="#374151" />
                    </TouchableOpacity>
                    <View>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
                            GST Settings
                        </Text>
                        <Text style={{ fontSize: 12, color: '#6b7280' }}>
                            Configure tax rates
                        </Text>
                    </View>
                </View>
            </View>

            {/*
                The GST rate input and Save Settings button share this
                container, so without this the first tap on Save after editing
                the rate is spent dismissing the keyboard.
            */}
            <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingVertical: 24,
                    gap: 24,
                    ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {})
                }}
            >
                <View style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                    padding: 16,
                    gap: 16
                }}>
                    <View>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                            GST Rate (%)
                        </Text>
                        <TextInput
                            style={{
                                borderWidth: 1,
                                borderColor: '#e5e7eb',
                                borderRadius: 12,
                                paddingHorizontal: 12,
                                paddingVertical: 12,
                                fontSize: 16,
                                backgroundColor: '#f3f4f6'
                            }}
                            value={gstPercentage}
                            onChangeText={setGstPercentage}
                            keyboardType="numeric"
                            maxLength={INPUT_LIMITS.percentage}
                            placeholder="Enter GST rate"
                        />
                        <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                            This rate will be applied to all items and making charges
                        </Text>
                    </View>
                </View>

                <View style={{
                    backgroundColor: '#f3f4f6',
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                    padding: 16
                }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                        Note
                    </Text>
                    <Text style={{ fontSize: 13, color: '#6b7280' }}>
                        These GST rates will be applied when calculating invoice totals.
                        Make sure to keep these rates updated according to current government regulations.
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={handleSave}
                    disabled={loading}
                    style={{
                        backgroundColor: loading ? '#94a3b8' : '#2563eb',
                        borderRadius: 16,
                        paddingVertical: 16,
                        alignItems: 'center',
                        opacity: loading ? 0.7 : 1
                    }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Save size={20} color="#ffffff" />
                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#ffffff' }}>
                            {loading ? 'Saving...' : 'Save Settings'}
                        </Text>
                    </View>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};