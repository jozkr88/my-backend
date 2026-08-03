import { create } from "zustand";
import { SCENARIOS } from "./seedWorld";
import { interpretDemoCommand } from "./commandInterpreter";
import { compileSpatialWorldSnapshot } from "./spatialSnapshot";
import {
  compareScenarios,
  createInitialWorldState,
  createWorldEvent,
  DEFAULT_OBJECTIVE,
  encodeState,
  reconstructAt,
} from "./worldRuntime";

const PERSISTENCE_KEY = "joz-possible-worlds-runtime-v1";

function loadPersistedRuntime() {
  if (typeof window === "undefined") return { events: [], objective: DEFAULT_OBJECTIVE };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PERSISTENCE_KEY) || "null");
    const objective = parsed?.objective && typeof parsed.objective === "object" ? {
      ...DEFAULT_OBJECTIVE,
      ...parsed.objective,
      constraints: Array.isArray(parsed.objective.constraints) ? parsed.objective.constraints : DEFAULT_OBJECTIVE.constraints,
    } : DEFAULT_OBJECTIVE;
    return { events: Array.isArray(parsed?.events) ? parsed.events : [], objective };
  } catch {
    return { events: [], objective: DEFAULT_OBJECTIVE };
  }
}

const persistedRuntime = loadPersistedRuntime();
const persistedEvents = persistedRuntime.events;
const persistedObjective = persistedRuntime.objective;
const initialRuntimeState = encodeState(persistedEvents);

const initialState = {
  world: initialRuntimeState.data,
  worldState: initialRuntimeState,
  events: persistedEvents,
  objective: persistedObjective,
  trajectories: compareScenarios(initialRuntimeState, SCENARIOS, persistedObjective),
  spatialSnapshot: compileSpatialWorldSnapshot({ worldState: initialRuntimeState, trajectories: compareScenarios(initialRuntimeState, SCENARIOS, persistedObjective), objective: persistedObjective }),
  pendingCommand: null,
  pendingMessage: null,
  processSteps: [],
  historyCursor: "now",
  isViewingHistory: false,
  mode: "overview",
  cameraView: "overview",
  selectedEntity: "project",
  selectedScenario: "baseline",
  simulationStatus: "idle",
  statusLabel: "Live simulation",
  focusedEntities: [],
  timelinePosition: "jul-31",
  showBranches: false,
};

const scenarioIdForAction = (actionType) => {
  const match = SCENARIOS.find((scenario) => scenario.actionType === actionType || scenario.type === actionType);
  return match?.id || "baseline";
};

function stateForEvents(events, objective = DEFAULT_OBJECTIVE) {
  const worldState = encodeState(events);
  const trajectories = compareScenarios(worldState, SCENARIOS, objective);
  return { world: worldState.data, worldState, objective, trajectories, spatialSnapshot: compileSpatialWorldSnapshot({ worldState, trajectories, objective }) };
}

export const usePossibleWorldsStore = create((set, get) => ({
  ...initialState,

  selectScenario: (scenarioId) => set({ selectedScenario: scenarioId, showBranches: true, mode: "compare", cameraView: "scenario_compare", statusLabel: "Comparing outcomes" }),

  selectTimelineEvent: (eventId) => {
    const events = get().events;
    let targetId = eventId;
    if (eventId === "before-scope-growth") {
      const scopeIndex = events.findIndex((event) => event.type === "scope_growth");
      targetId = scopeIndex > 0 ? events[scopeIndex - 1].id : null;
    }
    const worldState = targetId ? reconstructAt(events, targetId) : createInitialWorldState();
    set({
      ...stateForEvents(targetId ? events.slice(0, events.findIndex((event) => event.id === targetId) + 1) : [], get().objective),
      worldState,
      world: worldState.data,
      trajectories: compareScenarios(worldState, SCENARIOS, get().objective),
      historyCursor: eventId,
      timelinePosition: eventId,
      isViewingHistory: true,
      cameraView: "timeline",
      showBranches: false,
      statusLabel: "Viewing historical state",
    });
  },

  returnToNow: () => {
    const current = stateForEvents(get().events, get().objective);
    set({ ...current, historyCursor: "now", timelinePosition: "jul-31", isViewingHistory: false, cameraView: "overview", statusLabel: "Live simulation", showBranches: false, selectedScenario: "baseline" });
  },

  setTimelinePosition: (timelinePosition) => {
    if (timelinePosition === "jul-31") {
      get().returnToNow();
      return;
    }
    set({ timelinePosition, cameraView: "timeline", statusLabel: "Timeline view" });
  },

  prepareCommand: (command, sourceMessageId, sourceMessage) => {
    if (!command) return;
    if (command.intent === "reset") {
      get().resetWorld();
      return;
    }
    if (command.intent === "navigate_timeline" && command.timeline?.returnToNow) {
      get().returnToNow();
      return;
    }
    set({
      pendingCommand: { ...command, sourceMessageId },
      pendingMessage: sourceMessage || command.userIntent,
      processSteps: ["Interpreting change"],
      simulationStatus: "mapping",
      statusLabel: "Interpreting change",
      mode: command.mode,
      cameraView: command.camera?.view || "overview",
      focusedEntities: command.focusEntities || [],
      selectedEntity: command.camera?.targetEntityId || get().selectedEntity,
    });
  },

  commitPendingCommand: (requestedMode) => {
    const state = get();
    const command = state.pendingCommand;
    if (!command) return;

    if (command.intent === "navigate_timeline") {
      get().selectTimelineEvent(command.timeline?.targetEventId || "before-scope-growth");
      set({ pendingCommand: null, pendingMessage: null });
      return;
    }

    if (command.intent === "record_event" || command.intent === "observe" || command.intent === "correct_state") {
      const event = createWorldEvent({ command, sourceMessageId: command.sourceMessageId, previousStateVersion: state.worldState.version });
      const events = [...state.events, event];
      const current = stateForEvents(events, state.objective);
      set({
        ...current,
        events,
        pendingCommand: null,
        pendingMessage: null,
        processSteps: ["People capacity", "Project throughput", "Delivery risk", "Recalculating futures"],
        simulationStatus: "ready",
        statusLabel: "World updated",
        mode: "overview",
        cameraView: "overview",
        timelinePosition: "jul-31",
        historyCursor: "now",
        isViewingHistory: false,
        showBranches: false,
        selectedScenario: "baseline",
      });
      return;
    }

    if (command.intent === "set_objective" || command.intent === "add_constraint") {
      const objective = command.intent === "set_objective"
        ? { ...state.objective, ...command.objective, constraints: command.objective?.constraints || state.objective.constraints }
        : { ...state.objective, constraints: [...(state.objective.constraints || []), ...(command.objective?.constraints || [])] };
      const current = stateForEvents(state.events, objective);
      set({ ...current, objective, pendingCommand: null, pendingMessage: null, processSteps: ["Desired future recorded", "Evaluating alignment", "Recalculating futures"], simulationStatus: "ready", statusLabel: "Future alignment updated", mode: "compare", cameraView: "scenario_compare", showBranches: true });
      return;
    }

    if (command.intent === "simulate" || command.intent === "compare" || requestedMode === "simulate") {
      const scenarioAction = command.scenario?.action;
      const selectedScenario = command.intent === "simulate" ? scenarioIdForAction(scenarioAction?.type) : "split";
      const trajectories = compareScenarios(state.worldState, SCENARIOS, state.objective);
      set({
        pendingCommand: null,
        pendingMessage: null,
        trajectories,
        spatialSnapshot: compileSpatialWorldSnapshot({ worldState: state.worldState, trajectories, objective: state.objective }),
        selectedScenario,
        showBranches: true,
        mode: command.intent,
        cameraView: "scenario_compare",
        processSteps: ["Scenario state isolated", "Propagating effects", "Simulating futures", "Comparing outcomes"],
        simulationStatus: "ready",
        statusLabel: command.intent === "compare" ? "Comparing outcomes" : "Futures simulated",
      });
      return;
    }

    set({ pendingCommand: null, pendingMessage: null, processSteps: ["World explanation ready"], simulationStatus: "ready", statusLabel: "World explanation ready" });
  },

  clearPendingCommand: () => set({ pendingCommand: null, pendingMessage: null, processSteps: [], simulationStatus: "idle", statusLabel: "Live simulation" }),

  resetWorld: () => {
    const fresh = createInitialWorldState();
    set({ ...initialState, world: fresh.data, worldState: fresh, objective: DEFAULT_OBJECTIVE, trajectories: compareScenarios(fresh, SCENARIOS, DEFAULT_OBJECTIVE) });
  },
}));

if (typeof window !== "undefined") {
  usePossibleWorldsStore.subscribe((state) => {
    try {
      window.localStorage.setItem(PERSISTENCE_KEY, JSON.stringify({ events: state.events, objective: state.objective }));
    } catch {
      // Local persistence is a convenience fallback; runtime state remains authoritative.
    }
  });
}

export { initialState };
