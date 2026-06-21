import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, ExternalLink, Loader2 } from "lucide-react";
import { uploadToDrive } from "@/lib/googleDriveStorage";

interface Props {
  open: boolean; onOpenChange: (b: boolean) => void;
  ltcatId: string; ltcatVersao: number; empresaId: string;
  agenteId: string; gheId: string; avaliacao?: any | null;
}

export default function LtcatAvaliacaoDialog({
  open, onOpenChange, ltcatId, ltcatVersao, empresaId, agenteId, gheId, avaliacao,
}: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const editing = !!avaliacao;

  const [form, setForm] = useState({
    tecnica: avaliacao?.tecnica || "qualitativa",
    metodologia: avaliacao?.metodologia || "",
    norma_referencia: avaliacao?.norma_referencia || "",
    intensidade: avaliacao?.intensidade ?? "",
    unidade_medida: avaliacao?.unidade_medida || "",
    limite_tolerancia: avaliacao?.limite_tolerancia ?? "",
    base_normativa_limite: avaliacao?.base_normativa_limite || "",
    tempo_exposicao_horas: avaliacao?.tempo_exposicao_horas ?? "",
    tempo_medicao_minutos: avaliacao?.tempo_medicao_minutos ?? "",
    data_medicao: avaliacao?.data_medicao || "",
    responsavel_medicao: avaliacao?.responsavel_medicao || "",
    instrumento_marca: avaliacao?.instrumento_marca || "",
    instrumento_modelo: avaliacao?.instrumento_modelo || "",
    instrumento_serie: avaliacao?.instrumento_serie || "",
    instrumento_calibracao_data: avaliacao?.instrumento_calibracao_data || "",
    instrumento_calibracao_validade: avaliacao?.instrumento_calibracao_validade || "",
    enquadramento: avaliacao?.enquadramento || "nao_aplicavel",
    justificativa_qualitativa: avaliacao?.justificativa_qualitativa || "",
    observacoes: avaliacao?.observacoes || "",
    certificado_calibracao_drive_id: avaliacao?.certificado_calibracao_drive_id || "",
    certificado_calibracao_link: avaliacao?.certificado_calibracao_link || "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const intensidadeNum = form.intensidade !== "" ? Number(form.intensidade) : null;
  const limiteNum = form.limite_tolerancia !== "" ? Number(form.limite_tolerancia) : null;
  const acimaLimite = intensidadeNum != null && limiteNum != null && intensidadeNum > limiteNum;
  const semLimite = form.tecnica === "quantitativa" && (limiteNum == null || isNaN(limiteNum));

  const uploadCert = async (file: File) => {
    setUploading(true);
    try {
      const folder = `LTCAT/v${ltcatVersao}/Avaliacoes/${avaliacao?.id || "novo"}`;
      const res = await uploadToDrive(file, folder, file.name, { makePublic: false });
      setForm({
        ...form,
        certificado_calibracao_drive_id: res.fileId,
        certificado_calibracao_link: res.webViewLink,
      });
      toast.success("Certificado enviado ao Google Drive");
    } catch (e: any) {
      toast.error(e.message || "Falha no upload");
    } finally { setUploading(false); }
  };

  const save = async () => {
    if (form.tecnica === "qualitativa" && !form.justificativa_qualitativa.trim()) {
      toast.error("Avaliação qualitativa exige justificativa técnica"); return;
    }
    if (form.tecnica === "quantitativa" && intensidadeNum == null) {
      toast.error("Avaliação quantitativa exige intensidade/concentração"); return;
    }
    setSaving(true);
    try {
      const payload: any = {
        ltcat_id: ltcatId, empresa_id: empresaId,
        agente_id: agenteId, grupo_homogeneo_id: gheId,
        tecnica: form.tecnica,
        metodologia: form.metodologia.trim() || null,
        norma_referencia: form.norma_referencia.trim() || null,
        intensidade: intensidadeNum,
        unidade_medida: form.unidade_medida.trim() || null,
        limite_tolerancia: limiteNum,
        base_normativa_limite: form.base_normativa_limite.trim() || null,
        tempo_exposicao_horas: form.tempo_exposicao_horas !== "" ? Number(form.tempo_exposicao_horas) : null,
        tempo_medicao_minutos: form.tempo_medicao_minutos !== "" ? Number(form.tempo_medicao_minutos) : null,
        data_medicao: form.data_medicao || null,
        responsavel_medicao: form.responsavel_medicao.trim() || null,
        instrumento_marca: form.instrumento_marca.trim() || null,
        instrumento_modelo: form.instrumento_modelo.trim() || null,
        instrumento_serie: form.instrumento_serie.trim() || null,
        instrumento_calibracao_data: form.instrumento_calibracao_data || null,
        instrumento_calibracao_validade: form.instrumento_calibracao_validade || null,
        enquadramento: form.enquadramento,
        justificativa_qualitativa: form.justificativa_qualitativa.trim() || null,
        observacoes: form.observacoes.trim() || null,
        certificado_calibracao_drive_id: form.certificado_calibracao_drive_id || null,
        certificado_calibracao_link: form.certificado_calibracao_link || null,
      };
      if (editing) {
        const { error } = await (supabase.from as any)("ltcat_avaliacoes")
          .update(payload).eq("id", avaliacao.id);
        if (error) throw error;
        toast.success("Avaliação atualizada");
      } else {
        const { error } = await (supabase.from as any)("ltcat_avaliacoes")
          .insert({ ...payload, created_by: user?.id });
        if (error) throw error;
        toast.success("Avaliação adicionada");
      }
      qc.invalidateQueries({ queryKey: ["ltcat-aa", ltcatId] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar avaliação" : "Nova avaliação"}</DialogTitle>
          <DialogDescription>EPI/EPC não neutralizam exposição automaticamente — registre justificativa quando aplicável.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Técnica *</Label>
            <Select value={form.tecnica} onValueChange={(v) => setForm({ ...form, tecnica: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="qualitativa">Qualitativa</SelectItem>
                <SelectItem value="quantitativa">Quantitativa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Enquadramento previdenciário</Label>
            <Select value={form.enquadramento} onValueChange={(v) => setForm({ ...form, enquadramento: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nao_aplicavel">Não aplicável</SelectItem>
                <SelectItem value="habitual_permanente">Habitual e permanente</SelectItem>
                <SelectItem value="intermitente">Intermitente</SelectItem>
                <SelectItem value="eventual">Eventual</SelectItem>
                <SelectItem value="neutralizado_epi">Neutralizado por EPI (com justificativa)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Metodologia / técnica de avaliação</Label>
            <Textarea rows={2} value={form.metodologia} onChange={(e) => setForm({ ...form, metodologia: e.target.value })}
              placeholder="Ex.: NHO-01 (dosimetria); NHO-06 (calor); NR-15 Anexo 11..." />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Norma ou referência utilizada</Label>
            <Input value={form.norma_referencia} onChange={(e) => setForm({ ...form, norma_referencia: e.target.value })} />
          </div>

          <div className="md:col-span-2 border-t pt-2 text-xs font-semibold text-muted-foreground">Medição quantitativa</div>
          <div>
            <Label className="text-xs">Intensidade / concentração</Label>
            <Input type="number" step="any" value={form.intensidade}
              onChange={(e) => setForm({ ...form, intensidade: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Unidade de medida</Label>
            <Input value={form.unidade_medida} onChange={(e) => setForm({ ...form, unidade_medida: e.target.value })}
              placeholder="dB(A), ppm, mg/m³, °C, lux..." />
          </div>
          <div>
            <Label className="text-xs">Limite de tolerância</Label>
            <Input type="number" step="any" value={form.limite_tolerancia}
              onChange={(e) => setForm({ ...form, limite_tolerancia: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Base normativa do limite</Label>
            <Input value={form.base_normativa_limite}
              onChange={(e) => setForm({ ...form, base_normativa_limite: e.target.value })}
              placeholder="NR-15 Anexo 1, NHO-01, ACGIH..." />
          </div>
          <div>
            <Label className="text-xs">Tempo de exposição (h/jornada)</Label>
            <Input type="number" step="any" value={form.tempo_exposicao_horas}
              onChange={(e) => setForm({ ...form, tempo_exposicao_horas: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Tempo de medição (min)</Label>
            <Input type="number" step="any" value={form.tempo_medicao_minutos}
              onChange={(e) => setForm({ ...form, tempo_medicao_minutos: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Data da medição</Label>
            <Input type="date" value={form.data_medicao}
              onChange={(e) => setForm({ ...form, data_medicao: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Responsável pela medição</Label>
            <Input value={form.responsavel_medicao}
              onChange={(e) => setForm({ ...form, responsavel_medicao: e.target.value })} />
          </div>

          {(acimaLimite || semLimite) && (
            <div className="md:col-span-2 text-sm rounded-md p-2 bg-amber-100 text-amber-900 border border-amber-300">
              {acimaLimite && <div>⚠️ Intensidade <strong>acima</strong> do limite de tolerância informado.</div>}
              {semLimite && <div>⚠️ Avaliação quantitativa sem limite de tolerância definido — exige análise técnica.</div>}
            </div>
          )}

          <div className="md:col-span-2 border-t pt-2 text-xs font-semibold text-muted-foreground">Instrumento / calibração</div>
          <div>
            <Label className="text-xs">Marca</Label>
            <Input value={form.instrumento_marca} onChange={(e) => setForm({ ...form, instrumento_marca: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Modelo</Label>
            <Input value={form.instrumento_modelo} onChange={(e) => setForm({ ...form, instrumento_modelo: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Nº de série</Label>
            <Input value={form.instrumento_serie} onChange={(e) => setForm({ ...form, instrumento_serie: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Data da calibração</Label>
            <Input type="date" value={form.instrumento_calibracao_data}
              onChange={(e) => setForm({ ...form, instrumento_calibracao_data: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Validade da calibração</Label>
            <Input type="date" value={form.instrumento_calibracao_validade}
              onChange={(e) => setForm({ ...form, instrumento_calibracao_validade: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Certificado (Drive privado)</Label>
            <div className="flex gap-1 items-center">
              <Input type="file" disabled={uploading || !editing}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCert(f); }} />
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
            {form.certificado_calibracao_link && (
              <a href={form.certificado_calibracao_link} target="_blank" rel="noreferrer"
                 className="inline-flex items-center text-xs text-primary underline mt-1">
                <ExternalLink className="h-3 w-3 mr-1" /> Abrir certificado
              </a>
            )}
            {!editing && (
              <p className="text-xs text-muted-foreground mt-1">Salve a avaliação primeiro para anexar o certificado.</p>
            )}
          </div>

          {form.tecnica === "qualitativa" && (
            <div className="md:col-span-2">
              <Label className="text-xs">Justificativa técnica da avaliação qualitativa *</Label>
              <Textarea rows={3} value={form.justificativa_qualitativa}
                onChange={(e) => setForm({ ...form, justificativa_qualitativa: e.target.value })}
                placeholder="Justificativa técnica fundamentada (por que não foi quantitativa, base normativa, etc.)" />
            </div>
          )}

          <div className="md:col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
