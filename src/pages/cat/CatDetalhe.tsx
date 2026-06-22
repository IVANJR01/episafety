import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Edit,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Paperclip,
  History,
  Upload,
  AlertTriangle,
  Skull,
  FileText,
  Trash2,
} from "lucide-react";
import MfaActionButton from "@/components/cat/MfaActionButton";
import CatEsocialCard from "@/components/cat/CatEsocialCard";
import {
  CatRow,
  STATUS_LABEL,
  STATUS_COLOR,
  TIPO_LABEL,
  TIPO_ACIDENTE_LABEL,
  CATEGORIAS_ANEXO,
  prazoLegal,
} from "@/lib/catTypes";
import { usePermissions } from "@/hooks/usePermissions";
import { uploadToDrive } from "@/lib/googleDriveStorage";
import { generateAndUploadCatPdf, logCatPdfDownload } from "@/lib/catPdf";
import { openDocumentoSeguro } from "@/lib/secureStorage";
import { FileDown, RefreshCw } from "lucide-react";

function hasDocumentoSeguro(a: any): boolean {
  const driveFileId = String(a?.drive_file_id ?? a?.pdf_drive_file_id ?? "");
  return Boolean(
    a?.storage_provider === "supabase_storage" ||
      a?.storage_path ||
      driveFileId.startsWith("sb://") ||
      a?.drive_view_link ||
      a?.pdf_drive_view_link ||
      (a?.storage_provider === "google_drive_byok" && driveFileId),
  );
}

async function abrirAnexoStorage(a: any) {
  try {
    await openDocumentoSeguro({
      provider: a?.storage_provider,
      bucket: a?.storage_bucket,
      path: a?.storage_path,
      driveFileId: a?.drive_file_id ?? a?.pdf_drive_file_id,
      driveViewLink: a?.drive_view_link ?? a?.pdf_drive_view_link,
      ttl: 300,
    });
  } catch (e: any) {
    toast.error(e?.message || "Falha ao abrir arquivo");
  }
}

export default function CatDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { empresaId, isSuperAdmin, isPrincipal } = useAuth();
  const { canEdit, canDelete } = usePermissions("cat");

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [novaCategoria, setNovaCategoria] = useState<string>("outros");
  const [uploading, setUploading] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const { data: cat, isLoading, error } = useQuery({
    queryKey: ["cat-detalhe", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("cat_comunicacoes").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as CatRow | null;
    },
  });

  const { data: funcionario } = useQuery({
    queryKey: ["cat-detalhe-func", cat?.funcionario_id],
    enabled: !!cat?.funcionario_id,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("funcionarios").select("nome, cpf, cargo").eq("id", cat!.funcionario_id).maybeSingle();
      return data;
    },
  });

  const { data: empresa } = useQuery({
    queryKey: ["cat-detalhe-emp", cat?.empresa_id],
    enabled: !!cat?.empresa_id,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("empresa_config").select("nome, cnpj").eq("id", cat!.empresa_id).maybeSingle();
      return data;
    },
  });

  const { data: testemunhas = [] } = useQuery({
    queryKey: ["cat-detalhe-test", id],
    enabled: !!cat,
    queryFn: async () => (await (supabase.from as any)("cat_testemunhas").select("*").eq("cat_id", id)).data || [],
  });

  const { data: anexos = [] } = useQuery({
    queryKey: ["cat-detalhe-anx", id],
    enabled: !!cat,
    queryFn: async () =>
      (await (supabase.from as any)("cat_anexos").select("*").eq("cat_id", id).order("created_at", { ascending: false })).data || [],
  });

  const { data: historico = [] } = useQuery({
    queryKey: ["cat-detalhe-hist", id],
    enabled: !!cat,
    queryFn: async () =>
      (await (supabase.from as any)("cat_historico").select("*").eq("cat_id", id).order("created_at", { ascending: false })).data || [],
  });

  const { data: catalogo = [] } = useQuery({
    queryKey: ["cat-detalhe-cat", cat?.situacao_geradora_id, cat?.agente_causador_id, cat?.parte_atingida_id, cat?.natureza_lesao_id],
    enabled: !!cat,
    queryFn: async () => {
      const ids = [cat!.situacao_geradora_id, cat!.agente_causador_id, cat!.parte_atingida_id, cat!.natureza_lesao_id].filter(Boolean);
      if (!ids.length) return [];
      const tables = ["cat_situacoes_geradoras", "cat_agentes_causadores", "cat_partes_atingidas", "cat_naturezas_lesao"];
      const all: any[] = [];
      for (const t of tables) {
        const { data } = await (supabase.from as any)(t).select("id, codigo, descricao").in("id", ids);
        if (data) all.push(...data);
      }
      return all;
    },
  });
  const catName = (idVal: string | null) => catalogo.find((c: any) => c.id === idVal)?.descricao || "—";

  // Tenant guard explícito no client (RLS já bloqueia, mas reforça UX)
  useEffect(() => {
    if (!isLoading && !cat && !error) {
      toast.error("CAT não encontrada ou fora do seu escopo de empresa.");
      navigate("/cat");
    }
  }, [cat, isLoading, error, navigate]);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;
  if (!cat) return null;

  const p = prazoLegal(cat);
  const isRascunho = cat.status === "rascunho";
  const isPronto = cat.status === "pronto_para_envio";
  const isConcluida = cat.status === "concluida" || cat.status === "enviada_esocial";
  const canCancelar = (isSuperAdmin || isPrincipal) && cat.status !== "cancelada";
  const canReabrir = isConcluida && (isSuperAdmin || isPrincipal);

  const podeEditar = (isRascunho || isPronto) && canEdit;

  // Validação dura antes de concluir
  const validateConcluir = (): string | null => {
    if (!cat.tipo_acidente) return "Tipo de acidente obrigatório";
    if (!cat.situacao_geradora_id) return "Situação geradora obrigatória";
    if (!cat.parte_atingida_id) return "Parte atingida obrigatória";
    if (!cat.natureza_lesao_id) return "Natureza da lesão obrigatória";
    if (!cat.cid_codigo) return "CID-10 obrigatório";
    if (!cat.hospital) return "Hospital/local de atendimento obrigatório";
    if (!cat.medico_nome || !cat.medico_crm) return "Médico e CRM obrigatórios";
    if (!cat.emitente_nome || !cat.emitente_cpf) return "Dados do emitente obrigatórios";
    if (cat.houve_afastamento && !cat.ultimo_dia_trabalhado) return "Último dia trabalhado obrigatório";
    if (cat.obito && !cat.data_obito) return "Data do óbito obrigatória";
    return null;
  };

  const concluir = async () => {
    const err = validateConcluir();
    if (err) {
      toast.error(`Falta preencher: ${err}`);
      return;
    }
    // 1. gera número
    const { data: numero, error: numErr } = await (supabase.rpc as any)("gerar_numero_cat", { _empresa_id: cat.empresa_id });
    if (numErr) {
      toast.error(`Erro ao gerar número: ${numErr.message}`);
      return;
    }
    // 2. atualiza
    const { error } = await (supabase.from as any)("cat_comunicacoes")
      .update({
        numero_cat: cat.numero_cat || numero,
        status: "concluida",
        concluida_em: new Date().toISOString(),
        concluida_por: (await supabase.auth.getUser()).data.user?.id,
      })
      .eq("id", cat.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`CAT ${numero} concluída`);
    qc.invalidateQueries({ queryKey: ["cat-detalhe", id] });
    qc.invalidateQueries({ queryKey: ["cat-list"] });
  };

  const marcarProntoEnvio = async () => {
    const err = validateConcluir();
    if (err) {
      toast.error(`Falta preencher: ${err}`);
      return;
    }
    const { error } = await (supabase.from as any)("cat_comunicacoes")
      .update({ status: "pronto_para_envio" })
      .eq("id", cat.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("CAT pronta para envio");
    qc.invalidateQueries({ queryKey: ["cat-detalhe", id] });
  };

  const cancelar = async () => {
    if (!cancelMotivo.trim()) {
      toast.error("Informe o motivo do cancelamento");
      return;
    }
    const { error } = await (supabase.from as any)("cat_comunicacoes")
      .update({
        status: "cancelada",
        motivo_cancelamento: cancelMotivo,
        cancelada_em: new Date().toISOString(),
        cancelada_por: (await supabase.auth.getUser()).data.user?.id,
      })
      .eq("id", cat.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("CAT cancelada");
    setCancelOpen(false);
    qc.invalidateQueries({ queryKey: ["cat-detalhe", id] });
  };

  const reabrir = async () => {
    if (!confirm("Voltar a CAT para rascunho para edição?")) return;
    const { error } = await (supabase.from as any)("cat_comunicacoes").update({ status: "rascunho" }).eq("id", cat.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["cat-detalhe", id] });
    toast.success("CAT voltou para rascunho");
  };

  const excluir = async () => {
    if (!confirm("Excluir definitivamente esta CAT? Esta ação fica registrada no audit log.")) return;
    const { error } = await (supabase.from as any)("cat_comunicacoes").delete().eq("id", cat.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("CAT excluída");
    navigate("/cat");
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const folder = `CAT/${cat.numero_cat || cat.id}`;
      const res = await uploadToDrive(file, folder, file.name);
      const { error } = await (supabase.from as any)("cat_anexos").insert({
        cat_id: cat.id,
        empresa_id: cat.empresa_id, // trigger reescreve com o valor da CAT
        categoria: novaCategoria,
        nome_arquivo: file.name,
        mime_type: file.type,
        tamanho_bytes: file.size,
        drive_file_id: res.fileId,
        drive_path: folder,
      });
      if (error) throw error;
      toast.success("Anexo enviado ao Google Drive");
      qc.invalidateQueries({ queryKey: ["cat-detalhe-anx", id] });
    } catch (e: any) {
      toast.error(`Erro ao enviar: ${e?.message || e}`);
    } finally {
      setUploading(false);
    }
  };

  const removerAnexo = async (anexo: any) => {
    if (!confirm(`Remover ${anexo.nome_arquivo}?`)) return;
    const { error } = await (supabase.from as any)("cat_anexos").delete().eq("id", anexo.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["cat-detalhe-anx", id] });
    toast.success("Anexo removido (metadado). Arquivo no Drive permanece.");
  };

  const gerarPdf = async () => {
    if (cat.status === "cancelada") {
      toast.error("CAT cancelada — não é possível gerar PDF");
      return;
    }
    setGerandoPdf(true);
    try {
      const find = (idVal: string | null) => (catalogo as any[]).find((c) => c.id === idVal)?.descricao;
      const res = await generateAndUploadCatPdf({
        cat,
        empresaNome: empresa?.nome,
        empresaCnpj: empresa?.cnpj,
        funcionarioNome: funcionario?.nome,
        funcionarioCpf: funcionario?.cpf,
        funcionarioCargo: funcionario?.cargo,
        situacaoGeradora: find(cat.situacao_geradora_id),
        agenteCausador: find(cat.agente_causador_id),
        parteAtingida: find(cat.parte_atingida_id),
        naturezaLesao: find(cat.natureza_lesao_id),
        testemunhas: testemunhas as any[],
        historico: historico as any[],
        anexos: anexos as any[],
      });
      toast.success(`PDF v${res.versao} gerado e armazenado com segurança`);
      qc.invalidateQueries({ queryKey: ["cat-detalhe", id] });
      qc.invalidateQueries({ queryKey: ["cat-detalhe-anx", id] });
      qc.invalidateQueries({ queryKey: ["cat-detalhe-hist", id] });
    } catch (e: any) {
      toast.error(`Erro ao gerar PDF: ${e?.message || e}`);
    } finally {
      setGerandoPdf(false);
    }
  };

  const baixarPdf = async () => {
    // Localiza a versão vigente do PDF entre os anexos (pdf_cat)
    const pdfAnexos = (anexos as any[]).filter((a) => a.categoria === "pdf_cat");
    const vigente =
      pdfAnexos.find((a) => a.drive_file_id === (cat as any).pdf_drive_file_id) ||
      pdfAnexos[0];
    if (!vigente) {
      toast.error("Nenhum PDF disponível");
      return;
    }
    try {
      await logCatPdfDownload(cat.id);
    } catch (e) {
      console.warn("[cat-pdf] log download falhou", e);
    }
    await abrirAnexoStorage(vigente);
    qc.invalidateQueries({ queryKey: ["cat-detalhe-hist", id] });
  };


  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button variant="ghost" onClick={() => navigate("/cat")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div className="flex items-center gap-2 flex-wrap">
          {podeEditar && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/cat/${cat.id}/editar`)}>
              <Edit className="h-4 w-4 mr-1" /> Editar
            </Button>
          )}
          {isRascunho && (
            <MfaActionButton variant="secondary" size="sm" onClick={marcarProntoEnvio}>
              Marcar pronto p/ envio
            </MfaActionButton>
          )}
          {(isRascunho || isPronto) && (
            <MfaActionButton size="sm" onClick={concluir}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Concluir
            </MfaActionButton>
          )}
          {canReabrir && (
            <MfaActionButton variant="outline" size="sm" onClick={reabrir}>
              <RotateCcw className="h-4 w-4 mr-1" /> Reabrir
            </MfaActionButton>
          )}
          {canCancelar && (
            <MfaActionButton variant="destructive" size="sm" onClick={() => setCancelOpen(true)}>
              <XCircle className="h-4 w-4 mr-1" /> Cancelar
            </MfaActionButton>
          )}
          {canDelete && isRascunho && (
            <Button variant="ghost" size="sm" onClick={excluir}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </div>

      {/* Cabeçalho */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                {cat.obito && <Skull className="h-5 w-5 text-red-600" />}
                CAT {cat.numero_cat || "(rascunho)"}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Acidente em {new Date(cat.data_acidente).toLocaleDateString("pt-BR")}
                {cat.hora_acidente ? ` às ${cat.hora_acidente}` : ""}
                {" "}— {TIPO_ACIDENTE_LABEL[cat.tipo_acidente]}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge className={STATUS_COLOR[cat.status]} variant="outline">{STATUS_LABEL[cat.status]}</Badge>
              <Badge variant="secondary" className="text-[10px]">{TIPO_LABEL[cat.tipo_cat]}</Badge>
            </div>
          </div>
        </CardHeader>
        {p.label && (
          <CardContent>
            <div
              className={`rounded-md p-3 text-sm flex items-center gap-2 ${
                p.vencido
                  ? "bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/30 dark:text-red-300"
                  : p.critico
                  ? "bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {p.label}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Dados principais */}
      <Card>
        <CardHeader><CardTitle className="text-base">Dados da CAT</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Info label="Funcionário" value={funcionario?.nome} />
          <Info label="CPF" value={funcionario?.cpf} />
          <Info label="Cargo / CBO" value={`${funcionario?.cargo || ""} ${cat.cbo ? `(CBO ${cat.cbo})` : ""}`} />
          <Info label="Remuneração" value={cat.remuneracao_mensal ? `R$ ${Number(cat.remuneracao_mensal).toFixed(2)}` : null} />
          <Info label="Local do acidente" value={cat.local_acidente} />
          <Info label="Endereço" value={[cat.endereco_local, cat.municipio, cat.uf].filter(Boolean).join(", ")} />
          <Info label="Situação geradora" value={catName(cat.situacao_geradora_id)} />
          <Info label="Agente causador" value={catName(cat.agente_causador_id)} />
          <Info label="Parte atingida" value={`${catName(cat.parte_atingida_id)} (${cat.lateralidade || "N"})`} />
          <Info label="Natureza da lesão" value={catName(cat.natureza_lesao_id)} />
          <Info label="CID-10" value={cat.cid_codigo ? `${cat.cid_codigo} — ${cat.cid_descricao || ""}` : null} />
          <Info label="Hospital" value={cat.hospital} />
          <Info label="Médico" value={cat.medico_nome ? `${cat.medico_nome} (CRM ${cat.medico_crm}/${cat.medico_uf})` : null} />
          <Info label="Internação" value={cat.houve_internacao ? "Sim" : "Não"} />
          <Info label="Afastamento" value={cat.houve_afastamento ? `Sim — desde ${cat.ultimo_dia_trabalhado}` : "Não"} />
          <Info label="Óbito" value={cat.obito ? `Sim — ${cat.data_obito}` : "Não"} />
          <Info label="Emitente" value={cat.emitente_nome ? `${cat.emitente_nome} — ${cat.emitente_cargo || ""}` : null} />
          {cat.descricao_lesao && (
            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">Descrição da lesão</Label>
              <p className="text-sm">{cat.descricao_lesao}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Testemunhas */}
      <Card>
        <CardHeader><CardTitle className="text-base">Testemunhas ({testemunhas.length})</CardTitle></CardHeader>
        <CardContent>
          {testemunhas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma testemunha registrada.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {(testemunhas as any[]).map((t) => (
                <li key={t.id} className="flex flex-wrap gap-x-3">
                  <span className="font-medium">{t.nome}</span>
                  {t.cpf && <span className="text-muted-foreground">CPF {t.cpf}</span>}
                  {t.cargo && <span className="text-muted-foreground">— {t.cargo}</span>}
                  {t.telefone && <span className="text-muted-foreground">— {t.telefone}</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Anexos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Paperclip className="h-4 w-4" /> Anexos ({anexos.length})
            <Badge variant="outline" className="text-[10px] ml-auto">Google Drive BYOK</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {canEdit && cat.status !== "cancelada" && (
            <div className="flex flex-wrap gap-2 items-end p-3 rounded-md border bg-muted/40">
              <div className="min-w-[180px]">
                <Label className="text-xs">Categoria</Label>
                <Select value={novaCategoria} onValueChange={setNovaCategoria}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_ANEXO.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs">Arquivo</Label>
                <Input
                  type="file"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                    e.target.value = "";
                  }}
                />
              </div>
              {uploading && <span className="text-xs text-muted-foreground">Enviando…</span>}
            </div>
          )}

          {anexos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum anexo enviado.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {(anexos as any[]).filter((a) => a.categoria !== "pdf_cat").map((a) => (
                <li key={a.id} className="flex items-center gap-2 py-1 border-b last:border-0">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium truncate flex-1">{a.nome_arquivo}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {CATEGORIAS_ANEXO.find((c) => c.value === a.categoria)?.label || a.categoria}
                  </Badge>
                  {(a.storage_path || (a.drive_file_id && !String(a.drive_file_id).startsWith("sb://"))) && (
                    <button
                      type="button"
                      onClick={() => abrirAnexoStorage(a)}
                      className="text-xs text-primary hover:underline"
                    >
                      Abrir
                    </button>
                  )}
                  {canEdit && (
                    <Button size="sm" variant="ghost" onClick={() => removerAnexo(a)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* PDF gerencial */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> PDF da CAT (interno)
            {(cat as any).pdf_versao ? (
              <Badge variant="outline" className="text-[10px]">v{(cat as any).pdf_versao}</Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px]">Não gerado</Badge>
            )}
            {(cat as any).pdf_gerado_em && new Date(cat.updated_at).getTime() > new Date((cat as any).pdf_gerado_em).getTime() + 1500 && (
              <Badge variant="destructive" className="text-[10px]">PDF desatualizado — gerar nova versão</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Info label="Gerado em" value={(cat as any).pdf_gerado_em ? new Date((cat as any).pdf_gerado_em).toLocaleString("pt-BR") : null} />
            <Info label="Versão" value={(cat as any).pdf_versao ? `v${(cat as any).pdf_versao}` : null} />
            <div className="md:col-span-2">
              <span className="text-xs text-muted-foreground">Hash SHA-256: </span>
              <span className="font-mono text-[11px] break-all">{(cat as any).pdf_hash || "—"}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && cat.status !== "cancelada" && (
              <MfaActionButton size="sm" onClick={gerarPdf} disabled={gerandoPdf}>
                <RefreshCw className={`h-4 w-4 mr-1 ${gerandoPdf ? "animate-spin" : ""}`} />
                {(cat as any).pdf_versao ? "Gerar nova versão" : "Gerar PDF"}
              </MfaActionButton>
            )}
            {((cat as any).pdf_versao || (anexos as any[]).some((a) => a.categoria === "pdf_cat")) && (
              <Button size="sm" variant="outline" onClick={baixarPdf}>
                <FileDown className="h-4 w-4 mr-1" /> Abrir / baixar PDF
              </Button>
            )}
          </div>

          {/* Versões anteriores do PDF */}
          {(() => {
            const pdfVersoes = (anexos as any[]).filter((a) => a.categoria === "pdf_cat");
            if (pdfVersoes.length === 0) return null;
            return (
              <div className="border-t pt-3 mt-2">
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Histórico de versões ({pdfVersoes.length})
                </div>
                <ul className="space-y-1 text-xs">
                  {pdfVersoes.map((v, idx) => {
                    const isVigente = v.drive_file_id === (cat as any).pdf_drive_file_id;
                    return (
                      <li key={v.id} className="flex items-center gap-2 py-1 border-b last:border-0">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium truncate flex-1">{v.nome_arquivo}</span>
                        {isVigente ? (
                          <Badge className="text-[10px]" variant="default">Vigente</Badge>
                        ) : (
                          <Badge className="text-[10px]" variant="secondary">Anterior</Badge>
                        )}
                        <span className="text-muted-foreground">{new Date(v.created_at).toLocaleString("pt-BR")}</span>
                        {(v.storage_path || (v.drive_file_id && !String(v.drive_file_id).startsWith("sb://"))) && (
                          <button
                            type="button"
                            className="text-primary hover:underline"
                            onClick={async () => {
                              logCatPdfDownload(cat.id).catch(() => {});
                              await abrirAnexoStorage(v);
                            }}
                          >
                            Abrir
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })()}

          <p className="text-[11px] text-muted-foreground">
            Documento gerencial interno. Inclui QR Code (validação restrita à empresa) e hash SHA-256. Não substitui o envio oficial ao eSocial (S-2210), previsto para a Fase 2.
            {cat.status === "rascunho" && " PDFs gerados em rascunho recebem marca d'água RASCUNHO."}
          </p>
        </CardContent>
      </Card>


      {/* eSocial S-2210 — validação técnica (stub) */}
      <CatEsocialCard catId={cat.id} empresaId={cat.empresa_id} />


      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" /> Histórico ({historico.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historico.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem histórico.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(historico as any[]).map((h) => (
                <li key={h.id} className="border-l-2 border-primary/40 pl-3">
                  <div className="font-medium">
                    {h.acao === "criada" && "CAT criada"}
                    {h.acao === "status_alterado" && (
                      <>
                        {STATUS_LABEL[h.status_anterior as keyof typeof STATUS_LABEL] || h.status_anterior || "—"}
                        {" → "}
                        {STATUS_LABEL[h.status_novo as keyof typeof STATUS_LABEL] || h.status_novo}
                      </>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(h.created_at).toLocaleString("pt-BR")} {h.user_email && `· ${h.user_email}`}
                  </div>
                  {h.motivo && <div className="text-xs italic">{h.motivo}</div>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Modal Cancelar */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar CAT</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O cancelamento é registrado no histórico e no audit log. Informe o motivo:
          </p>
          <Textarea value={cancelMotivo} onChange={(e) => setCancelMotivo(e.target.value)} rows={4} placeholder="Motivo do cancelamento…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Voltar</Button>
            <Button variant="destructive" onClick={cancelar}>Confirmar cancelamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="text-sm">
      <span className="text-xs text-muted-foreground">{label}: </span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}
