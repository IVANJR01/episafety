import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Eye, FileText, FileWarning, Plus } from "lucide-react";
import {
  PPP_STATUS_LABEL, PPP_STATUS_COLOR, PPP_MOTIVO_LABEL,
  PppDocumento, PppStatus,
} from "@/lib/pppTypes";
import VoltarParaCentral from "@/components/documentacao/VoltarParaCentral";

export default function PppModule() {
  const navigate = useNavigate();
  const { empresaId, empresaScopeIds, isSuperAdmin } = useAuth();
  const perms = usePermissions("ppp");

  const [funcionarioFiltro, setFuncionarioFiltro] = useState("todos");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [funcaoFiltro, setFuncaoFiltro] = useState("");
  const [periodoIni, setPeriodoIni] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");

  const { data: ppps = [], isLoading } = useQuery({
    queryKey: ["ppp-list", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      let q = (supabase.from as any)("ppp_documentos").select("*");
      if (empresaScopeIds.length && !isSuperAdmin) q = q.in("empresa_id", empresaScopeIds);
      else if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PppDocumento[];
    },
    enabled: perms.canView,
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["ppp-funcs", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      let q = (supabase.from as any)("funcionarios")
        .select("id, nome, cpf, matricula, cargo, setor, empresa_id");
      if (empresaScopeIds.length && !isSuperAdmin) q = q.in("empresa_id", empresaScopeIds);
      else if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q.order("nome");
      return data || [];
    },
  });

  const funcMap = useMemo(() => {
    const m = new Map<string, any>();
    (funcionarios as any[]).forEach((f) => m.set(f.id, f));
    return m;
  }, [funcionarios]);

  const filtered = useMemo(() => {
    return ppps.filter((p) => {
      const f = funcMap.get(p.funcionario_id);
      if (funcionarioFiltro !== "todos" && p.funcionario_id !== funcionarioFiltro) return false;
      if (statusFiltro !== "todos" && p.status !== statusFiltro) return false;
      if (funcaoFiltro && !(f?.cargo || "").toLowerCase().includes(funcaoFiltro.toLowerCase())) return false;
      if (periodoIni && (!p.data_emissao || p.data_emissao < periodoIni)) return false;
      if (periodoFim && (!p.data_emissao || p.data_emissao > periodoFim)) return false;
      return true;
    });
  }, [ppps, funcMap, funcionarioFiltro, statusFiltro, funcaoFiltro, periodoIni, periodoFim]);

  if (!perms.canView) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Você não tem permissão para acessar o módulo PPP.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <VoltarParaCentral />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" /> PPP — Perfil Profissiográfico Previdenciário
          </h1>
          <p className="text-sm text-muted-foreground">
            Documento interno preparatório (IN PRES/INSS 128/2022). Sem envio eSocial nesta fase.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/ppp/dashboard")}>
            <BarChart3 className="h-4 w-4 mr-1" /> Dashboard
          </Button>
          {perms.canCreate && (
            <Button onClick={() => navigate("/ppp/novo")}>
              <Plus className="h-4 w-4 mr-1" /> Novo PPP
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <Label className="text-xs">Funcionário</Label>
            <Select value={funcionarioFiltro} onValueChange={setFuncionarioFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(funcionarios as any[]).map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(PPP_STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Função (contém)</Label>
            <Input value={funcaoFiltro} onChange={(e) => setFuncaoFiltro(e.target.value)} placeholder="ex.: eletricista" />
          </div>
          <div>
            <Label className="text-xs">Emissão de</Label>
            <Input type="date" value={periodoIni} onChange={(e) => setPeriodoIni(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Emissão até</Label>
            <Input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} />
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
              Nenhum PPP encontrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Função atual</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Emissão</TableHead>
                    <TableHead>Versão</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const f = funcMap.get(p.funcionario_id);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="max-w-[220px] truncate">{f?.nome || "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{f?.cpf || "—"}</TableCell>
                        <TableCell className="text-xs">{f?.matricula || "—"}</TableCell>
                        <TableCell className="text-xs">{f?.cargo || "—"}</TableCell>
                        <TableCell>
                          <Badge className={PPP_STATUS_COLOR[p.status]} variant="outline">
                            {PPP_STATUS_LABEL[p.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{PPP_MOTIVO_LABEL[p.motivo_emissao]}</TableCell>
                        <TableCell className="text-xs">
                          {p.data_emissao ? new Date(p.data_emissao + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                        </TableCell>
                        <TableCell className="text-xs font-mono">v{p.versao}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/ppp/${p.id}`)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
