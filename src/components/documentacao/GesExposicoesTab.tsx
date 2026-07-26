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
import { Layers, ShieldAlert, Plus, Edit2, Shield, CheckCircle, AlertTriangle, Building2 } from "lucide-react";

export function GesExposicoesTab() {
  const { gesList, funcoes, ambientes, setores, processos, estabelecimentos, exposicoes, perigosCatalogo, saveGes, saveExposicao } = useNucleoMestreSst();
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
        <TabsList className="grid grid-cols-3 w-full bg-slate-100 p-1 rounded-lg">
          <TabsTrigger value="inventario" className="text-xs font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600" /> Inventário Mestre NR-01 (Planilha)
          </TabsTrigger>
          <TabsTrigger value="ges" className="text-xs font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" /> Cadastro de GES / GHE
          </TabsTrigger>
          <TabsTrigger value="exposicoes" className="text-xs font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-600" /> Matriz Resumida de Exposições
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: INVENTÁRIO MESTRE DE RISCOS OCUPACIONAIS (EXCEL STYLE) */}
        <TabsContent value="inventario" className="mt-4 space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                INVENTÁRIO DE RISCOS OCUPACIONAIS (NR-01 / GRO)
              </h3>
              <p className="text-xs text-slate-500">
                Identificação de perigos e classificação de riscos por GES - Grupo de Exposição Similar
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  // Seed base examples if user wants initial rows
                  await saveExposicao({
                    ambiente_nome: "Ambiente de trabalho interno, pé-direito ~3m, piso cerâmico, iluminação artificial por lâmpadas fluorescentes, teto de gesso com laje.",
                    setor_nome: "PCP",
                    funcao_nome: "Supervisão de Produção, Cronometrista, Gerente de Produção, Auxiliar Adm, Assistente Fiscal",
                    processo_nome: "Gerenciamento de todo o processo produtivo da empresa",
                    agente_categoria: "ergonomico",
                    tipo_agente: "Monotonia e Repetitividade",
                    fonte_geradora: "Mobiliário, Máquina e Equipamento",
                    possiveis_lesoes: "Lesões por Esforços Repetitivos e Distúrbios Osteomusculares (DORT)",
                    limite_exposicao: "N.A",
                    intensidade_concentracao: "N.A",
                    tipo_exposicao: "intermitente",
                    tecnica_utilizada: "Avaliação Qualitativa",
                    procedimento_adm: "Revezamento do posicionamento das atividades utilizando posições diferentes",
                    epi_nome: "N.A",
                    atenuacao_fator_protecao: "N.A",
                    probabilidade: 1,
                    severidade: 1,
                    nivel_origem: "ges"
                  });
                }}
                variant="outline"
                size="sm"
                className="text-xs border-amber-400 text-amber-800 hover:bg-amber-50"
              >
                + Gerar Exemplo Base
              </Button>
              <Button onClick={() => { setExposicaoFormData({ nivel_origem: "ges", severidade: 1, probabilidade: 1, epi_eficacia_conclusao: "nao_avaliada" }); setOpenExposicaoModal(true); }} size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
                <Plus className="w-4 h-4 mr-1" /> Adicionar Risco ao Inventário
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto border border-amber-300 rounded-lg shadow-sm bg-white">
            {/* EXCEL HEADER TOP BANNER */}
            <div className="bg-amber-400 text-slate-900 p-3 text-center border-b border-amber-500">
              <div className="font-black text-sm tracking-wide uppercase">INVENTÁRIO DE RISCOS OCUPACIONAIS</div>
              <div className="text-[11px] font-bold text-slate-800">IDENTIFICAÇÃO DE PERIGOS E CLASSIFICAÇÃO DE RISCOS POR GES - GRUPO DE EXPOSIÇÃO SIMILAR</div>
            </div>

            <Table className="text-[11px] border-collapse min-w-[1500px]">
              <TableHeader>
                <TableRow className="bg-amber-300 text-slate-900 font-bold border-b border-amber-400">
                  <TableHead className="border-r border-amber-400 text-slate-900 font-extrabold w-[160px] text-center uppercase">Descrição do Ambiente</TableHead>
                  <TableHead className="border-r border-amber-400 text-slate-900 font-extrabold w-[80px] text-center uppercase">Setor</TableHead>
                  <TableHead className="border-r border-amber-400 text-slate-900 font-extrabold w-[50px] text-center uppercase">GES</TableHead>
                  <TableHead className="border-r border-amber-400 text-slate-900 font-extrabold w-[140px] text-center uppercase">Função</TableHead>
                  <TableHead className="border-r border-amber-400 text-slate-900 font-extrabold w-[140px] text-center uppercase">Processo</TableHead>
                  <TableHead className="border-r border-amber-400 text-slate-900 font-extrabold w-[90px] text-center uppercase bg-amber-400">Agente</TableHead>
                  <TableHead className="border-r border-amber-400 text-slate-900 font-extrabold w-[110px] text-center uppercase">Tipo de Agente</TableHead>
                  <TableHead className="border-r border-amber-400 text-slate-900 font-extrabold w-[120px] text-center uppercase">Perigo / Fonte Exposição</TableHead>
                  <TableHead className="border-r border-amber-400 text-slate-900 font-extrabold w-[140px] text-center uppercase">Possíveis Lesões ou Agravos À Saúde</TableHead>
                  <TableHead className="border-r border-amber-400 text-slate-900 font-extrabold w-[60px] text-center uppercase">Limite Exposição</TableHead>
                  <TableHead className="border-r border-amber-400 text-slate-900 font-extrabold w-[60px] text-center uppercase">Intens. / Conc.</TableHead>
                  <TableHead className="border-r border-amber-400 text-slate-900 font-extrabold w-[70px] text-center uppercase">Tipo / Tempo Exposição</TableHead>
                  <TableHead className="border-r border-amber-400 text-slate-900 font-extrabold w-[80px] text-center uppercase">Técnica Utilizada</TableHead>
                  <TableHead colSpan={3} className="border-r border-amber-400 text-slate-900 font-extrabold text-center uppercase bg-amber-200">MEDIDAS DE PREVENÇÃO EXISTENTES</TableHead>
                  <TableHead colSpan={4} className="border-r border-amber-400 text-slate-900 font-extrabold text-center uppercase bg-sky-200">CLASSIFICAÇÃO DO RISCO (GRO)</TableHead>
                  <TableHead className="text-slate-900 font-extrabold text-center uppercase w-[50px]">Ações</TableHead>
                </TableRow>
                <TableRow className="bg-amber-200 text-slate-800 font-bold border-b border-amber-300">
                  <TableHead colSpan={13} className="border-r border-amber-300 text-center font-bold text-[10px]">DADOS IDENTIFICADORES E AVALIAÇÃO DE EXPOSIÇÃO</TableHead>
                  <TableHead className="border-r border-amber-300 text-slate-900 text-center text-[10px] w-[140px]">Procedimento ADM / EPC / Org. Trabalho</TableHead>
                  <TableHead className="border-r border-amber-300 text-slate-900 text-center text-[10px] w-[60px]">EPI</TableHead>
                  <TableHead className="border-r border-amber-300 text-slate-900 text-center text-[10px] w-[70px]">Atenuação / Fator Proteção</TableHead>
                  <TableHead className="border-r border-amber-300 text-slate-900 text-center text-[10px] w-[40px]">PROB</TableHead>
                  <TableHead className="border-r border-amber-300 text-slate-900 text-center text-[10px] w-[40px]">SEV</TableHead>
                  <TableHead className="border-r border-amber-300 text-slate-900 text-center text-[10px] w-[40px]">TOTAL</TableHead>
                  <TableHead className="border-r border-amber-300 text-slate-900 text-center text-[10px] w-[90px] bg-sky-300">CLASSIFICAÇÃO</TableHead>
                  <TableHead className="text-center text-[10px]">-</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exposicoes.length === 0 ? (
                  <>
                    <TableRow className="hover:bg-amber-50 border-b border-slate-200">
                      <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">
                        Ambiente de trabalho interno, pé-direito ~3m, piso cerâmico, iluminação artificial por lâmpadas fluorescentes, teto de gesso com laje.
                      </TableCell>
                      <TableCell className="border-r border-slate-200 p-2 align-top font-bold text-center">PCP</TableCell>
                      <TableCell className="border-r border-slate-200 p-2 align-top font-bold text-center">1</TableCell>
                      <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">
                        Supervisão de Produção, Cronometrista, Gerente de Produção, Auxiliar Adm, Assistente Fiscal.
                      </TableCell>
                      <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">
                        Gerenciamento de todo o processo produtivo da empresa.
                      </TableCell>
                      <TableCell className="border-r border-slate-200 p-2 align-top text-center font-bold bg-amber-100 text-amber-900">
                        Ergonômico
                      </TableCell>
                      <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">Monotonia e Repetitividade</TableCell>
                      <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">Mobiliário, Máquina e Equipamento</TableCell>
                      <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">
                        Lesões por Esforços Repetitivos e Distúrbios Osteomusculares (DORT)
                      </TableCell>
                      <TableCell className="border-r border-slate-200 p-2 align-top text-center">N.A</TableCell>
                      <TableCell className="border-r border-slate-200 p-2 align-top text-center">N.A</TableCell>
                      <TableCell className="border-r border-slate-200 p-2 align-top text-center">Intermitente</TableCell>
                      <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">Avaliação Qualitativa</TableCell>
                      <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">
                        Revezamento do posicionamento das atividades utilizando posições diferentes.
                      </TableCell>
                      <TableCell className="border-r border-slate-200 p-2 align-top text-center">N.A</TableCell>
                      <TableCell className="border-r border-slate-200 p-2 align-top text-center">N.A</TableCell>
                      <TableCell className="border-r border-slate-200 p-2 align-top text-center font-bold">1</TableCell>
                      <TableCell className="border-r border-slate-200 p-2 align-top text-center font-bold">1</TableCell>
                      <TableCell className="border-r border-slate-200 p-2 align-top text-center font-bold">1</TableCell>
                      <TableCell className="border-r border-slate-200 p-2 align-top text-center font-extrabold bg-sky-500 text-white">
                        TRIVIAL
                      </TableCell>
                      <TableCell className="p-2 text-center align-top">-</TableCell>
                    </TableRow>
                  </>
                ) : (
                  exposicoes.map((exp: any) => {
                    const prob = exp.probabilidade || 1;
                    const sev = exp.severidade || 1;
                    const total = prob * sev;
                    const classif = total >= 15 ? "ALTO" : (total >= 8 ? "MODERADO" : "TRIVIAL");
                    const classifColor = total >= 15 ? "bg-red-600 text-white" : (total >= 8 ? "bg-amber-400 text-slate-900" : "bg-sky-500 text-white");

                    return (
                      <TableRow key={exp.id} className="hover:bg-amber-50 border-b border-slate-200">
                        <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">{exp.ambiente_nome || "-"}</TableCell>
                        <TableCell className="border-r border-slate-200 p-2 align-top font-bold text-center">{exp.setor_nome || "-"}</TableCell>
                        <TableCell className="border-r border-slate-200 p-2 align-top font-bold text-center">{exp.ges_id ? "GES" : "1"}</TableCell>
                        <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">{exp.funcao_nome || "-"}</TableCell>
                        <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">{exp.processo_nome || "-"}</TableCell>
                        <TableCell className="border-r border-slate-200 p-2 align-top text-center font-bold bg-amber-100 text-amber-900">
                          {exp.agente_categoria || "Ergonômico"}
                        </TableCell>
                        <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">{exp.tipo_agente || "-"}</TableCell>
                        <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">{exp.fonte_geradora || "-"}</TableCell>
                        <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">{exp.possiveis_lesoes || "-"}</TableCell>
                        <TableCell className="border-r border-slate-200 p-2 align-top text-center">{exp.limite_exposicao || "N.A"}</TableCell>
                        <TableCell className="border-r border-slate-200 p-2 align-top text-center">{exp.intensidade_concentracao || "N.A"}</TableCell>
                        <TableCell className="border-r border-slate-200 p-2 align-top text-center">{exp.tipo_exposicao || "Intermitente"}</TableCell>
                        <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">{exp.tecnica_utilizada || "Avaliação Qualitativa"}</TableCell>
                        <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">{exp.procedimento_adm || exp.medidas_existentes || "-"}</TableCell>
                        <TableCell className="border-r border-slate-200 p-2 align-top text-center">{exp.epi_nome || "N.A"}</TableCell>
                        <TableCell className="border-r border-slate-200 p-2 align-top text-center">{exp.atenuacao_fator_protecao || "N.A"}</TableCell>
                        <TableCell className="border-r border-slate-200 p-2 align-top text-center font-bold">{prob}</TableCell>
                        <TableCell className="border-r border-slate-200 p-2 align-top text-center font-bold">{sev}</TableCell>
                        <TableCell className="border-r border-slate-200 p-2 align-top text-center font-bold">{total}</TableCell>
                        <TableCell className={`border-r border-slate-200 p-2 align-top text-center font-extrabold ${classifColor}`}>
                          {classif}
                        </TableCell>
                        <TableCell className="p-2 text-center align-top">
                          <Button onClick={() => { setExposicaoFormData(exp); setOpenExposicaoModal(true); }} variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* TAB 2: GES / GHE */}
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

        {/* TAB 3: EXPOSIÇÕES & RISCOS */}
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

      {/* MODAL EXPOSICAO / INVENTÁRIO PLANILHA */}
      <Dialog open={openExposicaoModal} onOpenChange={setOpenExposicaoModal}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              {exposicaoFormData.id ? "Editar Risco" : "Cadastrar Risco"} no Inventário Mestre (Planilha NR-01)
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveExposicao} className="space-y-5 text-sm mt-2">
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs font-medium text-amber-900 flex items-center justify-between">
              <span>
                💡 <strong>Dica SST:</strong> Selecione os elementos já cadastrados na <strong>Estrutura (Ambientes, Setores, Processos, Funções)</strong> para preencher a planilha automaticamente sem redigitar!
              </span>
            </div>

            {/* SEÇÃO 1A: DADOS DA EMPRESA / ESTABELECIMENTO (reaproveita cadastro existente) */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-700" /> 1. Dados da Empresa / Estabelecimento
                </h4>
                <Badge variant="outline" className="text-[10px] bg-slate-100 border-slate-300 text-slate-700">Reaproveita cadastro</Badge>
              </div>

              {estabelecimentos.length > 0 ? (
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Estabelecimento já cadastrado (usar dados existentes)</Label>
                  <Select
                    value={exposicaoFormData.estabelecimento_id || ""}
                    onValueChange={(val) => setExposicaoFormData({ ...exposicaoFormData, estabelecimento_id: val })}
                  >
                    <SelectTrigger className="mt-1 bg-white"><SelectValue placeholder="Selecione o estabelecimento (matriz ou filial)..." /></SelectTrigger>
                    <SelectContent>
                      {estabelecimentos.map((e: any) => (
                        <SelectItem key={e.id} value={e.id}>{e.nome}{e.codigo ? ` (${e.codigo})` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Nenhum estabelecimento cadastrado ainda em <strong>Estrutura → Estabelecimentos</strong>. Cadastre lá para reaproveitar aqui automaticamente.
                </p>
              )}
            </div>

            {/* SEÇÃO 1B: DESCRIÇÃO DO AMBIENTE */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="font-bold text-xs text-indigo-900 uppercase tracking-wide flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" /> 2. Descrição do Ambiente
                </h4>
                <Badge variant="outline" className="text-[10px] bg-indigo-50 border-indigo-200 text-indigo-700">Estrutura Mestre</Badge>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Selecionar Ambiente Cadastrado (Preenchimento Rápido)</Label>
                <Select
                  onValueChange={(val) => {
                    const amb = ambientes.find((a) => a.id === val);
                    if (amb) {
                      const desc = `${amb.nome} (Pé-direito: ${amb.pe_direito || "Padrão"}, Piso: ${amb.piso || "Cerâmico/Concreto"}, Ventilação: ${amb.ventilacao || "Natural"}, Iluminação: ${amb.iluminacao || "Artificial LED"})`;
                      setExposicaoFormData({
                        ...exposicaoFormData,
                        ambiente_id: amb.id,
                        ambiente_nome: desc
                      });
                    }
                  }}
                >
                  <SelectTrigger className="mt-1 bg-white"><SelectValue placeholder="Selecione um ambiente cadastrado..." /></SelectTrigger>
                  <SelectContent>
                    {ambientes.length === 0 ? (
                      <SelectItem value="empty" disabled>Nenhum ambiente em Estrutura</SelectItem>
                    ) : (
                      ambientes.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-800">Descrição do Ambiente *</Label>
                <Textarea
                  rows={2}
                  value={exposicaoFormData.ambiente_nome || ""}
                  onChange={(e) => setExposicaoFormData({ ...exposicaoFormData, ambiente_nome: e.target.value })}
                  className="mt-1 bg-white text-xs"
                  placeholder="Ex: Ambiente de trabalho interno, pé-direito ~3m, piso cerâmico, iluminação artificial por lâmpadas fluorescentes..."
                />
              </div>
            </div>

            {/* SEÇÃO 1C: GES E SETORES */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="font-bold text-xs text-indigo-900 uppercase tracking-wide flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" /> 3. GES e Setores
                </h4>
                <Badge variant="outline" className="text-[10px] bg-indigo-50 border-indigo-200 text-indigo-700">Agrupamento Ocupacional</Badge>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Vincular a um GES / GHE (Grupo de Exposição)</Label>
                <Select
                  value={exposicaoFormData.ges_id || ""}
                  onValueChange={(val) => {
                    const selectedGes = gesList.find((g) => g.id === val);
                    setExposicaoFormData({
                      ...exposicaoFormData,
                      ges_id: val === "none" ? null : val,
                      tipo_agente: selectedGes ? `GES: ${selectedGes.codigo}` : exposicaoFormData.tipo_agente
                    });
                  }}
                >
                  <SelectTrigger className="mt-1 bg-white"><SelectValue placeholder="Selecione um GES cadastrado (opcional)..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Sem GES (Exposição Específica) --</SelectItem>
                    {gesList.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.codigo} - {g.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-bold text-slate-800">Setor *</Label>
                  <div className="flex gap-2 mt-1">
                    <Select
                      onValueChange={(val) => setExposicaoFormData({ ...exposicaoFormData, setor_nome: val })}
                    >
                      <SelectTrigger className="w-[140px] bg-white text-xs"><SelectValue placeholder="Puxar..." /></SelectTrigger>
                      <SelectContent>
                        {setores.map((s) => (
                          <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={exposicaoFormData.setor_nome || ""}
                      onChange={(e) => setExposicaoFormData({ ...exposicaoFormData, setor_nome: e.target.value })}
                      className="bg-white text-xs flex-1"
                      placeholder="Ex: PCP, Financeiro, SESMT, Costura"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-800">Processo / Atividade *</Label>
                  <div className="flex gap-2 mt-1">
                    <Select
                      onValueChange={(val) => setExposicaoFormData({ ...exposicaoFormData, processo_nome: val })}
                    >
                      <SelectTrigger className="w-[140px] bg-white text-xs"><SelectValue placeholder="Puxar..." /></SelectTrigger>
                      <SelectContent>
                        {processos.map((p) => (
                          <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={exposicaoFormData.processo_nome || ""}
                      onChange={(e) => setExposicaoFormData({ ...exposicaoFormData, processo_nome: e.target.value })}
                      className="bg-white text-xs flex-1"
                      placeholder="Ex: Gerenciamento do processo produtivo / Costura"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-800">Funções Abrangidas</Label>
                <div className="flex gap-2 mt-1">
                  <Select
                    onValueChange={(val) => {
                      const current = exposicaoFormData.funcao_nome ? `${exposicaoFormData.funcao_nome}, ${val}` : val;
                      setExposicaoFormData({ ...exposicaoFormData, funcao_nome: current });
                    }}
                  >
                    <SelectTrigger className="w-[180px] bg-white text-xs"><SelectValue placeholder="+ Adicionar Função..." /></SelectTrigger>
                    <SelectContent>
                      {funcoes.map((f) => (
                        <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={exposicaoFormData.funcao_nome || ""}
                    onChange={(e) => setExposicaoFormData({ ...exposicaoFormData, funcao_nome: e.target.value })}
                    className="bg-white text-xs flex-1"
                    placeholder="Ex: Supervisão de Produção, Cronometrista, Auxiliar Adm..."
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: RISCOS — AGENTE & PERIGO */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="font-bold text-xs text-amber-900 uppercase tracking-wide flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" /> 4. Riscos: Agente, Perigo & Danos à Saúde
                </h4>
                <Badge variant="outline" className="text-[10px] bg-amber-50 border-amber-200 text-amber-800">Perigos GRO</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-bold text-slate-800">Agente *</Label>
                  <Select
                    value={exposicaoFormData.agente_categoria || "Ergonômico"}
                    onValueChange={(val) => setExposicaoFormData({ ...exposicaoFormData, agente_categoria: val })}
                  >
                    <SelectTrigger className="mt-1 bg-white text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ergonômico">Ergonômico</SelectItem>
                      <SelectItem value="Físico">Físico</SelectItem>
                      <SelectItem value="Químico">Químico</SelectItem>
                      <SelectItem value="Biológico">Biológico</SelectItem>
                      <SelectItem value="Psicossocial">Psicossocial</SelectItem>
                      <SelectItem value="Acidente">Acidente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-bold text-slate-800">Tipo de Agente</Label>
                  <Input
                    value={exposicaoFormData.tipo_agente || ""}
                    onChange={(e) => setExposicaoFormData({ ...exposicaoFormData, tipo_agente: e.target.value })}
                    className="mt-1 bg-white text-xs"
                    placeholder="Ex: Monotonia e Repetitividade, Ruído Contínuo"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-slate-800">Perigo / Fonte Exposição *</Label>
                  <Input
                    value={exposicaoFormData.fonte_geradora || ""}
                    onChange={(e) => setExposicaoFormData({ ...exposicaoFormData, fonte_geradora: e.target.value })}
                    required
                    className="mt-1 bg-white text-xs"
                    placeholder="Ex: Mobiliário, Máquinas, Ruído 88 dB"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-800">Possíveis Lesões ou Agravos à Saúde</Label>
                <Input
                  value={exposicaoFormData.possiveis_lesoes || ""}
                  onChange={(e) => setExposicaoFormData({ ...exposicaoFormData, possiveis_lesoes: e.target.value })}
                  className="mt-1 bg-white text-xs"
                  placeholder="Ex: Lesões por Esforços Repetitivos (LER), DORT, estresse ocupacional..."
                />
              </div>
            </div>

            {/* SEÇÃO 3: EXPOSIÇÃO & MEDIDAS */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="font-bold text-xs text-emerald-900 uppercase tracking-wide flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-600" /> 5. Avaliação de Exposição & Medidas de Prevenção
                </h4>
                <Badge variant="outline" className="text-[10px] bg-emerald-50 border-emerald-200 text-emerald-800">Controles & EPI</Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Limite Exposição</Label>
                  <Input
                    value={exposicaoFormData.limite_exposicao || "N.A"}
                    onChange={(e) => setExposicaoFormData({ ...exposicaoFormData, limite_exposicao: e.target.value })}
                    className="mt-1 bg-white text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Intensidade / Conc.</Label>
                  <Input
                    value={exposicaoFormData.intensidade_concentracao || "N.A"}
                    onChange={(e) => setExposicaoFormData({ ...exposicaoFormData, intensidade_concentracao: e.target.value })}
                    className="mt-1 bg-white text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Tipo Exposição</Label>
                  <Select
                    value={exposicaoFormData.tipo_exposicao || "intermitente"}
                    onValueChange={(val) => setExposicaoFormData({ ...exposicaoFormData, tipo_exposicao: val })}
                  >
                    <SelectTrigger className="mt-1 bg-white text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intermitente">Intermitente</SelectItem>
                      <SelectItem value="habitual_permanente">Habitual e Permanente</SelectItem>
                      <SelectItem value="eventual">Eventual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Técnica Utilizada</Label>
                  <Input
                    value={exposicaoFormData.tecnica_utilizada || "Avaliação Qualitativa"}
                    onChange={(e) => setExposicaoFormData({ ...exposicaoFormData, tecnica_utilizada: e.target.value })}
                    className="mt-1 bg-white text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Procedimento ADM / EPC / Org. Trabalho</Label>
                  <Input
                    value={exposicaoFormData.procedimento_adm || ""}
                    onChange={(e) => setExposicaoFormData({ ...exposicaoFormData, procedimento_adm: e.target.value })}
                    className="mt-1 bg-white text-xs"
                    placeholder="Ex: Revezamento de posições, assentos NR-17"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">EPI</Label>
                  <Input
                    value={exposicaoFormData.epi_nome || "N.A"}
                    onChange={(e) => setExposicaoFormData({ ...exposicaoFormData, epi_nome: e.target.value })}
                    className="mt-1 bg-white text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Atenuação / Fator Proteção</Label>
                  <Input
                    value={exposicaoFormData.atenuacao_fator_protecao || "N.A"}
                    onChange={(e) => setExposicaoFormData({ ...exposicaoFormData, atenuacao_fator_protecao: e.target.value })}
                    className="mt-1 bg-white text-xs"
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO 4: MATRIZ DE RISCO (GRO) */}
            <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-4 space-y-3">
              <h4 className="font-bold text-xs text-amber-900 uppercase tracking-wide flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-amber-600" /> 6. Matriz de Risco Ocupacional (GRO)
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-bold text-slate-800">Probabilidade (1 a 5)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={exposicaoFormData.probabilidade || 1}
                    onChange={(e) => setExposicaoFormData({ ...exposicaoFormData, probabilidade: parseInt(e.target.value) || 1 })}
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-slate-800">Severidade (1 a 5)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={exposicaoFormData.severidade || 1}
                    onChange={(e) => setExposicaoFormData({ ...exposicaoFormData, severidade: parseInt(e.target.value) || 1 })}
                    className="mt-1 bg-white"
                  />
                </div>
                <div className="flex flex-col justify-center items-center bg-white p-2 rounded-lg border border-amber-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Cálculo Risco</span>
                  <span className="text-sm font-black text-amber-900">
                    Prob ({(exposicaoFormData.probabilidade || 1)}) x Sev ({(exposicaoFormData.severidade || 1)}) = {(exposicaoFormData.probabilidade || 1) * (exposicaoFormData.severidade || 1)}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setOpenExposicaoModal(false)}>Cancelar</Button>
              <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-6">
                Salvar no Inventário Planilha
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
