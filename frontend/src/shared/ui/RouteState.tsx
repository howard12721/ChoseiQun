import { useEffect, useState } from "react";
import { Hero } from "./Shell";

export function LoadingRoute() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 500);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) {
    return null;
  }

  return <Hero title="読み込み中" body="調整データを取得しています。" loading />;
}

export function ErrorRoute({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <Hero
      title="読み込みに失敗しました"
      body={error}
      actionLabel="もう一度試す"
      onAction={onRetry}
    />
  );
}

export function MissingPollRoute() {
  return <Hero title="調整が見つかりません" body="URL を確認してください。" />;
}
