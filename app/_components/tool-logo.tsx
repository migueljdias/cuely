import { logoSrc } from "@/logos";

/**
 * A tool's brand icon as a small rounded tile. Icons identify a tool; they never rank it.
 * Tools without an icon get a plain monogram tile the same size.
 */
export function ToolLogo({ slug, name, size = 20 }: { slug: string; name: string; size?: number }) {
  const src = logoSrc(slug);
  const style = { width: size, height: size, ["--logo-size" as string]: `${size}px` };
  if (src) {
    return <img className="tlogo" src={src} alt="" width={size} height={size} loading="lazy" decoding="async" style={style} />;
  }
  const letter = name.replace(/^Amazon\s+/, "").charAt(0).toUpperCase();
  return (
    <span className="tlogo tlogo-mono" aria-hidden="true" style={style}>
      {letter}
    </span>
  );
}
