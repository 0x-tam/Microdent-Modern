import type { HTMLAttributes, ReactNode } from "react";
import { classNames } from "../util/classNames.js";

export type ReadOnlyBannerProps = HTMLAttributes<HTMLDivElement> & {
  /** Short label shown in bold (default: Read-only). */
  label?: string;
  children: ReactNode;
};

export function ReadOnlyBanner({ label = "Read-only", children, className, ...rest }: ReadOnlyBannerProps) {
  return (
    <div
      className={classNames("ui-readonly-banner", className)}
      role="status"
      aria-live="polite"
      {...rest}
    >
      <span className="ui-readonly-banner__icon" aria-hidden>
        ℹ
      </span>
      <div className="ui-readonly-banner__body">
        <strong>{label}</strong>
        <span> — {children}</span>
      </div>
    </div>
  );
}
