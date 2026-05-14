import type { ButtonHTMLAttributes, ReactNode } from "react";
import { classNames } from "../util/classNames.js";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-outline";
export type ButtonSize = "default" | "compact";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

const variantClass: Record<ButtonVariant, string> = {
  primary: "ui-btn--primary",
  secondary: "ui-btn--secondary",
  ghost: "ui-btn--ghost",
  danger: "ui-btn--danger",
  "danger-outline": "ui-btn--danger-outline",
};

export function Button({
  variant = "primary",
  size = "default",
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classNames(
        "ui-btn",
        "ui-focusable",
        variantClass[variant],
        size === "compact" && "ui-btn--compact",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
