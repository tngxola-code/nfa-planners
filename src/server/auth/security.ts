/**
 * Shared NFA request-security utilities.
 *
 * EDGE-SAFE.
 */

import type { NextResponse } from "next/server";

const UNSAFE_METHODS = new Set([
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
]);

const REQUEST_ID_PATTERN =
    /^[A-Za-z0-9._:-]{8,128}$/;

export function getRequestId(
    request: Request,
): string {
    const supplied =
        request.headers
            .get("x-request-id")
            ?.trim();

    if (
        supplied &&
        REQUEST_ID_PATTERN.test(supplied)
    ) {
        return supplied;
    }

    return crypto.randomUUID();
}

export function isUnsafeMethod(
    method: string,
): boolean {
    return UNSAFE_METHODS.has(
        method.toUpperCase(),
    );
}

/**
 * For state-changing browser requests the Origin
 * must exactly match the request origin.
 */
export function isSameOriginRequest(
    request: Request,
): boolean {
    if (!isUnsafeMethod(request.method)) {
        return true;
    }

    const origin =
        request.headers.get("origin");

    if (!origin) {
        return false;
    }

    try {
        const suppliedOrigin =
            new URL(origin).origin;

        const requestOrigin =
            new URL(request.url).origin;

        return suppliedOrigin === requestOrigin;
    } catch {
        return false;
    }
}

export function applySecurityHeaders(
    response: NextResponse,
    options?: {
        requestId?: string;
        noStore?: boolean;
    },
): NextResponse {
    response.headers.set(
        "X-Content-Type-Options",
        "nosniff",
    );

    response.headers.set(
        "X-Frame-Options",
        "DENY",
    );

    response.headers.set(
        "Referrer-Policy",
        "no-referrer",
    );

    response.headers.set(
        "Cross-Origin-Opener-Policy",
        "same-origin",
    );

    response.headers.set(
        "Cross-Origin-Resource-Policy",
        "same-origin",
    );

    response.headers.set(
        "Permissions-Policy",
        [
            "camera=()",
            "microphone=()",
            "geolocation=()",
            "payment=()",
            "usb=()",
        ].join(", "),
    );

    response.headers.set(
        "X-Permitted-Cross-Domain-Policies",
        "none",
    );

    if (options?.requestId) {
        response.headers.set(
            "X-Request-ID",
            options.requestId,
        );
    }

    if (options?.noStore) {
        response.headers.set(
            "Cache-Control",
            "no-store, max-age=0",
        );

        response.headers.set(
            "Pragma",
            "no-cache",
        );
    }

    if (
        process.env.NODE_ENV ===
        "production"
    ) {
        response.headers.set(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains",
        );
    }

    return response;
}