import { Hero } from "./Shell";

export function LoadingRoute() {
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
