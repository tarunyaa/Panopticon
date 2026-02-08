/** Renders a single front-facing frame from an agent spritesheet. */
export function AgentAvatar({ src, size = 14 }: { src?: string; size?: number }) {
  if (!src) {
    return (
      <span
        className="shrink-0 inline-block bg-wood border border-wood-dark rounded-sm"
        style={{ width: size, height: size }}
      />
    );
  }
  // Spritesheets are 3 cols x 4 rows of 32x32 frames.
  // Frame 1 (front-facing idle) is col 1, row 0.
  const scale = size / 32;
  const sheetW = 96 * scale;
  const sheetH = 128 * scale;
  return (
    <span
      className="shrink-0 inline-block"
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${src})`,
        backgroundSize: `${sheetW}px ${sheetH}px`,
        backgroundPosition: `-${size}px 0`,
        imageRendering: "pixelated",
      }}
    />
  );
}
