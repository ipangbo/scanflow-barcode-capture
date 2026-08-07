import type { BarcodeFormatId, ScannerMode } from "./models";

type BarcodeDefinition = {
  id: BarcodeFormatId;
  name: string;
  kind: "1D" | "2D";
  example: string;
  nativeFormat: string;
};

export const DUPLICATE_COOLDOWN_MS = 1800;
export const FRAME_INTERVAL_MS = 90;
export const DECODE_CONFIRMATION_WINDOW_MS = 700;
export const REQUIRED_DECODE_MATCHES = 2;

export const BARCODE_FORMATS: BarcodeDefinition[] = [
  { id: "code_128", name: "Code 128", kind: "1D", example: "12345678", nativeFormat: "code_128" },
  { id: "ean_13", name: "EAN-13", kind: "1D", example: "5901234123457", nativeFormat: "ean_13" },
  { id: "ean_8", name: "EAN-8", kind: "1D", example: "96385074", nativeFormat: "ean_8" },
  { id: "upc_a", name: "UPC-A", kind: "1D", example: "036000291452", nativeFormat: "upc_a" },
  { id: "upc_e", name: "UPC-E", kind: "1D", example: "01234565", nativeFormat: "upc_e" },
  { id: "code_39", name: "Code 39", kind: "1D", example: "STUDENT-2048", nativeFormat: "code_39" },
  { id: "code_93", name: "Code 93", kind: "1D", example: "CAMPUS93", nativeFormat: "code_93" },
  { id: "itf", name: "ITF", kind: "1D", example: "12345678901231", nativeFormat: "itf" },
  { id: "codabar", name: "Codabar", kind: "1D", example: "A123456789B", nativeFormat: "codabar" },
  { id: "qr_code", name: "QR Code", kind: "2D", example: "https://example.edu", nativeFormat: "qr_code" },
  { id: "data_matrix", name: "Data Matrix", kind: "2D", example: "ID:U12345678", nativeFormat: "data_matrix" },
  { id: "pdf417", name: "PDF417", kind: "2D", example: "STUDENT|U12345678", nativeFormat: "pdf417" },
  { id: "aztec", name: "Aztec", kind: "2D", example: "CAMPUS-PASS-2048", nativeFormat: "aztec" },
];

export const ALL_FORMAT_IDS = BARCODE_FORMATS.map((format) => format.id);
const UNIVERSITY_FORMAT_IDS: BarcodeFormatId[] = ["code_128"];

export const nativeFormatNames: Record<string, string> = {
  ean_13: "EAN_13",
  ean_8: "EAN_8",
  upc_a: "UPC_A",
  upc_e: "UPC_E",
  code_128: "CODE_128",
  code_39: "CODE_39",
  code_93: "CODE_93",
  itf: "ITF",
  qr_code: "QR_CODE",
  data_matrix: "DATA_MATRIX",
  pdf417: "PDF_417",
  aztec: "AZTEC",
  codabar: "CODABAR",
};

const formatNames: Record<string, string> = {
  AZTEC: "AZTEC",
  CODABAR: "CODABAR",
  CODE_39: "CODE 39",
  CODE_93: "CODE 93",
  CODE_128: "CODE 128",
  DATA_MATRIX: "DATA MATRIX",
  EAN_8: "EAN-8",
  EAN_13: "EAN-13",
  ITF: "ITF",
  MAXICODE: "MAXICODE",
  PDF_417: "PDF417",
  QR_CODE: "QR CODE",
  RSS_14: "RSS-14",
  RSS_EXPANDED: "RSS EXPANDED",
  UPC_A: "UPC-A",
  UPC_E: "UPC-E",
  UPC_EAN_EXTENSION: "UPC/EAN EXT",
  MANUAL: "MANUAL ENTRY",
};

export function normalizeFormat(format: string) {
  return formatNames[format] ?? format.replaceAll("_", " ");
}

export function getEnabledFormatIds(
  mode: ScannerMode,
  customFormats: BarcodeFormatId[],
) {
  if (mode === "university") return UNIVERSITY_FORMAT_IDS;
  if (mode === "universal") return ALL_FORMAT_IDS;
  return customFormats.length ? customFormats : UNIVERSITY_FORMAT_IDS;
}

export function getScannerModeLabel(mode: ScannerMode, customCount: number) {
  if (mode === "university") return "University ID";
  if (mode === "custom") return `Custom · ${customCount}`;
  return "Universal";
}
