import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, Search, Tag, Pencil } from "lucide-react";

type T24Row = {
  codigo: string;
  descricao: string;
  grupo: string | null;
  unidade_medida_padrao: string | null;
  tipo_avaliacao: "quantitativa" | "qualitativa" | null;
  aposentadoria_especial: boolean;
  origem: "oficial" | "referencial" | "pendente_revisao";
  ativo: boolean;
};

type Mapeamento = {
  id: string;
  empresa_id: string;
  agente_nome: string;
  ltcat_catalogo_agente_id: string | null;
  codigo_t24: string | null;
  tipo_avaliacao_esperado: "quantitativa" | "qualitativa" | null;
  unidade_medida_padrao: string | null;
  aposentadoria_especial: boolean;
  status: "mapeado" | "pendente" | "divergente";
  observacoes_tecnicas: string | null;
  aprovado_em: string | null;
  updated_at: string;
};

type AgenteAggregado = {
  nome: string;
  origem: ("PPP" | "LTCAT")[];
  grupo: string | null;
  ltcat_catalogo_id: string | null;
  exemplos_unidade: string | null;
  ocorrencias: number;
};

const STATUS_LABEL: Record<string, string> = {
  mapeado: "Mapeado",
  pendente: "Pendente",
  divergente: "Divergente",
};
const STATUS_COLOR: Record<string, string> = {
  mapeado: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  pendente: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  divergente: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
};

function normalize(s: string) {
  return (s || "").trim().toLowerCase();
}

export default function S2240Mapeamentos() {
  const { empresaId, modulosPermitidos, isSuperAdmin } = useAuth();
  const qc = useQueryClient();

  const canView = isSuperAdmin || hasPermission(modulosPermitidos, "esocial", "view")
    || modulosPermitidos.includes("esocial:s2240:visualizar");
  const canEdit = isSuperAdmin || hasPermission(modulosPermitidos, "esocial", "edit")
    || modulosPermitidos.includes("esocial:s2240:preparar");

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroGrupo, setFiltroGrupo] = useState<string>("todos");
  const [editing, setEditing] = useState<{
    agente: AgenteAggregado;
    map: Mapeamento | null;
  } | null>(null);

  // Tabela 24 (catálogo global)
  const { data: t24 = [] } = useQuery({
    queryKey: ["t24"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("esocial_tabela24_agentes")
        .select("*").eq("ativo", true).order("codigo");
      if (error) throw error;
      return (data || []) as T24Row[];
    },
    enabled: canView,
  });

  // Agentes do PPP (na empresa ativa)
  const { data: pppAgentes = [] } = useQuery({
    queryKey: ["s2240-ppp-agentes", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await (supabase.from as any)("ppp_exposicoes")
        .select("agente_nome, agente_grupo, unidade_medida, agente_id")
        .eq("empresa_id", empresaId);
      if (error) throw error;
      return data || [];
    },
    enabled: canView && !!empresaId,
  });

  // Agentes do LTCAT (na empresa ativa)
  const { data: ltcatAgentes = [] } = useQuery({
    queryKey: ["s2240-ltcat-agentes", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await (supabase.from as any)("ltcat_agentes")
        .select("nome, grupo, catalogo_id")
        .eq("empresa_id", empresaId);
      if (error) return [];
      return data || [];
    },
    enabled: canView && !!empresaId,
  });

  // Mapeamentos existentes
  const { data: mapeamentos = [] } = useQuery({
    queryKey: ["s2240-map", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await (supabase.from as any)("esocial_s2240_mapeamentos")
        .select("*").eq("empresa_id", empresaId);
      if (error) throw error;
      return (data || []) as Mapeamento[];
    },
    enabled: canView && !!empresaId,
  });

  // Agregação por nome de agente
  const agentes: AgenteAggregado[] = useMemo(() => {
    const map = new Map<string, AgenteAggregado>();
    for (const row of pppAgentes as any[]) {
      const key = normalize(row.agente_nome);
      if (!key) continue;
      const ex = map.get(key) || {
        nome: row.agente_nome, origem: [], grupo: row.agente_grupo ?? null,
        ltcat_catalogo_id: null, exemplos_unidade: row.unidade_medida ?? null, ocorrencias: 0,
      };
      if (!ex.origem.includes("PPP")) ex.origem.push("PPP");
      ex.ocorrencias += 1;
      ex.exemplos_unidade = ex.exemplos_unidade || row.unidade_medida;
      map.set(key, ex);
    }
    for (const row of ltcatAgentes as any[]) {
      const key = normalize(row.nome);
      if (!key) continue;
      const ex = map.get(key) || {
        nome: row.nome, origem: [], grupo: row.grupo ?? null,
        ltcat_catalogo_id: row.catalogo_id ?? null,
        exemplos_unidade: null, ocorrencias: 0,
      };
      if (!ex.origem.includes("LTCAT")) ex.origem.push("LTCAT");
      ex.ltcat_catalogo_id = ex.ltcat_catalogo_id || row.catalogo_id;
      ex.ocorrencias += 1;
      map.set(key, ex);
    }
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [pppAgentes, ltcatAgentes]);

  const mapByKey = useMemo(() => {
    const m = new Map<string, Mapeamento>();
    for (const x of mapeamentos) m.set(normalize(x.agente_nome), x);
    return m;
  }, [mapeamentos]);

  const t24ByCode = useMemo(() => {
    const m = new Map<string, T24Row>();
    for (const x of t24) m.set(x.codigo, x);
    return m;
  }, [t24]);

  const linhas = useMemo(() => {
    return agentes.map(a => {
      const map = mapByKey.get(normalize(a.nome)) || null;
      const t24row = map?.codigo_t24 ? t24ByCode.get(map.codigo_t24) : null;
      let status: "mapeado" | "pendente" | "divergente";
      if (!map || !map.codigo_t24) status = "pendente";
      else if (!t24row) status = "divergente";
      else status = map.status === "divergente" ? "divergente" : "mapeado";
      return { agente: a, map, t24row, status };
    });
  }, [agentes, mapByKey, t24ByCode]);

  const linhasFiltradas = useMemo(() => {
    const q = normalize(busca);
    return linhas.filter(l => {
      if (filtroStatus !== "todos" && l.status !== filtroStatus) return false;
      if (filtroGrupo !== "todos" && (l.agente.grupo || "—") !== filtroGrupo) return false;
      if (q && !normalize(l.agente.nome).includes(q)
        && !(l.map?.codigo_t24 || "").toLowerCase().includes(q)
        && !(l.t24row?.descricao || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [linhas, busca, filtroStatus, filtroGrupo]);

  const grupos = useMemo(() => {
    const s = new Set<string>();
    for (const a of agentes) s.add(a.grupo || "—");
    return Array.from(s).sort();
  }, [agentes]);

  // Indicadores
  const ind = useMemo(() => {
    const total = linhas.length;
    const mapeados = linhas.filter(l => l.status === "mapeado").length;
    const pendentes = linhas.filter(l => l.status === "pendente").length;
    const divergentes = linhas.filter(l => l.status === "divergente").length;
    const porGrupo: Record<string, number> = {};
    for (const l of linhas) {
      const g = l.agente.grupo || "—";
      porGrupo[g] = (porGrupo[g] || 0) + 1;
    }
    return { total, mapeados, pendentes, divergentes, porGrupo };
  }, [linhas]);

  // Salvar mapeamento
  const upsert = useMutation({
    mutationFn: async (payload: {
      agente: AgenteAggregado;
      codigo_t24: string | null;
      observacoes: string;
      tipo_avaliacao: "quantitativa" | "qualitativa" | null;
      unidade: string | null;
      aposentadoria: boolean;
    }) => {
      if (!empresaId) throw new Error("Selecione uma empresa ativa");
      const status: "mapeado" | "pendente" | "divergente" = payload.codigo_t24
        ? (t24ByCode.has(payload.codigo_t24) ? "mapeado" : "divergente")
        : "pendente";
      const { data: { user } } = await supabase.auth.getUser();
      const row = {
        empresa_id: empresaId,
        agente_nome: payload.agente.nome,
        ltcat_catalogo_agente_id: payload.agente.ltcat_catalogo_id,
        codigo_t24: payload.codigo_t24,
        tipo_avaliacao_esperado: payload.tipo_avaliacao,
        unidade_medida_padrao: payload.unidade,
        aposentadoria_especial: payload.aposentadoria,
        observacoes_tecnicas: payload.observacoes || null,
        status,
        aprovado_por: status === "mapeado" ? user?.id ?? null : null,
        aprovado_em: status === "mapeado" ? new Date().toISOString() : null,
        created_by: user?.id ?? null,
      };
      const { error } = await (supabase.from as any)("esocial_s2240_mapeamentos")
        .upsert(row, { onConflict: "empresa_id,agente_nome" });
      if (error) throw error;

      // Audit log (sem binário, só metadados)
      try {
        await (supabase.from as any)("audit_log").insert({
          empresa_id: empresaId,
          tabela: "esocial_s2240_mapeamentos",
          acao: "upsert",
          dados_novos: {
            agente: payload.agente.nome,
            codigo_t24: payload.codigo_t24,
            status,
          },
        });
      } catch { /* audit não-fatal */ }
    },
    onSuccess: () => {
      toast({ title: "Mapeamento salvo" });
      qc.invalidateQueries({ queryKey: ["s2240-map", empresaId] });
      setEditing(null);
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  if (!canView) {
    return (
      <div className="p-6">
        <Alert><AlertDescription>Você não tem permissão para acessar o módulo eSocial S-2240.</AlertDescription></Alert>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">eSocial S-2240 — Mapeamento de Agentes Nocivos</h1>
        <p className="text-sm text-muted-foreground">
          Vincule cada agente usado em PPP/LTCAT ao código oficial da <strong>Tabela 24</strong> do eSocial.
        </p>
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertDescription className="text-xs">
            XML S-2240 gerado apenas para validação técnica · Não enviado ao Ambiente Nacional · Assinatura ICP-Brasil ainda não implementada · Certificado digital ainda não configurado.
          </AlertDescription>
        </Alert>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total de agentes" value={ind.total} />
        <KPI label="Mapeados" value={ind.mapeados} tone="ok" />
        <KPI label="Pendentes" value={ind.pendentes} tone="warn" />
        <KPI label="Divergentes" value={ind.divergentes} tone="err" />
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Por grupo</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {Object.entries(ind.porGrupo).length === 0 && (
            <span className="text-xs text-muted-foreground">Nenhum agente encontrado nesta empresa.</span>
          )}
          {Object.entries(ind.porGrupo).map(([g, n]) => (
            <Badge key={g} variant="outline" className="gap-1"><Tag className="size-3" />{g}: {n}</Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs">Buscar agente, código T24 ou descrição</Label>
            <div className="relative">
              <Search className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-7" value={busca} onChange={e => setBusca(e.target.value)} placeholder="ex: ruído, 02.01.001, benzeno" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="mapeado">Mapeado</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="divergente">Divergente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Grupo</Label>
            <Select value={filtroGrupo} onValueChange={setFiltroGrupo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {grupos.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Agentes ({linhasFiltradas.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agente (PPP/LTCAT)</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Código T24</TableHead>
                <TableHead>Descrição oficial</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhasFiltradas.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  Nenhum agente encontrado.
                </TableCell></TableRow>
              )}
              {linhasFiltradas.map(l => (
                <TableRow key={l.agente.nome}>
                  <TableCell className="font-medium">{l.agente.nome}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {l.agente.origem.map(o => <Badge key={o} variant="secondary" className="text-xs">{o}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{l.agente.grupo || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{l.map?.codigo_t24 || "—"}</TableCell>
                  <TableCell className="text-xs max-w-[260px]">
                    {l.t24row ? (
                      <div className="flex flex-col">
                        <span>{l.t24row.descricao}</span>
                        {l.t24row.origem !== "oficial" && (
                          <span className="text-amber-600 dark:text-amber-400 text-[10px]">
                            ⚠ código {l.t24row.origem === "referencial" ? "referencial" : "pendente de revisão"}
                          </span>
                        )}
                      </div>
                    ) : (l.map?.codigo_t24 ? <span className="text-rose-600">código não encontrado na T24</span> : "—")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_COLOR[l.status]}>
                      {l.status === "mapeado" && <CheckCircle2 className="size-3 mr-1" />}
                      {l.status === "pendente" && <AlertTriangle className="size-3 mr-1" />}
                      {l.status === "divergente" && <AlertTriangle className="size-3 mr-1" />}
                      {STATUS_LABEL[l.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" disabled={!canEdit}
                      onClick={() => setEditing({ agente: l.agente, map: l.map })}>
                      <Pencil className="size-3 mr-1" /> Mapear
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EditDialog
        editing={editing}
        onClose={() => setEditing(null)}
        t24={t24}
        onSave={(p) => upsert.mutate(p)}
        saving={upsert.isPending}
      />
    </div>
  );
}

function KPI({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" | "err" }) {
  const cls = tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : tone === "err" ? "text-rose-600" : "";
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${cls}`}>{value}</div>
    </CardContent></Card>
  );
}

function EditDialog({
  editing, onClose, t24, onSave, saving,
}: {
  editing: { agente: AgenteAggregado; map: Mapeamento | null } | null;
  onClose: () => void;
  t24: T24Row[];
  onSave: (p: { agente: AgenteAggregado; codigo_t24: string | null; observacoes: string; tipo_avaliacao: "quantitativa" | "qualitativa" | null; unidade: string | null; aposentadoria: boolean }) => void;
  saving: boolean;
}) {
  const [codigo, setCodigo] = useState("");
  const [obs, setObs] = useState("");
  const [tipo, setTipo] = useState<"quantitativa" | "qualitativa" | "">("");
  const [unidade, setUnidade] = useState("");
  const [apos, setApos] = useState(false);
  const [busca, setBusca] = useState("");

  // sync when opens
  useMemo(() => {
    if (editing) {
      setCodigo(editing.map?.codigo_t24 || "");
      setObs(editing.map?.observacoes_tecnicas || "");
      setTipo(editing.map?.tipo_avaliacao_esperado || "");
      setUnidade(editing.map?.unidade_medida_padrao || editing.agente.exemplos_unidade || "");
      setApos(editing.map?.aposentadoria_especial || false);
      setBusca("");
    }
  }, [editing]);

  const filteredT24 = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return t24.slice(0, 50);
    return t24.filter(x => x.codigo.toLowerCase().includes(q) || x.descricao.toLowerCase().includes(q)).slice(0, 80);
  }, [t24, busca]);

  const selecionado = t24.find(x => x.codigo === codigo);

  if (!editing) return null;

  return (
    <Dialog open={!!editing} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mapear agente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded border p-3 bg-muted/40">
            <div className="text-xs text-muted-foreground">Agente interno</div>
            <div className="font-medium">{editing.agente.nome}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Origens: {editing.agente.origem.join(", ") || "—"} · Grupo: {editing.agente.grupo || "—"}
              {editing.agente.ltcat_catalogo_id && " · vinculado ao catálogo LTCAT"}
            </div>
          </div>

          <div>
            <Label className="text-xs">Buscar na Tabela 24 oficial</Label>
            <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="código ou descrição" />
            <div className="mt-2 max-h-48 overflow-y-auto border rounded divide-y">
              {filteredT24.map(x => (
                <button type="button" key={x.codigo}
                  className={`w-full text-left px-2 py-1.5 text-xs hover:bg-muted ${codigo === x.codigo ? "bg-primary/10" : ""}`}
                  onClick={() => { setCodigo(x.codigo); setTipo(x.tipo_avaliacao || ""); setUnidade(x.unidade_medida_padrao || unidade); setApos(x.aposentadoria_especial); }}>
                  <span className="font-mono">{x.codigo}</span> · {x.descricao}
                  {x.origem !== "oficial" && <span className="text-amber-600 ml-2">({x.origem})</span>}
                </button>
              ))}
              {filteredT24.length === 0 && <div className="text-xs text-muted-foreground p-2">Nenhum código encontrado.</div>}
            </div>
          </div>

          {selecionado && selecionado.origem !== "oficial" && (
            <Alert>
              <AlertTriangle className="size-4" />
              <AlertDescription className="text-xs">
                Este código é <strong>{selecionado.origem === "referencial" ? "referencial" : "pendente de revisão"}</strong>. Confirme com a documentação oficial do eSocial antes de aprovar o mapeamento.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tipo de avaliação esperado</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quantitativa">Quantitativa</SelectItem>
                  <SelectItem value="qualitativa">Qualitativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Unidade de medida padrão</Label>
              <Input value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="ex: dB(A), mg/m³" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={apos} onChange={e => setApos(e.target.checked)} />
            Gera direito à aposentadoria especial
          </label>

          <div>
            <Label className="text-xs">Observações técnicas</Label>
            <Textarea value={obs} onChange={e => setObs(e.target.value)} rows={3} placeholder="justificativa, premissas adotadas, referências..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={saving}
            onClick={() => onSave({
              agente: editing.agente,
              codigo_t24: codigo || null,
              observacoes: obs,
              tipo_avaliacao: (tipo || null) as any,
              unidade: unidade || null,
              aposentadoria: apos,
            })}
          >Salvar mapeamento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
