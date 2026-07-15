import { useEffect, useMemo, useRef, useState } from "react";
import { useFlash } from "../shared/ui/useFlash";
import type { DayAvailability } from "../entities/poll/model";
import { isViewerParticipant, viewerResponses } from "../entities/poll/selectors";
import { usePollDetail } from "../entities/poll/usePollResource";
import { saveAvailability } from "../features/availability/api";
import type { AvailabilityDraft } from "../features/availability/model";
import { PollPage } from "../features/availability/PollPage";
import { copyAndNotify } from "../shared/lib/clipboard";
import { toErrorMessage } from "../shared/lib/errors";
import { ErrorRoute, LoadingRoute, MissingPollRoute } from "../shared/ui/RouteState";
import { Shell } from "../shared/ui/Shell";

export function PollRoute({ pollId }: { pollId: string }) {
  const resource = usePollDetail(pollId);
  const { flash, dismissFlash, showFlash } = useFlash();
  const [draft, setDraft] = useState<AvailabilityDraft>({ responses: {} });
  const [draftInitialized, setDraftInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const allowSavedNavigationRef = useRef(false);
  const hasUnsavedChanges = useMemo(() => {
    const poll = resource.data;
    if (!poll || !draftInitialized) {
      return false;
    }
    const savedResponses = poll.participants.find((participant) =>
      isViewerParticipant(participant, poll)
    )?.responses;
    return poll.candidateDates.some(
      (date) => draft.responses[date] !== (savedResponses?.[date] ?? "NO"),
    );
  }, [draft.responses, draftInitialized, resource.data]);

  useEffect(() => {
    if (resource.data) {
      setDraft({ responses: viewerResponses(resource.data) });
      setDraftInitialized(true);
    }
  }, [resource.data]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }
    function confirmLeave(event: BeforeUnloadEvent) {
      if (!allowSavedNavigationRef.current) {
        event.preventDefault();
      }
    }
    window.addEventListener("beforeunload", confirmLeave);
    return () => window.removeEventListener("beforeunload", confirmLeave);
  }, [hasUnsavedChanges]);

  function pickAvailability(date: string, value: DayAvailability) {
    allowSavedNavigationRef.current = false;
    setDraft((current) => ({
      responses: { ...current.responses, [date]: value },
    }));
  }

  async function submitAvailability() {
    const poll = resource.data;
    if (!poll || saving) {
      return;
    }
    const traqId = poll.viewerTraqId ?? "";
    if (!traqId) {
      showFlash("traQ 経由で開いたページから回答してください", "error");
      return;
    }

    const isInitialResponse = !poll.participants.some((participant) =>
      isViewerParticipant(participant, poll)
    );
    setSaving(true);
    try {
      const nextPoll = await saveAvailability(poll.id, draft.responses);
      if (isInitialResponse) {
        allowSavedNavigationRef.current = true;
        window.location.assign(`/polls/${poll.id}/results`);
        return;
      }
      resource.replace(nextPoll);
      setDraft({ responses: viewerResponses(nextPoll, draft.responses) });
      showFlash("回答を保存しました", "success");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell flash={flash} onDismissFlash={dismissFlash}>
      {resource.loading || (resource.data && !draftInitialized) ? <LoadingRoute /> : null}
      {!resource.loading && resource.error ? (
        <ErrorRoute error={resource.error} onRetry={resource.reload} />
      ) : null}
      {!resource.loading && !resource.error && !resource.data ? <MissingPollRoute /> : null}
      {!resource.loading && !resource.error && resource.data && draftInitialized ? (
        <PollPage
          poll={resource.data}
          draft={draft}
          onPickAvailability={pickAvailability}
          hasUnsavedChanges={hasUnsavedChanges}
          isSavingAvailability={saving}
          onSubmitAvailability={() =>
            submitAvailability().catch((caught) => showFlash(toErrorMessage(caught), "error"))
          }
          onCopy={(value) => copyAndNotify(value, showFlash)}
        />
      ) : null}
    </Shell>
  );
}
