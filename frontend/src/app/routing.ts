import type { AppRoute } from "./types";

export function resolveRoute(): AppRoute {
  const setupMatch = window.location.pathname.match(/^\/setup\/([^/]+)$/);
  if (setupMatch) {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      throw new Error("設定URLの token がありません");
    }
    return { kind: "setup", id: setupMatch[1], token };
  }

  const resultsMatch = window.location.pathname.match(/^\/polls\/([^/]+)\/results$/);
  if (resultsMatch) {
    return { kind: "results", id: resultsMatch[1] };
  }

  const pollMatch = window.location.pathname.match(/^\/polls\/([^/]+)$/);
  if (pollMatch) {
    return { kind: "poll", id: pollMatch[1] };
  }

  return { kind: "home" };
}

export function routeLabel(kind: AppRoute["kind"]) {
  if (kind === "home") return "Home";
  if (kind === "setup") return "Setup";
  if (kind === "results") return "Results";
  return "Poll";
}
