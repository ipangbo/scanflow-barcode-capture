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
          <mdui-button type="button" variant="outlined" onClick={onClose}>
            <ArrowLeft slot="icon" size={17} /> Back to scanner
          </mdui-button>
          <div className="export-page-title">
            <p className="panel-kicker">Export</p>
            <h2 id="export-page-title">Share “{project.name}”</h2>
            <div className="export-page-stats" aria-label={`${entryCount} entries and ${totalScanCount} scans`}>
              <mdui-chip variant="assist">
                <span className="export-stat-content"><strong>{entryCount}</strong><span>entries</span></span>
              </mdui-chip>
              <mdui-chip variant="assist">
                <span className="export-stat-content"><strong>{totalScanCount}</strong><span>scans</span></span>
              </mdui-chip>
            </div>
          </div>
        </header>

        <div className="export-choice-grid">
          <mdui-card className="export-choice" variant="outlined">
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
              <mdui-button className="is-primary" variant="filled" type="button" onClick={() => onDownload("txt")}>
                <Download slot="icon" size={16} /> Download
              </mdui-button>
              <mdui-button variant="tonal" type="button" onClick={() => onEmail("txt")}>
                <Mail slot="icon" size={16} /> Email
              </mdui-button>
            </div>
          </mdui-card>

          <mdui-card className="export-choice" variant="outlined">
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
              <mdui-button className="is-primary" variant="filled" type="button" onClick={() => onDownload("csv")}>
                <Download slot="icon" size={16} /> Download
              </mdui-button>
              <mdui-button variant="tonal" type="button" onClick={() => onEmail("csv")}>
                <Mail slot="icon" size={16} /> Email
              </mdui-button>
            </div>
          </mdui-card>

          <mdui-card className="export-choice" variant="outlined">
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
              <mdui-button className="is-primary" variant="filled" type="button" onClick={() => onDownload("json")}>
                <Download slot="icon" size={16} /> Download
              </mdui-button>
              <mdui-button variant="tonal" type="button" onClick={() => onEmail("json")}>
                <Mail slot="icon" size={16} /> Email
              </mdui-button>
            </div>
          </mdui-card>
        </div>

        <div className="email-export-note">
          <Mail size={17} />
          <p><strong>Email opens your default mail app.</strong><span>The selected export is placed in the message body.</span></p>
        </div>
      </div>
    </section>
  );
}
