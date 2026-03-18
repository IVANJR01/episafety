import { useState, useEffect } from "react";
import { GitBranch, Plus, Trash2, Pencil, UserPlus, Eye, EyeOff, Briefcase, MapPin, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
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

interface Contrato {
  id: string;
  nome: string;
  descricao: string | null;
  unidade_id: string;
  empresa_id: string | null;
  created_at: string;
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
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [usuariosContratos, setUsuariosContratos] = useState<{ id: string; nome: string | null; contrato_id: string | null; empresa_id: string | null; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [empresaNome, setEmpresaNome] = useState("");
  const [expandedFiliais, setExpandedFiliais] = useState<Set<string>>(new Set());

  // Unit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Filial | null>(null);
  const [form, setForm] = useState({ nome: "", cnpj: "", email: "", telefone: "", endereco: "", tipo: "filial" });

  // Assign user dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignFilialId, setAssignFilialId] = useState<string | null>(null);
  const [assignEmail, setAssignEmail] = useState("");
  const [assignNome, setAssignNome] = useState("");
  const [assignSenha, setAssignSenha] = useState("");
  const [assignContratoId, setAssignContratoId] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // Contract dialog
  const [contratoOpen, setContratoOpen] = useState(false);
  const [editingContrato, setEditingContrato] = useState<Contrato | null>(null);
  const [contratoFilialId, setContratoFilialId] = useState<string | null>(null);
  const [contratoForm, setContratoForm] = useState({ nome: "", descricao: "" });

  useEffect(() => {
    if (empresaId) loadData();
  }, [empresaId]);

  const loadData = async () => {
    setLoading(true);
    const [{ data: filData }, { data: profData }, { data: empData }, { data: contData }, { data: ulData }] = await Promise.all([
      (supabase.from as any)("empresa_config").select("*").eq("empresa_pai_id", empresaId).order("nome"),
      isAdmin ? (supabase.from as any)("profiles").select("*") : { data: [] },
      (supabase.from as any)("empresa_config").select("nome").eq("id", empresaId).single(),
      (supabase.from as any)("contratos").select("*").order("nome"),
      (supabase.from as any)("usuarios_liberados").select("id, nome, contrato_id, empresa_id, email"),
    ]);
    setFiliais(filData || []);
    setProfiles(profData || []);
    setEmpresaNome(empData?.nome || "");
    setContratos(contData || []);
    setUsuariosContratos(ulData || []);
    setLoading(false);
  };

  const toggleExpand = (id: string) => {
    setExpandedFiliais(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getContratosForFilial = (id: string) => contratos.filter(c => c.unidade_id === id);
  const getUsersForContrato = (id: string) => usuariosContratos.filter(u => u.contrato_id === id);
  const getUsersWithoutContrato = (filialId: string) => usuariosContratos.filter(u => u.empresa_id === filialId && !u.contrato_id);
  const getUsersForFilial = (id: string) => profiles.filter(p => p.empresa_id === id);

  // Unit CRUD
  const openNew = () => { setEditing(null); setForm({ nome: "", cnpj: "", email: "", telefone: "", endereco: "", tipo: "filial" }); setDialogOpen(true); };
  const openEdit = (f: Filial) => { setEditing(f); setForm({ nome: f.nome, cnpj: f.cnpj || "", email: f.email || "", telefone: f.telefone || "", endereco: f.endereco || "", tipo: f.tipo || "filial" }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    const payload = { nome: form.nome, cnpj: form.cnpj || null, email: form.email || null, telefone: form.telefone || null, endereco: form.endereco || null, tipo: form.tipo, empresa_pai_id: empresaId };
    if (editing) {
      const { error } = await (supabase.from as any)("empresa_config").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Atualizado com sucesso!" });
    } else {
      const { error } = await (supabase.from as any)("empresa_config").insert(payload);
      if (error) { toast({ title: "Erro ao criar", description: error.message, variant: "destructive" }); return; }
      toast({ title: `${TIPO_LABELS[form.tipo]?.label || "Item"} criado com sucesso!` });
    }
    setDialogOpen(false); await loadData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase.from as any)("empresa_config").delete().eq("id", id);
    if (error) { toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" }); }
    else { toast({ title: "Excluído com sucesso" }); await loadData(); }
  };

  // Assign user
  const handleAssignUser = async () => {
    if (!assignEmail.trim() || !assignFilialId) return;
    const existingProfile = profiles.find(p => p.email?.toLowerCase() === assignEmail.trim().toLowerCase());
    if (existingProfile) {
      const { error } = await (supabase.from as any)("profiles").update({ empresa_id: assignFilialId }).eq("user_id", existingProfile.user_id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      // Update contrato_id on usuarios_liberados if a contract was selected
      if (assignContratoId) {
        await (supabase.from as any)("usuarios_liberados").update({ contrato_id: assignContratoId }).eq("email", assignEmail.trim().toLowerCase());
      }
      toast({ title: "Usuário vinculado!" }); setAssignOpen(false); setAssignContratoId(""); await loadData(); return;
    }
    if (!assignSenha.trim() || assignSenha.length < 6) { toast({ title: "Senha deve ter no mínimo 6 caracteres", variant: "destructive" }); return; }
    setAssigning(true);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("create-user", { body: { email: assignEmail.trim().toLowerCase(), password: assignSenha, nome: assignNome.trim() } });
      if (fnError || fnData?.error) { toast({ title: "Erro", description: fnData?.error || fnError?.message, variant: "destructive" }); setAssigning(false); return; }
      if (fnData?.user_id) {
        await (supabase.from as any)("profiles").update({ empresa_id: assignFilialId }).eq("user_id", fnData.user_id);
        const ulPayload: any = { email: assignEmail.trim().toLowerCase(), nome: assignNome.trim(), modulos_permitidos: ["dashboard", "epis", "entregas", "relatorios", "cadastro_empresas", "cadastro_funcionarios", "cadastro_usuarios"], empresa_id: assignFilialId };
        if (assignContratoId) ulPayload.contrato_id = assignContratoId;
        await (supabase.from as any)("usuarios_liberados").insert(ulPayload);
      }
      toast({ title: "Usuário criado e vinculado!" }); setAssignOpen(false); setAssignContratoId(""); await loadData();
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "destructive" }); }
    setAssigning(false);
  };

  // Contract CRUD
  const openNewContrato = (filialId: string) => {
    setEditingContrato(null); setContratoFilialId(filialId); setContratoForm({ nome: "", descricao: "" }); setContratoOpen(true);
  };
  const openEditContrato = (c: Contrato) => {
    setEditingContrato(c); setContratoFilialId(c.unidade_id); setContratoForm({ nome: c.nome, descricao: c.descricao || "" }); setContratoOpen(true);
  };

  const handleSaveContrato = async () => {
    if (!contratoForm.nome.trim() || !contratoFilialId) return;
    // Find the empresa_id (parent) for this filial
    const filial = filiais.find(f => f.id === contratoFilialId);
    const empId = filial?.empresa_pai_id || empresaId;

    const payload = { nome: contratoForm.nome, descricao: contratoForm.descricao || null, unidade_id: contratoFilialId, empresa_id: empId, created_by: undefined as any };

    if (editingContrato) {
      const { error } = await (supabase.from as any)("contratos").update({ nome: payload.nome, descricao: payload.descricao }).eq("id", editingContrato.id);
      if (error) { toast({ title: "Erro ao salvar contrato", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Contrato atualizado!" });
    } else {
      const { error } = await (supabase.from as any)("contratos").insert(payload);
      if (error) { toast({ title: "Erro ao criar contrato", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Contrato criado com sucesso!" });
    }
    setContratoOpen(false); await loadData();
  };

  const handleDeleteContrato = async (id: string) => {
    const { error } = await (supabase.from as any)("contratos").delete().eq("id", id);
    if (error) { toast({ title: "Erro ao excluir contrato", description: error.message, variant: "destructive" }); }
    else { toast({ title: "Contrato excluído" }); await loadData(); }
  };

  if (!empresaId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Unidades</h1>
        <Card><CardContent className="py-8 text-center text-muted-foreground">Você não está vinculado a nenhuma empresa.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs sm:text-sm">Unidades vinculadas a <strong>{empresaNome}</strong></p>
        {(canCreate || isAdmin) && (
          <Button onClick={openNew} className="text-xs sm:text-sm"><Plus className="w-4 h-4 mr-1 sm:mr-2" />Nova Unidade</Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
      ) : filiais.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <GitBranch className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
            <p>Nenhuma unidade cadastrada.</p>
            <p className="text-xs mt-1">Clique em "Nova Unidade" para criar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filiais.map(f => {
            const tipoInfo = TIPO_LABELS[f.tipo] || TIPO_LABELS.filial;
            const TipoIcon = tipoInfo.icon;
            const filContratos = getContratosForFilial(f.id);
            const usersWithoutContract = getUsersWithoutContrato(f.id);
            const isExpanded = expandedFiliais.has(f.id);
            const totalUsers = filContratos.reduce((acc, c) => acc + getUsersForContrato(c.id).length, 0) + usersWithoutContract.length;

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
                      {isAdmin && (
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setAssignFilialId(f.id); setAssignEmail(""); setAssignNome(""); setAssignSenha(""); setAssignOpen(true); }}>
                          <UserPlus className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {(canEdit || isAdmin) && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(f)}><Pencil className="w-3.5 h-3.5" /></Button>}
                      {(canDelete || isAdmin) && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(f.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>}
                    </div>
                  </div>

                  {/* Info row */}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {f.endereco && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{f.endereco}</span>}
                    {f.telefone && <span>{f.telefone}</span>}
                    {f.email && <span>{f.email}</span>}
                  </div>

                  {/* Contratos & Usuários section */}
                  <div className="border-t pt-2">
                    <button
                      onClick={() => toggleExpand(f.id)}
                      className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
                    >
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      <FileText className="w-3.5 h-3.5" />
                      Contratos ({filContratos.length})
                      {totalUsers > 0 && (
                        <span className="text-muted-foreground/60 ml-1">· {totalUsers} usuário{totalUsers !== 1 ? "s" : ""}</span>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 space-y-2 pl-5">
                        {filContratos.length === 0 && usersWithoutContract.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">Nenhum contrato cadastrado.</p>
                        ) : (
                          <>
                            {filContratos.map(c => {
                              const contratoUsers = getUsersForContrato(c.id);
                              return (
                                <div key={c.id} className="bg-muted/50 rounded-md px-3 py-2 space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-xs font-medium truncate">{c.nome}</p>
                                      {c.descricao && <p className="text-[10px] text-muted-foreground truncate">{c.descricao}</p>}
                                    </div>
                                    <div className="flex gap-0.5 shrink-0">
                                      {(canEdit || isAdmin) && (
                                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEditContrato(c)}>
                                          <Pencil className="w-3 h-3" />
                                        </Button>
                                      )}
                                      {(canDelete || isAdmin) && (
                                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDeleteContrato(c.id)}>
                                          <Trash2 className="w-3 h-3 text-destructive" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  {contratoUsers.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      {contratoUsers.map(u => (
                                        <Badge key={u.id} variant="secondary" className="text-[10px] py-0.5 px-2 flex items-center gap-1">
                                          <Users className="w-2.5 h-2.5" />
                                          {u.nome || u.email || "—"}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-muted-foreground italic">Nenhum usuário vinculado</p>
                                  )}
                                </div>
                              );
                            })}

                            {usersWithoutContract.length > 0 && (
                              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2 space-y-1.5">
                                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Sem contrato vinculado</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {usersWithoutContract.map(u => (
                                    <Badge key={u.id} variant="outline" className="text-[10px] py-0.5 px-2 border-amber-300 text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                      <Users className="w-2.5 h-2.5" />
                                      {u.nome || u.email || "—"}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                        {(canCreate || isAdmin) && (
                          <Button size="sm" variant="outline" className="h-7 text-xs mt-1" onClick={() => openNewContrato(f.id)}>
                            <Plus className="w-3 h-3 mr-1" />Novo Contrato
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* New/Edit Unit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar Unidade" : "Nova Unidade"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
          <DialogFooter><Button onClick={handleSave}>{editing ? "Salvar" : "Criar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign User Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Vincular Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Se o e-mail já existir, será vinculado. Caso contrário, uma nova conta será criada.</p>
            <div><Label>Nome</Label><Input value={assignNome} onChange={e => setAssignNome(e.target.value)} placeholder="Nome" /></div>
            <div><Label>E-mail</Label><Input type="email" value={assignEmail} onChange={e => setAssignEmail(e.target.value)} placeholder="usuario@email.com" /></div>
            <div>
              <Label>Contrato (opcional)</Label>
              <Select value={assignContratoId} onValueChange={setAssignContratoId}>
                <SelectTrigger><SelectValue placeholder="Selecione um contrato" /></SelectTrigger>
                <SelectContent>
                  {contratos.filter(c => c.unidade_id === assignFilialId).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {contratos.filter(c => c.unidade_id === assignFilialId).length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Nenhum contrato cadastrado nesta unidade.</p>
              )}
            </div>
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
          <DialogFooter><Button onClick={handleAssignUser} disabled={!assignEmail.trim() || assigning}>{assigning ? "Criando..." : "Vincular"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contract Dialog */}
      <Dialog open={contratoOpen} onOpenChange={setContratoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingContrato ? "Editar Contrato" : "Novo Contrato"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div><Label>Nome do Contrato</Label><Input value={contratoForm.nome} onChange={e => setContratoForm({ ...contratoForm, nome: e.target.value })} placeholder="Ex: Contrato Linhas" /></div>
            <div><Label>Descrição (opcional)</Label><Input value={contratoForm.descricao} onChange={e => setContratoForm({ ...contratoForm, descricao: e.target.value })} placeholder="Descrição do contrato" /></div>
          </div>
          <DialogFooter><Button onClick={handleSaveContrato} disabled={!contratoForm.nome.trim()}>{editingContrato ? "Salvar" : "Criar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
