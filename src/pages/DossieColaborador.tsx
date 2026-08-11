import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowLeft, User, Upload, Loader2, History, ExternalLink, Archive, RefreshCw, Info, FileStack,
  ScanLine, FileText,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import SituacaoBadge from "@/components/arquivo-digital/SituacaoBadge";
import ScannerDocumento from "@/components/ScannerDocumento";
import {
  garantirDocumento, publicarVersao, urlTemporaria, registrarAcesso, registrarEvento,
  historicoVersoes, arquivarDocumento, definirEmRenovacao, prepararAbertura,
  PESO_SITUACAO, type SituacaoDocumento,
} from "@/lib/arquivoDigital";

const TABELA_AUSENTE = new Set(["42P01", "PGRST205", "PGRST202"]);
const ehTabelaAusente = (e: any) =>
  !!e && (TABELA_AUSENTE.has(e.code) || /does not exist|schema cache/i.test(e.message || ""));

const dataBr = (iso?: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const dataHoraBr = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
const hoje = () => new Date().toISOString().slice(0, 10);

function maskCpf(cpf?: string | null) {
  if (!cpf) return "—";
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.***.***-${d.slice(9)}`;
}

interface Funcionario {
  id: string; nome: string; cpf: string | null; cargo: string | null; setor: string | null;
  matricula: string | null; empresa_id: string | null; unidade_id: string | null;
  data_admissao: string | null; data_demissao: string | null;
}
interface TipoDocumento {
  id: string; nome: string; categoria: string; validade_meses: number | null;
  empresa_id: string | null; dias_aviso: number[] | null;
}
interface Requisito { tipo_documento_id: string; cargo: string | null; obrigatorio: boolean }
interface Responsavel { tipo_documento_id: string | null; email: string; nome: string | null }
interface DocSituacao {
  id: string; tipo_documento_id: string; situacao: SituacaoDocumento;
  data_emissao: string | null; data_validade: string | null; dias_para_vencer: number | null;
  caminho_arquivo: string | null; versao_id: string | null; total_versoes: number;
  enviado_em: string | null; enviado_por: string | null; arquivado_motivo: string | null;
}

/** Uma linha da tabela do dossiê: tipo + o documento dele, se existir. */
interface LinhaDossie {
  tipo: TipoDocumento;
  doc: DocSituacao | null;
  situacao: SituacaoDocumento;
  responsavel: string | null;
}

export default function DossieColaborador() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, empresaId } = useAuth();
  const { canEdit, canDelete } = usePermissions("arquivo_digital");

  const [funcionario, setFuncionario] = useState<Funcionario | null | undefined>(undefined);
  const [empresaNome, setEmpresaNome] = useState("");
  const [unidadeNome, setUnidadeNome] = useState("");
  const [tipos, setTipos] = useState<TipoDocumento[]>([]);
  const [docs, setDocs] = useState<DocSituacao[]>([]);
  const [requisitos, setRequisitos] = useState<Requisito[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [indisponivel, setIndisponivel] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [mostrarNaoAplicaveis, setMostrarNaoAplicaveis] = useState(false);

  // Diálogos
  const [envio, setEnvio] = useState<LinhaDossie | null>(null);
  const [envioData, setEnvioData] = useState(hoje());
  const [envioObs, setEnvioObs] = useState("");
  const [enviando, setEnviando] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [arquivoSel, setArquivoSel] = useState<File | null>(null);
  const [scannerAberto, setScannerAberto] = useState(false);

  const [histDe, setHistDe] = useState<LinhaDossie | null>(null);
  const [versoes, setVersoes] = useState<any[] | null>(null);

  const [arquivarDe, setArquivarDe] = useState<LinhaDossie | null>(null);
  const [motivoArquivo, setMotivoArquivo] = useState("");
  const [arquivando, setArquivando] = useState(false);

  const empresaDoc = funcionario?.empresa_id || empresaId || "";

  const carregarDocs = useCallback(async () => {
    if (!id) return;
    const { data, error } = await (supabase.from as any)("internal_documents_situacao")
      .select("id, tipo_documento_id, situacao, data_emissao, data_validade, dias_para_vencer, caminho_arquivo, versao_id, total_versoes, enviado_em, enviado_por, arquivado_motivo")
      .eq("colaborador_id", id);
    if (error) { if (ehTabelaAusente(error)) setIndisponivel(true); return; }
    setDocs((data || []) as DocSituacao[]);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelado = false;
    void (async () => {
      setCarregando(true);
      const { data } = await supabase.from("funcionarios")
        .select("id, nome, cpf, cargo, setor, matricula, empresa_id, unidade_id, data_admissao, data_demissao")
        .eq("id", id).maybeSingle();
      if (cancelado) return;
      setFuncionario((data as Funcionario) || null);
      setCarregando(false);
    })();
    return () => { cancelado = true; };
  }, [id]);

  useEffect(() => {
    if (!funcionario?.empresa_id) return;
    supabase.from("empresa_config").select("nome").eq("id", funcionario.empresa_id).maybeSingle()
      .then(({ data }) => { if (data) setEmpresaNome(data.nome); });
  }, [funcionario?.empresa_id]);

  useEffect(() => {
    if (!funcionario?.unidade_id) { setUnidadeNome(""); return; }
    supabase.from("empresa_config").select("nome").eq("id", funcionario.unidade_id).maybeSingle()
      .then(({ data }) => setUnidadeNome(data?.nome || ""));
  }, [funcionario?.unidade_id]);

  // Tipos: catálogo global (empresa_id null) + os da própria empresa.
  useEffect(() => {
    void (async () => {
      const { data, error } = await (supabase.from as any)("internal_document_types")
        .select("id, nome, categoria, validade_meses, empresa_id, dias_aviso")
        .eq("ativo", true).order("nome");
      if (error) { if (ehTabelaAusente(error)) setIndisponivel(true); return; }
      setTipos((data || []) as TipoDocumento[]);
    })();
  }, []);

  useEffect(() => { void carregarDocs(); }, [carregarDocs]);

  useEffect(() => {
    if (!empresaDoc) return;
    (supabase.from as any)("internal_document_requirements")
      .select("tipo_documento_id, cargo, obrigatorio").eq("empresa_id", empresaDoc)
      .then(({ data }: any) => setRequisitos(data || []));
    (supabase.from as any)("document_responsibles")
      .select("tipo_documento_id, email, nome").eq("empresa_id", empresaDoc)
      .then(({ data }: any) => setResponsaveis(data || []));
  }, [empresaDoc]);

  const docPorTipo = useMemo(
    () => new Map(docs.map((d) => [d.tipo_documento_id, d])), [docs],
  );

  /**
   * Monta as linhas do dossiê.
   *
   * Tipo COM documento sempre aparece. Tipo SEM documento só aparece
   * como "Não enviado" se algum requisito o exigir para o cargo deste
   * colaborador — senão é "Não aplicável" e fica escondido atrás do
   * checkbox. Sem essa distinção, o dossiê cobraria NR-35 de quem
   * trabalha sentado e a lista viraria ruído que ninguém olha.
   */
  const linhas = useMemo<LinhaDossie[]>(() => {
    const cargo = (funcionario?.cargo || "").trim().toLowerCase();
    const respDe = (tipoId: string) => {
      const especifico = responsaveis.find((r) => r.tipo_documento_id === tipoId);
      const geral = responsaveis.find((r) => !r.tipo_documento_id);
      const r = especifico || geral;
      return r ? (r.nome || r.email) : null;
    };

    const exigido = (tipoId: string) => requisitos.some((r) =>
      r.tipo_documento_id === tipoId && r.obrigatorio !== false &&
      (!r.cargo || r.cargo.trim().toLowerCase() === cargo));

    return tipos.map((tipo) => {
      const doc = docPorTipo.get(tipo.id) || null;
      const situacao: SituacaoDocumento = doc
        ? doc.situacao
        : (exigido(tipo.id) ? "nao_enviado" : "nao_aplicavel");
      return { tipo, doc, situacao, responsavel: respDe(tipo.id) };
    })
      .filter((l) => l.doc || l.situacao === "nao_enviado" || mostrarNaoAplicaveis)
      .sort((a, b) => {
        const p = PESO_SITUACAO[a.situacao] - PESO_SITUACAO[b.situacao];
        return p !== 0 ? p : a.tipo.nome.localeCompare(b.tipo.nome);
      });
  }, [tipos, docPorTipo, requisitos, responsaveis, funcionario?.cargo, mostrarNaoAplicaveis]);

  const resumo = useMemo(() => {
    const c: Partial<Record<SituacaoDocumento, number>> = {};
    linhas.forEach((l) => { c[l.situacao] = (c[l.situacao] || 0) + 1; });
    return c;
  }, [linhas]);

  const abrir = async (l: LinhaDossie) => {
    if (!l.doc?.caminho_arquivo) return;
    // A aba tem que nascer aqui, dentro do toque — ver prepararAbertura.
    const ir = prepararAbertura();
    const url = await urlTemporaria(l.doc.caminho_arquivo);
    if (!url) { ir(null); toast({ title: "Não foi possível abrir o documento", variant: "destructive" }); return; }
    ir(url);
    void registrarAcesso({
      documentoId: l.doc.id, versaoId: l.doc.versao_id, empresaId: empresaDoc,
      colaboradorId: funcionario?.id, userId: user?.id, userEmail: user?.email,
    });
  };

  const abrirEnvio = (l: LinhaDossie) => {
    setEnvio(l); setEnvioData(hoje()); setEnvioObs(""); setArquivoSel(null);
  };

  const confirmarEnvio = async () => {
    if (!envio || !funcionario) return;
    // Regra do módulo: documento sem arquivo não entra. Data sozinha não
    // é evidência — é exatamente o que o Arquivo Digital veio substituir.
    if (!arquivoSel) { toast({ title: "Anexe o arquivo do documento", variant: "destructive" }); return; }
    if (arquivoSel.type !== "application/pdf") { toast({ title: "Apenas arquivos PDF são aceitos. Imagens não são permitidas.", variant: "destructive" }); return; }
    if (!empresaDoc) { toast({ title: "Colaborador sem empresa definida", variant: "destructive" }); return; }

    setEnviando(true);
    try {
      const renovacao = !!envio.doc;
      const documentoId = envio.doc?.id || await garantirDocumento({
        empresaId: empresaDoc, colaboradorId: funcionario.id, tipoDocumentoId: envio.tipo.id,
        unidadeId: funcionario.unidade_id, origemTabela: "dossie", origemId: funcionario.id,
        userId: user?.id,
      });
      const versao = await publicarVersao({
        empresaId: empresaDoc, documentoId, colaboradorId: funcionario.id, file: arquivoSel,
        dataEmissao: envioData || hoje(), validadeMeses: envio.tipo.validade_meses,
        observacao: envioObs || null, userId: user?.id,
        origemTabela: "dossie", origemId: funcionario.id,
      });
      await registrarEvento({
        empresaId: empresaDoc, documentoId, versaoId: versao?.id, colaboradorId: funcionario.id,
        acao: renovacao ? "renovou" : "enviou",
        detalhe: `${envio.tipo.nome} — ${arquivoSel.name}`,
        userId: user?.id, userEmail: user?.email,
      });
      toast({ title: renovacao ? "Documento renovado" : "Documento anexado",
        description: renovacao ? "A versão anterior continua no histórico como substituída." : undefined });
      setEnvio(null);
      await carregarDocs();
    } catch (e: any) {
      toast({
        title: "Erro ao enviar documento",
        description: ehTabelaAusente(e) ? "O Arquivo Digital ainda não foi ativado neste banco." : e?.message,
        variant: "destructive",
      });
    } finally { setEnviando(false); }
  };

  const abrirHistorico = async (l: LinhaDossie) => {
    setHistDe(l); setVersoes(null);
    if (!l.doc) { setVersoes([]); return; }
    setVersoes(await historicoVersoes(l.doc.id));
  };

  const confirmarArquivamento = async () => {
    if (!arquivarDe?.doc || !motivoArquivo.trim()) return;
    setArquivando(true);
    try {
      await arquivarDocumento({
        documentoId: arquivarDe.doc.id, empresaId: empresaDoc,
        colaboradorId: funcionario?.id, motivo: motivoArquivo,
        userId: user?.id, userEmail: user?.email,
      });
      toast({ title: "Documento arquivado", description: "Nada foi apagado — segue no histórico." });
      setArquivarDe(null); setMotivoArquivo("");
      await carregarDocs();
    } catch (e: any) {
      toast({ title: "Erro ao arquivar", description: e?.message, variant: "destructive" });
    } finally { setArquivando(false); }
  };

  const alternarRenovacao = async (l: LinhaDossie) => {
    if (!l.doc) return;
    try {
      await definirEmRenovacao({
        documentoId: l.doc.id, empresaId: empresaDoc, colaboradorId: funcionario?.id,
        emRenovacao: l.situacao !== "em_renovacao", userId: user?.id, userEmail: user?.email,
      });
      await carregarDocs();
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message, variant: "destructive" });
    }
  };

  if (carregando || funcionario === undefined) {
    return <div className="p-6 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Carregando…</div>;
  }

  if (funcionario === null) {
    return (
      <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate("/arquivo-digital/dossies")}>
          <ArrowLeft className="w-4 h-4 mr-2" />Voltar
        </Button>
        <p className="text-sm text-muted-foreground">Colaborador não encontrado.</p>
      </div>
    );
  }

  const desligado = !!funcionario.data_demissao;

  /**
   * Ações de um documento — as mesmas na tabela e no cartão.
   *
   * `comRotulos` é para o celular: no cartão, botão só com ícone não se
   * entende. Ninguém adivinha que a seta circular é "marcar em renovação"
   * nem que a caixinha é "arquivar" sem passar o mouse por cima — e no
   * celular não existe passar o mouse por cima.
   */
  function AcoesDocumento({ l, comRotulos = false }: { l: LinhaDossie; comRotulos?: boolean }) {
    const arquivado = l.situacao === "arquivado";
    const emRenovacao = l.situacao === "em_renovacao";
    return (
      <div className={`flex gap-1 flex-wrap ${comRotulos ? "" : "justify-end"}`}>
        {l.doc?.caminho_arquivo && (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => abrir(l)}>
            <ExternalLink className="w-3.5 h-3.5 mr-1" />Ver
          </Button>
        )}
        {canEdit && !arquivado && (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => abrirEnvio(l)}>
            <Upload className="w-3.5 h-3.5 mr-1" />
            {/* "Renovar" só quando existe versão para renovar. A linha do
                documento pode existir com zero versões — foi o que sobrou das
                tentativas de anexo barradas pela permissão do bucket —, e aí
                oferecer "Renovar" num item "Não enviado" não faz sentido. */}
            {(l.doc?.total_versoes || 0) > 0 ? "Renovar" : "Anexar"}
          </Button>
        )}
        {canEdit && l.doc && !arquivado && (
          <Button size="sm" variant="ghost" className="h-8 text-xs"
            title={emRenovacao ? "Cancelar renovação" : "Marcar em renovação"}
            onClick={() => alternarRenovacao(l)}>
            <RefreshCw className={`w-3.5 h-3.5 ${emRenovacao ? "text-blue-600" : ""} ${comRotulos ? "mr-1" : ""}`} />
            {comRotulos && (emRenovacao ? "Cancelar renovação" : "Em renovação")}
          </Button>
        )}
        {l.doc && (l.doc.total_versoes || 0) > 0 && (
          <Button size="sm" variant="ghost" className="h-8 text-xs" title="Histórico de versões"
            onClick={() => abrirHistorico(l)}>
            <History className={`w-3.5 h-3.5 ${comRotulos ? "mr-1" : ""}`} />
            {comRotulos && "Histórico"}
          </Button>
        )}
        {canDelete && l.doc && !arquivado && (
          <Button size="sm" variant="ghost" className="h-8 text-xs" title="Arquivar"
            onClick={() => { setArquivarDe(l); setMotivoArquivo(""); }}>
            <Archive className={`w-3.5 h-3.5 text-muted-foreground ${comRotulos ? "mr-1" : ""}`} />
            {comRotulos && "Arquivar"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate("/arquivo-digital/dossies")}>
        <ArrowLeft className="w-4 h-4 mr-2" />Voltar para a lista
      </Button>

      {/* ── Identificação do colaborador ── */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold truncate">{funcionario.nome}</h1>
              <Badge className={desligado
                ? "bg-slate-100 text-slate-600 border-slate-300 border"
                : "bg-green-100 text-green-800 border-green-300 border"}>
                {desligado ? "Desligado" : "Ativo"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {funcionario.cargo || "Sem função"} • {funcionario.setor || "Sem setor"}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
              <span>CPF: {maskCpf(funcionario.cpf)}</span>
              <span>Matrícula: {funcionario.matricula || "—"}</span>
              <span className="truncate">Empresa: {empresaNome || "—"}</span>
              <span className="truncate">Unidade: {unidadeNome || "—"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {indisponivel && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-800 flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            O Arquivo Digital ainda não foi ativado neste banco (migrations pendentes).
          </CardContent>
        </Card>
      )}

      {/* ── Resumo por situação ── */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(resumo) as SituacaoDocumento[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-xs">
            <SituacaoBadge situacao={s} />
            <span className="text-muted-foreground">{resumo[s]}</span>
          </span>
        ))}
      </div>

      {/* ── Documentos ── */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-base font-semibold">Documentos do dossiê</h2>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={mostrarNaoAplicaveis} onCheckedChange={(v) => setMostrarNaoAplicaveis(!!v)} />
              Mostrar não aplicáveis
            </label>
          </div>

          {/* Celular: cartões. A tabela tem oito colunas — em tela estreita
              metade fica fora da vista, inclusive a coluna de Ações, que é
              onde estão Anexar e Renovar. */}
          <div className="space-y-2 lg:hidden">
            {linhas.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileStack className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum documento neste dossiê ainda.</p>
                <Button variant="link" className="text-xs h-auto"
                  onClick={() => navigate("/arquivo-digital/tipos")}>Configuração de Tipos</Button>
              </div>
            )}
            {linhas.map((l) => {
              const naoAplicavel = l.situacao === "nao_aplicavel";
              const arquivado = l.situacao === "arquivado";
              const fatos: [string, React.ReactNode][] = [];
              if (l.doc?.data_emissao) fatos.push(["Emissão", dataBr(l.doc.data_emissao)]);
              fatos.push(["Validade", l.doc?.data_validade ? dataBr(l.doc.data_validade) : (l.doc ? "Permanente" : "—")]);
              if (l.doc?.dias_para_vencer !== null && l.doc?.dias_para_vencer !== undefined) {
                fatos.push(["Dias", (
                  <span className={l.doc.dias_para_vencer < 0 ? "text-destructive font-medium" : ""}>
                    {l.doc.dias_para_vencer}
                  </span>
                )]);
              }
              fatos.push(["Versões", l.doc?.total_versoes ?? 0]);
              if (l.responsavel) fatos.push(["Responsável", l.responsavel]);

              return (
                <div key={l.tipo.id}
                  className={`rounded-lg border p-3 ${naoAplicavel || arquivado ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{l.tipo.nome}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {l.tipo.validade_meses ? `Validade ${l.tipo.validade_meses} meses` : "Permanente"}
                        {arquivado && l.doc?.arquivado_motivo ? ` · Motivo: ${l.doc.arquivado_motivo}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0"><SituacaoBadge situacao={l.situacao} /></div>
                  </div>

                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    {fatos.map(([rotulo, valor]) => (
                      <div key={rotulo} className="flex gap-1.5 min-w-0">
                        <dt className="text-muted-foreground shrink-0">{rotulo}:</dt>
                        <dd className="truncate">{valor}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-2.5"><AcoesDocumento l={l} comRotulos /></div>
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border overflow-x-auto hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Documento</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="whitespace-nowrap">Emissão</TableHead>
                  <TableHead className="whitespace-nowrap">Validade</TableHead>
                  <TableHead className="whitespace-nowrap">Dias</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="whitespace-nowrap">Versões</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    <FileStack className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    Nenhum documento neste dossiê ainda.
                    <div className="text-xs mt-1">
                      Configure quais documentos cada função exige em
                      <Button variant="link" className="px-1 h-auto text-xs"
                        onClick={() => navigate("/arquivo-digital/tipos")}>Configuração de Tipos</Button>
                    </div>
                  </TableCell></TableRow>
                )}
                {linhas.map((l) => {
                  const naoAplicavel = l.situacao === "nao_aplicavel";
                  const arquivado = l.situacao === "arquivado";
                  return (
                    <TableRow key={l.tipo.id} className={naoAplicavel || arquivado ? "opacity-60" : ""}>
                      <TableCell>
                        <div className="font-medium text-sm">{l.tipo.nome}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {l.tipo.validade_meses ? `Validade ${l.tipo.validade_meses} meses` : "Permanente"}
                          {arquivado && l.doc?.arquivado_motivo ? ` · Motivo: ${l.doc.arquivado_motivo}` : ""}
                        </div>
                      </TableCell>
                      <TableCell><SituacaoBadge situacao={l.situacao} /></TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{dataBr(l.doc?.data_emissao)}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {l.doc?.data_validade ? dataBr(l.doc.data_validade) : (l.doc ? "Permanente" : "—")}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {l.doc?.dias_para_vencer === null || l.doc?.dias_para_vencer === undefined
                          ? "—"
                          : <span className={l.doc.dias_para_vencer < 0 ? "text-destructive font-medium" : ""}>
                              {l.doc.dias_para_vencer}
                            </span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[140px]">
                        {l.responsavel || "—"}
                      </TableCell>
                      <TableCell className="text-sm">{l.doc?.total_versoes ?? 0}</TableCell>
                      <TableCell className="text-right">
                        <AcoesDocumento l={l} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Diálogo: anexar / renovar ── */}
      <Dialog open={!!envio} onOpenChange={(v) => { if (!v && !enviando) setEnvio(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{envio?.doc ? "Renovar" : "Anexar"} — {envio?.tipo.nome}</DialogTitle>
            <DialogDescription>
              {envio?.doc
                ? "A versão atual não é substituída: ela vira histórico e o arquivo antigo continua acessível."
                : "Todo documento do dossiê precisa de arquivo — data sozinha não vale como evidência."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Arquivo *</Label>
              {/* Dois caminhos para o mesmo fim: o PDF que já existe, ou o
                  papel que está na mão. Digitalizar entrega um PDF igual ao
                  do outro botão — daqui para frente o fluxo é o mesmo. */}
              <input ref={arquivoRef} type="file" className="hidden"
                accept="application/pdf"
                onChange={(e) => setArquivoSel(e.target.files?.[0] || null)} />
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Button variant="outline" className="font-normal" onClick={() => arquivoRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2 shrink-0" />
                  Escolher PDF
                </Button>
                <Button variant="outline" className="font-normal" onClick={() => setScannerAberto(true)}>
                  <ScanLine className="w-4 h-4 mr-2 shrink-0" />
                  Digitalizar
                </Button>
              </div>
              {arquivoSel && (
                <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{arquivoSel.name}</span>
                </p>
              )}
            </div>
            <div>
              <Label>Data de emissão *</Label>
              <Input type="date" value={envioData} onChange={(e) => setEnvioData(e.target.value)} />
              {envio?.tipo.validade_meses ? (
                <p className="text-[11px] text-muted-foreground mt-1">
                  A validade sai desta data + {envio.tipo.validade_meses} meses.
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground mt-1">Este tipo é permanente (sem vencimento).</p>
              )}
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea rows={2} value={envioObs} onChange={(e) => setEnvioObs(e.target.value)}
                placeholder="Opcional — ex.: emitido pela clínica X" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnvio(null)} disabled={enviando}>Cancelar</Button>
            <Button onClick={confirmarEnvio} disabled={enviando || !arquivoSel}>
              {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              {envio?.doc ? "Publicar nova versão" : "Anexar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Digitalizar entrega um PDF; daí em diante é o mesmo caminho do
          arquivo escolhido do aparelho, inclusive a exigência de ser PDF. */}
      <ScannerDocumento
        open={scannerAberto}
        nomeSugerido={envio?.tipo.nome}
        onCancel={() => setScannerAberto(false)}
        onReady={(arquivo) => { setArquivoSel(arquivo); setScannerAberto(false); }}
      />

      {/* ── Diálogo: histórico de versões ── */}
      <Dialog open={!!histDe} onOpenChange={(v) => { if (!v) setHistDe(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico — {histDe?.tipo.nome}</DialogTitle>
            <DialogDescription>
              Cada renovação é um arquivo próprio. Nenhuma versão anterior é apagada — é o que
              permite comprovar a situação de um período já passado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[55vh] overflow-y-auto">
            {versoes === null && <div className="text-center py-6"><Loader2 className="w-4 h-4 animate-spin inline" /></div>}
            {versoes?.length === 0 && <p className="text-sm text-muted-foreground py-4">Nenhuma versão ainda.</p>}
            {versoes?.map((v) => (
              <div key={v.id} className="border rounded p-2 flex items-center gap-2">
                <SituacaoBadge situacao={v.situacao_versao === "atual" ? "vigente" : "substituido"}
                  className="shrink-0 text-[10px]" />
                <div className="min-w-0 flex-1 text-xs">
                  <div className="truncate font-medium">v{v.versao} · {v.nome_original || "documento"}</div>
                  <div className="text-muted-foreground text-[11px]">
                    Emissão {dataBr(v.data_emissao)} · Validade {v.data_validade ? dataBr(v.data_validade) : "permanente"}
                  </div>
                  <div className="text-muted-foreground text-[11px]">Enviado em {dataHoraBr(v.created_at)}</div>
                  {v.observacao && <div className="text-muted-foreground text-[11px] italic truncate">{v.observacao}</div>}
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs shrink-0"
                  onClick={async () => {
                    const ir = prepararAbertura();
                    const url = await urlTemporaria(v.caminho_arquivo);
                    if (!url) { ir(null); toast({ title: "Não foi possível abrir", variant: "destructive" }); return; }
                    ir(url);
                    void registrarAcesso({
                      documentoId: v.documento_id, versaoId: v.id, empresaId: empresaDoc,
                      colaboradorId: funcionario?.id, userId: user?.id, userEmail: user?.email,
                    });
                  }}>Abrir</Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistDe(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo: arquivar ── */}
      <Dialog open={!!arquivarDe} onOpenChange={(v) => { if (!v && !arquivando) setArquivarDe(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Arquivar — {arquivarDe?.tipo.nome}</DialogTitle>
            <DialogDescription>
              Arquivar tira o documento de circulação sem apagar nada: os arquivos e todas as
              versões continuam guardados e auditáveis. O motivo fica registrado.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label>Motivo do arquivamento *</Label>
            <Textarea rows={3} value={motivoArquivo} onChange={(e) => setMotivoArquivo(e.target.value)}
              placeholder="Ex.: documento enviado por engano, substituído por outro tipo…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArquivarDe(null)} disabled={arquivando}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarArquivamento}
              disabled={arquivando || !motivoArquivo.trim()}>
              {arquivando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Archive className="w-4 h-4 mr-2" />}
              Arquivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
