import { useEffect, useState } from "react";
import { useFlash } from "../shared/ui/useFlash";
import { useSetupPoll } from "../entities/poll/usePollResource";
import { saveSetup } from "../features/poll-setup/api";
import {
  initialTimeRanges,
  missingTimes,
  setupCandidates,
  type SetupSelection,
} from "../features/poll-setup/model";
import { SetupPage } from "../features/poll-setup/SetupPage";
import {
  addMonths,
  initialMonthForDates,
  sortDates,
  startOfMonth,
} from "../shared/lib/date";
import { toErrorMessage } from "../shared/lib/errors";
import {
  ErrorRoute,
  LoadingRoute,
  MissingPollRoute,
} from "../shared/ui/RouteState";
import { Shell } from "../shared/ui/Shell";

export function SetupRoute({ pollId }: { pollId: string }) {
  const resource = useSetupPoll(pollId);
  const { flash, dismissFlash, showFlash } = useFlash();
  const [selection, setSelection] = useState<SetupSelection>({
    selectedDates: [],
    scheduleType: "DATE_ONLY",
    timeRanges: {},
    viewMonth: startOfMonth(new Date()),
  });
  const [selectionInitialized, setSelectionInitialized] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!resource.data) {
      return;
    }
    setSelection({
      selectedDates: sortDates(resource.data.candidateDates),
      scheduleType: resource.data.scheduleType ?? "DATE_ONLY",
      timeRanges: initialTimeRanges(resource.data),
      viewMonth: initialMonthForDates(resource.data.candidateDates),
    });
    setSelectionInitialized(true);
  }, [resource.data]);

  function setDates(dates: string[]) {
    setSelection((current) => {
      const selectedDates = sortDates(dates);
      if (
        current.selectedDates.length === selectedDates.length &&
        current.selectedDates.every(
          (value, index) => value === selectedDates[index],
        )
      ) {
        return current;
      }
      return { ...current, selectedDates };
    });
  }

  async function submit(formData: FormData) {
    const poll = resource.data;
    if (!poll || saving) {
      return;
    }
    if (missingTimes(selection)) {
      showFlash("未設定の日付があります！", "error");
      return;
    }
    if (!selection.selectedDates.length) {
      showFlash("候補日を1日以上選んでください", "error");
      return;
    }

    setSaving(true);
    try {
      const nextPoll = await saveSetup(poll.id, {
        title: `${formData.get("title") ?? ""}`.trim(),
        description: `${formData.get("description") ?? ""}`.trim(),
        candidateDates: sortDates(selection.selectedDates),
        scheduleType: selection.scheduleType,
        candidates: setupCandidates(selection),
      });
      window.location.assign(nextPoll.participantUrl);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell flash={flash} onDismissFlash={dismissFlash}>
      {resource.loading || (resource.data && !selectionInitialized) ? (
        <LoadingRoute />
      ) : null}
      {!resource.loading && resource.error ? (
        <ErrorRoute error={resource.error} onRetry={resource.reload} />
      ) : null}
      {!resource.loading && !resource.error && !resource.data ? (
        <MissingPollRoute />
      ) : null}
      {!resource.loading &&
      !resource.error &&
      resource.data &&
      selectionInitialized ? (
        <SetupPage
          poll={resource.data}
          selection={selection}
          onChangeSelection={setSelection}
          onSetDates={setDates}
          onShiftMonth={(amount) =>
            setSelection((current) => ({
              ...current,
              viewMonth: addMonths(current.viewMonth, amount),
            }))
          }
          isSaving={saving}
          onSubmit={(formData) =>
            submit(formData).catch((caught) =>
              showFlash(toErrorMessage(caught), "error"),
            )
          }
        />
      ) : null}
    </Shell>
  );
}
