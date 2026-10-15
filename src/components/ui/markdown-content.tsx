import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { cn } from "@/lib/utils";

export function MarkdownContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 break-words text-sm leading-6 text-[#344054]",
        "[&_p]:my-1.5 [&_p]:whitespace-pre-wrap",
        "[&_strong]:font-bold [&_strong]:text-[#172033]",
        "[&_em]:italic",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6",
        "[&_li]:my-1 [&_li]:whitespace-pre-wrap",
        "[&_blockquote]:my-2 [&_blockquote]:border-l-4 [&_blockquote]:border-[#D0D5DD] [&_blockquote]:pl-4",
        "[&_code]:rounded [&_code]:bg-[#F2F4F7] [&_code]:px-1",
        "[&_pre]:max-w-full [&_pre]:overflow-x-auto",
        "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse",
        "[&_th]:border [&_th]:border-[#D0D5DD] [&_th]:p-2 [&_th]:text-left",
        "[&_td]:border [&_td]:border-[#D0D5DD] [&_td]:p-2",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
