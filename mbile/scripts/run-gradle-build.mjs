import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const androidDir = path.resolve(scriptDir, "..", "android");
const localAppData = process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
const gradleUserHome = process.env.GRADLE_USER_HOME ?? path.join(localAppData, "Gradle");
const args = process.argv.slice(2);

if (args.length === 0) {
  args.push("assembleDebug");
}

const command = process.platform === "win32" ? "cmd.exe" : "./gradlew";
const commandArgs =
  process.platform === "win32" ? ["/d", "/s", "/c", "gradlew.bat", ...args] : args;

fs.mkdirSync(gradleUserHome, { recursive: true });

const result = spawnSync(command, commandArgs, {
  cwd: androidDir,
  env: {
    ...process.env,
    GRADLE_USER_HOME: gradleUserHome,
  },
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
