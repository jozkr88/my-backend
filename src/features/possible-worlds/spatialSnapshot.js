const DOMAIN_LAYOUT = {
  project: { radius: 2.35, phase: 2.7 },
  team: { radius: 2.75, phase: 0.18 },
  customer: { radius: 3.15, phase: -0.74 },
  technology: { radius: 3.55, phase: 3.45 },
  capital: { radius: 3.95, phase: 1.58 },
  risk: { radius: 4.3, phase: -1.38 },
};

export function compileSpatialWorldSnapshot({ worldState, trajectories = [], objective }) {
  const world = worldState?.data || {};
  const baseline = trajectories.find((trajectory) => trajectory.scenarioId === "baseline") || trajectories[0];
  const selected = trajectories.find((trajectory) => trajectory.alignmentScore === Math.max(...trajectories.map((item) => item.alignmentScore || 0))) || baseline;
  const domains = Object.entries(DOMAIN_LAYOUT).map(([id, layout]) => ({
    id,
    orbitRadius: layout.radius,
    phase: layout.phase,
    position: [Math.cos(layout.phase) * layout.radius, Math.sin(layout.phase) * layout.radius, 0],
    health: id === "risk" ? 1 - (world.risk?.overall || 0) : id === "customer" ? world.customer?.sentiment || 0 : 1 - (world.team?.backendCapacityGap || 0),
  }));
  const trajectoriesSnapshot = trajectories.map((trajectory, index) => {
    const y = (index - (trajectories.length - 1) / 2) * 0.42;
    const alignment = trajectory.alignmentScore || 0;
    return {
      id: trajectory.scenarioId || trajectory.id,
      label: trajectory.shortLabel || trajectory.label,
      confidence: trajectory.confidence,
      uncertainty: trajectory.uncertainty,
      alignmentScore: alignment,
      constraintViolations: trajectory.constraintViolations || [],
      points: [[0, 0, -0.42], [1.1, y * 0.5, -0.55], [2.3, y, -0.72], [3.25 + alignment * 0.8, y * (1.2 - alignment * 0.35), -0.92]],
    };
  });
  return {
    id: worldState?.id || "project-atlas",
    stateVersion: worldState?.version || "v0",
    kind: worldState?.kind || "observed",
    core: { position: [0, 0, 0], health: 1 - (world.risk?.overall || 0.72), alignmentScore: selected?.alignmentScore || 0 },
    objective: objective ? { label: objective.label, targetValue: objective.targetValue, constraints: objective.constraints || [], position: [4.2, 0, -0.92] } : null,
    domains,
    baseline: baseline ? { id: baseline.scenarioId, alignmentScore: baseline.alignmentScore, points: trajectoriesSnapshot.find((item) => item.id === baseline.scenarioId)?.points || [] } : null,
    trajectories: trajectoriesSnapshot,
  };
}
