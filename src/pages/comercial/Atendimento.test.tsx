import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Atendimento from "./Atendimento";
import type { ConfigLinha, Contato, Mensagem } from "@/lib/whatsappDados";

/**
 * O que este teste protege são as duas regras que custam dinheiro quando
 * quebram, e que não aparecem em compilação nenhuma:
 *
 * 1. Fora da janela de 24h da Meta, o campo de escrita não pode existir. Se
 *    existir, a pessoa escreve a resposta inteira e só descobre no envio que a
 *    Meta recusou — e a tentativa já foi contada.
 * 2. Numa conversa em que a IA ainda responde, a tela precisa dizer isso antes
 *    de alguém digitar. Os dois respondendo a mesma mensagem é o pior defeito
 *    possível neste produto: o cliente vê duas respostas diferentes.
 */

const config: ConfigLinha = {
  id: "cfg-1",
  empresa_id: "emp-1",
  phone_number_id: "LINHA1",
  numero_exibicao: "+55 85 99999-9999",
  automacao_ativa: true,
  prompt_extra: null,
  saudacao: null,
};

const agora = Date.now();
const horas = (n: number) => new Date(agora - n * 3600_000).toISOString();

const contatoRecente: Contato = {
  id: "c-1",
  wa_id: "5585988887777",
  nome: "Maria da Obra",
  cliente_comercial_id: null,
  automacao_ativa: false,
  ultima_entrada_em: horas(2),
  ultima_mensagem_em: horas(2),
};

const contatoAntigo: Contato = {
  ...contatoRecente,
  id: "c-2",
  wa_id: "5585977776666",
  nome: "João do Canteiro",
  ultima_entrada_em: horas(30),
  ultima_mensagem_em: horas(30),
};

const contatoComIa: Contato = { ...contatoRecente, id: "c-3", nome: "Pedro Novo", automacao_ativa: true };

const mensagens: Mensagem[] = [
  { id: "m1", direcao: "entrada", texto: "Quanto custa um PGR?", origem: null, status: null, erro: null, created_at: horas(2) },
  { id: "m2", direcao: "saida", texto: "Depende do porte da empresa.", origem: "ia", status: "enviado", erro: null, created_at: horas(2) },
];

const enviarMensagem = vi.fn().mockResolvedValue(undefined);
let configAtual: ConfigLinha | null = config;
let contatos: Contato[] = [];

vi.mock("@/lib/whatsappDados", () => ({
  lerConfigWhatsapp: () => Promise.resolve(configAtual),
  listarContatos: () => Promise.resolve(contatos),
  listarMensagens: () => Promise.resolve(mensagens),
  definirAutomacaoDoContato: vi.fn().mockResolvedValue(undefined),
  salvarConfigWhatsapp: vi.fn().mockResolvedValue(undefined),
  enviarMensagem: (...args: unknown[]) => enviarMensagem(...args),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ empresaId: "emp-1", isSuperAdmin: true }),
}));

// O canal de Realtime abriria uma conexão de verdade; a tela só precisa saber
// que cancela ao sair.
vi.mock("@/lib/realtimeTabelas", () => ({ assinarTabela: () => () => {} }));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function montar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Atendimento />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  configAtual = config;
  contatos = [contatoRecente, contatoAntigo, contatoComIa];
  enviarMensagem.mockClear();
});

describe("tela de atendimento", () => {
  it("lista as conversas e abre a escolhida", async () => {
    montar();
    await screen.findByText("Maria da Obra");

    fireEvent.click(screen.getByText("Maria da Obra"));

    expect(await screen.findByText("Quanto custa um PGR?")).toBeInTheDocument();
    expect(screen.getByText("Depende do porte da empresa.")).toBeInTheDocument();
    // Quem respondeu precisa estar visível: a equipe tem de saber o que a IA
    // já disse antes de continuar a conversa.
    expect(screen.getByText(/IA ·/)).toBeInTheDocument();
  });

  it("deixa escrever e envia dentro da janela de 24h", async () => {
    montar();
    fireEvent.click(await screen.findByText("Maria da Obra"));

    const campo = await screen.findByPlaceholderText("Escreva a resposta…");
    fireEvent.change(campo, { target: { value: "Bom dia! Já te mando a proposta." } });
    fireEvent.click(screen.getByLabelText("Enviar"));

    await waitFor(() => {
      expect(enviarMensagem).toHaveBeenCalledWith("c-1", "Bom dia! Já te mando a proposta.");
    });
  });

  it("some com o campo de escrita quando a janela de 24h fechou", async () => {
    montar();
    fireEvent.click(await screen.findByText("João do Canteiro"));

    expect(await screen.findByText(/template aprovado/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Escreva a resposta…")).not.toBeInTheDocument();
  });

  it("avisa que a IA ainda responde antes de alguém digitar por cima", async () => {
    montar();
    fireEvent.click(await screen.findByText("Pedro Novo"));

    expect(await screen.findByText("IA respondendo")).toBeInTheDocument();
    expect(screen.getByText(/assuma no botão acima/i)).toBeInTheDocument();
  });

  it("explica o que fazer quando a linha nem foi configurada", async () => {
    configAtual = null;
    contatos = [];
    montar();

    expect(await screen.findByText("Nenhuma linha de WhatsApp configurada")).toBeInTheDocument();
    expect(screen.getByText(/WHATSAPP_AUTOMACAO\.md/)).toBeInTheDocument();
  });
});
