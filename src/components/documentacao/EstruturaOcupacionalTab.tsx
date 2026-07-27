import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useNucleoMestreSst } from "@/hooks/useNucleoMestreSst";
import { EnderecoEstruturado, formatarEndereco } from "@/types/sst";
import { Building2, Home, LayoutGrid, Workflow, Briefcase, Plus, Edit2, Loader2 } from "lucide-react";

type SecaoEstrutura = "estabelecimentos" | "ambientes" | "setores" | "processos" | "funcoes";

interface EstruturaProps {
  /**
   * Restringe a exibição a uma única seção. Usado pelo assistente do PGR, que
   * mostra uma etapa por vez — reaproveita os mesmos formulários em vez de
   * duplicá-los, para que a correção de um campo valha nos dois lugares.
   */
  only?: SecaoEstrutura;
}

export function EstruturaOcupacionalTab({ only }: EstruturaProps = {}) {
  const {
    estabelecimentos,
    ambientes,
    setores,
    processos,
    funcoes,
    isLoading,
    saveEstabelecimento,
    saveAmbiente,
    saveSetor,
    saveProcesso,
    saveFuncao,
  } = useNucleoMestreSst();

  const [activeSubTab, setActiveSubTab] = useState<string>(only || "estabelecimentos");

  // DIALOG STATES
  const [openModal, setOpenModal] = useState(false);
  const [modalType, setModalType] = useState<"estabelecimento" | "ambiente" | "setor" | "processo" | "funcao">("estabelecimento");
  const [formData, setFormData] = useState<any>({});

  const handleOpenModal = (type: any, item?: any) => {
    setModalType(type);
    setFormData(item || {});
    setOpenModal(true);
  };

  /** Atualiza uma sub-chave do endereço jsonb sem perder as demais. */
  const setEndereco = (campo: keyof EnderecoEstruturado, valor: string) =>
    setFormData((prev: any) => ({
      ...prev,
      endereco: { ...(prev.endereco || {}), [campo]: valor },
    }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modalType === "estabelecimento") await saveEstabelecimento(formData);
      if (modalType === "ambiente") await saveAmbiente(formData);
      if (modalType === "setor") await saveSetor(formData);
      if (modalType === "processo") await saveProcesso(formData);
      if (modalType === "funcao") await saveFuncao(formData);
      setOpenModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mb-2 text-indigo-600" />
        <span>Carregando Estrutura Ocupacional do Núcleo Mestre...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-600" />
            Estrutura Ocupacional & Organizacional Mestre
          </h2>
          <p className="text-sm text-slate-500">
            Cadastre os dados organizacionais uma única vez. Eles alimentam o PGR, PCMSO, LTCAT, Laudos e PPP sem duplicação.
          </p>
        </div>
      </div>

      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className={`grid grid-cols-5 w-full bg-slate-100 p-1 rounded-lg${only ? " hidden" : ""}`}>
          <TabsTrigger value="estabelecimentos" className="text-xs font-medium flex items-center gap-1">
            <Building2 className="w-4 h-4" /> 1. Estabelecimentos
          </TabsTrigger>
          <TabsTrigger value="ambientes" className="text-xs font-medium flex items-center gap-1">
            <Home className="w-4 h-4" /> 2. Ambientes
          </TabsTrigger>
          <TabsTrigger value="setores" className="text-xs font-medium flex items-center gap-1">
            <LayoutGrid className="w-4 h-4" /> 3. Setores
          </TabsTrigger>
          <TabsTrigger value="processos" className="text-xs font-medium flex items-center gap-1">
            <Workflow className="w-4 h-4" /> 4. Processos
          </TabsTrigger>
          <TabsTrigger value="funcoes" className="text-xs font-medium flex items-center gap-1">
            <Briefcase className="w-4 h-4" /> 5. Funções / Cargos
          </TabsTrigger>
        </TabsList>

        {/* 1. ESTABELECIMENTOS */}
        <TabsContent value="estabelecimentos" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">Unidades e Estabelecimentos (CNO / CNPJ)</h3>
            <Button onClick={() => handleOpenModal("estabelecimento")} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-1" /> Novo Estabelecimento
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome / Unidade</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>CNPJ / CNO</TableHead>
                  <TableHead>CNAE / Grau Risco</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead className="text-right">Trab.</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estabelecimentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-slate-400">
                      Nenhum estabelecimento cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  estabelecimentos.map((est) => (
                    <TableRow key={est.id}>
                      <TableCell className="font-medium text-slate-900">
                        {est.nome}
                        {est.nome_fantasia && (
                          <span className="block text-xs font-normal text-slate-500">{est.nome_fantasia}</span>
                        )}
                      </TableCell>
                      <TableCell><Badge variant="outline">{est.tipo}</Badge></TableCell>
                      <TableCell>{est.cnpj || est.cno || "-"}</TableCell>
                      <TableCell>
                        {est.cnae_principal
                          ? `${est.cnae_principal}${est.grau_risco ? ` (Grau ${est.grau_risco})` : ""}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 max-w-[220px]">
                        {formatarEndereco(est.endereco) || "-"}
                      </TableCell>
                      <TableCell className="text-right">{est.qtd_trabalhadores ?? "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button onClick={() => handleOpenModal("estabelecimento", est)} variant="ghost" size="sm">
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

        {/* 2. AMBIENTES */}
        <TabsContent value="ambientes" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">Ambientes de Trabalho (Piso, Cobertura, Iluminação, Confinado)</h3>
            <Button onClick={() => handleOpenModal("ambiente")} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-1" /> Novo Ambiente
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ambiente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Pé-Direito / Piso</TableHead>
                  <TableHead>Ventilação / Iluminação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ambientes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-slate-400">
                      Nenhum ambiente cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  ambientes.map((amb) => (
                    <TableRow key={amb.id}>
                      <TableCell className="font-medium text-slate-900">{amb.nome}</TableCell>
                      <TableCell><Badge className="bg-slate-800 text-white">{amb.tipo_ambiente}</Badge></TableCell>
                      <TableCell>{amb.pe_direito ? `Alt: ${amb.pe_direito}` : "-"} {amb.piso ? `(${amb.piso})` : ""}</TableCell>
                      <TableCell>{amb.ventilacao || "-"} / {amb.iluminacao || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button onClick={() => handleOpenModal("ambiente", amb)} variant="ghost" size="sm">
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

        {/* 3. SETORES */}
        <TabsContent value="setores" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">Setores Organizacionais</h3>
            <Button onClick={() => handleOpenModal("setor")} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-1" /> Novo Setor
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Setor</TableHead>
                  <TableHead>Ambiente Vinculado</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {setores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-slate-400">
                      Nenhum setor cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  setores.map((set) => {
                    const ambName = ambientes.find((a) => a.id === set.ambiente_id)?.nome || "Não vinculado";
                    return (
                      <TableRow key={set.id}>
                        <TableCell className="font-medium text-slate-900">{set.nome}</TableCell>
                        <TableCell>{ambName}</TableCell>
                        <TableCell>{set.responsavel_setor || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button onClick={() => handleOpenModal("setor", set)} variant="ghost" size="sm">
                            <Edit2 className="w-4 h-4 text-slate-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* 4. PROCESSOS */}
        <TabsContent value="processos" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">Processos e Atividades Operacionais</h3>
            <Button onClick={() => handleOpenModal("processo")} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-1" /> Novo Processo
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Processo</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Característica</TableHead>
                  <TableHead>Máquinas / Equipamentos</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-slate-400">
                      Nenhum processo cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  processos.map((proc) => {
                    const set = setores.find((s) => s.id === proc.setor_id);
                    return (
                      <TableRow key={proc.id}>
                        <TableCell className="font-medium text-slate-900">{proc.nome}</TableCell>
                        <TableCell>{set?.nome || "-"}</TableCell>
                        <TableCell><Badge variant="outline">{proc.caracteristica_atividade}</Badge></TableCell>
                        <TableCell>{proc.maquinas_equipamentos || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button onClick={() => handleOpenModal("processo", proc)} variant="ghost" size="sm">
                            <Edit2 className="w-4 h-4 text-slate-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* 5. FUNÇÕES */}
        <TabsContent value="funcoes" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">Funções e Cargos Mestre (CBO / NRs)</h3>
            <Button onClick={() => handleOpenModal("funcao")} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-1" /> Nova Função
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome da Função</TableHead>
                  <TableHead>CBO</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Requisitos NRs</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {funcoes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-slate-400">
                      Nenhuma função cadastrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  funcoes.map((func) => {
                    const set = setores.find((s) => s.id === func.setor_id);
                    return (
                      <TableRow key={func.id}>
                        <TableCell className="font-medium text-slate-900">{func.nome}</TableCell>
                        <TableCell>{func.cbo || "-"}</TableCell>
                        <TableCell>{set?.nome || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {func.exige_nr10 && <Badge className="bg-amber-600 text-white text-[10px]">NR-10</Badge>}
                            {func.exige_nr33 && <Badge className="bg-red-600 text-white text-[10px]">NR-33</Badge>}
                            {func.exige_nr35 && <Badge className="bg-blue-600 text-white text-[10px]">NR-35</Badge>}
                            {!func.exige_nr10 && !func.exige_nr33 && !func.exige_nr35 && <span className="text-xs text-slate-400">Padrão</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button onClick={() => handleOpenModal("funcao", func)} variant="ghost" size="sm">
                            <Edit2 className="w-4 h-4 text-slate-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG DE CADASTRO E EDIÇÃO */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {formData.id ? "Editar" : "Cadastrar"} {modalType.toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 text-sm">
            <div>
              <Label>Nome / Identificação *</Label>
              <Input
                value={formData.nome || ""}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
                placeholder={`Nome do ${modalType}`}
              />
            </div>

            {modalType === "estabelecimento" && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo de Estabelecimento</Label>
                    <Select
                      value={formData.tipo || "proprio"}
                      onValueChange={(val) => setFormData({ ...formData, tipo: val })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="proprio">Próprio (Matriz/Filial)</SelectItem>
                        <SelectItem value="terceiro">Terceiro / Cliente</SelectItem>
                        <SelectItem value="obra">Canteiro de Obra (CNO)</SelectItem>
                        <SelectItem value="administrativo">Escritório Administrativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Nome Fantasia</Label>
                    <Input
                      value={formData.nome_fantasia || ""}
                      onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
                      placeholder="Como a unidade é conhecida"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>CNPJ</Label>
                    <Input
                      value={formData.cnpj || ""}
                      onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                  <div>
                    <Label>CNO {formData.tipo === "obra" && <span className="text-red-500">*</span>}</Label>
                    <Input
                      value={formData.cno || ""}
                      onChange={(e) => setFormData({ ...formData, cno: e.target.value })}
                      placeholder="Cadastro Nacional de Obras"
                      required={formData.tipo === "obra"}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label>CNAE Principal</Label>
                    <Input
                      value={formData.cnae_principal || ""}
                      onChange={(e) => setFormData({ ...formData, cnae_principal: e.target.value })}
                      placeholder="0000-0/00"
                    />
                  </div>
                  <div>
                    <Label>Grau de Risco (NR-04)</Label>
                    <Select
                      value={formData.grau_risco ? String(formData.grau_risco) : ""}
                      onValueChange={(val) => setFormData({ ...formData, grau_risco: Number(val) })}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 — Risco baixo</SelectItem>
                        <SelectItem value="2">2 — Risco médio</SelectItem>
                        <SelectItem value="3">3 — Risco alto</SelectItem>
                        <SelectItem value="4">4 — Risco máximo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Nº de Trabalhadores</Label>
                    <Input
                      type="number"
                      min={0}
                      value={formData.qtd_trabalhadores ?? ""}
                      onChange={(e) => setFormData({
                        ...formData,
                        qtd_trabalhadores: e.target.value === "" ? null : Number(e.target.value),
                      })}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <Label>CNAEs Secundários</Label>
                  <Input
                    value={(formData.cnae_secundario || []).join(", ")}
                    onChange={(e) => setFormData({
                      ...formData,
                      cnae_secundario: e.target.value
                        .split(",").map((s: string) => s.trim()).filter(Boolean),
                    })}
                    placeholder="0000-0/00, 1111-1/11 (separados por vírgula)"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Telefone</Label>
                    <Input
                      value={formData.telefone || ""}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div>
                    <Label>E-mail</Label>
                    <Input
                      type="email"
                      value={formData.email || ""}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="unidade@empresa.com.br"
                    />
                  </div>
                </div>

                <fieldset className="border rounded-md p-3 space-y-3">
                  <legend className="px-1 text-xs font-semibold text-slate-600">Endereço</legend>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-3">
                      <Label>Logradouro</Label>
                      <Input
                        value={formData.endereco?.logradouro || ""}
                        onChange={(e) => setEndereco("logradouro", e.target.value)}
                        placeholder="Rua / Avenida"
                      />
                    </div>
                    <div>
                      <Label>Número</Label>
                      <Input
                        value={formData.endereco?.numero || ""}
                        onChange={(e) => setEndereco("numero", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Complemento</Label>
                      <Input
                        value={formData.endereco?.complemento || ""}
                        onChange={(e) => setEndereco("complemento", e.target.value)}
                        placeholder="Galpão, sala, bloco"
                      />
                    </div>
                    <div>
                      <Label>Bairro</Label>
                      <Input
                        value={formData.endereco?.bairro || ""}
                        onChange={(e) => setEndereco("bairro", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <Label>Cidade</Label>
                      <Input
                        value={formData.endereco?.cidade || ""}
                        onChange={(e) => setEndereco("cidade", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>UF</Label>
                      <Input
                        value={formData.endereco?.uf || ""}
                        onChange={(e) => setEndereco("uf", e.target.value.toUpperCase().slice(0, 2))}
                        maxLength={2}
                        placeholder="PE"
                      />
                    </div>
                    <div>
                      <Label>CEP</Label>
                      <Input
                        value={formData.endereco?.cep || ""}
                        onChange={(e) => setEndereco("cep", e.target.value)}
                        placeholder="00000-000"
                      />
                    </div>
                  </div>
                </fieldset>
              </>
            )}

            {modalType === "ambiente" && (
              <>
                <div>
                  <Label>Tipo de Ambiente</Label>
                  <Select
                    value={formData.tipo_ambiente || "interno"}
                    onValueChange={(val) => setFormData({ ...formData, tipo_ambiente: val })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="interno">Interno Fechado</SelectItem>
                      <SelectItem value="externo">Externo ao Ar Livre</SelectItem>
                      <SelectItem value="misto">Misto (Galpão Aberto)</SelectItem>
                      <SelectItem value="confinado">Espaço Confinado (NR-33)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Descrição Completa do Local</Label>
                  <Textarea
                    value={formData.descricao || ""}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Detalhe estrutura, piso, ventilação e instalações..."
                  />
                </div>
              </>
            )}

            {modalType === "setor" && (
              <div>
                <Label>Ambiente Físico Vinculado</Label>
                <Select
                  value={formData.ambiente_id || ""}
                  onValueChange={(val) => setFormData({ ...formData, ambiente_id: val })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o ambiente..." /></SelectTrigger>
                  <SelectContent>
                    {ambientes.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {modalType === "processo" && (
              <div>
                <Label>Setor Responsável *</Label>
                <Select
                  value={formData.setor_id || ""}
                  onValueChange={(val) => setFormData({ ...formData, setor_id: val })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o setor..." /></SelectTrigger>
                  <SelectContent>
                    {setores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {modalType === "funcao" && (
              <>
                <div>
                  <Label>Código CBO (Classificação Brasileira de Ocupações)</Label>
                  <Input
                    value={formData.cbo || ""}
                    onChange={(e) => setFormData({ ...formData, cbo: e.target.value })}
                    placeholder="Ex: 7152-10"
                  />
                </div>
                <div>
                  <Label>Setor Principal</Label>
                  <Select
                    value={formData.setor_id || ""}
                    onValueChange={(val) => setFormData({ ...formData, setor_id: val })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione o setor..." /></SelectTrigger>
                    <SelectContent>
                      {setores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Descrição das Atividades Desempenhadas</Label>
                  <Textarea
                    value={formData.descricao_atividades || ""}
                    onChange={(e) => setFormData({ ...formData, descricao_atividades: e.target.value })}
                    placeholder="Descreva detalhadamente a rotina de trabalho..."
                  />
                </div>
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenModal(false)}>Cancelar</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">Salvar no Núcleo Mestre</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
