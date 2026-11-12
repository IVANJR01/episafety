import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EPIs from "@/pages/EPIs";
import InventarioTab from "@/components/pgr/InventarioTab";
import { dadosPorTabela } from "./stubSupabase";
import { inventarioFicticio } from "./stubDados";
import "@/index.css";

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

/* ?tela=inventario monta o inventário de riscos; sem nada, a tela de EPIs. */
const tela = new URLSearchParams(location.search).get("tela");
if (tela === "inventario") dadosPorTabela.pgr_inventario_itens = inventarioFicticio;

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={qc}>
    <MemoryRouter>
      <div className="min-h-screen bg-background p-6">
        {tela === "inventario"
          ? <InventarioTab pgrId="pgr-ficticio" empresaId="emp-ficticia" status={"rascunho" as any} canEdit />
          : <EPIs />}
      </div>
    </MemoryRouter>
  </QueryClientProvider>,
);
