import { describe, expect, it } from "vitest";
import { authorizationModules, permissionByCode } from "./catalog";

describe("authorization catalog", () => {
  type CatalogPermission = (typeof authorizationModules)[number]["permissions"][number];
  const permissions = authorizationModules.flatMap((module) => [
    ...module.permissions,
  ]) as CatalogPermission[];

  it("has unique active modules and permissions", () => {
    expect(new Set(authorizationModules.map((module) => module.code)).size).toBe(
      authorizationModules.length,
    );
    expect(authorizationModules.every((module) => module.active)).toBe(true);
    expect(new Set(permissions.map((item) => item.code)).size).toBe(permissions.length);
    expect(permissions.every((item) => item.active)).toBe(true);
  });

  it("resolves every permission by code", () => {
    for (const module of authorizationModules) {
      for (const permission of module.permissions) {
        expect(permissionByCode[permission.code]).toMatchObject({ module, permission });
      }
    }
  });

  it("covers every route guard code", () => {
    const guards = [
      "list-users",
      "detail-users",
      "create-users",
      "update-users",
      "list-roles",
      "detail-roles",
      "create-roles",
      "update-roles",
      "delete-roles",
      "list-permissions",
      "detail-permissions",
      "list-role-permissions",
      "create-role-permissions",
      "delete-role-permissions",
      "list-role-assignments",
      "create-role-assignments",
      "delete-role-assignments",
      "view-vendors",
      "list-vendors",
      "detail-vendors",
      "approve-vendors",
    ] as const;
    for (const code of guards) {
      expect(code in permissionByCode).toBe(true);
    }
  });
});
