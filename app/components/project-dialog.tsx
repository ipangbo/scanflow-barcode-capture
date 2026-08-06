import { X } from "lucide-react";
import type { FormEvent } from "react";
import type { ProjectDialogMode } from "../lib/models";

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

  return (
    <div className="dialog-backdrop" role="presentation">
      <form
        className="project-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-dialog-title"
        onSubmit={onSubmit}
      >
        <div className="dialog-heading">
          <div>
            <p className="panel-kicker">Project</p>
            <h2 id="project-dialog-title">
              {isCreating ? "New project" : "Rename project"}
            </h2>
          </div>
          <button
            className="dialog-close"
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>
        <label htmlFor="project-name">Project name</label>
        <input
          id="project-name"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="e.g. August stocktake"
          maxLength={60}
        />
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="dialog-primary" type="submit" disabled={!name.trim()}>
            {isCreating ? "Create project" : "Save name"}
          </button>
        </div>
      </form>
    </div>
  );
}
