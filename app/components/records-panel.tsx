import {
  Check,
  Copy,
  Download,
  Repeat2,
  ScanLine,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { normalizeFormat } from "../lib/barcodes";
import type { ScanRecord } from "../lib/models";

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
        <button
          className="clear-button"
          type="button"
          onClick={onClearRecords}
          disabled={!activeRecords.length}
        >
          <Trash2 size={15} /> Clear all
        </button>
      </div>

      <div className="record-tools">
        <label className="search-box">
          <Search size={17} />
          <span className="sr-only">Search scans</span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search barcode or format"
          />
          {query && (
            <button type="button" onClick={() => onQueryChange("")} aria-label="Clear search">
              <X size={15} />
            </button>
          )}
        </label>
        <button
          className="export-open-button"
          type="button"
          onClick={onOpenExport}
          disabled={!activeRecords.length}
        >
          <Download size={16} /> Export
        </button>
      </div>

      <div className="records-list" aria-live="polite">
        {!hydrated ? (
          <div className="empty-state"><span className="spinner dark" /><p>Loading local scans…</p></div>
        ) : filteredRecords.length ? (
          filteredRecords.map((record, index) => (
            <article className="record-row" key={record.id}>
              <span className="record-number">{String(filteredRecords.length - index).padStart(2, "0")}</span>
              <div className="record-main">
                <div className="record-value-line">
                  <button type="button" onClick={() => onCopy(record)} title="Copy barcode">
                    <strong>{record.value}</strong>
                    {copiedId === record.id ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                <div className="record-meta">
                  <span>{normalizeFormat(record.format)}</span>
                  <span className={`scan-count ${record.scanCount > 1 ? "is-repeat" : ""}`}>
                    <Repeat2 size={11} /> {record.scanCount} {record.scanCount === 1 ? "scan" : "scans"}
                  </span>
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
              <button
                className="delete-record"
                type="button"
                onClick={() => onDelete(record.id)}
                aria-label={`Delete barcode ${record.value}`}
              >
                <Trash2 size={16} />
              </button>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <span className="empty-icon"><ScanLine size={27} /></span>
            <h3>{query ? "No matching entries" : "Your first entry will appear here"}</h3>
            <p>{query ? "Try another search." : "Scan a barcode or add one manually to this project."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
