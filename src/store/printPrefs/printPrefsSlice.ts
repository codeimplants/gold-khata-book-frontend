import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SavedPrinter } from '../../print/thermal/transport';
import { BILL_PAGE, DEFAULT_PAPER, MAX_CUSTOM_WIDTH_MM, PaperPrefs } from '../../constants/bill';

export type PrintMode = 'standard' | 'thermal';

export type PrintPrefsState = {
  mode: PrintMode;
  device: SavedPrinter | null;
  /** Whether the user has ever been asked how they print. Distinct from `mode`:
   * mode defaults to 'standard', so without this we could not tell "chose A4" from
   * "never asked", and the first-run chooser would either never show or show forever. */
  hasChosenPrinter: boolean;
  /** The sheet invoices are printed on. See PaperPrefs in constants/bill. */
  paper: PaperPrefs;
  hydrated: boolean;
};

const PRINT_PREFS_KEY = '@print_prefs_v1';

const initialState: PrintPrefsState = {
  mode: 'standard',
  device: null,
  hasChosenPrinter: false,
  paper: DEFAULT_PAPER,
  hydrated: false,
};

type PersistedPrintPrefs = Pick<
  PrintPrefsState,
  'mode' | 'device' | 'hasChosenPrinter' | 'paper'
>;

/** Devices saved before multi-transport support have no `transport` field — they were
 * all BLE. Tag them so the discriminated union stays valid instead of silently
 * failing to match any transport at print time. */
function migrateDevice(device: any): SavedPrinter | null {
  if (!device || typeof device.id !== 'string') return null;
  if (device.transport === 'ble' || device.transport === 'spp' || device.transport === 'tcp') {
    return device as SavedPrinter;
  }
  return device.characteristicUUID ? ({ ...device, transport: 'ble' } as SavedPrinter) : null;
}

/** Paper settings read back from storage.
 *
 * Every save made before this feature existed has no `paper` key at all, so the
 * absent case is the normal one rather than an error. Beyond that, these numbers
 * feed @page margins directly: an out-of-range sheet size, or a header reserve
 * taller than the sheet, produces a negative margin and a blank or clipped print.
 * Clamping here rather than at render time means one bad save cannot quietly
 * break every bill printed afterwards. */
function sanitisePaper(paper: any): PaperPrefs {
  if (!paper || typeof paper !== 'object') return DEFAULT_PAPER;

  const reserve = Number(paper.headerReserveMm);

  if (paper.mode !== 'custom') {
    // A4 plus a header reserve is the ordinary letterhead case, not an odd one:
    // most pre-printed stationery is plain A4 with the shop's details across the
    // top. The reserve therefore has to survive outside custom mode, or those
    // shops could only reach it by switching custom on and retyping 210 x 297.
    const headerReserveMm = reserve > 0 && reserve < BILL_PAGE.HEIGHT_MM ? reserve : 0;
    return { ...DEFAULT_PAPER, headerReserveMm };
  }

  const widthMm = Number(paper.widthMm);
  const heightMm = Number(paper.heightMm);
  if (!(widthMm > 0) || !(heightMm > 0)) return DEFAULT_PAPER;
  // Width is capped at Letter, not at A4 — see MAX_CUSTOM_WIDTH_MM. Height is
  // still A4's, because the page the content is placed on is A4 and a taller
  // sheet has nothing below 297mm to place anything on.
  if (widthMm > MAX_CUSTOM_WIDTH_MM || heightMm > BILL_PAGE.HEIGHT_MM) return DEFAULT_PAPER;

  const headerReserveMm = reserve > 0 && reserve < heightMm ? reserve : 0;
  const position =
    paper.position === 'left' || paper.position === 'right' ? paper.position : 'center';

  return { mode: 'custom', widthMm, heightMm, headerReserveMm, position };
}

export const hydratePrintPrefs = createAsyncThunk('printPrefs/hydrate', async () => {
  const raw = await AsyncStorage.getItem(PRINT_PREFS_KEY);
  if (!raw) return null as PersistedPrintPrefs | null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || !parsed) return null;
    const device = migrateDevice(parsed.device);
    return {
      mode: parsed.mode === 'thermal' ? 'thermal' : 'standard',
      device,
      // Anyone who already paired a printer before this flag existed has plainly
      // made a choice — don't ask them again on their next print.
      hasChosenPrinter: parsed.hasChosenPrinter === true || device != null,
      paper: sanitisePaper(parsed.paper),
    } as PersistedPrintPrefs;
  } catch {
    return null;
  }
});

const printPrefsSlice = createSlice({
  name: 'printPrefs',
  initialState,
  reducers: {
    setPrintMode(state, action: PayloadAction<PrintMode>) {
      state.mode = action.payload;
    },
    setThermalDevice(state, action: PayloadAction<SavedPrinter | null>) {
      state.device = action.payload;
    },
    /** Records that the first-run "how do you print?" question has been answered, so
     * it is never asked again. */
    markPrinterChosen(state) {
      state.hasChosenPrinter = true;
    },
    /** Saved as one object rather than a field at a time: width, height, header
     * reserve and position are only meaningful together, and a half-applied
     * change would print a bill positioned for a sheet the shop isn't using. */
    setPaperPrefs(state, action: PayloadAction<PaperPrefs>) {
      state.paper = sanitisePaper(action.payload);
    },
  },
  extraReducers: builder => {
    builder
      .addCase(hydratePrintPrefs.fulfilled, (state, action) => {
        state.hydrated = true;
        if (action.payload) {
          state.mode = action.payload.mode;
          state.device = action.payload.device;
          state.hasChosenPrinter = action.payload.hasChosenPrinter;
          state.paper = action.payload.paper;
        }
      })
      .addCase(hydratePrintPrefs.rejected, state => {
        state.hydrated = true;
      });
  },
});

export const { setPrintMode, setThermalDevice, markPrinterChosen, setPaperPrefs } =
  printPrefsSlice.actions;
export default printPrefsSlice.reducer;
export { PRINT_PREFS_KEY };
