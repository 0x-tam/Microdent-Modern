import type { ReactNode } from "react";

export type ClinicPageProps = {
  children: ReactNode;
  className?: string;
  testId?: string;
};

/** Page root — max-width clinic workspace grid. */
export function ClinicPage({ children, className, testId }: ClinicPageProps) {
  return (
    <div className={["clinic-page", className].filter(Boolean).join(" ")} data-testid={testId}>
      {children}
    </div>
  );
}

export type ClinicPageHeroProps = {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  className?: string;
};

/** Hero band — display title, subtitle, optional right meta/chips. */
export function ClinicPageHero({ title, subtitle, meta, className }: ClinicPageHeroProps) {
  return (
    <header className={["clinic-page-hero", className].filter(Boolean).join(" ")}>
      <div className="clinic-page-hero__main">
        <h1 className="clinic-page-hero__title">{title}</h1>
        {subtitle ? <p className="clinic-page-hero__subtitle">{subtitle}</p> : null}
      </div>
      {meta ? <div className="clinic-page-hero__meta">{meta}</div> : null}
    </header>
  );
}
