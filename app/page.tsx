"use client";

import {
  BarcodeFormat,
  BrowserMultiFormatReader,
} from "@zxing/browser";
import { DecodeHintType } from "@zxing/library";
import {
  ArrowLeft,
  Braces,
  Camera,
  Check,
  ChevronDown,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Focus,
  GraduationCap,
  Keyboard,
  Lightbulb,
  LightbulbOff,
  Mail,
  Pencil,
  Plus,
  Repeat2,
  ScanLine,
  ScanSearch,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
} from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BUILD_NUMBER } from "./build-version";

const STORAGE_KEY = "liansao.scans.v1";
const SETTINGS_KEY = "liansao.settings.v1";
const PROJECTS_KEY = "scanflow.projects.v1";
const DEFAULT_PROJECT_ID = "inbox";
const DUPLICATE_COOLDOWN_MS = 1800;
const FRAME_INTERVAL_MS = 90;

type BarcodeFormatId =
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
type ScannerMode = "university" | "universal" | "custom";

type BarcodeDefinition = {
  id: BarcodeFormatId;
  name: string;
  kind: "1D" | "2D";
  example: string;
  nativeFormat: string;
  zxingFormat: BarcodeFormat;
};

const BARCODE_FORMATS: BarcodeDefinition[] = [
  { id: "code_128", name: "Code 128", kind: "1D", example: "U12345678", nativeFormat: "code_128", zxingFormat: BarcodeFormat.CODE_128 },
  { id: "ean_13", name: "EAN-13", kind: "1D", example: "5901234123457", nativeFormat: "ean_13", zxingFormat: BarcodeFormat.EAN_13 },
  { id: "ean_8", name: "EAN-8", kind: "1D", example: "96385074", nativeFormat: "ean_8", zxingFormat: BarcodeFormat.EAN_8 },
  { id: "upc_a", name: "UPC-A", kind: "1D", example: "036000291452", nativeFormat: "upc_a", zxingFormat: BarcodeFormat.UPC_A },
  { id: "upc_e", name: "UPC-E", kind: "1D", example: "01234565", nativeFormat: "upc_e", zxingFormat: BarcodeFormat.UPC_E },
  { id: "code_39", name: "Code 39", kind: "1D", example: "STUDENT-2048", nativeFormat: "code_39", zxingFormat: BarcodeFormat.CODE_39 },
  { id: "code_93", name: "Code 93", kind: "1D", example: "CAMPUS93", nativeFormat: "code_93", zxingFormat: BarcodeFormat.CODE_93 },
  { id: "itf", name: "ITF", kind: "1D", example: "12345678901231", nativeFormat: "itf", zxingFormat: BarcodeFormat.ITF },
  { id: "codabar", name: "Codabar", kind: "1D", example: "A123456789B", nativeFormat: "codabar", zxingFormat: BarcodeFormat.CODABAR },
  { id: "qr_code", name: "QR Code", kind: "2D", example: "https://example.edu", nativeFormat: "qr_code", zxingFormat: BarcodeFormat.QR_CODE },
  { id: "data_matrix", name: "Data Matrix", kind: "2D", example: "ID:U12345678", nativeFormat: "data_matrix", zxingFormat: BarcodeFormat.DATA_MATRIX },
  { id: "pdf417", name: "PDF417", kind: "2D", example: "STUDENT|U12345678", nativeFormat: "pdf417", zxingFormat: BarcodeFormat.PDF_417 },
  { id: "aztec", name: "Aztec", kind: "2D", example: "CAMPUS-PASS-2048", nativeFormat: "aztec", zxingFormat: BarcodeFormat.AZTEC },
];

const ALL_FORMAT_IDS = BARCODE_FORMATS.map((format) => format.id);
const UNIVERSITY_FORMAT_IDS: BarcodeFormatId[] = ["code_128"];

const nativeFormatNames: Record<string, string> = {
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

type BarcodePoint = { x: number; y: number };
type DetectedBarcode = {
  rawValue: string;
  format: string;
  boundingBox?: DOMRectReadOnly;
  cornerPoints?: BarcodePoint[];
};
type NativeBarcodeDetector = {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
};
type NativeBarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): NativeBarcodeDetector;
  getSupportedFormats: () => Promise<string[]>;
};
type CameraCapabilities = MediaTrackCapabilities & {
  focusMode?: string[];
  torch?: boolean;
  zoom?: { min: number; max: number; step: number };
};
type AdvancedCameraConstraint = MediaTrackConstraintSet & {
  focusMode?: string;
  torch?: boolean;
  zoom?: number;
};

type ScannerStatus = "idle" | "starting" | "scanning" | "error";
type ScannerEngine = "native" | "zxing" | null;
type ProjectDialogMode = "create" | "rename" | null;
type ExportFormat = "txt" | "csv" | "json";

type ScanProject = {
  id: string;
  name: string;
  createdAt: string;
};

type ScanRecord = {
  id: string;
  projectId: string;
  value: string;
  format: string;
  scannedAt: string;
  scanCount: number;
  source: "camera" | "manual";
};

type DetectionRegion = {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
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

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDefaultProject(): ScanProject {
  return {
    id: DEFAULT_PROJECT_ID,
    name: "Inbox",
    createdAt: new Date().toISOString(),
  };
}

function safeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";
}

function formatOrdinal(value: number) {
  const remainder100 = value % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${value}th`;
  return `${value}${value % 10 === 1 ? "st" : value % 10 === 2 ? "nd" : value % 10 === 3 ? "rd" : "th"}`;
}

function normalizeFormat(format: string) {
  return formatNames[format] ?? format.replaceAll("_", " ");
}

function getEnabledFormatIds(mode: ScannerMode, customFormats: BarcodeFormatId[]) {
  if (mode === "university") return UNIVERSITY_FORMAT_IDS;
  if (mode === "universal") return ALL_FORMAT_IDS;
  return customFormats.length ? customFormats : UNIVERSITY_FORMAT_IDS;
}

function getScannerModeLabel(mode: ScannerMode, customCount: number) {
  if (mode === "university") return "University ID";
  if (mode === "custom") return `Custom · ${customCount}`;
  return "Universal";
}

function createHighAccuracyReader(formatIds: BarcodeFormatId[]) {
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(
    DecodeHintType.POSSIBLE_FORMATS,
    BARCODE_FORMATS.filter((format) => formatIds.includes(format.id)).map(
      (format) => format.zxingFormat,
    ),
  );
  hints.set(DecodeHintType.TRY_HARDER, true);
  hints.set(DecodeHintType.ASSUME_GS1, true);
  return new BrowserMultiFormatReader(hints, {
    delayBetweenScanAttempts: FRAME_INTERVAL_MS,
    delayBetweenScanSuccess: 220,
  });
}

function triggerIOSSwitchHaptic() {
  const id = `scanflow-haptic-${createId()}`;
  const input = document.createElement("input");
  const label = document.createElement("label");
  input.type = "checkbox";
  input.id = id;
  input.setAttribute("switch", "");
  input.setAttribute("aria-hidden", "true");
  input.tabIndex = -1;
  input.style.cssText = "position:fixed;left:-100px;top:-100px;width:1px;height:1px;opacity:0;pointer-events:none";
  label.htmlFor = id;
  label.setAttribute("aria-hidden", "true");
  label.style.cssText = "position:fixed;left:-100px;top:-100px;width:1px;height:1px;opacity:0;pointer-events:none";
  document.body.append(input, label);
  label.click();
  window.setTimeout(() => {
    label.remove();
    input.remove();
  }, 80);
}

function downloadBlob(content: string, type: string, filename: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function safeCsvCell(value: string) {
  const protectedValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${protectedValue.replaceAll('"', '""')}"`;
}

function friendlyCameraError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Camera access is blocked. Allow it in your browser settings.";
    }
    if (error.name === "NotFoundError") {
      return "No camera was found. You can still use manual entry below.";
    }
    if (error.name === "NotReadableError") {
      return "The camera is in use by another app. Close it and try again.";
    }
  }
  return "We couldn’t start the camera. Check permissions or try another browser.";
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const detectionTimerRef = useRef<number | null>(null);
  const scanningRef = useRef(false);
  const recentScansRef = useRef(new Map<string, number>());
  const feedbackRef = useRef({ sound: true, vibration: true });
  const activeProjectIdRef = useRef(DEFAULT_PROJECT_ID);
  const recordsRef = useRef<ScanRecord[]>([]);

  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [projects, setProjects] = useState<ScanProject[]>(() => [createDefaultProject()]);
  const [activeProjectId, setActiveProjectId] = useState(DEFAULT_PROJECT_ID);
  const [projectDialog, setProjectDialog] = useState<ProjectDialogMode>(null);
  const [projectName, setProjectName] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [scanMode, setScanMode] = useState<ScannerMode>("university");
  const [scanModeConfigured, setScanModeConfigured] = useState(false);
  const [customFormats, setCustomFormats] = useState<BarcodeFormatId[]>(() => [
    ...ALL_FORMAT_IDS,
  ]);
  const [draftScanMode, setDraftScanMode] = useState<ScannerMode>("university");
  const [draftCustomFormats, setDraftCustomFormats] = useState<BarcodeFormatId[]>(() => [
    ...ALL_FORMAT_IDS,
  ]);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [cameraError, setCameraError] = useState("");
  const [query, setQuery] = useState("");
  const [manualValue, setManualValue] = useState("");
  const [lastScan, setLastScan] = useState<ScanRecord | null>(null);
  const [detectionRegion, setDetectionRegion] = useState<DetectionRegion | null>(null);
  const [toast, setToast] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [vibrationOn, setVibrationOn] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [engine, setEngine] = useState<ScannerEngine>(null);
  const [zoom, setZoom] = useState(1);
  const [zoomRange, setZoomRange] = useState<{
    min: number;
    max: number;
    step: number;
  } | null>(null);

  useEffect(() => {
    try {
      let nextProjects = [createDefaultProject()];
      const storedProjects = window.localStorage.getItem(PROJECTS_KEY);
      if (storedProjects) {
        const parsedProjects = JSON.parse(storedProjects) as ScanProject[];
        const validProjects = Array.isArray(parsedProjects)
          ? parsedProjects.filter(
              (project) =>
                project &&
                typeof project.id === "string" &&
                typeof project.name === "string" &&
                project.name.trim(),
            )
          : [];
        if (validProjects.length) nextProjects = validProjects;
      }
      // Browser storage is intentionally hydrated after mount to keep the server render stable.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProjects(nextProjects);

      const validProjectIds = new Set(nextProjects.map((project) => project.id));
      const fallbackProjectId = nextProjects[0].id;
      const storedRecords = window.localStorage.getItem(STORAGE_KEY);
      if (storedRecords) {
        const parsed = JSON.parse(storedRecords) as Array<Partial<ScanRecord>>;
        if (Array.isArray(parsed)) {
          const migratedRecords = parsed
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
          const consolidatedRecords = new Map<string, ScanRecord>();
          for (const record of migratedRecords) {
            const key = JSON.stringify([record.projectId, record.value]);
            const existing = consolidatedRecords.get(key);
            if (existing) {
              existing.scanCount += record.scanCount;
            } else {
              consolidatedRecords.set(key, { ...record });
            }
          }
          const nextRecords = [...consolidatedRecords.values()];
          recordsRef.current = nextRecords;
          setRecords(nextRecords);
        }
      }

      let nextActiveProjectId = fallbackProjectId;
      const storedSettings = window.localStorage.getItem(SETTINGS_KEY);
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings) as {
          sound?: boolean;
          vibration?: boolean;
          activeProjectId?: string;
          scanMode?: ScannerMode;
          scanModeConfigured?: boolean;
          customFormats?: string[];
        };
        setSoundOn(parsed.sound ?? true);
        setVibrationOn(parsed.vibration ?? true);
        const hasExplicitScanMode =
          parsed.scanModeConfigured === true ||
          parsed.scanMode === "university" ||
          parsed.scanMode === "custom";
        if (
          hasExplicitScanMode &&
          (parsed.scanMode === "university" ||
            parsed.scanMode === "universal" ||
            parsed.scanMode === "custom")
        ) {
          setScanMode(parsed.scanMode);
        }
        setScanModeConfigured(hasExplicitScanMode);
        if (Array.isArray(parsed.customFormats)) {
          const validCustomFormats = parsed.customFormats.filter(
            (format): format is BarcodeFormatId =>
              ALL_FORMAT_IDS.includes(format as BarcodeFormatId),
          );
          if (validCustomFormats.length) setCustomFormats(validCustomFormats);
        }
        if (
          typeof parsed.activeProjectId === "string" &&
          validProjectIds.has(parsed.activeProjectId)
        ) {
          nextActiveProjectId = parsed.activeProjectId;
        }
      }
      activeProjectIdRef.current = nextActiveProjectId;
      setActiveProjectId(nextActiveProjectId);
    } catch {
      setToast("Stored scans couldn’t be read. A fresh list has been created.");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    feedbackRef.current = { sound: soundOn, vibration: vibrationOn };
    activeProjectIdRef.current = activeProjectId;
    if (hydrated) {
      window.localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
          sound: soundOn,
          vibration: vibrationOn,
          activeProjectId,
          scanMode,
          scanModeConfigured,
          customFormats,
        }),
      );
    }
  }, [
    soundOn,
    vibrationOn,
    activeProjectId,
    scanMode,
    scanModeConfigured,
    customFormats,
    hydrated,
  ]);

  useEffect(() => {
    recordsRef.current = records;
    if (hydrated) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    }
  }, [records, hydrated]);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    }
  }, [projects, hydrated]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const playFeedback = useCallback(() => {
    if (feedbackRef.current.vibration) {
      let vibrated = false;
      if ("vibrate" in navigator) {
        vibrated = navigator.vibrate(55);
      }
      if (!vibrated) triggerIOSSwitchHaptic();
    }

    if (feedbackRef.current.sound) {
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as typeof window & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioContextClass) return;
        const context = new AudioContextClass();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, context.currentTime);
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.12);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.13);
        oscillator.addEventListener("ended", () => void context.close());
      } catch {
        // Audio feedback is optional and can be blocked by browser policy.
      }
    }
  }, []);

  const addRecord = useCallback(
    (value: string, format: string, source: ScanRecord["source"]) => {
      const trimmedValue = value.trim();
      if (!trimmedValue) return;

      const projectId = activeProjectIdRef.current;
      const currentRecords = recordsRef.current;
      const existing = currentRecords.find(
        (record) => record.projectId === projectId && record.value === trimmedValue,
      );
      const record: ScanRecord = existing
        ? {
            ...existing,
            format,
            scannedAt: new Date().toISOString(),
            scanCount: existing.scanCount + 1,
            source,
          }
        : {
            id: createId(),
            projectId,
            value: trimmedValue,
            format,
            scannedAt: new Date().toISOString(),
            scanCount: 1,
            source,
          };
      const nextRecords = [
        record,
        ...currentRecords.filter((item) => item.id !== record.id),
      ];

      recordsRef.current = nextRecords;
      setRecords(nextRecords);
      setLastScan(record);
      playFeedback();
      window.setTimeout(
        () => setLastScan((current) => (current?.id === record.id ? null : current)),
        1500,
      );
    },
    [playFeedback],
  );

  const acceptDecodedValue = useCallback(
    (value: string, format: string) => {
      const now = Date.now();
      const previous = recentScansRef.current.get(value) ?? 0;
      if (now - previous < DUPLICATE_COOLDOWN_MS) return false;

      recentScansRef.current.set(value, now);
      for (const [key, timestamp] of recentScansRef.current) {
        if (now - timestamp > 10_000) recentScansRef.current.delete(key);
      }

      addRecord(value, format, "camera");
      return true;
    },
    [addRecord],
  );

  const stopScanner = useCallback(() => {
    scanningRef.current = false;
    if (scanTimerRef.current !== null) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (detectionTimerRef.current !== null) {
      window.clearTimeout(detectionTimerRef.current);
      detectionTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    readerRef.current = null;
    setTorchOn(false);
    setTorchAvailable(false);
    setZoomRange(null);
    setEngine(null);
    setDetectionRegion(null);
    setStatus("idle");
  }, []);

  const openScannerSettings = () => {
    setDraftScanMode(scanMode);
    setDraftCustomFormats([...customFormats]);
    setSettingsOpen(true);
  };

  const toggleDraftFormat = (formatId: BarcodeFormatId) => {
    setDraftCustomFormats((current) =>
      current.includes(formatId)
        ? current.filter((item) => item !== formatId)
        : [...current, formatId],
    );
  };

  const saveScannerSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (draftScanMode === "custom" && draftCustomFormats.length === 0) {
      setToast("Choose at least one barcode format.");
      return;
    }

    const wasScanning = scanningRef.current;
    if (wasScanning) stopScanner();
    setScanMode(draftScanMode);
    setScanModeConfigured(true);
    setCustomFormats([...draftCustomFormats]);
    setSettingsOpen(false);
    setToast(
      wasScanning
        ? "Scanning mode saved. Restart the scanner to apply it."
        : "Scanning mode saved.",
    );
  };

  useEffect(
    () => () => {
      scanningRef.current = false;
      if (scanTimerRef.current !== null) window.clearTimeout(scanTimerRef.current);
      if (detectionTimerRef.current !== null) {
        window.clearTimeout(detectionTimerRef.current);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const startScanner = useCallback(async () => {
    if (status === "starting" || status === "scanning") return;

    const enabledFormatIds = getEnabledFormatIds(scanMode, customFormats);
    const requestedNativeFormats = BARCODE_FORMATS.filter((format) =>
      enabledFormatIds.includes(format.id),
    ).map((format) => format.nativeFormat);

    setCameraError("");
    setStatus("starting");

    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      setCameraError("Camera access requires a secure connection. Use the published site.");
      setStatus("error");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) throw new Error("Video preview is unavailable");
      video.srcObject = stream;
      await video.play();

      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error("Camera track is unavailable");

      try {
        const capabilities = track.getCapabilities() as CameraCapabilities;
        const focusMode = capabilities.focusMode?.includes("continuous")
          ? "continuous"
          : capabilities.focusMode?.includes("single-shot")
            ? "single-shot"
            : null;

        if (focusMode) {
          await track.applyConstraints({
            advanced: [{ focusMode } as AdvancedCameraConstraint],
          });
        }

        setTorchAvailable(capabilities.torch === true);
        if (capabilities.zoom && capabilities.zoom.max > capabilities.zoom.min) {
          const currentZoom = track.getSettings().zoom ?? capabilities.zoom.min;
          setZoom(currentZoom);
          setZoomRange(capabilities.zoom);
        } else {
          setZoomRange(null);
        }
      } catch {
        setTorchAvailable(false);
        setZoomRange(null);
      }

      let detector: NativeBarcodeDetector | null = null;
      let reader: BrowserMultiFormatReader | null = null;
      const Detector = (
        window as typeof window & {
          BarcodeDetector?: NativeBarcodeDetectorConstructor;
        }
      ).BarcodeDetector;

      if (Detector?.getSupportedFormats) {
        try {
          const supportedFormats = await Detector.getSupportedFormats();
          const preferredFormats = requestedNativeFormats.filter((format) =>
            supportedFormats.includes(format),
          );
          if (preferredFormats.length) {
            detector = new Detector({ formats: [...preferredFormats] });
          }
        } catch {
          detector = null;
        }
      }

      if (!detector) {
        reader = createHighAccuracyReader(enabledFormatIds);
        readerRef.current = reader;
      }

      setEngine(detector ? "native" : "zxing");
      scanningRef.current = true;
      setStatus("scanning");

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Scanner canvas is unavailable");
      let nativeErrors = 0;

      const scanFrame = async () => {
        if (!scanningRef.current) return;

        try {
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            const sourceWidth = video.videoWidth;
            const sourceHeight = video.videoHeight;
            const videoRect = video.getBoundingClientRect();
            const frameRect = frameRef.current?.getBoundingClientRect();

            if (sourceWidth && sourceHeight && videoRect.width && videoRect.height) {
              const objectFitScale = Math.max(
                videoRect.width / sourceWidth,
                videoRect.height / sourceHeight,
              );
              const overflowX = (sourceWidth * objectFitScale - videoRect.width) / 2;
              const overflowY = (sourceHeight * objectFitScale - videoRect.height) / 2;

              const sourceX = frameRect
                ? Math.max(0, (frameRect.left - videoRect.left + overflowX) / objectFitScale)
                : 0;
              const sourceY = frameRect
                ? Math.max(0, (frameRect.top - videoRect.top + overflowY) / objectFitScale)
                : 0;
              const cropWidth = frameRect
                ? Math.min(sourceWidth - sourceX, frameRect.width / objectFitScale)
                : sourceWidth;
              const cropHeight = frameRect
                ? Math.min(sourceHeight - sourceY, frameRect.height / objectFitScale)
                : sourceHeight;
              const outputScale = Math.min(1, 1600 / cropWidth);

              const outputWidth = Math.max(1, Math.round(cropWidth * outputScale));
              const outputHeight = Math.max(1, Math.round(cropHeight * outputScale));
              if (canvas.width !== outputWidth) canvas.width = outputWidth;
              if (canvas.height !== outputHeight) canvas.height = outputHeight;
              context.drawImage(
                video,
                sourceX,
                sourceY,
                cropWidth,
                cropHeight,
                0,
                0,
                canvas.width,
                canvas.height,
              );

              const revealDetectionRegion = (points: BarcodePoint[]) => {
                if (!frameRect || points.length === 0) return;

                const scaleX = frameRect.width / canvas.width;
                const scaleY = frameRect.height / canvas.height;
                const xValues = points.map((point) => point.x);
                const yValues = points.map((point) => point.y);
                const centerX = (Math.min(...xValues) + Math.max(...xValues)) / 2;
                const centerY = (Math.min(...yValues) + Math.max(...yValues)) / 2;
                const detectedWidth = Math.max(
                  (Math.max(...xValues) - Math.min(...xValues)) * scaleX,
                  frameRect.width * 0.14,
                );
                const detectedHeight = Math.max(
                  (Math.max(...yValues) - Math.min(...yValues)) * scaleY,
                  frameRect.height * 0.2,
                );
                const padding = 7;
                const desiredLeft =
                  frameRect.left - videoRect.left + centerX * scaleX - detectedWidth / 2 - padding;
                const desiredTop =
                  frameRect.top - videoRect.top + centerY * scaleY - detectedHeight / 2 - padding;
                const left = Math.max(6, desiredLeft);
                const top = Math.max(6, desiredTop);
                const width = Math.max(
                  36,
                  Math.min(detectedWidth + padding * 2, videoRect.width - left - 6),
                );
                const height = Math.max(
                  32,
                  Math.min(detectedHeight + padding * 2, videoRect.height - top - 6),
                );

                setDetectionRegion({ id: createId(), left, top, width, height });
                if (detectionTimerRef.current !== null) {
                  window.clearTimeout(detectionTimerRef.current);
                }
                detectionTimerRef.current = window.setTimeout(() => {
                  setDetectionRegion(null);
                  detectionTimerRef.current = null;
                }, 1050);
              };

              if (detector) {
                try {
                  const results = await detector.detect(canvas);
                  const result = results[0];
                  if (result?.rawValue) {
                    const accepted = acceptDecodedValue(
                      result.rawValue,
                      nativeFormatNames[result.format] ?? result.format.toUpperCase(),
                    );
                    if (accepted) {
                      const points = result.cornerPoints?.length
                        ? result.cornerPoints
                        : result.boundingBox
                          ? [
                              { x: result.boundingBox.left, y: result.boundingBox.top },
                              { x: result.boundingBox.right, y: result.boundingBox.bottom },
                            ]
                          : [];
                      revealDetectionRegion(points);
                    }
                  }
                  nativeErrors = 0;
                } catch {
                  nativeErrors += 1;
                  if (nativeErrors >= 2) {
                    detector = null;
                    reader = createHighAccuracyReader(enabledFormatIds);
                    readerRef.current = reader;
                    setEngine("zxing");
                  }
                }
              } else if (reader) {
                try {
                  const result = reader.decodeFromCanvas(canvas);
                  const accepted = acceptDecodedValue(
                    result.getText(),
                    BarcodeFormat[result.getBarcodeFormat()] ?? "UNKNOWN",
                  );
                  if (accepted) {
                    revealDetectionRegion(
                      (result.getResultPoints() ?? []).map((point) => ({
                        x: point.getX(),
                        y: point.getY(),
                      })),
                    );
                  }
                } catch {
                  // A frame without a readable barcode is expected during scanning.
                }
              }
            }
          }
        } finally {
          if (scanningRef.current) {
            scanTimerRef.current = window.setTimeout(scanFrame, FRAME_INTERVAL_MS);
          }
        }
      };

      void scanFrame();
    } catch (error) {
      scanningRef.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setDetectionRegion(null);
      setCameraError(friendlyCameraError(error));
      setStatus("error");
    }
  }, [acceptDecodedValue, customFormats, scanMode, status]);

  const toggleTorch = async () => {
    const next = !torchOn;
    try {
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track) return;
      await track.applyConstraints({
        advanced: [{ torch: next } as AdvancedCameraConstraint],
      });
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
      setToast("This device doesn’t support web torch controls.");
    }
  };

  const changeZoom = async (value: number) => {
    setZoom(value);
    try {
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track) return;
      await track.applyConstraints({
        advanced: [{ zoom: value } as AdvancedCameraConstraint],
      });
    } catch {
      setToast("Camera zoom could not be changed on this device.");
    }
  };

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? projects[0],
    [activeProjectId, projects],
  );

  const projectEntryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const record of records) {
      counts.set(record.projectId, (counts.get(record.projectId) ?? 0) + 1);
    }
    return counts;
  }, [records]);

  const activeRecords = useMemo(
    () => records.filter((record) => record.projectId === activeProject?.id),
    [activeProject?.id, records],
  );

  const lastScanCount = lastScan?.scanCount ?? 0;

  const switchProject = (projectId: string) => {
    if (!projects.some((project) => project.id === projectId)) return;
    activeProjectIdRef.current = projectId;
    setActiveProjectId(projectId);
    setQuery("");
    setLastScan(null);
  };

  const openProjectDialog = (mode: Exclude<ProjectDialogMode, null>) => {
    setProjectName(mode === "rename" ? activeProject?.name ?? "" : "");
    setProjectDialog(mode);
  };

  const saveProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = projectName.trim();
    if (!name) return;

    const duplicate = projects.some(
      (project) =>
        project.name.toLocaleLowerCase("en-US") === name.toLocaleLowerCase("en-US") &&
        (projectDialog === "create" || project.id !== activeProject?.id),
    );
    if (duplicate) {
      setToast("A project with that name already exists.");
      return;
    }

    if (projectDialog === "create") {
      const project: ScanProject = {
        id: createId(),
        name,
        createdAt: new Date().toISOString(),
      };
      setProjects((current) => [...current, project]);
      activeProjectIdRef.current = project.id;
      setActiveProjectId(project.id);
      setQuery("");
      setLastScan(null);
      setToast(`Project “${name}” created.`);
    } else if (projectDialog === "rename" && activeProject) {
      setProjects((current) =>
        current.map((project) =>
          project.id === activeProject.id ? { ...project, name } : project,
        ),
      );
      setToast("Project renamed.");
    }

    setProjectDialog(null);
    setProjectName("");
  };

  const deleteActiveProject = () => {
    if (!activeProject || projects.length === 1) return;
    const entryCount = activeRecords.length;
    if (
      !window.confirm(
        `Delete “${activeProject.name}” and its ${entryCount} ${entryCount === 1 ? "entry" : "entries"}? This can’t be undone.`,
      )
    ) {
      return;
    }

    const nextProject = projects.find((project) => project.id !== activeProject.id);
    if (!nextProject) return;
    setProjects((current) => current.filter((project) => project.id !== activeProject.id));
    setRecords((current) => {
      const nextRecords = current.filter((record) => record.projectId !== activeProject.id);
      recordsRef.current = nextRecords;
      return nextRecords;
    });
    activeProjectIdRef.current = nextProject.id;
    setActiveProjectId(nextProject.id);
    setQuery("");
    setLastScan(null);
    setToast("Project deleted.");
  };

  const submitManual = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!manualValue.trim()) return;
    addRecord(manualValue, "MANUAL", "manual");
    setManualValue("");
  };

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("en-US");
    if (!normalizedQuery) return activeRecords;
    return activeRecords.filter(
      (record) =>
        record.value.toLocaleLowerCase("en-US").includes(normalizedQuery) ||
        normalizeFormat(record.format)
          .toLocaleLowerCase("en-US")
          .includes(normalizedQuery),
    );
  }, [activeRecords, query]);

  const totalScanCount = useMemo(
    () => activeRecords.reduce((total, record) => total + record.scanCount, 0),
    [activeRecords],
  );

  const getExportPayload = (format: ExportFormat) => {
    if (!activeProject) return null;
    const date = new Date().toISOString().slice(0, 10);
    const stem = `scanflow-${safeFileName(activeProject.name)}-${date}`;

    if (format === "txt") {
      return {
        label: "TXT",
        filename: `${stem}.txt`,
        mimeType: "text/plain;charset=utf-8",
        content: [...activeRecords]
          .reverse()
          .map((record) => record.value.replace(/[\r\n]+/g, ""))
          .join("\r\n"),
      };
    }

    if (format === "json") {
      return {
        label: "JSON",
        filename: `${stem}.json`,
        mimeType: "application/json;charset=utf-8",
        content: JSON.stringify(
          {
            project: activeProject,
            exportedAt: new Date().toISOString(),
            entries: [...activeRecords].reverse(),
          },
          null,
          2,
        ),
      };
    }

    const rows = [...activeRecords].reverse().map((record, index) =>
      [
        String(index + 1),
        record.value,
        normalizeFormat(record.format),
        String(record.scanCount),
        new Date(record.scannedAt).toLocaleString("en-US", { hour12: false }),
        record.source === "camera" ? "Camera" : "Manual",
      ]
        .map(safeCsvCell)
        .join(","),
    );
    const header = ["Index", "Barcode", "Format", "Scan Count", "Last Scanned At", "Last Source"]
      .map(safeCsvCell)
      .join(",");
    return {
      label: "CSV",
      filename: `${stem}.csv`,
      mimeType: "text/csv;charset=utf-8",
      content: [header, ...rows].join("\r\n"),
    };
  };

  const downloadExport = (format: ExportFormat) => {
    const payload = getExportPayload(format);
    if (!payload) return;
    downloadBlob(
      format === "csv" ? `\uFEFF${payload.content}` : payload.content,
      payload.mimeType,
      payload.filename,
    );
    setToast(`Downloaded ${payload.label} export.`);
  };

  const emailExport = (format: ExportFormat) => {
    const payload = getExportPayload(format);
    if (!payload || !activeProject) return;
    const subject = `ScanFlow ${activeProject.name} ${payload.label} export`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
      payload.content,
    )}`;
  };

  const exportTxt = () => downloadExport("txt");
  const exportCsv = () => downloadExport("csv");
  const exportJson = () => downloadExport("json");

  const copyValue = async (record: ScanRecord) => {
    try {
      await navigator.clipboard.writeText(record.value);
      setCopiedId(record.id);
      window.setTimeout(() => setCopiedId(null), 1300);
    } catch {
      setToast("Copy failed. Press and hold the barcode value instead.");
    }
  };

  const clearRecords = () => {
    if (!activeProject || !activeRecords.length) return;
    if (
      window.confirm(
        `Clear all ${activeRecords.length} entries in “${activeProject.name}”? This can’t be undone.`,
      )
    ) {
      setRecords((current) => {
        const nextRecords = current.filter(
          (record) => record.projectId !== activeProject.id,
        );
        recordsRef.current = nextRecords;
        return nextRecords;
      });
      setToast("Project entries cleared.");
    }
  };

  const statusText = status === "scanning"
    ? engine === "native"
      ? "Scanning · Native"
      : "Scanning · Enhanced"
    : {
        idle: "Ready",
        starting: "Connecting",
        error: "Camera offline",
      }[status];
  const enabledFormatIds = getEnabledFormatIds(scanMode, customFormats);
  const draftEnabledFormatIds = getEnabledFormatIds(draftScanMode, draftCustomFormats);
  const scannerModeLabel = getScannerModeLabel(scanMode, enabledFormatIds.length);

  return (
    <main className="app-shell" id="top">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="ScanFlow home">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>ScanFlow</span>
        </a>
        <div className="topbar-actions">
          <button
            className="settings-trigger"
            type="button"
            onClick={openScannerSettings}
            aria-label={`Scanner settings. Current mode: ${scannerModeLabel}`}
          >
            <Settings size={16} />
            <span>{scannerModeLabel}</span>
          </button>
        </div>
      </header>

      <section className="project-bar" aria-label="Project controls">
        <div className="project-switcher">
          <span className="project-label">Active project</span>
          <label className="project-select">
            <FolderOpen size={17} />
            <span className="sr-only">Active project</span>
            <select
              value={activeProjectId}
              onChange={(event) => switchProject(event.target.value)}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} · {projectEntryCounts.get(project.id) ?? 0}
                </option>
              ))}
            </select>
            <ChevronDown size={15} aria-hidden="true" />
          </label>
        </div>
        <div className="project-summary" aria-label="Project statistics">
          <span><strong>{activeRecords.length}</strong> entries</span>
          <span><strong>{totalScanCount}</strong> scans</span>
        </div>
        <div className="project-actions">
          <button
            className="project-create"
            type="button"
            onClick={() => openProjectDialog("create")}
          >
            <Plus size={16} />
            <span>New project</span>
          </button>
          <button
            className="project-icon-action"
            type="button"
            onClick={() => openProjectDialog("rename")}
            aria-label="Rename project"
            title="Rename project"
          >
            <Pencil size={15} />
          </button>
          <button
            className="project-icon-action danger"
            type="button"
            onClick={deleteActiveProject}
            disabled={projects.length === 1}
            aria-label="Delete project"
            title={projects.length === 1 ? "Create another project before deleting this one" : "Delete project"}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </section>

      <section className="workspace" aria-label="Barcode capture workspace">
        <div className="scanner-panel">
          <div className="panel-heading scanner-heading">
            <div>
              <p className="panel-kicker">01 / CAPTURE</p>
              <h2>Viewfinder</h2>
            </div>
            <span className={`status-pill status-${status}`}>
              <i aria-hidden="true" />
              {statusText}
            </span>
          </div>

          <div className={`camera-stage ${status === "scanning" ? "is-live" : ""}`}>
            <video ref={videoRef} muted playsInline aria-label="Live camera preview" />
            {status !== "scanning" && status !== "starting" && (
              <div className="camera-placeholder">
                <div className="placeholder-barcode" aria-hidden="true">
                  {Array.from({ length: 18 }, (_, index) => <i key={index} />)}
                </div>
                <p>Keep the full barcode inside the frame</p>
                <span>Hold steady · avoid glare · leave space at both ends</span>
              </div>
            )}
            {status === "starting" && (
              <div className="camera-placeholder connecting">
                <span className="spinner" aria-hidden="true" />
                <p>Starting camera…</p>
              </div>
            )}
            <div className="scan-frame" aria-hidden="true" ref={frameRef}>
              <i /><i /><i /><i />
              {status === "scanning" && <b />}
            </div>
            {detectionRegion && status === "scanning" && (
              <div
                key={detectionRegion.id}
                className="detected-region"
                style={{
                  left: detectionRegion.left,
                  top: detectionRegion.top,
                  width: detectionRegion.width,
                  height: detectionRegion.height,
                }}
                aria-hidden="true"
              >
                <i /><i /><i /><i />
                <span>Detected</span>
              </div>
            )}
            {lastScan && (
              <div
                key={lastScan.id}
                className={`capture-confirmation ${lastScanCount > 1 ? "is-repeat" : ""}`}
                role="status"
              >
                {lastScanCount > 1 ? (
                  <Repeat2 size={18} strokeWidth={3} />
                ) : (
                  <Check size={18} strokeWidth={3} />
                )}
                <span>
                  {lastScanCount > 1
                    ? `Scanned again · ${formatOrdinal(lastScanCount)} time`
                    : "Saved"}
                </span>
                <strong>{lastScan.value}</strong>
              </div>
            )}
          </div>

          {cameraError && (
            <div className="camera-error" role="alert">
              <X size={17} />
              <span>{cameraError}</span>
            </div>
          )}

          <div className="scanner-actions">
            {status === "scanning" ? (
              <button className="primary-button stop-button" type="button" onClick={stopScanner}>
                <X size={19} />
                Stop scanner
              </button>
            ) : (
              <button className="primary-button" type="button" onClick={startScanner} disabled={status === "starting"}>
                <Camera size={19} />
                {status === "starting" ? "Starting…" : "Start continuous scan"}
              </button>
            )}
            <button
              className="icon-button"
              type="button"
              onClick={toggleTorch}
              disabled={!torchAvailable || status !== "scanning"}
              aria-label={torchOn ? "Turn torch off" : "Turn torch on"}
              title={torchAvailable ? "Torch" : "Torch control is unavailable on this device"}
            >
              {torchOn ? <Lightbulb size={20} /> : <LightbulbOff size={20} />}
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => setSoundOn((current) => !current)}
              aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
              title={soundOn ? "Turn sound off" : "Turn sound on"}
            >
              {soundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
          </div>

          <div className="feedback-row">
            <button
              type="button"
              className={vibrationOn ? "is-on" : ""}
              onClick={() => setVibrationOn((current) => !current)}
              aria-pressed={vibrationOn}
            >
              <span aria-hidden="true" />
              Vibration
            </button>
            <p><Database size={14} /> Every scan saves automatically on this device</p>
          </div>

          <div className="quality-controls">
            <p>
              <Focus size={14} />
              {engine === "native"
                ? `${scannerModeLabel} · device-native detection`
                : `${scannerModeLabel} · high-accuracy detection`}
            </p>
            {zoomRange && status === "scanning" && (
              <label>
                <ZoomIn size={14} />
                <span className="sr-only">Camera zoom</span>
                <input
                  type="range"
                  min={zoomRange.min}
                  max={zoomRange.max}
                  step={zoomRange.step || 0.1}
                  value={zoom}
                  onChange={(event) => void changeZoom(Number(event.target.value))}
                />
                <output>{zoom.toFixed(1)}×</output>
              </label>
            )}
          </div>

          <form className="manual-entry" onSubmit={submitManual}>
            <label htmlFor="manual-code"><Keyboard size={16} /> Manual entry</label>
            <div>
              <input
                id="manual-code"
                value={manualValue}
                onChange={(event) => setManualValue(event.target.value)}
                placeholder="Enter a barcode and press Return"
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" disabled={!manualValue.trim()}>Add</button>
            </div>
          </form>
        </div>

        <div className="records-panel">
          <div className="panel-heading records-heading">
            <div>
              <p className="panel-kicker">02 / ENTRIES</p>
              <h2>Entries <span>{activeRecords.length}</span></h2>
            </div>
            <button
              className="clear-button"
              type="button"
              onClick={clearRecords}
              disabled={!activeRecords.length}
            >
              <Trash2 size={15} /> Clear all
            </button>
          </div>

          <div className="record-tools">
            <label className="search-box">
              <Search size={17} />
              <span className="sr-only">Search scans</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search barcode or format"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
                  <X size={15} />
                </button>
              )}
            </label>
            <button
              className="export-open-button"
              type="button"
              onClick={() => setExportOpen(true)}
              disabled={!activeRecords.length}
            >
              <Download size={16} /> Export
            </button>
          </div>

          <div className="records-list" aria-live="polite">
            {!hydrated ? (
              <div className="empty-state"><span className="spinner dark" /><p>Loading local scans…</p></div>
            ) : filteredRecords.length ? (
              filteredRecords.map((record, index) => (
                <article className="record-row" key={record.id}>
                  <span className="record-number">{String(filteredRecords.length - index).padStart(2, "0")}</span>
                  <div className="record-main">
                    <div className="record-value-line">
                      <button type="button" onClick={() => copyValue(record)} title="Copy barcode">
                        <strong>{record.value}</strong>
                        {copiedId === record.id ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                    <div className="record-meta">
                      <span>{normalizeFormat(record.format)}</span>
                      <span className={`scan-count ${record.scanCount > 1 ? "is-repeat" : ""}`}>
                        <Repeat2 size={11} /> {record.scanCount} {record.scanCount === 1 ? "scan" : "scans"}
                      </span>
                      <time dateTime={record.scannedAt}>
                        {new Date(record.scannedAt).toLocaleString("en-US", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: false,
                        })}
                      </time>
                    </div>
                  </div>
                  <button
                    className="delete-record"
                    type="button"
                    onClick={() =>
                      setRecords((current) => {
                        const nextRecords = current.filter((item) => item.id !== record.id);
                        recordsRef.current = nextRecords;
                        return nextRecords;
                      })
                    }
                    aria-label={`Delete barcode ${record.value}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <span className="empty-icon"><ScanLine size={27} /></span>
                <h3>{query ? "No matching entries" : "Your first entry will appear here"}</h3>
                <p>{query ? "Try another search." : "Scan a barcode or add one manually to this project."}</p>
              </div>
            )}
          </div>

          <div className="export-note">
            <Download size={16} />
            <p><strong>Download or email this project</strong><span>Choose TXT, CSV, or JSON from the export page.</span></p>
          </div>
        </div>
      </section>

      <footer>
        <p><ShieldCheck size={15} /> Privacy first: camera frames, projects, and entries never leave this device.</p>
        <span className="footer-meta">
          <span>ScanFlow · Local-first barcode capture</span>
          <b>Build {BUILD_NUMBER}</b>
        </span>
      </footer>

      {exportOpen && activeProject && (
        <section
          className="export-page"
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-page-title"
        >
          <div className="export-page-shell">
            <header className="export-page-header">
              <button type="button" onClick={() => setExportOpen(false)}>
                <ArrowLeft size={17} /> Back to scanner
              </button>
              <div>
                <p className="panel-kicker">Export</p>
                <h2 id="export-page-title">Share “{activeProject.name}”</h2>
                <p>{activeRecords.length} entries · {totalScanCount} scans</p>
              </div>
            </header>

            <div className="export-choice-grid">
              <article className="export-choice">
                <span className="export-choice-icon"><FileText size={23} /></span>
                <div className="export-choice-copy">
                  <span className="export-extension">.TXT</span>
                  <h3>Plain barcode values</h3>
                  <p>One aggregated barcode value per line. No headings or extra information.</p>
                  <code>U12345678<br />U87654321</code>
                </div>
                <div className="export-choice-actions">
                  <button className="is-primary" type="button" onClick={exportTxt}>
                    <Download size={16} /> Download
                  </button>
                  <button type="button" onClick={() => emailExport("txt")}>
                    <Mail size={16} /> Email
                  </button>
                </div>
              </article>

              <article className="export-choice">
                <span className="export-choice-icon"><FileSpreadsheet size={23} /></span>
                <div className="export-choice-copy">
                  <span className="export-extension">.CSV</span>
                  <h3>Spreadsheet-ready data</h3>
                  <p>Barcode values, formats, scan counts, timestamps, and the last source.</p>
                  <code>Barcode, Format, Scan Count</code>
                </div>
                <div className="export-choice-actions">
                  <button className="is-primary" type="button" onClick={exportCsv}>
                    <Download size={16} /> Download
                  </button>
                  <button type="button" onClick={() => emailExport("csv")}>
                    <Mail size={16} /> Email
                  </button>
                </div>
              </article>

              <article className="export-choice">
                <span className="export-choice-icon"><Braces size={23} /></span>
                <div className="export-choice-copy">
                  <span className="export-extension">.JSON</span>
                  <h3>Structured project data</h3>
                  <p>The project metadata and complete entry objects for system import.</p>
                  <code>{`{ "project": …, "entries": […] }`}</code>
                </div>
                <div className="export-choice-actions">
                  <button className="is-primary" type="button" onClick={exportJson}>
                    <Download size={16} /> Download
                  </button>
                  <button type="button" onClick={() => emailExport("json")}>
                    <Mail size={16} /> Email
                  </button>
                </div>
              </article>
            </div>

            <div className="email-export-note">
              <Mail size={17} />
              <p><strong>Email opens your default mail app.</strong><span>The selected export is placed in the message body.</span></p>
            </div>
          </div>
        </section>
      )}

      {projectDialog && (
        <div
          className="dialog-backdrop"
          role="presentation"
        >
          <form
            className="project-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-dialog-title"
            onSubmit={saveProject}
          >
            <div className="dialog-heading">
              <div>
                <p className="panel-kicker">Project</p>
                <h2 id="project-dialog-title">
                  {projectDialog === "create" ? "New project" : "Rename project"}
                </h2>
              </div>
              <button
                className="dialog-close"
                type="button"
                onClick={() => {
                  setProjectDialog(null);
                  setProjectName("");
                }}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>
            <label htmlFor="project-name">Project name</label>
            <input
              id="project-name"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="e.g. August stocktake"
              maxLength={60}
            />
            <div className="dialog-actions">
              <button
                type="button"
                onClick={() => {
                  setProjectDialog(null);
                  setProjectName("");
                }}
              >
                Cancel
              </button>
              <button className="dialog-primary" type="submit" disabled={!projectName.trim()}>
                {projectDialog === "create" ? "Create project" : "Save name"}
              </button>
            </div>
          </form>
        </div>
      )}

      {settingsOpen && (
        <div className="dialog-backdrop" role="presentation">
          <form
            className="settings-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-dialog-title"
            onSubmit={saveScannerSettings}
          >
            <div className="dialog-heading settings-heading">
              <div>
                <p className="panel-kicker">Scanner</p>
                <h2 id="settings-dialog-title">Scanning settings</h2>
                <p>Choose which barcode formats the camera should look for.</p>
              </div>
              <button
                className="dialog-close"
                type="button"
                onClick={() => setSettingsOpen(false)}
                aria-label="Close settings"
              >
                <X size={18} />
              </button>
            </div>

            <fieldset className="mode-options">
              <legend>Scanning mode</legend>
              <label className={draftScanMode === "university" ? "is-selected" : ""}>
                <input
                  type="radio"
                  name="scan-mode"
                  value="university"
                  checked={draftScanMode === "university"}
                  onChange={() => setDraftScanMode("university")}
                />
                <span className="mode-icon"><GraduationCap size={20} /></span>
                <span className="mode-copy">
                  <strong>University ID</strong>
                  <small>Code 128 only · best for student and campus IDs</small>
                </span>
              </label>
              <label className={draftScanMode === "universal" ? "is-selected" : ""}>
                <input
                  type="radio"
                  name="scan-mode"
                  value="universal"
                  checked={draftScanMode === "universal"}
                  onChange={() => setDraftScanMode("universal")}
                />
                <span className="mode-icon"><ScanSearch size={20} /></span>
                <span className="mode-copy">
                  <strong>Universal</strong>
                  <small>Scan every supported 1D and 2D format</small>
                </span>
              </label>
              <label className={draftScanMode === "custom" ? "is-selected" : ""}>
                <input
                  type="radio"
                  name="scan-mode"
                  value="custom"
                  checked={draftScanMode === "custom"}
                  onChange={() => setDraftScanMode("custom")}
                />
                <span className="mode-icon"><SlidersHorizontal size={20} /></span>
                <span className="mode-copy">
                  <strong>Custom</strong>
                  <small>Choose exactly which formats to recognize</small>
                </span>
              </label>
            </fieldset>

            <fieldset className="format-settings">
              <legend className="format-settings-heading">
                <span>Recognized formats</span>
                <small>{draftEnabledFormatIds.length} enabled</small>
              </legend>
              <p className="format-help">
                {draftScanMode === "custom"
                  ? "Select one or more formats. Each item includes an example value."
                  : "Switch to Custom mode to change individual formats."}
              </p>
              <div className="format-grid">
                {BARCODE_FORMATS.map((format) => {
                  const checked = draftEnabledFormatIds.includes(format.id);
                  return (
                    <label
                      className={`format-option ${checked ? "is-enabled" : ""}`}
                      key={format.id}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={draftScanMode !== "custom"}
                        onChange={() => toggleDraftFormat(format.id)}
                      />
                      <span className="format-check" aria-hidden="true">
                        {checked && <Check size={13} strokeWidth={3} />}
                      </span>
                      <span className="format-copy">
                        <span><strong>{format.name}</strong><em>{format.kind}</em></span>
                        <code>{format.example}</code>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="dialog-actions settings-actions">
              <button type="button" onClick={() => setSettingsOpen(false)}>Cancel</button>
              <button
                className="dialog-primary"
                type="submit"
                disabled={draftScanMode === "custom" && draftCustomFormats.length === 0}
              >
                Save settings
              </button>
            </div>
          </form>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
