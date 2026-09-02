import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  errorStack: string;
}

// Catches any crash in the component tree below it and shows the actual
// error message + stack trace on screen instead of a blank white page.
// This matters specifically for this project because the person testing
// it is on a phone browser with no easy access to desktop DevTools — so
// "the screen went blank" previously meant no way to find out why.
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: "", errorStack: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      errorMessage: error?.message || String(error),
      errorStack: error?.stack || "",
    };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("ErrorBoundary caught a crash:", error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, errorMessage: "", errorStack: "" });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            background: "#0d1416",
            color: "#e8edef",
            padding: "24px 18px",
            fontFamily: "monospace",
            boxSizing: "border-box",
          }}
        >
          <h1 style={{ fontSize: "18px", color: "#ff8f8f", marginBottom: "12px" }}>
            Something crashed
          </h1>

          <p
            style={{
              fontSize: "14px",
              lineHeight: 1.5,
              marginBottom: "16px",
              padding: "12px",
              borderRadius: "10px",
              background: "#19282f",
              border: "1px solid #293438",
              wordBreak: "break-word",
            }}
          >
            {this.state.errorMessage}
          </p>

          <button
            type="button"
            onClick={this.handleReload}
            style={{
              padding: "12px 20px",
              borderRadius: "12px",
              border: "none",
              background: "#58d8c4",
              color: "#071012",
              fontWeight: 700,
              fontSize: "14px",
              marginBottom: "20px",
              cursor: "pointer",
            }}
          >
            Reload App
          </button>

          <p style={{ fontSize: "11px", color: "#829096", marginBottom: "8px" }}>
            FULL STACK TRACE (screenshot this and send it back):
          </p>
          <pre
            style={{
              fontSize: "10px",
              color: "#829096",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              padding: "10px",
              borderRadius: "8px",
              background: "#11191c",
              border: "1px solid #202c30",
              maxHeight: "50vh",
              overflowY: "auto",
            }}
          >
            {this.state.errorStack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}