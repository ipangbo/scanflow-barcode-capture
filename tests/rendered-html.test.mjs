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
  assert.match(html, /Start continuous scan/);
  assert.match(html, /Entries/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("repeat scans use a distinct confirmation treatment", async () => {
  const [pageSource, stylesheet] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /Scanned again/);
  assert.match(pageSource, /formatOrdinal\(lastScanCount\)/);
  assert.match(stylesheet, /\.capture-confirmation\.is-repeat\s*\{[^}]*var\(--coral\)/s);
});
