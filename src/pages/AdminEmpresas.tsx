import { useState, useEffect } from "react";
import { Building2, Plus, Trash2, Users, UserPlus, X, Eye, EyeOff, GitBranch, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Navigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Empresa {
  id: string;
  nome: string;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
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

interface UsuarioLiberado {
  id: string;
  email: string;
  is_principal: boolean;
  empresa_id: string | null;
}

export default function AdminEmpresas() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [usuariosLiberados, setUsuariosLiberados] = useState<UsuarioLiberado[]>([]);
  const [loading, setLoading] = useState(true);

  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ nome: "", cnpj: "", email: "", telefone: "", empresa_pai_id: "" });
  const [saving, setSaving] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignEmpresaId, setAssignEmpresaId] = useState<string | null>(null);
  const [assignEmail, setAssignEmail] = useState("");
  const [assignNome, setAssignNome] = useState("");
  const [assignSenha, setAssignSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) loadData();
  }, [isSuperAdmin]);

  const loadData = async () => {
    setLoading(true);
    const [{ data: empData }, { data: profData }, { data: ulData }] = await Promise.all([
      (supabase.from as any)("empresa_config").select("*").order("created_at", { ascending: false }),
      (supabase.from as any)("profiles").select("*"),
      (supabase.from as any)("usuarios_liberados").select("id, email, is_principal, empresa_id"),
    ]);
    setEmpresas(empData || []);
    setProfiles(profData || []);
    setUsuariosLiberados(ulData || []);
    setLoading(false);
  };

  if (authLoading) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

    const parentEmpresas = empresas.filter(e => !e.empresa_pai_id);
    const getFiliais = (parentId: string) => empresas.filter(e => e.empresa_pai_id === parentId);
  const getUsersForEmpresa = (empresaId: string) => profiles.filter(p => p.empresa_id === empresaId);

  const handleCreateEmpresa = async () => {
    if (!newForm.nome.trim()) return;
    setSaving(true);
    const { error } = await (supabase.from as any)("empresa_config").insert({
      nome: newForm.nome,
      cnpj: newForm.cnpj || null,
      email: newForm.email || null,
      telefone: newForm.telefone || null,
      empresa_pai_id: newForm.empresa_pai_id || null,
    });
    if (error) {
      toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: newForm.empresa_pai_id ? "Filial criada com sucesso!" : "Empresa criada com sucesso!" });
      setNewOpen(false);
      setNewForm({ nome: "", cnpj: "", email: "", telefone: "", empresa_pai_id: "" });
      await loadData();
    }
    setSaving(false);
  };

  const handleDeleteEmpresa = async (id: string) => {
    const filiais = getFiliais(id);
    if (filiais.length > 0) {
      toast({ title: "Não é possível excluir", description: "Remova as filiais antes de excluir a empresa mãe.", variant: "destructive" });
      return;
    }
    const { error } = await (supabase.from as any)("empresa_config").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Excluído com sucesso" });
      await loadData();
    }
  };

  const handleAssignUser = async () => {
    if (!assignEmail.trim() || !assignEmpresaId) return;
    const emailLower = assignEmail.trim().toLowerCase();
    const nome = assignNome.trim();
    const allModules = ["dashboard", "epis", "entregas", "relatorios", "cadastro_empresas", "cadastro_funcionarios", "cadastro_usuarios"];

    // Helper: ensure user is in usuarios_liberados
    const ensureUsuarioLiberado = async (empresaId: string) => {
      const { data: existing } = await (supabase.from as any)("usuarios_liberados")
        .select("id")
        .eq("email", emailLower)
        .limit(1);
      if (!existing || existing.length === 0) {
        await (supabase.from as any)("usuarios_liberados").insert({
          email: emailLower, nome, modulos_permitidos: allModules, empresa_id: empresaId,
        });
      } else {
        // Update empresa_id if needed
        await (supabase.from as any)("usuarios_liberados")
          .update({ empresa_id: empresaId })
          .eq("email", emailLower);
      }
    };

    const existingProfile = profiles.find(p => p.email?.toLowerCase() === emailLower);
    if (existingProfile) {
      const { error } = await (supabase.from as any)("profiles").update({ empresa_id: assignEmpresaId }).eq("user_id", existingProfile.user_id);
      if (error) {
        toast({ title: "Erro ao vincular", description: error.message, variant: "destructive" });
      } else {
        await ensureUsuarioLiberado(assignEmpresaId);
        toast({ title: `Usuário ${existingProfile.nome || existingProfile.email} vinculado e autorizado!` });
        setAssignOpen(false); setAssignEmail(""); setAssignNome(""); setAssignSenha("");
        await loadData();
      }
      return;
    }
    if (!assignSenha.trim()) { toast({ title: "Informe uma senha para criar o novo usuário", variant: "destructive" }); return; }
    if (assignSenha.length < 6) { toast({ title: "Senha deve ter no mínimo 6 caracteres", variant: "destructive" }); return; }
    setAssigning(true);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("create-user", {
        body: { email: emailLower, password: assignSenha, nome },
      });
      if (fnError || (fnData?.error && !fnData?.already_exists)) {
        toast({ title: "Erro ao criar conta", description: fnData?.error || fnError?.message, variant: "destructive" });
        setAssigning(false); return;
      }
      if (fnData?.user_id) {
        await (supabase.from as any)("profiles").update({ empresa_id: assignEmpresaId }).eq("user_id", fnData.user_id);
        await ensureUsuarioLiberado(assignEmpresaId);
      }
      toast({ title: fnData?.already_exists ? "Usuário existente vinculado e autorizado!" : "Usuário criado e vinculado com sucesso!" });
      setAssignOpen(false); setAssignEmail(""); setAssignNome(""); setAssignSenha("");
      await loadData();
    } catch (err: any) {
      toast({ title: "Erro inesperado", description: err.message, variant: "destructive" });
    }
    setAssigning(false);
  };

  const handleUnassignUser = async (userId: string) => {
    const { error } = await (supabase.from as any)("profiles").update({ empresa_id: null }).eq("user_id", userId);
    if (error) {
      toast({ title: "Erro ao desvincular", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Usuário desvinculado" }); await loadData();
    }
  };

  const openNewEmpresa = (parentId?: string) => {
    setNewForm({ nome: "", cnpj: "", email: "", telefone: "", empresa_pai_id: parentId || "" });
    setNewOpen(true);
  };

  const isUserPrincipal = (email: string | null) => {
    if (!email) return false;
    return usuariosLiberados.some(ul => ul.email.toLowerCase() === email.toLowerCase() && ul.is_principal);
  };

  const handleTogglePrincipal = async (profile: Profile) => {
    if (!profile.email) return;
    const emailLower = profile.email.toLowerCase();
    const ul = usuariosLiberados.find(u => u.email.toLowerCase() === emailLower);
    const newVal = !ul?.is_principal;

    if (ul) {
      const { error } = await (supabase.from as any)("usuarios_liberados").update({ is_principal: newVal }).eq("id", ul.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    } else {
      // Create entry in usuarios_liberados
      const { error } = await (supabase.from as any)("usuarios_liberados").insert({
        email: emailLower, nome: profile.nome, is_principal: true,
        modulos_permitidos: [], empresa_id: profile.empresa_id,
      });
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    }
    toast({ title: newVal ? "✅ Usuário definido como Principal!" : "Principal removido" });
    await loadData();
  };

  const renderUsers = (empresaId: string) => {
    const users = getUsersForEmpresa(empresaId);
    if (users.length === 0) return <p className="text-sm text-muted-foreground">Nenhum usuário vinculado</p>;
    return (
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Usuários:</p>
        <div className="flex flex-wrap gap-2">
          {users.map(u => {
            const principal = isUserPrincipal(u.email);
            return (
              <Badge key={u.id} variant={principal ? "default" : "secondary"} className="flex items-center gap-1.5 py-1 px-3">
                {principal && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                <span>{u.nome || u.email || "—"}</span>
                {u.email && <span className="text-xs opacity-70">({u.email})</span>}
                <button
                  onClick={() => handleTogglePrincipal(u)}
                  className="ml-1 hover:text-amber-500"
                  title={principal ? "Remover Principal" : "Definir como Principal"}
                >
                  <Crown className={`w-3 h-3 ${principal ? "text-amber-400" : "opacity-40"}`} />
                </button>
                <button onClick={() => handleUnassignUser(u.user_id)} className="ml-0.5 hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Administração de Empresas</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerenciar empresas, filiais e vincular usuários</p>
        </div>
        <Button onClick={() => openNewEmpresa()}>
          <Plus className="w-4 h-4 mr-2" />Nova Empresa
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
      ) : parentEmpresas.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma empresa cadastrada.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {parentEmpresas.map(emp => {
            const filiais = getFiliais(emp.id);
            return (
              <Card key={emp.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      {emp.nome}
                      {emp.cnpj && <span className="text-xs text-muted-foreground font-normal ml-2">CNPJ: {emp.cnpj}</span>}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openNewEmpresa(emp.id)}>
                        <GitBranch className="w-3.5 h-3.5 mr-1" />Nova Filial
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setAssignEmpresaId(emp.id); setAssignEmail(""); setAssignNome(""); setAssignSenha(""); setAssignOpen(true); }}>
                        <UserPlus className="w-3.5 h-3.5 mr-1" />Vincular Usuário
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDeleteEmpresa(emp.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {renderUsers(emp.id)}

                  {/* Filiais */}
                  {filiais.length > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <GitBranch className="w-3.5 h-3.5" /> Filiais ({filiais.length})
                      </p>
                      {filiais.map(filial => (
                        <div key={filial.id} className="ml-4 border rounded-lg p-3 bg-muted/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="font-medium text-sm">{filial.nome}</span>
                              {filial.cnpj && <span className="text-xs text-muted-foreground">CNPJ: {filial.cnpj}</span>}
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAssignEmpresaId(filial.id); setAssignEmail(""); setAssignNome(""); setAssignSenha(""); setAssignOpen(true); }}>
                                <UserPlus className="w-3 h-3 mr-1" />Vincular
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDeleteEmpresa(filial.id)}>
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                          {renderUsers(filial.id)}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Company/Branch Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{newForm.empresa_pai_id ? "Nova Filial" : "Nova Empresa"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {!newForm.empresa_pai_id && (
              <div>
                <Label>Vincular como filial de (opcional)</Label>
                <Select value={newForm.empresa_pai_id} onValueChange={v => setNewForm({ ...newForm, empresa_pai_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhuma (empresa independente)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma (empresa independente)</SelectItem>
                    {parentEmpresas.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {newForm.empresa_pai_id && (
              <div className="bg-muted/50 rounded-md px-3 py-2 text-sm flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-muted-foreground" />
                <span>Filial de: <strong>{empresas.find(e => e.id === newForm.empresa_pai_id)?.nome}</strong></span>
              </div>
            )}
            <div><Label>Nome</Label><Input value={newForm.nome} onChange={e => setNewForm({ ...newForm, nome: e.target.value })} placeholder={newForm.empresa_pai_id ? "Ex: Empresa X - Filial Mossoró" : "Nome completo"} /></div>
            <div><Label>CNPJ</Label><Input value={newForm.cnpj} onChange={e => setNewForm({ ...newForm, cnpj: e.target.value })} placeholder="00.000.000/0000-00" /></div>
            <div><Label>E-mail</Label><Input type="email" value={newForm.email} onChange={e => setNewForm({ ...newForm, email: e.target.value })} placeholder="contato@empresa.com" /></div>
            <div><Label>Telefone</Label><Input value={newForm.telefone} onChange={e => setNewForm({ ...newForm, telefone: e.target.value })} placeholder="(00) 00000-0000" /></div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateEmpresa} disabled={saving}>{saving ? "Criando..." : newForm.empresa_pai_id ? "Criar Filial" : "Criar Empresa"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign User Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Criar / Vincular Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Se o e-mail já existir, o usuário será vinculado. Caso contrário, uma nova conta será criada.
            </p>
            <div><Label>Nome</Label><Input value={assignNome} onChange={e => setAssignNome(e.target.value)} placeholder="Nome do usuário" /></div>
            <div><Label>E-mail</Label><Input type="email" value={assignEmail} onChange={e => setAssignEmail(e.target.value)} placeholder="usuario@email.com" /></div>
            <div>
              <Label>Senha (para novo usuário)</Label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} value={assignSenha} onChange={e => setAssignSenha(e.target.value)} placeholder="Mín. 6 caracteres" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAssignUser} disabled={!assignEmail.trim() || assigning}>
              {assigning ? "Criando..." : "Criar e Vincular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
