import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useNucleoMestreSst } from "@/hooks/useNucleoMestreSst";
import { criterioDoGrupo } from "@/lib/sstEstrutura";
import { Plus, Edit2, Trash2, AlertTriangle } from "lucide-react";

/**
 * Grupos de exposição (GES) de um Setor.
 *
 * Um setor nem sempre é um GES só: no PCP, os administrativos ficam sentados ao
 * computador e o Ajudante de Confecção movimenta material — mesma lotação,
 * exposições diferentes, dois grupos. Separar isso pela aba GES obrigava a sair
 * do setor e lembrar de cabeça quais funções eram de lá; aqui as funções do
 * próprio setor já vêm em cima, que é onde a divisão costuma acontecer.
 */
export function GruposDoSetorDialog({
  setor, open, onOpenChange,
}: {
  setor: { id: string; nome: string } | null;
  open: boolean;
  onOpenChange: (b: boolean) => void;
}) {
  const {
    gesList, funcoes, gheSetores, gheFuncoes,
    saveGes, vincularGesSetor, definirFuncoesDoGes, deleteGes,
  } = useNucleoMestreSst();

  const [editando, setEditando] = useState<any | null>(null);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  const gruposDoSetor = useMemo(() => {
    if (!setor) return [];
    const ids = new Set(
      (gheSetores as any[]).filter((v) => v.setor_id === setor.id).map((v) => v.ghe_id),
    );
    return gesList.filter((g: any) => ids.has(g.id));
  }, [gesList, gheSetores, setor]);

  /**
   * Grupos que não estão em setor nenhum.
   *
   * Sem isto eles ficavam inalcançáveis: não apareciam na lista de setor
   * algum — que é onde a tela manda ir — e o inventário só sabia dizer que o
   * grupo estava incompleto. Aparecem aqui para serem trazidos para o setor.
   */
  const gruposSemSetor = useMemo(() => {
    const comSetor = new Set(
      (gheSetores as any[]).filter((v) => v.setor_id).map((v) => v.ghe_id),
    );
    return gesList.filter((g: any) => !comSetor.has(g.id));
  }, [gesList, gheSetores]);

  const adotar = async (ges: any) => {
    if (!setor) return;
    try {
      await vincularGesSetor({ ges_id: ges.id, setor_id: setor.id, nome: setor.nome });
    } catch (err) {
      console.error(err);
    }
  };

  const funcoesDoGes = (gesId: string) => {
    const ids = new Set(
      (gheFuncoes as any[]).filter((v) => v.ghe_id === gesId && v.funcao_id).map((v) => v.funcao_id),
    );
    return funcoes.filter((f: any) => ids.has(f.id));
  };
  const gesDaFuncao = (funcaoId: string) => {
    const v = (gheFuncoes as any[]).find((x) => x.funcao_id === funcaoId);
    return v ? gesList.find((g: any) => g.id === v.ghe_id) : undefined;
  };

  /** As do setor primeiro: é entre elas que a divisão normalmente acontece. */
  const funcoesOrdenadas = useMemo(() => {
    if (!setor) return funcoes;
    const doSetor = funcoes.filter((f: any) => f.setor_id === setor.id);
    const resto = funcoes.filter((f: any) => f.setor_id !== setor.id);
    return [...doSetor, ...resto];
  }, [funcoes, setor]);

  /**
   * O texto do critério não é mais digitado nem guardado a partir do formulário:
   * ele é montado a partir do setor e das funções na hora de exibir e de gerar
   * o documento (ver `criterioDoGrupo`). Guardar uma cópia criava um texto que
   * envelhecia — mover uma função de grupo deixava o texto antigo no PGR.
   */
  const abrirNovo = () => {
    const proximo = String(
      gesList.reduce((max: number, g: any) => Math.max(max, Number(g.codigo) || 0), 0) + 1,
    ).padStart(2, "0");
    setEditando({ codigo: proximo, nome: "" });
    setSelecionadas([]);
  };

  const abrirEdicao = (ges: any) => {
    setEditando({ ...ges });
    setSelecionadas(funcoesDoGes(ges.id).map((f: any) => f.id));
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setor) return;
    setSalvando(true);
    try {
      const salvo: any = await saveGes({ ...editando, _silencioso: true } as any);
      // O grupo criado aqui já nasce ligado ao setor — sem isso ele não
      // apareceria nesta lista da próxima vez que a tela abrisse.
      await vincularGesSetor({ ges_id: salvo.id, setor_id: setor.id, nome: setor.nome });
      await definirFuncoesDoGes({ ges_id: salvo.id, funcao_ids: selecionadas });
      setEditando(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (ges: any) => {
    if (!confirm(`Excluir o grupo "${ges.nome}"? As funções dele ficam sem grupo.`)) return;
    try {
      await deleteGes(ges.id);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Grupos de exposição — {setor?.nome}</DialogTitle>
          <DialogDescription>
            Um grupo por conjunto de pessoas com a mesma exposição. Quando o setor tiver
            funções que se expõem de formas diferentes — quem opera a máquina e quem faz
            o trabalho administrativo —, crie um grupo para cada.
          </DialogDescription>
        </DialogHeader>

        {!editando && (
          <div className="space-y-3">
            {gruposDoSetor.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-400">
                Nenhum grupo neste setor ainda.
              </div>
            ) : gruposDoSetor.map((g: any) => {
              const fns = funcoesDoGes(g.id);
              return (
                <div key={g.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Badge variant="outline" className="text-indigo-600 border-indigo-200">{g.codigo}</Badge>
                      <p className="font-medium mt-1 break-words">{g.nome}</p>
                    </div>
                    <div className="flex shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => abrirEdicao(g)} aria-label="Editar grupo">
                        <Edit2 className="w-4 h-4 text-slate-600" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => excluir(g)} aria-label="Excluir grupo">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                  {/* Montado do setor e das funções agora — não é a cópia
                      guardada, que ficava velha ao mover função de grupo. */}
                  {criterioDoGrupo({
                    armazenado: g.criterio_agrupamento,
                    setorNome: setor?.nome,
                    funcoes: funcoesDoGes(g.id),
                  }) && (
                    <p className="text-xs text-slate-500 mt-1">
                      {criterioDoGrupo({
                        armazenado: g.criterio_agrupamento,
                        setorNome: setor?.nome,
                        funcoes: funcoesDoGes(g.id),
                      })}
                    </p>
                  )}
                  <div className="mt-2">
                    {fns.length === 0 ? (
                      <p className="text-xs text-amber-800">
                        Sem funções — o grupo não entra no quadro de EPIs do PGR assim.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {fns.map((f: any) => (
                          <Badge key={f.id} variant="secondary" className="text-[11px] font-normal">
                            {f.nome}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {gruposSemSetor.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50/60 p-3 space-y-2">
                <p className="text-xs text-amber-900">
                  <b>{gruposSemSetor.length}</b> {gruposSemSetor.length === 1 ? "grupo não está" : "grupos não estão"} em
                  setor nenhum — {gruposSemSetor.length === 1 ? "ele sai" : "eles saem"} sem setor e sem expostos no PGR.
                  Traga para cá {gruposSemSetor.length === 1 ? "o que for" : "os que forem"} deste setor.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {gruposSemSetor.map((g: any) => (
                    <Button key={g.id} size="sm" variant="outline"
                      className="h-7 text-xs bg-background"
                      onClick={() => adotar(g)}>
                      <Plus className="h-3 w-3 mr-1" />{g.codigo ? `${g.codigo} — ${g.nome}` : g.nome}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <Button size="sm" variant="outline" onClick={abrirNovo}>
              <Plus className="w-4 h-4 mr-1" /> Novo grupo neste setor
            </Button>
          </div>
        )}

        {editando && (
          <form onSubmit={salvar} className="space-y-4 text-sm">
            {/* Sem campo de Código: ele é sequencial e continua existindo por
                baixo (a coluna é obrigatória), mas era mais uma caixa para
                preencher sem decisão nenhuma por trás. */}
            <div>
              <Label>Nome do grupo *</Label>
              <Input value={editando.nome || ""} required
                placeholder="Ex.: Administrativo do PCP"
                onChange={(e) => setEditando({ ...editando, nome: e.target.value })} />
            </div>

            <div>
              <Label>Setor</Label>
              <p className="text-sm text-slate-600 h-10 flex items-center">{setor?.nome}</p>
            </div>

            <div>
              <Label>Funções neste grupo</Label>
              <p className="text-xs text-slate-500 mb-2">
                Uma função pertence a um grupo só. Marcar aqui a tira do grupo em que estiver.
              </p>
              {funcoesOrdenadas.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhuma função cadastrada ainda.</p>
              ) : (
                <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
                  {funcoesOrdenadas.map((f: any) => {
                    const marcada = selecionadas.includes(f.id);
                    const outro = gesDaFuncao(f.id);
                    const vemDeOutro = !marcada && outro && outro.id !== editando.id;
                    return (
                      <label key={f.id} className="flex items-start gap-2 p-2 cursor-pointer hover:bg-slate-50">
                        <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300"
                          checked={marcada}
                          onChange={(e) => setSelecionadas((prev) =>
                            e.target.checked ? [...prev, f.id] : prev.filter((id) => id !== f.id))} />
                        <span className="min-w-0">
                          <span className="block">{f.nome}</span>
                          {f.setor_id !== setor?.id && (
                            <span className="block text-[11px] text-slate-400">de outro setor</span>
                          )}
                          {vemDeOutro && (
                            <span className="block text-[11px] text-amber-700">
                              hoje está em “{outro!.nome}” — marcar move para cá
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {selecionadas.length === 0 && (
              <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Grupo sem nenhuma função. Ele fica no cadastro, mas não aparece no quadro
                  de EPIs do PGR até alguém entrar nele.
                </span>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
              <Button type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Salvar grupo"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
