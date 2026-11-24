"use client";

import { useActionState, useState } from "react";
import { deleteAccountAction, type DeleteState } from "../actions";

/** Delete account, behind a typed confirmation. */
export function DeleteAccount({ pro }: { pro: boolean }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteAccountAction, null);

  if (!open) {
    return (
      <button type="button" className="btn-app btn-app-small btn-app-danger" onClick={() => setOpen(true)}>
        Delete my account
      </button>
    );
  }
  return (
    <form action={action} className="delete-confirm">
      <p>
        This deletes your projects and checklist ticks, API keys (any agent using them stops working) and usage history,
        then your sign-in.{pro ? " Pro stops renewing; you keep it until the end of the period you paid for, and it isn't refunded." : ""}
      </p>
      <label className="field">
        <span>Type DELETE to confirm</span>
        <input name="confirm" type="text" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
      </label>
      {state?.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      <div className="delete-actions">
        <button type="submit" className="btn-app btn-app-small btn-app-danger" disabled={pending || typed.trim() !== "DELETE"}>
          {pending ? "Deleting…" : "Delete everything"}
        </button>
        <button type="button" className="btn-app btn-app-small" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  );
}
