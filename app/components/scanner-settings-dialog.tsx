import {
  Cpu,
  GraduationCap,
  Library,
  ScanLine,
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
import { MduiDialog } from "./mdui-bridge";

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
    <MduiDialog
      className="settings-dialog"
      ariaLabelledBy="settings-dialog-title"
      onDismiss={onClose}
    >
      <form
        className="settings-dialog-content"
        onSubmit={onSubmit}
      >
        <div className="dialog-heading settings-heading">
          <div>
            <p className="panel-kicker">Scanner</p>
            <h2 id="settings-dialog-title">Scanning settings</h2>
            <p>Choose which barcode formats the camera should look for.</p>
          </div>
          <mdui-button-icon
            className="dialog-close"
            variant="standard"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={18} />
          </mdui-button-icon>
        </div>

        <fieldset className="mode-options">
          <legend>Scanning mode</legend>
          <mdui-radio-group
            className="mode-option-grid"
            name="scan-mode"
            value={mode}
            onInput={(event) => onModeChange((event.currentTarget as HTMLElement & { value: ScannerMode }).value)}
          >
            {/* MDUI radios are form-associated custom elements; the lint rule cannot infer them. */}
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label className={mode === "university" ? "is-selected" : ""}>
              <mdui-radio value="university" aria-label="University ID" />
              <span className="mode-icon"><GraduationCap size={20} /></span>
              <span className="mode-copy">
                <strong>University ID</strong>
                <small>Code 128 · digits only · two-frame confirmation</small>
              </span>
            </label>
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label className={mode === "universal" ? "is-selected" : ""}>
              <mdui-radio value="universal" aria-label="Universal" />
              <span className="mode-icon"><ScanSearch size={20} /></span>
              <span className="mode-copy">
                <strong>Universal</strong>
                <small>All formats supported by the selected engine</small>
              </span>
            </label>
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label className={mode === "custom" ? "is-selected" : ""}>
              <mdui-radio value="custom" aria-label="Custom" />
              <span className="mode-icon"><SlidersHorizontal size={20} /></span>
              <span className="mode-copy">
                <strong>Custom</strong>
                <small>Choose exactly which formats to recognize</small>
              </span>
            </label>
          </mdui-radio-group>
        </fieldset>

        <fieldset className="engine-options">
          <legend>Recognition engine</legend>
          <mdui-radio-group
            className="mode-option-grid"
            name="recognition-engine"
            value={recognitionEngine}
            onInput={(event) => onRecognitionEngineChange((event.currentTarget as HTMLElement & { value: ScannerEnginePreference }).value)}
          >
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label className={recognitionEngine === "zxing" ? "is-selected" : ""}>
              <mdui-radio value="zxing" aria-label="ZXing JS" />
              <span className="mode-icon"><Library size={20} /></span>
              <span className="mode-copy">
                <strong>ZXing JS</strong>
                <small>Recommended for all modes · @zxing/browser</small>
              </span>
            </label>
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label className={recognitionEngine === "quagga" ? "is-selected" : ""}>
              <mdui-radio value="quagga" aria-label="Quagga2" />
              <span className="mode-icon"><ScanLine size={20} /></span>
              <span className="mode-copy">
                <strong>Quagga2</strong>
                <small>Optional 1D fallback · @ericblade/quagga2</small>
              </span>
            </label>
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label
              className={`${recognitionEngine === "native" ? "is-selected" : ""} ${nativeEngineAvailable ? "" : "is-disabled"}`}
            >
              <mdui-radio value="native" disabled={!nativeEngineAvailable} aria-label="BarcodeDetector API" />
              <span className="mode-icon"><Cpu size={20} /></span>
              <span className="mode-copy">
                <strong>BarcodeDetector API</strong>
                <small>{nativeEngineAvailable ? "Browser-native engine" : "Unavailable in this browser"}</small>
              </span>
            </label>
          </mdui-radio-group>
          <p className={`engine-recommendation ${recognitionEngine === "quagga" ? "is-warning" : ""}`}>
            <strong>Recommended setup</strong>
            <span>
              {recognitionEngine === "quagga"
                ? "Quagga2 is a slower 1D fallback. Use ZXing JS as the default, especially for University ID."
                : "Use ZXing JS for University ID, Universal, and 2D barcodes. Quagga2 is an optional 1D fallback."}
            </span>
          </p>
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
                // MDUI checkboxes are form-associated custom elements; the lint rule cannot infer them.
                // eslint-disable-next-line jsx-a11y/label-has-associated-control
                <label
                  className={`format-option ${checked ? "is-enabled" : ""}`}
                  key={format.id}
                >
                  <mdui-checkbox
                    checked={checked}
                    disabled={mode !== "custom"}
                    onInput={() => onToggleFormat(format.id)}
                    aria-label={`${format.name}: ${format.example}`}
                  />
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
          <mdui-button type="button" variant="text" onClick={onClose}>Cancel</mdui-button>
          <mdui-button
            className="dialog-primary"
            variant="filled"
            type="submit"
            disabled={mode === "custom" && customFormats.length === 0}
          >
            Save settings
          </mdui-button>
        </div>
      </form>
    </MduiDialog>
  );
}
