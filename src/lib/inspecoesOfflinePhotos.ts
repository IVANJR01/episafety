// Armazenamento offline de fotos de inspeção em IndexedDB (via idb-keyval).
// Evita perder evidência fotográfica quando o navegador limpa o localStorage
// antes da fila de sync ser processada.
//
// Uso:
//   - Ao salvar offline uma inspeção com foto, chamamos saveOfflinePhoto(...)
//     e guardamos apenas um marcador ("idbphoto://<chave>") dentro do payload
//     que vai para a sync queue no localStorage.
//   - O worker de sync (useOfflineSync) detecta o marcador, lê o blob do IDB,
//     faz o upload para o bucket privado `inspecoes-fotos` e limpa o IDB.

import { createStore, set, get, del, keys } from "idb-keyval";

const store = createStore("safety-inspecoes-fotos", "photos");

export const IDB_PHOTO_MARKER_PREFIX = "idbphoto://";

export function isOfflinePhotoMarker(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(IDB_PHOTO_MARKER_PREFIX);
}

function buildKey(recordId: string, label: "antes" | "depois"): string {
  return `${recordId}__${label}`;
}

function keyFromMarker(marker: string): string {
  return marker.slice(IDB_PHOTO_MARKER_PREFIX.length);
}

/** Salva um blob no IDB e devolve o marcador a ser gravado no payload offline. */
export async function saveOfflinePhoto(
  recordId: string,
  label: "antes" | "depois",
  data: Blob,
): Promise<string> {
  const key = buildKey(recordId, label);
  await set(key, data, store);
  return `${IDB_PHOTO_MARKER_PREFIX}${key}`;
}

/** Converte um data URL (Base64) em Blob e persiste no IDB. */
export async function saveOfflinePhotoFromDataUrl(
  recordId: string,
  label: "antes" | "depois",
  dataUrl: string,
): Promise<string> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return saveOfflinePhoto(recordId, label, blob);
}

export async function getOfflinePhotoBlob(marker: string): Promise<Blob | null> {
  if (!isOfflinePhotoMarker(marker)) return null;
  const key = keyFromMarker(marker);
  const val = (await get<Blob>(key, store)) || null;
  return val;
}

export async function deleteOfflinePhoto(marker: string): Promise<void> {
  if (!isOfflinePhotoMarker(marker)) return;
  const key = keyFromMarker(marker);
  try {
    await del(key, store);
  } catch {
    // ignora — melhor esforço
  }
}

/** Utilitário para diagnóstico/limpeza (não usado em produção). */
export async function listOfflinePhotoKeys(): Promise<string[]> {
  try {
    return (await keys(store)) as string[];
  } catch {
    return [];
  }
}
