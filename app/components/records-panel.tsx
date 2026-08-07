import {
  Check,
  CloudOff,
  Copy,
  Download,
  Repeat2,
  ScanLine,
  Search,
  Trash2,
} from "lucide-react";
import { normalizeFormat } from "../lib/barcodes";
import type { ScanRecord } from "../lib/models";
import { HoverTooltip } from "./hover-tooltip";

type RecordsPanelProps = {
  activeRecords: ScanRecord[];
  filteredRecords: ScanRecord[];
  hydrated: boolean;
  query: string;
  copiedId: string | null;
  onQueryChange: (query: string) => void;
  onClearRecords: () => void;
  onOpenExport: () => void;
  onCopy: (record: ScanRecord) => void;
  onDelete: (recordId: string) => void;
};

export function RecordsPanel({
  activeRecords,
  filteredRecords,
  hydrated,
  query,
  copiedId,
  onQueryChange,
  onClearRecords,
  onOpenExport,
  onCopy,
  onDelete,
}: RecordsPanelProps) {
  return (
    <div className="records-panel">
      <div className="panel-heading records-heading">
        <div>
          <h2>Entries <span>{activeRecords.length}</span></h2>
        </div>
        <mdui-button
          className="clear-button"
          type="button"
          variant="text"
          onClick={onClearRecords}
          disabled={!activeRecords.length}
        >
          <Trash2 slot="icon" size={15} /> Clear all
        </mdui-button>
      </div>

      <div className="record-tools">
        <mdui-text-field
          className="search-box"
          type="search"
          variant="outlined"
          value={query}
          clearable
          onInput={(event) => onQueryChange((event.currentTarget as HTMLElement & { value: string }).value)}
          placeholder="Search barcode or format"
          aria-label="Search scans"
        >
          <Search slot="icon" size={17} />
        </mdui-text-field>
        <mdui-button
          className="export-open-button"
          type="button"
          variant="filled"
          onClick={onOpenExport}
          disabled={!activeRecords.length}
        >
          <Download slot="icon" size={16} /> Export
        </mdui-button>
      </div>

      <div className="records-list" aria-live="polite">
        {!hydrated ? (
          <div className="empty-state"><mdui-circular-progress className="spinner dark" /><p>Loading local scans…</p></div>
        ) : filteredRecords.length ? (
          filteredRecords.map((record, index) => (
            <mdui-card className="record-row" variant="filled" key={record.id}>
              <span className="record-number">{String(filteredRecords.length - index).padStart(2, "0")}</span>
              <div className="record-main">
                <div className="record-value-line">
                  <mdui-button
                    className={copiedId === record.id ? "is-copied" : ""}
                    variant="text"
                    type="button"
                    onClick={() => onCopy(record)}
                    aria-label={`Copy barcode ${record.value}`}
                  >
                    <strong>{record.value}</strong>
                    {copiedId === record.id
                      ? <Check slot="end-icon" size={14} aria-hidden="true" />
                      : <Copy slot="end-icon" size={14} aria-hidden="true" />}
                  </mdui-button>
                </div>
                <div className="record-meta">
                  <mdui-chip variant="assist" className="format-chip">{normalizeFormat(record.format)}</mdui-chip>
                  <mdui-chip variant="assist" className={`scan-count ${record.scanCount > 1 ? "is-repeat" : ""}`}>
                    <Repeat2 slot="icon" size={12} aria-hidden="true" />
                    {record.scanCount} {record.scanCount === 1 ? "scan" : "scans"}
                  </mdui-chip>
                  <time dateTime={record.scannedAt}>
                    {new Date(record.scannedAt).toLocaleString("en-US", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: false,
                    })}
                  </time>
                </div>
              </div>
              <HoverTooltip content="Delete entry" placement="left">
                <mdui-button-icon
                  className="delete-record"
                  variant="outlined"
                  onClick={() => onDelete(record.id)}
                  aria-label={`Delete barcode ${record.value}`}
                >
                  <Trash2 size={16} />
                </mdui-button-icon>
              </HoverTooltip>
            </mdui-card>
          ))
        ) : (
          <div className="empty-state">
            <span className="empty-icon"><ScanLine size={27} /></span>
            <h3>{query ? "No matching entries" : "Your first entry will appear here"}</h3>
            <p>{query ? "Try another search." : "Scan a barcode or add one manually to this project."}</p>
          </div>
        )}
      </div>

      <aside className="storage-note" role="note">
        <CloudOff size={15} aria-hidden="true" />
        <p>
          <strong>Stored only in this browser.</strong> Entries are not saved to the cloud.
          Clearing browser data may permanently remove them.
        </p>
      </aside>
    </div>
  );
}
