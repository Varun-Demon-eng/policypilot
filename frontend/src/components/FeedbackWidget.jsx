import { useState } from 'react'
import api from '../api/axios'

export default function FeedbackWidget({ queryId, initialRating = null }) {
  const [rating, setRating] = useState(initialRating) // 1 or 0
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(initialRating !== null && initialRating !== undefined)
  const [submitting, setSubmitting] = useState(false)
  const [showComment, setShowComment] = useState(false)

  const handleThumb = (val) => {
    if (submitted) return
    setRating(val)
    setShowComment(true)
  }

  const handleSubmit = async () => {
    if (rating === null) return
    setSubmitting(true)
    try {
      await api.post('/feedback', {
        query_id: queryId,
        rating,
        comment: comment.trim() || null,
      })
      setSubmitted(true)
    } catch (err) {
      console.error('Feedback submission failed', err)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
        <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Thanks for your feedback!
      </div>
    )
  }

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Was this helpful?</span>
        <button
          onClick={() => handleThumb(1)}
          disabled={submitted}
          className={`p-1.5 rounded-md transition-colors text-sm ${
            rating === 1
              ? 'bg-green-100 text-green-700'
              : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'
          }`}
          title="Helpful"
        >
          👍
        </button>
        <button
          onClick={() => handleThumb(0)}
          disabled={submitted}
          className={`p-1.5 rounded-md transition-colors text-sm ${
            rating === 0
              ? 'bg-red-100 text-red-700'
              : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'
          }`}
          title="Not helpful"
        >
          👎
        </button>
      </div>
      {showComment && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional comment..."
            className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? '...' : 'Submit'}
          </button>
        </div>
      )}
    </div>
  )
}
