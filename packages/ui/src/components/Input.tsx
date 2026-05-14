import type { InputHTMLAttributes, ReactNode } from "react";
import { classNames } from "../util/classNames.js";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  inputId: string;
};

export function Input({ label, hint, error, inputId, className, disabled, ...rest }: InputProps) {
  const describedBy: string[] = [];
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errId = error ? `${inputId}-error` : undefined;
  if (hintId) describedBy.push(hintId);
  if (errId) describedBy.push(errId);

  return (
    <div className={classNames("ui-field", className)}>
      <label className="ui-field__label" htmlFor={inputId}>
        {label}
      </label>
      {hint ? (
        <span className="ui-field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      <input
        id={inputId}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy.length ? describedBy.join(" ") : undefined}
        className={classNames("ui-input", "ui-focusable", !!error && "ui-input--error")}
        {...rest}
      />
      {error ? (
        <span className="ui-field__error" id={errId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
