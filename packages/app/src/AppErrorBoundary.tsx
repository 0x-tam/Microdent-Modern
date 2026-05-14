import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, ErrorState } from "@microdent/ui";

type AppErrorBoundaryProps = { children: ReactNode };

type AppErrorBoundaryState = { hasError: boolean; message?: string };

/**
 * Catches render errors in descendants and shows a calm {@link ErrorState} instead of a blank screen.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(err: Error): AppErrorBoundaryState {
    return { hasError: true, message: err.message };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ hasError: false, message: undefined });
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <ErrorState
          title="Something went wrong"
          message={
            this.state.message ??
            "An unexpected error occurred in this view. You can try again or reload the application."
          }
          actions={
            <Button type="button" variant="secondary" onClick={this.reset}>
              Try again
            </Button>
          }
        />
      );
    }
    return this.props.children;
  }
}
