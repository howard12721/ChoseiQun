export type AppRoute =
  | { kind: "home" }
  | { kind: "answers" }
  | { kind: "setup"; id: string }
  | { kind: "poll"; id: string }
  | { kind: "results"; id: string };

export function resolveRoute(): AppRoute {
  return parseRoute(window.location.pathname);
}

export function parseRoute(pathname: string): AppRoute {
  if (pathname === "/answers") {
    return { kind: "answers" };
  }

  const setupMatch = pathname.match(/^\/setup\/([^/]+)$/);
  if (setupMatch) {
    return { kind: "setup", id: setupMatch[1] };
  }

  const resultsMatch = pathname.match(/^\/polls\/([^/]+)\/results$/);
  if (resultsMatch) {
    return { kind: "results", id: resultsMatch[1] };
  }

  const pollMatch = pathname.match(/^\/polls\/([^/]+)$/);
  if (pollMatch) {
    return { kind: "poll", id: pollMatch[1] };
  }

  return { kind: "home" };
}
