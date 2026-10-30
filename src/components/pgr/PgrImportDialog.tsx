import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  textoDaCelula, notaDeRisco, codigoDoGes, grupoDoRisco, classeDaPlanilha,
  tipoDeExposicao,
} from "@/lib/celulasDoInventario";
import JSZip from "jszip";
import {
  responsavelTecnicoDoWord, unidadesDoWord, type UnidadeDoWord,
} from "@/lib/dadosDoWordPgr";
import { avisoDeEmpresa } from "@/lib/conferirEmpresaDoDocumento";
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
  /** Dados da empresa aberta, para conferir de quem é o documento. */
  const [empresaAtiva, setEmpresaAtiva] = useState<{ nome: string; cnpj: string } | null>(null);
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

  /** As linhas do último .docx lido — ver dadosDoWordPgr.ts. */
  const linhasDoWordRef = useRef<string[]>([]);

  useEffect(() => {
    if (!open || !empresaId) return;
    (async () => {
      const { data } = await (supabase.from as any)("empresa_config")
        .select("nome, cnpj").eq("id", empresaId).maybeSingle();
      setEmpresaAtiva(data ? { nome: data.nome || "", cnpj: data.cnpj || "" } : null);
    })();
  }, [open, empresaId]);

  /**
   * De quem é o documento que está sendo importado.
   *
   * Um PGR do G-91 NORDESTE foi importado quatro vezes para a CG3
   * ENGENHARIA, e a tela não dizia nada: o seletor de empresa fica no
   * canto da barra lateral, e quem está com o arquivo na mão não olha
   * para lá. O PGR é documento legal de uma organização só.
   */
  const cnpjDoDocumento =
    (dadosExtraidos?.unidades?.[0]?.cnpj as string | undefined)
    || (dadosExtraidos?.empresa?.cnpj as string | undefined)
    || (dadosExtraidos?.documento?.cnpj as string | undefined)
    || "";
  const aviso = avisoDeEmpresa(cnpjDoDocumento, empresaAtiva?.cnpj, empresaAtiva?.nome);

  const lerTextoDocx = async (file: File): Promise<string> => {
    const zip = await JSZip.loadAsync(file);
    const docXml = await zip.file("word/document.xml")?.async("string");
    if (!docXml) throw new Error("Documento Word (.docx) inválido ou sem conteúdo textual.");

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(docXml, "application/xml");
    const paragraphs = xmlDoc.getElementsByTagName("w:p");
    const linhas: string[] = [];

    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      const textNodes = p.getElementsByTagName("w:t");
      let linha = "";
      for (let j = 0; j < textNodes.length; j++) {
        linha += textNodes[j].textContent || "";
      }
      if (linha.trim()) linhas.push(linha.trim());
    }

    linhasDoWordRef.current = linhas;
    return linhas.join("\n");
  };

  /**
   * Completa o que a IA deixou em branco com o que está escrito no Word.
   *
   * A identificação das unidades e o responsável técnico vêm em tabelas
   * de rótulo e valor, e voltavam vazios da IA: a tela mostrava
   * "Responsável Técnico: A definir" num PGR que diz o nome e o registro
   * dele em letras garrafais. A leitura direta não custa chamada, não
   * erra o que está escrito, e só preenche o que veio vazio.
   */
  const completarComOWord = (dados: any) => {
    const linhas = linhasDoWordRef.current;
    if (!linhas || linhas.length === 0) return dados;

    const doc = { ...(dados?.documento || {}) };
    const tecnico = responsavelTecnicoDoWord(linhas);
    if (tecnico) {
      if (!doc.resp_tec_nome) doc.resp_tec_nome = tecnico.nome;
      if (!doc.resp_tec_registro && tecnico.registro) doc.resp_tec_registro = tecnico.registro;
      if (!doc.resp_tec_formacao && tecnico.especialidade) {
        doc.resp_tec_formacao = tecnico.especialidade;
      }
    }

    const unidades = unidadesDoWord(linhas);
    return {
      ...dados,
      documento: doc,
      /*
       * As unidades entram para a conferência de quem importa. O
       * cadastro delas é outra tela — aqui elas servem para a pessoa ver
       * que o documento é da empresa certa antes de aprovar.
       */
      unidades: unidades.length > 0 ? unidades : dados?.unidades,
    };
  };

  const processarDocumentoComIA = async (file: File) => {
    if (file.size > 35 * 1024 * 1024) {
      toast.error("O arquivo excede o limite de 35MB.");
      return;
    }

    setArquivo(file);
    setLoading(true);

    try {
      const nomeLower = file.name.toLowerCase();

      // Caso 1: Arquivo Word (.docx)
      if (nomeLower.endsWith(".docx")) {
        toast.info("Extraindo texto do documento Word...");
        const textoDocx = await lerTextoDocx(file);
        if (!textoDocx || textoDocx.length < 30) {
          throw new Error("O documento Word não possui texto legível suficiente.");
        }

        const { data, error } = await supabase.functions.invoke("parse-pgr", {
          body: { texto: textoDocx },
        });

        if (error) {
          // Fallback para parse-pcmso com texto
          const fb = await supabase.functions.invoke("parse-pcmso", { body: { texto: textoDocx } });
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

            setDadosExtraidos(completarComOWord({
              documento: {
                data_emissao: new Date().toISOString().slice(0, 10),
                data_vigencia_inicio: new Date().toISOString().slice(0, 10),
                data_vigencia_fim: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
                metodologia_avaliacao: "Matriz 5x5 (NR-01)",
              },
              setores: setoresMapeados,
              ghes: ghesFb,
              inventario: inventarioFb,
            }));
            toast.success("Documento Word (.docx) analisado com sucesso!");
            return;
          }
        }

        if (data?.error) throw new Error(data.error);
        setDadosExtraidos(completarComOWord(data));
        toast.success("Documento Word interpretado com sucesso pela Inteligência Artificial!");
        return;
      }

      // Caso 2: Arquivo PDF
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
      toast.error("Falha ao analisar o documento: " + (err.message || String(err)));
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

      // 3. Localiza dinamicamente a linha do cabeçalho por pontuação
      const avaliarLinhaCabecalho = (row: any[]) => {
        const normCols = row.map((c) => normalizarChave(String(c))).filter(Boolean);
        if (normCols.length < 2) return 0;

        let score = 0;
        if (normCols.some((c) => c === "setor" || c.startsWith("setor") || c.includes("nomedosetor"))) score += 14;
        else if (normCols.some((c) => c.includes("area") || c.includes("departamento") || c.includes("posto") || c.includes("secao"))) score += 6;

        if (normCols.some((c) => c === "ges" || c === "ghe" || c.includes("grupodeexposicao"))) score += 10;
        if (normCols.some((c) => c === "funcao" || c.includes("cargo") || c.includes("ocupacao"))) score += 10;
        if (normCols.some((c) => c.includes("perigo") || c.includes("fator") || c.includes("risco"))) score += 10;
        if (normCols.some((c) => c.includes("agente") || c.includes("grupoderisco"))) score += 8;
        if (normCols.some((c) => c.includes("fonte") || c.includes("geradora"))) score += 6;
        if (normCols.some((c) => c.includes("prob") || c.includes("sev") || c.includes("severidade"))) score += 6;
        if (normCols.some((c) => c.includes("medida") || c.includes("controle") || c.includes("epi") || c.includes("epc"))) score += 6;

        score += Math.min(normCols.length, 12);
        return score;
      };

      let headerIdx = -1;
      let maxScore = 0;
      for (let i = 0; i < Math.min(rawRows.length, 25); i++) {
        const sc = avaliarLinhaCabecalho(rawRows[i]);
        if (sc > maxScore) {
          maxScore = sc;
          headerIdx = i;
        }
      }

      if (headerIdx === -1 || maxScore < 10) {
        headerIdx = 0;
      }

      let headers = rawRows[headerIdx].map((c) => normalizarChave(String(c || "")));
      let startRow = headerIdx + 1;

      // Se a linha seguinte for sub-cabeçalho (EPC, EPI, Atenuação), combina
      if (headerIdx + 1 < rawRows.length) {
        const nextRow = rawRows[headerIdx + 1].map((c) => normalizarChave(String(c || "")));
        const nextStr = nextRow.join(" ");
        if (
          nextStr.includes("epc") ||
          nextStr.includes("epi") ||
          nextStr.includes("atenuacao") ||
          nextStr.includes("procedimento")
        ) {
          headers = headers.map((h, col) => {
            const sub = nextRow[col] || "";
            return sub ? `${h}_${sub}` : h;
          });
          startRow = headerIdx + 2;
        }
      }

      const findExactOrIncludes = (exactTerms: string[], fallbackTerms: string[] = [], excludeTerms: string[] = []) => {
        // 1. Correspondência exata
        let idx = headers.findIndex((h) => exactTerms.some((t) => h === t));
        if (idx >= 0) return idx;

        // 2. Prefixo
        idx = headers.findIndex((h) => exactTerms.some((t) => h.startsWith(t)) && !excludeTerms.some((e) => h.includes(e)));
        if (idx >= 0) return idx;

        // 3. Contém
        idx = headers.findIndex((h) => exactTerms.some((t) => h.includes(t)) && !excludeTerms.some((e) => h.includes(e)));
        if (idx >= 0) return idx;

        // 4. Termos secundários de fallback
        if (fallbackTerms.length > 0) {
          idx = headers.findIndex((h) => fallbackTerms.some((t) => h.includes(t)) && !excludeTerms.some((e) => h.includes(e)));
          if (idx >= 0) return idx;
        }
        return -1;
      };

      // Mapeamento prioritário e sem ambiguidades
      const cSetor = findExactOrIncludes(
        ["setor", "setores", "nomedosetor", "setorarea"],
        ["area", "departamento", "secao", "posto", "unidade", "localdetrabalho", "postodetrabalho", "local"],
        ["ambiente", "descricaodoambiente"] // NUNCA confundir Setor com Ambiente
      );
      const cAmbiente = findExactOrIncludes(["descricaodoambiente", "ambiente"], ["localizacao", "instalacao"]);
      const cGes = findExactOrIncludes(["ges", "ghe", "codigoges", "codigoghe"], ["grupodeexposicao", "grupo", "homogeneo"]);
      const cFuncao = findExactOrIncludes(["funcao", "funcoes", "cargo", "cargos"], ["ocupacao", "trabalhadores", "atividade"]);
      const cAgente = findExactOrIncludes(["agente", "grupoderisco", "categoria", "natureza"], ["tipoagente", "tipo"]);
      const cTipoAgente = findExactOrIncludes(["tipodeagente", "tipoagente"]);
      const cPerigo = findExactOrIncludes(
        ["perigo", "descricaodoperigo", "fator", "fatorederisco", "fatorrisco"],
        ["evento", "causa", "situacaoperigosa", "risco"]
      );
      const cFonte = findExactOrIncludes(["fonte", "fontegeradora", "circunstancia", "origem"]);
      const cLesoes = findExactOrIncludes(["lesoes", "possiveislesoes", "danos", "agravos", "efeito", "consequencia"]);
      const cMedidas = findExactOrIncludes(["medidas", "controles", "prevencao", "epc", "procedimento"]);
      const cEpi = findExactOrIncludes(["epi", "protecaoint", "equipamento"]);
      const cProb = findExactOrIncludes(["prob", "probabilidade", "p"]);
      const cSev = findExactOrIncludes(["sev", "severidade", "gravidade", "s"]);

      /*
       * Colunas que a planilha traz e a importação descartava.
       *
       * Na planilha real do cliente elas estão preenchidas em quase toda
       * linha — ambiente, processo, limite, intensidade, tipo/tempo de
       * exposição, técnica, atenuação —, e sem elas o inventário entra
       * no sistema pela metade. A CLASSIFICAÇÃO é a mais importante: é a
       * palavra que o técnico escreveu (TRIVIAL, TOLERÁVEL, MODERADO) e
       * que decide a prioridade das ações; recalcular por fora é trocar
       * o julgamento dele por uma conta.
       */
      const cProcesso = findExactOrIncludes(["processo"], [], ["agente", "perigo"]);
      const cLimite = findExactOrIncludes(["limitedeexposicao", "limite"]);
      const cIntensidade = findExactOrIncludes(["intens", "concentracao"]);
      const cExposicao = findExactOrIncludes(
        ["tipotempodeexposicao", "tempodeexposicao", "tipodeexposicao"], [], ["limite"],
      );
      const cTecnica = findExactOrIncludes(["tecnicautilizada", "tecnica"]);
      const cAtenuacao = findExactOrIncludes(["atenuacao", "fatordeprotecao"]);
      const cClassificacao = findExactOrIncludes(["classificacaodorisco", "classificacao"]);

      const setoresSet = new Set<string>();
      const ghesMap = new Map<string, any>();
      const inventarioItens: any[] = [];

      const ant = {
        setor: "",
        ges: "",
        funcao: "",
        ambiente: "",
        /* "Agente" é mesclado como os outros — ver o uso adiante. */
        agente: "",
      };

      for (let r = startRow; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.every((c) => !c || String(c).trim() === "")) continue;

        // Detecta linhas de separação que anunciam novo setor (ex: "SETOR: COSTURA" ou "ÁREA OPERACIONAL")
        for (const c of row) {
          const str = String(c || "").trim();
          const matchSetor = str.match(/^(?:setor|area|departamento)\s*[:\-]\s*(.+)$/i);
          if (matchSetor && matchSetor[1] && matchSetor[1].length < 60) {
            ant.setor = matchSetor[1].trim();
            break;
          }
        }

        const val = (idx: number) => (idx >= 0 && row[idx] != null ? String(row[idx]).trim() : "");
        /*
         * A nota, como o Excel a grava.
         *
         * Aqui se tirava tudo que não fosse dígito: o "1.0" que o Excel
         * guarda virava "10", caía fora da faixa de 1 a 5 e voltava para
         * o padrão. Na planilha real do cliente TODAS as notas estão
         * assim — ou seja, probabilidade e severidade eram sempre o
         * padrão, e a classificação do risco saía inventada.
         */
        const num = (idx: number, defVal: number) =>
          (idx < 0 ? defVal : (notaDeRisco(row[idx]) ?? defVal));

        let setor = val(cSetor);
        /* "1.0" do Excel vira "01"; "3.1" é subgrupo e continua "3.1". */
        let gesCodigo = codigoDoGes(val(cGes));
        let funcaoStr = val(cFuncao);
        let ambiente = val(cAmbiente);
        let perigoDesc = val(cPerigo) || val(cTipoAgente);
        let agenteStr = val(cAgente);
        let fonte = val(cFonte);
        let lesoes = val(cLesoes);
        let medidas = val(cMedidas);
        let epi = val(cEpi);

        // Descarta linhas que sejam cabeçalhos residuais (ex: se o "perigo" for palavras como "FUNÇÃO", "IDENTIFICAÇÃO DE PERIGOS", etc.)
        const pNorm = normalizarChave(perigoDesc);
        if (
          pNorm === "funcao" ||
          pNorm === "cargo" ||
          pNorm === "perigo" ||
          pNorm === "agente" ||
          pNorm === "identificacaodeperigos" ||
          pNorm.startsWith("identificacaodeper") ||
          pNorm === "fatoresderisco" ||
          pNorm === "fontesgeradoras" ||
          pNorm === "possiveislesoes"
        ) {
          continue;
        }

        // Herança de campos agrupados da linha anterior
        if (!setor && ant.setor) setor = ant.setor;
        if (!gesCodigo && ant.ges) gesCodigo = ant.ges;
        if (!funcaoStr && ant.funcao) funcaoStr = ant.funcao;
        if (!ambiente && ant.ambiente) ambiente = ant.ambiente;

        // Se a linha não tem nenhum indicador de risco nem de perigo, pula
        if (!perigoDesc && !agenteStr && !fonte && !lesoes && !medidas) {
          continue;
        }

        // Atualiza estado anterior
        if (setor) ant.setor = setor;
        if (gesCodigo) ant.ges = gesCodigo;
        if (funcaoStr) ant.funcao = funcaoStr;
        if (ambiente) ant.ambiente = ambiente;

        // Se o setor ainda for vazio, mas a empresa tiver o nome da unidade ou estabelecimento
        setor = setor || ant.setor || "Operacional";
        gesCodigo = gesCodigo || "GES 01";
        perigoDesc = perigoDesc || agenteStr || "Risco ocupacional identificado";

        setoresSet.add(setor);

        // Desmembra funções separadas por vírgula, barra ou quebra de linha
        const funcoesArr = funcaoStr
          ? funcaoStr
              .split(/[\n,;/]+/)
              .map((f) => f.trim())
              .filter(Boolean)
          : [];

        if (!ghesMap.has(gesCodigo)) {
          ghesMap.set(gesCodigo, {
            codigo: gesCodigo,
            nome: gesCodigo.toLowerCase().startsWith("ges") ? gesCodigo : `GES ${gesCodigo}`,
            setor: setor,
            funcoes: funcoesArr,
          });
        } else {
          const g = ghesMap.get(gesCodigo);
          funcoesArr.forEach((f) => {
            if (!g.funcoes.includes(f)) g.funcoes.push(f);
          });
        }

        /*
         * O grupo sai da coluna "Agente", que é mesclada como as demais:
         * vazia, o valor da linha de cima ainda vale. Deduzir pelo tipo
         * de agente punha "Postura Inadequada" em "outro" quando a
         * planilha diz Ergonômico duas linhas acima.
         */
        if (agenteStr) ant.agente = agenteStr;
        const grupo = grupoDoRisco(agenteStr || ant.agente || perigoDesc);
        const P = num(cProb, 2);
        const S = num(cSev, 2);

        const controlesArr: string[] = [];
        if (medidas && medidas !== "N.A" && medidas !== "-") controlesArr.push(medidas);
        if (epi && epi !== "N.A" && epi !== "-") controlesArr.push(`EPI: ${epi}`);

        inventarioItens.push({
          setor,
          ges_codigo: gesCodigo,
          grupo,
          tipo_agente: agenteStr || perigoDesc,
          perigo_descricao: perigoDesc,
          fonte_geradora: fonte && fonte !== "N.A" ? fonte : null,
          lesoes: lesoes && lesoes !== "N.A" ? lesoes : null,
          controles_existentes: controlesArr.length > 0 ? controlesArr : ["Medidas preventivas gerais"],
          epi: epi || null,
          probabilidade: P,
          severidade: S,
          /* Ver o bloco de colunas acima. */
          descricao_ambiente: textoDaCelula(ambiente),
          processo: textoDaCelula(val(cProcesso)),
          funcoes_snapshot: funcoesArr,
          limite_tolerancia: textoDaCelula(val(cLimite)),
          intensidade: textoDaCelula(val(cIntensidade)),
          tipo_exposicao: textoDaCelula(val(cExposicao)),
          tecnica_utilizada: textoDaCelula(val(cTecnica)),
          atenuacao: textoDaCelula(val(cAtenuacao)),
          classificacao: textoDaCelula(val(cClassificacao)),
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
        /*
         * A classificação que o técnico escreveu manda; a matriz é o
         * recurso de quando a planilha não traz nenhuma. Recalcular por
         * cima da palavra dele é trocar o julgamento técnico por uma
         * conta — e é ela que define a prioridade das ações.
         */
        const classe = classeDaPlanilha(item.classificacao)
          || classificarRisco(S, P)
          || (nivel <= 3 ? "trivial" : nivel <= 8 ? "toleravel" : nivel <= 12 ? "moderado" : nivel <= 15 ? "substancial" : "intoleravel");

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
          /*
           * `nivel_risco` NÃO vai no insert: é coluna gerada pelo banco
           * (severidade * probabilidade). Mandando valor, o Postgres
           * recusa a gravação inteira — "cannot insert a non-DEFAULT
           * value into column nivel_risco" —, e a importação acabava
           * depois de ter lido tudo certo.
           */
          classificacao: classe,
          necessita_acao: nivel >= 9 || !!item.plano_acao_sugerido,
          avaliacao_estado: "avaliado",
          /*
           * Campos que a planilha traz e que eram gravados com um texto
           * fixo igual para todos os riscos. Sem dado, ficam vazios — o
           * PGR não afirma "Avaliação Qualitativa" sobre um risco que
           * ninguém avaliou assim.
           */
          descricao_ambiente: item.descricao_ambiente || null,
          processo: item.processo || null,
          funcoes_snapshot: item.funcoes_snapshot || null,
          limite_tolerancia: item.limite_tolerancia || null,
          intensidade: item.intensidade || null,
          /*
           * `tipo_exposicao` é lista fechada no banco; a planilha
           * escreve em português corrente. Mandando o texto cru, o
           * Postgres recusa o inventário inteiro — ver tipoDeExposicao.
           * A frase original fica em `tempo_exposicao`, que é texto.
           */
          tipo_exposicao: tipoDeExposicao(item.tipo_exposicao),
          tempo_exposicao: item.tipo_exposicao || null,
          tecnica_utilizada: item.tecnica_utilizada || null,
          atenuacao: item.atenuacao || null,
        };
      });

      if (itensInventario.length > 0) {
        const { error: invErr } = await (supabase.from as any)("pgr_inventario_itens")
          .insert(itensInventario);
        if (invErr) {
          /*
           * Falhou o inventário: o PGR recém-criado sai junto.
           *
           * O cabeçalho é gravado antes dos riscos. Deixando-o para trás,
           * cada tentativa frustrada vira um rascunho vazio na lista — foi
           * o que encheu a tela do cliente de rascunhos sem risco nenhum.
           * Um PGR sem inventário não serve para nada mesmo.
           */
          await (supabase.from as any)("pgr_documentos").delete().eq("id", novoPgrId);
          throw invErr;
        }
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
                  <FileText className="w-4 h-4" /> PDF ou Word (.docx)
                </TabsTrigger>
                <TabsTrigger value="xlsx" className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <FileSpreadsheet className="w-4 h-4" /> Planilha Excel (GRO)
                </TabsTrigger>
                <TabsTrigger value="texto" className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <FileText className="w-4 h-4" /> Colar Texto
                </TabsTrigger>
              </TabsList>

              {/* ABA 1: UPLOAD DE PDF OU WORD */}
              <TabsContent value="pdf" className="mt-4 space-y-4">
                <div
                  onClick={() => fileInputPdfRef.current?.click()}
                  className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/20 hover:bg-indigo-50/50 rounded-xl p-8 text-center cursor-pointer transition-all space-y-3"
                >
                  <input
                    ref={fileInputPdfRef}
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) processarDocumentoComIA(f);
                    }}
                  />
                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mx-auto text-indigo-600">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm sm:text-base">
                      {arquivo ? arquivo.name : "Clique para selecionar o PDF ou Word (.docx) do PGR"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                      Arquivos PDF ou Word (.docx) até 35MB. A Inteligência Artificial fará a leitura e classificação automática.
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

            {/*
              * De quem é este documento.
              *
              * Fica ANTES dos dados extraídos, e não embaixo deles: quem
              * confere começa por aqui, e é aqui que o erro se evita.
              */}
            {aviso && (
              <div
                className={`rounded-xl border p-4 ${aviso.grave
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-amber-300 bg-amber-50 dark:bg-amber-950/20"}`}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${aviso.grave ? "text-destructive" : "text-amber-600"}`} />
                  <div>
                    <p className={`text-sm font-semibold ${aviso.grave ? "text-destructive" : "text-amber-900 dark:text-amber-200"}`}>
                      {aviso.titulo}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{aviso.detalhe}</p>
                  </div>
                </div>
              </div>
            )}

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

                {/*
                  * As unidades lidas do Word.
                  *
                  * Não é enfeite: o PGR do cliente cobre quatro
                  * inscrições da mesma empresa, e é aqui que quem importa
                  * confere se o documento é da empresa certa antes de
                  * aprovar.
                  */}
                {Array.isArray(dadosExtraidos.unidades) && dadosExtraidos.unidades.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] text-muted-foreground">
                      Unidades no documento ({dadosExtraidos.unidades.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(dadosExtraidos.unidades as UnidadeDoWord[]).map((u, i) => (
                        <span
                          key={`${u.cnpj}-${i}`}
                          title={[u.nome, u.cnpj, [u.cidade, u.uf].filter(Boolean).join("/")]
                            .filter(Boolean).join(" · ")}
                          className="inline-flex items-center gap-1 rounded border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[11px] text-primary"
                        >
                          {u.rotulo}
                          <span className="opacity-70">{u.cnpj}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
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

            {/* Setores Identificados em Destaque */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  Setores Identificados ({dadosExtraidos.setores?.length || 0}):
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(dadosExtraidos.setores || []).map((s, idx) => {
                  const qtdRiscos = (dadosExtraidos.inventario || []).filter((i) => i.setor === s.nome).length;
                  return (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="text-xs font-medium bg-white border border-slate-300 text-slate-800 shadow-xs flex items-center gap-1.5 py-1 px-2.5"
                    >
                      <span className="font-semibold">{s.nome}</span>
                      <span className="text-[10px] text-muted-foreground bg-slate-100 rounded-full px-1.5 py-0.2">
                        {qtdRiscos} riscos
                      </span>
                    </Badge>
                  );
                })}
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
              /*
               * O aviso de empresa errada não bloqueia — empresa sem CNPJ
               * cadastrado cairia no bloqueio sem erro nenhum. O botão
               * muda de cor e de texto, para quem aprova ver que está
               * aprovando algo que o sistema desaconselha.
               */
              className={aviso?.grave
                ? "bg-destructive hover:bg-destructive/90 text-white gap-2"
                : "bg-indigo-600 hover:bg-indigo-700 text-white gap-2"}
            >
              {salvando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Gravando no sistema...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {aviso?.grave ? "Salvar mesmo assim nesta empresa" : "Aprovar e Salvar PGR no Sistema"}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
