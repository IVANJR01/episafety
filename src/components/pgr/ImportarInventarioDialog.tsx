import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { semColunasGeradas } from "@/lib/celulasDoInventario";
import { indiceDeGes, gesDaEstrutura } from "@/lib/vinculosDoInventario";
import { Upload, FileSpreadsheet, Download, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { gerarPlanilhaBlob } from "@/lib/documentos/gerarPlanilha";
import { classificarRisco } from "@/lib/pgrMatriz";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pgrId: string;
  empresaId: string;
  onImported: () => void;
}

export default function ImportarInventarioDialog({
  open,
  onOpenChange,
  pgrId,
  empresaId,
  onImported,
}: Props) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [baixandoModelo, setBaixandoModelo] = useState(false);
  const [linhasProcessadas, setLinhasProcessadas] = useState<any[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setArquivo(null);
    setLendo(false);
    setSalvando(false);
    setLinhasProcessadas([]);
    setErro(null);
  };

  const handleBaixarModelo = async () => {
    try {
      setBaixandoModelo(true);
      toast.info("Gerando modelo oficial de planilha (3 abas)...");
      const blob = await gerarPlanilhaBlob({});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Inventario_Modelo_Oficial.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Modelo oficial baixado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao gerar modelo: " + (err.message || err));
    } finally {
      setBaixandoModelo(false);
    }
  };

  const normalizarChave = (str: string) => {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  };

  const mapearGrupo = (val: string): "fisico" | "quimico" | "biologico" | "ergonomico" | "acidente" | "psicossocial" => {
    const s = normalizarChave(val || "");
    if (s.includes("fisic")) return "fisico";
    if (s.includes("quimic")) return "quimico";
    if (s.includes("biolog")) return "biologico";
    if (s.includes("ergonom")) return "ergonomico";
    if (s.includes("psicossoc")) return "psicossocial";
    if (s.includes("acident") || s.includes("mecanic")) return "acidente";
    return "acidente";
  };

  const processarArquivo = async (file: File) => {
    setArquivo(file);
    setLendo(true);
    setErro(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      
      // Procura a aba de Inventário de Riscos ou usa a primeira
      const sheetName = wb.SheetNames.find((n) => n.toUpperCase().includes("INVENT")) || wb.SheetNames[0];
      if (!sheetName) throw new Error("A planilha não possui páginas legíveis.");

      const ws = wb.Sheets[sheetName];

      // Preenche células mescladas para que nenhuma linha filha fique vazia
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

      if (rawRows.length < 2) {
        throw new Error("A planilha precisa ter um cabeçalho e pelo menos uma linha de dados.");
      }

      // Procura a linha de cabeçalho principal
      let headerIdx = 0;
      for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
        const rowStr = rawRows[i].map((c) => String(c).toLowerCase()).join(" ");
        if (rowStr.includes("perigo") || rowStr.includes("agente") || rowStr.includes("setor") || rowStr.includes("ges")) {
          headerIdx = i;
          break;
        }
      }

      // Verifica se a próxima linha é um sub-cabeçalho (como na planilha oficial: EPC, EPI, ATENUAÇÃO)
      let dataStartIdx = headerIdx + 1;
      let headers = rawRows[headerIdx].map((h) => normalizarChave(String(h || "")));

      if (headerIdx + 1 < rawRows.length) {
        const nextRowStr = rawRows[headerIdx + 1].map((c) => String(c).toLowerCase()).join(" ");
        if (nextRowStr.includes("epc") || nextRowStr.includes("epi") || nextRowStr.includes("procedimento") || nextRowStr.includes("atenuacao")) {
          // Combina o cabeçalho principal com o sub-cabeçalho
          headers = headers.map((h, col) => {
            const sub = normalizarChave(String(rawRows[headerIdx + 1][col] || ""));
            return sub ? `${h}_${sub}` : h;
          });
          dataStartIdx = headerIdx + 2;
        }
      }

      const dataRows = rawRows.slice(dataStartIdx);

      // Carrega os GES da empresa para vincular por código ou nome (suporta sst_ges e ghe_ges)
      const [ghesResp, sstGesResp] = await Promise.all([
        (supabase.from as any)("ghe_ges").select("id, codigo, nome").eq("empresa_id", empresaId),
        (supabase.from as any)("sst_ges").select("id, codigo, nome").eq("empresa_id", empresaId),
      ]);

      /*
       * Dois índices, não um.
       *
       * `ghe_id` aponta para ghe_ges e `ges_id` para sst_ges: são
       * tabelas diferentes, e o id de uma não vale na coluna da outra.
       * Os dois cadastros caíam no mesmo mapa e o mesmo id ia para as
       * duas colunas — o banco recusava o inventário inteiro com
       * "violates foreign key constraint". Ver vinculosDoInventario.ts.
       */
      const indiceGhe = indiceDeGes((ghesResp.data || []) as any);
      const indiceSstGes = indiceDeGes((sstGesResp.data || []) as any);

      const findCol = (termos: string[]) => {
        return headers.findIndex((h) => termos.some((t) => h.includes(t)));
      };

      const cAmbiente = findCol(["ambiente", "descricaodoambiente", "local"]);
      const cSetor = findCol(["setor", "area", "departamento"]);
      const cGes = findCol(["ges", "ghe", "grupodeexposicao"]);
      const cFuncao = findCol(["funcao", "cargo", "ocupacao"]);
      const cProcesso = findCol(["processo", "atividade"]);
      const cAgente = findCol(["agente", "grupoderisco", "categoria"]);
      const cTipoAgente = findCol(["tipodeagente", "tipoagente"]);
      const cPerigo = findCol(["perigo", "descricaodoperigo", "fator"]);
      const cFonte = findCol(["fonte", "fontegeradora", "fontedeexposicao"]);
      const cLesoes = findCol(["lesoes", "possiveislesoes", "danos", "agravos"]);
      const cLimite = findCol(["limite", "limitedeexposicao", "tolerancia"]);
      const cIntensidade = findCol(["intensidade", "concentracao", "medicao"]);
      const cTempo = findCol(["tempo", "exposicao", "tipodeexposicao"]);
      const cTecnica = findCol(["tecnica", "tecnicautilizada", "metodologia"]);
      const cControles = findCol(["epc", "procedimento", "administrativo", "medidas", "controles"]);
      const cEpi = findCol(["epi", "protecaoint"]);
      const cAtenuacao = findCol(["atenuacao", "fatordeprotecao"]);
      const cProb = findCol(["prob", "probabilidade", "p"]);
      const cSev = findCol(["sev", "severidade", "s"]);
      const cExpostos = findCol(["trabalhadores", "expostos", "qtd"]);

      const itensParaSalvar: any[] = [];
      const ant: Record<string, string> = {
        ambiente: "",
        setor: "",
        ges: "",
        funcao: "",
        processo: "",
      };

      for (const row of dataRows) {
        if (!row || row.every((c) => !c || String(c).trim() === "")) continue;

        const val = (idx: number) => (idx >= 0 && row[idx] != null ? String(row[idx]).trim() : "");
        const num = (idx: number, defVal: number) => {
          if (idx < 0) return defVal;
          const raw = String(row[idx] ?? "").replace(/[^0-9]/g, "");
          const parsed = Number(raw);
          return !isNaN(parsed) && parsed >= 1 && parsed <= 5 ? parsed : defVal;
        };

        // Herança de campos de grupo mesclados
        let ambiente = val(cAmbiente);
        let setor = val(cSetor);
        let gesTexto = val(cGes);
        let funcaoStr = val(cFuncao);
        let processo = val(cProcesso);

        if (!ambiente && ant.ambiente) ambiente = ant.ambiente;
        if (!setor && ant.setor) setor = ant.setor;
        if (!gesTexto && ant.ges) gesTexto = ant.ges;
        if (!funcaoStr && ant.funcao) funcaoStr = ant.funcao;
        if (!processo && ant.processo) processo = ant.processo;

        const perigoDesc = val(cPerigo) || val(cTipoAgente);
        const fonte = val(cFonte);
        const lesoes = val(cLesoes);
        const medidas = val(cControles);
        const agente = val(cAgente);

        // Se a linha não tiver dados de risco (ex: linha vazia, rodapé, legenda), pula
        if (!perigoDesc && !fonte && !lesoes && !medidas && !agente) {
          continue;
        }

        // Atualiza o anterior para a próxima linha
        if (ambiente) ant.ambiente = ambiente;
        if (setor) ant.setor = setor;
        if (gesTexto) ant.ges = gesTexto;
        if (funcaoStr) ant.funcao = funcaoStr;
        if (processo) ant.processo = processo;

        const grupo = mapearGrupo(agente);
        const P = num(cProb, 2);
        const S = num(cSev, 2);
        const nivel = P * S;
        const classe = classificarRisco(S, P) || (nivel <= 3 ? "trivial" : nivel <= 8 ? "toleravel" : nivel <= 12 ? "moderado" : nivel <= 15 ? "substancial" : "intoleravel");

        const gheId = gesDaEstrutura(indiceGhe, gesTexto, setor);
        const gesEstruturaId = gesDaEstrutura(indiceSstGes, gesTexto, setor);

        const funcoesArr = funcaoStr ? funcaoStr.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean) : null;
        const controlesArr = medidas ? medidas.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean) : null;
        const qtdTrab = cExpostos >= 0 && !isNaN(Number(row[cExpostos])) ? Number(row[cExpostos]) : null;

        itensParaSalvar.push({
          pgr_id: pgrId,
          empresa_id: empresaId,
          /* ghe_id -> ghe_ges; ges_id -> sst_ges. Cada um do seu. */
          ghe_id: gheId,
          ges_id: gesEstruturaId,
          setor: setor || null,
          descricao_ambiente: ambiente || null,
          processo: processo || null,
          funcoes_snapshot: funcoesArr,
          grupo,
          tipo_agente: val(cTipoAgente) || null,
          perigo_descricao: perigoDesc || "Perigo não especificado",
          fonte_geradora: fonte || null,
          lesoes: lesoes || null,
          limite_tolerancia: val(cLimite) || null,
          intensidade: val(cIntensidade) || null,
          tempo_exposicao: val(cTempo) || "Intermitente",
          tecnica_utilizada: val(cTecnica) || "Avaliação Qualitativa",
          controles_existentes: controlesArr,
          epi: val(cEpi) || null,
          atenuacao: val(cAtenuacao) || null,
          probabilidade: P,
          severidade: S,
          nivel_risco: nivel,
          classificacao: classe,
          necessita_acao: nivel >= 9,
          trabalhadores_expostos: qtdTrab ?? 0,
          avaliacao_estado: "avaliado",
          ges_texto_original: gesTexto || null,
        });
      }

      if (itensParaSalvar.length === 0) {
        throw new Error("Nenhum registro válido de risco foi encontrado nas linhas da planilha.");
      }

      setLinhasProcessadas(itensParaSalvar);
    } catch (err: any) {
      setErro(err.message || "Erro ao ler a planilha.");
      setLinhasProcessadas([]);
    } finally {
      setLendo(false);
    }
  };

  const handleConfirmarImportacao = async () => {
    if (linhasProcessadas.length === 0) return;
    setSalvando(true);

    try {
      /*
       * Fora os campos auxiliares, sai `nivel_risco`: é coluna gerada
       * pelo banco e, mandando valor, o Postgres recusa a gravação
       * inteira. A tela precisa dele para mostrar e ordenar, por isso
       * ele é tirado aqui e não na leitura.
       */
      const payloads = linhasProcessadas.map(({ ges_texto_original, ...item }) =>
        semColunasGeradas(item));

      const { error } = await (supabase.from as any)("pgr_inventario_itens").insert(payloads);
      if (error) throw error;

      toast.success(`${payloads.length} itens importados com sucesso para o Inventário!`);
      onImported();
      onOpenChange(false);
      reset();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar itens no banco.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-amber-600" />
            Importar Inventário de Riscos (Excel)
          </DialogTitle>
          <DialogDescription>
            Envie sua planilha (.xlsx, .xlsm ou .csv) para carregar os riscos diretamente no Inventário.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Caixa de download de modelo oficial com as 3 abas */}
          <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50 text-xs">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-slate-500" />
              <span>Precisa do modelo padrão oficial para preencher?</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBaixarModelo}
              disabled={baixandoModelo}
              className="h-7 text-xs gap-1"
            >
              {baixandoModelo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {baixandoModelo ? "Gerando..." : "Baixar Modelo Oficial"}
            </Button>
          </div>

          {/* Área de Upload / Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-amber-500 bg-slate-50/50 hover:bg-amber-50/30 rounded-xl p-6 text-center cursor-pointer transition-all space-y-2"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xlsm,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) processarArquivo(f);
              }}
            />
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">
                {arquivo ? arquivo.name : "Clique para selecionar o arquivo ou arraste aqui"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Formatos suportados: .xlsx, .xlsm, .csv</p>
            </div>
          </div>

          {lendo && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
              Lendo planilha e mapeando colunas...
            </div>
          )}

          {erro && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {linhasProcessadas.length > 0 && (
            <div className="space-y-3 border rounded-lg p-3 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>{linhasProcessadas.length} riscos encontrados e prontos para importar</span>
                </div>
                <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200">
                  Válido
                </Badge>
              </div>

              {/* Prévia das primeiras 5 linhas */}
              <div className="max-h-40 overflow-y-auto text-[11px] border rounded divide-y">
                {linhasProcessadas.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="p-2 flex items-center justify-between gap-2 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">
                        {item.setor ? `[${item.setor}] ` : ""}{item.perigo_descricao}
                      </p>
                      <p className="text-slate-500 text-[10px]">
                        Agente: {item.grupo} · P: {item.probabilidade} x S: {item.severidade} = {item.nivel_risco} ({item.classificacao})
                      </p>
                    </div>
                    {item.ghe_id ? (
                      <Badge variant="outline" className="text-indigo-600 text-[10px] shrink-0">GES vinculado</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-slate-500 text-[10px] shrink-0">Sem GES</Badge>
                    )}
                  </div>
                ))}
              </div>
              {linhasProcessadas.length > 5 && (
                <p className="text-[10px] text-muted-foreground text-center">
                  ... e mais {linhasProcessadas.length - 5} linha(s)
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={salvando}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirmarImportacao}
            disabled={linhasProcessadas.length === 0 || salvando}
            className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
          >
            {salvando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Confirmar Importação ({linhasProcessadas.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
