"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { Tooltip } from "mdui/components/tooltip.js";

type TooltipPlacement = "bottom" | "bottom-end" | "left";

type HoverTooltipProps = {
  children: ReactNode;
  content: string;
  placement: TooltipPlacement;
};

export function HoverTooltip({ children, content, placement }: HoverTooltipProps) {
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
    if (!supportsHover) tooltip.open = false;
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
