"use client";

import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export const INPUT_CLASS =
  "mt-1.5 min-h-11 w-full rounded-xl border border-[#D0D5DD] bg-white px-3.5 py-2.5 text-sm text-[#172033] shadow-sm placeholder:text-[#98A2B3] disabled:cursor-not-allowed disabled:bg-[#F2F4F7]";

export const TEXTAREA_CLASS = `${INPUT_CLASS} min-h-28 resize-y`;

export const PRIMARY_BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#4059A5] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#304783] disabled:cursor-not-allowed disabled:opacity-60";

export const SECONDARY_BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-[#D0D5DD] bg-white px-4 text-sm font-semibold text-[#344054] hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-60";

export const DANGER_BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60";

type ApiEnvelope<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: { code: string; message: string; details?: unknown };
    };

export async function apiRequest<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
  });
  const envelope = (await response
    .json()
    .catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !envelope || !envelope.success) {
    const message =
      envelope && !envelope.success
        ? envelope.error.message
        : "Không thể xử lý yêu cầu. Vui lòng thử lại.";
    throw new Error(message);
  }
  return envelope.data;
}

export function jsonRequest(
  body: unknown,
): Pick<RequestInit, "body" | "headers"> {
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function Field({
  label,
  required,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn("block text-sm font-semibold text-[#344054]", className)}
    >
      <span>
        {label}
        {required ? <span className="ml-1 text-red-600">*</span> : null}
      </span>
      {children}
      {hint ? (
        <span className="mt-1.5 block text-xs leading-5 font-normal text-[#667085]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function SectionCard({
  title,
  description,
  children,
  id,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm sm:p-6"
    >
      <h2 className="text-base font-bold text-[#172033]">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm leading-6 text-[#667085]">{description}</p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function MutationNotice({
  message,
  tone,
}: {
  message?: string;
  tone?: "success" | "error";
}) {
  if (!message) return null;
  const success = tone === "success";
  const Icon = success ? CheckCircle2 : AlertCircle;
  return (
    <div
      role={success ? "status" : "alert"}
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function BusyLabel({
  busy,
  idle,
  working = "Đang xử lý…",
}: {
  busy: boolean;
  idle: string;
  working?: string;
}) {
  return busy ? (
    <span className="inline-flex items-center gap-2">
      <LoaderCircle className="size-4 animate-spin" />
      {working}
    </span>
  ) : (
    idle
  );
}

export function optionalIsoDate(value: FormDataEntryValue | null) {
  const stringValue = String(value ?? "").trim();
  return stringValue ? new Date(stringValue).toISOString() : undefined;
}

export function toDateInput(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

export function toDateTimeInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
