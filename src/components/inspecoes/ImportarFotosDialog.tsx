import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { uploadInspecaoPhoto } from "@/lib/inspecoesStorage";

type Alvo = { id: string; numero: number; temFoto: boolean };

type Resultado = { numero: number; arquivo: string; ok: boolean; motivo?: string };

/**
 * Anexa várias fotos de uma vez, casando pelo número da inspeção.
 *
 * Serve para quem tem as evidências guardadas fora do sistema — de um relatório
 * antigo, do celular, de uma pasta do computador — e teria de abrir inspeção por
 * inspeção para subir cada uma. O nome do arquivo diz a qual pertence: qualquer
 * nome que contenha o número serve, como `insp_003.jpg`, `3.jpg` ou
 * `inspecao 03 - quadro.jpg`.
 */
export default function ImportarFotosDialog({
  open, onOpenChange, alvos, empresaId, onConcluido,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Inspeções da empresa ativa, para casar pelo número. */
  alvos: Alvo[];
  empresaId: string | null;
  onConcluido: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState({ feitos: 0, total: 0 });
  const [resultados, setResultados] = useState<Resultado[]>([]);

  /** Primeiro número do nome do arquivo: "insp_003.jpg" -> 3. */
  const numeroDoArquivo = (nome: string) => {
    const m = nome.replace(/\.[a-z0-9]+$/i, "").match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  };

  async function importar(arquivos: FileList | null) {
    if (!arquivos?.length || !empresaId) return;
    setEnviando(true);
    setResultados([]);
    const lista = Array.from(arquivos);
    setProgresso({ feitos: 0, total: lista.length });
    const saida: Resultado[] = [];
    // A lista de alvos é um retrato de antes do envio; sem marcar o que já foi
    // feito nesta rodada, dois arquivos do mesmo número subiriam os dois.
    const jaFeitos = new Set<number>();

    for (const arquivo of lista) {
      const num = numeroDoArquivo(arquivo.name);
      const alvo = num == null ? undefined : alvos.find((a) => a.numero === num);
      if (num != null && jaFeitos.has(num)) {
        saida.push({ numero: num, arquivo: arquivo.name, ok: false, motivo: `a inspeção nº ${num} já recebeu outra foto deste lote` });
      } else if (!alvo) {
        saida.push({
          numero: num ?? 0, arquivo: arquivo.name, ok: false,
          motivo: num == null ? "sem número no nome do arquivo" : `não existe inspeção nº ${num}`,
        });
      } else if (alvo.temFoto) {
        // Não sobrescreve o que já está lá: quem quiser trocar usa a tela do item.
        saida.push({ numero: num!, arquivo: arquivo.name, ok: false, motivo: "já tem foto ANTES" });
      } else {
        try {
          const { path } = await uploadInspecaoPhoto(arquivo, empresaId, alvo.id, "antes");
          const { error } = await (supabase.from as any)("conformidades")
            .update({ foto_antes_path: path }).eq("id", alvo.id);
          if (error) throw error;
          jaFeitos.add(num!);
          saida.push({ numero: num!, arquivo: arquivo.name, ok: true });
        } catch (e) {
          saida.push({
            numero: num!, arquivo: arquivo.name, ok: false,
            motivo: e instanceof Error ? e.message : String(e),
          });
        }
      }
      setProgresso((p) => ({ ...p, feitos: p.feitos + 1 }));
      setResultados([...saida]);
    }

    setEnviando(false);
    onConcluido();
  }

  const anexadas = resultados.filter((r) => r.ok).length;
  const falhas = resultados.filter((r) => !r.ok);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!enviando) onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Importar fotos em lote</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Escolha os arquivos de uma vez. Cada foto vai para a inspeção cujo número aparece no
            nome do arquivo — <span className="font-mono text-xs">insp_003.jpg</span> vai para a
            inspeção nº 3. Inspeções que já têm foto ANTES não são alteradas.
          </p>

          <div>
            <Label
              htmlFor="importar-fotos"
              className="flex min-h-[64px] cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-4 text-sm hover:bg-accent"
            >
              {enviando
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando {progresso.feitos} de {progresso.total}…</>
                : <><Upload className="h-4 w-4" /> Escolher as fotos</>}
            </Label>
            <input
              id="importar-fotos" type="file" accept="image/*" multiple className="sr-only"
              disabled={enviando}
              onChange={(e) => { void importar(e.target.files); e.currentTarget.value = ""; }}
            />
          </div>

          {resultados.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span><strong>{anexadas}</strong> foto(s) anexada(s)</span>
              </div>
              {falhas.length > 0 && (
                <div className="rounded border bg-muted/40 p-2 text-xs space-y-1 max-h-48 overflow-y-auto">
                  <div className="flex items-center gap-1 font-medium">
                    <AlertCircle className="h-3.5 w-3.5" /> {falhas.length} não anexada(s):
                  </div>
                  {falhas.map((f, i) => (
                    <div key={i} className="text-muted-foreground">
                      <span className="font-mono">{f.arquivo}</span> — {f.motivo}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>
              {resultados.length ? "Fechar" : "Cancelar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
