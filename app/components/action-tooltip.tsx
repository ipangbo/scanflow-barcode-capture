"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { Tooltip } from "mdui/components/tooltip.js";

type TooltipPlacement = "bottom" | "bottom-end" | "left";

type ActionTooltipProps = {
  children: ReactNode;
  content: string;
  placement: TooltipPlacement;
};

const LONG_PRESS_DELAY_MS = 520;
const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

export function ActionTooltip({ children, content, placement }: ActionTooltipProps) {
  const ref = useRef<Tooltip>(null);
  const [supportsHover, setSupportsHover] = useState<boolean | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    let cancelled = false;
    const syncPointerCapability = () => {
      if (cancelled) return;
      setSupportsHover(query.matches);
    };

    void customElements.whenDefined("mdui-tooltip").then(syncPointerCapability);
    query.addEventListener("change", syncPointerCapability);
    return () => {
      cancelled = true;
      query.removeEventListener("change", syncPointerCapability);
    };
  }, []);

  useEffect(() => {
    const tooltip = ref.current;
    if (!tooltip || supportsHover === null) return;

    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    let pressOrigin: { x: number; y: number } | null = null;
    let longPressTriggered = false;
    const clearPressTimer = () => {
      if (pressTimer === null) return;
      clearTimeout(pressTimer);
      pressTimer = null;
    };
    const closeTooltip = () => {
      tooltip.open = false;
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (supportsHover || event.pointerType === "mouse" || !event.isPrimary) return;
      clearPressTimer();
      closeTooltip();
      longPressTriggered = false;
      pressOrigin = { x: event.clientX, y: event.clientY };
      pressTimer = setTimeout(() => {
        pressTimer = null;
        longPressTriggered = true;
        tooltip.open = true;
      }, LONG_PRESS_DELAY_MS);
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (!pressOrigin || pressTimer === null) return;
      if (Math.hypot(event.clientX - pressOrigin.x, event.clientY - pressOrigin.y) > LONG_PRESS_MOVE_TOLERANCE_PX) {
        clearPressTimer();
        pressOrigin = null;
      }
    };
    const handlePointerEnd = () => {
      clearPressTimer();
      pressOrigin = null;
      if (!supportsHover) closeTooltip();
    };
    const handleClick = (event: MouseEvent) => {
      closeTooltip();
      if (!longPressTriggered) return;
      longPressTriggered = false;
      event.preventDefault();
      event.stopPropagation();
    };
    const handleContextMenu = (event: MouseEvent) => {
      if (!supportsHover) event.preventDefault();
    };

    closeTooltip();
    tooltip.addEventListener("pointerdown", handlePointerDown);
    tooltip.addEventListener("pointermove", handlePointerMove);
    tooltip.addEventListener("pointerup", handlePointerEnd);
    tooltip.addEventListener("pointercancel", handlePointerEnd);
    tooltip.addEventListener("pointerleave", handlePointerEnd);
    tooltip.addEventListener("click", handleClick, true);
    tooltip.addEventListener("contextmenu", handleContextMenu);
    return () => {
      clearPressTimer();
      closeTooltip();
      tooltip.removeEventListener("pointerdown", handlePointerDown);
      tooltip.removeEventListener("pointermove", handlePointerMove);
      tooltip.removeEventListener("pointerup", handlePointerEnd);
      tooltip.removeEventListener("pointercancel", handlePointerEnd);
      tooltip.removeEventListener("pointerleave", handlePointerEnd);
      tooltip.removeEventListener("click", handleClick, true);
      tooltip.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [supportsHover]);

  return (
    <mdui-tooltip
      ref={ref}
      content={content}
      placement={placement}
      trigger={supportsHover === true ? "hover" : "manual"}
    >
      {children}
    </mdui-tooltip>
  );
}
