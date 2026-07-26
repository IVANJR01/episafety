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
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                INVENTÁRIO DE RISCOS OCUPACIONAIS (NR-01 / GRO)
              </h3>
              <p className="text-xs text-slate-500">
                Identificação de perigos e classificação de riscos por GES - Grupo de Exposição Similar
              </p>
            </div>
            <Button onClick={() => { setExposicaoFormData({ nivel_origem: "ges", severidade: 3, probabilidade: 2, epi_eficacia_conclusao: "nao_avaliada" }); setOpenExposicaoModal(true); }} size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
              <Plus className="w-4 h-4 mr-1" /> Adicionar Risco ao Inventário
            </Button>
          </div>

          <div className="overflow-x-auto border border-amber-300 rounded-lg shadow-sm bg-white">
            {/* EXCEL HEADER TOP BANNER */}
            <div className="bg-amber-400 text-slate-900 p-3 text-center border-b border-amber-500">
              <div className="font-black text-sm tracking-wide uppercase">INVENTÁRIO DE RISCOS OCUPACIONAIS</div>
              <div className="text-[11px] font-bold text-slate-800">IDENTIFICAÇÃO DE PERIGOS E CLASSIFICAÇÃO DE RISCOS POR GES - GRUPO DE EXPOSIÇÃO SIMILAR</div>
            </div>

            <Table className="text-[11px] border-collapse min-w-[1400px]">
              <TableHeader>
                <TableRow className="bg-amber-300 text-slate-900 font-bold border-b border-amber-400">
                  <TableHead className="border-r border-amber-400 text-slate-900 font-extrabold w-[160px] text-center uppercase">Descrição do Ambiente</TableHead>
                  <TableHead className="border-r border-amber-400 text-slate-900 font-extrabold w-[80px] text-center uppercase">Setor</TableHead>
                  <TableHead className="border-r border-amber-400 text-slate-900 font-extrabold w-[40px] text-center uppercase">GES</TableHead>
                  <TableHead className="border-r border-amber-400 text-slate-900 font-extrabold w-[140px] text-center uppercase">Função</TableHead>
                  <TableHead className="border-r border-amber-400 text-slate-900 font-extrabold w-[140px] text-center uppercase">Processo</TableHead>
                  <TableHead className="border-r border-amber-400 text-slate-900 font-extrabold w-[90px] text-center uppercase bg-amber-400">Agente</TableHead>
                  <TableHead className="border-r border-amber-400 text-slate-900 font-extrabold w-[110px] text-center uppercase">Tipo de Agente</TableHead>
                  <TableHead className="border-r border-amber-400 text-slate-900 font-extrabold w-[120px] text-center uppercase">Perigo / Fonte Exposição</TableHead>
                  <TableHead className="border-r border-amber-400 text-slate-900 font-extrabold w-[140px] text-center uppercase">Possíveis Lesões ou Agravos à Saúde</TableHead>
                  <TableHead className="border-r border-amber-400 text-slate-900 font-extrabold w-[60px] text-center uppercase">Limite Exposição</TableHead>
                  <TableHead className="border-r border-amber-400 text-slate-900 font-extrabold w-[60px] text-center uppercase">Intens. / Conc.</TableHead>
                  <TableHead className="border-r border-amber-400 text-slate-900 font-extrabold w-[70px] text-center uppercase">Tipo / Tempo Exposição</TableHead>
                  <TableHead className="border-r border-amber-400 text-slate-900 font-extrabold w-[80px] text-center uppercase">Técnica Utilizada</TableHead>
                  <TableHead colSpan={3} className="border-r border-amber-400 text-slate-900 font-extrabold text-center uppercase bg-amber-200">MEDIDAS DE PREVENÇÃO EXISTENTES</TableHead>
                  <TableHead colSpan={4} className="text-slate-900 font-extrabold text-center uppercase bg-sky-200">CLASSIFICAÇÃO DO RISCO (GRO)</TableHead>
                </TableRow>
                <TableRow className="bg-amber-200 text-slate-800 font-bold border-b border-amber-300">
                  <TableHead colSpan={13} className="border-r border-amber-300 text-center font-bold text-[10px]">DADOS IDENTIFICADORES E AVALIAÇÃO DE EXPOSIÇÃO</TableHead>
                  <TableHead className="border-r border-amber-300 text-slate-900 text-center text-[10px] w-[140px]">Procedimento ADM / EPC / Org. Trabalho</TableHead>
                  <TableHead className="border-r border-amber-300 text-slate-900 text-center text-[10px] w-[60px]">EPI</TableHead>
                  <TableHead className="border-r border-amber-300 text-slate-900 text-center text-[10px] w-[70px]">Atenuação / Fator Proteção</TableHead>
                  <TableHead className="border-r border-amber-300 text-slate-900 text-center text-[10px] w-[40px]">PROB</TableHead>
                  <TableHead className="border-r border-amber-300 text-slate-900 text-center text-[10px] w-[40px]">SEV</TableHead>
                  <TableHead className="border-r border-amber-300 text-slate-900 text-center text-[10px] w-[40px]">TOTAL</TableHead>
                  <TableHead className="text-slate-900 text-center text-[10px] w-[90px] bg-sky-300">CLASSIFICAÇÃO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* SAMPLE / REAL INVENTORY ROWS */}
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
                  <TableCell className="p-2 align-top text-center font-extrabold bg-sky-500 text-white">
                    TRIVIAL
                  </TableCell>
                </TableRow>

                <TableRow className="hover:bg-amber-50 border-b border-slate-200">
                  <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">
                    Escritório administrativo climatizado, iluminação fluorescente LED.
                  </TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top font-bold text-center">FINANCEIRO</TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top font-bold text-center">1</TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">
                    Assistente Financeiro, Auxiliar Financeiro, Auxiliar Administrativo.
                  </TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">
                    Apurar e projetar o saldo disponível na empresa para fluxo de caixa.
                  </TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-center font-bold bg-amber-100 text-amber-900">
                    Ergonômico
                  </TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">Postura Inadequada</TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">Mobiliário e Computadores</TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">
                    Dores nos membros superiores, dor na coluna vertebral.
                  </TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-center">N.A</TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-center">N.A</TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-center">Intermitente</TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">Avaliação Qualitativa</TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">
                    Assentos padrão NR-17, suporte de monitor e apoio de pés.
                  </TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-center">N.A</TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-center">N.A</TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-center font-bold">1</TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-center font-bold">1</TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-center font-bold">1</TableCell>
                  <TableCell className="p-2 align-top text-center font-extrabold bg-sky-500 text-white">
                    TRIVIAL
                  </TableCell>
                </TableRow>

                <TableRow className="hover:bg-amber-50 border-b border-slate-200">
                  <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">
                    Setor de Recursos Humanos, ambiente climatizado.
                  </TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top font-bold text-center">SESMT</TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top font-bold text-center">1</TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">
                    Técnico em Segurança do Trabalho, Engenheiro SST.
                  </TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">
                    Vistoria nos setores da empresa e elaboração de documentos SST.
                  </TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-center font-bold bg-purple-100 text-purple-900">
                    Psicossocial
                  </TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">Excesso de Demanda</TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">Sobrecarga de Trabalho</TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">
                    Transtorno mental, estresse ocupacional, DORT.
                  </TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-center">N.A</TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-center">N.A</TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-center">Intermitente</TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">AEP Psicossocial + Entrevistas</TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-slate-700">
                    Divulgação de cartazes educativos sobre ergonomia, postura e acompanhamento.
                  </TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-center">N.A</TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-center">N.A</TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-center font-bold">3</TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-center font-bold">3</TableCell>
                  <TableCell className="border-r border-slate-200 p-2 align-top text-center font-bold">9</TableCell>
                  <TableCell className="p-2 align-top text-center font-extrabold bg-amber-400 text-slate-900">
                    MODERADO
                  </TableCell>
                </TableRow>
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
