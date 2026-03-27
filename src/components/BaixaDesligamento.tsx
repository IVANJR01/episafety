import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UserX, Package, RotateCcw, Trash2, AlertTriangle, FileText, Loader2 } from "lucide-react";
import jsPDF from "jspdf";

interface Funcionario {
  id: string;
  nome: string;
  cargo: string | null;
  cpf: string | null;
  matricula: string | null;
  data_admissao: string | null;
  contrato_id: string | null;
  unidade_id: string | null;
}

interface EntregaAtiva {
  id: string;
  epi_id: string;
  epi_nome: string;
  epi_ca: string | null;
  quantidade: number;
  data: string;
  tipo: string;
}

interface ItemBaixa {
  entrega: EntregaAtiva;
  selecionado: boolean;
  acao: "retorno" | "descarte" | "nao_devolvido";
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funcionario: Funcionario | null;
  empresaNome?: string;
  empresaCnpj?: string | null;
  onComplete: (dataDemissao: string) => void;
}

function formatDate(d: string) {
  if (!d) return "—";
  const p = d.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
}

export default function BaixaDesligamento({ open, onOpenChange, funcionario, empresaNome, empresaCnpj, onComplete }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<"checklist" | "confirm">("checklist");
  const [dataDemissao, setDataDemissao] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [entregas, setEntregas] = useState<EntregaAtiva[]>([]);
  const [itens, setItens] = useState<ItemBaixa[]>([]);
  const [observacao, setObservacao] = useState("");

  // Load active EPIs for this employee
  useEffect(() => {
    if (!open || !funcionario) return;
    setStep("checklist");
    setObservacao("");
    setLoading(true);

    const load = async () => {
      const { data, error } = await supabase
        .from("entregas")
        .select("id, epi_id, quantidade, data, tipo, epis!inner(nome, ca)")
        .eq("funcionario_id", funcionario.id)
        .eq("status", "ativo")
        .order("data", { ascending: false });

      if (error) {
        console.error(error);
        setEntregas([]);
        setItens([]);
        setLoading(false);
        return;
      }

      const mapped: EntregaAtiva[] = ((data || []) as any[]).map(e => ({
        id: e.id,
        epi_id: e.epi_id,
        epi_nome: e.epis?.nome || "EPI",
        epi_ca: e.epis?.ca || null,
        quantidade: e.quantidade,
        data: e.data,
        tipo: e.tipo,
      }));

      setEntregas(mapped);
      setItens(mapped.map(e => ({ entrega: e, selecionado: true, acao: "retorno" })));
      setLoading(false);
    };

    load();
  }, [open, funcionario]);

  const todosProcessados = useMemo(() => itens.every(i => i.selecionado), [itens]);
  const naoDevolvidos = useMemo(() => itens.filter(i => i.acao === "nao_devolvido"), [itens]);

  const handleToggle = (idx: number) => {
    setItens(prev => prev.map((item, i) => i === idx ? { ...item, selecionado: !item.selecionado } : item));
  };

  const handleAcao = (idx: number, acao: "retorno" | "descarte" | "nao_devolvido") => {
    setItens(prev => prev.map((item, i) => i === idx ? { ...item, acao } : item));
  };

  const handleConfirmar = async () => {
    if (!funcionario || saving) return;

    if (!todosProcessados) {
      toast({ title: "Processe todos os itens", description: "Todos os EPIs devem ser selecionados antes de confirmar.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      for (const item of itens) {
        if (item.acao === "retorno") {
          // Mark as devolvido + create devolução entry to restore stock
          await (supabase.from as any)("entregas").update({ status: "devolvido" }).eq("id", item.entrega.id);

          // Insert a devolução record to trigger stock restoration via trigger
          await (supabase.from as any)("entregas").insert({
            funcionario_id: funcionario.id,
            epi_id: item.entrega.epi_id,
            quantidade: item.entrega.quantidade,
            data: dataDemissao,
            tipo: "devolucao",
            status: "devolvido",
            observacao: "Devolução por desligamento",
            empresa_id: (await supabase.from("entregas").select("empresa_id").eq("id", item.entrega.id).single()).data?.empresa_id,
          });
        } else if (item.acao === "descarte") {
          await (supabase.from as any)("entregas").update({
            status: "danificado",
            observacao: "Descarte por desgaste — Desligamento"
          }).eq("id", item.entrega.id);
        } else {
          // nao_devolvido
          await (supabase.from as any)("entregas").update({
            status: "perdido",
            observacao: "Não devolvido — Desligamento"
          }).eq("id", item.entrega.id);
        }
      }

      toast({ title: "Baixa de EPIs concluída", description: `${itens.length} item(ns) processado(s).` });
      onComplete(dataDemissao);
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao processar baixa", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const gerarTermoPDF = () => {
    if (!funcionario) return;
    const doc = new jsPDF("p", "mm", "a4");
    const W = 210;
    const M = 15;
    const CW = W - M * 2;
    let y = 20;

    // Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(empresaNome || "EMPRESA", W / 2, y, { align: "center" });
    y += 6;
    if (empresaCnpj) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`CNPJ: ${empresaCnpj}`, W / 2, y, { align: "center" });
      y += 5;
    }
    y += 4;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("TERMO DE DEVOLUÇÃO DE EPI", W / 2, y, { align: "center" });
    y += 3;
    doc.setLineWidth(0.5);
    doc.line(M, y, W - M, y);
    y += 8;

    // Employee info
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const info = [
      `Nome: ${funcionario.nome}`,
      `CPF: ${funcionario.cpf || "—"}`,
      `Matrícula: ${funcionario.matricula || "—"}`,
      `Cargo: ${funcionario.cargo || "—"}`,
      `Data de Admissão: ${formatDate(funcionario.data_admissao || "")}`,
      `Data de Desligamento: ${formatDate(dataDemissao)}`,
    ];
    info.forEach(line => {
      doc.text(line, M, y);
      y += 5;
    });
    y += 5;

    // Table header
    const cols = [10, 70, 25, 25, 50];
    const headers = ["#", "Equipamento", "C.A.", "Qtd", "Situação"];
    doc.setFillColor(230, 230, 230);
    doc.rect(M, y, CW, 7, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    let x = M;
    headers.forEach((h, i) => {
      doc.text(h, x + 2, y + 5);
      x += cols[i];
    });
    y += 7;

    // Table rows
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const acaoLabels: Record<string, string> = {
      retorno: "Devolvido — Retorno ao Estoque",
      descarte: "Devolvido — Descarte/Sucata",
      nao_devolvido: "Não Devolvido",
    };

    itens.forEach((item, idx) => {
      if (y > 265) {
        doc.addPage();
        y = 20;
      }
      x = M;
      doc.rect(M, y, CW, 7, "S");
      doc.text(String(idx + 1), x + 2, y + 5);
      x += cols[0];
      const nome = item.entrega.epi_nome.length > 35 ? item.entrega.epi_nome.substring(0, 32) + "..." : item.entrega.epi_nome;
      doc.text(nome, x + 2, y + 5);
      x += cols[1];
      doc.text(item.entrega.epi_ca || "—", x + 2, y + 5);
      x += cols[2];
      doc.text(String(item.entrega.quantidade), x + 2, y + 5);
      x += cols[3];
      doc.text(acaoLabels[item.acao] || item.acao, x + 2, y + 5);
      y += 7;
    });

    y += 10;

    if (observacao) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Observações:", M, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const obsLines = doc.splitTextToSize(observacao, CW);
      doc.text(obsLines, M, y);
      y += obsLines.length * 4 + 5;
    }

    if (naoDevolvidos.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(180, 0, 0);
      doc.text(`⚠ ${naoDevolvidos.length} item(ns) não devolvido(s) — passível de desconto em rescisão conforme Art. 462, §1º da CLT.`, M, y);
      doc.setTextColor(0);
      y += 8;
    }

    // Signatures
    y += 15;
    if (y > 250) { doc.addPage(); y = 40; }
    doc.setLineWidth(0.3);
    const sigWidth = 70;
    const sig1X = M + 10;
    const sig2X = W - M - sigWidth - 10;
    doc.line(sig1X, y, sig1X + sigWidth, y);
    doc.line(sig2X, y, sig2X + sigWidth, y);
    y += 5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Funcionário (Ex-colaborador)", sig1X + sigWidth / 2, y, { align: "center" });
    doc.text("Técnico de Segurança", sig2X + sigWidth / 2, y, { align: "center" });

    // Footer
    y += 15;
    doc.setFontSize(6);
    doc.setTextColor(100);
    doc.text(`Documento gerado em ${new Date().toLocaleDateString("pt-BR")} — EPISafety`, W / 2, y, { align: "center" });

    doc.save(`Termo_Devolucao_${funcionario.nome.replace(/\s+/g, "_")}_${dataDemissao}.pdf`);
    toast({ title: "Termo de Devolução gerado!", description: "O PDF foi baixado." });
  };

  if (!funcionario) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="w-5 h-5 text-destructive" />
            Baixa de EPI por Desligamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Employee Info */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <p className="font-semibold text-sm">{funcionario.nome}</p>
            <p className="text-xs text-muted-foreground">
              {funcionario.cargo || "Sem cargo"} • CPF: {funcionario.cpf || "—"} • Mat: {funcionario.matricula || "—"}
            </p>
          </div>

          <div className="max-w-[200px]">
            <Label className="text-xs">Data do Desligamento</Label>
            <Input type="date" value={dataDemissao} onChange={e => setDataDemissao(e.target.value)} />
          </div>

          {/* EPI List */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : entregas.length === 0 ? (
            <div className="text-center py-6 space-y-2">
              <Package className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum EPI ativo sob posse deste funcionário.</p>
              <p className="text-xs text-muted-foreground">O desligamento pode ser processado diretamente.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" />
                {entregas.length} EPI(s) sob responsabilidade — processe todos para continuar
              </p>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {itens.map((item, idx) => (
                  <div
                    key={item.entrega.id}
                    className={`border rounded-lg p-3 transition-colors ${
                      item.selecionado ? "border-primary/30 bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={item.selecionado}
                        onCheckedChange={() => handleToggle(idx)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{item.entrega.epi_nome}</span>
                          {item.entrega.epi_ca && (
                            <Badge variant="outline" className="text-[10px] shrink-0">C.A. {item.entrega.epi_ca}</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">Qtd: {item.entrega.quantidade}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Entregue em {formatDate(item.entrega.data)}
                        </p>
                      </div>
                      {item.selecionado && (
                        <Select
                          value={item.acao}
                          onValueChange={(v) => handleAcao(idx, v as any)}
                        >
                          <SelectTrigger className="w-[180px] h-8 text-xs shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="retorno">
                              <span className="flex items-center gap-1.5">
                                <RotateCcw className="w-3 h-3 text-emerald-600" />Retorno ao Estoque
                              </span>
                            </SelectItem>
                            <SelectItem value="descarte">
                              <span className="flex items-center gap-1.5">
                                <Trash2 className="w-3 h-3 text-amber-600" />Descarte/Sucata
                              </span>
                            </SelectItem>
                            <SelectItem value="nao_devolvido">
                              <span className="flex items-center gap-1.5">
                                <AlertTriangle className="w-3 h-3 text-destructive" />Não Devolvido
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {naoDevolvidos.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p className="text-xs text-destructive font-medium flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                {naoDevolvidos.length} item(ns) marcado(s) como "Não Devolvido" — passível de desconto em rescisão (Art. 462, §1º CLT).
              </p>
            </div>
          )}

          <div>
            <Label className="text-xs">Observações (opcional)</Label>
            <Textarea
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              placeholder="Anotações sobre o desligamento ou estado dos EPIs..."
              className="h-16"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          {entregas.length > 0 && todosProcessados && (
            <Button variant="outline" onClick={gerarTermoPDF} disabled={saving}>
              <FileText className="w-4 h-4 mr-1" />Gerar Termo PDF
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={handleConfirmar}
            disabled={saving || (entregas.length > 0 && !todosProcessados) || !dataDemissao}
          >
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <UserX className="w-4 h-4 mr-1" />}
            {entregas.length === 0 ? "Confirmar Desligamento" : `Processar Baixa e Demitir`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
