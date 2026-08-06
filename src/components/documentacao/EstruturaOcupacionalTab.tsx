import React, { useMemo, useState } from "react";
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
import { caracteristicasAmbiente } from "@/lib/sstEstrutura";
import { GruposDoSetorDialog } from "./GruposDoSetorDialog";
import { Building2, LayoutGrid, Workflow, Briefcase, Layers, ClipboardPaste, Plus, Edit2, Loader2, Trash2, AlertTriangle } from "lucide-react";

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
  /**
   * Campo de texto corrido. No cartão do celular o rótulo vai numa linha
   * própria e o valor ocupa a largura toda, cortado em 3 linhas.
   *
   * Lado a lado, um rótulo comprido ("Descrição das atividades:") comia metade
   * da largura e sobrava uma coluna estreita onde um parágrafo virava vinte
   * linhas — um único cadastro tomava a tela inteira e a lista deixava de ser
   * navegável.
   */
  longo?: boolean;
}

/**
 * Listagem da Estrutura Ocupacional: cartões no celular, tabela no desktop.
 *
 * As tabelas tinham até 7 colunas. Em 390px de largura isso não cabe de jeito
 * nenhum: o CNPJ quebrava no meio do número ("51.213.683/000 04") e a coluna
 * de Ações era empurrada para fora da tela — os botões de editar e excluir
 * simplesmente não existiam no celular. No cartão cada campo ganha o próprio
 * rótulo e o texto pode quebrar à vontade.
 */
function ListaEstrutura<T extends { id: string }>({
  itens, vazio, rotuloPrincipal, principal, colunas, onEditar, onExcluir, acoesExtras,
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
}) {
  const acoes = (item: T) => (
    <div className="flex justify-end gap-1 shrink-0">
      {acoesExtras?.(item)}
      <Button onClick={() => onEditar(item)} variant="ghost" size="sm" aria-label="Editar">
        <Edit2 className="w-4 h-4 text-slate-600" />
      </Button>
      <Button onClick={() => onExcluir(item)} variant="ghost" size="sm" aria-label="Excluir">
        <Trash2 className="w-4 h-4 text-red-600" />
      </Button>
    </div>
  );

  if (itens.length === 0) {
    return <Card className="p-6 text-center text-sm text-slate-400">{vazio}</Card>;
  }

  return (
    <>
      <div className="space-y-2 sm:hidden">
        {itens.map((item) => (
          <Card key={item.id} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 font-medium text-slate-900">{principal(item)}</div>
              {acoes(item)}
            </div>
            <dl className="mt-2 space-y-1.5">
              {colunas.map((c) => (c.longo ? (
                <div key={c.rotulo} className="text-xs">
                  <dt className="text-slate-500">{c.rotulo}</dt>
                  <dd className="mt-0.5 break-words text-slate-700 line-clamp-3">{c.celula(item)}</dd>
                </div>
              ) : (
                <div key={c.rotulo} className="flex gap-2 text-xs">
                  <dt className="shrink-0 text-slate-500">{c.rotulo}:</dt>
                  <dd className="min-w-0 break-words text-slate-700">{c.celula(item)}</dd>
                </div>
              )))}
            </dl>
          </Card>
        ))}
      </div>

      <Card className="hidden sm:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{rotuloPrincipal}</TableHead>
              {colunas.map((c) => <TableHead key={c.rotulo} className={c.classe}>{c.rotulo}</TableHead>)}
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium text-slate-900">{principal(item)}</TableCell>
                {colunas.map((c) => (
                  <TableCell key={c.rotulo} className={c.classe} title={c.dica?.(item)}>
                    {c.celula(item)}
                  </TableCell>
                ))}
                <TableCell className="text-right">{acoes(item)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

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
    saveGes,
    vincularGesSetor,
    vincularGesFuncao,
    gesList,
    gheSetores,
    gheFuncoes,
    deleteEstabelecimento,
    deleteAmbiente,
    deleteSetor,
    deleteProcesso,
    deleteFuncao,
  } = useNucleoMestreSst();

  const { toast } = useToast();

  const [activeSubTab, setActiveSubTab] = useState<string>("estabelecimentos");
  const [setorDetalheId, setSetorDetalheId] = useState<string | null>(null);

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
        const setorSalvo = await saveSetor({
          id: formData.id,
          nome: formData.nome,
          ambiente_id: (ambienteSalvo as any).id,
        } as any);

        // O GES do setor também sai daqui. Exigir um cadastro separado só
        // produzia GES sem critério nenhum, batizados com nome de setor — ou
        // seja, o mesmo cadastro feito duas vezes. Continua dando para criar um
        // GES à mão na aba GES quando um setor tiver exposições diferentes,
        // que é o caso em que a NR-01 realmente separa os dois.
        const setorId = (setorSalvo as any).id;
        const vinculo = (gheSetores as any[]).find((v) => v.setor_id === setorId);
        const gesExistente = vinculo && gesList.find((g: any) => g.id === vinculo.ghe_id);
        const proximoCodigo = String(
          gesList.reduce((max: number, g: any) => Math.max(max, Number(g.codigo) || 0), 0) + 1,
        ).padStart(2, "0");
        const gesSalvo = await saveGes({
          id: gesExistente?.id,
          codigo: gesExistente?.codigo || proximoCodigo,
          nome: formData.nome,
          // Sem critério, o PDF do PGR imprime "não declarado — pendente de
          // justificativa técnica" em todo grupo, e a tela de GES estampa o
          // aviso amarelo. Como aqui o agrupamento É o setor, o critério é
          // exatamente esse — dito por escrito, e editável na aba GES por quem
          // quiser detalhar. Nunca sobrescreve um critério já escrito à mão.
          criterio_agrupamento: gesExistente?.criterio_agrupamento
            || `Agrupamento por setor: todos os trabalhadores de ${formData.nome} atuam no mesmo ambiente e estão sujeitos às mesmas condições de exposição.`,
          _silencioso: true,
        } as any);
        await vincularGesSetor({
          ges_id: (gesSalvo as any).id,
          setor_id: setorId,
          nome: formData.nome,
        });
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

      // 3. Clonar GES
      const vinculo = (gheSetores as any[]).find((v) => v.setor_id === setorId);
      const gesExistente = vinculo && gesList.find((g: any) => g.id === vinculo.ghe_id);
      
      let novoGesId = null;
      if (gesExistente) {
        const proximoCodigo = String(
          gesList.reduce((max: number, g: any) => Math.max(max, Number(g.codigo) || 0), 0) + 1,
        ).padStart(2, "0");
        const gesSalvo = await saveGes({
          codigo: proximoCodigo,
          nome: `${setorOriginal.nome} (Cópia)`,
          criterio_agrupamento: gesExistente.criterio_agrupamento,
          _silencioso: true,
        } as any);
        novoGesId = (gesSalvo as any).id;
        await vincularGesSetor({
          ges_id: novoGesId,
          setor_id: novoSetorId,
          nome: `${setorOriginal.nome} (Cópia)`,
        });
      }

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
        const funcSalva: any = await saveFuncao({
          nome: f.nome,
          descricao_atividades: f.descricao_atividades,
          setor_id: novoSetorId,
          _silencioso: true,
        } as any);

        if (novoGesId) {
          await vincularGesFuncao({
            ges_id: novoGesId,
            funcao_id: funcSalva.id,
            nome_funcao: f.nome,
            setor_nome: `${setorOriginal.nome} (Cópia)`,
          });
        }
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
        {!only && !setorDetalheId && (
          <TabsList className="grid grid-cols-2 w-full lg:inline-flex lg:w-auto bg-slate-100 p-1 rounded-lg h-auto">
            <TabsTrigger value="estabelecimentos" className="text-xs font-medium flex items-center gap-1">
              <Building2 className="w-4 h-4" /> Estabelecimentos
            </TabsTrigger>
            <TabsTrigger value="setores" className="text-xs font-medium flex items-center gap-1">
              <LayoutGrid className="w-4 h-4" /> Setores
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
          <ListaEstrutura
            itens={estabelecimentos}
            vazio="Nenhum estabelecimento cadastrado."
            rotuloPrincipal="Nome / Unidade"
            principal={(est) => (
              <>
                {est.nome}
                {est.nome_fantasia && (
                  <span className="block text-xs font-normal text-slate-500">{est.nome_fantasia}</span>
                )}
              </>
            )}
            colunas={[
              { rotulo: "Tipo", celula: (est) => <Badge variant="outline">{est.tipo}</Badge> },
              { rotulo: "CNPJ / CNO", celula: (est) => est.cnpj || est.cno || "-" },
              {
                rotulo: "CNAE / Grau Risco",
                celula: (est) => est.cnae_principal
                  ? `${est.cnae_principal}${est.grau_risco ? ` (Grau ${est.grau_risco})` : ""}`
                  : "-",
              },
              {
                rotulo: "Endereço",
                longo: true,
                classe: "text-xs text-slate-600 max-w-[220px]",
                celula: (est) => formatarEndereco(est.endereco) || "-",
              },
              { rotulo: "Trab.", classe: "text-right", celula: (est) => est.qtd_trabalhadores ?? "-" },
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
              const vinculo = (gheSetores as any[]).find((v) => v.setor_id === setorDetalheId);
              const gesExistente = vinculo && gesList.find((g: any) => g.id === vinculo.ghe_id);

              return (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="flex flex-wrap items-center gap-4 border-b pb-4">
                    <Button variant="ghost" size="sm" onClick={() => setSetorDetalheId(null)} className="shrink-0">
                      &larr; Voltar
                    </Button>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Setor: {setorAtual.nome}</h3>
                      <p className="text-sm text-slate-500">
                        {gesExistente ? `Grupo de Exposição: ${gesExistente.nome}` : 'Sem grupo de exposição vinculado'}
                      </p>
                    </div>
                  </div>

                  {/* Detalhes do Ambiente */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-slate-800 text-lg">Ambiente de Trabalho</h4>
                      <Button variant="outline" size="sm" onClick={() => handleOpenModal("setor", setorAtual)}>
                        <Edit2 className="w-4 h-4 mr-1" /> Editar
                      </Button>
                    </div>
                    {ambienteAtual ? (
                      <Card className="p-4 bg-slate-50/50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-slate-500 block mb-1">Tipo de Ambiente</span>
                            <Badge variant="outline">{ambienteAtual.tipo_ambiente}</Badge>
                          </div>
                          {ambienteAtual.pe_direito && (
                            <div>
                              <span className="text-slate-500 block mb-1">Pé-direito</span>
                              <span className="font-medium text-slate-700">{ambienteAtual.pe_direito} m</span>
                            </div>
                          )}
                          <div className="md:col-span-2">
                            <span className="text-slate-500 block mb-1">Caracterização Física</span>
                            <p className="text-slate-700">{ambienteAtual.descricao || "Não informada"}</p>
                          </div>
                        </div>
                      </Card>
                    ) : (
                      <p className="text-sm text-slate-500 italic">Ambiente não caracterizado.</p>
                    )}
                  </div>

                  {/* Processos */}
                  <div className="space-y-4">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <h4 className="font-semibold text-slate-800 text-lg">Processos de Trabalho</h4>
                      <Button onClick={() => {
                        setFormData({ setor_id: setorDetalheId });
                        setModalType("processo");
                        setOpenModal(true);
                      }} size="sm">
                        <Plus className="w-4 h-4 mr-1" /> Novo Processo
                      </Button>
                    </div>
                    <ListaEstrutura
                      itens={processosDoSetor}
                      vazio="Nenhum processo neste setor."
                      rotuloPrincipal="Nome / Etapas"
                      principal={(proc) => proc.descricao_etapas || "-"}
                      colunas={[
                        {
                          rotulo: "Característica",
                          celula: (proc) => <Badge variant="outline">{proc.caracteristica_atividade}</Badge>,
                        }
                      ]}
                      onEditar={(proc) => handleOpenModal("processo", proc)}
                      onExcluir={(proc) => setDeleteConfirm({ open: true, type: "processo", id: proc.id, nome: proc.nome })}
                    />
                  </div>

                  {/* Funções */}
                  <div className="space-y-4">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <h4 className="font-semibold text-slate-800 text-lg">Funções</h4>
                      <div className="flex gap-2">
                        <Button onClick={() => {
                          setLoteSetor(setorDetalheId);
                          setLoteAberto(true);
                        }} size="sm" variant="outline">
                          <ClipboardPaste className="w-4 h-4 mr-1" /> Colar em lote
                        </Button>
                        <Button onClick={() => {
                          setFormData({ setor_id: setorDetalheId });
                          setModalType("funcao");
                          setOpenModal(true);
                        }} size="sm">
                          <Plus className="w-4 h-4 mr-1" /> Nova Função
                        </Button>
                      </div>
                    </div>
                    <ListaEstrutura
                      itens={funcoesDoSetor}
                      vazio="Nenhuma função neste setor."
                      rotuloPrincipal="Nome da Função"
                      principal={(func) => func.nome}
                      colunas={[
                        {
                          rotulo: "Descrição das atividades",
                          longo: true,
                          classe: "text-sm text-slate-600 max-w-xs truncate",
                          dica: (func) => (func as any).descricao_atividades || "",
                          celula: (func) => (func as any).descricao_atividades || "—",
                        },
                      ]}
                      onEditar={(func) => handleOpenModal("funcao", func)}
                      onExcluir={(func) => setDeleteConfirm({ open: true, type: "funcao", id: func.id, nome: func.nome })}
                    />
                  </div>
                </div>
              );
            })()
          ) : (
            <>
              <div className="flex flex-wrap justify-between items-center gap-2">
                <h3 className="font-semibold text-slate-800">Setores</h3>
                <Button onClick={() => handleOpenModal("setor")} size="sm">
                  <Plus className="w-4 h-4 mr-1" /> Novo Setor
                </Button>
              </div>
              <ListaEstrutura
                itens={setores}
                vazio="Nenhum setor cadastrado."
                rotuloPrincipal="Nome do Setor"
                principal={(set) => set.nome}
                colunas={[
                  {
                    rotulo: "Ambiente de trabalho",
                    longo: true,
                    classe: "text-sm text-slate-600 max-w-xs truncate",
                    dica: (set) => caracteristicasAmbiente(ambientes.find((a) => a.id === set.ambiente_id)),
                    celula: (set) =>
                      caracteristicasAmbiente(ambientes.find((a) => a.id === set.ambiente_id)) || "—",
                  },
                  {
                    rotulo: "Grupos de exposição",
                    celula: (set) => {
                      const ids = new Set((gheSetores as any[])
                        .filter((v) => v.setor_id === set.id).map((v) => v.ghe_id));
                      const grupos = gesList.filter((g: any) => ids.has(g.id));
                      return grupos.length
                        ? grupos.map((g: any) => g.nome).join(" · ")
                        : "—";
                    },
                  },
                ]}
                acoesExtras={(set) => (
                  <>
                    <Button variant="ghost" size="sm" aria-label="Duplicar setor"
                      onClick={() => duplicarSetor(set.id)} disabled={duplicandoId === set.id}>
                      {duplicandoId === set.id ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <ClipboardPaste className="w-4 h-4 text-slate-600" />}
                    </Button>
                    <Button variant="default" size="sm" className="ml-1 px-3 bg-indigo-600 hover:bg-indigo-700" aria-label="Gerenciar este setor"
                      onClick={() => setSetorDetalheId(set.id)}>
                      Gerenciar
                    </Button>
                  </>
                )}
                onEditar={(set) => handleOpenModal("setor", set)}
                onExcluir={(set) => setDeleteConfirm({ open: true, type: "setor", id: set.id, nome: set.nome })}
              />
            </>
          )}
        </TabsContent>

        {/* 4. PROCESSOS */}
        <TabsContent value="processos" className="mt-4 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h3 className="font-semibold text-slate-800">Processos de trabalho</h3>
            <Button onClick={() => handleOpenModal("processo")} size="sm">
              <Plus className="w-4 h-4 mr-1" /> Novo Processo
            </Button>
          </div>
          {/* Sem a coluna "Nome do Processo": o nome é gerado a partir da
              primeira frase das etapas, então ficava ao lado da própria
              descrição, dizendo a mesma coisa cortada mais cedo. O nome segue
              existindo — é o rótulo usado no PDF e nos seletores do PGR. */}
          <ListaEstrutura
            itens={processos}
            vazio="Nenhum processo cadastrado."
            rotuloPrincipal="Setor"
            principal={(proc) => setores.find((s) => s.id === proc.setor_id)?.nome || "-"}
            colunas={[
              {
                rotulo: "Característica",
                celula: (proc) => <Badge variant="outline">{proc.caracteristica_atividade}</Badge>,
              },
              {
                rotulo: "Descrição do processo",
                longo: true,
                classe: "text-sm text-slate-600 max-w-md truncate",
                dica: (proc) => proc.descricao_etapas || "",
                celula: (proc) => proc.descricao_etapas || "—",
              },
            ]}
            onEditar={(proc) => handleOpenModal("processo", proc)}
            onExcluir={(proc) => setDeleteConfirm({ open: true, type: "processo", id: proc.id, nome: proc.nome })}
          />
        </TabsContent>

        {/* 5. FUNÇÕES */}
        <TabsContent value="funcoes" className="mt-4 space-y-4">
          <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-3">
            <h3 className="font-semibold text-slate-800">Funções</h3>
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
              { rotulo: "Setor", celula: (func) => setores.find((s) => s.id === func.setor_id)?.nome || "-" },
              {
                rotulo: "Descrição das atividades",
                longo: true,
                classe: "text-sm text-slate-600 max-w-xs truncate",
                dica: (func) => (func as any).descricao_atividades || "",
                celula: (func) => (func as any).descricao_atividades || "—",
              },
            ]}
            onEditar={(func) => handleOpenModal("funcao", func)}
            onExcluir={(func) => setDeleteConfirm({ open: true, type: "funcao", id: func.id, nome: func.nome })}
          />
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
              <div className="rounded-lg border bg-slate-50/60 p-3 text-xs space-y-1">
                <p className="font-medium text-slate-700">
                  {loteNovas.length} para cadastrar
                  {loteLinhas.length - loteNovas.length > 0
                    && `, ${loteLinhas.length - loteNovas.length} já existe(m) e será(ão) ignorada(s)`}
                </p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {loteLinhas.map((l, i) => (
                    <Badge key={i} variant={l.repetida ? "outline" : "secondary"}
                      className={`font-normal ${l.repetida ? "text-slate-400 line-through" : ""}`}>
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
    </div>
  );
}
