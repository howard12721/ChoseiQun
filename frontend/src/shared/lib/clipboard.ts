import { toErrorMessage } from "./errors";

export function copyAndNotify(
  value: string,
  notify: (message: string, tone: "success" | "error" | "info") => void,
) {
  void navigator.clipboard.writeText(value)
    .then(() => {
      notify("クリップボードにコピーしました", "success");
    })
    .catch((caught) => {
      notify(toErrorMessage(caught), "error");
    });
}
