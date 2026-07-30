import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, "..");

async function readJson(relativePath, fallback) {
  try {
    const raw = await readFile(path.join(rootDir, relativePath), "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function loadPlatformConfig() {
  const [device, site] = await Promise.all([
    readJson("config/device.json", {
      device_id: "dev-workstation",
      runs: ["core"],
      bus: { mode: "in-memory" }
    }),
    readJson("config/site.json", {
      site_id: "biztel-lab",
      enabled_modules: [],
      sources: {},
      sinks: {}
    })
  ]);

  return { device, site };
}
