import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

/**
 * Corpus Markdown, styled to the Atlas identity. GFM for tables; `remark-breaks`
 * because the Factbook files use single newlines between `**Field:** value`
 * lines and would otherwise collapse into a wall of text.
 *
 * Every override strips `node` (react-markdown passes it and React warns if it
 * reaches the DOM).
 */
const components: Components = {
  h1: ({ node, ...props }) => (
    <h1 className="mt-6 mb-3 font-heading text-2xl font-semibold first:mt-0" {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h2
      className="mt-7 mb-2 scroll-mt-4 border-b border-border pb-1 font-heading text-lg font-semibold first:mt-0"
      {...props}
    />
  ),
  h3: ({ node, ...props }) => (
    <h3 className="mt-5 mb-1.5 scroll-mt-4 font-heading text-base font-semibold" {...props} />
  ),
  h4: ({ node, ...props }) => (
    <h4 className="mt-4 mb-1 scroll-mt-4 font-heading text-sm font-semibold" {...props} />
  ),
  p: ({ node, ...props }) => <p className="my-2 leading-relaxed" {...props} />,
  ul: ({ node, ...props }) => <ul className="my-2 list-disc space-y-1 pl-5" {...props} />,
  ol: ({ node, ...props }) => <ol className="my-2 list-decimal space-y-1 pl-5" {...props} />,
  li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
  a: ({ node, ...props }) => (
    <a
      className="text-primary underline underline-offset-2 hover:no-underline"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  strong: ({ node, ...props }) => (
    <strong className="font-semibold text-foreground" {...props} />
  ),
  code: ({ node, ...props }) => (
    <code
      className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground"
      {...props}
    />
  ),
  pre: ({ node, ...props }) => (
    <pre
      className="my-3 overflow-x-auto rounded-sm border border-border bg-muted p-3 font-mono text-xs"
      {...props}
    />
  ),
  blockquote: ({ node, ...props }) => (
    <blockquote
      className="my-3 border-l-2 border-border pl-3 text-muted-foreground italic"
      {...props}
    />
  ),
  hr: () => <hr className="my-6 border-border" />,
  table: ({ node, ...props }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: ({ node, ...props }) => (
    <th
      className="border border-border bg-muted px-2 py-1 text-left font-medium"
      {...props}
    />
  ),
  td: ({ node, ...props }) => (
    <td className="border border-border px-2 py-1 align-top" {...props} />
  ),
};

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
