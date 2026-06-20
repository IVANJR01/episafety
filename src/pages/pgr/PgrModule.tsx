import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Plus, FileWarning, ShieldCheck, BarChart3 } from "lucide-react";
import { PGR_STATUS_LABEL, PGR_STATUS_COLOR, PgrDocumento, PgrStatus } from "@/lib/pgrTypes";

export default function PgrModule() {
  const navigate = useNavigate();
  const { empresaId, empresaScopeIds, isSuperAdmin } = useAuth();
  const perms = usePermissions("pgr");

  const [status, setStatus] = useState<string>("todos");
  const [unidadeFiltro, setUnidadeFiltro] = useState<string>("todas");
  const [vigencia, setVigencia] = useState<string>("todas");

  const { data: pgrs = [], isLoading } = useQuery({
    queryKey: ["pgr-list", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      let q = (supabase.from as any)("pgr_documentos").select("*");
      if (empresaScopeIds.length && !isSuperAdmin) q = q.in("empresa_id", empresaScopeIds);
      else if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PgrDocumento[];
    },
    enabled: perms.canView,
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ["pgr-unidades", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data } = await (supabase.from as any)("empresa_config")
        .select("id, nome")
        .or(`id.eq.${empresaId},empresa_pai_id.eq.${empresaId}`);
      return data || [];
    },
  });

  const unidadeMap = useMemo(() => {
    const m = new Map<string, string>();
    (unidades as any[]).forEach((u) => m.set(u.id, u.nome));
    return m;
  }, [unidades]);

  const filtered = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    return pgrs.filter((p) => {
      if (status !== "todos" && p.status !== status) return false;
      if (unidadeFiltro !== "todas") {
        const ref = p.unidade_id || p.empresa_id;
        if (ref !== unidadeFiltro) return false;
      }
      if (vigencia === "vigente_hoje") {
        if (!p.data_vigencia_inicio || !p.data_vigencia_fim) return false;
        if (p.data_vigencia_inicio > hoje || p.data_vigencia_fim < hoje) return false;
      } else if (vigencia === "vencido") {
        if (!p.data_vigencia_fim || p.data_vigencia_fim >= hoje) return false;
      }
      return true;
    });
  }, [pgrs, status, unidadeFiltro, vigencia]);

  if (!perms.canView) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Você não tem permissão para acessar o módulo PGR.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6" /> PGR — Gerenciamento de Riscos
          </h1>
          <p className="text-sm text-muted-foreground">
            Programa de Gerenciamento de Riscos (NR-1). Inventário e Plano de Ação.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/pgr/dashboard")}>
            <BarChart3 className="h-4 w-4 mr-1" /> Dashboard
          </Button>
          {perms.canCreate && (
            <Button onClick={() => navigate("/pgr/novo")}>
              <Plus className="h-4 w-4 mr-1" /> Novo PGR
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(PGR_STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Unidade</Label>
            <Select value={unidadeFiltro} onValueChange={setUnidadeFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {(unidades as any[]).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Vigência</Label>
            <Select value={vigencia} onValueChange={setVigencia}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="vigente_hoje">Vigente hoje</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <FileWarning className="h-10 w-10 mx-auto mb-2 opacity-30" />
              Nenhum PGR encontrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Versão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Emissão</TableHead>
                    <TableHead>Vigência</TableHead>
                    <TableHead>Responsável Técnico</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="max-w-[220px] truncate">
                        {unidadeMap.get(p.unidade_id || p.empresa_id) || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">v{p.versao}</TableCell>
                      <TableCell>
                        <Badge className={PGR_STATUS_COLOR[p.status as PgrStatus]} variant="outline">
                          {PGR_STATUS_LABEL[p.status as PgrStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {p.data_emissao ? new Date(p.data_emissao + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {p.data_vigencia_inicio && p.data_vigencia_fim
                          ? `${new Date(p.data_vigencia_inicio + "T00:00:00").toLocaleDateString("pt-BR")} – ${new Date(p.data_vigencia_fim + "T00:00:00").toLocaleDateString("pt-BR")}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs max-w-[180px] truncate">
                        {p.resp_tec_nome || "—"}
                        {p.resp_tec_registro && <span className="text-muted-foreground"> · {p.resp_tec_registro}</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/pgr/${p.id}`)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
