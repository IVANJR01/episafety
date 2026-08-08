import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, FileText, GraduationCap, Clock } from "lucide-react";
import DocumentoEvidencia from "@/components/treinamentos/DocumentoEvidencia";
import { isOnline } from "@/lib/offlineStorage";

const NOME_TIPO_ASO = "ASO - Atestado de Saúde Ocupacional";

function maskCpf(cpf?: string | null) {
  if (!cpf) return "—";
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.***.***-${d.slice(9)}`;
}

// Mesma normalização (remove acentos) que Treinamentos.tsx usa pra bater
// nome de curso com internal_document_types.nome. Evita regex literal com o
// intervalo de marcas de acentuação combinantes (0x0300-0x036f), que se
// perde fácil em transporte de texto — filtra por código de caractere.
function normalizarNome(s: string): string {
  const semAcento = (s || "")
    .normalize("NFD")
    .split("")
    .filter((ch) => {
      const codigo = ch.codePointAt(0) || 0;
      return codigo < 0x0300 || codigo > 0x036f;
    })
    .join("");
  return semAcento.toLowerCase().replace(/\s+/g, " ").trim();
}

interface Funcionario {
  id: string;
  nome: string;
  cpf: string | null;
  cargo: string | null;
  setor: string | null;
  matricula: string | null;
  empresa_id: string | null;
}

interface Aso {
  id: string;
  data_emissao: string | null;
  data_vencimento: string | null;
}

interface ControleTreinamento {
  id: string;
  nome_curso: string;
  funcionario_id: string;
  empresa_id: string | null;
}

/**
 * Dossiê Digital do Colaborador — um lugar só por colaborador, em vez de
 * espalhado por módulo. Mostra o que já está de fato ligado ao Arquivo
 * Digital (ASO, Cursos/Capacitações); Ficha de EPI, Ordem de Serviço e
 * documentos pessoais ainda não migraram pra cá, então entram como aviso,
 * não como se já funcionassem.
 */
export default function DossieColaborador() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canEdit } = usePermissions("cadastro_funcionarios");

  const [funcionario, setFuncionario] = useState<Funcionario | null | undefined>(undefined);
  const [empresaNome, setEmpresaNome] = useState("");
  const [ultimoAso, setUltimoAso] = useState<Aso | null>(null);
  const [asoTipoId, setAsoTipoId] = useState<string | null>(null);
  const [cursos, setCursos] = useState<ControleTreinamento[]>([]);
  const [tiposPorNome, setTiposPorNome] = useState<Map<string, { id: string; validade_meses: number | null }>>(new Map());

  useEffect(() => {
    if (!id) return;
    let cancelado = false;
    void (async () => {
      const { data } = await supabase
        .from("funcionarios")
        .select("id, nome, cpf, cargo, setor, matricula, empresa_id")
        .eq("id", id)
        .maybeSingle();
      if (!cancelado) setFuncionario((data as Funcionario) || null);
    })();
    return () => { cancelado = true; };
  }, [id]);

  useEffect(() => {
    if (!funcionario?.empresa_id) return;
    supabase.from("empresa_config").select("nome").eq("id", funcionario.empresa_id).maybeSingle()
      .then(({ data }) => { if (data) setEmpresaNome(data.nome); });
  }, [funcionario?.empresa_id]);

  useEffect(() => {
    if (!id) return;
    (supabase.from as any)("asos")
      .select("id, data_emissao, data_vencimento")
      .eq("funcionario_id", id)
      .order("data_emissao", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => setUltimoAso(data || null));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    (supabase.from as any)("controle_treinamentos")
      .select("id, nome_curso, funcionario_id, empresa_id")
      .eq("funcionario_id", id)
      .order("nome_curso")
      .then(({ data }: any) => setCursos(data || []));
  }, [id]);

  // Enquanto a migration do Arquivo Digital não roda, estas consultas falham
  // e os mapas ficam vazios — as seções abaixo caem no aviso de tabela
  // ausente do próprio DocumentoEvidencia, em vez de quebrar a página.
  useEffect(() => {
    if (!isOnline()) return;
    void (async () => {
      const { data } = await (supabase.from as any)("internal_document_types")
        .select("id")
        .is("empresa_id", null)
        .ilike("nome", NOME_TIPO_ASO)
        .maybeSingle();
      setAsoTipoId(data?.id || null);
    })();
  }, []);

  useEffect(() => {
    if (!isOnline()) return;
    void (async () => {
      const { data, error } = await (supabase.from as any)("internal_document_types")
        .select("id, nome, validade_meses")
        .eq("ativo", true);
      if (error || !data) return;
      setTiposPorNome(new Map(
        (data as any[]).map((t) => [normalizarNome(t.nome), { id: t.id, validade_meses: t.validade_meses }]),
      ));
    })();
  }, []);

  const tipoDoCurso = useCallback(
    (nomeCurso: string) => tiposPorNome.get(normalizarNome(nomeCurso)),
    [tiposPorNome],
  );

  if (funcionario === undefined) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }

  if (funcionario === null) {
    return (
      <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate("/cadastro/funcionarios")}>
          <ArrowLeft className="w-4 h-4 mr-2" />Voltar
        </Button>
        <p className="text-sm text-muted-foreground">Colaborador não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate("/cadastro/funcionarios")}>
        <ArrowLeft className="w-4 h-4 mr-2" />Voltar
      </Button>

      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{funcionario.nome}</h1>
            <p className="text-sm text-muted-foreground">{funcionario.cargo || "Sem cargo"} • {funcionario.setor || "Sem setor"}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
              <span>CPF: {maskCpf(funcionario.cpf)}</span>
              <span>Matrícula: {funcionario.matricula || "—"}</span>
              {empresaNome && <span>{empresaNome}</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" />ASO</CardTitle>
        </CardHeader>
        <CardContent>
          {ultimoAso ? (
            <DocumentoEvidencia
              empresaId={funcionario.empresa_id || ""}
              colaboradorId={funcionario.id}
              tipoDocumentoId={asoTipoId}
              dataValidade={ultimoAso.data_vencimento}
              registroId={ultimoAso.id}
              origemTabela="asos"
              origemId={ultimoAso.id}
              userId={user?.id}
              podeEditar={canEdit}
              semTipoTexto="Arquivo Digital indisponível"
              semTipoTitulo="O tipo de documento do ASO ainda não foi configurado neste banco."
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum ASO cadastrado.{" "}
              <button type="button" className="text-primary hover:underline" onClick={() => navigate("/aso")}>
                Cadastrar em Exames
              </button>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><GraduationCap className="w-4 h-4" />Cursos e Capacitações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cursos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum curso registrado para este colaborador.</p>
          ) : cursos.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 border-b last:border-0 pb-3 last:pb-0">
              <span className="text-sm font-medium">{c.nome_curso}</span>
              <DocumentoEvidencia
                empresaId={c.empresa_id || funcionario.empresa_id || ""}
                colaboradorId={funcionario.id}
                tipoDocumentoId={tipoDoCurso(c.nome_curso)?.id}
                validadeMeses={tipoDoCurso(c.nome_curso)?.validade_meses}
                registroId={c.id}
                userId={user?.id}
                podeEditar={canEdit}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-muted-foreground"><Clock className="w-4 h-4" />Em breve</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ficha de EPI, Ordem de Serviço e documentos pessoais ainda não fazem parte do Arquivo Digital — entram em rodadas futuras.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
