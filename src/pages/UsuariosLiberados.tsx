import { useState, useEffect } from "react";
import { Shield, UserPlus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface UsuarioLiberado {
  id: string;
  email: string;
  nome: string;
  created_at: string;
}

export default function UsuariosLiberados() {
  const { toast } = useToast();
  const [usuarios, setUsuarios] = useState<UsuarioLiberado[]>([]);
  const [novoEmail, setNovoEmail] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [addingUser, setAddingUser] = useState(false);

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
        <h1 className="text-2xl font-bold tracking-tight">Usuários Liberados</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie quem pode acessar o sistema</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="w-5 h-5" />
            Controle de Acesso
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Somente os e-mails cadastrados aqui poderão acessar o sistema. Enquanto a lista estiver vazia, qualquer usuário autenticado poderá acessar.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
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

          {usuarios.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum usuário liberado. Qualquer usuário autenticado poderá acessar.
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
