import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNucleoMestreSst } from "@/hooks/useNucleoMestreSst";
import { Layers, ShieldAlert, Plus, Edit2, Shield, CheckCircle, AlertTriangle } from "lucide-react";

export function GesExposicoesTab() {
  const { gesList, funcoes, ambientes, setores, exposicoes, perigosCatalogo, saveGes, saveExposicao } = useNucleoMestreSst();
  const [activeTab, setActiveTab] = useState("ges");

  // DIALOG STATES
  const [openGesModal, setOpenGesModal] = useState(false);
  const [gesFormData, setGesFormData] = useState<any>({});

  const [openExposicaoModal, setOpenExposicaoModal] = useState(false);
  const [exposicaoFormData, setExposicaoFormData] = useState<any>({
    nivel_origem: "ges",
    severidade: 3,
    probabilidade: 2,
    epi_eficacia_conclusao: "nao_avaliada",
  });

  const handleSaveGes = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveGes(gesFormData);
      setOpenGesModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveExposicao = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveExposicao(exposicaoFormData);
      setOpenExposicaoModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  const getNivelRiscoBadge = (sev?: number, prob?: number) => {
    const score = (sev || 1) * (prob || 1);
    if (score >= 15) return <Badge className="bg-red-600 text-white">Alto ({score})</Badge>;
    if (score >= 8) return <Badge className="bg-amber-500 text-white">Médio ({score})</Badge>;
    return <Badge className="bg-emerald-600 text-white">Baixo ({score})</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Layers className="w-6 h-6 text-indigo-600" />
          GES / GHE & Matriz Mestre de Exposições
        </h2>
        <p className="text-sm text-slate-500">
          O GES/GHE é um grupo técnico transversal (não dependente do setor). Configure exposições nos 6 níveis de herança.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 w-full bg-slate-100 p-1 rounded-lg">
          <TabsTrigger value="ges" className="text-xs font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4" /> Cadastro de GES / GHE Transversal
          </TabsTrigger>
          <TabsTrigger value="exposicoes" className="text-xs font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> Matriz Mestre de Exposições & Riscos
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: GES / GHE */}
        <TabsContent value="ges" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">Grupos Homogêneos de Exposição</h3>
            <Button onClick={() => { setGesFormData({}); setOpenGesModal(true); }} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-1" /> Criar Novo GES / GHE
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gesList.length === 0 ? (
              <Card className="col-span-2 p-8 text-center text-slate-400">
                Nenhum GES/GHE cadastrado no Núcleo Mestre. Clique no botão acima para adicionar.
              </Card>
            ) : (
              gesList.map((ges) => (
                <Card key={ges.id} className="border border-slate-200 shadow-sm hover:border-indigo-500 transition-all">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <Badge variant="outline" className="text-indigo-600 border-indigo-200">{ges.codigo}</Badge>
                        <CardTitle className="text-base font-bold mt-1">{ges.nome}</CardTitle>
                      </div>
                      <Button onClick={() => { setGesFormData(ges); setOpenGesModal(true); }} variant="ghost" size="sm">
                        <Edit2 className="w-4 h-4 text-slate-600" />
                      </Button>
                    </div>
                    <CardDescription className="text-xs">{ges.criterio_agrupamento || "Critério não especificado"}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    <div className="p-2 bg-slate-50 rounded border text-slate-600">
                      <strong>Descrição:</strong> {ges.descricao || "Sem observações registradas."}
                    </div>
                    <div className="flex justify-between text-slate-500 pt-1">
                      <span>Validade Inicial: {ges.validade_inicio || "-"}</span>
                      <span>Inspetor: {ges.responsavel_inspecao || "Técnico SST"}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* TAB 2: EXPOSIÇÕES & RISCOS */}
        <TabsContent value="exposicoes" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">Matriz de Exposições (Herança em 6 Níveis)</h3>
            <Button onClick={() => { setExposicaoFormData({ nivel_origem: "ges", severidade: 3, probabilidade: 2, epi_eficacia_conclusao: "nao_avaliada" }); setOpenExposicaoModal(true); }} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-1" /> Adicionar Perigo / Exposição
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Origem / Nível</TableHead>
                  <TableHead>Fonte Geradora / Perigo</TableHead>
                  <TableHead>Exposição</TableHead>
                  <TableHead>Nível de Risco (GRO)</TableHead>
                  <TableHead>EPI / Eficácia</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exposicoes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-slate-400">
                      Nenhuma exposição cadastrada na Matriz Mestre.
                    </TableCell>
                  </TableRow>
                ) : (
                  exposicoes.map((exp) => (
                    <TableRow key={exp.id}>
                      <TableCell>
                        <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200">
                          {exp.nivel_origem.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">{exp.fonte_geradora}</TableCell>
                      <TableCell><Badge variant="outline">{exp.tipo_exposicao || "habitual_permanente"}</Badge></TableCell>
                      <TableCell>{getNivelRiscoBadge(exp.severidade || 1, exp.probabilidade || 1)}</TableCell>
                      <TableCell>
                        <span className="text-xs text-slate-600">
                          {exp.epi_eficacia_conclusao === "eficaz" ? (
                            <Badge className="bg-emerald-600 text-white">Eficaz</Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-700 border-amber-300">{exp.epi_eficacia_conclusao}</Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button onClick={() => { setExposicaoFormData(exp); setOpenExposicaoModal(true); }} variant="ghost" size="sm">
                          <Edit2 className="w-4 h-4 text-slate-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL GES */}
      <Dialog open={openGesModal} onOpenChange={setOpenGesModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{gesFormData.id ? "Editar" : "Novo"} GES / GHE</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveGes} className="space-y-4 text-sm">
            <div>
              <Label>Código Identificador *</Label>
              <Input
                value={gesFormData.codigo || ""}
                onChange={(e) => setGesFormData({ ...gesFormData, codigo: e.target.value })}
                required
                placeholder="Ex: GES-01, GHE-ADM"
              />
            </div>
            <div>
              <Label>Nome do Agrupamento *</Label>
              <Input
                value={gesFormData.nome || ""}
                onChange={(e) => setGesFormData({ ...gesFormData, nome: e.target.value })}
                required
                placeholder="Ex: Equipe de Manutenção Operacional"
              />
            </div>
            <div>
              <Label>Critério Técnico de Agrupamento</Label>
              <Textarea
                value={gesFormData.criterio_agrupamento || ""}
                onChange={(e) => setGesFormData({ ...gesFormData, criterio_agrupamento: e.target.value })}
                placeholder="Ex: Exposição idêntica a Ruído e Poeiras durante a jornada em galpão fabril..."
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenGesModal(false)}>Cancelar</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">Salvar GES/GHE</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL EXPOSICAO */}
      <Dialog open={openExposicaoModal} onOpenChange={setOpenExposicaoModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{exposicaoFormData.id ? "Editar" : "Cadastrar"} Exposição na Matriz Mestre</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveExposicao} className="space-y-4 text-sm">
            <div>
              <Label>Nível de Herança de Risco *</Label>
              <Select
                value={exposicaoFormData.nivel_origem || "ges"}
                onValueChange={(val) => setExposicaoFormData({ ...exposicaoFormData, nivel_origem: val })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ges">1. Risco Comum do GES (Alcança todas as funções do GES)</SelectItem>
                  <SelectItem value="ambiente">2. Risco Específico do Ambiente</SelectItem>
                  <SelectItem value="setor">3. Risco Específico do Setor</SelectItem>
                  <SelectItem value="processo">4. Risco Específico do Processo</SelectItem>
                  <SelectItem value="funcao">5. Risco Específico da Função</SelectItem>
                  <SelectItem value="individual">6. Risco Individual (Trabalhador/Período)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {exposicaoFormData.nivel_origem === "ges" && (
              <div>
                <Label>Vincular ao GES / GHE *</Label>
                <Select
                  value={exposicaoFormData.ges_id || ""}
                  onValueChange={(val) => setExposicaoFormData({ ...exposicaoFormData, ges_id: val })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o GES..." /></SelectTrigger>
                  <SelectContent>
                    {gesList.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.codigo} - {g.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Fonte Geradora / Perigo *</Label>
              <Input
                value={exposicaoFormData.fonte_geradora || ""}
                onChange={(e) => setExposicaoFormData({ ...exposicaoFormData, fonte_geradora: e.target.value })}
                required
                placeholder="Ex: Máquina de Corte, Ruído Contínuo 88 dBA"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Severidade (1 a 5)</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={exposicaoFormData.severidade || 3}
                  onChange={(e) => setExposicaoFormData({ ...exposicaoFormData, severidade: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>Probabilidade (1 a 5)</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={exposicaoFormData.probabilidade || 2}
                  onChange={(e) => setExposicaoFormData({ ...exposicaoFormData, probabilidade: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <Label>Conclusão sobre Eficácia do EPI (Não automatizada)</Label>
              <Select
                value={exposicaoFormData.epi_eficacia_conclusao || "nao_avaliada"}
                onValueChange={(val) => setExposicaoFormData({ ...exposicaoFormData, epi_eficacia_conclusao: val })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_avaliada">Não Avaliada</SelectItem>
                  <SelectItem value="insuficiente">Insuficiente</SelectItem>
                  <SelectItem value="parcialmente_eficaz">Parcialmente Eficaz</SelectItem>
                  <SelectItem value="eficaz">Eficaz (Com C.A. válido e comprovante de entrega)</SelectItem>
                  <SelectItem value="nao_aplicavel">Não Aplicável</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Justificativa Técnica da Eficácia / Responsável</Label>
              <Textarea
                value={exposicaoFormData.justificativa_eficacia || ""}
                onChange={(e) => setExposicaoFormData({ ...exposicaoFormData, justificativa_eficacia: e.target.value })}
                placeholder="Exige ateste de higienização, treinamento e certificado C.A. ativo..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenExposicaoModal(false)}>Cancelar</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">Salvar Exposição Mestre</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
