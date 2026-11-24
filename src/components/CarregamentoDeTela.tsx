/*
 * O que aparece enquanto uma página abre — e se ela não puder abrir.
 *
 * Antes era um círculo girando no meio do nada e, depois de 20 s, um aviso
 * "Esta tela está demorando para carregar". Agora: o esqueleto da página
 * (o desenho dela em cinza, como em qualquer sistema de padrão alto) e, só
 * em falha de verdade, um aviso curto no visual do sistema.
 *
 * Na prática quase nunca aparece: as telas são pré-carregadas logo depois
 * do login (preCarregarTelas, em src/lib/carregarPagina.ts).
 */
import { CloudOff, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export function EsqueletoDePagina() {
  return (
    <div className="space-y-6" role="status" aria-label="Carregando página">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <Skeleton className="h-10 w-full max-w-md rounded-lg" />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
      </div>
    </div>
  );
}

export function PaginaIndisponivel({ semConexao }: { semConexao: boolean }) {
  const Icone = semConexao ? CloudOff : RefreshCw;
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4" role="alert">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Icone className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-base font-semibold text-foreground">
          {semConexao ? "Página indisponível sem conexão" : "Não foi possível abrir esta página"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {semConexao
            ? "Ela estará disponível assim que a internet voltar."
            : "Verifique sua conexão e tente novamente."}
        </p>
        {!semConexao && (
          <Button variant="outline" size="sm" className="mt-4" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Recarregar
          </Button>
        )}
      </div>
    </div>
  );
}

export const PaginaSemConexao = () => <PaginaIndisponivel semConexao />;
export const PaginaComFalha = () => <PaginaIndisponivel semConexao={false} />;
