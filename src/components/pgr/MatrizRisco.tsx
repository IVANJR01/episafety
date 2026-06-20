import { classificarRisco, CLASSE_BG, CLASSE_LABEL, SEVERIDADE_LABEL, PROBABILIDADE_LABEL } from "@/lib/pgrMatriz";

interface Props {
  severidade?: number;
  probabilidade?: number;
  onSelect?: (sev: number, prob: number) => void;
  compact?: boolean;
}

export default function MatrizRisco({ severidade, probabilidade, onSelect, compact }: Props) {
  const sevs = [5, 4, 3, 2, 1];
  const probs = [1, 2, 3, 4, 5];
  return (
    <div className="inline-block">
      <div className="text-xs text-muted-foreground mb-1 text-center">Probabilidade →</div>
      <div className="flex items-stretch">
        <div className="flex flex-col items-center justify-center pr-2 text-xs text-muted-foreground" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
          Severidade →
        </div>
        <table className="border-collapse">
          <tbody>
            {sevs.map((s) => (
              <tr key={s}>
                <td className="text-[10px] text-muted-foreground pr-1 text-right">{s}</td>
                {probs.map((p) => {
                  const cls = classificarRisco(s, p);
                  const isSel = s === severidade && p === probabilidade;
                  const sz = compact ? "w-7 h-7 text-[10px]" : "w-10 h-10 text-xs";
                  return (
                    <td key={p} className="p-0.5">
                      <button
                        type="button"
                        onClick={() => onSelect?.(s, p)}
                        title={`Sev ${s} (${SEVERIDADE_LABEL[s]}) × Prob ${p} (${PROBABILIDADE_LABEL[p]}) = ${s*p} · ${CLASSE_LABEL[cls]}`}
                        className={`${sz} ${CLASSE_BG[cls]} text-white font-semibold rounded ${isSel ? "ring-2 ring-offset-1 ring-foreground" : "opacity-80 hover:opacity-100"} ${onSelect ? "cursor-pointer" : "cursor-default"}`}
                      >
                        {s * p}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td></td>
              {probs.map((p) => (
                <td key={p} className="text-[10px] text-muted-foreground text-center">{p}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
