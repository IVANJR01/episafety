export interface SeedObra {
  id: string;
  empresa_id: string;
  nome: string;
  codigo: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  status: string;
  observacoes: string | null;
  created_at: string;
}

export const SEED_OBRAS: SeedObra[] = [
  // --- CG3 ENGENHARIA LTDA & RIO GRANDE DO NORTE ---
  {
    id: "obra-cg3-001",
    empresa_id: "75447c33-0960-46db-ba59-00327575fe44",
    nome: "SE 69 KV BARROCAS",
    codigo: "OBR-001",
    endereco: "Subestação Barrocas",
    cidade: "Barrocas",
    uf: "RN",
    status: "ATIVA",
    observacoes: "Subestação 69 kV Barrocas — CG3 Engenharia",
    created_at: "2026-06-01T10:00:00Z"
  },
  {
    id: "obra-cg3-002",
    empresa_id: "814c58d9-17c9-4e18-8d19-9d0e07210834",
    nome: "SE 69 KV ESTREITO",
    codigo: "OBR-002",
    endereco: "Subestação Estreito",
    cidade: "Estreito",
    uf: "RN",
    status: "ATIVA",
    observacoes: "Subestação 69 kV Estreito — CG3 Engenharia / RN",
    created_at: "2026-06-01T10:00:00Z"
  },
  {
    id: "obra-cg3-003",
    empresa_id: "814c58d9-17c9-4e18-8d19-9d0e07210834",
    nome: "SE JARDIM DE PIRANHAS",
    codigo: "OBR-003",
    endereco: "Subestação Jardim de Piranhas",
    cidade: "Jardim de Piranhas",
    uf: "RN",
    status: "ATIVA",
    observacoes: "Subestação Jardim de Piranhas — CG3 Engenharia / RN",
    created_at: "2026-06-01T10:00:00Z"
  },
  {
    id: "obra-cg3-004",
    empresa_id: "75447c33-0960-46db-ba59-00327575fe44",
    nome: "ALOJAMENTO - ALTO RODRIGUES",
    codigo: "OBR-004",
    endereco: "Alojamento Alto Rodrigues",
    cidade: "Alto Rodrigues",
    uf: "RN",
    status: "ATIVA",
    observacoes: "Alojamento Operacional Neoenergia",
    created_at: "2026-06-01T10:00:00Z"
  },
  {
    id: "obra-cg3-005",
    empresa_id: "75447c33-0960-46db-ba59-00327575fe44",
    nome: "ALOJAMENTO - MOSSORO",
    codigo: "OBR-005",
    endereco: "Alojamento Mossoró",
    cidade: "Mossoró",
    uf: "RN",
    status: "ATIVA",
    observacoes: "Alojamento Operacional Mossoró",
    created_at: "2026-06-01T10:00:00Z"
  },

  // --- G91 NORDESTE & IRACEMA ---
  {
    id: "obra-g91-001",
    empresa_id: "40d91cc4-ce68-4cb9-804b-a13db6cc3453",
    nome: "CASTANHÃO",
    codigo: "OBR-G01",
    endereco: "Unidade Castanhão",
    cidade: "Iracema",
    uf: "CE",
    status: "ATIVA",
    observacoes: "Unidade Operacional Castanhão",
    created_at: "2026-06-01T10:00:00Z"
  },
  {
    id: "obra-g91-002",
    empresa_id: "40d91cc4-ce68-4cb9-804b-a13db6cc3453",
    nome: "ALTO SANTO",
    codigo: "OBR-G02",
    endereco: "Unidade Alto Santo",
    cidade: "Alto Santo",
    uf: "CE",
    status: "ATIVA",
    observacoes: "Unidade Operacional Alto Santo",
    created_at: "2026-06-01T10:00:00Z"
  },
  {
    id: "obra-g91-003",
    empresa_id: "40d91cc4-ce68-4cb9-804b-a13db6cc3453",
    nome: "POTIRETAMA",
    codigo: "OBR-G03",
    endereco: "Unidade Potiretama",
    cidade: "Potiretama",
    uf: "CE",
    status: "ATIVA",
    observacoes: "Unidade Operacional Potiretama",
    created_at: "2026-06-01T10:00:00Z"
  },
  {
    id: "obra-g91-004",
    empresa_id: "40d91cc4-ce68-4cb9-804b-a13db6cc3453",
    nome: "BORDADO",
    codigo: "OBR-G04",
    endereco: "Setor de Bordado",
    cidade: "Iracema",
    uf: "CE",
    status: "ATIVA",
    observacoes: "Setor de Bordado G91",
    created_at: "2026-06-01T10:00:00Z"
  },
  {
    id: "obra-g91-005",
    empresa_id: "40d91cc4-ce68-4cb9-804b-a13db6cc3453",
    nome: "ESTAMPARIA",
    codigo: "OBR-G05",
    endereco: "Setor de Estamparia",
    cidade: "Iracema",
    uf: "CE",
    status: "ATIVA",
    observacoes: "Setor de Estamparia G91",
    created_at: "2026-06-01T10:00:00Z"
  },

  // --- LEONARDO A. DE ARAUJO LTDA ---
  {
    id: "obra-leo-001",
    empresa_id: "d3419ac5-f4fe-4309-bf45-0e104ac04f3a",
    nome: "COSTURA",
    codigo: "OBR-L01",
    endereco: "Setor de Costura",
    cidade: null,
    uf: null,
    status: "ATIVA",
    observacoes: "Setor de Costura",
    created_at: "2026-06-01T10:00:00Z"
  },
  {
    id: "obra-leo-002",
    empresa_id: "d3419ac5-f4fe-4309-bf45-0e104ac04f3a",
    nome: "PASSADORIA",
    codigo: "OBR-L02",
    endereco: "Setor de Passadoria",
    cidade: null,
    uf: null,
    status: "ATIVA",
    observacoes: "Setor de Passadoria",
    created_at: "2026-06-01T10:00:00Z"
  },
  {
    id: "obra-leo-003",
    empresa_id: "d3419ac5-f4fe-4309-bf45-0e104ac04f3a",
    nome: "MÁQ. TAQ / PASSADORIA",
    codigo: "OBR-L03",
    endereco: "Setor Máquinas Taquete / Passadoria",
    cidade: null,
    uf: null,
    status: "ATIVA",
    observacoes: "Setor de Máquinas Taquete",
    created_at: "2026-06-01T10:00:00Z"
  },
  {
    id: "obra-leo-004",
    empresa_id: "d3419ac5-f4fe-4309-bf45-0e104ac04f3a",
    nome: "ESTAMPARIA",
    codigo: "OBR-L04",
    endereco: "Setor de Estamparia",
    cidade: null,
    uf: null,
    status: "ATIVA",
    observacoes: "Setor de Estamparia",
    created_at: "2026-06-01T10:00:00Z"
  },
  {
    id: "obra-leo-005",
    empresa_id: "d3419ac5-f4fe-4309-bf45-0e104ac04f3a",
    nome: "TECELAGEM",
    codigo: "OBR-L05",
    endereco: "Setor de Tecelagem",
    cidade: null,
    uf: null,
    status: "ATIVA",
    observacoes: "Setor de Tecelagem",
    created_at: "2026-06-01T10:00:00Z"
  }
];
