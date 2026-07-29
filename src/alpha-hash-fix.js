export function applyAlphaHash(root) {
    if (!root) return;
    root.traverse((o) => {
      if (!o.isMesh) return;
      const apply = (m) => {
        if (!m) return;
        // Only apply when we see any transparency intent
        const isTransparent =
          m.transparent === true ||
          (typeof m.opacity === "number" && m.opacity < 1) ||
          (typeof m.transmission === "number" && m.transmission > 0);
  
        if (!isTransparent) return;
  
        // Prefer alphaHash when available (three r154+)
        if ("alphaHash" in m) {
          m.transparent = false;     // disable blending
          m.depthWrite  = true;
          m.depthTest   = true;
          m.alphaHash   = true;      // <- magic
          if (m.opacity === 1 && !m.transmission) m.opacity = 0.6; // ensure visible
        } else {
          // fallback to regular blending if alphaHash not supported
          m.transparent = true;
          m.depthWrite  = false;
          m.depthTest   = true;
        }
      };
      Array.isArray(o.material) ? o.material.forEach(apply) : apply(o.material);
    });
  }