import { describe, expect, it } from "vitest";
import { buildDigestEmail, escapeHtml } from "../../src/lib/digestEmail.js";
import type { NotificationDto } from "../../src/types/notification.js";

function notification(
  overrides: Partial<NotificationDto> = {},
): NotificationDto {
  return {
    id: "n1",
    kind: "match",
    title: "New high-match opportunity",
    body: "Precinct SDF (Tshwane) - 92%",
    read: false,
    createdAt: "2026-09-13T08:00:00.000Z",
    ...overrides,
  };
}

describe("escapeHtml", () => {
  it("escapes every supported HTML metacharacter", () => {
    expect(escapeHtml(`<script>"'&`)).toBe("&lt;script&gt;&quot;&#39;&amp;");
  });
});

describe("buildDigestEmail", () => {
  it("builds one list item per notification", () => {
    const { subject, html } = buildDigestEmail("Thandi", [
      notification(),
      notification({
        id: "n2",
        title: "Ingest completed",
      }),
    ]);

    expect(subject).toBe("NFA Console digest - 2 updates");
    expect(html).toContain("Hello Thandi");
    expect(html).toContain("New high-match opportunity");
    expect(html).toContain("Ingest completed");
  });

  it("uses a singular subject for one notification", () => {
    expect(buildDigestEmail("Sipho", [notification()]).subject).toBe(
      "NFA Console digest - 1 update",
    );
  });

  it("escapes feed-controlled titles and bodies", () => {
    const { html } = buildDigestEmail("User", [
      notification({
        title: '<img src=x onerror="alert(1)">',
        body: "<script>alert(2)</script>",
      }),
    ]);

    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>alert(2)");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes the recipient display name", () => {
    const { html } = buildDigestEmail("<script>User</script>", [
      notification(),
    ]);

    expect(html).not.toContain("Hello <script>User</script>");
    expect(html).toContain("Hello &lt;script&gt;User&lt;/script&gt;");
  });

  it("handles an invalid notification date", () => {
    const { html } = buildDigestEmail("User", [
      notification({
        createdAt: "invalid-date",
      }),
    ]);

    expect(html).toContain("Date unavailable");
  });
});
