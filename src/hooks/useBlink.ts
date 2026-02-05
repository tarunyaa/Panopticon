import { useState, useEffect, useRef } from 'react';

/**
 * JS-driven blink hook with random intervals.
 * Each character has independent timing (no sync).
 * Properly clears timeouts on unmount.
 */
export function useBlink(): boolean {
  const [blinking, setBlinking] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const blinkTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;

    const scheduleBlink = () => {
      // Random delay between 2-5 seconds
      const delay = 2000 + Math.random() * 3000;

      timeoutRef.current = window.setTimeout(() => {
        if (!mounted) return;

        // Start blink
        setBlinking(true);

        // End blink after 150ms
        blinkTimeoutRef.current = window.setTimeout(() => {
          if (!mounted) return;
          setBlinking(false);

          // Schedule next blink
          scheduleBlink();
        }, 150);
      }, delay);
    };

    // Start the blink cycle
    scheduleBlink();

    // Cleanup on unmount
    return () => {
      mounted = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (blinkTimeoutRef.current) {
        clearTimeout(blinkTimeoutRef.current);
      }
    };
  }, []);

  return blinking;
}
