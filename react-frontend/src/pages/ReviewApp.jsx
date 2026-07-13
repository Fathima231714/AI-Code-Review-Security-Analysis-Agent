import { useMemo, useState } from 'react'
import './reviewApp.css'
import { getCurrentUser, logout } from '../lib/auth'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

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

export default function ReviewApp() {
  const username = getCurrentUser() || 'User'

  const [mode, setMode] = useState('paste')
  const [language, setLanguage] = useState('java')
  const [fileName, setFileName] = useState('Submission.java')
  const [code, setCode] = useState(sampleJava)
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [aiReview, setAiReview] = useState('')
  const [ragMatches, setRagMatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [reviewLoading, setReviewLoading] = useState(false)

  const codeStats = useMemo(() => {
    const lines = code ? code.split(/\r\n|\r|\n/).length : 0
    const chars = code.length
    return { lines, chars }
  }, [code])

  function switchLanguage(nextLanguage) {
    setLanguage(nextLanguage)
    if (nextLanguage === 'java') {
      setFileName('Submission.java')
      setCode(sampleJava)
    } else {
      setFileName('submission.py')
      setCode(samplePython)
    }
    setResult(null)
    setAiReview('')
    setRagMatches([])
  }

  async function submitPastedCode(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)
    setAiReview('')
    setRagMatches([])

    try {
      const response = await fetch(`${API_BASE}/api/submissions/paste`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, fileName, language }),
      })
      if (!response.ok) throw new Error(`Backend returned ${response.status}`)
      setResult(await response.json())
    } catch (err) {
      setError(err.message || 'Could not submit pasted code.')
    } finally {
      setLoading(false)
    }
  }

  async function runAiReview() {
    const source = result?.code || code
    if (!source.trim()) {
      setError('Submit code before running AI review.')
      return
    }

    setReviewLoading(true)
    setError('')
    setAiReview('')

    try {
      const response = await fetch(`${API_BASE}/api/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: source, language: result?.language || language }),
      })
      if (!response.ok) throw new Error(`AI service returned ${response.status}`)
      const payload = await response.json()
      setAiReview(payload.response || 'AI review completed without text output.')
      setRagMatches(payload.rag_matches || payload.ragMatches || [])
    } catch (err) {
      setError(err.message || 'Could not reach the AI service.')
    } finally {
      setReviewLoading(false)
    }
  }

  async function submitFile(event) {
    event.preventDefault()
    if (!file) {
      setError('Choose a .java or .py file first.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    const formData = new FormData()
    formData.append('codeFile', file)

    try {
      const response = await fetch(`${API_BASE}/api/submissions/upload`, {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) throw new Error(`Backend returned ${response.status}`)
      const payload = await response.json()
      setResult(payload)
      setCode(payload.code)
      setFileName(payload.fileName)
      setLanguage(payload.language === 'python' ? 'python' : 'java')
    } catch (err) {
      setError(err.message || 'Could not upload file.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">AI Code Review</p>
          <h1>Security-first code review & remediation</h1>
        </div>

        <div className="top-actions">
          <span className="user-chip">Signed in as {username}</span>
          <button className="logout-btn" type="button" onClick={() => (logout(), window.location.reload())}>
            Logout
          </button>
        </div>
      </header>

      <section className="workspace">
        <section className="submission-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Code Submission</p>
              <h2>Paste or upload Java/Python</h2>
            </div>
            <div className="segmented" role="tablist" aria-label="Submission mode">
              <button className={mode === 'paste' ? 'active' : ''} type="button" onClick={() => setMode('paste')}>
                <span aria-hidden="true">TXT</span>
                Paste
              </button>
              <button className={mode === 'upload' ? 'active' : ''} type="button" onClick={() => setMode('upload')}>
                <span aria-hidden="true">UP</span>
                Upload
              </button>
            </div>
          </div>

          {mode === 'paste' ? (
            <form className="submission-form" onSubmit={submitPastedCode}>
              <div className="control-row">
                <label>
                  Language
                  <select value={language} onChange={(event) => switchLanguage(event.target.value)}>
                    <option value="java">Java</option>
                    <option value="python">Python</option>
                  </select>
                </label>
                <label>
                  File name
                  <input value={fileName} onChange={(event) => setFileName(event.target.value)} />
                </label>
              </div>
              <label className="editor-label">
                Source code
                <textarea value={code} onChange={(event) => setCode(event.target.value)} spellCheck="false" />
              </label>
              <button className="primary-action" type="submit" disabled={loading}>
                <span aria-hidden="true">OK</span>
                {loading ? 'Validating...' : 'Validate Code'}
              </button>
            </form>
          ) : (
            <form className="submission-form" onSubmit={submitFile}>
              <label className="file-picker">
                <span aria-hidden="true">UP</span>
                <strong>{file ? file.name : 'Choose Java or Python file'}</strong>
                <input type="file" accept=".java,.py" onChange={(event) => setFile(event.target.files?.[0] || null)} />
              </label>
              <button className="primary-action" type="submit" disabled={loading}>
                <span aria-hidden="true">OK</span>
                {loading ? 'Uploading...' : 'Upload and Validate'}
              </button>
            </form>
          )}

          {error ? <p className="error-banner">{error}</p> : null}
        </section>

        <section className="result-panel">
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">Validation Result</p>
              <h2>{result ? result.fileName : 'Waiting for submission'}</h2>
            </div>
            <div className={`result-badge ${result?.valid ? 'valid' : ''}`}>
              {result ? (result.valid ? 'Valid' : 'Needs Fix') : 'Idle'}
            </div>
          </div>

          <div className="metrics">
            <span>{result?.language || language}</span>
            <span>{codeStats.lines} lines</span>
            <span>{codeStats.chars} chars</span>
          </div>

          <div className="review-actions">
            <button className="secondary-action" type="button" onClick={runAiReview} disabled={reviewLoading}>
              <span aria-hidden="true">AI</span>
              {reviewLoading ? 'Reviewing...' : 'Run AI Review'}
            </button>
          </div>

          {result?.errors?.length ? (
            <ul className="messages">
              {result.errors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}

          {result?.detectedRisks?.length ? (
            <ul className="risk-list">
              {result.detectedRisks.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}

          <pre className="code-preview">{result?.code || code}</pre>

          {aiReview ? (
            <section className="ai-review" aria-label="AI review report">
              <h3>AI Review Report</h3>
              <pre>{aiReview}</pre>
              {ragMatches.length ? (
                <div className="rag-sources">
                  <h4>RAG Sources</h4>
                  <ul>
                    {ragMatches.map((match) => (
                      <li key={match.id || `${match.source}-${match.score}`}>
                        <strong>{match.source}</strong>
                        <span> score {match.score}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}
        </section>
      </section>
    </main>
  )
}

