import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the barcode capture workspace", async () => {
  const versionSource = await readSource("app/build-version.ts");
  const buildNumber = versionSource.match(/BUILD_NUMBER = (\d+)/)?.[1];
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>ScanFlow \| Continuous Barcode Scanning &amp; Local Export<\/title>/i);
  assert.match(html, /Active project/);
  assert.match(html, /Inbox/);
  assert.match(html, /University ID/);
  assert.match(html, /Start continuous scan/);
  assert.match(html, /Your phone and barcode must have the same orientation/);
  assert.doesNotMatch(html, /Portrait with portrait/);
  assert.match(html, /Entries/);
  assert.match(html, /<strong>0<\/strong>[\s\S]*?scans/);
  assert.ok(buildNumber, "build number should be readable");
  assert.match(html, new RegExp(`Build\\s*(?:<!-- -->)?${buildNumber}`));
  assert.doesNotMatch(html, /Device only/);
  assert.doesNotMatch(html, /01\s*\/\s*CAPTURE|02\s*\/\s*ENTRIES/i);
  assert.doesNotMatch(html, /Download or email this project/);
  assert.doesNotMatch(html, /Privacy first/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
  assert.match(html, /https:\/\/github\.com\/ipangbo\/scanflow-barcode-capture/);
});

test("the page is split into maintainable feature modules", async () => {
  const pageSource = await readSource("app/page.tsx");
  const requiredModules = [
    "components/scanner-panel",
    "components/records-panel",
    "components/scanner-settings-dialog",
    "components/export-page",
    "lib/barcodes",
    "lib/storage",
    "lib/exports",
    "lib/scanner-runtime",
    "lib/scanner-engines",
  ];

  for (const moduleName of requiredModules) {
    assert.match(pageSource, new RegExp(`from "\\./${moduleName}"`));
  }
  assert.ok(pageSource.split("\n").length < 1100, "page orchestration should remain focused");
});

test("mobile navigation separates scanning and entries without changing desktop columns", async () => {
  const [pageSource, navigationSource, componentLoader, scannerSource, recordsSource, stylesheet] = await Promise.all([
    readSource("app/page.tsx"),
    readSource("app/components/mobile-navigation.tsx"),
    readSource("app/components/mdui-components.ts"),
    readSource("app/components/scanner-panel.tsx"),
    readSource("app/components/records-panel.tsx"),
    readSource("app/globals.css"),
  ]);

  assert.match(pageSource, /mobileWorkspaceView/);
  assert.match(navigationSource, /<mdui-navigation-bar/);
  assert.match(navigationSource, /value="scanner"/);
  assert.match(navigationSource, /value="entries"/);
  assert.match(navigationSource, /className="mobile-entry-count"/);
  assert.doesNotMatch(navigationSource, /slot="badge"/);
  assert.doesNotMatch(navigationSource, /scrollIntoView|requestAnimationFrame/);
  assert.match(componentLoader, /components\/navigation-bar\.js/);
  assert.match(scannerSource, /mobile-view-/);
  assert.match(recordsSource, /mobile-view-/);
  assert.match(stylesheet, /\.mobile-navigation \{ display: none !important; \}/);
  assert.match(stylesheet, /@media \(max-width: 720px\)[\s\S]*\.workspace > \.mobile-view-inactive \{ display: none; \}/);
  assert.match(stylesheet, /mdui-navigation-bar-item::part\(container\)\s*\{[^}]*flex-direction: row/s);
  assert.match(stylesheet, /mdui-navigation-bar-item::part\(indicator\)\s*\{[^}]*flex: 0 0 auto/s);
  assert.doesNotMatch(stylesheet, /mdui-navigation-bar-item::part\(indicator\)\s*\{[^}]*width: 32px/s);
  assert.match(stylesheet, /height: calc\(56px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(stylesheet, /\.workspace \{ min-height: 0; border-radius: 14px; \}/);
  assert.match(stylesheet, /\.mobile-navigation \.mobile-entry-count\s*\{/);
  assert.match(stylesheet, /\.workspace \{[\s\S]*grid-template-columns: minmax\(0, 1\.04fr\) minmax\(420px, 0\.96fr\)/);
});

test("repeat scans use a distinct confirmation treatment", async () => {
  const [pageSource, scannerPanelSource, stylesheet] = await Promise.all([
    readSource("app/page.tsx"),
    readSource("app/components/scanner-panel.tsx"),
    readSource("app/globals.css"),
  ]);

  assert.match(scannerPanelSource, /Scanned again/);
  assert.match(scannerPanelSource, /formatOrdinal\(lastScanCount\)/);
  assert.match(scannerPanelSource, /key=\{lastScan\.eventId\}/);
  assert.match(pageSource, /setLastScan\(\{ eventId, record \}\)/);
  assert.match(stylesheet, /\.capture-confirmation\.is-repeat\s*\{[^}]*var\(--coral\)/s);
  assert.match(stylesheet, /@keyframes capture-in\s*\{[\s\S]*68%/);
});

test("continuous scanning has strong multi-channel feedback", async () => {
  const [pageSource, scannerPanelSource, counterSource, stylesheet] = await Promise.all([
    readSource("app/page.tsx"),
    readSource("app/components/scanner-panel.tsx"),
    readSource("app/components/scan-counter.tsx"),
    readSource("app/globals.css"),
  ]);

  assert.match(scannerPanelSource, /className=\{`scan-flash is-\$\{scanCue\.kind\}`\}/);
  assert.match(counterSource, /className=\{`scan-counter/);
  assert.match(scannerPanelSource, /key=\{lastScan\?\.eventId \?\? "scan-counter-idle"\}/);
  assert.match(counterSource, /const previousTotal = isAnimating \? Math\.max\(0, total - 1\)/);
  assert.match(counterSource, /className="scan-counter-reel"/);
  assert.match(counterSource, />scanned<\/span>/);
  assert.doesNotMatch(counterSource, />saved<\/span>/);
  assert.match(scannerPanelSource, /\? "Scanning"/);
  assert.doesNotMatch(scannerPanelSource, /Scanning · Enhanced/);
  assert.match(scannerPanelSource, /Verifying…/);
  assert.match(scannerPanelSource, /Digits only/);
  assert.match(pageSource, /kind === "repeat" \? \[38, 36, 38\] : 55/);
  assert.match(pageSource, /frequency: 940/);
  assert.match(pageSource, /frequency: 520/);
  assert.match(stylesheet, /\.scan-flash\.is-saved\s*\{/);
  assert.match(stylesheet, /\.scan-flash\.is-repeat\s*\{/);
  assert.match(stylesheet, /\.scan-counter\.is-counting \.scan-counter-digit\.is-rolling \.scan-counter-reel\s*\{/);
  assert.match(stylesheet, /@keyframes counter-roll\s*\{/);
  assert.doesNotMatch(stylesheet, /backdrop-filter:\s*blur\(7px\)/);
});

test("successful scans render their detected barcode region", async () => {
  const [pageSource, scannerPanelSource, scannerEnginesSource, stylesheet] = await Promise.all([
    readSource("app/page.tsx"),
    readSource("app/components/scanner-panel.tsx"),
    readSource("app/lib/scanner-engines.ts"),
    readSource("app/globals.css"),
  ]);

  assert.match(scannerEnginesSource, /result\.cornerPoints/);
  assert.match(scannerEnginesSource, /result\.getResultPoints\(\)/);
  assert.match(pageSource, /revealDetectionRegion\(result\.points\)/);
  assert.match(scannerPanelSource, /className="detected-region"/);
  assert.match(stylesheet, /\.detected-region\s*\{/);
});

test("live scanning extends a masked preview only inside the scanner stage", async () => {
  const [scannerPanelSource, stylesheet] = await Promise.all([
    readSource("app/components/scanner-panel.tsx"),
    readSource("app/globals.css"),
  ]);

  assert.doesNotMatch(scannerPanelSource, /scanner-ambient-video/);
  assert.doesNotMatch(stylesheet, /scanner-ambient-video|scanner-ambient-scrim/);
  assert.match(scannerPanelSource, /className="scan-area-mask"/);
  assert.match(stylesheet, /\.scan-area-mask\s*\{[^}]*100vmax/s);
  assert.match(stylesheet, /\.scan-frame\s*\{[^}]*var\(--scan-frame-block-inset\)/s);
});

test("idle camera guidance stays inside the viewfinder corners", async () => {
  const [scannerPanelSource, stylesheet] = await Promise.all([
    readSource("app/components/scanner-panel.tsx"),
    readSource("app/globals.css"),
  ]);

  assert.match(scannerPanelSource, /Your phone and barcode must have the same orientation/);
  assert.match(stylesheet, /\.camera-placeholder p\s*\{[^}]*max-width:/s);
  assert.match(stylesheet, /\.camera-placeholder p\s*\{[^}]*text-wrap: balance/s);
});

test("mobile text inputs avoid iPhone Safari focus zoom", async () => {
  const stylesheet = await readSource("app/globals.css");

  assert.match(stylesheet, /@media \(max-width: 720px\) and \(pointer: coarse\)/);
  assert.match(stylesheet, /\.manual-entry mdui-text-field,[\s\S]*\.search-box,[\s\S]*\.project-dialog-form mdui-text-field/);
  assert.match(stylesheet, /\.project-select::part\(text-field__input\)/);
  assert.match(stylesheet, /font-size: 16px;[\s\S]*transform: scale\(0\.8125\)/);
  assert.match(stylesheet, /width: 123\.077%/);
  assert.match(stylesheet, /\.project-select,[\s\S]*touch-action: manipulation/);
});

test("entries explain their browser-only storage risk", async () => {
  const [recordsSource, stylesheet] = await Promise.all([
    readSource("app/components/records-panel.tsx"),
    readSource("app/globals.css"),
  ]);

  assert.match(recordsSource, /Stored only in this browser/);
  assert.match(recordsSource, /not saved to the cloud/);
  assert.match(recordsSource, /Clearing browser data may permanently remove them/);
  assert.match(stylesheet, /\.storage-note\s*\{/);
});

test("entry deletion is confirmed and clear-all requires two differently ordered steps", async () => {
  const [pageSource, dialogSource, stylesheet] = await Promise.all([
    readSource("app/page.tsx"),
    readSource("app/components/entry-delete-dialog.tsx"),
    readSource("app/globals.css"),
  ]);

  assert.match(pageSource, /requestDeleteRecord/);
  assert.match(pageSource, /requestClearRecords/);
  assert.match(pageSource, /continueClearRecords/);
  assert.match(pageSource, /entryDeletePrompt\.step !== 2/);
  assert.match(dialogSource, /Delete entry\?/);
  assert.match(dialogSource, /Clear all entries\?/);
  assert.match(dialogSource, /Final confirmation/);
  assert.match(dialogSource, /isFinalClear[\s\S]*Clear all[\s\S]*Cancel[\s\S]*Cancel[\s\S]*Delete/);
  assert.match(stylesheet, /\.dialog-danger\s*\{/);
});

test("MDUI feedback, motion, and dialog actions use native component behavior", async () => {
  const [pageSource, tooltipSource, projectBarSource, recordsSource, settingsSource, deleteDialogSource, componentLoader, stylesheet] = await Promise.all([
    readSource("app/page.tsx"),
    readSource("app/components/action-tooltip.tsx"),
    readSource("app/components/project-bar.tsx"),
    readSource("app/components/records-panel.tsx"),
    readSource("app/components/scanner-settings-dialog.tsx"),
    readSource("app/components/entry-delete-dialog.tsx"),
    readSource("app/components/mdui-components.ts"),
    readSource("app/globals.css"),
  ]);

  assert.match(pageSource, /<mdui-snackbar/);
  assert.doesNotMatch(pageSource, /className="toast"/);
  assert.doesNotMatch(stylesheet, /\.toast\s*\{/);
  assert.match(componentLoader, /components\/ripple\.js/);
  assert.match(componentLoader, /components\/tooltip\.js/);
  assert.match(stylesheet, /--mdui-state-layer-pressed:/);
  assert.match(stylesheet, /--mdui-motion-duration-short3/);
  assert.match(projectBarSource, /project-create[\s\S]*variant="outlined"/);
  assert.doesNotMatch(projectBarSource, /project-create[\s\S]*variant="tonal"/);
  assert.match(recordsSource, /slot="end-icon"/);
  assert.match(recordsSource, /<Repeat2 slot="icon"/);
  assert.match(pageSource, /<ActionTooltip/);
  assert.match(tooltipSource, /\(hover: hover\) and \(pointer: fine\)/);
  assert.match(tooltipSource, /customElements\.whenDefined\("mdui-tooltip"\)/);
  assert.match(tooltipSource, /trigger=\{supportsHover === true \? "hover" : "manual"\}/);
  assert.match(tooltipSource, /LONG_PRESS_DELAY_MS = 520/);
  assert.match(tooltipSource, /longPressTriggered = true/);
  assert.match(tooltipSource, /addEventListener\("pointerdown", handlePointerDown\)/);
  assert.match(tooltipSource, /addEventListener\("click", handleClick, true\)/);
  assert.match(tooltipSource, /event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\)/);
  assert.doesNotMatch(tooltipSource, /trigger="hover focus"/);
  assert.match(settingsSource, /slot="action"[\s\S]*form=\{formId\}/);
  assert.doesNotMatch(settingsSource, /settings-actions/);
  assert.match(deleteDialogSource, /slot="action"/);
});

test("dialogs and secondary pages preserve Material You enter and exit motion", async () => {
  const [bridgeSource, projectDialogSource, settingsSource, exportSource, pageSource, stylesheet] = await Promise.all([
    readSource("app/components/mdui-bridge.tsx"),
    readSource("app/components/project-dialog.tsx"),
    readSource("app/components/scanner-settings-dialog.tsx"),
    readSource("app/components/export-page.tsx"),
    readSource("app/page.tsx"),
    readSource("app/globals.css"),
  ]);

  assert.match(bridgeSource, /customElements\.whenDefined\("mdui-dialog"\)/);
  assert.match(bridgeSource, /requestAnimationFrame[\s\S]*element\.open = true/);
  assert.match(bridgeSource, /dialog\.open = false/);
  assert.match(bridgeSource, /addEventListener\("closed", handleClosed\)/);
  assert.doesNotMatch(bridgeSource, /className=\{className\}[\s\S]*\n\s+open/);
  assert.match(projectDialogSource, /requestMduiDialogClose\(event\.currentTarget\)/);
  assert.match(settingsSource, /if \(onSubmit\(event\)\) requestMduiDialogClose\(event\.currentTarget\)/);
  assert.doesNotMatch(pageSource, /setSettingsOpen\(false\);[\s\S]*Scanner settings saved/);
  assert.match(exportSource, /ExportPagePhase = "entering" \| "open" \| "closing"/);
  assert.match(exportSource, /onTransitionEnd/);
  assert.match(stylesheet, /\.export-page\.is-open/);
  assert.match(stylesheet, /\.export-page\.is-closing/);
  assert.match(stylesheet, /--mdui-motion-duration-medium4/);
  assert.match(stylesheet, /--mdui-motion-easing-emphasized-decelerate/);
  assert.match(stylesheet, /--mdui-motion-easing-emphasized-accelerate/);
  assert.doesNotMatch(stylesheet, /@keyframes export-page-in/);
});

test("project dialog and scanner feedback controls match the mobile interaction design", async () => {
  const [dialogSource, scannerSource, componentLoader, stylesheet] = await Promise.all([
    readSource("app/components/project-dialog.tsx"),
    readSource("app/components/scanner-panel.tsx"),
    readSource("app/components/mdui-components.ts"),
    readSource("app/globals.css"),
  ]);

  assert.match(dialogSource, /placeholder="e\.g\. Tutorial Week 3"/);
  assert.match(stylesheet, /\.project-dialog-form mdui-text-field \{ --mdui-color-background: 251, 250, 245;/);
  assert.doesNotMatch(scannerSource, /Every scan saves automatically on this device/);
  assert.doesNotMatch(scannerSource, /<mdui-switch/);
  assert.doesNotMatch(componentLoader, /components\/switch\.js/);
  assert.match(scannerSource, /<Vibrate size=\{20\}/);
  assert.match(scannerSource, /Turn vibration off/);
  assert.match(scannerSource, /aria-pressed=\{vibrationOn\}/);
  assert.match(stylesheet, /repeat\(3, 48px\)/);
});

test("camera zoom offers supported common presets and fine control", async () => {
  const [scannerPanelSource, stylesheet] = await Promise.all([
    readSource("app/components/scanner-panel.tsx"),
    readSource("app/globals.css"),
  ]);

  assert.match(scannerPanelSource, /ZOOM_PRESETS = \[0\.9, 1, 1\.2, 1\.5\]/);
  assert.match(scannerPanelSource, /value >= zoomRange\.min && value <= zoomRange\.max/);
  assert.match(scannerPanelSource, /Common camera zoom levels/);
  assert.match(scannerPanelSource, /variant="filter"/);
  assert.match(scannerPanelSource, /Fine camera zoom/);
  assert.match(scannerPanelSource, /<mdui-slider/);
  assert.match(stylesheet, /--mdui-color-surface: 32, 35, 31/);
  assert.match(stylesheet, /--mdui-color-secondary-container: 56, 67, 41/);
});

test("scanner modes constrain formats and include examples", async () => {
  const [pageSource, settingsSource, barcodesSource, scannerEnginesSource] = await Promise.all([
    readSource("app/page.tsx"),
    readSource("app/components/scanner-settings-dialog.tsx"),
    readSource("app/lib/barcodes.ts"),
    readSource("app/lib/scanner-engines.ts"),
  ]);

  assert.match(settingsSource, /University ID/);
  assert.match(settingsSource, /Universal/);
  assert.match(settingsSource, /Choose exactly which formats to recognize/);
  assert.match(settingsSource, /BarcodeDetector API/);
  assert.match(settingsSource, /ZXing JS/);
  assert.match(settingsSource, /Quagga2/);
  assert.match(settingsSource, /Recommended for all modes/);
  assert.match(settingsSource, /Optional 1D fallback/);
  assert.match(settingsSource, /slower 1D fallback/);
  assert.match(settingsSource, /especially for University ID/);
  assert.doesNotMatch(settingsSource, /Recommended for University ID/);
  assert.match(settingsSource, /@zxing\/browser/);
  assert.match(settingsSource, /@ericblade\/quagga2/);
  assert.match(pageSource, /recognitionEngine === "native"/);
  assert.match(scannerEnginesSource, /Choose ZXing JS in settings/);
  assert.match(barcodesSource, /UNIVERSITY_FORMAT_IDS[^;]+code_128/s);
  assert.match(barcodesSource, /example: "12345678"/);
  assert.match(barcodesSource, /example: "5901234123457"/);
  assert.match(barcodesSource, /example: "https:\/\/example\.edu"/);
  assert.match(scannerEnginesSource, /createHighAccuracyReader\(formatIds\)/);
});

test("settings dialog stays within the mobile visual viewport", async () => {
  const stylesheet = await readSource("app/globals.css");

  assert.match(stylesheet, /\.settings-dialog\s*\{[^}]*max-height: 100%/s);
  assert.match(stylesheet, /\.settings-dialog\s*\{[^}]*overscroll-behavior: contain/s);
  assert.match(stylesheet, /\.settings-dialog::part\(panel\)\s*\{[^}]*100dvh/s);
  assert.match(stylesheet, /\.settings-dialog::part\(panel\)\s*\{[^}]*env\(safe-area-inset-top\)/s);
  assert.match(stylesheet, /\.settings-dialog::part\(body\)\s*\{[^}]*overflow-y: auto/s);
});

test("camera results require confirmation and University IDs are numeric", async () => {
  const [pageSource, settingsSource, barcodesSource] = await Promise.all([
    readSource("app/page.tsx"),
    readSource("app/components/scanner-settings-dialog.tsx"),
    readSource("app/lib/barcodes.ts"),
  ]);

  assert.match(barcodesSource, /REQUIRED_DECODE_MATCHES = 2/);
  assert.match(barcodesSource, /DECODE_CONFIRMATION_WINDOW_MS = 700/);
  assert.match(pageSource, /scanMode === "university" && !\/\^\[0-9\]\+\$\/\.test\(trimmedValue\)/);
  assert.match(pageSource, /pending\.matches \+= 1/);
  assert.match(pageSource, /pending\.matches < REQUIRED_DECODE_MATCHES/);
  assert.match(settingsSource, /Code 128 · digits only · two-frame confirmation/);
});

test("iPhone Safari receives a native switch haptic fallback", async () => {
  const [pageSource, runtimeSource] = await Promise.all([
    readSource("app/page.tsx"),
    readSource("app/lib/scanner-runtime.ts"),
  ]);

  assert.match(runtimeSource, /input\.setAttribute\("switch", ""\)/);
  assert.match(pageSource, /if \(!vibrated\) triggerIOSSwitchHaptic\(\)/);
  assert.match(pageSource, /useState<ScannerMode>\("university"\)/);
});

test("repeat barcodes increment one aggregated entry", async () => {
  const [pageSource, storageSource, exportSource, recordsSource] = await Promise.all([
    readSource("app/page.tsx"),
    readSource("app/lib/storage.ts"),
    readSource("app/lib/exports.ts"),
    readSource("app/components/records-panel.tsx"),
  ]);

  assert.match(pageSource, /scanCount: existing\.scanCount \+ 1/);
  assert.match(pageSource, /currentRecords\.filter\(\(item\) => item\.id !== record\.id\)/);
  assert.match(storageSource, /existing\.scanCount \+= record\.scanCount/);
  assert.match(exportSource, /"Scan Count"/);
  assert.match(recordsSource, /record\.scanCount === 1 \? "scan" : "scans"/);
});

test("local storage keys and migrations remain backward compatible", async () => {
  const [storageSource, pageSource] = await Promise.all([
    readSource("app/lib/storage.ts"),
    readSource("app/page.tsx"),
  ]);

  assert.match(storageSource, /"liansao\.scans\.v1"/);
  assert.match(storageSource, /"liansao\.settings\.v1"/);
  assert.match(storageSource, /"scanflow\.projects\.v1"/);
  assert.match(storageSource, /typeof record\.scanCount === "number"/);
  assert.match(storageSource, /customFormats: customFormats\.length \? customFormats : \[\.\.\.ALL_FORMAT_IDS\]/);
  assert.match(storageSource, /settings\.recognitionEngine === "native"/);
  assert.match(storageSource, /settings\.recognitionEngine === "quagga"/);
  assert.match(storageSource, /recognitionEngine: hasExplicitRecognitionEngine \? settings\.recognitionEngine : "zxing"/);
  assert.match(pageSource, /setRecognitionEngineConfigured\(true\)/);
});

test("Quagga2 is available as a Code 128 focused third-party engine", async () => {
  const [pageSource, quaggaSource, modelsSource, scannerEnginesSource] = await Promise.all([
    readSource("app/page.tsx"),
    readSource("app/lib/quagga-decoder.ts"),
    readSource("app/lib/models.ts"),
    readSource("app/lib/scanner-engines.ts"),
  ]);

  assert.match(modelsSource, /"native" \| "zxing" \| "quagga"/);
  assert.match(quaggaSource, /code_128_reader/);
  assert.match(quaggaSource, /locate: true/);
  assert.match(quaggaSource, /decodeSingle/);
  assert.match(scannerEnginesSource, /decodeCanvasWithQuagga\(canvas, supportedFormatIds\)/);
  assert.match(scannerEnginesSource, /Quagga2 supports 1D barcodes only/);
  assert.match(pageSource, /createScannerFrameDecoder/);
});

test("TXT export contains only one barcode value per line", async () => {
  const [exportSource, exportPageSource] = await Promise.all([
    readSource("app/lib/exports.ts"),
    readSource("app/components/export-page.tsx"),
  ]);

  assert.match(exportSource, /format === "txt"/);
  assert.match(exportSource, /record\.value\.replace\(\/\[\\r\\n\]\+\/g, ""\)/);
  assert.match(exportSource, /\.join\("\\r\\n"\)/);
  assert.match(exportSource, /text\/plain;charset=utf-8/);
  assert.match(exportPageSource, /Plain barcode values/);
});

test("export uses one secondary page with download and email actions", async () => {
  const [pageSource, recordsSource, exportPageSource] = await Promise.all([
    readSource("app/page.tsx"),
    readSource("app/components/records-panel.tsx"),
    readSource("app/components/export-page.tsx"),
  ]);

  assert.match(recordsSource, /className="export-open-button"/);
  assert.match(exportPageSource, /className=\{`export-page is-\$\{phase\}`\}/);
  assert.match(exportPageSource, /className="export-page-stats"/);
  assert.match(exportPageSource, /className="export-choice-heading"/);
  assert.match(exportPageSource, /className="export-choice-icon"[^]*className="export-extension">\.TXT/);
  assert.match(exportPageSource, /Back to scanner/);
  assert.match(pageSource, /mailto:\?subject=/);
  assert.match(exportPageSource, /onEmail\("txt"\)/);
  assert.match(exportPageSource, /onEmail\("csv"\)/);
  assert.match(exportPageSource, /onEmail\("json"\)/);
  assert.match(exportPageSource, /The selected export is placed in the message body\./);
});

test("build number is shown in the footer and increments before builds", async () => {
  const [pageSource, packageSource, incrementSource] = await Promise.all([
    readSource("app/page.tsx"),
    readSource("package.json"),
    readSource("scripts/increment-build-version.mjs"),
  ]);

  assert.match(pageSource, /Build \{BUILD_NUMBER\}/);
  assert.match(packageSource, /"prebuild": "node scripts\/increment-build-version\.mjs"/);
  assert.match(incrementSource, /currentBuild \+ 1/);
});
