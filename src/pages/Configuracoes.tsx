import { useState, useEffect } from "react";
import { Building2, Save, UserPlus, Trash2, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface UsuarioLiberado {
  id: string;
  email: string;
  nome: string;
  created_at: string;
}

export default function Configuracoes() {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: "",
    cnpj: "",
    endereco: "",
    telefone: "",
    email: "",
  });

  // Usuarios liberados
  const [usuarios, setUsuarios] = useState<UsuarioLiberado[]>([]);
  const [novoEmail, setNovoEmail] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [addingUser, setAddingUser] = useState(false);

  useEffect(() => {
    loadEmpresa();
    loadUsuarios();
  }, []);

  const loadEmpresa = async () => {
    const { data } = await (supabase.from as any)("empresa_config").select("*").limit(1);
    if (data && data.length > 0) {
      const e = data[0];
      setExistingId(e.id);
      setForm({
        nome: e.nome || "",
        cnpj: e.cnpj || "",
        endereco: e.endereco || "",
        telefone: e.telefone || "",
        email: e.email || "",
      });
    }
  };

  const loadUsuarios = async () => {
    const { data } = await (supabase.from as any)("usuarios_liberados")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setUsuarios(data);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (existingId) {
        await (supabase.from as any)("empresa_config").update(form).eq("id", existingId);
      } else {
        const { data } = await (supabase.from as any)("empresa_config").insert(form).select("id").single();
        if (data) setExistingId(data.id);
      }
      toast({ title: "Dados da empresa salvos com sucesso!" });
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleAddUser = async () => {
    if (!novoEmail.trim()) return;
    setAddingUser(true);
    const { error } = await (supabase.from as any)("usuarios_liberados").insert({
      email: novoEmail.trim().toLowerCase(),
      nome: novoNome.trim(),
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Dados da empresa e configurações do sistema</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="w-5 h-5" />
            Dados da Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Nome da Empresa</Label>
              <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo da empresa" />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input value={form.cnpj} onChange={e => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" />
            </div>
            <div className="sm:col-span-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="contato@empresa.com" />
            </div>
            <div className="sm:col-span-2">
              <Label>Endereço</Label>
              <Input value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} placeholder="Endereço completo" />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Usuarios Liberados */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="w-5 h-5" />
            Usuários Liberados
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Somente os e-mails cadastrados aqui poderão acessar o sistema.
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
              Nenhum usuário liberado. Enquanto a lista estiver vazia, qualquer usuário autenticado poderá acessar.
            </p>
          ) : (
            <div className="space-y-2">
              {usuarios.map(u => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <span className="font-medium text-sm">{u.nome || "—"}</span>
                    <span className="text-muted-foreground text-sm ml-2">{u.email}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveUser(u.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
