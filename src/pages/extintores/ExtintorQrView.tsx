import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Flame,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowLeft,
  ClipboardCheck,
  Calendar,
  User,
  MapPin,
  ChevronDown,
  ChevronUp,
  LogIn,
  Eye,
  X,
  Wrench,
  Award,
} from "lucide-react";
import { fmtDate } from "@/lib/pdfTimbrado";
import { ExtintorInspecaoDialog } from "./ExtintorInspecaoDialog";
import { carregarExtintorPorTokenLocal, carregarInspecoesLocais } from "@/lib/extintoresStorageFallback";
import { useAuth } from "@/contexts/AuthContext";

interface ItemChecklistInfo {
  chave: string;
  label: string;
}

const CHECKLIST_ITENS: ItemChecklistInfo[] = [
  { chave: "acesso_desobstruido", label: "Acesso desobstruído" },
  { chave: "sinalizacao_conforme", label: "Sinalização de emergência" },
  { chave: "quadro_demarcacao_piso_ok", label: "Demarcação de piso (1m x 1m)" },
  { chave: "altura_instalacao_conforme", label: "Altura de instalação conforme norma" },
  { chave: "lacre_intacto", label: "Lacre de segurança intacto" },
  { chave: "pino_seguranca_presente", label: "Pino de segurança presente" },
  { chave: "manometro_pressao_adequada", label: "Manômetro na faixa verde (pressão)" },
  { chave: "manga_bico_sem_obstrucao", label: "Mangueira e difusor íntegros" },
  { chave: "cilindro_sem_corrosao_ou_dano", label: "Cilindro sem corrosão ou amassados" },
  { chave: "rotulo_instrucoes_legivel", label: "Rótulo de instruções legível" },
  { chave: "selo_inmetro_presente", label: "Selo Inmetro presente e válido" },
];

export default function ExtintorQrView() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [extintor, setExtintor] = useState<any | null>(null);
  const [empresaNome, setEmpresaNome] = useState<string>("Empresa");
  const [inspecoes, setInspecoes] = useState<any[]>([]);
  const [manutencoes, setManutencoes] = useState<any[]>([]);
  const [inspecaoOpen, setInspecaoOpen] = useState(false);
  const [itensExpandidos, setItensExpandidos] = useState<Record<string, boolean>>({});
  const [fotoModal, setFotoModal] = useState<string | null>(null);

  const carregarDados = async () => {
    if (!qrToken) return;
    setLoading(true);

    try {
      // 1. Tenta buscar via RPC pública segura
      const { data, error } = await (supabase.rpc as any)("extintor_consultar_qr", {
        p_token: qrToken,
      });

      if (!error && data && data.encontrado) {
        setExtintor(data.extintor);
        setEmpresaNome(data.empresa_nome || "Empresa");
        setInspecoes(data.inspecoes || []);
        setManutencoes(data.manutencoes || []);
        if (data.inspecoes?.length > 0) {
          // Mantém a primeira inspeção (mais recente) aberta por padrão
          setItensExpandidos({ [data.inspecoes[0].id]: true });
        }
        setLoading(false);
        return;
      }

      // 2. Fallback de consulta direta ao Supabase
      const { data: extData, error: extErr } = await (supabase.from as any)("extintores")
        .select("*, empresa_config(nome)")
        .or(`qr_token.eq.${qrToken},id.eq.${qrToken}`)
        .maybeSingle();

      if (!extErr && extData) {
        setExtintor(extData);
        setEmpresaNome(extData.empresa_config?.nome || "Empresa");

        // Busca inspeções
        const { data: inspData } = await (supabase.from as any)("extintor_inspecoes")
          .select("*")
          .eq("extintor_id", extData.id)
          .order("data_inspecao", { ascending: false });

        setInspecoes(inspData || []);
        if (inspData && inspData.length > 0) {
          setItensExpandidos({ [inspData[0].id]: true });
        }

        // Busca manutenções
        const { data: manData } = await (supabase.from as any)("extintor_manutencoes")
          .select("*")
          .eq("extintor_id", extData.id)
          .order("data_manutencao", { ascending: false });

        setManutencoes(manData || []);
        setLoading(false);
        return;
      }

      // 3. Fallback LocalStorage (contingência offline)
      const localExt = carregarExtintorPorTokenLocal(qrToken);
      if (localExt) {
        setExtintor(localExt);
        setEmpresaNome("Registro Local (Dispositivo)");
        const localInsps = carregarInspecoesLocais(localExt.empresa_id);
        const inspsDoExt = localInsps.filter((i) => i.extintor_id === localExt.id);
        setInspecoes(inspsDoExt);
        if (inspsDoExt.length > 0) {
          setItensExpandidos({ [inspsDoExt[0].id]: true });
        }
      }
    } catch {
      const localExt = carregarExtintorPorTokenLocal(qrToken);
      if (localExt) {
        setExtintor(localExt);
        setEmpresaNome("Registro Local (Dispositivo)");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [qrToken]);

  const toggleExpandir = (id: string) => {
    setItensExpandidos((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="text-center space-y-3">
          <Flame className="h-10 w-10 text-orange-600 animate-bounce mx-auto" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Consultando Selo Digital do Extintor...
          </p>
          <p className="text-xs text-muted-foreground">Autenticando via NR-23 / NBR 12962</p>
        </div>
      </div>
    );
  }

  if (!extintor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <Card className="max-w-md w-full text-center p-6 space-y-4 shadow-lg border-red-200">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
          <h2 className="text-xl font-bold">Extintor não localizado</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            O código QR escaneado não corresponde a um extintor cadastrado ou o registro não foi
            encontrado no banco de dados da SafetySoluções.
          </p>
          {user ? (
            <Button onClick={() => navigate("/extintores")} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" /> Ir para o Painel de Extintores
            </Button>
          ) : (
            <Button onClick={() => navigate("/login")} variant="outline" className="w-full">
              <LogIn className="h-4 w-4 mr-2" /> Fazer Login no Sistema
            </Button>
          )}
        </Card>
      </div>
    );
  }

  // Cálculos de Status e Prazos
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let diasParaRecarga: number | null = null;
  if (extintor.data_proxima_recarga) {
    const dt = new Date(extintor.data_proxima_recarga + "T00:00:00");
    diasParaRecarga = Math.round((dt.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  }

  let diasParaTesteH: number | null = null;
  if (extintor.data_proximo_teste_hidrostatico) {
    const dt = new Date(extintor.data_proximo_teste_hidrostatico + "T00:00:00");
    diasParaTesteH = Math.round((dt.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  }

  const recargaVencida = diasParaRecarga !== null && diasParaRecarga < 0;
  const testeHVencido = diasParaTesteH !== null && diasParaTesteH < 0;

  // Última inspeção
  const ultimaInspecao = inspecoes[0] || null;
  const ultimaInspecaoIrregular = ultimaInspecao && ultimaInspecao.resultado === "NAO_CONFORME";

  // Verificação de inspeção do mês corrente
  const mesAtualStr = hoje.toISOString().slice(0, 7); // "YYYY-MM"
  const inspecionadoNoMesAtual = inspecoes.some(
    (i) => i.data_inspecao && i.data_inspecao.slice(0, 7) === mesAtualStr
  );

  // Status Geral para Fiscalização
  let statusGeral: "REGULAR" | "ATENCAO" | "CRITICO" = "REGULAR";
  let statusGeralTitulo = "REGULAR · EM CONFORMIDADE";
  let statusGeralDescricao = "Equipamento em dia, apto para uso operacional conforme NR-23 e NBR 12962.";

  if (recargaVencida || testeHVencido || ultimaInspecaoIrregular) {
    statusGeral = "CRITICO";
    statusGeralTitulo = "IRREGULAR / NÃO CONFORME";
    if (recargaVencida) {
      statusGeralDescricao = `Recarga vencida há ${Math.abs(diasParaRecarga!)} dia(s). Equipamento requer recarga imediata.`;
    } else if (testeHVencido) {
      statusGeralDescricao = `Teste hidrostático vencido há ${Math.abs(diasParaTesteH!)} dia(s). Requer ensaio hidrostático.`;
    } else {
      statusGeralDescricao = "Última inspeção mensal detectou não conformidade em itens do checklist.";
    }
  } else if (!inspecionadoNoMesAtual || (diasParaRecarga !== null && diasParaRecarga <= 30)) {
    statusGeral = "ATENCAO";
    statusGeralTitulo = "ATENÇÃO · PENDÊNCIA PRÓXIMA";
    if (!inspecionadoNoMesAtual) {
      statusGeralDescricao = "Inspeção mensal do mês corrente ainda pendente de registro.";
    } else {
      statusGeralDescricao = `Recarga próxima de vencer em ${diasParaRecarga} dia(s).`;
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-12">
      {/* Barra Superior Institucional */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-30">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-orange-600 flex items-center justify-center font-bold text-white shadow">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-semibold tracking-wider text-orange-400 uppercase">
                SafetySoluções
              </span>
              <p className="text-xs text-slate-300">Selo Digital · NR-23 / NBR 12962</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/extintores")}
                className="text-xs text-slate-300 hover:text-white hover:bg-slate-800 h-8 px-2"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Painel
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/login")}
                className="text-xs text-orange-400 hover:text-orange-300 hover:bg-slate-800 h-8 px-2"
              >
                <LogIn className="h-3.5 w-3.5 mr-1" /> Login
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-3.5 pt-4 space-y-4">
        {/* Identificação da Empresa e Extintor */}
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  {empresaNome}
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xs font-bold text-orange-400 uppercase">TAG</span>
                  <h1 className="text-3xl font-black tracking-tight text-white">{extintor.numero}</h1>
                </div>
              </div>

              {/* Badges de Agente */}
              <div className="text-right">
                <Badge className="bg-orange-600 hover:bg-orange-600 text-white font-bold text-sm px-2.5 py-1">
                  {extintor.agente?.replace(/_/g, " ")}
                </Badge>
                <p className="text-xs font-semibold text-slate-300 mt-1">
                  Capacidade: {extintor.capacidade} {extintor.unidade_capacidade}
                </p>
              </div>
            </div>

            {/* Localização */}
            <div className="mt-3 pt-3 border-t border-slate-700/80 flex items-start gap-2 text-xs text-slate-200">
              <MapPin className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">{extintor.local_setor || "Geral"}</span>
                {extintor.local_descricao && (
                  <span className="text-slate-300"> — {extintor.local_descricao}</span>
                )}
              </div>
            </div>
          </div>

          <CardContent className="p-4 space-y-3.5 text-xs">
            {/* Grid de Dados Técnicos */}
            <div className="grid grid-cols-2 gap-2.5 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200/80 dark:border-slate-800">
              <div>
                <span className="text-[11px] text-muted-foreground block">Fabricante:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {extintor.fabricante || "Não informado"}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Ano de Fabricação:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {extintor.ano_fabricacao || "—"}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Selo Inmetro:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {extintor.selo_inmetro || "Selo afixado"}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Classes de Fogo:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  Classe {extintor.classes || "ABC"}
                </span>
              </div>
            </div>

            {/* Vencimentos e Prazos Normativos */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between p-2 rounded-md bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <span className="font-medium text-slate-600 dark:text-slate-400">
                  Validade da Carga / Recarga:
                </span>
                <span
                  className={`font-black ${
                    recargaVencida ? "text-red-600" : "text-slate-900 dark:text-slate-100"
                  }`}
                >
                  {fmtDate(extintor.data_proxima_recarga)}
                  {diasParaRecarga !== null && (
                    <span className="text-[11px] font-normal text-muted-foreground ml-1.5">
                      ({recargaVencida ? `vencido há ${Math.abs(diasParaRecarga)}d` : `em ${diasParaRecarga}d`})
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-md bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <span className="font-medium text-slate-600 dark:text-slate-400">
                  Próximo Teste Hidrostático:
                </span>
                <span
                  className={`font-black ${
                    testeHVencido ? "text-red-600" : "text-slate-900 dark:text-slate-100"
                  }`}
                >
                  {fmtDate(extintor.data_proximo_teste_hidrostatico)}
                  {diasParaTesteH !== null && (
                    <span className="text-[11px] font-normal text-muted-foreground ml-1.5">
                      ({testeHVencido ? `vencido` : `em ${diasParaTesteH}d`})
                    </span>
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Parecer Geral para Fiscalização e Auditoria */}
        <div
          className={`p-4 rounded-xl border shadow-sm ${
            statusGeral === "REGULAR"
              ? "bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800"
              : statusGeral === "ATENCAO"
              ? "bg-amber-50 border-amber-300 dark:bg-amber-950/40 dark:border-amber-800"
              : "bg-red-50 border-red-300 dark:bg-red-950/40 dark:border-red-800"
          }`}
        >
          <div className="flex items-start gap-3">
            {statusGeral === "REGULAR" ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : statusGeral === "ATENCAO" ? (
              <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-6 w-6 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            )}

            <div className="space-y-1">
              <h2
                className={`text-sm font-black ${
                  statusGeral === "REGULAR"
                    ? "text-emerald-900 dark:text-emerald-200"
                    : statusGeral === "ATENCAO"
                    ? "text-amber-900 dark:text-amber-200"
                    : "text-red-900 dark:text-red-200"
                }`}
              >
                {statusGeralTitulo}
              </h2>
              <p
                className={`text-xs ${
                  statusGeral === "REGULAR"
                    ? "text-emerald-800 dark:text-emerald-300"
                    : statusGeral === "ATENCAO"
                    ? "text-amber-800 dark:text-amber-300"
                    : "text-red-800 dark:text-red-300"
                }`}
              >
                {statusGeralDescricao}
              </p>
            </div>
          </div>
        </div>

        {/* Botão de Ação: Realizar Inspeção Mensal */}
        <div className="space-y-2">
          {user ? (
            <Button
              size="lg"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 shadow-sm text-sm"
              onClick={() => setInspecaoOpen(true)}
            >
              <ClipboardCheck className="h-5 w-5 mr-2" />
              Realizar Nova Inspeção Mensal Agora
            </Button>
          ) : (
            <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">É inspetor ou brigadista da empresa?</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/login?redirect=/extintores/qr/${qrToken}`)}
                className="h-8 text-xs font-semibold"
              >
                <LogIn className="h-3.5 w-3.5 mr-1 text-primary" /> Fazer Login para Inspecionar
              </Button>
            </div>
          )}
        </div>

        {/* Histórico Completo de Inspeções Mensais (Registro Digital) */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-orange-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Histórico de Inspeções Mensais
              </h2>
            </div>
            <Badge variant="outline" className="text-xs font-semibold">
              {inspecoes.length} {inspecoes.length === 1 ? "inspeção" : "inspeções"}
            </Badge>
          </div>

          <p className="text-[11px] text-muted-foreground leading-normal">
            Registro digital oficial com fé pública (NR-23 e ABNT NBR 12962). Substitui a etiqueta
            física de papel fixada no cilindro.
          </p>

          {inspecoes.length === 0 ? (
            <Card className="p-6 text-center border-dashed border-2 bg-white/50 dark:bg-slate-900/50">
              <Calendar className="h-10 w-10 text-muted-foreground/60 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Nenhuma inspeção mensal registrada ainda
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 max-w-xs mx-auto">
                Assim que a primeira inspeção for realizada pelo técnico ou brigadista, todo o
                checklist e histórico ficarão salvos e visíveis neste QR Code.
              </p>
              {user && (
                <Button
                  size="sm"
                  onClick={() => setInspecaoOpen(true)}
                  className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                >
                  <ClipboardCheck className="h-4 w-4 mr-1.5" /> Iniciar Primeira Inspeção
                </Button>
              )}
            </Card>
          ) : (
            <div className="space-y-3">
              {inspecoes.map((insp, index) => {
                const aberta = !!itensExpandidos[insp.id];
                const conforme = insp.resultado === "CONFORME";

                return (
                  <Card
                    key={insp.id || index}
                    className={`border overflow-hidden bg-white dark:bg-slate-900 shadow-sm transition-all ${
                      conforme
                        ? "border-emerald-200 dark:border-emerald-900/60"
                        : "border-red-300 dark:border-red-900/80"
                    }`}
                  >
                    {/* Cabeçalho do Card da Inspeção */}
                    <button
                      type="button"
                      onClick={() => toggleExpandir(insp.id)}
                      className={`w-full text-left p-3.5 flex items-center justify-between gap-2 transition-colors ${
                        conforme
                          ? "hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
                          : "hover:bg-red-50/50 dark:hover:bg-red-950/20"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {conforme ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-bold text-[11px] px-2 py-0.5">
                              ✓ REGULAR
                            </Badge>
                          ) : (
                            <Badge className="bg-red-600 hover:bg-red-600 text-white font-bold text-[11px] px-2 py-0.5">
                              ✕ IRREGULAR
                            </Badge>
                          )}
                          <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                            {fmtDate(insp.data_inspecao)}
                          </span>
                          {index === 0 && (
                            <span className="text-[10px] uppercase font-bold bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 px-1.5 py-0.5 rounded">
                              Mais recente
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <User className="h-3 w-3 shrink-0" />
                          <span>Inspetor: {insp.inspetor_nome || "Técnico SST"}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-muted-foreground">
                        <span className="text-[11px] font-medium hidden sm:inline">
                          {aberta ? "Ocultar checklist" : "Ver checklist"}
                        </span>
                        {aberta ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </button>

                    {/* Detalhamento do Checklist Expandido */}
                    {aberta && (
                      <div className="border-t border-slate-100 dark:border-slate-800 p-3.5 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Checklist de Conformidade (NBR 12962):
                        </h4>

                        <div className="grid grid-cols-1 gap-1.5">
                          {CHECKLIST_ITENS.map((item) => {
                            const valor = insp[item.chave];
                            // Se for manômetro e agente CO2, pode ser null/NA
                            const isNa =
                              valor === null &&
                              item.chave === "manometro_pressao_adequada" &&
                              extintor.agente === "CO2";
                            const isOk = valor === true;

                            return (
                              <div
                                key={item.chave}
                                className={`flex items-center justify-between p-2 rounded text-xs border ${
                                  isNa
                                    ? "bg-slate-100/70 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700"
                                    : isOk
                                    ? "bg-emerald-50/60 border-emerald-100 text-emerald-950 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-200"
                                    : "bg-red-50 border-red-200 text-red-950 dark:bg-red-950/30 dark:border-red-900 dark:text-red-200 font-semibold"
                                }`}
                              >
                                <span className="pr-2">{item.label}</span>
                                {isNa ? (
                                  <span className="text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                    N/A (CO2)
                                  </span>
                                ) : isOk ? (
                                  <span className="flex items-center text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                                    <CheckCircle2 className="h-4 w-4 mr-1" /> Sim
                                  </span>
                                ) : (
                                  <span className="flex items-center text-red-600 dark:text-red-400 font-bold shrink-0">
                                    <XCircle className="h-4 w-4 mr-1" /> Não
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Foto de Evidência da Inspeção */}
                        {insp.foto_url && (
                          <div className="space-y-1.5 pt-2">
                            <span className="text-[11px] font-bold text-muted-foreground block">
                              Evidência Fotográfica:
                            </span>
                            <div className="relative inline-block group">
                              <img
                                src={insp.foto_url}
                                alt="Evidência da Inspeção"
                                className="h-24 w-32 object-cover rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer shadow-sm hover:opacity-90"
                                onClick={() => setFotoModal(insp.foto_url)}
                              />
                              <Button
                                size="sm"
                                variant="secondary"
                                className="absolute bottom-1 right-1 h-6 px-1.5 text-[10px] font-bold bg-black/70 text-white hover:bg-black"
                                onClick={() => setFotoModal(insp.foto_url)}
                              >
                                <Eye className="h-3 w-3 mr-1" /> Ampliar
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Observações da Inspeção */}
                        {insp.observacoes && (
                          <div className="p-2.5 rounded bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200">
                            <span className="font-bold block text-[11px] uppercase tracking-wide">
                              Observações do Inspetor:
                            </span>
                            <p className="mt-0.5 whitespace-pre-wrap">{insp.observacoes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Histórico de Manutenções e Recargas */}
        {manutencoes.length > 0 && (
          <div className="space-y-3 pt-3">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-orange-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Histórico de Manutenções & Recargas
              </h2>
            </div>

            <div className="space-y-2">
              {manutencoes.map((man, i) => (
                <Card
                  key={man.id || i}
                  className="p-3 text-xs space-y-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="font-bold">
                      {man.tipo?.replace(/_/g, " ")}
                    </Badge>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {fmtDate(man.data_manutencao)}
                    </span>
                  </div>
                  {man.empresa_prestadora && (
                    <p className="text-muted-foreground">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Prestador:</span>{" "}
                      {man.empresa_prestadora}
                    </p>
                  )}
                  {man.selo_inmetro && (
                    <p className="text-muted-foreground">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Novo Selo Inmetro:</span>{" "}
                      {man.selo_inmetro}
                    </p>
                  )}
                  {man.numero_os && (
                    <p className="text-muted-foreground">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Ordem de Serviço:</span>{" "}
                      {man.numero_os}
                    </p>
                  )}
                  {man.observacoes && (
                    <p className="text-slate-600 dark:text-slate-400 italic text-[11px] pt-1">
                      "{man.observacoes}"
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Rodapé Legal e Auditoria */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-center space-y-2">
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground font-semibold">
            <Award className="h-4 w-4 text-orange-600" />
            Certificação Digital de Inspeção SafetySoluções
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed max-w-sm mx-auto">
            Este registro digital atende aos padrões de rastreabilidade da NR-23 e ABNT NBR 12962,
            dispensando fichas manuais de papel e garantindo integridade das informações para auditorias e Corpo de Bombeiros.
          </p>
          <p className="text-[10px] text-slate-400">
            Consulta gerada em {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR")}
          </p>
        </div>
      </main>

      {/* Modal de Foto Ampliada */}
      {fotoModal && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setFotoModal(null)}
        >
          <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <Button
              size="icon"
              variant="secondary"
              className="absolute top-2 right-2 rounded-full h-8 w-8 bg-black/60 text-white hover:bg-black"
              onClick={() => setFotoModal(null)}
            >
              <X className="h-5 w-5" />
            </Button>
            <img
              src={fotoModal}
              alt="Evidência em alta resolução"
              className="w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* Diálogo para Nova Inspeção */}
      {user && (
        <ExtintorInspecaoDialog
          open={inspecaoOpen}
          onOpenChange={setInspecaoOpen}
          extintor={extintor}
          onSuccess={carregarDados}
        />
      )}
    </div>
  );
}
