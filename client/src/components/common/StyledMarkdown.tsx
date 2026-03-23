/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import Markdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface StyledMarkdownProps {
  children: string;
}

/**
 * StyledMarkdown Component
 * 
 * A wrapper around react-markdown that provides consistent, contained styling
 * for LLM-generated markdown across the application. Specifically scales down
 * headings so they don't overpower the page headers, and formats lists/paragraphs.
 */
const StyledMarkdown: React.FC<StyledMarkdownProps> = ({ children }) => {
  const markdownComponents: Components = {
    // Override h1 to look like a smaller section header
    h1: ({ node, ...props }) => (
      <h3 className="text-xl font-bold mt-6 mb-3 text-primary border-b border-border-main/20 pb-2" {...props} />
    ),
    // Override h2 to look like a subheader
    h2: ({ node, ...props }) => (
      <h4 className="text-lg font-semibold mt-5 mb-2 text-primary" {...props} />
    ),
    // Override h3 to look like a minor header
    h3: ({ node, ...props }) => (
      <h5 className="text-base font-medium mt-4 mb-2 text-primary/90" {...props} />
    ),
    p: ({ node, ...props }) => (
      <p className="text-sm leading-relaxed mb-3 text-text-main/80" {...props} />
    ),
    ul: ({ node, ...props }) => (
      <ul className="list-disc list-inside mb-3 text-sm text-text-main/80 space-y-1" {...props} />
    ),
    ol: ({ node, ...props }) => (
      <ol className="list-decimal list-inside mb-3 text-sm text-text-main/80 space-y-1" {...props} />
    ),
    li: ({ node, ...props }) => (
      <li className="ml-2" {...props} />
    ),
    strong: ({ node, ...props }) => (
      <strong className="font-bold text-text-main" {...props} />
    ),
    a: ({ node, ...props }) => (
      <a className="text-primary hover:underline font-medium" {...props} />
    ),
    blockquote: ({ node, ...props }) => (
      <blockquote className="border-l-4 border-primary/50 pl-4 py-1 my-4 bg-primary/5 italic text-text-main/70 rounded-r-lg" {...props} />
    ),
    table: ({ node, ...props }) => (
      <div className="overflow-x-auto w-full mb-4">
        <table className="w-full text-sm text-left text-text-main border-collapse" {...props} />
      </div>
    ),
    th: ({ node, ...props }) => (
      <th className="px-4 py-2 font-semibold bg-form-bg border border-border-main/20" {...props} />
    ),
    td: ({ node, ...props }) => (
      <td className="px-4 py-2 border border-border-main/20 bg-list-bg/50" {...props} />
    ),
  };

  return (
    <div className="w-full wrap-break-word">
      <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {children}
      </Markdown>
    </div>
  );
};

export default StyledMarkdown;
