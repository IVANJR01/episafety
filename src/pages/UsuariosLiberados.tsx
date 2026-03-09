import { useState, useEffect } from "react";
import { Shield, UserPlus, Trash2, ChevronDown, ChevronUp, Save, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  const { empresaId } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioLiberado[]>([]);
  const [novoEmail, setNovoEmail] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    if (!novoEmail.trim() || !novaSenha.trim()) {
      toast({ title: "Preencha e-mail e senha", variant: "destructive" });
      return;
    }
    if (novaSenha.length < 6) {
      toast({ title: "Senha deve ter no mínimo 6 caracteres", variant: "destructive" });
      return;
    }

    setAddingUser(true);
    try {
      // 1. Create auth user via edge function
      const { data: fnData, error: fnError } = await supabase.functions.invoke("create-user", {
        body: {
          email: novoEmail.trim().toLowerCase(),
          password: novaSenha,
          nome: novoNome.trim(),
        },
      });

      if (fnError || fnData?.error) {
        toast({
          title: "Erro ao criar conta",
          description: fnData?.error || fnError?.message || "Erro desconhecido",
          variant: "destructive",
        });
        setAddingUser(false);
        return;
      }

      // 2. Add to usuarios_liberados
      const allModules = MODULOS.map(m => m.key);
      const { error } = await (supabase.from as any)("usuarios_liberados").insert({
        email: novoEmail.trim().toLowerCase(),
        nome: novoNome.trim(),
        modulos_permitidos: allModules,
        empresa_id: empresaId,
      });

      if (error) {
        toast({
          title: error.message.includes("unique") ? "E-mail já cadastrado" : "Erro ao adicionar",
          description: error.message,
          variant: "destructive",
        });
      } else {
        // 3. Update profile empresa_id if we have one
        if (empresaId && fnData?.user_id) {
          await (supabase.from as any)("profiles")
            .update({ empresa_id: empresaId })
            .eq("user_id", fnData.user_id);
        }
        toast({ title: "Usuário criado e liberado com sucesso!" });
        setNovoEmail("");
        setNovoNome("");
        setNovaSenha("");
        await loadUsuarios();
      }
    } catch (err: any) {
      toast({ title: "Erro inesperado", description: err.message, variant: "destructive" });
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
            Cadastre os e-mails autorizados, defina uma senha e escolha quais módulos cada usuário pode acessar.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
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
                className="flex-1"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Senha (mín. 6 caracteres)"
                  value={novaSenha}
                  onChange={e => setNovaSenha(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddUser()}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button onClick={handleAddUser} disabled={addingUser || !novoEmail.trim() || !novaSenha.trim()}>
                <UserPlus className="w-4 h-4 mr-2" />
                {addingUser ? "Criando..." : "Adicionar"}
              </Button>
            </div>
          </div>

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