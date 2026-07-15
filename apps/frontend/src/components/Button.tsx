import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
}

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "px-5 py-2.5 rounded-pill text-sm font-semibold transition-colors",
        variant === "primary" && "bg-accent text-white hover:bg-accentHover",
        variant === "secondary" && "bg-transparent border border-border text-text hover:bg-surfaceHover",
        variant === "ghost" && "bg-transparent text-muted hover:text-text",
        className
      )}
      {...props}
    />
  );
}