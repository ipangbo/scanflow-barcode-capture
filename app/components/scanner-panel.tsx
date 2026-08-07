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
          </div>
        )}
        {status === "starting" && (
          <div className="camera-placeholder connecting">
            <mdui-circular-progress className="spinner" aria-hidden="true" />
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
          <mdui-button className="primary-button stop-button" type="button" variant="tonal" onClick={onStop}>
            <X slot="icon" size={19} />
            Stop scanner
          </mdui-button>
        ) : (
          <mdui-button className="primary-button" type="button" variant="filled" onClick={onStart} disabled={status === "starting"} loading={status === "starting"}>
            <Camera slot="icon" size={19} />
            {status === "starting" ? "Starting…" : "Start continuous scan"}
          </mdui-button>
        )}
        <mdui-button-icon
          className="icon-button"
          variant="outlined"
          onClick={onToggleTorch}
          disabled={!torchAvailable || status !== "scanning"}
          aria-label={torchOn ? "Turn torch off" : "Turn torch on"}
          title={torchAvailable ? "Torch" : "Torch control is unavailable on this device"}
        >
          {torchOn ? <Lightbulb size={20} /> : <LightbulbOff size={20} />}
        </mdui-button-icon>
        <mdui-button-icon
          className="icon-button"
          variant="outlined"
          onClick={onToggleSound}
          aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
          title={soundOn ? "Turn sound off" : "Turn sound on"}
        >
          {soundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </mdui-button-icon>
      </div>

      <div className="feedback-row">
        {/* MDUI is a form-associated custom element; the lint rule cannot infer that relationship. */}
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
        <label className="vibration-control">
          <mdui-switch
            checked={vibrationOn}
            onInput={onToggleVibration}
            aria-label="Vibration feedback"
          />
          <span>Vibration</span>
        </label>
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
            <mdui-slider
              min={zoomRange.min}
              max={zoomRange.max}
              step={zoomRange.step || 0.1}
              value={zoom}
              nolabel
              onInput={(event) => onZoomChange(Number((event.currentTarget as HTMLElement & { value: number }).value))}
            />
            <output>{zoom.toFixed(1)}×</output>
          </label>
        )}
      </div>

      <form className="manual-entry" onSubmit={onManualSubmit}>
        <label htmlFor="manual-code"><Keyboard size={16} /> Manual entry</label>
        <div>
          <mdui-text-field
            id="manual-code"
            variant="outlined"
            value={manualValue}
            onInput={(event) => onManualValueChange((event.currentTarget as HTMLElement & { value: string }).value)}
            placeholder="Enter a barcode and press Return"
            autocomplete="off"
            spellcheck={false}
          />
          <mdui-button type="submit" variant="tonal" disabled={!manualValue.trim()}>Add</mdui-button>
        </div>
      </form>
    </div>
  );
}
