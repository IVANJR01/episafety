import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Info, ShieldAlert, AlertTriangle, ShieldCheck, CheckCircle2, Building2, Home, Layers, Briefcase } from "lucide-react";
import { SstEstabelecimento, SstAmbiente, SstSetor, SstProcesso, SstFuncao, SstGes, SstPerigoCatalogo } from "@/types/sst";

export function FormExposicaoDialog({
  open,
  onOpenChange,
  formData,
  setFormData,
  onSave,
  estabelecimentos = [],
  ambientes = [],
  setores = [],
  processos = [],
  gesList = [],
  funcoes = [],
  perigosCatalogo = []
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: any;
  setFormData: (data: any) => void;
  onSave: () => void;
  estabelecimentos?: SstEstabelecimento[];
  ambientes?: SstAmbiente[];
  setores?: SstSetor[];
  processos?: SstProcesso[];
  gesList?: SstGes[];
  funcoes?: SstFuncao[];
  perigosCatalogo?: SstPerigoCatalogo[];
}) {
  const [activeTab, setActiveTab] = useState("estrutura");

  // Reset tab on open
  useEffect(() => {
    if (open) {
      setActiveTab("estrutura");
      if (!formData.nivel_origem) {
        setFormData({ ...formData, nivel_origem: "ges", probabilidade: 1, severidade: 1 });
      }
    }
  }, [open]);

  // Derived calculations for GRO
  const prob = formData.probabilidade || 1;
  const sev = formData.severidade || 1;
  const total = prob * sev;
  const classif = total >= 15 ? "Alto / Crítico" : (total >= 8 ? "Moderado" : "Baixo / Trivial");
  const classifColor = total >= 15 ? "bg-red-600" : (total >= 8 ? "bg-amber-500" : "bg-emerald-500");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-indigo-900">
            <ShieldAlert className="w-5 h-5 text-indigo-600" />
            {formData.id ? "Editar Risco / Exposição Mestre" : "Novo Risco / Exposição Mestre (PGR / GRO / LTCAT)"}
          </DialogTitle>
          <DialogDescription>
            Cadastre os riscos associados à hierarquia ocupacional. Os dados alimentam o PGR, LTCAT, PCMSO e eSocial sem duplicidade.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-4 mb-4 text-xs font-semibold">
              <TabsTrigger value="estrutura" className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" /> 1. Estrutura & GES
              </TabsTrigger>
              <TabsTrigger value="agente" className="flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> 2. Agente / Perigo
              </TabsTrigger>
              <TabsTrigger value="gro" className="flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" /> 3. GRO (Matriz)
              </TabsTrigger>
              <TabsTrigger value="controles" className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> 4. Controles & EPI
              </TabsTrigger>
            </TabsList>

            {/* SEÇÃO 1: IDENTIFICAÇÃO DE ESTRUTURA, AMBIENTE, GES E SETOR */}
            <TabsContent value="estrutura" className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
                <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  1. Dados da Empresa & Estabelecimento
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Estabelecimento / Unidade *</Label>
                    <Select
                      value={formData.estabelecimento_id || (estabelecimentos[0]?.id || "")}
                      onValueChange={v => {
                        const est = estabelecimentos.find(e => e.id === v);
                        setFormData({
                          ...formData,
                          estabelecimento_id: v,
                          estabelecimento_nome: est?.nome
                        });
                      }}
                    >
                      <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione o Estabelecimento" /></SelectTrigger>
                      <SelectContent>
                        {estabelecimentos.map(e => (
                          <SelectItem key={e.id} value={e.id}>{e.nome} {(e.cnpj || e.cno) ? `(${e.cnpj || e.cno})` : ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Nível do Risco *</Label>
                    <Select
                      value={formData.nivel_origem || "ges"}
                      onValueChange={v => setFormData({ ...formData, nivel_origem: v })}
                    >
                      <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ges">GES / GHE (Grupo Todo)</SelectItem>
                        <SelectItem value="ambiente">Ambiente Específico</SelectItem>
                        <SelectItem value="setor">Setor Específico</SelectItem>
                        <SelectItem value="funcao">Função / Cargo Específico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* DESCRIÇÃO DO AMBIENTE & GES */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
                <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                  <Home className="w-4 h-4 text-indigo-600" />
                  2. Ambiente de Trabalho & Grupo (GES)
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Ambiente de Trabalho *</Label>
                    <Select
                      value={formData.ambiente_id || ""}
                      onValueChange={v => {
                        const amb = ambientes.find(a => a.id === v);
                        setFormData({
                          ...formData,
                          ambiente_id: v,
                          ambiente_nome: amb?.nome || formData.ambiente_nome
                        });
                      }}
                    >
                      <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione o Ambiente..." /></SelectTrigger>
                      <SelectContent>
                        {ambientes.map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.nome} ({a.tipo_ambiente || 'Interno'})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">GES / GHE (Grupo Homogêneo de Exposição)</Label>
                    <Select
                      value={formData.ges_id || ""}
                      onValueChange={v => {
                        const g = gesList.find(x => x.id === v);
                        setFormData({
                          ...formData,
                          ges_id: v,
                          ges_nome: g?.nome
                        });
                      }}
                    >
                      <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione o GES..." /></SelectTrigger>
                      <SelectContent>
                        {gesList.map(g => (
                          <SelectItem key={g.id} value={g.id}>{g.codigo} - {g.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Descrição Detalhada do Ambiente (Piso, Cobertura, Pé-Direito, Iluminação, Leiaute)</Label>
                  <Textarea
                    value={formData.ambiente_descricao || formData.descricao_ambiente || ""}
                    onChange={e => setFormData({ ...formData, ambiente_descricao: e.target.value })}
                    placeholder="Ex: Ambiente interno, pé-direito 3m, piso cerâmico, ventilação natural com janelas, iluminação LED..."
                    rows={2}
                    className="bg-white text-xs"
                  />
                </div>
              </div>

              {/* SETOR, PROCESSO E FUNÇÃO */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
                <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-indigo-600" />
                  3. Setor, Processo & Função Atingida
                </h4>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Setor</Label>
                    <Select
                      value={formData.setor_id || ""}
                      onValueChange={v => {
                        const s = setores.find(x => x.id === v);
                        setFormData({ ...formData, setor_id: v, setor_nome: s?.nome });
                      }}
                    >
                      <SelectTrigger className="bg-white text-xs"><SelectValue placeholder="Setor..." /></SelectTrigger>
                      <SelectContent>
                        {setores.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Processo / Etapa</Label>
                    <Select
                      value={formData.processo_id || ""}
                      onValueChange={v => {
                        const p = processos.find(x => x.id === v);
                        setFormData({ ...formData, processo_id: v, processo_nome: p?.nome });
                      }}
                    >
                      <SelectTrigger className="bg-white text-xs"><SelectValue placeholder="Processo..." /></SelectTrigger>
                      <SelectContent>
                        {processos.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Função / Cargo</Label>
                    <Select
                      value={formData.funcao_id || ""}
                      onValueChange={v => {
                        const f = funcoes.find(x => x.id === v);
                        setFormData({ ...formData, funcao_id: v, funcao_nome: f?.nome });
                      }}
                    >
                      <SelectTrigger className="bg-white text-xs"><SelectValue placeholder="Função..." /></SelectTrigger>
                      <SelectContent>
                        {funcoes.map(f => (
                          <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <Button onClick={() => setActiveTab("agente")} type="button" className="bg-indigo-600 hover:bg-indigo-700">
                  Próximo: Agente & Perigo <CheckCircle2 className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </TabsContent>

            {/* SEÇÃO 2: IDENTIFICAÇÃO DO AGENTE & PERIGO */}
            <TabsContent value="agente" className="space-y-4">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Categoria do Agente / Risco *</Label>
                  <Select
                    value={formData.agente_categoria || "fisico"}
                    onValueChange={v => setFormData({ ...formData, agente_categoria: v })}
                  >
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fisico">Físico (Ruído, Calor, Vibração...)</SelectItem>
                      <SelectItem value="quimico">Químico (Poeiras, Fumos, Solventes...)</SelectItem>
                      <SelectItem value="biologico">Biológico (Vírus, Bactérias, Fungos...)</SelectItem>
                      <SelectItem value="ergonomico">Ergonômico (Postura, Esforço, Repetitividade...)</SelectItem>
                      <SelectItem value="acidente">Acidente (Queda, Corte, Choque Elétrico...)</SelectItem>
                      <SelectItem value="periculosidade">Periculosidade (NR-16 / Inflamáveis, Explosivos)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Agente / Fator de Risco (Catálogo eSocial / Livre) *</Label>
                  <Select
                    value={formData.perigo_id || formData.fonte_geradora || ""}
                    onValueChange={v => {
                      const p = perigosCatalogo.find(c => c.id === v);
                      if (p) {
                        setFormData({
                          ...formData,
                          perigo_id: v,
                          fonte_geradora: p.nome_agente,
                          possiveis_lesoes: p.possiveis_lesoes || formData.possiveis_lesoes,
                          agente_categoria: p.categoria || formData.agente_categoria
                        });
                      } else {
                        setFormData({ ...formData, perigo_id: null, fonte_geradora: v });
                      }
                    }}
                  >
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Busque o perigo/agente..." /></SelectTrigger>
                    <SelectContent>
                      {perigosCatalogo.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.nome_agente} ({p.categoria?.toUpperCase()})</SelectItem>
                      ))}
                      {formData.fonte_geradora && !perigosCatalogo.find(p => p.nome_agente === formData.fonte_geradora) && (
                        <SelectItem value={formData.fonte_geradora}>{formData.fonte_geradora} (Manual)</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Fonte Geradora / Perigo Específico *</Label>
                <Input
                  value={formData.fonte_geradora || ""}
                  onChange={e => setFormData({ ...formData, fonte_geradora: e.target.value })}
                  placeholder="Ex: Moinho industrial de grãos, Maçarico de solda, Postura sentado prolongada"
                  className="bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Agravos Possíveis / Lesões à Saúde</Label>
                  <Input
                    value={formData.possiveis_lesoes || ""}
                    onChange={e => setFormData({ ...formData, possiveis_lesoes: e.target.value })}
                    placeholder="Ex: Perda Auditiva Induzida por Ruído (PAIR), Queimaduras, Lombalgia"
                    className="bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Tipo de Exposição</Label>
                  <Select
                    value={formData.tipo_exposicao || "habitual_permanente"}
                    onValueChange={v => setFormData({ ...formData, tipo_exposicao: v })}
                  >
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="habitual_permanente">Habitual / Permanente</SelectItem>
                      <SelectItem value="intermitente">Intermitente</SelectItem>
                      <SelectItem value="eventual">Eventual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-between mt-4">
                <Button onClick={() => setActiveTab("estrutura")} variant="outline" type="button">Voltar</Button>
                <Button onClick={() => setActiveTab("gro")} type="button" className="bg-indigo-600 hover:bg-indigo-700">
                  Próximo: Matriz GRO <CheckCircle2 className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </TabsContent>

            {/* SEÇÃO 3: GRO - AVALIAÇÃO & MATRIZ DE RISCO (NR-01) */}
            <TabsContent value="gro" className="space-y-6">
              <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg">
                <h4 className="font-semibold text-indigo-900 mb-3 flex items-center gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-indigo-600" /> Matriz de Risco Ocupacional (GRO / NR-01)
                </h4>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs font-semibold text-indigo-900">Probabilidade de Ocorrência (1 a 5)</Label>
                      <Select
                        value={prob.toString()}
                        onValueChange={v => setFormData({ ...formData, probabilidade: parseInt(v) })}
                      >
                        <SelectTrigger className="bg-white mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 - Muito Rara / Improvável</SelectItem>
                          <SelectItem value="2">2 - Rara / Ocasional</SelectItem>
                          <SelectItem value="3">3 - Possível / Frequente</SelectItem>
                          <SelectItem value="4">4 - Muito Provável</SelectItem>
                          <SelectItem value="5">5 - Contínua / Quase Certa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-indigo-900">Severidade das Lesões (1 a 5)</Label>
                      <Select
                        value={sev.toString()}
                        onValueChange={v => setFormData({ ...formData, severidade: parseInt(v) })}
                      >
                        <SelectTrigger className="bg-white mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 - Leve (sem afastamento)</SelectItem>
                          <SelectItem value="2">2 - Moderada (afastamento temporário)</SelectItem>
                          <SelectItem value="3">3 - Grave (incapacidade parcial)</SelectItem>
                          <SelectItem value="4">4 - Muito Grave (incapacidade total)</SelectItem>
                          <SelectItem value="5">5 - Fatalidade / Danos Múltiplos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center bg-white rounded-lg border border-indigo-100 p-4 text-center shadow-sm">
                    <span className="text-xs text-slate-500 font-semibold mb-1">Escore & Classificação do Risco</span>
                    <div className="text-4xl font-black text-slate-900 mb-2">{total}</div>
                    <Badge className={`text-white px-4 py-1 text-xs font-bold ${classifColor}`}>
                      {classif}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Limite de Tolerância (LT / LEO)</Label>
                  <Input
                    value={formData.limite_exposicao || ""}
                    onChange={e => setFormData({ ...formData, limite_exposicao: e.target.value })}
                    placeholder="Ex: 85 dB(A) - NR-15 / 80 dB(A) Nível Ação"
                    className="bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Intensidade / Concentração Medida</Label>
                  <Input
                    value={formData.intensidade_concentracao || ""}
                    onChange={e => setFormData({ ...formData, intensidade_concentracao: e.target.value })}
                    placeholder="Ex: 87.4 dB(A) Leq / 0.05 mg/m³"
                    className="bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-between mt-4">
                <Button onClick={() => setActiveTab("agente")} variant="outline" type="button">Voltar</Button>
                <Button onClick={() => setActiveTab("controles")} type="button" className="bg-indigo-600 hover:bg-indigo-700">
                  Próximo: Controles & EPI <CheckCircle2 className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </TabsContent>

            {/* SEÇÃO 4: CONTROLES EXISTENTES, EPC & EPI */}
            <TabsContent value="controles" className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Medidas Administrativas & Procedimentos de Segurança</Label>
                <Textarea
                  value={formData.procedimento_adm || ""}
                  onChange={e => setFormData({ ...formData, procedimento_adm: e.target.value })}
                  placeholder="Ex: Pausas de descanso a cada 2 horas, rodízio de função, treinamento de operação segura"
                  rows={2}
                  className="bg-white text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">EPC - Equipamentos de Proteção Coletiva Existentes</Label>
                <Input
                  value={formData.epc_existente || ""}
                  onChange={e => setFormData({ ...formData, epc_existente: e.target.value })}
                  placeholder="Ex: Enclausuramento acústico, sistema de exaustão local, barreira de proteção"
                  className="bg-white"
                />
              </div>

              <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg space-y-4">
                <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> EPI - Equipamento de Proteção Individual & Eficácia (eSocial / PPP)
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">EPI Recomendado / Fornecido (Nome & C.A.)</Label>
                    <Input
                      value={formData.epi_nome || ""}
                      onChange={e => setFormData({ ...formData, epi_nome: e.target.value })}
                      placeholder="Ex: Protetor Auricular Plug C.A. 11.884"
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Fator de Atenuação / Proteção</Label>
                    <Input
                      value={formData.atenuacao_fator_protecao || ""}
                      onChange={e => setFormData({ ...formData, atenuacao_fator_protecao: e.target.value })}
                      placeholder="Ex: NRRsf 18 dB"
                      className="bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Conclusão sobre a Eficácia do EPI (Exigido pelo eSocial S-2240 e PPP)</Label>
                  <Select
                    value={formData.epi_eficacia_conclusao || "nao_avaliada"}
                    onValueChange={v => setFormData({ ...formData, epi_eficacia_conclusao: v })}
                  >
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione a conclusão" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nao_aplicavel">Não Aplicável / Não Exigido</SelectItem>
                      <SelectItem value="nao_avaliada">Não Avaliada</SelectItem>
                      <SelectItem value="insuficiente">Insuficiente (Não Neutraliza a Exposição)</SelectItem>
                      <SelectItem value="parcialmente_eficaz">Parcialmente Eficaz</SelectItem>
                      <SelectItem value="eficaz">Eficaz (Neutraliza a Exposição)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-between mt-4">
                <Button onClick={() => setActiveTab("gro")} variant="outline" type="button">Voltar</Button>
                <Button onClick={() => {
                  onSave();
                  onOpenChange(false);
                }} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                  Salvar Exposição Mestre Completa
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
