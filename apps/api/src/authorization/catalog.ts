export const targetTypes = ["global"] as const;

export type TargetType = (typeof targetTypes)[number];

type PermissionDefinition = {
  code: string;
  name: string;
  description: string;
  targetType: TargetType;
  active: true;
};

type ModuleDefinition = {
  code: string;
  name: string;
  active: true;
  permissions: readonly PermissionDefinition[];
};

export const authorizationModules = [
  {
    code: "users",
    name: "Users",
    active: true,
    permissions: [
      { code: "view-users", name: "View Users", description: "View user accounts.", targetType: "global", active: true },
      { code: "list-users", name: "List Users", description: "List user accounts.", targetType: "global", active: true },
      { code: "detail-users", name: "Detail Users", description: "View a user account.", targetType: "global", active: true },
      { code: "create-users", name: "Create Users", description: "Create user accounts.", targetType: "global", active: true },
      { code: "update-users", name: "Update Users", description: "Update user accounts.", targetType: "global", active: true },
    ],
  },
  {
    code: "roles",
    name: "Roles",
    active: true,
    permissions: [
      { code: "view-roles", name: "View Roles", description: "View roles.", targetType: "global", active: true },
      { code: "list-roles", name: "List Roles", description: "List roles.", targetType: "global", active: true },
      { code: "detail-roles", name: "Detail Roles", description: "View a role.", targetType: "global", active: true },
      { code: "create-roles", name: "Create Roles", description: "Create roles.", targetType: "global", active: true },
      { code: "update-roles", name: "Update Roles", description: "Update roles.", targetType: "global", active: true },
      { code: "delete-roles", name: "Delete Roles", description: "Delete roles.", targetType: "global", active: true },
    ],
  },
  {
    code: "permissions",
    name: "Permissions",
    active: true,
    permissions: [
      { code: "view-permissions", name: "View Permissions", description: "View permissions.", targetType: "global", active: true },
      { code: "list-permissions", name: "List Permissions", description: "List permissions.", targetType: "global", active: true },
      { code: "detail-permissions", name: "Detail Permissions", description: "View a permission.", targetType: "global", active: true },
    ],
  },
  {
    code: "role-permissions",
    name: "Role Permissions",
    active: true,
    permissions: [
      { code: "list-role-permissions", name: "List Role Permissions", description: "List a role's permissions.", targetType: "global", active: true },
      { code: "create-role-permissions", name: "Grant Role Permission", description: "Grant a permission to a role.", targetType: "global", active: true },
      { code: "delete-role-permissions", name: "Revoke Role Permission", description: "Revoke a permission from a role.", targetType: "global", active: true },
    ],
  },
  {
    code: "role-assignments",
    name: "Role Assignments",
    active: true,
    permissions: [
      { code: "list-role-assignments", name: "List Role Assignments", description: "List a user's roles.", targetType: "global", active: true },
      { code: "create-role-assignments", name: "Assign Role", description: "Assign a role to a user.", targetType: "global", active: true },
      { code: "delete-role-assignments", name: "Unassign Role", description: "Remove a role from a user.", targetType: "global", active: true },
    ],
  },
  {
    code: "vendors",
    name: "Vendors",
    active: true,
    permissions: [
      { code: "view-vendors", name: "View Vendors", description: "View vendor onboarding.", targetType: "global", active: true },
      { code: "list-vendors", name: "List Vendors", description: "List vendor onboarding records.", targetType: "global", active: true },
      { code: "detail-vendors", name: "Detail Vendors", description: "View a vendor onboarding record.", targetType: "global", active: true },
      { code: "approve-vendors", name: "Approve Vendors", description: "Approve or reject a vendor onboarding record.", targetType: "global", active: true },
    ],
  },
] as const satisfies readonly ModuleDefinition[];

export type AuthorizationModuleCode = (typeof authorizationModules)[number]["code"];
export type PermissionCode = (typeof authorizationModules)[number]["permissions"][number]["code"];

export const permissionByCode = Object.freeze(
  Object.fromEntries(
    authorizationModules.flatMap((module) =>
      module.permissions.map((permission) => [permission.code, { module, permission }]),
    ),
  ) as Record<
    PermissionCode,
    {
      module: (typeof authorizationModules)[number];
      permission: (typeof authorizationModules)[number]["permissions"][number];
    }
  >,
);
