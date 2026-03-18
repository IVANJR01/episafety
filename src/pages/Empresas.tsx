import { useState, useEffect, useRef } from "react";
import { Building2, Save, Upload, X, Image } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isOnline, getCachedData, setCachedData, addToSyncQueue } from "@/lib/offlineStorage";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Filiais from "@/pages/Filiais";

export default function Empresas() {
  const { toast } = useToast();
  const { empresaId } = useAuth();
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    nome: "",
    cnpj: "",
    endereco: "",
    telefone: "",
    email: "",
  });

  useEffect(() => {
    loadEmpresa();
  }, [empresaId]);

  const loadEmpresa = async () => {
    if (!empresaId) return;
    if (!isOnline()) {
      const cached = getCachedData<any>("empresa_config");
      if (cached && cached.length > 0) {
        const e = cached.find((c: any) => c.id === empresaId) || cached[0];
        setExistingId(e.id);
        setLogoUrl(e.logo_url || null);
        setForm({ nome: e.nome || "", cnpj: e.cnpj || "", endereco: e.endereco || "", telefone: e.telefone || "", email: e.email || "" });
      }
      return;
    }
    const { data } = await (supabase.from as any)("empresa_config").select("*").eq("id", empresaId).limit(1);
    if (data && data.length > 0) {
      const e = data[0];
      setExistingId(e.id);
      setLogoUrl(e.logo_url || null);
      setForm({ nome: e.nome || "", cnpj: e.cnpj || "", endereco: e.endereco || "", telefone: e.telefone || "", email: e.email || "" });
      setCachedData("empresa_config", data);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Selecione um arquivo de imagem", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `logo-empresa-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("logos")
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;
      setLogoUrl(publicUrl);

      if (existingId) {
        await (supabase.from as any)("empresa_config")
          .update({ logo_url: publicUrl })
          .eq("id", existingId);
      }

      toast({ title: "Logo enviada com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao enviar logo", description: err.message, variant: "destructive" });
    }
    setUploading(false);
  };

  const handleRemoveLogo = async () => {
    setLogoUrl(null);
    if (existingId) {
      await (supabase.from as any)("empresa_config")
        .update({ logo_url: null })
        .eq("id", existingId);
    }
    toast({ title: "Logo removida" });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, logo_url: logoUrl };
      if (!existingId) {
        toast({ title: "Empresa não encontrada. Contacte o administrador.", variant: "destructive" });
        setSaving(false);
        return;
      }
      if (!isOnline()) {
        addToSyncQueue({ table: "empresa_config", type: "update", payload: { id: existingId, ...payload } });
        const cached = getCachedData<any>("empresa_config") || [];
        setCachedData("empresa_config", cached.map((c: any) => c.id === existingId ? { ...c, ...payload } : c));
        toast({ title: "Salvo offline", description: "Será sincronizado quando houver conexão." });
        setSaving(false);
        return;
      }
      await (supabase.from as any)("empresa_config").update(payload).eq("id", existingId);
      toast({ title: "Dados da empresa salvos com sucesso!" });
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
    setSaving(false);
  };

  if (!empresaId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
          <p className="text-muted-foreground text-sm mt-1">Dados da empresa</p>
        </div>
        <Card className="max-w-2xl">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Você ainda não está vinculado a nenhuma empresa. Contacte o administrador do sistema.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
        <p className="text-muted-foreground text-sm mt-1">Dados da empresa e unidades</p>
      </div>

      <Tabs defaultValue="dados" className="w-full">
        <TabsList>
          <TabsTrigger value="dados">
            <Building2 className="w-4 h-4 mr-2" />
            Dados da Empresa
          </TabsTrigger>
          <TabsTrigger value="unidades">
            Unidades
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-4">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="w-5 h-5" />
                Dados da Empresa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Logo / Marca da Empresa</Label>
                <div className="flex items-center gap-4">
                  {logoUrl ? (
                    <div className="relative group">
                      <img
                        src={logoUrl}
                        alt="Logo da empresa"
                        className="w-24 h-24 object-contain rounded-lg border border-border bg-muted p-1"
                      />
                      <button
                        onClick={handleRemoveLogo}
                        className="absolute -top-2 -right-2 p-1 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remover logo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/50">
                      <Image className="w-8 h-8 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploading ? "Enviando..." : logoUrl ? "Trocar Logo" : "Enviar Logo"}
                    </Button>
                    <p className="text-xs text-muted-foreground">PNG, JPG ou SVG. Recomendado: fundo transparente.</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                </div>
              </div>

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
        </TabsContent>

        <TabsContent value="unidades" className="mt-4">
          <Filiais />
        </TabsContent>
      </Tabs>
    </div>
  );
}
