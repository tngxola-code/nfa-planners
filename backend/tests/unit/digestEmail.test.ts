import { describe, expect, it } from "vitest";
import { buildDigestEmail, escapeHtml } from "../../src/lib/digestEmail.js";
import type { NotificationDto } from "../../src/types/notification.js";

function notification(
  overrides: Partial<NotificationDto> = {},
): NotificationDto {
  return {
    id: "notification-1",
    kind: "match",
    title: "New high-match opportunity",
    body: "Precinct SDF (Tshwane) — 92%",
    read: false,
    createdAt: "2026-09-13T08:00:00.000Z",
    ...overrides,
  };
}

describe("escapeHtml", () => {
  it("escapes HTML metacharacters", () => {
    expect(escapeHtml(`<script>"'&`)).toBe("&lt;script&gt;&quot;&#39;&amp;");
  });
});

describe("buildDigestEmail", () => {
  it("builds one item per notification", () => {
    const { subject, html } = buildDigestEmail("Thandi", [
      notification(),
      notification({
        id: "notification-2",
        title: "Ingest completed",
      }),
    ]);

    expect(subject).toBe("NFA Console digest — 2 updates");
    expect(html).toContain("Hello Thandi");
    expect(html).toContain("New high-match opportunity");
    expect(html).toContain("Ingest completed");
  });

  it("uses a singular subject for one notification", () => {
    expect(buildDigestEmail("Sipho", [notification()]).subject).toBe(
      "NFA Console digest — 1 update",
    );
  });

  it("neutralizes feed-controlled HTML", () => {
    const { html } = buildDigestEmail("User", [
      notification({
        title: "<img src=x onerror=alert(1)>",
      }),
    ]);

    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });

  it("escapes the recipient name", () => {
    const { html } = buildDigestEmail("<script>alert(1)</script>", [
      notification(),
    ]);

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});
