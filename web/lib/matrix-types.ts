/**
 * Shape of the shift-partner matrix payload.
 *
 * Matches `reference/sample-data.json` and the algorithm in
 * `docs/matrix-algorithm.md`. This is what a future API route (reading the
 * live roster Google Sheet) needs to return.
 */
export interface MatrixData {
  /** Employee names, in original roster row order. */
  names: string[];
  /** matrix[i][j] = number of days i and j both had a worked shift (symmetric). */
  matrix: number[][];
  /** rowSums[i] = sum of matrix[i][*] — total overlap-days across all colleagues. */
  rowSums: number[];
  /** shifts[i] = total worked-shift count for names[i] this month (the "מש'" column). */
  shifts: number[];
  /** pairDays["i-j"] (i < j) = list of day-of-month numbers both people worked. */
  pairDays: Record<string, number[]>;
}
