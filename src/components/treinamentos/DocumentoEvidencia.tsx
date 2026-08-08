import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { FileText, Upload, Loader2, History, ExternalLink, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  publicarVersao, garantirDocumento, urlTemporaria, historicoVersoes, registrarAcesso,
} from "@/lib/arquivoDigital";

/**
 * Enquanto a migration do Arquivo Digital não roda, as tabelas não existem e
 * o PostgREST responde 42P01. A coluna volta ao comportamento atual em vez de
 * quebrar a tela — publicar o código antes da migration precisa ser inofensivo.
 */
const TABELA_AUSENTE = new Set(["42P01", "PGRST205", "PGRST202"]);
const ehTabelaAusente = (e: any) =>
  !!e && (TABELA_AUSENTE.has(e.code) || /does not exist|schema cache/i.test(e.message || ""));

interface VersaoResumo {
  id: string;
  versao: number;
  caminho_arquivo: string;
  nome_original: string | null;
  data_emissao: string | null;
  data_validade: string | null;
  created_at: string;
}

const dataBr = (iso?: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

const dataHoraBr = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

/**
 * Coluna "Documento / Evidência" da tela de Capacitações.
 *
 * Antes era um cabeçalho sem célula: a tabela `controle_treinamentos` não tem
 * coluna de arquivo nenhuma, então não havia o que mostrar. Aqui a evidência
 * passa a ser o próprio arquivo — quantas versões existem, quando foi
 * enviado, e um link temporário para abrir.
 */
export default function DocumentoEvidencia({
  empresaId, colaboradorId, tipoDocumentoId, registroId, validadeMeses, dataValidade,
  origemTabela, origemId, userId, podeEditar,
  semTipoTexto = "Curso não cadastrado",
  semTipoTitulo = "Cadastre este curso em 'Cursos e Evidências' para poder anexar o comprovante",
}: {
  empresaId: string;
  colaboradorId: string;
  /** Tipo derivado do curso cadastrado. Sem ele não há onde pendurar o arquivo. */
  tipoDocumentoId?: string | null;
  registroId: string;
  validadeMeses?: number | null;
  /**
   * Validade já pronta (ex.: `asos.data_vencimento`), quando quem chama já
   * sabe o vencimento exato em vez de "N meses após a emissão". Vence
   * `validadeMeses` quando informada.
   */
  dataValidade?: string | null;
  /** Registro de origem desta versão. Sem isso, cai no padrão de Treinamentos. */
  origemTabela?: string;
  origemId?: string;
  userId?: string | null;
  podeEditar: boolean;
  /** Texto/título quando não há tipo de documento — padrão é o de cursos. */
  semTipoTexto?: string;
  semTipoTitulo?: string;
}) {
  const [versoes, setVersoes] = useState<VersaoResumo[] | null>(null);
  const [documentoId, setDocumentoId] = useState<string | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [histAberto, setHistAberto] = useState(false);
  const [acessosPorVersao, setAcessosPorVersao] = useState<Map<string, { total: number; ultimo: string }>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    if (!tipoDocumentoId) { setVersoes([]); return; }
    const { data, error } = await (supabase.from as any)("internal_documents")
      .select("id, internal_document_versions(id, versao, caminho_arquivo, nome_original, data_emissao, data_validade, created_at)")
      .eq("colaborador_id", colaboradorId)
      .eq("tipo_documento_id", tipoDocumentoId)
      .is("arquivado_em", null)
      .maybeSingle();

    if (error) {
      if (ehTabelaAusente(error)) { setIndisponivel(true); return; }
      setVersoes([]);
      return;
    }
    setDocumentoId(data?.id || null);
    const lista = ((data?.internal_document_versions || []) as VersaoResumo[])
      .sort((a, b) => b.versao - a.versao);
    setVersoes(lista);
  }, [colaboradorId, tipoDocumentoId]);

  useEffect(() => { void carregar(); }, [carregar]);

  // Carrega a contagem de acesso só quando o Histórico abre — não vale a
  // pena consultar isso pra toda linha da tabela o tempo todo.
  useEffect(() => {
    if (!histAberto || !documentoId) return;
    (supabase.from as any)("document_access_log")
      .select("versao_id, created_at")
      .eq("documento_id", documentoId)
      .then(({ data }: any) => {
        const mapa = new Map<string, { total: number; ultimo: string }>();
        (data || []).forEach((row: any) => {
          if (!row.versao_id) return;
          const atual = mapa.get(row.versao_id);
          if (!atual || row.created_at > atual.ultimo) {
            mapa.set(row.versao_id, { total: (atual?.total || 0) + 1, ultimo: row.created_at });
          } else {
            mapa.set(row.versao_id, { ...atual, total: atual.total + 1 });
          }
        });
        setAcessosPorVersao(mapa);
      });
  }, [histAberto, documentoId]);

  const abrir = async (caminho: string, versaoId: string) => {
    const url = await urlTemporaria(caminho);
    if (!url) {
      toast({ title: "Não foi possível abrir o documento", variant: "destructive" });
      return;
    }
    window.open(url, "_blank", "noopener");
    if (documentoId) {
      void registrarAcesso({ documentoId, versaoId, empresaId, colaboradorId, userId });
    }
  };

  const enviar = async (file: File) => {
    if (!tipoDocumentoId) return;
    setEnviando(true);
    try {
      const documentoId = await garantirDocumento({
        empresaId, colaboradorId, tipoDocumentoId,
        origemTabela: origemTabela || "controle_treinamentos", origemId: origemId || registroId, userId,
      });
      await publicarVersao({
        empresaId, documentoId, colaboradorId, file,
        dataEmissao: new Date().toISOString().slice(0, 10),
        validadeMeses, dataValidade, userId,
        origemTabela: origemTabela || "controle_treinamentos", origemId: origemId || registroId,
      });
      toast({ title: "Documento anexado" });
      await carregar();
    } catch (e: any) {
      toast({
        title: "Erro ao anexar documento",
        description: ehTabelaAusente(e) ? "O Arquivo Digital ainda não foi ativado neste banco." : e?.message,
        variant: "destructive",
      });
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  // Sem as tabelas, a coluna se cala em vez de mostrar erro em toda linha.
  if (indisponivel) return <span className="text-xs text-muted-foreground">—</span>;

  if (versoes === null) {
    return <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />;
  }

  if (!tipoDocumentoId) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"
        title={semTipoTitulo}>
        <AlertCircle className="w-3.5 h-3.5" />{semTipoTexto}
      </span>
    );
  }

  const atual = versoes[0];

  return (
    <div className="flex flex-col gap-0.5">
      <input
        ref={inputRef} type="file" className="hidden"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void enviar(f); }}
      />

      {atual ? (
        <>
          <button
            type="button" onClick={() => abrir(atual.caminho_arquivo, atual.id)}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
          >
            <FileText className="w-3.5 h-3.5" />Ver PDF
            <ExternalLink className="w-3 h-3 opacity-60" />
          </button>
          <span className="text-[10px] text-muted-foreground">
            {versoes.length} {versoes.length === 1 ? "versão" : "versões"} · {dataBr(atual.created_at)}
          </span>
          {podeEditar && (
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]"
                disabled={enviando} onClick={() => inputRef.current?.click()}>
                {enviando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                <span className="ml-1">Renovar</span>
              </Button>
              {versoes.length > 1 && (
                <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]"
                  onClick={() => setHistAberto(true)}>
                  <History className="w-3 h-3" /><span className="ml-1">Histórico</span>
                </Button>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <Badge variant="outline" className="w-fit bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
            Sem comprovante
          </Badge>
          {podeEditar && (
            <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] w-fit"
              disabled={enviando} onClick={() => inputRef.current?.click()}>
              {enviando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              <span className="ml-1">Anexar</span>
            </Button>
          )}
        </>
      )}

      <Dialog open={histAberto} onOpenChange={setHistAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico do documento</DialogTitle>
            <DialogDescription>
              Cada renovação é um arquivo próprio. Nenhuma versão anterior é apagada —
              é o que permite comprovar a situação de um período já passado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[55vh] overflow-y-auto">
            {versoes.map((v, i) => (
              <div key={v.id} className="border rounded p-2 flex items-center gap-2">
                <Badge variant={i === 0 ? "default" : "outline"} className="shrink-0 text-[10px]">
                  v{v.versao}{i === 0 ? " · atual" : ""}
                </Badge>
                <div className="min-w-0 flex-1 text-xs">
                  <div className="truncate font-medium">{v.nome_original || "documento"}</div>
                  <div className="text-muted-foreground text-[11px]">
                    Emissão {dataBr(v.data_emissao)} · Validade {v.data_validade ? dataBr(v.data_validade) : "permanente"}
                  </div>
                  <div className="text-muted-foreground text-[11px]">
                    {acessosPorVersao.has(v.id)
                      ? `${acessosPorVersao.get(v.id)!.total} ${acessosPorVersao.get(v.id)!.total === 1 ? "visualização" : "visualizações"} · última em ${dataHoraBr(acessosPorVersao.get(v.id)!.ultimo)}`
                      : "Nunca aberto"}
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs shrink-0"
                  onClick={() => abrir(v.caminho_arquivo, v.id)}>Abrir</Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistAberto(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
