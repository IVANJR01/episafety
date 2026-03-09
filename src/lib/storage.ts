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
}

export interface Entrega {
  id: string;
  funcionarioId: string;
  epiId: string;
  quantidade: number;
  data: string;
  observacao: string;
}

function getItems<T>(key: string): T[] {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

function setItems<T>(key: string, items: T[]) {
  localStorage.setItem(key, JSON.stringify(items));
}

export const epiStorage = {
  getAll: () => getItems<EPI>("epis"),
  save: (items: EPI[]) => setItems("epis", items),
  add: (item: EPI) => { const all = epiStorage.getAll(); all.push(item); epiStorage.save(all); },
  update: (item: EPI) => { const all = epiStorage.getAll().map(e => e.id === item.id ? item : e); epiStorage.save(all); },
  delete: (id: string) => { epiStorage.save(epiStorage.getAll().filter(e => e.id !== id)); },
};

export const funcionarioStorage = {
  getAll: () => getItems<Funcionario>("funcionarios"),
  save: (items: Funcionario[]) => setItems("funcionarios", items),
  add: (item: Funcionario) => { const all = funcionarioStorage.getAll(); all.push(item); funcionarioStorage.save(all); },
  update: (item: Funcionario) => { const all = funcionarioStorage.getAll().map(e => e.id === item.id ? item : e); funcionarioStorage.save(all); },
  delete: (id: string) => { funcionarioStorage.save(funcionarioStorage.getAll().filter(e => e.id !== id)); },
};

export const entregaStorage = {
  getAll: () => getItems<Entrega>("entregas"),
  save: (items: Entrega[]) => setItems("entregas", items),
  add: (item: Entrega) => {
    const all = entregaStorage.getAll();
    all.push(item);
    entregaStorage.save(all);
    // Decrease stock
    const epis = epiStorage.getAll();
    const epi = epis.find(e => e.id === item.epiId);
    if (epi) {
      epi.estoque -= item.quantidade;
      epiStorage.save(epis.map(e => e.id === epi.id ? epi : e));
    }
  },
  delete: (id: string) => { entregaStorage.save(entregaStorage.getAll().filter(e => e.id !== id)); },
};
