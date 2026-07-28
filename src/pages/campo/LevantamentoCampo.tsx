import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Camera, Check, ClipboardCheck, Clock, Loader2, Minus, Paperclip,
  Plus, RefreshCw, Save, TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useNucleoMestreSst } from "@/hooks/useNucleoMestreSst";
import { ContextoSst, PgrContextoSelector } from "@/components/pgr/PgrContextoSelector";
import { STATUS_COLETA_COR, STATUS_COLETA_LABEL, StatusColetaCampo } from "@/types/sst";
import { GRUPO_LABEL } from "@/lib/pgrMatriz";
import {
  SST_BUCKET, SUPABASE_STORAGE_REF_PREFIX, sanitizeStorageFileName,
} from "@/lib/secureStorage";

const CATEGORIAS = [
  { id: "fisico", rotulo: "Físico" },
  { id: "quimico", rotulo: "Químico" },
  { id: "biologico", rotulo: "Biológico" },
  { id: "ergonomico", rotulo: "Ergonômico" },
  { id: "acidente", rotulo: "Acidente" },
  { id: "psicossocial", rotulo: "Psicossocial" },
];

const vazio = {
  categoria: "",
  perigo_observado: "",
  fonte_circunstancia: "",
  situacao_encontrada: "",
  possiveis_lesoes: "",
  exposicao: "diaria",
  qtd_expostos: 1,
  medidas_existentes: "",
  observacoes: "",
};

/**
 * Modo 3 — Levantamento em campo.
 *
 * Uma coluna, alvos de toque grandes, sem tabela. A avaliação de risco NÃO é
 * feita aqui: quem está na obra registra o que viu, e a classificação
 * severidade × probabilidade é decidida no desktop, com o inventário à vista.
 * Pedir a matriz no celular gera avaliação apressada em documento legal.
 *
 * Nada do que é coletado entra no PGR direto — a coleta nasce 'rascunho' e só
 * vira item do inventário depois da revisão técnica.
 */
export default function LevantamentoCampo() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const pgrId = params.get("pgr");
  const { activeEmpresaId, isLoading: carregandoEstrutura } = useNucleoMestreSst();
  const inputFoto = useRef<HTMLInputElement>(null);

  const [aba, setAba] = useState<"contexto" | "perigos" | "pendencias">("contexto");
  const [ctx, setCtx] = useState<ContextoSst>({});
  const [f, setF] = useState<any>(vazio);
  const [anexos, setAnexos] = useState<{ nome: string; url: string }[]>([]);
  const [enviando, setEnviando] = useState(false);

  const { data: coletas = [] } = useQuery({
    queryKey: ["coletas-campo", activeEmpresaId, pgrId],
    enabled: !!activeEmpresaId,
    queryFn: async () => {
      let q = (supabase.from as any)("sst_coletas_campo")
        .select("*").eq("empresa_id", activeEmpresaId);
      if (pgrId) q = q.eq("pgr_id", pgrId);
      const { data } = await q.order("coletado_em", { ascending: false }).limit(100);
      return (data || []) as any[];
    },
  });

  const pendentes = coletas.filter((c) => c.status !== "validado" && c.status !== "descartado");

  const salvar = useMutation({
    mutationFn: async (status: StatusColetaCampo) => {
      if (!activeEmpresaId) throw new Error("Nenhuma empresa ativa.");
      if (!f.perigo_observado.trim()) throw new Error("Informe o perigo observado.");

      // Coordenadas são melhor-esforço: em galpão ou subsolo o GPS falha, e isso
      // não pode impedir o registro do perigo.
      const coords = await new Promise<{ lat: number | null; lon: number | null }>((ok) => {
        if (!navigator.geolocation) return ok({ lat: null, lon: null });
        navigator.geolocation.getCurrentPosition(
          (p) => ok({ lat: p.coords.latitude, lon: p.coords.longitude }),
          () => ok({ lat: null, lon: null }),
          { timeout: 4000 },
        );
      });

      const payload = {
        empresa_id: activeEmpresaId,
        pgr_id: pgrId || null,
        ambiente_id: ctx.ambiente_id || null,
        processo_id: ctx.processo_id || null,
        setor_id: ctx.setor_id || null,
        ges_id: ctx.ges_id || null,
        funcao_id: ctx.funcao_id || null,
        atividade_id: ctx.atividade_id || null,
        categoria: f.categoria || null,
        perigo_observado: f.perigo_observado.trim(),
        fonte_circunstancia: f.fonte_circunstancia.trim() || null,
        situacao_encontrada: f.situacao_encontrada.trim() || null,
        possiveis_lesoes: f.possiveis_lesoes.trim() || null,
        exposicao: f.exposicao || null,
        qtd_expostos: Number(f.qtd_expostos) || null,
        medidas_existentes: f.medidas_existentes.trim() || null,
        observacoes: f.observacoes.trim() || null,
        coletado_por: user?.id || null,
        coletado_por_nome: (user as any)?.email || null,
        latitude: coords.lat,
        longitude: coords.lon,
        status,
      };

      const { data, error } = await (supabase.from as any)("sst_coletas_campo")
        .insert(payload).select("id").single();
      if (error) throw error;

      if (anexos.length > 0 && data?.id) {
        await (supabase.from as any)("sst_coleta_evidencias").insert(
          anexos.map((a) => ({
            empresa_id: activeEmpresaId,
            coleta_id: data.id,
            tipo: "foto",
            url: a.url,
            nome_arquivo: a.nome,
          })),
        );
      }
    },
    onSuccess: (_d, status) => {
      toast.success(status === "rascunho" ? "Salvo como rascunho" : "Coleta enviada para revisão");
      qc.invalidateQueries({ queryKey: ["coletas-campo"] });
      setF(vazio);
      setAnexos([]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  /**
   * Sobe a foto para o bucket privado e guarda a referência sb://, não a imagem.
   * Mesmo bucket e mesmo formato de referência dos demais documentos de SST —
   * a foto de uma coleta é evidência e segue a mesma política de acesso.
   */
  const anexarFoto = async (arquivo: File) => {
    if (!activeEmpresaId) return;
    setEnviando(true);
    try {
      const nomeSeguro = sanitizeStorageFileName(arquivo.name);
      const caminho = `${activeEmpresaId}/coletas-campo/${crypto.randomUUID()}-${nomeSeguro}`;
      const { error } = await supabase.storage.from(SST_BUCKET).upload(caminho, arquivo);
      if (error) throw error;
      setAnexos((a) => [
        ...a,
        { nome: arquivo.name, url: `${SUPABASE_STORAGE_REF_PREFIX}${SST_BUCKET}/${caminho}` },
      ]);
      toast.success("Foto anexada");
    } catch (e: any) {
      toast.error(e.message || "Falha ao anexar a foto");
    } finally {
      setEnviando(false);
    }
  };

  // Abas no topo, não em barra inferior fixa: o AppLayout já ocupa o rodapé com
  // a navegação principal no celular, e duas barras fixas se sobrepõem.
  const Aba = ({ id, rotulo, icone: Icone, alerta }: any) => (
    <button
      onClick={() => setAba(id)}
      className={`flex-1 flex items-center justify-center gap-1.5 py-3 border-b-2 transition ${
        aba === id ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground"
      }`}
    >
      <Icone className="h-4 w-4 shrink-0" />
      <span className="text-sm">{rotulo}</span>
      {alerta > 0 && (
        <span className="bg-amber-500 text-white text-[10px] rounded-full h-4 min-w-4 px-1 grid place-items-center">
          {alerta}
        </span>
      )}
    </button>
  );

  return (
    <div className="pgr-module min-h-screen bg-muted/30 pb-8">
      <header className="sticky top-0 z-20 bg-background border-b px-4 pt-3 pb-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(pgrId ? `/pgr/${pgrId}` : "/pgr")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold leading-tight truncate">Levantamento em campo</h1>
            <p className="text-xs text-muted-foreground">
              {pendentes.length} coleta(s) aguardando revisão
            </p>
          </div>
          <Button variant="outline" size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["coletas-campo"] })}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex mt-2 -mb-3">
          <Aba id="contexto" rotulo="Contexto" icone={ClipboardCheck} alerta={0} />
          <Aba id="perigos" rotulo="Perigos" icone={TriangleAlert} alerta={0} />
          <Aba id="pendencias" rotulo="Pendências" icone={Check} alerta={pendentes.length} />
        </nav>
      </header>

      <main className="p-4 space-y-4 max-w-2xl mx-auto">
        {aba === "contexto" && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <h2 className="font-semibold">Onde você está</h2>
                <p className="text-sm text-muted-foreground">
                  Selecione o que já estiver cadastrado. O que faltar pode ser ajustado na revisão.
                </p>
              </div>
              {carregandoEstrutura ? (
                <div className="py-6 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando estrutura…
                </div>
              ) : (
                <PgrContextoSelector valor={ctx} onChange={setCtx} />
              )}
              <Button className="w-full h-12" onClick={() => setAba("perigos")}>
                Continuar para os perigos
              </Button>
            </CardContent>
          </Card>
        )}

        {aba === "perigos" && (
          <>
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <h2 className="font-semibold">Identificar perigo</h2>
                  <p className="text-sm text-muted-foreground">
                    Selecione a categoria do perigo observado
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CATEGORIAS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setF({ ...f, categoria: c.id })}
                      className={`rounded-lg border-2 py-4 px-2 text-sm font-medium transition ${
                        f.categoria === c.id
                          ? "border-amber-400 bg-amber-50 text-amber-800"
                          : "border-border hover:border-muted-foreground/40"
                      }`}
                    >
                      {c.rotulo}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Perigo observado *</Label>
                  <Input className="h-12" value={f.perigo_observado}
                    onChange={(e) => setF({ ...f, perigo_observado: e.target.value })}
                    placeholder="Ex.: Queda de altura" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Fonte ou circunstância</Label>
                  <Input className="h-12" value={f.fonte_circunstancia}
                    onChange={(e) => setF({ ...f, fonte_circunstancia: e.target.value })}
                    placeholder="Ex.: Trabalho em andaime" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Possíveis lesões ou agravos</Label>
                  <Input className="h-12" value={f.possiveis_lesoes}
                    onChange={(e) => setF({ ...f, possiveis_lesoes: e.target.value })}
                    placeholder="Ex.: Fraturas, trauma grave" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Exposição</Label>
                    <Select value={f.exposicao} onValueChange={(v) => setF({ ...f, exposicao: v })}>
                      <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="diaria">Diária</SelectItem>
                        <SelectItem value="intermitente">Intermitente</SelectItem>
                        <SelectItem value="eventual">Eventual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Quantidade exposta</Label>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="icon" className="h-12 w-12 shrink-0"
                        onClick={() => setF({ ...f, qtd_expostos: Math.max(0, Number(f.qtd_expostos) - 1) })}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input type="number" min={0} className="h-12 text-center"
                        value={f.qtd_expostos}
                        onChange={(e) => setF({ ...f, qtd_expostos: e.target.value })} />
                      <Button type="button" variant="outline" size="icon" className="h-12 w-12 shrink-0"
                        onClick={() => setF({ ...f, qtd_expostos: Number(f.qtd_expostos) + 1 })}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Evidências</Label>
                  <input ref={inputFoto} type="file" accept="image/*" capture="environment"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && anexarFoto(e.target.files[0])} />
                  <div className="grid grid-cols-2 gap-3">
                    <Button type="button" variant="outline"
                      className="h-20 flex-col gap-1 border-dashed"
                      disabled={enviando} onClick={() => inputFoto.current?.click()}>
                      {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                      <span className="text-xs">Tirar foto</span>
                    </Button>
                    <Button type="button" variant="outline"
                      className="h-20 flex-col gap-1 border-dashed"
                      disabled={enviando} onClick={() => inputFoto.current?.click()}>
                      <Paperclip className="h-5 w-5" />
                      <span className="text-xs">Anexar</span>
                    </Button>
                  </div>
                  {anexos.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {anexos.length} arquivo(s) anexado(s).
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Medidas existentes</Label>
                  <Textarea rows={3} value={f.medidas_existentes}
                    onChange={(e) => setF({ ...f, medidas_existentes: e.target.value })}
                    placeholder="O que já existe hoje para controlar este perigo" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Observações</Label>
                  <Textarea rows={2} value={f.observacoes}
                    onChange={(e) => setF({ ...f, observacoes: e.target.value })} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-sky-200 bg-sky-50">
              <CardContent className="p-3 text-sm text-sky-900">
                A avaliação dos riscos e a matriz de risco são feitas depois, no desktop.
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button variant="outline" className="h-14"
                disabled={salvar.isPending} onClick={() => salvar.mutate("rascunho")}>
                <Clock className="h-4 w-4 mr-2" /> Avaliar depois
              </Button>
              <Button className="h-14"
                disabled={salvar.isPending} onClick={() => salvar.mutate("aguardando_revisao")}>
                {salvar.isPending
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : <Save className="h-4 w-4 mr-2" />}
                Salvar e adicionar outro
              </Button>
            </div>
          </>
        )}

        {aba === "pendencias" && (
          <div className="space-y-3">
            <h2 className="font-semibold">Coletas registradas</h2>
            {coletas.length === 0 ? (
              <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma coleta ainda.
              </CardContent></Card>
            ) : coletas.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm min-w-0">{c.perigo_observado}</p>
                    <Badge variant="outline"
                      className={`${STATUS_COLETA_COR[c.status as StatusColetaCampo]} shrink-0 text-[10px]`}>
                      {STATUS_COLETA_LABEL[c.status as StatusColetaCampo]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {c.fonte_circunstancia || "Sem fonte informada"}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{new Date(c.coletado_em).toLocaleString("pt-BR")}</span>
                    {c.categoria && <span>· {GRUPO_LABEL[c.categoria] || c.categoria}</span>}
                    {c.qtd_expostos != null && <span>· {c.qtd_expostos} exposto(s)</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
