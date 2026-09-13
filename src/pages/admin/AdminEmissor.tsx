/*
 * Identificação de quem elabora os documentos técnicos.
 *
 * A capa do PGR leva a marca da empresa coberta no alto e, no rodapé, o
 * crédito de quem elaborou. Esse segundo bloco não tinha onde ser cadastrado:
 * `empresa_config` guarda as empresas atendidas, não quem atende.
 *
 * Fica no painel admin porque é a identidade da operação inteira — aparece
 * impressa em documento que circula fora, e não é dado de uma empresa só.
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Loader2, Save, Upload, Building2, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { carregarEmissor, linhasDoEmissor, EMISSOR_VAZIO, type Emissor } from "@/lib/emissorDocumentos";

const CAMPOS: { chave: keyof Emissor; rotulo: string; dica?: string }[] = [
  { chave: "nome", rotulo: "Razão social *", dica: "Sai em destaque no rodapé da capa." },
  { chave: "slogan", rotulo: "Descrição", dica: "Ex.: Segurança e Saúde Ocupacional." },
  { chave: "cnpj", rotulo: "CNPJ" },
  { chave: "endereco", rotulo: "Endereço", dica: "Uma linha só, como deve sair impresso." },
  { chave: "contato", rotulo: "Contato", dica: "Telefone, e-mail ou os dois." },
];

export default function AdminEmissor() {
  const { user } = useAuth();
  const [emissor, setEmissor] = useState<Emissor>(EMISSOR_VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      const e = await carregarEmissor();
      if (e) setEmissor(e);
      setCarregando(false);
    })();
  }, []);

  const salvar = async () => {
    if (!emissor.nome.trim()) {
      toast({ title: "Informe a razão social", variant: "destructive" });
      return;
    }
    setSalvando(true);
    try {
      const { error } = await (supabase.from as any)("emissor_documentos")
        .update({ ...emissor, updated_at: new Date().toISOString(), updated_by: user?.id })
        .eq("id", true);
      if (error) throw error;
      toast({ title: "Identificação salva", description: "Vale para os próximos documentos gerados." });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e?.message, variant: "destructive" });
    } finally { setSalvando(false); }
  };

  const enviarLogo = async (arquivo: File) => {
    setEnviandoLogo(true);
    try {
      const ext = arquivo.name.split(".").pop()?.toLowerCase() || "png";
      const caminho = `emissor/logo_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("company-logos")
        .upload(caminho, arquivo, { contentType: arquivo.type, upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;
      // URL assinada de um ano, como já é feito com a logo das empresas.
      const { data: assinada, error: sErr } = await supabase.storage
        .from("company-logos").createSignedUrl(caminho, 60 * 60 * 24 * 365);
      if (sErr) throw sErr;
      setEmissor((e) => ({ ...e, logo_url: assinada.signedUrl, logo_path: caminho }));
      toast({ title: "Logo enviada", description: "Salve para valer nos documentos." });
    } catch (e: any) {
      toast({ title: "Erro ao enviar a logo", description: e?.message, variant: "destructive" });
    } finally { setEnviandoLogo(false); }
  };

  if (carregando) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }

  const previa = linhasDoEmissor(emissor);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl">
      <PageHeader
        title="Quem elabora os documentos"
        subtitle="Sai no rodapé da capa do PGR e dos demais documentos técnicos."
      />

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start gap-4">
            <div className="h-20 w-20 shrink-0 rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden">
              {emissor.logo_url
                ? <img src={emissor.logo_url} alt="Logo de quem elabora" className="h-full w-full object-contain" />
                : <Building2 className="h-7 w-7 text-muted-foreground" />}
            </div>
            <div className="space-y-2">
              <input ref={arquivoRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void enviarLogo(f); }} />
              <Button variant="outline" size="sm" disabled={enviandoLogo}
                onClick={() => arquivoRef.current?.click()}>
                {enviandoLogo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {emissor.logo_url ? "Trocar logo" : "Enviar logo"}
              </Button>
              {emissor.logo_url && (
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"
                  onClick={() => setEmissor((e) => ({ ...e, logo_url: null, logo_path: null }))}>
                  <Trash2 className="w-4 h-4 mr-2" />Remover
                </Button>
              )}
              <p className="text-[11px] text-muted-foreground">PNG ou JPG. Fundo claro sai melhor no papel.</p>
            </div>
          </div>

          {CAMPOS.map(({ chave, rotulo, dica }) => (
            <div key={chave}>
              <Label>{rotulo}</Label>
              <Input className="mt-1" value={(emissor[chave] as string) || ""}
                onChange={(e) => setEmissor((v) => ({ ...v, [chave]: e.target.value }))} />
              {dica && <p className="text-[11px] text-muted-foreground mt-1">{dica}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Prévia do que sai impresso: o rodapé monta só com o que está
          preenchido, e ver isso agora evita descobrir no PDF. */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Como sai no rodapé da capa</p>
          <div className="rounded-lg border-t-2 pt-3 flex items-start gap-3">
            {emissor.logo_url && (
              <img src={emissor.logo_url} alt="" className="h-10 w-10 object-contain shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-bold text-sm">{emissor.nome || "Razão social"}</p>
              {previa.map((l) => (
                <p key={l} className="text-[11px] text-muted-foreground break-words">{l}</p>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={salvar} disabled={salvando}>
          {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}
