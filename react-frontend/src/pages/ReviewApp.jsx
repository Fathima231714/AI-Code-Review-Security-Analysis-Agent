import { useEffect, useMemo, useState } from 'react'
import './reviewApp.css'
import { getCurrentUser, logout } from '../lib/auth'

// Keep API calls same-origin. Nginx (Docker) and Vite (local development)
// both proxy /api requests to Spring Boot, avoiding browser CORS failures.
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
// Route AI calls through the same-origin API gateway. In Docker, Nginx sends
// these requests to FastAPI; in local Vite development, Spring Boot forwards
// them. This avoids direct browser-to-service CORS/network failures.
const AI_BASE = import.meta.env.VITE_AI_BASE_URL || '/api'
const LOCAL_HISTORY_KEY = 'code-review-history'
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

function inferLanguage(fileName, source) {
  const name = (fileName || '').toLowerCase()
  if (name.endsWith('.java') || /\b(class|interface|record|enum)\s+\w+/.test(source)) return 'java'
  if (name.endsWith('.py') || /^\s*(def|class)\s+\w+/m.test(source) || /\b(import|print)\s*\(/.test(source)) return 'python'
  return null
}

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
  const [reviewStage, setReviewStage] = useState('')
  const [aiStatus, setAiStatus] = useState(null)
  const [history, setHistory] = useState([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const stats = useMemo(() => ({ lines: code ? code.split(/\r\n|\r|\n/).length : 0, chars: code.length }), [code])
  const findings = useMemo(() => {
    const all = [...(review?.findings || []), ...(review?.code_quality || [])]
    return filter === 'all' ? all : all.filter((item) => item.severity === filter)
  }, [review, filter])
  const healthScore = review?.health_score ?? 100
  const summaryData = review?.pr_summary_data
  const suggestedQuestions = useMemo(() => {
    const firstFinding = [...(review?.findings || []), ...(review?.code_quality || [])][0]
    return [
      firstFinding ? `Explain ${firstFinding.id} in simple words` : 'What should I review first?',
      firstFinding ? `Show a safer fix for ${firstFinding.id}` : 'How do I make this code more secure?',
      'What is the highest-priority fix before merge?',
      'Give me a short test plan for these findings',
    ]
  }, [review])

  useEffect(() => {
    fetch(`${AI_BASE}/status`)
      .then((response) => response.ok ? response.json() : null)
      .then(setAiStatus)
      .catch(() => setAiStatus({ status: 'unavailable' }))
  }, [])

  useEffect(() => {
    const detected = inferLanguage(fileName, code)
    if (detected) setLanguage(detected)
  }, [fileName, code])

  async function loadHistory() {
    let local = []
    try { local = JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || '[]') } catch { local = [] }
    try {
      const response = await fetch(`${AI_BASE}/reviews/history`)
      const remote = response.ok ? (await response.json()).reviews || [] : []
      setHistory([...remote, ...local.filter((entry) => !remote.some((saved) => saved.id === entry.id))].slice(0, 12))
    } catch { setHistory(local) }
  }

  useEffect(() => { loadHistory() }, [])

  function switchLanguage(next) {
    setLanguage(next); setFileName(next === 'java' ? 'Submission.java' : 'submission.py')
    setCode(next === 'java' ? sampleJava : samplePython); setResult(null); setReview(null); setChat([])
  }
  async function paste(event) {
    event.preventDefault(); setLoading(true); setError(''); setResult(null); setReview(null)
    try {
      const response = await fetch(`${API_BASE}/api/submissions/paste`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, fileName, language }) })
      if (!response.ok) throw new Error(await responseError(response, 'Backend')); setResult(await response.json())
    } catch (err) { setError(err.message || 'Could not submit code.') } finally { setLoading(false) }
  }
  async function upload(event) {
    event.preventDefault(); if (!file) return setError('Choose a .java or .py file first.')
    setLoading(true); setError(''); setResult(null); const form = new FormData(); form.append('codeFile', file)
    try {
      const response = await fetch(`${API_BASE}/api/submissions/upload`, { method: 'POST', body: form })
      if (!response.ok) throw new Error(await responseError(response, 'Backend'))
      const payload = await response.json(); setResult(payload); setCode(payload.code); setFileName(payload.fileName); setLanguage(payload.language)
    } catch (err) { setError(err.message || 'Could not upload file.') } finally { setLoading(false) }
  }
  async function runReview() {
    const source = result?.code || code; if (!source.trim()) return setError('Submit code before reviewing.')
    setReviewLoading(true); setError(''); setChat([]); setReviewStage('Scanning source code…')
    try {
      setReviewStage('Running security and quality agents…')
      const response = await fetch(`${AI_BASE}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: source, language: result?.language || language, submission_id: result?.submissionId }) })
      if (!response.ok) throw new Error(await responseError(response, 'AI service'))
      const payload = await response.json()
      if (!payload.review) throw new Error(payload.response || 'The AI service did not return a review.')
      const savedId = payload.reviewId || result?.submissionId || crypto.randomUUID()
      const localReview = { id: savedId, createdAt: new Date().toISOString(), fileName, language: result?.language || language, code: source, review: payload.review }
      const local = [localReview, ...history.filter((entry) => entry.id !== savedId)].slice(0, 12)
      localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(local))
      setHistory(local); setReview(payload.review); setReviewId(savedId); setReviewStage('Analysis complete'); loadHistory()
      setChat([{ role: 'Assistant', text: 'Review complete. Ask me about any finding, a remediation, or the safest next step.' }])
    } catch (err) { setError(err.message || 'Could not reach the AI service.'); setReviewStage('') } finally { setReviewLoading(false) }
  }
  async function ask(event) {
    event.preventDefault(); if (!question.trim()) return
    const prompt = question; setQuestion(''); setAsking(true)
    const newChat = [...chat, { role: 'You', text: prompt }]
    setChat(newChat)
    try {
      const response = await fetch(`${AI_BASE}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: prompt,
          review_id: reviewId,
          review_findings: [...(review?.findings || []), ...(review?.code_quality || [])],
          chat_history: newChat.map((item) => ({ role: item.role.toLowerCase(), text: item.text })),
        }),
      })
      if (!response.ok) throw new Error(await responseError(response, 'Assistant'))
      const payload = await response.json(); setChat((items) => [...items, { role: 'Assistant', text: payload.answer, citations: payload.citations || [] }])
    } catch (err) {
      setChat((items) => [...items, { role: 'Assistant', text: err.message || 'Assistant unavailable.' }])
    } finally {
      setAsking(false)
    }
  }
  async function exportReport(type) {
    if (!review) return
    try {
      const response = await fetch(`${AI_BASE}/reports/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review, file_name: fileName, language }),
      })
      if (!response.ok) {
        const body = await response.text()
        throw new Error(`Report generation failed${body ? `: ${body}` : ''}`)
      }
      download(await response.blob(), `code-review-report.${type}`)
    } catch (err) {
      setError(err.message || 'Failed to generate report.')
    }
  }

  function restoreReview(saved) {
    if (!saved.review || !saved.code) return
    setCode(saved.code); setFileName(saved.fileName || 'Submission'); setLanguage(saved.language || inferLanguage(saved.fileName, saved.code) || 'java')
    setResult({ submissionId: saved.id, fileName: saved.fileName, language: saved.language, code: saved.code, valid: true, errors: [] })
    setReview(saved.review); setReviewId(saved.id); setChat([{ role: 'Assistant', text: `Restored ${saved.fileName}. Ask me anything about this saved review.` }]); setError('')
  }

  return <main className="app-shell"><header className="topbar"><div><p className="eyebrow">AI Code Review · Multi-agent analysis</p><h1>Turn risky code into clear, safe fixes.</h1><p className="hero-copy">Validate code, visualize risk, then chat with an assistant grounded in your active review.</p></div><div className="top-actions"><button className="history-toggle" onClick={() => setHistoryOpen(true)}>History <span>{history.length}</span></button><span className="user-chip">Signed in as {getCurrentUser() || 'User'}</span><button className="logout-btn" onClick={() => (logout(), window.location.reload())}>Logout</button></div></header>
    <section className="workspace"><section className="submission-panel"><div className="panel-header"><div><p className="eyebrow">Code Submission</p><h2>Paste or upload Java/Python</h2></div><div className="segmented"><button className={mode === 'paste' ? 'active' : ''} onClick={() => setMode('paste')}>Paste</button><button className={mode === 'upload' ? 'active' : ''} onClick={() => setMode('upload')}>Upload</button></div></div>
      {mode === 'paste' ? <form className="submission-form" onSubmit={paste}><div className="control-row"><label>Language<select value={language} onChange={(e) => switchLanguage(e.target.value)}><option value="java">Java</option><option value="python">Python</option></select></label><label>File name<input value={fileName} onChange={(e) => setFileName(e.target.value)} /></label></div><label className="editor-label">Source code<textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck="false" /></label><button className="primary-action" disabled={loading}>{loading ? 'Validating…' : 'Validate Code'}</button></form> : <form className="submission-form" onSubmit={upload}><label className="file-picker"><strong>{file ? file.name : 'Choose Java or Python file'}</strong><input type="file" accept=".java,.py" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label><button className="primary-action" disabled={loading}>{loading ? 'Uploading…' : 'Upload and Validate'}</button></form>}
      {error && <p className="error-banner">{error}</p>}</section>
      <section className="result-panel"><div className="panel-header compact"><div><p className="eyebrow">Analysis workspace</p><h2>{result ? result.fileName : 'Ready for submission'}</h2></div><div className={`result-badge ${result?.valid ? 'valid' : ''}`}>{result ? (result.valid ? 'Valid' : 'Needs Fix') : 'Idle'}</div></div><div className="metrics"><span>{result?.language || language}</span><span>{stats.lines} lines</span><span>{stats.chars} chars</span><button className="secondary-action" onClick={runReview} disabled={reviewLoading || !result?.valid}>{reviewLoading ? 'Analyzing…' : 'Run AI Review'}</button></div>{reviewLoading && <div className="analysis-progress"><span /><p>{reviewStage || 'Preparing analysis…'}</p></div>}
      {result?.errors?.length > 0 && <ul className="messages">{result.errors.map((item) => <li key={item}>{item}</li>)}</ul>}
      {review ? <section className="review-results"><div className="summary-card"><div className="summary-header"><div><h3>Pull request summary</h3><p className="summary-tag">Executive overview</p></div><div className={`health-score ${healthScore >= 80 ? 'good' : healthScore >= 60 ? 'warning' : 'danger'}`}><span>{healthScore}</span><small>/100</small></div></div><div className="health-bar"><span style={{ width: `${healthScore}%` }} /></div><p>{summaryData?.executive_overview || review.pr_summary}</p>{summaryData?.prioritized_fixes?.length > 0 && <ul className="priority-list">{summaryData.prioritized_fixes.filter((item) => item !== 'Prioritized fixes:').map((item) => <li key={item}>{item}</li>)}</ul>}{review.llm_notes && <p className="llm-notes">{review.llm_notes}</p>}<div className="severity-graph">{Object.entries(review.severity_breakdown || {}).map(([level, count]) => <div className={`severity-bar ${level}`} key={level}><span className="severity-icon">{level === 'critical' ? '!' : level === 'high' ? '↑' : level === 'medium' ? '•' : level === 'low' ? '↓' : 'i'}</span><span className="label">{level}</span><div className={`bar ${level}`}><span style={{ width: `${Math.min(100, count * 30)}%` }} /></div><strong>{count}</strong></div>)}</div><div className="severity-row">{Object.entries(review.severity_breakdown || {}).map(([level, count]) => <button key={level} className={`severity ${level} ${filter === level ? 'selected' : ''}`} onClick={() => setFilter(filter === level ? 'all' : level)}>{count} {level}</button>)}</div><div className="export-row"><button onClick={() => exportReport('html')}>Export HTML</button><button onClick={() => exportReport('pdf')}>Export PDF</button></div></div>
        <div className="findings"><h3>Findings ({findings.length})</h3>{findings.map((item) => <article className={`finding ${item.severity}`} key={item.id}><div><span className="finding-id">{item.id}</span><strong>{item.title}</strong><span className="line">{item.line ? `Line ${item.line}` : ''}</span></div><p>{item.explanation}</p><code>{item.evidence}</code><p><b>Recommendation:</b> {item.recommendation}</p>{item.owasp && <small>{item.owasp}</small>}{review.remediations?.filter((fix) => fix.finding_id === item.id).map((fix) => <pre className="fix" key={fix.finding_id}>{fix.after_code}</pre>)}</article>)}{findings.length === 0 && <p>No issues match this filter.</p>}</div>
        <section className="assistant"><div className="assistant-title"><div><p className="eyebrow">Review copilot</p><h3>Conversational Code Assistant</h3></div><span className={`online-dot ${aiStatus?.status === 'unavailable' ? 'offline' : ''}`}>{aiStatus?.status === 'unavailable' ? 'Offline' : 'Ready'}</span></div><p>Ask about a finding, a safer implementation, or the next fix to prioritize.</p><p className="model-status">{aiStatus?.llm_provider ? <>Powered by <b>{aiStatus.llm_provider === 'gemini' ? 'Google Gemini' : 'Ollama'}</b> · {aiStatus.llm_model}</> : 'Checking AI provider…'}</p><div className="prompt-chips">{suggestedQuestions.map((prompt) => <button type="button" key={prompt} onClick={() => setQuestion(prompt)}>{prompt}</button>)}</div><div className="chat-log">{chat.map((item, index) => <div className={`chat-message ${item.role.toLowerCase()}`} key={index}><b>{item.role}</b><p>{item.text}</p>{item.citations?.map((citation) => <small key={citation.id}>{citation.source}</small>)}</div>)}{asking && <div className="chat-message assistant typing"><b>Assistant</b><p>Checking review context…</p></div>}</div><form onSubmit={ask}><input placeholder="Explain F-001 and show the safe approach" value={question} onChange={(e) => setQuestion(e.target.value)} /><button disabled={asking}>{asking ? 'Thinking…' : 'Send'}</button></form></section>
      </section> : <pre className="code-preview">{result?.code || code}</pre>}</section></section><button className="history-fab" onClick={() => setHistoryOpen(true)}>◷ <span>History</span><b>{history.length}</b></button>{historyOpen && <div className="history-backdrop" onClick={() => setHistoryOpen(false)}><aside className="history-drawer" onClick={(event) => event.stopPropagation()}><div className="history-drawer-head"><div><p className="eyebrow">Persistent history</p><h2>Recent reviews</h2></div><button onClick={() => setHistoryOpen(false)}>×</button></div><p>Every completed AI review is stored locally and in the app database.</p><button className="history-refresh" onClick={loadHistory}>Refresh history</button><div className="history-list">{history.length ? history.map((saved) => <button key={saved.id} className="history-item" onClick={() => { restoreReview(saved); setHistoryOpen(false) }}><span className="history-icon">{saved.language === 'python' ? 'Py' : 'Ja'}</span><span><b>{saved.fileName}</b><small>{saved.createdAt ? new Date(saved.createdAt).toLocaleString() : 'Saved review'}</small></span><em>Open</em></button>) : <p className="history-empty">Run an AI review, then it will appear here.</p>}</div></aside></div>}</main>
}

async function responseError(response, service) {
  const body = await response.text()
  try {
    const parsed = JSON.parse(body)
    return parsed.message || parsed.detail || parsed.error || `${service} returned ${response.status}`
  } catch {
    return `${service} returned ${response.status}${body ? `: ${body.slice(0, 180)}` : ''}`
  }
}
