import {
  ArrowLeft,
  Braces,
  Download,
  FileSpreadsheet,
  FileText,
  Mail,
} from "lucide-react";
import type { ExportFormat, ScanProject } from "../lib/models";

type ExportPageProps = {
  project: ScanProject;
  entryCount: number;
  totalScanCount: number;
  onClose: () => void;
  onDownload: (format: ExportFormat) => void;
  onEmail: (format: ExportFormat) => void;
};

export function ExportPage({
  project,
  entryCount,
  totalScanCount,
  onClose,
  onDownload,
  onEmail,
}: ExportPageProps) {
  return (
    <section
      className="export-page"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-page-title"
    >
      <div className="export-page-shell">
        <header className="export-page-header">
          <button type="button" onClick={onClose}>
            <ArrowLeft size={17} /> Back to scanner
          </button>
          <div className="export-page-title">
            <p className="panel-kicker">Export</p>
            <h2 id="export-page-title">Share “{project.name}”</h2>
            <div className="export-page-stats" aria-label={`${entryCount} entries and ${totalScanCount} scans`}>
              <span><strong>{entryCount}</strong> entries</span>
              <span><strong>{totalScanCount}</strong> scans</span>
            </div>
          </div>
        </header>

        <div className="export-choice-grid">
          <article className="export-choice">
            <div className="export-choice-heading">
              <span className="export-choice-icon"><FileText size={20} /></span>
              <span className="export-extension">.TXT</span>
              <h3>Plain barcode values</h3>
            </div>
            <div className="export-choice-copy">
              <p>One aggregated barcode value per line. No headings or extra information.</p>
              <code>U12345678<br />U87654321</code>
            </div>
            <div className="export-choice-actions">
              <button className="is-primary" type="button" onClick={() => onDownload("txt")}>
                <Download size={16} /> Download
              </button>
              <button type="button" onClick={() => onEmail("txt")}>
                <Mail size={16} /> Email
              </button>
            </div>
          </article>

          <article className="export-choice">
            <div className="export-choice-heading">
              <span className="export-choice-icon"><FileSpreadsheet size={20} /></span>
              <span className="export-extension">.CSV</span>
              <h3>Spreadsheet-ready data</h3>
            </div>
            <div className="export-choice-copy">
              <p>Barcode values, formats, scan counts, timestamps, and the last source.</p>
              <code>Barcode, Format, Scan Count</code>
            </div>
            <div className="export-choice-actions">
              <button className="is-primary" type="button" onClick={() => onDownload("csv")}>
                <Download size={16} /> Download
              </button>
              <button type="button" onClick={() => onEmail("csv")}>
                <Mail size={16} /> Email
              </button>
            </div>
          </article>

          <article className="export-choice">
            <div className="export-choice-heading">
              <span className="export-choice-icon"><Braces size={20} /></span>
              <span className="export-extension">.JSON</span>
              <h3>Structured project data</h3>
            </div>
            <div className="export-choice-copy">
              <p>The project metadata and complete entry objects for system import.</p>
              <code>{`{ "project": …, "entries": […] }`}</code>
            </div>
            <div className="export-choice-actions">
              <button className="is-primary" type="button" onClick={() => onDownload("json")}>
                <Download size={16} /> Download
              </button>
              <button type="button" onClick={() => onEmail("json")}>
                <Mail size={16} /> Email
              </button>
            </div>
          </article>
        </div>

        <div className="email-export-note">
          <Mail size={17} />
          <p><strong>Email opens your default mail app.</strong><span>The selected export is placed in the message body.</span></p>
        </div>
      </div>
    </section>
  );
}
