import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Info, Search, ExternalLink, History, FileCheck2, FolderOpen } from "lucide-react";
import SituacaoBadge from "@/components/arquivo-digital/SituacaoBadge";
import { urlTemporaria, registrarAcesso, prepararAbertura } from "@/lib/arquivoDigital";
import { toast } from "@/hooks/use-toast";

const TABELA_AUSENTE = new Set(["42P01", "PGRST205", "PGRST202"]);
const ehTabelaAusente = (e: any) =>
  !!e && (TABELA_AUSENTE.has(e.code) || /does not exist|schema cache/i.test(e.message || ""));

const dataHoraBr = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
const dataBr = (iso?: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

interface VersaoHist {
  id: string; documento_id: string; empresa_id: string; versao: number;
  caminho_arquivo: string; nome_original: string | null;
  data_emissao: string | null; data_validade: string | null;
  created_at: string; created_by: string | null; situacao_versao: string;
}

/**
 * Histórico de Versões — todo arquivo já publicado no Arquivo Digital.
 *
 * A prova de que renovar não apaga: aqui aparece tanto a versão atual
 * quanto todas as substituídas, com o arquivo original ainda acessível.
 */
export default function HistoricoVersoes() {
  const navigate = useNavigate();
  const { empresaId, empresaScopeIds, isSuperAdmin, user } = useAuth();
  const perms = usePermissions("arquivo_digital");

  const [busca, setBusca] = useState("");
  const [indisponivel, setIndisponivel] = useState(false);

  const { data: versoes = [], isLoading } = useQuery({
    queryKey: ["arquivo-digital-historico", empresaId, empresaScopeIds.join(",")],
    enabled: perms.canView,
    queryFn: async () => {
      let q = (supabase.from as any)("internal_document_versions_historico")
        .select("id, documento_id, empresa_id, versao, caminho_arquivo, nome_original, data_emissao, data_validade, created_at, created_by, situacao_versao");
      if (empresaScopeIds.length && !isSuperAdmin) q = q.in("empresa_id", empresaScopeIds);
      else if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(500);
      if (error) { if (ehTabelaAusente(error)) setIndisponivel(true); return []; }
      return (data || []) as VersaoHist[];
    },
  });

  // A view de versões não traz colaborador nem tipo — vêm do documento.
  const { data: documentos = [] } = useQuery({
    queryKey: ["arquivo-digital-historico-docs", versoes.length],
    enabled: perms.canView && versoes.length > 0,
    queryFn: async () => {
      const ids = [...new Set(versoes.map((v) => v.documento_id))];
      const { data } = await (supabase.from as any)("internal_documents_situacao")
        .select("id, colaborador_id, tipo_nome").in("id", ids);
      return (data || []) as { id: string; colaborador_id: string | null; tipo_nome: string }[];
    },
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["arquivo-digital-historico-func", empresaId, empresaScopeIds.join(",")],
    enabled: perms.canView && documentos.length > 0,
    queryFn: async () => {
      let q = supabase.from("funcionarios").select("id, nome");
      if (empresaScopeIds.length && !isSuperAdmin) q = q.in("empresa_id", empresaScopeIds);
      else if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q;
      return (data || []) as { id: string; nome: string }[];
    },
  });

  const docPorId = useMemo(() => new Map(documentos.map((d) => [d.id, d])), [documentos]);
  const nomePorId = useMemo(() => new Map(funcionarios.map((f) => [f.id, f.nome])), [funcionarios]);

  const linhas = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return versoes.map((v) => {
      const doc = docPorId.get(v.documento_id);
      const colaborador = doc?.colaborador_id ? nomePorId.get(doc.colaborador_id) : null;
      return { v, tipo: doc?.tipo_nome || "—", colaborador: colaborador || "—", colaboradorId: doc?.colaborador_id };
    }).filter((l) => !b
      || l.tipo.toLowerCase().includes(b)
      || l.colaborador.toLowerCase().includes(b)
      || (l.v.nome_original || "").toLowerCase().includes(b));
  }, [versoes, docPorId, nomePorId, busca]);

  const abrir = async (l: (typeof linhas)[number]) => {
    const ir = prepararAbertura();
    const url = await urlTemporaria(l.v.caminho_arquivo);
    if (!url) { ir(null); toast({ title: "Não foi possível abrir o arquivo", variant: "destructive" }); return; }
    ir(url);
    void registrarAcesso({
      documentoId: l.v.documento_id, versaoId: l.v.id, empresaId: l.v.empresa_id,
      colaboradorId: l.colaboradorId, userId: user?.id, userEmail: user?.email,
    });
  };

  if (!perms.canView) return null;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">

      {indisponivel && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-800 flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            O Arquivo Digital ainda não foi ativado neste banco (migrations pendentes).
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Info className="w-3.5 h-3.5 shrink-0" />
        Renovar nunca sobrescreve: a versão anterior continua aqui, com o arquivo original intacto.
        Mostrando os 500 envios mais recentes.
      </p>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por colaborador, tipo ou nome do arquivo…" className="pl-8" />
          </div>

          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead className="whitespace-nowrap">Versão</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="whitespace-nowrap">Emissão</TableHead>
                  <TableHead className="whitespace-nowrap">Validade</TableHead>
                  <TableHead className="whitespace-nowrap">Enviado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
                )}
                {!isLoading && linhas.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    <History className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    Nenhuma versão publicada ainda.
                  </TableCell></TableRow>
                )}
                {linhas.map((l) => (
                  <TableRow key={l.v.id} className={l.v.situacao_versao !== "atual" ? "opacity-70" : ""}>
                    <TableCell className="font-medium text-sm">{l.colaborador}</TableCell>
                    <TableCell className="text-sm">{l.tipo}</TableCell>
                    <TableCell className="text-sm">v{l.v.versao}</TableCell>
                    <TableCell>
                      <SituacaoBadge situacao={l.v.situacao_versao === "atual" ? "vigente" : "substituido"} />
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{dataBr(l.v.data_emissao)}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {l.v.data_validade ? dataBr(l.v.data_validade) : "Permanente"}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{dataHoraBr(l.v.created_at)}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" title="Abrir arquivo" onClick={() => abrir(l)}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      {l.colaboradorId && (
                        <Button size="icon" variant="ghost" title="Abrir dossiê"
                          onClick={() => navigate(`/arquivo-digital/dossie/${l.colaboradorId}`)}>
                          <FolderOpen className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
