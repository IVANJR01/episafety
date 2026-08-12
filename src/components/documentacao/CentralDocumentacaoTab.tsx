import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, ArrowRight, FileSpreadsheet, FileText, Loader2,
  ShieldCheck, Stethoscope, Users, ClipboardList,
} from "lucide-react";

interface Props {
  /** Mantido por compatibilidade; a lista navega por rota própria de cada módulo. */
  onNavigateSubmodulo?: (submodulo: string) => void;
}

/**
 * Lista dos documentos legais da empresa.
 *
 * Cada linha mostra APENAS contagens reais consultadas no banco. Antes esta tela
 * exibia números e nomes fixos no código — "24 Agentes", "Dr. Roberto Lima",
 * "12 Exames Mapeados", "8 Agentes", "01 Função Elegível" — que não vinham de
 * lugar nenhum. Um responsável técnico inexistente aparecia como se estivesse
 * cadastrado, e o fluxo de 6 etapas tinha os status "concluído"/"em andamento"
 * escritos à mão, independentes do estado real de qualquer documento.
 */
export function CentralDocumentacaoTab(_props: Props = {}) {
  const navigate = useNavigate();
  const { empresaId } = useAuth();

  const { data: c, isLoading } = useQuery({
    queryKey: ["doc-contagens", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      /** Devolve null (e não 0) quando a consulta falha: "não sei" difere de "nenhum". */
      const conta = async (tabela: string, extra?: [string, string]) => {
        let q = (supabase.from as any)(tabela)
          .select("id", { count: "exact", head: true }).eq("empresa_id", empresaId);
        if (extra) q = q.eq(extra[0], extra[1]);
        const { count, error } = await q;
        return error ? null : (count ?? 0);
      };
      const [pgr, pgrVigentes, aso, ltcat, ppp, os] = await Promise.all([
        conta("pgr_documentos"),
        conta("pgr_documentos", ["status", "vigente"]),
        conta("asos"),
        conta("ltcat_documentos"),
        conta("ppp_documentos"),
        conta("ordens_servico_sst"),
      ]);
      return { pgr, pgrVigentes, aso, ltcat, ppp, os };
    },
  });

  const DOCS = [
    {
      key: "pgr", nome: "PGR", norma: "NR-01",
      descricao: "Programa de Gerenciamento de Riscos",
      icone: FileText, cor: "text-emerald-600",
      total: c?.pgr, vigentes: c?.pgrVigentes,
      abrir: () => navigate("/pgr"),
    },
    {
      key: "pcmso", nome: "PCMSO", norma: "NR-07",
      descricao: "Controle Médico de Saúde Ocupacional",
      icone: Stethoscope, cor: "text-blue-600",
      total: c?.aso, rotulo: "ASO(s)",
      abrir: () => navigate("/aso"),
    },
    {
      key: "ltcat", nome: "LTCAT", norma: "Lei 8.213",
      descricao: "Laudo Técnico das Condições Ambientais do Trabalho",
      icone: ShieldCheck, cor: "text-purple-600",
      total: c?.ltcat,
      abrir: () => navigate("/ltcat"),
    },
    {
      key: "os", nome: "Ordem de Serviço", norma: "CLT / NR-01",
      descricao: "Instruções de segurança e ciência de riscos",
      icone: ClipboardList, cor: "text-teal-600",
      total: c?.os,
      abrir: () => navigate("/programas/ordem-servico"),
    },
    {
      key: "insalubridade", nome: "Laudo de Insalubridade", norma: "NR-15",
      descricao: "Caracterização de atividades insalubres",
      icone: FileSpreadsheet, cor: "text-amber-600",
      abrir: () => navigate("/programas/laudo-insalubridade"),
    },
    {
      key: "periculosidade", nome: "Laudo de Periculosidade", norma: "NR-16",
      descricao: "Caracterização de atividades perigosas",
      icone: AlertTriangle, cor: "text-red-600",
      abrir: () => navigate("/programas/laudo-periculosidade"),
    },
    {
      key: "ppp", nome: "PPP", norma: "eSocial",
      descricao: "Perfil Profissiográfico Previdenciário",
      icone: Users, cor: "text-indigo-600",
      total: c?.ppp,
      abrir: () => navigate("/ppp"),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Aqui se escolhe o TIPO a elaborar; a lista abaixo é o que já existe.
          As duas seções tinham o mesmo título e botões concorrentes de criar. */}
      <div>
        <h2 className="text-lg font-semibold">Tipos de documento</h2>
        <p className="text-sm text-muted-foreground">
          Escolha por onde começar. O número ao lado é quanto já existe de cada tipo.
        </p>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-8 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando documentos…
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {DOCS.map((d) => {
            const Icone = d.icone;
            return (
              <Card 
                key={d.key} 
                className="group hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 border-border/60 bg-card overflow-hidden flex flex-col cursor-pointer"
                onClick={d.abrir}
              >
                <CardContent className="p-0 flex flex-col h-full">
                  
                  {/* Cabeçalho do Cartão */}
                  <div className="p-5 pb-4 flex justify-between items-start">
                    <div className="p-3 rounded-2xl bg-muted/60 group-hover:bg-primary/5 transition-colors">
                      <Icone className={`h-6 w-6 ${d.cor}`} />
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-mono tracking-widest font-semibold uppercase bg-secondary/40 text-secondary-foreground/70">
                      {d.norma}
                    </Badge>
                  </div>

                  {/* Corpo / Informações */}
                  <div className="px-5 pb-6 flex-1">
                    <h3 className="text-lg font-bold tracking-tight text-foreground/90 group-hover:text-primary transition-colors">
                      {d.nome}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed line-clamp-2">
                      {d.descricao}
                    </p>
                  </div>

                  {/* Rodapé com Contador e Ação */}
                  <div className="px-5 py-4 bg-muted/20 border-t border-border/40 flex items-center justify-between mt-auto">
                    <div className="flex flex-col">
                      <span className="text-2xl font-black leading-none text-foreground/80">
                        {d.total == null ? "0" : d.total}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mt-1.5">
                        {d.rotulo || "documento(s)"} {d.vigentes ? `(${d.vigentes} em vigor)` : ""}
                      </span>
                    </div>
                    
                    <Button 
                      size="sm" 
                      className="rounded-full px-4 bg-background shadow-sm hover:bg-primary hover:text-primary-foreground transition-all group-hover:scale-105" 
                      variant="outline"
                    >
                      Acessar <ArrowRight className="h-4 w-4 ml-1.5 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>

                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

    </div>
  );
}
