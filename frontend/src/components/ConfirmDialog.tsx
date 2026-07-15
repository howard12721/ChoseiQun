import { useEffect, useId, useRef } from "react";

export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  confirmLabel: string;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { open, title, confirmLabel, disabled = false, onCancel, onConfirm } = props;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
      window.requestAnimationFrame(() => cancelButtonRef.current?.focus());
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby={titleId}
      aria-busy={disabled}
      onCancel={(event) => {
        event.preventDefault();
        if (!disabled) {
          onCancel();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          if (!disabled) {
            onCancel();
          }
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !disabled) {
          onCancel();
        }
      }}
    >
      <div className="confirm-dialog__surface">
        <div className="confirm-dialog__content">
          <h2 id={titleId}>{title}</h2>
        </div>
        <div className="confirm-dialog__actions">
          <button
            ref={cancelButtonRef}
            className="confirm-dialog__cancel"
            type="button"
            disabled={disabled}
            onClick={onCancel}
          >
            キャンセル
          </button>
          <button
            className="confirm-dialog__confirm"
            type="button"
            disabled={disabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
