import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useNucleoMestreSst } from "@/hooks/useNucleoMestreSst";
import type { SstGes } from "@/types/sst";
import { useNavigate } from "react-router-dom";
import { Layers, Plus, Edit2, Trash2, ListTree } from "lucide-react";

/**
 * Cadastro dos Grupos de Exposição Similar (GES/GHE).
 *
 * Esta tela tinha três abas — "Grupos", "Riscos" e "Exposições". As duas
 * últimas gravavam a MESMA tabela (`sst_exposicoes`) pelo mesmo `saveExposicao`,
 * e essa tabela não é lida por nenhum documento: o inventário do PGR vive em
 * `pgr_inventario_itens`, editado no assistente do PGR. Ou seja, o risco
 * digitado aqui não chegava a lugar nenhum — era uma tela que parecia
 * alimentar o PGR e não alimentava.
 *
 * A aba "Riscos" ainda trazia um botão "Gerar Exemplo Base" que INSERIA
 * dados inventados no banco de produção, contrariando a regra de não criar
 * riscos/agentes de exemplo em produção.
 *
 * Sobrou o que só existe aqui e é usado de fato: o cadastro dos grupos.
 * Nenhuma tabela foi removida do banco; apenas a duplicidade saiu da tela.
 */
export function GesExposicoesTab() {
  const { gesList, saveGes, deleteGes, funcoes, gheFuncoes, definirFuncoesDoGes } = useNucleoMestreSst();
  const navigate = useNavigate();

  /** Funções de cada grupo, pelo vínculo real (ghe_funcoes.funcao_id). */
  const funcoesDoGes = (gesId: string) => {
    const ids = new Set(
      (gheFuncoes as any[]).filter((v) => v.ghe_id === gesId && v.funcao_id).map((v) => v.funcao_id),
    );
    return funcoes.filter((f: any) => ids.has(f.id));
  };
  /** Em que grupo cada função está hoje — para avisar de onde ela sairia. */
  const gesDaFuncao = (funcaoId: string) => {
    const v = (gheFuncoes as any[]).find((x) => x.funcao_id === funcaoId);
    return v ? gesList.find((g: any) => g.id === v.ghe_id) : undefined;
  };

  const [openGesModal, setOpenGesModal] = useState(false);
  const [gesFormData, setGesFormData] = useState<Partial<SstGes>>({});
  const [funcoesSelecionadas, setFuncoesSelecionadas] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState<{ id: string; nome: string } | null>(null);

  const abrirGes = (ges?: SstGes) => {
    setGesFormData(ges || {});
    setFuncoesSelecionadas(ges ? funcoesDoGes(ges.id).map((f: any) => f.id) : []);
    setOpenGesModal(true);
  };

  const handleSaveGes = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      const salvo = await saveGes(gesFormData);
      await definirFuncoesDoGes({ ges_id: (salvo as any).id, funcao_ids: funcoesSelecionadas });
      setOpenGesModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-6 h-6 text-slate-700" />
            Grupos de exposição (GES)
          </h2>
          {/* Antes esta tela era o único caminho para ter um GES, e o resultado
              prático era GES sem critério nenhum, batizados com nome de setor —
              o mesmo cadastro feito duas vezes. Cada Setor agora já cria o seu.
              A tela continua aqui para o caso que de fato justifica separar os
              dois conceitos. */}
          <p className="text-sm text-slate-500 max-w-2xl">
            Cada setor já cria o seu grupo automaticamente — normalmente não é preciso
            cadastrar nada aqui. Só crie um grupo à parte quando ele <b>não</b> for igual a
            um setor: gente de setores diferentes com a mesma exposição, ou um mesmo setor
            com exposições distintas (quem opera a máquina e quem faz o acabamento).
          </p>
        </div>
        <Button onClick={() => abrirGes()} size="sm" className="shrink-0">
          <Plus className="w-4 h-4 mr-1" /> Novo grupo
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {gesList.length === 0 ? (
          <Card className="md:col-span-2 p-8 text-center text-slate-400">
            Nenhum GES cadastrado. Clique em “Novo grupo” para adicionar.
          </Card>
        ) : (
          gesList.map((ges) => (
            <Card key={ges.id} className="border border-slate-200 shadow-sm hover:border-indigo-500 transition-all">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <Badge variant="outline" className="text-indigo-600 border-indigo-200">{ges.codigo}</Badge>
                    <CardTitle className="text-base font-bold mt-1 break-words">{ges.nome}</CardTitle>
                  </div>
                  <div className="flex shrink-0">
                    {/* Funções, riscos e EPIs deste GES. Essa tela era acessível
                        só digitando a URL: nenhum link do sistema levava até
                        ela, apesar de ser o ÚNICO lugar onde ghe_funcoes e
                        ghe_riscos podem ser editados — e o PDF do PGR, o quadro
                        de EPIs e o ASO leem justamente essas tabelas. */}
                    <Button
                      onClick={() => navigate(`/cadastro/ghe/${ges.id}/estrutura`)}
                      variant="ghost" size="sm" title="Funções, riscos e EPIs deste grupo"
                    >
                      <ListTree className="w-4 h-4 text-slate-600" />
                    </Button>
                    <Button onClick={() => abrirGes(ges)} variant="ghost" size="sm" title="Editar grupo">
                      <Edit2 className="w-4 h-4 text-slate-600" />
                    </Button>
                    <Button
                      onClick={() => setConfirmarExclusao({ id: ges.id, nome: ges.nome })}
                      variant="ghost" size="sm" title="Excluir grupo"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {/* O critério é o que separa um GES de um setor renomeado.
                    Quando falta, o card avisa e diz o que fazer, em vez de
                    estampar "Critério não especificado" e seguir. */}
                {ges.criterio_agrupamento ? (
                  <p className="text-slate-600">{ges.criterio_agrupamento}</p>
                ) : (
                  <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                    Falta dizer <b>por que</b> estas pessoas têm a mesma exposição.
                    Sem isso, o grupo é apenas um setor com outro nome.
                  </p>
                )}
                {ges.descricao && <p className="text-slate-500">{ges.descricao}</p>}
                {/* Quem está no grupo é a informação que decide se ele está
                    certo: é olhando a lista que se percebe, por exemplo, um
                    ajudante de produção junto de sete administrativos. */}
                <div>
                  <p className="text-[11px] font-medium text-slate-500 mb-1">
                    Funções neste grupo ({funcoesDoGes(ges.id).length})
                  </p>
                  {funcoesDoGes(ges.id).length === 0 ? (
                    <p className="text-amber-800">
                      Nenhuma função ainda — o grupo não entra no quadro de EPIs do PGR assim.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {funcoesDoGes(ges.id).map((f: any) => (
                        <Badge key={f.id} variant="secondary" className="text-[11px] font-normal">
                          {f.nome}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground border-t pt-4">
        Os perigos, agentes e a avaliação de risco de cada grupo são preenchidos no
        assistente do PGR, na etapa <b>Inventário de riscos</b> — é de lá que saem o PDF
        e o plano de ação.
      </p>

      <Dialog open={openGesModal} onOpenChange={setOpenGesModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{gesFormData.id ? "Editar grupo" : "Novo grupo"} de exposição</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveGes} className="space-y-4 text-sm">
            <div>
              <Label>Código *</Label>
              <Input
                value={gesFormData.codigo || ""}
                onChange={(e) => setGesFormData({ ...gesFormData, codigo: e.target.value })}
                required
                placeholder="Ex.: GES-01"
              />
            </div>
            <div>
              <Label>Nome do grupo *</Label>
              <Input
                value={gesFormData.nome || ""}
                onChange={(e) => setGesFormData({ ...gesFormData, nome: e.target.value })}
                required
                placeholder="Ex.: Equipe de manutenção mecânica"
              />
            </div>
            <div>
              <Label>Por que estas pessoas formam um grupo?</Label>
              <Textarea
                value={gesFormData.criterio_agrupamento || ""}
                onChange={(e) => setGesFormData({ ...gesFormData, criterio_agrupamento: e.target.value })}
                placeholder="Ex.: mesma exposição a ruído e óleo mineral, na mesma jornada, no galpão fabril."
              />
            </div>
            <div>
              <Label>Funções neste grupo</Label>
              <p className="text-xs text-slate-500 mb-2">
                Uma função pertence a um grupo só. Marcar aqui a tira do grupo em que estiver.
              </p>
              {funcoes.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhuma função cadastrada na Estrutura Ocupacional.</p>
              ) : (
                <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
                  {funcoes.map((f: any) => {
                    const marcada = funcoesSelecionadas.includes(f.id);
                    const outro = gesDaFuncao(f.id);
                    const vemDeOutro = !marcada && outro && outro.id !== gesFormData.id;
                    return (
                      <label key={f.id} className="flex items-start gap-2 p-2 cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300"
                          checked={marcada}
                          onChange={(e) => setFuncoesSelecionadas((prev) =>
                            e.target.checked ? [...prev, f.id] : prev.filter((id) => id !== f.id))}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm">{f.nome}</span>
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenGesModal(false)}>Cancelar</Button>
              <Button type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Salvar grupo"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmarExclusao}
        onOpenChange={(aberto) => { if (!aberto) setConfirmarExclusao(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{confirmarExclusao?.nome}”?</AlertDialogTitle>
            <AlertDialogDescription>
              O grupo sai do cadastro. Se houver trabalhadores vinculados a ele, a exclusão
              é recusada e o sistema avisa — nesse caso, mova essas pessoas para outro grupo
              antes de tentar de novo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => {
                const alvo = confirmarExclusao;
                setConfirmarExclusao(null);
                if (alvo) {
                  try { await deleteGes(alvo.id); } catch (err) { console.error(err); }
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
