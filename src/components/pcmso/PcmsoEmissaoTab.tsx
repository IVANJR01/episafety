import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Download, FileText, Loader2, PlayCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PGR_STATUS_LABEL, PgrStatus } from "@/lib/pgrTypes";

interface PcmsoEmissaoTabProps {
  pcmso: any;
}

export default function PcmsoEmissaoTab({ pcmso }: PcmsoEmissaoTabProps) {
  const perms = usePermissions("pgr");
  const queryClient = useQueryClient();
  const [gerando, setGerando] = useState(false);

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

  const handleGerarPDF = () => {
    // Placeholder para chamada real à Edge Function
    setGerando(true);
    toast.info("Processamento de PDF iniciado no servidor...");
    setTimeout(() => {
      setGerando(false);
      toast.success("Emulação de geração de PDF concluída. Disponível em breve.");
    }, 2500);
  };

  const isRascunho = pcmso.status === "rascunho";
  
  // Condições impeditivas simples
  const semPgr = !pcmso.pgr_base_id;
  const semMedico = !pcmso.medico_coordenador_id;
  const prontoParaAtivar = !semPgr && !semMedico;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="border-t-4 border-t-emerald-600 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-600" /> Revisão e Emissão do Documento
          </CardTitle>
          <CardDescription>
            Etapa final. Verifique se os dados exigidos pela NR-07 estão preenchidos antes de validar 
            este documento e gerar o PDF Oficial assinado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-5 border">
              <h3 className="font-semibold mb-4 text-lg">Checklist de Conformidade</h3>
              
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  {semPgr ? <div className="h-2 w-2 rounded-full bg-red-500 shrink-0" /> : <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />}
                  <span className={semPgr ? "text-muted-foreground" : "font-medium"}>
                    PGR Base Vinculado
                  </span>
                  {semPgr && <span className="text-xs text-red-500 ml-auto">Pendente</span>}
                </li>
                <li className="flex items-center gap-3">
                  {semMedico ? <div className="h-2 w-2 rounded-full bg-red-500 shrink-0" /> : <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />}
                  <span className={semMedico ? "text-muted-foreground" : "font-medium"}>
                    Médico Coordenador Definido
                  </span>
                  {semMedico && <span className="text-xs text-red-500 ml-auto">Pendente</span>}
                </li>
              </ul>
            </div>

            {isRascunho ? (
              <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t">
                {!prontoParaAtivar ? (
                  <p className="text-sm text-red-600 flex-1">
                    Resolva as pendências do checklist acima para liberar a emissão do documento.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground flex-1">
                    Tudo certo! Ao ativar, este PCMSO passará a ditar as regras de saúde para as validações de exames dos funcionários.
                  </p>
                )}
                <Button 
                  onClick={() => ativarMutation.mutate()} 
                  disabled={!prontoParaAtivar || !perms.canEdit || ativarMutation.isPending}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
                >
                  {ativarMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                  Ativar Documento (Vigente)
                </Button>
              </div>
            ) : (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-400 p-6 rounded-lg border border-emerald-200 dark:border-emerald-900/50 flex flex-col items-center justify-center text-center gap-4">
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900 rounded-full">
                  <ShieldCheck className="h-8 w-8 text-emerald-600 dark:text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-1">Documento Valido e {PGR_STATUS_LABEL[pcmso.status as PgrStatus]}</h3>
                  <p className="text-sm opacity-80 max-w-md mx-auto">
                    Este PCMSO já está bloqueado para edições sensíveis para manter o compliance.
                    Qualquer mudança drástica exigirá uma nova revisão.
                  </p>
                </div>
                <Button onClick={handleGerarPDF} disabled={gerando} className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                  {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Imprimir PCMSO em PDF
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
