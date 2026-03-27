import { useEffect, useState } from "react";
import { resolveTraqId } from "../utils/poll";

export function Avatar({ iconUrl, name, traqId }: { iconUrl?: string; name: string; traqId?: string }) {
  const resolvedTraqId = resolveTraqId(name, traqId);
  const fallbackIconUrl = resolvedTraqId
    ? `https://q.trap.jp/api/v3/public/icon/${encodeURIComponent(resolvedTraqId)}`
    : undefined;
  const [resolvedIconUrl, setResolvedIconUrl] = useState(iconUrl ?? fallbackIconUrl);

  useEffect(() => {
    setResolvedIconUrl(iconUrl ?? fallbackIconUrl);
  }, [fallbackIconUrl, iconUrl]);

  if (resolvedIconUrl) {
    return (
      <img
        className="avatar"
        src={resolvedIconUrl}
        alt={name}
        onError={() => {
          if (fallbackIconUrl && resolvedIconUrl !== fallbackIconUrl) {
            setResolvedIconUrl(fallbackIconUrl);
            return;
          }
          setResolvedIconUrl(undefined);
        }}
      />
    );
  }

  return <div className="avatar avatar-fallback">{name.slice(0, 1).toUpperCase()}</div>;
}
