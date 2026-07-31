import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, "..");

const scalarSchema = z.union([z.string(), z.number(), z.boolean()]);

const deviceConfigSchema = z.object({
  device_id: z.string().min(1),
  role: z.string().min(1).default("development"),
  runs: z.array(z.string().min(1)).default(["core"]),
  bus: z
    .object({
      mode: z.enum(["in-memory"]).default("in-memory"),
      host: z.string().min(1).default("localhost"),
      port: z.number().int().positive().default(7080)
    })
    .default({})
});

const siteConfigSchema = z.object({
  site_id: z.string().min(1),
  enabled_modules: z.array(z.string().min(1)).default([]),
  sources: z.record(z.record(z.union([scalarSchema, z.array(scalarSchema)]))).default({}),
  sinks: z.record(z.record(z.union([scalarSchema, z.array(scalarSchema)]))).default({})
});

const platformConfigSchema = z.object({
  device: deviceConfigSchema,
  site: siteConfigSchema,
  loaded_from: z.object({
    device: z.string(),
    site: z.string()
  })
});

const defaultDeviceConfig = {
  device_id: "dev-workstation",
  role: "development",
  runs: ["core"],
  bus: { mode: "in-memory", host: "localhost", port: 7080 }
};

const defaultSiteConfig = {
  site_id: "biztel-lab",
  enabled_modules: [],
  sources: {},
  sinks: {}
};

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  return trimmed.replace(/^["']|["']$/g, "");
}

function parseInlineArray(value) {
  return value
    .slice(1, -1)
    .split(",")
    .map((item) => parseScalar(item))
    .filter((item) => item !== "");
}

function parseYaml(raw) {
  const root = {};
  const stack = [{ indent: -1, value: root }];
  const lines = raw.split(/\r?\n/).filter((line) => line.trim() && !line.trimStart().startsWith("#"));

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const indent = line.match(/^\s*/)[0].length;
    const text = line.trim();

    while (stack.length > 1 && indent <= stack.at(-1).indent) {
      stack.pop();
    }

    const parent = stack.at(-1).value;

    if (text.startsWith("- ")) {
      if (!Array.isArray(parent)) {
        throw new Error(`YAML array item has no array parent: ${line}`);
      }
      parent.push(parseScalar(text.slice(2)));
      continue;
    }

    const separator = text.indexOf(":");
    if (separator === -1) {
      throw new Error(`Invalid YAML line: ${line}`);
    }

    const key = text.slice(0, separator).trim();
    const rawValue = text.slice(separator + 1).trim();

    if (!rawValue) {
      const nextLine = lines[index + 1] ?? "";
      const child = nextLine.trim().startsWith("- ") ? [] : {};
      parent[key] = child;
      stack.push({ indent, value: child });
      continue;
    }

    parent[key] = rawValue.startsWith("[") && rawValue.endsWith("]")
      ? parseInlineArray(rawValue)
      : parseScalar(rawValue);
  }

  return root;
}

async function existingConfigPath(basename) {
  const candidates = [`config/${basename}.yaml`, `config/${basename}.yml`, `config/${basename}.json`];
  for (const relativePath of candidates) {
    try {
      await access(path.join(rootDir, relativePath));
      return relativePath;
    } catch {
      // Try the next supported config extension.
    }
  }
  return null;
}

async function readConfigFile(basename, fallback) {
  const relativePath = await existingConfigPath(basename);
  if (!relativePath) {
    return { value: fallback, source: "defaults" };
  }

  try {
    const raw = await readFile(path.join(rootDir, relativePath), "utf8");
    const value = relativePath.endsWith(".json") ? JSON.parse(raw) : parseYaml(raw);
    return { value, source: relativePath };
  } catch (error) {
    throw new Error(`Failed to load ${relativePath}: ${error.message}`);
  }
}

export async function loadPlatformConfig() {
  const [deviceFile, siteFile] = await Promise.all([
    readConfigFile("device", defaultDeviceConfig),
    readConfigFile("site", defaultSiteConfig)
  ]);

  return platformConfigSchema.parse({
    device: {
      ...defaultDeviceConfig,
      ...deviceFile.value,
      bus: { ...defaultDeviceConfig.bus, ...deviceFile.value.bus }
    },
    site: { ...defaultSiteConfig, ...siteFile.value },
    loaded_from: {
      device: deviceFile.source,
      site: siteFile.source
    }
  });
}

export function getConfigValue(config, keyPath) {
  return keyPath
    .split(".")
    .reduce((current, key) => (current && Object.hasOwn(current, key) ? current[key] : undefined), config);
}