import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import ConfidenceBadge from '../components/ConfidenceBadge'

// ─── Theme Colors ─────────────────────────────────────────────────────────────
const C = {
  primary: '#1E3A8A',  // Deep Slate Blue
  accent: '#0D9488',   // Calm Teal
  bg: '#F8FAFC',       // Soft Cool Gray
  card: '#FFFFFF',     // Pure White
  text: '#0F172A',     // Charcoal Ink
  muted: '#64748B',    // Slate Gray
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar({ user, logout }) {
  return (
    <nav
      className="px-6 py-3 flex items-center justify-between shadow-sm flex-shrink-0"
      style={{ backgroundColor: C.primary }}
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/20">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <span className="font-bold text-white text-lg tracking-tight">PolicyPilot</span>
        <span className="ml-2 px-2.5 py-0.5 bg-white/20 text-white text-xs font-medium rounded-full">Admin</span>
      </div>
      <div className="flex items-center gap-4">
        <Link
          to="/chat"
          className="text-sm font-medium flex items-center gap-1 text-white/80 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Back to Chat
        </Link>
        <div className="flex items-center gap-2 text-sm text-white/80">
          <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold text-xs">{user?.name?.charAt(0).toUpperCase()}</span>
          </div>
          <span className="font-medium">{user?.name}</span>
        </div>
        <button
          onClick={logout}
          className="text-sm text-white/70 hover:text-white flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
    </nav>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color = 'blue', icon }) {
  const colors = {
    blue: 'bg-blue-50 text-[#1E3A8A] border-blue-200',
    green: 'bg-teal-50 text-[#0D9488] border-teal-200',
    yellow: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-rose-50 text-rose-700 border-rose-200',
  }
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium opacity-80">{label}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="text-3xl font-bold">{value ?? '—'}</div>
    </div>
  )
}

// ─── STATS TAB ────────────────────────────────────────────────────────────────
function StatsTab() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/admin/stats')
      .then((r) => setStats(r.data))
      .catch(() => setError('Failed to load stats'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-center text-gray-500">Loading stats…</div>
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>

  const helpfulRate = stats?.helpful_rate != null ? `${stats.helpful_rate}%` : '—'
  const avgConf = stats?.avg_confidence != null ? `${Math.round(stats.avg_confidence * 100)}%` : '—'
  const fallbackRate = stats?.fallback_rate != null ? `${stats.fallback_rate}%` : '—'

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Queries" value={stats?.total_queries} color="blue" icon="🔍" />
        <StatCard label="Helpful Rate" value={helpfulRate} color="green" icon="👍" />
        <StatCard label="Avg Confidence" value={avgConf} color="yellow" icon="📊" />
        <StatCard label="Fallback Rate" value={fallbackRate} color="red" icon="⚠️" />
      </div>

      <div>
        <h3 className="text-base font-semibold text-gray-800 mb-3">Policy Usage Heatmap</h3>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Filename</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Query Count</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.policy_usage || []).length === 0 ? (
                <tr>
                  <td colSpan={2} className="text-center py-8 text-gray-400">No policy query data yet</td>
                </tr>
              ) : (
                (stats?.policy_usage || []).map((p, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700 font-medium">{p.filename}</td>
                    <td className="px-4 py-3 text-right text-gray-600 font-semibold">{p.query_count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── QUERY LOGS TAB ───────────────────────────────────────────────────────────
function QueryLogsTab() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [minConf, setMinConf] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(true)
  const limit = 10

  const fetchLogs = () => {
    setLoading(true)
    const params = { page, limit }
    if (minConf) params.min_confidence = parseFloat(minConf)
    api.get('/admin/queries', { params })
      .then((r) => {
        const items = r.data.items || (Array.isArray(r.data) ? r.data : [])
        setLogs(items)
        setTotal(r.data.total ?? items.length)
      })
      .catch((err) => {
        console.error('Failed to load query logs:', err)
        setLogs([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchLogs() }, [page, minConf])

  const totalPages = Math.max(1, Math.ceil(total / limit))

  const parseSources = (s) => {
    if (!s) return []
    if (Array.isArray(s)) return s
    try {
      const parsed = JSON.parse(s)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Confidence filter:</label>
          <select
            value={minConf}
            onChange={(e) => { setMinConf(e.target.value); setPage(1) }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] bg-white"
          >
            <option value="">All Queries</option>
            <option value="0.55">&ge; 0.55 High Confidence</option>
            <option value="0.40">&ge; 0.40 Medium &amp; Above</option>
            <option value="0.25">&ge; 0.25 Low &amp; Above</option>
          </select>
        </div>
        <button
          onClick={fetchLogs}
          className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 px-2.5 py-1.5 rounded border border-gray-200 hover:bg-gray-100"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Timestamp</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Question</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Confidence</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Feedback</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Response ms</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Loading query logs…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">No logs found</td></tr>
            ) : (
              logs.map((log, i) => {
                const sourcesList = parseSources(log.sources)
                return (
                  <tr key={log.id || i} className="border-b border-gray-100 last:border-0">
                    <td colSpan={5} className="p-0">
                      <div
                        className="flex items-center px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => setExpanded(expanded === i ? null : i)}
                      >
                        <div className="w-1/6 text-gray-500 text-xs whitespace-nowrap">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                        </div>
                        <div className="w-2/5 pr-4 text-gray-800 font-medium">
                          <span className="line-clamp-1">{log.question}</span>
                        </div>
                        <div className="w-1/6">
                          {log.confidence_score != null ? (
                            <ConfidenceBadge score={log.confidence_score} />
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                        <div className="w-1/8 text-lg">
                          {log.feedback_rating === 1 ? '👍' : log.feedback_rating === 0 ? '👎' : <span className="text-gray-300 text-sm">—</span>}
                        </div>
                        <div className="w-1/6 text-right text-gray-600 text-xs font-mono">
                          {log.response_time_ms != null ? `${log.response_time_ms}ms` : '—'}
                        </div>
                      </div>

                      {expanded === i && (
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 space-y-3">
                          <div>
                            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Generated Answer:</p>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap bg-white p-3 rounded-lg border border-gray-200">
                              {log.answer}
                            </p>
                          </div>
                          {sourcesList.length > 0 && (
                            <div>
                              <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Retrieved Sources:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {sourcesList.map((s, si) => (
                                  <span key={si} className="px-2.5 py-1 bg-white border border-gray-200 text-gray-700 text-xs rounded-lg shadow-2xs">
                                    📄 {s.policy_title || s.filename} {s.section ? `› ${s.section}` : ''}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">Page {page} of {totalPages} · {total} total logs</span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed bg-white"
          >
            ← Prev
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed bg-white"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── FEEDBACK TAB ─────────────────────────────────────────────────────────────
function FeedbackTab() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/feedback')
      .then((r) => setItems(r.data.items || r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-3 font-semibold text-gray-600">Timestamp</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600">Question</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600">Rating</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600">Comment</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={4} className="text-center py-8 text-gray-400">Loading feedback…</td></tr>
          ) : items.length === 0 ? (
            <tr><td colSpan={4} className="text-center py-8 text-gray-400">No user feedback submitted yet</td></tr>
          ) : (
            items.map((fb) => (
              <tr key={fb.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {fb.created_at ? new Date(fb.created_at).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3 text-gray-800 font-medium max-w-sm">
                  {fb.question || <span className="text-gray-400 italic">Query #{fb.query_id}</span>}
                </td>
                <td className="px-4 py-3 text-lg">
                  {fb.rating === 1 ? '👍 Helpful' : '👎 Unhelpful'}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {fb.comment || <span className="text-gray-400 italic">No comment</span>}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── POLICIES TAB ─────────────────────────────────────────────────────────────
function PoliciesTab() {
  const [policies, setPolicies] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [deleteModal, setDeleteModal] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  const fetchPolicies = () => {
    api.get('/admin/policies')
      .then((r) => setPolicies(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchPolicies() }, [])

  const handleUpload = async (file) => {
    if (!file || !file.name.endsWith('.md')) {
      alert('Only .md (Markdown) policy documents are accepted')
      return
    }
    const form = new FormData()
    form.append('file', file)
    setUploading(true)
    setUploadProgress(20)
    try {
      await api.post('/admin/policies/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded * 100) / e.total))
        },
      })
      fetchPolicies()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
      setUploadProgress(0)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleDelete = async (policy) => {
    try {
      await api.delete(`/admin/policies/${policy.filename}`)
      setPolicies((prev) => prev.filter((p) => p.id !== policy.id))
    } catch (err) {
      alert(err?.response?.data?.detail || 'Delete failed')
    } finally {
      setDeleteModal(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const file = e.dataTransfer.files[0]
          if (file) handleUpload(file)
        }}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          dragOver ? 'border-[#1E3A8A] bg-blue-50' : 'border-gray-300 bg-white'
        }`}
      >
        <svg className="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-sm text-gray-700 mb-1 font-medium">Drag &amp; drop a .md policy file</p>
        <p className="text-xs text-gray-400 mb-4">or click to browse your files</p>
        <input
          ref={fileRef}
          type="file"
          accept=".md"
          className="hidden"
          onChange={(e) => handleUpload(e.target.files[0])}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="px-4 py-2 text-white text-sm rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity font-medium"
          style={{ backgroundColor: C.primary }}
        >
          {uploading ? `Uploading… ${uploadProgress}%` : 'Choose Policy File'}
        </button>
        {uploading && (
          <div className="mt-3 w-full bg-gray-200 rounded-full h-1.5 max-w-xs mx-auto">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ width: `${uploadProgress}%`, backgroundColor: C.primary }}
            />
          </div>
        )}
      </div>

      {/* Policy list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Filename</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Title</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Chunks</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Uploaded</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading policies…</td></tr>
            ) : policies.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">No policies uploaded yet</td></tr>
            ) : (
              policies.map((pol) => (
                <tr key={pol.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{pol.filename}</td>
                  <td className="px-4 py-3 text-gray-600">{pol.title || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono">{pol.chunk_count}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {pol.uploaded_at ? new Date(pol.uploaded_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      pol.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {pol.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setDeleteModal(pol)}
                      className="text-rose-600 hover:text-rose-800 text-xs font-medium px-2.5 py-1 rounded border border-rose-200 hover:bg-rose-50 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold text-gray-900 text-lg mb-2">Delete Policy</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete <strong>{deleteModal.filename}</strong>? This will remove all its chunks from the vector store and prevent future retrieval.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteModal(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteModal)}
                className="px-4 py-2 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-medium"
              >
                Delete Policy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── USERS TAB ────────────────────────────────────────────────────────────────
function UsersTab({ currentUser }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'employee' })
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteModal, setDeleteModal] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fetchUsers = () => {
    api.get('/admin/users')
      .then((r) => setUsers(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchUsers() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setFormError('')
    setCreating(true)
    try {
      await api.post('/admin/users', form)
      setForm({ name: '', email: '', password: '', role: 'employee' })
      fetchUsers()
    } catch (err) {
      setFormError(err?.response?.data?.detail || 'Failed to create user')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteUser = async (userToDelete) => {
    if (!userToDelete) return
    setDeleting(true)
    try {
      await api.delete(`/admin/users/${userToDelete.id}`)
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id))
      setDeleteModal(null)
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to delete user')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Create user form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-4">Create New Account (Admin / Employee)</h3>
        {formError && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {formError}
          </div>
        )}
        <form onSubmit={handleCreate} className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
              placeholder="jane@company.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] bg-white"
            >
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="col-span-2 md:col-span-4 flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2 text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: C.primary }}
            >
              {creating ? 'Creating…' : '+ Create User'}
            </button>
          </div>
        </form>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Role</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Created</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading users…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">No users found</td></tr>
            ) : (
              users.map((u) => {
                const isSelf = u.email === currentUser?.email || u.id === currentUser?.id
                return (
                  <tr key={u.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {u.name}
                      {isSelf && (
                        <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-[#1E3A8A] text-[11px] font-semibold rounded">
                          You
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        u.role === 'admin'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-teal-100 text-[#0D9488]'
                      }`}>
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isSelf ? (
                        <span className="text-xs text-gray-400 italic px-2 py-1">Logged In</span>
                      ) : (
                        <button
                          onClick={() => setDeleteModal(u)}
                          className="text-rose-600 hover:text-rose-800 text-xs font-medium px-2.5 py-1 rounded border border-rose-200 hover:bg-rose-50 transition-colors"
                          title={`Remove ${u.role === 'admin' ? 'Admin' : 'Employee'}`}
                        >
                          Remove {u.role === 'admin' ? 'Admin' : 'Employee'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Delete User Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold text-gray-900 text-lg mb-2">
              Remove {deleteModal.role === 'admin' ? 'Admin Account' : 'Employee Account'}
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Are you sure you want to remove <strong>{deleteModal.name}</strong> ({deleteModal.email})?
            </p>
            {deleteModal.role === 'admin' && (
              <div className="mb-4 text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                ⚠️ <strong>Admin Removal Notice:</strong> This user has full admin rights. Deleting this account will immediately revoke all dashboard and policy management access.
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteModal(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteUser(deleteModal)}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-medium disabled:opacity-50"
              >
                {deleting ? 'Removing…' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const TABS = ['Stats', 'Query Logs', 'Feedback', 'Policies', 'Users']

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState('Stats')

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: C.bg }}>
      <Navbar user={user} logout={logout} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Tab bar */}
          <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 w-fit shadow-2xs">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab
                    ? 'text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
                style={{
                  backgroundColor: activeTab === tab ? C.primary : 'transparent',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'Stats' && <StatsTab />}
          {activeTab === 'Query Logs' && <QueryLogsTab />}
          {activeTab === 'Feedback' && <FeedbackTab />}
          {activeTab === 'Policies' && <PoliciesTab />}
          {activeTab === 'Users' && <UsersTab currentUser={user} />}
        </div>
      </div>
    </div>
  )
}
