# API cycle C-1

Design revision 2. API row A-1.

The parent reviewed the test and red output before implementation. The initial route returned 31 permissions instead of a filtered page of 10 and total 11. The test retains its assertions. Its timeout changed from 5 seconds to 60 seconds because the remote test database exceeded the default limit.

The GET route accepts page (positive integer, default 1), limit (1 to 100, default 10), search (trimmed text), sort_by (permissionCode, name, description, assigned; default permissionCode), and sort (asc or desc; default asc). Search matches code, name, or description without case sensitivity. Only active permissions enter the page and total. Sorting adds id ascending for equal values. Missing and inactive mappings display assigned=false. Invalid declared query values return 400. The response remains { data, total }.

PUT and DELETE, their guards, role assignments, and user role count have no source changes.

The test checks filtered pages, total, inactive exclusion, empty pages, sorting and equal-value order, invalid queries, authentication, denied writes, stored grant/revoke state, and reloaded state. The existing users test checks creation with two roles.

Evidence:
- api-red.json: expected assertion failure. Environment label is inaccurate; the preflight and raw output identify the actual guarded target as 10.8.69.67:54432/carta_test.
- api-green.json: failed on 5-second test timeouts, followed by pool errors from unfinished requests after teardown.
- api-types.json: command passed, but report invalidated because the test timeout changed during the run.
- api-lint.json: passed before the test timeout change.
- api-green-2: command stopped when an unrelated swa-reports API test was found running against the test target. No completed evidence report was written. This run is not evidence of a pass.

The tracked .sprindle-test/routes.d.ts file was restored after the compile command deleted it. The pre-existing .sprindle-dev deletion remains.
- api-types-2.json and api-lint-2.json: passed on current source.
- api-green-3.json: stopped with SIGTERM after another swa-reports test started during the run. It has no complete behavior result. Shared database test coordination is required before retry.
