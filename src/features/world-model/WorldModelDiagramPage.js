import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls, Sparkles } from "@react-three/drei";
import * as THREE from "three";

const ORBITS = [
  { label: "Observe", radius: 1.28, speed: 0.42, tilt: [1.32, 0.1, 0.18], color: "#66e7ff", satellites: 3, labelPhase: 0.2 },
  { label: "Simulate", radius: 1.9, speed: -0.31, tilt: [1.14, -0.45, 0.36], color: "#a78bff", satellites: 4, labelPhase: 1.35 },
  { label: "Select", radius: 2.55, speed: 0.23, tilt: [1.5, 0.32, -0.22], color: "#ff61d8", satellites: 5, labelPhase: 2.45 },
  { label: "Execute", radius: 3.22, speed: -0.17, tilt: [1.02, 0.68, 0.52], color: "#ffe96a", satellites: 4, labelPhase: 3.6 },
  { label: "Learn", radius: 3.92, speed: 0.11, tilt: [1.62, -0.18, -0.62], color: "#79ffd2", satellites: 6, labelPhase: 4.85 },
];

const TRAJECTORIES = [
  {
    label: "Future A",
    selected: false,
    color: "#8f7cff",
    points: [
      [0, 0.04, 0],
      [-0.72, 0.72, -0.65],
      [-1.85, 1.08, -1.3],
      [-2.85, 0.62, -1.96],
    ],
  },
  {
    label: "Selected",
    selected: true,
    color: "#ffe96a",
    points: [
      [0, 0.04, 0],
      [0.08, 0.94, -0.72],
      [0.28, 1.52, -1.48],
      [0.46, 1.18, -2.34],
    ],
  },
  {
    label: "Future B",
    selected: false,
    color: "#ff61d8",
    points: [
      [0, 0.04, 0],
      [0.74, 0.68, -0.65],
      [1.9, 1.0, -1.34],
      [2.92, 0.5, -2.02],
    ],
  },
];

const FEEDBACK_POINTS = [
  [0.46, 1.18, -2.34],
  [1.42, -0.42, -1.72],
  [0.74, -1.72, -0.64],
  [-0.42, -1.42, -0.08],
  [-0.08, -0.3, 0.08],
];

function curveFromPoints(points) {
  return new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
}

function OrbitBand({ orbit, index }) {
  const ref = useRef();
  const satellites = useMemo(
    () =>
      Array.from({ length: orbit.satellites }, (_, satelliteIndex) => ({
        phase: (satelliteIndex / orbit.satellites) * Math.PI * 2,
        size: satelliteIndex === 0 ? 0.105 : 0.052,
      })),
    [orbit.satellites]
  );

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const elapsed = clock.getElapsedTime();
    ref.current.rotation.z = elapsed * orbit.speed;
    ref.current.rotation.y = orbit.tilt[1] + Math.sin(elapsed * 0.16 + index) * 0.05;
  });

  return (
    <group ref={ref} rotation={orbit.tilt}>
      <mesh>
        <torusGeometry args={[orbit.radius, index === 3 ? 0.018 : 0.009, 16, 360]} />
        <meshBasicMaterial
          color={orbit.color}
          transparent
          opacity={index === 3 ? 0.72 : 0.34}
        />
      </mesh>
      <mesh>
        <torusGeometry args={[orbit.radius + 0.045, 0.0025, 10, 360]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.1} />
      </mesh>

      {satellites.map((satellite, satelliteIndex) => {
        const x = Math.cos(satellite.phase) * orbit.radius;
        const y = Math.sin(satellite.phase) * orbit.radius;
        const isLead = satelliteIndex === 0;
        return (
          <mesh key={satelliteIndex} position={[x, y, 0]}>
            <sphereGeometry args={[satellite.size, 24, 24]} />
            <meshStandardMaterial
              color={isLead ? "#ffffff" : orbit.color}
              emissive={orbit.color}
              emissiveIntensity={isLead ? 2.4 : 1.15}
              roughness={0.18}
              metalness={0.32}
            />
          </mesh>
        );
      })}

      <Html
        center
        distanceFactor={8.4}
        position={[
          Math.cos(orbit.labelPhase) * orbit.radius,
          Math.sin(orbit.labelPhase) * orbit.radius,
          0,
        ]}
      >
        <div className="world-model-diagram__orbit-label" style={{ borderColor: orbit.color }}>
          {orbit.label}
        </div>
      </Html>
    </group>
  );
}

function Core() {
  const ref = useRef();

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const elapsed = clock.getElapsedTime();
    ref.current.rotation.y = elapsed * 0.18;
    ref.current.rotation.x = Math.sin(elapsed * 0.22) * 0.1;
  });

  return (
    <group ref={ref}>
      <mesh>
        <icosahedronGeometry args={[0.78, 5]} />
        <meshPhysicalMaterial
          color="#061a31"
          emissive="#39cfff"
          emissiveIntensity={0.42}
          roughness={0.12}
          metalness={0.2}
          transmission={0.42}
          thickness={0.85}
          transparent
          opacity={0.88}
        />
      </mesh>
      <mesh scale={[1.18, 1.18, 1.18]}>
        <icosahedronGeometry args={[0.78, 2]} />
        <meshBasicMaterial color="#7be7ff" wireframe transparent opacity={0.24} />
      </mesh>
      <mesh scale={[1.58, 1.58, 1.58]}>
        <sphereGeometry args={[0.78, 48, 48]} />
        <meshBasicMaterial color="#8feaff" transparent opacity={0.045} />
      </mesh>
    </group>
  );
}

function BrowserTrajectory({ trajectory }) {
  const points = useMemo(
    () => curveFromPoints(trajectory.points).getPoints(80).map((point) => point.toArray()),
    [trajectory.points]
  );

  return (
    <group>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={points.length}
            array={new Float32Array(points.flat())}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color={trajectory.color}
          transparent
          opacity={trajectory.selected ? 0.9 : 0.32}
        />
      </line>
      <mesh position={trajectory.points[trajectory.points.length - 1]}>
        <sphereGeometry args={[trajectory.selected ? 0.16 : 0.09, 24, 24]} />
        <meshStandardMaterial
          color={trajectory.selected ? "#ffffff" : trajectory.color}
          emissive={trajectory.color}
          emissiveIntensity={trajectory.selected ? 1.7 : 0.7}
          roughness={0.22}
          metalness={0.2}
        />
      </mesh>
    </group>
  );
}

function BrowserFeedbackLoop() {
  const points = useMemo(
    () => curveFromPoints(FEEDBACK_POINTS).getPoints(96).map((point) => point.toArray()),
    []
  );

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={points.length}
          array={new Float32Array(points.flat())}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#79ffd2" transparent opacity={0.62} />
    </line>
  );
}

function WorldModelScene() {
  const rigRef = useRef();

  useFrame(({ clock }) => {
    if (!rigRef.current) return;
    rigRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.08) * 0.18;
  });

  return (
    <>
      <color attach="background" args={["#020611"]} />
      <fog attach="fog" args={["#020611", 7.5, 15]} />
      <ambientLight intensity={0.42} />
      <pointLight position={[0, 3.5, 4.4]} intensity={36} color="#8be8ff" />
      <pointLight position={[-4.5, -2, 2.8]} intensity={22} color="#ff4fd8" />
      <pointLight position={[4.2, -1.2, 3.2]} intensity={18} color="#ffe96a" />

      <Sparkles count={180} scale={[8.5, 6, 5]} size={0.95} speed={0.16} color="#9cecff" />

      <group ref={rigRef}>
        <Core />
        {ORBITS.map((orbit, index) => (
          <OrbitBand key={`${orbit.radius}-${orbit.color}`} orbit={orbit} index={index} />
        ))}
        {TRAJECTORIES.map((trajectory) => (
          <BrowserTrajectory key={trajectory.label} trajectory={trajectory} />
        ))}
        <BrowserFeedbackLoop />
      </group>

      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.82]}>
        <torusGeometry args={[5.15, 0.006, 12, 360]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.09} />
      </mesh>

      <OrbitControls
        enableDamping
        dampingFactor={0.07}
        minDistance={4.2}
        maxDistance={9.5}
        maxPolarAngle={Math.PI * 0.82}
      />
    </>
  );
}

function addExportableOrbitLabel({ TextGeometry, font, orbit, root }) {
  const textGeometry = new TextGeometry(orbit.label.toUpperCase(), {
    font,
    size: 0.28,
    depth: 0.04,
    curveSegments: 8,
    bevelEnabled: false,
  });
  textGeometry.computeBoundingBox();
  textGeometry.center();

  const labelPoint = new THREE.Vector3(
    Math.cos(orbit.labelPhase) * orbit.radius,
    Math.sin(orbit.labelPhase) * orbit.radius,
    0
  );
  labelPoint.applyEuler(new THREE.Euler(...orbit.tilt));

  const labelGroup = new THREE.Group();
  labelGroup.name = `${orbit.label}_Readable_AR_Label`;
  labelGroup.position.copy(labelPoint);
  labelGroup.position.z += 0.16;

  const width = Math.max(1.18, orbit.label.length * 0.22);
  const plaque = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.42, 0.035),
    new THREE.MeshStandardMaterial({
      color: "#06101f",
      emissive: orbit.color,
      emissiveIntensity: 0.08,
      roughness: 0.36,
      metalness: 0.08,
    })
  );
  plaque.name = `${orbit.label}_Label_Backplate`;
  plaque.position.z = -0.035;
  labelGroup.add(plaque);

  const textMesh = new THREE.Mesh(
    textGeometry,
    new THREE.MeshStandardMaterial({
      color: "#ffffff",
      emissive: orbit.color,
      emissiveIntensity: 0.55,
      roughness: 0.22,
      metalness: 0.12,
    })
  );
  textMesh.name = `${orbit.label}_Orbit_Label`;
  textMesh.position.z = 0.02;
  labelGroup.add(textMesh);

  root.add(labelGroup);
}

function addExportableTextPlaque({ TextGeometry, font, root, label, color, position, width = 1.42 }) {
  const group = new THREE.Group();
  group.name = `${label.replace(/\s+/g, "_")}_AR_Label`;
  group.position.set(...position);

  const plaque = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.38, 0.035),
    new THREE.MeshStandardMaterial({
      color: "#06101f",
      emissive: color,
      emissiveIntensity: 0.08,
      roughness: 0.36,
      metalness: 0.08,
    })
  );
  plaque.position.z = -0.035;
  group.add(plaque);

  const textGeometry = new TextGeometry(label.toUpperCase(), {
    font,
    size: 0.2,
    depth: 0.035,
    curveSegments: 8,
    bevelEnabled: false,
  });
  textGeometry.computeBoundingBox();
  textGeometry.center();
  const textMesh = new THREE.Mesh(
    textGeometry,
    new THREE.MeshStandardMaterial({
      color: "#ffffff",
      emissive: color,
      emissiveIntensity: 0.45,
      roughness: 0.24,
      metalness: 0.1,
    })
  );
  textMesh.position.z = 0.015;
  group.add(textMesh);

  root.add(group);
}

function addExportableTrajectory({ root, trajectory }) {
  const curve = curveFromPoints(trajectory.points);
  const material = new THREE.MeshStandardMaterial({
    color: trajectory.color,
    emissive: trajectory.color,
    emissiveIntensity: trajectory.selected ? 0.92 : 0.38,
    roughness: 0.24,
    metalness: 0.16,
  });
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 96, trajectory.selected ? 0.035 : 0.018, 12, false),
    material
  );
  tube.name = `${trajectory.label.replace(/\s+/g, "_")}_Trajectory`;
  root.add(tube);

  const end = trajectory.points[trajectory.points.length - 1];
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(trajectory.selected ? 0.18 : 0.11, 24, 24),
    new THREE.MeshStandardMaterial({
      color: trajectory.selected ? "#ffffff" : trajectory.color,
      emissive: trajectory.color,
      emissiveIntensity: trajectory.selected ? 1.35 : 0.72,
      roughness: 0.18,
      metalness: 0.2,
    })
  );
  marker.name = `${trajectory.label.replace(/\s+/g, "_")}_Predicted_State`;
  marker.position.set(...end);
  root.add(marker);
}

function addExportableFeedbackLoop({ root }) {
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curveFromPoints(FEEDBACK_POINTS), 96, 0.022, 12, false),
    new THREE.MeshStandardMaterial({
      color: "#79ffd2",
      emissive: "#79ffd2",
      emissiveIntensity: 0.58,
      roughness: 0.24,
      metalness: 0.16,
    })
  );
  tube.name = "Feedback_Learning_Loop";
  root.add(tube);
}

async function buildExportableOrbitScene() {
  const [{ FontLoader }, { TextGeometry }, fontAsset] = await Promise.all([
    import("three/examples/jsm/loaders/FontLoader.js"),
    import("three/examples/jsm/geometries/TextGeometry.js"),
    import("three/examples/fonts/helvetiker_regular.typeface.json"),
  ]);
  const font = new FontLoader().parse(fontAsset.default || fontAsset);

  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.name = "World_Model_AI_Orbits";
  root.rotation.x = -0.18;

  const coreMaterial = new THREE.MeshStandardMaterial({
    color: "#0a2546",
    emissive: "#1ba4ff",
    emissiveIntensity: 0.32,
    roughness: 0.2,
    metalness: 0.38,
  });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 4), coreMaterial);
  core.name = "World_State_Core";
  root.add(core);

  ORBITS.forEach((orbit, index) => {
    const orbitGroup = new THREE.Group();
    orbitGroup.name = `${orbit.label}_Orbit`;
    orbitGroup.rotation.set(...orbit.tilt);

    const orbitMaterial = new THREE.MeshStandardMaterial({
      color: orbit.color,
      emissive: orbit.color,
      emissiveIntensity: index === 3 ? 0.8 : 0.42,
      roughness: 0.26,
      metalness: 0.22,
    });
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(orbit.radius, index === 3 ? 0.04 : 0.026, 20, 192),
      orbitMaterial
    );
    ring.name = `${orbit.label}_Prediction_Ring`;
    orbitGroup.add(ring);

    Array.from({ length: orbit.satellites }).forEach((_, satelliteIndex) => {
      const phase = (satelliteIndex / orbit.satellites) * Math.PI * 2;
      const isLead = satelliteIndex === 0;
      const satellite = new THREE.Mesh(
        new THREE.SphereGeometry(isLead ? 0.16 : 0.082, 24, 24),
        new THREE.MeshStandardMaterial({
          color: isLead ? "#ffffff" : orbit.color,
          emissive: orbit.color,
          emissiveIntensity: isLead ? 1.2 : 0.52,
          roughness: 0.18,
          metalness: 0.28,
        })
      );
      satellite.name = `${orbit.label}_State_${satelliteIndex + 1}`;
      satellite.position.set(
        Math.cos(phase) * orbit.radius,
        Math.sin(phase) * orbit.radius,
        0
      );
      orbitGroup.add(satellite);
    });

    root.add(orbitGroup);
    addExportableOrbitLabel({ TextGeometry, font, orbit, root });
  });

  TRAJECTORIES.forEach((trajectory) => {
    addExportableTrajectory({ root, trajectory });
  });
  addExportableFeedbackLoop({ root });
  addExportableTextPlaque({
    TextGeometry,
    font,
    root,
    label: "Selected Future",
    color: "#ffe96a",
    position: [0.48, 1.55, -2.34],
    width: 1.85,
  });
  addExportableTextPlaque({
    TextGeometry,
    font,
    root,
    label: "Feedback",
    color: "#79ffd2",
    position: [0.96, -1.55, -0.78],
    width: 1.34,
  });

  scene.add(root);
  scene.add(new THREE.AmbientLight(0xffffff, 1.25));
  const key = new THREE.PointLight(0x8be8ff, 36);
  key.position.set(0, 3.5, 4.4);
  scene.add(key);
  const fill = new THREE.PointLight(0xff4fd8, 18);
  fill.position.set(-4.5, -2, 2.8);
  scene.add(fill);

  return scene;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function openQuickLook(blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.rel = "ar";
  link.style.display = "none";

  const img = document.createElement("img");
  img.alt = "World Model AI";
  link.appendChild(img);

  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}

function isAppleArDevice() {
  const ua = navigator.userAgent || "";
  return (
    (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

async function exportWorldModelAsset() {
  const scene = await buildExportableOrbitScene();

  if (isAppleArDevice()) {
    const { USDZExporter } = await import("three/examples/jsm/exporters/USDZExporter.js");
    const exporter = new USDZExporter();
    const arrayBuffer = await exporter.parseAsync(scene, {
      quickLookCompatible: true,
      includeAnchoringProperties: true,
      maxTextureSize: 1024,
      ar: {
        anchoring: { type: "plane" },
        planeAnchoring: { alignment: "horizontal" },
      },
    });
    openQuickLook(new Blob([arrayBuffer], { type: "model/vnd.usdz+zip" }));
    return "Opening USDZ in AR…";
  }

  const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
  const exporter = new GLTFExporter();
  const arrayBuffer = await new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      resolve,
      reject,
      {
        binary: true,
        onlyVisible: true,
      }
    );
  });
  downloadBlob(new Blob([arrayBuffer], { type: "model/gltf-binary" }), "world-model-ai-orbits.glb");
  return "Generated GLB asset.";
}

export function WorldModelDiagramPage() {
  const [exportStatus, setExportStatus] = useState("");

  const handleExport = async () => {
    setExportStatus("Generating AR model…");
    try {
      const message = await exportWorldModelAsset();
      setExportStatus(message);
    } catch (error) {
      console.error("World model AR export failed:", error);
      setExportStatus("AR export failed. Try a modern Safari or Chrome browser.");
    }
  };

  return (
    <main className="world-model-diagram-page">
      <section className="world-model-diagram-page__copy" aria-label="World model AI visualization description">
        <p className="world-model-diagram-page__kicker">World Model AI</p>
        <h1>Orbits of Possible Futures</h1>
        <p>
          State at the center. Futures branch through space. One path is selected,
          execution follows, and feedback bends the next prediction.
        </p>
      </section>

      <div className="world-model-diagram-page__canvas" aria-label="Interactive orbital world model AI visualization">
        <Canvas
          camera={{ position: [0, 1.05, 7.2], fov: 39 }}
          dpr={[1, 1.8]}
          gl={{ antialias: true, alpha: false }}
        >
          <WorldModelScene />
        </Canvas>
      </div>

      <div className="world-model-diagram-page__hint">
        Drag to rotate · Scroll to zoom
      </div>

      <div className="world-model-diagram-page__actions">
        <button type="button" onClick={handleExport}>
          View in AR
        </button>
        <span aria-live="polite">{exportStatus}</span>
      </div>
    </main>
  );
}
