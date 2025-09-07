"use client";

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

export default function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
    return (
        <div className={cn("text-sm space-y-2", className)}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                    // Customize code blocks
                    code: ({ className, children, ...props }: any) => {
                        const match = /language-(\w+)/.exec(className || '');
                        const inline = !match;
                        return !inline && match ? (
                            <pre className="bg-muted text-muted-foreground p-3 rounded-md overflow-x-auto text-sm border">
                                <code className={className} {...props}>
                                    {children}
                                </code>
                            </pre>
                        ) : (
                            <code className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-sm font-mono border" {...props}>
                                {children}
                            </code>
                        );
                    },
                    // Customize links to open in new tab
                    a: ({ href, children, ...props }) => (
                        <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline decoration-2 underline-offset-2"
                            {...props}
                        >
                            {children}
                        </a>
                    ),
                    // Customize blockquotes
                    blockquote: ({ children, ...props }) => (
                        <blockquote className="border-l-4 border-primary/40 pl-4 italic text-muted-foreground bg-muted/50 py-2 rounded-r-md" {...props}>
                            {children}
                        </blockquote>
                    ),
                    // Customize tables
                    table: ({ children, ...props }) => (
                        <div className="overflow-x-auto my-4">
                            <table className="w-full border-collapse border border-border rounded-md" {...props}>
                                {children}
                            </table>
                        </div>
                    ),
                    th: ({ children, ...props }) => (
                        <th className="border border-border bg-muted p-2 text-left font-semibold text-sm" {...props}>
                            {children}
                        </th>
                    ),
                    td: ({ children, ...props }) => (
                        <td className="border border-border p-2 text-sm" {...props}>
                            {children}
                        </td>
                    ),
                    // Customize headings
                    h1: ({ children, ...props }) => (
                        <h1 className="text-lg font-bold mb-2 mt-4 first:mt-0 text-foreground" {...props}>
                            {children}
                        </h1>
                    ),
                    h2: ({ children, ...props }) => (
                        <h2 className="text-base font-semibold mb-2 mt-3 first:mt-0 text-foreground" {...props}>
                            {children}
                        </h2>
                    ),
                    h3: ({ children, ...props }) => (
                        <h3 className="text-sm font-medium mb-1 mt-2 first:mt-0 text-foreground" {...props}>
                            {children}
                        </h3>
                    ),
                    // Customize lists
                    ul: ({ children, ...props }) => (
                        <ul className="list-disc pl-4 mb-2 space-y-1" {...props}>
                            {children}
                        </ul>
                    ),
                    ol: ({ children, ...props }) => (
                        <ol className="list-decimal pl-4 mb-2 space-y-1" {...props}>
                            {children}
                        </ol>
                    ),
                    li: ({ children, ...props }) => (
                        <li className="text-sm" {...props}>
                            {children}
                        </li>
                    ),
                    // Customize paragraphs
                    p: ({ children, ...props }) => (
                        <p className="mb-2 last:mb-0 text-sm leading-relaxed" {...props}>
                            {children}
                        </p>
                    ),
                    // Customize strong/bold
                    strong: ({ children, ...props }: any) => (
                        <strong className="font-semibold text-foreground" {...props}>
                            {children}
                        </strong>
                    ),
                    // Customize emphasis/italic
                    em: ({ children, ...props }: any) => (
                        <em className="italic" {...props}>
                            {children}
                        </em>
                    ),
                    // Customize horizontal rules
                    hr: ({ ...props }) => (
                        <hr className="border-border my-4" {...props} />
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
