import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Plus, FileWarning, Activity, BarChart3 } from "lucide-react";
import {
  LTCAT_STATUS_LABEL, LTCAT_STATUS_COLOR, LTCAT_MOTIVO_LABEL,
  LtcatDocumento, LtcatStatus,
} from "@/lib/ltcatTypes";

export default function LtcatModule() {
  const navigate = useNavigate();
  const { empresaId, empresaScopeIds, isSuperAdmin } = useAuth();
  const perms = usePermissions("ltcat");

  const [status, setStatus] = useState<string>("todos");
  const [unidadeFiltro, setUnidadeFiltro] = useState<string>("todas");
  const [vigencia, setVigencia] = useState<string>("todas");
  const [pgrFiltro, setPgrFiltro] = useState<string>("todos");

  const { data: ltcats = [], isLoading } = useQuery({
    queryKey: ["ltcat-list", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      let q = (supabase.from as any)("ltcat_documentos").select("*");
      if (empresaScopeIds.length && !isSuperAdmin) q = q.in("empresa_id", empresaScopeIds);
      else if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as LtcatDocumento[];
    },
    enabled: perms.canView,
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ["ltcat-unidades", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data } = await (supabase.from as any)("empresa_config")
        .select("id, nome")
        .or(`id.eq.${empresaId},empresa_pai_id.eq.${empresaId}`);
      return data || [];
    },
  });

  const { data: pgrs = [] } = useQuery({
    queryKey: ["ltcat-pgrs", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data } = await (supabase.from as any)("pgr_documentos")
        .select("id, versao, status, unidade_id")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const unidadeMap = useMemo(() => {
    const m = new Map<string, string>();
    (unidades as any[]).forEach((u) => m.set(u.id, u.nome));
    return m;
  }, [unidades]);

  const pgrMap = useMemo(() => {
    const m = new Map<string, string>();
    (pgrs as any[]).forEach((p) => m.set(p.id, `PGR v${p.versao}`));
    return m;
  }, [pgrs]);

  const filtered = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    return ltcats.filter((p) => {
      if (status !== "todos" && p.status !== status) return false;
      if (unidadeFiltro !== "todas") {
        const ref = p.unidade_id || p.empresa_id;
        if (ref !== unidadeFiltro) return false;
      }
      if (pgrFiltro === "sem_pgr" && p.pgr_id) return false;
      if (pgrFiltro !== "todos" && pgrFiltro !== "sem_pgr" && p.pgr_id !== pgrFiltro) return false;
      if (vigencia === "vigente_hoje") {
        if (!p.data_vigencia_inicio || !p.data_vigencia_fim) return false;
        if (p.data_vigencia_inicio > hoje || p.data_vigencia_fim < hoje) return false;
      } else if (vigencia === "vencido") {
        if (!p.data_vigencia_fim || p.data_vigencia_fim >= hoje) return false;
      }
      return true;
    });
  }, [ltcats, status, unidadeFiltro, vigencia, pgrFiltro]);

  if (!perms.canView) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Você não tem permissão para acessar o módulo LTCAT.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" /> LTCAT — Laudo Previdenciário
          </h1>
          <p className="text-sm text-muted-foreground">
            Laudo Técnico das Condições Ambientais do Trabalho (Lei 8.213/91 art. 58, Dec. 3.048/99).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/ltcat/dashboard")}>
            <BarChart3 className="h-4 w-4 mr-1" /> Dashboard
          </Button>
          {perms.canCreate && (
            <Button onClick={() => navigate("/ltcat/novo")}>
              <Plus className="h-4 w-4 mr-1" /> Novo LTCAT
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(LTCAT_STATUS_LABEL).map(([k, v]) => (
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
            <Label className="text-xs">PGR vinculado</Label>
            <Select value={pgrFiltro} onValueChange={setPgrFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="sem_pgr">Sem PGR</SelectItem>
                {(pgrs as any[]).map((p) => (
                  <SelectItem key={p.id} value={p.id}>PGR v{p.versao} ({p.status})</SelectItem>
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
              Nenhum LTCAT encontrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Versão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Emissão</TableHead>
                    <TableHead>Vigência</TableHead>
                    <TableHead>PGR</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="max-w-[200px] truncate">
                        {unidadeMap.get(p.unidade_id || p.empresa_id) || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">v{p.versao}</TableCell>
                      <TableCell>
                        <Badge className={LTCAT_STATUS_COLOR[p.status as LtcatStatus]} variant="outline">
                          {LTCAT_STATUS_LABEL[p.status as LtcatStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{LTCAT_MOTIVO_LABEL[p.motivo_emissao]}</TableCell>
                      <TableCell className="text-xs">
                        {p.data_emissao ? new Date(p.data_emissao + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {p.data_vigencia_inicio && p.data_vigencia_fim
                          ? `${new Date(p.data_vigencia_inicio + "T00:00:00").toLocaleDateString("pt-BR")} – ${new Date(p.data_vigencia_fim + "T00:00:00").toLocaleDateString("pt-BR")}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {p.pgr_id ? (pgrMap.get(p.pgr_id) || "vinculado") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/ltcat/${p.id}`)}>
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
