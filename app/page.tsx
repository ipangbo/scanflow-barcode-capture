"use client";

import {
  BarcodeFormat,
  BrowserMultiFormatReader,
} from "@zxing/browser";
import { DecodeHintType } from "@zxing/library";
import {
  Braces,
  Camera,
  Check,
  ChevronDown,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  FolderOpen,
  Focus,
  Keyboard,
  Lightbulb,
  LightbulbOff,
  Pencil,
  Plus,
  ScanLine,
  Search,
  ShieldCheck,
  Trash2,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
} from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "liansao.scans.v1";
const SETTINGS_KEY = "liansao.settings.v1";
const PROJECTS_KEY = "scanflow.projects.v1";
const DEFAULT_PROJECT_ID = "inbox";
const DUPLICATE_COOLDOWN_MS = 1800;
const FRAME_INTERVAL_MS = 90;

const ZXING_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.ITF,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
];

const NATIVE_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "code_93",
  "itf",
  "qr_code",
  "data_matrix",
  "pdf417",
  "aztec",
  "codabar",
] as const;

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

type DetectedBarcode = { rawValue: string; format: string };
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
  source: "camera" | "manual";
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

function normalizeFormat(format: string) {
  return formatNames[format] ?? format.replaceAll("_", " ");
}

function createHighAccuracyReader() {
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, ZXING_FORMATS);
  hints.set(DecodeHintType.TRY_HARDER, true);
  hints.set(DecodeHintType.ASSUME_GS1, true);
  return new BrowserMultiFormatReader(hints, {
    delayBetweenScanAttempts: FRAME_INTERVAL_MS,
    delayBetweenScanSuccess: 220,
  });
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
  const scanningRef = useRef(false);
  const recentScansRef = useRef(new Map<string, number>());
  const feedbackRef = useRef({ sound: true, vibration: true });
  const activeProjectIdRef = useRef(DEFAULT_PROJECT_ID);

  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [projects, setProjects] = useState<ScanProject[]>(() => [createDefaultProject()]);
  const [activeProjectId, setActiveProjectId] = useState(DEFAULT_PROJECT_ID);
  const [projectDialog, setProjectDialog] = useState<ProjectDialogMode>(null);
  const [projectName, setProjectName] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [cameraError, setCameraError] = useState("");
  const [query, setQuery] = useState("");
  const [manualValue, setManualValue] = useState("");
  const [lastScan, setLastScan] = useState<ScanRecord | null>(null);
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
            })) as ScanRecord[];
          setRecords(migratedRecords);
        }
      }

      let nextActiveProjectId = fallbackProjectId;
      const storedSettings = window.localStorage.getItem(SETTINGS_KEY);
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings) as {
          sound?: boolean;
          vibration?: boolean;
          activeProjectId?: string;
        };
        setSoundOn(parsed.sound ?? true);
        setVibrationOn(parsed.vibration ?? true);
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
        JSON.stringify({ sound: soundOn, vibration: vibrationOn, activeProjectId }),
      );
    }
  }, [soundOn, vibrationOn, activeProjectId, hydrated]);

  useEffect(() => {
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
    if (feedbackRef.current.vibration && "vibrate" in navigator) {
      navigator.vibrate(55);
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

      const record: ScanRecord = {
        id: createId(),
        projectId: activeProjectIdRef.current,
        value: trimmedValue,
        format,
        scannedAt: new Date().toISOString(),
        source,
      };

      setRecords((current) => [record, ...current]);
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
      if (now - previous < DUPLICATE_COOLDOWN_MS) return;

      recentScansRef.current.set(value, now);
      for (const [key, timestamp] of recentScansRef.current) {
        if (now - timestamp > 10_000) recentScansRef.current.delete(key);
      }

      addRecord(value, format, "camera");
    },
    [addRecord],
  );

  const stopScanner = useCallback(() => {
    scanningRef.current = false;
    if (scanTimerRef.current !== null) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    readerRef.current = null;
    setTorchOn(false);
    setTorchAvailable(false);
    setZoomRange(null);
    setEngine(null);
    setStatus("idle");
  }, []);

  useEffect(
    () => () => {
      scanningRef.current = false;
      if (scanTimerRef.current !== null) window.clearTimeout(scanTimerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const startScanner = useCallback(async () => {
    if (status === "starting" || status === "scanning") return;

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
          const preferredFormats = NATIVE_FORMATS.filter((format) =>
            supportedFormats.includes(format),
          );
          const coversRetailCodes =
            preferredFormats.includes("code_128") &&
            (preferredFormats.includes("ean_13") || preferredFormats.includes("upc_a"));
          if (coversRetailCodes) {
            detector = new Detector({ formats: [...preferredFormats] });
          }
        } catch {
          detector = null;
        }
      }

      if (!detector) {
        reader = createHighAccuracyReader();
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

              if (detector) {
                try {
                  const results = await detector.detect(canvas);
                  const result = results[0];
                  if (result?.rawValue) {
                    acceptDecodedValue(
                      result.rawValue,
                      nativeFormatNames[result.format] ?? result.format.toUpperCase(),
                    );
                  }
                  nativeErrors = 0;
                } catch {
                  nativeErrors += 1;
                  if (nativeErrors >= 2) {
                    detector = null;
                    reader = createHighAccuracyReader();
                    readerRef.current = reader;
                    setEngine("zxing");
                  }
                }
              } else if (reader) {
                try {
                  const result = reader.decodeFromCanvas(canvas);
                  acceptDecodedValue(
                    result.getText(),
                    BarcodeFormat[result.getBarcodeFormat()] ?? "UNKNOWN",
                  );
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
      setCameraError(friendlyCameraError(error));
      setStatus("error");
    }
  }, [acceptDecodedValue, status]);

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
    setRecords((current) => current.filter((record) => record.projectId !== activeProject.id));
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

  const uniqueCount = useMemo(
    () => new Set(activeRecords.map((record) => record.value)).size,
    [activeRecords],
  );

  const exportCsv = () => {
    if (!activeProject) return;
    const rows = [...activeRecords].reverse().map((record, index) =>
      [
        String(index + 1),
        record.value,
        normalizeFormat(record.format),
        new Date(record.scannedAt).toLocaleString("en-US", { hour12: false }),
        record.source === "camera" ? "Camera" : "Manual",
      ]
        .map(safeCsvCell)
        .join(","),
    );
    const header = ["Index", "Barcode", "Format", "Scanned At", "Source"]
      .map(safeCsvCell)
      .join(",");
    downloadBlob(
      `\uFEFF${[header, ...rows].join("\r\n")}`,
      "text/csv;charset=utf-8",
      `scanflow-${safeFileName(activeProject.name)}-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    setToast(`Exported ${activeRecords.length} entries from “${activeProject.name}”.`);
  };

  const exportJson = () => {
    if (!activeProject) return;
    downloadBlob(
      JSON.stringify(
        {
          project: activeProject,
          exportedAt: new Date().toISOString(),
          entries: [...activeRecords].reverse(),
        },
        null,
        2,
      ),
      "application/json;charset=utf-8",
      `scanflow-${safeFileName(activeProject.name)}-${new Date().toISOString().slice(0, 10)}.json`,
    );
    setToast(`Exported ${activeRecords.length} entries from “${activeProject.name}”.`);
  };

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
      setRecords((current) =>
        current.filter((record) => record.projectId !== activeProject.id),
      );
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
        <div className="local-badge">
          <ShieldCheck size={15} strokeWidth={2.2} />
          Device only
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
          <span><strong>{uniqueCount}</strong> unique</span>
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
            {lastScan && (
              <div className="capture-confirmation" role="status">
                <Check size={18} strokeWidth={3} />
                <span>Saved</span>
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
                ? "Device-native detection · focused scan zone"
                : "High-accuracy detection · focused scan zone"}
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
            <div className="export-actions">
              <button type="button" onClick={exportCsv} disabled={!activeRecords.length}>
                <FileSpreadsheet size={16} /> CSV
              </button>
              <button type="button" onClick={exportJson} disabled={!activeRecords.length}>
                <Braces size={16} /> JSON
              </button>
            </div>
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
                    onClick={() => setRecords((current) => current.filter((item) => item.id !== record.id))}
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
            <p><strong>Export this project anytime</strong><span>CSV opens in Excel. JSON includes the project and its entries.</span></p>
          </div>
        </div>
      </section>

      <footer>
        <p><ShieldCheck size={15} /> Privacy first: camera frames, projects, and entries never leave this device.</p>
        <span>ScanFlow · Local-first barcode capture</span>
      </footer>

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

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
