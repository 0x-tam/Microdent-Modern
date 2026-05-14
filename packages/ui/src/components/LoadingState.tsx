import type { HTMLAttributes } from "react";
import { classNames } from "../util/classNames.js";

export type LoadingStateProps = HTMLAttributes<HTMLDivElement> & {
  /** Visible label for assistive tech and sighted users. */
  label?: string;
};

export function LoadingState({ label = "Loading", className, ...rest }: LoadingStateProps) {
  return (
    <div
      className={classNames("ui-loading", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
      {...rest}
    >
      <span className="ui-loading__label">{label}</span>
      <div className="ui-loading__bars" aria-hidden>
        <div className="ui-loading__bar" />
        <div className="ui-loading__bar" />
        <div className="ui-loading__bar" />
      </div>
    </div>
  );
}
