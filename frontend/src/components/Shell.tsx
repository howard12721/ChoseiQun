import type { ReactNode } from "react";
import type { AppRoute } from "../app/types";
import { routeKindLabel } from "../utils/ui";

export function Shell({
  children,
  flash,
  routeKind,
}: {
  children: ReactNode;
  flash?: string | null;
  routeKind: AppRoute["kind"];
}) {
  return (
    <div className="app-shell">
      <header className="shell-header">
        <div className="shell-brand">
          <span className="shell-product">ChoseiQun</span>
          <span className="shell-description">traQ scheduling dashboard</span>
        </div>
        <div className="shell-meta">
          <span className="shell-chip">{routeKindLabel(routeKind)}</span>
        </div>
      </header>
      <main className="shell-content">
        {children}
        {flash ? <div className="floating-flash">{flash}</div> : null}
      </main>
    </div>
  );
}

export function Hero({ title, body }: { title: string; body: string }) {
  return (
    <section className="hero-card hero-card--compact">
      <span className="eyebrow">Status</span>
      <h1>{title}</h1>
      <p>{body}</p>
      <a className="secondary-button" href="/">
        トップへ戻る
      </a>
    </section>
  );
}
