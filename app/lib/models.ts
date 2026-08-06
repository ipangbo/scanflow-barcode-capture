export type BarcodeFormatId =
  | "code_128"
  | "ean_13"
  | "ean_8"
  | "upc_a"
  | "upc_e"
  | "code_39"
  | "code_93"
  | "itf"
  | "qr_code"
  | "data_matrix"
  | "pdf417"
  | "aztec"
  | "codabar";

export type ScannerMode = "university" | "universal" | "custom";
export type ScannerStatus = "idle" | "starting" | "scanning" | "error";
export type ScannerEngine = "native" | "zxing" | null;
export type ProjectDialogMode = "create" | "rename" | null;
export type ExportFormat = "txt" | "csv" | "json";

export type ScanProject = {
  id: string;
  name: string;
  createdAt: string;
};

export type ScanRecord = {
  id: string;
  projectId: string;
  value: string;
  format: string;
  scannedAt: string;
  scanCount: number;
  source: "camera" | "manual";
};

export type DetectionRegion = {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

export type PendingDecodedValue = {
  key: string;
  matches: number;
  lastSeenAt: number;
};

export type ScanCueKind = "verifying" | "saved" | "repeat" | "invalid";

export type ScanCue = {
  id: string;
  kind: ScanCueKind;
};

export type ScanFeedback = {
  eventId: string;
  record: ScanRecord;
};

export const DEFAULT_PROJECT_ID = "inbox";

export function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createDefaultProject(): ScanProject {
  return {
    id: DEFAULT_PROJECT_ID,
    name: "Inbox",
    createdAt: new Date().toISOString(),
  };
}

export function formatOrdinal(value: number) {
  const remainder100 = value % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${value}th`;
  return `${value}${value % 10 === 1 ? "st" : value % 10 === 2 ? "nd" : value % 10 === 3 ? "rd" : "th"}`;
}
