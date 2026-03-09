import { useState, useEffect } from "react";
import { Building2, Plus, Trash2, Users, UserPlus, X, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Navigate } from "react-router-dom";

interface Empresa {
  id: string;
  nome: string;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  user_id: string;
  nome: string;
  email: string | null;
  empresa_id: string | null;
}

export default function AdminEmpresas() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // New company dialog
  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ nome: "", cnpj: "", email: "", telefone: "" });
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
    const [{ data: empData }, { data: profData }] = await Promise.all([
      (supabase.from as any)("empresa_config").select("*").order("created_at", { ascending: false }),
      (supabase.from as any)("profiles").select("*"),
    ]);
    setEmpresas(empData || []);
    setProfiles(profData || []);
    setLoading(false);
  };

  if (authLoading) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleCreateEmpresa = async () => {
    if (!newForm.nome.trim()) return;
    setSaving(true);
    const { error } = await (supabase.from as any)("empresa_config").insert({
      nome: newForm.nome,
      cnpj: newForm.cnpj || null,
      email: newForm.email || null,
      telefone: newForm.telefone || null,
    });
    if (error) {
      toast({ title: "Erro ao criar empresa", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Empresa criada com sucesso!" });
      setNewOpen(false);
      setNewForm({ nome: "", cnpj: "", email: "", telefone: "" });
      await loadData();
    }
    setSaving(false);
  };

  const handleDeleteEmpresa = async (id: string) => {
    const { error } = await (supabase.from as any)("empresa_config").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Empresa excluída" });
      await loadData();
    }
  };

  const handleAssignUser = async () => {
    if (!assignEmail.trim() || !assignEmpresaId) return;

    // Check if user already exists
    const existingProfile = profiles.find(p => p.email?.toLowerCase() === assignEmail.trim().toLowerCase());

    if (existingProfile) {
      // Just link to empresa
      const { error } = await (supabase.from as any)("profiles")
        .update({ empresa_id: assignEmpresaId })
        .eq("user_id", existingProfile.user_id);
      if (error) {
        toast({ title: "Erro ao vincular", description: error.message, variant: "destructive" });
      } else {
        toast({ title: `Usuário ${existingProfile.nome || existingProfile.email} vinculado com sucesso!` });
        setAssignOpen(false);
        setAssignEmail("");
        setAssignNome("");
        setAssignSenha("");
        await loadData();
      }
      return;
    }

    // Create new user
    if (!assignSenha.trim()) {
      toast({ title: "Informe uma senha para criar o novo usuário", variant: "destructive" });
      return;
    }
    if (assignSenha.length < 6) {
      toast({ title: "Senha deve ter no mínimo 6 caracteres", variant: "destructive" });
      return;
    }

    setAssigning(true);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("create-user", {
        body: {
          email: assignEmail.trim().toLowerCase(),
          password: assignSenha,
          nome: assignNome.trim(),
        },
      });

      if (fnError || fnData?.error) {
        toast({ title: "Erro ao criar conta", description: fnData?.error || fnError?.message, variant: "destructive" });
        setAssigning(false);
        return;
      }

      // Update profile with empresa_id
      if (fnData?.user_id) {
        await (supabase.from as any)("profiles")
          .update({ empresa_id: assignEmpresaId })
          .eq("user_id", fnData.user_id);

        // Also add to usuarios_liberados with all modules
        const allModules = ["dashboard", "epis", "entregas", "relatorios", "cadastro_empresas", "cadastro_funcionarios", "cadastro_usuarios"];
        await (supabase.from as any)("usuarios_liberados").insert({
          email: assignEmail.trim().toLowerCase(),
          nome: assignNome.trim(),
          modulos_permitidos: allModules,
          empresa_id: assignEmpresaId,
        });
      }

      toast({ title: "Usuário criado e vinculado com sucesso!" });
      setAssignOpen(false);
      setAssignEmail("");
      setAssignNome("");
      setAssignSenha("");
      await loadData();
    } catch (err: any) {
      toast({ title: "Erro inesperado", description: err.message, variant: "destructive" });
    }
    setAssigning(false);
  };

  const handleUnassignUser = async (userId: string) => {
    const { error } = await (supabase.from as any)("profiles")
      .update({ empresa_id: null })
      .eq("user_id", userId);
    if (error) {
      toast({ title: "Erro ao desvincular", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Usuário desvinculado" });
      await loadData();
    }
  };

  const getUsersForEmpresa = (empresaId: string) => 
    profiles.filter(p => p.empresa_id === empresaId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Administração de Empresas</h1>
          <p className="text-muted-foreground text-sm mt-1">Criar empresas e vincular usuários (Super Admin)</p>
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />Nova Empresa
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
      ) : empresas.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhuma empresa cadastrada. Clique em "Nova Empresa" para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {empresas.map(emp => {
            const users = getUsersForEmpresa(emp.id);
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
                      <Button size="sm" variant="outline" onClick={() => { setAssignEmpresaId(emp.id); setAssignEmail(""); setAssignOpen(true); }}>
                        <UserPlus className="w-3.5 h-3.5 mr-1" />Vincular Usuário
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDeleteEmpresa(emp.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {users.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum usuário vinculado</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Usuários vinculados:</p>
                      <div className="flex flex-wrap gap-2">
                        {users.map(u => (
                          <Badge key={u.id} variant="secondary" className="flex items-center gap-1.5 py-1 px-3">
                            <span>{u.nome || u.email || "—"}</span>
                            {u.email && <span className="text-muted-foreground text-xs">({u.email})</span>}
                            <button onClick={() => handleUnassignUser(u.user_id)} className="ml-1 hover:text-destructive">
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Company Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Empresa</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div><Label>Nome da Empresa</Label><Input value={newForm.nome} onChange={e => setNewForm({...newForm, nome: e.target.value})} placeholder="Nome completo" /></div>
            <div><Label>CNPJ</Label><Input value={newForm.cnpj} onChange={e => setNewForm({...newForm, cnpj: e.target.value})} placeholder="00.000.000/0000-00" /></div>
            <div><Label>E-mail</Label><Input type="email" value={newForm.email} onChange={e => setNewForm({...newForm, email: e.target.value})} placeholder="contato@empresa.com" /></div>
            <div><Label>Telefone</Label><Input value={newForm.telefone} onChange={e => setNewForm({...newForm, telefone: e.target.value})} placeholder="(00) 00000-0000" /></div>
          </div>
          <DialogFooter><Button onClick={handleCreateEmpresa} disabled={saving}>{saving ? "Criando..." : "Criar Empresa"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign User Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Vincular Usuário à Empresa</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Digite o e-mail do usuário já cadastrado no sistema para vinculá-lo a esta empresa.
            </p>
            <div>
              <Label>E-mail do Usuário</Label>
              <Input type="email" value={assignEmail} onChange={e => setAssignEmail(e.target.value)} placeholder="usuario@email.com" />
            </div>
          </div>
          <DialogFooter><Button onClick={handleAssignUser} disabled={!assignEmail.trim()}>Vincular</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}