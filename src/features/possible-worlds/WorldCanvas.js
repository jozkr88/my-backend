import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ENTITY_BY_ID } from "./seedWorld";

const SCALE = 1.18;

const DOMAIN_ORBITS = {
  project: { radius: 2.35, flatten: 1, phase: 2.7, labelAngle: 3.55, speed: 0.052, tilt: [0, 0, 0] },
  team: { radius: 2.75, flatten: 1, phase: 0.18, labelAngle: 0.25, speed: -0.044, tilt: [0, 0, 0] },
  customer: { radius: 3.15, flatten: 1, phase: -0.74, labelAngle: -0.42, speed: 0.034, tilt: [0, 0, 0] },
  technology: { radius: 3.55, flatten: 1, phase: 3.45, labelAngle: 3.12, speed: 0.047, tilt: [0, 0, 0] },
  capital: { radius: 3.95, flatten: 1, phase: 1.58, labelAngle: 1.2, speed: -0.026, tilt: [0, 0, 0] },
  risk: { radius: 4.3, flatten: 1, phase: -1.38, labelAngle: -1.34, speed: 0.024, tilt: [0, 0, 0] },
};

function scaledPosition(position) {
  return position.map((value) => value * SCALE);
}

function domainScale(domainId, world) {
  if (!world) return 1;
  if (domainId === "project") return 0.92 + (world.project?.completionRatio || 0.68) * 0.18;
  if (domainId === "team") return 0.9 + Math.min(1.3, (world.team?.engineers || 12) / 12) * 0.14;
  if (domainId === "customer") return 0.86 + (world.customer?.sentiment || 0.54) * 0.22;
  if (domainId === "technology") return 0.9 + (1 - (world.team?.backendCapacityGap || 0.21)) * 0.16;
  if (domainId === "capital") return 1;
  if (domainId === "risk") return 0.9 + (world.risk?.overall || 0.72) * 0.22;
  return 1;
}

function CurrentStateCore({ focused, world }) {
  const coreRef = useRef();
  useFrame(({ clock }) => {
    if (!coreRef.current) return;
    const t = clock.getElapsedTime();
    const stability = 1 - (world?.risk?.overall || 0.72);
    coreRef.current.scale.setScalar((focused ? 1.08 : 1) * (0.96 + stability * 0.08) + Math.sin(t * 1.2) * 0.012);
    coreRef.current.material.emissiveIntensity = 0.3 + stability * 0.5;
  });
  return (
    <group>
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.58, 32, 24]} />
        <meshStandardMaterial color="#b68c50" emissive="#d9a95e" emissiveIntensity={0.5} roughness={0.26} metalness={0.55} />
      </mesh>
      <Html center position={[0, -0.9, 0]} distanceFactor={8}>
        <div className="pw-scene-label pw-scene-label--core">
          <strong>Current operational state</strong>
          <span>observed · 31 Jul 2026</span>
        </div>
      </Html>
    </group>
  );
}

function OrbitRing({ domainId, color, active, world }) {
  const orbit = DOMAIN_ORBITS[domainId];
  const markerScale = domainScale(domainId, world);
  return (
    <group rotation={[orbit.tilt[0], orbit.tilt[1], orbit.tilt[2]]}>
      <mesh>
        <torusGeometry args={[orbit.radius, active ? 0.022 : 0.012, 10, 192]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.52 : 0.19} />
      </mesh>
      <OrbitalBall orbit={orbit} color={color} phase={0.3} size={(active ? 0.11 : 0.085) * markerScale} />
      <Html center position={[Math.cos(orbit.labelAngle) * orbit.radius, Math.sin(orbit.labelAngle) * orbit.radius, 0.04]} distanceFactor={8.4}>
        <div className={`pw-scene-label pw-scene-label--orbit ${active ? "pw-scene-label--active" : ""}`} style={{ "--label-accent": color }}>
          <strong>{ENTITY_BY_ID[domainId].label}</strong>
          <span>orbital domain</span>
        </div>
      </Html>
    </group>
  );
}

function OrbitalBall({ orbit, color, phase, size }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const angle = phase + clock.getElapsedTime() * orbit.speed;
    ref.current.position.set(
      Math.cos(angle) * orbit.radius,
      Math.sin(angle) * orbit.radius,
      Math.sin(angle * 0.72) * 0.24
    );
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[size, 14, 12]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.1} roughness={0.24} metalness={0.28} />
    </mesh>
  );
}

function FutureTrajectoryPaths({ snapshot, showBranches, selectedScenario }) {
  const paths = snapshot?.trajectories || [];
  const visible = showBranches ? paths : paths.filter((path) => path.id === "baseline");
  return <group>
    {visible.map((path) => {
      const active = path.id === selectedScenario;
      return <group key={path.id}>
        <Line points={path.points.map(scaledPosition)} color={active ? "#f5c36a" : "#8da2b0"} transparent opacity={active ? 0.82 : 0.34} lineWidth={active ? 1.8 : 1} dashed={!active} dashSize={0.14} gapSize={0.11} />
        {active && <Html center position={scaledPosition(path.points[path.points.length - 1])} distanceFactor={8}>
          <div className="pw-scene-label pw-scene-label--future" style={{ "--label-accent": "#f5c36a" }}><strong>{path.label}</strong><span>{Math.round(path.alignmentScore * 100)}% alignment · {Math.round(path.confidence * 100)}% confidence</span></div>
        </Html>}
      </group>;
    })}
    {snapshot?.objective && <group position={scaledPosition(snapshot.objective.position)}>
      <mesh><sphereGeometry args={[0.15, 20, 16]} /><meshStandardMaterial color="#f5c36a" emissive="#f5c36a" emissiveIntensity={1.3} transparent opacity={0.88} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.24, 0.012, 8, 48]} /><meshBasicMaterial color="#f5c36a" transparent opacity={0.52} /></mesh>
      <Html center position={[0, 0.38, 0]} distanceFactor={8}><div className="pw-scene-label pw-scene-label--future" style={{ "--label-accent": "#f5c36a" }}><strong>Desired future</strong><span>target state</span></div></Html>
    </group>}
  </group>;
}


function CameraController({ view, selectedEntity }) {
  const controls = useRef();
  const userControlled = useRef(false);
  const previousCommand = useRef(`${view}:${selectedEntity}`);
  const { camera } = useThree();
  const destination = useMemo(() => {
    const entity = ENTITY_BY_ID[selectedEntity];
    const target = entity ? scaledPosition(entity.position).map((value, index) => index === 2 ? value : value * 0.64) : [0, 0, 0];
    if (view === "causal_path") return { position: [-0.7, 0.1, 7.4], target: [-0.3, -0.25, 0] };
    if (view === "focus") return { position: [target[0] * 0.7 + 0.7, target[1] * 0.55 + 0.25, 6.4], target };
    if (view === "scenario_compare") return { position: [0.1, 0.5, 10.2], target: [1.0, 0.0, -0.35] };
    if (view === "timeline") return { position: [0.2, -0.1, 8.8], target: [0, 0, 0] };
    return { position: [0, 0.55, 9.4], target: [0, 0, 0] };
  }, [selectedEntity, view]);
  useEffect(() => {
    const commandKey = `${view}:${selectedEntity}`;
    if (previousCommand.current === commandKey) return;
    previousCommand.current = commandKey;
    userControlled.current = false;
  }, [selectedEntity, view]);
  useFrame(() => {
    if (userControlled.current) {
      controls.current?.update();
      return;
    }
    camera.position.lerp(new THREE.Vector3(...destination.position), 0.035);
    if (controls.current) {
      controls.current.target.lerp(new THREE.Vector3(...destination.target), 0.045);
      controls.current.update();
    }
  });
  return <OrbitControls
    ref={controls}
    enableRotate
    enableZoom
    enablePan={false}
    enableDamping
    dampingFactor={0.08}
    minDistance={3.6}
    maxDistance={16}
    maxPolarAngle={Math.PI * 0.86}
    onStart={() => { userControlled.current = true; }}
  />;
}

function WorldScene({ view, selectedEntity, focusedEntities, world, spatialSnapshot, showBranches, selectedScenario }) {
  return (
    <>
      <color attach="background" args={["#080b0e"]} />
      <ambientLight intensity={0.48} />
      <pointLight position={[0, 3, 5]} intensity={18} color="#f5c36a" />
      <CurrentStateCore focused={focusedEntities.includes("project")} world={world} />
      {Object.entries(DOMAIN_ORBITS).map(([domainId]) => {
        const entity = ENTITY_BY_ID[domainId];
        return <OrbitRing key={domainId} domainId={domainId} color={entity.color} active={focusedEntities.includes(domainId) || selectedEntity === domainId} world={world} />;
      })}
      <FutureTrajectoryPaths snapshot={spatialSnapshot} showBranches={showBranches} selectedScenario={selectedScenario} />
      <CameraController view={view} selectedEntity={selectedEntity} />
    </>
  );
}

export function WorldCanvas(props) {
  return (
    <Canvas
      className="possible-worlds__canvas"
      camera={{ position: [0, 0.55, 9.4], fov: 38 }}
      dpr={[1, 1.55]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      fallback={<div className="possible-worlds__webgl-fallback"><strong>3D world preview unavailable</strong><span>The current state and scenario metrics remain available below.</span></div>}
    >
      <WorldScene {...props} />
    </Canvas>
  );
}
