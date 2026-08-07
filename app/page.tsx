"use client";

import {
  BarcodeFormat,
  BrowserMultiFormatReader,
} from "@zxing/browser";
import { Settings, ShieldCheck } from "lucide-react";
import { FaGithub } from "react-icons/fa6";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BUILD_NUMBER } from "./build-version";
import { ExportPage } from "./components/export-page";
import { ProjectBar } from "./components/project-bar";
import { ProjectDialog } from "./components/project-dialog";
import { RecordsPanel } from "./components/records-panel";
import { ScannerPanel } from "./components/scanner-panel";
import { ScannerSettingsDialog } from "./components/scanner-settings-dialog";
import {
  ALL_FORMAT_IDS,
  BARCODE_FORMATS,
  DECODE_CONFIRMATION_WINDOW_MS,
  DUPLICATE_COOLDOWN_MS,
  FRAME_INTERVAL_MS,
  REQUIRED_DECODE_MATCHES,
  createHighAccuracyReader,
  getEnabledFormatIds,
  getScannerModeLabel,
  nativeFormatNames,
  normalizeFormat,
} from "./lib/barcodes";
import {
  createExportPayload,
  downloadExportPayload,
} from "./lib/exports";
import {
  DEFAULT_PROJECT_ID,
  createDefaultProject,
  createId,
  type BarcodeFormatId,
  type DetectionRegion,
  type ExportFormat,
  type PendingDecodedValue,
  type ProjectDialogMode,
  type ScanCue,
  type ScanCueKind,
  type ScanFeedback,
  type ScanProject,
  type ScanRecord,
  type ScannerEngine,
  type ScannerEnginePreference,
  type ScannerMode,
  type ScannerStatus,
} from "./lib/models";
import {
  friendlyCameraError,
  triggerIOSSwitchHaptic,
  type AdvancedCameraConstraint,
  type BarcodePoint,
  type CameraCapabilities,
  type NativeBarcodeDetector,
  type NativeBarcodeDetectorConstructor,
} from "./lib/scanner-runtime";
import {
  readStoredAppState,
  writeStoredProjects,
  writeStoredRecords,
  writeStoredSettings,
} from "./lib/storage";


export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const detectionTimerRef = useRef<number | null>(null);
  const scanCueTimerRef = useRef<number | null>(null);
  const scanFeedbackTimerRef = useRef<number | null>(null);
  const scanningRef = useRef(false);
  const recentScansRef = useRef(new Map<string, number>());
  const pendingDecodedValueRef = useRef<PendingDecodedValue | null>(null);
  const invalidCueRef = useRef({ value: "", shownAt: 0 });
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
  const [recognitionEngine, setRecognitionEngine] = useState<ScannerEnginePreference>("zxing");
  const [recognitionEngineConfigured, setRecognitionEngineConfigured] = useState(false);
  const [scanModeConfigured, setScanModeConfigured] = useState(false);
  const [customFormats, setCustomFormats] = useState<BarcodeFormatId[]>(() => [
    ...ALL_FORMAT_IDS,
  ]);
  const [draftScanMode, setDraftScanMode] = useState<ScannerMode>("university");
  const [draftRecognitionEngine, setDraftRecognitionEngine] = useState<ScannerEnginePreference>("zxing");
  const [draftCustomFormats, setDraftCustomFormats] = useState<BarcodeFormatId[]>(() => [
    ...ALL_FORMAT_IDS,
  ]);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [cameraError, setCameraError] = useState("");
  const [query, setQuery] = useState("");
  const [manualValue, setManualValue] = useState("");
  const [lastScan, setLastScan] = useState<ScanFeedback | null>(null);
  const [scanCue, setScanCue] = useState<ScanCue | null>(null);
  const [detectionRegion, setDetectionRegion] = useState<DetectionRegion | null>(null);
  const [toast, setToast] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [vibrationOn, setVibrationOn] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [engine, setEngine] = useState<ScannerEngine>(null);
  const [nativeEngineAvailable, setNativeEngineAvailable] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [zoomRange, setZoomRange] = useState<{
    min: number;
    max: number;
    step: number;
  } | null>(null);

  useEffect(() => {
    try {
      const stored = readStoredAppState(window.localStorage);
      // Browser storage is intentionally hydrated after mount to keep the server render stable.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProjects(stored.projects);
      recordsRef.current = stored.records;
      setRecords(stored.records);
      setSoundOn(stored.sound);
      setVibrationOn(stored.vibration);
      setScanMode(stored.scanMode);
      setScanModeConfigured(stored.scanModeConfigured);
      setCustomFormats(stored.customFormats);
      const NativeDetector = (
        window as typeof window & {
          BarcodeDetector?: NativeBarcodeDetectorConstructor;
        }
      ).BarcodeDetector;
      const supportsNativeEngine = Boolean(NativeDetector?.getSupportedFormats);
      setNativeEngineAvailable(supportsNativeEngine);
      setRecognitionEngine(
        stored.recognitionEngine === "native" && !supportsNativeEngine
          ? "zxing"
          : stored.recognitionEngine,
      );
      setRecognitionEngineConfigured(stored.recognitionEngineConfigured);
      activeProjectIdRef.current = stored.activeProjectId;
      setActiveProjectId(stored.activeProjectId);
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
      writeStoredSettings(window.localStorage, {
        sound: soundOn,
        vibration: vibrationOn,
        activeProjectId,
        scanMode,
        scanModeConfigured,
        customFormats,
        recognitionEngine,
        recognitionEngineConfigured,
      });
    }
  }, [
    soundOn,
    vibrationOn,
    activeProjectId,
    scanMode,
    scanModeConfigured,
    customFormats,
    recognitionEngine,
    recognitionEngineConfigured,
    hydrated,
  ]);

  useEffect(() => {
    recordsRef.current = records;
    if (hydrated) writeStoredRecords(window.localStorage, records);
  }, [records, hydrated]);

  useEffect(() => {
    if (hydrated) writeStoredProjects(window.localStorage, projects);
  }, [projects, hydrated]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const showScanCue = useCallback((kind: ScanCueKind, duration: number) => {
    const cue = { id: createId(), kind };
    if (scanCueTimerRef.current !== null) {
      window.clearTimeout(scanCueTimerRef.current);
    }
    setScanCue(cue);
    scanCueTimerRef.current = window.setTimeout(() => {
      setScanCue((current) => (current?.id === cue.id ? null : current));
      scanCueTimerRef.current = null;
    }, duration);
    return cue.id;
  }, []);

  const playFeedback = useCallback((kind: "saved" | "repeat") => {
    if (feedbackRef.current.vibration) {
      let vibrated = false;
      if ("vibrate" in navigator) {
        vibrated = navigator.vibrate(kind === "repeat" ? [38, 36, 38] : 55);
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
        const tones = kind === "repeat"
          ? [{ frequency: 520, delay: 0 }, { frequency: 410, delay: 0.12 }]
          : [{ frequency: 940, delay: 0 }];

        tones.forEach((tone, index) => {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          const startsAt = context.currentTime + tone.delay;
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(tone.frequency, startsAt);
          gain.gain.setValueAtTime(0.0001, startsAt);
          gain.gain.exponentialRampToValueAtTime(0.12, startsAt + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.09);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start(startsAt);
          oscillator.stop(startsAt + 0.1);
          if (index === tones.length - 1) {
            oscillator.addEventListener("ended", () => void context.close());
          }
        });
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
      const feedbackKind = existing ? "repeat" : "saved";
      const eventId = showScanCue(feedbackKind, feedbackKind === "repeat" ? 680 : 560);
      setLastScan({ eventId, record });
      playFeedback(feedbackKind);
      if (scanFeedbackTimerRef.current !== null) {
        window.clearTimeout(scanFeedbackTimerRef.current);
      }
      scanFeedbackTimerRef.current = window.setTimeout(() => {
        setLastScan((current) => (current?.eventId === eventId ? null : current));
        scanFeedbackTimerRef.current = null;
      }, 1600);
    },
    [playFeedback, showScanCue],
  );

  const acceptDecodedValue = useCallback(
    (value: string, format: string) => {
      const trimmedValue = value.trim();
      if (!trimmedValue) return false;

      const now = Date.now();

      if (scanMode === "university" && !/^[0-9]+$/.test(trimmedValue)) {
        pendingDecodedValueRef.current = null;
        if (
          invalidCueRef.current.value !== trimmedValue ||
          now - invalidCueRef.current.shownAt > 1200
        ) {
          invalidCueRef.current = { value: trimmedValue, shownAt: now };
          showScanCue("invalid", 720);
        }
        return false;
      }

      const previous = recentScansRef.current.get(trimmedValue) ?? 0;
      if (now - previous < DUPLICATE_COOLDOWN_MS) {
        pendingDecodedValueRef.current = null;
        return false;
      }

      const confirmationKey = `${format}\u0000${trimmedValue}`;
      const pending = pendingDecodedValueRef.current;
      if (
        !pending ||
        pending.key !== confirmationKey ||
        now - pending.lastSeenAt > DECODE_CONFIRMATION_WINDOW_MS
      ) {
        pendingDecodedValueRef.current = {
          key: confirmationKey,
          matches: 1,
          lastSeenAt: now,
        };
        showScanCue("verifying", DECODE_CONFIRMATION_WINDOW_MS);
        return false;
      }

      pending.matches += 1;
      pending.lastSeenAt = now;
      if (pending.matches < REQUIRED_DECODE_MATCHES) return false;
      pendingDecodedValueRef.current = null;

      recentScansRef.current.set(trimmedValue, now);
      for (const [key, timestamp] of recentScansRef.current) {
        if (now - timestamp > 10_000) recentScansRef.current.delete(key);
      }

      addRecord(trimmedValue, format, "camera");
      return true;
    },
    [addRecord, scanMode, showScanCue],
  );

  const stopScanner = useCallback(() => {
    scanningRef.current = false;
    pendingDecodedValueRef.current = null;
    if (scanTimerRef.current !== null) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (detectionTimerRef.current !== null) {
      window.clearTimeout(detectionTimerRef.current);
      detectionTimerRef.current = null;
    }
    if (scanCueTimerRef.current !== null) {
      window.clearTimeout(scanCueTimerRef.current);
      scanCueTimerRef.current = null;
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
    setScanCue(null);
    setStatus("idle");
  }, []);

  const openScannerSettings = () => {
    setDraftScanMode(scanMode);
    setDraftRecognitionEngine(recognitionEngine);
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
    setRecognitionEngine(draftRecognitionEngine);
    setRecognitionEngineConfigured(true);
    setScanModeConfigured(true);
    setCustomFormats([...draftCustomFormats]);
    setSettingsOpen(false);
    setToast(
      wasScanning
        ? "Scanner settings saved. Restart the scanner to apply them."
        : "Scanner settings saved.",
    );
  };

  useEffect(
    () => () => {
      scanningRef.current = false;
      if (scanTimerRef.current !== null) window.clearTimeout(scanTimerRef.current);
      if (detectionTimerRef.current !== null) {
        window.clearTimeout(detectionTimerRef.current);
      }
      if (scanCueTimerRef.current !== null) {
        window.clearTimeout(scanCueTimerRef.current);
      }
      if (scanFeedbackTimerRef.current !== null) {
        window.clearTimeout(scanFeedbackTimerRef.current);
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
    setScanCue(null);
    pendingDecodedValueRef.current = null;

    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      setCameraError("Camera access requires a secure connection. Use the published site.");
      setStatus("error");
      return;
    }

    const NativeDetector = (
      window as typeof window & {
        BarcodeDetector?: NativeBarcodeDetectorConstructor;
      }
    ).BarcodeDetector;
    let preferredNativeFormats: string[] = [];

    if (recognitionEngine === "native") {
      if (!NativeDetector?.getSupportedFormats) {
        setNativeEngineAvailable(false);
        setCameraError("BarcodeDetector API is unavailable in this browser. Choose ZXing JS in settings.");
        setStatus("error");
        return;
      }

      try {
        const supportedFormats = await NativeDetector.getSupportedFormats();
        preferredNativeFormats = requestedNativeFormats.filter((format) =>
          supportedFormats.includes(format),
        );
      } catch {
        setCameraError("BarcodeDetector API could not be initialized. Choose ZXing JS in settings.");
        setStatus("error");
        return;
      }

      if (!preferredNativeFormats.length) {
        setCameraError("BarcodeDetector API does not support the selected formats. Choose ZXing JS in settings.");
        setStatus("error");
        return;
      }
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
      if (recognitionEngine === "native" && NativeDetector) {
        detector = new NativeDetector({ formats: [...preferredNativeFormats] });
      } else {
        reader = createHighAccuracyReader(enabledFormatIds);
        readerRef.current = reader;
      }

      setEngine(recognitionEngine);
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
                    scanningRef.current = false;
                    streamRef.current?.getTracks().forEach((streamTrack) => streamTrack.stop());
                    streamRef.current = null;
                    if (videoRef.current) videoRef.current.srcObject = null;
                    detector = null;
                    setEngine(null);
                    setCameraError("BarcodeDetector API stopped responding. Choose ZXing JS in settings.");
                    setStatus("error");
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
  }, [acceptDecodedValue, customFormats, recognitionEngine, scanMode, status]);

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
    setScanCue(null);
    pendingDecodedValueRef.current = null;
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
  const getExportPayload = (format: ExportFormat) =>
    activeProject ? createExportPayload(format, activeProject, activeRecords) : null;

  const downloadExport = (format: ExportFormat) => {
    const payload = getExportPayload(format);
    if (!payload) return;
    downloadExportPayload(payload, format === "csv");
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

  const copyValue = async (record: ScanRecord) => {
    try {
      await navigator.clipboard.writeText(record.value);
      setCopiedId(record.id);
      window.setTimeout(() => setCopiedId(null), 1300);
    } catch {
      setToast("Copy failed. Press and hold the barcode value instead.");
    }
  };

  const deleteRecord = (recordId: string) => {
    setRecords((current) => {
      const nextRecords = current.filter((record) => record.id !== recordId);
      recordsRef.current = nextRecords;
      return nextRecords;
    });
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

      <ProjectBar
        projects={projects}
        activeProjectId={activeProjectId}
        entryCounts={projectEntryCounts}
        activeEntryCount={activeRecords.length}
        totalScanCount={totalScanCount}
        onSwitch={switchProject}
        onCreate={() => openProjectDialog("create")}
        onRename={() => openProjectDialog("rename")}
        onDelete={deleteActiveProject}
      />


      <section className="workspace" aria-label="Barcode capture workspace">
        <ScannerPanel
          videoRef={videoRef}
          frameRef={frameRef}
          status={status}
          engine={engine}
          scannerModeLabel={scannerModeLabel}
          totalScanCount={totalScanCount}
          scanCue={scanCue}
          detectionRegion={detectionRegion}
          lastScan={lastScan}
          cameraError={cameraError}
          torchOn={torchOn}
          torchAvailable={torchAvailable}
          soundOn={soundOn}
          vibrationOn={vibrationOn}
          zoom={zoom}
          zoomRange={zoomRange}
          manualValue={manualValue}
          onStart={() => void startScanner()}
          onStop={stopScanner}
          onToggleTorch={() => void toggleTorch()}
          onToggleSound={() => setSoundOn((current) => !current)}
          onToggleVibration={() => setVibrationOn((current) => !current)}
          onZoomChange={(value) => void changeZoom(value)}
          onManualValueChange={setManualValue}
          onManualSubmit={submitManual}
        />


        <RecordsPanel
          activeRecords={activeRecords}
          filteredRecords={filteredRecords}
          hydrated={hydrated}
          query={query}
          copiedId={copiedId}
          onQueryChange={setQuery}
          onClearRecords={clearRecords}
          onOpenExport={() => setExportOpen(true)}
          onCopy={copyValue}
          onDelete={deleteRecord}
        />

      </section>

      <footer>
        <p><ShieldCheck size={15} /> Privacy first: camera frames, projects, and entries never leave this device.</p>
        <span className="footer-meta">
          <a
            className="footer-github"
            href="https://github.com/ipangbo/scanflow-barcode-capture"
            target="_blank"
            rel="noreferrer"
            aria-label="View ScanFlow on GitHub"
          >
            <FaGithub size={14} aria-hidden="true" /> GitHub
          </a>
          <span>ScanFlow · Local-first barcode capture</span>
          <b>Build {BUILD_NUMBER}</b>
        </span>
      </footer>

      {exportOpen && activeProject && (
        <ExportPage
          project={activeProject}
          entryCount={activeRecords.length}
          totalScanCount={totalScanCount}
          onClose={() => setExportOpen(false)}
          onDownload={downloadExport}
          onEmail={emailExport}
        />
      )}


      {projectDialog && (
        <ProjectDialog
          mode={projectDialog}
          name={projectName}
          onNameChange={setProjectName}
          onSubmit={saveProject}
          onClose={() => {
            setProjectDialog(null);
            setProjectName("");
          }}
        />
      )}


      {settingsOpen && (
        <ScannerSettingsDialog
          mode={draftScanMode}
          recognitionEngine={draftRecognitionEngine}
          nativeEngineAvailable={nativeEngineAvailable}
          customFormats={draftCustomFormats}
          enabledFormatIds={draftEnabledFormatIds}
          onModeChange={setDraftScanMode}
          onRecognitionEngineChange={setDraftRecognitionEngine}
          onToggleFormat={toggleDraftFormat}
          onSubmit={saveScannerSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}


      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
