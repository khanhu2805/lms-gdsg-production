"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, X } from "lucide-react";

type ReasonOptions = {
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  confirmLabel?: string;
  danger?: boolean;
  minLength?: number;
};

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
};

type ReasonState = ReasonOptions & {
  kind: "reason";
  resolve: (value: string | null) => void;
};

type ConfirmState = ConfirmOptions & {
  kind: "confirm";
  resolve: (value: boolean) => void;
};

type DialogState = ReasonState | ConfirmState;

type ActionDialogContextValue = {
  requestReason: (options: ReasonOptions) => Promise<string | null>;
  confirmAction: (options: ConfirmOptions) => Promise<boolean>;
};

const ActionDialogContext = createContext<ActionDialogContextValue | null>(null);

const BUTTON_BASE =
  "inline-flex min-h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

export function ReasonDialog({
  open,
  title,
  description,
  label = "Lý do",
  placeholder,
  confirmLabel = "Xác nhận",
  danger = false,
  minLength = 3,
  onCancel,
  onConfirm,
}: ReasonOptions & {
  open: boolean;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const trimmed = value.trim();
  const valid = trimmed.length >= minLength;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="reason-dialog-title"
        className="w-full max-w-lg rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="reason-dialog-title"
              className="text-lg font-semibold text-[#172033]"
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-2 text-sm leading-6 text-[#667085]">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-2 text-[#667085] hover:bg-[#F2F4F7]"
            aria-label="Đóng hộp thoại"
          >
            <X className="size-4" />
          </button>
        </div>

        <label className="mt-5 block">
          <span className="text-sm font-semibold text-[#344054]">{label}</span>
          <textarea
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={placeholder}
            minLength={minLength}
            rows={4}
            className="mt-2 w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm text-[#172033] outline-none ring-[#4059A5] focus:ring-2"
          />
          <span className="mt-1 block text-xs text-[#667085]">
            Tối thiểu {minLength} ký tự. Nội dung này có thể được lưu vào nhật ký
            kiểm toán.
          </span>
        </label>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className={`${BUTTON_BASE} border border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#F9FAFB]`}
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={() => onConfirm(trimmed)}
            className={`${BUTTON_BASE} ${
              danger
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-[#4059A5] text-white hover:bg-[#304783]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Xác nhận",
  danger = false,
  onCancel,
  onConfirm,
}: ConfirmOptions & {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-md rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-2xl sm:p-6"
      >
        <span
          className={`flex size-11 items-center justify-center rounded-xl ${
            danger ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          <AlertTriangle className="size-5" />
        </span>
        <h2
          id="confirm-dialog-title"
          className="mt-4 text-lg font-semibold text-[#172033]"
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-[#667085]">{description}</p>
        ) : null}
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className={`${BUTTON_BASE} border border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#F9FAFB]`}
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`${BUTTON_BASE} ${
              danger
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-[#4059A5] text-white hover:bg-[#304783]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export function ActionDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const requestReason = useCallback(
    (options: ReasonOptions) =>
      new Promise<string | null>((resolve) => {
        setDialog({ ...options, kind: "reason", resolve });
      }),
    [],
  );

  const confirmAction = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setDialog({ ...options, kind: "confirm", resolve });
      }),
    [],
  );

  const contextValue = useMemo(
    () => ({ requestReason, confirmAction }),
    [confirmAction, requestReason],
  );

  function cancel() {
    const current = dialog;
    setDialog(null);
    if (!current) return;
    if (current.kind === "reason") current.resolve(null);
    else current.resolve(false);
  }

  function confirmReason(reason: string) {
    const current = dialog;
    setDialog(null);
    if (current?.kind === "reason") current.resolve(reason);
  }

  function confirmBoolean() {
    const current = dialog;
    setDialog(null);
    if (current?.kind === "confirm") current.resolve(true);
  }

  return (
    <ActionDialogContext.Provider value={contextValue}>
      {children}
      {dialog?.kind === "reason" ? (
        <ReasonDialog
          key={`${dialog.title}-${dialog.confirmLabel ?? ""}`}
          {...dialog}
          open
          onCancel={cancel}
          onConfirm={confirmReason}
        />
      ) : null}
      {dialog?.kind === "confirm" ? (
        <ConfirmDialog
          {...dialog}
          open
          onCancel={cancel}
          onConfirm={confirmBoolean}
        />
      ) : null}
    </ActionDialogContext.Provider>
  );
}

export function useActionDialogs() {
  const context = useContext(ActionDialogContext);
  if (!context) {
    throw new Error(
      "useActionDialogs phải được sử dụng bên trong ActionDialogProvider.",
    );
  }
  return context;
}
