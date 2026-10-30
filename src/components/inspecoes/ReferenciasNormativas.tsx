import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  referenciasNormativas, rotuloCurto, temDescricao,
} from "@/lib/referenciaNormativa";

/**
 * As normas de um apontamento, em etiquetas curtas.
 *
 * O campo guarda o texto que a IA escreveu — linhas como "NR-18 — Item
 * 18.6.10 — Quadros de distribuição devem possuir partes vivas
 * inacessíveis e protegidas." Três dessas ocupavam mais espaço no cartão
 * do que a situação detectada e a ação corretiva, que é o que a pessoa
 * precisa ler.
 *
 * Quem percorre a lista procura a norma pelo código. A frase só
 * interessa quando para naquele item — então ela fica a um toque, e não
 * na frente de todo mundo o tempo todo.
 *
 * Nada é escondido do documento: o PDF continua levando o texto inteiro.
 */
export default function ReferenciasNormativas({
  texto, className = "",
}: { texto?: string | null; className?: string }) {
  const [aberto, setAberto] = useState(false);
  const refs = referenciasNormativas(texto);
  if (refs.length === 0) return null;

  const podeAbrir = temDescricao(refs);

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {refs.map((r, i) => (
        <span
          key={`${r.textoCompleto}-${i}`}
          title={r.textoCompleto}
          className="inline-flex items-center rounded border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[11px] font-medium text-primary"
        >
          {rotuloCurto(r)}
        </span>
      ))}

      {podeAbrir && (
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          {aberto ? "ocultar" : "ver norma"}
          <ChevronDown className={`h-3 w-3 transition-transform ${aberto ? "rotate-180" : ""}`} />
        </button>
      )}

      {aberto && (
        <ul className="w-full list-none space-y-0.5 pt-1">
          {refs.filter((r) => r.descricao).map((r, i) => (
            <li key={`d-${i}`} className="text-[11px] leading-snug text-muted-foreground">
              <span className="font-medium text-foreground">{rotuloCurto(r)}</span>
              {" — "}{r.descricao}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
