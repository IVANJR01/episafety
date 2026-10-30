import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { lerInventarioDaPlanilha } from "@/lib/importarPgrPlanilha";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  FileText, Upload, Sparkles, CheckCircle2, AlertTriangle, Building2,
  Users, ShieldCheck, Loader2, RefreshCw, ArrowRight, FileSpreadsheet, Download
} from "lucide-react";
import { toast } from "sonner";
import { classificarRisco } from "@/lib/pgrMatriz";
import { gerarPlanilhaBlob } from "@/lib/documentos/gerarPlanilha";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  onImportadoSucesso?: (novoPgrId: string) => void;
}

interface DadosPgrExtraidos {
  documento?: {
    empresa_nome?: string;
    cnpj?: string;
    unidade_nome?: string;
    resp_tec_nome?: string;
    resp_tec_registro?: string;
    data_emissao?: string;
    data_vigencia_inicio?: string;
    data_vigencia_fim?: string;
    escopo?: string;
    metodologia_avaliacao?: string;
  };
  setores?: Array<{
    nome: string;
    descricao_ambiente?: string;
  }>;
  ghes?: Array<{
    codigo: string;
    nome: string;
    setor?: string;
    funcoes?: string[];
    descricao?: string;
  }>;
  inventario?: Array<{
    setor?: string;
    ges_codigo?: string;
    grupo: "fisico" | "quimico" | "biologico" | "ergonomico" | "acidente";
    tipo_agente?: string;
    perigo_descricao: string;
    fonte_geradora?: string;
    lesoes?: string;
    controles_existentes?: string[];
    epi?: string;
    probabilidade?: number;
    severidade?: number;
    plano_acao_sugerido?: string;
  }>;
  acoes?: Array<{
    setor?: string;
    ges?: string;
    oque: string;
    porque?: string;
    como?: string;
    onde?: string;
    prioridade?: string | number;
    responsavel?: string;
    status?: string;
  }>;
}

export default function PgrImportDialog({
  open,
  onOpenChange,
  empresaId,
  onImportadoSucesso,
}: Props) {
  const [tab, setTab] = useState<"pdf" | "texto" | "xlsx">("pdf");
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [baixandoModelo, setBaixandoModelo] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [textoLivre, setTextoLivre] = useState("");
  const [dadosExtraidos, setDadosExtraidos] = useState<DadosPgrExtraidos | null>(null);

  const fileInputPdfRef = useRef<HTMLInputElement>(null);
  const fileInputXlsxRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setArquivo(null);
    setTextoLivre("");
    setLoading(false);
    setSalvando(false);
    setDadosExtraidos(null);
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const str = String(reader.result || "");
        const idx = str.indexOf(",");
        resolve(idx >= 0 ? str.slice(idx + 1) : str);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const normalizarGrupo = (grupo: string): "fisico" | "quimico" | "biologico" | "ergonomico" | "acidente" => {
    const s = (grupo || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (s.includes("fisic")) return "fisico";
    if (s.includes("quimic")) return "quimico";
    if (s.includes("biolog")) return "biologico";
    if (s.includes("ergonom")) return "ergonomico";
    return "acidente";
  };

  const processarPdfComIA = async (file: File) => {
    if (file.size > 30 * 1024 * 1024) {
      toast.error("O arquivo excede o limite de 30MB.");
      return;
    }

    setArquivo(file);
    setLoading(true);

    try {
      const pdf_base64 = await fileToBase64(file);
      
      // Tenta a Edge Function parse-pgr
      const { data, error } = await supabase.functions.invoke("parse-pgr", {
        body: { pdf_base64, mime_type: file.type || "application/pdf" },
      });

      if (error) {
        // Se a função parse-pgr ainda não foi implantada na nuvem, usa parse-pcmso como fallback
        const fb = await supabase.functions.invoke("parse-pcmso", {
          body: { pdf_base64, mime_type: file.type || "application/pdf" },
        });
        if (fb.error) throw new Error(error.message || "Erro ao conectar com serviço de IA.");
        if (fb.data) {
          // Converte o retorno do parse-pcmso para o formato do PGR
          const ghesFb = fb.data.ghes || [];
          const setoresMapeados = Array.from(new Set(ghesFb.map((g: any) => g.setor).filter(Boolean))).map((s) => ({ nome: s as string }));
          const inventarioFb: any[] = [];
          ghesFb.forEach((g: any) => {
            (g.riscos || []).forEach((r: any) => {
              inventarioFb.push({
                setor: g.setor,
                ges_codigo: g.codigo,
                grupo: normalizarGrupo(r.grupo),
                perigo_descricao: r.tipo_agente || "Risco ocupacional",
                tipo_agente: r.tipo_agente,
                controles_existentes: ["Acompanhamento de rotina e medidas preventivas"],
                probabilidade: 3,
                severidade: 3,
              });
            });
          });

          setDadosExtraidos({
            documento: {
              data_emissao: new Date().toISOString().slice(0, 10),
              data_vigencia_inicio: new Date().toISOString().slice(0, 10),
              data_vigencia_fim: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
              metodologia_avaliacao: "Matriz de Risco 5x5 (NR-01)",
            },
            setores: setoresMapeados,
            ghes: ghesFb,
            inventario: inventarioFb,
          });
          toast.success("PDF analisado com sucesso!");
          return;
        }
      }

      if (data?.error) throw new Error(data.error);

      setDadosExtraidos(data);
      toast.success("PGR interpretado com sucesso pela Inteligência Artificial!");
    } catch (err: any) {
      toast.error("Falha ao analisar o PDF: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const processarTextoComIA = async () => {
    if (!textoLivre.trim() || textoLivre.length < 30) {
      toast.error("Cole um trecho com conteúdo relevante do PGR (mínimo 30 caracteres).");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-pgr", {
        body: { texto: textoLivre },
      });

      if (error) {
        // Fallback para parse-pcmso
        const fb = await supabase.functions.invoke("parse-pcmso", { body: { texto: textoLivre } });
        if (fb.error) throw new Error(error.message || "Erro no serviço de IA.");
        if (fb.data) {
          const ghesFb = fb.data.ghes || [];
          const setoresMapeados = Array.from(new Set(ghesFb.map((g: any) => g.setor).filter(Boolean))).map((s) => ({ nome: s as string }));
          const inventarioFb: any[] = [];
          ghesFb.forEach((g: any) => {
            (g.riscos || []).forEach((r: any) => {
              inventarioFb.push({
                setor: g.setor,
                ges_codigo: g.codigo,
                grupo: normalizarGrupo(r.grupo),
                perigo_descricao: r.tipo_agente || "Risco ocupacional",
                tipo_agente: r.tipo_agente,
                controles_existentes: ["Acompanhamento e medidas de controle"],
                probabilidade: 3,
                severidade: 3,
              });
            });
          });

          setDadosExtraidos({
            documento: {
              data_emissao: new Date().toISOString().slice(0, 10),
              data_vigencia_inicio: new Date().toISOString().slice(0, 10),
              data_vigencia_fim: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
              metodologia_avaliacao: "Matriz 5x5 (NR-01)",
            },
            setores: setoresMapeados,
            ghes: ghesFb,
            inventario: inventarioFb,
          });
          toast.success("Texto interpretado com sucesso!");
          return;
        }
      }

      if (data?.error) throw new Error(data.error);

      setDadosExtraidos(data);
      toast.success("Dados do PGR estruturados com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao analisar texto: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const normalizarChave = (str: string) => {
    return String(str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  };

  const handleBaixarModelo = async () => {
    try {
      setBaixandoModelo(true);
      toast.info("Gerando modelo oficial de planilha de GRO / PGR...");
      const blob = await gerarPlanilhaBlob({});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Planilha_GRO_PGR_Modelo_Oficial.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Modelo oficial de planilha baixado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao gerar modelo: " + (err.message || String(err)));
    } finally {
      setBaixandoModelo(false);
    }
  };

  const processarPlanilhaXlsx = async (file: File) => {
    setArquivo(file);
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });

      if (!wb.SheetNames || wb.SheetNames.length === 0) {
        throw new Error("O arquivo não contém planilhas legíveis.");
      }

      // 1. Identifica a aba principal de Inventário de Riscos / GRO
      let sheetInventarioName = wb.SheetNames.find((n) => {
        const norm = normalizarChave(n);
        return (
          norm.includes("invent") ||
          norm.includes("gro") ||
          norm.includes("risco") ||
          norm.includes("perigo") ||
          norm.includes("pgr") ||
          norm.includes("avaliac") ||
          norm.includes("matriz")
        );
      });

      // Se não achou por nome, usa a primeira aba
      if (!sheetInventarioName) {
        sheetInventarioName = wb.SheetNames[0];
      }

      const ws = wb.Sheets[sheetInventarioName];
      if (!ws) throw new Error("Não foi possível acessar a aba de dados da planilha.");

      // Propaga valores de células mescladas (evita campos vazios em linhas filhas)
      if (ws["!merges"]) {
        for (const merge of ws["!merges"]) {
          const startCellAddress = XLSX.utils.encode_cell(merge.s);
          const startCell = ws[startCellAddress];
          if (startCell && startCell.v !== undefined) {
            for (let r = merge.s.r; r <= merge.e.r; r++) {
              for (let c = merge.s.c; c <= merge.e.c; c++) {
                const addr = XLSX.utils.encode_cell({ r, c });
                if (!ws[addr] || ws[addr].v === undefined || ws[addr].v === "") {
                  ws[addr] = { ...startCell };
                }
              }
            }
          }
        }
      }

      const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (!rawRows || rawRows.length < 2) {
        throw new Error("A planilha precisa ter um cabeçalho e linhas de dados.");
      }

      // 2. Extrai metadados da empresa/responsável das primeiras 5 linhas se existirem
      let empresaNomeDoc = "";
      let cnpjDoc = "";
      let respTecDoc = "";
      let dataDoc = "";

      for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
        const linhaTexto = rawRows[i].map((c) => String(c)).join(" ");
        const cnpjMatch = linhaTexto.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
        if (cnpjMatch) cnpjDoc = cnpjMatch[0];

        const empMatch = linhaTexto.match(/Empresa:\s*([^\s][^;,\t\n]+?)(?=\s{2,}|CNPJ|Atualiza|$)/i);
        if (empMatch) empresaNomeDoc = empMatch[1].trim();

        const respMatch = linhaTexto.match(/Respons[aá]vel:\s*([^\s][^;,\t\n]+?)(?=\s{2,}|$)/i);
        if (respMatch) respTecDoc = respMatch[1].trim();

        const dataMatch = linhaTexto.match(/(\d{2}\/\d{2}\/\d{4})/);
        if (dataMatch) {
          const [d, m, y] = dataMatch[1].split("/");
          dataDoc = `${y}-${m}-${d}`;
        }
      }

      /*
       * 3. Lê o inventário — ver src/lib/importarPgrPlanilha.ts.
       *
       * A leitura morava aqui dentro e errava três coisas na planilha
       * real do cliente: tomava o TÍTULO por cabeçalho, lia o SETOR da
       * coluna "DESCRIÇÃO DO AMBIENTE" e lia PROBABILIDADE/SEVERIDADE
       * das colunas "PROCESSO" e "DESCRIÇÃO DO AMBIENTE" — porque
       * procurava pelas letras soltas "p" e "s". As duas notas caíam no
       * padrão 2 e 2, e a classificação do risco saía inventada.
       */
      const leitura = lerInventarioDaPlanilha(rawRows);
      if (leitura.linhaCabecalho < 0) {
        throw new Error(
          "Não encontrei o cabeçalho do inventário nesta planilha. "
          + "Ela precisa ter uma linha com SETOR, GES, FUNÇÃO e os campos de risco.",
        );
      }

      const setoresSet = new Set<string>();
      const ghesMap = new Map<string, any>();
      const inventarioItens: any[] = [];

      for (const item of leitura.itens) {
        const setor = item.setor || "Geral";
        const gesCodigo = item.ges_codigo || "01";
        setoresSet.add(setor);

        if (!ghesMap.has(gesCodigo)) {
          ghesMap.set(gesCodigo, {
            codigo: gesCodigo,
            nome: setor,
            setor,
            funcoes: [...item.funcoes],
          });
        } else {
          const g = ghesMap.get(gesCodigo);
          item.funcoes.forEach((f) => { if (!g.funcoes.includes(f)) g.funcoes.push(f); });
        }

        inventarioItens.push({
          setor,
          ges_codigo: gesCodigo,
          grupo: item.grupo,
          tipo_agente: item.tipo_agente,
          perigo_descricao: item.perigo_descricao,
          fonte_geradora: item.fonte_geradora,
          lesoes: item.lesoes,
          descricao_ambiente: item.descricao_ambiente,
          processo: item.processo,
          funcoes_snapshot: item.funcoes,
          limite_tolerancia: item.limite_tolerancia,
          intensidade: item.intensidade,
          tipo_exposicao: item.tipo_exposicao,
          tecnica_utilizada: item.tecnica_utilizada,
          controles_existentes: item.controles_existentes.length > 0
            ? item.controles_existentes
            : ["Medidas preventivas gerais"],
          epi: item.epi,
          atenuacao: item.atenuacao,
          /*
           * Sem nota na planilha, o padrão 2 continua — mas agora é
           * exceção, e não a regra que valia para todo o inventário.
           */
          probabilidade: item.probabilidade ?? 2,
          severidade: item.severidade ?? 2,
          classificacao: item.classificacao,
        });
      }

      // 4. Lê aba de Plano de Ação 5W2H se existir na planilha
      const acoesExtraidas: any[] = [];
      const sheetAcoesName = wb.SheetNames.find((n) => {
        const norm = normalizarChave(n);
        return norm.includes("acao") || norm.includes("acoes") || norm.includes("5w2h") || norm.includes("plano");
      });

      if (sheetAcoesName) {
        const wsAcoes = wb.Sheets[sheetAcoesName];
        if (wsAcoes["!merges"]) {
          for (const merge of wsAcoes["!merges"]) {
            const startCell = wsAcoes[XLSX.utils.encode_cell(merge.s)];
            if (startCell && startCell.v !== undefined) {
              for (let r = merge.s.r; r <= merge.e.r; r++) {
                for (let c = merge.s.c; c <= merge.e.c; c++) {
                  const addr = XLSX.utils.encode_cell({ r, c });
                  if (!wsAcoes[addr] || wsAcoes[addr].v === undefined) {
                    wsAcoes[addr] = { ...startCell };
                  }
                }
              }
            }
          }
        }

        const rawAcoes: any[][] = XLSX.utils.sheet_to_json(wsAcoes, { header: 1, defval: "" });
        let headerAcoesIdx = -1;
        for (let i = 0; i < Math.min(rawAcoes.length, 15); i++) {
          const colsComDado = rawAcoes[i].filter((c) => String(c).trim() !== "").length;
          if (colsComDado < 3) continue;
          const rowStr = rawAcoes[i].map((c) => normalizarChave(String(c))).join(" ");
          if (
            (rowStr.includes("oque") || rowStr.includes("medida") || rowStr.includes("acao")) &&
            (rowStr.includes("setor") || rowStr.includes("ges") || rowStr.includes("responsavel") || rowStr.includes("prioridade"))
          ) {
            headerAcoesIdx = i;
            break;
          }
        }

        if (headerAcoesIdx >= 0) {
          const headersAcoes = rawAcoes[headerAcoesIdx].map((c) => normalizarChave(String(c)));
          const findAcaoCol = (termos: string[]) => headersAcoes.findIndex((h) => termos.some((t) => h.includes(t)));
          const cASetor = findAcaoCol(["setor", "local"]);
          const cAGes = findAcaoCol(["ges", "ghe"]);
          const cAOque = findAcaoCol(["oque", "medida", "prevencao", "acao", "descricao"]);
          const cAPorque = findAcaoCol(["porque", "motivo"]);
          const cAComo = findAcaoCol(["como", "metodo"]);
          const cAOnde = findAcaoCol(["onde", "local"]);
          const cAPrioridade = findAcaoCol(["prioridade", "grau"]);
          const cAResp = findAcaoCol(["responsavel"]);
          const cAStatus = findAcaoCol(["status", "situacao"]);

          // Pula linhas de subcabeçalho de meses se houver
          let startAcaoRow = headerAcoesIdx + 1;
          if (startAcaoRow < rawAcoes.length) {
            const nextRowStr = rawAcoes[startAcaoRow].map((c) => normalizarChave(String(c))).join(" ");
            if (nextRowStr.includes("jan") && nextRowStr.includes("fev")) {
              startAcaoRow = headerAcoesIdx + 2;
            }
          }

          for (let r = startAcaoRow; r < rawAcoes.length; r++) {
            const row = rawAcoes[r];
            if (!row || row.every((c) => !c || String(c).trim() === "")) continue;
            const val = (idx: number) => (idx >= 0 && row[idx] != null ? String(row[idx]).trim() : "");
            const oque = val(cAOque);
            if (!oque || oque.toUpperCase().includes("LEGENDA") || oque.length < 3) continue;

            acoesExtraidas.push({
              setor: val(cASetor),
              ges: val(cAGes),
              oque,
              porque: val(cAPorque),
              como: val(cAComo),
              onde: val(cAOnde),
              prioridade: val(cAPrioridade) || "Média",
              responsavel: val(cAResp) || "Empresa",
              status: val(cAStatus) || "planejada",
            });
          }
        }
      }

      // 5. FALLBACK INTELIGENTE COM IA: Se a extração padrão achou 0 riscos
      if (inventarioItens.length === 0) {
        toast.info("Layout de planilha customizado detectado. Interpretando com IA...");
        // Converte as primeiras 120 linhas com dados em texto para IA analisar
        const textoPlanilha = rawRows
          .slice(0, 120)
          .map((r) => r.filter(Boolean).join(" | "))
          .filter(Boolean)
          .join("\n");

        if (textoPlanilha.length > 50) {
          const respIa = await supabase.functions.invoke("parse-pgr", {
            body: { texto: `Planilha de Riscos e GRO:\n\n${textoPlanilha}` },
          });

          if (respIa.data && respIa.data.inventario && respIa.data.inventario.length > 0) {
            setDadosExtraidos(respIa.data);
            toast.success(`${respIa.data.inventario.length} riscos estruturados com sucesso via IA!`);
            return;
          }
        }

        throw new Error(
          "Não foram encontrados riscos na planilha. Certifique-se de que a planilha possui colunas como Setor, Função, Perigo e Medidas de Prevenção, ou utilize o Modelo Oficial."
        );
      }

      // Monta os dados finais
      const hoje = new Date().toISOString().slice(0, 10);
      const vigenciaFim = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);

      setDadosExtraidos({
        documento: {
          empresa_nome: empresaNomeDoc || undefined,
          cnpj: cnpjDoc || undefined,
          resp_tec_nome: respTecDoc || undefined,
          data_emissao: dataDoc || hoje,
          data_vigencia_inicio: dataDoc || hoje,
          data_vigencia_fim: vigenciaFim,
          metodologia_avaliacao: "Matriz 5x5 (NR-01)",
        },
        setores: Array.from(setoresSet).map((s) => ({ nome: s })),
        ghes: Array.from(ghesMap.values()),
        inventario: inventarioItens,
        acoes: acoesExtraidas,
      });

      toast.success(
        `Planilha lida com sucesso! ${inventarioItens.length} riscos e ${ghesMap.size} GES identificados.`
      );
    } catch (err: any) {
      toast.error("Erro ao processar planilha: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Salva tudo no banco de dados com integridade referencial:
   * 1. Cria o registro em pgr_documentos
   * 2. Cria/sincroniza setores em sst_setores
   * 3. Cria/sincroniza funções em sst_funcoes
   * 4. Cria/sincroniza GES em ghe_ges e vínculos em ghe_setores / ghe_funcoes
   * 5. Insere os itens em pgr_inventario_itens
   * 6. Insere as ações no plano de ação pgr_acoes
   */
  const handleConfirmarImportacao = async () => {
    if (!dadosExtraidos || !empresaId) return;
    setSalvando(true);

    try {
      const doc = dadosExtraidos.documento || {};
      const dataEmissao = doc.data_emissao || new Date().toISOString().slice(0, 10);
      const vigIni = doc.data_vigencia_inicio || dataEmissao;
      const vigFim = doc.data_vigencia_fim || new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);

      // 1. Cria o PGR no banco
      const { data: pgrCriado, error: pgrErr } = await (supabase.from as any)("pgr_documentos")
        .insert({
          empresa_id: empresaId,
          versao: 1,
          status: "rascunho",
          data_emissao: dataEmissao,
          data_vigencia_inicio: vigIni,
          data_vigencia_fim: vigFim,
          resp_tec_nome: doc.resp_tec_nome || "A definir",
          resp_tec_registro: doc.resp_tec_registro || null,
          metodologia_avaliacao: doc.metodologia_avaliacao || "Matriz de Risco 5x5 (NR-01)",
          escopo: doc.escopo || "PGR importado com estrutura e inventário de riscos integrado.",
        })
        .select()
        .single();

      if (pgrErr) throw pgrErr;
      const novoPgrId = pgrCriado.id;

      // 2. Cria / Sincroniza Setores
      const mapaSetores = new Map<string, string>(); // nomeSetor -> id
      const { data: setoresExistentes } = await (supabase.from as any)("sst_setores")
        .select("id, nome")
        .eq("empresa_id", empresaId);

      (setoresExistentes || []).forEach((s: any) => {
        mapaSetores.set(s.nome.trim().toLowerCase(), s.id);
      });

      for (const setor of dadosExtraidos.setores || []) {
        const chave = (setor.nome || "").trim().toLowerCase();
        if (!chave || mapaSetores.has(chave)) continue;

        const { data: setorNovo } = await (supabase.from as any)("sst_setores")
          .insert({
            empresa_id: empresaId,
            nome: setor.nome.trim(),
            descricao: setor.descricao_ambiente || null,
          })
          .select("id")
          .single();

        if (setorNovo) {
          mapaSetores.set(chave, setorNovo.id);
        }
      }

      // 3. Cria / Sincroniza Funções
      const mapaFuncoes = new Map<string, string>(); // nomeFuncao -> id
      const { data: funcoesExistentes } = await (supabase.from as any)("sst_funcoes")
        .select("id, nome")
        .eq("empresa_id", empresaId);

      (funcoesExistentes || []).forEach((f: any) => {
        mapaFuncoes.set(f.nome.trim().toLowerCase(), f.id);
      });

      for (const ghe of dadosExtraidos.ghes || []) {
        const setorId = ghe.setor ? mapaSetores.get(ghe.setor.trim().toLowerCase()) : null;
        for (const funcNome of ghe.funcoes || []) {
          const chave = funcNome.trim().toLowerCase();
          if (!chave || mapaFuncoes.has(chave)) continue;

          const { data: funcNova } = await (supabase.from as any)("sst_funcoes")
            .insert({
              empresa_id: empresaId,
              setor_id: setorId || null,
              nome: funcNome.trim(),
            })
            .select("id")
            .single();

          if (funcNova) {
            mapaFuncoes.set(chave, funcNova.id);
          }
        }
      }

      // 4. Cria / Sincroniza GES
      const mapaGes = new Map<string, string>(); // codigoGes -> id
      const { data: gesExistentes } = await (supabase.from as any)("ghe_ges")
        .select("id, codigo, nome")
        .eq("empresa_id", empresaId);

      (gesExistentes || []).forEach((g: any) => {
        if (g.codigo) mapaGes.set(g.codigo.trim().toLowerCase(), g.id);
        if (g.nome) mapaGes.set(g.nome.trim().toLowerCase(), g.id);
      });

      for (const ghe of dadosExtraidos.ghes || []) {
        const chaveCodigo = (ghe.codigo || "").trim().toLowerCase();
        const chaveNome = (ghe.nome || "").trim().toLowerCase();

        let gesId = mapaGes.get(chaveCodigo) || mapaGes.get(chaveNome);

        if (!gesId) {
          const { data: gesNovo } = await (supabase.from as any)("ghe_ges")
            .insert({
              empresa_id: empresaId,
              codigo: ghe.codigo || "GES 01",
              nome: ghe.nome || ghe.codigo || "GES Geral",
              descricao: ghe.descricao || null,
            })
            .select("id")
            .single();

          if (gesNovo) {
            gesId = gesNovo.id;
            mapaGes.set(chaveCodigo, gesNovo.id);
            mapaGes.set(chaveNome, gesNovo.id);

            // Vincula Setor ao GES
            const setorId = ghe.setor ? mapaSetores.get(ghe.setor.trim().toLowerCase()) : null;
            if (setorId) {
              await (supabase.from as any)("ghe_setores").insert({
                ghe_id: gesNovo.id,
                setor_id: setorId,
                nome: ghe.nome,
              });
            }

            // Vincula Funções ao GES
            for (const funcNome of ghe.funcoes || []) {
              const funcaoId = mapaFuncoes.get(funcNome.trim().toLowerCase());
              if (funcaoId) {
                await (supabase.from as any)("ghe_funcoes").insert({
                  ghe_id: gesNovo.id,
                  funcao_id: funcaoId,
                });
              }
            }
          }
        }
      }

      // 5. Insere os Itens do Inventário de Riscos
      const itensInventario = (dadosExtraidos.inventario || []).map((item) => {
        const P = item.probabilidade && item.probabilidade >= 1 && item.probabilidade <= 5 ? item.probabilidade : 3;
        const S = item.severidade && item.severidade >= 1 && item.severidade <= 5 ? item.severidade : 3;
        const nivel = P * S;
        const classe = classificarRisco(S, P) || (nivel <= 3 ? "trivial" : nivel <= 8 ? "toleravel" : nivel <= 12 ? "moderado" : nivel <= 15 ? "substancial" : "intoleravel");

        const gesId = item.ges_codigo ? mapaGes.get(item.ges_codigo.trim().toLowerCase()) : null;
        const setorId = item.setor ? mapaSetores.get(item.setor.trim().toLowerCase()) : null;

        return {
          pgr_id: novoPgrId,
          empresa_id: empresaId,
          ghe_id: gesId || null,
          ges_id: gesId || null,
          setor: item.setor || null,
          grupo: item.grupo,
          tipo_agente: item.tipo_agente || null,
          perigo_descricao: item.perigo_descricao || "Risco identificado no PGR",
          fonte_geradora: item.fonte_geradora || null,
          lesoes: item.lesoes || null,
          controles_existentes: item.controles_existentes || [],
          epi: item.epi || null,
          probabilidade: P,
          severidade: S,
          nivel_risco: nivel,
          classificacao: classe,
          necessita_acao: nivel >= 9 || !!item.plano_acao_sugerido,
          avaliacao_estado: "avaliado",
          tempo_exposicao: "Habitual e Permanente",
          tecnica_utilizada: "Avaliação Qualitativa",
        };
      });

      if (itensInventario.length > 0) {
        const { error: invErr } = await (supabase.from as any)("pgr_inventario_itens")
          .insert(itensInventario);
        if (invErr) throw invErr;
      }

      // 6. Insere Plano de Ação sugerido ou extraído da aba 5W2H da planilha
      const acoesParaInserir: any[] = [];
      (dadosExtraidos.inventario || []).forEach((item) => {
        if (item.plano_acao_sugerido) {
          acoesParaInserir.push({
            pgr_id: novoPgrId,
            empresa_id: empresaId,
            titulo: `Ação preventiva: ${item.perigo_descricao.slice(0, 80)}`,
            descricao: item.plano_acao_sugerido,
            status: "pendente",
            prioridade: (item.probabilidade || 3) * (item.severidade || 3) >= 12 ? 4 : 3,
            tipo_acao: "preventiva",
            tipo: "engenharia",
          });
        }
      });

      (dadosExtraidos.acoes || []).forEach((ac) => {
        acoesParaInserir.push({
          pgr_id: novoPgrId,
          empresa_id: empresaId,
          titulo: (ac.oque || "Medida de Controle").slice(0, 100),
          descricao: ac.oque,
          what: ac.oque,
          why: ac.porque || null,
          how: ac.como || null,
          where_local: ac.onde || null,
          responsavel_nome: ac.responsavel || null,
          status: "planejada",
          prioridade: typeof ac.prioridade === "number" ? ac.prioridade : String(ac.prioridade).toLowerCase().includes("alt") ? 4 : 3,
          tipo_acao: "preventiva",
          tipo: "engenharia",
        });
      });

      if (acoesParaInserir.length > 0) {
        await (supabase.from as any)("pgr_acoes").insert(acoesParaInserir);
      }

      toast.success(
        `PGR importado com sucesso! ${itensInventario.length} riscos e ${dadosExtraidos.ghes?.length || 0} GES cadastrados.`
      );

      if (onImportadoSucesso) {
        onImportadoSucesso(novoPgrId);
      }

      onOpenChange(false);
      reset();
    } catch (err: any) {
      toast.error("Erro ao salvar PGR importado: " + (err.message || String(err)));
    } finally {
      setSalvando(false);
    }
  };

  const corBadgeGrupo = (grupo: string) => {
    switch (grupo) {
      case "fisico": return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "quimico": return "bg-red-100 text-red-800 border-red-300";
      case "biologico": return "bg-amber-100 text-amber-800 border-amber-300";
      case "ergonomico": return "bg-yellow-100 text-yellow-800 border-yellow-300";
      default: return "bg-blue-100 text-blue-800 border-blue-300";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            Importação Inteligente de PGR (PDF / IA)
          </DialogTitle>
          <DialogDescription>
            Importe o documento PDF do PGR existente para extrair a estrutura, cargos, GES e inventário de riscos sem digitação manual.
          </DialogDescription>
        </DialogHeader>

        {!dadosExtraidos ? (
          <div className="space-y-4 py-2">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="pdf" className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <FileText className="w-4 h-4" /> Arquivo PDF (IA)
                </TabsTrigger>
                <TabsTrigger value="texto" className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <FileText className="w-4 h-4" /> Colar Texto
                </TabsTrigger>
                <TabsTrigger value="xlsx" className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <FileSpreadsheet className="w-4 h-4" /> Planilha Excel
                </TabsTrigger>
              </TabsList>

              {/* ABA 1: UPLOAD DE PDF */}
              <TabsContent value="pdf" className="mt-4 space-y-4">
                <div
                  onClick={() => fileInputPdfRef.current?.click()}
                  className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/20 hover:bg-indigo-50/50 rounded-xl p-8 text-center cursor-pointer transition-all space-y-3"
                >
                  <input
                    ref={fileInputPdfRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) processarPdfComIA(f);
                    }}
                  />
                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mx-auto text-indigo-600">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm sm:text-base">
                      {arquivo ? arquivo.name : "Clique para selecionar o PDF do PGR"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Arquivos PDF até 30MB. A Inteligência Artificial fará a leitura e classificação automática.
                    </p>
                  </div>
                </div>

                {loading && (
                  <div className="flex items-center justify-center gap-3 p-4 bg-indigo-50 rounded-lg text-indigo-800 text-sm">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Lendo documento, identificando setores, funções, GES e perigos...</span>
                  </div>
                )}
              </TabsContent>

              {/* ABA 2: COLAR TEXTO */}
              <TabsContent value="texto" className="mt-4 space-y-4">
                <div>
                  <Label className="text-xs font-medium text-slate-700">
                    Cole o conteúdo textual do documento PGR (tabelas, cargos ou inventário):
                  </Label>
                  <Textarea
                    rows={8}
                    placeholder="Exemplo: Setor Operacional. GES 01 - Costura. Funções: Costureira, Ajudante. Perigo: Ruído contínuo..."
                    value={textoLivre}
                    onChange={(e) => setTextoLivre(e.target.value)}
                    className="mt-1 font-mono text-xs"
                  />
                </div>
                <Button
                  onClick={processarTextoComIA}
                  disabled={loading || !textoLivre.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Interpretar Texto com IA
                </Button>
              </TabsContent>

              {/* ABA 3: PLANILHA EXCEL */}
              <TabsContent value="xlsx" className="mt-4 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200">
                  <div className="text-xs text-emerald-950">
                    <p className="font-semibold text-emerald-900 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                      Planilha Oficial de GRO / PGR (NR-01)
                    </p>
                    <p className="text-emerald-800 text-[11px] mt-0.5">
                      Possui abas pré-formatadas para Inventário de Riscos, Plano de Ação 5W2H e Matriz 5x5.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleBaixarModelo}
                    disabled={baixandoModelo}
                    className="shrink-0 text-emerald-800 border-emerald-300 hover:bg-emerald-100 text-xs gap-1.5 shadow-sm"
                  >
                    {baixandoModelo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    Baixar Modelo Oficial (.xlsx)
                  </Button>
                </div>

                <div
                  onClick={() => fileInputXlsxRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/50 hover:bg-emerald-50/30 rounded-xl p-8 text-center cursor-pointer transition-all space-y-3"
                >
                  <input
                    ref={fileInputXlsxRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) processarPlanilhaXlsx(f);
                    }}
                  />
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <FileSpreadsheet className="w-6 h-6" />}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">
                      {arquivo ? arquivo.name : "Clique para selecionar a Planilha Excel (.xlsx)"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                      Carrega inventário com colunas de Setor, GES, Função, Perigo, Agente e Controles. Suporta células mescladas e abas de Plano de Ação.
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          /* PAINEL DE CONFERÊNCIA E APROVAÇÃO (REVIEW) */
          <div className="space-y-6 py-2">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="font-semibold text-emerald-950 text-sm">Documento Interpretado com Sucesso!</h4>
                  <p className="text-xs text-emerald-800">
                    Confira abaixo os dados extraídos antes de confirmar a gravação definitiva no sistema.
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setDadosExtraidos(null)}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Ler outro
              </Button>
            </div>

            {/* Metadados do PGR */}
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-4 space-y-3">
                <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-primary" /> Identificação do Documento
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Responsável Técnico:</span>
                    <p className="font-semibold text-foreground">
                      {dadosExtraidos.documento?.resp_tec_nome || "A definir"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Registro Profissional:</span>
                    <p className="font-semibold text-foreground">
                      {dadosExtraidos.documento?.resp_tec_registro || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Vigência:</span>
                    <p className="font-semibold text-foreground">
                      {dadosExtraidos.documento?.data_vigencia_inicio || "—"} até {dadosExtraidos.documento?.data_vigencia_fim || "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Métricas de Estrutura */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-muted/40 border rounded-lg p-3">
                <span className="text-2xl font-bold text-foreground">
                  {dadosExtraidos.setores?.length || 0}
                </span>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">Setores Mapeados</p>
              </div>
              <div className="bg-muted/40 border rounded-lg p-3">
                <span className="text-2xl font-bold text-foreground">
                  {dadosExtraidos.ghes?.length || 0}
                </span>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">Grupos (GES)</p>
              </div>
              <div className="bg-muted/40 border rounded-lg p-3">
                <span className="text-2xl font-bold text-foreground">
                  {dadosExtraidos.inventario?.length || 0}
                </span>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">Riscos Identificados</p>
              </div>
              <div className="bg-muted/40 border rounded-lg p-3">
                <span className="text-2xl font-bold text-foreground">
                  {(dadosExtraidos.acoes?.length || 0) + (dadosExtraidos.inventario?.filter((i) => i.plano_acao_sugerido)?.length || 0)}
                </span>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">Ações 5W2H</p>
              </div>
            </div>

            {/* Amostra do Inventário de Riscos */}
            <div className="space-y-2">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Inventário de Riscos Extraído ({dadosExtraidos.inventario?.length || 0} registros)
              </h5>
              <div className="max-h-60 overflow-y-auto border rounded-lg">
                <Table className="text-xs">
                  <TableHeader className="bg-muted/50 sticky top-0">
                    <TableRow>
                      <TableHead>Setor / GES</TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Perigo / Agente</TableHead>
                      <TableHead>Fonte Geradora</TableHead>
                      <TableHead>Medidas Preventivas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(dadosExtraidos.inventario || []).map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">
                          {item.setor || "Geral"}
                          {item.ges_codigo && <span className="block text-[11px] text-muted-foreground">{item.ges_codigo}</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] font-normal uppercase ${corBadgeGrupo(item.grupo)}`}>
                            {item.grupo}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate" title={item.perigo_descricao}>
                          {item.perigo_descricao}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[140px] truncate" title={item.fonte_geradora || ""}>
                          {item.fonte_geradora || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[180px] truncate" title={(item.controles_existentes || []).join(", ")}>
                          {(item.controles_existentes || []).join(", ") || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-2 pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          {dadosExtraidos && (
            <Button
              onClick={handleConfirmarImportacao}
              disabled={salvando}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Gravando no sistema...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Aprovar e Salvar PGR no Sistema
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
