import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, FileText, ShieldCheck } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";

function maskCpf(c?: string | null) {
  if (!c) return "—";
  const d = c.replace(/\D/g, "");
  if (d.length < 11) return "***";
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

export default function VerificarAso() {
  const { hash } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      if (!hash) { setNotFound(true); setLoading(false); return; }
      const { data: v } = await supabase.from("aso_verificacao").select("aso_id").eq("hash", hash).maybeSingle();
      if (!v) { setNotFound(true); setLoading(false); return; }
      const { data: a } = await supabase
        .from("asos")
        .select("numero_aso, tipo_exame, data_emissao, data_vencimento, status, status_aptidao, funcionarios:funcionario_id (nome, cpf), empresa_config:empresa_id (nome, cnpj)")
        .eq("id", v.aso_id).maybeSingle();
      setData(a);
      setLoading(false);
    })();
  }, [hash]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando…</div>;
  if (notFound || !data) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full"><CardContent className="p-6 text-center space-y-2">
        <XCircle className="h-12 w-12 text-destructive mx-auto" />
        <h1 className="text-xl font-bold">Documento não encontrado</h1>
        <p className="text-sm text-muted-foreground">Este link de verificação é inválido ou expirou.</p>
      </CardContent></Card>
    </div>
  );

  const venc = data.data_vencimento ? differenceInDays(parseISO(data.data_vencimento), new Date()) : null;
  const valido = data.status !== "cancelado" && venc !== null && venc >= 0;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="max-w-lg w-full">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Verificação de ASO</h1>
              <p className="text-xs text-muted-foreground">SafetySoluções — Atestado de Saúde Ocupacional</p>
            </div>
          </div>

          <div className={`rounded-lg p-4 flex items-center gap-3 ${valido ? "bg-emerald-500/10 text-emerald-700" : "bg-destructive/10 text-destructive"}`}>
            {valido ? <CheckCircle2 className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
            <div>
              <div className="font-semibold">{valido ? "Documento válido" : (data.status === "cancelado" ? "Documento cancelado" : "Documento vencido")}</div>
              {venc !== null && valido && <div className="text-xs">Faltam {venc} dias para vencer</div>}
            </div>
          </div>

          <div className="text-sm space-y-1 border-t pt-3">
            <div><span className="text-muted-foreground">Número:</span> <strong className="font-mono">{data.numero_aso}</strong></div>
            <div><span className="text-muted-foreground">Empresa:</span> <strong>{data.empresa_config?.nome}</strong></div>
            <div><span className="text-muted-foreground">Funcionário:</span> <strong>{data.funcionarios?.nome}</strong> ({maskCpf(data.funcionarios?.cpf)})</div>
            <div><span className="text-muted-foreground">Tipo:</span> {data.tipo_exame}</div>
            <div><span className="text-muted-foreground">Emissão:</span> {data.data_emissao && format(parseISO(data.data_emissao), "dd/MM/yyyy")}</div>
            <div><span className="text-muted-foreground">Vencimento:</span> {data.data_vencimento && format(parseISO(data.data_vencimento), "dd/MM/yyyy")}</div>
            <div><span className="text-muted-foreground">Aptidão:</span> {data.status_aptidao || "—"}</div>
          </div>

          <p className="text-xs text-muted-foreground italic">Esta página apresenta dados básicos para validação pública. Dados sensíveis estão mascarados.</p>
        </CardContent>
      </Card>
    </div>
  );
}
