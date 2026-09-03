import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Fingerprint } from 'lucide-react-native';
import { useAppDispatch } from '../../store/hooks';
import { deactivateLock } from '../../store/security/securitySlice';
import { useBiometric } from '../../hooks/useBiometric';

type LockStatus = 'idle' | 'prompting' | 'failed';

const BiometricLockScreen = () => {
  const dispatch = useAppDispatch();
  const { prompt } = useBiometric();
  const [status, setStatus] = useState<LockStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const triggerAuth = useCallback(async () => {
    setStatus('prompting');
    setErrorMessage(null);
    const result = await prompt('Unlock Gold Khata Book');
    if (result.success) {
      dispatch(deactivateLock());
    } else {
      setStatus('failed');
      setErrorMessage('Authentication failed. Please try again.');
    }
  }, [dispatch, prompt]);

  useEffect(() => {
    triggerAuth();
  }, []);

  return (
    <Modal
      visible={true}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={triggerAuth}
    >
      <View style={styles.container}>
        {/* App Logo */}
        <View style={styles.logoBox}>
          <Image
            source={require('../../../assets/logo.png')}
            style={styles.logoImage}
          />
        </View>
        <Text style={styles.appName}>Gold Khata Book</Text>

        {/* Lock icon */}
        <View style={styles.iconContainer}>
          <Fingerprint size={48} color="#A855F7" strokeWidth={1.5} />
        </View>

        {/* Status */}
        <Text style={styles.title}>
          {status === 'prompting' ? 'Authenticating…' : 'App Locked'}
        </Text>
        <Text style={styles.subtitle}>
          {status === 'failed'
            ? errorMessage ?? 'Authentication failed. Please try again.'
            : 'Use biometrics or PIN to unlock'}
        </Text>

        {status === 'prompting' && (
          <ActivityIndicator color="#A855F7" size="large" style={styles.indicator} />
        )}

        {status === 'failed' && (
          <TouchableOpacity style={styles.retryButton} onPress={triggerAuth} activeOpacity={0.8}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 32,
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 8,
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  appName: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  iconContainer: {
    marginTop: 48,
    marginBottom: 24,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3E8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  indicator: {
    marginTop: 32,
  },
  retryButton: {
    marginTop: 32,
    backgroundColor: '#A855F7',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default BiometricLockScreen;
