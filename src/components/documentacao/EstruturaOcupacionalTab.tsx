import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useNucleoMestreSst } from "@/hooks/useNucleoMestreSst";
import { EnderecoEstruturado, formatarEndereco } from "@/types/sst";
import { Building2, Home, LayoutGrid, Workflow, Briefcase, ClipboardList, Plus, Edit2, Loader2, Trash2 } from "lucide-react";

type SecaoEstrutura = "estabelecimentos" | "ambientes" | "setores" | "processos" | "funcoes" | "atividades";

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
    atividades,
    isLoading,
    saveEstabelecimento,
    saveAmbiente,
    saveSetor,
    saveProcesso,
    saveFuncao,
    saveAtividade,
    deleteEstabelecimento,
    deleteAmbiente,
    deleteSetor,
    deleteProcesso,
    deleteFuncao,
    deleteAtividade,
  } = useNucleoMestreSst();

  const [activeSubTab, setActiveSubTab] = useState<string>(only || "estabelecimentos");

  // DIALOG STATES
  const [openModal, setOpenModal] = useState(false);
  const [modalType, setModalType] = useState<"estabelecimento" | "ambiente" | "setor" | "processo" | "funcao" | "atividade">("estabelecimento");
  const [formData, setFormData] = useState<any>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; type: string; id: string; nome: string }>({
    open: false,
    type: "",
    id: "",
    nome: "",
  });

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
      if (modalType === "atividade") await saveAtividade(formData);
      setOpenModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    try {
      if (deleteConfirm.type === "estabelecimento") await deleteEstabelecimento(deleteConfirm.id);
      if (deleteConfirm.type === "ambiente") await deleteAmbiente(deleteConfirm.id);
      if (deleteConfirm.type === "setor") await deleteSetor(deleteConfirm.id);
      if (deleteConfirm.type === "processo") await deleteProcesso(deleteConfirm.id);
      if (deleteConfirm.type === "funcao") await deleteFuncao(deleteConfirm.id);
      if (deleteConfirm.type === "atividade") await deleteAtividade(deleteConfirm.id);
      setDeleteConfirm({ open: false, type: "", id: "", nome: "" });
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
    <div className={only ? "" : "space-y-6"}>
      {/* Cabeçalho e barra de abas só existem na tela cheia de Documentação.
          No assistente, cada etapa monta duas seções (ex.: Ambientes +
          Processos) e o cabeçalho aparecia duplicado, junto de duas barras de
          6 abas que nem navegam — a etapa já tem título próprio.
          É renderização condicional, não `hidden`: a classe perdia para o
          `grid` na cascata do Tailwind e a barra aparecia mesmo assim. */}
      {!only && (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-indigo-600" />
              Estrutura Ocupacional
            </h2>
            <p className="text-sm text-slate-500">
              Cadastre uma única vez. Estes dados alimentam PGR, PCMSO, LTCAT, Laudos e PPP.
            </p>
          </div>
        </div>
      )}

      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        {!only && (
          <TabsList className="grid grid-cols-3 lg:grid-cols-6 w-full bg-slate-100 p-1 rounded-lg h-auto">
            <TabsTrigger value="estabelecimentos" className="text-xs font-medium flex items-center gap-1">
              <Building2 className="w-4 h-4" /> Estabelecimentos
            </TabsTrigger>
            <TabsTrigger value="ambientes" className="text-xs font-medium flex items-center gap-1">
              <Home className="w-4 h-4" /> Ambientes
            </TabsTrigger>
            <TabsTrigger value="setores" className="text-xs font-medium flex items-center gap-1">
              <LayoutGrid className="w-4 h-4" /> Setores
            </TabsTrigger>
            <TabsTrigger value="processos" className="text-xs font-medium flex items-center gap-1">
              <Workflow className="w-4 h-4" /> Processos
            </TabsTrigger>
            <TabsTrigger value="funcoes" className="text-xs font-medium flex items-center gap-1">
              <Briefcase className="w-4 h-4" /> Funções
            </TabsTrigger>
            <TabsTrigger value="atividades" className="text-xs font-medium flex items-center gap-1">
              <ClipboardList className="w-4 h-4" /> Atividades
            </TabsTrigger>
          </TabsList>
        )}

        {/* 1. ESTABELECIMENTOS */}
        <TabsContent value="estabelecimentos" className="mt-4 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h3 className="font-semibold text-slate-800">Estabelecimentos</h3>
            <Button onClick={() => handleOpenModal("estabelecimento")} size="sm">
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
                        <div className="flex justify-end gap-1">
                          <Button onClick={() => handleOpenModal("estabelecimento", est)} variant="ghost" size="sm">
                            <Edit2 className="w-4 h-4 text-slate-600" />
                          </Button>
                          <Button onClick={() => setDeleteConfirm({ open: true, type: "estabelecimento", id: est.id, nome: est.nome })} variant="ghost" size="sm">
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
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
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h3 className="font-semibold text-slate-800">Ambientes de trabalho</h3>
            <Button onClick={() => handleOpenModal("ambiente")} size="sm">
              <Plus className="w-4 h-4 mr-1" /> Novo Ambiente
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ambiente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Características</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ambientes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-slate-400">
                      Nenhum ambiente cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  ambientes.map((amb) => (
                    <TableRow key={amb.id}>
                      <TableCell className="font-medium text-slate-900">{amb.nome}</TableCell>
                      <TableCell><Badge className="bg-slate-800 text-white">{amb.tipo_ambiente}</Badge></TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {[amb.pe_direito && `Pé-direito ${amb.pe_direito}`, amb.piso,
                          amb.ventilacao && `Ventilação ${amb.ventilacao}`,
                          amb.iluminacao && `Iluminação ${amb.iluminacao}`]
                          .filter(Boolean).join(" · ") || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button onClick={() => handleOpenModal("ambiente", amb)} variant="ghost" size="sm">
                            <Edit2 className="w-4 h-4 text-slate-600" />
                          </Button>
                          <Button onClick={() => setDeleteConfirm({ open: true, type: "ambiente", id: amb.id, nome: amb.nome })} variant="ghost" size="sm">
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
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
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h3 className="font-semibold text-slate-800">Setores</h3>
            <Button onClick={() => handleOpenModal("setor")} size="sm">
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
                          <div className="flex justify-end gap-1">
                            <Button onClick={() => handleOpenModal("setor", set)} variant="ghost" size="sm">
                              <Edit2 className="w-4 h-4 text-slate-600" />
                            </Button>
                            <Button onClick={() => setDeleteConfirm({ open: true, type: "setor", id: set.id, nome: set.nome })} variant="ghost" size="sm">
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
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
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h3 className="font-semibold text-slate-800">Processos de trabalho</h3>
            <Button onClick={() => handleOpenModal("processo")} size="sm">
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
                  <TableHead>Máquinas</TableHead>
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
                          <div className="flex justify-end gap-1">
                            <Button onClick={() => handleOpenModal("processo", proc)} variant="ghost" size="sm">
                              <Edit2 className="w-4 h-4 text-slate-600" />
                            </Button>
                            <Button onClick={() => setDeleteConfirm({ open: true, type: "processo", id: proc.id, nome: proc.nome })} variant="ghost" size="sm">
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
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
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h3 className="font-semibold text-slate-800">Funções</h3>
            <Button onClick={() => handleOpenModal("funcao")} size="sm">
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
                          <div className="flex justify-end gap-1">
                            <Button onClick={() => handleOpenModal("funcao", func)} variant="ghost" size="sm">
                              <Edit2 className="w-4 h-4 text-slate-600" />
                            </Button>
                            <Button onClick={() => setDeleteConfirm({ open: true, type: "funcao", id: func.id, nome: func.nome })} variant="ghost" size="sm">
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* 6. ATIVIDADES */}
        <TabsContent value="atividades" className="mt-4 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h3 className="font-semibold text-slate-800">Atividades</h3>
            <Button onClick={() => handleOpenModal("atividade")} size="sm">
              <Plus className="w-4 h-4 mr-1" /> Nova Atividade
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Atividade</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Característica</TableHead>
                  <TableHead>Frequência / Duração</TableHead>
                  <TableHead className="text-right">Envolvidos</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atividades.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-slate-400">
                      Nenhuma atividade cadastrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  atividades.map((ativ: any) => {
                    const fn = funcoes.find((f: any) => f.id === ativ.funcao_id);
                    return (
                      <TableRow key={ativ.id}>
                        <TableCell className="font-medium text-slate-900">
                          {ativ.nome}
                          {ativ.descricao && (
                            <span className="block text-xs font-normal text-slate-500 max-w-[260px] truncate">
                              {ativ.descricao}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{fn?.nome || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{ativ.caracteristica || "rotineira"}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {[ativ.frequencia, ativ.duracao].filter(Boolean).join(" / ") || "-"}
                        </TableCell>
                        <TableCell className="text-right">{ativ.trabalhadores_envolvidos ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button onClick={() => handleOpenModal("atividade", ativ)} variant="ghost" size="sm">
                              <Edit2 className="w-4 h-4 text-slate-600" />
                            </Button>
                            <Button onClick={() => setDeleteConfirm({ open: true, type: "atividade", id: ativ.id, nome: ativ.nome })} variant="ghost" size="sm">
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
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

      {/* CONFIRMATION DIALOG DE EXCLUSÃO */}
      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover "{deleteConfirm.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O registro será removido permanentemente do Núcleo Mestre.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DIALOG DE CADASTRO E EDIÇÃO */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        {/* Tela cheia no celular; largura confortável no desktop para os grids de 2-3 colunas. */}
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {formData.id ? "Editar" : "Cadastrar"} {modalType}
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

            {modalType === "atividade" && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Função que executa</Label>
                    <Select
                      value={formData.funcao_id || ""}
                      onValueChange={(val) => setFormData({ ...formData, funcao_id: val })}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione a função..." /></SelectTrigger>
                      <SelectContent>
                        {funcoes.map((f: any) => (
                          <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Característica</Label>
                    <Select
                      value={formData.caracteristica || "rotineira"}
                      onValueChange={(val) => setFormData({ ...formData, caracteristica: val })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rotineira">Rotineira</SelectItem>
                        <SelectItem value="nao_rotineira">Não rotineira</SelectItem>
                        <SelectItem value="emergencia">Emergência</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Descrição detalhada</Label>
                  <Textarea
                    value={formData.descricao || ""}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Como a atividade é executada, passo a passo..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label>Frequência</Label>
                    <Input
                      value={formData.frequencia || ""}
                      onChange={(e) => setFormData({ ...formData, frequencia: e.target.value })}
                      placeholder="Diária, semanal..."
                    />
                  </div>
                  <div>
                    <Label>Duração</Label>
                    <Input
                      value={formData.duracao || ""}
                      onChange={(e) => setFormData({ ...formData, duracao: e.target.value })}
                      placeholder="Ex.: 4h por turno"
                    />
                  </div>
                  <div>
                    <Label>Trabalhadores envolvidos</Label>
                    <Input
                      type="number"
                      min={0}
                      value={formData.trabalhadores_envolvidos ?? ""}
                      onChange={(e) => setFormData({
                        ...formData,
                        trabalhadores_envolvidos: e.target.value === "" ? null : Number(e.target.value),
                      })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Local de execução</Label>
                    <Input
                      value={formData.local_execucao || ""}
                      onChange={(e) => setFormData({ ...formData, local_execucao: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Postura / esforço exigido</Label>
                    <Input
                      value={formData.postura_esforco || ""}
                      onChange={(e) => setFormData({ ...formData, postura_esforco: e.target.value })}
                      placeholder="Em pé, agachado, carga de 20 kg..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Máquinas e equipamentos</Label>
                    <Input
                      value={formData.maquinas || ""}
                      onChange={(e) => setFormData({ ...formData, maquinas: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Produtos utilizados</Label>
                    <Input
                      value={formData.produtos_utilizados || ""}
                      onChange={(e) => setFormData({ ...formData, produtos_utilizados: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenModal(false)}>Cancelar</Button>
              <Button type="submit">Salvar no Núcleo Mestre</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
