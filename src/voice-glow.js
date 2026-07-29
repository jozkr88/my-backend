// voiceGlow.js — animated dot grid only along screen edges using <canvas>

let animationFrame = null;
let canvas = null;
let ctx = null;

export function startVoiceGlow() {
  if (canvas) return; // already active

  // --- Create and insert canvas overlay ---
  canvas = document.createElement("canvas");
  canvas.className = "voice-glow-canvas";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  ctx = canvas.getContext("2d");

  // --- Handle resizing ---
  const handleResize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  window.addEventListener("resize", handleResize);

  // --- Animation loop ---
  let t = 0;
  const spacing = 36; // grid spacing between dots
  const edgeThickness = 60; // ✅ only show within 60px from edges
  const dotSize = 2.5;

  const render = () => {
    if (!ctx) return;
    t += 0.02;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cols = Math.ceil(canvas.width / spacing);
    const rows = Math.ceil(canvas.height / spacing);

    for (let y = 0; y <= rows; y++) {
      for (let x = 0; x <= cols; x++) {
        const px = x * spacing;
        const py = y * spacing;

        // ✅ Only draw dots near edges
        const nearEdge =
          px < edgeThickness ||
          px > canvas.width - edgeThickness ||
          py < edgeThickness ||
          py > canvas.height - edgeThickness;

        if (!nearEdge) continue;

        // Gentle shimmer brightness
        const flicker =
          0.4 +
          0.3 *
            Math.sin(
              (x * 0.6 + y * 0.6) * 0.5 + t + Math.sin(x * 0.3 + y * 0.3)
            );

        ctx.beginPath();
        ctx.arc(px, py, dotSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${flicker})`;
        ctx.shadowColor = "rgba(255,255,255,0.4)";
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.closePath();
      }
    }

    animationFrame = requestAnimationFrame(render);
  };

  render();

  // Store cleanup
  canvas._cleanup = () => {
    window.removeEventListener("resize", handleResize);
  };

  // Fade in
  canvas.classList.add("active");
}

export function stopVoiceGlow() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = null;

  if (canvas) {
    canvas.classList.remove("active");
    canvas._cleanup?.();

    // Fade out smoothly before removing
    setTimeout(() => {
      canvas.remove();
      canvas = null;
      ctx = null;
    }, 500);
  }
}
