import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, ShieldAlert, Camera, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import SignatureCanvas from "@/components/SignatureCanvas";
import CameraCapture from "@/components/CameraCapture";
import { optimizePhotoDataUrl } from "@/lib/gerarFichaEPI";

interface EntregaPendente {
  id: string;
  data: string;
  tipo: string;
  quantidade: number;
  epi_nome: string;
  epi_ca: string | null;
}

interface DadosFuncionario {
  ok: boolean;
  erro?: string;
  funcionario_nome?: string;
  entregas?: EntregaPendente[];
}

export default function AssinaturaRemota() {
  const { id: funcionario_id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<DadosFuncionario | null>(null);

  // Sign mode
  const [signMode, setSignMode] = useState<"assinatura" | "facial">("assinatura");
  const sigRef = useRef<any>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    async function loadPendencias() {
      if (!funcionario_id) {
        setErro("Link inválido.");
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await (supabase.rpc as any)("consultar_entregas_pendentes_publico", {
          p_funcionario_id: funcionario_id,
        });

        if (error) throw error;
        if (!data || !data.ok) throw new Error(data?.erro || "Não foi possível carregar as pendências.");

        setDados(data);
      } catch (err: any) {
        setErro(err.message || "Erro inesperado ao carregar.");
      } finally {
        setLoading(false);
      }
    }

    loadPendencias();
  }, [funcionario_id]);

  const handleSave = async () => {
    if (!funcionario_id) return;
    setSaving(true);

    try {
      let assinaturaColaborador: string | null = null;
      let fotoFallbackDataUrl: string | null = null;

      if (signMode === "facial") {
        if (!capturedPhoto) {
          throw new Error("Tire a foto antes de salvar.");
        }
        assinaturaColaborador = "RECONHECIMENTO_FACIAL";
        fotoFallbackDataUrl = await optimizePhotoDataUrl(capturedPhoto);
      } else {
        assinaturaColaborador = sigRef.current?.getDataURL() || null;
        if (!assinaturaColaborador) {
          throw new Error("Desenhe sua assinatura antes de salvar.");
        }
      }

      const { data, error } = await (supabase.rpc as any)("assinar_entregas_publico", {
        p_funcionario_id: funcionario_id,
        p_assinatura: assinaturaColaborador,
        p_foto_url: fotoFallbackDataUrl,
      });

      if (error) throw error;
      if (!data || !data.ok) throw new Error(data?.erro || "Falha ao registrar assinatura.");

      setSucesso(true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse">Carregando pendências...</p>
      </div>
    );
  }

  if (erro || !dados || !dados.entregas || dados.entregas.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="max-w-md w-full shadow-lg border-muted">
          <CardContent className="p-6 text-center space-y-3">
            {erro ? (
              <ShieldAlert className="h-12 w-12 text-destructive mx-auto" />
            ) : (
              <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
            )}
            <h1 className="text-xl font-bold">{erro ? "Ops!" : "Tudo Certo!"}</h1>
            <p className="text-muted-foreground">
              {erro || "Você não possui EPIs pendentes de assinatura no momento."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (sucesso) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="max-w-md w-full shadow-lg border-muted">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
            <h1 className="text-2xl font-bold text-foreground">Assinatura Concluída!</h1>
            <p className="text-muted-foreground">
              Obrigado, {dados.funcionario_nome}. Seu registro foi salvo com sucesso.
              Você já pode fechar esta tela.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background md:bg-muted/30 md:py-8">
      <div className="flex-1 w-full max-w-2xl mx-auto md:shadow-xl md:rounded-xl md:border md:border-border bg-background flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-primary p-6 text-primary-foreground text-center">
          <h1 className="text-xl font-bold tracking-tight">Confirmação de Recebimento</h1>
          <p className="text-primary-foreground/80 text-sm mt-1">EPIs pendentes para assinatura</p>
        </div>

        <div className="p-4 md:p-6 flex-1 overflow-y-auto space-y-6">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Colaborador</p>
            <p className="font-semibold text-lg">{dados.funcionario_nome}</p>
          </div>

          <div className="space-y-3">
            <h3 className="font-medium flex items-center gap-2">
              <span className="bg-muted px-2 py-0.5 rounded text-xs font-bold">{dados.entregas.length}</span>
              Itens aguardando assinatura
            </h3>
            
            <div className="space-y-2">
              {dados.entregas.map((e) => (
                <div key={e.id} className="p-3 rounded-lg border border-border bg-muted/30 text-sm">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <span className="font-medium text-foreground">{e.epi_nome}</span>
                    <StatusBadge tone="warning" size="sm">Pendente</StatusBadge>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>Qtd: <strong>{e.quantidade}</strong></span>
                    {e.epi_ca && <span>CA: {e.epi_ca}</span>}
                    <span>Data: {new Date(e.data).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border">
            <h3 className="font-medium text-center">Como deseja assinar?</h3>
            <div className="flex bg-muted p-1 rounded-lg">
              <button
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-colors ${signMode === "assinatura" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setSignMode("assinatura")}
              >
                <PenLine className="w-4 h-4" />
                Desenhar
              </button>
              <button
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-colors ${signMode === "facial" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setSignMode("facial")}
              >
                <Camera className="w-4 h-4" />
                Foto (Selfie)
              </button>
            </div>

            <div className="mt-4 border rounded-xl overflow-hidden bg-background">
              {signMode === "assinatura" ? (
                <div className="p-1">
                  <SignatureCanvas
                    ref={sigRef}
                    onClear={() => {}}
                  />
                  <p className="text-[10px] text-center text-muted-foreground mt-2 mb-1 uppercase tracking-widest">
                    Assine acima
                  </p>
                </div>
              ) : (
                <div className="p-1">
                  <CameraCapture
                    onCapture={setCapturedPhoto}
                    capturedPhoto={capturedPhoto}
                    onClear={() => setCapturedPhoto(null)}
                  />
                  {!capturedPhoto && (
                    <p className="text-[10px] text-center text-muted-foreground mt-2 mb-1 uppercase tracking-widest">
                      Tire uma selfie segurando o EPI
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border bg-muted/10">
          <Button
            size="lg"
            className="w-full h-12 text-base font-bold shadow-lg"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
            Confirmar e Assinar
          </Button>
          <p className="text-center text-xs text-muted-foreground mt-3">
            Ao assinar, você confirma o recebimento dos itens listados acima em perfeito estado.
          </p>
        </div>
      </div>
    </div>
  );
}
