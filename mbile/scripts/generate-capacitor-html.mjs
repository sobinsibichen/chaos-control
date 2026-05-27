import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const serverEntry = path.join(rootDir, "dist", "server", "index.js");
const outputFile = path.join(rootDir, "dist", "client", "index.html");

const moduleUrl = pathToFileURL(serverEntry).href;
const mod = await import(moduleUrl);
const response = await mod.default.fetch(new Request("https://chaos-control-api.onrender.com/"), {}, {});

if (!response.ok) {
  throw new Error(`Unable to render mobile entry HTML. Status: ${response.status}`);
}

const html = await response.text();
await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, html, "utf8");

console.log(`Generated ${path.relative(rootDir, outputFile)}`);
