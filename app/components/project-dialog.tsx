import { X } from "lucide-react";
import type { FormEvent } from "react";
import type { ProjectDialogMode } from "../lib/models";
import { MduiDialog } from "./mdui-bridge";

type ProjectDialogProps = {
  mode: Exclude<ProjectDialogMode, null>;
  name: string;
  onNameChange: (name: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
};

export function ProjectDialog({
  mode,
  name,
  onNameChange,
  onSubmit,
  onClose,
}: ProjectDialogProps) {
  const isCreating = mode === "create";
  const formId = "project-dialog-form";

  return (
    <MduiDialog
      className="project-dialog"
      ariaLabelledBy="project-dialog-title"
      onDismiss={onClose}
    >
      <div className="dialog-heading">
        <div>
          <p className="panel-kicker">Project</p>
          <h2 id="project-dialog-title">
            {isCreating ? "New project" : "Rename project"}
          </h2>
        </div>
        <mdui-button-icon
          className="dialog-close"
          variant="outlined"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={18} />
        </mdui-button-icon>
      </div>
      <form
        id={formId}
        className="project-dialog-form"
        onSubmit={onSubmit}
      >
        <mdui-text-field
          id="project-name"
          variant="outlined"
          label="Project name"
          value={name}
          onInput={(event) => onNameChange((event.currentTarget as HTMLElement & { value: string }).value)}
          placeholder="e.g. August stocktake"
          maxlength={60}
          counter
          autofocus
        />
      </form>
      <mdui-button slot="action" variant="text" type="button" onClick={onClose}>Cancel</mdui-button>
      <mdui-button slot="action" className="dialog-primary" variant="filled" type="submit" form={formId} disabled={!name.trim()}>
        {isCreating ? "Create project" : "Save name"}
      </mdui-button>
    </MduiDialog>
  );
}
