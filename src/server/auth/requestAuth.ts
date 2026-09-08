/**
 * Route-level authentication and authorization.
 *
 * Zero Trust rule:
 * middleware protection is not sufficient by itself.
 * Sensitive API routes should verify the JWT again.
 */

import type { NextRequest } from "next/server";

import {
    SESSION_COOKIE_NAME,
} from "./config";

import {
    verifySessionToken,
    type ConsoleSession,
} from "./session";

import {
    hasPermission,
    type ConsolePermission,
} from "./authorization";

export async function authenticateConsoleRequest(
    request: NextRequest,
    requiredPermission?: ConsolePermission,
): Promise<ConsoleSession | null> {
    const token =
        request.cookies.get(
            SESSION_COOKIE_NAME,
        )?.value;

    if (!token) {
        return null;
    }

    const session =
        await verifySessionToken(token);

    if (!session) {
        return null;
    }

    if (
        requiredPermission &&
        !hasPermission(
            session.permissions,
            requiredPermission,
        )
    ) {
        return null;
    }

    return session;
}