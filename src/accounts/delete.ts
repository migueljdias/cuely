/**
 * Deleting an account, in the order that never leaves someone billed without an account:
 *
 * 1. Stop Pro: the Stripe subscription is set to cancel at the end of the period already
 *    paid for, so no further charge is made. If Stripe can't be reached, nothing else runs.
 * 2. Delete the account row. Keys, usage counts and projects (with checklist ticks) go with
 *    it through `on delete cascade`.
 * 3. Delete the sign-in user at Clerk, which also ends their sessions. If this step fails the
 *    Cuely data is already gone; signing in again would only start a new, empty account.
 */
export interface DeleteSteps {
  /** The account's Stripe subscription id, when it has a live one. */
  subscriptionId: string | null;
  cancelSubscription: (id: string) => Promise<void>;
  deleteRows: () => Promise<void>;
  deleteAuthUser: () => Promise<void>;
}

export type DeleteResult = { ok: true; authDeleted: boolean } | { ok: false; error: string };

export async function deleteAccount(steps: DeleteSteps): Promise<DeleteResult> {
  if (steps.subscriptionId) {
    try {
      await steps.cancelSubscription(steps.subscriptionId);
    } catch (err) {
      console.error("account delete: subscription cancel failed", err);
      return { ok: false, error: "Couldn't stop your Pro subscription just now, so nothing was deleted. Try again in a minute, or write to support." };
    }
  }
  try {
    await steps.deleteRows();
  } catch (err) {
    console.error("account delete: rows failed", err);
    return { ok: false, error: "Couldn't delete your data just now. Nothing was removed. Try again in a minute, or write to support." };
  }
  try {
    await steps.deleteAuthUser();
    return { ok: true, authDeleted: true };
  } catch (err) {
    console.error("account delete: auth user failed", err);
    return { ok: true, authDeleted: false };
  }
}
