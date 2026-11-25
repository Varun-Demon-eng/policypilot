import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function FormattedMessage({ content }) {
  if (!content) return null

  // Clean any stray HTML tags or non-standard markdown artifacts
  const normalizedContent = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\|\s*<br\s*\/?>/gi, '|\n')

  return (
    <div className="formatted-markdown text-gray-800 text-[14.5px] leading-relaxed font-sans">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="mb-2.5 last:mb-0 text-[14.5px] leading-relaxed text-gray-800">
              {children}
            </p>
          ),
          h1: ({ children }) => (
            <h1 className="text-base font-bold text-gray-900 mt-3.5 mb-2 first:mt-0 pb-1 border-b border-gray-100">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-[15px] font-bold text-gray-900 mt-3 mb-1.5 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-gray-900 mt-2.5 mb-1 first:mt-0">
              {children}
            </h3>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside pl-5 mb-2.5 space-y-1 text-[14.5px] text-gray-800">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside pl-5 mb-2.5 space-y-1 text-[14.5px] text-gray-800">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed pl-0.5">
              {children}
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-950">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="text-gray-700 italic">
              {children}
            </em>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-xl border border-gray-200/90 shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 text-left text-xs sm:text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-100/80 text-gray-700 font-semibold uppercase text-xs tracking-wider">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-gray-100 bg-white">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-blue-50/40 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-3.5 py-2.5 font-semibold text-gray-800 border-b border-gray-200">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3.5 py-2 text-gray-700 align-top text-xs sm:text-sm">
              {children}
            </td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-500 bg-blue-50/50 pl-3.5 py-2 rounded-r-lg my-2.5 text-sm text-blue-950">
              {children}
            </blockquote>
          ),
          code: ({ inline, children }) => (
            inline ? (
              <code className="px-1.5 py-0.5 bg-gray-100 text-gray-800 rounded text-xs font-mono border border-gray-200">
                {children}
              </code>
            ) : (
              <pre className="p-3 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto text-xs font-mono my-2">
                <code>{children}</code>
              </pre>
            )
          ),
          hr: () => <hr className="my-3 border-gray-200" />,
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  )
}
