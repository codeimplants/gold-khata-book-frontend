import ReactNativeBiometrics from 'react-native-biometrics';
import { setBiometricPromptInFlight } from '../utils/biometricPromptState';

export type BiometryInfo = {
  available: boolean;
  biometryType: string | null;
  label: string;
};

export type BiometricPromptResult = {
  success: boolean;
  error?: string;
};

export function useBiometric() {
  const checkAvailability = async (): Promise<BiometryInfo> => {
    try {
      const rnBiometrics = new ReactNativeBiometrics({ allowDeviceCredentials: true });
      const { available, biometryType } = await rnBiometrics.isSensorAvailable();
      let label = 'Device PIN';
      if (biometryType === 'FaceID') label = 'Face ID';
      else if (biometryType === 'TouchID' || biometryType === 'Biometrics') label = 'Fingerprint';
      return { available, biometryType: biometryType ?? null, label };
    } catch {
      return { available: false, biometryType: null, label: 'Device PIN' };
    }
  };

  const prompt = async (promptMessage: string): Promise<BiometricPromptResult> => {
    setBiometricPromptInFlight(true);
    try {
      const rnBiometrics = new ReactNativeBiometrics({ allowDeviceCredentials: true });
      const { success } = await rnBiometrics.simplePrompt({ promptMessage });
      return { success };
    } catch (e: any) {
      return { success: false, error: e?.message ?? 'Authentication failed' };
    } finally {
      setBiometricPromptInFlight(false);
    }
  };

  return { checkAvailability, prompt };
}
