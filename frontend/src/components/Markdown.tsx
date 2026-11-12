import React, { useRef, useState } from 'react';
import type { ComponentPropsWithoutRef, ReactElement } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';

// Code block with a language label and a copy button.
const CodeBlock: React.FC<ComponentPropsWithoutRef<'pre'>> = ({ children, ...props }) => {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const codeClass = (children as ReactElement<{ className?: string }>)?.props?.className ?? '';
  const language = /language-([\w-]+)/.exec(codeClass)?.[1];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(preRef.current?.textContent ?? '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (e.g. insecure context); nothing to do.
    }
  };

  return (
    <div className="code-block">
      <div className="code-header">
        <span>{language ?? 'code'}</span>
        <button type="button" className="copy-btn" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre ref={preRef} {...props}>{children}</pre>
    </div>
  );
};

// react-markdown passes its AST `node` to custom components; keep it off the DOM.
function omitNode<T extends { node?: unknown }>({ node, ...rest }: T) {
  void node;
  return rest;
}

const components: Components = {
  pre: (props) => <CodeBlock {...omitNode(props)} />,
  a: (props) => <a {...omitNode(props)} target="_blank" rel="noopener noreferrer" />,
  table: (props) => (
    <div className="table-wrap">
      <table {...omitNode(props)} />
    </div>
  ),
};

export const Markdown: React.FC<{ content: string }> = ({ content }) => (
  <div className="markdown">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  </div>
);
