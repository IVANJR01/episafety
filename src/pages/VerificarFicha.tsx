/*
 * Conferência pública da Ficha de EPI pelo código impresso.
 *
 * A ficha trazia o código de 40 caracteres embaixo de cada assinatura desde
 * que ele foi criado, mas não havia onde digitá-lo: quem recebia o papel não
 * tinha como saber se aquilo corresponde a um registro real. Esta página é
 * esse "onde".
 *
 * Ela não substitui o validar.iti.gov.br e diz isso na cara, no rodapé. O que
 * ela prova é que a entrega existe no sistema com aquela assinatura — que é o
 * que a fiscalização quer conferir na prática.
 */
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, ShieldCheck, Loader2, Search } from "lucide-react";

interface Resultado {
  empresa: string | null;
  funcionario: string | null;
  cargo: string | null;
  data_entrega: string | null;
  assinado_em: string | null;
  epi: string | null;
  ca: string | null;
  tipo: string | null;
  quantidade: number | null;
}

const ROTULO_TIPO: Record<string, string> = {
  entrega: "Entrega", substituicao: "Substituição", perda: "Perda",
  dano: "Dano", troca: "Troca", devolucao: "Devolução",
};

/** Só hexadecimal, minúsculo, no tamanho do código impresso. */
function limpar(bruto: string): string {
  return bruto.toLowerCase().replace(/[^0-9a-f]/g, "").slice(0, 40);
}

function dataBr(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

function dataHoraBr(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR")}`;
}

export default function VerificarFicha() {
  const { codigo: codigoDaUrl } = useParams();
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState(limpar(codigoDaUrl || ""));
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [naoAchou, setNaoAchou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const verificar = async (valor: string) => {
    const limpo = limpar(valor);
    if (limpo.length !== 40) {
      setErro("O código tem 40 caracteres. Confira se copiou inteiro.");
      setResultado(null);
      setNaoAchou(false);
      return;
    }
    setBuscando(true);
    setErro(null);
    setNaoAchou(false);
    setResultado(null);
    try {
      const { data, error } = await (supabase as any).rpc("verificar_ficha", { p_codigo: limpo });
      if (error) throw error;
      const linha = Array.isArray(data) ? data[0] : data;
      if (linha) setResultado(linha as Resultado);
      else setNaoAchou(true);
    } catch (e: any) {
      setErro(e?.message || "Não foi possível consultar agora. Tente de novo em instantes.");
    } finally {
      setBuscando(false);
    }
  };

  // Código na URL confere sozinho: é o caso de quem chegou por link ou QR.
  useEffect(() => {
    const limpo = limpar(codigoDaUrl || "");
    if (limpo.length === 40) void verificar(limpo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoDaUrl]);

  return (
    <div className="min-h-screen bg-muted/30 p-4 flex justify-center">
      <div className="w-full max-w-lg space-y-4 py-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-10 w-10 text-primary shrink-0" />
          <div>
            <h1 className="text-xl font-bold">Verificação de Ficha de EPI</h1>
            <p className="text-xs text-muted-foreground">SafetySoluções — conferência de entrega assinada</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 space-y-3">
            <label htmlFor="codigo" className="text-sm font-medium">
              Código impresso embaixo da assinatura
            </label>
            <div className="flex gap-2">
              <Input
                id="codigo"
                value={codigo}
                onChange={(e) => setCodigo(limpar(e.target.value))}
                onKeyDown={(e) => { if (e.key === "Enter") void verificar(codigo); }}
                placeholder="fa7f39bb97c459cd63e78345e116191e75f60b8a"
                className="font-mono text-xs"
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
              />
              <Button onClick={() => { navigate(`/verificar/${codigo}`); void verificar(codigo); }} disabled={buscando}>
                {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="ml-2 hidden sm:inline">Verificar</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {codigo.length}/40 caracteres. Espaços e maiúsculas não atrapalham.
            </p>
            {erro && <p className="text-xs text-destructive">{erro}</p>}
          </CardContent>
        </Card>

        {naoAchou && (
          <Card className="border-destructive">
            <CardContent className="p-6 text-center space-y-2">
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <h2 className="text-lg font-bold">Nenhum registro com esse código</h2>
              <p className="text-sm text-muted-foreground">
                Confira se o código foi copiado inteiro e sem trocar caractere. Se estiver
                certo, a ficha não foi emitida por este sistema.
              </p>
            </CardContent>
          </Card>
        )}

        {resultado && (
          <Card className="border-primary">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-10 w-10 text-primary shrink-0" />
                <div>
                  <h2 className="text-lg font-bold">Registro encontrado</h2>
                  <p className="text-xs text-muted-foreground">
                    A assinatura impressa corresponde a esta entrega.
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Empresa</dt>
                  <dd className="font-medium">{resultado.empresa || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Trabalhador</dt>
                  <dd className="font-medium">{resultado.funcionario || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Função</dt>
                  <dd className="font-medium">{resultado.cargo?.trim() || "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Equipamento</dt>
                  <dd className="font-medium">{resultado.epi || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">CA</dt>
                  <dd className="font-medium">{resultado.ca || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Quantidade</dt>
                  <dd className="font-medium">{resultado.quantidade ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Movimento</dt>
                  <dd className="font-medium">
                    {ROTULO_TIPO[resultado.tipo || ""] || resultado.tipo || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Data da entrega</dt>
                  <dd className="font-medium">{dataBr(resultado.data_entrega)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Assinatura registrada em</dt>
                  <dd className="font-medium">{dataHoraBr(resultado.assinado_em)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        )}

        {/*
          * O limite fica escrito na própria página, e não só na documentação:
          * quem consulta precisa saber o que este "confere" quer dizer, para
          * não tomar a conferência por assinatura qualificada.
          */}
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          O nome do trabalhador aparece abreviado e nenhum dado pessoal além dos exibidos
          acima é divulgado. Esta conferência mostra que a entrega existe no sistema com a
          assinatura registrada, conforme a MP 2.200-2/01, Art. 10º, §2. Não é assinatura
          qualificada ICP-Brasil e não substitui o validador oficial do ITI.
        </p>
      </div>
    </div>
  );
}
