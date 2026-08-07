import {
  FolderOpen,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { ScanProject } from "../lib/models";
import { MduiSelect } from "./mdui-bridge";

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
        <MduiSelect
          className="project-select"
          value={activeProjectId}
          ariaLabel="Active project"
          onValueChange={onSwitch}
        >
          <FolderOpen slot="icon" size={17} />
            {projects.map((project) => (
              <mdui-menu-item key={project.id} value={project.id}>
                {project.name} · {entryCounts.get(project.id) ?? 0}
              </mdui-menu-item>
            ))}
        </MduiSelect>
      </div>
      <div className="project-summary" aria-label="Project statistics">
        <mdui-chip variant="assist"><strong>{activeEntryCount}</strong> entries</mdui-chip>
        <mdui-chip variant="assist"><strong>{totalScanCount}</strong> scans</mdui-chip>
      </div>
      <div className="project-actions">
        <mdui-button className="project-create" type="button" variant="tonal" onClick={onCreate}>
          <Plus slot="icon" size={16} />
          <span>New project</span>
        </mdui-button>
        <mdui-button-icon
          className="project-icon-action"
          variant="outlined"
          onClick={onRename}
          aria-label="Rename project"
          title="Rename project"
        >
          <Pencil size={15} />
        </mdui-button-icon>
        <mdui-button-icon
          className="project-icon-action danger"
          variant="outlined"
          onClick={onDelete}
          disabled={!canDelete}
          aria-label="Delete project"
          title={canDelete ? "Delete project" : "Create another project before deleting this one"}
        >
          <Trash2 size={16} />
        </mdui-button-icon>
      </div>
    </section>
  );
}
