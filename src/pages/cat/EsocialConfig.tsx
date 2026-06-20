import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import MfaActionButton from "@/components/cat/MfaActionButton";
import { toast } from "sonner";
import {
  Settings2, ShieldAlert, AlertTriangle, FileSearch, CheckCircle2,
  Loader2, Save, Database, MapPin, Stethoscope,
} from "lucide-react";

const CATALOGOS: { key: string; label: string; table: string }[] = [
  { key: "partes", label: "Partes atingidas (T13)", table: "cat_partes_atingidas" },
  { key: "agentes", label: "Agentes causadores (T14)", table: "cat_agentes_causadores" },
  { key: "naturezas", label: "Naturezas da lesão (T15)", table: "cat_naturezas_lesao" },
  { key: "situacoes", label: "Situações geradoras (T16)", table: "cat_situacoes_geradoras" },
];

export default function EsocialConfig() {
  const { isSuperAdmin, isPrincipal, modulosPermitidos, activeEmpresaId } = useAuth() as any;
  const qc = useQueryClient();
  const canEdit =
    isSuperAdmin || isPrincipal ||
    modulosPermitidos.includes("cat:esocial") ||
    modulosPermitidos.includes("cat");

  const empresaId = activeEmpresaId;

  // ---------------- config ----------------
  const [form, setForm] = useState({
    tp_amb: "homologacao",
    ver_proc: "EpiSafety-1.0",
    tp_insc: "1",
    nr_insc: "",
    cnpj_raiz: "",
    certificado_alias: "",
    certificado_validade: "",
    ativo: true,
    observacoes: "",
  });
  const [saving, setSaving] = useState(false);

  const { data: cfg } = useQuery({
    queryKey: ["esocial-config-page", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("esocial_config")
        .select("*").eq("empresa_id", empresaId).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (cfg) {
      setForm({
        tp_amb: cfg.tp_amb || "homologacao",
        ver_proc: cfg.ver_proc || "EpiSafety-1.0",
        tp_insc: String(cfg.tp_insc || 1),
        nr_insc: cfg.nr_insc || "",
        cnpj_raiz: cfg.cnpj_raiz || "",
        certificado_alias: cfg.certificado_alias || "",
        certificado_validade: cfg.certificado_validade || "",
        ativo: cfg.ativo ?? true,
        observacoes: cfg.observacoes || "",
      });
    }
  }, [cfg]);

  const salvar = async () => {
    if (!empresaId) { toast.error("Selecione uma empresa ativa"); return; }
    setSaving(true);
    try {
      const { error } = await (supabase.rpc as any)("esocial_config_upsert", {
        _payload: { empresa_id: empresaId, ...form, tp_insc: parseInt(form.tp_insc, 10) },
      });
      if (error) throw error;
      toast.success("Configuração eSocial salva");
      qc.invalidateQueries({ queryKey: ["esocial-config-page", empresaId] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally { setSaving(false); }
  };

  // ---------------- catálogos / mapeamentos ----------------
  const [catKey, setCatKey] = useState("partes");
  const [filtro, setFiltro] = useState<"todos" | "pendentes" | "mapeados">("todos");
  const cat = CATALOGOS.find((c) => c.key === catKey)!;

  const { data: itens = [], refetch: refetchCat } = useQuery({
    queryKey: ["esocial-cat-map", cat.table],
    queryFn: async () => {
      const { data } = await (supabase.from as any)(cat.table)
        .select("id, codigo, codigo_esocial, descricao, ativo")
        .order("codigo");
      return data || [];
    },
  });

  const filtered = itens.filter((i: any) => {
    if (filtro === "pendentes") return !i.codigo_esocial;
    if (filtro === "mapeados") return !!i.codigo_esocial;
    return true;
  });

  const totalPendentes = itens.filter((i: any) => !i.codigo_esocial).length;

  const salvarMapeamento = async (id: string, novoCodigo: string) => {
    const v = (novoCodigo || "").trim() || null;
    const { error } = await (supabase.from as any)(cat.table).update({ codigo_esocial: v }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Mapeamento atualizado"); refetchCat(); }
  };

  // ---------------- bases referenciais ----------------
  const { data: bases } = useQuery({
    queryKey: ["esocial-bases-counts"],
    queryFn: async () => {
      const [a, b] = await Promise.all([
        (supabase.from as any)("esocial_cid10").select("codigo", { count: "exact", head: true }),
        (supabase.from as any)("esocial_municipios_ibge").select("codigo", { count: "exact", head: true }),
      ]);
      return { cid: a.count ?? 0, municipios: b.count ?? 0 };
    },
  });

  if (!canEdit) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card><CardContent className="p-6 flex items-center gap-3">
          <ShieldAlert className="h-5 w-5" />
          <span>Sem permissão <code className="font-mono">cat:esocial</code>.</span>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 max-w-6xl">
      <div className="flex items-center gap-2">
        <Settings2 className="h-5 w-5" />
        <h1 className="text-xl font-semibold">eSocial — Configuração & Mapeamentos</h1>
        <Badge variant="destructive" className="text-[10px]">Nenhum envio real</Badge>
      </div>

      <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-300 p-3 text-sm text-amber-900 dark:text-amber-200 flex gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <strong>Certificado digital ICP-Brasil ainda não implementado.</strong> Esta tela apenas prepara
          ambiente, identificação do empregador e mapeamentos. Nada é transmitido ao Ambiente Nacional.
        </div>
      </div>

      <Tabs defaultValue="config" className="w-full">
        <TabsList>
          <TabsTrigger value="config"><Settings2 className="h-4 w-4 mr-1" /> Configuração</TabsTrigger>
          <TabsTrigger value="mapeamentos">
            <FileSearch className="h-4 w-4 mr-1" /> Mapeamentos
            {totalPendentes > 0 && <Badge variant="outline" className="ml-2 text-[10px]">{totalPendentes} pend.</Badge>}
          </TabsTrigger>
          <TabsTrigger value="bases"><Database className="h-4 w-4 mr-1" /> Bases</TabsTrigger>
        </TabsList>

        {/* CONFIG */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Configuração da empresa ativa</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Ambiente</Label>
                <Select value={form.tp_amb} onValueChange={(v) => setForm({ ...form, tp_amb: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="homologacao">Homologação</SelectItem>
                    <SelectItem value="producao">Produção restrita / Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Versão layout</Label>
                <Input value={form.ver_proc} onChange={(e) => setForm({ ...form, ver_proc: e.target.value })} />
              </div>
              <div>
                <Label>Tipo de inscrição</Label>
                <Select value={form.tp_insc} onValueChange={(v) => setForm({ ...form, tp_insc: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 — CNPJ</SelectItem>
                    <SelectItem value="2">2 — CPF</SelectItem>
                    <SelectItem value="3">3 — CAEPF</SelectItem>
                    <SelectItem value="4">4 — CNO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Número da inscrição</Label>
                <Input value={form.nr_insc} onChange={(e) => setForm({ ...form, nr_insc: e.target.value.replace(/\D/g, "").slice(0, 14) })} placeholder="Somente dígitos" inputMode="numeric" />
              </div>
              <div>
                <Label>CNPJ raiz (8 dígitos)</Label>
                <Input value={form.cnpj_raiz} onChange={(e) => setForm({ ...form, cnpj_raiz: e.target.value.replace(/\D/g, "").slice(0, 14) })} placeholder="Primeiros 8 dígitos do CNPJ" inputMode="numeric" />
              </div>
              <div>
                <Label>Alias do certificado (preparação)</Label>
                <Input value={form.certificado_alias} onChange={(e) => setForm({ ...form, certificado_alias: e.target.value })} placeholder="ex: ACME-A1-2026" />
              </div>
              <div>
                <Label>Validade do certificado</Label>
                <Input type="date" value={form.certificado_validade} onChange={(e) => setForm({ ...form, certificado_validade: e.target.value })} />
              </div>
              <div className="flex items-end gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                  <Label>Configuração ativa</Label>
                </div>
              </div>
              <div className="md:col-span-2">
                <Label>Observações</Label>
                <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} />
              </div>
              <div className="md:col-span-2 rounded-md bg-muted p-2 text-xs flex gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                Senha de certificado e arquivo .pfx <strong>não são armazenados</strong>. Implementação de
                assinatura ICP-Brasil e cliente SOAP ficam para fase posterior.
              </div>
              <div className="md:col-span-2 flex justify-end">
                <MfaActionButton onClick={salvar} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  Salvar configuração
                </MfaActionButton>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MAPEAMENTOS */}
        <TabsContent value="mapeamentos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                Mapeamento código interno → código oficial eSocial
                {totalPendentes > 0 && <Badge variant="destructive">{totalPendentes} pendente(s)</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Select value={catKey} onValueChange={setCatKey}>
                  <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATALOGOS.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filtro} onValueChange={(v: any) => setFiltro(v)}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pendentes">Apenas pendentes</SelectItem>
                    <SelectItem value="mapeados">Apenas mapeados</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Interno</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-44">Código eSocial</TableHead>
                      <TableHead className="w-28">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((i: any) => (
                      <TableRow key={i.id}>
                        <TableCell className="font-mono text-xs">{i.codigo}</TableCell>
                        <TableCell className="text-sm">{i.descricao}</TableCell>
                        <TableCell>
                          <Input
                            defaultValue={i.codigo_esocial || ""}
                            placeholder="ex: 100"
                            className="h-8 font-mono"
                            onBlur={(e) => {
                              if ((e.target.value || "") !== (i.codigo_esocial || "")) {
                                salvarMapeamento(i.id, e.target.value);
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          {i.codigo_esocial
                            ? <Badge className="text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Mapeado</Badge>
                            : <Badge variant="destructive" className="text-[10px]">Pendente</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhum item</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">
                Edite o código oficial e clique fora do campo para salvar. Pendências bloqueiam a marcação
                "pronto p/ envio real" mas não impedem geração técnica do XML.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BASES */}
        <TabsContent value="bases" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Stethoscope className="h-4 w-4" /> CID-10</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="text-3xl font-bold">{bases?.cid ?? "—"}</div>
                <Badge variant="outline">Base reduzida (capítulos S/T + DORT comuns)</Badge>
                <p className="text-xs text-muted-foreground">
                  Base oficial DATASUS contém ~14.000 códigos. Para envio real ao eSocial expandir
                  via importação CSV oficial.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Municípios IBGE</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="text-3xl font-bold">{bases?.municipios ?? "—"}</div>
                <Badge variant="outline">Base reduzida (capitais + maiores municípios)</Badge>
                <p className="text-xs text-muted-foreground">
                  Base oficial IBGE: 5.570 municípios. Antes de envio real, importar a tabela completa
                  (formato 7 dígitos).
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
