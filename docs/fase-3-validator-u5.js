// Fase 3 — Validador automático do __fase3Report para o perfil U5_RH_ONLY.
//
// Uso no DevTools, logado como homolog.u5@gmail.com, APÓS rodar o script de
// teste que popula window.__fase3Report:
//
//   1. Cole este arquivo inteiro no console.
//   2. Rode: validateFase3U5(__fase3Report)
//   3. Veja a tabela colorida + objeto retornado.
//   4. Para copiar: copy(__fase3Validation)

(function () {
  const EMPRESA_A      = "405d9da9-e213-4c25-8522-7d4bdc268dd0";
  const EMPRESA_B      = "d3419ac5-f4fe-4309-bf45-0e104ac04f3a";
  const ASO_LIBERADO_A = "aaaaaaa1-0000-4000-8000-000000000002";

  // Heurística: erro de RLS no PostgREST vem como 42501 (insufficient_privilege)
  // ou mensagem contendo "row-level security" / "permission denied".
  function isRlsDenied(res) {
    if (!res) return false;
    const err = (res.error || "").toString().toLowerCase();
    const code = (res.code || "").toString();
    return (
      code === "42501" ||
      err.includes("row-level security") ||
      err.includes("violates row-level") ||
      err.includes("permission denied") ||
      err.includes("new row violates")
    );
  }

  // Escrita "negada" = erro de RLS OU 0 linhas afetadas (UPDATE/DELETE silenciosos
  // sob RLS). INSERT deve falhar com erro explícito.
  function writeDenied(res, { mustError = false } = {}) {
    if (!res) return { ok: false, why: "sem resposta" };
    if (isRlsDenied(res)) return { ok: true, why: `RLS negou (${res.code || "msg"})` };
    if (mustError) {
      return res.ok === false
        ? { ok: true, why: "operação falhou" }
        : { ok: false, why: "INSERT passou sem erro — RLS aberta" };
    }
    if (typeof res.affected === "number" && res.affected === 0) {
      return { ok: true, why: "0 linhas afetadas" };
    }
    return { ok: false, why: `operação passou (affected=${res.affected ?? "?"})` };
  }

  function check(label, esperado, obtido, ok, detalhe = "") {
    return { label, esperado, obtido, status: ok ? "PASS" : "FAIL", detalhe };
  }

  window.validateFase3U5 = function (report) {
    if (!report) {
      console.error("Passe o __fase3Report. Ex: validateFase3U5(__fase3Report)");
      return null;
    }

    const r = report;
    const checks = [];

    // --- Sessão ---
    checks.push(check(
      "sessao.email = homolog.u5@gmail.com",
      "homolog.u5@gmail.com",
      r.sessao?.email,
      r.sessao?.email === "homolog.u5@gmail.com",
    ));
    const mods = r.sessao?.usuarios_liberados?.modulos_permitidos || [];
    const hasRh = mods.some((m) => m === "portal_rh" || m.startsWith?.("portal_rh"));
    checks.push(check(
      "usuarios_liberados.modulos_permitidos contém portal_rh*",
      "portal_rh ou portal_rh:*",
      mods.join(","),
      hasRh,
    ));

    // --- Leitura ---
    const libA = r.leitura?.aso_liberado_A;
    checks.push(check(
      "aso_liberado_A.count = 1 (Empresa A liberado visível)",
      1, libA?.count, libA?.count === 1,
      libA?.rows?.[0]?.empresa_id && libA.rows[0].empresa_id !== EMPRESA_A
        ? `empresa_id devolvida=${libA.rows[0].empresa_id} ≠ EMPRESA_A` : "",
    ));
    const rascA = r.leitura?.aso_rascunho_A;
    checks.push(check(
      "aso_rascunho_A.count = 0 (rascunho invisível p/ RH)",
      0, rascA?.count, rascA?.count === 0,
    ));
    const empB = r.leitura?.aso_empresa_B;
    checks.push(check(
      "aso_empresa_B.count = 0 (cross-tenant bloqueado)",
      0, empB?.count, empB?.count === 0,
    ));
    const listB = r.leitura?.list_empresa_B;
    checks.push(check(
      "list_empresa_B.count = 0 (listagem cross-tenant bloqueada)",
      0, listB?.count, listB?.count === 0,
    ));

    // --- Escrita (tudo deve ser negado) ---
    const ins = writeDenied(r.escrita?.insert_aso, { mustError: true });
    checks.push(check("insert_aso negado por RLS", "erro RLS", ins.why, ins.ok));
    const upd = writeDenied(r.escrita?.update_aso);
    checks.push(check("update_aso negado (erro RLS ou affected=0)", "RLS / affected=0", upd.why, upd.ok));
    const del = writeDenied(r.escrita?.delete_aso);
    checks.push(check("delete_aso negado (erro RLS ou affected=0)", "RLS / affected=0", del.why, del.ok));
    const insEx = writeDenied(r.escrita?.insert_aso_exames, { mustError: true });
    checks.push(check("insert_aso_exames negado por RLS", "erro RLS", insEx.why, insEx.ok));
    const updAs = writeDenied(r.escrita?.update_aso_assinaturas);
    checks.push(check("update_aso_assinaturas negado (RLS ou affected=0)", "RLS / affected=0", updAs.why, updAs.ok));

    // --- Edge ---
    const eLib = r.edge?.liberado_A;
    checks.push(check(
      "edge.liberado_A.status = 200",
      200, eLib?.status, eLib?.status === 200,
      eLib?.body?.error ? `body.error=${eLib.body.error}` : "",
    ));
    const eRasc = r.edge?.rascunho_A;
    const rascOk = eRasc?.status === 403 && eRasc?.body?.error === "aso_nao_liberado";
    checks.push(check(
      "edge.rascunho_A = 403 aso_nao_liberado",
      "403 aso_nao_liberado",
      `${eRasc?.status} ${eRasc?.body?.error || ""}`.trim(),
      rascOk,
    ));
    const eB = r.edge?.empresa_B;
    const bOk = eB?.status === 403 && eB?.body?.error === "forbidden_tenant";
    checks.push(check(
      "edge.empresa_B = 403 forbidden_tenant",
      "403 forbidden_tenant",
      `${eB?.status} ${eB?.body?.error || ""}`.trim(),
      bOk,
    ));

    const passed = checks.filter((c) => c.status === "PASS").length;
    const failed = checks.filter((c) => c.status === "FAIL");

    const summary = {
      perfil: r.perfil,
      timestamp_report: r.timestamp,
      total: checks.length,
      passed,
      failed: failed.length,
      veredito: failed.length === 0 ? "APROVADO" : "REPROVADO",
      falhas: failed,
      checks,
      erros_runtime: r.erros || [],
    };

    console.log(`%c Fase 3 / ${r.perfil}: ${summary.veredito} (${passed}/${checks.length}) `,
      `background:${failed.length ? "#b00020" : "#1b5e20"};color:#fff;padding:4px 8px;font-weight:bold`);
    console.table(checks.map((c) => ({
      Check: c.label, Esperado: c.esperado, Obtido: c.obtido, Status: c.status, Detalhe: c.detalhe,
    })));
    if (failed.length) {
      console.warn("Falhas:");
      failed.forEach((f) => console.warn(` ✗ ${f.label} — obtido=${JSON.stringify(f.obtido)} ${f.detalhe}`));
    }

    window.__fase3Validation = summary;
    console.log("Para copiar o relatório: copy(__fase3Validation)");
    return summary;
  };

  console.log("validateFase3U5 carregado. Rode: validateFase3U5(__fase3Report)");
})();
