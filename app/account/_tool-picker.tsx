"use client";

import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { ToolLogo } from "../_components/tool-logo";

export interface ToolOption {
  slug: string;
  name: string;
  category: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Picks catalog tools as chips. Type to filter, Enter or click to add; pasting
 * "Vercel, Supabase, Clerk" adds each name it recognises. Submits one hidden "tools"
 * input per chosen slug.
 */
export function ToolPicker({
  options,
  initial = [],
  name = "tools",
  label = "Tools",
}: {
  options: ToolOption[];
  initial?: string[];
  name?: string;
  label?: string;
}) {
  const id = useId();
  const bySlug = useMemo(() => new Map(options.map((o) => [o.slug, o])), [options]);
  const [picked, setPicked] = useState<string[]>(initial.filter((s) => bySlug.has(s)));
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);

  const find = (text: string) => {
    const k = norm(text);
    if (!k) return null;
    return options.find((o) => norm(o.slug) === k || norm(o.name) === k) ?? options.find((o) => norm(o.name).startsWith(k)) ?? null;
  };

  const matches = useMemo(() => {
    const k = norm(q);
    if (!k) return [];
    return options
      .filter((o) => !picked.includes(o.slug) && (norm(o.name).includes(k) || norm(o.slug).includes(k) || norm(o.category).includes(k)))
      .slice(0, 8);
  }, [q, options, picked]);

  const add = (slug: string) => {
    setPicked((p) => (p.includes(slug) ? p : [...p, slug]));
    setQ("");
    setHi(0);
  };

  const onChange = (v: string) => {
    if (v.includes(",")) {
      const parts = v.split(",");
      const last = parts.pop() ?? "";
      const found = parts.map(find).filter((o) => o !== null);
      setPicked((p) => [...new Set([...p, ...found.map((o) => o.slug)])]);
      setQ(last.trimStart());
    } else setQ(v);
    setHi(0);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (!q.trim()) return;
      e.preventDefault();
      const o = matches[hi] ?? find(q);
      if (o) add(o.slug);
    } else if (e.key === "Backspace" && !q && picked.length) {
      setPicked((p) => p.slice(0, -1));
    }
  };

  return (
    <div className="picker">
      <label className="field-label" htmlFor={`${id}-q`}>
        {label}
      </label>
      <div className="picker-box">
        {picked.map((slug) => {
          const o = bySlug.get(slug)!;
          return (
            <span key={slug} className="chip">
              <ToolLogo slug={o.slug} name={o.name} size={16} />
              {o.name}
              <button type="button" onClick={() => setPicked((p) => p.filter((s) => s !== slug))} aria-label={`Remove ${o.name}`}>
                <X size={12} />
              </button>
              <input type="hidden" name={name} value={slug} />
            </span>
          );
        })}
        <input
          id={`${id}-q`}
          type="text"
          value={q}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          placeholder={picked.length ? "Add another…" : "Start typing: Vercel, Supabase, Clerk…"}
          autoComplete="off"
          role="combobox"
          aria-expanded={matches.length > 0}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
        />
      </div>
      {matches.length > 0 && (
        <ul className="picker-list" id={`${id}-list`} role="listbox">
          {matches.map((o, i) => (
            <li key={o.slug} role="option" aria-selected={i === hi}>
              <button type="button" className={i === hi ? "is-hi" : undefined} onMouseDown={(e) => e.preventDefault()} onClick={() => add(o.slug)}>
                <ToolLogo slug={o.slug} name={o.name} size={18} />
                <span>{o.name}</span>
                <span className="muted small">{o.category}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
