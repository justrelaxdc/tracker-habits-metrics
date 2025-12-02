import { Component, type ComponentChild } from "preact";
import { CSS_CLASSES, ERROR_MESSAGES } from "../../constants";
import { logError } from "../../utils/notifications";

interface ErrorBoundaryProps {
  children: ComponentChild;
  fallback?: ComponentChild;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary component to catch errors in tracker items
 * Prevents one broken tracker from crashing the entire block
 * Note: Preact 10+ supports error boundaries via componentDidCatch
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    // Log error for debugging
    logError("TrackerItem error boundary", error);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div class={CSS_CLASSES.ERROR}>
          {ERROR_MESSAGES.RENDER_ERROR}: {this.state.error?.message || "Unknown error"}
        </div>
      );
    }

    return this.props.children;
  }
}

