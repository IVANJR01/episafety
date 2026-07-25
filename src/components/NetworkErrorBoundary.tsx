import { Component, type ErrorInfo, type ReactNode } from "react";
import { isNetworkFailure } from "@/lib/offlineViewCache";

type NetworkErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

type NetworkErrorBoundaryState = {
  hasError: boolean;
  isNetworkError: boolean;
  errorMessage: string;
  errorStack: string;
  componentStack: string;
};

const EMPTY_STATE: NetworkErrorBoundaryState = {
  hasError: false,
  isNetworkError: false,
  errorMessage: "",
  errorStack: "",
  componentStack: "",
};

export default class NetworkErrorBoundary extends Component<NetworkErrorBoundaryProps, NetworkErrorBoundaryState> {
  state: NetworkErrorBoundaryState = EMPTY_STATE;

  static getDerivedStateFromError(error: unknown): NetworkErrorBoundaryState {
    const msg = error instanceof Error ? error.message : String(error ?? "");
    const stack = error instanceof Error ? (error.stack ?? "") : "";
    return {
      hasError: true,
      isNetworkError: isNetworkFailure(error),
      errorMessage: msg,
      errorStack: stack,
      componentStack: "",
    };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error("[NetworkErrorBoundary] Erro capturado:", error);
    console.error("[NetworkErrorBoundary] Component stack:", errorInfo.componentStack);
    this.setState({ componentStack: errorInfo.componentStack ?? "" });
  }

  componentDidUpdate(prevProps: NetworkErrorBoundaryProps) {
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState(EMPTY_STATE);
    }
  }

  handleRetry = () => {
    this.setState(EMPTY_STATE);
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="mx-auto max-w-2xl rounded-xl border border-border bg-muted/40 p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-foreground mb-1">
              {this.state.isNetworkError
                ? "Você está offline"
                : "Não foi possível atualizar esta tela agora"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {this.state.isNetworkError
                ? "Sem conexão com a internet. Exibindo os últimos dados disponíveis quando reconectar."
                : "Ocorreu um erro inesperado ao carregar esta seção. Tente novamente ou recarregue a página."}
            </p>
            {!this.state.isNetworkError && this.state.errorMessage && (
              <details className="mt-3 text-xs text-muted-foreground" open>
                <summary className="cursor-pointer hover:text-foreground">Detalhes técnicos</summary>
                <div className="mt-2 space-y-2">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1">Erro</div>
                    <pre className="whitespace-pre-wrap break-words rounded bg-background p-2 border border-border font-mono text-[10px]">
                      {this.state.errorMessage}
                    </pre>
                  </div>
                  {this.state.errorStack && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1">Stack</div>
                      <pre className="whitespace-pre-wrap break-words rounded bg-background p-2 border border-border font-mono text-[10px] max-h-64 overflow-auto">
                        {this.state.errorStack}
                      </pre>
                    </div>
                  )}
                  {this.state.componentStack && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1">Componente</div>
                      <pre className="whitespace-pre-wrap break-words rounded bg-background p-2 border border-border font-mono text-[10px] max-h-48 overflow-auto">
                        {this.state.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition"
            >
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2 rounded-md border border-border bg-background text-foreground text-sm font-medium hover:bg-muted transition"
            >
              Recarregar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
