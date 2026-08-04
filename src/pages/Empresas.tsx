import { useState, useEffect, useMemo, useRef } from "react";
import { Building2, Save, Upload, X, Image } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isOnline, getCachedData, setCachedData, addToSyncQueue } from "@/lib/offlineStorage";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { separarEmails } from "@/lib/solicitacaoMateriaisEmail";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Filiais from "@/pages/Filiais";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

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
    email_compras: "",
  });

  /** Mesma leitura que o envio faz — a tela mostra o que vai valer na hora. */
  const emailsCompras = useMemo(() => separarEmails(form.email_compras), [form.email_compras]);

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
        setForm({ nome: e.nome || "", cnpj: e.cnpj || "", endereco: e.endereco || "", telefone: e.telefone || "", email: e.email || "", email_compras: e.email_compras || "" });
      }
      return;
    }
    const { data } = await (supabase.from as any)("empresa_config").select("*").eq("id", empresaId).limit(1);
    if (data && data.length > 0) {
      const e = data[0];
      setExistingId(e.id);
      setLogoUrl(e.logo_url || null);
      setForm({ nome: e.nome || "", cnpj: e.cnpj || "", endereco: e.endereco || "", telefone: e.telefone || "", email: e.email || "", email_compras: e.email_compras || "" });
      setCachedData("empresa_config", data);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
    if (!ALLOWED.includes(file.type)) {
      toast({ title: "Formato não suportado", description: "Use PNG, JPG, WEBP ou SVG.", variant: "destructive" });
      return;
    }
    const MAX = 5 * 1024 * 1024;
    if (file.size > MAX) {
      toast({ title: "Arquivo muito grande", description: "Tamanho máximo: 5 MB.", variant: "destructive" });
      return;
    }
    if (!empresaId || !existingId) {
      toast({ title: "Empresa não identificada", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${empresaId}/logo/logo_${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("company-logos")
        .upload(path, file, { contentType: file.type, upsert: true, cacheControl: "3600" });

      if (upErr) {
        console.error("[logo upload] storage error:", { userId: (await supabase.auth.getUser()).data.user?.id, empresaId, path, file: { name: file.name, type: file.type, size: file.size }, error: upErr });
        throw upErr;
      }

      const { data: signed, error: signErr } = await supabase.storage
        .from("company-logos")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr) throw signErr;

      const publicUrl = signed.signedUrl;
      setLogoUrl(publicUrl);

      const { error: updErr } = await (supabase.from as any)("empresa_config")
        .update({ logo_url: publicUrl, logo_path: path })
        .eq("id", existingId);
      if (updErr) {
        // fallback: se coluna logo_path não existir, salva só a URL
        await (supabase.from as any)("empresa_config")
          .update({ logo_url: publicUrl })
          .eq("id", existingId);
      }

      toast({ title: "Logo enviada com sucesso!" });
    } catch (err: any) {
      console.error("[logo upload] falhou:", err);
      const msg = err?.message ?? String(err);
      // "Bucket not found" sozinho não diz nada a quem usa. O bucket é criado
      // por migration; enquanto ela não roda, o envio falha sempre.
      const amigavel = /bucket not found/i.test(msg)
        ? "O espaço de armazenamento das logos ainda não foi criado no banco. Peça para aplicar a migration do bucket company-logos."
        : msg;
      toast({ title: "Erro ao enviar logo", description: amigavel, variant: "destructive" });
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
    // Endereço malformado é descartado na hora do envio, sem aviso nenhum —
    // a notificação simplesmente não chega para aquela pessoa e ninguém fica
    // sabendo. Barrar aqui é o único momento em que dá para mostrar o erro.
    if (emailsCompras.invalidos.length > 0) {
      toast({
        title: "Confira os e-mails para compras",
        description: `Sem formato de e-mail: ${emailsCompras.invalidos.join(", ")}`,
        variant: "destructive",
      });
      return;
    }
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
        <PageHeader
          title="Empresas / Unidades"
          subtitle="Gerencie os dados da empresa, unidades e identidade visual."
        />
        <EmptyState
          icon={Building2}
          title="Você não está vinculado a nenhuma empresa"
          description="Contate o administrador do sistema para vincular seu usuário a uma empresa."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empresas / Unidades"
        subtitle="Gerencie os dados da empresa, unidades e identidade visual."
      />

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
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {logoUrl ? (
                    <div className="relative self-center sm:self-auto">
                      <img
                        src={logoUrl}
                        alt="Logo da empresa"
                        className="w-32 h-32 sm:w-24 sm:h-24 object-contain rounded-lg border border-border bg-white p-2"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        aria-label="Remover logo"
                        className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-full sm:w-24 h-32 sm:h-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/50">
                      <Image className="w-8 h-8 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="flex flex-col gap-2 flex-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full sm:w-auto min-h-[44px]"
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
                  <Input className="min-h-[44px]" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo da empresa" />
                </div>
                <div>
                  <Label>CNPJ</Label>
                  <Input className="min-h-[44px]" value={form.cnpj} onChange={e => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input className="min-h-[44px]" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" />
                </div>
                <div className="sm:col-span-2">
                  <Label>E-mail Principal</Label>
                  <Input className="min-h-[44px]" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="contato@empresa.com" />
                </div>
                <div className="sm:col-span-2">
                  <Label>E-mails para Compras 📧</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Quem recebe automaticamente as notificações de solicitação de materiais.
                    Para mais de uma pessoa, separe por vírgula ou uma por linha — todas recebem
                    o mesmo email, com o PDF em anexo e o link de aprovação.
                  </p>
                  {emailsCompras.validos.length > 1 && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-2">
                      Enviar para mais de um endereço exige domínio verificado na conta de email
                      (resend.com/domains). Sem isso, a Resend recusa o envio inteiro — nem o
                      primeiro da lista recebe.
                    </p>
                  )}
                  {/* Textarea, não Input `type="email"`: aquele campo trata uma
                      lista separada por vírgula como endereço inválido, e uma
                      linha só não comporta seis endereços. */}
                  <Textarea
                    rows={3}
                    value={form.email_compras}
                    onChange={e => setForm({ ...form, email_compras: e.target.value })}
                    placeholder={"compras@empresa.com, engenharia@empresa.com\nseguranca@empresa.com"}
                  />
                  {(emailsCompras.validos.length > 0 || emailsCompras.invalidos.length > 0) && (
                    <p className="text-xs mt-1.5">
                      {emailsCompras.validos.length > 0 && (
                        <span className="text-muted-foreground">
                          {emailsCompras.validos.length} {emailsCompras.validos.length === 1 ? "destinatário" : "destinatários"}
                        </span>
                      )}
                      {emailsCompras.invalidos.length > 0 && (
                        <span className="text-destructive">
                          {emailsCompras.validos.length > 0 ? " · " : ""}
                          sem formato de e-mail: {emailsCompras.invalidos.join(", ")}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <Label>Endereço</Label>
                  <Input className="min-h-[44px]" value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} placeholder="Endereço completo" />
                </div>
              </div>
              <div className="flex justify-end pt-2 sticky bottom-0 bg-card -mx-6 px-6 pb-2 pt-3 border-t sm:static sm:border-0 sm:mx-0 sm:px-0 sm:pt-2">
                <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto min-h-[44px]">
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
