import { useFlash } from "../shared/ui/useFlash";
import { usePollList } from "../entities/poll/usePollResource";
import { HomePage } from "../features/poll-list/HomePage";
import { copyAndNotify } from "../shared/lib/clipboard";
import { ErrorRoute, LoadingRoute } from "../shared/ui/RouteState";
import { Shell } from "../shared/ui/Shell";

export function HomeRoute() {
  const polls = usePollList();
  const { flash, dismissFlash, showFlash } = useFlash();

  return (
    <Shell flash={flash} onDismissFlash={dismissFlash}>
      {polls.loading ? <LoadingRoute /> : null}
      {!polls.loading && polls.error ? <ErrorRoute error={polls.error} onRetry={polls.reload} /> : null}
      {!polls.loading && !polls.error && polls.data ? (
        <HomePage
          openPolls={polls.data}
          onCopy={(value) => copyAndNotify(value, showFlash)}
        />
      ) : null}
    </Shell>
  );
}
