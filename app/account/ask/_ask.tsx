"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ToolPicker, type ToolOption } from "../_tool-picker";
import { createStackAction, type StackFormState } from "../projects/actions";
import { askAction, type AskMode, type AskState } from "./actions";
import { CheckView, CompareView, StartView } from "./_results";

const MODES: { id: AskMode; label: string; lede: string }[] = [
  { id: "start", label: "Plan a new build", lede: "The stack, its monthly cost at 1,000 users, and the security and compliance checklist." },
  { id: "check", label: "Check my stack", lede: "Keep or change for each tool you use now, and the core parts that are missing." },
  { id: "compare", label: "Compare two tools", lede: "Free plans, prices, strengths and a verdict for your case." },
];

const EXAMPLES: Record<AskMode, string> = {
  start: "B2B SaaS for small accounting firms, EU customers, monthly subscription",
  check: "Next.js app where therapists keep patient notes, now adding EU customers",
  compare: "B2B SaaS that will need SSO for enterprise customers",
};

/** "Save as a stack" under an answer: keeps the tools (and description) on the account. */
function SaveStack({ tools, description, name, canSave }: { tools: string[]; description: string; name: string; canSave: boolean }) {
  const [state, action, pending] = useActionState<StackFormState, FormData>(createStackAction, null);
  if (!tools.length) return null;
  if (!canSave) {
    return (
      <p className="muted small">
        You&apos;ve saved as many stacks as your plan allows. <Link href="/account/projects">Manage stacks</Link>
      </p>
    );
  }
  return (
    <form action={action} className="save-row">
      {tools.map((t) => (
        <input key={t} type="hidden" name="tools" value={t} />
      ))}
      <input type="hidden" name="description" value={description} />
      <label className="field field-inline">
        <span className="sr-only">Stack name</span>
        <input name="name" type="text" defaultValue={name} maxLength={80} />
      </label>
      <button type="submit" className="btn btn-quiet btn-small" disabled={pending}>
        {pending ? "Saving…" : "Save as a stack to watch"}
      </button>
      {state?.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function Ask({ options, initialMode, canSave }: { options: ToolOption[]; initialMode: AskMode; canSave: boolean }) {
  const [mode, setMode] = useState<AskMode>(initialMode);
  const [state, action, pending] = useActionState<AskState, FormData>(askAction, null);
  const current = MODES.find((m) => m.id === mode)!;
  const shown = state && "mode" in state && state.mode === mode ? state : null;

  const pick = (m: AskMode) => {
    setMode(m);
    window.history.replaceState(null, "", `/account/ask?mode=${m}`);
  };

  return (
    <>
      <section className="panel" aria-labelledby="ask-form-title">
        <div className="seg" role="tablist" aria-label="What to ask">
          {MODES.map((m) => (
            <button key={m.id} type="button" role="tab" aria-selected={m.id === mode} className={m.id === mode ? "is-on" : undefined} onClick={() => pick(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <h2 id="ask-form-title" className="sr-only">
          {current.label}
        </h2>
        <p className="muted">{current.lede}</p>

        <form action={action} className="form" key={mode}>
          <input type="hidden" name="mode" value={mode} />
          {mode === "compare" && (
            <div className="two-col">
              <label className="field">
                <span>First tool</span>
                <select name="a" required defaultValue="">
                  <option value="" disabled>
                    Choose…
                  </option>
                  {options.map((o) => (
                    <option key={o.slug} value={o.slug}>
                      {o.name} ({o.category})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Second tool</span>
                <select name="b" required defaultValue="">
                  <option value="" disabled>
                    Choose…
                  </option>
                  {options.map((o) => (
                    <option key={o.slug} value={o.slug}>
                      {o.name} ({o.category})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {mode === "check" && (
            <ToolPicker
              key={shown?.mode === "check" ? shown.using.join() : "new"}
              options={options}
              initial={shown?.mode === "check" ? shown.result.items.filter((i) => i.current).map((i) => i.current!.slug) : []}
              label="Tools the project uses now"
            />
          )}
          <label className="field">
            <span>
              {mode === "compare" ? "What you're building" : mode === "check" ? "What the project is" : "What you're building"}
              {mode === "compare" && <span className="muted"> (optional, for a verdict for your case)</span>}
            </span>
            <textarea
              key={shown && "description" in shown ? shown.description : "new"}
              name="description"
              rows={3}
              maxLength={2000}
              required={mode !== "compare"}
              placeholder={EXAMPLES[mode]}
              defaultValue={shown && "description" in shown ? shown.description : undefined}
            />
            <span className="muted small" style={{ fontWeight: 400 }}>
              Plain words only: who it&apos;s for, what it does, region, budget. No code, secrets or names of people or companies.
              Nothing you type here is stored.
            </span>
          </label>
          {state && "error" in state && (
            <p className="form-error" role="alert">
              {state.error}
            </p>
          )}
          <div>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? "Asking…" : "Ask Cuely"}
            </button>
            <span className="muted small" style={{ marginLeft: 12 }}>
              Counts as one tool call.
            </span>
          </div>
        </form>
      </section>

      {shown && (
        <section className="panel" aria-label="Answer" aria-live="polite">
          {shown.mode === "start" && (
            <>
              <StartView result={shown.result} />
              <SaveStack
                canSave={canSave}
                tools={shown.result.recommendation.stack.filter((s) => s.role === "core").map((s) => s.pick.slug)}
                description={shown.description}
                name={shown.result.recommendation.productType.label || "New build"}
              />
            </>
          )}
          {shown.mode === "check" && (
            <>
              <CheckView result={shown.result} />
              <SaveStack
                canSave={canSave}
                tools={shown.result.items.filter((i) => i.current).map((i) => i.current!.slug)}
                description={shown.description}
                name={shown.result.productLabel || "My project"}
              />
            </>
          )}
          {shown.mode === "compare" && <CompareView result={shown.result} />}
        </section>
      )}
    </>
  );
}
