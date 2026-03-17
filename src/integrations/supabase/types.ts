export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      conformidades: {
        Row: {
          acao_corretiva: string | null
          created_at: string
          created_by: string | null
          data_inspecao: string
          data_realizado: string | null
          empresa_id: string | null
          foto_antes: string | null
          foto_depois: string | null
          gravidade: string
          id: string
          local: string | null
          numero: number
          referencia_normativa: string | null
          responsavel: string | null
          situacao_detectada: string
          status: string
          updated_at: string
        }
        Insert: {
          acao_corretiva?: string | null
          created_at?: string
          created_by?: string | null
          data_inspecao?: string
          data_realizado?: string | null
          empresa_id?: string | null
          foto_antes?: string | null
          foto_depois?: string | null
          gravidade?: string
          id?: string
          local?: string | null
          numero?: number
          referencia_normativa?: string | null
          responsavel?: string | null
          situacao_detectada: string
          status?: string
          updated_at?: string
        }
        Update: {
          acao_corretiva?: string | null
          created_at?: string
          created_by?: string | null
          data_inspecao?: string
          data_realizado?: string | null
          empresa_id?: string | null
          foto_antes?: string | null
          foto_depois?: string | null
          gravidade?: string
          id?: string
          local?: string | null
          numero?: number
          referencia_normativa?: string | null
          responsavel?: string | null
          situacao_detectada?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conformidades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_epis: {
        Row: {
          contrato_id: string
          created_at: string
          created_by: string | null
          empresa_id: string | null
          epi_id: string
          estoque: number
          id: string
          updated_at: string
        }
        Insert: {
          contrato_id: string
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          epi_id: string
          estoque?: number
          id?: string
          updated_at?: string
        }
        Update: {
          contrato_id?: string
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          epi_id?: string
          estoque?: number
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contrato_epis_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_epis_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_epis_epi_id_fkey"
            columns: ["epi_id"]
            isOneToOne: false
            referencedRelation: "epis"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_responsaveis: {
        Row: {
          contrato_id: string
          created_at: string
          created_by: string | null
          empresa_id: string | null
          funcionario_id: string
          id: string
        }
        Insert: {
          contrato_id: string
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          funcionario_id: string
          id?: string
        }
        Update: {
          contrato_id?: string
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          funcionario_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contrato_responsaveis_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_responsaveis_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_responsaveis_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          nome: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      controle_treinamentos: {
        Row: {
          created_at: string
          created_by: string | null
          data_realizacao: string
          data_renovacao: string | null
          documento_pendente: string | null
          empresa_id: string | null
          funcionario_id: string
          id: string
          nome_curso: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_realizacao?: string
          data_renovacao?: string | null
          documento_pendente?: string | null
          empresa_id?: string | null
          funcionario_id: string
          id?: string
          nome_curso: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_realizacao?: string
          data_renovacao?: string | null
          documento_pendente?: string | null
          empresa_id?: string | null
          funcionario_id?: string
          id?: string
          nome_curso?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "controle_treinamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controle_treinamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      cursos_atribuicao: {
        Row: {
          created_at: string
          curso_id: string
          empresa_id: string | null
          funcionario_id: string
          id: string
        }
        Insert: {
          created_at?: string
          curso_id: string
          empresa_id?: string | null
          funcionario_id: string
          id?: string
        }
        Update: {
          created_at?: string
          curso_id?: string
          empresa_id?: string | null
          funcionario_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cursos_atribuicao_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos_video"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cursos_atribuicao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cursos_atribuicao_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      cursos_documentos: {
        Row: {
          created_at: string
          created_by: string | null
          empresa_id: string | null
          id: string
          nome: string
          updated_at: string
          validade_meses: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          updated_at?: string
          validade_meses?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          updated_at?: string
          validade_meses?: number
        }
        Relationships: [
          {
            foreignKeyName: "cursos_documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      cursos_video: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          link_externo: string | null
          pontuacao_minima: number
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          link_externo?: string | null
          pontuacao_minima?: number
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          link_externo?: string | null
          pontuacao_minima?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cursos_video_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      dds: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          duracao: string | null
          empresa_id: string | null
          id: string
          local: string | null
          observacao: string | null
          palestrante: string | null
          tema: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: string
          duracao?: string | null
          empresa_id?: string | null
          id?: string
          local?: string | null
          observacao?: string | null
          palestrante?: string | null
          tema: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          duracao?: string | null
          empresa_id?: string | null
          id?: string
          local?: string | null
          observacao?: string | null
          palestrante?: string | null
          tema?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dds_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      dds_participantes: {
        Row: {
          assinatura: string | null
          created_at: string
          dds_id: string
          empresa_id: string | null
          funcionario_id: string
          id: string
        }
        Insert: {
          assinatura?: string | null
          created_at?: string
          dds_id: string
          empresa_id?: string | null
          funcionario_id: string
          id?: string
        }
        Update: {
          assinatura?: string | null
          created_at?: string
          dds_id?: string
          empresa_id?: string | null
          funcionario_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dds_participantes_dds_id_fkey"
            columns: ["dds_id"]
            isOneToOne: false
            referencedRelation: "dds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dds_participantes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dds_participantes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_config: {
        Row: {
          cnpj: string | null
          created_at: string
          email: string | null
          empresa_pai_id: string | null
          endereco: string | null
          id: string
          logo_url: string | null
          nome: string
          telefone: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          email?: string | null
          empresa_pai_id?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          telefone?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          email?: string | null
          empresa_pai_id?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          telefone?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_config_empresa_pai_id_fkey"
            columns: ["empresa_pai_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      entregas: {
        Row: {
          assinatura_colaborador: string | null
          created_at: string
          created_by: string | null
          data: string
          empresa_id: string | null
          epi_id: string
          foto_reconhecimento: string | null
          funcionario_id: string
          id: string
          nome_assinatura: string | null
          observacao: string | null
          quantidade: number
          status: Database["public"]["Enums"]["status_entrega"]
          tipo: Database["public"]["Enums"]["tipo_entrega"]
        }
        Insert: {
          assinatura_colaborador?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          empresa_id?: string | null
          epi_id: string
          foto_reconhecimento?: string | null
          funcionario_id: string
          id?: string
          nome_assinatura?: string | null
          observacao?: string | null
          quantidade?: number
          status?: Database["public"]["Enums"]["status_entrega"]
          tipo?: Database["public"]["Enums"]["tipo_entrega"]
        }
        Update: {
          assinatura_colaborador?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          empresa_id?: string | null
          epi_id?: string
          foto_reconhecimento?: string | null
          funcionario_id?: string
          id?: string
          nome_assinatura?: string | null
          observacao?: string | null
          quantidade?: number
          status?: Database["public"]["Enums"]["status_entrega"]
          tipo?: Database["public"]["Enums"]["tipo_entrega"]
        }
        Relationships: [
          {
            foreignKeyName: "entregas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_epi_id_fkey"
            columns: ["epi_id"]
            isOneToOne: false
            referencedRelation: "epis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      epis: {
        Row: {
          aprovado_para: string | null
          ca: string | null
          categoria: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string | null
          estoque: number
          estoque_minimo: number
          fabricante: string | null
          id: string
          nome: string
          updated_at: string
          validade: string | null
          valor: number | null
        }
        Insert: {
          aprovado_para?: string | null
          ca?: string | null
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string | null
          estoque?: number
          estoque_minimo?: number
          fabricante?: string | null
          id?: string
          nome: string
          updated_at?: string
          validade?: string | null
          valor?: number | null
        }
        Update: {
          aprovado_para?: string | null
          ca?: string | null
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string | null
          estoque?: number
          estoque_minimo?: number
          fabricante?: string | null
          id?: string
          nome?: string
          updated_at?: string
          validade?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "epis_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      exames: {
        Row: {
          created_at: string
          created_by: string | null
          data: string | null
          data_vencimento: string | null
          empresa_id: string | null
          funcionario_id: string
          id: string
          medico: string | null
          nome_exame: string | null
          observacao: string | null
          resultado: Database["public"]["Enums"]["resultado_exame"]
          tipo: Database["public"]["Enums"]["tipo_exame"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: string | null
          data_vencimento?: string | null
          empresa_id?: string | null
          funcionario_id: string
          id?: string
          medico?: string | null
          nome_exame?: string | null
          observacao?: string | null
          resultado?: Database["public"]["Enums"]["resultado_exame"]
          tipo: Database["public"]["Enums"]["tipo_exame"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string | null
          data_vencimento?: string | null
          empresa_id?: string | null
          funcionario_id?: string
          id?: string
          medico?: string | null
          nome_exame?: string | null
          observacao?: string | null
          resultado?: Database["public"]["Enums"]["resultado_exame"]
          tipo?: Database["public"]["Enums"]["tipo_exame"]
        }
        Relationships: [
          {
            foreignKeyName: "exames_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exames_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      faturas: {
        Row: {
          ciclo: number
          created_at: string
          created_by: string | null
          data_criacao: string
          data_vencimento: string
          empresa_id: string
          fatura_url: string | null
          id: string
          observacao: string | null
          situacao: Database["public"]["Enums"]["status_fatura"]
          updated_at: string
          valor: number
        }
        Insert: {
          ciclo?: number
          created_at?: string
          created_by?: string | null
          data_criacao?: string
          data_vencimento: string
          empresa_id: string
          fatura_url?: string | null
          id?: string
          observacao?: string | null
          situacao?: Database["public"]["Enums"]["status_fatura"]
          updated_at?: string
          valor?: number
        }
        Update: {
          ciclo?: number
          created_at?: string
          created_by?: string | null
          data_criacao?: string
          data_vencimento?: string
          empresa_id?: string
          fatura_url?: string | null
          id?: string
          observacao?: string | null
          situacao?: Database["public"]["Enums"]["status_fatura"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "faturas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      fichas_entrega: {
        Row: {
          assinatura_colaborador: string | null
          created_at: string
          created_by: string | null
          data_assinatura: string | null
          empresa_id: string | null
          entrega_ids: string[] | null
          funcionario_id: string
          id: string
          pdf_url: string | null
        }
        Insert: {
          assinatura_colaborador?: string | null
          created_at?: string
          created_by?: string | null
          data_assinatura?: string | null
          empresa_id?: string | null
          entrega_ids?: string[] | null
          funcionario_id: string
          id?: string
          pdf_url?: string | null
        }
        Update: {
          assinatura_colaborador?: string | null
          created_at?: string
          created_by?: string | null
          data_assinatura?: string | null
          empresa_id?: string | null
          entrega_ids?: string[] | null
          funcionario_id?: string
          id?: string
          pdf_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fichas_entrega_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fichas_entrega_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          cargo: string | null
          contrato_id: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          data_admissao: string | null
          data_demissao: string | null
          empresa_id: string | null
          id: string
          matricula: string | null
          nome: string
          setor: string | null
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          contrato_id?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_admissao?: string | null
          data_demissao?: string | null
          empresa_id?: string | null
          id?: string
          matricula?: string | null
          nome: string
          setor?: string | null
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          contrato_id?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_admissao?: string | null
          data_demissao?: string | null
          empresa_id?: string | null
          id?: string
          matricula?: string | null
          nome?: string
          setor?: string | null
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      inspecao_itens: {
        Row: {
          conforme: boolean | null
          descricao: string
          empresa_id: string | null
          id: string
          inspecao_id: string
          observacao: string | null
        }
        Insert: {
          conforme?: boolean | null
          descricao: string
          empresa_id?: string | null
          id?: string
          inspecao_id: string
          observacao?: string | null
        }
        Update: {
          conforme?: boolean | null
          descricao?: string
          empresa_id?: string | null
          id?: string
          inspecao_id?: string
          observacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspecao_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspecao_itens_inspecao_id_fkey"
            columns: ["inspecao_id"]
            isOneToOne: false
            referencedRelation: "inspecoes"
            referencedColumns: ["id"]
          },
        ]
      }
      inspecoes: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          empresa_id: string | null
          id: string
          local: string | null
          observacao: string | null
          responsavel: string | null
          status: Database["public"]["Enums"]["status_inspecao"]
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: string
          empresa_id?: string | null
          id?: string
          local?: string | null
          observacao?: string | null
          responsavel?: string | null
          status?: Database["public"]["Enums"]["status_inspecao"]
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          empresa_id?: string | null
          id?: string
          local?: string | null
          observacao?: string | null
          responsavel?: string | null
          status?: Database["public"]["Enums"]["status_inspecao"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspecoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      inspecoes_subestacao: {
        Row: {
          clima: string | null
          created_at: string
          created_by: string | null
          data_inspecao: string
          empresa_id: string | null
          fotos: string[] | null
          id: string
          identificacao_se: string
          inspetor: string
          itens_json: Json
          observacoes: string | null
          status_geral: string
          updated_at: string
        }
        Insert: {
          clima?: string | null
          created_at?: string
          created_by?: string | null
          data_inspecao?: string
          empresa_id?: string | null
          fotos?: string[] | null
          id?: string
          identificacao_se: string
          inspetor: string
          itens_json?: Json
          observacoes?: string | null
          status_geral?: string
          updated_at?: string
        }
        Update: {
          clima?: string | null
          created_at?: string
          created_by?: string | null
          data_inspecao?: string
          empresa_id?: string | null
          fotos?: string[] | null
          id?: string
          identificacao_se?: string
          inspetor?: string
          itens_json?: Json
          observacoes?: string | null
          status_geral?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspecoes_subestacao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      medicos: {
        Row: {
          created_at: string
          created_by: string | null
          crm: string | null
          empresa_id: string | null
          especialidade: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          crm?: string | null
          empresa_id?: string | null
          especialidade?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          crm?: string | null
          empresa_id?: string | null
          especialidade?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_servico: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          descricao: string | null
          empresa_id: string | null
          epis: string | null
          funcionario_id: string | null
          id: string
          numero: string | null
          riscos: string | null
          setor: string | null
          status: Database["public"]["Enums"]["status_ordem"]
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string | null
          empresa_id?: string | null
          epis?: string | null
          funcionario_id?: string | null
          id?: string
          numero?: string | null
          riscos?: string | null
          setor?: string | null
          status?: Database["public"]["Enums"]["status_ordem"]
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string | null
          empresa_id?: string | null
          epis?: string | null
          funcionario_id?: string | null
          id?: string
          numero?: string | null
          riscos?: string | null
          setor?: string | null
          status?: Database["public"]["Enums"]["status_ordem"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          empresa_id: string | null
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      treinamento_participantes: {
        Row: {
          empresa_id: string | null
          funcionario_id: string
          id: string
          treinamento_id: string
        }
        Insert: {
          empresa_id?: string | null
          funcionario_id: string
          id?: string
          treinamento_id: string
        }
        Update: {
          empresa_id?: string | null
          funcionario_id?: string
          id?: string
          treinamento_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treinamento_participantes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamento_participantes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamento_participantes_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "treinamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      treinamentos: {
        Row: {
          carga_horaria: number
          created_at: string
          created_by: string | null
          data: string
          descricao: string | null
          empresa_id: string | null
          id: string
          instrutor: string | null
          nome: string
          status: Database["public"]["Enums"]["status_treinamento"]
          updated_at: string
          validade: string | null
        }
        Insert: {
          carga_horaria?: number
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          instrutor?: string | null
          nome: string
          status?: Database["public"]["Enums"]["status_treinamento"]
          updated_at?: string
          validade?: string | null
        }
        Update: {
          carga_horaria?: number
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          instrutor?: string | null
          nome?: string
          status?: Database["public"]["Enums"]["status_treinamento"]
          updated_at?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treinamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      usuarios_liberados: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          empresa_id: string | null
          id: string
          is_principal: boolean
          modulos_permitidos: string[] | null
          nome: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          empresa_id?: string | null
          id?: string
          is_principal?: boolean
          modulos_permitidos?: string[] | null
          nome?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          empresa_id?: string | null
          id?: string
          is_principal?: boolean
          modulos_permitidos?: string[] | null
          nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_liberados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      videos_atribuicao: {
        Row: {
          created_at: string
          empresa_id: string | null
          funcionario_id: string
          id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          funcionario_id: string
          id?: string
          video_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          funcionario_id?: string
          id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "videos_atribuicao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_atribuicao_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_atribuicao_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos_treinamento"
            referencedColumns: ["id"]
          },
        ]
      }
      videos_perguntas: {
        Row: {
          created_at: string
          empresa_id: string | null
          id: string
          opcao_a: string
          opcao_b: string
          opcao_c: string | null
          opcao_d: string | null
          ordem: number | null
          pergunta: string
          resposta_correta: string
          video_id: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          opcao_a: string
          opcao_b: string
          opcao_c?: string | null
          opcao_d?: string | null
          ordem?: number | null
          pergunta: string
          resposta_correta: string
          video_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          opcao_a?: string
          opcao_b?: string
          opcao_c?: string | null
          opcao_d?: string | null
          ordem?: number | null
          pergunta?: string
          resposta_correta?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "videos_perguntas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_perguntas_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos_treinamento"
            referencedColumns: ["id"]
          },
        ]
      }
      videos_treinamento: {
        Row: {
          created_at: string
          created_by: string | null
          curso_id: string | null
          descricao: string | null
          duracao_segundos: number | null
          empresa_id: string | null
          id: string
          ordem: number
          pontuacao_minima: number | null
          titulo: string
          updated_at: string
          video_url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          curso_id?: string | null
          descricao?: string | null
          duracao_segundos?: number | null
          empresa_id?: string | null
          id?: string
          ordem?: number
          pontuacao_minima?: number | null
          titulo: string
          updated_at?: string
          video_url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          curso_id?: string | null
          descricao?: string | null
          duracao_segundos?: number | null
          empresa_id?: string | null
          id?: string
          ordem?: number
          pontuacao_minima?: number | null
          titulo?: string
          updated_at?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "videos_treinamento_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos_video"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_treinamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      videos_visualizacao: {
        Row: {
          assinatura: string | null
          concluido: boolean | null
          created_at: string
          empresa_id: string | null
          funcionario_id: string
          id: string
          percentual_assistido: number | null
          pontuacao: number | null
          updated_at: string
          video_id: string
        }
        Insert: {
          assinatura?: string | null
          concluido?: boolean | null
          created_at?: string
          empresa_id?: string | null
          funcionario_id: string
          id?: string
          percentual_assistido?: number | null
          pontuacao?: number | null
          updated_at?: string
          video_id: string
        }
        Update: {
          assinatura?: string | null
          concluido?: boolean | null
          created_at?: string
          empresa_id?: string | null
          funcionario_id?: string
          id?: string
          percentual_assistido?: number | null
          pontuacao?: number | null
          updated_at?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "videos_visualizacao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_visualizacao_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_visualizacao_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos_treinamento"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_consolidated_epi_stock: { Args: never; Returns: Json }
      get_filial_epis: { Args: { _filial_id: string }; Returns: Json }
      get_user_empresa_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_in_user_company_tree: {
        Args: { _empresa_id: string; _user_id: string }
        Returns: boolean
      }
      is_principal: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      transfer_epi_stock: {
        Args: {
          _dest_empresa_id: string
          _quantidade: number
          _source_empresa_id: string
          _source_epi_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "tecnico" | "usuario" | "super_admin"
      resultado_exame: "apto" | "inapto" | "apto_com_restricao" | "pendente"
      status_entrega:
        | "ativo"
        | "devolvido"
        | "trocado"
        | "substituido"
        | "perdido"
        | "danificado"
      status_fatura: "aberto" | "vencido" | "pago" | "cancelado"
      status_inspecao: "pendente" | "em_andamento" | "concluida"
      status_ordem: "emitida" | "assinada" | "cancelada"
      status_treinamento: "agendado" | "realizado" | "cancelado"
      tipo_entrega:
        | "entrega"
        | "troca"
        | "devolucao"
        | "substituicao"
        | "perda"
        | "dano"
      tipo_exame:
        | "admissional"
        | "periodico"
        | "demissional"
        | "retorno"
        | "mudanca_funcao"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "tecnico", "usuario", "super_admin"],
      resultado_exame: ["apto", "inapto", "apto_com_restricao", "pendente"],
      status_entrega: [
        "ativo",
        "devolvido",
        "trocado",
        "substituido",
        "perdido",
        "danificado",
      ],
      status_fatura: ["aberto", "vencido", "pago", "cancelado"],
      status_inspecao: ["pendente", "em_andamento", "concluida"],
      status_ordem: ["emitida", "assinada", "cancelada"],
      status_treinamento: ["agendado", "realizado", "cancelado"],
      tipo_entrega: [
        "entrega",
        "troca",
        "devolucao",
        "substituicao",
        "perda",
        "dano",
      ],
      tipo_exame: [
        "admissional",
        "periodico",
        "demissional",
        "retorno",
        "mudanca_funcao",
      ],
    },
  },
} as const
