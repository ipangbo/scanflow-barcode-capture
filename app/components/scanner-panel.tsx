import {
  Camera,
  Check,
  Database,
  Focus,
  Keyboard,
  Lightbulb,
  LightbulbOff,
  Repeat2,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
} from "lucide-react";
import type { FormEvent, RefObject } from "react";
import {
  formatOrdinal,
  type DetectionRegion,
  type ScanCue,
  type ScanFeedback,
  type ScannerEngine,
  type ScannerStatus,
} from "../lib/models";
import { ScanCounter } from "./scan-counter";

type ZoomRange = {
  min: number;
  max: number;
  step: number;
};

type ScannerPanelProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  frameRef: RefObject<HTMLDivElement | null>;
  status: ScannerStatus;
  engine: ScannerEngine;
  scannerModeLabel: string;
  totalScanCount: number;
  scanCue: ScanCue | null;
  detectionRegion: DetectionRegion | null;
  lastScan: ScanFeedback | null;
  cameraError: string;
  torchOn: boolean;
  torchAvailable: boolean;
  soundOn: boolean;
  vibrationOn: boolean;
  zoom: number;
  zoomRange: ZoomRange | null;
  manualValue: string;
  onStart: () => void;
  onStop: () => void;
  onToggleTorch: () => void;
  onToggleSound: () => void;
  onToggleVibration: () => void;
  onZoomChange: (value: number) => void;
  onManualValueChange: (value: string) => void;
  onManualSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ScannerPanel({
  videoRef,
  frameRef,
  status,
  engine,
  scannerModeLabel,
  totalScanCount,
  scanCue,
  detectionRegion,
  lastScan,
  cameraError,
  torchOn,
  torchAvailable,
  soundOn,
  vibrationOn,
  zoom,
  zoomRange,
  manualValue,
  onStart,
  onStop,
  onToggleTorch,
  onToggleSound,
  onToggleVibration,
  onZoomChange,
  onManualValueChange,
  onManualSubmit,
}: ScannerPanelProps) {
  const statusText = status === "scanning"
    ? "Scanning"
    : {
        idle: "Ready",
        starting: "Connecting",
        error: "Camera offline",
      }[status];
  const lastScanCount = lastScan?.record.scanCount ?? 0;

  return (
    <div className="scanner-panel">
      <div className="panel-heading scanner-heading">
        <div>
          <h2>Viewfinder</h2>
        </div>
        <ScanCounter
          key={lastScan?.eventId ?? "scan-counter-idle"}
          total={totalScanCount}
          isAnimating={Boolean(lastScan)}
        />
        <span className={`status-pill status-${status}`}>
          <i aria-hidden="true" />
          {statusText}
        </span>
      </div>

      <div className={`camera-stage ${status === "scanning" ? "is-live" : ""}`}>
        <video ref={videoRef} muted playsInline aria-label="Live camera preview" />
        {scanCue && scanCue.kind !== "verifying" && (
          <div
            key={scanCue.id}
            className={`scan-flash is-${scanCue.kind}`}
            aria-hidden="true"
          />
        )}
        {status !== "scanning" && status !== "starting" && (
          <div className="camera-placeholder">
            <div className="placeholder-barcode" aria-hidden="true">
              {Array.from({ length: 18 }, (_, index) => <i key={index} />)}
            </div>
            <p>Your phone and barcode must have the same orientation</p>
            <span>Portrait with portrait · landscape with landscape</span>
          </div>
        )}
        {status === "starting" && (
          <div className="camera-placeholder connecting">
            <span className="spinner" aria-hidden="true" />
            <p>Starting camera…</p>
          </div>
        )}
        <div
          className={`scan-frame ${scanCue ? `is-${scanCue.kind}` : ""}`}
          aria-hidden="true"
          ref={frameRef}
        >
          <i /><i /><i /><i />
          {status === "scanning" && <b />}
          {scanCue?.kind === "verifying" && (
            <span className="scan-frame-status">Verifying…</span>
          )}
          {scanCue?.kind === "invalid" && (
            <span className="scan-frame-status">Digits only</span>
          )}
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
            key={lastScan.eventId}
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
            <strong>{lastScan.record.value}</strong>
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
          <button className="primary-button stop-button" type="button" onClick={onStop}>
            <X size={19} />
            Stop scanner
          </button>
        ) : (
          <button className="primary-button" type="button" onClick={onStart} disabled={status === "starting"}>
            <Camera size={19} />
            {status === "starting" ? "Starting…" : "Start continuous scan"}
          </button>
        )}
        <button
          className="icon-button"
          type="button"
          onClick={onToggleTorch}
          disabled={!torchAvailable || status !== "scanning"}
          aria-label={torchOn ? "Turn torch off" : "Turn torch on"}
          title={torchAvailable ? "Torch" : "Torch control is unavailable on this device"}
        >
          {torchOn ? <Lightbulb size={20} /> : <LightbulbOff size={20} />}
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={onToggleSound}
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
          onClick={onToggleVibration}
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
            : engine === "quagga"
              ? `${scannerModeLabel} · Quagga2 1D detection`
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
              onChange={(event) => onZoomChange(Number(event.target.value))}
            />
            <output>{zoom.toFixed(1)}×</output>
          </label>
        )}
      </div>

      <form className="manual-entry" onSubmit={onManualSubmit}>
        <label htmlFor="manual-code"><Keyboard size={16} /> Manual entry</label>
        <div>
          <input
            id="manual-code"
            value={manualValue}
            onChange={(event) => onManualValueChange(event.target.value)}
            placeholder="Enter a barcode and press Return"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" disabled={!manualValue.trim()}>Add</button>
        </div>
      </form>
    </div>
  );
}
