import { useRef, useState, useCallback, useEffect, type ReactNode, type MouseEvent, type WheelEvent } from 'react';
import { useWorldState, useCamera, useTransition } from '../../state/WorldState';
import { events } from '../../state/events';

interface PanZoomCanvasProps {
  children: ReactNode;
  width?: number;
  height?: number;
}

export function PanZoomCanvas({ children, width = 800, height = 600 }: PanZoomCanvasProps) {
  const { dispatch } = useWorldState();
  const camera = useCamera();
  const transition = useTransition();

  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [cameraStart, setCameraStart] = useState({ x: 0, y: 0 });

  // Handle mouse down for panning
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    if (transition.isTransitioning) return;

    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
    setCameraStart({ x: camera.x, y: camera.y });
  }, [camera.x, camera.y, transition.isTransitioning]);

  // Handle mouse move for panning
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanning) return;

    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;

    dispatch(events.setCamera({
      x: cameraStart.x - dx / camera.zoom,
      y: cameraStart.y - dy / camera.zoom,
    }));
  }, [isPanning, panStart, cameraStart, camera.zoom, dispatch]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Handle wheel for zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    if (transition.isTransitioning) return;

    e.preventDefault();
    const newZoom = e.deltaY < 0 ? 1.5 : 1;
    if (newZoom !== camera.zoom) {
      dispatch(events.setCamera({ zoom: newZoom }));
    }
  }, [camera.zoom, dispatch, transition.isTransitioning]);

  // Global mouse up listener
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsPanning(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden bg-floor"
      style={{
        width: '100%',
        height: '100%',
        cursor: isPanning ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
    >
      {/* Transform container - single source of transforms */}
      <div
        className="absolute"
        style={{
          width,
          height,
          left: '50%',
          top: '50%',
          transform: `
            translate(-50%, -50%)
            translate(${-camera.x}px, ${-camera.y}px)
            scale(${camera.zoom})
          `,
          transformOrigin: 'center center',
          willChange: 'transform',
          transition: transition.isTransitioning
            ? 'transform 150ms ease-out'
            : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}
