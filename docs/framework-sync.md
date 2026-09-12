# Framework sync

Carta is the project template. Projects start private with full history, then
sync framework packages as subtrees. Application code and root tooling stay
under project control. Apply changes there when the update requires them.
Preserve unrelated project files and local environment values.

## Sync boundary

| Updated from package repositories | Owned by the project |
|---|---|
| `packages/loom`, `packages/sprindle`, `packages/utilities`, `packages/sdk` | `apps/api`, `apps/web` |
|  | Root tooling, `.github/workflows`, `plans/`, and project documents |
| Skills live separately at `southneuhof/skills` (`skills/<name>/`) | `.env`, `.env.test`, `.env.e2e` secrets |

Router integration under `apps/web` is project-owned. When an update changes
the routing contract, adapt the project routes and check their behavior.

## Start a project from Carta

```sh
git clone https://github.com/southneuhof/carta my-project
cd my-project
git remote rename origin project-origin
git remote add origin <private-repo-url>
git remote add carta https://github.com/southneuhof/carta.git
git push -u origin main
```

## Update Carta packages in a project

### Authorization

A user request to update Carta authorizes package updates, local merge commits,
conflict resolution, and changes to application code or root tooling required
by the new contract. Preserve the intended behavior of local work. Local
changes and merge conflicts are work to resolve, not reasons to stop.

Ask the user only when a conflict requires a product decision that the available
context cannot resolve. Continue independent work while that decision is open.
Report access or tool failures with the exact blocked step. Pushes, publication,
production changes, and deletion of unrelated work need separate authorization.

### Procedure

1. Read `package.json` and `scripts/package-repos.mjs` to identify the update
   command, package sources, and target branches. Use the package sources for
   a normal Carta update. A whole-repository merge needs an explicit request.
2. Inspect `git status --short`, the current branch, and local differences.
   Record the starting commit and package revisions, and create a local backup
   branch. If there are
   uncommitted changes, save tracked and untracked work with a named Git stash
   and record its commit ID. Keep ignored files in place. Proceed when the
   working tree is clean and all saved work has a recovery reference.
3. Run `pnpm carta:update`. If a package pull stops with conflicts, inspect both
   changes and resolve each conflict against the new contract while preserving
   local behavior. Complete the merge, then run the update command again to
   process the remaining packages. Check that each requested package was
   processed; report any package that the script skips.
4. Read the fetched changes and any supplied migration instructions. Adapt
   affected callers, application code, and root tooling to the new contract.
   Use the applicable API or UI skill for those changes. This step is complete
   when each affected use follows the new contract and retains local behavior.
5. If work was saved in a stash, restore it with `git stash apply --index` using
   the recorded ID. Resolve any conflicts and retain the stash as a recovery
   copy. Check the result against the saved changes so no local work is lost.
6. Run dependency installation, type checks, and tests from the current root
   scripts after all changes and saved work are in place. Run any additional
   checks required by the changed packages, including stable tests for changed
   behavior. Inspect `git diff --check` and the final status for unresolved
   conflicts or unrelated changes.
7. Report the package revisions before and after the update, local changes
   required by the new contract, check results, and recovery references. State
   any blocked or unverified work. Completion requires all requested packages
   to be processed, local work to be restored, and required checks to pass.

The update command pulls framework packages. The agent applies required changes
outside those packages. Keep project-specific framework patches local.

## Propose a framework change upstream

Promote is manual. From the project, split the changed framework path,
push it to a branch on `southneuhof/carta`, and open a PR for maintainer
review. Never split `apps/`, `plans/`, `docs/` project files, or `.env` files.

```sh
git subtree split --prefix=packages/loom -b promote/loom-<topic>
git push carta promote/loom-<topic>
gh pr create --repo southneuhof/carta --base main --head promote/loom-<topic>
```

The maintainer merges worthy changes into Carta `main`. Projects then pull
newest Carta to receive improvements from every project.

## Local framework patches

A project-specific customization that must live in framework code stays as
normal commits under `packages/<name>/`. Mark the commits (for example with a
`local-patch:` prefix) so they are never split back upstream. Pulls from Carta
merge against them; conflicting hunks are resolved in the project.

## Skills

Skills are versioned separately at `southneuhof/skills`, one folder per skill
under `skills/`. Projects install what they need:

```sh
npx skills@latest add southneuhof/skills --skill <name>
```
