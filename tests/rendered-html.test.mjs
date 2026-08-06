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
  assert.doesNotMatch(html, /Device only/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("repeat scans use a distinct confirmation treatment", async () => {
  const [pageSource, stylesheet] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /Scanned again/);
  assert.match(pageSource, /formatOrdinal\(lastScanCount\)/);
  assert.match(pageSource, /key=\{lastScan\.id\}/);
  assert.match(stylesheet, /\.capture-confirmation\.is-repeat\s*\{[^}]*var\(--coral\)/s);
  assert.match(stylesheet, /@keyframes capture-in\s*\{[\s\S]*68%/);
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
  assert.match(pageSource, /example: "U12345678"/);
  assert.match(pageSource, /example: "5901234123457"/);
  assert.match(pageSource, /example: "https:\/\/example\.edu"/);
  assert.match(pageSource, /createHighAccuracyReader\(enabledFormatIds\)/);
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
