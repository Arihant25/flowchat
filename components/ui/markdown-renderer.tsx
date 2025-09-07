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
        // Increased base text size from text-sm to text-base for better readability in chat nodes
        <div className={cn("text-base space-y-3 leading-relaxed", className)}>
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
                            <code className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-[0.85rem] font-mono border" {...props}>
                                {children}
                            </code>
                        );
                    },
                    // Customize links to open in new tab
                    a: ({ href, children, ...props }: any) => (
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
                    blockquote: ({ children, ...props }: any) => (
                        <blockquote className="border-l-4 border-primary/40 pl-4 italic text-muted-foreground bg-muted/50 py-2 rounded-r-md text-[0.95rem]" {...props}>
                            {children}
                        </blockquote>
                    ),
                    // Customize tables
                    table: ({ children, ...props }: any) => (
                        <div className="overflow-x-auto my-4">
                            <table className="w-full border-collapse border border-border rounded-md" {...props}>
                                {children}
                            </table>
                        </div>
                    ),
                    th: ({ children, ...props }: any) => (
                        <th className="border border-border bg-muted p-2 text-left font-semibold text-[0.9rem]" {...props}>
                            {children}
                        </th>
                    ),
                    td: ({ children, ...props }: any) => (
                        <td className="border border-border p-2 text-[0.95rem]" {...props}>
                            {children}
                        </td>
                    ),
                    // Customize headings
                    h1: ({ children, ...props }: any) => (
                        <h1 className="text-2xl font-bold mb-3 mt-6 first:mt-0 text-foreground" {...props}>
                            {children}
                        </h1>
                    ),
                    h2: ({ children, ...props }: any) => (
                        <h2 className="text-xl font-semibold mb-2 mt-5 first:mt-0 text-foreground" {...props}>
                            {children}
                        </h2>
                    ),
                    h3: ({ children, ...props }: any) => (
                        <h3 className="text-lg font-medium mb-2 mt-4 first:mt-0 text-foreground" {...props}>
                            {children}
                        </h3>
                    ),
                    // Customize lists
                    ul: ({ children, ...props }: any) => (
                        <ul className="list-disc pl-5 mb-3 space-y-1" {...props}>
                            {children}
                        </ul>
                    ),
                    ol: ({ children, ...props }: any) => (
                        <ol className="list-decimal pl-5 mb-3 space-y-1" {...props}>
                            {children}
                        </ol>
                    ),
                    li: ({ children, ...props }: any) => (
                        <li className="text-[0.95rem]" {...props}>
                            {children}
                        </li>
                    ),
                    // Customize paragraphs
                    p: ({ children, ...props }: any) => (
                        <p className="mb-3 last:mb-0" {...props}>
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
