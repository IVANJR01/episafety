import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flame, CheckCircle2, AlertTriangle, ArrowLeft, ClipboardCheck, Wrench, Shield } from "lucide-react";
import { fmtDate } from "@/lib/pdfTimbrado";
import { ExtintorInspecaoDialog } from "./ExtintorInspecaoDialog";

import { carregarExtintorPorTokenLocal } from "@/lib/extintoresStorageFallback";

export default function ExtintorQrView() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const navigate = useNavigate();
  const [extintor, setExtintor] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [inspecaoOpen, setInspecaoOpen] = useState(false);

  const carregarExtintor = async () => {
    if (!qrToken) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase.from as any)("extintores")
        .select("*, empresa_config(nome)")
        .eq("qr_token", qrToken)
        .maybeSingle();

      if (error || !data) {
        // Tenta buscar no fallback local
        const localExt = carregarExtintorPorTokenLocal(qrToken);
        setExtintor(localExt);
      } else {
        setExtintor(data);
      }
    } catch (e) {
      const localExt = carregarExtintorPorTokenLocal(qrToken);
      setExtintor(localExt);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarExtintor();
  }, [qrToken]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-3">
          <Flame className="h-10 w-10 text-red-600 animate-bounce mx-auto" />
          <p className="text-sm font-medium text-muted-foreground">Localizando extintor...</p>
        </div>
      </div>
    );
  }

  if (!extintor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full text-center p-6 space-y-4">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
          <h2 className="text-xl font-bold">Extintor não localizado</h2>
          <p className="text-sm text-muted-foreground">
            O código QR escaneado não corresponde a um extintor cadastrado ou foi desativado.
          </p>
          <Button onClick={() => navigate("/extintores")} variant="outline" className="w-full">
            <ArrowLeft className="h-4 w-4 mr-2" /> Ir para o Painel de Extintores
          </Button>
        </Card>
      </div>
    );
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  let diasParaRecarga: number | null = null;
  if (extintor.data_proxima_recarga) {
    const dt = new Date(extintor.data_proxima_recarga + "T00:00:00");
    diasParaRecarga = Math.round((dt.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  }

  const vencido = diasParaRecarga !== null && diasParaRecarga < 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 max-w-lg mx-auto space-y-4">
      {/* Topo com Identificação */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/extintores")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Painel
        </Button>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <Shield className="h-4 w-4 text-primary" />
          SafetySoluções · NR-23
        </div>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="bg-primary/5 border-b pb-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase">Extintor de Incêndio</span>
              <h1 className="text-3xl font-black text-foreground tracking-tight">{extintor.numero}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {extintor.empresa_config?.nome || "Empresa"}
              </p>
            </div>
            {vencido ? (
              <Badge className="bg-red-600 text-white font-semibold">🔴 VENCIDO</Badge>
            ) : (
              <Badge className="bg-emerald-600 text-white font-semibold">🟢 REGULAR</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-lg text-sm">
            <div>
              <span className="text-xs text-muted-foreground">Agente Extintor</span>
              <p className="font-bold text-foreground">{extintor.agente?.replace(/_/g, " ")}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Capacidade</span>
              <p className="font-bold text-foreground">
                {extintor.capacidade} {extintor.unidade_capacidade}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Setor / Local</span>
              <p className="font-semibold text-foreground">{extintor.local_setor || "Geral"}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Selo Inmetro</span>
              <p className="font-semibold text-foreground">{extintor.selo_inmetro || "—"}</p>
            </div>
          </div>

          {extintor.local_descricao && (
            <div className="text-xs bg-muted/20 p-2.5 rounded border border-border">
              <span className="font-semibold text-muted-foreground">Ponto de Fixação: </span>
              <span className="text-foreground">{extintor.local_descricao}</span>
            </div>
          )}

          <div className="space-y-2 border-t pt-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Próxima Recarga:</span>
              <span className={`font-bold ${vencido ? "text-red-600" : "text-foreground"}`}>
                {fmtDate(extintor.data_proxima_recarga)}
                {diasParaRecarga !== null && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    ({diasParaRecarga < 0 ? `vencido há ${Math.abs(diasParaRecarga)}d` : `em ${diasParaRecarga}d`})
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Próximo Teste Hidrostático:</span>
              <span className="font-semibold text-foreground">
                {fmtDate(extintor.data_proximo_teste_hidrostatico)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Última Inspeção Mensal:</span>
              <span className="font-semibold text-foreground">
                {fmtDate(extintor.data_ultima_inspecao)}
              </span>
            </div>
          </div>

          <Button
            size="lg"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 text-base shadow-sm"
            onClick={() => setInspecaoOpen(true)}
          >
            <ClipboardCheck className="h-5 w-5 mr-2" />
            Realizar Inspeção Mensal Agora
          </Button>
        </CardContent>
      </Card>

      <ExtintorInspecaoDialog
        open={inspecaoOpen}
        onOpenChange={setInspecaoOpen}
        extintor={extintor}
        onSuccess={carregarExtintor}
      />
    </div>
  );
}
