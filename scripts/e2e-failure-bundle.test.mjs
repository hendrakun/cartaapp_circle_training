import { strict as assert } from "node:assert";
import { afterEach, test } from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { collectFailureBundle } from "./e2e-failure-bundle.mjs";

const roots = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

function fixture(status = "failed") {
  const root = mkdtempSync(join(tmpdir(), "e2e-bundle-"));
  roots.push(root);
  const reportsRoot = join(root, "plans/e2e-iteration/reports");
  const artifacts = join(root, "apps/web/test-results");
  mkdirSync(reportsRoot, { recursive: true });
  mkdirSync(artifacts, { recursive: true });
  const screenshot = join(artifacts, "shot.png");
  writeFileSync(screenshot, "png");
  const diagnostics = Buffer.from(
    JSON.stringify({
      responses: [{ method: "GET", url: "http://local/fail", status: 500 }],
      requests: [{ method: "GET", url: "http://local/abort", error: "failed" }],
    }),
  ).toString("base64");
  const report = {
    stats: { startTime: "2026-09-12T00:00:00.000Z" },
    errors: [],
    suites: [
      {
        title: "suite",
        specs: [
          {
            title: "case",
            file: "nested/failure.spec.ts",
            tests: [
              {
                projectName: "chromium",
                expectedStatus: "passed",
                results: [
                  {
                    status,
                    errors: [{ message: "assertion failed" }],
                    stdout: [{ text: "test stdout" }],
                    stderr: [{ buffer: Buffer.from("test stderr").toString("base64") }],
                    steps: [{ title: "outer", steps: [{ title: "failed action", error: {} }] }],
                    attachments: [
                      { name: "screenshot", path: screenshot },
                      {
                        name: "diagnostics.json",
                        body: diagnostics,
                        contentType: "application/json",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  const reportPath = join(root, "results.json");
  writeFileSync(reportPath, JSON.stringify(report));
  const options = { repoRoot: root, reportPath, reportsRoot, artifactRoots: [artifacts], attachmentBase: root };
  return { root, reportsRoot, reportPath, artifacts, options };
}

test("copies failed attempt artifacts and writes linked diagnostics", () => {
  const value = fixture();
  const result = collectFailureBundle("plans/e2e-iteration/reports/run-1", value.options);
  const summary = readFileSync(join(result.output, "summary.md"), "utf8");
  const network = readFileSync(join(result.output, "network.md"), "utf8");
  assert.match(summary, /suite › case/);
  assert.match(summary, /assertion failed/);
  assert.match(summary, /nested\/failure.spec.ts/);
  assert.match(summary, /failed action/);
  assert.match(summary, /test stdout/);
  assert.match(summary, /test stderr/);
  assert.match(summary, /Recovered later: no/);
  assert.match(summary, /screenshot/);
  assert.match(network, /500/);
  assert.match(network, /abort/);
  assert.throws(
    () => collectFailureBundle("plans/e2e-iteration/reports/run-1", value.options),
    /exists/,
  );
});

test("supports top-level errors without attachments", () => {
  const value = fixture("passed");
  writeFileSync(
    value.reportPath,
    JSON.stringify({ stats: {}, suites: [], errors: [{ message: "server failed" }] }),
  );
  const result = collectFailureBundle("plans/e2e-iteration/reports/run-error", value.options);
  assert.match(readFileSync(join(result.output, "summary.md"), "utf8"), /server failed/);
});

test("rejects clean reports, traversal, and malformed JSON", () => {
  const value = fixture("passed");
  assert.throws(() => collectFailureBundle("../outside", value.options), /under/);
  assert.throws(
    () => collectFailureBundle("plans/e2e-iteration/reports/clean", value.options),
    /no failure/,
  );
  writeFileSync(value.reportPath, "{");
  assert.throws(
    () => collectFailureBundle("plans/e2e-iteration/reports/bad", value.options),
    /JSON/,
  );
});

test("rejects a symlink parent before it writes the destination", () => {
  const value = fixture();
  symlinkSync(tmpdir(), join(value.reportsRoot, "linked"));
  assert.throws(
    () => collectFailureBundle("plans/e2e-iteration/reports/linked/run", value.options),
    /symlink parent/,
  );
});

test("resolves relative attachments from the report context and rejects symlinks and directories", () => {
  const value = fixture();
  const resultData = JSON.parse(readFileSync(value.reportPath, "utf8"));
  resultData.suites[0].specs[0].tests[0].results[0].attachments[0].path = "apps/web/test-results/shot.png";
  writeFileSync(value.reportPath, JSON.stringify(resultData));
  const copied = collectFailureBundle("plans/e2e-iteration/reports/relative", value.options);
  assert.match(readFileSync(join(copied.output, "summary.md"), "utf8"), /screenshot/);

  const linked = join(value.artifacts, "linked.png");
  symlinkSync(join(value.artifacts, "shot.png"), linked);
  resultData.suites[0].specs[0].tests[0].results[0].attachments[0].path = "apps/web/test-results/linked.png";
  writeFileSync(value.reportPath, JSON.stringify(resultData));
  assert.throws(
    () => collectFailureBundle("plans/e2e-iteration/reports/symlink", value.options),
    /no failure|symlink|missing/i,
  );

  resultData.suites[0].specs[0].tests[0].results[0].attachments[0].path = "apps/web/test-results";
  writeFileSync(value.reportPath, JSON.stringify(resultData));
  assert.throws(
    () => collectFailureBundle("plans/e2e-iteration/reports/directory", value.options),
    /regular file/,
  );
});

test("uses unique names and summarizes every diagnostics attachment", () => {
  const value = fixture();
  const report = JSON.parse(readFileSync(value.reportPath, "utf8"));
  report.suites[0].specs[0].file = "long/".repeat(30) + "failure.spec.ts";
  const duplicate = structuredClone(report.suites[0].specs[0]);
  duplicate.tests[0].projectName = "firefox";
  duplicate.tests[0].results[0].attachments[1].body = Buffer.from(JSON.stringify({ console: ["second console"], responses: [{ method: "GET", url: "https://user:pass@example.test/path?token=secret#part", status: 503 }] })).toString("base64");
  report.suites[0].specs.push(duplicate);
  writeFileSync(value.reportPath, JSON.stringify(report));
  const result = collectFailureBundle("plans/e2e-iteration/reports/multiple", value.options);
  const summary = readFileSync(join(result.output, "summary.md"), "utf8");
  const network = readFileSync(join(result.output, "network.md"), "utf8");
  assert.match(summary, /Browser console — failure 1/);
  assert.match(summary, /Browser console — failure 2/);
  assert.match(summary, /second console/);
  assert.match(network, /https:\/\/example.test\/path/);
  assert.doesNotMatch(network, /user|pass|token|secret|#part/);
});

test("handles absent allowed roots without a realpath failure", () => {
  const value = fixture();
  assert.throws(
    () => collectFailureBundle("plans/e2e-iteration/reports/absent-root", { ...value.options, artifactRoots: [join(value.root, "missing-root")] }),
    /escapes the allowed/,
  );
});

test("rejects invalid network metadata at the collector boundary", () => {
  const value = fixture();
  const report = JSON.parse(readFileSync(value.reportPath, "utf8"));
  report.suites[0].specs[0].tests[0].results[0].attachments[1].body = Buffer.from(
    JSON.stringify({ requests: [{ method: "GET injected", url: "file:///private/value" }] }),
  ).toString("base64");
  writeFileSync(value.reportPath, JSON.stringify(report));
  assert.throws(
    () => collectFailureBundle("plans/e2e-iteration/reports/invalid-network", value.options),
    /diagnostics method|URL protocol/,
  );
});
