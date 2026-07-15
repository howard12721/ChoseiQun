import type { AppRoute } from "./types";

export function resolveRoute(): AppRoute {
  if (window.location.pathname === "/answers") {
    return { kind: "answers" };
  }

  const setupMatch = window.location.pathname.match(/^\/setup\/([^/]+)$/);
  if (setupMatch) {
    return { kind: "setup", id: setupMatch[1] };
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
  if (kind === "answers") return "Answers";
  if (kind === "setup") return "Setup";
  if (kind === "results") return "Results";
  return "Poll";
}
