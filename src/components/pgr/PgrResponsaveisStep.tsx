import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Edit2, Loader2, PenLine, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  PGR_PAPEL_LABEL, PgrResponsavel, PgrResponsavelPapel,
} from "@/lib/pgrTypes";

interface Props {
  pgrId: string;
  empresaId: string;
  canEdit: boolean;
}

const vazio = {
  papel: "responsavel_tecnico" as PgrResponsavelPapel,
  nome: "", cpf: "", profissao: "", registro_profissional: "",
  uf_registro: "", numero_art: "", email: "", telefone: "", ordem: 1,
};

export default function PgrResponsaveisStep({ pgrId, empresaId, canEdit }: Props) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(vazio);

  const { data: resps = [], isLoading } = useQuery({
    queryKey: ["pgr-responsaveis-step", pgrId],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("pgr_responsaveis")
        .select("*").eq("pgr_id", pgrId).order("ordem");
      if (error) throw error;
      return (data || []) as PgrResponsavel[];
    },
  });

  const { data: assinaturas = [] } = useQuery({
    queryKey: ["pgr-assin-step", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_assinaturas")
        .select("*").eq("pgr_id", pgrId).order("assinado_em", { ascending: false });
      return (data || []) as any[];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (form.nome.trim().length < 3) throw new Error("Informe o nome completo.");
      const payload = {
        pgr_id: pgrId, empresa_id: empresaId,
        papel: form.papel,
        nome: form.nome.trim(),
        cpf: form.cpf.trim() || null,
        profissao: form.profissao.trim() || null,
        registro_profissional: form.registro_profissional.trim() || null,
        uf_registro: form.uf_registro.trim().toUpperCase() || null,
        numero_art: form.numero_art.trim() || null,
        email: form.email.trim() || null,
        telefone: form.telefone.trim() || null,
        ordem: Number(form.ordem) || 1,
      };
      const q = editId
        ? (supabase.from as any)("pgr_responsaveis").update(payload).eq("id", editId)
        : (supabase.from as any)("pgr_responsaveis").insert(payload);
      const { error } = await q;
      if (error) throw error;

      // Mantém resp_tec_nome/registro em pgr_documentos espelhando o RT de menor
      // ordem: telas e PDFs antigos ainda leem dessas colunas.
      if (form.papel === "responsavel_tecnico") {
        const { data: primeiro } = await (supabase.from as any)("pgr_responsaveis")
          .select("nome,registro_profissional")
          .eq("pgr_id", pgrId).eq("papel", "responsavel_tecnico")
          .order("ordem").limit(1).maybeSingle();
        if (primeiro) {
          await (supabase.from as any)("pgr_documentos").update({
            resp_tec_nome: primeiro.nome,
            resp_tec_registro: primeiro.registro_profissional,
          }).eq("id", pgrId);
        }
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Responsável atualizado" : "Responsável adicionado");
      qc.invalidateQueries({ queryKey: ["pgr-responsaveis-step", pgrId] });
      qc.invalidateQueries({ queryKey: ["pgr-detalhe", pgrId] });
      setAberto(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)("pgr_responsaveis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pgr-responsaveis-step", pgrId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const abrirNovo = () => {
    setEditId(null);
    setForm({ ...vazio, ordem: resps.length + 1 });
    setAberto(true);
  };
  const abrirEdicao = (r: PgrResponsavel) => {
    setEditId(r.id);
    setForm({
      papel: r.papel, nome: r.nome, cpf: r.cpf || "", profissao: r.profissao || "",
      registro_profissional: r.registro_profissional || "", uf_registro: r.uf_registro || "",
      numero_art: r.numero_art || "", email: r.email || "", telefone: r.telefone || "",
      ordem: r.ordem,
    });
    setAberto(true);
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando responsáveis…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        O documento precisa ser datado e assinado por profissional habilitado. Cadastre quem
        elaborou, quem revisou tecnicamente e quem aprova pela organização — todos aparecem na
        tabela de habilitação técnica e no encerramento do PDF.
      </p>

      {canEdit && (
        <Button size="sm" onClick={abrirNovo}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar responsável
        </Button>
      )}

      {resps.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Nenhum responsável cadastrado. É pendência bloqueante para emitir o PGR.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {resps.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.nome}</span>
                    <Badge variant="outline" className="text-[11px]">
                      {PGR_PAPEL_LABEL[r.papel] || r.papel}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">ordem {r.ordem}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[
                      r.profissao,
                      r.registro_profissional
                        && `Registro ${r.registro_profissional}${r.uf_registro ? `/${r.uf_registro}` : ""}`,
                      r.numero_art && `ART ${r.numero_art}`,
                      r.cpf && `CPF ${r.cpf}`,
                    ].filter(Boolean).join("  ·  ") || "Sem dados profissionais informados"}
                  </p>
                  {(r.email || r.telefone) && (
                    <p className="text-[11px] text-muted-foreground">
                      {[r.email, r.telefone].filter(Boolean).join("  ·  ")}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => abrirEdicao(r)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => excluir.mutate(r.id)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
          <PenLine className="h-4 w-4" /> Assinaturas registradas
        </h3>
        {assinaturas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma assinatura ainda. A assinatura visual é feita na etapa de emissão, sobre o
            PDF gerado — ela vincula nome, registro e o hash do arquivo.
          </p>
        ) : (
          <div className="space-y-2">
            {assinaturas.map((a) => (
              <Card key={a.id}>
                <CardContent className="p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{a.responsavel_nome}</span>
                    {a.responsavel_registro && (
                      <span className="text-xs text-muted-foreground">{a.responsavel_registro}</span>
                    )}
                    <Badge variant="outline" className="text-[11px]">PDF v{a.pdf_versao}</Badge>
                    {a.mfa_verificado && (
                      <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[11px]">
                        MFA
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {new Date(a.assinado_em).toLocaleString("pt-BR")} · hash {String(a.pdf_hash).slice(0, 16)}…
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar responsável" : "Novo responsável"}</DialogTitle>
            <DialogDescription>
              O papel define onde a pessoa aparece no documento e no fluxo de aprovação.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Papel *</Label>
                <Select value={form.papel} onValueChange={(v) => setForm({ ...form, papel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PGR_PAPEL_LABEL) as PgrResponsavelPapel[]).map((p) => (
                      <SelectItem key={p} value={p}>{PGR_PAPEL_LABEL[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Ordem de exibição</Label>
                <Input type="number" min={1} value={form.ordem}
                  onChange={(e) => setForm({ ...form, ordem: e.target.value })} />
              </div>
            </div>

            <div>
              <Label className="text-xs">Nome completo *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Profissão</Label>
                <Input value={form.profissao}
                  onChange={(e) => setForm({ ...form, profissao: e.target.value })}
                  placeholder="Eng. de Segurança do Trabalho" />
              </div>
              <div>
                <Label className="text-xs">CPF</Label>
                <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Registro profissional</Label>
                <Input value={form.registro_profissional}
                  onChange={(e) => setForm({ ...form, registro_profissional: e.target.value })}
                  placeholder="CREA / CRM" />
              </div>
              <div>
                <Label className="text-xs">UF do registro</Label>
                <Input maxLength={2} value={form.uf_registro}
                  onChange={(e) => setForm({ ...form, uf_registro: e.target.value.toUpperCase().slice(0, 2) })} />
              </div>
              <div>
                <Label className="text-xs">Nº da ART</Label>
                <Input value={form.numero_art}
                  onChange={(e) => setForm({ ...form, numero_art: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {salvar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
