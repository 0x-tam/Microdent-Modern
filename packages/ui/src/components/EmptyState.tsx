import type { HTMLAttributes, ReactNode } from "react";
import { classNames } from "../util/classNames.js";

export type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  description: string;
  /** Primary / secondary actions (e.g. `<Button>`). */
  actions?: ReactNode;
};

export function EmptyState({ title, description, actions, className, ...rest }: EmptyStateProps) {
  return (
    <div className={classNames("ui-empty", className)} role="region" aria-label={title} {...rest}>
      <p className="ui-empty__title">{title}</p>
      <p className="ui-empty__desc">{description}</p>
      {actions ? <div className="ui-empty__actions">{actions}</div> : null}
    </div>
  );
}
