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
      empresa_config: {
        Row: {
          cnpj: string | null
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          logo_url: string | null
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      entregas: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          epi_id: string
          funcionario_id: string
          id: string
          observacao: string | null
          quantidade: number
          status: Database["public"]["Enums"]["status_entrega"]
          tipo: Database["public"]["Enums"]["tipo_entrega"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: string
          epi_id: string
          funcionario_id: string
          id?: string
          observacao?: string | null
          quantidade?: number
          status?: Database["public"]["Enums"]["status_entrega"]
          tipo?: Database["public"]["Enums"]["tipo_entrega"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          epi_id?: string
          funcionario_id?: string
          id?: string
          observacao?: string | null
          quantidade?: number
          status?: Database["public"]["Enums"]["status_entrega"]
          tipo?: Database["public"]["Enums"]["tipo_entrega"]
        }
        Relationships: [
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
          estoque?: number
          estoque_minimo?: number
          fabricante?: string | null
          id?: string
          nome?: string
          updated_at?: string
          validade?: string | null
          valor?: number | null
        }
        Relationships: []
      }
      exames: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          data_vencimento: string | null
          funcionario_id: string
          id: string
          medico: string | null
          observacao: string | null
          resultado: Database["public"]["Enums"]["resultado_exame"]
          tipo: Database["public"]["Enums"]["tipo_exame"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: string
          data_vencimento?: string | null
          funcionario_id: string
          id?: string
          medico?: string | null
          observacao?: string | null
          resultado?: Database["public"]["Enums"]["resultado_exame"]
          tipo: Database["public"]["Enums"]["tipo_exame"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          data_vencimento?: string | null
          funcionario_id?: string
          id?: string
          medico?: string | null
          observacao?: string | null
          resultado?: Database["public"]["Enums"]["resultado_exame"]
          tipo?: Database["public"]["Enums"]["tipo_exame"]
        }
        Relationships: [
          {
            foreignKeyName: "exames_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
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
          entrega_ids?: string[] | null
          funcionario_id?: string
          id?: string
          pdf_url?: string | null
        }
        Relationships: [
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
          cpf: string | null
          created_at: string
          created_by: string | null
          data_admissao: string | null
          id: string
          matricula: string | null
          nome: string
          setor: string | null
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_admissao?: string | null
          id?: string
          matricula?: string | null
          nome: string
          setor?: string | null
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_admissao?: string | null
          id?: string
          matricula?: string | null
          nome?: string
          setor?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inspecao_itens: {
        Row: {
          conforme: boolean | null
          descricao: string
          id: string
          inspecao_id: string
          observacao: string | null
        }
        Insert: {
          conforme?: boolean | null
          descricao: string
          id?: string
          inspecao_id: string
          observacao?: string | null
        }
        Update: {
          conforme?: boolean | null
          descricao?: string
          id?: string
          inspecao_id?: string
          observacao?: string | null
        }
        Relationships: [
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
          id?: string
          local?: string | null
          observacao?: string | null
          responsavel?: string | null
          status?: Database["public"]["Enums"]["status_inspecao"]
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      ordens_servico: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          descricao: string | null
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
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      treinamento_participantes: {
        Row: {
          funcionario_id: string
          id: string
          treinamento_id: string
        }
        Insert: {
          funcionario_id: string
          id?: string
          treinamento_id: string
        }
        Update: {
          funcionario_id?: string
          id?: string
          treinamento_id?: string
        }
        Relationships: [
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
          id?: string
          instrutor?: string | null
          nome?: string
          status?: Database["public"]["Enums"]["status_treinamento"]
          updated_at?: string
          validade?: string | null
        }
        Relationships: []
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
          id: string
          nome: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          nome?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          nome?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "tecnico" | "usuario"
      resultado_exame: "apto" | "inapto" | "apto_com_restricao" | "pendente"
      status_entrega:
        | "ativo"
        | "devolvido"
        | "trocado"
        | "substituido"
        | "perdido"
        | "danificado"
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
      app_role: ["admin", "tecnico", "usuario"],
      resultado_exame: ["apto", "inapto", "apto_com_restricao", "pendente"],
      status_entrega: [
        "ativo",
        "devolvido",
        "trocado",
        "substituido",
        "perdido",
        "danificado",
      ],
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
