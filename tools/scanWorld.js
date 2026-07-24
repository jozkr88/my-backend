// server/tools/scanWorld.js
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import gltfPipeline from "gltf-pipeline";
import dotenv from "dotenv";

dotenv.config();

// --------------------------------------------
// CONFIG
// --------------------------------------------
const PROJECT_ROOT = path.resolve("./");
const ASSET_DIRS = ["./public", "./src/assets", "./src/models"];
const FILE_EXTENSIONS = [".glb", ".gltf"];
const CODE_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx"];
const OUTPUT_FILE = "./worldIndex.json";
const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000";

// --------------------------------------------
// HELPERS
// --------------------------------------------
function walk(dir, result = []) {
  if (!fs.existsSync(dir)) return result;
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, result);
    else result.push(full);
  }
  return result;
}

async function analyzeGLB(file) {
  try {
    const data = fs.readFileSync(file);
    const result = await gltfPipeline.glbToGltf(data);
    const json = result?.gltf ?? {};
    const meshes = (json.meshes || []).map((m) => m.name).filter(Boolean);
    const materials = (json.materials || []).map((m) => m.name).filter(Boolean);
    return { meshes, materials, uri: file };
  } catch (err) {
    console.warn("⚠️ Failed to parse GLB:", file, err.message);
    return { meshes: [], materials: [], uri: file };
  }
}

function analyzeCode(file) {
  try {
    const code = fs.readFileSync(file, "utf8");
    const imports = [...code.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    const functions = [...code.matchAll(/function\s+(\w+)/g)].map((m) => m[1]);
    const glbRefs = [...code.matchAll(/["']([^"']+\.glb)["']/g)].map((m) => m[1]);
    return { imports, functions, glbRefs };
  } catch (err) {
    console.warn("⚠️ Failed to parse code:", file, err.message);
    return {};
  }
}

// --------------------------------------------
// MAIN
// --------------------------------------------
(async () => {
  console.log("🧠 Scanning world assets and code...");

  const worldIndex = {};

  // Scan GLBs
  for (const dir of ASSET_DIRS) {
    const allFiles = walk(dir);
    for (const file of allFiles) {
      if (FILE_EXTENSIONS.some((ext) => file.endsWith(ext))) {
        const data = await analyzeGLB(file);
        worldIndex[file] = { type: "model", ...data };
      }
    }
  }

  // Scan code
  const allCode = walk("./src");
  for (const file of allCode) {
    if (CODE_EXTENSIONS.some((ext) => file.endsWith(ext))) {
      worldIndex[file] = { type: "code", ...analyzeCode(file) };
    }
  }

  // Save local index
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(worldIndex, null, 2));
  console.log(`💾 World index saved → ${OUTPUT_FILE}`);

  // Sync with backend memory
  console.log("🌍 Syncing world index to backend memory...");
  try {
    await fetch(`${API_BASE}/api/world-memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mesh: "worldIndex",
        action: "scan",
        context: { date: new Date().toISOString() },
        commands: Object.keys(worldIndex),
      }),
    });
    console.log("✅ Synced with backend memory!");
  } catch (err) {
    console.error("❌ Failed to sync with backend:", err.message);
  }

  console.log("🧩 Total entries:", Object.keys(worldIndex).length);
})();
