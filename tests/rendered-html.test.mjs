import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
  const versionSource = await readFile(new URL("../app/build-version.ts", import.meta.url), "utf8");
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
  assert.match(html, /Entries/);
  assert.match(html, /<strong>0<\/strong> scans/);
  assert.ok(buildNumber, "build number should be readable");
  assert.match(html, new RegExp(`Build\\s*(?:<!-- -->)?${buildNumber}`));
  assert.doesNotMatch(html, /Device only/);
  assert.doesNotMatch(html, /Download or email this project/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("repeat scans use a distinct confirmation treatment", async () => {
  const [pageSource, stylesheet] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /Scanned again/);
  assert.match(pageSource, /formatOrdinal\(lastScanCount\)/);
  assert.match(pageSource, /key=\{lastScan\.eventId\}/);
  assert.match(pageSource, /setLastScan\(\{ eventId, record \}\)/);
  assert.match(stylesheet, /\.capture-confirmation\.is-repeat\s*\{[^}]*var\(--coral\)/s);
  assert.match(stylesheet, /@keyframes capture-in\s*\{[\s\S]*68%/);
});

test("continuous scanning has strong multi-channel feedback", async () => {
  const [pageSource, stylesheet] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /className=\{`scan-flash is-\$\{scanCue\.kind\}`\}/);
  assert.match(pageSource, /className=\{`scan-total/);
  assert.match(pageSource, /Verifying…/);
  assert.match(pageSource, /Digits only/);
  assert.match(pageSource, /kind === "repeat" \? \[38, 36, 38\] : 55/);
  assert.match(pageSource, /frequency: 940/);
  assert.match(pageSource, /frequency: 520/);
  assert.match(stylesheet, /\.scan-flash\.is-saved\s*\{/);
  assert.match(stylesheet, /\.scan-flash\.is-repeat\s*\{/);
  assert.match(stylesheet, /\.scan-total\.is-updated\s*\{/);
});

test("successful scans render their detected barcode region", async () => {
  const [pageSource, stylesheet] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /result\.cornerPoints/);
  assert.match(pageSource, /result\.getResultPoints\(\)/);
  assert.match(pageSource, /className="detected-region"/);
  assert.match(stylesheet, /\.detected-region\s*\{/);
});

test("scanner modes constrain formats and include examples", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(pageSource, /University ID/);
  assert.match(pageSource, /Universal/);
  assert.match(pageSource, /Choose exactly which formats to recognize/);
  assert.match(pageSource, /UNIVERSITY_FORMAT_IDS[^;]+code_128/s);
  assert.match(pageSource, /example: "12345678"/);
  assert.match(pageSource, /example: "5901234123457"/);
  assert.match(pageSource, /example: "https:\/\/example\.edu"/);
  assert.match(pageSource, /createHighAccuracyReader\(enabledFormatIds\)/);
});

test("camera results require confirmation and University IDs are numeric", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(pageSource, /REQUIRED_DECODE_MATCHES = 2/);
  assert.match(pageSource, /DECODE_CONFIRMATION_WINDOW_MS = 700/);
  assert.match(pageSource, /scanMode === "university" && !\/\^\[0-9\]\+\$\/\.test\(trimmedValue\)/);
  assert.match(pageSource, /pending\.matches \+= 1/);
  assert.match(pageSource, /pending\.matches < REQUIRED_DECODE_MATCHES/);
  assert.match(pageSource, /Code 128 · digits only · two-frame confirmation/);
});

test("iPhone Safari receives a native switch haptic fallback", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(pageSource, /input\.setAttribute\("switch", ""\)/);
  assert.match(pageSource, /if \(!vibrated\) triggerIOSSwitchHaptic\(\)/);
  assert.match(pageSource, /useState<ScannerMode>\("university"\)/);
});

test("repeat barcodes increment one aggregated entry", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(pageSource, /scanCount: existing\.scanCount \+ 1/);
  assert.match(pageSource, /currentRecords\.filter\(\(item\) => item\.id !== record\.id\)/);
  assert.match(pageSource, /existing\.scanCount \+= record\.scanCount/);
  assert.match(pageSource, /"Scan Count"/);
  assert.match(pageSource, /record\.scanCount === 1 \? "scan" : "scans"/);
});

test("TXT export contains only one barcode value per line", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(pageSource, /const exportTxt = \(\) =>/);
  assert.match(pageSource, /format === "txt"/);
  assert.match(pageSource, /record\.value\.replace\(\/\[\\r\\n\]\+\/g, ""\)/);
  assert.match(pageSource, /\.join\("\\r\\n"\)/);
  assert.match(pageSource, /text\/plain;charset=utf-8/);
  assert.match(pageSource, /Plain barcode values/);
});

test("export uses one secondary page with download and email actions", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(pageSource, /className="export-open-button"/);
  assert.match(pageSource, /className="export-page"/);
  assert.match(pageSource, /Back to scanner/);
  assert.match(pageSource, /mailto:\?subject=/);
  assert.match(pageSource, /emailExport\("txt"\)/);
  assert.match(pageSource, /emailExport\("csv"\)/);
  assert.match(pageSource, /emailExport\("json"\)/);
  assert.match(pageSource, /The selected export is placed in the message body\./);
});

test("build number is shown in the footer and increments before builds", async () => {
  const [pageSource, packageSource, incrementSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/increment-build-version.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /Build \{BUILD_NUMBER\}/);
  assert.match(packageSource, /"prebuild": "node scripts\/increment-build-version\.mjs"/);
  assert.match(incrementSource, /currentBuild \+ 1/);
});
