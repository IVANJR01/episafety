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
      analises_ia: {
        Row: {
          arquivo_nome: string
          created_at: string
          created_by: string | null
          empresa_id: string | null
          funcionario_id: string
          ia_metadata: Json
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          arquivo_nome: string
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          funcionario_id: string
          ia_metadata?: Json
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          arquivo_nome?: string
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          funcionario_id?: string
          ia_metadata?: Json
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analises_ia_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analises_ia_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      aso_assinaturas: {
        Row: {
          aso_id: string
          assinatura_url: string | null
          created_at: string
          data_assinatura: string
          empresa_id: string | null
          id: string
          ip: string | null
          nome: string | null
          tipo: string
        }
        Insert: {
          aso_id: string
          assinatura_url?: string | null
          created_at?: string
          data_assinatura?: string
          empresa_id?: string | null
          id?: string
          ip?: string | null
          nome?: string | null
          tipo: string
        }
        Update: {
          aso_id?: string
          assinatura_url?: string | null
          created_at?: string
          data_assinatura?: string
          empresa_id?: string | null
          id?: string
          ip?: string | null
          nome?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "aso_assinaturas_aso_id_fkey"
            columns: ["aso_id"]
            isOneToOne: false
            referencedRelation: "asos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aso_assinaturas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      aso_download_logs: {
        Row: {
          acao: string
          aso_id: string | null
          created_at: string
          empresa_id: string
          funcionario_id: string | null
          id: string
          ip: string | null
          perfil_usuario: string | null
          user_agent: string | null
          usuario_id: string | null
        }
        Insert: {
          acao: string
          aso_id?: string | null
          created_at?: string
          empresa_id: string
          funcionario_id?: string | null
          id?: string
          ip?: string | null
          perfil_usuario?: string | null
          user_agent?: string | null
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          aso_id?: string | null
          created_at?: string
          empresa_id?: string
          funcionario_id?: string | null
          id?: string
          ip?: string | null
          perfil_usuario?: string | null
          user_agent?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aso_download_logs_aso_id_fkey"
            columns: ["aso_id"]
            isOneToOne: false
            referencedRelation: "asos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aso_download_logs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      aso_exames: {
        Row: {
          aso_id: string
          created_at: string
          data_realizacao: string | null
          empresa_id: string | null
          exame_id: string | null
          id: string
          nome_exame: string
          observacao: string | null
          realizado: boolean
          resultado: string | null
        }
        Insert: {
          aso_id: string
          created_at?: string
          data_realizacao?: string | null
          empresa_id?: string | null
          exame_id?: string | null
          id?: string
          nome_exame: string
          observacao?: string | null
          realizado?: boolean
          resultado?: string | null
        }
        Update: {
          aso_id?: string
          created_at?: string
          data_realizacao?: string | null
          empresa_id?: string | null
          exame_id?: string | null
          id?: string
          nome_exame?: string
          observacao?: string | null
          realizado?: boolean
          resultado?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aso_exames_aso_id_fkey"
            columns: ["aso_id"]
            isOneToOne: false
            referencedRelation: "asos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aso_exames_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aso_exames_exame_id_fkey"
            columns: ["exame_id"]
            isOneToOne: false
            referencedRelation: "aso_exames_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      aso_exames_catalogo: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          obrigatorio: boolean
          periodicidade: string | null
          periodicidade_meses: number | null
          risco_relacionado: string | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          obrigatorio?: boolean
          periodicidade?: string | null
          periodicidade_meses?: number | null
          risco_relacionado?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          obrigatorio?: boolean
          periodicidade?: string | null
          periodicidade_meses?: number | null
          risco_relacionado?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aso_exames_catalogo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      aso_funcoes: {
        Row: {
          ativo: boolean
          cbo: string | null
          created_at: string
          descricao_atividades: string | null
          empresa_id: string
          exige_nr10: boolean
          exige_nr33: boolean
          exige_nr35: boolean
          id: string
          nome: string
          setor_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cbo?: string | null
          created_at?: string
          descricao_atividades?: string | null
          empresa_id: string
          exige_nr10?: boolean
          exige_nr33?: boolean
          exige_nr35?: boolean
          id?: string
          nome: string
          setor_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cbo?: string | null
          created_at?: string
          descricao_atividades?: string | null
          empresa_id?: string
          exige_nr10?: boolean
          exige_nr33?: boolean
          exige_nr35?: boolean
          id?: string
          nome?: string
          setor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aso_funcoes_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "aso_setores"
            referencedColumns: ["id"]
          },
        ]
      }
      aso_medicos: {
        Row: {
          assinatura_url: string | null
          ativo: boolean
          carimbo_url: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          crm: string
          email: string | null
          empresa_id: string | null
          id: string
          nome: string
          responsavel_pcmso: boolean
          telefone: string | null
          uf_crm: string | null
          updated_at: string
        }
        Insert: {
          assinatura_url?: string | null
          ativo?: boolean
          carimbo_url?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          crm: string
          email?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          responsavel_pcmso?: boolean
          telefone?: string | null
          uf_crm?: string | null
          updated_at?: string
        }
        Update: {
          assinatura_url?: string | null
          ativo?: boolean
          carimbo_url?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          crm?: string
          email?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          responsavel_pcmso?: boolean
          telefone?: string | null
          uf_crm?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aso_medicos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      aso_numeracao: {
        Row: {
          ano: number
          empresa_id: string
          ultimo_seq: number
        }
        Insert: {
          ano: number
          empresa_id: string
          ultimo_seq?: number
        }
        Update: {
          ano?: number
          empresa_id?: string
          ultimo_seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "aso_numeracao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      aso_riscos: {
        Row: {
          aso_id: string
          created_at: string
          descricao: string
          empresa_id: string | null
          grupo: string
          id: string
        }
        Insert: {
          aso_id: string
          created_at?: string
          descricao: string
          empresa_id?: string | null
          grupo: string
          id?: string
        }
        Update: {
          aso_id?: string
          created_at?: string
          descricao?: string
          empresa_id?: string | null
          grupo?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aso_riscos_aso_id_fkey"
            columns: ["aso_id"]
            isOneToOne: false
            referencedRelation: "asos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aso_riscos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      aso_riscos_funcao: {
        Row: {
          aplica_aso: boolean
          created_at: string
          descricao: string
          empresa_id: string
          fonte_geradora: string | null
          funcao_id: string
          grupo: string
          id: string
          medidas_controle: string | null
          possiveis_danos: string | null
          updated_at: string
        }
        Insert: {
          aplica_aso?: boolean
          created_at?: string
          descricao: string
          empresa_id: string
          fonte_geradora?: string | null
          funcao_id: string
          grupo: string
          id?: string
          medidas_controle?: string | null
          possiveis_danos?: string | null
          updated_at?: string
        }
        Update: {
          aplica_aso?: boolean
          created_at?: string
          descricao?: string
          empresa_id?: string
          fonte_geradora?: string | null
          funcao_id?: string
          grupo?: string
          id?: string
          medidas_controle?: string | null
          possiveis_danos?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aso_riscos_funcao_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "aso_funcoes"
            referencedColumns: ["id"]
          },
        ]
      }
      aso_setores: {
        Row: {
          created_at: string
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      aso_verificacao: {
        Row: {
          aso_id: string
          created_at: string
          empresa_id: string | null
          hash: string
        }
        Insert: {
          aso_id: string
          created_at?: string
          empresa_id?: string | null
          hash: string
        }
        Update: {
          aso_id?: string
          created_at?: string
          empresa_id?: string | null
          hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "aso_verificacao_aso_id_fkey"
            columns: ["aso_id"]
            isOneToOne: false
            referencedRelation: "asos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aso_verificacao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      asos: {
        Row: {
          apto_cargo: boolean | null
          apto_nr35: boolean | null
          apto_restricao: boolean | null
          created_at: string
          created_by: string | null
          data_emissao: string
          data_vencimento: string | null
          empresa_id: string
          exames_snapshot: Json | null
          funcionario_id: string
          ghe_id: string | null
          id: string
          inapto_cargo: boolean | null
          inapto_nr35: boolean | null
          liberado_portal_rh: boolean
          local_emissao: string | null
          local_emissao_id: string | null
          local_emissao_snapshot: string | null
          medico_id: string | null
          nr35_nao_aplica: boolean | null
          numero_aso: string
          observacoes: string | null
          pcmso_id: string | null
          pdf_url: string | null
          riscos_snapshot: Json | null
          status: string
          status_aptidao: string | null
          tipo_exame: string
          updated_at: string
          validade_tipo: string | null
        }
        Insert: {
          apto_cargo?: boolean | null
          apto_nr35?: boolean | null
          apto_restricao?: boolean | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          data_vencimento?: string | null
          empresa_id: string
          exames_snapshot?: Json | null
          funcionario_id: string
          ghe_id?: string | null
          id?: string
          inapto_cargo?: boolean | null
          inapto_nr35?: boolean | null
          liberado_portal_rh?: boolean
          local_emissao?: string | null
          local_emissao_id?: string | null
          local_emissao_snapshot?: string | null
          medico_id?: string | null
          nr35_nao_aplica?: boolean | null
          numero_aso: string
          observacoes?: string | null
          pcmso_id?: string | null
          pdf_url?: string | null
          riscos_snapshot?: Json | null
          status?: string
          status_aptidao?: string | null
          tipo_exame: string
          updated_at?: string
          validade_tipo?: string | null
        }
        Update: {
          apto_cargo?: boolean | null
          apto_nr35?: boolean | null
          apto_restricao?: boolean | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          data_vencimento?: string | null
          empresa_id?: string
          exames_snapshot?: Json | null
          funcionario_id?: string
          ghe_id?: string | null
          id?: string
          inapto_cargo?: boolean | null
          inapto_nr35?: boolean | null
          liberado_portal_rh?: boolean
          local_emissao?: string | null
          local_emissao_id?: string | null
          local_emissao_snapshot?: string | null
          medico_id?: string | null
          nr35_nao_aplica?: boolean | null
          numero_aso?: string
          observacoes?: string | null
          pcmso_id?: string | null
          pdf_url?: string | null
          riscos_snapshot?: Json | null
          status?: string
          status_aptidao?: string | null
          tipo_exame?: string
          updated_at?: string
          validade_tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asos_ghe_id_fkey"
            columns: ["ghe_id"]
            isOneToOne: false
            referencedRelation: "ghe_ges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asos_local_emissao_id_fkey"
            columns: ["local_emissao_id"]
            isOneToOne: false
            referencedRelation: "locais_emissao_aso"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asos_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "aso_medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asos_pcmso_id_fkey"
            columns: ["pcmso_id"]
            isOneToOne: false
            referencedRelation: "pcmso"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          empresa_id: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_data: Json | null
          occurred_at: string
          old_data: Json | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          empresa_id?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          empresa_id?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cat_agentes_causadores: {
        Row: {
          ativo: boolean
          codigo: string
          codigo_esocial: string | null
          created_at: string
          descricao: string
          id: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          codigo_esocial?: string | null
          created_at?: string
          descricao: string
          id?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          codigo_esocial?: string | null
          created_at?: string
          descricao?: string
          id?: string
        }
        Relationships: []
      }
      cat_anexos: {
        Row: {
          cat_id: string
          categoria: string
          created_at: string
          drive_file_id: string | null
          drive_path: string | null
          empresa_id: string
          id: string
          mime_type: string | null
          nome_arquivo: string
          storage_bucket: string | null
          storage_path: string | null
          storage_provider: string
          tamanho_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          cat_id: string
          categoria: string
          created_at?: string
          drive_file_id?: string | null
          drive_path?: string | null
          empresa_id: string
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          storage_bucket?: string | null
          storage_path?: string | null
          storage_provider?: string
          tamanho_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          cat_id?: string
          categoria?: string
          created_at?: string
          drive_file_id?: string | null
          drive_path?: string | null
          empresa_id?: string
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          storage_bucket?: string | null
          storage_path?: string | null
          storage_provider?: string
          tamanho_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cat_anexos_cat_id_fkey"
            columns: ["cat_id"]
            isOneToOne: false
            referencedRelation: "cat_comunicacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cat_comunicacoes: {
        Row: {
          agente_causador_id: string | null
          aso_id: string | null
          cancelada_em: string | null
          cancelada_por: string | null
          cat_origem_id: string | null
          cbo: string | null
          cep: string | null
          cid_codigo: string | null
          cid_descricao: string | null
          concluida_em: string | null
          concluida_por: string | null
          contrato_id: string | null
          created_at: string
          created_by: string | null
          data_acidente: string
          data_atendimento: string | null
          data_obito: string | null
          descricao_lesao: string | null
          emitente_cargo: string | null
          emitente_cpf: string | null
          emitente_nome: string | null
          emitente_tipo: Database["public"]["Enums"]["cat_emitente_tipo"]
          empresa_id: string
          endereco_local: string | null
          esocial_enviado_em: string | null
          esocial_erro: Json | null
          esocial_event_id: string
          esocial_protocolo: string | null
          esocial_recibo: string | null
          esocial_status: string | null
          exame_id: string | null
          funcionario_id: string
          hora_acidente: string | null
          hora_atendimento: string | null
          hospital: string | null
          houve_afastamento: boolean
          houve_internacao: boolean | null
          hrs_trab_antes_acid: number | null
          id: string
          iniciat_cat: number | null
          jornada_semanal_horas: number | null
          lateralidade: string | null
          local_acidente: string | null
          medico_crm: string | null
          medico_id: string | null
          medico_nome: string | null
          medico_uf: string | null
          motivo_cancelamento: string | null
          municipio: string | null
          natureza_lesao_id: string | null
          numero_cat: string | null
          obito: boolean
          observacoes: string | null
          pais: string | null
          parte_atingida_id: string | null
          pdf_drive_file_id: string | null
          pdf_drive_view_link: string | null
          pdf_gerado_em: string | null
          pdf_hash: string | null
          pdf_versao: number
          remuneracao_mensal: number | null
          situacao_geradora_id: string | null
          status: Database["public"]["Enums"]["cat_status"]
          tipo_acidente: Database["public"]["Enums"]["cat_tipo_acidente"]
          tipo_cat: Database["public"]["Enums"]["cat_tipo"]
          uf: string | null
          ultimo_dia_trabalhado: string | null
          unidade_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agente_causador_id?: string | null
          aso_id?: string | null
          cancelada_em?: string | null
          cancelada_por?: string | null
          cat_origem_id?: string | null
          cbo?: string | null
          cep?: string | null
          cid_codigo?: string | null
          cid_descricao?: string | null
          concluida_em?: string | null
          concluida_por?: string | null
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          data_acidente: string
          data_atendimento?: string | null
          data_obito?: string | null
          descricao_lesao?: string | null
          emitente_cargo?: string | null
          emitente_cpf?: string | null
          emitente_nome?: string | null
          emitente_tipo?: Database["public"]["Enums"]["cat_emitente_tipo"]
          empresa_id: string
          endereco_local?: string | null
          esocial_enviado_em?: string | null
          esocial_erro?: Json | null
          esocial_event_id?: string
          esocial_protocolo?: string | null
          esocial_recibo?: string | null
          esocial_status?: string | null
          exame_id?: string | null
          funcionario_id: string
          hora_acidente?: string | null
          hora_atendimento?: string | null
          hospital?: string | null
          houve_afastamento?: boolean
          houve_internacao?: boolean | null
          hrs_trab_antes_acid?: number | null
          id?: string
          iniciat_cat?: number | null
          jornada_semanal_horas?: number | null
          lateralidade?: string | null
          local_acidente?: string | null
          medico_crm?: string | null
          medico_id?: string | null
          medico_nome?: string | null
          medico_uf?: string | null
          motivo_cancelamento?: string | null
          municipio?: string | null
          natureza_lesao_id?: string | null
          numero_cat?: string | null
          obito?: boolean
          observacoes?: string | null
          pais?: string | null
          parte_atingida_id?: string | null
          pdf_drive_file_id?: string | null
          pdf_drive_view_link?: string | null
          pdf_gerado_em?: string | null
          pdf_hash?: string | null
          pdf_versao?: number
          remuneracao_mensal?: number | null
          situacao_geradora_id?: string | null
          status?: Database["public"]["Enums"]["cat_status"]
          tipo_acidente?: Database["public"]["Enums"]["cat_tipo_acidente"]
          tipo_cat?: Database["public"]["Enums"]["cat_tipo"]
          uf?: string | null
          ultimo_dia_trabalhado?: string | null
          unidade_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agente_causador_id?: string | null
          aso_id?: string | null
          cancelada_em?: string | null
          cancelada_por?: string | null
          cat_origem_id?: string | null
          cbo?: string | null
          cep?: string | null
          cid_codigo?: string | null
          cid_descricao?: string | null
          concluida_em?: string | null
          concluida_por?: string | null
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          data_acidente?: string
          data_atendimento?: string | null
          data_obito?: string | null
          descricao_lesao?: string | null
          emitente_cargo?: string | null
          emitente_cpf?: string | null
          emitente_nome?: string | null
          emitente_tipo?: Database["public"]["Enums"]["cat_emitente_tipo"]
          empresa_id?: string
          endereco_local?: string | null
          esocial_enviado_em?: string | null
          esocial_erro?: Json | null
          esocial_event_id?: string
          esocial_protocolo?: string | null
          esocial_recibo?: string | null
          esocial_status?: string | null
          exame_id?: string | null
          funcionario_id?: string
          hora_acidente?: string | null
          hora_atendimento?: string | null
          hospital?: string | null
          houve_afastamento?: boolean
          houve_internacao?: boolean | null
          hrs_trab_antes_acid?: number | null
          id?: string
          iniciat_cat?: number | null
          jornada_semanal_horas?: number | null
          lateralidade?: string | null
          local_acidente?: string | null
          medico_crm?: string | null
          medico_id?: string | null
          medico_nome?: string | null
          medico_uf?: string | null
          motivo_cancelamento?: string | null
          municipio?: string | null
          natureza_lesao_id?: string | null
          numero_cat?: string | null
          obito?: boolean
          observacoes?: string | null
          pais?: string | null
          parte_atingida_id?: string | null
          pdf_drive_file_id?: string | null
          pdf_drive_view_link?: string | null
          pdf_gerado_em?: string | null
          pdf_hash?: string | null
          pdf_versao?: number
          remuneracao_mensal?: number | null
          situacao_geradora_id?: string | null
          status?: Database["public"]["Enums"]["cat_status"]
          tipo_acidente?: Database["public"]["Enums"]["cat_tipo_acidente"]
          tipo_cat?: Database["public"]["Enums"]["cat_tipo"]
          uf?: string | null
          ultimo_dia_trabalhado?: string | null
          unidade_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cat_comunicacoes_agente_causador_id_fkey"
            columns: ["agente_causador_id"]
            isOneToOne: false
            referencedRelation: "cat_agentes_causadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_comunicacoes_aso_id_fkey"
            columns: ["aso_id"]
            isOneToOne: false
            referencedRelation: "asos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_comunicacoes_cat_origem_id_fkey"
            columns: ["cat_origem_id"]
            isOneToOne: false
            referencedRelation: "cat_comunicacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_comunicacoes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_comunicacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_comunicacoes_exame_id_fkey"
            columns: ["exame_id"]
            isOneToOne: false
            referencedRelation: "exames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_comunicacoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_comunicacoes_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "aso_medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_comunicacoes_natureza_lesao_id_fkey"
            columns: ["natureza_lesao_id"]
            isOneToOne: false
            referencedRelation: "cat_naturezas_lesao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_comunicacoes_parte_atingida_id_fkey"
            columns: ["parte_atingida_id"]
            isOneToOne: false
            referencedRelation: "cat_partes_atingidas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_comunicacoes_situacao_geradora_id_fkey"
            columns: ["situacao_geradora_id"]
            isOneToOne: false
            referencedRelation: "cat_situacoes_geradoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_comunicacoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      cat_historico: {
        Row: {
          acao: string
          cat_id: string
          created_at: string
          empresa_id: string
          id: string
          metadata: Json | null
          motivo: string | null
          status_anterior: Database["public"]["Enums"]["cat_status"] | null
          status_novo: Database["public"]["Enums"]["cat_status"] | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          cat_id: string
          created_at?: string
          empresa_id: string
          id?: string
          metadata?: Json | null
          motivo?: string | null
          status_anterior?: Database["public"]["Enums"]["cat_status"] | null
          status_novo?: Database["public"]["Enums"]["cat_status"] | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          cat_id?: string
          created_at?: string
          empresa_id?: string
          id?: string
          metadata?: Json | null
          motivo?: string | null
          status_anterior?: Database["public"]["Enums"]["cat_status"] | null
          status_novo?: Database["public"]["Enums"]["cat_status"] | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cat_historico_cat_id_fkey"
            columns: ["cat_id"]
            isOneToOne: false
            referencedRelation: "cat_comunicacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cat_naturezas_lesao: {
        Row: {
          ativo: boolean
          codigo: string
          codigo_esocial: string | null
          created_at: string
          descricao: string
          id: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          codigo_esocial?: string | null
          created_at?: string
          descricao: string
          id?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          codigo_esocial?: string | null
          created_at?: string
          descricao?: string
          id?: string
        }
        Relationships: []
      }
      cat_numeracao: {
        Row: {
          ano: number
          empresa_id: string
          ultimo_seq: number
          updated_at: string
        }
        Insert: {
          ano: number
          empresa_id: string
          ultimo_seq?: number
          updated_at?: string
        }
        Update: {
          ano?: number
          empresa_id?: string
          ultimo_seq?: number
          updated_at?: string
        }
        Relationships: []
      }
      cat_partes_atingidas: {
        Row: {
          ativo: boolean
          codigo: string
          codigo_esocial: string | null
          created_at: string
          descricao: string
          id: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          codigo_esocial?: string | null
          created_at?: string
          descricao: string
          id?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          codigo_esocial?: string | null
          created_at?: string
          descricao?: string
          id?: string
        }
        Relationships: []
      }
      cat_situacoes_geradoras: {
        Row: {
          ativo: boolean
          codigo: string
          codigo_esocial: string | null
          created_at: string
          descricao: string
          id: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          codigo_esocial?: string | null
          created_at?: string
          descricao: string
          id?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          codigo_esocial?: string | null
          created_at?: string
          descricao?: string
          id?: string
        }
        Relationships: []
      }
      cat_testemunhas: {
        Row: {
          cargo: string | null
          cat_id: string
          cpf: string | null
          created_at: string
          empresa_id: string
          id: string
          nome: string
          telefone: string | null
        }
        Insert: {
          cargo?: string | null
          cat_id: string
          cpf?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          telefone?: string | null
        }
        Update: {
          cargo?: string | null
          cat_id?: string
          cpf?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cat_testemunhas_cat_id_fkey"
            columns: ["cat_id"]
            isOneToOne: false
            referencedRelation: "cat_comunicacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_servicos: {
        Row: {
          ativo: boolean
          categoria: string | null
          created_at: string
          created_by: string | null
          custo_estimado: number | null
          descricao: string | null
          empresa_id: string
          id: string
          margem_padrao: number | null
          nome: string
          unidade: string | null
          updated_at: string
          valor_padrao: number
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          custo_estimado?: number | null
          descricao?: string | null
          empresa_id: string
          id?: string
          margem_padrao?: number | null
          nome: string
          unidade?: string | null
          updated_at?: string
          valor_padrao?: number
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          custo_estimado?: number | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          margem_padrao?: number | null
          nome?: string
          unidade?: string | null
          updated_at?: string
          valor_padrao?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_servicos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes_comerciais: {
        Row: {
          ativo: boolean
          cidade: string | null
          cnpj_cpf: string | null
          contato_responsavel: string | null
          created_at: string
          created_by: string | null
          email: string | null
          empresa_id: string
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          razao_social: string | null
          segmento: string | null
          telefone: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          cnpj_cpf?: string | null
          contato_responsavel?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          empresa_id: string
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          razao_social?: string | null
          segmento?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          cnpj_cpf?: string | null
          contato_responsavel?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          empresa_id?: string
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          razao_social?: string | null
          segmento?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_comerciais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      conferencia_itens: {
        Row: {
          conferencia_id: string
          contagem_fisica: number | null
          contrato_epi_id: string
          created_at: string
          divergencia: number | null
          empresa_id: string | null
          epi_id: string
          estoque_sistema: number
          id: string
          justificativa: string | null
        }
        Insert: {
          conferencia_id: string
          contagem_fisica?: number | null
          contrato_epi_id: string
          created_at?: string
          divergencia?: number | null
          empresa_id?: string | null
          epi_id: string
          estoque_sistema?: number
          id?: string
          justificativa?: string | null
        }
        Update: {
          conferencia_id?: string
          contagem_fisica?: number | null
          contrato_epi_id?: string
          created_at?: string
          divergencia?: number | null
          empresa_id?: string | null
          epi_id?: string
          estoque_sistema?: number
          id?: string
          justificativa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conferencia_itens_conferencia_id_fkey"
            columns: ["conferencia_id"]
            isOneToOne: false
            referencedRelation: "conferencias_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conferencia_itens_contrato_epi_id_fkey"
            columns: ["contrato_epi_id"]
            isOneToOne: false
            referencedRelation: "contrato_epis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conferencia_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conferencia_itens_epi_id_fkey"
            columns: ["epi_id"]
            isOneToOne: false
            referencedRelation: "epis"
            referencedColumns: ["id"]
          },
        ]
      }
      conferencias_estoque: {
        Row: {
          contrato_id: string
          created_at: string
          created_by: string | null
          empresa_id: string | null
          finalizado_em: string | null
          finalizado_por: string | null
          id: string
          observacao_geral: string | null
          status: string
          tipo: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          contrato_id: string
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          finalizado_em?: string | null
          finalizado_por?: string | null
          id?: string
          observacao_geral?: string | null
          status?: string
          tipo?: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          contrato_id?: string
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          finalizado_em?: string | null
          finalizado_por?: string | null
          id?: string
          observacao_geral?: string | null
          status?: string
          tipo?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conferencias_estoque_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conferencias_estoque_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conferencias_estoque_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      conformidades: {
        Row: {
          acao_corretiva: string | null
          created_at: string
          created_by: string | null
          data_inspecao: string
          data_realizado: string | null
          empresa_id: string | null
          foto_antes: string | null
          foto_antes_path: string | null
          foto_depois: string | null
          foto_depois_path: string | null
          gravidade: string
          id: string
          local: string | null
          local_especifico: string | null
          numero: number
          obra_id: string | null
          prazo_correcao: string | null
          referencia_normativa: string | null
          resolved_by: string | null
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
          foto_antes_path?: string | null
          foto_depois?: string | null
          foto_depois_path?: string | null
          gravidade?: string
          id?: string
          local?: string | null
          local_especifico?: string | null
          numero?: number
          obra_id?: string | null
          prazo_correcao?: string | null
          referencia_normativa?: string | null
          resolved_by?: string | null
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
          foto_antes_path?: string | null
          foto_depois?: string | null
          foto_depois_path?: string | null
          gravidade?: string
          id?: string
          local?: string | null
          local_especifico?: string | null
          numero?: number
          obra_id?: string | null
          prazo_correcao?: string | null
          referencia_normativa?: string | null
          resolved_by?: string | null
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
          {
            foreignKeyName: "conformidades_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
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
      contrato_epis_movimentacoes: {
        Row: {
          contrato_epi_id: string
          contrato_id: string
          created_at: string
          created_by: string | null
          empresa_id: string | null
          epi_id: string
          id: string
          motivo: string | null
          quantidade: number
          responsavel_nome: string | null
          tipo: string
        }
        Insert: {
          contrato_epi_id: string
          contrato_id: string
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          epi_id: string
          id?: string
          motivo?: string | null
          quantidade?: number
          responsavel_nome?: string | null
          tipo?: string
        }
        Update: {
          contrato_epi_id?: string
          contrato_id?: string
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          epi_id?: string
          id?: string
          motivo?: string | null
          quantidade?: number
          responsavel_nome?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "contrato_epis_movimentacoes_contrato_epi_id_fkey"
            columns: ["contrato_epi_id"]
            isOneToOne: false
            referencedRelation: "contrato_epis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_epis_movimentacoes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_epis_movimentacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_epis_movimentacoes_epi_id_fkey"
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
      dispensas_requisito: {
        Row: {
          created_at: string
          created_by: string | null
          curso_nome: string
          empresa_id: string | null
          funcionario_id: string
          id: string
          motivo: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          curso_nome: string
          empresa_id?: string | null
          funcionario_id: string
          id?: string
          motivo?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          curso_nome?: string
          empresa_id?: string | null
          funcionario_id?: string
          id?: string
          motivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispensas_requisito_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispensas_requisito_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_rate_limit: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      empresa_config: {
        Row: {
          cnpj: string | null
          cpf_representante_legal: string | null
          created_at: string
          email: string | null
          email_compras: string | null
          email_sst: string | null
          empresa_pai_id: string | null
          endereco: string | null
          id: string
          logo_url: string | null
          nome: string
          nome_representante_legal: string | null
          storage_provider: string
          telefone: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          cpf_representante_legal?: string | null
          created_at?: string
          email?: string | null
          email_compras?: string | null
          email_sst?: string | null
          empresa_pai_id?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          nome_representante_legal?: string | null
          storage_provider?: string
          telefone?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          cpf_representante_legal?: string | null
          created_at?: string
          email?: string | null
          email_compras?: string | null
          email_sst?: string | null
          empresa_pai_id?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          nome_representante_legal?: string | null
          storage_provider?: string
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
          unidade_origem_id: string | null
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
          unidade_origem_id?: string | null
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
          unidade_origem_id?: string | null
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
          {
            foreignKeyName: "entregas_unidade_origem_id_fkey"
            columns: ["unidade_origem_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
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
          tamanho: string | null
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
          tamanho?: string | null
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
          tamanho?: string | null
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
      esocial_cid10: {
        Row: {
          categoria: string | null
          codigo: string
          descricao: string
        }
        Insert: {
          categoria?: string | null
          codigo: string
          descricao: string
        }
        Update: {
          categoria?: string | null
          codigo?: string
          descricao?: string
        }
        Relationships: []
      }
      esocial_config: {
        Row: {
          ativo: boolean
          certificado_alias: string | null
          certificado_validade: string | null
          cnpj_raiz: string | null
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          nr_insc: string | null
          observacoes: string | null
          proc_emi: number
          tp_amb: Database["public"]["Enums"]["esocial_tp_amb"]
          tp_insc: number | null
          updated_at: string
          updated_by: string | null
          ver_proc: string
        }
        Insert: {
          ativo?: boolean
          certificado_alias?: string | null
          certificado_validade?: string | null
          cnpj_raiz?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          nr_insc?: string | null
          observacoes?: string | null
          proc_emi?: number
          tp_amb?: Database["public"]["Enums"]["esocial_tp_amb"]
          tp_insc?: number | null
          updated_at?: string
          updated_by?: string | null
          ver_proc?: string
        }
        Update: {
          ativo?: boolean
          certificado_alias?: string | null
          certificado_validade?: string | null
          cnpj_raiz?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          nr_insc?: string | null
          observacoes?: string | null
          proc_emi?: number
          tp_amb?: Database["public"]["Enums"]["esocial_tp_amb"]
          tp_insc?: number | null
          updated_at?: string
          updated_by?: string | null
          ver_proc?: string
        }
        Relationships: [
          {
            foreignKeyName: "esocial_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      esocial_eventos_historico: {
        Row: {
          acao: Database["public"]["Enums"]["esocial_acao_hist"]
          created_at: string
          empresa_id: string
          erro_resumo: string | null
          evento_id: string
          id: string
          metadados: Json
          status_anterior:
            | Database["public"]["Enums"]["esocial_evento_status"]
            | null
          status_novo:
            | Database["public"]["Enums"]["esocial_evento_status"]
            | null
          user_email: string | null
          user_id: string | null
          xml_hash_sha256: string | null
        }
        Insert: {
          acao: Database["public"]["Enums"]["esocial_acao_hist"]
          created_at?: string
          empresa_id: string
          erro_resumo?: string | null
          evento_id: string
          id?: string
          metadados?: Json
          status_anterior?:
            | Database["public"]["Enums"]["esocial_evento_status"]
            | null
          status_novo?:
            | Database["public"]["Enums"]["esocial_evento_status"]
            | null
          user_email?: string | null
          user_id?: string | null
          xml_hash_sha256?: string | null
        }
        Update: {
          acao?: Database["public"]["Enums"]["esocial_acao_hist"]
          created_at?: string
          empresa_id?: string
          erro_resumo?: string | null
          evento_id?: string
          id?: string
          metadados?: Json
          status_anterior?:
            | Database["public"]["Enums"]["esocial_evento_status"]
            | null
          status_novo?:
            | Database["public"]["Enums"]["esocial_evento_status"]
            | null
          user_email?: string | null
          user_id?: string | null
          xml_hash_sha256?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "esocial_eventos_historico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esocial_eventos_historico_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "esocial_eventos_s2210"
            referencedColumns: ["id"]
          },
        ]
      }
      esocial_eventos_s2210: {
        Row: {
          assinatura_simulada: boolean
          aviso_nao_enviado: string
          cat_id: string
          created_at: string
          created_by: string | null
          dh_processamento: string | null
          empresa_id: string
          evento_origem_id: string | null
          hrs_trab_antes_acid: number | null
          id: string
          id_evento: string | null
          ind_retif: Database["public"]["Enums"]["esocial_ind_retif"]
          iniciat_cat: number | null
          nr_protocolo_simulado: string | null
          nr_recibo_origem: string | null
          nr_recibo_simulado: string | null
          status: Database["public"]["Enums"]["esocial_evento_status"]
          storage_bucket: string | null
          storage_path: string | null
          storage_provider: string | null
          tentativas: number
          tp_amb: Database["public"]["Enums"]["esocial_tp_amb"]
          ultima_validacao_em: string | null
          ultimo_erro_resumo: string | null
          updated_at: string
          updated_by: string | null
          versao_layout: string
          xml_drive_id: string | null
          xml_drive_link: string | null
          xml_gerado_em: string | null
          xml_gerado_por: string | null
          xml_hash_sha256: string | null
          xml_tamanho_bytes: number | null
        }
        Insert: {
          assinatura_simulada?: boolean
          aviso_nao_enviado?: string
          cat_id: string
          created_at?: string
          created_by?: string | null
          dh_processamento?: string | null
          empresa_id: string
          evento_origem_id?: string | null
          hrs_trab_antes_acid?: number | null
          id?: string
          id_evento?: string | null
          ind_retif?: Database["public"]["Enums"]["esocial_ind_retif"]
          iniciat_cat?: number | null
          nr_protocolo_simulado?: string | null
          nr_recibo_origem?: string | null
          nr_recibo_simulado?: string | null
          status?: Database["public"]["Enums"]["esocial_evento_status"]
          storage_bucket?: string | null
          storage_path?: string | null
          storage_provider?: string | null
          tentativas?: number
          tp_amb?: Database["public"]["Enums"]["esocial_tp_amb"]
          ultima_validacao_em?: string | null
          ultimo_erro_resumo?: string | null
          updated_at?: string
          updated_by?: string | null
          versao_layout?: string
          xml_drive_id?: string | null
          xml_drive_link?: string | null
          xml_gerado_em?: string | null
          xml_gerado_por?: string | null
          xml_hash_sha256?: string | null
          xml_tamanho_bytes?: number | null
        }
        Update: {
          assinatura_simulada?: boolean
          aviso_nao_enviado?: string
          cat_id?: string
          created_at?: string
          created_by?: string | null
          dh_processamento?: string | null
          empresa_id?: string
          evento_origem_id?: string | null
          hrs_trab_antes_acid?: number | null
          id?: string
          id_evento?: string | null
          ind_retif?: Database["public"]["Enums"]["esocial_ind_retif"]
          iniciat_cat?: number | null
          nr_protocolo_simulado?: string | null
          nr_recibo_origem?: string | null
          nr_recibo_simulado?: string | null
          status?: Database["public"]["Enums"]["esocial_evento_status"]
          storage_bucket?: string | null
          storage_path?: string | null
          storage_provider?: string | null
          tentativas?: number
          tp_amb?: Database["public"]["Enums"]["esocial_tp_amb"]
          ultima_validacao_em?: string | null
          ultimo_erro_resumo?: string | null
          updated_at?: string
          updated_by?: string | null
          versao_layout?: string
          xml_drive_id?: string | null
          xml_drive_link?: string | null
          xml_gerado_em?: string | null
          xml_gerado_por?: string | null
          xml_hash_sha256?: string | null
          xml_tamanho_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "esocial_eventos_s2210_cat_id_fkey"
            columns: ["cat_id"]
            isOneToOne: false
            referencedRelation: "cat_comunicacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esocial_eventos_s2210_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esocial_eventos_s2210_evento_origem_id_fkey"
            columns: ["evento_origem_id"]
            isOneToOne: false
            referencedRelation: "esocial_eventos_s2210"
            referencedColumns: ["id"]
          },
        ]
      }
      esocial_eventos_s2240: {
        Row: {
          categoria_esocial: string | null
          cbo: string | null
          cert_alias: string | null
          cpf_trabalhador: string
          created_at: string
          created_by: string | null
          data_fim_condicao: string | null
          data_inicio_condicao: string
          empresa_id: string
          evento_origem_id: string | null
          funcao: string | null
          funcionario_id: string | null
          id: string
          ind_retificacao: number
          lotacao_tributaria: string | null
          ltcat_documento_id: string | null
          matricula: string | null
          nr_recibo_origem: string | null
          observacao_complementar: string | null
          pgr_documento_id: string | null
          ppp_documento_id: string | null
          ppp_periodo_id: string | null
          status: Database["public"]["Enums"]["esocial_s2240_status"]
          storage_bucket: string | null
          storage_path: string | null
          storage_provider: string | null
          tipo_evento: Database["public"]["Enums"]["esocial_s2240_tipo_evento"]
          updated_at: string
          validado_em: string | null
          validado_por: string | null
          xml_assinado_drive_id: string | null
          xml_drive_id: string | null
          xml_drive_link: string | null
          xml_gerado_em: string | null
          xml_gerado_por: string | null
          xml_sha256: string | null
          xml_tamanho_bytes: number | null
        }
        Insert: {
          categoria_esocial?: string | null
          cbo?: string | null
          cert_alias?: string | null
          cpf_trabalhador: string
          created_at?: string
          created_by?: string | null
          data_fim_condicao?: string | null
          data_inicio_condicao: string
          empresa_id: string
          evento_origem_id?: string | null
          funcao?: string | null
          funcionario_id?: string | null
          id?: string
          ind_retificacao?: number
          lotacao_tributaria?: string | null
          ltcat_documento_id?: string | null
          matricula?: string | null
          nr_recibo_origem?: string | null
          observacao_complementar?: string | null
          pgr_documento_id?: string | null
          ppp_documento_id?: string | null
          ppp_periodo_id?: string | null
          status?: Database["public"]["Enums"]["esocial_s2240_status"]
          storage_bucket?: string | null
          storage_path?: string | null
          storage_provider?: string | null
          tipo_evento?: Database["public"]["Enums"]["esocial_s2240_tipo_evento"]
          updated_at?: string
          validado_em?: string | null
          validado_por?: string | null
          xml_assinado_drive_id?: string | null
          xml_drive_id?: string | null
          xml_drive_link?: string | null
          xml_gerado_em?: string | null
          xml_gerado_por?: string | null
          xml_sha256?: string | null
          xml_tamanho_bytes?: number | null
        }
        Update: {
          categoria_esocial?: string | null
          cbo?: string | null
          cert_alias?: string | null
          cpf_trabalhador?: string
          created_at?: string
          created_by?: string | null
          data_fim_condicao?: string | null
          data_inicio_condicao?: string
          empresa_id?: string
          evento_origem_id?: string | null
          funcao?: string | null
          funcionario_id?: string | null
          id?: string
          ind_retificacao?: number
          lotacao_tributaria?: string | null
          ltcat_documento_id?: string | null
          matricula?: string | null
          nr_recibo_origem?: string | null
          observacao_complementar?: string | null
          pgr_documento_id?: string | null
          ppp_documento_id?: string | null
          ppp_periodo_id?: string | null
          status?: Database["public"]["Enums"]["esocial_s2240_status"]
          storage_bucket?: string | null
          storage_path?: string | null
          storage_provider?: string | null
          tipo_evento?: Database["public"]["Enums"]["esocial_s2240_tipo_evento"]
          updated_at?: string
          validado_em?: string | null
          validado_por?: string | null
          xml_assinado_drive_id?: string | null
          xml_drive_id?: string | null
          xml_drive_link?: string | null
          xml_gerado_em?: string | null
          xml_gerado_por?: string | null
          xml_sha256?: string | null
          xml_tamanho_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "esocial_eventos_s2240_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esocial_eventos_s2240_evento_origem_id_fkey"
            columns: ["evento_origem_id"]
            isOneToOne: false
            referencedRelation: "esocial_eventos_s2240"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esocial_eventos_s2240_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esocial_eventos_s2240_ltcat_documento_id_fkey"
            columns: ["ltcat_documento_id"]
            isOneToOne: false
            referencedRelation: "ltcat_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esocial_eventos_s2240_pgr_documento_id_fkey"
            columns: ["pgr_documento_id"]
            isOneToOne: false
            referencedRelation: "pgr_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esocial_eventos_s2240_ppp_documento_id_fkey"
            columns: ["ppp_documento_id"]
            isOneToOne: false
            referencedRelation: "ppp_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esocial_eventos_s2240_ppp_periodo_id_fkey"
            columns: ["ppp_periodo_id"]
            isOneToOne: false
            referencedRelation: "ppp_periodos"
            referencedColumns: ["id"]
          },
        ]
      }
      esocial_import_logs: {
        Row: {
          arquivo_nome: string | null
          base: string
          created_at: string
          empresa_id: string | null
          erros: Json
          id: string
          status: string
          total_atualizados: number
          total_erros: number
          total_ignorados: number
          total_inseridos: number
          total_linhas: number
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          arquivo_nome?: string | null
          base: string
          created_at?: string
          empresa_id?: string | null
          erros?: Json
          id?: string
          status?: string
          total_atualizados?: number
          total_erros?: number
          total_ignorados?: number
          total_inseridos?: number
          total_linhas?: number
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          arquivo_nome?: string | null
          base?: string
          created_at?: string
          empresa_id?: string | null
          erros?: Json
          id?: string
          status?: string
          total_atualizados?: number
          total_erros?: number
          total_ignorados?: number
          total_inseridos?: number
          total_linhas?: number
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "esocial_import_logs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      esocial_municipios_ibge: {
        Row: {
          codigo: string
          nome: string
          uf: string
        }
        Insert: {
          codigo: string
          nome: string
          uf: string
        }
        Update: {
          codigo?: string
          nome?: string
          uf?: string
        }
        Relationships: []
      }
      esocial_retorno_ocorrencias: {
        Row: {
          codigo: string | null
          created_at: string
          descricao: string
          empresa_id: string
          evento_id: string
          id: string
          localizacao: string | null
          origem: string
          tipo: number
        }
        Insert: {
          codigo?: string | null
          created_at?: string
          descricao: string
          empresa_id: string
          evento_id: string
          id?: string
          localizacao?: string | null
          origem?: string
          tipo: number
        }
        Update: {
          codigo?: string | null
          created_at?: string
          descricao?: string
          empresa_id?: string
          evento_id?: string
          id?: string
          localizacao?: string | null
          origem?: string
          tipo?: number
        }
        Relationships: [
          {
            foreignKeyName: "esocial_retorno_ocorrencias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esocial_retorno_ocorrencias_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "esocial_eventos_s2210"
            referencedColumns: ["id"]
          },
        ]
      }
      esocial_s2240_agentes: {
        Row: {
          agente_nome: string
          aposentadoria_especial: boolean
          codigo_t24: string | null
          created_at: string
          eficacia_epc: boolean | null
          eficacia_epi: boolean | null
          empresa_id: string
          evento_id: string
          id: string
          insalubridade: boolean
          intensidade_concentracao: number | null
          justificativa_epi: string | null
          limite_tolerancia: number | null
          periculosidade: boolean
          ppp_exposicao_id: string | null
          tecnica_medicao: string | null
          tipo_avaliacao:
            | Database["public"]["Enums"]["esocial_s2240_tipo_aval"]
            | null
          unidade_medida: string | null
          updated_at: string
          utiliza_epc: boolean | null
          utiliza_epi: boolean | null
        }
        Insert: {
          agente_nome: string
          aposentadoria_especial?: boolean
          codigo_t24?: string | null
          created_at?: string
          eficacia_epc?: boolean | null
          eficacia_epi?: boolean | null
          empresa_id: string
          evento_id: string
          id?: string
          insalubridade?: boolean
          intensidade_concentracao?: number | null
          justificativa_epi?: string | null
          limite_tolerancia?: number | null
          periculosidade?: boolean
          ppp_exposicao_id?: string | null
          tecnica_medicao?: string | null
          tipo_avaliacao?:
            | Database["public"]["Enums"]["esocial_s2240_tipo_aval"]
            | null
          unidade_medida?: string | null
          updated_at?: string
          utiliza_epc?: boolean | null
          utiliza_epi?: boolean | null
        }
        Update: {
          agente_nome?: string
          aposentadoria_especial?: boolean
          codigo_t24?: string | null
          created_at?: string
          eficacia_epc?: boolean | null
          eficacia_epi?: boolean | null
          empresa_id?: string
          evento_id?: string
          id?: string
          insalubridade?: boolean
          intensidade_concentracao?: number | null
          justificativa_epi?: string | null
          limite_tolerancia?: number | null
          periculosidade?: boolean
          ppp_exposicao_id?: string | null
          tecnica_medicao?: string | null
          tipo_avaliacao?:
            | Database["public"]["Enums"]["esocial_s2240_tipo_aval"]
            | null
          unidade_medida?: string | null
          updated_at?: string
          utiliza_epc?: boolean | null
          utiliza_epi?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "esocial_s2240_agentes_codigo_t24_fkey"
            columns: ["codigo_t24"]
            isOneToOne: false
            referencedRelation: "esocial_tabela24_agentes"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "esocial_s2240_agentes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esocial_s2240_agentes_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "esocial_eventos_s2240"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esocial_s2240_agentes_ppp_exposicao_id_fkey"
            columns: ["ppp_exposicao_id"]
            isOneToOne: false
            referencedRelation: "ppp_exposicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      esocial_s2240_epi: {
        Row: {
          agente_evento_id: string | null
          ca_numero: string | null
          ca_validade: string | null
          created_at: string
          descricao: string
          eficaz: boolean | null
          empresa_id: string
          epi_id: string | null
          evento_id: string
          id: string
          observacao: string | null
          updated_at: string
        }
        Insert: {
          agente_evento_id?: string | null
          ca_numero?: string | null
          ca_validade?: string | null
          created_at?: string
          descricao: string
          eficaz?: boolean | null
          empresa_id: string
          epi_id?: string | null
          evento_id: string
          id?: string
          observacao?: string | null
          updated_at?: string
        }
        Update: {
          agente_evento_id?: string | null
          ca_numero?: string | null
          ca_validade?: string | null
          created_at?: string
          descricao?: string
          eficaz?: boolean | null
          empresa_id?: string
          epi_id?: string | null
          evento_id?: string
          id?: string
          observacao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "esocial_s2240_epi_agente_evento_id_fkey"
            columns: ["agente_evento_id"]
            isOneToOne: false
            referencedRelation: "esocial_s2240_agentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esocial_s2240_epi_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esocial_s2240_epi_epi_id_fkey"
            columns: ["epi_id"]
            isOneToOne: false
            referencedRelation: "epis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esocial_s2240_epi_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "esocial_eventos_s2240"
            referencedColumns: ["id"]
          },
        ]
      }
      esocial_s2240_historico: {
        Row: {
          acao: string
          created_at: string
          empresa_id: string
          evento_id: string
          id: string
          observacao: string | null
          status_anterior:
            | Database["public"]["Enums"]["esocial_s2240_status"]
            | null
          status_novo: Database["public"]["Enums"]["esocial_s2240_status"]
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          empresa_id: string
          evento_id: string
          id?: string
          observacao?: string | null
          status_anterior?:
            | Database["public"]["Enums"]["esocial_s2240_status"]
            | null
          status_novo: Database["public"]["Enums"]["esocial_s2240_status"]
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          empresa_id?: string
          evento_id?: string
          id?: string
          observacao?: string | null
          status_anterior?:
            | Database["public"]["Enums"]["esocial_s2240_status"]
            | null
          status_novo?: Database["public"]["Enums"]["esocial_s2240_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "esocial_s2240_historico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esocial_s2240_historico_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "esocial_eventos_s2240"
            referencedColumns: ["id"]
          },
        ]
      }
      esocial_s2240_mapeamentos: {
        Row: {
          agente_nome: string
          aposentadoria_especial: boolean
          aprovado_em: string | null
          aprovado_por: string | null
          codigo_t24: string | null
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          ltcat_catalogo_agente_id: string | null
          observacoes_tecnicas: string | null
          status: Database["public"]["Enums"]["esocial_s2240_mapeamento_status"]
          tipo_avaliacao_esperado:
            | Database["public"]["Enums"]["esocial_s2240_tipo_aval"]
            | null
          unidade_medida_padrao: string | null
          updated_at: string
        }
        Insert: {
          agente_nome: string
          aposentadoria_especial?: boolean
          aprovado_em?: string | null
          aprovado_por?: string | null
          codigo_t24?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          ltcat_catalogo_agente_id?: string | null
          observacoes_tecnicas?: string | null
          status?: Database["public"]["Enums"]["esocial_s2240_mapeamento_status"]
          tipo_avaliacao_esperado?:
            | Database["public"]["Enums"]["esocial_s2240_tipo_aval"]
            | null
          unidade_medida_padrao?: string | null
          updated_at?: string
        }
        Update: {
          agente_nome?: string
          aposentadoria_especial?: boolean
          aprovado_em?: string | null
          aprovado_por?: string | null
          codigo_t24?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          ltcat_catalogo_agente_id?: string | null
          observacoes_tecnicas?: string | null
          status?: Database["public"]["Enums"]["esocial_s2240_mapeamento_status"]
          tipo_avaliacao_esperado?:
            | Database["public"]["Enums"]["esocial_s2240_tipo_aval"]
            | null
          unidade_medida_padrao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "esocial_s2240_mapeamentos_codigo_t24_fkey"
            columns: ["codigo_t24"]
            isOneToOne: false
            referencedRelation: "esocial_tabela24_agentes"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "esocial_s2240_mapeamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esocial_s2240_mapeamentos_ltcat_catalogo_agente_id_fkey"
            columns: ["ltcat_catalogo_agente_id"]
            isOneToOne: false
            referencedRelation: "ltcat_catalogo_agentes"
            referencedColumns: ["id"]
          },
        ]
      }
      esocial_s2240_ocorrencias: {
        Row: {
          created_at: string
          empresa_id: string
          erro_resumido: string | null
          evento_id: string
          id: string
          mensagens: Json
          resultado: Database["public"]["Enums"]["esocial_s2240_ocorrencia_resultado"]
          tipo: Database["public"]["Enums"]["esocial_s2240_ocorrencia_tipo"]
          user_id: string | null
          xml_sha256: string | null
        }
        Insert: {
          created_at?: string
          empresa_id: string
          erro_resumido?: string | null
          evento_id: string
          id?: string
          mensagens?: Json
          resultado: Database["public"]["Enums"]["esocial_s2240_ocorrencia_resultado"]
          tipo: Database["public"]["Enums"]["esocial_s2240_ocorrencia_tipo"]
          user_id?: string | null
          xml_sha256?: string | null
        }
        Update: {
          created_at?: string
          empresa_id?: string
          erro_resumido?: string | null
          evento_id?: string
          id?: string
          mensagens?: Json
          resultado?: Database["public"]["Enums"]["esocial_s2240_ocorrencia_resultado"]
          tipo?: Database["public"]["Enums"]["esocial_s2240_ocorrencia_tipo"]
          user_id?: string | null
          xml_sha256?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "esocial_s2240_ocorrencias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esocial_s2240_ocorrencias_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "esocial_eventos_s2240"
            referencedColumns: ["id"]
          },
        ]
      }
      esocial_s2240_transmissoes: {
        Row: {
          ambiente: number | null
          created_at: string
          empresa_id: string
          endpoint: string | null
          evento_id: string
          id: string
          lote_id: string | null
          observacao: string | null
          protocolo: string | null
          recibo: string | null
          status_transmissao: string | null
          updated_at: string
        }
        Insert: {
          ambiente?: number | null
          created_at?: string
          empresa_id: string
          endpoint?: string | null
          evento_id: string
          id?: string
          lote_id?: string | null
          observacao?: string | null
          protocolo?: string | null
          recibo?: string | null
          status_transmissao?: string | null
          updated_at?: string
        }
        Update: {
          ambiente?: number | null
          created_at?: string
          empresa_id?: string
          endpoint?: string | null
          evento_id?: string
          id?: string
          lote_id?: string | null
          observacao?: string | null
          protocolo?: string | null
          recibo?: string | null
          status_transmissao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "esocial_s2240_transmissoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esocial_s2240_transmissoes_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "esocial_eventos_s2240"
            referencedColumns: ["id"]
          },
        ]
      }
      esocial_tabela24_agentes: {
        Row: {
          aposentadoria_especial: boolean
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string
          grupo: string | null
          id: string
          insalubridade_padrao: boolean
          observacoes: string | null
          origem: Database["public"]["Enums"]["esocial_s2240_origem_t24"]
          periculosidade_padrao: boolean
          tipo_avaliacao:
            | Database["public"]["Enums"]["esocial_s2240_tipo_aval"]
            | null
          unidade_medida_padrao: string | null
          updated_at: string
        }
        Insert: {
          aposentadoria_especial?: boolean
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao: string
          grupo?: string | null
          id?: string
          insalubridade_padrao?: boolean
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["esocial_s2240_origem_t24"]
          periculosidade_padrao?: boolean
          tipo_avaliacao?:
            | Database["public"]["Enums"]["esocial_s2240_tipo_aval"]
            | null
          unidade_medida_padrao?: string | null
          updated_at?: string
        }
        Update: {
          aposentadoria_especial?: boolean
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string
          grupo?: string | null
          id?: string
          insalubridade_padrao?: boolean
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["esocial_s2240_origem_t24"]
          periculosidade_padrao?: boolean
          tipo_avaliacao?:
            | Database["public"]["Enums"]["esocial_s2240_tipo_aval"]
            | null
          unidade_medida_padrao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      estoque_movimentacoes: {
        Row: {
          created_at: string
          created_by: string | null
          empresa_destino_id: string | null
          empresa_id: string | null
          empresa_origem_id: string | null
          epi_id: string
          id: string
          motivo: string | null
          quantidade: number
          tipo: string
          valor_unitario: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empresa_destino_id?: string | null
          empresa_id?: string | null
          empresa_origem_id?: string | null
          epi_id: string
          id?: string
          motivo?: string | null
          quantidade?: number
          tipo?: string
          valor_unitario?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empresa_destino_id?: string | null
          empresa_id?: string | null
          empresa_origem_id?: string | null
          epi_id?: string
          id?: string
          motivo?: string | null
          quantidade?: number
          tipo?: string
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentacoes_empresa_destino_id_fkey"
            columns: ["empresa_destino_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_empresa_origem_id_fkey"
            columns: ["empresa_origem_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_epi_id_fkey"
            columns: ["epi_id"]
            isOneToOne: false
            referencedRelation: "epis"
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
          ghe_id: string | null
          id: string
          matricula: string | null
          nome: string
          regime_revezamento: string | null
          setor: string | null
          unidade_id: string | null
          updated_at: string
          user_id: string | null
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
          ghe_id?: string | null
          id?: string
          matricula?: string | null
          nome: string
          regime_revezamento?: string | null
          setor?: string | null
          unidade_id?: string | null
          updated_at?: string
          user_id?: string | null
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
          ghe_id?: string | null
          id?: string
          matricula?: string | null
          nome?: string
          regime_revezamento?: string | null
          setor?: string | null
          unidade_id?: string | null
          updated_at?: string
          user_id?: string | null
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
            foreignKeyName: "funcionarios_ghe_id_fkey"
            columns: ["ghe_id"]
            isOneToOne: false
            referencedRelation: "ghe_ges"
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
      ghe_exames: {
        Row: {
          admissional: boolean
          aparece_aso: boolean
          codigo_exame: string | null
          created_at: string
          demissional: boolean
          empresa_id: string
          ghe_id: string
          id: string
          mudanca_funcao: boolean
          mudanca_risco: boolean
          nome_exame: string
          obrigatorio: boolean
          observacao: string | null
          periodicidade_meses: number | null
          periodico: boolean
          retorno_trabalho: boolean
          tipo_exame: string | null
          updated_at: string
        }
        Insert: {
          admissional?: boolean
          aparece_aso?: boolean
          codigo_exame?: string | null
          created_at?: string
          demissional?: boolean
          empresa_id: string
          ghe_id: string
          id?: string
          mudanca_funcao?: boolean
          mudanca_risco?: boolean
          nome_exame: string
          obrigatorio?: boolean
          observacao?: string | null
          periodicidade_meses?: number | null
          periodico?: boolean
          retorno_trabalho?: boolean
          tipo_exame?: string | null
          updated_at?: string
        }
        Update: {
          admissional?: boolean
          aparece_aso?: boolean
          codigo_exame?: string | null
          created_at?: string
          demissional?: boolean
          empresa_id?: string
          ghe_id?: string
          id?: string
          mudanca_funcao?: boolean
          mudanca_risco?: boolean
          nome_exame?: string
          obrigatorio?: boolean
          observacao?: string | null
          periodicidade_meses?: number | null
          periodico?: boolean
          retorno_trabalho?: boolean
          tipo_exame?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ghe_exames_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ghe_exames_ghe_id_fkey"
            columns: ["ghe_id"]
            isOneToOne: false
            referencedRelation: "ghe_ges"
            referencedColumns: ["id"]
          },
        ]
      }
      ghe_funcoes: {
        Row: {
          cbo: string | null
          created_at: string
          descricao_atividade: string | null
          empresa_id: string
          ghe_id: string
          id: string
          nome_funcao: string
          observacoes: string | null
          processo: string | null
          quantidade_trabalhadores: number | null
          setor: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cbo?: string | null
          created_at?: string
          descricao_atividade?: string | null
          empresa_id: string
          ghe_id: string
          id?: string
          nome_funcao: string
          observacoes?: string | null
          processo?: string | null
          quantidade_trabalhadores?: number | null
          setor?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cbo?: string | null
          created_at?: string
          descricao_atividade?: string | null
          empresa_id?: string
          ghe_id?: string
          id?: string
          nome_funcao?: string
          observacoes?: string | null
          processo?: string | null
          quantidade_trabalhadores?: number | null
          setor?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ghe_funcoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ghe_funcoes_ghe_id_fkey"
            columns: ["ghe_id"]
            isOneToOne: false
            referencedRelation: "ghe_ges"
            referencedColumns: ["id"]
          },
        ]
      }
      ghe_ges: {
        Row: {
          ambiente: string | null
          capacitacoes_obrigatorias: string | null
          codigo: string
          created_at: string
          created_by: string | null
          descricao: string | null
          descricao_ambiente: string | null
          descricao_atividades: string | null
          empresa_id: string
          epcs: string | null
          frequencia_exposicao: string | null
          id: string
          medidas_controle_existentes: string | null
          medidas_controle_recomendadas: string | null
          nivel_risco: string | null
          nome: string
          observacoes_tecnicas: string | null
          pcmso_id: string | null
          probabilidade: number | null
          processo: string | null
          setor: string | null
          setores: string[]
          severidade: number | null
          status: string
          tempo_exposicao: string | null
          trabalhadores_expostos: number | null
          updated_at: string
        }
        Insert: {
          ambiente?: string | null
          capacitacoes_obrigatorias?: string | null
          codigo: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          descricao_ambiente?: string | null
          descricao_atividades?: string | null
          empresa_id: string
          epcs?: string | null
          frequencia_exposicao?: string | null
          id?: string
          medidas_controle_existentes?: string | null
          medidas_controle_recomendadas?: string | null
          nivel_risco?: string | null
          nome: string
          observacoes_tecnicas?: string | null
          pcmso_id?: string | null
          probabilidade?: number | null
          processo?: string | null
          setor?: string | null
          setores?: string[]
          severidade?: number | null
          status?: string
          tempo_exposicao?: string | null
          trabalhadores_expostos?: number | null
          updated_at?: string
        }
        Update: {
          ambiente?: string | null
          capacitacoes_obrigatorias?: string | null
          codigo?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          descricao_ambiente?: string | null
          descricao_atividades?: string | null
          empresa_id?: string
          epcs?: string | null
          frequencia_exposicao?: string | null
          id?: string
          medidas_controle_existentes?: string | null
          medidas_controle_recomendadas?: string | null
          nivel_risco?: string | null
          nome?: string
          observacoes_tecnicas?: string | null
          pcmso_id?: string | null
          probabilidade?: number | null
          processo?: string | null
          setor?: string | null
          setores?: string[]
          severidade?: number | null
          status?: string
          tempo_exposicao?: string | null
          trabalhadores_expostos?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ghe_ges_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ghe_ges_pcmso_id_fkey"
            columns: ["pcmso_id"]
            isOneToOne: false
            referencedRelation: "pcmso"
            referencedColumns: ["id"]
          },
        ]
      }
      ghe_riscos: {
        Row: {
          aparece_aso: boolean
          created_at: string
          empresa_id: string
          especifico_funcao: boolean
          exposicao: string | null
          funcao_id: string | null
          ghe_id: string
          grupo: string
          id: string
          limite_exposicao: string | null
          perigo_fonte: string | null
          possiveis_lesoes: string | null
          texto_aso: string | null
          tipo_agente: string | null
          updated_at: string
        }
        Insert: {
          aparece_aso?: boolean
          created_at?: string
          empresa_id: string
          especifico_funcao?: boolean
          exposicao?: string | null
          funcao_id?: string | null
          ghe_id: string
          grupo: string
          id?: string
          limite_exposicao?: string | null
          perigo_fonte?: string | null
          possiveis_lesoes?: string | null
          texto_aso?: string | null
          tipo_agente?: string | null
          updated_at?: string
        }
        Update: {
          aparece_aso?: boolean
          created_at?: string
          empresa_id?: string
          especifico_funcao?: boolean
          exposicao?: string | null
          funcao_id?: string | null
          ghe_id?: string
          grupo?: string
          id?: string
          limite_exposicao?: string | null
          perigo_fonte?: string | null
          possiveis_lesoes?: string | null
          texto_aso?: string | null
          tipo_agente?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ghe_riscos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ghe_riscos_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "ghe_funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ghe_riscos_ghe_id_fkey"
            columns: ["ghe_id"]
            isOneToOne: false
            referencedRelation: "ghe_ges"
            referencedColumns: ["id"]
          },
        ]
      }
      ghe_setores: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          ghe_id: string
          id: string
          nome: string
          observacoes: string | null
          processo: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id: string
          ghe_id: string
          id?: string
          nome: string
          observacoes?: string | null
          processo?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          ghe_id?: string
          id?: string
          nome?: string
          observacoes?: string | null
          processo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ghe_setores_ghe_id_fkey"
            columns: ["ghe_id"]
            isOneToOne: false
            referencedRelation: "ghe_ges"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_inventario: {
        Row: {
          colaborador_id: string | null
          colaborador_nome: string | null
          conferencia_id: string
          contrato_id: string
          created_at: string
          empresa_id: string | null
          id: string
          observacao: string | null
          tipo: string
          total_divergencias: number
          total_itens: number
          unidade_id: string
        }
        Insert: {
          colaborador_id?: string | null
          colaborador_nome?: string | null
          conferencia_id: string
          contrato_id: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          observacao?: string | null
          tipo: string
          total_divergencias?: number
          total_itens?: number
          unidade_id: string
        }
        Update: {
          colaborador_id?: string | null
          colaborador_nome?: string | null
          conferencia_id?: string
          contrato_id?: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          observacao?: string | null
          tipo?: string
          total_divergencias?: number
          total_itens?: number
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "historico_inventario_conferencia_id_fkey"
            columns: ["conferencia_id"]
            isOneToOne: false
            referencedRelation: "conferencias_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_inventario_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_inventario_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_inventario_unidade_id_fkey"
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
      laudos_insalubridade: {
        Row: {
          agentes: Json
          base_legal: string | null
          caracterizado: boolean
          created_at: string
          created_by: string | null
          data_avaliacao: string | null
          data_emissao: string | null
          empresa_id: string
          fundamentacao: string | null
          funcao: string | null
          funcionario_id: string | null
          grau_conclusao: string
          id: string
          metodologia: string | null
          pdf_gerado_em: string | null
          percentual_aplicavel: number
          recomendacoes: string | null
          responsavel_tecnico_nome: string | null
          responsavel_tecnico_registro: string | null
          setor: string | null
          status: string
          titulo: string
          updated_at: string
          versao: number
        }
        Insert: {
          agentes?: Json
          base_legal?: string | null
          caracterizado?: boolean
          created_at?: string
          created_by?: string | null
          data_avaliacao?: string | null
          data_emissao?: string | null
          empresa_id: string
          fundamentacao?: string | null
          funcao?: string | null
          funcionario_id?: string | null
          grau_conclusao?: string
          id?: string
          metodologia?: string | null
          pdf_gerado_em?: string | null
          percentual_aplicavel?: number
          recomendacoes?: string | null
          responsavel_tecnico_nome?: string | null
          responsavel_tecnico_registro?: string | null
          setor?: string | null
          status?: string
          titulo: string
          updated_at?: string
          versao?: number
        }
        Update: {
          agentes?: Json
          base_legal?: string | null
          caracterizado?: boolean
          created_at?: string
          created_by?: string | null
          data_avaliacao?: string | null
          data_emissao?: string | null
          empresa_id?: string
          fundamentacao?: string | null
          funcao?: string | null
          funcionario_id?: string | null
          grau_conclusao?: string
          id?: string
          metodologia?: string | null
          pdf_gerado_em?: string | null
          percentual_aplicavel?: number
          recomendacoes?: string | null
          responsavel_tecnico_nome?: string | null
          responsavel_tecnico_registro?: string | null
          setor?: string | null
          status?: string
          titulo?: string
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "laudos_insalubridade_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      laudos_periculosidade: {
        Row: {
          atividades: Json
          base_legal: string | null
          caracterizado: boolean
          created_at: string
          created_by: string | null
          data_avaliacao: string | null
          data_emissao: string | null
          empresa_id: string
          fundamentacao: string | null
          funcao: string | null
          funcionario_id: string | null
          id: string
          metodologia: string | null
          pdf_gerado_em: string | null
          percentual_aplicavel: number
          recomendacoes: string | null
          responsavel_tecnico_nome: string | null
          responsavel_tecnico_registro: string | null
          setor: string | null
          status: string
          titulo: string
          updated_at: string
          versao: number
        }
        Insert: {
          atividades?: Json
          base_legal?: string | null
          caracterizado?: boolean
          created_at?: string
          created_by?: string | null
          data_avaliacao?: string | null
          data_emissao?: string | null
          empresa_id: string
          fundamentacao?: string | null
          funcao?: string | null
          funcionario_id?: string | null
          id?: string
          metodologia?: string | null
          pdf_gerado_em?: string | null
          percentual_aplicavel?: number
          recomendacoes?: string | null
          responsavel_tecnico_nome?: string | null
          responsavel_tecnico_registro?: string | null
          setor?: string | null
          status?: string
          titulo: string
          updated_at?: string
          versao?: number
        }
        Update: {
          atividades?: Json
          base_legal?: string | null
          caracterizado?: boolean
          created_at?: string
          created_by?: string | null
          data_avaliacao?: string | null
          data_emissao?: string | null
          empresa_id?: string
          fundamentacao?: string | null
          funcao?: string | null
          funcionario_id?: string | null
          id?: string
          metodologia?: string | null
          pdf_gerado_em?: string | null
          percentual_aplicavel?: number
          recomendacoes?: string | null
          responsavel_tecnico_nome?: string | null
          responsavel_tecnico_registro?: string | null
          setor?: string | null
          status?: string
          titulo?: string
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "laudos_periculosidade_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      locais_emissao_aso: {
        Row: {
          ativo: boolean
          cidade: string | null
          created_at: string
          created_by: string | null
          empresa_id: string
          endereco: string | null
          id: string
          nome: string
          padrao: boolean
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id: string
          endereco?: string | null
          id?: string
          nome: string
          padrao?: boolean
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          endereco?: string | null
          id?: string
          nome?: string
          padrao?: boolean
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ltcat_agentes: {
        Row: {
          catalogo_id: string | null
          codigo_esocial: string
          created_at: string
          created_by: string | null
          duracao: string | null
          empresa_id: string
          epc_descricao: string | null
          epc_eficacia: string | null
          epi_ca: string | null
          epi_descricao: string | null
          epi_eficacia: string | null
          fonte_geradora: string | null
          frequencia: string | null
          grupo: Database["public"]["Enums"]["ltcat_agente_grupo"]
          grupo_homogeneo_id: string
          id: string
          ltcat_id: string
          meio_propagacao: string | null
          nome: string
          observacoes: string | null
          tipo_exposicao: string | null
          trajetoria: string | null
          updated_at: string
        }
        Insert: {
          catalogo_id?: string | null
          codigo_esocial: string
          created_at?: string
          created_by?: string | null
          duracao?: string | null
          empresa_id: string
          epc_descricao?: string | null
          epc_eficacia?: string | null
          epi_ca?: string | null
          epi_descricao?: string | null
          epi_eficacia?: string | null
          fonte_geradora?: string | null
          frequencia?: string | null
          grupo: Database["public"]["Enums"]["ltcat_agente_grupo"]
          grupo_homogeneo_id: string
          id?: string
          ltcat_id: string
          meio_propagacao?: string | null
          nome: string
          observacoes?: string | null
          tipo_exposicao?: string | null
          trajetoria?: string | null
          updated_at?: string
        }
        Update: {
          catalogo_id?: string | null
          codigo_esocial?: string
          created_at?: string
          created_by?: string | null
          duracao?: string | null
          empresa_id?: string
          epc_descricao?: string | null
          epc_eficacia?: string | null
          epi_ca?: string | null
          epi_descricao?: string | null
          epi_eficacia?: string | null
          fonte_geradora?: string | null
          frequencia?: string | null
          grupo?: Database["public"]["Enums"]["ltcat_agente_grupo"]
          grupo_homogeneo_id?: string
          id?: string
          ltcat_id?: string
          meio_propagacao?: string | null
          nome?: string
          observacoes?: string | null
          tipo_exposicao?: string | null
          trajetoria?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ltcat_agentes_catalogo_id_fkey"
            columns: ["catalogo_id"]
            isOneToOne: false
            referencedRelation: "ltcat_catalogo_agentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ltcat_agentes_grupo_homogeneo_id_fkey"
            columns: ["grupo_homogeneo_id"]
            isOneToOne: false
            referencedRelation: "ltcat_grupos_homogeneos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ltcat_agentes_ltcat_id_fkey"
            columns: ["ltcat_id"]
            isOneToOne: false
            referencedRelation: "ltcat_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      ltcat_anexos: {
        Row: {
          avaliacao_id: string | null
          created_at: string
          descricao: string | null
          drive_file_id: string
          drive_path: string | null
          drive_view_link: string | null
          empresa_id: string
          id: string
          ltcat_id: string
          mime_type: string | null
          nome_arquivo: string
          tamanho_bytes: number | null
          tipo: string
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          avaliacao_id?: string | null
          created_at?: string
          descricao?: string | null
          drive_file_id: string
          drive_path?: string | null
          drive_view_link?: string | null
          empresa_id: string
          id?: string
          ltcat_id: string
          mime_type?: string | null
          nome_arquivo: string
          tamanho_bytes?: number | null
          tipo: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          avaliacao_id?: string | null
          created_at?: string
          descricao?: string | null
          drive_file_id?: string
          drive_path?: string | null
          drive_view_link?: string | null
          empresa_id?: string
          id?: string
          ltcat_id?: string
          mime_type?: string | null
          nome_arquivo?: string
          tamanho_bytes?: number | null
          tipo?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ltcat_anexos_avaliacao_id_fkey"
            columns: ["avaliacao_id"]
            isOneToOne: false
            referencedRelation: "ltcat_avaliacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ltcat_anexos_ltcat_id_fkey"
            columns: ["ltcat_id"]
            isOneToOne: false
            referencedRelation: "ltcat_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      ltcat_assinaturas: {
        Row: {
          assinado_em: string
          empresa_id: string
          id: string
          ip_origem: string | null
          ltcat_id: string
          observacao: string | null
          pdf_hash: string
          pdf_versao: number | null
          responsavel_cpf: string | null
          responsavel_nome: string
          responsavel_registro: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          assinado_em?: string
          empresa_id: string
          id?: string
          ip_origem?: string | null
          ltcat_id: string
          observacao?: string | null
          pdf_hash: string
          pdf_versao?: number | null
          responsavel_cpf?: string | null
          responsavel_nome: string
          responsavel_registro?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          assinado_em?: string
          empresa_id?: string
          id?: string
          ip_origem?: string | null
          ltcat_id?: string
          observacao?: string | null
          pdf_hash?: string
          pdf_versao?: number | null
          responsavel_cpf?: string | null
          responsavel_nome?: string
          responsavel_registro?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ltcat_assinaturas_ltcat_id_fkey"
            columns: ["ltcat_id"]
            isOneToOne: false
            referencedRelation: "ltcat_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      ltcat_avaliacoes: {
        Row: {
          agente_id: string
          base_normativa_limite: string | null
          certificado_calibracao_drive_id: string | null
          certificado_calibracao_link: string | null
          created_at: string
          created_by: string | null
          data_medicao: string | null
          empresa_id: string
          enquadramento: Database["public"]["Enums"]["ltcat_enquadramento"]
          epc_descricao: string | null
          epi_ca: string | null
          epi_descricao: string | null
          epi_eficacia: string | null
          grupo_homogeneo_id: string
          id: string
          instrumento_calibracao_data: string | null
          instrumento_calibracao_validade: string | null
          instrumento_marca: string | null
          instrumento_modelo: string | null
          instrumento_serie: string | null
          intensidade: number | null
          justificativa_qualitativa: string | null
          limite_tolerancia: number | null
          ltcat_id: string
          metodologia: string | null
          norma_referencia: string | null
          observacoes: string | null
          origem_pgr_item_id: string | null
          percentual_jornada: number | null
          pgr_id: string | null
          responsavel_medicao: string | null
          tecnica: Database["public"]["Enums"]["ltcat_tecnica_avaliacao"]
          tempo_exposicao_horas: number | null
          tempo_medicao_minutos: number | null
          unidade_medida: string | null
          updated_at: string
        }
        Insert: {
          agente_id: string
          base_normativa_limite?: string | null
          certificado_calibracao_drive_id?: string | null
          certificado_calibracao_link?: string | null
          created_at?: string
          created_by?: string | null
          data_medicao?: string | null
          empresa_id: string
          enquadramento?: Database["public"]["Enums"]["ltcat_enquadramento"]
          epc_descricao?: string | null
          epi_ca?: string | null
          epi_descricao?: string | null
          epi_eficacia?: string | null
          grupo_homogeneo_id: string
          id?: string
          instrumento_calibracao_data?: string | null
          instrumento_calibracao_validade?: string | null
          instrumento_marca?: string | null
          instrumento_modelo?: string | null
          instrumento_serie?: string | null
          intensidade?: number | null
          justificativa_qualitativa?: string | null
          limite_tolerancia?: number | null
          ltcat_id: string
          metodologia?: string | null
          norma_referencia?: string | null
          observacoes?: string | null
          origem_pgr_item_id?: string | null
          percentual_jornada?: number | null
          pgr_id?: string | null
          responsavel_medicao?: string | null
          tecnica?: Database["public"]["Enums"]["ltcat_tecnica_avaliacao"]
          tempo_exposicao_horas?: number | null
          tempo_medicao_minutos?: number | null
          unidade_medida?: string | null
          updated_at?: string
        }
        Update: {
          agente_id?: string
          base_normativa_limite?: string | null
          certificado_calibracao_drive_id?: string | null
          certificado_calibracao_link?: string | null
          created_at?: string
          created_by?: string | null
          data_medicao?: string | null
          empresa_id?: string
          enquadramento?: Database["public"]["Enums"]["ltcat_enquadramento"]
          epc_descricao?: string | null
          epi_ca?: string | null
          epi_descricao?: string | null
          epi_eficacia?: string | null
          grupo_homogeneo_id?: string
          id?: string
          instrumento_calibracao_data?: string | null
          instrumento_calibracao_validade?: string | null
          instrumento_marca?: string | null
          instrumento_modelo?: string | null
          instrumento_serie?: string | null
          intensidade?: number | null
          justificativa_qualitativa?: string | null
          limite_tolerancia?: number | null
          ltcat_id?: string
          metodologia?: string | null
          norma_referencia?: string | null
          observacoes?: string | null
          origem_pgr_item_id?: string | null
          percentual_jornada?: number | null
          pgr_id?: string | null
          responsavel_medicao?: string | null
          tecnica?: Database["public"]["Enums"]["ltcat_tecnica_avaliacao"]
          tempo_exposicao_horas?: number | null
          tempo_medicao_minutos?: number | null
          unidade_medida?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ltcat_avaliacoes_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "ltcat_agentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ltcat_avaliacoes_grupo_homogeneo_id_fkey"
            columns: ["grupo_homogeneo_id"]
            isOneToOne: false
            referencedRelation: "ltcat_grupos_homogeneos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ltcat_avaliacoes_ltcat_id_fkey"
            columns: ["ltcat_id"]
            isOneToOne: false
            referencedRelation: "ltcat_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ltcat_avaliacoes_origem_pgr_item_id_fkey"
            columns: ["origem_pgr_item_id"]
            isOneToOne: false
            referencedRelation: "pgr_inventario_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ltcat_avaliacoes_pgr_id_fkey"
            columns: ["pgr_id"]
            isOneToOne: false
            referencedRelation: "pgr_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      ltcat_catalogo_agentes: {
        Row: {
          ativo: boolean
          base_normativa: string | null
          codigo_esocial: string
          created_at: string
          created_by: string | null
          empresa_id: string | null
          grupo: Database["public"]["Enums"]["ltcat_agente_grupo"]
          id: string
          limite_tolerancia: number | null
          nome: string
          observacoes: string | null
          sinonimos: string[] | null
          unidade_medida: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          base_normativa?: string | null
          codigo_esocial: string
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          grupo: Database["public"]["Enums"]["ltcat_agente_grupo"]
          id?: string
          limite_tolerancia?: number | null
          nome: string
          observacoes?: string | null
          sinonimos?: string[] | null
          unidade_medida?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          base_normativa?: string | null
          codigo_esocial?: string
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          grupo?: Database["public"]["Enums"]["ltcat_agente_grupo"]
          id?: string
          limite_tolerancia?: number | null
          nome?: string
          observacoes?: string | null
          sinonimos?: string[] | null
          unidade_medida?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ltcat_catalogo_agentes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      ltcat_conclusoes: {
        Row: {
          agentes_considerados: Json | null
          conclusao: Database["public"]["Enums"]["ltcat_conclusao_aposentadoria"]
          created_at: string
          created_by: string | null
          empresa_id: string
          enquadramento:
            | Database["public"]["Enums"]["ltcat_enquadramento"]
            | null
          epc_considerados: string | null
          epi_considerados: string | null
          funcao_id: string | null
          fundamento_legal: string | null
          grupo_homogeneo_id: string | null
          id: string
          justificativa: string | null
          ltcat_id: string
          observacoes: string | null
          tipo_exposicao: string | null
          updated_at: string
        }
        Insert: {
          agentes_considerados?: Json | null
          conclusao?: Database["public"]["Enums"]["ltcat_conclusao_aposentadoria"]
          created_at?: string
          created_by?: string | null
          empresa_id: string
          enquadramento?:
            | Database["public"]["Enums"]["ltcat_enquadramento"]
            | null
          epc_considerados?: string | null
          epi_considerados?: string | null
          funcao_id?: string | null
          fundamento_legal?: string | null
          grupo_homogeneo_id?: string | null
          id?: string
          justificativa?: string | null
          ltcat_id: string
          observacoes?: string | null
          tipo_exposicao?: string | null
          updated_at?: string
        }
        Update: {
          agentes_considerados?: Json | null
          conclusao?: Database["public"]["Enums"]["ltcat_conclusao_aposentadoria"]
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          enquadramento?:
            | Database["public"]["Enums"]["ltcat_enquadramento"]
            | null
          epc_considerados?: string | null
          epi_considerados?: string | null
          funcao_id?: string | null
          fundamento_legal?: string | null
          grupo_homogeneo_id?: string | null
          id?: string
          justificativa?: string | null
          ltcat_id?: string
          observacoes?: string | null
          tipo_exposicao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ltcat_conclusoes_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "ltcat_funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ltcat_conclusoes_grupo_homogeneo_id_fkey"
            columns: ["grupo_homogeneo_id"]
            isOneToOne: false
            referencedRelation: "ltcat_grupos_homogeneos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ltcat_conclusoes_ltcat_id_fkey"
            columns: ["ltcat_id"]
            isOneToOne: false
            referencedRelation: "ltcat_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      ltcat_documentos: {
        Row: {
          cnae: string | null
          conteudo_atualizado_em: string
          created_at: string
          created_by: string | null
          data_emissao: string | null
          data_vigencia_fim: string | null
          data_vigencia_inicio: string | null
          empresa_id: string
          escopo: string | null
          grau_risco: number | null
          id: string
          metodologia_geral: string | null
          motivo_emissao: Database["public"]["Enums"]["ltcat_motivo_emissao"]
          observacoes: string | null
          pgr_id: string | null
          publicado_em: string | null
          publicado_por: string | null
          status: Database["public"]["Enums"]["ltcat_status"]
          unidade_id: string | null
          updated_at: string
          updated_by: string | null
          versao: number
          versao_pai_id: string | null
        }
        Insert: {
          cnae?: string | null
          conteudo_atualizado_em?: string
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          data_vigencia_fim?: string | null
          data_vigencia_inicio?: string | null
          empresa_id: string
          escopo?: string | null
          grau_risco?: number | null
          id?: string
          metodologia_geral?: string | null
          motivo_emissao?: Database["public"]["Enums"]["ltcat_motivo_emissao"]
          observacoes?: string | null
          pgr_id?: string | null
          publicado_em?: string | null
          publicado_por?: string | null
          status?: Database["public"]["Enums"]["ltcat_status"]
          unidade_id?: string | null
          updated_at?: string
          updated_by?: string | null
          versao?: number
          versao_pai_id?: string | null
        }
        Update: {
          cnae?: string | null
          conteudo_atualizado_em?: string
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          data_vigencia_fim?: string | null
          data_vigencia_inicio?: string | null
          empresa_id?: string
          escopo?: string | null
          grau_risco?: number | null
          id?: string
          metodologia_geral?: string | null
          motivo_emissao?: Database["public"]["Enums"]["ltcat_motivo_emissao"]
          observacoes?: string | null
          pgr_id?: string | null
          publicado_em?: string | null
          publicado_por?: string | null
          status?: Database["public"]["Enums"]["ltcat_status"]
          unidade_id?: string | null
          updated_at?: string
          updated_by?: string | null
          versao?: number
          versao_pai_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ltcat_documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ltcat_documentos_pgr_id_fkey"
            columns: ["pgr_id"]
            isOneToOne: false
            referencedRelation: "pgr_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ltcat_documentos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ltcat_documentos_versao_pai_id_fkey"
            columns: ["versao_pai_id"]
            isOneToOne: false
            referencedRelation: "ltcat_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      ltcat_funcoes: {
        Row: {
          cbo: string | null
          created_at: string
          created_by: string | null
          descricao_atividade: string | null
          empresa_id: string
          funcao_origem_id: string | null
          grupo_homogeneo_id: string
          id: string
          ltcat_id: string
          nome_funcao: string
          numero_trabalhadores: number | null
          observacoes: string | null
          updated_at: string
        }
        Insert: {
          cbo?: string | null
          created_at?: string
          created_by?: string | null
          descricao_atividade?: string | null
          empresa_id: string
          funcao_origem_id?: string | null
          grupo_homogeneo_id: string
          id?: string
          ltcat_id: string
          nome_funcao: string
          numero_trabalhadores?: number | null
          observacoes?: string | null
          updated_at?: string
        }
        Update: {
          cbo?: string | null
          created_at?: string
          created_by?: string | null
          descricao_atividade?: string | null
          empresa_id?: string
          funcao_origem_id?: string | null
          grupo_homogeneo_id?: string
          id?: string
          ltcat_id?: string
          nome_funcao?: string
          numero_trabalhadores?: number | null
          observacoes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ltcat_funcoes_funcao_origem_id_fkey"
            columns: ["funcao_origem_id"]
            isOneToOne: false
            referencedRelation: "aso_funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ltcat_funcoes_grupo_homogeneo_id_fkey"
            columns: ["grupo_homogeneo_id"]
            isOneToOne: false
            referencedRelation: "ltcat_grupos_homogeneos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ltcat_funcoes_ltcat_id_fkey"
            columns: ["ltcat_id"]
            isOneToOne: false
            referencedRelation: "ltcat_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      ltcat_grupos_homogeneos: {
        Row: {
          codigo: string
          created_at: string
          created_by: string | null
          descricao: string | null
          descricao_atividade: string | null
          empresa_id: string
          ghe_origem_id: string | null
          id: string
          ltcat_id: string
          nome: string
          numero_trabalhadores: number
          setor_nome: string | null
          updated_at: string
        }
        Insert: {
          codigo: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          descricao_atividade?: string | null
          empresa_id: string
          ghe_origem_id?: string | null
          id?: string
          ltcat_id: string
          nome: string
          numero_trabalhadores?: number
          setor_nome?: string | null
          updated_at?: string
        }
        Update: {
          codigo?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          descricao_atividade?: string | null
          empresa_id?: string
          ghe_origem_id?: string | null
          id?: string
          ltcat_id?: string
          nome?: string
          numero_trabalhadores?: number
          setor_nome?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ltcat_grupos_homogeneos_ghe_origem_id_fkey"
            columns: ["ghe_origem_id"]
            isOneToOne: false
            referencedRelation: "ghe_ges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ltcat_grupos_homogeneos_ltcat_id_fkey"
            columns: ["ltcat_id"]
            isOneToOne: false
            referencedRelation: "ltcat_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      ltcat_pdf_versoes: {
        Row: {
          com_marca_dagua: boolean
          drive_file_id: string | null
          drive_path: string | null
          drive_view_link: string | null
          empresa_id: string
          gerado_em: string
          gerado_por: string | null
          id: string
          ltcat_id: string
          nome_arquivo: string | null
          pdf_hash: string
          pdf_versao: number
          status_no_momento: Database["public"]["Enums"]["ltcat_status"]
          storage_bucket: string | null
          storage_path: string | null
          storage_provider: string
          tamanho_bytes: number | null
        }
        Insert: {
          com_marca_dagua?: boolean
          drive_file_id?: string | null
          drive_path?: string | null
          drive_view_link?: string | null
          empresa_id: string
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          ltcat_id: string
          nome_arquivo?: string | null
          pdf_hash: string
          pdf_versao: number
          status_no_momento: Database["public"]["Enums"]["ltcat_status"]
          storage_bucket?: string | null
          storage_path?: string | null
          storage_provider?: string
          tamanho_bytes?: number | null
        }
        Update: {
          com_marca_dagua?: boolean
          drive_file_id?: string | null
          drive_path?: string | null
          drive_view_link?: string | null
          empresa_id?: string
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          ltcat_id?: string
          nome_arquivo?: string | null
          pdf_hash?: string
          pdf_versao?: number
          status_no_momento?: Database["public"]["Enums"]["ltcat_status"]
          storage_bucket?: string | null
          storage_path?: string | null
          storage_provider?: string
          tamanho_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ltcat_pdf_versoes_ltcat_id_fkey"
            columns: ["ltcat_id"]
            isOneToOne: false
            referencedRelation: "ltcat_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      ltcat_responsaveis_tecnicos: {
        Row: {
          cpf: string | null
          created_at: string
          created_by: string | null
          email: string | null
          empresa_id: string
          id: string
          ltcat_id: string
          nome: string
          numero_art: string | null
          ordem: number
          profissao: string
          registro_profissional: string
          telefone: string | null
          uf_registro: string | null
          updated_at: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          empresa_id: string
          id?: string
          ltcat_id: string
          nome: string
          numero_art?: string | null
          ordem?: number
          profissao: string
          registro_profissional: string
          telefone?: string | null
          uf_registro?: string | null
          updated_at?: string
        }
        Update: {
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          empresa_id?: string
          id?: string
          ltcat_id?: string
          nome?: string
          numero_art?: string | null
          ordem?: number
          profissao?: string
          registro_profissional?: string
          telefone?: string | null
          uf_registro?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ltcat_responsaveis_tecnicos_ltcat_id_fkey"
            columns: ["ltcat_id"]
            isOneToOne: false
            referencedRelation: "ltcat_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      ltcat_revisoes: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          ltcat_id: string
          motivo: string
          resumo_alteracoes: string | null
          status_anterior: Database["public"]["Enums"]["ltcat_status"] | null
          status_novo: Database["public"]["Enums"]["ltcat_status"] | null
          user_email: string | null
          user_id: string | null
          versao_anterior: number | null
          versao_nova: number | null
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          ltcat_id: string
          motivo: string
          resumo_alteracoes?: string | null
          status_anterior?: Database["public"]["Enums"]["ltcat_status"] | null
          status_novo?: Database["public"]["Enums"]["ltcat_status"] | null
          user_email?: string | null
          user_id?: string | null
          versao_anterior?: number | null
          versao_nova?: number | null
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          ltcat_id?: string
          motivo?: string
          resumo_alteracoes?: string | null
          status_anterior?: Database["public"]["Enums"]["ltcat_status"] | null
          status_novo?: Database["public"]["Enums"]["ltcat_status"] | null
          user_email?: string | null
          user_id?: string | null
          versao_anterior?: number | null
          versao_nova?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ltcat_revisoes_ltcat_id_fkey"
            columns: ["ltcat_id"]
            isOneToOne: false
            referencedRelation: "ltcat_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      ltcat_setores_avaliados: {
        Row: {
          created_at: string
          created_by: string | null
          descricao_local: string | null
          empresa_id: string
          id: string
          ltcat_id: string
          nome_setor: string
          setor_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao_local?: string | null
          empresa_id: string
          id?: string
          ltcat_id: string
          nome_setor: string
          setor_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao_local?: string | null
          empresa_id?: string
          id?: string
          ltcat_id?: string
          nome_setor?: string
          setor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ltcat_setores_avaliados_ltcat_id_fkey"
            columns: ["ltcat_id"]
            isOneToOne: false
            referencedRelation: "ltcat_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ltcat_setores_avaliados_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "aso_setores"
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
      mfa_enforcement: {
        Row: {
          created_at: string
          enforced_at: string | null
          grace_days: number
          grace_started_at: string
          updated_at: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          enforced_at?: string | null
          grace_days?: number
          grace_started_at?: string
          updated_at?: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          enforced_at?: string | null
          grace_days?: number
          grace_started_at?: string
          updated_at?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      obras: {
        Row: {
          cidade: string | null
          codigo: string | null
          created_at: string
          created_by: string | null
          empresa_id: string
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          status: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id: string
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          status?: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          status?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      orcamentos: {
        Row: {
          aprovado_em: string | null
          cancelado_em: string | null
          cartao_credito_config: Json | null
          cliente_cnpj_cpf: string | null
          cliente_email: string | null
          cliente_endereco: string | null
          cliente_id: string | null
          cliente_nome: string | null
          cliente_telefone: string | null
          condicoes_pagamento: string | null
          condicoes_pagamento_detalhe: string | null
          created_at: string
          created_by: string | null
          data_emissao: string
          data_validade: string | null
          desconto_tipo: string | null
          desconto_valor: number
          empresa_id: string
          enviado_em: string | null
          formas_pagamento: Json
          id: string
          impostos_valor: number
          modelo: string | null
          motivo_recusa: string | null
          numero_orcamento: string
          observacoes: string | null
          pagamento_config: Json | null
          prazo_execucao: string | null
          prioridade: string | null
          recusado_em: string | null
          responsavel_cliente: string | null
          status: string
          subtotal: number
          taxa_extra: number
          titulo: string
          total: number
          updated_at: string
          validade_proposta: string | null
          visualizado_em: string | null
        }
        Insert: {
          aprovado_em?: string | null
          cancelado_em?: string | null
          cartao_credito_config?: Json | null
          cliente_cnpj_cpf?: string | null
          cliente_email?: string | null
          cliente_endereco?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          condicoes_pagamento?: string | null
          condicoes_pagamento_detalhe?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          data_validade?: string | null
          desconto_tipo?: string | null
          desconto_valor?: number
          empresa_id: string
          enviado_em?: string | null
          formas_pagamento?: Json
          id?: string
          impostos_valor?: number
          modelo?: string | null
          motivo_recusa?: string | null
          numero_orcamento: string
          observacoes?: string | null
          pagamento_config?: Json | null
          prazo_execucao?: string | null
          prioridade?: string | null
          recusado_em?: string | null
          responsavel_cliente?: string | null
          status?: string
          subtotal?: number
          taxa_extra?: number
          titulo: string
          total?: number
          updated_at?: string
          validade_proposta?: string | null
          visualizado_em?: string | null
        }
        Update: {
          aprovado_em?: string | null
          cancelado_em?: string | null
          cartao_credito_config?: Json | null
          cliente_cnpj_cpf?: string | null
          cliente_email?: string | null
          cliente_endereco?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          condicoes_pagamento?: string | null
          condicoes_pagamento_detalhe?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          data_validade?: string | null
          desconto_tipo?: string | null
          desconto_valor?: number
          empresa_id?: string
          enviado_em?: string | null
          formas_pagamento?: Json
          id?: string
          impostos_valor?: number
          modelo?: string | null
          motivo_recusa?: string | null
          numero_orcamento?: string
          observacoes?: string | null
          pagamento_config?: Json | null
          prazo_execucao?: string | null
          prioridade?: string | null
          recusado_em?: string | null
          responsavel_cliente?: string | null
          status?: string
          subtotal?: number
          taxa_extra?: number
          titulo?: string
          total?: number
          updated_at?: string
          validade_proposta?: string | null
          visualizado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes_comerciais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos_itens: {
        Row: {
          codigo: string | null
          created_at: string
          desconto: number
          descricao: string
          detalhe: string | null
          empresa_id: string
          id: string
          observacoes: string | null
          orcamento_id: string
          ordem: number
          quantidade: number
          tipo: string | null
          total_item: number
          unidade: string | null
          updated_at: string
          valor_unitario: number
        }
        Insert: {
          codigo?: string | null
          created_at?: string
          desconto?: number
          descricao: string
          detalhe?: string | null
          empresa_id: string
          id?: string
          observacoes?: string | null
          orcamento_id: string
          ordem?: number
          quantidade?: number
          tipo?: string | null
          total_item?: number
          unidade?: string | null
          updated_at?: string
          valor_unitario?: number
        }
        Update: {
          codigo?: string | null
          created_at?: string
          desconto?: number
          descricao?: string
          detalhe?: string | null
          empresa_id?: string
          id?: string
          observacoes?: string | null
          orcamento_id?: string
          ordem?: number
          quantidade?: number
          tipo?: string | null
          total_item?: number
          unidade?: string | null
          updated_at?: string
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
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
      ordens_servico_sst: {
        Row: {
          atividades: string | null
          created_at: string
          created_by: string | null
          data_emissao: string | null
          empresa_id: string
          epis_snapshot: Json
          escopo: string
          funcao_id: string | null
          funcionario_id: string | null
          ghe_id: string | null
          id: string
          medidas_preventivas: string | null
          pdf_drive_view_link: string | null
          pdf_gerado_em: string | null
          pdf_hash: string | null
          procedimentos_acidente: string | null
          proibicoes: string | null
          responsabilidades: string | null
          responsavel_tecnico_nome: string | null
          responsavel_tecnico_registro: string | null
          riscos_snapshot: Json
          status: string
          titulo: string
          updated_at: string
          versao: number
        }
        Insert: {
          atividades?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          empresa_id: string
          epis_snapshot?: Json
          escopo: string
          funcao_id?: string | null
          funcionario_id?: string | null
          ghe_id?: string | null
          id?: string
          medidas_preventivas?: string | null
          pdf_drive_view_link?: string | null
          pdf_gerado_em?: string | null
          pdf_hash?: string | null
          procedimentos_acidente?: string | null
          proibicoes?: string | null
          responsabilidades?: string | null
          responsavel_tecnico_nome?: string | null
          responsavel_tecnico_registro?: string | null
          riscos_snapshot?: Json
          status?: string
          titulo: string
          updated_at?: string
          versao?: number
        }
        Update: {
          atividades?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          empresa_id?: string
          epis_snapshot?: Json
          escopo?: string
          funcao_id?: string | null
          funcionario_id?: string | null
          ghe_id?: string | null
          id?: string
          medidas_preventivas?: string | null
          pdf_drive_view_link?: string | null
          pdf_gerado_em?: string | null
          pdf_hash?: string | null
          procedimentos_acidente?: string | null
          proibicoes?: string | null
          responsabilidades?: string | null
          responsavel_tecnico_nome?: string | null
          responsavel_tecnico_registro?: string | null
          riscos_snapshot?: Json
          status?: string
          titulo?: string
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_sst_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_sst_ghe_id_fkey"
            columns: ["ghe_id"]
            isOneToOne: false
            referencedRelation: "ghe_ges"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_servico_sst_assinaturas: {
        Row: {
          assinado_em: string
          assinatura_url: string | null
          created_at: string
          empresa_id: string
          funcionario_id: string | null
          id: string
          observacao: string | null
          os_id: string
        }
        Insert: {
          assinado_em?: string
          assinatura_url?: string | null
          created_at?: string
          empresa_id: string
          funcionario_id?: string | null
          id?: string
          observacao?: string | null
          os_id: string
        }
        Update: {
          assinado_em?: string
          assinatura_url?: string | null
          created_at?: string
          empresa_id?: string
          funcionario_id?: string | null
          id?: string
          observacao?: string | null
          os_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_sst_assinaturas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_sst_assinaturas_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico_sst"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_servico_sst_pdf_versoes: {
        Row: {
          bucket: string | null
          created_at: string
          empresa_id: string
          gerado_por: string | null
          gerado_por_email: string | null
          id: string
          os_id: string
          path: string | null
          pdf_drive_view_link: string | null
          pdf_hash: string
          tamanho_bytes: number | null
          versao: number
        }
        Insert: {
          bucket?: string | null
          created_at?: string
          empresa_id: string
          gerado_por?: string | null
          gerado_por_email?: string | null
          id?: string
          os_id: string
          path?: string | null
          pdf_drive_view_link?: string | null
          pdf_hash: string
          tamanho_bytes?: number | null
          versao: number
        }
        Update: {
          bucket?: string | null
          created_at?: string
          empresa_id?: string
          gerado_por?: string | null
          gerado_por_email?: string | null
          id?: string
          os_id?: string
          path?: string | null
          pdf_drive_view_link?: string | null
          pdf_hash?: string
          tamanho_bytes?: number | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_sst_pdf_versoes_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico_sst"
            referencedColumns: ["id"]
          },
        ]
      }
      pcmso: {
        Row: {
          created_at: string
          created_by: string | null
          data_elaboracao: string | null
          data_validade: string | null
          empresa_id: string
          id: string
          medico_responsavel_id: string | null
          observacoes: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_elaboracao?: string | null
          data_validade?: string | null
          empresa_id: string
          id?: string
          medico_responsavel_id?: string | null
          observacoes?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_elaboracao?: string | null
          data_validade?: string | null
          empresa_id?: string
          id?: string
          medico_responsavel_id?: string | null
          observacoes?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pcmso_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pcmso_medico_responsavel_id_fkey"
            columns: ["medico_responsavel_id"]
            isOneToOne: false
            referencedRelation: "aso_medicos"
            referencedColumns: ["id"]
          },
        ]
      }
      pcmso_cronograma_acoes: {
        Row: {
          acao: string
          created_at: string
          data_planejada: string | null
          empresa_id: string
          id: string
          observacoes: string | null
          pcmso_id: string
          responsavel: string | null
          status: string
          updated_at: string
        }
        Insert: {
          acao: string
          created_at?: string
          data_planejada?: string | null
          empresa_id: string
          id?: string
          observacoes?: string | null
          pcmso_id: string
          responsavel?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          acao?: string
          created_at?: string
          data_planejada?: string | null
          empresa_id?: string
          id?: string
          observacoes?: string | null
          pcmso_id?: string
          responsavel?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pcmso_cronograma_acoes_pcmso_id_fkey"
            columns: ["pcmso_id"]
            isOneToOne: false
            referencedRelation: "pcmso_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      pcmso_documentos: {
        Row: {
          created_at: string
          created_by: string | null
          data_emissao: string | null
          data_vigencia_fim: string | null
          data_vigencia_inicio: string | null
          documento_origem_id: string | null
          empresa_id: string
          id: string
          medico_coordenador_id: string | null
          medico_crm: string | null
          medico_nome: string | null
          medico_uf: string | null
          observacoes: string | null
          pdf_drive_file_id: string | null
          pdf_drive_view_link: string | null
          pdf_gerado_em: string | null
          pdf_hash: string | null
          pgr_base_id: string | null
          relatorio_analitico: string | null
          status: Database["public"]["Enums"]["pgr_status"]
          unidade_id: string | null
          updated_at: string
          updated_by: string | null
          versao: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          data_vigencia_fim?: string | null
          data_vigencia_inicio?: string | null
          documento_origem_id?: string | null
          empresa_id: string
          id?: string
          medico_coordenador_id?: string | null
          medico_crm?: string | null
          medico_nome?: string | null
          medico_uf?: string | null
          observacoes?: string | null
          pdf_drive_file_id?: string | null
          pdf_drive_view_link?: string | null
          pdf_gerado_em?: string | null
          pdf_hash?: string | null
          pgr_base_id?: string | null
          relatorio_analitico?: string | null
          status?: Database["public"]["Enums"]["pgr_status"]
          unidade_id?: string | null
          updated_at?: string
          updated_by?: string | null
          versao?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          data_vigencia_fim?: string | null
          data_vigencia_inicio?: string | null
          documento_origem_id?: string | null
          empresa_id?: string
          id?: string
          medico_coordenador_id?: string | null
          medico_crm?: string | null
          medico_nome?: string | null
          medico_uf?: string | null
          observacoes?: string | null
          pdf_drive_file_id?: string | null
          pdf_drive_view_link?: string | null
          pdf_gerado_em?: string | null
          pdf_hash?: string | null
          pgr_base_id?: string | null
          relatorio_analitico?: string | null
          status?: Database["public"]["Enums"]["pgr_status"]
          unidade_id?: string | null
          updated_at?: string
          updated_by?: string | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "pcmso_documentos_documento_origem_id_fkey"
            columns: ["documento_origem_id"]
            isOneToOne: false
            referencedRelation: "pcmso_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pcmso_documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pcmso_documentos_medico_coordenador_id_fkey"
            columns: ["medico_coordenador_id"]
            isOneToOne: false
            referencedRelation: "aso_medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pcmso_documentos_pgr_base_id_fkey"
            columns: ["pgr_base_id"]
            isOneToOne: false
            referencedRelation: "pgr_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pcmso_documentos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      pcmso_revisoes: {
        Row: {
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          motivo_revisao: string | null
          pcmso_id: string
          status_anterior: Database["public"]["Enums"]["pgr_status"] | null
          status_novo: Database["public"]["Enums"]["pgr_status"] | null
          versao_anterior: number | null
          versao_nova: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          motivo_revisao?: string | null
          pcmso_id: string
          status_anterior?: Database["public"]["Enums"]["pgr_status"] | null
          status_novo?: Database["public"]["Enums"]["pgr_status"] | null
          versao_anterior?: number | null
          versao_nova?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          motivo_revisao?: string | null
          pcmso_id?: string
          status_anterior?: Database["public"]["Enums"]["pgr_status"] | null
          status_novo?: Database["public"]["Enums"]["pgr_status"] | null
          versao_anterior?: number | null
          versao_nova?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pcmso_revisoes_pcmso_id_fkey"
            columns: ["pcmso_id"]
            isOneToOne: false
            referencedRelation: "pcmso_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      pgr_acao_evidencias: {
        Row: {
          acao_id: string
          created_at: string
          descricao: string | null
          drive_file_id: string
          drive_path: string | null
          drive_view_link: string | null
          empresa_id: string
          id: string
          mime_type: string | null
          nome_arquivo: string
          pgr_id: string
          tamanho_bytes: number | null
          uploaded_by: string | null
          uploaded_by_email: string | null
        }
        Insert: {
          acao_id: string
          created_at?: string
          descricao?: string | null
          drive_file_id: string
          drive_path?: string | null
          drive_view_link?: string | null
          empresa_id: string
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          pgr_id: string
          tamanho_bytes?: number | null
          uploaded_by?: string | null
          uploaded_by_email?: string | null
        }
        Update: {
          acao_id?: string
          created_at?: string
          descricao?: string | null
          drive_file_id?: string
          drive_path?: string | null
          drive_view_link?: string | null
          empresa_id?: string
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          pgr_id?: string
          tamanho_bytes?: number | null
          uploaded_by?: string | null
          uploaded_by_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pgr_acao_evidencias_acao_id_fkey"
            columns: ["acao_id"]
            isOneToOne: false
            referencedRelation: "pgr_acoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pgr_acao_evidencias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pgr_acao_evidencias_pgr_id_fkey"
            columns: ["pgr_id"]
            isOneToOne: false
            referencedRelation: "pgr_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      pgr_acao_historico: {
        Row: {
          acao_id: string
          campo_alterado: string | null
          created_at: string
          empresa_id: string
          id: string
          motivo: string | null
          pgr_id: string
          status_anterior: Database["public"]["Enums"]["pgr_acao_status"] | null
          status_novo: Database["public"]["Enums"]["pgr_acao_status"] | null
          user_email: string | null
          user_id: string | null
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          acao_id: string
          campo_alterado?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          motivo?: string | null
          pgr_id: string
          status_anterior?:
            | Database["public"]["Enums"]["pgr_acao_status"]
            | null
          status_novo?: Database["public"]["Enums"]["pgr_acao_status"] | null
          user_email?: string | null
          user_id?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          acao_id?: string
          campo_alterado?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          motivo?: string | null
          pgr_id?: string
          status_anterior?:
            | Database["public"]["Enums"]["pgr_acao_status"]
            | null
          status_novo?: Database["public"]["Enums"]["pgr_acao_status"] | null
          user_email?: string | null
          user_id?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pgr_acao_historico_acao_id_fkey"
            columns: ["acao_id"]
            isOneToOne: false
            referencedRelation: "pgr_acoes"
            referencedColumns: ["id"]
          },
        ]
      }
      pgr_acoes: {
        Row: {
          concluida_por: string | null
          created_at: string
          created_by: string | null
          custo_estimado: number | null
          data_conclusao: string | null
          descricao: string
          empresa_id: string
          evidencia_url: string | null
          how: string | null
          id: string
          inventario_item_id: string | null
          motivo_cancelamento: string | null
          motivo_prorrogacao: string | null
          pgr_id: string
          prazo: string | null
          prazo_original: string | null
          prioridade: number
          responsavel_id: string | null
          responsavel_nome: string | null
          status: Database["public"]["Enums"]["pgr_acao_status"]
          tipo: Database["public"]["Enums"]["pgr_medida_tipo"]
          updated_at: string
          updated_by: string | null
          what: string | null
          where_local: string | null
          why: string | null
        }
        Insert: {
          concluida_por?: string | null
          created_at?: string
          created_by?: string | null
          custo_estimado?: number | null
          data_conclusao?: string | null
          descricao: string
          empresa_id: string
          evidencia_url?: string | null
          how?: string | null
          id?: string
          inventario_item_id?: string | null
          motivo_cancelamento?: string | null
          motivo_prorrogacao?: string | null
          pgr_id: string
          prazo?: string | null
          prazo_original?: string | null
          prioridade?: number
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: Database["public"]["Enums"]["pgr_acao_status"]
          tipo?: Database["public"]["Enums"]["pgr_medida_tipo"]
          updated_at?: string
          updated_by?: string | null
          what?: string | null
          where_local?: string | null
          why?: string | null
        }
        Update: {
          concluida_por?: string | null
          created_at?: string
          created_by?: string | null
          custo_estimado?: number | null
          data_conclusao?: string | null
          descricao?: string
          empresa_id?: string
          evidencia_url?: string | null
          how?: string | null
          id?: string
          inventario_item_id?: string | null
          motivo_cancelamento?: string | null
          motivo_prorrogacao?: string | null
          pgr_id?: string
          prazo?: string | null
          prazo_original?: string | null
          prioridade?: number
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: Database["public"]["Enums"]["pgr_acao_status"]
          tipo?: Database["public"]["Enums"]["pgr_medida_tipo"]
          updated_at?: string
          updated_by?: string | null
          what?: string | null
          where_local?: string | null
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pgr_acoes_inventario_item_id_fkey"
            columns: ["inventario_item_id"]
            isOneToOne: false
            referencedRelation: "pgr_inventario_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pgr_acoes_pgr_id_fkey"
            columns: ["pgr_id"]
            isOneToOne: false
            referencedRelation: "pgr_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      pgr_assinaturas: {
        Row: {
          assinado_em: string
          empresa_id: string
          id: string
          ip_origem: string | null
          mfa_verificado: boolean
          observacao: string | null
          pdf_hash: string
          pdf_versao: number
          pgr_id: string
          responsavel_nome: string
          responsavel_registro: string | null
          responsavel_user_id: string | null
        }
        Insert: {
          assinado_em?: string
          empresa_id: string
          id?: string
          ip_origem?: string | null
          mfa_verificado?: boolean
          observacao?: string | null
          pdf_hash: string
          pdf_versao: number
          pgr_id: string
          responsavel_nome: string
          responsavel_registro?: string | null
          responsavel_user_id?: string | null
        }
        Update: {
          assinado_em?: string
          empresa_id?: string
          id?: string
          ip_origem?: string | null
          mfa_verificado?: boolean
          observacao?: string | null
          pdf_hash?: string
          pdf_versao?: number
          pgr_id?: string
          responsavel_nome?: string
          responsavel_registro?: string | null
          responsavel_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pgr_assinaturas_pgr_id_fkey"
            columns: ["pgr_id"]
            isOneToOne: false
            referencedRelation: "pgr_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      pgr_documentos: {
        Row: {
          conteudo_atualizado_em: string
          created_at: string
          created_by: string | null
          data_emissao: string | null
          data_vigencia_fim: string | null
          data_vigencia_inicio: string | null
          documento_origem_id: string | null
          empresa_id: string
          escopo: string | null
          id: string
          metodologia_avaliacao: string | null
          observacoes: string | null
          pdf_drive_file_id: string | null
          pdf_drive_view_link: string | null
          pdf_gerado_em: string | null
          pdf_hash: string | null
          resp_tec_nome: string | null
          resp_tec_registro: string | null
          responsavel_tecnico_id: string | null
          status: Database["public"]["Enums"]["pgr_status"]
          unidade_id: string | null
          updated_at: string
          updated_by: string | null
          versao: number
        }
        Insert: {
          conteudo_atualizado_em?: string
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          data_vigencia_fim?: string | null
          data_vigencia_inicio?: string | null
          documento_origem_id?: string | null
          empresa_id: string
          escopo?: string | null
          id?: string
          metodologia_avaliacao?: string | null
          observacoes?: string | null
          pdf_drive_file_id?: string | null
          pdf_drive_view_link?: string | null
          pdf_gerado_em?: string | null
          pdf_hash?: string | null
          resp_tec_nome?: string | null
          resp_tec_registro?: string | null
          responsavel_tecnico_id?: string | null
          status?: Database["public"]["Enums"]["pgr_status"]
          unidade_id?: string | null
          updated_at?: string
          updated_by?: string | null
          versao?: number
        }
        Update: {
          conteudo_atualizado_em?: string
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          data_vigencia_fim?: string | null
          data_vigencia_inicio?: string | null
          documento_origem_id?: string | null
          empresa_id?: string
          escopo?: string | null
          id?: string
          metodologia_avaliacao?: string | null
          observacoes?: string | null
          pdf_drive_file_id?: string | null
          pdf_drive_view_link?: string | null
          pdf_gerado_em?: string | null
          pdf_hash?: string | null
          resp_tec_nome?: string | null
          resp_tec_registro?: string | null
          responsavel_tecnico_id?: string | null
          status?: Database["public"]["Enums"]["pgr_status"]
          unidade_id?: string | null
          updated_at?: string
          updated_by?: string | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "pgr_documentos_documento_origem_id_fkey"
            columns: ["documento_origem_id"]
            isOneToOne: false
            referencedRelation: "pgr_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pgr_documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pgr_documentos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      pgr_inventario_itens: {
        Row: {
          atenuacao: string | null
          avaliacao_tipo: Database["public"]["Enums"]["pgr_avaliacao_tipo"]
          classificacao: Database["public"]["Enums"]["pgr_risco_classe"] | null
          controles_existentes: string[] | null
          created_at: string
          created_by: string | null
          descricao_ambiente: string | null
          empresa_id: string
          epi: string | null
          excedente: boolean | null
          fonte_geradora: string | null
          funcao_id: string | null
          funcoes_snapshot: string[] | null
          ghe_id: string | null
          grupo: Database["public"]["Enums"]["pgr_perigo_grupo"]
          id: string
          intensidade: string | null
          justificativa: string | null
          lesoes: string | null
          limite_tolerancia: string | null
          medicao_unidade: string | null
          medicao_valor: number | null
          meio_propagacao: string | null
          necessita_acao: boolean
          nivel_risco: number | null
          perigo_descricao: string
          perigo_id: string | null
          pgr_id: string
          probabilidade: number
          processo: string | null
          setor: string | null
          severidade: number
          tecnica_utilizada: string | null
          tempo_exposicao: string | null
          tipo_agente: string | null
          tipo_exposicao: Database["public"]["Enums"]["pgr_exposicao_tipo"]
          trabalhadores_ajuste_manual: boolean
          trabalhadores_calculados: number | null
          trabalhadores_expostos: number
          updated_at: string
        }
        Insert: {
          atenuacao?: string | null
          avaliacao_tipo?: Database["public"]["Enums"]["pgr_avaliacao_tipo"]
          classificacao?: Database["public"]["Enums"]["pgr_risco_classe"] | null
          controles_existentes?: string[] | null
          created_at?: string
          created_by?: string | null
          descricao_ambiente?: string | null
          empresa_id: string
          epi?: string | null
          excedente?: boolean | null
          fonte_geradora?: string | null
          funcao_id?: string | null
          funcoes_snapshot?: string[] | null
          ghe_id?: string | null
          grupo: Database["public"]["Enums"]["pgr_perigo_grupo"]
          id?: string
          intensidade?: string | null
          justificativa?: string | null
          lesoes?: string | null
          limite_tolerancia?: string | null
          medicao_unidade?: string | null
          medicao_valor?: number | null
          meio_propagacao?: string | null
          necessita_acao?: boolean
          nivel_risco?: number | null
          perigo_descricao: string
          perigo_id?: string | null
          pgr_id: string
          probabilidade?: number
          processo?: string | null
          setor?: string | null
          severidade?: number
          tecnica_utilizada?: string | null
          tempo_exposicao?: string | null
          tipo_agente?: string | null
          tipo_exposicao?: Database["public"]["Enums"]["pgr_exposicao_tipo"]
          trabalhadores_ajuste_manual?: boolean
          trabalhadores_calculados?: number | null
          trabalhadores_expostos?: number
          updated_at?: string
        }
        Update: {
          atenuacao?: string | null
          avaliacao_tipo?: Database["public"]["Enums"]["pgr_avaliacao_tipo"]
          classificacao?: Database["public"]["Enums"]["pgr_risco_classe"] | null
          controles_existentes?: string[] | null
          created_at?: string
          created_by?: string | null
          descricao_ambiente?: string | null
          empresa_id?: string
          epi?: string | null
          excedente?: boolean | null
          fonte_geradora?: string | null
          funcao_id?: string | null
          funcoes_snapshot?: string[] | null
          ghe_id?: string | null
          grupo?: Database["public"]["Enums"]["pgr_perigo_grupo"]
          id?: string
          intensidade?: string | null
          justificativa?: string | null
          lesoes?: string | null
          limite_tolerancia?: string | null
          medicao_unidade?: string | null
          medicao_valor?: number | null
          meio_propagacao?: string | null
          necessita_acao?: boolean
          nivel_risco?: number | null
          perigo_descricao?: string
          perigo_id?: string | null
          pgr_id?: string
          probabilidade?: number
          processo?: string | null
          setor?: string | null
          severidade?: number
          tecnica_utilizada?: string | null
          tempo_exposicao?: string | null
          tipo_agente?: string | null
          tipo_exposicao?: Database["public"]["Enums"]["pgr_exposicao_tipo"]
          trabalhadores_ajuste_manual?: boolean
          trabalhadores_calculados?: number | null
          trabalhadores_expostos?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pgr_inventario_itens_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "ghe_funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pgr_inventario_itens_ghe_id_fkey"
            columns: ["ghe_id"]
            isOneToOne: false
            referencedRelation: "ghe_ges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pgr_inventario_itens_perigo_id_fkey"
            columns: ["perigo_id"]
            isOneToOne: false
            referencedRelation: "pgr_perigos_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pgr_inventario_itens_pgr_id_fkey"
            columns: ["pgr_id"]
            isOneToOne: false
            referencedRelation: "pgr_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      pgr_pdf_versoes: {
        Row: {
          com_marca_dagua: boolean
          drive_file_id: string
          drive_path: string | null
          drive_view_link: string | null
          empresa_id: string
          gerado_em: string
          gerado_por: string | null
          id: string
          nome_arquivo: string | null
          pdf_hash: string
          pdf_versao: number
          pgr_id: string
          pgr_versao: number
          status_no_momento: Database["public"]["Enums"]["pgr_status"]
          storage_bucket: string | null
          storage_path: string | null
          storage_provider: string
          tamanho_bytes: number | null
        }
        Insert: {
          com_marca_dagua?: boolean
          drive_file_id: string
          drive_path?: string | null
          drive_view_link?: string | null
          empresa_id: string
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          nome_arquivo?: string | null
          pdf_hash: string
          pdf_versao: number
          pgr_id: string
          pgr_versao: number
          status_no_momento: Database["public"]["Enums"]["pgr_status"]
          storage_bucket?: string | null
          storage_path?: string | null
          storage_provider?: string
          tamanho_bytes?: number | null
        }
        Update: {
          com_marca_dagua?: boolean
          drive_file_id?: string
          drive_path?: string | null
          drive_view_link?: string | null
          empresa_id?: string
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          nome_arquivo?: string | null
          pdf_hash?: string
          pdf_versao?: number
          pgr_id?: string
          pgr_versao?: number
          status_no_momento?: Database["public"]["Enums"]["pgr_status"]
          storage_bucket?: string | null
          storage_path?: string | null
          storage_provider?: string
          tamanho_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pgr_pdf_versoes_pgr_id_fkey"
            columns: ["pgr_id"]
            isOneToOne: false
            referencedRelation: "pgr_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      pgr_perigos_catalogo: {
        Row: {
          ativo: boolean
          codigo: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string | null
          grupo: Database["public"]["Enums"]["pgr_perigo_grupo"]
          id: string
          limite_tolerancia: string | null
          nome: string
          norma_referencia: string | null
          possiveis_lesoes: string | null
          unidade_medida: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string | null
          grupo: Database["public"]["Enums"]["pgr_perigo_grupo"]
          id?: string
          limite_tolerancia?: string | null
          nome: string
          norma_referencia?: string | null
          possiveis_lesoes?: string | null
          unidade_medida?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string | null
          grupo?: Database["public"]["Enums"]["pgr_perigo_grupo"]
          id?: string
          limite_tolerancia?: string | null
          nome?: string
          norma_referencia?: string | null
          possiveis_lesoes?: string | null
          unidade_medida?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pgr_perigos_catalogo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      pgr_revisoes: {
        Row: {
          acao: string
          created_at: string
          empresa_id: string
          id: string
          motivo: string | null
          pgr_id: string
          snapshot: Json | null
          status_anterior: Database["public"]["Enums"]["pgr_status"] | null
          status_novo: Database["public"]["Enums"]["pgr_status"] | null
          user_email: string | null
          user_id: string | null
          versao_anterior: number | null
          versao_nova: number | null
        }
        Insert: {
          acao: string
          created_at?: string
          empresa_id: string
          id?: string
          motivo?: string | null
          pgr_id: string
          snapshot?: Json | null
          status_anterior?: Database["public"]["Enums"]["pgr_status"] | null
          status_novo?: Database["public"]["Enums"]["pgr_status"] | null
          user_email?: string | null
          user_id?: string | null
          versao_anterior?: number | null
          versao_nova?: number | null
        }
        Update: {
          acao?: string
          created_at?: string
          empresa_id?: string
          id?: string
          motivo?: string | null
          pgr_id?: string
          snapshot?: Json | null
          status_anterior?: Database["public"]["Enums"]["pgr_status"] | null
          status_novo?: Database["public"]["Enums"]["pgr_status"] | null
          user_email?: string | null
          user_id?: string | null
          versao_anterior?: number | null
          versao_nova?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pgr_revisoes_pgr_id_fkey"
            columns: ["pgr_id"]
            isOneToOne: false
            referencedRelation: "pgr_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      pgr_textos: {
        Row: {
          conteudo: string
          created_at: string
          empresa_id: string
          id: string
          pgr_id: string
          secao: string
          updated_at: string
        }
        Insert: {
          conteudo?: string
          created_at?: string
          empresa_id: string
          id?: string
          pgr_id: string
          secao: string
          updated_at?: string
        }
        Update: {
          conteudo?: string
          created_at?: string
          empresa_id?: string
          id?: string
          pgr_id?: string
          secao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pgr_textos_pgr_id_fkey"
            columns: ["pgr_id"]
            isOneToOne: false
            referencedRelation: "pgr_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      ppp_assinaturas: {
        Row: {
          assinado_em: string
          assinado_por: string | null
          auth_aal: string | null
          created_at: string
          drive_id: string | null
          empresa_id: string
          id: string
          imagem_link: string | null
          ip_origem: string | null
          nome: string
          observacao: string | null
          papel: string | null
          pdf_hash: string | null
          pdf_versao: number | null
          pdf_versao_id: string | null
          ppp_id: string
          responsavel_nome: string | null
          responsavel_registro: string | null
          user_email: string | null
        }
        Insert: {
          assinado_em?: string
          assinado_por?: string | null
          auth_aal?: string | null
          created_at?: string
          drive_id?: string | null
          empresa_id: string
          id?: string
          imagem_link?: string | null
          ip_origem?: string | null
          nome: string
          observacao?: string | null
          papel?: string | null
          pdf_hash?: string | null
          pdf_versao?: number | null
          pdf_versao_id?: string | null
          ppp_id: string
          responsavel_nome?: string | null
          responsavel_registro?: string | null
          user_email?: string | null
        }
        Update: {
          assinado_em?: string
          assinado_por?: string | null
          auth_aal?: string | null
          created_at?: string
          drive_id?: string | null
          empresa_id?: string
          id?: string
          imagem_link?: string | null
          ip_origem?: string | null
          nome?: string
          observacao?: string | null
          papel?: string | null
          pdf_hash?: string | null
          pdf_versao?: number | null
          pdf_versao_id?: string | null
          ppp_id?: string
          responsavel_nome?: string | null
          responsavel_registro?: string | null
          user_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ppp_assinaturas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppp_assinaturas_ppp_id_fkey"
            columns: ["ppp_id"]
            isOneToOne: false
            referencedRelation: "ppp_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      ppp_documentos: {
        Row: {
          cbo_consolidado: string | null
          conclusao_consolidada:
            | Database["public"]["Enums"]["ppp_conclusao_aposentadoria"]
            | null
          conteudo_atualizado_em: string
          created_at: string
          created_by: string | null
          data_emissao: string | null
          descricao_atividade_consolidada: string | null
          empresa_id: string
          funcionario_id: string
          id: string
          motivo_emissao: Database["public"]["Enums"]["ppp_motivo_emissao"]
          observacoes: string | null
          publicado_em: string | null
          publicado_por: string | null
          status: Database["public"]["Enums"]["ppp_status"]
          updated_at: string
          updated_by: string | null
          versao: number
          versao_pai_id: string | null
        }
        Insert: {
          cbo_consolidado?: string | null
          conclusao_consolidada?:
            | Database["public"]["Enums"]["ppp_conclusao_aposentadoria"]
            | null
          conteudo_atualizado_em?: string
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          descricao_atividade_consolidada?: string | null
          empresa_id: string
          funcionario_id: string
          id?: string
          motivo_emissao?: Database["public"]["Enums"]["ppp_motivo_emissao"]
          observacoes?: string | null
          publicado_em?: string | null
          publicado_por?: string | null
          status?: Database["public"]["Enums"]["ppp_status"]
          updated_at?: string
          updated_by?: string | null
          versao?: number
          versao_pai_id?: string | null
        }
        Update: {
          cbo_consolidado?: string | null
          conclusao_consolidada?:
            | Database["public"]["Enums"]["ppp_conclusao_aposentadoria"]
            | null
          conteudo_atualizado_em?: string
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          descricao_atividade_consolidada?: string | null
          empresa_id?: string
          funcionario_id?: string
          id?: string
          motivo_emissao?: Database["public"]["Enums"]["ppp_motivo_emissao"]
          observacoes?: string | null
          publicado_em?: string | null
          publicado_por?: string | null
          status?: Database["public"]["Enums"]["ppp_status"]
          updated_at?: string
          updated_by?: string | null
          versao?: number
          versao_pai_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ppp_documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppp_documentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppp_documentos_versao_pai_id_fkey"
            columns: ["versao_pai_id"]
            isOneToOne: false
            referencedRelation: "ppp_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      ppp_exames_referenciados: {
        Row: {
          aptidao: string | null
          aso_id: string | null
          created_at: string
          data: string | null
          empresa_id: string
          id: string
          observacoes: string | null
          origem: string | null
          ppp_id: string
          resultado_resumo: string | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          aptidao?: string | null
          aso_id?: string | null
          created_at?: string
          data?: string | null
          empresa_id: string
          id?: string
          observacoes?: string | null
          origem?: string | null
          ppp_id: string
          resultado_resumo?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          aptidao?: string | null
          aso_id?: string | null
          created_at?: string
          data?: string | null
          empresa_id?: string
          id?: string
          observacoes?: string | null
          origem?: string | null
          ppp_id?: string
          resultado_resumo?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppp_exames_referenciados_aso_id_fkey"
            columns: ["aso_id"]
            isOneToOne: false
            referencedRelation: "asos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppp_exames_referenciados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppp_exames_referenciados_ppp_id_fkey"
            columns: ["ppp_id"]
            isOneToOne: false
            referencedRelation: "ppp_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      ppp_exposicoes: {
        Row: {
          acima_limite: boolean | null
          agente_grupo: Database["public"]["Enums"]["ppp_agente_grupo"] | null
          agente_id: string | null
          agente_nome: string
          agente_tipo: Database["public"]["Enums"]["ppp_agente_grupo"] | null
          codigo_esocial: string | null
          conclusao_ltcat_id: string | null
          conclusao_previdenciaria: string | null
          created_at: string
          data_medicao: string | null
          duracao: string | null
          empresa_id: string
          enquadramento: Database["public"]["Enums"]["ppp_enquadramento"] | null
          epc_descricao: string | null
          epc_eficacia: string | null
          epi_ca: string | null
          epi_descricao: string | null
          epi_eficacia: Database["public"]["Enums"]["ppp_epi_eficacia"] | null
          fonte_geradora: string | null
          frequencia: string | null
          fundamento_legal: string | null
          id: string
          intensidade: number | null
          justificativa: string | null
          limite_tolerancia: number | null
          ltcat_id: string | null
          observacoes: string | null
          origem_ltcat_aval_id: string | null
          percentual_jornada: number | null
          periodo_id: string
          ppp_id: string
          tecnica: Database["public"]["Enums"]["ppp_tecnica_avaliacao"] | null
          tecnica_avaliacao: string | null
          tempo_exposicao_horas: number | null
          tipo_exposicao: string | null
          unidade_medida: string | null
          updated_at: string
        }
        Insert: {
          acima_limite?: boolean | null
          agente_grupo?: Database["public"]["Enums"]["ppp_agente_grupo"] | null
          agente_id?: string | null
          agente_nome: string
          agente_tipo?: Database["public"]["Enums"]["ppp_agente_grupo"] | null
          codigo_esocial?: string | null
          conclusao_ltcat_id?: string | null
          conclusao_previdenciaria?: string | null
          created_at?: string
          data_medicao?: string | null
          duracao?: string | null
          empresa_id: string
          enquadramento?:
            | Database["public"]["Enums"]["ppp_enquadramento"]
            | null
          epc_descricao?: string | null
          epc_eficacia?: string | null
          epi_ca?: string | null
          epi_descricao?: string | null
          epi_eficacia?: Database["public"]["Enums"]["ppp_epi_eficacia"] | null
          fonte_geradora?: string | null
          frequencia?: string | null
          fundamento_legal?: string | null
          id?: string
          intensidade?: number | null
          justificativa?: string | null
          limite_tolerancia?: number | null
          ltcat_id?: string | null
          observacoes?: string | null
          origem_ltcat_aval_id?: string | null
          percentual_jornada?: number | null
          periodo_id: string
          ppp_id: string
          tecnica?: Database["public"]["Enums"]["ppp_tecnica_avaliacao"] | null
          tecnica_avaliacao?: string | null
          tempo_exposicao_horas?: number | null
          tipo_exposicao?: string | null
          unidade_medida?: string | null
          updated_at?: string
        }
        Update: {
          acima_limite?: boolean | null
          agente_grupo?: Database["public"]["Enums"]["ppp_agente_grupo"] | null
          agente_id?: string | null
          agente_nome?: string
          agente_tipo?: Database["public"]["Enums"]["ppp_agente_grupo"] | null
          codigo_esocial?: string | null
          conclusao_ltcat_id?: string | null
          conclusao_previdenciaria?: string | null
          created_at?: string
          data_medicao?: string | null
          duracao?: string | null
          empresa_id?: string
          enquadramento?:
            | Database["public"]["Enums"]["ppp_enquadramento"]
            | null
          epc_descricao?: string | null
          epc_eficacia?: string | null
          epi_ca?: string | null
          epi_descricao?: string | null
          epi_eficacia?: Database["public"]["Enums"]["ppp_epi_eficacia"] | null
          fonte_geradora?: string | null
          frequencia?: string | null
          fundamento_legal?: string | null
          id?: string
          intensidade?: number | null
          justificativa?: string | null
          limite_tolerancia?: number | null
          ltcat_id?: string | null
          observacoes?: string | null
          origem_ltcat_aval_id?: string | null
          percentual_jornada?: number | null
          periodo_id?: string
          ppp_id?: string
          tecnica?: Database["public"]["Enums"]["ppp_tecnica_avaliacao"] | null
          tecnica_avaliacao?: string | null
          tempo_exposicao_horas?: number | null
          tipo_exposicao?: string | null
          unidade_medida?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppp_exposicoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppp_exposicoes_origem_ltcat_aval_id_fkey"
            columns: ["origem_ltcat_aval_id"]
            isOneToOne: false
            referencedRelation: "ltcat_avaliacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppp_exposicoes_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "ppp_periodos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppp_exposicoes_ppp_id_fkey"
            columns: ["ppp_id"]
            isOneToOne: false
            referencedRelation: "ppp_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      ppp_pdf_versoes: {
        Row: {
          com_marca_dagua: boolean
          created_at: string
          drive_id: string | null
          drive_link: string | null
          drive_path: string | null
          empresa_id: string
          gerado_em: string
          gerado_por: string | null
          id: string
          nome_arquivo: string | null
          pdf_hash: string | null
          pdf_versao: number | null
          ppp_id: string
          sha256: string
          snapshot_json: Json | null
          status_no_momento: string | null
          storage_bucket: string | null
          storage_path: string | null
          storage_provider: string
          tamanho_bytes: number | null
          tipo: string
          versao_ppp_snapshot: number | null
        }
        Insert: {
          com_marca_dagua?: boolean
          created_at?: string
          drive_id?: string | null
          drive_link?: string | null
          drive_path?: string | null
          empresa_id: string
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          nome_arquivo?: string | null
          pdf_hash?: string | null
          pdf_versao?: number | null
          ppp_id: string
          sha256: string
          snapshot_json?: Json | null
          status_no_momento?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          storage_provider?: string
          tamanho_bytes?: number | null
          tipo: string
          versao_ppp_snapshot?: number | null
        }
        Update: {
          com_marca_dagua?: boolean
          created_at?: string
          drive_id?: string | null
          drive_link?: string | null
          drive_path?: string | null
          empresa_id?: string
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          nome_arquivo?: string | null
          pdf_hash?: string | null
          pdf_versao?: number | null
          ppp_id?: string
          sha256?: string
          snapshot_json?: Json | null
          status_no_momento?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          storage_provider?: string
          tamanho_bytes?: number | null
          tipo?: string
          versao_ppp_snapshot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ppp_pdf_versoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppp_pdf_versoes_ppp_id_fkey"
            columns: ["ppp_id"]
            isOneToOne: false
            referencedRelation: "ppp_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      ppp_periodos: {
        Row: {
          cbo: string | null
          created_at: string
          data_fim: string | null
          data_inicio: string
          descricao_atividade: string | null
          empresa_id: string
          funcao_id: string | null
          funcao_nome: string | null
          ghe_codigo: string | null
          ghe_descricao: string | null
          ghe_id: string | null
          id: string
          ltcat_id: string | null
          motivo_encerramento: string | null
          observacoes: string | null
          ordem: number
          pgr_id: string | null
          ppp_id: string
          setor_id: string | null
          setor_nome: string | null
          updated_at: string
        }
        Insert: {
          cbo?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          descricao_atividade?: string | null
          empresa_id: string
          funcao_id?: string | null
          funcao_nome?: string | null
          ghe_codigo?: string | null
          ghe_descricao?: string | null
          ghe_id?: string | null
          id?: string
          ltcat_id?: string | null
          motivo_encerramento?: string | null
          observacoes?: string | null
          ordem?: number
          pgr_id?: string | null
          ppp_id: string
          setor_id?: string | null
          setor_nome?: string | null
          updated_at?: string
        }
        Update: {
          cbo?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          descricao_atividade?: string | null
          empresa_id?: string
          funcao_id?: string | null
          funcao_nome?: string | null
          ghe_codigo?: string | null
          ghe_descricao?: string | null
          ghe_id?: string | null
          id?: string
          ltcat_id?: string | null
          motivo_encerramento?: string | null
          observacoes?: string | null
          ordem?: number
          pgr_id?: string | null
          ppp_id?: string
          setor_id?: string | null
          setor_nome?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppp_periodos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppp_periodos_ltcat_id_fkey"
            columns: ["ltcat_id"]
            isOneToOne: false
            referencedRelation: "ltcat_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppp_periodos_ppp_id_fkey"
            columns: ["ppp_id"]
            isOneToOne: false
            referencedRelation: "ppp_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      ppp_responsaveis: {
        Row: {
          created_at: string
          created_by: string | null
          empresa_id: string | null
          id: string
          nit: string | null
          nome: string
          periodo_fim: string | null
          periodo_inicio: string | null
          registro_conselho: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          id?: string
          nit?: string | null
          nome: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          registro_conselho?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          id?: string
          nit?: string | null
          nome?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          registro_conselho?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppp_responsaveis_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      ppp_responsaveis_ambientais: {
        Row: {
          cargo: string | null
          conselho: string | null
          conselho_uf: string | null
          cpf: string | null
          created_at: string
          empresa_id: string
          formacao: string | null
          id: string
          nome: string
          observacoes: string | null
          origem_ltcat_rt_id: string | null
          periodo_fim: string | null
          periodo_id: string | null
          periodo_inicio: string | null
          ppp_id: string
          registro_profissional: string | null
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          conselho?: string | null
          conselho_uf?: string | null
          cpf?: string | null
          created_at?: string
          empresa_id: string
          formacao?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          origem_ltcat_rt_id?: string | null
          periodo_fim?: string | null
          periodo_id?: string | null
          periodo_inicio?: string | null
          ppp_id: string
          registro_profissional?: string | null
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          conselho?: string | null
          conselho_uf?: string | null
          cpf?: string | null
          created_at?: string
          empresa_id?: string
          formacao?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          origem_ltcat_rt_id?: string | null
          periodo_fim?: string | null
          periodo_id?: string | null
          periodo_inicio?: string | null
          ppp_id?: string
          registro_profissional?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppp_responsaveis_ambientais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppp_responsaveis_ambientais_origem_ltcat_rt_id_fkey"
            columns: ["origem_ltcat_rt_id"]
            isOneToOne: false
            referencedRelation: "ltcat_responsaveis_tecnicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppp_responsaveis_ambientais_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "ppp_periodos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppp_responsaveis_ambientais_ppp_id_fkey"
            columns: ["ppp_id"]
            isOneToOne: false
            referencedRelation: "ppp_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      ppp_responsaveis_medicos: {
        Row: {
          created_at: string
          crm: string | null
          empresa_id: string
          id: string
          nome: string
          observacoes: string | null
          origem_aso_medico_id: string | null
          periodo_fim: string | null
          periodo_inicio: string | null
          ppp_id: string
          uf_crm: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          crm?: string | null
          empresa_id: string
          id?: string
          nome: string
          observacoes?: string | null
          origem_aso_medico_id?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          ppp_id: string
          uf_crm?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          crm?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          observacoes?: string | null
          origem_aso_medico_id?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          ppp_id?: string
          uf_crm?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppp_responsaveis_medicos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppp_responsaveis_medicos_ppp_id_fkey"
            columns: ["ppp_id"]
            isOneToOne: false
            referencedRelation: "ppp_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      ppp_revisoes: {
        Row: {
          acao: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string
          id: string
          motivo: string | null
          ppp_id: string
          status_anterior: Database["public"]["Enums"]["ppp_status"] | null
          status_novo: Database["public"]["Enums"]["ppp_status"] | null
          user_email: string | null
          user_id: string | null
          versao_anterior: number | null
          versao_nova: number | null
        }
        Insert: {
          acao?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          motivo?: string | null
          ppp_id: string
          status_anterior?: Database["public"]["Enums"]["ppp_status"] | null
          status_novo?: Database["public"]["Enums"]["ppp_status"] | null
          user_email?: string | null
          user_id?: string | null
          versao_anterior?: number | null
          versao_nova?: number | null
        }
        Update: {
          acao?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          motivo?: string | null
          ppp_id?: string
          status_anterior?: Database["public"]["Enums"]["ppp_status"] | null
          status_novo?: Database["public"]["Enums"]["ppp_status"] | null
          user_email?: string | null
          user_id?: string | null
          versao_anterior?: number | null
          versao_nova?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ppp_revisoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppp_revisoes_ppp_id_fkey"
            columns: ["ppp_id"]
            isOneToOne: false
            referencedRelation: "ppp_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      ppp_riscos_cargo: {
        Row: {
          ca_epi: string | null
          cargo: string
          cbo: string | null
          created_at: string
          created_by: string | null
          empresa_id: string | null
          epc_eficaz: boolean | null
          epi_eficaz: boolean | null
          fator_risco: string
          id: string
          intensidade_concentracao: string | null
          profissiografia: string | null
          tecnica_utilizada: string | null
          tipo_risco: Database["public"]["Enums"]["tipo_risco_ppp"]
          updated_at: string
        }
        Insert: {
          ca_epi?: string | null
          cargo: string
          cbo?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          epc_eficaz?: boolean | null
          epi_eficaz?: boolean | null
          fator_risco: string
          id?: string
          intensidade_concentracao?: string | null
          profissiografia?: string | null
          tecnica_utilizada?: string | null
          tipo_risco: Database["public"]["Enums"]["tipo_risco_ppp"]
          updated_at?: string
        }
        Update: {
          ca_epi?: string | null
          cargo?: string
          cbo?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          epc_eficaz?: boolean | null
          epi_eficaz?: boolean | null
          fator_risco?: string
          id?: string
          intensidade_concentracao?: string | null
          profissiografia?: string | null
          tecnica_utilizada?: string | null
          tipo_risco?: Database["public"]["Enums"]["tipo_risco_ppp"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppp_riscos_cargo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      ppp_snapshots_emitidos: {
        Row: {
          created_at: string
          empresa_id: string
          funcionario_id: string | null
          funcionario_nome: string | null
          gerado_em: string
          gerado_por: string | null
          id: string
          nome_arquivo: string | null
          snapshot_json: Json
          tipo: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          funcionario_id?: string | null
          funcionario_nome?: string | null
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          nome_arquivo?: string | null
          snapshot_json: Json
          tipo?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          funcionario_id?: string | null
          funcionario_nome?: string | null
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          nome_arquivo?: string | null
          snapshot_json?: Json
          tipo?: string
        }
        Relationships: []
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
      requisitos_cliente: {
        Row: {
          carga_horaria_minima: number
          created_at: string | null
          created_by: string | null
          curso_nome: string
          descricao: string | null
          empresa_id: string | null
          funcoes_exigidas: string[] | null
          id: string
          nome_cliente: string
          sinonimos: string[] | null
          updated_at: string | null
          validade_meses: number
        }
        Insert: {
          carga_horaria_minima?: number
          created_at?: string | null
          created_by?: string | null
          curso_nome: string
          descricao?: string | null
          empresa_id?: string | null
          funcoes_exigidas?: string[] | null
          id?: string
          nome_cliente?: string
          sinonimos?: string[] | null
          updated_at?: string | null
          validade_meses?: number
        }
        Update: {
          carga_horaria_minima?: number
          created_at?: string | null
          created_by?: string | null
          curso_nome?: string
          descricao?: string | null
          empresa_id?: string | null
          funcoes_exigidas?: string[] | null
          id?: string
          nome_cliente?: string
          sinonimos?: string[] | null
          updated_at?: string | null
          validade_meses?: number
        }
        Relationships: [
          {
            foreignKeyName: "requisitos_cliente_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_epi: {
        Row: {
          aprovado_por: string | null
          aprovador_nome: string | null
          contrato_id: string
          created_at: string
          created_by: string | null
          empresa_id: string | null
          epi_id: string
          id: string
          motivo: string | null
          observacao_resposta: string | null
          quantidade: number
          solicitante_nome: string | null
          status: Database["public"]["Enums"]["status_solicitacao"]
          updated_at: string
        }
        Insert: {
          aprovado_por?: string | null
          aprovador_nome?: string | null
          contrato_id: string
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          epi_id: string
          id?: string
          motivo?: string | null
          observacao_resposta?: string | null
          quantidade?: number
          solicitante_nome?: string | null
          status?: Database["public"]["Enums"]["status_solicitacao"]
          updated_at?: string
        }
        Update: {
          aprovado_por?: string | null
          aprovador_nome?: string | null
          contrato_id?: string
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          epi_id?: string
          id?: string
          motivo?: string | null
          observacao_resposta?: string | null
          quantidade?: number
          solicitante_nome?: string | null
          status?: Database["public"]["Enums"]["status_solicitacao"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_epi_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_epi_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_epi_epi_id_fkey"
            columns: ["epi_id"]
            isOneToOne: false
            referencedRelation: "epis"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_materiais: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          aprovado_por_nome: string | null
          comprada_em: string | null
          contrato_id: string | null
          created_at: string
          created_by: string | null
          data_necessidade: string | null
          data_solicitacao: string
          empresa_id: string
          id: string
          justificativa: string | null
          local_obra: string | null
          motivo_recusa: string | null
          nota_fiscal: string | null
          numero_solicitacao: string
          obra_id: string | null
          observacoes: string | null
          prioridade: string
          recebida_em: string | null
          recebida_por_nome: string | null
          setor: string | null
          solicitante_id: string | null
          solicitante_nome: string | null
          status: string
          titulo: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          aprovado_por_nome?: string | null
          comprada_em?: string | null
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          data_necessidade?: string | null
          data_solicitacao?: string
          empresa_id: string
          id?: string
          justificativa?: string | null
          local_obra?: string | null
          motivo_recusa?: string | null
          nota_fiscal?: string | null
          numero_solicitacao: string
          obra_id?: string | null
          observacoes?: string | null
          prioridade?: string
          recebida_em?: string | null
          recebida_por_nome?: string | null
          setor?: string | null
          solicitante_id?: string | null
          solicitante_nome?: string | null
          status?: string
          titulo: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          aprovado_por_nome?: string | null
          comprada_em?: string | null
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          data_necessidade?: string | null
          data_solicitacao?: string
          empresa_id?: string
          id?: string
          justificativa?: string | null
          local_obra?: string | null
          motivo_recusa?: string | null
          nota_fiscal?: string | null
          numero_solicitacao?: string
          obra_id?: string | null
          observacoes?: string | null
          prioridade?: string
          recebida_em?: string | null
          recebida_por_nome?: string | null
          setor?: string | null
          solicitante_id?: string | null
          solicitante_nome?: string | null
          status?: string
          titulo?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      solicitacoes_materiais_itens: {
        Row: {
          ca: string | null
          created_at: string
          descricao: string | null
          empresa_id: string
          epi_id: string | null
          id: string
          imagem_nome: string | null
          imagem_path: string | null
          imagem_tamanho: number | null
          imagem_tipo: string | null
          imagem_url_legado: string | null
          justificativa_item: string | null
          nome_item: string
          observacoes: string | null
          ordem: number
          prioridade_item: string | null
          quantidade_aprovada: number | null
          quantidade_comprada: number | null
          quantidade_recebida: number | null
          quantidade_solicitada: number
          solicitacao_id: string
          tipo_item: string
          unidade_medida: string
          updated_at: string
        }
        Insert: {
          ca?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id: string
          epi_id?: string | null
          id?: string
          imagem_nome?: string | null
          imagem_path?: string | null
          imagem_tamanho?: number | null
          imagem_tipo?: string | null
          imagem_url_legado?: string | null
          justificativa_item?: string | null
          nome_item: string
          observacoes?: string | null
          ordem?: number
          prioridade_item?: string | null
          quantidade_aprovada?: number | null
          quantidade_comprada?: number | null
          quantidade_recebida?: number | null
          quantidade_solicitada?: number
          solicitacao_id: string
          tipo_item?: string
          unidade_medida?: string
          updated_at?: string
        }
        Update: {
          ca?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          epi_id?: string | null
          id?: string
          imagem_nome?: string | null
          imagem_path?: string | null
          imagem_tamanho?: number | null
          imagem_tipo?: string | null
          imagem_url_legado?: string | null
          justificativa_item?: string | null
          nome_item?: string
          observacoes?: string | null
          ordem?: number
          prioridade_item?: string | null
          quantidade_aprovada?: number | null
          quantidade_comprada?: number | null
          quantidade_recebida?: number | null
          quantidade_solicitada?: number
          solicitacao_id?: string
          tipo_item?: string
          unidade_medida?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_materiais_itens_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_materiais"
            referencedColumns: ["id"]
          },
        ]
      }
      termos_aceites: {
        Row: {
          aceito_em: string
          created_at: string
          empresa_id: string | null
          id: string
          ip: string | null
          user_agent: string | null
          user_id: string
          versao_termos: string
        }
        Insert: {
          aceito_em?: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id: string
          versao_termos: string
        }
        Update: {
          aceito_em?: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id?: string
          versao_termos?: string
        }
        Relationships: []
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
      user_active_empresa: {
        Row: {
          empresa_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          empresa_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          empresa_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_active_empresa_empresa_id_fkey"
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
      usuario_empresas: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          empresa_id: string
          id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          empresa_id: string
          id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          empresa_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_empresas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_config"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios_liberados: {
        Row: {
          ativo: boolean
          contrato_id: string | null
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
          ativo?: boolean
          contrato_id?: string | null
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
          ativo?: boolean
          contrato_id?: string | null
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
            foreignKeyName: "usuarios_liberados_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
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
      cat_registrar_pdf: {
        Args: {
          _cat_id: string
          _drive_file_id: string
          _drive_path: string
          _drive_view_link: string
          _nome_arquivo: string
          _pdf_hash: string
          _tamanho_bytes: number
        }
        Returns: Json
      }
      cat_registrar_pdf_download: {
        Args: { _cat_id: string }
        Returns: undefined
      }
      check_rate_limit: {
        Args: { _key: string; _limit: number; _window_seconds: number }
        Returns: boolean
      }
      esocial_config_upsert: { Args: { _payload: Json }; Returns: Json }
      esocial_import_cid10: {
        Args: { _arquivo_nome?: string; _rows: Json }
        Returns: Json
      }
      esocial_import_municipios: {
        Args: { _arquivo_nome?: string; _rows: Json }
        Returns: Json
      }
      esocial_iniciar_retificacao: {
        Args: { _evento_id: string }
        Returns: Json
      }
      esocial_production_checklist: {
        Args: { _empresa: string }
        Returns: Json
      }
      esocial_registrar_download: {
        Args: { _evento_id: string }
        Returns: undefined
      }
      esocial_registrar_ocorrencias: {
        Args: { _evento_id: string; _ocorrencias: Json }
        Returns: Json
      }
      esocial_registrar_xml_meta: {
        Args: {
          _drive_file_id: string
          _drive_link?: string
          _evento_id: string
          _hash: string
          _tamanho_bytes: number
          _versao_layout: string
        }
        Returns: Json
      }
      finalizar_conferencia_estoque: {
        Args: {
          _contrato_id: string
          _empresa_id: string
          _itens: Json
          _observacao_geral?: string
          _tipo: string
          _unidade_id: string
        }
        Returns: Json
      }
      gerar_numero_aso: { Args: { _empresa_id: string }; Returns: string }
      gerar_numero_cat: { Args: { _empresa_id: string }; Returns: string }
      get_active_empresa_id: { Args: { _user_id: string }; Returns: string }
      get_consolidated_epi_stock: { Args: never; Returns: Json }
      get_filial_epis: { Args: { _filial_id: string }; Returns: Json }
      get_my_funcionario_ids: { Args: never; Returns: string[] }
      get_user_empresa_id: { Args: { _user_id: string }; Returns: string }
      get_user_empresa_ids: { Args: { _email: string }; Returns: string[] }
      get_user_empresas: { Args: { _user_id: string }; Returns: string[] }
      get_user_parent_empresa_id: {
        Args: { _user_id: string }
        Returns: string
      }
      has_aso_full_access: { Args: { _user_id: string }; Returns: boolean }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_empresa: {
        Args: { _empresa_id: string; _user_id: string }
        Returns: boolean
      }
      is_empresa_authorized: {
        Args: { _empresa_id: string; _user_id: string }
        Returns: boolean
      }
      is_in_user_company_tree: {
        Args: { _empresa_id: string; _user_id: string }
        Returns: boolean
      }
      is_principal: { Args: { _user_id: string }; Returns: boolean }
      is_same_company_user: {
        Args: { _target_user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      ltcat_abrir_revisao: {
        Args: { _ltcat_id: string; _motivo: string }
        Returns: Json
      }
      ltcat_assinar_visual: {
        Args: {
          _ip_origem: string
          _ltcat_id: string
          _observacao: string
          _pdf_hash: string
          _responsavel_nome: string
          _responsavel_registro: string
        }
        Returns: Json
      }
      ltcat_importar_avaliacoes_pgr: {
        Args: { _item_ids?: string[]; _ltcat_id: string; _pgr_id: string }
        Returns: Json
      }
      ltcat_pdf_registrar: {
        Args: {
          _com_marca_dagua: boolean
          _drive_file_id: string
          _drive_path: string
          _drive_view_link: string
          _ltcat_id: string
          _nome_arquivo: string
          _pdf_hash: string
          _tamanho_bytes: number
        }
        Returns: Json
      }
      ltcat_publicar: { Args: { _ltcat_id: string }; Returns: Json }
      ltcat_validar_interno: {
        Args: { _ltcat_id: string; _pdf_versao?: number }
        Returns: Json
      }
      mfa_required_for_current_user: { Args: never; Returns: Json }
      next_orcamento_numero: { Args: { _empresa_id: string }; Returns: string }
      pgr_abrir_revisao: {
        Args: { _motivo: string; _pgr_id: string }
        Returns: Json
      }
      pgr_acao_set_status: {
        Args: {
          _acao_id: string
          _data_conclusao?: string
          _motivo?: string
          _novo_prazo?: string
          _novo_status: string
        }
        Returns: Json
      }
      pgr_assinar_visual: {
        Args: {
          _ip_origem: string
          _observacao: string
          _pdf_hash: string
          _pgr_id: string
          _responsavel_nome: string
          _responsavel_registro: string
        }
        Returns: Json
      }
      pgr_classificar_risco: {
        Args: { _prob: number; _sev: number }
        Returns: Database["public"]["Enums"]["pgr_risco_classe"]
      }
      pgr_funcionarios_por_ghe: { Args: { _ghe_id: string }; Returns: number }
      pgr_importar_ghe:
        | { Args: { _dry_run?: boolean; _pgr_id: string }; Returns: Json }
        | {
            Args: { _dry_run?: boolean; _ghe_ids?: string[]; _pgr_id: string }
            Returns: Json
          }
      pgr_marcar_atrasadas: { Args: { _pgr_id: string }; Returns: number }
      pgr_pdf_registrar: {
        Args: {
          _com_marca_dagua: boolean
          _drive_file_id: string
          _drive_path: string
          _drive_view_link: string
          _nome_arquivo: string
          _pdf_hash: string
          _pgr_id: string
          _tamanho_bytes: number
        }
        Returns: Json
      }
      pgr_publicar: { Args: { _pgr_id: string }; Returns: Json }
      pgr_seed_textos: { Args: { _pgr_id: string }; Returns: undefined }
      pgr_validar_interno: {
        Args: { _pdf_versao?: number; _pgr_id: string }
        Returns: Json
      }
      ppp_assinar_visual: {
        Args: {
          _ip_origem: string
          _observacao: string
          _pdf_hash: string
          _ppp_id: string
          _responsavel_nome: string
          _responsavel_registro: string
        }
        Returns: Json
      }
      ppp_doc_status: {
        Args: { _ppp_id: string }
        Returns: Database["public"]["Enums"]["ppp_status"]
      }
      ppp_pdf_registrar: {
        Args: {
          _com_marca_dagua: boolean
          _drive_file_id: string
          _drive_path: string
          _drive_view_link: string
          _nome_arquivo: string
          _pdf_hash: string
          _ppp_id: string
          _tamanho_bytes: number
        }
        Returns: Json
      }
      ppp_publicar: { Args: { _ppp_id: string }; Returns: Json }
      proximo_numero_solicitacao_material: {
        Args: { _empresa_id: string }
        Returns: string
      }
      resolve_contrato_target_for_entrega: {
        Args: {
          _funcionario_id: string
          _selected_epi_id: string
          _unidade_id: string
        }
        Returns: {
          contrato_epi_id: string
          contrato_id: string
          resolved_empresa_id: string
          resolved_epi_id: string
        }[]
      }
      s2240_assert_tenant: { Args: { _evento_id: string }; Returns: string }
      s2240_marcar_validacao_xml: {
        Args: {
          _evento_id: string
          _novo_status?: Database["public"]["Enums"]["esocial_s2240_status"]
          _resultado: Database["public"]["Enums"]["esocial_s2240_ocorrencia_resultado"]
          _xml_sha256: string
        }
        Returns: undefined
      }
      s2240_registrar_audit: {
        Args: {
          _action: string
          _evento_id: string
          _funcionario_id?: string
          _hash?: string
          _metadados?: Json
          _ppp_id?: string
          _status?: Database["public"]["Enums"]["esocial_s2240_status"]
        }
        Returns: string
      }
      s2240_registrar_mapeamento_audit: {
        Args: {
          _agente: string
          _codigo_t24: string
          _empresa_id: string
          _status: string
        }
        Returns: undefined
      }
      s2240_registrar_ocorrencia: {
        Args: {
          _erro_resumido?: string
          _evento_id: string
          _mensagens?: Json
          _resultado: Database["public"]["Enums"]["esocial_s2240_ocorrencia_resultado"]
          _tipo: Database["public"]["Enums"]["esocial_s2240_ocorrencia_tipo"]
          _xml_sha256?: string
        }
        Returns: string
      }
      s2240_registrar_xml_meta: {
        Args: {
          _drive_id: string
          _drive_link: string
          _evento_id: string
          _status?: Database["public"]["Enums"]["esocial_s2240_status"]
          _tamanho_bytes: number
          _xml_sha256: string
        }
        Returns: undefined
      }
      salvar_orcamento_itens: {
        Args: { _itens: Json; _orcamento_id: string }
        Returns: undefined
      }
      storage_path_empresa_id: { Args: { _name: string }; Returns: string }
      transfer_epi_between_contracts: {
        Args: {
          _dest_contrato_id: string
          _epi_id: string
          _motivo?: string
          _quantidade: number
          _source_contrato_id: string
        }
        Returns: Json
      }
      transfer_epi_stock: {
        Args: {
          _dest_empresa_id: string
          _quantidade: number
          _source_empresa_id: string
          _source_epi_id: string
        }
        Returns: Json
      }
      transfer_epi_to_contract: {
        Args: {
          _contrato_id: string
          _epi_id: string
          _quantidade: number
          _source_empresa_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "tecnico" | "usuario" | "super_admin"
      cat_emitente_tipo:
        | "empregador"
        | "sindicato"
        | "medico"
        | "autoridade"
        | "segurado"
        | "dependente"
      cat_status:
        | "rascunho"
        | "pronto_para_envio"
        | "concluida"
        | "enviada_esocial"
        | "rejeitada_esocial"
        | "cancelada"
      cat_tipo: "inicial" | "reabertura" | "comunicacao_obito"
      cat_tipo_acidente: "tipico" | "trajeto" | "doenca_ocupacional"
      esocial_acao_hist:
        | "gerado"
        | "validado"
        | "assinatura_simulada"
        | "envio_simulado"
        | "consulta_simulada"
        | "aceito"
        | "rejeitado"
        | "retificado"
        | "marcado_exclusao"
        | "erro"
        | "config_alterada"
      esocial_evento_status:
        | "pendente"
        | "pronto_envio"
        | "validado_stub"
        | "homologacao_stub"
        | "simulado"
        | "aceito"
        | "rejeitado"
        | "retificar"
        | "excluido"
      esocial_ind_retif: "original" | "retificacao"
      esocial_s2240_mapeamento_status: "mapeado" | "pendente" | "divergente"
      esocial_s2240_ocorrencia_resultado: "ok" | "aviso" | "erro"
      esocial_s2240_ocorrencia_tipo:
        | "validacao_local"
        | "geracao_xml_stub"
        | "simulacao_envio"
        | "rejeicao_local"
        | "retificacao_aberta"
        | "exclusao_local"
      esocial_s2240_origem_t24: "oficial" | "referencial" | "pendente_revisao"
      esocial_s2240_status:
        | "pendente"
        | "pronto_envio"
        | "validado_stub"
        | "homologacao_stub"
        | "simulado"
        | "rejeitado_local"
        | "retificar"
        | "excluido_local"
      esocial_s2240_tipo_aval: "quantitativa" | "qualitativa"
      esocial_s2240_tipo_evento:
        | "inicial"
        | "alteracao"
        | "fim"
        | "retificacao"
        | "exclusao"
      esocial_tp_amb: "producao" | "homologacao"
      ltcat_agente_grupo:
        | "fisico"
        | "quimico"
        | "biologico"
        | "ergonomico"
        | "acidente"
      ltcat_conclusao_aposentadoria:
        | "nao_especial"
        | "especial_15"
        | "especial_20"
        | "especial_25"
        | "inconclusivo"
      ltcat_enquadramento:
        | "nao_aplicavel"
        | "habitual_permanente"
        | "intermitente"
        | "eventual"
        | "neutralizado_epi"
      ltcat_motivo_emissao:
        | "inicial"
        | "revisao_periodica"
        | "mudanca_ambiental"
        | "correcao"
      ltcat_status:
        | "rascunho"
        | "em_revisao"
        | "vigente"
        | "substituido"
        | "arquivado"
      ltcat_tecnica_avaliacao: "quantitativa" | "qualitativa"
      pgr_acao_status:
        | "pendente"
        | "em_andamento"
        | "concluida"
        | "atrasada"
        | "cancelada"
      pgr_avaliacao_tipo: "qualitativa" | "quantitativa"
      pgr_exposicao_tipo:
        | "continua"
        | "intermitente"
        | "eventual"
        | "nao_aplicavel"
      pgr_medida_tipo:
        | "eliminacao"
        | "substituicao"
        | "engenharia"
        | "administrativa"
        | "epi"
      pgr_perigo_grupo:
        | "fisico"
        | "quimico"
        | "biologico"
        | "ergonomico"
        | "acidente"
        | "psicossocial"
        | "outro"
      pgr_risco_classe: "baixo" | "moderado" | "alto" | "critico"
      pgr_status:
        | "rascunho"
        | "em_revisao_tecnica"
        | "aguardando_aprovacao"
        | "aguardando_assinatura"
        | "em_revisao"
        | "vigente"
        | "substituido"
        | "arquivado"
      ppp_agente_grupo:
        | "fisico"
        | "quimico"
        | "biologico"
        | "ergonomico"
        | "acidente"
      ppp_conclusao_aposentadoria:
        | "nao_especial"
        | "especial_15"
        | "especial_20"
        | "especial_25"
        | "inconclusivo"
      ppp_enquadramento:
        | "nao_aplicavel"
        | "habitual_permanente"
        | "intermitente"
        | "eventual"
        | "neutralizado_epi"
      ppp_epi_eficacia: "sim" | "nao" | "parcial"
      ppp_motivo_emissao: "inicial" | "atualizacao" | "correcao" | "demissao"
      ppp_status:
        | "rascunho"
        | "em_revisao"
        | "vigente"
        | "substituido"
        | "arquivado"
      ppp_tecnica_avaliacao: "quantitativa" | "qualitativa"
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
      status_solicitacao: "pendente" | "aprovada" | "rejeitada" | "entregue"
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
      tipo_risco_ppp:
        | "fisico"
        | "quimico"
        | "biologico"
        | "ergonomico"
        | "acidente"
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
      cat_emitente_tipo: [
        "empregador",
        "sindicato",
        "medico",
        "autoridade",
        "segurado",
        "dependente",
      ],
      cat_status: [
        "rascunho",
        "pronto_para_envio",
        "concluida",
        "enviada_esocial",
        "rejeitada_esocial",
        "cancelada",
      ],
      cat_tipo: ["inicial", "reabertura", "comunicacao_obito"],
      cat_tipo_acidente: ["tipico", "trajeto", "doenca_ocupacional"],
      esocial_acao_hist: [
        "gerado",
        "validado",
        "assinatura_simulada",
        "envio_simulado",
        "consulta_simulada",
        "aceito",
        "rejeitado",
        "retificado",
        "marcado_exclusao",
        "erro",
        "config_alterada",
      ],
      esocial_evento_status: [
        "pendente",
        "pronto_envio",
        "validado_stub",
        "homologacao_stub",
        "simulado",
        "aceito",
        "rejeitado",
        "retificar",
        "excluido",
      ],
      esocial_ind_retif: ["original", "retificacao"],
      esocial_s2240_mapeamento_status: ["mapeado", "pendente", "divergente"],
      esocial_s2240_ocorrencia_resultado: ["ok", "aviso", "erro"],
      esocial_s2240_ocorrencia_tipo: [
        "validacao_local",
        "geracao_xml_stub",
        "simulacao_envio",
        "rejeicao_local",
        "retificacao_aberta",
        "exclusao_local",
      ],
      esocial_s2240_origem_t24: ["oficial", "referencial", "pendente_revisao"],
      esocial_s2240_status: [
        "pendente",
        "pronto_envio",
        "validado_stub",
        "homologacao_stub",
        "simulado",
        "rejeitado_local",
        "retificar",
        "excluido_local",
      ],
      esocial_s2240_tipo_aval: ["quantitativa", "qualitativa"],
      esocial_s2240_tipo_evento: [
        "inicial",
        "alteracao",
        "fim",
        "retificacao",
        "exclusao",
      ],
      esocial_tp_amb: ["producao", "homologacao"],
      ltcat_agente_grupo: [
        "fisico",
        "quimico",
        "biologico",
        "ergonomico",
        "acidente",
      ],
      ltcat_conclusao_aposentadoria: [
        "nao_especial",
        "especial_15",
        "especial_20",
        "especial_25",
        "inconclusivo",
      ],
      ltcat_enquadramento: [
        "nao_aplicavel",
        "habitual_permanente",
        "intermitente",
        "eventual",
        "neutralizado_epi",
      ],
      ltcat_motivo_emissao: [
        "inicial",
        "revisao_periodica",
        "mudanca_ambiental",
        "correcao",
      ],
      ltcat_status: [
        "rascunho",
        "em_revisao",
        "vigente",
        "substituido",
        "arquivado",
      ],
      ltcat_tecnica_avaliacao: ["quantitativa", "qualitativa"],
      pgr_acao_status: [
        "pendente",
        "em_andamento",
        "concluida",
        "atrasada",
        "cancelada",
      ],
      pgr_avaliacao_tipo: ["qualitativa", "quantitativa"],
      pgr_exposicao_tipo: [
        "continua",
        "intermitente",
        "eventual",
        "nao_aplicavel",
      ],
      pgr_medida_tipo: [
        "eliminacao",
        "substituicao",
        "engenharia",
        "administrativa",
        "epi",
      ],
      pgr_perigo_grupo: [
        "fisico",
        "quimico",
        "biologico",
        "ergonomico",
        "acidente",
        "psicossocial",
        "outro",
      ],
      pgr_risco_classe: ["baixo", "moderado", "alto", "critico"],
      pgr_status: [
        "rascunho",
        "em_revisao_tecnica",
        "aguardando_aprovacao",
        "aguardando_assinatura",
        "em_revisao",
        "vigente",
        "substituido",
        "arquivado",
      ],
      ppp_agente_grupo: [
        "fisico",
        "quimico",
        "biologico",
        "ergonomico",
        "acidente",
      ],
      ppp_conclusao_aposentadoria: [
        "nao_especial",
        "especial_15",
        "especial_20",
        "especial_25",
        "inconclusivo",
      ],
      ppp_enquadramento: [
        "nao_aplicavel",
        "habitual_permanente",
        "intermitente",
        "eventual",
        "neutralizado_epi",
      ],
      ppp_epi_eficacia: ["sim", "nao", "parcial"],
      ppp_motivo_emissao: ["inicial", "atualizacao", "correcao", "demissao"],
      ppp_status: [
        "rascunho",
        "em_revisao",
        "vigente",
        "substituido",
        "arquivado",
      ],
      ppp_tecnica_avaliacao: ["quantitativa", "qualitativa"],
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
      status_solicitacao: ["pendente", "aprovada", "rejeitada", "entregue"],
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
      tipo_risco_ppp: [
        "fisico",
        "quimico",
        "biologico",
        "ergonomico",
        "acidente",
      ],
    },
  },
} as const
