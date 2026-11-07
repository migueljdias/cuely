"use client";

import { useActionState } from "react";
import { CopyButton } from "../_components/copy";
import { createKeyAction, type KeyState } from "./actions";

export function NewKey() {
  const [state, action, pending] = useActionState<KeyState, FormData>(createKeyAction, null);
  return (
    <div className="new-key">
      <form action={action} className="inline-form">
        <label className="field field-inline">
          <span className="sr-only">Key name</span>
          <input name="name" type="text" placeholder="Name, like laptop or CI" maxLength={60} />
        </label>
        <button type="submit" className="btn btn-quiet" disabled={pending}>
          {pending ? "Creating…" : "Create key"}
        </button>
      </form>
      {state?.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      {state?.key && (
        <div className="key-reveal" role="status">
          <p>Copy this key now. It won&apos;t be shown again.</p>
          <div className="endpoint">
            <code>{state.key}</code>
            <CopyButton value={state.key} />
          </div>
        </div>
      )}
    </div>
  );
}
