import { useState, useEffect } from "react";
import { Building2, Plus, Trash2, Users, UserPlus, Eye, EyeOff, GitBranch, Crown, Pencil, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Navigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  // Filters
  const [filterEmpresa, setFilterEmpresa] = useState("");
  const [filterUsuario, setFilterUsuario] = useState("");

  // New company dialog
  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ nome: "", cnpj: "", email: "", telefone: "", empresa_pai_id: "" });
  const [saving, setSaving] = useState(false);

  // Assign user dialog
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

  const filteredEmpresas = parentEmpresas.filter(e =>
    !filterEmpresa || e.nome.toLowerCase().includes(filterEmpresa.toLowerCase()) || (e.cnpj || "").includes(filterEmpresa)
  );

  const allUsers = profiles.filter(p => p.empresa_id);
  const filteredUsers = allUsers.filter(u => {
    if (!filterUsuario) return true;
    const term = filterUsuario.toLowerCase();
    return (u.nome || "").toLowerCase().includes(term) || (u.email || "").toLowerCase().includes(term);
  });

  const getEmpresaNome = (empId: string | null) => {
    if (!empId) return "—";
    return empresas.find(e => e.id === empId)?.nome || "—";
  };

  const isUserPrincipal = (email: string | null) => {
    if (!email) return false;
    return usuariosLiberados.some(ul => ul.email.toLowerCase() === email.toLowerCase() && ul.is_principal);
  };

  const handleCreateEmpresa = async () => {
    if (!newForm.nome.trim()) return;
    setSaving(true);
    const { error } = await (supabase.from as any)("empresa_config").insert({
      nome: newForm.nome, cnpj: newForm.cnpj || null, email: newForm.email || null,
      telefone: newForm.telefone || null, empresa_pai_id: newForm.empresa_pai_id || null,
    });
    if (error) {
      toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: newForm.empresa_pai_id ? "Filial criada!" : "Empresa criada!" });
      setNewOpen(false);
      setNewForm({ nome: "", cnpj: "", email: "", telefone: "", empresa_pai_id: "" });
      await loadData();
    }
    setSaving(false);
  };

  const handleDeleteEmpresa = async (id: string) => {
    const filiais = getFiliais(id);
    if (filiais.length > 0) {
      toast({ title: "Não é possível excluir", description: "Remova as filiais antes.", variant: "destructive" });
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

    const ensureUsuarioLiberado = async (empresaId: string) => {
      const { data: existing } = await (supabase.from as any)("usuarios_liberados").select("id").eq("email", emailLower).limit(1);
      if (!existing || existing.length === 0) {
        await (supabase.from as any)("usuarios_liberados").insert({ email: emailLower, nome, modulos_permitidos: allModules, empresa_id: empresaId });
      } else {
        await (supabase.from as any)("usuarios_liberados").update({ empresa_id: empresaId }).eq("email", emailLower);
      }
    };

    const existingProfile = profiles.find(p => p.email?.toLowerCase() === emailLower);
    if (existingProfile) {
      const { error } = await (supabase.from as any)("profiles").update({ empresa_id: assignEmpresaId }).eq("user_id", existingProfile.user_id);
      if (error) {
        toast({ title: "Erro ao vincular", description: error.message, variant: "destructive" });
      } else {
        await ensureUsuarioLiberado(assignEmpresaId);
        toast({ title: `Usuário ${existingProfile.nome || existingProfile.email} vinculado!` });
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
      toast({ title: fnData?.already_exists ? "Usuário existente vinculado!" : "Usuário criado e vinculado!" });
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

  const handleTogglePrincipal = async (profile: Profile) => {
    if (!profile.email) return;
    const emailLower = profile.email.toLowerCase();
    const ul = usuariosLiberados.find(u => u.email.toLowerCase() === emailLower);
    const newVal = !ul?.is_principal;

    if (ul) {
      const { error } = await (supabase.from as any)("usuarios_liberados").update({ is_principal: newVal }).eq("id", ul.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await (supabase.from as any)("usuarios_liberados").insert({
        email: emailLower, nome: profile.nome, is_principal: true, modulos_permitidos: [], empresa_id: profile.empresa_id,
      });
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    }
    toast({ title: newVal ? "✅ Usuário definido como Principal!" : "Principal removido" });
    await loadData();
  };

  const openNewEmpresa = (parentId?: string) => {
    setNewForm({ nome: "", cnpj: "", email: "", telefone: "", empresa_pai_id: parentId || "" });
    setNewOpen(true);
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
      ) : (
        <Tabs defaultValue="empresas">
          <TabsList>
            <TabsTrigger value="empresas" className="gap-2">
              <Building2 className="w-4 h-4" />
              Empresas ({parentEmpresas.length})
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="gap-2">
              <Users className="w-4 h-4" />
              Todos os Usuários ({allUsers.length})
            </TabsTrigger>
          </TabsList>

          {/* Empresas Tab */}
          <TabsContent value="empresas" className="space-y-4 mt-4">
            <Input
              placeholder="Filtrar por nome ou CNPJ..."
              value={filterEmpresa}
              onChange={e => setFilterEmpresa(e.target.value)}
              className="max-w-sm"
            />

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Empresa</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Filiais</TableHead>
                      <TableHead>Usuários</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmpresas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma empresa encontrada.</TableCell>
                      </TableRow>
                    ) : (
                      filteredEmpresas.map(emp => {
                        const filiais = getFiliais(emp.id);
                        const users = getUsersForEmpresa(emp.id);
                        const totalUsers = users.length + filiais.reduce((sum, f) => sum + getUsersForEmpresa(f.id).length, 0);

                        return (
                          <TableRow key={emp.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                                <span className="font-medium">{emp.nome}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{emp.cnpj || "—"}</TableCell>
                            <TableCell>
                              {filiais.length > 0 ? (
                                <Badge variant="secondary" className="gap-1">
                                  <GitBranch className="w-3 h-3" />{filiais.length}
                                </Badge>
                              ) : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="gap-1">
                                <Users className="w-3 h-3" />{totalUsers}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openNewEmpresa(emp.id)}>
                                  <GitBranch className="w-3 h-3 mr-1" />Filial
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAssignEmpresaId(emp.id); setAssignEmail(""); setAssignNome(""); setAssignSenha(""); setAssignOpen(true); }}>
                                  <UserPlus className="w-3 h-3 mr-1" />Vincular
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDeleteEmpresa(emp.id)}>
                                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Filiais detail below */}
            {filteredEmpresas.filter(e => getFiliais(e.id).length > 0).map(emp => (
              <Card key={emp.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <GitBranch className="w-4 h-4 text-primary" />
                    Filiais de {emp.nome}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Filial</TableHead>
                        <TableHead>CNPJ</TableHead>
                        <TableHead>Usuários</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getFiliais(emp.id).map(filial => {
                        const fUsers = getUsersForEmpresa(filial.id);
                        return (
                          <TableRow key={filial.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="font-medium text-sm">{filial.nome}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{filial.cnpj || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="gap-1"><Users className="w-3 h-3" />{fUsers.length}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAssignEmpresaId(filial.id); setAssignEmail(""); setAssignNome(""); setAssignSenha(""); setAssignOpen(true); }}>
                                  <UserPlus className="w-3 h-3 mr-1" />Vincular
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDeleteEmpresa(filial.id)}>
                                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Usuarios Tab */}
          <TabsContent value="usuarios" className="space-y-4 mt-4">
            <Input
              placeholder="Filtrar por nome ou e-mail..."
              value={filterUsuario}
              onChange={e => setFilterUsuario(e.target.value)}
              className="max-w-sm"
            />

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>E-mail</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado.</TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map(u => {
                        const principal = isUserPrincipal(u.email);
                        return (
                          <TableRow key={u.id}>
                            <TableCell className="font-mono text-sm">
                              <div className="flex items-center gap-2">
                                {principal && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                                {u.email || "—"}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium uppercase">
                              {u.nome || "—"}
                              {principal && (
                                <Badge variant="outline" className="ml-2 text-[10px] py-0 px-1.5 text-amber-600 border-amber-300">Principal</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">{getEmpresaNome(u.empresa_id)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => handleTogglePrincipal(u)}>
                                  <Crown className={`w-3 h-3 ${principal ? "text-amber-500" : ""}`} />
                                  {principal ? "Remover" : "Principal"}
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive gap-1" onClick={() => handleUnassignUser(u.user_id)}>
                                  <Trash2 className="w-3 h-3" />
                                  Desvincular
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
