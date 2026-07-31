import React, { useEffect, useMemo, useState } from "react";
import { apiFetch, apiUrl } from "../../utils/api";
import { appPath } from "../../utils/paths";
import "./worldModelConsultant.css";

const SESSION_KEY = "meetjoz-consultant-session";
const ASSESSMENT_KEY = "meetjoz-consultant-assessment";

function getSessionKey() {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(SESSION_KEY, created);
  return created;
}

async function request(path, init = {}, sessionKey = "") {
  const headers = {
    "Content-Type": "application/json",
    ...(sessionKey ? { "X-Consultant-Session": sessionKey } : {}),
    ...(init.headers || {}),
  };
  const response = await apiFetch(apiUrl(path), { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function ScoreBar({ value }) {
  return (
    <div className="wmc-score-bar" aria-label={`${Math.round(value * 10)} out of 10`}>
      <span style={{ width: `${Math.max(0, Math.min(100, Number(value || 0) * 10))}%` }} />
    </div>
  );
}

export function WorldModelConsultantPage() {
  const [sessionKey] = useState(getSessionKey);
  const [phase, setPhase] = useState("landing");
  const [assessment, setAssessment] = useState(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [exampleOpen, setExampleOpen] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [lead, setLead] = useState({ name: "", email: "", company: "", role: "", engagement: "World Model Discovery Workshop", message: "" });

  const field = assessment?.nextField;
  const analysis = assessment?.analysis;
  const answerCount = useMemo(() => Math.round((assessment?.progress || 0) / 100 * 8), [assessment]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "World Model Consultant | Meet Joz";
    return () => { document.title = previousTitle; };
  }, []);

  useEffect(() => {
    const assessmentId = window.localStorage.getItem(ASSESSMENT_KEY);
    if (!assessmentId) return undefined;
    let cancelled = false;
    request(`/api/consultant/assessments/${assessmentId}`, {}, sessionKey)
      .then((result) => {
        if (cancelled || !result.assessment) return;
        setAssessment(result.assessment);
        setPhase(result.assessment.analysis ? "result" : "assessment");
      })
      .catch(() => {
        window.localStorage.removeItem(ASSESSMENT_KEY);
      });
    return () => { cancelled = true; };
  }, [sessionKey]);

  useEffect(() => {
    if (assessment?.profile?.companyName && !lead.company) {
      setLead((current) => ({ ...current, company: assessment.profile.companyName }));
    }
  }, [assessment, lead.company]);

  const startAssessment = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await request("/api/consultant/assessments", { method: "POST", body: JSON.stringify({ sessionKey }) }, sessionKey);
      setAssessment(result.assessment);
      window.localStorage.setItem(ASSESSMENT_KEY, result.assessment.id);
      setPhase("assessment");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const submitAnswer = async (event) => {
    event.preventDefault();
    if (!field || !answer.trim()) return;
    setBusy(true);
    setError("");
    try {
      const result = await request(
        `/api/consultant/assessments/${assessment.id}/messages`,
        { method: "POST", body: JSON.stringify({ field: field.key, answer: answer.trim() }) },
        sessionKey,
      );
      setAssessment(result.assessment);
      setAnswer("");
      if (result.assessment.analysis) setPhase("result");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const submitLead = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("/api/consultant/leads", { method: "POST", body: JSON.stringify({ ...lead, assessmentId: assessment.id }) }, sessionKey);
      setLeadSubmitted(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setAssessment(null);
    window.localStorage.removeItem(ASSESSMENT_KEY);
    setPhase("landing");
    setError("");
    setLeadSubmitted(false);
  };

  return (
    <main className="wmc-page">
      <header className="wmc-header">
        <a className="wmc-brand" href={appPath("/")}>JOZ <span>MAXX</span></a>
        <div className="wmc-header-note">WORLD MODEL CONSULTANT <i aria-hidden="true" /></div>
      </header>

      <div className="wmc-shell">
        {phase === "landing" && (
          <section className="wmc-hero">
            <div className="wmc-eyebrow">A structured discovery system by Joz MAXX</div>
            <h1>Model your business<br /><em>before</em> automating it.</h1>
            <p className="wmc-lede">Discover where AI can understand, predict and improve how your organisation operates.</p>
            <div className="wmc-hero-actions">
              <button className="wmc-primary" onClick={startAssessment} disabled={busy}>{busy ? "Opening assessment…" : "Start Free Assessment"}<span>↗</span></button>
              <button className="wmc-secondary" onClick={() => setExampleOpen((open) => !open)}>See Example Report</button>
            </div>
            {exampleOpen && (
              <div className="wmc-example" role="status">
                <div><span className="wmc-label">EXAMPLE PRIORITY PILOT</span><strong>Project Delivery World Model</strong></div>
                <p>Represent projects, tasks, dependencies, teams and releases so delivery interventions can be compared before execution.</p>
                <div className="wmc-example-grid"><span>Decision</span><b>Should we add capacity, reduce scope, or move the deadline?</b><span>Outcome</span><b>Delivery date · cost · defect rate</b></div>
              </div>
            )}
            <div className="wmc-distinction">
              <div><span>01</span><strong>Traditional AI</strong><p>Answers questions.</p></div>
              <div><span>02</span><strong>Agents</strong><p>Execute tasks.</p></div>
              <div><span>03</span><strong>World-model systems</strong><p>Represent state, dependencies, actions and likely outcomes.</p></div>
            </div>
            <div className="wmc-keep">Your assessment is directional and confidential. Do not enter credentials, secrets, or highly sensitive personal data.</div>
          </section>
        )}

        {phase === "assessment" && (
          <section className="wmc-assessment">
            <div className="wmc-assessment-top">
              <div><div className="wmc-eyebrow">DISCOVERY / {String(answerCount + 1).padStart(2, "0")} OF 08</div><h1>Let’s map the operating world.</h1></div>
              <button className="wmc-text-button" onClick={reset}>Exit</button>
            </div>
            <div className="wmc-progress"><span style={{ width: `${assessment.progress}%` }} /></div>
            <div className="wmc-question-card">
              <div className="wmc-question-number">{String(answerCount + 1).padStart(2, "0")}</div>
              <label htmlFor="consultant-answer">{field?.label}</label>
              <p>{field?.hint}</p>
              {field?.type === "textarea" ? <textarea id="consultant-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={field.placeholder} autoFocus rows={5} /> : <input id="consultant-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={field?.placeholder} autoFocus />}
              <button className="wmc-primary" onClick={submitAnswer} disabled={busy || !answer.trim()}>{busy ? "Mapping…" : answerCount === 7 ? "Generate My Assessment" : "Continue"}<span>↗</span></button>
            </div>
            <div className="wmc-assessment-foot"><span>Joz MAXX keeps the conversation focused and skips irrelevant questions.</span><span>{assessment.progress}% mapped</span></div>
          </section>
        )}

        {phase === "result" && analysis && (
          <section className="wmc-result">
            <div className="wmc-result-heading"><div className="wmc-eyebrow">FREE WORLD MODEL OPPORTUNITY ASSESSMENT</div><h1>{analysis.profile.companyName ? `${analysis.profile.companyName} has a world to model.` : "Your operating world has a pattern."}</h1><p>{analysis.disclaimer}</p></div>
            <div className="wmc-result-grid">
              <article className="wmc-panel wmc-maturity"><span className="wmc-label">AI + DATA MATURITY</span><strong>{analysis.maturity.score}<small>/100</small></strong><h3>{analysis.maturity.label}</h3><ul>{analysis.maturity.evidence.map((item) => <li key={item}>{item}</li>)}</ul></article>
              <article className="wmc-panel wmc-priority"><span className="wmc-label">PRIORITY WORLD-MODEL CANDIDATE</span><h2>{analysis.priorityPilot?.title}</h2><p>{analysis.opportunities[0]?.description}</p><div className="wmc-confidence"><span>Confidence {formatPercent(analysis.priorityPilot?.confidence)}</span><ScoreBar value={analysis.priorityPilot?.confidence || 0} /></div><div className="wmc-pilot-line"><b>Why this first</b><span>{analysis.priorityPilot?.whyNow}</span></div></article>
            </div>
            <div className="wmc-section-heading"><div><span className="wmc-label">OPPORTUNITY PORTFOLIO</span><h2>Where prediction could create leverage.</h2></div><span className="wmc-muted">Directional scores / version {analysis.version}</span></div>
            <div className="wmc-opportunity-list">{analysis.opportunities.map((opportunity, index) => <article className="wmc-opportunity" key={opportunity.key}><span className="wmc-opportunity-index">0{index + 1}</span><div><h3>{opportunity.title}</h3><p>{opportunity.description}</p><div className="wmc-tags">{opportunity.worldModelFit.actions.slice(0, 3).map((action) => <span key={action}>{action}</span>)}</div></div><div className="wmc-opportunity-score"><strong>{opportunity.scoreOutOf10}</strong><span>/10</span><ScoreBar value={opportunity.scoreOutOf10} /></div></article>)}</div>
            <div className="wmc-result-bottom"><article className="wmc-panel"><span className="wmc-label">DATA GAPS TO VALIDATE</span><ul>{analysis.dataGaps.map((gap) => <li key={gap}>{gap}</li>)}</ul></article><article className="wmc-panel wmc-next"><span className="wmc-label">RECOMMENDED NEXT STEP</span><p>{analysis.nextStep}</p><div className="wmc-report-lock"><span>FULL BLUEPRINT</span><strong>World Model Opportunity Report — €199</strong><small>Detailed state model, event taxonomy, architecture, roadmap and investment assumptions.</small></div></article></div>
            <div className="wmc-lead-section"><div><span className="wmc-label">CONTINUE WITH JOZ</span><h2>Turn the assessment into a decision-ready pilot.</h2><p>Book a focused strategy session to validate the priority opportunity.</p></div>{leadSubmitted ? <div className="wmc-success"><strong>Enquiry received.</strong><span>Joz will follow up using the details you provided.</span></div> : <form onSubmit={submitLead} className="wmc-lead-form"><input required value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} placeholder="Name" /><input required type="email" value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} placeholder="Work email" /><input value={lead.role} onChange={(e) => setLead({ ...lead, role: e.target.value })} placeholder="Role" /><select value={lead.engagement} onChange={(e) => setLead({ ...lead, engagement: e.target.value })}><option>World Model Discovery Workshop</option><option>Data and Architecture Blueprint</option><option>Pilot Design</option><option>Pilot Implementation</option><option>Fractional AI Architecture Leadership</option></select><textarea value={lead.message} onChange={(e) => setLead({ ...lead, message: e.target.value })} placeholder="What would you like to explore?" rows={3} /><button className="wmc-primary" disabled={busy}>{busy ? "Sending…" : "Book a World Model Strategy Session"}<span>↗</span></button></form>}</div>
            <div className="wmc-result-actions"><a className="wmc-secondary" href={appPath("/")}>Return to Joz MAXX</a><button className="wmc-text-button" onClick={reset}>Start another assessment</button></div>
          </section>
        )}

        {error && <div className="wmc-error" role="alert">{error}</div>}
      </div>
    </main>
  );
}

export default WorldModelConsultantPage;
