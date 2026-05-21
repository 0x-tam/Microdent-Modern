import type { ReactNode } from "react";

export type AppEmptyPanelProps = {
  title: string;
  body: string;
  offline?: boolean;
  actions?: ReactNode;
  className?: string;
};

/** Shared empty / offline panel — clinical wash + title + body (+ optional actions). */
export function AppEmptyPanel({ title, body, offline = false, actions, className }: AppEmptyPanelProps) {
  return (
    <div
      className={["app-empty-panel", offline ? "app-empty-panel--offline" : null, className].filter(Boolean).join(" ")}
      role="status"
    >
      <h3 className="app-empty-panel__title">{title}</h3>
      <p className="app-empty-panel__body">{body}</p>
      {actions ? <div className="app-empty-panel__actions">{actions}</div> : null}
    </div>
  );
}
