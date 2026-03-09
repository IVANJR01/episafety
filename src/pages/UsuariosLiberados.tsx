import { useState, useEffect } from "react";
import { Shield, UserPlus, Trash2, ChevronDown, ChevronUp, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface UsuarioLiberado {
  id: string;
  email: string;
  nome: string;
  modulos_permitidos: string[] | null;
  created_at: string;
}

const MODULOS = [
  { key: "dashboard", label: "Dashboard", path: "/" },
  { key: "epis", label: "Controle de EPI", path: "/epis" },
  { key: "entregas", label: "Entregas", path: "/entregas" },
  { key: "relatorios", label: "Relatórios", path: "/relatorios" },
  { key: "cadastro_empresas", label: "Cadastro → Empresas", path: "/cadastro/empresas" },
  { key: "cadastro_funcionarios", label: "Cadastro → Funcionários", path: "/cadastro/funcionarios" },
  { key: "cadastro_usuarios", label: "Cadastro → Usuários Liberados", path: "/cadastro/usuarios" },
];

export default function UsuariosLiberados() {
  const { toast } = useToast();
  const [usuarios, setUsuarios] = useState<UsuarioLiberado[]>([]);
  const [novoEmail, setNovoEmail] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [addingUser, setAddingUser] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingPerms, setSavingPerms] = useState<string | null>(null);

  useEffect(() => {
    loadUsuarios();
  }, []);

  const loadUsuarios = async () => {
    const { data } = await (supabase.from as any)("usuarios_liberados")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setUsuarios(data);
  };

  const handleAddUser = async () => {
    if (!novoEmail.trim()) return;
    setAddingUser(true);
    // By default, give access to all modules
    const allModules = MODULOS.map(m => m.key);
    const { error } = await (supabase.from as any)("usuarios_liberados").insert({
      email: novoEmail.trim().toLowerCase(),
      nome: novoNome.trim(),
      modulos_permitidos: allModules,
    });
    if (error) {
      toast({
        title: error.message.includes("unique") ? "E-mail já cadastrado" : "Erro ao adicionar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Usuário liberado com sucesso!" });
      setNovoEmail("");
      setNovoNome("");
      await loadUsuarios();
    }
    setAddingUser(false);
  };

  const handleRemoveUser = async (id: string) => {
    const { error } = await (supabase.from as any)("usuarios_liberados").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao remover", variant: "destructive" });
    } else {
      toast({ title: "Usuário removido" });
      await loadUsuarios();
    }
  };

  const toggleModulo = (userId: string, moduloKey: string) => {
    setUsuarios(prev =>
      prev.map(u => {
        if (u.id !== userId) return u;
        const current = u.modulos_permitidos || [];
        const updated = current.includes(moduloKey)
          ? current.filter(m => m !== moduloKey)
          : [...current, moduloKey];
        return { ...u, modulos_permitidos: updated };
      })
    );
  };

  const handleSavePermissions = async (userId: string) => {
    setSavingPerms(userId);
    const user = usuarios.find(u => u.id === userId);
    if (!user) return;
    const { error } = await (supabase.from as any)("usuarios_liberados")
      .update({ modulos_permitidos: user.modulos_permitidos || [] })
      .eq("id", userId);
    if (error) {
      toast({ title: "Erro ao salvar permissões", variant: "destructive" });
    } else {
      toast({ title: "Permissões atualizadas!" });
    }
    setSavingPerms(null);
  };

  const selectAll = (userId: string) => {
    setUsuarios(prev =>
      prev.map(u => u.id === userId ? { ...u, modulos_permitidos: MODULOS.map(m => m.key) } : u)
    );
  };

  const deselectAll = (userId: string) => {
    setUsuarios(prev =>
      prev.map(u => u.id === userId ? { ...u, modulos_permitidos: [] } : u)
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Usuários Liberados</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie quem pode acessar o sistema e suas permissões</p>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="w-5 h-5" />
            Controle de Acesso
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Cadastre os e-mails autorizados e defina quais módulos cada usuário pode acessar.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add form */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Nome do usuário"
              value={novoNome}
              onChange={e => setNovoNome(e.target.value)}
              className="sm:w-40"
            />
            <Input
              type="email"
              placeholder="email@exemplo.com"
              value={novoEmail}
              onChange={e => setNovoEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddUser()}
              className="flex-1"
            />
            <Button onClick={handleAddUser} disabled={addingUser || !novoEmail.trim()}>
              <UserPlus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </div>

          {/* List */}
          {usuarios.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum usuário liberado. Qualquer usuário autenticado poderá acessar.
            </p>
          ) : (
            <div className="space-y-2">
              {usuarios.map(u => {
                const isExpanded = expandedId === u.id;
                const perms = u.modulos_permitidos || [];
                return (
                  <div key={u.id} className="rounded-lg border bg-card">
                    <div className="flex items-center justify-between p-3">
                      <button
                        className="flex items-center gap-2 flex-1 text-left"
                        onClick={() => setExpandedId(isExpanded ? null : u.id)}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        <div>
                          <span className="font-medium text-sm">{u.nome || "—"}</span>
                          <span className="text-muted-foreground text-sm ml-2">{u.email}</span>
                        </div>
                      </button>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground mr-2">
                          {perms.length}/{MODULOS.length} módulos
                        </span>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveUser(u.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t pt-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Módulos Permitidos</Label>
                          <div className="flex gap-2">
                            <button onClick={() => selectAll(u.id)} className="text-xs text-primary hover:underline">
                              Selecionar todos
                            </button>
                            <span className="text-muted-foreground text-xs">|</span>
                            <button onClick={() => deselectAll(u.id)} className="text-xs text-muted-foreground hover:underline">
                              Limpar
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {MODULOS.map(mod => (
                            <label
                              key={mod.key}
                              className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                            >
                              <Checkbox
                                checked={perms.includes(mod.key)}
                                onCheckedChange={() => toggleModulo(u.id, mod.key)}
                              />
                              <span className="text-sm">{mod.label}</span>
                            </label>
                          ))}
                        </div>
                        <div className="flex justify-end pt-1">
                          <Button
                            size="sm"
                            onClick={() => handleSavePermissions(u.id)}
                            disabled={savingPerms === u.id}
                          >
                            <Save className="w-3.5 h-3.5 mr-1.5" />
                            {savingPerms === u.id ? "Salvando..." : "Salvar Permissões"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
