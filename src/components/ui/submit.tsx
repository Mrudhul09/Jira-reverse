"use client";

import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass, cx } from "./index";

// A submit button that shows progress while its form's server action runs.
export function SubmitButton({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "subtle" | "danger"; size?: "sm" | "md" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" aria-busy={pending || undefined} disabled={pending || rest.disabled} className={cx(buttonClass(variant, size), className)} {...rest}>
      {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
}
