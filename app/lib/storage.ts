import { ALL_FORMAT_IDS } from "./barcodes";
import {
  createDefaultProject,
  type BarcodeFormatId,
  type ScanProject,
  type ScanRecord,
  type ScannerEnginePreference,
  type ScannerMode,
} from "./models";

const STORAGE_KEY = "liansao.scans.v1";
const SETTINGS_KEY = "liansao.settings.v1";
const PROJECTS_KEY = "scanflow.projects.v1";

type StoredSettings = {
  sound?: boolean;
  vibration?: boolean;
  activeProjectId?: string;
  scanMode?: ScannerMode;
  scanModeConfigured?: boolean;
  customFormats?: string[];
  recognitionEngine?: string;
  recognitionEngineConfigured?: boolean;
};

export type StoredAppState = {
  projects: ScanProject[];
  records: ScanRecord[];
  activeProjectId: string;
  sound: boolean;
  vibration: boolean;
  scanMode: ScannerMode;
  scanModeConfigured: boolean;
  customFormats: BarcodeFormatId[];
  recognitionEngine: ScannerEnginePreference;
  recognitionEngineConfigured: boolean;
};

function readProjects(storage: Storage) {
  const fallback = [createDefaultProject()];
  const value = storage.getItem(PROJECTS_KEY);
  if (!value) return fallback;

  const parsed = JSON.parse(value) as ScanProject[];
  if (!Array.isArray(parsed)) return fallback;
  const valid = parsed.filter(
    (project) =>
      project &&
      typeof project.id === "string" &&
      typeof project.name === "string" &&
      project.name.trim(),
  );
  return valid.length ? valid : fallback;
}

function readRecords(storage: Storage, projects: ScanProject[]) {
  const value = storage.getItem(STORAGE_KEY);
  if (!value) return [];

  const validProjectIds = new Set(projects.map((project) => project.id));
  const fallbackProjectId = projects[0].id;
  const parsed = JSON.parse(value) as Array<Partial<ScanRecord>>;
  if (!Array.isArray(parsed)) return [];

  const migrated = parsed
    .filter(
      (record) =>
        record &&
        typeof record.id === "string" &&
        typeof record.value === "string" &&
        typeof record.format === "string" &&
        typeof record.scannedAt === "string" &&
        (record.source === "camera" || record.source === "manual"),
    )
    .map((record) => ({
      ...record,
      projectId:
        typeof record.projectId === "string" && validProjectIds.has(record.projectId)
          ? record.projectId
          : fallbackProjectId,
      scanCount:
        typeof record.scanCount === "number" && record.scanCount > 0
          ? Math.floor(record.scanCount)
          : 1,
    })) as ScanRecord[];

  const consolidated = new Map<string, ScanRecord>();
  for (const record of migrated) {
    const key = JSON.stringify([record.projectId, record.value]);
    const existing = consolidated.get(key);
    if (existing) {
      existing.scanCount += record.scanCount;
    } else {
      consolidated.set(key, { ...record });
    }
  }
  return [...consolidated.values()];
}

export function readStoredAppState(storage: Storage): StoredAppState {
  const projects = readProjects(storage);
  const records = readRecords(storage, projects);
  const validProjectIds = new Set(projects.map((project) => project.id));
  const fallbackProjectId = projects[0].id;
  const value = storage.getItem(SETTINGS_KEY);
  const settings = value ? JSON.parse(value) as StoredSettings : {};
  const hasExplicitScanMode =
    settings.scanModeConfigured === true ||
    settings.scanMode === "university" ||
    settings.scanMode === "custom";
  const scanMode =
    hasExplicitScanMode &&
    (settings.scanMode === "university" ||
      settings.scanMode === "universal" ||
      settings.scanMode === "custom")
      ? settings.scanMode
      : "university";
  const customFormats = Array.isArray(settings.customFormats)
    ? settings.customFormats.filter(
        (format): format is BarcodeFormatId =>
          ALL_FORMAT_IDS.includes(format as BarcodeFormatId),
      )
    : [];
  const hasExplicitRecognitionEngine =
    settings.recognitionEngineConfigured === true &&
    (settings.recognitionEngine === "native" || settings.recognitionEngine === "zxing");

  return {
    projects,
    records,
    activeProjectId:
      typeof settings.activeProjectId === "string" &&
      validProjectIds.has(settings.activeProjectId)
        ? settings.activeProjectId
        : fallbackProjectId,
    sound: settings.sound ?? true,
    vibration: settings.vibration ?? true,
    scanMode,
    scanModeConfigured: hasExplicitScanMode,
    customFormats: customFormats.length ? customFormats : [...ALL_FORMAT_IDS],
    recognitionEngine: hasExplicitRecognitionEngine ? settings.recognitionEngine : "zxing",
    recognitionEngineConfigured: hasExplicitRecognitionEngine,
  };
}

export function writeStoredSettings(
  storage: Storage,
  settings: {
    sound: boolean;
    vibration: boolean;
    activeProjectId: string;
    scanMode: ScannerMode;
    scanModeConfigured: boolean;
    customFormats: BarcodeFormatId[];
    recognitionEngine: ScannerEnginePreference;
    recognitionEngineConfigured: boolean;
  },
) {
  storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function writeStoredRecords(storage: Storage, records: ScanRecord[]) {
  storage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function writeStoredProjects(storage: Storage, projects: ScanProject[]) {
  storage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}
