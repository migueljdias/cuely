import { ICON_PATHS, TOOL_ICON } from "@/logos";

/**
 * A tool's mark, drawn in the current text colour so every tool looks the same weight.
 * Marks identify a tool; they never rank it. Tools without a mark get a plain monogram.
 */
export function ToolLogo({ slug, name, size = 16 }: { slug: string; name: string; size?: number }) {
  const key = TOOL_ICON[slug];
  const d = key ? ICON_PATHS[key] : undefined;
  if (d) {
    return (
      <svg className="logo" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d={d} />
      </svg>
    );
  }
  const letter = name.replace(/^Amazon\s+/, "").charAt(0).toUpperCase();
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="none" stroke="currentColor" strokeWidth="2" />
      <text
        x="12"
        y="16.6"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fontFamily="var(--display)"
        fill="currentColor"
      >
        {letter}
      </text>
    </svg>
  );
}
