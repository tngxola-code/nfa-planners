/**
 * NFA Console authorization model.
 *
 * EDGE-SAFE.
 *
 * Authentication establishes identity.
 * Authorization determines what that identity may do.
 */

export type ConsoleRole =
    | "admin"
    | "planner"
    | "viewer";

export type ConsolePermission =
    | "console:read"
    | "console:write"
    | "opportunities:read"
    | "opportunities:write"
    | "notifications:read"
    | "notifications:write"
    | "ingest:read"
    | "ingest:execute"
    | "users:read"
    | "users:manage"
    | "audit:read";

const ROLE_PERMISSIONS: Record<
    ConsoleRole,
    readonly ConsolePermission[]
> = {
    admin: [
        "console:read",
        "console:write",
        "opportunities:read",
        "opportunities:write",
        "notifications:read",
        "notifications:write",
        "ingest:read",
        "ingest:execute",
        "users:read",
        "users:manage",
        "audit:read",
    ],

    planner: [
        "console:read",
        "console:write",
        "opportunities:read",
        "opportunities:write",
        "notifications:read",
        "notifications:write",
        "ingest:read",
        "audit:read",
    ],

    viewer: [
        "console:read",
        "opportunities:read",
        "notifications:read",
    ],
};

export function isConsoleRole(
    value: unknown,
): value is ConsoleRole {
    return (
        value === "admin" ||
        value === "planner" ||
        value === "viewer"
    );
}

export function isConsolePermission(
    value: unknown,
): value is ConsolePermission {
    if (typeof value !== "string") {
        return false;
    }

    return (
        value === "console:read" ||
        value === "console:write" ||
        value === "opportunities:read" ||
        value === "opportunities:write" ||
        value === "notifications:read" ||
        value === "notifications:write" ||
        value === "ingest:read" ||
        value === "ingest:execute" ||
        value === "users:read" ||
        value === "users:manage" ||
        value === "audit:read"
    );
}

export function getPermissionsForRole(
    role: ConsoleRole,
): ConsolePermission[] {
    return [...ROLE_PERMISSIONS[role]];
}

export function hasPermission(
    permissions: readonly ConsolePermission[],
    requiredPermission: ConsolePermission,
): boolean {
    return permissions.includes(requiredPermission);
}