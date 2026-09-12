# Plan 014: E2E failure bundle with scoped S3 cleanup rule

> **Implementation instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before you move to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When you finish, update the status row for this
> plan in `plans/README.md` after the implementation and review pass.
>
> **Drift check (run first)**: `git diff --stat 6fa00d4..HEAD -- apps/web/playwright.config.ts apps/api/scripts/clear-e2e-storage.ts apps/api/src/storage/s3.ts "apps/api/src/routes/(authenticated)/files/presigned-url/+server.ts" apps/web/src/framework/adapters/storage.ts apps/web/e2e/fixtures.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before you proceed. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 012 (needs the iteration fixture; does not need 013)
- **Category**: perf
- **Planned at**: commit `6fa00d4`, 2026-09-12
- **Design**: `plans/008-e2e-iteration-design.md`, approved 2026-09-12

## Why this matters

A failed E2E run still needs manual trace plus network inspection.
The agent reads the wrong artifact first and loses time.
This plan adds one command that collects the failed assertion, logs,
screenshot, trace, DOM, console, and network summary in one place.
It also sets the S3 rule for future upload journeys: one prefix per test,
delete only owned keys. No full bucket clear per test.

## Current state

The relevant files, each with one line on its role:

- `apps/web/playwright.config.ts` — owns reporters, `outputDir: test-results`, trace and screenshot settings.
- `apps/api/scripts/clear-e2e-storage.ts` — deletes all keys in the E2E bucket.
- `apps/api/src/storage/s3.ts` — owns `listObjects`, `deleteObject`, presigned upload and download.
- `apps/api/src/routes/(authenticated)/files/presigned-url/+server.ts` — mints presigned PUT URLs under `uploads/<uuid>.<ext>`.
- `apps/web/src/framework/adapters/storage.ts` — uploads through presign plus direct PUT.
- `apps/web/e2e/fixtures.ts` — owns prepare and will own the prefix rule after plan 009.

Excerpts of the code as it exists today:

```ts
// apps/web/playwright.config.ts:36-48
outputDir: 'test-results',
reporter: [
  ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ['json', { outputFile: 'playwright-report/results.json' }],
],
use: {
  baseURL: webUrl,
  actionTimeout: 15_000,
  navigationTimeout: 30_000,
  screenshot: 'only-on-failure',
  trace: 'retain-on-failure',
  video: 'off',
  viewport: { width: 1440, height: 900 },
},
```

```ts
// apps/api/scripts/clear-e2e-storage.ts:29-56
export async function clearE2eStorage() {
  const bucket = process.env.S3_BUCKET
  assertE2eStorageTarget(bucket)
  ...
  const keys = await listAllKeys(client, bucket)
  for (let index = 0; index < keys.length; index += 1000) {
    await client.send(new DeleteObjectsCommand({...}))
  }
  if ((await listAllKeys(client, bucket)).length) throw new Error('E2E storage bucket is not empty after clear.')
}
```

```ts
// apps/api/src/routes/(authenticated)/files/presigned-url/+server.ts:17-21
function objectKey(filename: string) {
  const extension = filename.match(/\.([a-zA-Z0-9]{1,16})$/)?.[1]?.toLowerCase()
  return `uploads/${randomUUID()}${extension ? `.${extension}` : ''}`
}
```

```ts
// apps/web/src/framework/adapters/storage.ts:134-139
export async function uploadFile(file: File, context: UploadContext = {}): Promise<StoredAsset> {
  const signed = await presign(file, context.signal)
  ...
  return signed.asset
}
```

Repo conventions that apply here:

- Reports go under `plans/<feature>/reports/<run>/` before the next run overwrites them. See `ui-automation.md:61-65`.
- A screenshot alone proves nothing about persistence or permission. Keep the failed assertion and logs first.
- S3 cleanup deletes only keys the test created. Seed or reference data is not disposable by default.
- The E2E guard stays. The bundle script never touches another bucket.
- No current E2E spec does an upload. This plan sets the rule and the tool. It does not add an upload journey.

## Commands you will need

| Purpose | Working directory | Command | Expected on success |
|---|---|---|---|
| Baseline failure read | repo root | `pnpm --filter @southneuhof/framework-web test:e2e -- rbac-smoke.spec.ts -g "no such case"` | zero tests selected, proves selector check works |
| Bundle on a real failure | repo root | `node scripts/e2e-failure-bundle.mjs plans/e2e-iteration/reports/<run>/` after a failed run | bundle dir has summary plus linked artifacts |
| Guard tests | repo root | `pnpm --filter @southneuhof/api test:focused -- scripts/e2e-target.spec.ts` | all pass |
| Script lint or type gate for the new script | repo root | per repo script conventions, lint the new script file | exit 0 |

## Scope

**In scope** (the only files you should modify):

- `scripts/e2e-failure-bundle.mjs` (new, repo root)
- `apps/web/e2e/fixtures.ts` (add the S3 prefix helper and owned-key rule only, no prepare change)
- `plans/README.md` (status row only)

**Out of scope** (do NOT touch, even though they look related):

- Playwright config, reporters, trace settings — no change in this plan.
- `clear-e2e-storage.ts` — full clear stays for acceptance mode.
- Upload route, S3 module, web storage adapter — no product change.
- New upload E2E journey — not in this plan. No current spec uploads.
- Plan 012 and 013 logic — depend on them, do not rewrite them.
- Framework packages — this plan is app-local plus one repo script.
- `packages/loom/*` — dirty work exists in the tree. Do not touch it.

## Git workflow

- Branch: `advisor/014-e2e-failure-bundle`
- Commit per step or per logical unit. Message style matches `git log`: short imperative.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Run 009 first

Plan 014 needs plan 012 VERIFIED. Check `plans/README.md`. If 012 is not
VERIFIED, stop. This is not a failure. Return to 009.

**Verify**: 009 row says DONE or VERIFIED with evidence.

### Step 2: Write the failure-bundle script

Create `scripts/e2e-failure-bundle.mjs` at the repo root. It takes one output
dir argument under `plans/<feature>/reports/<run>/`. It reads
`apps/web/playwright-report/results.json` plus `apps/web/test-results/`.
It writes one `summary.md` with: failed spec file and test title, failed step
or assertion text, first error lines, and the relative paths of the screenshot,
trace, DOM snapshot, stdout, and stderr for that failure. It copies the
referenced attachments into the output dir and keeps their relative layout or
fixes the links. It also writes one `network.md` with the failed request URL,
method, status, and response body excerpt when the JSON report has it. It never
writes credentials. If no failure exists, it exits nonzero with a clear message
instead of writing an empty bundle.
Check `scripts/module-evidence.mjs --help` style for CLI shape. Match repo
script style. No new dependency.

**Verify**: `node scripts/e2e-failure-bundle.mjs --help` prints usage. A dry run
with a missing report exits nonzero with a clear message.

### Step 3: Prove the bundle on a real failure

Run one E2E case with a wrong selector `-g "no such case"` to prove selector
checking. Then cause one real failure once, for example by a temporary wrong
expected cell in a scratch copy. Do not commit the scratch break. Run the spec.
Run the bundle script. Check `summary.md` names the exact failed title, step,
and assertion, and links existing screenshot, trace, and logs. Delete the
scratch break. Rerun the spec green. Keep both the failed bundle and the green
pass. The failed result stays in the record. The pass replaces it.

**Verify**: bundle dir exists with `summary.md`, `network.md`, and linked
attachments. The follow-up green run passes.

### Step 4: Add the scoped S3 cleanup rule to the fixture

In `apps/web/e2e/fixtures.ts`, add a helper that returns one upload prefix per
test, for example `e2e/<sanitized-test-title>-<short-id>/`. Add a comment that
states the rule: future upload tests use this prefix, record created keys, and
delete only those keys after the test with `deleteObject`. Full bucket clear
stays in `e2e:prepare` for acceptance mode only. Do not change the upload route
or adapter. Do not add an upload journey in this plan.

**Verify**: `grep -n "e2e/.*prefix\|deleteObject\|owned" apps/web/e2e/fixtures.ts`
shows the helper and rule. Web lint for the fixture passes.

### Step 5: Guard check and index row

Run the E2E guard tests. Update `plans/README.md` for plan 011 with DONE and
the evidence: bundle path, failed plus green runs, guard pass.

**Verify**: `git status --short` shows only in-scope files.

## Test plan

- Proof cases, not new acceptance tests:
  1. Wrong selector run selects zero tests and the agent checks the selector first.
  2. One real failure produces a bundle with exact title, step, assertion, and links.
  3. The follow-up green run passes on the same case.
- Existing guard tests: `apps/api/scripts/e2e-target.spec.ts` (full file).
- Existing E2E specs stay green: `rbac-smoke.spec.ts` in iteration mode.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `ls scripts/e2e-failure-bundle.mjs` exists and `--help` prints usage.
- [ ] One real failed run has a bundle dir with `summary.md` and `network.md` plus linked screenshot, trace, and logs.
- [ ] The same case has a follow-up green pass. Both are recorded.
- [ ] `apps/web/e2e/fixtures.ts` has the prefix helper and owned-key rule comment.
- [ ] Full bucket clear still exists for acceptance mode. No guard change.
- [ ] `pnpm --filter @southneuhof/api test:focused -- scripts/e2e-target.spec.ts` passes.
- [ ] No files outside the in-scope list are modified (`git status`).
- [ ] `plans/README.md` status row for 014 is DONE with evidence.

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 012 is not VERIFIED.
- The code at the locations in "Current state" does not match the excerpts.
- A step verification fails twice after a reasonable fix attempt.
- The JSON report lacks the fields the bundle needs. Record the exact gap. Do not invent data.
- A failure needs a product fix outside this plan. Record it. Do not expand scope.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

For the human or agent who owns this code after the change lands:

- Read `summary.md` first on a failure. Open trace only when the summary leaves the cause unclear.
- Preserve the bundle dir before the next run. Working outputs get overwritten.
- When upload journeys arrive, they must use the prefix helper and delete only owned keys.
- Reviewer focus: the script copies evidence. It never changes test outcomes.
