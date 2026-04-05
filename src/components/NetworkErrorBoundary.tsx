import { Component, type ErrorInfo, type ReactNode } from "react";
import { isNetworkFailure } from "@/lib/offlineViewCache";

type NetworkErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

type NetworkErrorBoundaryState = {
  hasError: boolean;
  isNetworkError: boolean;
};

export default class NetworkErrorBoundary extends Component<NetworkErrorBoundaryProps, NetworkErrorBoundaryState> {
  state: NetworkErrorBoundaryState = {
    hasError: false,
    isNetworkError: false,
  };

  static getDerivedStateFromError(error: unknown): NetworkErrorBoundaryState {
    return {
      hasError: true,
      isNetworkError: isNetworkFailure(error),
    };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error("[NetworkErrorBoundary]", error, errorInfo);
  }

  componentDidUpdate(prevProps: NetworkErrorBoundaryProps) {
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false, isNetworkError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {this.state.isNetworkError
            ? "Você está offline. Exibindo os últimos dados disponíveis."
            : "Não foi possível atualizar esta tela agora."}
        </div>
      );
    }

    return this.props.children;
  }
}