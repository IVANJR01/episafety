import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Pencil, FileDown, Trash2, Search, Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { differenceInDays, parseISO, format } from "date-fns";
import { gerarPdfAso } from "@/lib/asoPdf";
import { usePermissions } from "@/hooks/usePermissions";
import DocumentoEvidencia from "@/components/treinamentos/DocumentoEvidencia";
import { ROTULO_EXAME_ASO, rotuloExameAso } from "@/lib/tipoExameAso";

const NOME_TIPO_ASO = "ASO - Atestado de Saúde Ocupacional";

/* O rótulo do exame mora em um lugar só — o dossiê mostra o mesmo. */
const TIPO = ROTULO_EXAME_ASO;

function statusValidade(dv?: string | null) {
  if (!dv) return { label: "—", cls: "bg-muted text-muted-foreground" };
  const d = differenceInDays(parseISO(dv), new Date());
  if (d < 0) return { label: "Vencido", cls: "bg-destructive/15 text-destructive" };
  if (d <= 30) return { label: "Vencendo", cls: "bg-orange-500/15 text-orange-600" };
  return { label: "Válido", cls: "bg-emerald-500/15 text-emerald-600" };
}

function aptidaoBadge(a?: string | null) {
  if (a === "apto") return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">Apto</Badge>;
  if (a === "inapto") return <Badge className="bg-destructive/15 text-destructive border-destructive/30">Inapto</Badge>;
  if (a === "apto_restricao") return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">Apto c/ restrição</Badge>;
  return <Badge variant="outline">—</Badge>;
}

export default function AsoList({ onEdit }: { onEdit?: (id: string) => void }) {
  const { empresaId, user } = useAuth();
  const { canEdit, canDelete } = usePermissions("aso");
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [tipo, setTipo] = useState<string>("all");
  const [valid, setValid] = useState<string>("all");

  /*
   * O ASO tem UM tipo de documento no dossiê, e admissional, periódico,
   * demissional etc. são versões dele.
   *
   * Houve aqui um mapa de cinco subtipos ("ASO Admissional", "ASO
   * Periódico"...). Eles foram apagados do catálogo pela migração
   * 20260809100000_remove_aso_subtipos.sql, a pedido do cliente, e o mapa
   * ficou procurando nome que não existe mais — toda busca caía no tipo
   * genérico pela cláusula de reserva. Sai o mapa; fica a consulta de um
   * tipo só.
   *
   * Quem precisa ver "falta o demissional" vê pela lista do próprio módulo
   * de ASO, que guarda o tipo de exame de cada registro.
   */
  const { data: tipoDocumentoAso } = useQuery({
    queryKey: ["internal-document-type-aso"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("internal_document_types")
        .select("id")
        .is("empresa_id", null)
        .eq("nome", NOME_TIPO_ASO)
        .maybeSingle();
      return data?.id || null;
    },
    staleTime: Infinity,
  });

  const { data: asos = [], isLoading } = useQuery({
    queryKey: ["asos-list", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asos")
        .select(`*, funcionarios:funcionario_id (nome, cpf, cargo, setor), aso_medicos:medico_id (nome, crm, uf_crm), empresa_config:empresa_id (nome, cnpj)`)
        .eq("empresa_id", empresaId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  /*
   * O anexo é por ASO, não por colaborador.
   *
   * O documento do Arquivo Digital é um só por colaborador e tipo, e o ASO
   * tem um tipo só. Com isso, as linhas do admissional, do periódico e do
   * demissional do MESMO colaborador mostravam o mesmo "Ver PDF" e a mesma
   * contagem: não dava para saber qual arquivo era qual, e "Renovar" numa
   * linha mexia no monte inteiro.
   *
   * Cada versão já guarda o id do ASO que a originou. Daqui sai o rótulo
   * do tipo de exame de cada uma, e a linha passa a mostrar só o seu.
   */
  const rotuloDoAso = useCallback((origemId: string | null) => {
    if (!origemId) return null;
    const aso = (asos as any[]).find((a) => a.id === origemId);
    return aso ? rotuloExameAso(aso.tipo_exame) : null;
  }, [asos]);

  const rows = useMemo(() => {
    return asos.filter((a: any) => {
      // Blindagem extra: só empresa ativa.
      if (empresaId && a.empresa_id !== empresaId) return false;
      if (tipo !== "all" && a.tipo_exame !== tipo) return false;
      const sv = statusValidade(a.data_vencimento).label.toLowerCase();
      if (valid !== "all" && sv !== valid) return false;
      if (!filter) return true;
      const f = filter.toLowerCase();
      return (
        a.numero_aso?.toLowerCase().includes(f) ||
        a.funcionarios?.nome?.toLowerCase().includes(f) ||
        a.funcionarios?.cpf?.includes(f) ||
        a.empresa_config?.nome?.toLowerCase().includes(f)
      );
    });
  }, [asos, filter, tipo, valid, empresaId]);

  if (!empresaId) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Selecione uma empresa no cabeçalho para listar os ASOs.</CardContent></Card>;
  }

  const { data: examesPendentes = [], isFetching: buscandoExamesPendentes } = useQuery({
    queryKey: ["exames-para-sincronizar", empresaId, asos.length],
    enabled: !!empresaId && !isLoading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exames")
        .select("id, funcionario_id, tipo, data, data_vencimento, resultado, medico, observacao, funcionarios:funcionario_id(nome, cpf)")
        .eq("empresa_id", empresaId!);
      if (error || !data) return [];

      const funcIdsComAso = new Set(asos.map((a: any) => a.funcionario_id));
      return data.filter((e: any) => e.funcionario_id && !funcIdsComAso.has(e.funcionario_id));
    },
  });

  const [sincronizando, setSincronizando] = useState(false);

  const sincronizarDaMatriz = async () => {
    if (!empresaId || examesPendentes.length === 0) return;
    setSincronizando(true);
    try {
      let inseridos = 0;
      for (const ex of examesPendentes) {
        let numeroAso = "";
        try {
          const { data: num } = await supabase.rpc("gerar_numero_aso", { _empresa_id: empresaId });
          numeroAso = num || `ASO-${new Date().getFullYear()}-${String(inseridos + 2).padStart(4, "0")}`;
        } catch {
          numeroAso = `ASO-${new Date().getFullYear()}-${String(inseridos + 2).padStart(4, "0")}`;
        }

        const res = (ex.resultado || "apto").toLowerCase();
        const aptidao = res.includes("restri")
          ? "apto_restricao"
          : res.includes("inapto")
          ? "inapto"
          : "apto";

        const payload: any = {
          empresa_id: empresaId,
          funcionario_id: ex.funcionario_id,
          tipo_exame: ex.tipo || "periodico",
          data_emissao: ex.data || new Date().toISOString().split("T")[0],
          data_vencimento: ex.data_vencimento || null,
          validade_tipo: "1ano",
          status_aptidao: aptidao,
          apto_cargo: aptidao === "apto",
          inapto_cargo: aptidao === "inapto",
          apto_restricao: aptidao === "apto_restricao",
          nr35_nao_aplica: true,
          numero_aso: numeroAso,
          status: "emitido",
          liberado_portal_rh: true,
          observacoes: ex.observacao || "Importado da Matriz de Exames Ocupacionais.",
          exames_snapshot: [{ nome_exame: "ASO - Avaliação Clínica Ocupacional" }],
          created_by: user?.id || null,
        };

        const { data: asoCriado, error: errInsert } = await supabase.from("asos").insert(payload).select().single();
        if (!errInsert && asoCriado) {
          inseridos++;
          // Cria também na tabela aso_exames para enriquecer o prontuário
          await supabase.from("aso_exames").insert({
            aso_id: asoCriado.id,
            nome_exame: "ASO - Avaliação Clínica Ocupacional",
            realizado: true,
            data_realizacao: ex.data,
            resultado: ex.resultado || "Normal / Apto",
            empresa_id: empresaId,
          });
        }
      }

      toast.success(`${inseridos} ASO(s) sincronizado(s) com sucesso a partir da Matriz de Exames!`);
      qc.invalidateQueries({ queryKey: ["asos-list"] });
      qc.invalidateQueries({ queryKey: ["aso-dashboard"] });
      qc.invalidateQueries({ queryKey: ["exames-para-sincronizar"] });
      qc.invalidateQueries({ queryKey: ["pcmso-relatorio-asos"] });
    } catch (e: any) {
      toast.error(`Erro ao sincronizar: ${e.message}`);
    } finally {
      setSincronizando(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Cancelar este ASO? Ele permanecerá no histórico como cancelado.")) return;
    const { error } = await supabase.from("asos").update({ status: "cancelado" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("ASO cancelado");
    qc.invalidateQueries({ queryKey: ["asos-list"] });
    qc.invalidateQueries({ queryKey: ["aso-dashboard"] });
  };

  const gerarPdf = async (id: string) => {
    try {
      await gerarPdfAso(id);
    } catch (e: any) {
      toast.error("Erro ao gerar PDF: " + e.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Banner de Sincronização inteligente com a Matriz de Exames */}
      {examesPendentes.length > 0 && canEdit && (
        <div className="p-4 bg-linear-to-r from-sky-50 via-blue-50/40 to-indigo-50 border border-sky-200 rounded-xl shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sky-950">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 font-bold text-sm text-sky-900">
              <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
              Sincronização com a Matriz de Exames
            </div>
            <p className="text-xs text-sky-700 max-w-2xl leading-relaxed">
              Foram identificados <b>{examesPendentes.length} exames ocupacionais válidos</b> na aba Matriz de Exames que ainda não constam como ASO formal nesta lista. Clique no botão ao lado para gerar automaticamente os números e prontuários oficiais de ASO.
            </p>
          </div>
          <Button
            size="sm"
            onClick={sincronizarDaMatriz}
            disabled={sincronizando}
            className="bg-sky-600 hover:bg-sky-700 text-white text-xs gap-1.5 shrink-0 shadow-2xs h-9 px-3.5 font-medium"
          >
            {sincronizando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Sincronizar {examesPendentes.length} Exames para ASOs
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar por nº, nome, CPF ou empresa…" className="pl-8" />
          </div>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(TIPO).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={valid} onValueChange={setValid}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="válido">Válido</SelectItem>
              <SelectItem value="vencendo">Vencendo</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº ASO</TableHead>
                <TableHead>Funcionário</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Aptidão</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Documento/Evidência</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>}
              {!isLoading && rows.length === 0 && <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nenhum ASO encontrado.</TableCell></TableRow>}
              {rows.map((a: any) => {
                const sv = statusValidade(a.data_vencimento);
                return (
                  <TableRow key={a.id} className={a.status === "cancelado" ? "opacity-50" : ""}>
                    <TableCell className="font-mono text-xs">{a.numero_aso}</TableCell>
                    <TableCell>
                      <div className="font-medium">{a.funcionarios?.nome || "—"}</div>
                      <div className="text-xs text-muted-foreground">{a.funcionarios?.cpf}</div>
                    </TableCell>
                    <TableCell className="text-sm">{a.empresa_config?.nome}</TableCell>
                    <TableCell>{TIPO[a.tipo_exame] || a.tipo_exame}</TableCell>
                    <TableCell>{aptidaoBadge(a.status_aptidao)}</TableCell>
                    <TableCell className="text-sm">{a.data_emissao ? format(parseISO(a.data_emissao), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell className="text-sm">{a.data_vencimento ? format(parseISO(a.data_vencimento), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell>
                      {a.status === "cancelado"
                        ? <Badge variant="outline">Cancelado</Badge>
                        : <Badge className={sv.cls + " border-0"}>{sv.label}</Badge>}
                    </TableCell>
                    <TableCell>
                      <DocumentoEvidencia
                        empresaId={a.empresa_id}
                        colaboradorId={a.funcionario_id}
                        tipoDocumentoId={tipoDocumentoAso || null}
                        versaoDoRegistro
                        rotuloVersao={rotuloDoAso}
                        dataValidade={a.data_vencimento}
                        registroId={a.id}
                        origemTabela="asos"
                        origemId={a.id}
                        userId={user?.id}
                        podeEditar={canEdit}
                        semTipoTexto="Arquivo Digital indisponível"
                        semTipoTitulo="O tipo de documento do ASO ainda não foi configurado neste banco."
                      />
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => gerarPdf(a.id)} title="Gerar PDF"><FileDown className="h-4 w-4" /></Button>
                      {canEdit && <Button size="icon" variant="ghost" onClick={() => onEdit?.(a.id)} title="Editar"><Pencil className="h-4 w-4" /></Button>}
                      {canDelete && <Button size="icon" variant="ghost" onClick={() => remove(a.id)} title="Cancelar"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      </Card>
    </div>
  );
}
