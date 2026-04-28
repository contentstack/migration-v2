import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  buildOAuthSuccessPage,
  buildOAuthErrorPage,
} from "../../../src/utils/oauth-callback-html.utils.js";

describe("oauth-callback-html.utils", () => {
  it("escapeHtml escapes special characters", () => {
    expect(escapeHtml("<script>&")).toBe("&lt;script&gt;&amp;");
  });

  it("buildOAuthSuccessPage includes Migration Tool link only", () => {
    const html = buildOAuthSuccessPage({
      dashboardUrl: "http://localhost:3000/projects",
    });
    expect(html).toContain("Successfully Authorized!");
    expect(html).toContain("You can close this window now.");
    expect(html).toContain("Open Migration Tool");
    expect(html).toContain("http://localhost:3000/projects");
    expect(html).toContain("window.location.replace");
    expect(html).not.toContain("Authorized Apps");
  });

  it("buildOAuthErrorPage escapes error message in body and notifies opener", () => {
    const html = buildOAuthErrorPage("x < y", "http://localhost:3000/projects");
    const bodyHtml = html.split("<script>")[0] ?? "";
    expect(bodyHtml).toContain("x &lt; y");
    expect(bodyHtml).not.toContain("< y");
    expect(html).toContain("postMessage");
    expect(html).toContain("cs-migration-oauth-callback");
  });
});
