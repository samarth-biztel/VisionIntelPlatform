/**
 * Runs every language binding against the shared fixture corpus.
 *
 * The JS binding always runs. The Python binding runs wherever a usable
 * interpreter exists -- so drift is caught on any dev box that has Python,
 * and CI (where both are installed) enforces it for real. A machine with no
 * Python is warned, loudly, rather than blocked.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function run(label, command, args) {
  const result = spawnSync(command, args, { cwd: here, stdio: "inherit" });
  return { label, ...result };
}

const js = run("js", process.execPath, [
  path.join(here, "bindings", "javascript", "src", "conformance-test.js")
]);
if (js.status !== 0) {
  process.exit(js.status ?? 1);
}

const probe = spawnSync("python3", ["-c", "import pydantic"], { stdio: "ignore" });

if (probe.status !== 0) {
  console.warn(
    "python contracts: SKIPPED (no python3 with pydantic on this machine).\n" +
      "  The Python binding was NOT verified against the shared fixtures.\n" +
      "  Run `npm run test:python --workspace @biztel/contracts` where Python is available."
  );
} else {
  const py = run("python", "python3", [
    path.join(here, "bindings", "python", "conformance_test.py")
  ]);
  if (py.status !== 0) {
    process.exit(py.status ?? 1);
  }
}
