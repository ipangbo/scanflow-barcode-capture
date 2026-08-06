import { readFile, writeFile } from "node:fs/promises";

const versionFile = new URL("../app/build-version.ts", import.meta.url);
const source = await readFile(versionFile, "utf8");
const currentBuild = Number(source.match(/BUILD_NUMBER = (\d+)/)?.[1]);

if (!Number.isSafeInteger(currentBuild) || currentBuild < 0) {
  throw new Error("Unable to read the current build number.");
}

const nextBuild = currentBuild + 1;
await writeFile(
  versionFile,
  `// Updated automatically by npm run build.\nexport const BUILD_NUMBER = ${nextBuild};\n`,
);

console.log(`Build ${nextBuild}`);
