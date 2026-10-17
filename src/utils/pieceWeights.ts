/**
 * Weighing a line piece by piece.
 *
 * A line of more than one piece can be weighed one piece at a time, each with
 * its own weight, and the line's weight is their sum. The owner asked for it
 * (2026-10-17): a counter weighs and tags pieces separately, and a disputed
 * piece is answered from its own weight, not from a lot total.
 *
 * It is optional per line. A lot can still be weighed together (twenty-four
 * pairs of payal on the scale at once), and beyond MAX_PIECE_ROWS only the
 * total is offered: rows past that are slower to fill than one total, and a
 * hundred inputs on a phone is a screen that lags.
 *
 * The server recomputes the totals from the pieces it is sent
 * (order.model.ts), so the sums here are only the live preview.
 */

/** Above this many pieces, a line is weighed as one lot. */
export const MAX_PIECE_ROWS = 50;

/**
 * One piece as it is typed. `packet` is used on silver lines only.
 *
 * A gold piece carries its own purity, wastage and rate, because two pieces
 * on one line are not always alike (a 22K ring and an 18K one). Pieces that
 * agree on all three are saved as one line with their weights; a piece that
 * differs is saved as its own line, so each is priced by the same rules as
 * any other line and nothing in goldPricing changes.
 */
export interface PieceDraft {
  weight: string;
  packet: string;
  purity?: string;
  wastage?: string;
  rate?: string;
  /** Follows the live rate, as the line-level tick does. */
  useLiveRate?: boolean;
}

const num = (v: string) => Number(String(v ?? '').trim()) || 0;
const round3 = (n: number) => Number((Number(n) || 0).toFixed(3));

/** A new piece: no weight yet, the rest copied from `like` when given, so a
 *  line of identical pieces only needs its weights typed. */
export const blankPiece = (like?: PieceDraft): PieceDraft => ({
  weight: '',
  packet: '',
  ...(like
    ? { purity: like.purity, wastage: like.wastage, rate: like.rate, useLiveRate: like.useLiveRate }
    : {}),
});

/** The quantity as a whole number of pieces, at least 1. */
export const pieceCount = (quantity: string): number => {
  const n = Math.floor(Number(String(quantity ?? '').trim()));
  return Number.isFinite(n) && n >= 1 ? n : 1;
};

/** Whether a line of this quantity is weighed piece by piece. */
export const weighsEach = (quantity: string, together: boolean): boolean => {
  const n = pieceCount(quantity);
  return n > 1 && n <= MAX_PIECE_ROWS && !together;
};

/** The pieces grown or shrunk to `n`, keeping what was already typed. New
 *  rows copy the last existing one's purity, wastage and rate. */
export const resizePieces = (pieces: PieceDraft[], n: number): PieceDraft[] => {
  const like = pieces[pieces.length - 1];
  return Array.from({ length: n }, (_, i) => pieces[i] ?? blankPiece(like));
};

/** A gold line's weight: the pieces' weights, summed. */
export const goldTotal = (pieces: PieceDraft[]): number =>
  round3(pieces.reduce((s, p) => s + num(p.weight), 0));

/** A piece of silver's net: gross less packet, never below zero. */
export const silverPieceNet = (p: PieceDraft): number =>
  round3(Math.max(0, num(p.weight) - num(p.packet)));

/** A silver line's gross, packet and net, summed over its pieces. */
export const silverTotals = (pieces: PieceDraft[]) => ({
  gross: round3(pieces.reduce((s, p) => s + num(p.weight), 0)),
  packet: round3(pieces.reduce((s, p) => s + num(p.packet), 0)),
  net: round3(pieces.reduce((s, p) => s + silverPieceNet(p), 0)),
});

/** A figure for a field: '' for nothing, so an empty line stays empty. */
export const asField = (n: number): string => (n > 0 ? String(n) : '');
