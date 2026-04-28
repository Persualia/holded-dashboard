/**
 * Blob keys are stable so uploads overwrite the same object every time.
 * `data.xlsx` is the original spreadsheet (kept for re-download / debugging).
 * `data.json` is the parsed dataset cache the frontend actually reads.
 */
export const BLOB_DATASET_KEY = 'data.json';
export const BLOB_XLSX_KEY = 'data.xlsx';
