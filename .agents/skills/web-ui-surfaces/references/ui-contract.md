# UI contract check

Use [source mode](verification.md) for every changed web surface. Use this
additional contract mode for the full process, an existing contract or
custom composition that needs it. Ordinary standard Views need no JSON record;
inspect their actual output and composition. When selected, record
`plans/<feature>/ui-contract.json`. Paths are repository-relative. Select current
public exports; default imports use `default`.

```json
{
  "surfaces": [
    {
      "file": "apps/web/src/routes/items/index.route.vue",
      "kind": "list",
      "components": [{ "name": "ListView", "from": "@southneuhof/loom" }]
    },
    {
      "file": "apps/web/src/routes/items/detail.route.vue",
      "kind": "detail",
      "components": [{ "name": "DetailView", "from": "@southneuhof/loom" }]
    }
  ]
}
```

List each changed route and its local surface components. `kind` is `list`,
`detail`, `create`, `update` or `custom`; it describes the user task and determines the required standard View. A workflow
record is still `detail`. The checker enforces kind for conventional detail,
create and edit route filenames. `custom` is for other surfaces, such as dashboards. `components` names the
framework exports that the template must use; an unused import fails. Slots and
adjacent sections extend the selected View. A lower-level component needs a `gap`
that names the unsupported requirement and local owner. A custom record layout
retains `Detail`; cards and a header alone do not meet the record contract. Review that claim against
current source. Standard use needs no explanation.

A requested standard Create override adds
`"extensions": [{"slot": "create-action", "reason": "<required interaction>"}]`.
An unused exception fails. Check action text against
[DESIGN.md](../../../../DESIGN.md#text-and-spacing). Inspect label props or the
app dictionary before replacing a control. Cite the requirement when a control
override exists only to change its label.

Run from the repository root and preserve the command result:

```sh
node scripts/module-ui-check.mjs plans/<feature>/ui-contract.json
```

Exit `0` means the declared static checks pass; `1` means defects; `2` means
exceptions need review. The orchestrator resolves each exception against the
requirement and component source before acceptance. Label self-review when an
independent reviewer is unavailable or the user requests direct work.

The checker uses the installed Vue parser. It checks template component bindings,
selected imports in template use, and declared Create overrides. It reports
each native `button`, visible `input`, `select`, and `textarea` as a review
item with file and line, since any of them can replace a shared control.
A literal `type="hidden"` input carries state rather than an interaction and
stays silent; any other type source (absent, dynamic, spread) needs review.
Vue built-ins
and Vue Router components are recognized; confirm the app installs its router.
For explicit globals, add `"globals": [{"tag": "SharedWidget", "registration":
"apps/web/src/main.ts"}]`. The checker requires a literal `.component()` call;
the reviewer confirms that registration runs. Type declarations and test stubs
are not runtime registration.

Dynamic components, plugin registration and aliases outside supported syntax
need source review or a focused extension to the checker. A binding check cannot
prove that an imported module exports the symbol; run the app type check too.
A review item is not a defect: open the file and line, compare the native
control against the shared controls, and either replace it with the shared
control or keep it for the named requirement in the surface `gap`.
Compare the contract with the complete changed file list. Inspect file renderers,
slots and adjacent sections; a token View beside a replacement body is a defect.
A static pass does not prove requirement coverage, runtime behavior or acceptance.
