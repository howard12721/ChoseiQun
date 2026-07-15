import { startTransition, useCallback, useEffect, useState } from "react";
import { toErrorMessage } from "../../shared/lib/errors";
import type { PollDetail, PollListItem } from "./model";
import { getPollDetail, getSetupPoll, listPolls } from "./queries";

type Loadable<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  replace: (data: T) => void;
};

function useLoadable<T>(load: () => Promise<T>): Loadable<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void load()
      .then((nextData) => {
        if (active) {
          startTransition(() => setData(nextData));
        }
      })
      .catch((caught) => {
        if (active) {
          setError(toErrorMessage(caught));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [load, reloadKey]);

  return {
    data,
    loading,
    error,
    reload: () => setReloadKey((current) => current + 1),
    replace: (nextData) => startTransition(() => setData(nextData)),
  };
}

export function usePollList() {
  const load = useCallback(() => listPolls(), []);
  return useLoadable<PollListItem[]>(load);
}

export function usePollDetail(id: string) {
  const load = useCallback(() => getPollDetail(id), [id]);
  return useLoadable<PollDetail>(load);
}

export function useSetupPoll(id: string) {
  const load = useCallback(() => getSetupPoll(id), [id]);
  return useLoadable<PollDetail>(load);
}
