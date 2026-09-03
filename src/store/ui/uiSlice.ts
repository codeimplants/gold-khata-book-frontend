import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  isGlobalLoading: boolean;
  loadingMessage?: string;
  mutationCount: number; // To track multiple overlapping mutation requests
}

const initialState: UIState = {
  isGlobalLoading: false,
  loadingMessage: 'Please wait...',
  mutationCount: 0,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    startGlobalLoading: (state, action: PayloadAction<string | undefined>) => {
      state.mutationCount += 1;
      state.isGlobalLoading = true;
      if (action.payload) {
        state.loadingMessage = action.payload;
      }
    },
    stopGlobalLoading: (state) => {
      state.mutationCount = Math.max(0, state.mutationCount - 1);
      if (state.mutationCount === 0) {
        state.isGlobalLoading = false;
        state.loadingMessage = 'Please wait...';
      }
    },
    resetGlobalLoading: (state) => {
      state.mutationCount = 0;
      state.isGlobalLoading = false;
      state.loadingMessage = 'Please wait...';
    },
  },
});

export const { startGlobalLoading, stopGlobalLoading, resetGlobalLoading } = uiSlice.actions;

export default uiSlice.reducer;
