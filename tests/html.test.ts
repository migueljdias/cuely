import { describe, expect, it } from "vitest";
import { html } from "@/html";

describe("html", () => {
  it("escapes every interpolated value", () => {
    expect(html`<p title="${'"x'}">${"<script>&'"}</p>`.value).toBe('<p title="&quot;x">&lt;script&gt;&amp;&#39;</p>');
  });

  it("keeps nested html, single or in a list, as is", () => {
    const items = ["<a>", "b"].map((s) => html`<li>${s}</li>`);
    expect(html`<ul>${items}</ul>${html`<br>`}`.value).toBe("<ul><li>&lt;a&gt;</li>\n<li>b</li></ul><br>");
  });
});
