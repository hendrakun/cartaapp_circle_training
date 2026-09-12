#!/usr/bin/env node
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultReport = resolve(repoRoot, "apps/web/playwright-report/results.json");
const defaultArtifacts = [
  resolve(repoRoot, "apps/web/test-results"),
  resolve(repoRoot, "apps/web/playwright-report"),
];
const reportsRoot = resolve(repoRoot, "plans/e2e-iteration/reports");

function within(root, path) {
  const name = relative(root, path);
  return name !== ".." && !name.startsWith(`..${sep}`) && !isAbsolute(name);
}

function safeName(value) {
  return (
    String(value || "failure")
      .replace(/[^a-z0-9._-]+/gi, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "failure"
  );
}

function rejectSymlinkParents(root, path) {
  let current = dirname(path);
  while (current !== root) {
    if (!within(root, current)) throw new Error("Destination escapes the report folder.");
    if (existsSync(current) && lstatSync(current).isSymbolicLink())
      throw new Error(`Destination has a symlink parent: ${current}`);
    current = dirname(current);
  }
}

function cleanNetworkEntry(entry) {
  if (!entry || typeof entry !== "object") throw new Error("Invalid diagnostics network entry.");
  const method = String(entry.method ?? "").toUpperCase();
  if (!/^[A-Z]+$/.test(method)) throw new Error("Invalid diagnostics method.");
  const url = new URL(String(entry.url ?? ""));
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new Error("Invalid diagnostics URL protocol.");
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  const status = Number.isInteger(entry.status) ? entry.status : undefined;
  const error = String(entry.error ?? "unknown").replace(/[\r\n]/g, " ").slice(0, 1_000);
  return `${method} ${url.toString()}: ${status ?? error}`;
}

function outputText(value) {
  if (typeof value === "string") return value;
  if (typeof value?.buffer === "string") return Buffer.from(value.buffer, "base64").toString("utf8");
  return String(value?.text ?? "");
}

function failedStep(steps = []) {
  for (const step of steps) {
    const child = failedStep(step.steps);
    if (child) return child;
    if (step.error) return step.title;
  }
}

function walk(suite, parents, failures) {
  const titles = [...parents, suite.title].filter(Boolean);
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      for (const [attempt, result] of (test.results ?? []).entries()) {
        if (["failed", "timedOut", "interrupted"].includes(result.status))
          failures.push({ spec, test, result, attempt, titles });
      }
    }
  }
  for (const child of suite.suites ?? []) walk(child, titles, failures);
}

export function collectFailureBundle(destination, options = {}) {
  const root = realpathSync(options.repoRoot ?? repoRoot);
  const reportPath = resolve(options.reportPath ?? defaultReport);
  mkdirSync(options.reportsRoot ?? reportsRoot, { recursive: true });
  const outputRoot = realpathSync(options.reportsRoot ?? reportsRoot);
  const output = resolve(root, destination);
  if (!within(outputRoot, output) || output === outputRoot)
    throw new Error("Destination must be a new folder under plans/e2e-iteration/reports/.");
  if (existsSync(output)) throw new Error("Destination already exists.");
  rejectSymlinkParents(outputRoot, output);
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  const failures = [];
  for (const suite of report.suites ?? []) walk(suite, [], failures);
  const runErrors = report.errors ?? [];
  if (!failures.length && !runErrors.length)
    throw new Error("The report has no failure or run error.");
  mkdirSync(output, { recursive: true });
  const artifacts = [];
  const missing = [];
  for (const [failureIndex, failure] of failures.entries()) {
    for (const [attachmentIndex, attachment] of (failure.result.attachments ?? []).entries()) {
      const name = safeName(
        `${failureIndex}-${failure.attempt}-${attachmentIndex}-${failure.test.projectName}-${failure.spec.file}-${attachment.name}`,
      );
      const target = resolve(
        output,
        `${name}${attachment.path ? `-${basename(attachment.path)}` : ".txt"}`,
      );
      if (attachment.body)
        writeFileSync(target, Buffer.from(attachment.body, "base64"), { flag: "wx" });
      else if (attachment.path) {
        const source = resolve(options.attachmentBase ?? resolve(dirname(reportPath), ".."), attachment.path);
        if (!existsSync(source)) missing.push(attachment.path);
        else if (lstatSync(source).isSymbolicLink())
          throw new Error(`Attachment is a symlink: ${attachment.path}`);
        else {
          const realSource = realpathSync(source);
          if (!lstatSync(realSource).isFile()) throw new Error(`Attachment is not a regular file: ${attachment.path}`);
          const allowed = (options.artifactRoots ?? defaultArtifacts)
            .filter(existsSync)
            .some((candidate) => within(realpathSync(candidate), realSource));
          if (!allowed)
            throw new Error(`Attachment escapes the allowed result folders: ${attachment.path}`);
          cpSync(realSource, target, { errorOnExist: true, force: false });
        }
      } else continue;
      if (existsSync(target))
        artifacts.push({
          name: attachment.name,
          path: basename(target),
          contentType: attachment.contentType,
          failureIndex,
        });
    }
  }
  const lines = [
    "# E2E failure bundle",
    "",
    `Report timestamp: ${report.stats?.startTime ?? "unavailable"}`,
    `Source: ${relative(root, reportPath)}`,
    "",
  ];
  for (const failure of failures) {
    lines.push(
      `## ${[...failure.titles, failure.spec.title].filter(Boolean).join(" › ")}`,
      "",
      `Project: ${failure.test.projectName ?? "unknown"}`,
      `File: ${failure.spec.file ?? "unknown"}`,
      `Attempt: ${failure.attempt}`,
      `Expected: ${failure.test.expectedStatus ?? "passed"}`,
      `Recovered later: ${(failure.test.results ?? []).slice(failure.attempt + 1).some(({ status }) => status === "passed") ? "yes" : "no"}`,
      `Failed step: ${failedStep(failure.result.steps) ?? "unavailable"}`,
      "",
    );
    for (const error of failure.result.errors ?? [])
      lines.push(
        "```text",
        String(error.message ?? error.value ?? error).slice(0, 10_000),
        "```",
        "",
      );
    const stdout = (failure.result.stdout ?? []).map(outputText).join("");
    const stderr = (failure.result.stderr ?? []).map(outputText).join("");
    if (stdout) lines.push("### stdout", "", "```text", stdout.slice(0, 10_000), "```", "");
    if (stderr) lines.push("### stderr", "", "```text", stderr.slice(0, 10_000), "```", "");
  }
  for (const error of runErrors)
    lines.push(
      "## Run error",
      "",
      "```text",
      String(error.message ?? error.value ?? error).slice(0, 10_000),
      "```",
      "",
    );
  lines.push("## Artifacts", "");
  for (const item of artifacts) lines.push(`- [${item.name}](${encodeURIComponent(item.path)})`);
  for (const path of missing) lines.push(`- Missing referenced file: ${path}`);
  const diagnostics = artifacts.filter((item) => item.name === "diagnostics.json");
  let network =
    "# Network diagnostics\n\nNo diagnostics attachment is available. Use the trace when present.\n";
  if (diagnostics.length) {
    const networkLines = ["# Network diagnostics", ""];
    for (const diagnostic of diagnostics) {
      const data = JSON.parse(readFileSync(resolve(output, diagnostic.path), "utf8"));
      lines.push("", `## Browser console — failure ${diagnostic.failureIndex + 1}`, "");
      for (const entry of data.console ?? []) lines.push(`- ${String(entry).slice(0, 1_000)}`);
      for (const entry of data.pageErrors ?? []) lines.push(`- Page error: ${String(entry).slice(0, 1_000)}`);
      networkLines.push(`## Failure ${diagnostic.failureIndex + 1}`, "");
      for (const entry of [...(data.responses ?? []), ...(data.requests ?? [])])
        networkLines.push(`- ${cleanNetworkEntry(entry)}`);
    }
    networkLines.push("", "DOM data is available in the Playwright trace.");
    network = networkLines.join("\n");
  }
  writeFileSync(resolve(output, "summary.md"), `${lines.join("\n")}\n`, { flag: "wx" });
  writeFileSync(resolve(output, "network.md"), `${network}\n`, { flag: "wx" });
  return { output, failures: failures.length, runErrors: runErrors.length };
}

const help = `Usage: node scripts/e2e-failure-bundle.mjs <plans/e2e-iteration/reports/new-folder>

Copy the bundle before another Playwright run replaces the source report. Output is local private evidence and is not fully redacted.`;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes("--help")) console.log(help);
    else if (process.argv.length !== 3) throw new Error("One destination is required. Use --help.");
    else console.log(collectFailureBundle(process.argv[2]).output);
  } catch (error) {
    console.error(`e2e-failure-bundle: ${error.message}`);
    process.exitCode = 1;
  }
}
