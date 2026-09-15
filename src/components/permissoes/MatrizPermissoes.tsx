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
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ACOES, ACOES_ESPECIAIS, GRUPOS_MODULOS, MODULOS } from "@/lib/permissions";

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


interface Modulo { key: string; label: string; }

/** Um módulo por linha, com as quatro ações e as permissões específicas dele. */
function LinhaModulo({
  mod, perms, onAlternar, onAlternarModulo,
}: {
  mod: Modulo;
  perms: string[];
  onAlternar: (chave: string) => void;
  onAlternarModulo: (moduloKey: string) => void;
}) {
  const marcadas = quantasNoModulo(perms, mod.key);
  const todas = marcadas === ACOES.length;
  const especiais = ACOES_ESPECIAIS[mod.key];
  const especiaisMarcadas = (especiais || []).filter((a) =>
    perms.includes(`${mod.key}:${a.key}`),
  ).length;
  /*
   * As permissões específicas só aparecem sozinhas quando já há algo liberado
   * no módulo.
   *
   * LTCAT, PPP e eSocial têm cinco cada uma. Num módulo sem nenhuma permissão,
   * essas cinco linhas ocupavam meia tela para dizer "nada aqui" — três
   * módulos assim enchiam a rolagem inteira. Quem ainda não liberou o módulo
   * não está refinando permissão dentro dele; quando liberar, elas aparecem.
   */
  const [mostrarEspeciais, setMostrarEspeciais] = useState(
    marcadas > 0 || especiaisMarcadas > 0,
  );
  const especiaisVisiveis = mostrarEspeciais || marcadas > 0 || especiaisMarcadas > 0;

  return (
    <div
      className={`relative px-3 py-2.5 transition-colors hover:bg-muted/40 sm:grid sm:grid-cols-[1fr_repeat(4,_72px)] sm:items-center sm:gap-1 ${
        marcadas > 0 ? "bg-primary/[0.04]" : ""
      }`}
    >
      {/*
       * Faixa fina na borda, no lugar do fundo colorido cheio: numa lista
       * longa, metade das linhas pintada de laranja claro faz o olho perder
       * a referência de onde está o quê.
       */}
      {marcadas > 0 && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-primary" />}

      <label className="flex cursor-pointer items-center gap-2.5">
        {/*
         * Traço no lugar do visto quando o módulo está pela metade. Antes a
         * caixa do módulo ficava vazia com duas das quatro ações marcadas, o
         * que se lê como "nada liberado aqui".
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

      {especiais && !especiaisVisiveis && (
        <button
          type="button"
          onClick={() => setMostrarEspeciais(true)}
          className="mt-1.5 justify-self-start text-left text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground sm:col-span-full sm:ml-[26px]"
        >
          + {especiais.length} permissões específicas
        </button>
      )}

      {especiais && especiaisVisiveis && (
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
}

export default function MatrizPermissoes({ perms, onAlternar, onAlternarModulo }: Props) {
  const porChave = new Map<string, Modulo>(
    MODULOS.map((m) => [m.key as string, { key: m.key, label: m.label }]),
  );

  /*
   * Grupo começa aberto quando já tem permissão marcada.
   *
   * Vinte e quatro módulos abertos de uma vez são a parede que a tela tinha;
   * vinte e quatro fechados escondem o que a pessoa veio conferir. Abrir o
   * que já está liberado mostra de cara a situação do usuário e deixa o resto
   * quieto até alguém precisar dele.
   */
  const [abertos, setAbertos] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      GRUPOS_MODULOS.map((g) => [
        g.titulo,
        g.modulos.some((k) => quantasNoModulo(perms, k) > 0),
      ]),
    ),
  );

  const todosAbertos = GRUPOS_MODULOS.every((g) => abertos[g.titulo]);
  const alternarTodos = () =>
    setAbertos(Object.fromEntries(GRUPOS_MODULOS.map((g) => [g.titulo, !todosAbertos])));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {GRUPOS_MODULOS.length} grupos · {MODULOS.length} módulos
        </p>
        <button
          type="button"
          onClick={alternarTodos}
          className="text-xs font-medium text-primary hover:underline"
        >
          {todosAbertos ? "Recolher todos" : "Expandir todos"}
        </button>
      </div>

      {GRUPOS_MODULOS.map((grupo) => {
        const modulos = grupo.modulos
          .map((k) => porChave.get(k))
          .filter((m): m is Modulo => !!m);
        const totalAcoes = modulos.length * ACOES.length;
        const marcadas = modulos.reduce((n, m) => n + quantasNoModulo(perms, m.key), 0);
        const aberto = !!abertos[grupo.titulo];

        return (
          <div key={grupo.titulo} className="overflow-hidden rounded-lg border">
            <button
              type="button"
              onClick={() => setAbertos((a) => ({ ...a, [grupo.titulo]: !a[grupo.titulo] }))}
              aria-expanded={aberto}
              className="flex w-full items-center gap-2 bg-muted/50 px-3 py-2.5 text-left transition-colors hover:bg-muted"
            >
              <ChevronRight
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${aberto ? "rotate-90" : ""}`}
              />
              <span className="flex-1 text-sm font-semibold">{grupo.titulo}</span>
              {/*
               * O resumo é o que permite manter o grupo fechado sem perder a
               * informação: fechado e mudo, ninguém saberia que ali dentro há
               * permissão liberada.
               */}
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  marcadas > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {marcadas} de {totalAcoes}
              </span>
            </button>

            {aberto && (
              <>
                {/*
                 * Cabeçalho por grupo, e não um só no topo: com os grupos
                 * recolhíveis, um cabeçalho fixo lá em cima ficaria sobre um
                 * grupo fechado, nomeando colunas que não estão na tela.
                 */}
                <div className="hidden border-b bg-background px-3 py-1.5 sm:grid sm:grid-cols-[1fr_repeat(4,_72px)] sm:gap-1">
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
                  {modulos.map((mod) => (
                    <LinhaModulo
                      key={mod.key}
                      mod={mod}
                      perms={perms}
                      onAlternar={onAlternar}
                      onAlternarModulo={onAlternarModulo}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
