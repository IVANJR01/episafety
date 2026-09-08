/*
 * Escolhe, dentro de um .pfx, qual certificado é o do titular.
 *
 * Um A1 da ICP-Brasil não vem sozinho no arquivo: junto dele vêm os
 * certificados da AC intermediária e da raiz. Pegar o primeiro da lista dá
 * certo no auto-assinado (que só tem um) e erra no certificado de verdade —
 * a validade que apareceria na tela seria a da AC Soluti, que vence em 2029,
 * e o aviso de renovação nunca dispararia.
 *
 * O titular é o único que não emitiu ninguém: se algum outro certificado do
 * arquivo tem como emissor este aqui, então este é uma AC, não a folha.
 *
 * Sem dependência de npm de propósito, para poder ser testado pelo vitest
 * junto com o resto do front.
 */

export interface AtributoDn {
  shortName?: string | null;
  name?: string | null;
  type?: string | null;
  value?: string | null;
}

export interface NomeDn {
  attributes: AtributoDn[];
}

export interface CertificadoLike {
  subject: NomeDn;
  issuer: NomeDn;
  validity: { notAfter: Date };
}

/** Texto canônico de um DN, para comparar emissor com titular. */
export function nomeDistinto(dn: NomeDn | null | undefined): string {
  if (!dn?.attributes?.length) return "";
  return dn.attributes
    .map((a) => `${a.shortName || a.name || a.type || ""}=${a.value ?? ""}`)
    .join(",");
}

/**
 * O certificado do titular: aquele que não é emissor de nenhum outro.
 *
 * Um auto-assinado é emissor de si mesmo, e por isso a comparação ignora o
 * próprio certificado — senão ele seria descartado como se fosse uma AC.
 */
export function escolherFolha<T extends CertificadoLike>(certs: T[]): T | null {
  if (!certs.length) return null;
  const folha = certs.find((c) => {
    const meuSubject = nomeDistinto(c.subject);
    if (!meuSubject) return false;
    return !certs.some((outro) => outro !== c && nomeDistinto(outro.issuer) === meuSubject);
  });
  /*
   * Sem chute quando a regra não decide (cadeia circular, DNs vazios).
   * Devolver "algum" certificado aqui significaria mostrar na tela a validade
   * de uma AC — 2029, tipicamente — no lugar da validade do titular, e o
   * aviso de renovação nunca dispararia. Ficar sem aviso é ruim; dar um
   * "está tudo em dia" falso é pior.
   */
  return folha ?? null;
}

/** Nome legível do titular: o CN, ou o DN inteiro se não houver CN. */
export function titularDe(cert: CertificadoLike | null | undefined): string {
  if (!cert) return "";
  const cn = cert.subject?.attributes?.find(
    (a) => a.shortName === "CN" || a.name === "commonName" || a.type === "2.5.4.3",
  );
  return (cn?.value || nomeDistinto(cert.subject) || "").trim();
}
