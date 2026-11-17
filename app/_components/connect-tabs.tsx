"use client";

import { useState } from "react";
import { CopyButton } from "./copy";

export interface ConnectOption {
  id: string;
  label: string;
  where: string;
  code: string;
  oauth?: boolean;
}

export function ConnectTabs({ options }: { options: ConnectOption[] }) {
  const [active, setActive] = useState(options[0].id);
  const current = options.find((o) => o.id === active) ?? options[0];
  return (
    <div className="tabs">
      <div className="tablist" role="tablist" aria-label="Agent">
        {options.map((o) => (
          <button
            key={o.id}
            role="tab"
            id={`tab-${o.id}`}
            aria-selected={o.id === active}
            aria-controls={`panel-${o.id}`}
            className="tab"
            onClick={() => setActive(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="tabpanel" role="tabpanel" id={`panel-${current.id}`} aria-labelledby={`tab-${current.id}`}>
        <p className="where">{current.where}</p>
        <div className="codeblock">
          <pre>
            <code>{current.code}</code>
          </pre>
          <CopyButton value={current.code} />
        </div>
      </div>
    </div>
  );
}
