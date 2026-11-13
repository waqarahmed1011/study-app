import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { cx } from "@/components/ui";

/** Markdown with tables and LaTeX math ($...$ and $$...$$). */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cx("prose-doc", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

/** Single-line rich text for question prompts and options (math, bold, no block wrappers). */
export function InlineMd({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{ p: ({ children }) => <span>{children}</span> }}
    >
      {children}
    </ReactMarkdown>
  );
}
