import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { isNetworkFailure } from "@/lib/offlineViewCache";
import { forceAppUpdate } from "@/lib/appUpdate";

type NetworkErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

type NetworkErrorBoundaryState = {
  hasError: boolean;
  isNetworkError: boolean;
  errorMessage: string | null;
};

export default class NetworkErrorBoundary extends Component<NetworkErrorBoundaryProps, NetworkErrorBoundaryState> {
  state: NetworkErrorBoundaryState = {
    hasError: false,
    isNetworkError: false,
    errorMessage: null,
  };

  static getDerivedStateFromError(error: unknown): NetworkErrorBoundaryState {
    return {
      hasError: true,
      isNetworkError: isNetworkFailure(error),
      errorMessage: error instanceof Error ? error.message : String(error ?? "Erro desconhecido"),
    };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error("[NetworkErrorBoundary]", error, errorInfo);
  }

  private retry = () => {
    this.setState({ hasError: false, isNetworkError: false, errorMessage: null });
  };

  private clearCacheAndReload = () => {
    void forceAppUpdate().catch(() => window.location.reload());
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-card px-5 py-4 text-sm text-foreground shadow-sm">
          <p className="font-semibold">Não foi possível carregar o dashboard.</p>
          <p className="mt-1 text-muted-foreground">
            {this.state.isNetworkError
              ? "A conexão com o servidor falhou. Seus dados não foram apagados."
              : "Ocorreu um erro temporário ao montar esta tela."}
          </p>
          {this.state.errorMessage && (
            <p className="mt-2 max-w-3xl break-words text-xs text-muted-foreground/80">
              Detalhe técnico: {this.state.errorMessage.slice(0, 240)}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={this.retry} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
              <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
            </button>
            <button type="button" onClick={this.clearCacheAndReload} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium">
              <Trash2 className="h-3.5 w-3.5" /> Limpar cache e atualizar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
