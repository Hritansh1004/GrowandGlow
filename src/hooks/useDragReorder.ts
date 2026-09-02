import { useCallback, useRef, useState } from "react";

export interface UseDragReorderOptions<T> {
  items: T[];
  onReorder: (newItems: T[], fromIndex: number, toIndex: number) => void;
  edgeScrollThreshold?: number;
  edgeScrollSpeed?: number;
}

export interface DragHandleProps {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  style: React.CSSProperties;
}

export function useDragReorder<T>({
  items,
  onReorder,
  edgeScrollThreshold = 70,
  edgeScrollSpeed = 12,
}: UseDragReorderOptions<T>) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  const itemsRef = useRef(items);
  itemsRef.current = items;

  const draggingIndexRef = useRef<number | null>(null);
  const overIndexRef = useRef<number | null>(null);
  const startYRef = useRef(0);
  const rowHeightRef = useRef(56);
  const scrollRafRef = useRef<number | null>(null);
  const lastClientYRef = useRef(0);

  const moveHandlerRef = useRef<(e: PointerEvent) => void>(() => {});
  const upHandlerRef = useRef<() => void>(() => {});

  const stopAutoScroll = useCallback(() => {
    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
  }, []);

  const runAutoScrollTick = useCallback(() => {
    const clientY = lastClientYRef.current;
    const viewportH = window.innerHeight;
    let scrollBy = 0;

    if (clientY < edgeScrollThreshold) {
      const intensity = (edgeScrollThreshold - clientY) / edgeScrollThreshold;
      scrollBy = -edgeScrollSpeed * Math.max(intensity, 0.2);
    } else if (clientY > viewportH - edgeScrollThreshold) {
      const intensity = (clientY - (viewportH - edgeScrollThreshold)) / edgeScrollThreshold;
      scrollBy = edgeScrollSpeed * Math.max(intensity, 0.2);
    }

    if (scrollBy !== 0) {
      window.scrollBy(0, scrollBy);
      scrollRafRef.current = requestAnimationFrame(runAutoScrollTick);
    } else {
      scrollRafRef.current = null;
    }
  }, [edgeScrollThreshold, edgeScrollSpeed]);

  const maybeStartAutoScroll = useCallback(
    (clientY: number) => {
      lastClientYRef.current = clientY;
      const nearEdge =
        clientY < edgeScrollThreshold || clientY > window.innerHeight - edgeScrollThreshold;
      if (nearEdge && scrollRafRef.current === null) {
        scrollRafRef.current = requestAnimationFrame(runAutoScrollTick);
      } else if (!nearEdge) {
        stopAutoScroll();
      }
    },
    [edgeScrollThreshold, runAutoScrollTick, stopAutoScroll]
  );

  const endDrag = useCallback(() => {
    const from = draggingIndexRef.current;
    const to = overIndexRef.current;

    if (from !== null && to !== null && from !== to) {
      const next = [...itemsRef.current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onReorder(next, from, to);
    }

    draggingIndexRef.current = null;
    overIndexRef.current = null;
    setDraggingIndex(null);
    setOverIndex(null);
    setDragOffset(0);
    stopAutoScroll();

    window.removeEventListener("pointermove", moveHandlerRef.current);
    window.removeEventListener("pointerup", upHandlerRef.current);
    window.removeEventListener("pointercancel", upHandlerRef.current);
  }, [onReorder, stopAutoScroll]);

  const startDrag = useCallback(
    (index: number, clientY: number, rowHeight: number) => {
      draggingIndexRef.current = index;
      overIndexRef.current = index;
      setDraggingIndex(index);
      setOverIndex(index);
      startYRef.current = clientY;
      rowHeightRef.current = rowHeight || 56;

      const handleMove = (e: PointerEvent) => {
        const deltaY = e.clientY - startYRef.current;
        setDragOffset(deltaY);
        maybeStartAutoScroll(e.clientY);

        const shift = Math.round(deltaY / rowHeightRef.current);
        const from = draggingIndexRef.current ?? 0;
        const next = Math.min(
          Math.max(from + shift, 0),
          itemsRef.current.length - 1
        );
        overIndexRef.current = next;
        setOverIndex(next);
      };

      const handleUp = () => endDrag();

      moveHandlerRef.current = handleMove;
      upHandlerRef.current = handleUp;

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
      window.addEventListener("pointercancel", handleUp);
    },
    [endDrag, maybeStartAutoScroll]
  );

  const getHandleProps = useCallback(
    (index: number, rowRef?: React.RefObject<HTMLElement>): DragHandleProps => ({
      onPointerDown: (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rowHeight = rowRef?.current?.getBoundingClientRect().height ?? 56;
        startDrag(index, e.clientY, rowHeight);
      },
      style: {
        touchAction: "none",
        cursor: "grab",
      },
    }),
    [startDrag]
  );

  const getRowStyle = useCallback(
    (index: number): React.CSSProperties => {
      if (draggingIndex === null) {
        return { transition: "transform 0.15s ease" };
      }
      if (index === draggingIndex) {
        return {
          transform: `translateY(${dragOffset}px)`,
          zIndex: 20,
          opacity: 0.92,
          boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
          transition: "none",
          position: "relative",
        };
      }
      if (overIndex !== null) {
        if (draggingIndex < overIndex && index > draggingIndex && index <= overIndex) {
          return {
            transform: `translateY(-${rowHeightRef.current}px)`,
            transition: "transform 0.15s ease",
          };
        }
        if (draggingIndex > overIndex && index < draggingIndex && index >= overIndex) {
          return {
            transform: `translateY(${rowHeightRef.current}px)`,
            transition: "transform 0.15s ease",
          };
        }
      }
      return { transition: "transform 0.15s ease" };
    },
    [draggingIndex, overIndex, dragOffset]
  );

  return {
    draggingIndex,
    overIndex,
    getHandleProps,
    getRowStyle,
  };
}