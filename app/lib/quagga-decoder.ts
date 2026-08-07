import type { BarcodeFormatId } from "./models";

type QuaggaStatic = typeof import("@ericblade/quagga2")["default"];

type QuaggaDecodeResult = {
  value: string;
  format: string;
  points: Array<{ x: number; y: number }>;
};

const QUAGGA_READER_NAMES: Partial<Record<BarcodeFormatId, string>> = {
  code_128: "code_128_reader",
  ean_13: "ean_reader",
  ean_8: "ean_8_reader",
  upc_a: "upc_reader",
  upc_e: "upc_e_reader",
  code_39: "code_39_reader",
  code_93: "code_93_reader",
  itf: "i2of5_reader",
  codabar: "codabar_reader",
};

const QUAGGA_FORMAT_NAMES: Record<string, string> = {
  code_128: "CODE_128",
  ean_13: "EAN_13",
  ean_8: "EAN_8",
  upc_a: "UPC_A",
  upc_e: "UPC_E",
  code_39: "CODE_39",
  code_93: "CODE_93",
  i2of5: "ITF",
  codabar: "CODABAR",
};

let quaggaPromise: Promise<QuaggaStatic> | null = null;

function loadQuagga() {
  quaggaPromise ??= import("@ericblade/quagga2").then((module) => module.default);
  return quaggaPromise;
}

export function prepareQuaggaDecoder() {
  return loadQuagga();
}

export function getQuaggaFormatIds(formatIds: BarcodeFormatId[]) {
  return formatIds.filter((formatId) => Boolean(QUAGGA_READER_NAMES[formatId]));
}

export async function decodeCanvasWithQuagga(
  canvas: HTMLCanvasElement,
  formatIds: BarcodeFormatId[],
): Promise<QuaggaDecodeResult | null> {
  const readers = getQuaggaFormatIds(formatIds)
    .map((formatId) => QUAGGA_READER_NAMES[formatId])
    .filter((reader): reader is string => Boolean(reader));
  if (!readers.length) return null;

  const Quagga = await loadQuagga();
  const result = await Quagga.decodeSingle({
    src: canvas.toDataURL("image/jpeg", 0.96),
    numOfWorkers: 0,
    locate: true,
    inputStream: {
      size: 0,
      singleChannel: false,
      willReadFrequently: true,
    },
    canvas: { createOverlay: false },
    locator: {
      halfSample: false,
      patchSize: "medium",
      willReadFrequently: true,
    },
    decoder: {
      readers,
      multiple: false,
    },
  });

  const value = result?.codeResult?.code?.trim();
  if (!value) return null;

  const boxPoints = Array.isArray(result.box)
    ? result.box
        .filter((point) => point.length >= 2)
        .map(([x, y]) => ({ x, y }))
    : [];
  const linePoints = Array.isArray(result.line)
    ? result.line.map(({ x, y }) => ({ x, y }))
    : [];

  return {
    value,
    format:
      QUAGGA_FORMAT_NAMES[result.codeResult.format] ??
      result.codeResult.format.toUpperCase(),
    points: boxPoints.length ? boxPoints : linePoints,
  };
}
