import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, CheckCircle2, Layers, Loader2, MapPin, Users, Workflow, Building2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { useSupabaseQuery } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import {
  duplicadosDoCadastro, sugerirPrincipal, camposPreenchidos,
  type GrupoDuplicado, type ItemCadastro,
} from "@/lib/duplicadosCadastro";
import { unirCadastro, type TabelaUnivel } from "@/lib/unirCadastroEstrutura";

/*
 * Limpeza de cadastros repetidos.
 *
 * O problema que ela resolve aparece no documento, não na tela: um PGR real
 * saiu com CORTE, COSTURA e LOJA descritos duas vezes, com textos diferentes,
 * porque eram duas linhas no cadastro. Também havia ESCRITORIO e ESCRITÓRIO,
 * "SEPARAÇÃO (Cópia)" e dois erros de digitação do almoxarifado.
 *
 * A tela não decide nada sozinha. Ela mostra o que está repetido, sugere qual
 * cadastro manter — o mais completo — e espera a confirmação de quem conhece a
 * empresa. Unir é irreversível para quem está olhando, então antes de mexer em
 * qualquer coisa o cadastro que sai é copiado para uma tabela de segurança.
 */

interface Secao {
  chave: TabelaUnivel;
  titulo: string;
  singular: string;
  icone: typeof MapPin;
}

export const SECOES: Secao[] = [
  { chave: "sst_ambientes", titulo: "Ambientes", singular: "ambiente", icone: MapPin },
  { chave: "sst_setores", titulo: "Setores", singular: "setor", icone: Building2 },
  { chave: "sst_processos", titulo: "Processos", singular: "processo", icone: Workflow },
  { chave: "sst_funcoes", titulo: "Funções", singular: "função", icone: Users },
  { chave: "sst_ges", titulo: "GES", singular: "GES", icone: Layers },
];

/** Um resumo curto do cadastro, para dar o que decidir sem abrir nada. */
function resumo(item: ItemCadastro): string {
  const partes = [
    item.codigo, item.descricao, item.descricao_etapas, item.descricao_atividades,
  ].filter((v) => v != null && String(v).trim() !== "").map(String);
  const texto = partes.join(" · ").replace(/\s+/g, " ").trim();
  return texto.length > 160 ? `${texto.slice(0, 160)}…` : texto;
}

function dataCurta(valor: unknown): string {
  const d = valor ? new Date(String(valor)) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

function GrupoCard({
  grupo, secao, aoUnir, unindo,
}: {
  grupo: GrupoDuplicado;
  secao: Secao;
  aoUnir: (manter: string, remover: string[]) => void;
  unindo: boolean;
}) {
  const sugerido = sugerirPrincipal(grupo.itens)?.id || grupo.itens[0].id;
  const [manter, setManter] = useState(sugerido);
  /*
   * Em "parecidos" nenhum cadastro vem marcado: o sistema não tem certeza de
   * que são a mesma coisa, e marcar por padrão empurraria para unir sem olhar.
   */
  const [juntar, setJuntar] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(grupo.itens.map((i) => [i.id, grupo.tipo === "iguais"])),
  );
  const [confirmando, setConfirmando] = useState(false);

  const remover = grupo.itens.map((i) => i.id).filter((id) => id !== manter && juntar[id]);
  const parecidos = grupo.tipo === "parecidos";

  return (
    <Card className={parecidos ? "border-amber-300 dark:border-amber-800" : undefined}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{grupo.rotulo}</CardTitle>
          {parecidos ? (
            <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3 mr-1" aria-hidden />
              Nomes parecidos
            </Badge>
          ) : (
            <Badge variant="secondary">{grupo.itens.length} cadastros iguais</Badge>
          )}
        </div>
        <CardDescription>
          {parecidos
            ? `Pode ser o mesmo ${secao.singular} escrito de dois jeitos — ou dois de verdade. Confira antes de unir.`
            : `O mesmo nome cadastrado ${grupo.itens.length} vezes. Escolha qual fica.`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <RadioGroup value={manter} onValueChange={setManter} className="space-y-2">
          {grupo.itens.map((item) => {
            const ehPrincipal = item.id === manter;
            return (
              <div
                key={item.id}
                className={`rounded-lg border p-3 ${ehPrincipal ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem value={item.id} id={`fica-${item.id}`} className="mt-1" />
                  <div className="min-w-0 flex-1">
                    <Label htmlFor={`fica-${item.id}`} className="font-medium cursor-pointer break-words">
                      {String(item.nome ?? "(sem nome)")}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {camposPreenchidos(item)} campos preenchidos
                      {dataCurta(item.created_at) ? ` · cadastrado em ${dataCurta(item.created_at)}` : ""}
                    </p>
                    {resumo(item) && (
                      <p className="text-xs text-muted-foreground mt-1 break-words">{resumo(item)}</p>
                    )}
                  </div>

                  {ehPrincipal ? (
                    <Badge className="shrink-0">Fica</Badge>
                  ) : (
                    <label className="flex items-center gap-2 text-xs shrink-0 cursor-pointer">
                      <Checkbox
                        checked={!!juntar[item.id]}
                        onCheckedChange={(v) =>
                          setJuntar((s) => ({ ...s, [item.id]: v === true }))}
                        aria-label={`Unir ${String(item.nome ?? "")} ao cadastro que fica`}
                      />
                      Unir a este
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </RadioGroup>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            size="sm"
            disabled={remover.length === 0 || unindo}
            onClick={() => setConfirmando(true)}
          >
            {unindo && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden />}
            Unir {remover.length > 0 ? `${remover.length} ` : ""}
            {remover.length === 1 ? "cadastro" : "cadastros"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Tudo que aponta para os cadastros unidos passa para o que fica.
          </span>
        </div>
      </CardContent>

      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unir {remover.length === 1 ? "o cadastro" : "os cadastros"}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Fica: <strong>{String(grupo.itens.find((i) => i.id === manter)?.nome ?? "")}</strong>.
                </p>
                <p>
                  Sai{remover.length > 1 ? "em" : ""}:{" "}
                  {remover
                    .map((id) => String(grupo.itens.find((i) => i.id === id)?.nome ?? ""))
                    .join(", ")}.
                </p>
                <p>
                  Nada se perde: os itens de inventário, as ações do plano e os demais
                  vínculos passam para o cadastro que fica, e os campos que só o removido
                  tinha preenchidos são copiados. O que sai é guardado numa cópia de
                  segurança antes de qualquer alteração.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => aoUnir(manter, remover)}>
              Unir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/* Exportada para o teste poder montar uma seção sem passar pelas abas. */
export function SecaoLimpeza({ secao }: { secao: Secao }) {
  const queryClient = useQueryClient();
  const { data: itens = [], loading } = useSupabaseQuery<ItemCadastro>(
    secao.chave, secao.chave === "sst_ges" ? "codigo" : "nome", true,
  );
  const [unindo, setUnindo] = useState(false);

  const grupos = useMemo(() => duplicadosDoCadastro(itens), [itens]);

  const unir = async (manter: string, remover: string[]) => {
    setUnindo(true);
    try {
      const r = await unirCadastro(supabase as never, {
        tabela: secao.chave, manter, remover,
      });
      const detalhes = [
        `${r.removidos} ${r.removidos === 1 ? "cadastro unido" : "cadastros unidos"}`,
        r.vinculosMovidos > 0 ? `${r.vinculosMovidos} vínculos movidos` : null,
        r.camposPreenchidos.length > 0
          ? `${r.camposPreenchidos.length} campos completados` : null,
        r.vinculosDuplicadosDescartados > 0
          ? `${r.vinculosDuplicadosDescartados} vínculos repetidos descartados` : null,
      ].filter(Boolean).join(" · ");
      toast.success("Cadastros unidos", { description: detalhes });
      await queryClient.invalidateQueries({ queryKey: ["supabase"] });
    } catch (e: any) {
      /* A mensagem já vem explicando o que falhou e em que passo. */
      toast.error("Não deu para unir", { description: e?.message || String(e) });
    } finally {
      setUnindo(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Procurando repetições…
      </div>
    );
  }

  if (grupos.length === 0) {
    return (
      <div className="flex flex-col items-center text-center gap-2 py-10">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" aria-hidden />
        <p className="font-medium">Nenhuma repetição em {secao.titulo.toLowerCase()}</p>
        <p className="text-sm text-muted-foreground">
          {itens.length} {itens.length === 1 ? "cadastro conferido" : "cadastros conferidos"}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {grupos.map((grupo, i) => (
        <GrupoCard
          key={`${grupo.tipo}-${grupo.itens.map((x) => x.id).join("-")}-${i}`}
          grupo={grupo}
          secao={secao}
          unindo={unindo}
          aoUnir={unir}
        />
      ))}
    </div>
  );
}

export default function LimpezaCadastros() {
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Limpeza de cadastros"
        subtitle="Cadastros repetidos da estrutura — ambientes, setores, processos, funções e GES."
      />

      <Card className="mb-4">
        <CardContent className="pt-5 text-sm text-muted-foreground space-y-1">
          <p>
            Cadastro repetido vira documento repetido: o mesmo setor descrito duas vezes,
            com textos diferentes, dentro do PGR.
          </p>
          <p>
            Aqui nada é apagado sozinho. O sistema mostra o que está repetido, sugere qual
            cadastro manter — o mais completo — e só une depois da sua confirmação.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue={SECOES[0].chave}>
        <TabsList className="flex flex-wrap h-auto">
          {SECOES.map((s) => (
            <TabsTrigger key={s.chave} value={s.chave} className="gap-1.5">
              <s.icone className="h-4 w-4" aria-hidden />
              {s.titulo}
            </TabsTrigger>
          ))}
        </TabsList>
        {SECOES.map((s) => (
          <TabsContent key={s.chave} value={s.chave} className="mt-4">
            <SecaoLimpeza secao={s} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
