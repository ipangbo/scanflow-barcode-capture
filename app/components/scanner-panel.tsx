import {
  Camera,
  Check,
  Focus,
  Keyboard,
  Lightbulb,
  LightbulbOff,
  Repeat2,
  Vibrate,
  VibrateOff,
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
import { ActionTooltip } from "./action-tooltip";

const ZOOM_PRESETS = [0.9, 1, 1.2, 1.5] as const;

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
  const availableZoomPresets = zoomRange
    ? ZOOM_PRESETS.filter((value) => value >= zoomRange.min && value <= zoomRange.max)
    : [];

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
        {status === "scanning" && <div className="scan-area-mask" aria-hidden="true" />}
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
        <ActionTooltip
          content={torchAvailable ? (torchOn ? "Turn torch off" : "Turn torch on") : "Torch unavailable"}
          placement="bottom"
        >
          <mdui-button-icon
            className={`icon-button ${torchOn ? "is-active" : ""}`}
            variant="outlined"
            onClick={onToggleTorch}
            disabled={!torchAvailable || status !== "scanning"}
            aria-label={torchOn ? "Turn torch off" : "Turn torch on"}
            aria-pressed={torchOn}
          >
            {torchOn ? <Lightbulb size={20} /> : <LightbulbOff size={20} />}
          </mdui-button-icon>
        </ActionTooltip>
        <ActionTooltip content={vibrationOn ? "Turn vibration off" : "Turn vibration on"} placement="bottom">
          <mdui-button-icon
            className={`icon-button ${vibrationOn ? "is-active" : ""}`}
            variant="outlined"
            onClick={onToggleVibration}
            aria-label={vibrationOn ? "Turn vibration off" : "Turn vibration on"}
            aria-pressed={vibrationOn}
          >
            {vibrationOn ? <Vibrate size={20} /> : <VibrateOff size={20} />}
          </mdui-button-icon>
        </ActionTooltip>
        <ActionTooltip content={soundOn ? "Turn sound off" : "Turn sound on"} placement="bottom">
          <mdui-button-icon
            className={`icon-button ${soundOn ? "is-active" : ""}`}
            variant="outlined"
            onClick={onToggleSound}
            aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
            aria-pressed={soundOn}
          >
            {soundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </mdui-button-icon>
        </ActionTooltip>
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
          <div className="zoom-controls">
            <div className="zoom-presets" role="group" aria-label="Common camera zoom levels">
              <ZoomIn size={14} aria-hidden="true" />
              {availableZoomPresets.map((preset) => (
                <mdui-chip
                  key={preset}
                  variant="filter"
                  selected={Math.abs(zoom - preset) < 0.05}
                  onClick={() => onZoomChange(preset)}
                  aria-label={`Set camera zoom to ${preset.toFixed(1)} times`}
                >
                  {preset.toFixed(1)}×
                </mdui-chip>
              ))}
            </div>
            <label className="zoom-fine-control">
              <span className="sr-only">Fine camera zoom</span>
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
          </div>
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
