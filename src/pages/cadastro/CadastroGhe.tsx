import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Power, ClipboardList, Search, Briefcase, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { ListSkeleton } from "@/components/ui/list-skeleton";

export default function CadastroGhe() {
  const { empresaId, empresasIds, isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [empresaSel, setEmpresaSel] = useState<string>(empresaId || "");
  const [busca, setBusca] = useState("");
  const [openQuick, setOpenQuick] = useState(false);

  useEffect(() => {
    if (empresaId) setEmpresaSel(empresaId);
  }, [empresaId]);

  const irParaEstrutura = (id: string) => navigate(`/cadastro/ghe/${id}/estrutura`);

  const { data: empresas = [] } = useQuery({
    queryKey: ["cad-ghe-empresas", isSuperAdmin ? "all" : empresasIds.join(",")],
    queryFn: async () => {
      let q = (supabase.from as any)("empresa_config").select("id, nome").order("nome");
      if (!isSuperAdmin && empresasIds.length > 0) q = q.in("id", empresasIds);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: ghes = [], isLoading } = useQuery({
    queryKey: ["cad-ghe-list", empresaSel],
    enabled: !!empresaSel,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ghe_ges")
        .select("*, ghe_funcoes(nome_funcao), ghe_riscos(id), ghe_setores(nome)")
        .eq("empresa_id", empresaSel)
        .order("codigo");
      if (error) throw error;
      return (data || []).map((g: any) => {
        const setoresTab = (g.ghe_setores || []).map((s: any) => s.nome).filter(Boolean);
        const setoresLegacy = (g.setores && g.setores.length ? g.setores : (g.setor ? [g.setor] : [])) as string[];
        return {
          ...g,
          funcoesList: (g.ghe_funcoes || []).map((f: any) => f.nome_funcao).filter(Boolean).sort(),
          nFuncoes: (g.ghe_funcoes || []).length,
          nRiscos: (g.ghe_riscos || []).length,
          setoresList: setoresTab.length ? setoresTab.sort() : setoresLegacy,
          ambienteDisplay: g.ambiente?.trim()
            || (g.descricao_ambiente?.trim() ? (g.descricao_ambiente.trim().slice(0, 80) + (g.descricao_ambiente.length > 80 ? "…" : "")) : ""),
        };
      });
    },
  });

  const filtrados = ghes.filter((g: any) => {
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    return (
      g.codigo?.toLowerCase().includes(q) ||
      g.nome?.toLowerCase().includes(q) ||
      g.ambiente?.toLowerCase().includes(q) ||
      (g.setoresList || []).some((s: string) => s.toLowerCase().includes(q))
    );
  });

  const alternarStatus = async (g: any) => {
    const novoStatus = g.status === "ativo" ? "inativo" : "ativo";
    const { error } = await supabase.from("ghe_ges").update({ status: novoStatus }).eq("id", g.id);
    if (error) return toast.error(error.message);
    toast.success(`GES ${novoStatus === "ativo" ? "ativado" : "inativado"}`);
    qc.invalidateQueries({ queryKey: ["cad-ghe-list"] });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="GES"
        subtitle="Cadastro dos grupos homogêneos de exposição — ambiente, setores, funções, riscos e controles."
        actions={
          <>
            <Select value={empresaSel} onValueChange={setEmpresaSel}>
              <SelectTrigger className="w-full sm:w-[240px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
              <SelectContent>{empresas.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={() => setOpenQuick(true)} disabled={!empresaSel}><Plus className="h-4 w-4 mr-1" />Novo GES</Button>
          </>
        }
      />

      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por código, nome, ambiente ou setor…" className="pl-8" />
          </div>
          {isLoading && <ListSkeleton rows={4} variant="row" />}
          {!isLoading && filtrados.length === 0 && (
            <EmptyState
              icon={ClipboardList}
              title={busca ? "Nenhum resultado" : "Nenhum GES cadastrado"}
              description={busca ? "Ajuste a busca para ver mais resultados." : "Cadastre os grupos para organizar ambientes, setores, funções e exposições ocupacionais."}
              action={!busca && empresaSel ? (
                <Button onClick={() => setOpenQuick(true)}><Plus className="h-4 w-4 mr-1" />Novo GES</Button>
              ) : undefined}
              bare
            />
          )}
          {filtrados.length > 0 && (
            <div className="border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Código</TableHead>
                    <TableHead className="w-[200px]">Ambiente</TableHead>
                    <TableHead className="w-[180px]">Setores</TableHead>
                    <TableHead>Funções / Riscos</TableHead>
                    <TableHead className="w-[80px]">Status</TableHead>
                    <TableHead className="w-[160px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((g: any) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium align-top">{g.codigo}</TableCell>
                      <TableCell className="align-top text-sm">{g.ambienteDisplay || "—"}</TableCell>
                      <TableCell className="align-top">
                        {(g.setoresList || []).length ? (
                          <div className="flex flex-wrap gap-1">
                            {g.setoresList.map((s: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                            ))}
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline"><Briefcase className="h-3 w-3 mr-1" />{g.nFuncoes} funç.</Badge>
                          <Badge variant="outline"><ShieldAlert className="h-3 w-3 mr-1" />{g.nRiscos} risco(s)</Badge>
                        </div>
                        {g.funcoesList?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {g.funcoesList.slice(0, 6).map((nf: string, i: number) => (
                              <Badge key={i} variant="secondary" className="font-normal text-xs">{nf}</Badge>
                            ))}
                            {g.funcoesList.length > 6 && <span className="text-xs text-muted-foreground">+{g.funcoesList.length - 6}</span>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <StatusBadge tone={g.status === "ativo" ? "success" : "neutral"} size="sm">
                          {g.status === "ativo" ? "Ativo" : "Inativo"}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-right align-top space-x-1">
                        <Button size="sm" onClick={() => irParaEstrutura(g.id)} title="Editar estrutura do GES">
                          <Pencil className="h-4 w-4 mr-1" />Estrutura
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => alternarStatus(g)} title={g.status === "ativo" ? "Inativar" : "Ativar"}>
                          <Power className={`h-4 w-4 ${g.status === "ativo" ? "text-destructive" : "text-primary"}`} />
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

      <QuickCreateGheDialog
        open={openQuick}
        onOpenChange={setOpenQuick}
        empresaId={empresaSel}
        onCreated={async (id) => {
          setOpenQuick(false);
          await qc.invalidateQueries({ queryKey: ["cad-ghe-list"] });
          irParaEstrutura(id);
        }}
      />
    </div>
  );
}

/* ---------------- Quick create (código + nome) — abre Estrutura em seguida ---------------- */
function QuickCreateGheDialog({
  open, onOpenChange, empresaId, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresaId: string;
  onCreated: (id: string) => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [saving, setSaving] = useState(false);

  const salvar = async () => {
    if (!codigo.trim()) return toast.error("Código é obrigatório");
    setSaving(true);
    const { data, error } = await supabase
      .from("ghe_ges")
      .insert({
        empresa_id: empresaId,
        codigo: codigo.trim(),
        nome: codigo.trim(),
        status: "ativo",
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("GES criado — complete a estrutura");
    setCodigo("");
    onCreated(data!.id);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setCodigo(""); } onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo GES</DialogTitle>
          <p className="text-xs text-muted-foreground">Informe apenas o código. Você completa Ambiente, Setores, Funções, Riscos, EPIs e Medidas na tela seguinte.</p>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Código do GES *</Label>
            <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="GES 01" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>Criar e abrir estrutura</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
