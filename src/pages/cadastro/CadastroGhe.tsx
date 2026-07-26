import React from "react";
import { GesExposicoesTab } from "@/components/documentacao/GesExposicoesTab";
import { PageHeader } from "@/components/ui/page-header";

export default function CadastroGhe() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de GES / GHE (Módulo Mestre)"
        description="Consolidação e sincronização única de Grupos Homogêneos de Exposição e Matriz Mestre para PGR, PCMSO, LTCAT e eSocial."
      />
      <GesExposicoesTab />
    </div>
  );
}
