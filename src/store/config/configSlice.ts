import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { apiClient } from '../../api/apiClient';
import { supportEmail, supportPhone, supportWhatsapp, supportAddress } from '@config';
import { applyRemoteConfig } from '../../utils/versionControlConfig';
import type { FeatureFlagMap } from '../../featureFlags/registry';

export interface VersionControlSettings {
  backendUrl: string;
  apiKey: string;
}

export interface PlatformConfig {
  supportPhone: string;
  supportWhatsapp: string;
  supportEmail: string;
  supportAddress: string;
  /** Optional: older backends predate this field. */
  versionControl?: VersionControlSettings;
  /** Optional: absent means every flag uses its compiled default, never "off". */
  featureFlags?: FeatureFlagMap;
}

interface ConfigState extends PlatformConfig {
  loaded: boolean;
  /**
   * Flags from the Nexus version check, which can only force a flag OFF.
   *
   * Kept separate from `featureFlags` rather than merged, because the two layers
   * are not interchangeable — merging would let Nexus turn a flag on, which is
   * precisely the ambiguity the two-layer rule exists to avoid.
   */
  nexusFeatureFlags: FeatureFlagMap;
}

const initialState: ConfigState = {
  supportPhone,
  supportWhatsapp,
  supportEmail,
  supportAddress,
  nexusFeatureFlags: {},
  loaded: false,
};

export const fetchPlatformConfig = createAsyncThunk(
  'config/fetchPlatformConfig',
  async (_, { rejectWithValue }) => {
    try {
      const res = await apiClient.get<{ success: boolean; data: PlatformConfig }>(
        '/api/platform/config'
      );
      // Applied here rather than in the reducer: it writes to AsyncStorage and
      // re-inits the version-control client, neither of which belongs in a
      // reducer. Awaited so a later getDecision() in the same launch sees it.
      await applyRemoteConfig(res.data.data?.versionControl);
      return res.data.data;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch platform config');
    }
  }
);

const configSlice = createSlice({
  name: 'config',
  initialState,
  reducers: {
    /**
     * Store the flags carried by a Nexus version check.
     *
     * Dispatched from App.tsx once the decision resolves. Written even when empty
     * so a Nexus that stops sending flags releases whatever it had forced off,
     * rather than leaving a stale kill in place for the rest of the session.
     */
    setNexusFeatureFlags: (state, action: PayloadAction<FeatureFlagMap>) => {
      state.nexusFeatureFlags = action.payload;
    },
  },
  extraReducers: builder => {
    builder.addCase(fetchPlatformConfig.fulfilled, (state, action) => {
      const { supportPhone, supportWhatsapp, supportEmail, supportAddress } = action.payload;
      state.supportPhone = supportPhone;
      state.supportWhatsapp = supportWhatsapp;
      state.supportEmail = supportEmail;
      state.supportAddress = supportAddress;
      // Absent in the payload leaves this undefined, which the resolver reads as
      // "use compiled defaults" — not as "everything off".
      state.featureFlags = action.payload.featureFlags;
      state.loaded = true;
    });
  },
});

export const { setNexusFeatureFlags } = configSlice.actions;

export default configSlice.reducer;
