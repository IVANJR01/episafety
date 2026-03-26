import { useState, useEffect, useMemo } from "react";
import { Shield, UserPlus, Trash2, Save, Eye, EyeOff, Building2, Crown, GitBranch, Pencil, UserX, UserCheck, Power } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isOnline, getCachedData, setCachedData, addToSyncQueue } from "@/lib/offlineStorage";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { MODULOS, ACOES, ACOES_ESPECIAIS, allPermissions, allActionsForModule } from "@/lib/permissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

interface UsuarioLiberado {
  id: string;
  email: string;
  nome: string;
  modulos_permitidos: string[] | null;
  created_at: string;
  empresa_id: string | null;
  is_principal: boolean;
  contrato_id: string | null;
  ativo: boolean;
}

interface Empresa {
  id: string;
  nome: string;
  empresa_pai_id: string | null;
}

const ACAO_ICONS: Record<string, string> = {
  view: "👁️",
  create: "➕",
  edit: "✏️",
  delete: "🗑️",
};

export default function UsuariosLiberados() {
  const { toast } = useToast();
  const { empresaId, isSuperAdmin, isPrincipal } = useAuth();
  const isAdmin = isSuperAdmin || isPrincipal;
  const [usuarios, setUsuarios] = useState<UsuarioLiberado[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [novoEmail, setNovoEmail] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [novoEmpresaId, setNovoEmpresaId] = useState<string>("");
  const [novoContratoId, setNovoContratoId] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [savingPerms, setSavingPerms] = useState<string | null>(null);
  const [allContratos, setAllContratos] = useState<{ id: string; nome: string; unidade_id: string }[]>([]);

  // Filters
  const [filterEmail, setFilterEmail] = useState("");
  const [filterNome, setFilterNome] = useState("");
  const [filterEmpresa, setFilterEmpresa] = useState("");

  // Dialog states
  const [newOpen, setNewOpen] = useState(false);
  const [permsUserId, setPermsUserId] = useState<string | null>(null);
  const [editTab, setEditTab] = useState<string>("dados");

  // Edit fields
  const [editNome, setEditNome] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editEmpresaId, setEditEmpresaId] = useState<string>("");
  const [editContratoId, setEditContratoId] = useState<string>("");
  const [savingData, setSavingData] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    loadUsuarios();
    loadEmpresas();
    loadContratos();
  }, []);

  const loadContratos = async () => {
    if (!isOnline()) {
      setAllContratos(getCachedData<{ id: string; nome: string; unidade_id: string }>("contratos_list") || []);
      return;
    }
    const { data } = await supabase.from("contratos").select("id, nome, unidade_id").order("nome");
    if (data) { setAllContratos(data); setCachedData("contratos_list", data); }
  };

  const loadEmpresas = async () => {
    if (!isOnline()) {
      setEmpresas(getCachedData<Empresa>("empresa_config_list") || []);
      return;
    }
    const { data } = await supabase.from("empresa_config").select("id, nome, empresa_pai_id").order("nome");
    if (data) { setEmpresas(data); setCachedData("empresa_config_list", data); }
  };

  const loadUsuarios = async () => {
    if (!isOnline()) {
      setUsuarios(getCachedData<UsuarioLiberado>("usuarios_liberados") || []);
      return;
    }
    const { data } = await (supabase.from as any)("usuarios_liberados")
      .select("*")
      .order("nome", { ascending: true });
    if (data) {
      // Ensure ativo field exists for backward compat
      const normalized = data.map((u: any) => ({ ...u, ativo: u.ativo !== false }));
      setUsuarios(normalized);
      setCachedData("usuarios_liberados", normalized);
    }
  };

  const empresaMap = useMemo(() => {
    const map: Record<string, string> = {};
    empresas.forEach(e => { map[e.id] = e.nome; });
    return map;
  }, [empresas]);

  const contratoMap = useMemo(() => {
    const map: Record<string, string> = {};
    allContratos.forEach(c => { map[c.id] = c.nome; });
    return map;
  }, [allContratos]);

  const unidadesDisponiveis = useMemo(() => {
    if (isSuperAdmin) return empresas;
    if (!empresaId) return [];
    return empresas.filter(e => e.id === empresaId || e.empresa_pai_id === empresaId);
  }, [empresas, empresaId, isSuperAdmin]);

  // Filter contratos by selected unidade for edit dialog
  const contratosForEditUnidade = useMemo(() => {
    if (!editEmpresaId) return [];
    return allContratos.filter(c => c.unidade_id === editEmpresaId);
  }, [allContratos, editEmpresaId]);

  // Filter contratos by selected unidade for new user dialog
  const contratosForNovoUnidade = useMemo(() => {
    if (!novoEmpresaId) return [];
    return allContratos.filter(c => c.unidade_id === novoEmpresaId);
  }, [allContratos, novoEmpresaId]);

  const filteredUsuarios = useMemo(() => {
    return usuarios.filter(u => {
      if (filterEmail && !u.email.toLowerCase().includes(filterEmail.toLowerCase())) return false;
      if (filterNome && !(u.nome || "").toLowerCase().includes(filterNome.toLowerCase())) return false;
      if (filterEmpresa) {
        const empNome = u.empresa_id ? (empresaMap[u.empresa_id] || "") : "";
        if (!empNome.toLowerCase().includes(filterEmpresa.toLowerCase())) return false;
      }
      return true;
    });
  }, [usuarios, filterEmail, filterNome, filterEmpresa, empresaMap]);

  const totalPages = Math.max(1, Math.ceil(filteredUsuarios.length / pageSize));
  const paginatedUsuarios = filteredUsuarios.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setCurrentPage(1); }, [filterEmail, filterNome, filterEmpresa]);

  const handleAddUser = async () => {
    if (!novoEmail.trim() || !novaSenha.trim()) {
      toast({ title: "Preencha e-mail e senha", variant: "destructive" });
      return;
    }
    if (novaSenha.length < 6) {
      toast({ title: "Senha deve ter no mínimo 6 caracteres", variant: "destructive" });
      return;
    }
    if (!isOnline()) {
      toast({ title: "Sem conexão", description: "Criar usuários requer conexão com a internet.", variant: "destructive" });
      return;
    }

    setAddingUser(true);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("create-user", {
        body: {
          email: novoEmail.trim().toLowerCase(),
          password: novaSenha,
          nome: novoNome.trim(),
        },
      });

      if (fnError || (fnData?.error && !fnData?.already_exists)) {
        toast({ title: "Erro ao criar conta", description: fnData?.error || fnError?.message, variant: "destructive" });
        setAddingUser(false);
        return;
      }

      const targetEmpresaId = novoEmpresaId || empresaId;
      const { error } = await (supabase.from as any)("usuarios_liberados").insert({
        email: novoEmail.trim().toLowerCase(),
        nome: novoNome.trim(),
        modulos_permitidos: [],
        empresa_id: targetEmpresaId,
        contrato_id: novoContratoId || null,
      });

      if (error) {
        toast({ title: error.message.includes("unique") ? "E-mail já cadastrado" : "Erro ao adicionar", description: error.message, variant: "destructive" });
      } else {
        if (targetEmpresaId && fnData?.user_id) {
          await (supabase.from as any)("profiles").update({ empresa_id: targetEmpresaId }).eq("user_id", fnData.user_id);
        }
        toast({ title: fnData?.already_exists ? "Usuário existente vinculado!" : "Usuário criado com sucesso!" });
        setNovoEmail(""); setNovoNome(""); setNovaSenha(""); setNovoEmpresaId(""); setNovoContratoId("");
        setNewOpen(false);
        await loadUsuarios();
      }
    } catch (err: any) {
      toast({ title: "Erro inesperado", description: err.message, variant: "destructive" });
    }
    setAddingUser(false);
  };

  const handleRemoveUser = async (id: string) => {
    if (!isOnline()) {
      addToSyncQueue({ table: "usuarios_liberados", type: "delete", payload: { id } });
      const cached = getCachedData<UsuarioLiberado>("usuarios_liberados") || [];
      setCachedData("usuarios_liberados", cached.filter(u => u.id !== id));
      setUsuarios(prev => prev.filter(u => u.id !== id));
      toast({ title: "Removido offline" });
      return;
    }
    const { error } = await (supabase.from as any)("usuarios_liberados").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao remover", variant: "destructive" });
    } else {
      toast({ title: "Usuário removido" });
      await loadUsuarios();
    }
  };

  const togglePerm = (userId: string, permKey: string) => {
    setUsuarios(prev =>
      prev.map(u => {
        if (u.id !== userId) return u;
        const current = u.modulos_permitidos || [];
        const updated = current.includes(permKey) ? current.filter(p => p !== permKey) : [...current, permKey];
        return { ...u, modulos_permitidos: updated };
      })
    );
  };

  const toggleModuleAll = (userId: string, moduleKey: string) => {
    setUsuarios(prev =>
      prev.map(u => {
        if (u.id !== userId) return u;
        const current = u.modulos_permitidos || [];
        const modulePerms = allActionsForModule(moduleKey);
        const hasAll = modulePerms.every(p => current.includes(p));
        const cleaned = current.filter(p => p !== moduleKey && !modulePerms.includes(p));
        return { ...u, modulos_permitidos: hasAll ? cleaned : [...cleaned, ...modulePerms] };
      })
    );
  };

  const handleSavePermissions = async (userId: string) => {
    setSavingPerms(userId);
    const user = usuarios.find(u => u.id === userId);
    if (!user) return;

    if (!isOnline()) {
      addToSyncQueue({ table: "usuarios_liberados", type: "update", payload: { id: userId, modulos_permitidos: user.modulos_permitidos || [] } });
      toast({ title: "Permissões salvas offline" });
      setSavingPerms(null);
      return;
    }

    const { error } = await (supabase.from as any)("usuarios_liberados")
      .update({ modulos_permitidos: user.modulos_permitidos || [] })
      .eq("id", userId);
    if (error) {
      toast({ title: "Erro ao salvar permissões", variant: "destructive" });
    } else {
      toast({ title: "Permissões atualizadas!" });
      setPermsUserId(null);
    }
    setSavingPerms(null);
  };

  const handleSaveUserData = async (userId: string) => {
    setSavingData(true);
    const { error } = await (supabase.from as any)("usuarios_liberados")
      .update({
        nome: editNome.trim(),
        email: editEmail.trim().toLowerCase(),
        empresa_id: editEmpresaId || null,
        contrato_id: (editContratoId && editContratoId !== "none") ? editContratoId : null,
      })
      .eq("id", userId);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message.includes("unique") ? "Este e-mail já está cadastrado" : error.message, variant: "destructive" });
    } else {
      toast({ title: "Dados atualizados!" });
      setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, nome: editNome.trim(), email: editEmail.trim().toLowerCase(), empresa_id: editEmpresaId || null, contrato_id: (editContratoId && editContratoId !== "none") ? editContratoId : null } : u));
    }
    setSavingData(false);
  };

  const handleToggleAtivo = async (userId: string) => {
    const user = usuarios.find(u => u.id === userId);
    if (!user) return;
    const newVal = !user.ativo;

    setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, ativo: newVal } : u));

    if (isOnline()) {
      const { error } = await (supabase.from as any)("usuarios_liberados")
        .update({ ativo: newVal })
        .eq("id", userId);
      if (error) {
        toast({ title: "Erro ao atualizar status", variant: "destructive" });
        setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, ativo: !newVal } : u));
      } else {
        toast({ title: newVal ? "Usuário ativado!" : "Usuário desativado!" });
      }
    }
  };

  const selectAll = (userId: string) => {
    setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, modulos_permitidos: allPermissions() } : u));
  };

  const deselectAll = (userId: string) => {
    setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, modulos_permitidos: [] } : u));
  };

  const getModulePermCount = (perms: string[], moduleKey: string): number => {
    if (perms.includes(moduleKey)) return ACOES.length;
    return ACOES.filter(a => perms.includes(`${moduleKey}:${a.key}`)).length;
  };

  const hasModulePerm = (perms: string[], moduleKey: string, action: string): boolean => {
    if (perms.includes(moduleKey)) return true;
    return perms.includes(`${moduleKey}:${action}`);
  };

  const handleTogglePrincipal = async (userId: string) => {
    const user = usuarios.find(u => u.id === userId);
    if (!user) return;
    const newVal = !user.is_principal;
    const updates: any = { is_principal: newVal };
    if (newVal) updates.modulos_permitidos = allPermissions();

    setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, is_principal: newVal, ...(newVal ? { modulos_permitidos: allPermissions() } : {}) } : u));

    if (isOnline()) {
      const { error } = await (supabase.from as any)("usuarios_liberados").update(updates).eq("id", userId);
      if (error) {
        toast({ title: "Erro ao atualizar", variant: "destructive" });
        setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, is_principal: !newVal } : u));
      } else {
        toast({ title: newVal ? "Usuário definido como Principal!" : "Principal removido" });
      }
    }
  };

  // When opening edit dialog, populate edit fields and auto-populate perms
  useEffect(() => {
    if (permsUserId) {
      const user = usuarios.find(u => u.id === permsUserId);
      if (user) {
        setEditNome(user.nome || "");
        setEditEmail(user.email || "");
        setEditEmpresaId(user.empresa_id || "");
        setEditContratoId(user.contrato_id || "");
      }
      setUsuarios(prev => prev.map(u => {
        if (u.id !== permsUserId) return u;
        if (!u.is_principal && (!u.modulos_permitidos || u.modulos_permitidos.length === 0)) {
          return { ...u, modulos_permitidos: allPermissions() };
        }
        return u;
      }));
      setEditTab("dados");
    }
  }, [permsUserId]);

  const permsUser = permsUserId ? usuarios.find(u => u.id === permsUserId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Lista de Usuários
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie quem pode acessar o sistema e suas permissões
          </p>
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />Novo
        </Button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{filteredUsuarios.length} de {usuarios.length} registros</span>
        {totalPages > 1 && (
          <span>Página {currentPage} de {totalPages}</span>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[25%]">Login</TableHead>
                  <TableHead className="w-[20%]">Nome</TableHead>
                  <TableHead className="w-[20%]">Empresa</TableHead>
                  <TableHead className="w-[10%] text-center">Status</TableHead>
                  <TableHead className="w-[25%] text-right">Ações</TableHead>
                </TableRow>
                {/* Filter row */}
                <TableRow>
                  <TableHead className="py-2">
                    <Input
                      placeholder="Filtrar e-mail..."
                      value={filterEmail}
                      onChange={e => setFilterEmail(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </TableHead>
                  <TableHead className="py-2">
                    <Input
                      placeholder="Filtrar nome..."
                      value={filterNome}
                      onChange={e => setFilterNome(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </TableHead>
                  <TableHead className="py-2">
                    <Input
                      placeholder="Filtrar empresa..."
                      value={filterEmpresa}
                      onChange={e => setFilterEmpresa(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </TableHead>
                  <TableHead />
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsuarios.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum usuário encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedUsuarios.map(u => (
                    <TableRow key={u.id} className={`hover:bg-muted/30 ${!u.ativo ? "opacity-50" : ""}`}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          {u.is_principal && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                          {u.email}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium uppercase">
                        {u.nome || "—"}
                        {u.is_principal && (
                          <Badge variant="outline" className="ml-2 text-[10px] py-0 px-1.5 text-amber-600 border-amber-300">
                            Principal
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>
                          {u.empresa_id ? (empresaMap[u.empresa_id] || "—") : <span className="text-muted-foreground italic">Sem empresa</span>}
                          {u.contrato_id && contratoMap[u.contrato_id] && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <GitBranch className="w-3 h-3" />
                              {contratoMap[u.contrato_id]}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {u.ativo ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">Ativo</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-[10px]">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => setPermsUserId(u.id)}
                          >
                            <Pencil className="w-3 h-3" />
                            Alterar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-destructive hover:text-destructive gap-1"
                            onClick={() => handleRemoveUser(u.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                            Remover
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-3 border-t">
              <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                ‹
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <Button
                  key={page}
                  variant={page === currentPage ? "default" : "outline"}
                  size="sm"
                  className="w-8 h-8 p-0"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              ))}
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                ›
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New User Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Novo Usuário
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Nome</Label>
              <Input placeholder="Nome do usuário" value={novoNome} onChange={e => setNovoNome(e.target.value)} />
            </div>
            <div>
              <Label>E-mail (Login)</Label>
              <Input type="email" placeholder="email@exemplo.com" value={novoEmail} onChange={e => setNovoEmail(e.target.value)} />
            </div>
            {unidadesDisponiveis.length > 1 && (
              <div>
                <Label>Vincular à unidade</Label>
                <Select value={novoEmpresaId} onValueChange={(val) => { setNovoEmpresaId(val); setNovoContratoId(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Empresa atual" />
                  </SelectTrigger>
                  <SelectContent>
                    {unidadesDisponiveis.map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        <span className="flex items-center gap-2">
                          {e.empresa_pai_id ? <GitBranch className="w-3.5 h-3.5 text-muted-foreground" /> : <Building2 className="w-3.5 h-3.5 text-muted-foreground" />}
                          {e.nome}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {contratosForNovoUnidade.length > 0 && (
              <div>
                <Label>Vincular ao contrato (opcional)</Label>
                <Select value={novoContratoId} onValueChange={setNovoContratoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum — acesso geral à unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {contratosForNovoUnidade.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2">
                          <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                          {c.nome}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Restringe a visualização de estoque e movimentações apenas a este contrato.
                </p>
              </div>
            )}
            <div>
              <Label>Senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mín. 6 caracteres"
                  value={novaSenha}
                  onChange={e => setNovaSenha(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddUser()}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddUser} disabled={addingUser || !novoEmail.trim() || !novaSenha.trim()}>
              <UserPlus className="w-4 h-4 mr-2" />
              {addingUser ? "Criando..." : "Criar e Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog with Tabs */}
      <Dialog open={!!permsUserId} onOpenChange={(open) => { if (!open) setPermsUserId(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {permsUser && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Pencil className="w-5 h-5" />
                  {permsUser.nome || permsUser.email}
                  {!permsUser.ativo && (
                    <Badge variant="outline" className="text-muted-foreground text-[10px] ml-2">Inativo</Badge>
                  )}
                </DialogTitle>
              </DialogHeader>

              <Tabs value={editTab} onValueChange={setEditTab} className="w-full">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="dados">Dados do Usuário</TabsTrigger>
                  <TabsTrigger value="permissoes">Permissões</TabsTrigger>
                </TabsList>

                {/* Tab: Dados */}
                <TabsContent value="dados" className="space-y-4 pt-2">
                  <div className="grid gap-4">
                    <div>
                      <Label>Nome</Label>
                      <Input value={editNome} onChange={e => setEditNome(e.target.value)} placeholder="Nome do usuário" />
                    </div>
                    <div>
                      <Label>E-mail (Login)</Label>
                      <Input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="email@exemplo.com" />
                    </div>
                    {unidadesDisponiveis.length > 0 && (
                      <div>
                        <Label>Unidade / Empresa</Label>
                        <Select value={editEmpresaId} onValueChange={(val) => { setEditEmpresaId(val); setEditContratoId(""); }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a unidade" />
                          </SelectTrigger>
                          <SelectContent>
                            {unidadesDisponiveis.map(e => (
                              <SelectItem key={e.id} value={e.id}>
                                <span className="flex items-center gap-2">
                                  {e.empresa_pai_id ? <GitBranch className="w-3.5 h-3.5 text-muted-foreground" /> : <Building2 className="w-3.5 h-3.5 text-muted-foreground" />}
                                  {e.nome}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {contratosForEditUnidade.length > 0 && (
                      <div>
                        <Label>Contrato vinculado</Label>
                        <Select value={editContratoId} onValueChange={setEditContratoId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Nenhum — acesso geral à unidade" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              <span className="text-muted-foreground">Nenhum — acesso geral</span>
                            </SelectItem>
                            {contratosForEditUnidade.map(c => (
                              <SelectItem key={c.id} value={c.id}>
                                <span className="flex items-center gap-2">
                                  <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                                  {c.nome}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Restringe o usuário a ver apenas o estoque e movimentações deste contrato.
                        </p>
                      </div>
                    )}

                    {/* Status ativo/inativo */}
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                      <div className="flex items-center gap-3">
                        {permsUser.ativo ? (
                          <UserCheck className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <UserX className="w-5 h-5 text-muted-foreground" />
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {permsUser.ativo ? "Usuário Ativo" : "Usuário Inativo"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {permsUser.ativo
                              ? "O usuário pode acessar o sistema normalmente"
                              : "O acesso do usuário está bloqueado"}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={permsUser.ativo}
                        onCheckedChange={() => handleToggleAtivo(permsUser.id)}
                      />
                    </div>

                    {/* Principal toggle */}
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                      <div className="flex items-center gap-3">
                        <Crown className={`w-5 h-5 ${permsUser.is_principal ? "text-amber-500" : "text-muted-foreground"}`} />
                        <div>
                          <p className="text-sm font-medium">
                            {permsUser.is_principal ? "Usuário Principal" : "Usuário Comum"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Principal tem acesso administrativo à árvore da empresa
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={permsUser.is_principal}
                        onCheckedChange={() => handleTogglePrincipal(permsUser.id)}
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button onClick={() => handleSaveUserData(permsUser.id)} disabled={savingData || !editEmail.trim()}>
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                      {savingData ? "Salvando..." : "Salvar Dados"}
                    </Button>
                  </DialogFooter>
                </TabsContent>

                {/* Tab: Permissões */}
                <TabsContent value="permissoes" className="space-y-4 pt-2">
                  <div className="flex items-center justify-end">
                    <div className="flex gap-2">
                      <button onClick={() => selectAll(permsUser.id)} className="text-xs text-primary hover:underline">Selecionar todos</button>
                      <span className="text-muted-foreground text-xs">|</span>
                      <button onClick={() => deselectAll(permsUser.id)} className="text-xs text-muted-foreground hover:underline">Limpar</button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="grid grid-cols-[1fr_repeat(4,_50px)] sm:grid-cols-[1fr_repeat(4,_80px)] gap-1 items-center px-2 py-1">
                      <span className="text-xs font-semibold text-muted-foreground">Módulo</span>
                      {ACOES.map(a => (
                        <span key={a.key} className="text-xs font-semibold text-muted-foreground text-center">
                          {ACAO_ICONS[a.key]} {a.label}
                        </span>
                      ))}
                    </div>

                    {MODULOS.map(mod => {
                      const perms = permsUser.modulos_permitidos || [];
                      const modulePermCount = getModulePermCount(perms, mod.key);
                      const hasAllModule = modulePermCount === ACOES.length;

                      return (
                        <div
                          key={mod.key}
                          className={`grid grid-cols-[1fr_repeat(4,_50px)] sm:grid-cols-[1fr_repeat(4,_80px)] gap-1 items-center px-2 py-2 rounded-md transition-colors ${
                            modulePermCount > 0 ? "bg-primary/5" : "hover:bg-muted/50"
                          }`}
                        >
                          <label className="flex items-center gap-2 cursor-pointer" onClick={() => toggleModuleAll(permsUser.id, mod.key)}>
                            <Checkbox checked={hasAllModule} className="pointer-events-none" />
                            <span className="text-sm font-medium">{mod.label}</span>
                          </label>
                          {ACOES.map(acao => (
                            <div key={acao.key} className="flex justify-center">
                              <Checkbox
                                checked={hasModulePerm(perms, mod.key, acao.key)}
                                onCheckedChange={() => togglePerm(permsUser.id, `${mod.key}:${acao.key}`)}
                              />
                            </div>
                          ))}
                          {/* Special per-module actions */}
                          {ACOES_ESPECIAIS[mod.key] && (
                            <div className="col-span-full flex items-center gap-2 pl-6 pt-1">
                              {ACOES_ESPECIAIS[mod.key].map(acao => (
                                <label key={acao.key} className="flex items-center gap-1.5 cursor-pointer">
                                  <Checkbox
                                    checked={perms.includes(`${mod.key}:${acao.key}`)}
                                    onCheckedChange={() => togglePerm(permsUser.id, `${mod.key}:${acao.key}`)}
                                  />
                                  <span className="text-xs text-muted-foreground">{acao.label}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <DialogFooter>
                    <Button onClick={() => handleSavePermissions(permsUser.id)} disabled={savingPerms === permsUser.id}>
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                      {savingPerms === permsUser.id ? "Salvando..." : "Salvar Permissões"}
                    </Button>
                  </DialogFooter>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
