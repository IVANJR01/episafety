import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EPIs from "@/pages/EPIs";
import "@/index.css";

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={qc}>
    <MemoryRouter>
      <div className="min-h-screen bg-background p-6"><EPIs /></div>
    </MemoryRouter>
  </QueryClientProvider>,
);
