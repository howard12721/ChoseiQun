import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorSource = "render" | "window-error" | "unhandled-rejection";

type CapturedError = {
  source: ErrorSource;
  name: string;
  message: string;
  stack?: string;
  componentStack?: string;
};

type CrashBoundaryState = {
  renderError: CapturedError | null;
  asyncError: CapturedError | null;
};

export default class CrashBoundary extends Component<{ children: ReactNode }, CrashBoundaryState> {
  state: CrashBoundaryState = {
    renderError: null,
    asyncError: null,
  };

  static getDerivedStateFromError(error: Error): Partial<CrashBoundaryState> {
    return {
      renderError: normalizeError(error, "render"),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({
      renderError: normalizeError(error, "render", info.componentStack),
    });
  }

  componentDidMount() {
    if (!import.meta.env.DEV) {
      return;
    }
    window.addEventListener("error", this.handleWindowError);
    window.addEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    if (!import.meta.env.DEV) {
      return;
    }
    window.removeEventListener("error", this.handleWindowError);
    window.removeEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  render() {
    const { renderError, asyncError } = this.state;

    if (renderError) {
      return (
        <CrashScreen
          error={renderError}
          onGoHome={() => window.location.assign("/")}
          onReload={() => window.location.reload()}
        />
      );
    }

    return (
      <>
        {this.props.children}
        {import.meta.env.DEV && asyncError ? (
          <AsyncErrorPanel error={asyncError} onDismiss={() => this.setState({ asyncError: null })} />
        ) : null}
      </>
    );
  }

  private handleWindowError = (event: ErrorEvent) => {
    this.setState({
      asyncError: normalizeError(event.error ?? event.message, "window-error"),
    });
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    this.setState({
      asyncError: normalizeError(event.reason, "unhandled-rejection"),
    });
  };
}

function CrashScreen(props: { error: CapturedError; onReload: () => void; onGoHome: () => void }) {
  const { error, onReload, onGoHome } = props;

  return (
    <main className="crash-screen">
      <section className="crash-card">
        <span className="eyebrow">Frontend Crash</span>
        <h1>画面の描画中にエラーが発生しました</h1>
        <p className="crash-message">{error.message}</p>
        <div className="button-row">
          <button className="primary-button" type="button" onClick={onReload}>
            再読み込み
          </button>
          <button className="secondary-button" type="button" onClick={onGoHome}>
            トップへ戻る
          </button>
        </div>
        {import.meta.env.DEV ? <CrashDetails error={error} /> : null}
      </section>
    </main>
  );
}

function AsyncErrorPanel(props: { error: CapturedError; onDismiss: () => void }) {
  const { error, onDismiss } = props;

  return (
    <aside className="async-error-panel" role="alert" aria-live="assertive">
      <div className="async-error-panel__header">
        <strong>開発中の例外を検出しました</strong>
        <button className="secondary-button async-error-panel__dismiss" type="button" onClick={onDismiss}>
          閉じる
        </button>
      </div>
      <p className="crash-message">{error.message}</p>
      <CrashDetails error={error} compact />
    </aside>
  );
}

function CrashDetails({ error, compact = false }: { error: CapturedError; compact?: boolean }) {
  return (
    <div className={`crash-details${compact ? " crash-details--compact" : ""}`}>
      <div className="crash-meta">
        <span className="shell-chip">{labelForSource(error.source)}</span>
        <span className="shell-chip">{error.name || "Error"}</span>
      </div>
      {error.stack ? <pre className="crash-stack">{error.stack}</pre> : null}
      {error.componentStack ? <pre className="crash-stack">{error.componentStack}</pre> : null}
    </div>
  );
}

function labelForSource(source: ErrorSource) {
  if (source === "render") {
    return "Render";
  }
  if (source === "window-error") {
    return "Window Error";
  }
  return "Unhandled Rejection";
}

function normalizeError(value: unknown, source: ErrorSource, componentStack?: string | null): CapturedError {
  if (value instanceof Error) {
    return {
      source,
      name: value.name || "Error",
      message: value.message || "Unknown error",
      stack: value.stack,
      componentStack: componentStack?.trim() || undefined,
    };
  }

  if (typeof value === "string") {
    return {
      source,
      name: "Error",
      message: value || "Unknown error",
      componentStack: componentStack?.trim() || undefined,
    };
  }

  return {
    source,
    name: "Error",
    message: "予期しないエラーが発生しました",
    stack: safeStringify(value),
    componentStack: componentStack?.trim() || undefined,
  };
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
