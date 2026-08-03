import React, { useEffect, useMemo, useState } from "react";
import { fetchJson, apiUrl } from "../../utils/api";

const REVIEW_STATUS_OPTIONS = [
  { value: "unreviewed", label: "Unreviewed" },
  { value: "flagged", label: "Flagged" },
  { value: "approved_correction", label: "Approved Correction" },
  { value: "dismissed", label: "Dismissed" },
];

const ISSUE_TYPE_OPTIONS = [
  { value: "", label: "No Issue Type" },
  { value: "wrong_answer", label: "Wrong Answer" },
  { value: "wrong_route", label: "Wrong Route" },
  { value: "hallucination", label: "Hallucination" },
  { value: "weak_answer", label: "Weak Answer" },
  { value: "bad_tone", label: "Bad Tone" },
  { value: "verifier_miss", label: "Verifier Miss" },
  { value: "other", label: "Other" },
];

function formatTime(value) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function getEventLocation(event = {}) {
  const context = event.request_context || event.requestContext || {};
  const portal = context.currentPortal || context.current_portal;
  const mesh = context.currentMesh || context.current_mesh;
  const stage = context.currentMeshStage || context.current_mesh_stage;
  const location = [portal, mesh, stage].filter(Boolean).join(" / ");

  return location || "Unknown location";
}

function getEventGeoLocation(event = {}) {
  const context = event.request_context || event.requestContext || {};
  const geo = context.geo || context.geolocation || {};
  return geo.label || [geo.city, geo.region, geo.country].filter(Boolean).join(", ") || "Unknown visitor location";
}

function truncate(value = "", limit = 140) {
  const text = String(value || "").trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
}

const VOICE_MAXX_SWEEP_PREFIX = "voice-maxx-100-";

function getVoiceMaxxSweepId(event = {}) {
  const sessionKey = String(event.session_key || event.sessionKey || "").trim();
  return sessionKey.startsWith(VOICE_MAXX_SWEEP_PREFIX) ? sessionKey : null;
}

function DashboardVoiceMaxxSweep({ events, selectedRun, onSelectRun, storage }) {
  const runs = useMemo(() => {
    const grouped = new Map();
    for (const event of events) {
      const id = getVoiceMaxxSweepId(event);
      if (!id) continue;
      const current = grouped.get(id) || { id, total: 0, failed: 0, corrected: 0 };
      current.total += 1;
      if (didFailAfterRelease(event)) current.failed += 1;
      if (wasCorrected(event)) current.corrected += 1;
      grouped.set(id, current);
    }
    return [...grouped.values()];
  }, [events]);

  if (!runs.length) return null;

  const latest = runs[0];
  const active = runs.find((run) => run.id === selectedRun) || latest;

  return (
    <section className="joz-dashboard-test-run" aria-label="Voice MAXX 100 question sweep">
      <div>
        <div className="joz-dashboard-label">Local Voice MAXX test</div>
        <h2>100 short questions</h2>
        <p>
          Typos, abstract world-model questions, vague prompts, booking requests, and playful pushback are stored as individual backend runs.
        </p>
      </div>
      <div className="joz-dashboard-test-run-stats">
        <span><strong>{active.total}</strong>/100 stored</span>
        <span><strong>{active.failed}</strong> failed final checks</span>
        <span><strong>{active.corrected}</strong> corrected</span>
        <span>{storage === "database" ? "Supabase" : "local memory"}</span>
      </div>
      <button
        type="button"
        className="joz-dashboard-test-run-button"
        onClick={() => onSelectRun(selectedRun === active.id ? "all" : active.id)}
      >
        {selectedRun === active.id ? "Show all runs" : "Show these 100"}
      </button>
    </section>
  );
}

function summarizeCheckFailures(stage = {}) {
  const checks = Array.isArray(stage?.verificationChecks)
    ? stage.verificationChecks
    : [];
  return checks.filter((check) => check?.status === "fail");
}

function getStageLabel(stageKey = "") {
  switch (stageKey) {
    case "initial":
      return "Pre-Answer Draft";
    case "retry":
      return "Verified Repair";
    case "fallback":
      return "Fallback Guard";
    case "final":
      return "Final Answer";
    default:
      return stageKey;
  }
}

function getReviewStatusLabel(value = "") {
  return (
    REVIEW_STATUS_OPTIONS.find((option) => option.value === value)?.label ||
    "Unreviewed"
  );
}

function getIssueTypeLabel(value = "") {
  return (
    ISSUE_TYPE_OPTIONS.find((option) => option.value === value)?.label ||
    "None"
  );
}

function didFailBeforeRelease(event = {}) {
  const flow =
    event.verification_flow ||
    event.verificationFlow ||
    event?.trace?.verification_flow ||
    event?.trace?.verificationFlow ||
    {};
  return String(flow?.initial?.verificationStatus || "").toLowerCase() === "fail";
}

function didFailAfterRelease(event = {}) {
  const flow = event.verification_flow || event.verificationFlow || {};
  return (
    String(flow?.final?.verificationStatus || "").toLowerCase() === "fail" ||
    String(event.response_status || event.responseStatus || "").toLowerCase() ===
      "verification_failed"
  );
}

function wasCorrected(event = {}) {
  const flow = event.verification_flow || event.verificationFlow || {};
  return Boolean(flow?.corrected);
}

function getAudienceProfile(event = {}) {
  return (
    event?.trace?.audienceProfile ||
    event?.trace?.audience_profile ||
    event?.audienceProfile ||
    event?.audience_profile ||
    null
  );
}

function getAudiencePersona(event = {}) {
  return getAudienceProfile(event)?.persona || {};
}

function getAiKnowledge(event = {}) {
  return getAudienceProfile(event)?.aiKnowledge || getAudienceProfile(event)?.ai_knowledge || {};
}

function formatAudienceScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? `${Math.round(score * 100)}%` : "—";
}

function titleCase(value = "") {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function DashboardAudienceBadges({ event }) {
  const persona = getAudiencePersona(event);
  const knowledge = getAiKnowledge(event);

  return (
    <div className="joz-dashboard-audience-badges" aria-label="Audience classification">
      <span className="joz-dashboard-audience-pill is-persona">
        {persona.label || titleCase(persona.id || "Unknown persona")} · {formatAudienceScore(persona.confidence)}
      </span>
      <span className="joz-dashboard-audience-pill is-knowledge">
        AI: {knowledge.label || titleCase(knowledge.id || "Unknown level")} · {formatAudienceScore(knowledge.confidence)}
      </span>
    </div>
  );
}

function DashboardBarChart({ title, items, emptyLabel = "No classified runs yet." }) {
  const maxCount = Math.max(1, ...items.map((item) => item.count));

  return (
    <section className="joz-dashboard-chart">
      <div className="joz-dashboard-chart-header">
        <h3>{title}</h3>
        <span>{items.reduce((total, item) => total + item.count, 0)} runs</span>
      </div>
      {items.length ? (
        <div className="joz-dashboard-chart-bars">
          {items.map((item) => (
            <div className="joz-dashboard-chart-row" key={item.id}>
              <div className="joz-dashboard-chart-label">
                <span>{item.label}</span>
                <strong>{item.count}</strong>
              </div>
              <div className="joz-dashboard-chart-track">
                <span style={{ width: `${Math.max(5, (item.count / maxCount) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="joz-dashboard-chart-empty">{emptyLabel}</div>
      )}
    </section>
  );
}

function DashboardAudienceCharts({ events }) {
  const chartData = useMemo(() => {
    const personas = new Map();
    const knowledge = new Map();

    for (const event of events) {
      const persona = getAudiencePersona(event);
      const aiKnowledge = getAiKnowledge(event);
      if (persona.id) {
        const current = personas.get(persona.id) || { id: persona.id, label: persona.label || titleCase(persona.id), count: 0 };
        current.count += 1;
        personas.set(persona.id, current);
      }
      if (aiKnowledge.id) {
        const current = knowledge.get(aiKnowledge.id) || { id: aiKnowledge.id, label: aiKnowledge.label || titleCase(aiKnowledge.id), count: 0 };
        current.count += 1;
        knowledge.set(aiKnowledge.id, current);
      }
    }

    return {
      personas: [...personas.values()].sort((left, right) => right.count - left.count),
      knowledge: [...knowledge.values()].sort((left, right) => right.count - left.count),
    };
  }, [events]);

  return (
    <section className="joz-dashboard-charts" aria-label="Audience analytics">
      <DashboardBarChart title="Who is asking?" items={chartData.personas} />
      <DashboardBarChart title="AI knowledge level" items={chartData.knowledge} />
    </section>
  );
}

function getEvaluationForEvent(evaluations = [], event = {}) {
  return evaluations.find(
    (evaluation) => String(evaluation.request_event_id) === String(event.id)
  ) || null;
}

function DashboardEvaluationBadge({ evaluation }) {
  if (!evaluation) return null;
  return (
    <span className={`joz-dashboard-evaluation-badge is-${evaluation.verdict || "warn"}`}>
      AI judge: {evaluation.verdict || "warn"}
    </span>
  );
}

function DashboardEvaluationPanel({
  evaluation,
  repairCandidates = [],
  onRepairAction,
  repairActionSaving,
}) {
  if (!evaluation) {
    return (
      <section className="joz-dashboard-evaluation is-empty">
        <div className="joz-dashboard-label">OpenAI evaluation</div>
        <p>No model evaluation is linked to this run yet.</p>
      </section>
    );
  }

  const repair = repairCandidates.find(
    (candidate) => String(candidate.request_event_id) === String(evaluation.request_event_id)
  );
  const scores = [
    ["Correctness", evaluation.correctness],
    ["Relevance", evaluation.relevance],
    ["Groundedness", evaluation.groundedness],
    ["Safety", evaluation.safety],
  ];

  return (
    <section className="joz-dashboard-evaluation">
      <div className="joz-dashboard-review-header">
        <div>
          <div className="joz-dashboard-label">OpenAI evaluation</div>
          <h3>
            {evaluation.verdict || "warn"} · {evaluation.evaluator_model || "evaluator"}
          </h3>
        </div>
        {repair ? (
          <span className={`joz-dashboard-pill is-${repair.status || "neutral"}`}>
            repair: {repair.status || "pending"}
          </span>
        ) : null}
      </div>
      <div className="joz-dashboard-evaluation-scores">
        {scores.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value == null ? "—" : `${value}/5`}</strong>
          </div>
        ))}
      </div>
      {evaluation.pre_answer_verdict ? (
        <div className="joz-dashboard-evaluation-compare">
          <span>Pre-answer: {evaluation.pre_answer_verdict}</span>
          <span>Final: {evaluation.final_verdict || evaluation.verdict}</span>
          <span>
            Correction: {evaluation.correction_effective == null
              ? "not assessed"
              : evaluation.correction_effective
                ? "effective"
                : "not effective"}
          </span>
        </div>
      ) : null}
      <p className="joz-dashboard-stage-copy">{evaluation.critique || "No critique recorded."}</p>
      {repair ? (
        <div className="joz-dashboard-repair-copy">
          <strong>Suggested repair</strong>
          <span>{repair.proposed_change}</span>
          {repair.status === "pending" && onRepairAction ? (
            <div className="joz-dashboard-review-actions">
              <button
                type="button"
                className="joz-dashboard-save"
                disabled={repairActionSaving}
                onClick={() => onRepairAction(repair, "approve")}
              >
                {repairActionSaving ? "Running regression..." : "Approve after regression"}
              </button>
              <button
                type="button"
                className="joz-dashboard-reset"
                disabled={repairActionSaving}
                onClick={() => onRepairAction(repair, "reject")}
              >
                Reject
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function DashboardStage({ stageKey, stage }) {
  if (!stage || !stage.reply) return null;

  const failures = summarizeCheckFailures(stage);

  return (
    <section className="joz-dashboard-stage">
      <div className="joz-dashboard-stage-header">
        <h4>{getStageLabel(stageKey)}</h4>
        <div className="joz-dashboard-stage-meta">
          <span className={`joz-dashboard-pill is-${String(stage?.verificationStatus || "unknown").toLowerCase()}`}>
            {stage?.verificationStatus || "unknown"}
          </span>
          <span>{stage?.subIntent || "unknown"}</span>
        </div>
      </div>
      <p className="joz-dashboard-stage-copy">{stage.reply}</p>
      {failures.length ? (
        <div className="joz-dashboard-stage-failures">
          {failures.map((check) => (
            <div key={`${stageKey}-${check.id}`} className="joz-dashboard-check is-fail">
              <strong>{check.id}</strong>
              <span>{check.detail}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DashboardRunDetail({
  event,
  evaluation,
  repairCandidates,
  reviewForm,
  onReviewChange,
  onReviewSave,
  reviewSaving,
  reviewMessage,
  onRepairAction,
  repairActionSaving,
}) {
  if (!event) {
    return (
      <div className="joz-dashboard-empty">
        Select a run to inspect the question, pre-answer draft, and verified final answer.
      </div>
    );
  }

  const flow = event.verification_flow || event.verificationFlow || {};
  const correctionStrategy =
    event?.verification_recovery?.strategy ||
    event?.verificationRecovery?.strategy ||
    null;
  const persona = getAudiencePersona(event);
  const aiKnowledge = getAiKnowledge(event);

  return (
    <div className="joz-dashboard-detail">
      <div className="joz-dashboard-detail-top">
        <div>
          <div className="joz-dashboard-label">Question</div>
          <h2>{event.user_message || event.userMessage}</h2>
          <p className="joz-dashboard-question">
            {event.user_message || event.userMessage}
          </p>
          <DashboardAudienceBadges event={event} />
        </div>
        <div className="joz-dashboard-detail-stats">
          <div className="joz-dashboard-statline">
            <span>Route</span>
            <strong>{event.route || event?.trace?.selectedRoute || "unknown"}</strong>
          </div>
          <div className="joz-dashboard-statline">
            <span>Subintent</span>
            <strong>{event?.trace?.detectedSubIntent || flow?.final?.subIntent || "unknown"}</strong>
          </div>
          <div className="joz-dashboard-statline">
            <span>Latency</span>
            <strong>{event.latency_ms || event.latencyMs || 0}ms</strong>
          </div>
          <div className="joz-dashboard-statline">
            <span>Correction</span>
            <strong>{flow?.corrected ? correctionStrategy || "yes" : "no"}</strong>
          </div>
          <div className="joz-dashboard-statline">
            <span>Review</span>
            <strong>{getReviewStatusLabel(event.review_status || "unreviewed")}</strong>
          </div>
          <div className="joz-dashboard-statline">
            <span>Audience</span>
            <strong>{persona.label || titleCase(persona.id || "unknown")}</strong>
          </div>
          <div className="joz-dashboard-statline">
            <span>AI level</span>
            <strong>{aiKnowledge.label || titleCase(aiKnowledge.id || "unknown")}</strong>
          </div>
        </div>
      </div>

      <div className="joz-dashboard-flow-grid">
        <DashboardStage stageKey="initial" stage={flow.initial} />
        <DashboardStage stageKey="retry" stage={flow.retry} />
        <DashboardStage stageKey="fallback" stage={flow.fallback} />
        <DashboardStage stageKey="final" stage={flow.final} />
      </div>

      <section className="joz-dashboard-metadata">
        <div className="joz-dashboard-metadata-block">
          <div className="joz-dashboard-label">Final Answer Served</div>
          <p className="joz-dashboard-stage-copy">
            {event.assistant_reply || event.assistantReply}
          </p>
        </div>
        <div className="joz-dashboard-metadata-grid">
          <div>
            <div className="joz-dashboard-label">Asked at</div>
            <div>{formatTime(event.created_at || event.createdAt)}</div>
          </div>
          <div>
            <div className="joz-dashboard-label">Location</div>
            <div>{getEventLocation(event)}</div>
          </div>
          <div>
            <div className="joz-dashboard-label">Approx. visitor location</div>
            <div>{getEventGeoLocation(event)}</div>
          </div>
          <div>
            <div className="joz-dashboard-label">Conversation</div>
            <div>{event.conversation_id || event.conversationId || "none"}</div>
          </div>
          <div>
            <div className="joz-dashboard-label">Session</div>
            <div>{event.session_key || event.sessionKey || "none"}</div>
          </div>
          <div>
            <div className="joz-dashboard-label">Storage Status</div>
            <div>{event.response_status || event.responseStatus || "ok"}</div>
          </div>
          <div>
            <div className="joz-dashboard-label">Issue Type</div>
            <div>{getIssueTypeLabel(event.issue_type || "")}</div>
          </div>
          <div>
            <div className="joz-dashboard-label">Audience confidence</div>
            <div>{formatAudienceScore(persona.confidence)}</div>
          </div>
          <div>
            <div className="joz-dashboard-label">AI-level confidence</div>
            <div>{formatAudienceScore(aiKnowledge.confidence)}</div>
          </div>
        </div>
      </section>

      <DashboardEvaluationPanel
        evaluation={evaluation}
        repairCandidates={repairCandidates}
        onRepairAction={onRepairAction}
        repairActionSaving={repairActionSaving}
      />

      <section className="joz-dashboard-review">
        <div className="joz-dashboard-review-header">
          <div>
            <div className="joz-dashboard-label">Manual Review</div>
            <h3>Flag this run and save an approved correction</h3>
          </div>
          {reviewMessage ? <div className="joz-dashboard-review-message">{reviewMessage}</div> : null}
        </div>
        <div className="joz-dashboard-review-grid">
          <select
            className="joz-dashboard-select"
            value={reviewForm.reviewStatus}
            onChange={(nextEvent) => onReviewChange("reviewStatus", nextEvent.target.value)}
          >
            {REVIEW_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="joz-dashboard-select"
            value={reviewForm.issueType}
            onChange={(nextEvent) => onReviewChange("issueType", nextEvent.target.value)}
          >
            {ISSUE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <textarea
          className="joz-dashboard-textarea"
          value={reviewForm.reviewNotes}
          onChange={(nextEvent) => onReviewChange("reviewNotes", nextEvent.target.value)}
          placeholder="Why is this run bad, weak, or worth learning from?"
        />
        <textarea
          className="joz-dashboard-textarea is-large"
          value={reviewForm.approvedCorrection}
          onChange={(nextEvent) => onReviewChange("approvedCorrection", nextEvent.target.value)}
          placeholder="Approved correction to reuse for future similar questions"
        />
        <div className="joz-dashboard-review-actions">
          <button
            type="button"
            className="joz-dashboard-save"
            onClick={onReviewSave}
            disabled={reviewSaving}
          >
            {reviewSaving ? "Saving..." : "Save Review"}
          </button>
        </div>
      </section>
    </div>
  );
}

export function JozLlmDashboardPage() {
  const [events, setEvents] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [repairCandidates, setRepairCandidates] = useState([]);
  const [storage, setStorage] = useState("unknown");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    reviewStatus: "unreviewed",
    issueType: "",
    reviewNotes: "",
    approvedCorrection: "",
  });
  const [reviewSaving, setReviewSaving] = useState(false);
  const [repairActionSaving, setRepairActionSaving] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [query, setQuery] = useState("");
  const [routeFilter, setRouteFilter] = useState("all");
  const [personaFilter, setPersonaFilter] = useState("all");
  const [knowledgeFilter, setKnowledgeFilter] = useState("all");
  const [correctedOnly, setCorrectedOnly] = useState(false);
  const [failedFirstOnly, setFailedFirstOnly] = useState(false);
  const [testRunFilter, setTestRunFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;

    async function load({ silent = false } = {}) {
      try {
        if (!silent) {
          setRefreshing(true);
        }
        setError("");
        const [payload, evaluationPayload, repairPayload] = await Promise.all([
          fetchJson(apiUrl("/api/joz-llm/observability?limit=200")),
          fetchJson(apiUrl("/api/joz-llm/evaluations?limit=100")),
          fetchJson(apiUrl("/api/joz-llm/repair-candidates?limit=100")),
        ]);
        if (cancelled) return;
        const nextEvents = Array.isArray(payload?.events) ? payload.events : [];
        setEvents(nextEvents);
        setEvaluations(Array.isArray(evaluationPayload?.evaluations) ? evaluationPayload.evaluations : []);
        setRepairCandidates(Array.isArray(repairPayload?.repairCandidates) ? repairPayload.repairCandidates : []);
        setStorage(payload?.storage || "unknown");
        setLastRefreshedAt(new Date().toISOString());
        setSelectedId((current) => {
          if (current && nextEvents.some((event) => String(event.id) === String(current))) {
            return current;
          }
          return nextEvents[0]?.id || null;
        });
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError.message || "Failed to load observability events.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    load();
    const intervalId = window.setInterval(() => {
      load({ silent: true });
    }, 5000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        load({ silent: true });
      }
    }

    function handleWindowFocus() {
      load({ silent: true });
    }

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const routeOptions = useMemo(() => {
    return [
      "all",
      ...new Set(events.map((event) => String(event.route || "unknown")).filter(Boolean)),
    ];
  }, [events]);

  const audienceOptions = useMemo(() => {
    const personas = new Map();
    const knowledge = new Map();
    for (const event of events) {
      const persona = getAudiencePersona(event);
      const aiKnowledge = getAiKnowledge(event);
      if (persona.id) personas.set(persona.id, persona.label || titleCase(persona.id));
      if (aiKnowledge.id) knowledge.set(aiKnowledge.id, aiKnowledge.label || titleCase(aiKnowledge.id));
    }
    return {
      personas: [...personas.entries()].sort((left, right) => left[1].localeCompare(right[1])),
      knowledge: [...knowledge.entries()].sort((left, right) => left[1].localeCompare(right[1])),
    };
  }, [events]);

  const testRunOptions = useMemo(() => {
    const counts = new Map();
    for (const event of events) {
      const id = getVoiceMaxxSweepId(event);
      if (id) counts.set(id, (counts.get(id) || 0) + 1);
    }
    return [...counts.entries()].map(([id, count]) => ({ id, count }));
  }, [events]);

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return events.filter((event) => {
      const flow = event.verification_flow || event.verificationFlow || {};
      const initialStatus = String(flow?.initial?.verificationStatus || "").toLowerCase();
      const corrected = Boolean(flow?.corrected);
      const persona = getAudiencePersona(event);
      const aiKnowledge = getAiKnowledge(event);
      const haystack = [
        event.user_message,
        event.assistant_reply,
        event.route,
        event.intent_mode,
        event?.trace?.detectedSubIntent,
        persona.id,
        persona.label,
        aiKnowledge.id,
        aiKnowledge.label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (routeFilter !== "all" && String(event.route || "unknown") !== routeFilter) {
        return false;
      }
      if (personaFilter !== "all" && persona.id !== personaFilter) {
        return false;
      }
      if (knowledgeFilter !== "all" && aiKnowledge.id !== knowledgeFilter) {
        return false;
      }
      if (testRunFilter !== "all" && getVoiceMaxxSweepId(event) !== testRunFilter) {
        return false;
      }
      if (correctedOnly && !corrected) {
        return false;
      }
      if (failedFirstOnly && initialStatus !== "fail") {
        return false;
      }
      if (normalizedQuery && !haystack.includes(normalizedQuery)) {
        return false;
      }
      return true;
    });
  }, [correctedOnly, events, failedFirstOnly, knowledgeFilter, personaFilter, query, routeFilter, testRunFilter]);

  const selectedEvent = useMemo(() => {
    return (
      filteredEvents.find((event) => String(event.id) === String(selectedId)) ||
      filteredEvents[0] ||
      null
    );
  }, [filteredEvents, selectedId]);

  const selectedEvaluation = useMemo(
    () => getEvaluationForEvent(evaluations, selectedEvent),
    [evaluations, selectedEvent]
  );

  useEffect(() => {
    setReviewForm({
      reviewStatus: selectedEvent?.review_status || "unreviewed",
      issueType: selectedEvent?.issue_type || "",
      reviewNotes: selectedEvent?.review_notes || "",
      approvedCorrection: selectedEvent?.approved_correction || "",
    });
    setReviewMessage("");
  }, [selectedEvent]);

  const summary = useMemo(() => {
    const totals = {
      total: filteredEvents.length,
      corrected: 0,
      failedFirst: 0,
      failedFinal: 0,
      flagged: 0,
      evaluated: evaluations.length,
      repairs: repairCandidates.filter((candidate) => candidate.status === "pending").length,
    };

    for (const event of filteredEvents) {
      if (wasCorrected(event)) totals.corrected += 1;
      if (didFailBeforeRelease(event)) totals.failedFirst += 1;
      if (didFailAfterRelease(event)) totals.failedFinal += 1;
      if (String(event.review_status || "unreviewed") !== "unreviewed") totals.flagged += 1;
    }

    return totals;
  }, [evaluations.length, filteredEvents, repairCandidates]);

  async function saveReview() {
    if (!selectedEvent?.id) return;
    setReviewSaving(true);
    setReviewMessage("");
    try {
      const payload = await fetchJson(apiUrl(`/api/joz-llm/observability/${selectedEvent.id}/review`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewStatus: reviewForm.reviewStatus,
          issueType: reviewForm.issueType,
          reviewNotes: reviewForm.reviewNotes,
          approvedCorrection: reviewForm.approvedCorrection,
          reviewedBy: "dashboard",
        }),
      });

      const updated = payload?.event || {};
      setEvents((current) =>
        current.map((event) =>
          String(event.id) === String(selectedEvent.id)
            ? { ...event, ...updated }
            : event
        )
      );
      setReviewMessage("Saved");
    } catch (saveError) {
      setReviewMessage(saveError.message || "Failed to save review");
    } finally {
      setReviewSaving(false);
    }
  }

  async function updateRepairCandidate(candidate, action) {
    if (!candidate?.id) return;
    setRepairActionSaving(true);
    setReviewMessage("");
    try {
      const payload = await fetchJson(apiUrl(`/api/joz-llm/repair-candidates/${candidate.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reviewedBy: "dashboard" }),
      });
      if (payload?.candidate) {
        setRepairCandidates((current) =>
          current.map((item) =>
            String(item.id) === String(payload.candidate.id)
              ? { ...item, ...payload.candidate }
              : item
          )
        );
      }
      setReviewMessage(action === "approve" ? "Approved after golden regression" : "Repair rejected");
    } catch (repairError) {
      setReviewMessage(repairError.message || "Failed to update repair candidate");
    } finally {
      setRepairActionSaving(false);
    }
  }

  return (
    <div className="joz-dashboard-page">
      <header className="joz-dashboard-header">
        <div>
          <div className="joz-dashboard-kicker">Meet Joz Analytics</div>
          <h1>Joz MAXX Review Dashboard</h1>
          <p>
            Review live question routing, pre-answer drafts, verification outcomes, repairs, and final answers.
          </p>
        </div>
        <div className="joz-dashboard-header-meta">
          <span className="joz-dashboard-pill is-neutral">storage: {storage}</span>
          <span className="joz-dashboard-pill is-neutral">runs: {summary.total}</span>
          <span className={`joz-dashboard-pill ${refreshing ? "is-live" : "is-neutral"}`}>
            {refreshing ? "refreshing" : "auto-refresh on"}
          </span>
          <span className="joz-dashboard-refresh-time">
            last update: {lastRefreshedAt ? formatTime(lastRefreshedAt) : "waiting"}
          </span>
        </div>
      </header>

      <section className="joz-dashboard-summary">
        <div className="joz-dashboard-summary-card">
          <span>Total Runs</span>
          <strong>{summary.total}</strong>
        </div>
        <div className="joz-dashboard-summary-card">
          <span>Corrected Before Release</span>
          <strong>{summary.corrected}</strong>
        </div>
        <div className="joz-dashboard-summary-card">
          <span>Failed Before Release</span>
          <strong>{summary.failedFirst}</strong>
        </div>
        <div className="joz-dashboard-summary-card">
          <span>Failed After Release</span>
          <strong>{summary.failedFinal}</strong>
        </div>
        <div className="joz-dashboard-summary-card">
          <span>Manually Flagged</span>
          <strong>{summary.flagged}</strong>
        </div>
        <div className="joz-dashboard-summary-card">
          <span>AI Evaluated</span>
          <strong>{summary.evaluated}</strong>
        </div>
        <div className="joz-dashboard-summary-card">
          <span>Pending Repairs</span>
          <strong>{summary.repairs}</strong>
        </div>
      </section>

      <DashboardAudienceCharts events={filteredEvents} />

      <DashboardVoiceMaxxSweep
        events={events}
        selectedRun={testRunFilter}
        onSelectRun={setTestRunFilter}
        storage={storage}
      />

      <section className="joz-dashboard-toolbar">
        <input
          className="joz-dashboard-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search question, answer, route, or subintent"
        />
        <select
          className="joz-dashboard-select"
          value={routeFilter}
          onChange={(event) => setRouteFilter(event.target.value)}
        >
          {routeOptions.map((route) => (
            <option key={route} value={route}>
              {route}
            </option>
          ))}
        </select>
        {testRunOptions.length ? (
          <select
            className="joz-dashboard-select"
            value={testRunFilter}
            onChange={(event) => setTestRunFilter(event.target.value)}
            aria-label="Filter Voice MAXX 100 test runs"
          >
            <option value="all">All test runs</option>
            {testRunOptions.map(({ id, count }) => (
              <option key={id} value={id}>
                Voice MAXX 100 · {count}/100
              </option>
            ))}
          </select>
        ) : null}
        <select
          className="joz-dashboard-select"
          value={personaFilter}
          onChange={(event) => setPersonaFilter(event.target.value)}
          aria-label="Filter by audience persona"
        >
          <option value="all">All audience types</option>
          {audienceOptions.personas.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="joz-dashboard-select"
          value={knowledgeFilter}
          onChange={(event) => setKnowledgeFilter(event.target.value)}
          aria-label="Filter by AI knowledge level"
        >
          <option value="all">All AI levels</option>
          {audienceOptions.knowledge.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <label className="joz-dashboard-toggle">
          <input
            type="checkbox"
            checked={correctedOnly}
            onChange={(event) => setCorrectedOnly(event.target.checked)}
          />
          <span>Corrected only</span>
        </label>
        <label className="joz-dashboard-toggle">
          <input
            type="checkbox"
            checked={failedFirstOnly}
            onChange={(event) => setFailedFirstOnly(event.target.checked)}
          />
          <span>Failed first check only</span>
        </label>
      </section>

      <section className="joz-dashboard-shell">
        <aside className="joz-dashboard-list">
          <div className="joz-dashboard-list-header">
            <strong>Runs</strong>
            <span>{filteredEvents.length}</span>
          </div>
          {loading ? <div className="joz-dashboard-empty">Loading events…</div> : null}
          {error ? <div className="joz-dashboard-empty is-error">{error}</div> : null}
          {!loading && !error && !filteredEvents.length ? (
            <div className="joz-dashboard-empty">No runs match the current filters.</div>
          ) : null}
          {filteredEvents.map((event) => {
            const flow = event.verification_flow || event.verificationFlow || {};
            const isSelected = String(event.id) === String(selectedEvent?.id);
            const initialStatus = String(flow?.initial?.verificationStatus || "unknown").toLowerCase();
            const finalStatus = String(flow?.final?.verificationStatus || "unknown").toLowerCase();

            return (
              <button
                key={event.id}
                type="button"
                className={`joz-dashboard-run ${isSelected ? "is-selected" : ""}`}
                onClick={() => setSelectedId(event.id)}
              >
                <div className="joz-dashboard-run-top">
                  <span className="joz-dashboard-run-route">{event.route || "unknown"}</span>
                  <div className="joz-dashboard-run-pills">
                    <span className={`joz-dashboard-pill is-${initialStatus}`}>
                      initial {initialStatus}
                    </span>
                    <span className={`joz-dashboard-pill is-${finalStatus}`}>
                      final {finalStatus}
                    </span>
                  </div>
                </div>
                <div className="joz-dashboard-run-question">
                  {truncate(event.user_message || event.userMessage, 110)}
                </div>
                <DashboardEvaluationBadge evaluation={getEvaluationForEvent(evaluations, event)} />
                <DashboardAudienceBadges event={event} />
                <div className="joz-dashboard-run-context">
                  <span>asked {formatTime(event.created_at || event.createdAt)}</span>
                  <span>{getEventLocation(event)}</span>
                </div>
                <div className="joz-dashboard-run-context">
                  <span>visitor: {getEventGeoLocation(event)}</span>
                </div>
                <div className="joz-dashboard-run-bottom">
                  <span>{event?.trace?.detectedSubIntent || flow?.final?.subIntent || "unknown"}</span>
                  <span>
                    {event.review_status && event.review_status !== "unreviewed"
                      ? getReviewStatusLabel(event.review_status)
                      : flow?.corrected
                        ? "corrected"
                        : "unchanged"}
                  </span>
                </div>
              </button>
            );
          })}
        </aside>

        <main className="joz-dashboard-main">
          <DashboardRunDetail
            event={selectedEvent}
            evaluation={selectedEvaluation}
            repairCandidates={repairCandidates}
            reviewForm={reviewForm}
            onReviewChange={(field, value) =>
              setReviewForm((current) => ({ ...current, [field]: value }))
            }
            onReviewSave={saveReview}
            reviewSaving={reviewSaving}
            reviewMessage={reviewMessage}
            onRepairAction={updateRepairCandidate}
            repairActionSaving={repairActionSaving}
          />
        </main>
      </section>
    </div>
  );
}
