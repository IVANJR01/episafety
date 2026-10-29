import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { useToast } from "@/hooks/use-toast";
import { EnderecoEstruturado, formatarEndereco } from "@/types/sst";
import { mensagemErro } from "@/lib/erroSupabase";
import { caracteristicasAmbiente, ordenarPorCodigoGes } from "@/lib/sstEstrutura";
import { exportarFuncoes } from "@/lib/exportarFuncoes";
import { GruposDoSetorDialog } from "./GruposDoSetorDialog";
import { GesExposicoesTab } from "./GesExposicoesTab";
import { Building2, LayoutGrid, Workflow, Briefcase, Layers, ClipboardPaste, Plus, Edit2, Loader2, Trash2, AlertTriangle, Users, Download, Sparkles, FolderOpen, ChevronLeft, ChevronRight, ListTree, AlertCircle } from "lucide-react";

/*
 * O que a coluna Tipo mostra.
 *
 * A tabela imprimia o valor cru do banco — "proprio", em minúscula e sem
 * acento, dentro de um selo. O formulário sempre teve os nomes por extenso;
 * a lista é que não os usava.
 */
const TIPO_ESTABELECIMENTO: Record<string, string> = {
  proprio: "Próprio",
  terceiro: "Terceiro / Cliente",
  obra: "Obra",
  administrativo: "Administrativo",
};

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

interface ColunaEstrutura<T> {
  rotulo: string;
  celula: (item: T) => React.ReactNode;
  /** Classe da célula no desktop — é onde ficam truncamento e alinhamento. */
  classe?: string;
  /** Texto do `title` (tooltip) da célula no desktop, quando ela trunca. */
  dica?: (item: T) => string;
  longo?: boolean;
}

/**
 * Listagem da Estrutura Ocupacional: cartões no celular, tabela no desktop.
 */
function ListaEstrutura<T extends { id: string }>({
  itens, vazio, rotuloPrincipal, principal, colunas, onEditar, onExcluir, acoesExtras, rotuloEditar,
}: {
  itens: T[];
  vazio: string;
  rotuloPrincipal: string;
  principal: (item: T) => React.ReactNode;
  colunas: ColunaEstrutura<T>[];
  onEditar: (item: T) => void;
  onExcluir: (item: T) => void;
  /** Botão adicional antes de editar/excluir (ex.: grupos do setor). */
  acoesExtras?: (item: T) => React.ReactNode;
  rotuloEditar?: string;
}) {
  const acoes = (item: T) => (
    <div className="flex justify-end gap-1 shrink-0">
      {acoesExtras?.(item)}
      <Button onClick={() => onEditar(item)} variant="ghost" size="sm"
        aria-label={rotuloEditar ?? "Editar"} title={rotuloEditar ?? "Editar"}>
        <Edit2 className="w-4 h-4 text-muted-foreground" />
      </Button>
      <Button onClick={() => onExcluir(item)} variant="ghost" size="sm"
        aria-label="Excluir" title="Excluir">
        <Trash2 className="w-4 h-4 text-red-600" />
      </Button>
    </div>
  );

  const nome = (item: T) => principal(item);

  if (itens.length === 0) {
    return (
      <Card className="border-dashed p-10 text-center">
        <p className="text-sm text-muted-foreground">{vazio}</p>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-2 sm:hidden">
        {itens.map((item) => (
          <Card key={item.id} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 font-medium text-foreground">{nome(item)}</div>
              {acoes(item)}
            </div>
            <dl className="mt-2 space-y-1.5">
              {colunas.map((c) => (c.longo ? (
                <div key={c.rotulo} className="text-xs">
                  <dt className="text-muted-foreground">{c.rotulo}</dt>
                  <dd className="mt-0.5 break-words text-foreground line-clamp-3">{c.celula(item)}</dd>
                </div>
              ) : (
                <div key={c.rotulo} className="flex gap-2 text-xs">
                  <dt className="shrink-0 text-muted-foreground">{c.rotulo}:</dt>
                  <dd className="min-w-0 break-words text-foreground">{c.celula(item)}</dd>
                </div>
              )))}
            </dl>
          </Card>
        ))}
      </div>

      <Card className="hidden sm:block overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-11 min-w-[190px] text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {rotuloPrincipal}
                </TableHead>
                {colunas.map((c) => (
                  <TableHead key={c.rotulo}
                    className={`h-11 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground ${c.classe ?? ""}`}>
                    {c.rotulo}
                  </TableHead>
                ))}
                <TableHead className="h-11 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/50">
                  <TableCell className="py-3 font-medium text-foreground">{nome(item)}</TableCell>
                  {colunas.map((c) => (
                    <TableCell key={c.rotulo} className={`py-3 text-muted-foreground ${c.classe ?? ""}`} title={c.dica?.(item)}>
                      {c.celula(item)}
                    </TableCell>
                  ))}
                  <TableCell className="py-3 text-right">{acoes(item)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </>
  );
}

interface EstruturaProps {
  only?: SecaoEstrutura;
  abaInicial?: string;
}

export function EstruturaOcupacionalTab({ only, abaInicial }: EstruturaProps = {}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Resolve a aba correta com base na URL ou prop
  const resolverSubAba = () => {
    const param = searchParams.get("subaba") || searchParams.get("aba") || abaInicial;
    if (param === "ges" || param === "riscos") return "riscos";
    if (param === "setores" || param === "setor") return "setores";
    if (param === "funcoes" || param === "funcao") return "funcoes";
    if (param === "estabelecimentos" || param === "estabelecimento") return "estabelecimentos";
    return "estabelecimentos";
  };

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
    saveGes,
    vincularGesSetor,
    vincularGesFuncao,
    definirFuncoesDoGes,
    gesList,
    gheSetores,
    gheFuncoes,
    deleteEstabelecimento,
    deleteAmbiente,
    deleteSetor,
    deleteProcesso,
    deleteFuncao,
    deleteGes,
    activeFuncionarios,
    contagemTrabalhadoresPorSetor,
    contagemTrabalhadoresPorGes,
  } = useNucleoMestreSst();

  const { toast } = useToast();

  const [activeSubTab, setActiveSubTab] = useState<string>(resolverSubAba);
  const [setorDetalheId, setSetorDetalheId] = useState<string | null>(null);

  // Sincroniza a sub-aba quando a URL mudar (ex: clicar no menu com ?aba=ges)
  useEffect(() => {
    if (!only) {
      setActiveSubTab(resolverSubAba());
    }
  }, [searchParams, abaInicial, only]);

  // Modal de GES criado e gerido dentro do Setor
  const [openGesSetorModal, setOpenGesSetorModal] = useState(false);
  const [gesSetorFormData, setGesSetorFormData] = useState<{
    id?: string;
    codigo: string;
    nome: string;
    descricao?: string;
    setor_id: string;
  }>({ codigo: "", nome: "", descricao: "", setor_id: "" });
  const [gesSetorFuncoesSelecionadas, setGesSetorFuncoesSelecionadas] = useState<string[]>([]);
  const [salvandoGesSetor, setSalvandoGesSetor] = useState(false);
  const [erroGesSetor, setErroGesSetor] = useState("");

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

  const [setorDosGrupos, setSetorDosGrupos] = useState<{ id: string; nome: string } | null>(null);

  // Cadastro de funções em lote: digitar oito cargos um a um, abrindo e
  // fechando o mesmo formulário, é o tipo de trabalho que a tela devia poupar.
  const [loteAberto, setLoteAberto] = useState(false);
  const [loteTexto, setLoteTexto] = useState("");
  const [loteSetor, setLoteSetor] = useState("");
  const [loteSalvando, setLoteSalvando] = useState(false);

  const normalizar = (v: string) => (v || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

  const [filtroFuncaoTexto, setFiltroFuncaoTexto] = useState("");
  const [filtroFuncaoSetor, setFiltroFuncaoSetor] = useState("todos");

  /** O código do GES ligado a um setor — é por ele que a lista se ordena. */
  const codigoDoGesDoSetor = (setorId: string) => {
    const vinculo = (gheSetores as any[]).find((v) => v.setor_id === setorId);
    if (!vinculo) return null;
    const grupo = gesList.find((g: any) => g.id === vinculo.ghe_id);
    return grupo?.codigo || grupo?.nome || null;
  };

  /**
   * Setores em ordem de GES: 01, 02, 03…
   *
   * Vinham por nome, o que não diz nada sobre a organização do trabalho — e um
   * espaço à toa no começo do cadastro ("␣SEPARAÇÃO") jogava o setor para o
   * topo sem explicação nenhuma.
   */
  const setoresOrdenados = useMemo(
    () => ordenarPorCodigoGes(setores as any[], codigoDoGesDoSetor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setores, gheSetores, gesList],
  );

  const funcoesFiltradas = useMemo(() => {
    let filtradas = funcoes;
    if (filtroFuncaoSetor !== "todos") {
      filtradas = filtradas.filter((f: any) => f.setor_id === filtroFuncaoSetor);
    }
    if (filtroFuncaoTexto.trim()) {
      const q = normalizar(filtroFuncaoTexto);
      filtradas = filtradas.filter((f: any) => normalizar(f.nome).includes(q));
    }
    return filtradas;
  }, [funcoes, filtroFuncaoTexto, filtroFuncaoSetor]);

  /**
   * Baixa a lista de funções para o gestor revisar as descrições.
   *
   * Vai o que está na tela — com a busca e o filtro de setor aplicados —,
   * porque é o recorte que a pessoa acabou de montar para pedir a revisão.
   */
  const exportarListaDeFuncoes = () => {
    const setorFiltrado = filtroFuncaoSetor !== "todos"
      ? setores.find((s: any) => s.id === filtroFuncaoSetor)?.nome
      : null;
    exportarFuncoes(
      funcoesFiltradas as any[],
      (id) => setores.find((s: any) => s.id === id)?.nome,
      { empresa: estabelecimentos[0]?.nome, setor: setorFiltrado },
    );
  };

  /** Uma função por linha; "Nome | Descrição" quando quiser já descrever. */
  const loteLinhas = useMemo(() => {
    const jaExistem = new Set(funcoes.map((f: any) => normalizar(f.nome)));
    const vistos = new Set<string>();
    return loteTexto.split("\n").map((l) => l.trim()).filter(Boolean).map((linha) => {
      const [nome, descricao] = linha.split(/[|\t]/).map((p) => p.trim());
      const chave = normalizar(nome);
      const duplicadaNoTexto = vistos.has(chave);
      vistos.add(chave);
      return {
        nome, descricao: descricao || "",
        repetida: jaExistem.has(chave) || duplicadaNoTexto,
      };
    }).filter((l) => l.nome);
  }, [loteTexto, funcoes]);

  const loteNovas = loteLinhas.filter((l) => !l.repetida);

  const salvarLote = async () => {
    setLoteSalvando(true);
    try {
      const vinculoSetor = (gheSetores as any[]).find((v) => v.setor_id === loteSetor);
      for (const linha of loteNovas) {
        const salva: any = await saveFuncao({
          nome: linha.nome,
          setor_id: loteSetor || null,
          descricao_atividades: linha.descricao || null,
          _silencioso: true,
        } as any);
        // Mesma regra do cadastro avulso: entra no GES do setor.
        if (vinculoSetor?.ghe_id) {
          await vincularGesFuncao({
            ges_id: vinculoSetor.ghe_id,
            funcao_id: salva.id,
            nome_funcao: linha.nome,
            setor_nome: setores.find((st) => st.id === loteSetor)?.nome,
          });
        }
      }
      toast({
        title: "Funções cadastradas",
        description: `${loteNovas.length} função(ões) adicionada(s).`,
      });
      setLoteTexto("");
      setLoteAberto(false);
    } catch (err) {
      console.error(err);
      toast({
        title: "Erro ao cadastrar em lote",
        description: mensagemErro(err, "função"),
        variant: "destructive",
      });
    } finally {
      setLoteSalvando(false);
    }
  };

  const [erroSalvar, setErroSalvar] = useState("");
  const [salvando, setSalvando] = useState(false);

  const handleFuncaoNameChange = (nome: string) => {
    setFormData((prev: any) => ({ ...prev, nome }));
    if (!formData.descricao_atividades || formData.descricao_atividades.trim() === "") {
      const existente = funcoes.find((f: any) => normalizar(f.nome) === normalizar(nome) && f.descricao_atividades);
      if (existente) {
        setFormData((prev: any) => ({ ...prev, nome, descricao_atividades: (existente as any).descricao_atividades }));
      }
    }
  };

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
        // Regra Arquitetural: Setor NÃO cria GES automaticamente.
        // O setor é salvo de forma independente. O GES é criado conscientemente dentro do Setor.
      }
      if (modalType === "processo") await saveProcesso(dados);
      if (modalType === "funcao") {
        const funcaoSalva = await saveFuncao(dados);
        // A função entra no GES do seu setor. É `ghe_funcoes` que o "Quadro
        // sinóptico de EPIs" do PDF lê — sem este vínculo, o GES criado junto
        // com o Setor apareceria no documento sem ninguém dentro.
        // Só entra no GES do setor quem ainda não está em grupo nenhum. Um
        // setor pode ter mais de um GES — no PCP, os administrativos e o
        // Ajudante de Confecção têm exposições diferentes — e reatribuir aqui
        // desfaria essa separação a cada vez que a função fosse editada.
        const jaEmAlgumGes = (gheFuncoes as any[]).some(
          (v) => v.funcao_id === (funcaoSalva as any).id,
        );
        const vinculoSetor = (gheSetores as any[]).find((v) => v.setor_id === dados.setor_id);
        if (!jaEmAlgumGes && vinculoSetor?.ghe_id) {
          await vincularGesFuncao({
            ges_id: vinculoSetor.ghe_id,
            funcao_id: (funcaoSalva as any).id,
            nome_funcao: dados.nome,
            setor_nome: setores.find((st) => st.id === dados.setor_id)?.nome,
          });
        }
      }
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

  const [duplicandoId, setDuplicandoId] = useState<string | null>(null);

  /** Os processos de um setor, na ordem em que foram cadastrados. */
  const processosDoSetor = (setorId: string) =>
    processos.filter((p) => p.setor_id === setorId);

  const duplicarSetor = async (setorId: string) => {
    try {
      setDuplicandoId(setorId);
      const setorOriginal = setores.find(s => s.id === setorId);
      if (!setorOriginal) return;

      const ambienteOriginal = ambientes.find(a => a.id === setorOriginal.ambiente_id);
      
      // 1. Clonar Ambiente
      let novoAmbienteId = undefined;
      if (ambienteOriginal) {
        const ambSalvo: any = await saveAmbiente({
          nome: `${ambienteOriginal.nome} (Cópia)`,
          tipo_ambiente: ambienteOriginal.tipo_ambiente,
          pe_direito: ambienteOriginal.pe_direito,
          descricao: ambienteOriginal.descricao,
        } as any);
        novoAmbienteId = ambSalvo.id;
      }

      // 2. Clonar Setor
      const setorSalvo: any = await saveSetor({
        nome: `${setorOriginal.nome} (Cópia)`,
        ambiente_id: novoAmbienteId,
      } as any);
      
      const novoSetorId = setorSalvo.id;

      // Não clonamos mais o GES automaticamente, para evitar duplicações 
      // indevidas de "Nome (Cópia)" e grupos vazios. O GES agora é gerenciado 
      // exclusivamente na aba GES.

      // 4. Clonar Processos
      const processosDoSetor = processos.filter(p => p.setor_id === setorId);
      for (const p of processosDoSetor) {
        await saveProcesso({
          nome: p.nome,
          descricao_etapas: p.descricao_etapas,
          caracteristica_atividade: p.caracteristica_atividade,
          setor_id: novoSetorId,
        } as any);
      }

      // 5. Clonar Funções
      const funcoesDoSetor = funcoes.filter(f => f.setor_id === setorId);
      for (const f of funcoesDoSetor) {
        await saveFuncao({
          nome: f.nome,
          descricao_atividades: f.descricao_atividades,
          setor_id: novoSetorId,
          _silencioso: true,
        } as any);
      }

      toast({
        title: "Setor duplicado",
        description: "O setor, seus processos e funções foram copiados.",
      });
      recarregar();
    } catch (err) {
      console.error(err);
      toast({
        title: "Erro ao duplicar setor",
        description: mensagemErro(err, "setor"),
        variant: "destructive",
      });
    } finally {
      setDuplicandoId(null);
    }
  };

  const abrirModalGesSetor = (setorId: string, ges?: any) => {
    setErroGesSetor("");
    if (ges) {
      const funcs = (gheFuncoes as any[])
        .filter((v) => v.ghe_id === ges.id && v.funcao_id)
        .map((v) => v.funcao_id);
      setGesSetorFormData({
        id: ges.id,
        codigo: ges.codigo || "",
        nome: ges.nome || "",
        descricao: ges.criterio_agrupamento || ges.descricao || "",
        setor_id: setorId,
      });
      setGesSetorFuncoesSelecionadas(funcs);
    } else {
      const proximoNum = gesList.reduce((max: number, g: any) => {
        const num = Number(String(g.codigo || "").replace(/\D/g, ""));
        return isNaN(num) ? max : Math.max(max, num);
      }, 0) + 1;
      const codigoSugerido = `GES-${String(proximoNum).padStart(2, "0")}`;
      const setorNome = setores.find((s) => s.id === setorId)?.nome || "";

      setGesSetorFormData({
        codigo: codigoSugerido,
        nome: `GES ${setorNome}`,
        descricao: `Trabalhadores do setor ${setorNome}, expostos às mesmas condições ambientais e operacionais.`,
        setor_id: setorId,
      });
      const funcoesDesteSetor = funcoes.filter((f: any) => f.setor_id === setorId).map((f: any) => f.id);
      setGesSetorFuncoesSelecionadas(funcoesDesteSetor);
    }
    setOpenGesSetorModal(true);
  };

  const handleSalvarGesSetor = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroGesSetor("");

    const nomeTrim = (gesSetorFormData.nome || "").trim();
    if (!nomeTrim) {
      setErroGesSetor("O nome do GES é obrigatório.");
      return;
    }
    const codigoTrim = (gesSetorFormData.codigo || "").trim();
    if (!codigoTrim) {
      setErroGesSetor("O código do GES é obrigatório.");
      return;
    }

    // Regra de Unicidade: no mesmo setor, não permitir duplicar código ou nome
    const vinculosDesteSetor = (gheSetores as any[]).filter((v) => v.setor_id === gesSetorFormData.setor_id);
    const gesExistentesNoSetor = vinculosDesteSetor
      .map((v) => gesList.find((g: any) => g.id === v.ghe_id))
      .filter(Boolean);

    const duplicadoNome = gesExistentesNoSetor.find(
      (g: any) => g.id !== gesSetorFormData.id && normalizar(g.nome) === normalizar(nomeTrim),
    );
    if (duplicadoNome) {
      setErroGesSetor(`Já existe um GES chamado "${nomeTrim}" neste setor.`);
      return;
    }

    const duplicadoCodigo = gesExistentesNoSetor.find(
      (g: any) => g.id !== gesSetorFormData.id && normalizar(g.codigo) === normalizar(codigoTrim),
    );
    if (duplicadoCodigo) {
      setErroGesSetor(`O código "${codigoTrim}" já está em uso neste setor.`);
      return;
    }

    setSalvandoGesSetor(true);
    try {
      const setorNome = setores.find((s) => s.id === gesSetorFormData.setor_id)?.nome || "";
      const salvo: any = await saveGes({
        id: gesSetorFormData.id,
        codigo: codigoTrim,
        nome: nomeTrim,
        criterio_agrupamento: gesSetorFormData.descricao || null,
        _silencioso: false,
      } as any);

      await vincularGesSetor({
        ges_id: salvo.id,
        setor_id: gesSetorFormData.setor_id,
        nome: setorNome,
      });

      await definirFuncoesDoGes({
        ges_id: salvo.id,
        funcao_ids: gesSetorFuncoesSelecionadas,
      });

      toast({
        title: "GES salvo com sucesso!",
        description: `${codigoTrim} — ${nomeTrim} configurado para o setor ${setorNome}.`,
      });
      setOpenGesSetorModal(false);
    } catch (err) {
      console.error(err);
      setErroGesSetor(mensagemErro(err, "GES"));
    } finally {
      setSalvandoGesSetor(false);
    }
  };

  const handleExcluirGesDoSetor = (gesId: string, gesNome: string) => {
    setDeleteConfirm({
      open: true,
      type: "ges",
      id: gesId,
      nome: gesNome,
    });
  };

  const handleDelete = async () => {
    try {
      if (deleteConfirm.type === "estabelecimento") await deleteEstabelecimento(deleteConfirm.id);
      if (deleteConfirm.type === "ambiente") await deleteAmbiente(deleteConfirm.id);
      if (deleteConfirm.type === "setor") await deleteSetor(deleteConfirm.id);
      if (deleteConfirm.type === "processo") await deleteProcesso(deleteConfirm.id);
      if (deleteConfirm.type === "funcao") await deleteFuncao(deleteConfirm.id);
      if (deleteConfirm.type === "ges") await deleteGes(deleteConfirm.id);
      setDeleteConfirm({ open: false, type: "", id: "", nome: "" });
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mb-2 text-primary" />
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
      {/*
        Havia aqui um segundo cabeçalho — "Repositório Técnico", com ícone e
        subtítulo — logo abaixo do título da página, dizendo a mesma coisa com
        outras palavras. Dois títulos e dois subtítulos em sequência é o que
        mais fazia a tela parecer improvisada. O título da página basta, e a
        aba ativa já diz em que seção se está.
      */}

      <Tabs value={secaoAtiva} onValueChange={(v) => setActiveSubTab(v as any)} className="w-full">
        {!only && !setorDetalheId && (
          <div className="flex flex-col lg:flex-row lg:items-center gap-2">
          <TabsList className="grid grid-cols-2 sm:grid sm:grid-cols-4 lg:inline-flex lg:w-auto w-full bg-muted p-1 rounded-lg h-auto gap-1">
            <TabsTrigger value="estabelecimentos" className="text-xs font-medium flex items-center justify-center gap-1.5 px-3 py-2 text-muted-foreground data-[state=active]:text-primary">
              <Building2 className="w-4 h-4" /> Estabelecimentos
            </TabsTrigger>
            <TabsTrigger value="setores" className="text-xs font-medium flex items-center justify-center gap-1.5 px-3 py-2 text-muted-foreground data-[state=active]:text-primary">
              <LayoutGrid className="w-4 h-4" /> Setores
            </TabsTrigger>
            {/*
              Esta aba existia, foi removida em 74bf9acd em favor de uma seção
              dentro do setor, e a seção foi removida depois em 81a7edef. O
              conteúdo `funcoes` continuou no arquivo o tempo todo — com busca,
              filtro por setor e "Colar em lote" — mas a única porta que sobrou
              para ele era o assistente do PGR, etapa 3.

              Ou seja: para cadastrar uma função era preciso abrir um PGR. A
              Base Técnica promete cadastrar a estrutura "uma única vez" para
              alimentar PGR, PCMSO, LTCAT, Laudos e PPP — não dá para essa
              estrutura só existir por dentro de um dos documentos.

              É a MESMA tela do assistente (mesmo componente, mesmo conteúdo),
              agora com porta também aqui. Não é um segundo lugar de cadastro.
            */}
            <TabsTrigger value="funcoes" className="text-xs font-medium flex items-center justify-center gap-1.5 px-3 py-2 text-muted-foreground data-[state=active]:text-primary">
              <Briefcase className="w-4 h-4" /> Funções
            </TabsTrigger>
            <TabsTrigger value="riscos" className="text-xs font-medium flex items-center justify-center gap-1.5 px-3 py-2 text-muted-foreground data-[state=active]:text-primary">
              <Users className="w-4 h-4" /> GES
            </TabsTrigger>
          </TabsList>
          {/*
            Porta para a limpeza de repetidos. Ela precisa estar AQUI: é
            olhando a lista de setores que se percebe o mesmo setor duas vezes,
            e era daqui que não havia para onde ir.
          */}
          <Button
            variant="outline"
            size="sm"
            className="lg:ml-auto"
            onClick={() => navigate("/cadastro/limpeza")}
          >
            <Sparkles className="w-4 h-4 mr-1.5" aria-hidden /> Limpar repetidos
          </Button>
          </div>
        )}

        {/* 1. ESTABELECIMENTOS */}
        <TabsContent value="estabelecimentos" className="mt-4 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              Estabelecimentos
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {estabelecimentos.length} {estabelecimentos.length === 1 ? "estabelecimento" : "estabelecimentos"}
              </span>
            </h3>
            <Button onClick={() => handleOpenModal("estabelecimento")} size="sm">
              <Plus className="w-4 h-4 mr-1" /> Novo Estabelecimento
            </Button>
          </div>
          <ListaEstrutura
            itens={estabelecimentos}
            vazio="Nenhum estabelecimento cadastrado."
            rotuloPrincipal="Nome / Unidade"
            principal={(est) => (
              <>
                {est.nome}
                {est.nome_fantasia && (
                  <span className="block text-xs font-normal text-muted-foreground">{est.nome_fantasia}</span>
                )}
              </>
            )}
            colunas={[
              {
                rotulo: "Tipo",
                celula: (est) => (
                  <Badge variant="outline" className="font-normal">
                    {TIPO_ESTABELECIMENTO[est.tipo] ?? est.tipo ?? "—"}
                  </Badge>
                ),
              },
              { rotulo: "CNPJ / CNO", celula: (est) => est.cnpj || est.cno || "—" },
              {
                rotulo: "CNAE / Grau Risco",
                celula: (est) => est.cnae_principal
                  ? `${est.cnae_principal}${est.grau_risco ? ` (Grau ${est.grau_risco})` : ""}`
                  : "—",
              },
              {
                rotulo: "Endereço",
                longo: true,
                classe: "text-xs text-muted-foreground max-w-[220px]",
                celula: (est) => formatarEndereco(est.endereco) || "—",
              },
                {
                  rotulo: "Trabalhadores",
                  classe: "text-right tabular-nums",
                  celula: (est) => est.qtd_trabalhadores ?? "—",
                },
              ]}
              onEditar={(est) => handleOpenModal("estabelecimento", est)}
              onExcluir={(est) => setDeleteConfirm({ open: true, type: "estabelecimento", id: est.id, nome: est.nome })}
            />
          </TabsContent>

          {/* 2. SETORES */}
          <TabsContent value="setores" className="mt-4 space-y-4">
            {setorDetalheId ? (
            (() => {
              const setorAtual = setores.find(s => s.id === setorDetalheId);
              if (!setorAtual) return null;
              
              const ambienteAtual = ambientes.find(a => a.id === setorAtual.ambiente_id);
              const processosDoSetor = processos.filter(p => p.setor_id === setorDetalheId);
              const funcoesDoSetor = funcoes.filter(f => f.setor_id === setorDetalheId);
              const vinculos = (gheSetores as any[]).filter((v) => v.setor_id === setorDetalheId);
              const gesDoSetor = vinculos
                .map((v) => gesList.find((g: any) => g.id === v.ghe_id))
                .filter(Boolean);

              const totalTrabalhadoresSetor = contagemTrabalhadoresPorSetor.get(normalizar(setorAtual.nome)) || 0;

              return (
                <div className="space-y-6 animate-in fade-in duration-300">
                  {/* Navegação de retorno e cabeçalho do Setor */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
                    <div className="space-y-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSetorDetalheId(null)}
                        className="-ml-2 text-muted-foreground hover:text-foreground h-8 px-2 gap-1"
                      >
                        <ChevronLeft className="w-4 h-4" /> Voltar para Setores
                      </Button>
                      <div className="flex items-center gap-2.5 pt-1">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                          <LayoutGrid className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold tracking-tight text-foreground">{setorAtual.nome}</h2>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span className="font-medium text-foreground">{gesDoSetor.length} {gesDoSetor.length === 1 ? "GES" : "GES"}</span>
                            <span>·</span>
                            <span className="font-medium text-foreground">{funcoesDoSetor.length} {funcoesDoSetor.length === 1 ? "função" : "funções"}</span>
                            <span>·</span>
                            <span className="font-medium text-foreground">{totalTrabalhadoresSetor} {totalTrabalhadoresSetor === 1 ? "colaborador" : "colaboradores"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleOpenModal("setor", setorAtual)}>
                        <Edit2 className="w-4 h-4 mr-1.5" /> Editar Nome do Setor
                      </Button>
                    </div>
                  </div>

                  {/* BLOCO 1: GES DO SETOR (O Coração da Estrutura) */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                          <Layers className="w-4 h-4 text-primary" />
                          GES deste Setor
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                            {gesDoSetor.length}
                          </span>
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Grupos de Exposição Similar específicos de {setorAtual.nome}.
                        </p>
                      </div>
                      <Button onClick={() => abrirModalGesSetor(setorAtual.id)} size="sm">
                        <Plus className="w-4 h-4 mr-1" /> Novo GES neste Setor
                      </Button>
                    </div>

                    {gesDoSetor.length === 0 ? (
                      <Card className="border-dashed p-6 text-center bg-muted/20">
                        <div className="max-w-md mx-auto space-y-2.5">
                          <Layers className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                          <h4 className="font-semibold text-sm text-foreground">Nenhum GES cadastrado para {setorAtual.nome}</h4>
                          <p className="text-xs text-muted-foreground">
                            O setor existe perfeitamente sem GES. Quando quiser definir riscos e exposições, crie o primeiro grupo e selecione as funções expostas.
                          </p>
                          <Button onClick={() => abrirModalGesSetor(setorAtual.id)} size="sm" className="mt-1">
                            <Plus className="w-4 h-4 mr-1" /> Criar Primeiro GES
                          </Button>
                        </div>
                      </Card>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {gesDoSetor.map((ges: any) => {
                          const funcsIds = new Set(
                            (gheFuncoes as any[])
                              .filter((v) => v.ghe_id === ges.id && v.funcao_id)
                              .map((v) => v.funcao_id),
                          );
                          const funcoesDesteGes = funcoes.filter((f: any) => funcsIds.has(f.id));
                          const trabalhadoresDesteGes = contagemTrabalhadoresPorGes.get(ges.id) || Number(ges.trabalhadores || 0);

                          return (
                            <Card key={ges.id} className="border hover:border-primary/50 transition-all p-3.5 space-y-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <Badge variant="outline" className="font-mono text-xs font-bold text-primary border-primary/30">
                                      {ges.codigo || "GES"}
                                    </Badge>
                                    <h4 className="font-bold text-sm text-foreground truncate">{ges.nome}</h4>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Briefcase className="w-3.5 h-3.5" />
                                      {funcoesDesteGes.length} {funcoesDesteGes.length === 1 ? "função" : "funções"}
                                    </span>
                                    <span>·</span>
                                    <span className="flex items-center gap-1 font-medium text-foreground">
                                      <Users className="w-3.5 h-3.5 text-primary" />
                                      {trabalhadoresDesteGes} {trabalhadoresDesteGes === 1 ? "trabalhador" : "trabalhadores"}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigate(`/cadastro/ghe/${ges.id}/estrutura`)}
                                    title="Estrutura de perigos, riscos e EPIs deste GES"
                                    className="h-8 w-8 p-0"
                                  >
                                    <ListTree className="w-4 h-4 text-primary" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => abrirModalGesSetor(setorAtual.id, ges)}
                                    title="Editar nome e funções deste GES"
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit2 className="w-4 h-4 text-muted-foreground" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleExcluirGesDoSetor(ges.id, ges.nome)}
                                    title="Excluir este GES"
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>

                              {/* Funções do GES */}
                              <div className="pt-2 border-t text-xs">
                                <span className="text-muted-foreground block text-[11px] mb-1">Funções vinculadas:</span>
                                {funcoesDesteGes.length === 0 ? (
                                  <span className="text-amber-600 italic">Nenhuma função vinculada a este GES.</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {funcoesDesteGes.map((f: any) => (
                                      <span key={f.id} className="inline-block bg-muted px-2 py-0.5 rounded text-[11px] text-foreground">
                                        {f.nome}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* BLOCO 2: FUNÇÕES DO SETOR */}
                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-primary" />
                          Funções do Setor
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                            {funcoesDoSetor.length}
                          </span>
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Cargos e funções alocados em {setorAtual.nome}.
                        </p>
                      </div>
                      <Button
                        onClick={() => handleOpenModal("funcao", { setor_id: setorAtual.id })}
                        variant="outline"
                        size="sm"
                      >
                        <Plus className="w-4 h-4 mr-1" /> Nova Função neste Setor
                      </Button>
                    </div>

                    {funcoesDoSetor.length === 0 ? (
                      <Card className="border-dashed p-6 text-center bg-muted/10">
                        <p className="text-xs text-muted-foreground">
                          Nenhuma função cadastrada neste setor ainda. Clique em "Nova Função" para adicionar.
                        </p>
                      </Card>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {funcoesDoSetor.map((f: any) => {
                          const vinculoGes = (gheFuncoes as any[]).find((v) => v.funcao_id === f.id);
                          const gesDestaFuncao = vinculoGes ? gesList.find((g: any) => g.id === vinculoGes.ghe_id) : null;

                          return (
                            <Card key={f.id} className="p-3 flex items-center justify-between gap-2 border">
                              <div className="min-w-0 space-y-0.5">
                                <span className="font-semibold text-xs text-foreground block truncate">{f.nome}</span>
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                  {f.cbo && <span>CBO: {f.cbo}</span>}
                                  {gesDestaFuncao ? (
                                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono text-primary">
                                      {gesDestaFuncao.codigo || gesDestaFuncao.nome}
                                    </Badge>
                                  ) : (
                                    <span className="text-amber-600 text-[10px]">Sem GES</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenModal("funcao", f)}
                                  className="h-7 w-7 p-0"
                                  title="Editar função"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteConfirm({ open: true, type: "funcao", id: f.id, nome: f.nome })}
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                  title="Excluir função"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* BLOCO 3: AMBIENTE E PROCESSOS (Opcional, em detalhes colapsáveis) */}
                  <details className="border rounded-lg p-3 bg-muted/10 text-xs text-muted-foreground group">
                    <summary className="font-semibold text-foreground cursor-pointer flex items-center justify-between">
                      <span>Ambiente físico e processos do setor (Opcional)</span>
                      <span className="text-[11px] text-primary group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="mt-3 space-y-3 pt-3 border-t">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">Ambiente de Trabalho:</span>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenModal("setor", setorAtual)} className="h-7 text-xs">
                          <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar Ambiente
                        </Button>
                      </div>
                      {ambienteAtual ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 bg-background rounded border text-xs">
                          <div><strong>Tipo:</strong> {ambienteAtual.tipo_ambiente || "Próprio"}</div>
                          <div><strong>Pé-direito:</strong> {ambienteAtual.pe_direito ? `${ambienteAtual.pe_direito} m` : "Não informado"}</div>
                          <div className="sm:col-span-2"><strong>Descrição:</strong> {ambienteAtual.descricao || "Não informada"}</div>
                        </div>
                      ) : (
                        <p className="italic">Nenhum detalhe físico de ambiente preenchido.</p>
                      )}
                    </div>
                  </details>
                </div>
              );
            })()
          ) : (
            <>
              <div className="flex flex-wrap justify-between items-center gap-2">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  Setores
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {setores.length} {setores.length === 1 ? "setor" : "setores"}
                  </span>
                </h3>
                <Button onClick={() => handleOpenModal("setor")} size="sm">
                  <Plus className="w-4 h-4 mr-1" /> Novo Setor
                </Button>
              </div>

              {/* Tabela de Setores Simplificada e Métrica */}
              <ListaEstrutura
                itens={setoresOrdenados}
                vazio="Nenhum setor cadastrado."
                rotuloPrincipal="Setor"
                principal={(set) => (
                  <button
                    onClick={() => setSetorDetalheId(set.id)}
                    className="font-bold text-foreground hover:text-primary transition-colors text-left flex items-center gap-1.5 group"
                    title="Clique para abrir os GES e Funções deste setor"
                  >
                    <span>{set.nome}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-primary transition-transform group-hover:translate-x-0.5" />
                  </button>
                )}
                colunas={[
                  {
                    rotulo: "GES",
                    classe: "whitespace-nowrap align-top",
                    celula: (set) => {
                      const ids = new Set((gheSetores as any[])
                        .filter((v) => v.setor_id === set.id).map((v) => v.ghe_id));
                      const grupos = gesList.filter((g: any) => ids.has(g.id));
                      if (!grupos.length) {
                        return (
                          <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50/50 text-[11px] font-normal">
                            0 GES · Sem GES
                          </Badge>
                        );
                      }
                      return (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="secondary" className="font-semibold text-xs">
                            {grupos.length} {grupos.length === 1 ? "GES" : "GES"}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">
                            ({grupos.map((g: any) => g.codigo || g.nome).join(", ")})
                          </span>
                        </div>
                      );
                    },
                  },
                  {
                    rotulo: "Funções",
                    classe: "text-center tabular-nums align-top",
                    celula: (set) => {
                      const total = funcoes.filter((f: any) => f.setor_id === set.id).length;
                      return <span className="font-medium text-foreground">{total}</span>;
                    },
                  },
                  {
                    rotulo: "Colaboradores",
                    classe: "text-center tabular-nums align-top",
                    celula: (set) => {
                      const total = contagemTrabalhadoresPorSetor.get(normalizar(set.nome)) || 0;
                      return <span className="font-medium text-foreground">{total}</span>;
                    },
                  },
                ]}
                acoesExtras={(set) => (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-primary hover:bg-primary/10 hover:text-primary font-medium text-xs h-8 px-2.5 mr-1"
                      onClick={() => setSetorDetalheId(set.id)}
                      title="Abrir setor para gerenciar GES e Funções"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      Abrir setor
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Duplicar setor"
                      onClick={() => duplicarSetor(set.id)}
                      disabled={duplicandoId === set.id}
                      className="h-8 w-8 p-0"
                    >
                      {duplicandoId === set.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/70" />
                      ) : (
                        <ClipboardPaste className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                )}
                rotuloEditar="Editar nome e ambiente do setor"
                onEditar={(set) => handleOpenModal("setor", set)}
                onExcluir={(set) => setDeleteConfirm({ open: true, type: "setor", id: set.id, nome: set.nome })}
              />
            </>
          )}
        </TabsContent>

        {/*
          A aba "Processos" saiu daqui: os processos passaram a ser cadastrados
          por dentro do setor, onde o vínculo já vem pronto. O conteúdo ficou
          para trás sem nenhum gatilho que o abrisse — mesmo acidente que deixou
          as Funções sem porta. Removido de vez para não voltar a confundir.
        */}

        {/* 5. FUNÇÕES */}
        <TabsContent value="funcoes" className="mt-4 space-y-4">
          <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              Funções
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {funcoesFiltradas.length} {funcoesFiltradas.length === 1 ? "função" : "funções"}
              </span>
            </h3>
            <div className="flex flex-1 w-full sm:max-w-xl lg:ml-auto gap-2">
              <Input 
                placeholder="Buscar função..." 
                value={filtroFuncaoTexto} 
                onChange={e => setFiltroFuncaoTexto(e.target.value)} 
                className="h-9" 
              />
              <Select value={filtroFuncaoSetor} onValueChange={setFiltroFuncaoSetor}>
                <SelectTrigger className="w-[180px] h-9 shrink-0">
                  <SelectValue placeholder="Setor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os setores</SelectItem>
                  {setores.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 shrink-0">
              {/*
                Exporta o que está NA TELA, respeitando a busca e o filtro de
                setor. Mandar sempre a lista inteira surpreenderia quem acabou
                de filtrar por um setor para pedir a revisão só daquele.
              */}
              <Button onClick={exportarListaDeFuncoes} size="sm" variant="outline"
                disabled={funcoesFiltradas.length === 0}
                title="Baixar planilha com função, setor e descrição das atividades">
                <Download className="w-4 h-4 mr-1" /> Exportar
              </Button>
              <Button onClick={() => setLoteAberto(true)} size="sm" variant="outline">
                <ClipboardPaste className="w-4 h-4 mr-1" /> Colar em lote
              </Button>
              <Button onClick={() => handleOpenModal("funcao")} size="sm">
                <Plus className="w-4 h-4 mr-1" /> Nova Função
              </Button>
            </div>
          </div>
          {/* Os requisitos de NR continuam sendo marcados no cadastro e
              impressos no PDF — só saíram daqui, onde a descrição das
              atividades diz muito mais sobre a função. */}
          <ListaEstrutura
            itens={funcoesFiltradas}
            vazio="Nenhuma função cadastrada."
            rotuloPrincipal="Nome da Função"
            principal={(func) => func.nome}
            colunas={[
              { rotulo: "Setor", celula: (func) => setores.find((s) => s.id === func.setor_id)?.nome || "—" },
              {
                /*
                 * A descrição sai INTEIRA, quebrando em várias linhas.
                 *
                 * Antes era `max-w-xs truncate`: teto de 320px e corte em uma
                 * linha só, com reticências — numa tabela de quatro colunas,
                 * onde sobrava metade da largura vazia à direita. O texto
                 * completo só aparecia parando o mouse em cima, e é ele que
                 * diz o que a função faz: é a informação da tela, não um
                 * detalhe.
                 */
                rotulo: "Descrição das atividades",
                longo: true,
                classe: "text-sm text-muted-foreground whitespace-normal break-words align-top",
                celula: (func) => (func as any).descricao_atividades || "—",
              },
            ]}
            onEditar={(func) => handleOpenModal("funcao", func)}
            onExcluir={(func) => setDeleteConfirm({ open: true, type: "funcao", id: func.id, nome: func.nome })}
          />
        </TabsContent>

        {/* 3. EXPOSIÇÕES E RISCOS (GES) */}
        <TabsContent value="riscos" className="mt-4">
          <GesExposicoesTab />
        </TabsContent>
      </Tabs>

      {/* COLAR FUNÇÕES EM LOTE */}
      <Dialog open={loteAberto} onOpenChange={setLoteAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Colar funções em lote</DialogTitle>
            <DialogDescription>
              Uma função por linha. Para já descrever a rotina, use
              {" "}<code>Nome | Descrição</code> na mesma linha.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div>
              <Label>Setor de todas elas</Label>
              <Select value={loteSetor} onValueChange={setLoteSetor}>
                <SelectTrigger><SelectValue placeholder="Selecione o setor..." /></SelectTrigger>
                <SelectContent>
                  {setores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Funções</Label>
              <Textarea
                rows={8}
                value={loteTexto}
                onChange={(e) => setLoteTexto(e.target.value)}
                placeholder={"Analista de PCP\nAssistente Administrativo\nAuxiliar Administrativo\nCronometrista\nGerente de Produção"}
              />
            </div>

            {loteLinhas.length > 0 && (
              <div className="rounded-lg border bg-muted/50/60 p-3 text-xs space-y-1">
                <p className="font-medium text-foreground">
                  {loteNovas.length} para cadastrar
                  {loteLinhas.length - loteNovas.length > 0
                    && `, ${loteLinhas.length - loteNovas.length} já existe(m) e será(ão) ignorada(s)`}
                </p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {loteLinhas.map((l, i) => (
                    <Badge key={i} variant={l.repetida ? "outline" : "secondary"}
                      className={`font-normal ${l.repetida ? "text-muted-foreground/70 line-through" : ""}`}>
                      {l.nome}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLoteAberto(false)}>Cancelar</Button>
            <Button type="button" onClick={salvarLote}
              disabled={loteSalvando || loteNovas.length === 0 || !loteSetor}>
              {loteSalvando ? "Cadastrando…" : `Cadastrar ${loteNovas.length || ""}`.trim()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GruposDoSetorDialog
        setor={setorDosGrupos}
        open={!!setorDosGrupos}
        onOpenChange={(aberto) => { if (!aberto) setSetorDosGrupos(null); }}
      />

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
                  onChange={(e) => modalType === "funcao" ? handleFuncaoNameChange(e.target.value) : setFormData({ ...formData, nome: e.target.value })}
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
                  <legend className="px-1 text-xs font-semibold text-muted-foreground">Endereço</legend>
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
                  <Label>Etapas do processo *</Label>
                  <Textarea value={formData.descricao_etapas || ""}
                    onChange={(e) => setFormData({ ...formData, descricao_etapas: e.target.value })}
                    placeholder="Como o trabalho é executado, do início ao fim" />
                </div>
              </>
            )}

            {modalType === "funcao" && (
              <>
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

                {/* Sem CBO, nº de trabalhadores, jornada e treinamentos
                    obrigatórios: alimentavam só a linha de detalhe abaixo de
                    cada função na seção "Funções e Atividades" do PDF do PGR,
                    que já omite o que estiver em branco. CBO e as NRs continuam
                    sendo cadastrados onde de fato importam — o módulo ASO tem
                    formulário próprio, e o PPP/eSocial lê de ghe_funcoes. */}
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

      <GruposDoSetorDialog
        setor={setorDosGrupos}
        open={!!setorDosGrupos}
        onOpenChange={(open) => { if (!open) setSetorDosGrupos(null); }}
      />

      {/* Modal de Criação e Edição de GES contextualizado no Setor */}
      <Dialog open={openGesSetorModal} onOpenChange={setOpenGesSetorModal}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>
              {gesSetorFormData.id ? "Editar GES" : "Novo GES"} — Setor {setores.find(s => s.id === gesSetorFormData.setor_id)?.nome}
            </DialogTitle>
            <DialogDescription>
              Defina o código sequencial, nome do grupo e selecione as funções que compartilham as mesmas exposições.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarGesSetor} className="space-y-4 pt-1">
            {erroGesSetor && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{erroGesSetor}</span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="gesCodigo" className="text-xs font-semibold">Código Interno *</Label>
                <Input
                  id="gesCodigo"
                  value={gesSetorFormData.codigo}
                  onChange={(e) => setGesSetorFormData({ ...gesSetorFormData, codigo: e.target.value })}
                  placeholder="ex: GES-01"
                  className="mt-1 font-mono text-xs"
                  required
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="gesNome" className="text-xs font-semibold">Nome do GES *</Label>
                <Input
                  id="gesNome"
                  value={gesSetorFormData.nome}
                  onChange={(e) => setGesSetorFormData({ ...gesSetorFormData, nome: e.target.value })}
                  placeholder="ex: Costura Produção"
                  className="mt-1 text-xs"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="gesDescricao" className="text-xs font-semibold">Descrição / Critério de Agrupamento</Label>
              <Textarea
                id="gesDescricao"
                value={gesSetorFormData.descricao}
                onChange={(e) => setGesSetorFormData({ ...gesSetorFormData, descricao: e.target.value })}
                placeholder="Descreva as condições ou atividades compartilhadas pelo grupo..."
                className="mt-1 text-xs"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">
                  Funções vinculadas ({gesSetorFuncoesSelecionadas.length} de {funcoes.filter((f: any) => f.setor_id === gesSetorFormData.setor_id).length} selecionadas)
                </Label>
                <span className="text-[11px] text-muted-foreground">Marque quem tem a mesma exposição</span>
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1 bg-muted/20">
                {funcoes.filter((f: any) => f.setor_id === gesSetorFormData.setor_id).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-3 text-center">
                    Nenhuma função cadastrada neste setor ainda. Você poderá adicioná-las e vinculá-las depois.
                  </p>
                ) : (
                  funcoes.filter((f: any) => f.setor_id === gesSetorFormData.setor_id).map((f: any) => {
                    const selecionada = gesSetorFuncoesSelecionadas.includes(f.id);
                    return (
                      <label
                        key={f.id}
                        className={`flex items-center gap-2.5 p-2 rounded-md text-xs cursor-pointer transition-colors ${
                          selecionada ? "bg-primary/10 text-primary font-medium border border-primary/20" : "hover:bg-muted text-foreground"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selecionada}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setGesSetorFuncoesSelecionadas([...gesSetorFuncoesSelecionadas, f.id]);
                            } else {
                              setGesSetorFuncoesSelecionadas(gesSetorFuncoesSelecionadas.filter(id => id !== f.id));
                            }
                          }}
                          className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                        />
                        <span className="flex-1">{f.nome}</span>
                        {f.cbo && <span className="text-[10px] text-muted-foreground font-mono">CBO {f.cbo}</span>}
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpenGesSetorModal(false)} disabled={salvandoGesSetor}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvandoGesSetor}>
                {salvandoGesSetor && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {gesSetorFormData.id ? "Atualizar GES" : "Criar GES"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
