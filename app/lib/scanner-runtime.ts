import { createId } from "./models";

export type BarcodePoint = { x: number; y: number };

type DetectedBarcode = {
  rawValue: string;
  format: string;
  boundingBox?: DOMRectReadOnly;
  cornerPoints?: BarcodePoint[];
};

export type NativeBarcodeDetector = {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
};

export type NativeBarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): NativeBarcodeDetector;
  getSupportedFormats: () => Promise<string[]>;
};

export type CameraCapabilities = MediaTrackCapabilities & {
  focusMode?: string[];
  torch?: boolean;
  zoom?: { min: number; max: number; step: number };
};

export type AdvancedCameraConstraint = MediaTrackConstraintSet & {
  focusMode?: string;
  torch?: boolean;
  zoom?: number;
};

export function triggerIOSSwitchHaptic() {
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

export function friendlyCameraError(error: unknown) {
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
