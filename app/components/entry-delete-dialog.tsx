import { AlertTriangle, Trash2, X } from "lucide-react";
import { MduiDialog, requestMduiDialogClose } from "./mdui-bridge";

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
    }
  | {
      kind: "project";
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
  const isProject = prompt.kind === "project";
  const isFinalClear = prompt.kind === "clear" && prompt.step === 2;
  const title = isSingle
    ? "Delete entry?"
    : isProject
      ? "Delete project?"
    : isFinalClear
      ? "Final confirmation"
      : "Clear all entries?";

  return (
    <MduiDialog
      className="project-dialog confirm-dialog"
      ariaLabelledBy="entry-delete-dialog-title"
      onDismiss={onCancel}
    >
        <div className="dialog-heading">
          <div>
            <p className="panel-kicker">Entries</p>
            <h2 id="entry-delete-dialog-title">{title}</h2>
          </div>
          <mdui-button-icon
            className="dialog-close"
            variant="outlined"
            onClick={(event) => requestMduiDialogClose(event.currentTarget)}
            aria-label="Cancel deletion"
          >
            <X size={18} />
          </mdui-button-icon>
        </div>

        <div className={`confirm-dialog-message ${isFinalClear ? "is-final" : ""}`}>
          <AlertTriangle size={19} aria-hidden="true" />
          {isSingle ? (
            <p>
              Delete <code>{prompt.value}</code> from this project? This can’t be undone.
            </p>
          ) : isProject ? (
            <p>
              Delete “{prompt.projectName}” and its <strong>{prompt.entryCount}</strong> {prompt.entryCount === 1 ? "entry" : "entries"}? This can’t be undone.
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

        {isFinalClear ? (
          <>
            <mdui-button slot="action" className="dialog-danger" variant="filled" type="button" onClick={(event) => { onConfirm(); requestMduiDialogClose(event.currentTarget); }}>
              <Trash2 slot="icon" size={15} /> Clear all
            </mdui-button>
            <mdui-button slot="action" variant="text" type="button" onClick={(event) => requestMduiDialogClose(event.currentTarget)}>Cancel</mdui-button>
          </>
        ) : (
          <>
            <mdui-button slot="action" variant="text" type="button" onClick={(event) => requestMduiDialogClose(event.currentTarget)}>Cancel</mdui-button>
            <mdui-button
              slot="action"
              className="dialog-danger"
              variant="filled"
              type="button"
              onClick={isSingle || isProject ? (event) => { onConfirm(); requestMduiDialogClose(event.currentTarget); } : onContinue}
            >
              {isSingle || isProject ? <><Trash2 slot="icon" size={15} /> Delete</> : "Continue"}
            </mdui-button>
          </>
        )}
    </MduiDialog>
  );
}
