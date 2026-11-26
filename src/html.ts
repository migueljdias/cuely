/**
 * HTML for emails and the few plain pages served outside React. Every value interpolated into
 * `html` is escaped unless it is itself `html` output, so a page is safe by construction
 * rather than by remembering to escape each value.
 */

export class SafeHtml {
  constructor(readonly value: string) {}
  toString() {
    return this.value;
  }
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

type Value = string | number | SafeHtml | readonly SafeHtml[];

const render = (v: Value): string =>
  v instanceof SafeHtml ? v.value : Array.isArray(v) ? v.map(render).join("\n") : escapeHtml(String(v));

export function html(strings: TemplateStringsArray, ...values: Value[]): SafeHtml {
  return new SafeHtml(strings.reduce((out, s, i) => out + s + (i < values.length ? render(values[i]) : ""), ""));
}
