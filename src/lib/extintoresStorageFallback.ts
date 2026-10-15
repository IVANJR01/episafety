export function isTableMissingError(err: any): boolean {
  if (!err) return false;
  const msg = typeof err === "string" ? err : err.message || "";
  const code = err.code || "";
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    msg.includes("Could not find the table") ||
    msg.includes("relation") && msg.includes("does not exist") ||
    msg.includes("schema cache")
  );
}

function getStorageKey(empresaId: string): string {
  return `episafety_extintores_${empresaId}`;
}

export function carregarExtintoresLocal(empresaId: string): any[] {
  if (typeof window === "undefined" || !empresaId) return [];
  try {
    const raw = localStorage.getItem(getStorageKey(empresaId));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function salvarExtintorLocal(empresaId: string, extData: any): any {
  if (typeof window === "undefined" || !empresaId) return extData;
  try {
    const lista = carregarExtintoresLocal(empresaId);
    let itemSalvo: any;

    if (extData.id) {
      // Atualização
      const idx = lista.findIndex((e) => e.id === extData.id);
      itemSalvo = {
        ...extData,
        updated_at: new Date().toISOString(),
      };
      if (idx >= 0) {
        lista[idx] = itemSalvo;
      } else {
        lista.push(itemSalvo);
      }
    } else {
      // Criação
      itemSalvo = {
        ...extData,
        id: crypto.randomUUID(),
        qr_token: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      lista.push(itemSalvo);
    }

    localStorage.setItem(getStorageKey(empresaId), JSON.stringify(lista));
    return itemSalvo;
  } catch (err) {
    console.warn("Falha ao salvar extintor no fallback local:", err);
    return extData;
  }
}

export function excluirExtintorLocal(empresaId: string, id: string): boolean {
  if (typeof window === "undefined" || !empresaId) return false;
  try {
    const lista = carregarExtintoresLocal(empresaId).filter((e) => e.id !== id);
    localStorage.setItem(getStorageKey(empresaId), JSON.stringify(lista));
    return true;
  } catch {
    return false;
  }
}
