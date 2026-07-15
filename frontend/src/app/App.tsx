import { useMemo } from "react";
import { AnswersRoute } from "../routes/AnswersRoute";
import { HomeRoute } from "../routes/HomeRoute";
import { PollRoute } from "../routes/PollRoute";
import { ResultsRoute } from "../routes/ResultsRoute";
import { SetupRoute } from "../routes/SetupRoute";
import { resolveRoute } from "./routing";

export default function App() {
  const route = useMemo(() => resolveRoute(), []);

  if (route.kind === "home") {
    return <HomeRoute />;
  }
  if (route.kind === "answers") {
    return <AnswersRoute />;
  }
  if (route.kind === "setup") {
    return <SetupRoute pollId={route.id} />;
  }
  if (route.kind === "results") {
    return <ResultsRoute pollId={route.id} />;
  }
  return <PollRoute pollId={route.id} />;
}
