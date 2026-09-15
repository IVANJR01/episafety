/*
 * A matriz de permissões: módulo por linha, ação por coluna.
 *
 * Saiu de dentro de UsuariosLiberados.tsx por dois motivos. O primeiro é que
 * lá ela era um bloco de 90 linhas de JSX no meio de uma tela de 1.300, e
 * ninguém conseguia olhar para ela sozinha. O segundo é consequência do
 * primeiro: para conferir o desenho era preciso entrar com um usuário
 * administrador e abrir um diálogo — agora ela renderiza sozinha, com dados
 * de mentira, e dá para ver o que a pessoa vê.
 */
import { Checkbox } from "@/components/ui/checkbox";
import { ACOES, ACOES_ESPECIAIS, MODULOS } from "@/lib/permissions";

/** "Criar / Adicionar" não cabe no cabeçalho de 72px sem quebrar em três linhas. */
const ROTULO_COLUNA: Record<string, string> = { create: "Criar" };

interface Props {
  /** As permissões atuais, no formato "modulo:acao" (ou "modulo" legado). */
  perms: string[];
  /** Liga ou desliga uma permissão. Recebe a chave inteira. */
  onAlternar: (chave: string) => void;
  /** Liga ou desliga todas as ações de um módulo de uma vez. */
  onAlternarModulo: (moduloKey: string) => void;
}

/**
 * Chave antiga, sem ação, vale por todas.
 *
 * Usuários cadastrados antes da divisão em ações guardam só "epis" no lugar
 * de "epis:view", "epis:edit"... Ignorar isso mostraria a matriz inteira
 * vazia para quem tem acesso total — e quem fosse "corrigir" acabaria
 * salvando por cima, tirando permissões que a pessoa tinha.
 */
export function temPermissao(perms: string[], modulo: string, acao: string): boolean {
  return perms.includes(modulo) || perms.includes(`${modulo}:${acao}`);
}

export function quantasNoModulo(perms: string[], modulo: string): number {
  if (perms.includes(modulo)) return ACOES.length;
  return ACOES.filter((a) => perms.includes(`${modulo}:${a.key}`)).length;
}

export default function MatrizPermissoes({ perms, onAlternar, onAlternarModulo }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border">
      {/*
       * Cabeçalho grudado no topo da rolagem: são 25 módulos, e quem chega na
       * metade da lista não lembra mais qual coluna é "Editar" e qual é
       * "Excluir" — a diferença entre as duas não é pequena.
       */}
      <div className="sticky top-0 z-10 hidden border-b bg-muted/60 px-3 py-2 backdrop-blur sm:grid sm:grid-cols-[1fr_repeat(4,_72px)] sm:gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Módulo
        </span>
        {ACOES.map((a) => (
          <span
            key={a.key}
            className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {ROTULO_COLUNA[a.key] ?? a.label}
          </span>
        ))}
      </div>

      <div className="divide-y">
        {MODULOS.map((mod) => {
          const marcadas = quantasNoModulo(perms, mod.key);
          const todas = marcadas === ACOES.length;
          const especiais = ACOES_ESPECIAIS[mod.key];

          return (
            <div
              key={mod.key}
              className={`relative px-3 py-2.5 transition-colors hover:bg-muted/40 sm:grid sm:grid-cols-[1fr_repeat(4,_72px)] sm:items-center sm:gap-1 ${
                marcadas > 0 ? "bg-primary/[0.04]" : ""
              }`}
            >
              {/*
               * Faixa fina na borda, no lugar do fundo colorido de antes: num
               * diálogo com 25 linhas, metade delas pintada de laranja claro,
               * o olho não achava mais onde estava o quê.
               */}
              {marcadas > 0 && (
                <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-primary" />
              )}

              <label className="flex cursor-pointer items-center gap-2.5">
                {/*
                 * Traço no lugar do visto quando o módulo está pela metade.
                 * Antes a caixa do módulo ficava vazia com duas das quatro
                 * ações marcadas, o que se lê como "nada liberado aqui".
                 */}
                <Checkbox
                  checked={todas ? true : marcadas > 0 ? "indeterminate" : false}
                  onCheckedChange={() => onAlternarModulo(mod.key)}
                  aria-label={`Todas as permissões de ${mod.label}`}
                />
                <span className="text-sm font-medium leading-tight">{mod.label}</span>
              </label>

              {/* Celular: cada caixa carrega o próprio rótulo, duas por linha. */}
              <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2.5 pl-[26px] sm:hidden">
                {ACOES.map((acao) => (
                  <label key={acao.key} className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={temPermissao(perms, mod.key, acao.key)}
                      onCheckedChange={() => onAlternar(`${mod.key}:${acao.key}`)}
                    />
                    <span className="text-xs text-muted-foreground">{acao.label}</span>
                  </label>
                ))}
              </div>

              {/* Telas maiores: só a caixa, sob a coluna que a nomeia. */}
              {ACOES.map((acao) => (
                <div key={acao.key} className="hidden justify-center sm:flex">
                  <Checkbox
                    checked={temPermissao(perms, mod.key, acao.key)}
                    onCheckedChange={() => onAlternar(`${mod.key}:${acao.key}`)}
                    aria-label={`${acao.label} em ${mod.label}`}
                  />
                </div>
              ))}

              {especiais && (
                <div className="mt-2.5 space-y-1.5 border-l-2 border-muted pl-3 sm:col-span-full sm:ml-[26px] sm:mt-1.5">
                  {especiais.map((acao) => (
                    <label key={acao.key} className="flex cursor-pointer items-start gap-2">
                      <Checkbox
                        checked={perms.includes(`${mod.key}:${acao.key}`)}
                        onCheckedChange={() => onAlternar(`${mod.key}:${acao.key}`)}
                        className="mt-[3px]"
                      />
                      <span className="text-xs leading-snug text-muted-foreground">{acao.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
