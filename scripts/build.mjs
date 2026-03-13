import { execFileSync } from "node:child_process";
import { mkdirSync, cpSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const dist = path.join(root, "dist");
const distPopup = path.join(dist, "popup");
const distOptions = path.join(dist, "options");

function runTailwind(input, output) {
  const cli = path.join(root, "node_modules", "tailwindcss", "lib", "cli.js");
  execFileSync(process.execPath, [cli, "-i", input, "-o", output, "--minify"], {
    stdio: "inherit",
    cwd: root,
  });
}

function copyFile(src, dest) {
  cpSync(src, dest, { recursive: false });
}

function copyDir(src, dest) {
  cpSync(src, dest, { recursive: true });
}

if (existsSync(dist)) rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
mkdirSync(distPopup, { recursive: true });
mkdirSync(distOptions, { recursive: true });

// CSS build (Tailwind)
runTailwind(path.join(root, "popup", "popup.css"), path.join(distPopup, "popup.css"));
runTailwind(path.join(root, "options", "options.css"), path.join(distOptions, "options.css"));

// Static files
copyFile(path.join(root, "popup", "popup.html"), path.join(distPopup, "popup.html"));
copyFile(path.join(root, "popup", "popup.js"), path.join(distPopup, "popup.js"));

copyFile(path.join(root, "options", "options.html"), path.join(distOptions, "options.html"));
copyFile(path.join(root, "options", "options.js"), path.join(distOptions, "options.js"));

copyFile(path.join(root, "background.js"), path.join(dist, "background.js"));

// Keep manifest at repo root; Chrome loads from root and resolves dist paths.
console.log("Built dist/ assets successfully.");

