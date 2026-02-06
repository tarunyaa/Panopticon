import { useState, useEffect } from 'react';

interface SpriteProps {
  src: string;
  width: number;
  height: number;
  scale?: number;
  className?: string;
  alt?: string;
  // For future sprite sheet support
  frameIndex?: number;
  framesPerRow?: number;
}

/**
 * Sprite component wrapper for PNG loading.
 * Designed to be swappable to sprite sheets later without refactoring.
 *
 * Future: Add frameIndex and framesPerRow props to support sprite sheets
 * using background-position to show specific frames.
 */
export function Sprite({
  src,
  width,
  height,
  scale = 1,
  className = '',
  alt = 'sprite',
  frameIndex = 0,
  framesPerRow = 1,
}: SpriteProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Reset state when src changes
  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [src]);

  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  // Calculate background position for sprite sheet (future use)
  const frameX = (frameIndex % framesPerRow) * width;
  const frameY = Math.floor(frameIndex / framesPerRow) * height;

  // If using sprite sheets, use background-image approach
  const useSpriteSheet = framesPerRow > 1 || frameIndex > 0;

  if (useSpriteSheet) {
    return (
      <div
        className={`${className}`}
        style={{
          width: scaledWidth,
          height: scaledHeight,
          backgroundImage: `url(${src})`,
          backgroundPosition: `-${frameX * scale}px -${frameY * scale}px`,
          backgroundSize: `${framesPerRow * scaledWidth}px auto`,
          imageRendering: 'pixelated',
        }}
        role="img"
        aria-label={alt}
      />
    );
  }

  // Standard single-image sprite
  return (
    <div
      className={`relative ${className}`}
      style={{
        width: scaledWidth,
        height: scaledHeight,
      }}
    >
      {/* Placeholder while loading */}
      {!loaded && !error && (
        <div
          className="absolute inset-0 bg-accent-blue/30 animate-pulse"
          style={{ imageRendering: 'pixelated' }}
        />
      )}

      {/* Error fallback */}
      {error && (
        <div
          className="absolute inset-0 bg-accent-coral/50 flex items-center justify-center"
          style={{ imageRendering: 'pixelated' }}
        >
          <div className="w-2 h-2 bg-text-dark" />
        </div>
      )}

      {/* Actual sprite image */}
      <img
        src={src}
        alt={alt}
        width={scaledWidth}
        height={scaledHeight}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`absolute inset-0 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        style={{
          imageRendering: 'pixelated',
          transition: 'opacity 100ms',
        }}
        draggable={false}
      />
    </div>
  );
}

/**
 * Placeholder sprite using CSS (no image needed)
 * Used for prototyping before real assets are ready
 */
interface PlaceholderSpriteProps {
  width: number;
  height: number;
  scale?: number;
  color: string;
  className?: string;
  hasEyes?: boolean;
  blinking?: boolean;
}

export function PlaceholderSprite({
  width,
  height,
  scale = 1,
  color,
  className = '',
  hasEyes = true,
  blinking = false,
}: PlaceholderSpriteProps) {
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  return (
    <div
      className={`relative ${className}`}
      style={{
        width: scaledWidth,
        height: scaledHeight,
        imageRendering: 'pixelated',
      }}
    >
      {/* Body */}
      <div
        className="absolute rounded-sm"
        style={{
          backgroundColor: color,
          width: scaledWidth * 0.8,
          height: scaledHeight * 0.6,
          left: scaledWidth * 0.1,
          top: scaledHeight * 0.35,
        }}
      />

      {/* Head */}
      <div
        className="absolute "
        style={{
          backgroundColor: '#F5DEB3', // skin tone
          width: scaledWidth * 0.6,
          height: scaledHeight * 0.4,
          left: scaledWidth * 0.2,
          top: scaledHeight * 0.05,
        }}
      >
        {/* Eyes */}
        {hasEyes && !blinking && (
          <>
            <div
              className="absolute bg-text-dark "
              style={{
                width: scaledWidth * 0.1,
                height: scaledHeight * 0.08,
                left: '25%',
                top: '40%',
              }}
            />
            <div
              className="absolute bg-text-dark "
              style={{
                width: scaledWidth * 0.1,
                height: scaledHeight * 0.08,
                right: '25%',
                top: '40%',
              }}
            />
          </>
        )}
        {/* Closed eyes (blinking) */}
        {hasEyes && blinking && (
          <>
            <div
              className="absolute bg-text-dark"
              style={{
                width: scaledWidth * 0.1,
                height: 2,
                left: '25%',
                top: '45%',
              }}
            />
            <div
              className="absolute bg-text-dark"
              style={{
                width: scaledWidth * 0.1,
                height: 2,
                right: '25%',
                top: '45%',
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
