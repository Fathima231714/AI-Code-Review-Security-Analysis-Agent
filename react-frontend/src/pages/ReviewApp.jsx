import { useEffect, useMemo, useState } from "react";
import "./reviewApp.css";
import { getCurrentUser, logout } from "../lib/auth";
import RiskRadar from "../components/RiskRadar";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const AI_BASE = import.meta.env.VITE_AI_BASE_URL || "/api";
const LOCAL_HISTORY_KEY = "code-review-history";
const sampleJava = `public class LoginService {
  public boolean login(String username, String password) {
    String sql = "SELECT * FROM users WHERE name = '" + username + "'";
    return password.equals("admin123");
  }
}`;
const samplePython = `def get_user(cursor, username):
    query = "SELECT * FROM users WHERE name = '" + username + "'"
    cursor.execute(query)
    return cursor.fetchone()`;

function inferLanguage(fileName, source) {
  const text = source || "";
  const name = (fileName || "").toLowerCase();
  const java = (
    text.match(
      /\b(package|public\s+(class|interface|static)|class|interface|extends|implements|System\.out\.println)\b/g,
    ) || []
  ).length;
  const python = (
    text.match(
      /(^|\n)\s*(def|class|import|from)\s+|\b(self|None|True|False|print)\s*\(?/g,
    ) || []
  ).length;
  if (java > python && java) return "java";
  if (python > java && python) return "python";
  if (name.endsWith(".java")) return "java";
  if (name.endsWith(".py")) return "python";
  return "unknown";
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
function displayLanguage(language) {
  return language === "python"
    ? "Python"
    : language === "java"
      ? "Java"
      : "Detectingâ€¦";
}

export default function ReviewApp() {
  const [mode, setMode] = useState("paste");
  const [fileName, setFileName] = useState("LoginService.java");
  const [code, setCode] = useState(sampleJava);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [review, setReview] = useState(null);
  const [reviewId, setReviewId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const detectedLanguage = useMemo(
    () => inferLanguage(fileName, code),
    [fileName, code],
  );
  const stats = useMemo(
    () => ({
      lines: code ? code.split(/\r\n|\r|\n/).length : 0,
      chars: code.length,
    }),
    [code],
  );
  const allFindings = useMemo(
    () => [...(review?.findings || []), ...(review?.code_quality || [])],
    [review],
  );
  const findings = useMemo(
    () =>
      filter === "all"
        ? allFindings
        : allFindings.filter((item) => item.severity === filter),
    [allFindings, filter],
  );
  const healthScore = review?.health_score ?? 100;
  const summaryData = review?.pr_summary_data;
  const suggestedQuestions = useMemo(() => {
    const first = allFindings[0];
    return [
      first ? `Explain ${first.id} simply` : "What should I review first?",
      "What must I fix before merge?",
      "Give me a secure code example",
      "Create a test plan for these issues",
    ];
  }, [allFindings]);

  async function loadAiStatus() {
    try {
      const response = await fetch(`${AI_BASE}/status`);
      if (!response.ok) throw new Error();
      setAiStatus(await response.json());
    } catch {
      setAiStatus({ status: "unavailable" });
    }
  }
  async function loadHistory() {
    let local = [];
    try {
      local = JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || "[]");
    } catch {
      local = [];
    }
    try {
      const response = await fetch(`${AI_BASE}/reviews/history`);
      const remote = response.ok ? (await response.json()).reviews || [] : [];
      setHistory(
        [
          ...remote,
          ...local.filter(
            (entry) => !remote.some((saved) => saved.id === entry.id),
          ),
        ].slice(0, 12),
      );
    } catch {
      setHistory(local);
    }
  }
  useEffect(() => {
    loadAiStatus();
    loadHistory();
    const timer = window.setInterval(loadAiStatus, 15000);
    return () => window.clearInterval(timer);
  }, []);

  function useSample(language) {
    const isPython = language === "python";
    setMode("paste");
    setFileName(isPython ? "security_sample.py" : "LoginService.java");
    setCode(isPython ? samplePython : sampleJava);
    setResult(null);
    setReview(null);
    setChat([]);
    setError("");
  }
  function clearEditor() {
    setFileName("untitled");
    setCode("");
    setResult(null);
    setReview(null);
    setChat([]);
    setError("");
  }
  async function paste(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    setReview(null);
    try {
      const response = await fetch(`${API_BASE}/api/submissions/paste`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          fileName,
          language: detectedLanguage === "unknown" ? "" : detectedLanguage,
        }),
      });
      if (!response.ok)
        throw new Error(await responseError(response, "Backend"));
      const payload = await response.json();
      setResult(payload);
      setFileName(payload.fileName || fileName);
    } catch (err) {
      setError(err.message || "Could not validate the submitted code.");
    } finally {
      setLoading(false);
    }
  }
  async function upload(event) {
    event.preventDefault();
    if (!file) return setError("Choose a non-empty .java or .py file first.");
    setLoading(true);
    setError("");
    setResult(null);
    const form = new FormData();
    form.append("codeFile", file);
    try {
      const response = await fetch(`${API_BASE}/api/submissions/upload`, {
        method: "POST",
        body: form,
      });
      if (!response.ok)
        throw new Error(await responseError(response, "Backend"));
      const payload = await response.json();
      setResult(payload);
      setCode(payload.code);
      setFileName(payload.fileName);
    } catch (err) {
      setError(err.message || "Could not upload the code file.");
    } finally {
      setLoading(false);
    }
  }
  async function runReview() {
    const source = result?.code || code;
    if (!source.trim())
      return setError("Add code and validate it before running a review.");
    setReviewLoading(true);
    setError("");
    setChat([]);
    try {
      const language = inferLanguage(result?.fileName || fileName, source);
      const response = await fetch(`${AI_BASE}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: source,
          language: language === "unknown" ? "" : language,
          submission_id: result?.submissionId,
        }),
      });
      if (!response.ok)
        throw new Error(await responseError(response, "AI service"));
      const payload = await response.json();
      if (!payload.review)
        throw new Error(
          payload.response || "The AI service did not return a review.",
        );
      const savedId =
        payload.reviewId || result?.submissionId || crypto.randomUUID();
      const localReview = {
        id: savedId,
        createdAt: new Date().toISOString(),
        fileName,
        language: payload.detected_language || language,
        code: source,
        review: payload.review,
      };
      const local = [
        localReview,
        ...history.filter((entry) => entry.id !== savedId),
      ].slice(0, 12);
      localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(local));
      setHistory(local);
      setReview(payload.review);
      setReviewId(savedId);
      setChat([
        {
          role: "Assistant",
          text: "Review complete. Ask about a finding, secure implementation, test plan, or the best next step.",
        },
      ]);
      loadHistory();
    } catch (err) {
      setError(err.message || "Could not reach the AI service.");
    } finally {
      setReviewLoading(false);
    }
  }
  async function ask(event) {
    event.preventDefault();
    if (!question.trim()) return;
    const prompt = question;
    setQuestion("");
    setAsking(true);
    const newChat = [...chat, { role: "You", text: prompt }];
    setChat(newChat);
    try {
      const response = await fetch(`${AI_BASE}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: prompt,
          review_id: reviewId,
          review_findings: allFindings,
          chat_history: newChat.map((item) => ({
            role: item.role.toLowerCase(),
            text: item.text,
          })),
        }),
      });
      if (!response.ok)
        throw new Error(await responseError(response, "Assistant"));
      const payload = await response.json();
      setChat((items) => [
        ...items,
        {
          role: "Assistant",
          text: payload.answer,
          citations: payload.citations || [],
        },
      ]);
    } catch (err) {
      setChat((items) => [
        ...items,
        { role: "Assistant", text: err.message || "Assistant unavailable." },
      ]);
    } finally {
      setAsking(false);
    }
  }
  async function exportReport(type) {
    if (!review) return;
    try {
      const response = await fetch(`${AI_BASE}/reports/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review,
          file_name: fileName,
          language: review.detected_language || detectedLanguage,
        }),
      });
      if (!response.ok)
        throw new Error(await responseError(response, "Report generator"));
      download(await response.blob(), `code-review-report.${type}`);
    } catch (err) {
      setError(err.message || "Report generation failed.");
    }
  }
  function restoreReview(saved) {
    if (!saved.review || !saved.code) return;
    setCode(saved.code);
    setFileName(saved.fileName || "Submission");
    setResult({
      submissionId: saved.id,
      fileName: saved.fileName,
      language: saved.language,
      code: saved.code,
      valid: true,
      errors: [],
    });
    setReview(saved.review);
    setReviewId(saved.id);
    setChat([
      {
        role: "Assistant",
        text: `Restored ${saved.fileName}. What would you like to know about this review?`,
      },
    ]);
    setHistoryOpen(false);
    setError("");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">âŒ</span>
          <div>
            <p className="eyebrow">AI Code Review Â· Security Intelligence</p>
            <h1>Build safer software, before it ships.</h1>
            <p className="hero-copy">
              Paste code, get explainable findings, then work with an AI
              security copilot.
            </p>
          </div>
        </div>
        <div className="top-actions">
          <span
            className={`service-pill ${aiStatus?.status === "unavailable" ? "offline" : ""}`}
          >
            <i />
            {aiStatus?.status === "unavailable"
              ? "Assistant offline"
              : `AI ready${aiStatus?.llm_provider ? ` Â· ${aiStatus.llm_provider}` : ""}`}
          </span>
          <button
            className="history-toggle"
            onClick={() => setHistoryOpen(true)}
          >
            Review history <span>{history.length}</span>
          </button>
          <button
            className="logout-btn"
            onClick={() => (logout(), window.location.reload())}
          >
            Sign out
          </button>
        </div>
      </header>
      <section className="command-bar">
        <span>Try a vulnerable example:</span>
        <button onClick={() => useSample("java")}>Java sample</button>
        <button onClick={() => useSample("python")}>Python sample</button>
        <span className="command-note">
          Language is detected automatically from source code.
        </span>
      </section>
      <section className="workspace">
        <section className="submission-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">01 Â· Source input</p>
              <h2>Code workspace</h2>
            </div>
            <div className="segmented">
              <button
                className={mode === "paste" ? "active" : ""}
                type="button"
                onClick={() => setMode("paste")}
              >
                Paste code
              </button>
              <button
                className={mode === "upload" ? "active" : ""}
                type="button"
                onClick={() => setMode("upload")}
              >
                Upload file
              </button>
            </div>
          </div>
          {mode === "paste" ? (
            <form className="submission-form" onSubmit={paste}>
              <div className="editor-toolbar">
                <span className={`language-chip ${detectedLanguage}`}>
                  {detectedLanguage === "python"
                    ? "Py"
                    : detectedLanguage === "java"
                      ? "Ja"
                      : "??"}{" "}
                  {displayLanguage(detectedLanguage)}
                </span>
                <span>{stats.lines} lines</span>
                <span>{stats.chars.toLocaleString()} characters</span>
                <button type="button" onClick={clearEditor}>
                  Clear
                </button>
              </div>
              <label>
                File name{" "}
                <input
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="Filename is optional"
                />
              </label>
              <label className="editor-label">
                Source code{" "}
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  spellCheck="false"
                  placeholder="Paste Java or Python code hereâ€¦"
                />
              </label>
              <button
                className="primary-action"
                disabled={loading || !code.trim()}
              >
                {loading ? "Detecting and validatingâ€¦" : "Validate code"}
              </button>
            </form>
          ) : (
            <form className="submission-form" onSubmit={upload}>
              <label className="file-picker">
                <span className="upload-icon">â†‘</span>
                <strong>
                  {file ? file.name : "Choose a Java or Python source file"}
                </strong>
                <small>
                  Supported formats: .java and .py Â· Language is detected
                  automatically
                </small>
                <input
                  type="file"
                  accept=".java,.py"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
              <button className="primary-action" disabled={loading}>
                {loading ? "Uploading and validatingâ€¦" : "Upload and validate"}
              </button>
            </form>
          )}
          {error && <p className="error-banner">{error}</p>}
        </section>
        <section className="result-panel">
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">02 Â· Review center</p>
              <h2>{result ? result.fileName : "Ready when you are"}</h2>
            </div>
            <div className={`result-badge ${result?.valid ? "valid" : ""}`}>
              {result
                ? result.valid
                  ? "Validated"
                  : "Needs attention"
                : "Waiting"}
            </div>
          </div>
          <div className="review-command">
            <div>
              <span className="language-chip mini">
                {displayLanguage(result?.language || detectedLanguage)}
              </span>
              <p>
                {result?.valid
                  ? "Validation passed. Start the multi-agent review."
                  : "Validate code to unlock the security review."}
              </p>
            </div>
            <button
              className="secondary-action"
              onClick={runReview}
              disabled={reviewLoading || !result?.valid}
            >
              {reviewLoading ? "Agents are reviewingâ€¦" : "Run AI review â†’"}
            </button>
          </div>
          {result?.errors?.length > 0 && (
            <ul className="messages">
              {result.errors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {result?.detectedRisks?.length > 0 && (
            <div className="preflight">
              <strong>Fast pre-flight signals</strong>
              {result.detectedRisks.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          )}
          {review ? (
            <section className="review-results">
              <section className="agent-pipeline" aria-label="Multi-agent pipeline">
                <div className="agent-step">
                  <span>01</span><div><strong>Code Analysis Agent</strong><small>{review.code_quality?.length || 0} quality issue(s) found</small></div>
                </div>
                <div className="agent-step">
                  <span>02</span><div><strong>Security Agent</strong><small>{review.findings?.length || 0} OWASP risk(s) found</small></div>
                </div>
                <div className="agent-step">
                  <span>03</span><div><strong>Remediation Agent</strong><small>{review.remediations?.length || 0} safe fix(es) prepared</small></div>
                </div>
                <div className="agent-step">
                  <span>04</span><div><strong>PR Summary Agent</strong><small>Merge guidance generated</small></div>
                </div>
              </section>
              <div className="summary-and-radar">
                <div className="summary-card">
                  <div className="summary-header">
                    <div>
                      <p className="eyebrow">04 Â· PR Summary Agent</p>
                      <h3>
                        {summaryData?.executive_overview || "Review complete"}
                      </h3>
                    </div>
                    <div
                      className={`health-score ${healthScore >= 80 ? "good" : healthScore >= 60 ? "warning" : "danger"}`}
                    >
                      <span>{healthScore}</span>
                      <small>health</small>
                    </div>
                  </div>
                  <div className="health-bar">
                    <span style={{ width: `${healthScore}%` }} />
                  </div>
                  {summaryData?.prioritized_fixes?.length > 0 && (
                    <ol className="priority-list">
                      {summaryData.prioritized_fixes.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ol>
                  )}
                  {review.llm_notes && (
                    <p className="llm-notes">{review.llm_notes}</p>
                  )}
                </div>
                <RiskRadar review={review} />
              </div>
              <div className="severity-graph">
                {Object.entries(review.severity_breakdown || {}).map(
                  ([level, count]) => (
                    <button
                      className={`severity-bar ${level} ${filter === level ? "selected" : ""}`}
                      key={level}
                      onClick={() =>
                        setFilter(filter === level ? "all" : level)
                      }
                    >
                      <span className="label">{level}</span>
                      <strong>{count}</strong>
                      <small>view findings</small>
                    </button>
                  ),
                )}
              </div>
              <div className="findings">
                <div className="section-title">
                  <div>
                    <p className="eyebrow">Evidence and fixes</p>
                    <h3>
                      {findings.length} finding
                      {findings.length === 1 ? "" : "s"}
                    </h3>
                  </div>
                  <button
                    className="filter-reset"
                    onClick={() => setFilter("all")}
                  >
                    Show all
                  </button>
                </div>
                {findings.map((item) => (
                  <article className={`finding ${item.severity}`} key={item.id}>
                    <div className="finding-heading">
                      <span className="finding-id">{item.id}</span>
                      <strong>{item.title}</strong>
                      <span className="line">
                        {item.line
                          ? `Line ${item.line}`
                          : item.owasp || "Review finding"}
                      </span>
                    </div>
                    <p>{item.explanation}</p>
                    <code>{item.evidence}</code>
                    <p className="recommendation">
                      <b>Safe next step</b>
                      {item.recommendation}
                    </p>
                    {review.remediations
                      ?.filter((fix) => fix.finding_id === item.id)
                      .map((fix) => (
                        <pre className="fix" key={fix.finding_id}>
                          {fix.after_code}
                        </pre>
                      ))}
                  </article>
                ))}
                {findings.length === 0 && (
                  <p className="empty-state">No findings match this filter.</p>
                )}
              </div>
              <section className="remediation-roadmap">
                <div className="section-title">
                  <div><p className="eyebrow">03 Â· Remediation Agent</p><h3>Safe-fix roadmap</h3></div>
                  <span>{review.remediations?.length || 0} corrected examples</span>
                </div>
                {review.remediations?.length ? review.remediations.map((fix, index) => (
                  <article className="remediation-card" key={`${fix.finding_id}-${index}`}>
                    <div><span>{fix.finding_id}</span><strong>{fix.title}</strong></div>
                    <p>{fix.explanation}</p>
                    {fix.before_code && <details><summary>Show vulnerable code</summary><pre>{fix.before_code}</pre></details>}
                    <pre className="safe-code">{fix.after_code}</pre>
                  </article>
                )) : <p className="empty-state">No code changes are needed for this review.</p>}
              </section>
              <section className="assistant">
                <div className="assistant-title">
                  <div>
                    <p className="eyebrow">03 Â· Review copilot</p>
                    <h3>Ask the security assistant</h3>
                  </div>
                  <span
                    className={`online-dot ${aiStatus?.status === "unavailable" ? "offline" : ""}`}
                  >
                    {aiStatus?.status === "unavailable"
                      ? "Offline"
                      : "Connected"}
                  </span>
                </div>
                <p className="assistant-copy">
                  Use it for explanations, safer code patterns, test ideas, and
                  prioritized fixes.
                </p>
                <div className="prompt-chips">
                  {suggestedQuestions.map((prompt) => (
                    <button
                      type="button"
                      key={prompt}
                      onClick={() => setQuestion(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
                <div className="chat-log">
                  {chat.map((item, index) => (
                    <div
                      className={`chat-message ${item.role.toLowerCase()}`}
                      key={index}
                    >
                      <b>{item.role}</b>
                      <p>{item.text}</p>
                      {item.citations?.map((citation) => (
                        <small key={citation.id}>{citation.source}</small>
                      ))}
                    </div>
                  ))}
                  {asking && (
                    <div className="chat-message assistant typing">
                      <b>Assistant</b>
                      <p>Checking your review and secure-coding knowledgeâ€¦</p>
                    </div>
                  )}
                </div>
                <form onSubmit={ask}>
                  <input
                    placeholder="Ask about a finding or secure implementationâ€¦"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                  />
                  <button disabled={asking}>
                    {asking ? "Thinkingâ€¦" : "Send"}
                  </button>
                </form>
              </section>
              <section className="report-handoff">
                <div><p className="eyebrow">Final step</p><h3>Download your review report</h3><p>Export the PR summary, radar profile, findings, and remediation roadmap.</p></div>
                <div className="export-row"><button onClick={() => exportReport("html")}>Download HTML report</button><button onClick={() => exportReport("pdf")}>Download PDF report</button></div>
              </section>
            </section>
          ) : (
            <div className="empty-review">
              <span>âœ¦</span>
              <h3>Your review results will appear here</h3>
              <p>
                Validate source code first. Then the independent quality and
                security agents will analyze it in parallel.
              </p>
            </div>
          )}
        </section>
      </section>
      {historyOpen && (
        <div className="history-backdrop" onClick={() => setHistoryOpen(false)}>
          <aside
            className="history-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="history-drawer-head">
              <div>
                <p className="eyebrow">Persistent workspace</p>
                <h2>Review history</h2>
              </div>
              <button onClick={() => setHistoryOpen(false)}>Ã—</button>
            </div>
            <p>Recent reviews are saved in MySQL and this browser.</p>
            <div className="history-list">
              {history.length ? (
                history.map((saved) => (
                  <button
                    key={saved.id}
                    className="history-item"
                    onClick={() => restoreReview(saved)}
                  >
                    <span className="history-icon">
                      {saved.language === "python" ? "Py" : "Ja"}
                    </span>
                    <span>
                      <b>{saved.fileName}</b>
                      <small>
                        {saved.createdAt
                          ? new Date(saved.createdAt).toLocaleString()
                          : "Saved review"}
                      </small>
                    </span>
                    <em>Open</em>
                  </button>
                ))
              ) : (
                <p className="history-empty">
                  Run a review and it will appear here.
                </p>
              )}
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}

async function responseError(response, service) {
  const body = await response.text();
  try {
    const parsed = JSON.parse(body);
    return (
      parsed.message ||
      parsed.detail ||
      parsed.error ||
      `${service} returned ${response.status}`
    );
  } catch {
    return `${service} returned ${response.status}${body ? `: ${body.slice(0, 160)}` : ""}`;
  }
}

