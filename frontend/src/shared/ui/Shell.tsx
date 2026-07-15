import type { ReactNode } from "react";

export type FlashTone = "success" | "error" | "info";

export type FlashMessage = {
  message: string;
  tone: FlashTone;
};

export function Shell({
  children,
  flash,
  onDismissFlash,
}: {
  children: ReactNode;
  flash?: FlashMessage | null;
  onDismissFlash?: () => void;
}) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        本文へ移動
      </a>
      <header className="shell-header">
        <a className="shell-brand" href="/" aria-label="ChoseiQun トップへ">
          <span className="shell-product">ChoseiQun</span>
        </a>
      </header>
      <main className="shell-content" id="main-content">
        {children}
        {flash ? (
          <div
            className={`floating-flash floating-flash--${flash.tone}`}
            role={flash.tone === "error" ? "alert" : "status"}
            aria-live={flash.tone === "error" ? "assertive" : "polite"}
            aria-atomic="true"
          >
            <span className="floating-flash__mark" aria-hidden="true">
              {flash.tone === "error" ? "!" : flash.tone === "success" ? "✓" : "i"}
            </span>
            <span>{flash.message}</span>
            {flash.tone === "error" && onDismissFlash ? (
              <button
                className="floating-flash__dismiss"
                type="button"
                aria-label="エラー通知を閉じる"
                onClick={onDismissFlash}
              >
                ×
              </button>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}

export function Hero({
  title,
  body,
  loading = false,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <section className="hero-card hero-card--compact" aria-busy={loading || undefined}>
      {loading ? <span className="loading-indicator" aria-hidden="true" /> : null}
      <h1>{title}</h1>
      <p>{body}</p>
      <div className="button-row">
        {actionLabel && onAction ? (
          <button className="primary-button" type="button" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
        {!loading ? (
          <a className="secondary-button" href="/">
            トップへ戻る
          </a>
        ) : null}
      </div>
    </section>
  );
}
