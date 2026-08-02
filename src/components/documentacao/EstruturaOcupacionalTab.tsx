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
import { mensagemErro } from "@/lib/erroSupabase";
import { caracteristicasAmbiente } from "@/lib/sstEstrutura";
import { Building2, LayoutGrid, Workflow, Briefcase, Plus, Edit2, Loader2, Trash2, AlertTriangle } from "lucide-react";

/** Rótulo do modal por tipo. O título usava a chave crua: "Cadastrar funcao". */
const ROTULO_MODAL: Record<string, string> = {
  estabelecimento: "estabelecimento",
  ambiente: "ambiente",
  setor: "setor",
  processo: "processo",
  funcao: "função",
};

/** Placeholder do campo Nome. Era `Nome do ${modalType}`, que gerava
 *  "Nome do atividade" e "Nome do funcao". */
const PLACEHOLDER_NOME: Record<string, string> = {
  estabelecimento: "Nome do estabelecimento",
  ambiente: "Nome do ambiente",
  setor: "Nome do setor",
  processo: "Nome do processo",
  funcao: "Nome da função",
};

/**
 * Sugere um nome curto a partir de um texto longo (descrição, etapas).
 *
 * O nome é o rótulo que aparece ao lado do perigo no inventário do PGR, então
 * a atividade precisa de um. Mas exigir que a pessoa invente um título depois
 * de já ter escrito a descrição é atrito à toa — e travava o formulário com
 * "Preencha este campo". Aqui a primeira oração vira a sugestão, que continua
 * editável.
 */
function sugerirNomeCurto(descricao: string): string {
  const limpo = (descricao || "").trim();
  if (!limpo) return "";
  // Corta na primeira fronteira de oração; se não houver, usa o começo.
  const corte = limpo.split(/[.;\n]/)[0].trim() || limpo;
  const curto = corte.length > 70 ? `${corte.slice(0, 70).trimEnd()}…` : corte;
  return curto.charAt(0).toUpperCase() + curto.slice(1);
}

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
    erroCarregamento,
    recarregar,
    saveEstabelecimento,
    saveAmbiente,
    saveSetor,
    saveProcesso,
    saveFuncao,
    deleteEstabelecimento,
    deleteAmbiente,
    deleteSetor,
    deleteProcesso,
    deleteFuncao,
  } = useNucleoMestreSst();

  const [activeSubTab, setActiveSubTab] = useState<string>("estabelecimentos");

  /**
   * Com `only`, a seção vem SEMPRE da prop — nunca do estado.
   *
   * Antes, `only` era só o valor inicial de um useState. O assistente do PGR
   * monta este componente na mesma posição da árvore em etapas diferentes e sem
   * `key`, então o React reaproveita a MESMA instância: a prop mudava de
   * "funcoes" para "ambientes", mas o estado continuava "funcoes" — o
   * useState só lê o valor inicial na montagem. Resultado: quem abrisse a
   * etapa 4 e voltasse para a 2 via "Funções" no lugar de "Ambientes", e a
   * etapa 3 ("Setores e GES") mostrava "Funções" também.
   *
   * O estado continua existindo para a tela cheia de Documentação, onde as
   * abas navegam de verdade.
   */
  const secaoAtiva = only ?? activeSubTab;

  // DIALOG STATES
  const [openModal, setOpenModal] = useState(false);
  const [modalType, setModalType] = useState<"estabelecimento" | "ambiente" | "setor" | "processo" | "funcao">("estabelecimento");
  const [formData, setFormData] = useState<any>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; type: string; id: string; nome: string }>({
    open: false,
    type: "",
    id: "",
    nome: "",
  });

  const [erroSalvar, setErroSalvar] = useState("");
  const [salvando, setSalvando] = useState(false);

  const handleOpenModal = (type: any, item?: any) => {
    setModalType(type);
    // Setor e Ambiente viraram um formulário só. O registro do Setor guarda
    // apenas o `ambiente_id`; os campos que a pessoa vai editar (tipo,
    // pé-direito, trabalhadores, descrição) moram no Ambiente vinculado, e
    // sem essa busca eles abririam em branco toda vez que alguém editasse um
    // setor já cadastrado.
    if (type === "setor" && item?.ambiente_id) {
      const ambienteVinculado = ambientes.find((a) => a.id === item.ambiente_id);
      setFormData({
        ...item,
        tipo_ambiente: ambienteVinculado?.tipo_ambiente,
        pe_direito: ambienteVinculado?.pe_direito,
        descricao: ambienteVinculado?.descricao,
      });
    } else {
      setFormData(item || {});
    }
    setErroSalvar("");
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
    setErroSalvar("");

    // Processo deriva o Nome das etapas — a pessoa não devia ter que escrever a
    // mesma coisa duas vezes. Sem isto, quem clica direto em "Salvar" (sem
    // tirar o foco do campo de etapas) ficava barrado pelo required do Nome
    // mesmo já tendo escrito tudo que precisava, logo abaixo.
    let dados = formData;
    if (modalType === "processo" && !(formData.nome || "").trim()) {
      const sugestao = sugerirNomeCurto(formData.descricao_etapas || "");
      if (!sugestao) {
        setErroSalvar("Escreva ao menos as etapas do processo — o nome é gerado a partir delas.");
        return;
      }
      dados = { ...formData, nome: sugestao };
      setFormData(dados);
    }

    setSalvando(true);
    try {
      if (modalType === "estabelecimento") await saveEstabelecimento(dados);
      if (modalType === "ambiente") await saveAmbiente(dados);
      if (modalType === "setor") {
        // Um Setor sempre tem um Ambiente por trás — criado junto na primeira
        // vez, atualizado nas próximas. A pessoa só vê e edita um formulário;
        // por baixo continuam sendo dois registros, porque é assim que o PDF
        // do PGR e o Núcleo Mestre já leem essa estrutura (mudar isso exigiria
        // migrar dado de empresas que já têm PGR gerado).
        const ambienteSalvo = await saveAmbiente({
          id: formData.ambiente_id || undefined,
          nome: formData.nome,
          tipo_ambiente: formData.tipo_ambiente || "interno",
          pe_direito: formData.pe_direito || null,
          descricao: formData.descricao || null,
        } as any);
        await saveSetor({
          id: formData.id,
          nome: formData.nome,
          ambiente_id: (ambienteSalvo as any).id,
        } as any);
      }
      if (modalType === "processo") await saveProcesso(dados);
      if (modalType === "funcao") await saveFuncao(dados);
      setOpenModal(false);
    } catch (err) {
      // O erro ia só para o console: o modal ficava aberto, sem nada escrito, e
      // clicar em "Salvar" parecia não fazer efeito nenhum. A mensagem agora
      // aparece dentro do próprio formulário, onde a pessoa está olhando.
      console.error(err);
      setErroSalvar(mensagemErro(err, ROTULO_MODAL[modalType]));
    } finally {
      setSalvando(false);
    }
  };

  const handleDelete = async () => {
    try {
      if (deleteConfirm.type === "estabelecimento") await deleteEstabelecimento(deleteConfirm.id);
      if (deleteConfirm.type === "ambiente") await deleteAmbiente(deleteConfirm.id);
      if (deleteConfirm.type === "setor") await deleteSetor(deleteConfirm.id);
      if (deleteConfirm.type === "processo") await deleteProcesso(deleteConfirm.id);
      if (deleteConfirm.type === "funcao") await deleteFuncao(deleteConfirm.id);
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

  // Falha de carregamento não pode virar "Nenhum setor cadastrado": é a mesma
  // tela que apareceria se o cadastro estivesse vazio, e quem está no celular
  // com sinal ruim conclui que os dados sumiram.
  if (erroCarregamento) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 space-y-3">
        <div className="flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Não foi possível carregar a Estrutura Ocupacional.</p>
            <p className="text-xs mt-1">
              Nada foi perdido — só não deu para buscar os dados agora. Verifique a conexão
              e tente de novo.
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => recarregar()}>
          Tentar de novo
        </Button>
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

      <Tabs value={secaoAtiva} onValueChange={setActiveSubTab} className="w-full">
        {!only && (
          <TabsList className="grid grid-cols-3 w-full lg:inline-flex lg:w-auto bg-slate-100 p-1 rounded-lg h-auto">
            <TabsTrigger value="estabelecimentos" className="text-xs font-medium flex items-center gap-1">
              <Building2 className="w-4 h-4" /> Estabelecimentos
            </TabsTrigger>
            {/* "Ambientes" deixou de ser aba própria: cada Setor cadastra e
                mantém seu próprio ambiente de trabalho junto (ver o
                formulário de Setor e handleSave). Existir como aba separada
                era o convite para cadastrar a caracterização física duas
                vezes — uma vez aqui, outra de novo no Setor que a usa. */}
            <TabsTrigger value="setores" className="text-xs font-medium flex items-center gap-1">
              <LayoutGrid className="w-4 h-4" /> Setores
            </TabsTrigger>
            <TabsTrigger value="processos" className="text-xs font-medium flex items-center gap-1">
              <Workflow className="w-4 h-4" /> Processos
            </TabsTrigger>
            <TabsTrigger value="funcoes" className="text-xs font-medium flex items-center gap-1">
              <Briefcase className="w-4 h-4" /> Funções
            </TabsTrigger>
            {/* Atividades deixou de ser aba própria: na prática cada função
                tinha exatamente uma atividade, com o mesmo texto já escrito em
                "Descrição das Atividades Desempenhadas" da própria função —
                era o mesmo cadastro feito duas vezes. */}
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

        {/* 2. SETORES (inclui o Ambiente de cada setor — ver comentário na aba) */}
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
                  <TableHead>Ambiente de trabalho</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {setores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6 text-slate-400">
                      Nenhum setor cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  setores.map((set) => {
                    // A coluna mostrava o nome do Ambiente vinculado — que hoje
                    // é sempre o próprio ambiente deste setor, então repetia o
                    // "Nome do Setor" da primeira coluna. As características
                    // (mesma leitura usada no PDF do PGR) são a informação que
                    // de fato falta ver aqui sem abrir o cadastro.
                    const amb = ambientes.find((a) => a.id === set.ambiente_id);
                    return (
                      <TableRow key={set.id}>
                        <TableCell className="font-medium text-slate-900">{set.nome}</TableCell>
                        <TableCell className="text-sm text-slate-600 max-w-xs truncate" title={caracteristicasAmbiente(amb)}>
                          {caracteristicasAmbiente(amb) || "—"}
                        </TableCell>
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
                        {/* Nome numa linha só: quando alguém cola o texto
                            inteiro aqui, a linha crescia e empurrava a tabela. */}
                        <TableCell className="font-medium text-slate-900 max-w-[280px]">
                          <span className="block truncate" title={proc.nome}>{proc.nome}</span>
                        </TableCell>
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
                  {/* Os requisitos de NR continuam sendo marcados no cadastro e
                      impressos no PDF — só saíram daqui, onde a descrição das
                      atividades diz muito mais sobre a função. */}
                  <TableHead>Descrição das atividades</TableHead>
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
                        <TableCell className="text-sm text-slate-600 max-w-xs truncate"
                          title={(func as any).descricao_atividades || ""}>
                          {(func as any).descricao_atividades || "—"}
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {formData.id ? "Editar" : "Cadastrar"} {ROTULO_MODAL[modalType]}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 text-sm">
            {/* Atividade e Processo não têm este campo: o nome/rótulo curto sai
                sozinho da primeira frase da descrição/etapas, lá embaixo (ver
                handleSave). Mostrar uma caixa "Nome" além da descrição fazia a
                pessoa escrever a mesma coisa duas vezes à toa. */}
            {modalType !== "processo" && (
              <div>
                <Label>Nome / Identificação *</Label>
                <Input
                  value={formData.nome || ""}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                  placeholder={PLACEHOLDER_NOME[modalType]}
                />
              </div>
            )}

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

            {/* modalType === "ambiente" não abre mais sozinho por nenhum botão
                da UI — o cadastro de ambiente virou parte do formulário de
                Setor, logo abaixo. A mutation saveAmbiente() continua existindo
                porque handleSave a chama por baixo dos panos ao salvar um
                Setor; só a tela separada para editar um Ambiente isolado é
                que deixou de existir. */}

            {modalType === "setor" && (
              <>
                {/* Cadastro do Ambiente, embutido aqui — é o mesmo formulário
                    que antes vivia numa aba própria. Cada Setor tem o seu:
                    não existe mais escolher entre ambientes já cadastrados,
                    porque era exatamente aí que a descrição acabava sendo
                    escrita duas vezes (uma no Ambiente, outra de novo aqui). */}
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
                  {/* Pé-direito não tem mais campo próprio — entra aqui junto
                      com o resto, como piso/ventilação/iluminação já entravam.
                      `caracteristicasAmbiente()` (sstEstrutura.ts) lê este texto
                      para a coluna "Ambiente de trabalho" da tabela e o PDF do
                      PGR imprime como parágrafo na seção "Caracterização dos
                      Ambientes". */}
                  <Label>Descrição do ambiente</Label>
                  <Textarea
                    value={formData.descricao || ""}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Pé-direito, piso, ventilação, iluminação, paredes/cobertura, máquinas e instalações, e qualquer outro detalhe relevante"
                    rows={4}
                  />
                </div>
              </>
            )}

            {modalType === "processo" && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  {/* "Característica" e "Máquinas" eram colunas sem campo aqui. */}
                  <div>
                    <Label>Característica</Label>
                    <Select
                      value={formData.caracteristica_atividade || "rotineira"}
                      onValueChange={(val) => setFormData({ ...formData, caracteristica_atividade: val })}
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
                  <Label>Máquinas e equipamentos</Label>
                  <Input value={formData.maquinas_equipamentos || ""}
                    onChange={(e) => setFormData({ ...formData, maquinas_equipamentos: e.target.value })}
                    placeholder="Ex.: betoneira, serra mármore, computador" />
                </div>
                <div>
                  <Label>Produtos químicos utilizados</Label>
                  <Input value={formData.produtos_quimicos || ""}
                    onChange={(e) => setFormData({ ...formData, produtos_quimicos: e.target.value })}
                    placeholder="Deixe em branco se não houver" />
                </div>
                <div>
                  <Label>Etapas do processo *</Label>
                  <Textarea value={formData.descricao_etapas || ""}
                    onChange={(e) => setFormData({ ...formData, descricao_etapas: e.target.value })}
                    placeholder="Como o trabalho é executado, do início ao fim" />
                </div>
              </>
            )}

            {modalType === "funcao" && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label>Código CBO</Label>
                    <Input
                      value={formData.cbo || ""}
                      onChange={(e) => setFormData({ ...formData, cbo: e.target.value })}
                      placeholder="Ex: 7152-10"
                    />
                  </div>
                  {/* Colunas sst_funcoes.qtd_trabalhadores e .jornada, criadas
                      pela migration de 28/07. Ficaram fora enquanto ela estava
                      pendente — enviar coluna inexistente derrubava o insert. */}
                  <div>
                    <Label>Nº de trabalhadores</Label>
                    <Input type="number" min={0} value={formData.qtd_trabalhadores ?? ""}
                      onChange={(e) => setFormData({
                        ...formData,
                        qtd_trabalhadores: e.target.value === "" ? null : Number(e.target.value),
                      })} />
                  </div>
                  <div>
                    <Label>Jornada</Label>
                    <Input value={formData.jornada || ""} placeholder="Ex.: 44h semanais"
                      onChange={(e) => setFormData({ ...formData, jornada: e.target.value })} />
                  </div>
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
                {/* A tabela tinha a coluna "Requisitos NRs" e mostrava "Padrão"
                    quando vazia, sem lugar nenhum para marcar. "Padrão" também
                    não dizia nada: o que existe é a função EXIGIR ou não cada
                    treinamento. */}
                <fieldset className="border rounded-md p-3 space-y-2">
                  <legend className="px-1 text-xs font-semibold text-slate-600">
                    Treinamentos obrigatórios
                  </legend>
                  <p className="text-xs text-slate-500">
                    Marque apenas o que esta função exige. Sem marcação, nenhum treinamento
                    especial é exigido.
                  </p>
                  {([
                    ["exige_nr10", "NR-10 — Eletricidade"],
                    ["exige_nr33", "NR-33 — Espaço confinado"],
                    ["exige_nr35", "NR-35 — Trabalho em altura"],
                  ] as [string, string][]).map(([campo, rotulo]) => (
                    <label key={campo} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300"
                        checked={!!formData[campo]}
                        onChange={(e) => setFormData({ ...formData, [campo]: e.target.checked })} />
                      {rotulo}
                    </label>
                  ))}
                </fieldset>

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


            {erroSalvar && (
              <div className="flex gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{erroSalvar}</span>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenModal(false)}>Cancelar</Button>
              <Button type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
