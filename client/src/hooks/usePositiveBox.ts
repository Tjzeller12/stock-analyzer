import { useLayoutEffect, useRef, useState } from "react";

/**
 * Live pixel size of an element. Recharts warns if ResponsiveContainer
 * measures width/height as -1, so callers pass these numbers in instead.
 */
export function usePositiveBox<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height }
      );
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, width: size.width, height: size.height };
}
