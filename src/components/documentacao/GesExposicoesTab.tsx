import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useNucleoMestreSst } from "@/hooks/useNucleoMestreSst";
import type { SstGes } from "@/types/sst";
import { Layers, Plus, Edit2 } from "lucide-react";

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
  const { gesList, saveGes } = useNucleoMestreSst();

  const [openGesModal, setOpenGesModal] = useState(false);
  const [gesFormData, setGesFormData] = useState<Partial<SstGes>>({});

  const handleSaveGes = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveGes(gesFormData);
      setOpenGesModal(false);
    } catch (err) {
      console.error(err);
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
          <p className="text-sm text-slate-500 max-w-2xl">
            Um GES reúne trabalhadores expostos aos mesmos agentes, na mesma intensidade.
            Não é o mesmo que setor: pessoas de setores diferentes podem estar no mesmo GES,
            e um GES pode conter mais de uma função.
          </p>
        </div>
        <Button onClick={() => { setGesFormData({}); setOpenGesModal(true); }} size="sm" className="shrink-0">
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
                  <Button onClick={() => { setGesFormData(ges); setOpenGesModal(true); }} variant="ghost" size="sm" className="shrink-0">
                    <Edit2 className="w-4 h-4 text-slate-600" />
                  </Button>
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenGesModal(false)}>Cancelar</Button>
              <Button type="submit">Salvar grupo</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
