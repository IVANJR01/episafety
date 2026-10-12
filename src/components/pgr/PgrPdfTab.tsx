import { useState } from "react";
import { carregarLogoDataUrl } from "@/lib/logoParaPdf";
import { carregarEmissor, linhasDoEmissor } from "@/lib/emissorDocumentos";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { FileText, Download, RefreshCw, PenLine, ExternalLink, AlertTriangle, ShieldCheck, Eye } from "lucide-react";
import { toast } from "sonner";
import MfaActionButton from "@/components/cat/MfaActionButton";
import { FileType2, ChevronDown } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PgrDocumento, PgrStatus } from "@/lib/pgrTypes";
import { generateAndUploadPgrPdf, previsualizarPgrPdf } from "@/lib/pgrPdf";
import { resolveDocumentoUrl } from "@/lib/secureStorage";
import { criterioDoGrupo, setoresDoGrupo, nomeDoGrupo, nomesUnicos } from "@/lib/sstEstrutura";

async function abrirPdfVersao(v: any) {
  try {
    const provider =
      (v.storage_provider as "supabase_storage" | "google_drive_byok") ||
      (v.storage_path ? "supabase_storage" : "google_drive_byok");
    const url = await resolveDocumentoUrl({
      provider,
      bucket: v.storage_bucket,
      path: v.storage_path,
      driveViewLink: v.drive_view_link,
      ttl: 300,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (e: any) {
    toast.error(e?.message || "Falha ao abrir PDF");
  }
}

interface Props {
  pgr: PgrDocumento;
  canEdit: boolean;
  canExport: boolean;
  canAssinar: boolean;
}

/*
 * Os outros cinco documentos do pacote.
 *
 * O PGR e a planilha têm botão próprio porque saem do inventário desta tela;
 * estes cinco usam só os dados da empresa e a mesma capa, e ficam num menu
 * para o cartão não virar uma fileira de oito botões.
 */
const OUTROS_DOCUMENTOS: { sigla: string; nome: string }[] = [
  { sigla: "PCMSO", nome: "PCMSO — Controle Médico" },
  { sigla: "AET", nome: "AET — Análise Ergonômica" },
  { sigla: "AEP", nome: "AEP — Avaliação Ergonômica Preliminar" },
  { sigla: "LTI", nome: "Laudo de Insalubridade (NR-15)" },
  { sigla: "LTP", nome: "Laudo de Periculosidade (NR-16)" },
];

export default function PgrPdfTab({ pgr, canEdit, canExport, canAssinar }: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [showSig, setShowSig] = useState(false);
  const [sigNome, setSigNome] = useState(pgr.resp_tec_nome || "");
  const [sigReg, setSigReg] = useState(pgr.resp_tec_registro || "");
  const [sigObs, setSigObs] = useState("");

  const { data: versoes = [], refetch } = useQuery({
    queryKey: ["pgr-pdf-versoes", pgr.id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_pdf_versoes")
        .select("*").eq("pgr_id", pgr.id).order("pdf_versao", { ascending: false });
      return (data || []) as Array<any>;
    },
  });
  const { data: assinaturas = [] } = useQuery({
    queryKey: ["pgr-assinaturas", pgr.id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_assinaturas")
        .select("*").eq("pgr_id", pgr.id).order("assinado_em", { ascending: false });
      return (data || []) as Array<any>;
    },
  });

  const ultima = versoes[0];
  const status = pgr.status as PgrStatus;
  const bloqueado = status === "substituido" || status === "arquivado";
  const desatualizado = ultima && (pgr as any).conteudo_atualizado_em &&
    new Date((pgr as any).conteudo_atualizado_em).getTime() > new Date(ultima.gerado_em).getTime() + 500;

  async function carregarContexto() {
    const [emp, uni, inv, acoes, evid, rev, ghes, textos] = await Promise.all([
      (supabase.from as any)("empresa_config")
        .select("nome, cnpj, logo_url, telefone, email, endereco, logradouro, numero, bairro, cidade, uf, cep")
        .eq("id", pgr.empresa_id).maybeSingle(),
      pgr.unidade_id ? (supabase.from as any)("empresa_config").select("nome").eq("id", pgr.unidade_id).maybeSingle() : Promise.resolve({ data: null }),
      (supabase.from as any)("pgr_inventario_itens").select("*").eq("pgr_id", pgr.id).order("classificacao"),
      (supabase.from as any)("pgr_acoes").select("*").eq("pgr_id", pgr.id).order("prazo"),
      (supabase.from as any)("pgr_acao_evidencias").select("*").eq("pgr_id", pgr.id),
      (supabase.from as any)("pgr_revisoes").select("*").eq("pgr_id", pgr.id).order("created_at", { ascending: false }),
      (supabase.from as any)("ghe_ges").select("id,nome,codigo").eq("empresa_id", pgr.empresa_id),
      (supabase.from as any)("pgr_textos").select("secao,conteudo").eq("pgr_id", pgr.id),
    ]);
    const ghesMap: Record<string, string> = {};
    const ghesInfo: Record<string, { codigo: string; nome: string }> = {};
    (ghes.data || []).forEach((g: any) => {
      ghesMap[g.id] = g.nome;
      ghesInfo[g.id] = { codigo: g.codigo || "", nome: g.nome || "" };
    });
    const textosMap: Record<string, string> = {};
    (textos.data || []).forEach((t: any) => { textosMap[t.secao] = t.conteudo || ""; });

    // Identificação completa (matriz + filiais) e responsáveis técnicos —
    // o que a NR-01 pede para identificar o estabelecimento e assinar.
    // Tolerantes a falha: se uma tabela ainda não existir no ambiente, o PDF
    // cai no comportamento antigo em vez de não ser gerado.
    const [unidadesRes, respRes] = await Promise.all([
      (supabase.from as any)("empresa_config")
        /*
         * cnae_secundario entrou na lista: a Identificação da Empresa tem
         * essa linha, como no Word, e sem o campo na consulta ela saía
         * sempre vazia — um campo anunciado e nunca preenchido.
         */
        .select("id,nome,nome_fantasia,cnpj,cnae_principal,cnae_secundario,grau_risco,telefone,email,logradouro,numero,complemento,bairro,cidade,uf,cep,endereco,empresa_pai_id")
        .or(`id.eq.${pgr.empresa_id},empresa_pai_id.eq.${pgr.empresa_id}`),
      (supabase.from as any)("pgr_responsaveis")
        .select("papel,nome,cpf,profissao,registro_profissional,uf_registro,numero_art,ordem")
        .eq("pgr_id", pgr.id).order("ordem"),
    ]);

    // Matriz primeiro, filiais depois — a ordem do documento oficial.
    const unidades = ((unidadesRes.data || []) as any[]).sort(
      (a, b) => (a.empresa_pai_id ? 1 : 0) - (b.empresa_pai_id ? 1 : 0),
    );

    // Caracterização da estrutura (Núcleo Mestre) para as seções de ambientes,
    // processos, setores/GES e funções. Tolerante a falha: uma tabela ausente
    // apenas omite a seção correspondente, em vez de impedir a geração do PDF.
    const daEmpresa = async (tabela: string, ordem = "nome") => {
      const { data, error } = await (supabase.from as any)(tabela)
        .select("*").eq("empresa_id", pgr.empresa_id).order(ordem);
      return error ? [] : (data || []);
    };
    const [ambientes, processos, setores, gesCru, funcoes, atividades] = await Promise.all([
      daEmpresa("sst_ambientes"), daEmpresa("sst_processos"), daEmpresa("sst_setores"),
      daEmpresa("sst_ges", "codigo"), daEmpresa("sst_funcoes"), daEmpresa("sst_atividades"),
    ]);

    /*
     * Critério de agrupamento de cada GES, montado aqui a partir do cadastro.
     *
     * Antes vinha de uma "Descrição curta da exposição" digitada no cadastro do
     * grupo. Era uma cópia da composição que o sistema já conhece — e que
     * envelhecia: mover uma função de um grupo para outro não mexia no texto
     * guardado, então o PGR saía declarando funções que não estavam mais ali.
     *
     * Texto escrito por uma pessoa continua valendo; só o que o próprio sistema
     * tinha escrito é remontado (ver `criterioDoGrupo`).
     */
    const [vincSetor, vincFuncao] = await Promise.all([
      (supabase.from as any)("ghe_setores").select("ghe_id, setor_id, nome")
        .eq("empresa_id", pgr.empresa_id),
      (supabase.from as any)("ghe_funcoes").select("ghe_id, nome_funcao, funcao_id")
        .eq("empresa_id", pgr.empresa_id),
    ]);
    // O setor de um grupo sai das funções que estão nele — é o que define um
    // GES. O vínculo ghe_setores fica de reserva para o grupo ainda sem
    // nenhuma função.
    const setorDaFuncaoId = new Map<string, string>();
    (funcoes as any[]).forEach((f: any) => {
      const nome = (setores as any[]).find((s: any) => s.id === f.setor_id)?.nome;
      if (nome) setorDaFuncaoId.set(f.id, nome);
    });
    const reservaPorGes = new Map<string, string>();
    ((vincSetor as any).data || []).forEach((v: any) => {
      const nome = v.nome || (setores as any[]).find((s: any) => s.id === v.setor_id)?.nome;
      if (nome && !reservaPorGes.has(v.ghe_id)) reservaPorGes.set(v.ghe_id, nome);
    });
    const setoresDaFuncaoPorGes = new Map<string, { setorNome: string | null }[]>();
    ((vincFuncao as any).data || []).forEach((v: any) => {
      if (!setoresDaFuncaoPorGes.has(v.ghe_id)) setoresDaFuncaoPorGes.set(v.ghe_id, []);
      setoresDaFuncaoPorGes.get(v.ghe_id)!.push({
        setorNome: v.funcao_id ? setorDaFuncaoId.get(v.funcao_id) ?? null : null,
      });
    });
    const funcoesPorGes = new Map<string, { nome: string }[]>();
    ((vincFuncao as any).data || []).forEach((v: any) => {
      if (!v.nome_funcao) return;
      if (!funcoesPorGes.has(v.ghe_id)) funcoesPorGes.set(v.ghe_id, []);
      funcoesPorGes.get(v.ghe_id)!.push({ nome: v.nome_funcao });
    });
    const gesDetalhes = (gesCru as any[]).map((g: any) => ({
      ...g,
      qtd_trabalhadores: g.quantidade_trabalhadores ?? g.qtd_trabalhadores ?? null,
      // O nome sai do setor quando o grupo não tem nome próprio. Sem isto o
      // documento lista "01", "02", "03" — o mesmo número da coluna ao lado.
      nome: nomeDoGrupo({
        armazenado: g.nome,
        codigo: g.codigo,
        setores: setoresDoGrupo(setoresDaFuncaoPorGes.get(g.id), reservaPorGes.get(g.id)),
      }),
      criterio_agrupamento: criterioDoGrupo({
        armazenado: g.criterio_agrupamento,
        setorNome: setoresDoGrupo(setoresDaFuncaoPorGes.get(g.id), reservaPorGes.get(g.id)),
        funcoes: funcoesPorGes.get(g.id),
      }),
    }));

    // Campos 5W2H que o PDF consome mas que NÃO são colunas de pgr_acoes.
    // "who" e "how much" moram em responsavel_nome/custo_estimado; a classe de risco
    // vem do item de inventário vinculado. Sem este mapeamento o PDF imprimia
    // Who/How much em branco e a coluna Risco sempre como "—".
    const classePorItem = new Map<string, string | null>();
    (inv.data || []).forEach((i: any) => classePorItem.set(i.id, i.classificacao ?? null));
    const acoesEnriquecidas = (acoes.data || []).map((a: any) => ({
      ...a,
      who: a.responsavel_nome ?? null,
      how_much: a.custo_estimado ?? null,
      classe_risco: a.inventario_item_id
        ? classePorItem.get(a.inventario_item_id) ?? null
        : null,
    }));

    // A capa é papel timbrado da empresa coberta pelo documento: logo no alto
    // e no rodapé, endereço e contato embaixo do nome.
    const logoDataUrl = await carregarLogoDataUrl(emp.data?.logo_url ?? null);
    // Quem elaborou o documento vai no rodapé da capa, separado da empresa
    // coberta — são pessoas jurídicas diferentes.
    const emissor = await carregarEmissor();
    const emissorLogoDataUrl = await carregarLogoDataUrl(emissor?.logo_url ?? null);

    return {
      doc: pgr,
      empresaNome: emp.data?.nome ?? null,
      empresaCnpj: emp.data?.cnpj ?? null,
      logoDataUrl,
      emissorNome: emissor?.nome?.trim() || null,
      emissorLinhas: linhasDoEmissor(emissor),
      emissorLogoDataUrl,
      unidadeNome: uni?.data?.nome ?? null,
      inventario: inv.data || [],
      acoes: acoesEnriquecidas,
      evidencias: (evid.data || []).map((e: any) => ({
        id: e.id, acao_id: e.acao_id, nome_arquivo: e.nome_arquivo,
        uploaded_at: e.created_at, uploaded_by_email: e.uploaded_by_email,
        drive_view_link: e.drive_view_link,
      })),
      revisoes: rev.data || [],
      assinaturas: assinaturas as any[],
      ghes: ghesMap,
      textos: textosMap,
      unidades,
      responsaveis: respRes.data || [],
      ambientes, processos, setores, gesDetalhes, funcoes, atividades,
      // Código do documento: identificador estável e legível para arquivo físico.
      codigoDocumento: `PGR-${(pgr.data_vigencia_inicio || pgr.data_emissao || "")
        .slice(0, 4) || new Date().getFullYear()}-${String(pgr.id).slice(0, 8).toUpperCase()}`,
    };
  }

  /*
   * Conferir como o documento vai sair, sem gravar.
   *
   * "Gerar PDF" nao serve para isso: ele sobe o arquivo, consome um numero de
   * versao e registra a versao no banco — cada olhada deixaria um PDF a mais
   * na lista, e com pedido de MFA no meio. Quem esta com o PGR em rascunho
   * quer ver antes de publicar, e ver nao deveria custar uma versao.
   */
  async function handlePrevisualizar() {
    setBusy(true);
    try {
      const ctx = await carregarContexto();
      await previsualizarPgrPdf(ctx as any);
    } catch (e: any) {
      toast.error(e.message || "Falha ao montar a pré-visualização");
    } finally { setBusy(false); }
  }

  async function handleGerar() {
    if (bloqueado) { toast.error(`PGR ${status} — não é permitido gerar nova versão de PDF.`); return; }
    setBusy(true);
    try {
      const ctx = await carregarContexto();
      const r = await generateAndUploadPgrPdf(ctx as any);
      toast.success(`PDF v${r.pdfVersao} gerado e salvo no Drive`);
      refetch();
      qc.invalidateQueries({ queryKey: ["pgr-detalhe", pgr.id] });
      qc.invalidateQueries({ queryKey: ["pgr-revisoes", pgr.id] });
    } catch (e: any) {
      toast.error(e.message || "Falha ao gerar PDF");
    } finally { setBusy(false); }
  }

  /*
   * PGR em Word, no formato do pacote da SafetySoluções.
   *
   * Roda inteiro no navegador: não há servidor neste projeto, e Edge Function
   * é Deno — sem python3 nem processo filho. É a mesma biblioteca e o mesmo
   * código do gerador original (ver gerarDocx.fidelidade.test.ts).
   *
   * Não grava versão nem hash: isto é um rascunho editável para o técnico
   * trabalhar em cima. O documento que vale, numerado e rastreável, continua
   * sendo o PDF gerado acima.
   */
  /**
   * Baixa um arquivo gerado no navegador.
   *
   * O endereço do blob só é solto depois, porque o navegador ainda está
   * lendo o arquivo no instante do clique.
   */
  function baixar(blob: Blob, nome: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  /*
   * Documentos da SafetySoluções, no formato do pacote.
   *
   * Rodam inteiros no navegador: não há servidor neste projeto, e Edge
   * Function é Deno — sem python3 nem processo filho. São a mesma biblioteca
   * e o mesmo código dos geradores originais (ver gerarDocx.fidelidade.test.ts
   * e gerarPlanilha.fidelidade.test.ts).
   *
   * Não gravam versão nem hash: são rascunhos editáveis para o técnico
   * trabalhar em cima. O documento que vale, numerado e rastreável, continua
   * sendo o PDF gerado acima.
   */
  async function handleGerarDocumento(sigla: string) {
    setBusy(true);
    try {
      /*
       * Carregadas só agora, e não junto com a tela: `docx` e `exceljs` somam
       * mais de um megabyte, e isso entraria no pacote que todo mundo baixa
       * ao abrir o sistema — inclusive quem nunca gera documento, inclusive
       * no celular com internet ruim.
       */
      const { dadosDoPgr } = await import("@/lib/documentos/buscarDados");
      const dados = await dadosDoPgr(pgr.id, pgr.empresa_id);

      if (sigla === "XLSX") {
        if (!dados.inventario?.length) {
          toast.warning("O inventário está vazio — a planilha sai com as linhas em branco.");
        }
        const { gerarPlanilhaBlob, nomePlanilha } = await import("@/lib/documentos/gerarPlanilha");
        baixar(await gerarPlanilhaBlob(dados), nomePlanilha(dados));
        toast.success("Planilha gerada");
        return;
      }

      const { gerarDocumentoDocx, nomeArquivo } = await import("@/lib/documentos/gerarDocx");
      if (sigla === "PGR" && !dados.inventario?.length) {
        toast.warning("O inventário está vazio — o Word sai com a tabela em branco.");
      }
      baixar(await gerarDocumentoDocx(sigla, dados), nomeArquivo(sigla, dados));
      toast.success(`${sigla} gerado em Word`);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar o documento");
    } finally {
      setBusy(false);
    }
  }

  async function handleAssinar() {
    if (!ultima) { toast.error("Gere o PDF antes de assinar"); return; }
    if (ultima.com_marca_dagua) { toast.error("Gere a versão final (sem marca d'água) antes de assinar"); return; }
    if (sigNome.trim().length < 3) { toast.error("Informe o nome do responsável técnico"); return; }
    setBusy(true);
    try {
      const { error } = await (supabase.rpc as any)("pgr_assinar_visual", {
        _pgr_id: pgr.id,
        _pdf_hash: ultima.pdf_hash,
        _responsavel_nome: sigNome.trim(),
        _responsavel_registro: sigReg.trim() || null,
        _ip_origem: null,
        _observacao: sigObs.trim() || null,
      });
      if (error) throw error;
      toast.success("Assinatura visual registrada");
      setShowSig(false); setSigObs("");
      qc.invalidateQueries({ queryKey: ["pgr-assinaturas", pgr.id] });
      qc.invalidateQueries({ queryKey: ["pgr-revisoes", pgr.id] });
    } catch (e: any) {
      toast.error(e.message || "Falha ao assinar");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* 1. CARD PRINCIPAL: EMISSÃO DO PDF OFICIAL                         */}
      {/* ----------------------------------------------------------------- */}
      <Card className="border-border/80 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-5 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  <FileText className="h-4 w-4" />
                </span>
                <h3 className="font-semibold text-lg tracking-tight">Emissão Oficial do PGR (PDF)</h3>
              </div>
              <p className="text-xs text-slate-300">
                Gere a versão oficial numerada e rastreável com capa, identificação, inventário e plano de ação.
              </p>
            </div>

            {/* Ações principais do PDF */}
            <div className="flex items-center gap-2 flex-wrap">
              {!bloqueado && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePrevisualizar}
                  disabled={busy}
                  className="bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white"
                >
                  <Eye className="h-4 w-4 mr-1.5 text-slate-400" />
                  Ver como vai sair
                </Button>
              )}
              {ultima && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => abrirPdfVersao(ultima)}
                  className="bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white"
                >
                  <ExternalLink className="h-4 w-4 mr-1.5 text-sky-400" />
                  Abrir PDF Salvo
                </Button>
              )}
              {!bloqueado && canExport && (
                <MfaActionButton
                  size="sm"
                  onClick={handleGerar}
                  disabled={busy}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/30 border border-indigo-400/30"
                >
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${busy ? "animate-spin" : ""}`} />
                  {ultima ? "Regenerar PDF" : "Gerar PDF Oficial"}
                </MfaActionButton>
              )}
              {ultima && !ultima.com_marca_dagua && canAssinar && (
                <MfaActionButton
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSig(true)}
                  disabled={busy}
                  className="bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white"
                >
                  <PenLine className="h-4 w-4 mr-1.5 text-emerald-400" />
                  Assinar (visual)
                </MfaActionButton>
              )}
            </div>
          </div>
        </div>

        <CardContent className="p-5 space-y-4">
          {desatualizado && (
            <div className="rounded-xl p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-sm flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span><b>PDF desatualizado:</b> o conteúdo do PGR foi alterado após a última geração. Recomendamos clicar em <b>Regenerar PDF</b>.</span>
            </div>
          )}

          {bloqueado && (
            <div className="rounded-xl p-3 bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm">
              PGR <b>{status}</b> — modo somente visualização das versões registradas.
            </div>
          )}

          {/* Dados da versão atual */}
          {ultima ? (
            <div className="rounded-xl bg-muted/40 border p-4 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  Registro da Última Versão Gerada
                </span>
                <Badge variant={ultima.com_marca_dagua ? "outline" : "default"} className="text-xs">
                  {ultima.com_marca_dagua ? "Rascunho" : "Oficial"}
                </Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Versão do PDF</div>
                  <div className="font-semibold text-foreground">v{ultima.pdf_versao} (PGR v{ultima.pgr_versao})</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Gerado em</div>
                  <div className="font-medium text-foreground">{new Date(ultima.gerado_em).toLocaleString("pt-BR")}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Tamanho do Arquivo</div>
                  <div className="font-medium text-foreground">{ultima.tamanho_bytes ? `${Math.round(ultima.tamanho_bytes / 1024)} KB` : "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Armazenamento</div>
                  <div className="font-medium text-foreground">
                    {ultima.storage_provider === "supabase_storage" || ultima.storage_path
                      ? <span className="text-xs text-emerald-600 font-medium">Supabase Storage</span>
                      : ultima.drive_view_link
                      ? <a className="text-primary underline inline-flex items-center gap-1 text-xs" href={ultima.drive_view_link} target="_blank" rel="noreferrer">Google Drive <ExternalLink className="h-3 w-3" /></a>
                      : "—"}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span><b>Hash de Integridade (SHA-256):</b> <code className="font-mono text-[11px] text-foreground bg-muted px-1.5 py-0.5 rounded select-all break-all">{ultima.pdf_hash}</code></span>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-xl">
              <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              Nenhum PDF oficial gerado ainda para esta revisão. Clique em <b>Gerar PDF Oficial</b> acima.
            </div>
          )}

          <div className="text-[11px] text-muted-foreground bg-muted/30 p-2.5 rounded-lg border">
            <b>Validação técnica:</b> Este documento é autenticado por Hash SHA-256 e código QR interno. A emissão oficial atende aos requisitos normativos do item 1.5.7.2 da NR-01.
          </div>
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* 2. EXPORTAÇÕES RÁPIDAS: WORD, EXCEL E OUTROS LAUDOS               */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-3">
        <div className="space-y-0.5">
          <h4 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
            <FileType2 className="h-4 w-4 text-primary" />
            Formatos Editáveis & Laudos Complementares
          </h4>
          <p className="text-xs text-muted-foreground">
            Baixe arquivos editáveis no padrão da SafetySoluções para ajustes locais antes da entrega final.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card Word */}
          <div className="border rounded-xl p-4 bg-card hover:border-blue-300 dark:hover:border-blue-800 transition-all shadow-sm flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-sm">
                <FileType2 className="h-4 w-4" />
                <span>PGR em Word (.docx)</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Documento completo do PGR formatado com capas e tabelas, 100% editável no Microsoft Word.
              </p>
            </div>
            {!bloqueado && canExport && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleGerarDocumento("PGR")}
                disabled={busy}
                className="w-full text-xs font-medium border-blue-200 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-700 dark:text-blue-300"
              >
                <FileType2 className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
                Baixar Word (.docx)
              </Button>
            )}
          </div>

          {/* Card Outros Laudos */}
          <div className="border rounded-xl p-4 bg-card hover:border-purple-300 dark:hover:border-purple-800 transition-all shadow-sm flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-semibold text-sm">
                <ExternalLink className="h-4 w-4" />
                <span>Laudos do Pacote</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Gere PCMSO, AET, AEP, Laudo de Insalubridade (NR-15) e Periculosidade (NR-16) da mesma empresa.
              </p>
            </div>
            {!bloqueado && canExport && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    className="w-full text-xs font-medium border-purple-200 dark:border-purple-900 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-purple-700 dark:text-purple-300"
                  >
                    <span>Escolher documento</span>
                    <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    Mesma capa e dados cadastrais
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {OUTROS_DOCUMENTOS.map((d) => (
                    <DropdownMenuItem key={d.sigla} onClick={() => handleGerarDocumento(d.sigla)} className="text-xs">
                      <FileType2 className="h-3.5 w-3.5 mr-2 text-purple-600" />
                      <span className="truncate">{d.nome}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showSig} onOpenChange={setShowSig}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assinatura visual do PGR</DialogTitle>
            <DialogDescription>
              Registro de assinatura visual com hash SHA-256 e MFA. <b>Não é assinatura digital ICP-Brasil.</b>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Responsável técnico *</Label>
              <Input value={sigNome} onChange={(e) => setSigNome(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Registro profissional</Label>
              <Input value={sigReg} onChange={(e) => setSigReg(e.target.value)} placeholder="CREA / MTE / etc." />
            </div>
            <div>
              <Label className="text-xs">Observação</Label>
              <Textarea rows={2} value={sigObs} onChange={(e) => setSigObs(e.target.value)} />
            </div>
            {ultima && (
              <div className="text-[11px] text-muted-foreground">
                Hash a ser assinado: <span className="font-mono break-all">{ultima.pdf_hash}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSig(false)}>Cancelar</Button>
            <Button onClick={handleAssinar} disabled={busy}>Assinar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value || "—"}</div>
    </div>
  );
}
