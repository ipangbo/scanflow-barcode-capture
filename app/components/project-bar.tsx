import {
  ChevronDown,
  FolderOpen,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { ScanProject } from "../lib/models";

type ProjectBarProps = {
  projects: ScanProject[];
  activeProjectId: string;
  entryCounts: ReadonlyMap<string, number>;
  activeEntryCount: number;
  totalScanCount: number;
  onSwitch: (projectId: string) => void;
  onCreate: () => void;
  onRename: () => void;
  onDelete: () => void;
};

export function ProjectBar({
  projects,
  activeProjectId,
  entryCounts,
  activeEntryCount,
  totalScanCount,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
}: ProjectBarProps) {
  const canDelete = projects.length > 1;

  return (
    <section className="project-bar" aria-label="Project controls">
      <div className="project-switcher">
        <span className="project-label">Active project</span>
        <label className="project-select">
          <FolderOpen size={17} />
          <span className="sr-only">Active project</span>
          <select
            value={activeProjectId}
            onChange={(event) => onSwitch(event.target.value)}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} · {entryCounts.get(project.id) ?? 0}
              </option>
            ))}
          </select>
          <ChevronDown size={15} aria-hidden="true" />
        </label>
      </div>
      <div className="project-summary" aria-label="Project statistics">
        <span><strong>{activeEntryCount}</strong> entries</span>
        <span><strong>{totalScanCount}</strong> scans</span>
      </div>
      <div className="project-actions">
        <button className="project-create" type="button" onClick={onCreate}>
          <Plus size={16} />
          <span>New project</span>
        </button>
        <button
          className="project-icon-action"
          type="button"
          onClick={onRename}
          aria-label="Rename project"
          title="Rename project"
        >
          <Pencil size={15} />
        </button>
        <button
          className="project-icon-action danger"
          type="button"
          onClick={onDelete}
          disabled={!canDelete}
          aria-label="Delete project"
          title={canDelete ? "Delete project" : "Create another project before deleting this one"}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </section>
  );
}
