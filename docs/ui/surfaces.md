# Page surfaces

Read this file for page shells, navigation headers, page actions, filters, and
layout.

Read [DESIGN.md](../../DESIGN.md#page-structure) for page composition and
[action placement](../../DESIGN.md#actions-and-forms) before choosing slots.

## Header actions

`ListView` exposes these adjacent slots in this order:

1. `#create-action` is only for replacing the standard Create action. When the
   slot is absent and the resource has a Create route, `ListView` renders the
   standard Create action.
2. `#resource-action` is for Import, Export, Download, and other resource-level
   actions. It remains available when the resource has no Create route.

Content in `#resource-action` does not replace the standard Create action. Use
`#resource-action` when an action does not create one resource record through
the standard Create route.

Row View, Edit, and Delete overrides stay in their named row-action slots.
Each override replaces only the named standard action.

## Filters

`ListView #filters` hosts collection query controls.

Use [collections.md](collections.md) to select `ChipFilter` or `Tabs`.

## Page composition

Standard surface components own their loading, error, and empty presentation.
Route-local layout owns only the domain sections that the standard surface
cannot express.
