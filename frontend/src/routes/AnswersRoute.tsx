import { usePollList } from "../entities/poll/usePollResource";
import { AnswerCalendarPage } from "../features/answer-calendar/AnswerCalendarPage";
import { ErrorRoute, LoadingRoute } from "../shared/ui/RouteState";
import { Shell } from "../shared/ui/Shell";

export function AnswersRoute() {
  const polls = usePollList();

  return (
    <Shell>
      {polls.loading ? <LoadingRoute /> : null}
      {!polls.loading && polls.error ? <ErrorRoute error={polls.error} onRetry={polls.reload} /> : null}
      {!polls.loading && !polls.error && polls.data ? (
        <AnswerCalendarPage openPolls={polls.data} />
      ) : null}
    </Shell>
  );
}
