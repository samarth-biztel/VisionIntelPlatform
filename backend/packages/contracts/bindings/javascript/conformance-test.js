/**
 * JavaScript binding conformance test.
 *
 * Runs the shared corpus in packages/contracts/fixtures/conformance.json. Every
 * other binding runs that same file. If two bindings ever disagree on a case,
 * one of them fails its build -- which is the point (PROBLEM_STATEMENT.md S8, P11).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  frameEnvelopeSchema,
  inferenceRequestSchema,
  inferenceResponseSchema,
  heartbeatSchema,
  moduleManifestSchema,
  resultEnvelopeSchema,
  serviceRegistrationSchema,
  shutdownCommandSchema,
  topicMatches,
  topicNameSchema,
  topicPatternSchema
} from "./index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
// bindings/javascript -> packages/contracts
const contractsRoot = path.join(here, "..", "..");
const corpus = JSON.parse(
  readFileSync(path.join(contractsRoot, "fixtures", "conformance.json"), "utf8")
);

const schemas = {
  frame_envelope: frameEnvelopeSchema,
  result_envelope: resultEnvelopeSchema,
  module_manifest: moduleManifestSchema,
  inference_request: inferenceRequestSchema,
  inference_response: inferenceResponseSchema,
  service_registration: serviceRegistrationSchema,
  service_heartbeat: heartbeatSchema,
  service_shutdown: shutdownCommandSchema
};

const failures = [];
let checks = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) {
    failures.push(message);
  }
}

function stripMeta(testCase) {
  return Object.fromEntries(
    Object.entries(testCase).filter(([key]) => !key.startsWith("_"))
  );
}

for (const [group, schema] of Object.entries(schemas)) {
  for (const testCase of corpus[group].valid) {
    const result = schema.safeParse(stripMeta(testCase));
    check(
      result.success,
      `${group}: valid case "${testCase._name}" was rejected: ${
        result.success ? "" : result.error.issues.map((i) => i.message).join("; ")
      }`
    );
  }

  for (const testCase of corpus[group].invalid) {
    const result = schema.safeParse(stripMeta(testCase));
    check(!result.success, `${group}: invalid case "${testCase._name}" was ACCEPTED`);
  }
}

// Round-trip: parse, re-serialize to JSON, and require every original value
// back unchanged. Bindings may add defaults; they may not alter what was sent.
function subsetEqual(expected, actual, path) {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      return [`${path}: list changed shape`];
    }
    return expected.flatMap((value, index) =>
      subsetEqual(value, actual[index], `${path}[${index}]`)
    );
  }
  if (expected !== null && typeof expected === "object") {
    if (actual === null || typeof actual !== "object") {
      return [`${path}: expected object`];
    }
    return Object.entries(expected).flatMap(([key, value]) =>
      key in actual
        ? subsetEqual(value, actual[key], `${path}.${key}`)
        : [`${path}.${key}: missing after round trip`]
    );
  }
  if (!Object.is(expected, actual)) {
    return [
      `${path}: ${JSON.stringify(expected)} (${typeof expected}) became ` +
        `${JSON.stringify(actual)} (${typeof actual})`
    ];
  }
  return [];
}

for (const testCase of corpus.round_trip) {
  const schema = schemas[testCase.group];
  const original = testCase.message;
  const parsed = schema.safeParse(original);
  if (!parsed.success) {
    check(false, `round trip "${testCase._name}": message did not validate`);
    continue;
  }
  const reserialized = JSON.parse(JSON.stringify(parsed.data));
  const problems = subsetEqual(original, reserialized, testCase.group);
  check(problems.length === 0, `round trip "${testCase._name}": ${problems.join("; ")}`);
}

const topics = corpus.topics;

for (const topic of topics.valid_topics) {
  check(topicNameSchema.safeParse(topic).success, `topic ${topic} should be valid`);
}
for (const topic of topics.invalid_topics) {
  check(!topicNameSchema.safeParse(topic).success, `topic ${topic} should be invalid`);
}
for (const pattern of topics.valid_patterns) {
  check(topicPatternSchema.safeParse(pattern).success, `pattern ${pattern} should be valid`);
}
for (const pattern of topics.invalid_patterns) {
  check(
    !topicPatternSchema.safeParse(pattern).success,
    `pattern ${pattern} should be invalid`
  );
}
for (const [pattern, topic, expected] of topics.matches) {
  const actual = topicMatches(pattern, topic);
  check(
    actual === expected,
    `topicMatches(${pattern}, ${topic}) = ${actual}, expected ${expected}`
  );
}

if (failures.length > 0) {
  console.error(`js contracts: ${failures.length} FAILURES of ${checks} checks`);
  for (const failure of failures) {
    console.error("  -", failure);
  }
  process.exit(1);
}

console.log(`js contracts: ok (${checks} checks)`);
