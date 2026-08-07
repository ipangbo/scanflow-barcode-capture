import { lazy } from "react";
import {
  loadMduiDialogComponents,
  loadMduiSettingsComponents,
} from "./mdui-components";

export const preloadExportPage = () => import("./export-page");

export const preloadEntryDeleteDialog = () =>
  Promise.all([
    import("./entry-delete-dialog"),
    loadMduiDialogComponents(),
  ]);

export const preloadProjectDialog = () =>
  Promise.all([
    import("./project-dialog"),
    loadMduiDialogComponents(),
  ]);

export const preloadScannerSettingsDialog = () =>
  Promise.all([
    import("./scanner-settings-dialog"),
    loadMduiSettingsComponents(),
  ]);

export const LazyExportPage = lazy(async () => {
  const loadedModule = await preloadExportPage();
  return { default: loadedModule.ExportPage };
});

export const LazyEntryDeleteDialog = lazy(async () => {
  const [loadedModule] = await preloadEntryDeleteDialog();
  return { default: loadedModule.EntryDeleteDialog };
});

export const LazyProjectDialog = lazy(async () => {
  const [loadedModule] = await preloadProjectDialog();
  return { default: loadedModule.ProjectDialog };
});

export const LazyScannerSettingsDialog = lazy(async () => {
  const [loadedModule] = await preloadScannerSettingsDialog();
  return { default: loadedModule.ScannerSettingsDialog };
});
