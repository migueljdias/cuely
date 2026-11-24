"use client";

import { useActionState } from "react";
import { connectOptions } from "@/connect";
import { ConnectTabs } from "../_components/connect-tabs";
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
        <button type="submit" className="btn-app btn-app-primary" disabled={pending}>
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
          <div className="connect-next">
            <h3>Now add Cuely to your AI tool</h3>
            <p className="muted small">Your key is already filled in. Paste the one for your tool, then start a new chat.</p>
            <ConnectTabs options={connectOptions(state.key).filter((o) => !o.oauth)} />
            <p className="muted small">
              Then ask: <q>Use Cuely to choose the stack for what I&apos;m building.</q>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
