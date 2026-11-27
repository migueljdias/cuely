"use client";

import { useActionState } from "react";
import { ToolPicker, type ToolOption } from "../_tool-picker";
import { createStackAction, updateStackAction, type StackFormState } from "./actions";

/** Create a project, or edit one when `stack` is given. */
export function StackForm({
  options,
  stack,
  submitLabel,
}: {
  options: ToolOption[];
  stack?: { id: number; name: string; description: string; tools: string[] };
  submitLabel?: string;
}) {
  const [state, action, pending] = useActionState<StackFormState, FormData>(stack ? updateStackAction : createStackAction, null);
  return (
    <form action={action} className="form stack-form">
      {stack && <input type="hidden" name="id" value={stack.id} />}
      <label className="field">
        <span>Name</span>
        <input name="name" type="text" required maxLength={80} defaultValue={stack?.name} placeholder="Client portal, side project…" />
      </label>
      <ToolPicker options={options} initial={stack?.tools} label="Tools it uses" />
      <label className="field">
        <span>
          What it is <span className="muted">(optional)</span>
        </span>
        <textarea
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={stack?.description}
          placeholder="Next.js app where therapists keep patient notes, EU customers"
        />
        <span className="muted small" style={{ fontWeight: 400 }}>
          Lets Cuely say keep or change for each tool. Plain words only: no code, secrets or names of people or companies.
        </span>
      </label>
      {state?.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      <div>
        <button type="submit" className="btn-app btn-app-primary" disabled={pending}>
          {pending ? "Saving…" : (submitLabel ?? (stack ? "Save changes" : "Save project"))}
        </button>
      </div>
    </form>
  );
}
