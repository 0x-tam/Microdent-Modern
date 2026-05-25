import type { InputHTMLAttributes, ReactNode } from "react";
import { classNames } from "../util/classNames.js";

export type InputVariant = "default" | "search";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  variant?: InputVariant;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  inputId: string;
};

export function Input({
  variant = "default",
  label,
  hint,
  error,
  inputId,
  className,
  disabled,
  ...rest
}: InputProps) {
  const describedBy: string[] = [];
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errId = error ? `${inputId}-error` : undefined;
  if (hintId) describedBy.push(hintId);
  if (errId) describedBy.push(errId);

  return (
    <div className={classNames("ui-field", className)}>
      {label && (
        <label className="ui-field__label" htmlFor={inputId}>
          {label}
        </label>
      )}
      {hint ? (
        <span className="ui-field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      <div className={classNames("ui-input__wrapper", variant === "search" && "ui-input__wrapper--search")}>
        {variant === "search" && (
          <svg className="ui-input__search-icon" viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
        <input
          id={inputId}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy.length ? describedBy.join(" ") : undefined}
          className={classNames(
            "ui-input",
            "ui-focusable",
            variant === "search" && "ui-input--search",
            !!error && "ui-input--error",
          )}
          {...rest}
        />
      </div>
      {error ? (
        <span className="ui-field__error" id={errId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
