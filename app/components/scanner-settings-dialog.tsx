import {
  Check,
  Cpu,
  GraduationCap,
  Library,
  ScanSearch,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { FormEvent } from "react";
import { BARCODE_FORMATS } from "../lib/barcodes";
import type {
  BarcodeFormatId,
  ScannerEnginePreference,
  ScannerMode,
} from "../lib/models";

type ScannerSettingsDialogProps = {
  mode: ScannerMode;
  recognitionEngine: ScannerEnginePreference;
  nativeEngineAvailable: boolean;
  customFormats: BarcodeFormatId[];
  enabledFormatIds: BarcodeFormatId[];
  onModeChange: (mode: ScannerMode) => void;
  onRecognitionEngineChange: (engine: ScannerEnginePreference) => void;
  onToggleFormat: (formatId: BarcodeFormatId) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
};

export function ScannerSettingsDialog({
  mode,
  recognitionEngine,
  nativeEngineAvailable,
  customFormats,
  enabledFormatIds,
  onModeChange,
  onRecognitionEngineChange,
  onToggleFormat,
  onSubmit,
  onClose,
}: ScannerSettingsDialogProps) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <form
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        onSubmit={onSubmit}
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
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        <fieldset className="mode-options">
          <legend>Scanning mode</legend>
          <label className={mode === "university" ? "is-selected" : ""}>
            <input
              type="radio"
              name="scan-mode"
              value="university"
              checked={mode === "university"}
              onChange={() => onModeChange("university")}
            />
            <span className="mode-icon"><GraduationCap size={20} /></span>
            <span className="mode-copy">
              <strong>University ID</strong>
              <small>Code 128 · digits only · two-frame confirmation</small>
            </span>
          </label>
          <label className={mode === "universal" ? "is-selected" : ""}>
            <input
              type="radio"
              name="scan-mode"
              value="universal"
              checked={mode === "universal"}
              onChange={() => onModeChange("universal")}
            />
            <span className="mode-icon"><ScanSearch size={20} /></span>
            <span className="mode-copy">
              <strong>Universal</strong>
              <small>Scan every supported 1D and 2D format</small>
            </span>
          </label>
          <label className={mode === "custom" ? "is-selected" : ""}>
            <input
              type="radio"
              name="scan-mode"
              value="custom"
              checked={mode === "custom"}
              onChange={() => onModeChange("custom")}
            />
            <span className="mode-icon"><SlidersHorizontal size={20} /></span>
            <span className="mode-copy">
              <strong>Custom</strong>
              <small>Choose exactly which formats to recognize</small>
            </span>
          </label>
        </fieldset>

        <fieldset className="engine-options">
          <legend>Recognition engine</legend>
          <label
            className={`${recognitionEngine === "native" ? "is-selected" : ""} ${nativeEngineAvailable ? "" : "is-disabled"}`}
          >
            <input
              type="radio"
              name="recognition-engine"
              value="native"
              checked={recognitionEngine === "native"}
              disabled={!nativeEngineAvailable}
              onChange={() => onRecognitionEngineChange("native")}
            />
            <span className="mode-icon"><Cpu size={20} /></span>
            <span className="mode-copy">
              <strong>BarcodeDetector API</strong>
              <small>{nativeEngineAvailable ? "Browser-native engine" : "Unavailable in this browser"}</small>
            </span>
          </label>
          <label className={recognitionEngine === "zxing" ? "is-selected" : ""}>
            <input
              type="radio"
              name="recognition-engine"
              value="zxing"
              checked={recognitionEngine === "zxing"}
              onChange={() => onRecognitionEngineChange("zxing")}
            />
            <span className="mode-icon"><Library size={20} /></span>
            <span className="mode-copy">
              <strong>ZXing JS</strong>
              <small>Third-party engine · @zxing/browser</small>
            </span>
          </label>
        </fieldset>

        <fieldset className="format-settings">
          <legend className="format-settings-heading">
            <span>Recognized formats</span>
            <small>{enabledFormatIds.length} enabled</small>
          </legend>
          <p className="format-help">
            {mode === "custom"
              ? "Select one or more formats. Each item includes an example value."
              : "Switch to Custom mode to change individual formats."}
          </p>
          <div className="format-grid">
            {BARCODE_FORMATS.map((format) => {
              const checked = enabledFormatIds.includes(format.id);
              return (
                <label
                  className={`format-option ${checked ? "is-enabled" : ""}`}
                  key={format.id}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={mode !== "custom"}
                    onChange={() => onToggleFormat(format.id)}
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
          <button type="button" onClick={onClose}>Cancel</button>
          <button
            className="dialog-primary"
            type="submit"
            disabled={mode === "custom" && customFormats.length === 0}
          >
            Save settings
          </button>
        </div>
      </form>
    </div>
  );
}
