export type CommentDraft = {
  body: string;
  editingCreatedAt: string | null;
};

export const EMPTY_COMMENT_DRAFT: CommentDraft = {
  body: "",
  editingCreatedAt: null,
};
