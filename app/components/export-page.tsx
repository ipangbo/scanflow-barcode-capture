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
          <div>
            <p className="panel-kicker">Export</p>
            <h2 id="export-page-title">Share “{project.name}”</h2>
            <p>{entryCount} entries · {totalScanCount} scans</p>
          </div>
        </header>

        <div className="export-choice-grid">
          <article className="export-choice">
            <span className="export-choice-icon"><FileText size={23} /></span>
            <div className="export-choice-copy">
              <span className="export-extension">.TXT</span>
              <h3>Plain barcode values</h3>
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
            <span className="export-choice-icon"><FileSpreadsheet size={23} /></span>
            <div className="export-choice-copy">
              <span className="export-extension">.CSV</span>
              <h3>Spreadsheet-ready data</h3>
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
            <span className="export-choice-icon"><Braces size={23} /></span>
            <div className="export-choice-copy">
              <span className="export-extension">.JSON</span>
              <h3>Structured project data</h3>
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
