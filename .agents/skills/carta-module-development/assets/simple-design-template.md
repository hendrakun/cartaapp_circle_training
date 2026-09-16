# <Feature>

## Result and scope

- User result: <What the user can do>
- Included: <Required work>
- Excluded: <Explicit scope limits>
- Requirement source: <Original request and later decisions>

## Data and access

- Records and fields: <Types, required values and important defaults>
- Relations: <Stored identity, selectable label, displayed value and edit value>
- Access: <Who can read, create, edit, delete and run custom actions>
- Constraints: <Module-specific rules; identify inferred defaults>
- Standard CRUD pattern: <Existing source reference>

## Custom behavior

### <Action name; repeat for each action, state shared behavior once>

- Trigger and inputs: <Entry point and accepted values>
- Conditions: <Access and state requirements>
- Successful result: <Output and visible result>
- Stored effects: <Changes to data, or none>
- Failure behavior: <Rejected inputs, technical failures and their results>
- Control states: <Relevant loading, result and failure states, or none>

## Acceptance and checks

| Required outcome | Check | Expected result |
|---|---|---|
| <Observable behavior> | <API, unit or live integration check> | <Specific result> |

- Live checks: <Authority, target, test data, cost or request limit; or none>
- Unresolved decisions: <Question and affected behavior, or none>
- Browser and E2E checks: excluded.

## Progress and evidence

- Status: <Designed / implementing / verifying / complete / blocked>
- Implementation owners and pattern: <Paths and selected approach>
- Work order: <First working result and remaining work>
- Next action: <Next step, or none>
- Development setup: <Target and authority, migration, seed, configuration and URL>
- Check results: <Command or live check, observed result and relevant source state>
- Review: <Findings and verdict; identify self-review when applicable>
- Remaining gaps: <Missing work or evidence, or none>
