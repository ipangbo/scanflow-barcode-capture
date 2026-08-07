let coreLoadingPromise: Promise<unknown[]> | null = null;
let dialogLoadingPromise: Promise<unknown> | null = null;
let settingsLoadingPromise: Promise<unknown[]> | null = null;
let scannerLoadingPromise: Promise<unknown> | null = null;

export function loadMduiCoreComponents() {
  coreLoadingPromise ??= Promise.all([
    import("mdui/components/button.js"),
    import("mdui/components/button-icon.js"),
    import("mdui/components/badge.js"),
    import("mdui/components/card.js"),
    import("mdui/components/chip.js"),
    import("mdui/components/circular-progress.js"),
    import("mdui/components/menu-item.js"),
    import("mdui/components/navigation-bar.js"),
    import("mdui/components/navigation-bar-item.js"),
    import("mdui/components/ripple.js"),
    import("mdui/components/select.js"),
    import("mdui/components/snackbar.js"),
    import("mdui/components/text-field.js"),
    import("mdui/components/tooltip.js"),
  ]);
  return coreLoadingPromise;
}

export function loadMduiDialogComponents() {
  dialogLoadingPromise ??= import("mdui/components/dialog.js");
  return dialogLoadingPromise;
}

export function loadMduiSettingsComponents() {
  settingsLoadingPromise ??= Promise.all([
    loadMduiDialogComponents(),
    import("mdui/components/checkbox.js"),
    import("mdui/components/radio.js"),
    import("mdui/components/radio-group.js"),
  ]);
  return settingsLoadingPromise;
}

export function loadMduiScannerComponents() {
  scannerLoadingPromise ??= import("mdui/components/slider.js");
  return scannerLoadingPromise;
}
