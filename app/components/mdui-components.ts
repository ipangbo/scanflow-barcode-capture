let loadingPromise: Promise<unknown[]> | null = null;

export function loadMduiComponents() {
  loadingPromise ??= Promise.all([
    import("mdui/components/button.js"),
    import("mdui/components/button-icon.js"),
    import("mdui/components/card.js"),
    import("mdui/components/checkbox.js"),
    import("mdui/components/chip.js"),
    import("mdui/components/circular-progress.js"),
    import("mdui/components/dialog.js"),
    import("mdui/components/menu-item.js"),
    import("mdui/components/radio.js"),
    import("mdui/components/radio-group.js"),
    import("mdui/components/ripple.js"),
    import("mdui/components/select.js"),
    import("mdui/components/slider.js"),
    import("mdui/components/snackbar.js"),
    import("mdui/components/switch.js"),
    import("mdui/components/text-field.js"),
    import("mdui/components/tooltip.js"),
  ]);
  return loadingPromise;
}
