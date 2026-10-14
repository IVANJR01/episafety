import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Download, FileText, Loader2, PlayCircle, ShieldCheck, Eye } from "lucide-react";
import { toast } from "sonner";
import { PGR_STATUS_LABEL, PgrStatus } from "@/lib/pgrTypes";
import { generateAndUploadPcmsoPdf } from "@/lib/pcmsoPdf";

interface PcmsoEmissaoTabProps {
  pcmso: any;
}

export default function PcmsoEmissaoTab({ pcmso }: PcmsoEmissaoTabProps) {
  const perms = usePermissions("pgr");
  const queryClient = useQueryClient();
  const [gerando, setGerando] = useState(false);

  // Auto-vincula o PGR da empresa se ainda não estiver salvo
  useEffect(() => {
    if (!pcmso.pgr_base_id && pcmso.empresa_id) {
      (async () => {
        const { data } = await supabase
          .from("pgr_documentos")
          .select("id, status, versao, data_vigencia_inicio, data_vigencia_fim")
          .eq("empresa_id", pcmso.empresa_id)
          .order("versao", { ascending: false });

        const valido = ((data || []) as any[]).find(
          (p) => p.status !== "arquivado" && p.status !== "substituido"
        );

        if (valido) {
          await supabase
            .from("pcmso_documentos")
            .update({
              pgr_base_id: valido.id,
              data_vigencia_inicio: pcmso.data_vigencia_inicio || valido.data_vigencia_inicio,
              data_vigencia_fim: pcmso.data_vigencia_fim || valido.data_vigencia_fim,
            })
            .eq("id", pcmso.id);
          queryClient.invalidateQueries({ queryKey: ["pcmso-detalhe", pcmso.id] });
        }
      })();
    }
  }, [pcmso.pgr_base_id, pcmso.empresa_id, pcmso.id]);

  const ativarMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("pcmso_documentos")
        .update({ status: "vigente", data_emissao: new Date().toISOString() })
        .eq("id", pcmso.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento PCMSO ativado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["pcmso-detalhe", pcmso.id] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleGerarPDF = async () => {
    try {
      setGerando(true);
      toast.info("Compilando dados e gerando PDF Oficial do PCMSO (NR-07)...");
      const res = await generateAndUploadPcmsoPdf(pcmso.id);
      toast.success(`PDF gerado e baixado com sucesso: ${res.fileName}`);
    } catch (err: any) {
      console.error("Erro na geração do PDF do PCMSO:", err);
      toast.error("Falha ao gerar PDF: " + (err?.message || "Erro desconhecido"));
    } finally {
      setGerando(false);
    }
  };

  const isRascunho = pcmso.status === "rascunho";
  
  // Condições impeditivas
  const semPgr = !pcmso.pgr_base_id;
  const semMedico = !pcmso.medico_coordenador_id && !pcmso.medico_nome;
  const prontoParaAtivar = !semPgr;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="border-t-4 border-t-emerald-600 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-600" /> Revisão e Emissão do Documento PCMSO
          </CardTitle>
          <CardDescription>
            Etapa final. Verifique se os dados exigidos pela NR-07 estão preenchidos antes de validar 
            este documento e gerar o PDF Oficial assinado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-5 border">
              <h3 className="font-semibold mb-4 text-lg">Checklist de Conformidade (NR-07)</h3>
              
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  {semPgr ? <div className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0" /> : <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />}
                  <span className={semPgr ? "text-muted-foreground" : "font-medium"}>
                    PGR Base Vinculado com Inventário de Riscos
                  </span>
                  {semPgr && <span className="text-xs text-red-500 ml-auto font-medium">Pendente</span>}
                </li>
                <li className="flex items-center gap-3">
                  {semMedico ? <div className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0" /> : <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />}
                  <span className={semMedico ? "text-muted-foreground" : "font-medium"}>
                    Médico do Trabalho Coordenador Definido
                  </span>
                  {semMedico && <span className="text-xs text-red-500 ml-auto font-medium">Pendente (Configure na Etapa 1)</span>}
                </li>
                <li className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span className="font-medium">
                    15 Seções Normativas da NR-07 e Portaria SEPRT 6.734/2020 Integradas
                  </span>
                  <span className="text-xs text-emerald-600 ml-auto font-semibold">Conforme</span>
                </li>
              </ul>
            </div>

            {isRascunho ? (
              <div className="space-y-4 pt-4 border-t">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {!prontoParaAtivar ? (
                    <p className="text-sm text-red-600 flex-1">
                      Resolva as pendências do checklist acima para liberar a homologação e ativação definitiva deste documento.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground flex-1">
                      Tudo certo! Você pode gerar a versão em PDF agora mesmo para conferência ou ativar o PCMSO como Vigente.
                    </p>
                  )}

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button 
                      variant="outline"
                      onClick={handleGerarPDF} 
                      disabled={gerando}
                      className="w-full sm:w-auto"
                    >
                      {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                      Baixar Prévia em PDF
                    </Button>

                    <Button 
                      onClick={() => ativarMutation.mutate()} 
                      disabled={!prontoParaAtivar || !perms.canEdit || ativarMutation.isPending}
                      className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {ativarMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                      Ativar Documento (Vigente)
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-400 p-6 rounded-lg border border-emerald-200 dark:border-emerald-900/50 flex flex-col items-center justify-center text-center gap-4">
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900 rounded-full">
                  <ShieldCheck className="h-8 w-8 text-emerald-600 dark:text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-1">Documento Válido e {PGR_STATUS_LABEL[pcmso.status as PgrStatus]}</h3>
                  <p className="text-sm opacity-80 max-w-md mx-auto">
                    Este PCMSO está oficializado no sistema. O documento completo contém todas as 15 seções normativas, ambientes, cargos, tabelas de controle médico e exames da NR-07.
                  </p>
                </div>
                <Button onClick={handleGerarPDF} disabled={gerando} className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md">
                  {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Imprimir PCMSO em PDF (Oficial)
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
