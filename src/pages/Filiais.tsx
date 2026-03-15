import { useState, useEffect } from "react";
import { GitBranch, Plus, Trash2, Pencil, Users, UserPlus, X, Eye, EyeOff, Building2, Briefcase, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/hooks/usePermissions";

interface Filial {
  id: string;
  nome: string;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  tipo: string;
  empresa_pai_id: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  user_id: string;
  nome: string;
  email: string | null;
  empresa_id: string | null;
}

const TIPO_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  filial: { label: "Filial", icon: GitBranch, color: "bg-primary/10 text-primary" },
  obra: { label: "Obra", icon: Briefcase, color: "bg-amber-500/10 text-amber-700" },
  setor: { label: "Setor", icon: MapPin, color: "bg-emerald-500/10 text-emerald-700" },
};

export default function Filiais() {
  const { empresaId, isSuperAdmin, isPrincipal } = useAuth();
  const isAdmin = isSuperAdmin || isPrincipal;
  const { canCreate, canEdit, canDelete } = usePermissions("cadastro_empresas");
  const { toast } = useToast();
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [empresaNome, setEmpresaNome] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Filial | null>(null);
  const [form, setForm] = useState({ nome: "", cnpj: "", email: "", telefone: "", endereco: "", tipo: "filial" });

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignFilialId, setAssignFilialId] = useState<string | null>(null);
  const [assignEmail, setAssignEmail] = useState("");
  const [assignNome, setAssignNome] = useState("");
  const [assignSenha, setAssignSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (empresaId) loadData();
  }, [empresaId]);

  const loadData = async () => {
    setLoading(true);
    const [{ data: filData }, { data: profData }, { data: empData }] = await Promise.all([
      (supabase.from as any)("empresa_config").select("*").eq("empresa_pai_id", empresaId).order("nome"),
      isAdmin ? (supabase.from as any)("profiles").select("*") : { data: [] },
      (supabase.from as any)("empresa_config").select("nome").eq("id", empresaId).single(),
    ]);
    setFiliais(filData || []);
    setProfiles(profData || []);
    setEmpresaNome(empData?.nome || "");
    setLoading(false);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ nome: "", cnpj: "", email: "", telefone: "", endereco: "", tipo: "filial" });
    setDialogOpen(true);
  };

  const openEdit = (f: Filial) => {
    setEditing(f);
    setForm({
      nome: f.nome, cnpj: f.cnpj || "", email: f.email || "",
      telefone: f.telefone || "", endereco: f.endereco || "", tipo: f.tipo || "filial",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    const payload = {
      nome: form.nome, cnpj: form.cnpj || null, email: form.email || null,
      telefone: form.telefone || null, endereco: form.endereco || null,
      tipo: form.tipo, empresa_pai_id: empresaId,
    };
    if (editing) {
      const { error } = await (supabase.from as any)("empresa_config").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Atualizado com sucesso!" });
    } else {
      const { error } = await (supabase.from as any)("empresa_config").insert(payload);
      if (error) { toast({ title: "Erro ao criar", description: error.message, variant: "destructive" }); return; }
      toast({ title: `${TIPO_LABELS[form.tipo]?.label || "Item"} criado com sucesso!` });
    }
    setDialogOpen(false);
    await loadData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase.from as any)("empresa_config").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Excluído com sucesso" }); await loadData();
    }
  };

  const handleAssignUser = async () => {
    if (!assignEmail.trim() || !assignFilialId) return;
    const existingProfile = profiles.find(p => p.email?.toLowerCase() === assignEmail.trim().toLowerCase());
    if (existingProfile) {
      const { error } = await (supabase.from as any)("profiles").update({ empresa_id: assignFilialId }).eq("user_id", existingProfile.user_id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Usuário vinculado!" }); setAssignOpen(false); await loadData(); return;
    }
    if (!assignSenha.trim() || assignSenha.length < 6) {
      toast({ title: "Senha deve ter no mínimo 6 caracteres", variant: "destructive" }); return;
    }
    setAssigning(true);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("create-user", {
        body: { email: assignEmail.trim().toLowerCase(), password: assignSenha, nome: assignNome.trim() },
      });
      if (fnError || fnData?.error) { toast({ title: "Erro", description: fnData?.error || fnError?.message, variant: "destructive" }); setAssigning(false); return; }
      if (fnData?.user_id) {
        await (supabase.from as any)("profiles").update({ empresa_id: assignFilialId }).eq("user_id", fnData.user_id);
        await (supabase.from as any)("usuarios_liberados").insert({
          email: assignEmail.trim().toLowerCase(), nome: assignNome.trim(),
          modulos_permitidos: ["dashboard", "epis", "entregas", "relatorios", "cadastro_empresas", "cadastro_funcionarios", "cadastro_usuarios"],
          empresa_id: assignFilialId,
        });
      }
      toast({ title: "Usuário criado e vinculado!" });
      setAssignOpen(false); await loadData();
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "destructive" }); }
    setAssigning(false);
  };

  const getUsersForFilial = (id: string) => profiles.filter(p => p.empresa_id === id);

  if (!empresaId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Filiais / Obras / Setores</h1>
        <Card><CardContent className="py-8 text-center text-muted-foreground">Você não está vinculado a nenhuma empresa.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Filiais / Obras / Setores</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            Unidades vinculadas a <strong>{empresaNome}</strong>
          </p>
        </div>
        {(canCreate || isSuperAdmin) && (
          <Button onClick={openNew} className="text-xs sm:text-sm">
            <Plus className="w-4 h-4 mr-1 sm:mr-2" />Nova Unidade
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
      ) : filiais.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <GitBranch className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
            <p>Nenhuma filial, obra ou setor cadastrado.</p>
            <p className="text-xs mt-1">Clique em "Nova Unidade" para criar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filiais.map(f => {
            const tipoInfo = TIPO_LABELS[f.tipo] || TIPO_LABELS.filial;
            const TipoIcon = tipoInfo.icon;
            const users = getUsersForFilial(f.id);
            return (
              <Card key={f.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tipoInfo.color}`}>
                        <TipoIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{f.nome}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{tipoInfo.label}</Badge>
                          {f.cnpj && <span className="text-xs text-muted-foreground">CNPJ: {f.cnpj}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {isSuperAdmin && (
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setAssignFilialId(f.id); setAssignEmail(""); setAssignNome(""); setAssignSenha(""); setAssignOpen(true); }}>
                          <UserPlus className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {(canEdit || isSuperAdmin) && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(f)}><Pencil className="w-3.5 h-3.5" /></Button>}
                      {(canDelete || isSuperAdmin) && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(f.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>}
                    </div>
                  </div>

                  {/* Info row */}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {f.endereco && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{f.endereco}</span>}
                    {f.telefone && <span>{f.telefone}</span>}
                    {f.email && <span>{f.email}</span>}
                  </div>

                  {/* Users (super admin only) */}
                  {isSuperAdmin && users.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {users.map(u => (
                        <Badge key={u.id} variant="secondary" className="text-[10px] py-0.5 px-2">
                          {u.nome || u.email || "—"}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* New/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Unidade" : "Nova Unidade"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="filial"><span className="flex items-center gap-2"><GitBranch className="w-3.5 h-3.5" /> Filial</span></SelectItem>
                  <SelectItem value="obra"><span className="flex items-center gap-2"><Briefcase className="w-3.5 h-3.5" /> Obra</span></SelectItem>
                  <SelectItem value="setor"><span className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> Setor</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder={`Ex: ${empresaNome} - Filial Mossoró`} /></div>
            <div><Label>CNPJ (opcional)</Label><Input value={form.cnpj} onChange={e => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" /></div>
            <div><Label>Endereço</Label><Input value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} placeholder="Endereço completo" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Telefone</Label><Input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" /></div>
              <div><Label>E-mail</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="contato@filial.com" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave}>{editing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign User Dialog (super admin) */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Vincular Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Se o e-mail já existir, será vinculado. Caso contrário, uma nova conta será criada.</p>
            <div><Label>Nome</Label><Input value={assignNome} onChange={e => setAssignNome(e.target.value)} placeholder="Nome" /></div>
            <div><Label>E-mail</Label><Input type="email" value={assignEmail} onChange={e => setAssignEmail(e.target.value)} placeholder="usuario@email.com" /></div>
            <div>
              <Label>Senha (novo usuário)</Label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} value={assignSenha} onChange={e => setAssignSenha(e.target.value)} placeholder="Mín. 6 caracteres" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAssignUser} disabled={!assignEmail.trim() || assigning}>{assigning ? "Criando..." : "Vincular"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
