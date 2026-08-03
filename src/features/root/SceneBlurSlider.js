export function SceneBlurSlider({ value = 0, onChange }) {
  const normalizedValue = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div
      className="scene-blur-control"
      aria-label="Scene focus control"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onTouchMove={(event) => event.stopPropagation()}
    >
      <span className="scene-blur-control__label scene-blur-control__label--blur">
        Blur
      </span>
      <div className="scene-blur-control__track">
        <input
          className="scene-blur-control__range"
          type="range"
          min="0"
          max="100"
          step="1"
          value={normalizedValue}
          aria-label="Scene blur amount"
          aria-valuetext={`${normalizedValue}% blur`}
          onChange={(event) => onChange?.(Number(event.target.value))}
          style={{ "--scene-blur-progress": `${normalizedValue}%` }}
        />
      </div>
      <span className="scene-blur-control__label scene-blur-control__label--clear">
        Clear
      </span>
    </div>
  );
}
