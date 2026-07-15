export function toErrorMessage(caught: unknown) {
  if (caught instanceof Error) {
    return caught.message;
  }
  return "予期しないエラーが発生しました";
}
