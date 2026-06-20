import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, AlertTriangle, Search, FileWarning } from "lucide-react";
import {
  CatRow,
  STATUS_LABEL,
  STATUS_COLOR,
  TIPO_ACIDENTE_LABEL,
  prazoLegal,
} from "@/lib/catTypes";

export default function CatList() {
  const navigate = useNavigate();
  const { empresaId, empresaScopeIds, isSuperAdmin } = useAuth();

  const [status, setStatus] = useState<string>("todos");
  const [tipo, setTipo] = useState<string>("todos");
  const [funcionarioFiltro, setFuncionarioFiltro] = useState<string>("todos");
  const [unidadeFiltro, setUnidadeFiltro] = useState<string>("todos");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [busca, setBusca] = useState("");

  const { data: cats = [], isLoading } = useQuery({
    queryKey: ["cat-list", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      let q = (supabase.from as any)("cat_comunicacoes").select("*");
      if (empresaScopeIds.length && !isSuperAdmin) q = q.in("empresa_id", empresaScopeIds);
      else if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q.order("data_acidente", { ascending: false });
      if (error) throw error;
      return (data || []) as CatRow[];
    },
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["cat-list-funcs", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      let q = (supabase.from as any)("funcionarios").select("id, nome, empresa_id");
      if (empresaScopeIds.length && !isSuperAdmin) q = q.in("empresa_id", empresaScopeIds);
      else if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q.order("nome");
      return data || [];
    },
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ["cat-list-unidades", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data } = await (supabase.from as any)("empresa_config")
        .select("id, nome")
        .or(`id.eq.${empresaId},empresa_pai_id.eq.${empresaId}`);
      return data || [];
    },
  });

  const funcMap = useMemo(() => {
    const m = new Map<string, string>();
    (funcionarios as any[]).forEach((f) => m.set(f.id, f.nome));
    return m;
  }, [funcionarios]);

  const filtered = useMemo(() => {
    return cats.filter((c) => {
      if (status !== "todos" && c.status !== status) return false;
      if (tipo !== "todos" && c.tipo_acidente !== tipo) return false;
      if (funcionarioFiltro !== "todos" && c.funcionario_id !== funcionarioFiltro) return false;
      if (unidadeFiltro !== "todos" && c.unidade_id !== unidadeFiltro && c.empresa_id !== unidadeFiltro) return false;
      if (dataDe && c.data_acidente < dataDe) return false;
      if (dataAte && c.data_acidente > dataAte) return false;
      if (busca) {
        const b = busca.toLowerCase();
        const nome = (funcMap.get(c.funcionario_id) || "").toLowerCase();
        const num = (c.numero_cat || "").toLowerCase();
        if (!num.includes(b) && !nome.includes(b)) return false;
      }
      return true;
    });
  }, [cats, status, tipo, funcionarioFiltro, unidadeFiltro, dataDe, dataAte, busca, funcMap]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <Label className="text-xs">Buscar</Label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Nº CAT, funcionário…"
                className="pl-8"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo de acidente</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(TIPO_ACIDENTE_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
            <Label className="text-xs">Unidade</Label>
            <Select value={unidadeFiltro} onValueChange={setUnidadeFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {(unidades as any[]).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Data inicial</Label>
            <Input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Data final</Label>
            <Input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)} />
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
              Nenhuma CAT encontrada com os filtros aplicados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº CAT</TableHead>
                    <TableHead>Data Acidente</TableHead>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prazo Legal</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const p = prazoLegal(c);
                    return (
                      <TableRow key={c.id} className={p.vencido ? "bg-red-50/50 dark:bg-red-950/10" : ""}>
                        <TableCell className="font-mono text-xs">
                          {c.numero_cat || <span className="italic text-muted-foreground">rascunho</span>}
                        </TableCell>
                        <TableCell>{new Date(c.data_acidente).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {funcMap.get(c.funcionario_id) || "—"}
                          {c.obito && (
                            <Badge variant="destructive" className="ml-2 text-[10px]">ÓBITO</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{TIPO_ACIDENTE_LABEL[c.tipo_acidente]}</TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLOR[c.status]} variant="outline">
                            {STATUS_LABEL[c.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {p.label && (
                            <span className={p.vencido ? "text-red-600 font-medium" : p.critico ? "text-amber-600" : "text-muted-foreground"}>
                              {p.critico && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                              {p.label}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/cat/${c.id}`)}>
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
