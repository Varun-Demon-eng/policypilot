import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import ConfidenceBadge from '../components/ConfidenceBadge'
import CitationList from '../components/CitationList'
import FeedbackWidget from '../components/FeedbackWidget'
import LoadingDots from '../components/LoadingDots'
import FormattedMessage from '../components/FormattedMessage'

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  primary: '#1E3A8A',   // Deep Slate Blue  – header, buttons, icons
  accent:  '#0D9488',   // Calm Teal        – user bubbles, links
  bg:      '#F8FAFC',   // Soft Cool Gray   – page background
  card:    '#FFFFFF',   // Pure White       – bot bubble, cards
  text:    '#0F172A',   // Charcoal Ink     – main text
  muted:   '#64748B',   // Slate Gray       – placeholders, hints
}

const EXAMPLE_QUESTIONS = [
  'What is the company leave policy?',
  'How do I request a performance review?',
  'What are the remote work guidelines?',
  'What benefits am I entitled to as an employee?',
  'What is the code of conduct policy?',
]

function formatChatTime(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (isToday) return `Today, ${timeStr}`
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`
}

export default function ChatPage() {
  const { user, logout } = useAuth()
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [loadingSession, setLoadingSession] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const fetchSessions = async () => {
    try {
      const res = await api.get('/chat/sessions')
      setSessions(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error('Failed to load chat history', err)
    } finally {
      setSessionsLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
    if (window.innerWidth < 768) {
      setSidebarOpen(false)
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const startNewChat = () => {
    setActiveSessionId(null)
    setMessages([])
    if (window.innerWidth < 768) setSidebarOpen(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const loadSession = async (sessionId) => {
    if (loading || sessionId === activeSessionId) {
      if (window.innerWidth < 768) setSidebarOpen(false)
      return
    }
    setLoadingSession(true)
    try {
      const res = await api.get(`/chat/sessions/${sessionId}`)
      const detail = res.data
      const loadedMessages = []
      for (const item of detail.messages || []) {
        loadedMessages.push({
          role: 'user',
          content: item.question,
          timestamp: item.timestamp,
        })
        loadedMessages.push({
          role: 'assistant',
          content: item.answer,
          sources: item.sources || [],
          confidence_score: item.confidence_score,
          confidence_label: item.confidence_label,
          query_id: item.id,
          timestamp: item.timestamp,
          feedback_rating: item.feedback_rating,
        })
      }
      setActiveSessionId(detail.id)
      setMessages(loadedMessages)
      if (window.innerWidth < 768) setSidebarOpen(false)
    } catch (err) {
      console.error('Failed to load chat session', err)
    } finally {
      setLoadingSession(false)
    }
  }

  const deleteSession = async (e, sessionId) => {
    e.stopPropagation()
    try {
      await api.delete(`/chat/sessions/${sessionId}`)
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      if (activeSessionId === sessionId) {
        setActiveSessionId(null)
        setMessages([])
      }
    } catch (err) {
      console.error('Failed to delete chat session', err)
    }
  }

  const sendMessage = async (text) => {
    const question = text || input.trim()
    if (!question || loading) return
    const nowIso = new Date().toISOString()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: question, timestamp: nowIso }])
    setLoading(true)
    try {
      const payload = { question }
      if (activeSessionId !== null) {
        payload.session_id = activeSessionId
      }
      const res = await api.post('/chat', payload)
      const {
        answer,
        sources,
        confidence_score,
        confidence_label,
        query_id,
        session_id,
      } = res.data

      if (session_id && activeSessionId !== session_id) {
        setActiveSessionId(session_id)
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: answer,
          sources,
          confidence_score,
          confidence_label,
          query_id,
          timestamp: new Date().toISOString(),
        },
      ])
      fetchSessions()
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          isError: true,
          timestamp: new Date().toISOString(),
        },
      ])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: C.bg }}>
      {/* ── Navbar ── */}
      <nav
        className="px-4 md:px-6 py-3 flex items-center justify-between shadow-sm flex-shrink-0 z-20"
        style={{ backgroundColor: C.primary, borderBottom: `1px solid ${C.primary}` }}
      >
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors"
            title={sidebarOpen ? 'Hide chat history' : 'Show chat history'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/20">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="font-bold text-white text-lg tracking-tight">PolicyPilot</span>
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          {user?.role === 'admin' && (
            <Link
              to="/admin"
              className="text-sm font-medium flex items-center gap-1 text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">Admin Dashboard</span>
            </Link>
          )}
          <div className="flex items-center gap-2 text-sm text-white/80">
            <div className="w-7 h-7 rounded-full flex items-center justify-center bg-white/20">
              <span className="font-semibold text-xs text-white">
                {user?.name?.charAt(0).toUpperCase() || '?'}
              </span>
            </div>
            <span className="font-medium hidden sm:inline">{user?.name}</span>
          </div>
          <button
            onClick={logout}
            className="text-sm text-white/70 hover:text-white flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </nav>

      {/* ── Body (Sidebar + Chat Pane) ── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-10 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Chat History Sidebar ── */}
        {sidebarOpen && (
          <aside
            className="w-72 flex-shrink-0 flex flex-col border-r z-20 fixed md:static inset-y-0 left-0 top-[57px] md:top-0 shadow-lg md:shadow-none"
            style={{ backgroundColor: C.card, borderColor: '#E2E8F0' }}
          >
            <div className="p-3 border-b" style={{ borderColor: '#E2E8F0' }}>
              <button
                onClick={startNewChat}
                className="w-full py-2.5 px-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 shadow-sm"
                style={{ backgroundColor: C.primary }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Chat
              </button>
            </div>

            <div className="px-3 pt-3 pb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>
                Chat History
              </span>
              <span className="text-[11px]" style={{ color: C.muted }}>
                {sessions.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-3 space-y-1">
              {sessionsLoading ? (
                <p className="text-xs text-center py-6" style={{ color: C.muted }}>
                  Loading history…
                </p>
              ) : sessions.length === 0 ? (
                <p className="text-xs text-center py-6 px-3" style={{ color: C.muted }}>
                  No past conversations yet. Ask a question to start a chat!
                </p>
              ) : (
                sessions.map((s) => {
                  const isActive = s.id === activeSessionId
                  return (
                    <div
                      key={s.id}
                      onClick={() => loadSession(s.id)}
                      className={`group flex items-start justify-between gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors border ${
                        isActive ? 'shadow-sm' : 'border-transparent hover:bg-slate-50'
                      }`}
                      style={
                        isActive
                          ? { backgroundColor: `${C.primary}10`, borderColor: `${C.primary}30` }
                          : undefined
                      }
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-sm font-medium truncate"
                          style={{ color: isActive ? C.primary : C.text }}
                          title={s.title}
                        >
                          {s.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px]" style={{ color: C.muted }}>
                          <span>{formatChatTime(s.updated_at || s.created_at)}</span>
                          <span>·</span>
                          <span>{s.message_count} {s.message_count === 1 ? 'msg' : 'msgs'}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => deleteSession(e, s.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-all flex-shrink-0"
                        title="Delete chat"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </aside>
        )}

        {/* ── Main Chat Column ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-6">
            <div className="max-w-3xl mx-auto space-y-4">
              {loadingSession ? (
                <div className="flex items-center justify-center py-16">
                  <LoadingDots />
                </div>
              ) : messages.length === 0 && !loading ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: `${C.primary}18` }}
                  >
                    <svg
                      className="w-9 h-9"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      style={{ color: C.primary }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold mb-2" style={{ color: C.text }}>
                    Ask about HR Policies
                  </h2>
                  <p className="text-sm mb-8 max-w-sm" style={{ color: C.muted }}>
                    Get instant answers from your company's HR policy documents. Each chat remembers your past 5 conversations.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {EXAMPLE_QUESTIONS.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(q)}
                        className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm border hover:shadow-md"
                        style={{
                          backgroundColor: C.card,
                          borderColor: `${C.primary}30`,
                          color: C.primary,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${C.primary}08` }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = C.card }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Messages */}
              {!loadingSession && messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center mr-2 mt-1 flex-shrink-0"
                      style={{ backgroundColor: C.primary }}
                    >
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] md:max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'rounded-tr-sm text-white'
                        : 'rounded-tl-sm shadow-sm border px-5 py-4'
                    }`}
                    style={
                      msg.role === 'user'
                        ? { backgroundColor: C.accent }
                        : { backgroundColor: C.card, borderColor: '#E2E8F0', color: C.text }
                    }
                  >
                    {msg.role === 'user' ? (
                      <>
                        <p className="text-[14.5px] leading-relaxed">{msg.content}</p>
                        {msg.timestamp && (
                          <p className="text-[10.5px] text-white/70 mt-1 text-right">
                            {formatChatTime(msg.timestamp)}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        {msg.isError ? (
                          <p className="text-sm leading-relaxed text-red-600">{msg.content}</p>
                        ) : (
                          <FormattedMessage content={msg.content} />
                        )}
                        {!msg.isError && (
                          <>
                            {msg.confidence_score !== undefined && (
                              <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                                <ConfidenceBadge score={msg.confidence_score} label={msg.confidence_label} />
                                {msg.timestamp && (
                                  <span className="text-[11px]" style={{ color: C.muted }}>
                                    {formatChatTime(msg.timestamp)}
                                  </span>
                                )}
                              </div>
                            )}
                            {msg.sources && msg.sources.length > 0 && (
                              <CitationList sources={msg.sources} />
                            )}
                            {msg.query_id && (
                              <FeedbackWidget queryId={msg.query_id} initialRating={msg.feedback_rating} />
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div className="flex justify-start">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center mr-2 mt-1 flex-shrink-0"
                    style={{ backgroundColor: C.primary }}
                  >
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 shadow-sm">
                    <LoadingDots />
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input Area */}
          <div
            className="px-4 py-4 flex-shrink-0 border-t"
            style={{ backgroundColor: C.card, borderColor: '#E2E8F0' }}
          >
            <div className="max-w-3xl mx-auto flex gap-3 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  placeholder="Ask about HR policies..."
                  rows={1}
                  className="w-full resize-none rounded-xl px-4 py-3 text-sm focus:outline-none transition-shadow max-h-32 overflow-y-auto disabled:opacity-50"
                  style={{
                    border: `1.5px solid #CBD5E1`,
                    backgroundColor: C.bg,
                    color: C.text,
                    minHeight: '48px',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = C.primary
                    e.target.style.boxShadow = `0 0 0 3px ${C.primary}18`
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#CBD5E1'
                    e.target.style.boxShadow = 'none'
                  }}
                  onInput={(e) => {
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
                  }}
                />
              </div>
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all focus:outline-none disabled:opacity-40"
                style={{ backgroundColor: input.trim() && !loading ? C.primary : '#CBD5E1', color: '#fff' }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-center text-xs mt-2" style={{ color: C.muted }}>
              Press Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
