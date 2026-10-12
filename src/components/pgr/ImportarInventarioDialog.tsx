import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Download, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { gerarModeloInventarioXlsx } from "@/lib/exportarInventarioXlsx";

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

  const normalizarChave = (str: string) => {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  };

  const mapearGrupo = (val: string): string => {
    const s = normalizarChave(val || "");
    if (s.includes("fisic")) return "fisico";
    if (s.includes("quimic")) return "quimico";
    if (s.includes("biolog")) return "biologico";
    if (s.includes("ergonom")) return "ergonomico";
    if (s.includes("acident") || s.includes("mecanic")) return "acidente";
    if (s.includes("psicossoc")) return "psicossocial";
    return "acidente";
  };

  const calcularClasse = (p: number, s: number): string => {
    const total = p * s;
    if (total <= 3) return "trivial";
    if (total <= 8) return "toleravel";
    if (total <= 12) return "moderado";
    if (total <= 15) return "substancial";
    return "intoleravel";
  };

  const processarArquivo = async (file: File) => {
    setArquivo(file);
    setLendo(true);
    setErro(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) throw new Error("A planilha não possui páginas legíveis.");

      const ws = wb.Sheets[sheetName];
      const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

      if (rawRows.length < 2) {
        throw new Error("A planilha precisa ter um cabeçalho e pelo menos uma linha de dados.");
      }

      // Procura linha do cabeçalho
      let headerIdx = 0;
      for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
        const rowStr = rawRows[i].map((c) => String(c).toLowerCase()).join(" ");
        if (rowStr.includes("perigo") || rowStr.includes("agente") || rowStr.includes("setor") || rowStr.includes("ges")) {
          headerIdx = i;
          break;
        }
      }

      const headers = rawRows[headerIdx].map((h) => normalizarChave(String(h || "")));
      const dataRows = rawRows.slice(headerIdx + 1);

      // Carrega os GES da empresa para tentar vincular por código ou nome
      const { data: ghes = [] } = await (supabase.from as any)("ghe_ges")
        .select("id, codigo, nome")
        .eq("empresa_id", empresaId);

      const mapaGhe = new Map<string, string>();
      (ghes || []).forEach((g: any) => {
        if (g.codigo) mapaGhe.set(normalizarChave(g.codigo), g.id);
        if (g.nome) mapaGhe.set(normalizarChave(g.nome), g.id);
      });

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
      const cTempo = findCol(["tipo/tempo", "tempo", "exposicao", "tipodeexposicao"]);
      const cTecnica = findCol(["tecnica", "tecnicautilizada", "metodologia"]);
      const cControles = findCol(["proc", "epc", "administrativo", "medidas", "controles"]);
      const cEpi = findCol(["epi", "protecaoint"]);
      const cAtenuacao = findCol(["atenuacao", "fatordeprotecao"]);
      const cProb = findCol(["prob", "probabilidade", "p"]);
      const cSev = findCol(["sev", "severidade", "s"]);
      const cExpostos = findCol(["trabalhadores", "expostos", "qtd"]);

      const itensParaSalvar: any[] = [];

      for (const row of dataRows) {
        if (!row || row.every((c) => !c || String(c).trim() === "")) continue;

        const val = (idx: number) => (idx >= 0 && row[idx] != null ? String(row[idx]).trim() : "");
        const num = (idx: number, defVal: number) => {
          if (idx < 0) return defVal;
          const parsed = Number(row[idx]);
          return !isNaN(parsed) && parsed >= 1 && parsed <= 5 ? parsed : defVal;
        };

        const perigoDesc = val(cPerigo) || val(cTipoAgente) || "Perigo não especificado";
        const grupo = mapearGrupo(val(cAgente));
        const P = num(cProb, 2);
        const S = num(cSev, 2);
        const nivel = P * S;
        const classe = calcularClasse(P, S);

        const gesTexto = val(cGes);
        const gheId = gesTexto ? mapaGhe.get(normalizarChave(gesTexto)) || null : null;

        const funcoesStr = val(cFuncao);
        const funcoesArr = funcoesStr ? funcoesStr.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean) : null;

        const controlesStr = val(cControles);
        const controlesArr = controlesStr ? controlesStr.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean) : null;

        const qtdTrab = cExpostos >= 0 && !isNaN(Number(row[cExpostos])) ? Number(row[cExpostos]) : null;

        itensParaSalvar.push({
          pgr_id: pgrId,
          empresa_id: empresaId,
          ghe_id: gheId,
          setor: val(cSetor) || null,
          descricao_ambiente: val(cAmbiente) || null,
          processo: val(cProcesso) || null,
          funcoes_snapshot: funcoesArr,
          grupo,
          tipo_agente: val(cTipoAgente) || null,
          perigo_descricao: perigoDesc,
          fonte_geradora: val(cFonte) || null,
          lesoes: val(cLesoes) || null,
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
      // Remove campos auxiliares que não são colunas do banco
      const payloads = linhasProcessadas.map(({ ges_texto_original, ...item }) => item);

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
          {/* Caixa de download de modelo */}
          <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50 text-xs">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-slate-500" />
              <span>Precisa do modelo padrão para preencher?</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={gerarModeloInventarioXlsx}
              className="h-7 text-xs gap-1"
            >
              Baixar Modelo Excel
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

              {/* Prévia das primeiras 3 linhas */}
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
