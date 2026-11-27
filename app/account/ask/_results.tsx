import type { ProjectCheck } from "@/engine/check";
import type { CompareResult } from "@/engine/compare";
import type { Recommendation } from "@/engine/recommend";
import type { ChecklistItem, ProjectStart } from "@/engine/start";
import { SITE_URL } from "@/site";
import { ToolLogo } from "../../_components/tool-logo";
import { plain } from "../_options";

const usd = (v: number) => (v > 0 && v < 1 ? "under $1" : `$${Math.round(v).toLocaleString("en-US")}`);

/*
  Ask Cuely's answers as pages rather than the markdown agents get. Plain components with no
  state, so the stack page (a server component) and the Ask form (a client one) both use them.
*/

const ROLE = { core: null, optional: "Optional", if_you_build: "If you build it" } as const;
const AREA: Record<ChecklistItem["area"], string> = {
  security: "Security",
  privacy: "Privacy",
  compliance: "Compliance",
  payments: "Payments",
  ai: "AI",
  app_stores: "App stores",
};

function Catches({ items }: { items: { text: string; source: string; verifiedOn: string }[] }) {
  if (!items.length) return null;
  return (
    <>
      <h3 className="sub-head">Catches that matter</h3>
      <ul className="catch-list">
        {items.map((c) => (
          <li key={c.text}>
            {plain(c.text)}{" "}
            <a className="muted small" href={c.source}>
              read {c.verifiedOn}
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

function Notes({ notes }: { notes: string[] }) {
  return notes.length ? (
    <ul className="note-list">
      {notes.map((n) => (
        <li key={n}>{n}</li>
      ))}
    </ul>
  ) : null;
}

export function RecommendationView({ rec }: { rec: Recommendation }) {
  if (rec.status === "outside_coverage") {
    return (
      <div className="result">
        <h3 className="result-head">Outside Cuely&apos;s coverage</h3>
        <Notes notes={rec.coverage.notes} />
      </div>
    );
  }
  if (rec.status === "needs_answers") {
    return (
      <div className="result">
        <h3 className="result-head">A few questions first</h3>
        <ol className="note-list">
          {rec.questions.map((q) => (
            <li key={q.question}>
              {q.question} <span className="muted small">{q.why}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }
  const s = rec.summary!;
  return (
    <div className="result">
      <h3 className="result-head">{s.headline}</h3>
      {rec.profile.assumed.length > 0 && <p className="muted small">Assumed: {rec.profile.assumed.join("; ")}.</p>}
      {s.cost && (
        <div className="cost-box">
          <span className="cost-num">
            {usd(s.cost.monthly)}
            <small>/month</small>
          </span>
          <span className="muted small">{s.cost.text}</span>
        </div>
      )}
      <ul className="pick-list">
        {rec.stack.map((x) => (
          <li key={x.category}>
            <ToolLogo slug={x.pick.slug} name={x.pick.name} size={28} />
            <div>
              <span className="muted small">
                {x.categoryName}
                {ROLE[x.role] && <span className="tag">{ROLE[x.role]}</span>}
              </span>
              <strong>
                <a href={`${SITE_URL}/tools/${x.pick.slug}`}>{x.pick.name}</a>
              </strong>
              <span className="small">{plain(x.pick.reason)}</span>
              {x.alternatives[0] && (
                <span className="muted small">
                  Or {x.alternatives[0].name}: {x.alternatives[0].when}
                </span>
              )}
            </div>
            <span className="pick-cost">
              {x.pick.monthlyCost !== null ? usd(x.pick.monthlyCost) : "—"}
              <small>{x.pick.freeTier ? "Free plan" : "Paid"}</small>
            </span>
          </li>
        ))}
      </ul>
      <Catches items={s.catches} />
      {rec.productType.recipe && (
        <p className="small">
          Setup steps: <a href={`${SITE_URL}/recipes/${rec.productType.recipe}`}>{rec.productType.title ?? rec.productType.recipe} recipe</a>
        </p>
      )}
    </div>
  );
}

export function StartView({ result }: { result: ProjectStart }) {
  const phases = [
    { id: "day_one", title: "Before real data goes in" },
    { id: "before_launch", title: "Before launch" },
  ] as const;
  return (
    <>
      <RecommendationView rec={result.recommendation} />
      {result.checklist.length > 0 && (
        <div className="result">
          <h3 className="result-head">Security and compliance checklist</h3>
          {phases.map((p) => {
            const items = result.checklist.filter((c) => c.phase === p.id);
            if (!items.length) return null;
            return (
              <div key={p.id}>
                <h4 className="sub-head">{p.title}</h4>
                <ul className="check-list">
                  {items.map((c) => (
                    <li key={c.id}>
                      <details>
                        <summary>
                          <span className="tag">{AREA[c.area]}</span> {c.title}
                        </summary>
                        <p className="small">{c.detail}</p>
                        <p className="muted small">
                          Why: {c.why} <a href={c.source}>Source</a>
                        </p>
                      </details>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

const VERDICT = { keep: "Keep", switch: "Change", add: "Add" } as const;

export function CheckView({ result }: { result: ProjectCheck }) {
  if (result.status !== "ok") {
    return (
      <div className="result">
        <h3 className="result-head">{result.headline}</h3>
        <p className="muted small">{result.nextStep}</p>
      </div>
    );
  }
  return (
    <div className="result">
      <h3 className="result-head">{result.headline}</h3>
      {result.assumed.length > 0 && <p className="muted small">Assumed: {result.assumed.join("; ")}.</p>}
      <ul className="verdict-list">
        {result.items.map((i) => {
          const tool = i.current ?? i.suggestion!;
          return (
            <li key={`${i.category}-${tool.slug}`} className={`is-${i.verdict}`}>
              <span className={`verdict verdict-${i.verdict}`}>{VERDICT[i.verdict]}</span>
              <ToolLogo slug={tool.slug} name={tool.name} size={24} />
              <div>
                <span className="muted small">{i.categoryName}</span>
                <strong>
                  {i.current?.name ?? i.suggestion!.name}
                  {i.verdict === "switch" && i.suggestion && <> → {i.suggestion.name}</>}
                </strong>
                <span className="small">{plain(i.why)}</span>
                {i.watch.length > 0 && <span className="muted small">Watch: {plain(i.watch.join(" "))}</span>}
              </div>
            </li>
          );
        })}
      </ul>
      {result.optionalAdds.length > 0 && (
        <>
          <h4 className="sub-head">Worth considering</h4>
          <ul className="note-list">
            {result.optionalAdds.map((o) => (
              <li key={o.category}>
                <strong>{o.categoryName}:</strong> {o.name}. {o.reason}
              </li>
            ))}
          </ul>
        </>
      )}
      <Catches items={result.catches} />
      {result.notChecked.length > 0 && <p className="muted small">Not in the catalog, so not checked: {result.notChecked.join(", ")}.</p>}
    </div>
  );
}

export function CompareView({ result }: { result: CompareResult }) {
  if (!result.ok) {
    return (
      <div className="result">
        <p className="form-error">{result.error}</p>
      </div>
    );
  }
  const [a, b] = result.tools;
  return (
    <div className="result">
      <h3 className="result-head">{result.verdict}</h3>
      <div className="compare-grid">
        {result.tools.map((t) => (
          <div key={t.slug} className="compare-col">
            <div className="tool-facts-head">
              <ToolLogo slug={t.slug} name={t.name} size={28} />
              <strong>
                <a href={`${SITE_URL}/tools/${t.slug}`}>{t.name}</a>
              </strong>
            </div>
            <p className="small">{t.summary}</p>
            <dl>
              <dt>Free plan</dt>
              <dd>{t.freeTier ?? "None"}</dd>
              <dt>Paid from</dt>
              <dd>{t.paidStartsAt ?? "—"}</dd>
              <dt>Best for</dt>
              <dd>{t.bestFor.join(", ")}</dd>
              {t.watchOut[0] && (
                <>
                  <dt>Watch out</dt>
                  <dd>{t.watchOut[0]}</dd>
                </>
              )}
              {t.compliance.length > 0 && (
                <>
                  <dt>Compliance</dt>
                  <dd>{plain(t.compliance.join(" "))}</dd>
                </>
              )}
            </dl>
            <p className="muted small">
              Read {t.verifiedOn} from <a href={t.pricingUrl}>pricing page</a>
            </p>
          </div>
        ))}
      </div>
      {result.differences.length > 0 && (
        <>
          <h4 className="sub-head">Where they differ</h4>
          <ul className="diff-list">
            {result.differences.slice(0, 6).map((d) => (
              <li key={d.need}>
                <strong>{d.label}</strong>
                <span className="small">
                  {a.name}: {d.a.reason}
                </span>
                <span className="small">
                  {b.name}: {d.b.reason}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
