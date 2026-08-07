"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import type { Dialog } from "mdui/components/dialog.js";
import type { Select } from "mdui/components/select.js";

type MduiSelectProps = {
  className?: string;
  value: string;
  label?: string;
  ariaLabel: string;
  children: ReactNode;
  onValueChange: (value: string) => void;
};

export function MduiSelect({
  className,
  value,
  label,
  ariaLabel,
  children,
  onValueChange,
}: MduiSelectProps) {
  const ref = useRef<Select>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const handleChange = () => onValueChange(String(element.value));
    element.addEventListener("change", handleChange);
    return () => element.removeEventListener("change", handleChange);
  }, [onValueChange]);

  useEffect(() => {
    let cancelled = false;
    void customElements.whenDefined("mdui-select").then(() => {
      if (!cancelled && ref.current && ref.current.value !== value) {
        ref.current.value = value;
      }
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <mdui-select
      ref={ref}
      className={className}
      variant="outlined"
      value={value}
      label={label}
      aria-label={ariaLabel}
    >
      {children}
    </mdui-select>
  );
}

type MduiDialogProps = {
  className: string;
  ariaLabelledBy: string;
  children: ReactNode;
  onDismiss: () => void;
};

export function MduiDialog({
  className,
  ariaLabelledBy,
  children,
  onDismiss,
}: MduiDialogProps) {
  const ref = useRef<Dialog>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const handleClose = () => onDismiss();
    element.addEventListener("close", handleClose);
    return () => element.removeEventListener("close", handleClose);
  }, [onDismiss]);

  return (
    <mdui-dialog
      ref={ref}
      className={className}
      open
      close-on-esc
      close-on-overlay-click
      aria-labelledby={ariaLabelledBy}
    >
      {children}
    </mdui-dialog>
  );
}
