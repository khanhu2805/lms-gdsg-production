"use client";

import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Pilcrow,
} from "lucide-react";
import { useRef } from "react";

import { MarkdownContent } from "@/components/ui/markdown-content";
import { cn } from "@/lib/utils";

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  rows?: number;
  compact?: boolean;
  disabled?: boolean;
};

export function MarkdownEditor({
  value,
  onChange,
  required = false,
  placeholder,
  rows = 5,
  compact = false,
  disabled = false,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insert(before: string, after = "", fallback = "") {
    const textarea = textareaRef.current;
    if (!textarea || disabled) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || fallback;
    const next =
      value.slice(0, start) +
      before +
      selected +
      after +
      value.slice(end);

    onChange(next);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + before.length + selected.length + after.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  function prefixSelectedLines(prefix: string) {
    const textarea = textareaRef.current;
    if (!textarea || disabled) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const selected = value.slice(lineStart, end) || "Nội dung";
    const prefixed = selected
      .split("\n")
      .map((line, index) =>
        prefix === "1. "
          ? `${index + 1}. ${line}`
          : `${prefix}${line}`,
      )
      .join("\n");

    const next = value.slice(0, lineStart) + prefixed + value.slice(end);
    onChange(next);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(
        lineStart,
        lineStart + prefixed.length,
      );
    });
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-[#D0D5DD] bg-white",
        "focus-within:border-[#4059A5] focus-within:ring-2 focus-within:ring-[#4059A5]/20",
        disabled && "bg-[#F9FAFB] opacity-80",
      )}
    >
      {!disabled ? (
        <div className="flex flex-wrap items-center gap-1 border-b border-[#EAECF0] bg-[#F9FAFB] p-2">
          <button
            type="button"
            title="In đậm"
            aria-label="In đậm"
            onClick={() => insert("**", "**", "nội dung")}
            className="rounded-lg p-2 text-[#475467] hover:bg-white"
          >
            <Bold className="size-4" />
          </button>

          <button
            type="button"
            title="In nghiêng"
            aria-label="In nghiêng"
            onClick={() => insert("*", "*", "nội dung")}
            className="rounded-lg p-2 text-[#475467] hover:bg-white"
          >
            <Italic className="size-4" />
          </button>

          <button
            type="button"
            title="Danh sách"
            aria-label="Danh sách"
            onClick={() => prefixSelectedLines("- ")}
            className="rounded-lg p-2 text-[#475467] hover:bg-white"
          >
            <List className="size-4" />
          </button>

          <button
            type="button"
            title="Danh sách đánh số"
            aria-label="Danh sách đánh số"
            onClick={() => prefixSelectedLines("1. ")}
            className="rounded-lg p-2 text-[#475467] hover:bg-white"
          >
            <ListOrdered className="size-4" />
          </button>

          <button
            type="button"
            title="Xuống dòng"
            aria-label="Xuống dòng"
            onClick={() => insert("\n")}
            className="rounded-lg p-2 text-[#475467] hover:bg-white"
          >
            <Pilcrow className="size-4" />
          </button>

          <span className="ml-1 text-[11px] text-[#98A2B3]">
            Hỗ trợ Markdown và công thức $...$
          </span>
        </div>
      ) : null}

      <textarea
        ref={textareaRef}
        value={value}
        rows={rows}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "block w-full resize-y border-0 bg-transparent px-3.5 py-3 text-sm leading-6 outline-none",
          compact ? "min-h-20" : "min-h-32",
        )}
      />

      {value.trim() ? (
        <div className="border-t border-[#EAECF0] bg-[#FCFCFD] px-4 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">
            Xem trước
          </p>
          <MarkdownContent content={value} />
        </div>
      ) : null}
    </div>
  );
}
