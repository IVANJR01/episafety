import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EPIs from "@/pages/EPIs";
import InventarioTab from "@/components/pgr/InventarioTab";
import SolicitacaoMaterialFormDialog from "@/components/epis/SolicitacaoMaterialFormDialog";
import ScannerDocumento from "@/components/ScannerDocumento";
import AnaliseEpi from "@/components/dashboard/AnaliseEpi";
import { analiseEpiFicticia } from "./stubDados";
import { dadosPorTabela } from "./stubSupabase";
import { inventarioFicticio } from "./stubDados";
import "@/index.css";

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

/* ?tela=inventario: inventário de riscos; ?tela=solicitacao: nova solicitação de materiais; sem nada, a tela de EPIs. */
const tela = new URLSearchParams(location.search).get("tela");
if (tela === "inventario") dadosPorTabela.pgr_inventario_itens = inventarioFicticio;
if (tela === "analise-epi") dadosPorTabela.ghe_ges = analiseEpiFicticia.ghes;
if (tela === "solicitacao") {
  dadosPorTabela.empresa_config = [{ email_compras: "compras@empresa-ficticia.com.br, seguranca@empresa-ficticia.com.br" }];
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={qc}>
    <MemoryRouter>
      <div className="min-h-screen bg-background p-6">
        {tela === "inventario"
          ? <InventarioTab pgrId="pgr-ficticio" empresaId="emp-ficticia" status={"rascunho" as any} canEdit />
          : tela === "analise-epi"
            ? <AnaliseEpi epis={analiseEpiFicticia.epis} entregas={analiseEpiFicticia.entregas} funcionarios={analiseEpiFicticia.funcionarios} />
          : tela === "scanner"
            ? <ScannerDocumento open onCancel={() => {}} onReady={() => {}} nomeSugerido="aso" />
          : tela === "solicitacao"
            ? <SolicitacaoMaterialFormDialog open onOpenChange={() => {}} solicitacaoId={null} onSaved={() => {}} />
            : <EPIs />}
      </div>
    </MemoryRouter>
  </QueryClientProvider>,
);
