import { BarcodeFormat, BrowserMultiFormatReader } from "@zxing/browser";
import { DecodeHintType } from "@zxing/library";
import { FRAME_INTERVAL_MS } from "./barcodes";
import type { BarcodeFormatId } from "./models";
import type { ScannerFrameDecoder } from "./scanner-engines";

const zxingFormats: Record<BarcodeFormatId, BarcodeFormat> = {
  code_128: BarcodeFormat.CODE_128,
  ean_13: BarcodeFormat.EAN_13,
  ean_8: BarcodeFormat.EAN_8,
  upc_a: BarcodeFormat.UPC_A,
  upc_e: BarcodeFormat.UPC_E,
  code_39: BarcodeFormat.CODE_39,
  code_93: BarcodeFormat.CODE_93,
  itf: BarcodeFormat.ITF,
  codabar: BarcodeFormat.CODABAR,
  qr_code: BarcodeFormat.QR_CODE,
  data_matrix: BarcodeFormat.DATA_MATRIX,
  pdf417: BarcodeFormat.PDF_417,
  aztec: BarcodeFormat.AZTEC,
};

export function createZXingFrameDecoder(
  formatIds: BarcodeFormatId[],
): ScannerFrameDecoder {
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(
    DecodeHintType.POSSIBLE_FORMATS,
    formatIds.map((formatId) => zxingFormats[formatId]),
  );
  hints.set(DecodeHintType.TRY_HARDER, true);
  hints.set(DecodeHintType.ASSUME_GS1, true);

  const reader = new BrowserMultiFormatReader(hints, {
    delayBetweenScanAttempts: FRAME_INTERVAL_MS,
    delayBetweenScanSuccess: 220,
  });

  return {
    async decode(canvas) {
      try {
        const result = reader.decodeFromCanvas(canvas);
        return {
          value: result.getText(),
          format: BarcodeFormat[result.getBarcodeFormat()] ?? "UNKNOWN",
          points: (result.getResultPoints() ?? []).map((point) => ({
            x: point.getX(),
            y: point.getY(),
          })),
        };
      } catch {
        return null;
      }
    },
    dispose() {},
  };
}
