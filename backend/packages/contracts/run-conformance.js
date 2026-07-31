/**
 * Runs every language binding against the shared fixture corpus.
 *
 * The JS binding always runs. The Python binding runs wherever a usable
 * interpreter exists -- so drift is caught on dev boxes that have Python,
 * and CI can enforce it for real. A machine with no Python is warned,
 * loudly, rather than blocked.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function run(label, command, args) {
  const result = spawnSync(command, args, { cwd: here, stdio: "inherit" });
  return { label, ...result };
}

function findPython() {
  for (const command of ["python3", "python", "py"]) {
    const result = spawnSync(command, ["-c", "import pydantic"], { stdio: "ignore" });
    if (result.status === 0) {
      return command;
    }
  }
  return null;
}

const js = run("js", process.execPath, [
  path.join(here, "bindings", "javascript", "conformance-test.js")
]);
if (js.status !== 0) {
  process.exit(js.status ?? 1);
}

const python = findPython();

if (python === null) {
  console.warn(
    "python contracts: SKIPPED (no python3/python/py with pydantic on this machine).\n" +
      "  The Python binding was NOT verified against the shared fixtures.\n" +
      "  Run `npm run test:python --workspace @biztel/contracts` where Python is available."
  );
} else {
  const py = run("python", python, [
    path.join(here, "bindings", "python", "conformance_test.py")
  ]);
  if (py.status !== 0) {
    process.exit(py.status ?? 1);
  }
}
