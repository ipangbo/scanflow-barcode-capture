"use client";

import { List, ScanLine } from "lucide-react";
import type { NavigationBar } from "mdui/components/navigation-bar.js";
import { useEffect, useRef } from "react";

export type MobileWorkspaceView = "scanner" | "entries";

type MobileNavigationProps = {
  value: MobileWorkspaceView;
  entryCount: number;
  onViewChange: (view: MobileWorkspaceView) => void;
};

export function MobileNavigation({
  value,
  entryCount,
  onViewChange,
}: MobileNavigationProps) {
  const ref = useRef<NavigationBar>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleChange = () => {
      const nextView: MobileWorkspaceView = element.value === "entries" ? "entries" : "scanner";
      onViewChange(nextView);
      window.requestAnimationFrame(() => {
        document.getElementById("workspace")?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          block: "start",
        });
      });
    };

    element.addEventListener("change", handleChange);
    return () => element.removeEventListener("change", handleChange);
  }, [onViewChange]);

  useEffect(() => {
    let cancelled = false;
    void customElements.whenDefined("mdui-navigation-bar").then(() => {
      if (!cancelled && ref.current && ref.current.value !== value) {
        ref.current.value = value;
      }
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <mdui-navigation-bar
      ref={ref}
      className="mobile-navigation"
      value={value}
      label-visibility="labeled"
      aria-label="Workspace views"
    >
      <mdui-navigation-bar-item value="scanner" aria-label="Scan">
        <ScanLine slot="icon" size={22} aria-hidden="true" />
        <ScanLine slot="active-icon" size={22} strokeWidth={2.7} aria-hidden="true" />
        Scan
      </mdui-navigation-bar-item>
      <mdui-navigation-bar-item value="entries" aria-label={`Entries, ${entryCount}`}>
        <List slot="icon" size={22} aria-hidden="true" />
        <List slot="active-icon" size={22} strokeWidth={2.7} aria-hidden="true" />
        {entryCount > 0 && <mdui-badge slot="badge">{entryCount > 99 ? "99+" : entryCount}</mdui-badge>}
        Entries
      </mdui-navigation-bar-item>
    </mdui-navigation-bar>
  );
}
