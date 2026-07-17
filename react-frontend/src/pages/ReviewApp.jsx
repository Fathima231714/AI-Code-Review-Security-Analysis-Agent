import { useMemo, useState } from 'react'
import './reviewApp.css'
import { getCurrentUser, logout } from '../lib/auth'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
const AI_BASE = import.meta.env.VITE_AI_BASE_URL || 'http://localhost:8000'
const sampleJava = `public class LoginService {
  public boolean login(String username, String password) {
    String sql = "SELECT * FROM users WHERE name = '" + username + "'";
    return password.equals("admin123");
  }
}`
const samplePython = `def get_user(cursor, username):
    query = "SELECT * FROM users WHERE name = '" + username + "'"
    cursor.execute(query)
    return cursor.fetchone()`

function download(blob, name) {
  const url = URL.createObjectURL(blob); const link = document.createElement('a')
  link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url)
}

export default function ReviewApp() {
  const [mode, setMode] = useState('paste'); const [language, setLanguage] = useState('java')
  const [fileName, setFileName] = useState('Submission.java'); const [code, setCode] = useState(sampleJava)
  const [file, setFile] = useState(null); const [result, setResult] = useState(null)
  const [review, setReview] = useState(null); const [reviewId, setReviewId] = useState(null)
  const [filter, setFilter] = useState('all'); const [question, setQuestion] = useState('')
  const [chat, setChat] = useState([]); const [error, setError] = useState('')
  const [loading, setLoading] = useState(false); const [reviewLoading, setReviewLoading] = useState(false)
  const [asking, setAsking] = useState(false)
  const stats = useMemo(() => ({ lines: code ? code.split(/\r\n|\r|\n/).length : 0, chars: code.length }), [code])
  const findings = useMemo(() => {
    const all = [...(review?.findings || []), ...(review?.code_quality || [])]
    return filter === 'all' ? all : all.filter((item) => item.severity === filter)
  }, [review, filter])

  function switchLanguage(next) {
    setLanguage(next); setFileName(next === 'java' ? 'Submission.java' : 'submission.py')
    setCode(next === 'java' ? sampleJava : samplePython); setResult(null); setReview(null); setChat([])
  }
  async function paste(event) {
    event.preventDefault(); setLoading(true); setError(''); setReview(null)
    try {
      const response = await fetch(`${API_BASE}/api/submissions/paste`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, fileName, language }) })
      if (!response.ok) throw new Error(`Backend returned ${response.status}`); setResult(await response.json())
    } catch (err) { setError(err.message || 'Could not submit code.') } finally { setLoading(false) }
  }
  async function upload(event) {
    event.preventDefault(); if (!file) return setError('Choose a .java or .py file first.')
    setLoading(true); setError(''); const form = new FormData(); form.append('codeFile', file)
    try {
      const response = await fetch(`${API_BASE}/api/submissions/upload`, { method: 'POST', body: form })
      if (!response.ok) throw new Error(`Backend returned ${response.status}`)
      const payload = await response.json(); setResult(payload); setCode(payload.code); setFileName(payload.fileName); setLanguage(payload.language)
    } catch (err) { setError(err.message || 'Could not upload file.') } finally { setLoading(false) }
  }
  async function runReview() {
    const source = result?.code || code; if (!source.trim()) return setError('Submit code before reviewing.')
    setReviewLoading(true); setError(''); setChat([])
    try {
      const response = await fetch(`${AI_BASE}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: source, language: result?.language || language, submission_id: result?.submissionId }) })
      if (!response.ok) throw new Error(`AI service returned ${response.status}`)
      const payload = await response.json(); setReview(payload.review); setReviewId(payload.reviewId || result?.submissionId || null)
    } catch (err) { setError(err.message || 'Could not reach the AI service.') } finally { setReviewLoading(false) }
  }
  async function ask(event) {
    event.preventDefault(); if (!question.trim()) return
    const prompt = question; setQuestion(''); setAsking(true); setChat((items) => [...items, { role: 'You', text: prompt }])
    try {
      const response = await fetch(`${AI_BASE}/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: prompt, review_id: reviewId }) })
      if (!response.ok) throw new Error(`Assistant returned ${response.status}`)
      const payload = await response.json(); setChat((items) => [...items, { role: 'Assistant', text: payload.answer, citations: payload.citations || [] }])
    } catch (err) { setChat((items) => [...items, { role: 'Assistant', text: err.message || 'Assistant unavailable.' }]) } finally { setAsking(false) }
  }
  async function exportReport(type) {
    if (!review) return
    try {
      const response = await fetch(`${AI_BASE}/reports/${type}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ review, file_name: fileName, language }) })
      if (!response.ok) throw new Error('Report generation failed'); download(await response.blob(), `code-review-report.${type}`)
    } catch (err) { setError(err.message) }
  }

  return <main className="app-shell"><header className="topbar"><div><p className="eyebrow">AI Code Review</p><h1>Security-first code review & remediation</h1></div><div className="top-actions"><span className="user-chip">Signed in as {getCurrentUser() || 'User'}</span><button className="logout-btn" onClick={() => (logout(), window.location.reload())}>Logout</button></div></header>
    <section className="workspace"><section className="submission-panel"><div className="panel-header"><div><p className="eyebrow">Code Submission</p><h2>Paste or upload Java/Python</h2></div><div className="segmented"><button className={mode === 'paste' ? 'active' : ''} onClick={() => setMode('paste')}>Paste</button><button className={mode === 'upload' ? 'active' : ''} onClick={() => setMode('upload')}>Upload</button></div></div>
      {mode === 'paste' ? <form className="submission-form" onSubmit={paste}><div className="control-row"><label>Language<select value={language} onChange={(e) => switchLanguage(e.target.value)}><option value="java">Java</option><option value="python">Python</option></select></label><label>File name<input value={fileName} onChange={(e) => setFileName(e.target.value)} /></label></div><label className="editor-label">Source code<textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck="false" /></label><button className="primary-action" disabled={loading}>{loading ? 'Validating…' : 'Validate Code'}</button></form> : <form className="submission-form" onSubmit={upload}><label className="file-picker"><strong>{file ? file.name : 'Choose Java or Python file'}</strong><input type="file" accept=".java,.py" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label><button className="primary-action" disabled={loading}>{loading ? 'Uploading…' : 'Upload and Validate'}</button></form>}
      {error && <p className="error-banner">{error}</p>}</section>
      <section className="result-panel"><div className="panel-header compact"><div><p className="eyebrow">Analysis workspace</p><h2>{result ? result.fileName : 'Ready for submission'}</h2></div><div className={`result-badge ${result?.valid ? 'valid' : ''}`}>{result ? (result.valid ? 'Valid' : 'Needs Fix') : 'Idle'}</div></div><div className="metrics"><span>{result?.language || language}</span><span>{stats.lines} lines</span><span>{stats.chars} chars</span><button className="secondary-action" onClick={runReview} disabled={reviewLoading}>{reviewLoading ? 'Reviewing…' : 'Run AI Review'}</button></div>
      {result?.errors?.length > 0 && <ul className="messages">{result.errors.map((item) => <li key={item}>{item}</li>)}</ul>}
      {review ? <section className="review-results"><div className="summary-card"><h3>Pull request summary</h3><p>{review.pr_summary}</p>{review.llm_notes && <p className="llm-notes">{review.llm_notes}</p>}<div className="severity-row">{Object.entries(review.severity_breakdown || {}).map(([level, count]) => <button key={level} className={`severity ${level} ${filter === level ? 'selected' : ''}`} onClick={() => setFilter(filter === level ? 'all' : level)}>{count} {level}</button>)}</div><div className="export-row"><button onClick={() => exportReport('html')}>Export HTML</button><button onClick={() => exportReport('pdf')}>Export PDF</button></div></div>
        <div className="findings"><h3>Findings ({findings.length})</h3>{findings.map((item) => <article className={`finding ${item.severity}`} key={item.id}><div><span className="finding-id">{item.id}</span><strong>{item.title}</strong><span className="line">{item.line ? `Line ${item.line}` : ''}</span></div><p>{item.explanation}</p><code>{item.evidence}</code><p><b>Recommendation:</b> {item.recommendation}</p>{item.owasp && <small>{item.owasp}</small>}{review.remediations?.filter((fix) => fix.finding_id === item.id).map((fix) => <pre className="fix" key={fix.finding_id}>{fix.after_code}</pre>)}</article>)}{findings.length === 0 && <p>No issues match this filter.</p>}</div>
        <section className="assistant"><h3>Conversational Code Assistant</h3><p>Ask about a finding or secure-coding practice.</p><div className="chat-log">{chat.map((item, index) => <div className={`chat-message ${item.role.toLowerCase()}`} key={index}><b>{item.role}</b><p>{item.text}</p>{item.citations?.map((citation) => <small key={citation.id}>{citation.source}</small>)}</div>)}</div><form onSubmit={ask}><input placeholder="Why is this SQL injection?" value={question} onChange={(e) => setQuestion(e.target.value)} /><button disabled={asking}>{asking ? 'Asking…' : 'Ask'}</button></form></section>
      </section> : <pre className="code-preview">{result?.code || code}</pre>}</section></section></main>
}
