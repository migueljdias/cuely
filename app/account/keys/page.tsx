import type { Metadata } from "next";
import { connectOptions } from "@/connect";
import { SITE_URL } from "@/site";
import { ConnectTabs } from "../../_components/connect-tabs";
import { NewKey } from "../_new-key";
import { accountSession, day } from "../_session";
import { revokeKeyAction } from "../actions";

export const metadata: Metadata = { title: "API keys · Cuely", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function KeysPage() {
  const { user, store, plan } = await accountSession();
  const keys = store ? await store.listKeys(user.id) : [];

  return (
    <div className="account">
      <div className="app-section">
        <h1 className="app-title">API keys</h1>
        <p className="app-lede">
          For Cursor, VS Code, Claude Code and scripts. The Claude app signs in on its own and needs no key.{" "}
          {plan.id === "free" ? "Free includes one key." : `Pro includes up to ${plan.maxKeys}.`}
        </p>
      </div>

      <section className="panel" aria-labelledby="keys-title">
        <div className="panel-head">
          <h2 id="keys-title">
            Your keys <span className="tag">{keys.length} / {plan.maxKeys}</span>
          </h2>
          <p className="muted">Only a hash of each key is stored. Lost one? Revoke it and make a new one.</p>
        </div>
        {keys.length > 0 ? (
          <ul className="key-list">
            {keys.map((k) => (
              <li key={k.id}>
                <div>
                  <code>{k.prefix}…</code>
                  <span className="key-name">{k.name}</span>
                </div>
                <span className="muted">
                  Created {day(k.createdAt)} · {k.lastUsedAt ? `Last used ${day(k.lastUsedAt)}` : "Not used yet"}
                </span>
                <form action={revokeKeyAction}>
                  <input type="hidden" name="id" value={k.id} />
                  <button type="submit" className="btn btn-quiet btn-small">
                    Revoke
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No keys yet.</p>
        )}
        <NewKey />
      </section>

      <section id="connect" className="panel" aria-labelledby="connect-title">
        <div className="panel-head">
          <h2 id="connect-title">Connect your AI tool</h2>
          <p className="muted">
            Replace YOUR_CUELY_KEY with a key from above (a new key shows this with it filled in), then start a new chat
            and ask: <q>Use Cuely to choose the stack for what I&apos;m building.</q>
          </p>
        </div>
        <ConnectTabs options={connectOptions()} />
        <p className="muted small">
          Step-by-step help: <a href={`${SITE_URL}/start`}>Get started</a>.
        </p>
      </section>
    </div>
  );
}
