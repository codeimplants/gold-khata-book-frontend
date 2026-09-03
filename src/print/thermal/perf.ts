import { APP_ENV } from '../../config';

/**
 * Stage timing for a thermal print.
 *
 * Rasterised (Devanagari/Gujarati) receipts are far slower than text ones and the cost
 * is split across capture, PNG decode, thresholding and the Bluetooth transfer — which
 * of those dominates is not obvious from the outside, and optimising the wrong one
 * wastes effort. This makes the split visible on a real phone with a real printer,
 * where it actually matters.
 *
 * Deliberately reported in-app rather than via console.log: release builds strip
 * console output (see CLAUDE.md), which is exactly the build being tested.
 */
export class PrintTimer {
  private marks: { label: string; ms: number }[] = [];
  private last = Date.now();
  private started = Date.now();
  private notes: string[] = [];

  /** Records elapsed time since the previous mark. */
  mark(label: string): void {
    const now = Date.now();
    this.marks.push({ label, ms: now - this.last });
    this.last = now;
  }

  /** Non-timing context worth seeing next to the timings (sizes, dimensions). */
  note(text: string): void {
    this.notes.push(text);
  }

  get totalMs(): number {
    return Date.now() - this.started;
  }

  summary(): string {
    const rows = this.marks.map(m => `${m.label.padEnd(14)} ${String(m.ms).padStart(6)} ms`);
    return [
      ...this.notes,
      '',
      ...rows,
      '─'.repeat(24),
      `${'TOTAL'.padEnd(14)} ${String(this.totalMs).padStart(6)} ms`,
    ].join('\n');
  }
}

/** Diagnostics are shown in dev/preprod test builds only — never to a real shop. */
export const printDiagnosticsEnabled = (): boolean => APP_ENV !== 'prod';
