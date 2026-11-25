export default function CitationList({ sources }) {
  if (!sources || sources.length === 0) return null

  return (
    <div className="mt-2">
      <p className="text-xs font-medium text-gray-500 mb-1.5">📄 Sources:</p>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((src, i) => (
          <span
            key={i}
            className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-xs text-blue-800 font-medium"
            title={src.filename}
          >
            <svg className="w-3 h-3 mr-1 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {src.policy_title || src.filename}
            {src.section && (
              <span className="ml-1 text-blue-500">› {src.section}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}
