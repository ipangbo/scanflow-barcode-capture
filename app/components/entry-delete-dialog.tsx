import { AlertTriangle, Trash2, X } from "lucide-react";

export type EntryDeletePrompt =
  | {
      kind: "single";
      recordId: string;
      value: string;
    }
  | {
      kind: "clear";
      step: 1 | 2;
      projectId: string;
      projectName: string;
      entryCount: number;
    };

type EntryDeleteDialogProps = {
  prompt: EntryDeletePrompt;
  onCancel: () => void;
  onContinue: () => void;
  onConfirm: () => void;
};

export function EntryDeleteDialog({
  prompt,
  onCancel,
  onContinue,
  onConfirm,
}: EntryDeleteDialogProps) {
  const isSingle = prompt.kind === "single";
  const isFinalClear = prompt.kind === "clear" && prompt.step === 2;
  const title = isSingle
    ? "Delete entry?"
    : isFinalClear
      ? "Final confirmation"
      : "Clear all entries?";

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        className="project-dialog confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-delete-dialog-title"
      >
        <div className="dialog-heading">
          <div>
            <p className="panel-kicker">Entries</p>
            <h2 id="entry-delete-dialog-title">{title}</h2>
          </div>
          <button
            className="dialog-close"
            type="button"
            onClick={onCancel}
            aria-label="Cancel deletion"
          >
            <X size={18} />
          </button>
        </div>

        <div className={`confirm-dialog-message ${isFinalClear ? "is-final" : ""}`}>
          <AlertTriangle size={19} aria-hidden="true" />
          {isSingle ? (
            <p>
              Delete <code>{prompt.value}</code> from this project? This can’t be undone.
            </p>
          ) : isFinalClear ? (
            <p>
              This permanently deletes all <strong>{prompt.entryCount}</strong> entries from
              “{prompt.projectName}”.
            </p>
          ) : (
            <p>
              Remove all <strong>{prompt.entryCount}</strong> entries from “{prompt.projectName}”?
              You’ll be asked once more before anything is deleted.
            </p>
          )}
        </div>

        <div className={`dialog-actions confirm-actions ${isFinalClear ? "is-reversed" : ""}`}>
          {isFinalClear ? (
            <>
              <button className="dialog-danger" type="button" onClick={onConfirm}>
                <Trash2 size={15} /> Clear all
              </button>
              <button type="button" onClick={onCancel}>Cancel</button>
            </>
          ) : (
            <>
              <button type="button" onClick={onCancel}>Cancel</button>
              <button
                className="dialog-danger"
                type="button"
                onClick={isSingle ? onConfirm : onContinue}
              >
                {isSingle ? <><Trash2 size={15} /> Delete</> : "Continue"}
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
