import { normalizeFormat } from "./barcodes";
import type { ExportFormat, ScanProject, ScanRecord } from "./models";

export type ExportPayload = {
  label: string;
  filename: string;
  mimeType: string;
  content: string;
};

function safeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";
}

function safeCsvCell(value: string) {
  const protectedValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${protectedValue.replaceAll('"', '""')}"`;
}

export function createExportPayload(
  format: ExportFormat,
  project: ScanProject,
  records: ScanRecord[],
): ExportPayload {
  const date = new Date().toISOString().slice(0, 10);
  const stem = `scanflow-${safeFileName(project.name)}-${date}`;

  if (format === "txt") {
    return {
      label: "TXT",
      filename: `${stem}.txt`,
      mimeType: "text/plain;charset=utf-8",
      content: [...records]
        .reverse()
        .map((record) => record.value.replace(/[\r\n]+/g, ""))
        .join("\r\n"),
    };
  }

  if (format === "json") {
    return {
      label: "JSON",
      filename: `${stem}.json`,
      mimeType: "application/json;charset=utf-8",
      content: JSON.stringify(
        {
          project,
          exportedAt: new Date().toISOString(),
          entries: [...records].reverse(),
        },
        null,
        2,
      ),
    };
  }

  const rows = [...records].reverse().map((record, index) =>
    [
      String(index + 1),
      record.value,
      normalizeFormat(record.format),
      String(record.scanCount),
      new Date(record.scannedAt).toLocaleString("en-US", { hour12: false }),
      record.source === "camera" ? "Camera" : "Manual",
    ]
      .map(safeCsvCell)
      .join(","),
  );
  const header = ["Index", "Barcode", "Format", "Scan Count", "Last Scanned At", "Last Source"]
    .map(safeCsvCell)
    .join(",");
  return {
    label: "CSV",
    filename: `${stem}.csv`,
    mimeType: "text/csv;charset=utf-8",
    content: [header, ...rows].join("\r\n"),
  };
}

export function downloadExportPayload(payload: ExportPayload, includeBom = false) {
  const blob = new Blob([includeBom ? `\uFEFF${payload.content}` : payload.content], {
    type: payload.mimeType,
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = payload.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
