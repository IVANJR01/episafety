import React from "react";
import { EstruturaOcupacionalTab } from "@/components/documentacao/EstruturaOcupacionalTab";
import { Network, Building2 } from "lucide-react";

/**
 * Página principal de Estrutura Ocupacional & GES do Cadastro Mestre.
 *
 * Desacoplada da Central de Documentação SST para que o usuário gerencie
 * a estrutura mestre da empresa (Estabelecimentos, Setores, Funções e GES)
 * sem poluição visual de catálogos de laudos (PGR, PCMSO, LTCAT) que pertencem
 * exclusivamente à Gestão SST.
 */
export default function EstruturaOcupacionalPage() {
  return (
    <div className="tela-larga p-4 md:p-6 space-y-6 pb-10">
      <div className="border-b pb-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          <span className="flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-primary" /> Cadastro Mestre
          </span>
          <span>/</span>
          <span className="text-primary font-bold">Estrutura Ocupacional & GES</span>
        </div>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground">
          <Network className="h-6 w-6 text-primary" />
          Estrutura Ocupacional & GES
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Cadastre e gerencie os estabelecimentos, setores, funções e grupos homogêneos de exposição (GES) da empresa.
          Estes dados mestres são utilizados por todos os módulos do sistema.
        </p>
      </div>

      <div className="pt-2">
        <EstruturaOcupacionalTab />
      </div>
    </div>
  );
}
