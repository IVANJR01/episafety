export interface EPI {
  id: string;
  nome: string;
  ca: string;
  validade: string;
  estoque: number;
  estoqueMinimo: number;
  categoria: string;
}

export interface Funcionario {
  id: string;
  nome: string;
  matricula: string;
  setor: string;
  cargo: string;
  dataAdmissao: string;
}

export interface Entrega {
  id: string;
  funcionarioId: string;
  epiId: string;
  quantidade: number;
  data: string;
  tipo: "entrega" | "troca" | "devolucao";
  observacao: string;
  status: "ativo" | "devolvido" | "trocado";
}

export interface Inspecao {
  id: string;
  titulo: string;
  local: string;
  responsavel: string;
  data: string;
  status: "pendente" | "em_andamento" | "concluida";
  itens: InspecaoItem[];
  observacao: string;
}

export interface InspecaoItem {
  id: string;
  descricao: string;
  conforme: boolean | null;
  observacao: string;
}

export interface Treinamento {
  id: string;
  nome: string;
  descricao: string;
  instrutor: string;
  data: string;
  cargaHoraria: number;
  validade: string;
  participantes: string[]; // funcionarioIds
  status: "agendado" | "realizado" | "cancelado";
}

export interface OrdemServico {
  id: string;
  numero: string;
  titulo: string;
  descricao: string;
  funcionarioId: string;
  setor: string;
  riscos: string;
  epis: string;
  data: string;
  status: "emitida" | "assinada" | "cancelada";
}

export interface Exame {
  id: string;
  funcionarioId: string;
  tipo: "admissional" | "periodico" | "demissional" | "retorno" | "mudanca_funcao";
  data: string;
  dataVencimento: string;
  resultado: "apto" | "inapto" | "apto_com_restricao" | "pendente";
  medico: string;
  observacao: string;
}

// Generic storage helpers
function getItems<T>(key: string): T[] {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

function setItems<T>(key: string, items: T[]) {
  localStorage.setItem(key, JSON.stringify(items));
}

function createStorage<T extends { id: string }>(key: string) {
  return {
    getAll: () => getItems<T>(key),
    save: (items: T[]) => setItems(key, items),
    add: (item: T) => {
      const all = getItems<T>(key);
      all.push(item);
      setItems(key, all);
    },
    update: (item: T) => {
      const all = getItems<T>(key).map(e => e.id === item.id ? item : e);
      setItems(key, all);
    },
    delete: (id: string) => {
      setItems(key, getItems<T>(key).filter(e => e.id !== id));
    },
  };
}

export const epiStorage = createStorage<EPI>("epis");
export const funcionarioStorage = createStorage<Funcionario>("funcionarios");
export const inspecaoStorage = createStorage<Inspecao>("inspecoes");
export const treinamentoStorage = createStorage<Treinamento>("treinamentos");
export const ordemServicoStorage = createStorage<OrdemServico>("ordensServico");
export const exameStorage = createStorage<Exame>("exames");

export const entregaStorage = {
  ...createStorage<Entrega>("entregas"),
  add: (item: Entrega) => {
    const all = getItems<Entrega>("entregas");
    all.push(item);
    setItems("entregas", all);
    // Adjust stock for entrega/devolucao
    if (item.tipo === "entrega" || item.tipo === "troca") {
      const epis = epiStorage.getAll();
      const epi = epis.find(e => e.id === item.epiId);
      if (epi) {
        epi.estoque -= item.quantidade;
        epiStorage.save(epis.map(e => e.id === epi.id ? epi : e));
      }
    } else if (item.tipo === "devolucao") {
      const epis = epiStorage.getAll();
      const epi = epis.find(e => e.id === item.epiId);
      if (epi) {
        epi.estoque += item.quantidade;
        epiStorage.save(epis.map(e => e.id === epi.id ? epi : e));
      }
    }
  },
};
