import { useEffect, useMemo, useState } from "react";
import { SCENARIOS, TIMELINE, CURRENT_DATE } from "./seedWorld";
import { usePossibleWorldsStore } from "./store";
import { WorldCanvas } from "./WorldCanvas";
import { PossibleWorldsJozChat } from "./PossibleWorldsJozChat";

function percent(value) {
  return `${Math.round(value * 100)}%`;
}

function money(value) {
  return `€${Math.round(value / 1000)}k`;
}

function shortDate(value) {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function Metric({ label, value, note, tone = "neutral" }) {
  return <div className={`pw-metric pw-metric--${tone}`}><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>;
}

function eventLabel(event) {
  if (event.type === "people_hired") return `+${event.payload.count || 1} ${event.payload.role || "engineers"}`;
  if (event.type === "backend_tasks_blocked") return `${event.payload.count || 1} backend tasks blocked`;
  if (event.type === "scope_growth") return `Scope +${event.payload.percentage || 20}%`;
  if (event.type === "people_departed") return "Senior engineer left";
  if (event.type === "release_date_moved") return `Release moved to ${shortDate(event.payload.date)}`;
  return event.type.replaceAll("_", " ");
}

function Timeline({ position, onSelect, events, onSelectEvent, isViewingHistory, onReturnToNow }) {
  return <div className="pw-timeline" aria-label="World timeline">
    <div className="pw-timeline__heading"><span>Past observations</span><span>{isViewingHistory ? "Historical state" : "Current state"}</span><span>Simulated futures</span></div>
    <div className="pw-timeline__rail"><span className="pw-timeline__line" />{TIMELINE.map((item) => <button key={item.id} type="button" className={`pw-timeline__point pw-timeline__point--${item.type} ${position === item.id ? "is-selected" : ""}`} onClick={() => onSelect(item.id)} aria-label={`View ${item.fullDate}`}><i /><span>{item.date}</span></button>)}</div>
    {events.length > 0 && <div className="pw-history"><span className="pw-history__label">World history</span>{events.map((event) => <button key={event.id} type="button" className={`pw-history__event ${position === event.id ? "is-selected" : ""}`} onClick={() => onSelectEvent(event.id)}><i />{eventLabel(event)}<small>{event.stateKind} · {shortDate(event.timestamp)}</small></button>)}</div>}
    {isViewingHistory && <button type="button" className="pw-return-now" onClick={onReturnToNow}>Return to Now</button>}
  </div>;
}

function ScenarioTray({ scenarios, selectedId, onSelect, visible }) {
  if (!visible) return <div className="pw-scenario-tray pw-scenario-tray--empty"><span>Ask a what-if question to split the future into scenario branches.</span></div>;
  return <div className="pw-scenario-tray"><div className="pw-scenario-tray__title"><span>Possible futures</span><small>synthetic demonstration · select a branch</small></div><div className="pw-scenario-tray__cards">{scenarios.map((scenario) => <button key={scenario.scenarioId || scenario.id} type="button" className={`pw-scenario-card ${selectedId === (scenario.scenarioId || scenario.id) ? "is-selected" : ""}`} onClick={() => onSelect(scenario.scenarioId || scenario.id)}><span>{scenario.shortLabel}</span><b>{percent(scenario.metrics?.onTimeProbability ?? scenario.onTimeProbability)}</b><small>on-time</small></button>)}</div></div>;
}

function WorldCommandDock() {
  const pendingCommand = usePossibleWorldsStore((state) => state.pendingCommand);
  const pendingMessage = usePossibleWorldsStore((state) => state.pendingMessage);
  const processSteps = usePossibleWorldsStore((state) => state.processSteps);
  const commitPendingCommand = usePossibleWorldsStore((state) => state.commitPendingCommand);
  const clearPendingCommand = usePossibleWorldsStore((state) => state.clearPendingCommand);
  if (!pendingCommand && !processSteps.length) return null;
  const isSimulation = pendingCommand?.intent === "simulate";
  const isComparison = pendingCommand?.intent === "compare";
  const actionLabel = isSimulation ? "Simulate" : isComparison ? "Compare Futures" : pendingCommand?.intent === "set_objective" ? "Set Goal" : pendingCommand?.intent === "add_constraint" ? "Add Constraint" : pendingCommand?.intent === "explain" ? "Explain" : pendingCommand?.intent === "navigate_timeline" ? "View this moment" : "Apply to World";
  const interpretation = pendingCommand?.event?.type === "scope_growth"
    ? `Observed event · Customer · +${pendingCommand.event.payload.percentage || 20}% scope`
    : pendingCommand?.event?.type === "people_hired"
      ? `Observed event · People · +${pendingCommand.event.payload.count || 1} engineers`
      : pendingCommand?.scenario?.action?.type === "add_contractors"
        ? "Hypothetical action · Add 2 contractors"
        : pendingCommand?.scenario?.action?.type === "reduce_scope"
          ? "Hypothetical action · Reduce scope by 15%"
          : pendingCommand?.intent === "set_objective" ? "Desired future · Release by 15 Sep"
            : pendingCommand?.intent === "add_constraint" ? "Constraint · Additional spend ≤ €40k"
              : pendingCommand?.intent === "navigate_timeline" ? "Historical navigation" : pendingCommand?.intent === "explain" ? "Causal question" : "World update";
  return <div className={`pw-command-dock ${pendingCommand ? "is-pending" : "is-complete"}`} aria-live="polite">
    {pendingCommand ? <>
      <span className="pw-command-dock__eyebrow">Interpreted as</span>
      <strong>{interpretation}</strong>
      <small>{pendingCommand.summary}</small>
      <div className="pw-command-dock__meta">Confidence {percent(pendingCommand.confidence)} · {pendingCommand.assumptions?.[0] || "Seeded Atlas dynamics"}</div>
      <div className="pw-command-dock__actions"><button type="button" onClick={() => commitPendingCommand(isSimulation ? "simulate" : undefined)}>{actionLabel}</button><button type="button" onClick={clearPendingCommand}>Dismiss</button></div>
      {pendingMessage && <span className="pw-command-dock__source">“{pendingMessage}”</span>}
    </> : <><span className="pw-command-dock__eyebrow">World update</span><strong>{processSteps[processSteps.length - 1]}</strong><small>{processSteps.map((step) => `✓ ${step}`).join("  ")}</small></>}
  </div>;
}

export function PossibleWorldsPage() {
  const world = usePossibleWorldsStore((state) => state.world);
  const cameraView = usePossibleWorldsStore((state) => state.cameraView);
  const selectedEntity = usePossibleWorldsStore((state) => state.selectedEntity);
  const focusedEntities = usePossibleWorldsStore((state) => state.focusedEntities);
  const showBranches = usePossibleWorldsStore((state) => state.showBranches);
  const selectedScenarioId = usePossibleWorldsStore((state) => state.selectedScenario);
  const trajectories = usePossibleWorldsStore((state) => state.trajectories);
  const spatialSnapshot = usePossibleWorldsStore((state) => state.spatialSnapshot);
  const objective = usePossibleWorldsStore((state) => state.objective);
  const events = usePossibleWorldsStore((state) => state.events);
  const isViewingHistory = usePossibleWorldsStore((state) => state.isViewingHistory);
  const selectScenario = usePossibleWorldsStore((state) => state.selectScenario);
  const setTimelinePosition = usePossibleWorldsStore((state) => state.setTimelinePosition);
  const selectTimelineEvent = usePossibleWorldsStore((state) => state.selectTimelineEvent);
  const returnToNow = usePossibleWorldsStore((state) => state.returnToNow);
  const timelinePosition = usePossibleWorldsStore((state) => state.timelinePosition);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const selectedScenario = useMemo(() => {
    const trajectory = trajectories.find((scenario) => scenario.scenarioId === selectedScenarioId || scenario.id === selectedScenarioId);
    const seed = SCENARIOS.find((scenario) => scenario.id === selectedScenarioId) || SCENARIOS[0];
    return { ...seed, ...trajectory?.metrics, alignmentScore: trajectory?.alignmentScore, constraintViolations: trajectory?.constraintViolations || [], label: trajectory?.label || seed.label, shortLabel: trajectory?.shortLabel || seed.shortLabel };
  }, [selectedScenarioId, trajectories]);

  useEffect(() => {
    document.title = "Possible Worlds · Project Atlas";
    return () => { document.title = "Joz MAXX"; };
  }, []);

  return <main className="possible-worlds">
    <header className="possible-worlds__topbar">
      <div className="possible-worlds__title"><span className="possible-worlds__eyebrow">JOZ / WORLD MODEL</span><h1>Possible Worlds</h1><p>Describe a decision. See how it reshapes the future.</p></div>
      <div className="possible-worlds__topmeta"><span className="pw-live-dot" /> Live simulation <span className="pw-topmeta__divider" /> <span>Project Atlas</span><span className="pw-topmeta__date">{CURRENT_DATE}</span></div>
    </header>
    <section className="possible-worlds__workspace">
      <PossibleWorldsJozChat />
      <section className="possible-worlds__visual" aria-label="Interactive Project Atlas world model">
        <WorldCanvas view={cameraView} selectedEntity={selectedEntity} focusedEntities={focusedEntities} world={world} spatialSnapshot={spatialSnapshot} showBranches={showBranches} selectedScenario={selectedScenarioId} />
      </section>
    </section>
    <WorldCommandDock />
    <section className="possible-worlds__results" aria-label="Scenario metrics and timeline">
      <div className="pw-results__header"><div><span className="possible-worlds__eyebrow">{isViewingHistory ? "HISTORICAL STATE" : "DECISION SURFACE"}</span><strong>{showBranches ? selectedScenario.label : isViewingHistory ? "Viewing reconstructed state" : "Current operational state"}</strong></div><div className="pw-recommendation"><span>RECOMMENDED</span><strong>Split release</strong><small>Highest on-time probability under current assumptions</small></div></div>
      <div className="pw-objective"><span>Desired future</span><strong>{objective.label}</strong><small>{(objective.constraints || []).map((constraint) => `${constraint.metric} ${constraint.operator === "less_than_or_equal" ? "≤" : "="} ${constraint.metric === "additionalCost" ? money(constraint.value) : percent(constraint.value)}`).join(" · ")}</small></div>
      <div className="pw-metrics"><Metric label="Predicted release" value={shortDate(selectedScenario.predictedReleaseDate)} note={`planned ${shortDate(world.project.plannedReleaseDate)}`} tone={selectedScenario.id === "baseline" ? "risk" : "positive"} /><Metric label="Future alignment" value={percent(selectedScenario.alignmentScore ?? 0)} note={selectedScenario.constraintViolations.length ? `${selectedScenario.constraintViolations.length} constraint issue` : "objective fit"} tone={selectedScenario.alignmentScore > 0.7 ? "positive" : "risk"} /><Metric label="On-time probability" value={percent(selectedScenario.onTimeProbability)} note={`${percent(world.project.onTimeProbability)} current`} tone={selectedScenario.onTimeProbability > 0.7 ? "positive" : "risk"} /><Metric label="Estimated cost" value={money(selectedScenario.estimatedCost)} note={`${selectedScenario.estimatedCost >= world.project.estimatedCost ? "+€38k" : "−€18k"} vs current`} /><Metric label="Defect risk" value={percent(selectedScenario.defectRisk)} note="synthetic estimate" tone={selectedScenario.defectRisk < 0.11 ? "positive" : "risk"} /><Metric label="Renewal probability" value={percent(selectedScenario.renewalProbability)} note={selectedScenario.customerImpact} tone={selectedScenario.renewalProbability > 0.75 ? "positive" : "risk"} /><Metric label="Confidence" value={percent(selectedScenario.confidence)} note="model trace" /></div>
      <ScenarioTray scenarios={trajectories} visible={showBranches} selectedId={selectedScenarioId} onSelect={selectScenario} />
      <Timeline position={timelinePosition} onSelect={setTimelinePosition} events={events} onSelectEvent={selectTimelineEvent} isViewingHistory={isViewingHistory} onReturnToNow={returnToNow} />
      <div className="pw-results__footer"><button type="button" className="pw-assumptions-toggle" onClick={() => setShowAssumptions((current) => !current)} aria-expanded={showAssumptions}>ⓘ Assumptions & confidence <span>{showAssumptions ? "−" : "+"}</span></button><span>Observed facts, inferred relationships, and simulated futures remain separate.</span>{showAssumptions && <div className="pw-assumptions"><strong>Model boundary</strong><span>Joz interprets language; the deterministic world engine updates observed events and evaluates isolated futures. The 3D scene only receives validated runtime state.</span><strong>Confidence</strong><span>Confidence describes stability of this synthetic trace, not the probability that a real project will follow it.</span></div>}</div>
    </section>
  </main>;
}
