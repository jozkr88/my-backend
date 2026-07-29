export function stabilizePortalAlphaMaterial(material) {
  if (!material) return;

  const isTransmissive =
    typeof material.transmission === "number" && material.transmission > 0;
  const hasAlphaTexture = Boolean(material.alphaMap);

  if (hasAlphaTexture && !isTransmissive) {
    if ("alphaHash" in material) {
      material.alphaHash = true;
      material.transparent = false;
    } else {
      material.transparent = true;
      material.alphaTest = Math.max(material.alphaTest || 0, 0.08);
      if ("alphaToCoverage" in material) material.alphaToCoverage = true;
    }

    material.depthWrite = true;
    material.depthTest = true;
    material.premultipliedAlpha = false;
    material.needsUpdate = true;
    return;
  }

  if (isTransmissive) {
    material.transparent = true;
    material.depthWrite = false;
    material.depthTest = true;
    material.premultipliedAlpha = false;
    material.needsUpdate = true;
    return;
  }

  if (material.transparent || material.opacity < 1) {
    material.transparent = true;
    material.depthWrite = false;
    material.depthTest = true;
    material.premultipliedAlpha = false;
    material.needsUpdate = true;
  }
}
