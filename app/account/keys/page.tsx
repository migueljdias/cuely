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
    <div className="keys-page">
      <div>
        <h1 className="app-h1">API keys</h1>
        <p className="project-desc">For Claude Code, Cursor, VS Code and scripts. The Claude app signs in on its own and needs no key.</p>
      </div>

      <div className="keys-grid">
        <section className="card" aria-labelledby="h-keys">
          <div className="card-head">
            <h2 id="h-keys">Your keys</h2>
            <span className="muted small">
              {keys.length} of {plan.maxKeys} on {plan.name} · only a hash is stored
            </span>
          </div>
          {keys.length > 0 ? (
            <ul className="app-keys">
              {keys.map((k) => (
                <li key={k.id}>
                  <div>
                    <code>{k.prefix}…</code>
                    <span className="app-key-name">{k.name}</span>
                    <span className="app-key-sub">{k.lastUsedAt ? `Last used ${day(k.lastUsedAt)}` : "Not used yet"}</span>
                  </div>
                  <span className="muted small">Created {day(k.createdAt)}</span>
                  <form action={revokeKeyAction}>
                    <input type="hidden" name="id" value={k.id} />
                    <button type="submit" className="btn-app btn-app-small">
                      Revoke
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No keys yet. Lost one? Revoke it and make a new one.</p>
          )}
          <NewKey />
        </section>

        <section id="connect" className="card" aria-labelledby="h-connect">
          <h2 id="h-connect" className="card-title">
            Connect your AI tool
          </h2>
          <p className="card-sub">
            Replace YOUR_CUELY_KEY with a key from this page (a new key shows this with it filled in).
          </p>
          <ConnectTabs options={connectOptions()} />
          <p className="card-text muted small">
            Then start a new chat and ask: <q>Use Cuely to choose the stack for what I&apos;m building.</q> Step-by-step help:{" "}
            <a href={`${SITE_URL}/start`}>Get started</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
