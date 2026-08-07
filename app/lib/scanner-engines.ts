import {
  BARCODE_FORMATS,
  nativeFormatNames,
} from "./barcodes";
import {
  decodeCanvasWithQuagga,
  getQuaggaFormatIds,
  prepareQuaggaDecoder,
} from "./quagga-decoder";
import type {
  BarcodeFormatId,
  ScannerEnginePreference,
} from "./models";
import type {
  BarcodePoint,
  NativeBarcodeDetectorConstructor,
} from "./scanner-runtime";

export type ScannerFrameResult = {
  value: string;
  format: string;
  points: BarcodePoint[];
};

export type ScannerFrameDecoder = {
  decode: (canvas: HTMLCanvasElement) => Promise<ScannerFrameResult | null>;
  dispose: () => void;
};

const setupErrors = {
  nativeUnavailable:
    "BarcodeDetector API is unavailable in this browser. Choose ZXing JS in settings.",
  nativeInitialization:
    "BarcodeDetector API could not be initialized. Choose ZXing JS in settings.",
  nativeFormats:
    "BarcodeDetector API does not support the selected formats. Choose ZXing JS in settings.",
  quaggaFormats:
    "Quagga2 supports 1D barcodes only. Choose ZXing JS for the selected formats.",
  quaggaInitialization:
    "Quagga2 could not be initialized. Choose ZXing JS in settings.",
} as const;

async function createZXingDecoder(
  formatIds: BarcodeFormatId[],
): Promise<ScannerFrameDecoder> {
  const { createZXingFrameDecoder } = await import("./zxing-decoder");
  return createZXingFrameDecoder(formatIds);
}

async function createNativeDecoder(
  formatIds: BarcodeFormatId[],
  NativeDetector?: NativeBarcodeDetectorConstructor,
): Promise<ScannerFrameDecoder> {
  if (!NativeDetector?.getSupportedFormats) throw new Error(setupErrors.nativeUnavailable);

  let supportedFormats: string[];
  try {
    supportedFormats = await NativeDetector.getSupportedFormats();
  } catch {
    throw new Error(setupErrors.nativeInitialization);
  }

  const requestedFormats = BARCODE_FORMATS.filter((format) =>
    formatIds.includes(format.id),
  ).map((format) => format.nativeFormat);
  const formats = requestedFormats.filter((format) => supportedFormats.includes(format));
  if (!formats.length) throw new Error(setupErrors.nativeFormats);

  const detector = new NativeDetector({ formats });
  return {
    async decode(canvas) {
      const result = (await detector.detect(canvas))[0];
      if (!result?.rawValue) return null;
      const points = result.cornerPoints?.length
        ? result.cornerPoints
        : result.boundingBox
          ? [
              { x: result.boundingBox.left, y: result.boundingBox.top },
              { x: result.boundingBox.right, y: result.boundingBox.bottom },
            ]
          : [];
      return {
        value: result.rawValue,
        format: nativeFormatNames[result.format] ?? result.format.toUpperCase(),
        points,
      };
    },
    dispose() {},
  };
}

async function createQuaggaDecoder(
  formatIds: BarcodeFormatId[],
): Promise<ScannerFrameDecoder> {
  const supportedFormatIds = getQuaggaFormatIds(formatIds);
  if (!supportedFormatIds.length) throw new Error(setupErrors.quaggaFormats);
  try {
    await prepareQuaggaDecoder();
  } catch {
    throw new Error(setupErrors.quaggaInitialization);
  }
  return {
    decode: (canvas) => decodeCanvasWithQuagga(canvas, supportedFormatIds),
    dispose() {},
  };
}

export function getEngineFailureMessage(engine: ScannerEnginePreference) {
  if (engine === "native") {
    return "BarcodeDetector API stopped responding. Choose ZXing JS in settings.";
  }
  if (engine === "quagga") {
    return "Quagga2 stopped responding. Choose ZXing JS in settings.";
  }
  return "ZXing JS stopped responding. Restart the scanner and try again.";
}

export async function createScannerFrameDecoder(
  engine: ScannerEnginePreference,
  formatIds: BarcodeFormatId[],
  NativeDetector?: NativeBarcodeDetectorConstructor,
) {
  if (engine === "native") return createNativeDecoder(formatIds, NativeDetector);
  if (engine === "quagga") return createQuaggaDecoder(formatIds);
  return createZXingDecoder(formatIds);
}
