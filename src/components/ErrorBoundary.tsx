/**
 * ErrorBoundary — catches uncaught React render errors and shows a friendly
 * recovery screen instead of a blank page.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <Studio />
 *   </ErrorBoundary>
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Optional label shown in the error card (e.g. "Studio"). */
  context?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[VibeStudio] Uncaught render error:", error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    const { children, context } = this.props;

    if (!error) return children;

    return (
      <div className="h-full flex items-center justify-center bg-vs-bg p-8">
        <div className="max-w-md w-full rounded-2xl bg-vs-surface border border-vs-border p-8 text-center space-y-4">
          <p className="text-3xl">⚠️</p>
          <h2 className="text-lg font-semibold text-vs-text">
            {context ? `${context} crashed` : "Something went wrong"}
          </h2>
          <p className="text-sm text-vs-muted leading-relaxed">
            An unexpected error occurred. Your project is safe — reload the page
            or click below to try again.
          </p>
          <pre className="text-xs text-left bg-vs-raised rounded-xl p-4 overflow-x-auto text-red-500 max-h-32">
            {error.message}
          </pre>
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm
                         font-medium transition-colors"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-vs-raised hover:bg-vs-border border
                         border-vs-border text-vs-muted hover:text-vs-text text-sm transition-colors"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
