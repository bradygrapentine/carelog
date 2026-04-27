"use client";

import { Component, type ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    Sentry.captureException(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center">
          <div className="bg-card border border-[var(--color-border)] rounded-xl p-8 shadow-sm text-center max-w-sm">
            <p className="text-[var(--color-ink)] font-medium mb-2">
              Something went wrong
            </p>
            <p className="text-[var(--color-muted)] text-sm mb-6">
              We ran into an unexpected problem. Try refreshing the page.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[var(--color-ink)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
