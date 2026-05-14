import type { HTMLAttributes, ReactNode } from "react";
import { classNames } from "../util/classNames.js";

export type ErrorStateProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  message: string;
  actions?: ReactNode;
};

export function ErrorState({ title, message, actions, className, ...rest }: ErrorStateProps) {
  return (
    <div className={classNames("ui-error", className)} role="alert" {...rest}>
      <h2 className="ui-error__title">{title}</h2>
      <p className="ui-error__message">{message}</p>
      {actions ? <div className="ui-error__actions">{actions}</div> : null}
    </div>
  );
}
