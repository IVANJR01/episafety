import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useMatrizMetodos, useMatrizRisco } from "@/hooks/useMatrizRisco";

export default function MatrizRiscoAdmin() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const { data: metodos = [], isLoading } = useMatrizMetodos(empresaId);
  const [versaoSel, setVersaoSel] = useState<string>("");
  const [duplicando, setDuplicando] = useState(false);

  const versoesTodas = metodos.flatMap((m: any) =>
    (m.versoes || []).map((v: any) => ({ ...v, metodo: m })));
  const versaoAtiva = versaoSel || versoesTodas.find((v: any) => v.status === "vigente")?.id || "";
  const matriz = useMatrizRisco(versaoAtiva || null);
  const metodoSel = versoesTodas.find((v: any) => v.id === versaoAtiva)?.metodo;
  const ehGlobal = metodoSel?.empresa_id == null;

  /**
   * Cria um método próprio do tenant copiando as faixas da versão exibida.
   * Não se edita a versão vigente: alterar faixas em uso reescreveria a
   * classificação de PGRs já emitidos.
   */
  const duplicarParaEmpresa = async () => {
    if (!empresaId) return toast.error("Nenhuma empresa ativa.");
    setDuplicando(true);
    try {
      const { data: m, error: e1 } = await (supabase.from as any)("sst_matriz_metodos")
        .insert({
          empresa_id: empresaId,
          nome: `${metodoSel?.nome || "Matriz"} (cópia)`,
          descricao: "Cópia editável criada a partir de " + (metodoSel?.nome || "matriz padrão"),
          dimensao_severidade: metodoSel?.dimensao_severidade ?? 5,
          dimensao_probabilidade: metodoSel?.dimensao_probabilidade ?? 5,
        }).select().single();
      if (e1) throw e1;

      const { data: v, error: e2 } = await (supabase.from as any)("sst_matriz_versoes")
        .insert({
          metodo_id: m.id, versao: 1, status: "rascunho",
          motivo_alteracao: "Cópia inicial para customização.",
        }).select().single();
      if (e2) throw e2;

      if (matriz.niveis.length) {
        const { error: e3 } = await (supabase.from as any)("sst_matriz_niveis").insert(
          matriz.niveis.map((n) => ({
            versao_id: v.id, codigo: n.codigo, rotulo: n.rotulo,
            valor_min: n.valor_min, valor_max: n.valor_max, cor_hex: n.cor_hex,
            decisao: n.decisao, exige_acao: n.exige_acao, ordem: n.ordem,
          })));
        if (e3) throw e3;
      }
      if (matriz.escalas.length) {
        const { error: e4 } = await (supabase.from as any)("sst_matriz_escalas").insert(
          matriz.escalas.map((e) => ({
            versao_id: v.id, tipo: e.tipo, valor: e.valor,
            rotulo: e.rotulo, definicao: e.definicao,
          })));
        if (e4) throw e4;
      }

      toast.success("Cópia criada como rascunho. Edite as faixas antes de publicar.");
      qc.invalidateQueries({ queryKey: ["matriz-metodos"] });
      setVersaoSel(v.id);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDuplicando(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando matrizes…
      </div>
    );
  }

  const sevs = Array.from({ length: matriz.dimensaoSev }, (_, i) => matriz.dimensaoSev - i);
  const probs = Array.from({ length: matriz.dimensaoProb }, (_, i) => i + 1);

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold">Matriz de Risco</h1>
        <p className="text-sm text-muted-foreground">
          Os critérios de severidade, probabilidade e classificação precisam ficar
          documentados (NR-01 1.5.4.4.2). Cada PGR trava a versão que usou, para que
          uma mudança de metodologia nunca reescreva um documento já emitido.
        </p>
      </div>

      <Card>
        <CardContent className="p-3 flex flex-wrap gap-3 items-end justify-between">
          <div className="min-w-[280px]">
            <label className="text-xs text-muted-foreground">Método e versão</label>
            <Select value={versaoAtiva} onValueChange={setVersaoSel}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {versoesTodas.map((v: any) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.metodo.nome} · v{v.versao} · {v.status}
                    {v.metodo.empresa_id == null ? " (global)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            {ehGlobal && (
              <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
                <Lock className="h-3 w-3 mr-1" /> Somente leitura
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={duplicarParaEmpresa} disabled={duplicando}>
              {duplicando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Criar cópia editável
            </Button>
          </div>
        </CardContent>
      </Card>

      {ehGlobal && (
        <div className="text-xs border rounded p-2 bg-blue-50 text-blue-900 flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Esta é a matriz padrão do sistema, compartilhada por todos os clientes — por
            isso não é editável aqui. Para usar critérios próprios, crie uma cópia: ela
            nasce como rascunho e pertence apenas à sua empresa.
          </span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Faixas de classificação</CardTitle>
          <CardDescription>
            Fórmula: {metodoSel?.formula || "severidade × probabilidade"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Classe</TableHead>
                <TableHead>Faixa</TableHead>
                <TableHead>Exige ação</TableHead>
                <TableHead>Decisão associada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matriz.niveis.map((n) => (
                <TableRow key={n.id}>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <span className="w-3 h-3 rounded" style={{ background: n.cor_hex || "#94a3b8" }} />
                      {n.rotulo}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{n.valor_min} – {n.valor_max}</TableCell>
                  <TableCell>
                    {n.exige_acao
                      ? <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">Sim</Badge>
                      : <span className="text-muted-foreground text-xs">Não</span>}
                  </TableCell>
                  <TableCell className="text-xs">{n.decisao || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Matriz resultante</CardTitle>
          <CardDescription>Severidade (linhas) × Probabilidade (colunas)</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="border-collapse">
            <tbody>
              {sevs.map((s) => (
                <tr key={s}>
                  <td className="text-[10px] text-muted-foreground pr-2 text-right whitespace-nowrap">
                    {s} {matriz.escalaDe("severidade", s)?.rotulo || ""}
                  </td>
                  {probs.map((p) => {
                    const n = matriz.classificar(s, p);
                    return (
                      <td key={p} className="p-0.5">
                        <div
                          title={`Sev ${s} × Prob ${p} = ${s * p} · ${n?.rotulo || "sem faixa"}`}
                          className="w-11 h-11 rounded text-white text-xs font-semibold flex items-center justify-center"
                          style={{ background: n?.cor_hex || "#94a3b8" }}
                        >
                          {s * p}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td />
                {probs.map((p) => (
                  <td key={p} className="text-[10px] text-muted-foreground text-center pt-1">
                    {p}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Critérios das escalas</CardTitle>
          <CardDescription>
            É a definição objetiva de cada grau que torna a avaliação auditável — não o rótulo.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dimensão</TableHead>
                <TableHead>Grau</TableHead>
                <TableHead>Rótulo</TableHead>
                <TableHead>Definição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matriz.escalas.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="capitalize text-xs">{e.tipo}</TableCell>
                  <TableCell>{e.valor}</TableCell>
                  <TableCell>{e.rotulo}</TableCell>
                  <TableCell className="text-xs">{e.definicao || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
