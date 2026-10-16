import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Loader2, ArrowLeft, Info } from "lucide-react";
import { toast } from "sonner";
import {
  anexosPendentes, asoDoAnexo, type AnexoDeAso, type DocumentoComVersoes,
} from "@/lib/importarAsosAnexados";
import { ROTULO_EXAME_ASO } from "@/lib/tipoExameAso";
import { type TipoExameAso } from "@/lib/validadeAso";

const NOME_TIPO_ASO = "ASO - Atestado de Saúde Ocupacional";

const dataBr = (iso?: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

/**
 * Traz para o módulo os ASOs que só existem como PDF anexado no dossiê.
 *
 * Anexado direto no dossiê, o ASO não gera vencimento, não entra nos
 * relatórios e não alimenta o Relatório Analítico que a NR-07 exige
 * (7.5.4 "e"). Esta tela aproveita o que o anexo já tem — colaborador,
 * emissão e vencimento — e pede a única coisa que o arquivo não diz: o
 * tipo de exame.
 *
 * Nada é preenchido por palpite. Os arquivos desta empresa têm todos o
 * mesmo nome, e chutar "periódico" criaria admissional errado num
 * documento legal — erro que ninguém mais conferiria, justamente por já
 * vir preenchido.
 */
export default function AsoImportarAnexados({ onVoltar }: { onVoltar?: () => void }) {
  const { empresaId, user } = useAuth();
  const [carregando, setCarregando] = useState(true);
  const [anexos, setAnexos] = useState<AnexoDeAso[]>([]);
  const [tipoPorVersao, setTipoPorVersao] = useState<Record<string, string>>({});
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  const [importando, setImportando] = useState(false);

  useEffect(() => {
    if (!empresaId) return;
    let vivo = true;
    (async () => {
      setCarregando(true);
      try {
        const { data: tipo } = await (supabase.from as any)("internal_document_types")
          .select("id").is("empresa_id", null).eq("nome", NOME_TIPO_ASO).maybeSingle();
        if (!tipo?.id) { if (vivo) { setAnexos([]); setCarregando(false); } return; }

        const { data: docs } = await (supabase.from as any)("internal_documents")
          .select("id, colaborador_id, internal_document_versions(id, versao, nome_original, data_emissao, data_validade, origem_tabela)")
          .eq("empresa_id", empresaId)
          .eq("tipo_documento_id", tipo.id)
          .is("arquivado_em", null);

        const ids = Array.from(new Set(((docs || []) as DocumentoComVersoes[])
          .map((d) => d.colaborador_id).filter(Boolean)));
        const { data: pessoas } = ids.length
          ? await supabase.from("funcionarios").select("id, nome").in("id", ids)
          : { data: [] as any[] };
        const nomes = new Map<string, string>(
          (pessoas || []).map((p: any) => [p.id, p.nome]),
        );

        if (vivo) setAnexos(anexosPendentes((docs || []) as DocumentoComVersoes[], nomes));
      } catch (e: any) {
        toast.error("Não foi possível ler os anexos", { description: e?.message });
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, [empresaId]);

  /** Prontos para importar: marcados, com tipo escolhido e com emissão. */
  const prontos = useMemo(
    () => anexos.filter((a) =>
      marcados[a.versaoId] && tipoPorVersao[a.versaoId] && a.dataEmissao),
    [anexos, marcados, tipoPorVersao],
  );

  const aplicarTipoEmTodos = (tipo: string) => {
    const novo: Record<string, string> = {};
    for (const a of anexos) novo[a.versaoId] = tipo;
    setTipoPorVersao(novo);
  };

  const marcarTodos = (v: boolean) => {
    const novo: Record<string, boolean> = {};
    for (const a of anexos) if (a.dataEmissao) novo[a.versaoId] = v;
    setMarcados(novo);
  };

  const importar = async () => {
    if (!empresaId || prontos.length === 0) return;
    setImportando(true);
    let feitos = 0;
    const falhas: string[] = [];
    try {
      for (const anexo of prontos) {
        const { data: num } = await supabase.rpc("gerar_numero_aso", { _empresa_id: empresaId });
        const registro = asoDoAnexo({
          anexo,
          tipoExame: tipoPorVersao[anexo.versaoId] as TipoExameAso,
          empresaId,
          numero: num || `ASO-${Date.now()}`,
          userId: user?.id,
        });
        if (!registro) { falhas.push(anexo.colaboradorNome); continue; }

        const { data: criado, error } = await (supabase.from as any)("asos")
          .insert(registro).select("id").single();
        if (error) { falhas.push(`${anexo.colaboradorNome}: ${error.message}`); continue; }

        /*
         * A versão passa a apontar para o ASO criado. É isso que liga o
         * papel ao registro — e é o que impede este mesmo anexo de ser
         * importado de novo numa próxima passagem.
         */
        await (supabase.from as any)("internal_document_versions")
          .update({ origem_tabela: "asos", origem_id: criado.id })
          .eq("id", anexo.versaoId);

        feitos++;
      }

      if (feitos) toast.success(`${feitos} ASO(s) importado(s) para o módulo.`);
      if (falhas.length) {
        toast.error(`${falhas.length} não importado(s)`, { description: falhas.slice(0, 3).join(" · ") });
      }
      setAnexos((atual) => atual.filter((a) => !prontos.some((p) => p.versaoId === a.versaoId)));
      setMarcados({});
    } finally {
      setImportando(false);
    }
  };

  if (carregando) {
    return <div className="p-6 text-sm text-muted-foreground">
      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Lendo os anexos do dossiê…
    </div>;
  }

  return (
    <div className="space-y-4">
      {onVoltar && (
        <Button variant="ghost" size="sm" onClick={onVoltar}>
          <ArrowLeft className="w-4 h-4 mr-2" />Voltar para a lista
        </Button>
      )}

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <p>
              Estes ASOs foram anexados direto no Dossiê do Colaborador e o módulo não
              os conhece — por isso não geram vencimento nem entram no Relatório
              Analítico. O colaborador e as datas vêm do próprio anexo; falta dizer
              <strong> qual exame é cada um</strong>, que o arquivo não informa.
            </p>
          </div>

          {anexos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum ASO anexado fora do módulo. Está tudo lançado.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => marcarTodos(true)}>
                  Marcar todos
                </Button>
                <Button size="sm" variant="ghost" onClick={() => marcarTodos(false)}>
                  Desmarcar
                </Button>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-muted-foreground">Aplicar tipo a todos:</span>
                  <Select onValueChange={aplicarTipoEmTodos}>
                    <SelectTrigger className="w-44 h-8 text-xs">
                      <SelectValue placeholder="Escolha o exame…" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROTULO_EXAME_ASO).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Emissão</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="w-52">Tipo de exame *</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {anexos.map((a) => (
                      <TableRow key={a.versaoId}>
                        <TableCell>
                          <Checkbox
                            checked={!!marcados[a.versaoId]}
                            disabled={!a.dataEmissao}
                            onCheckedChange={(v) =>
                              setMarcados((m) => ({ ...m, [a.versaoId]: !!v }))}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {a.colaboradorNome}
                          <span className="ml-2 text-[10px] text-muted-foreground">v{a.versao}</span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {a.dataEmissao ? dataBr(a.dataEmissao) : (
                            <Badge variant="outline" className="text-[10px] font-normal"
                              title="Sem data de emissão no anexo. Informe a data no dossiê antes de importar — usar a data de hoje marcaria como atual um exame antigo.">
                              sem data de emissão
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{dataBr(a.dataVencimento)}</TableCell>
                        <TableCell>
                          <Select
                            value={tipoPorVersao[a.versaoId] || ""}
                            onValueChange={(v) =>
                              setTipoPorVersao((t) => ({ ...t, [a.versaoId]: v }))}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Escolha…" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(ROTULO_EXAME_ASO).map(([v, l]) => (
                                <SelectItem key={v} value={v}>{l}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {prontos.length} de {anexos.length} prontos para importar
                  {prontos.length < anexos.length && " — falta marcar ou escolher o exame nos demais."}
                </p>
                <Button onClick={importar} disabled={prontos.length === 0 || importando}>
                  {importando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Importar {prontos.length || ""}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
