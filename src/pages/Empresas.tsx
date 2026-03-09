import { useState, useEffect } from "react";
import { Building2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function Empresas() {
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

  useEffect(() => {
    loadEmpresa();
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
        <p className="text-muted-foreground text-sm mt-1">Dados da empresa</p>
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
    </div>
  );
}
