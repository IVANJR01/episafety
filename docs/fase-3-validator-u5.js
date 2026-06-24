// Fase 3 — Validador automático do __fase3Report para o perfil U5_RH_ONLY.
//
// Uso no DevTools, logado como homolog.u5@gmail.com, APÓS rodar o script de
// teste que popula window.__fase3Report:
//
//   1. Cole este arquivo inteiro no console.
//   2. Rode: validateFase3U5(__fase3Report)
//   3. Veja a tabela colorida + objeto retornado.
//   4. Para copiar: copy(__fase3Validation)
//   5. Se o botão de download falhar, rode no console: baixarFase3Validation()

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
    console.log("Para baixar o arquivo: baixarFase3Validation()");
    renderFase3Panel(summary);
    return summary;
  };

  // ---------- Painel flutuante: copiar / baixar JSON ----------
  function getFase3ExportPayload(summary) {
    const source = summary || window.__fase3Validation;
    if (!source) throw new Error("__fase3Validation não encontrado. Rode validateFase3U5(__fase3Report) primeiro.");
    return {
      fname: `fase3-${source.perfil || "report"}-${new Date().toISOString().replace(/[:.]/g,"-")}.json`,
      json: JSON.stringify(source, null, 2),
    };
  }

  async function copyTextWithFallback(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    if (!ok) throw new Error("clipboard indisponível");
  }

  function downloadJsonWithFallback(summary) {
    const { fname, json } = getFase3ExportPayload(summary);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fname;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);

    try {
      a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    } catch (e) {
      a.click();
    }

    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1500);

    return { fname, json };
  }

  window.baixarFase3Validation = function () {
    const result = downloadJsonWithFallback(window.__fase3Validation);
    console.log(`Download solicitado: ${result.fname}`);
    return result.fname;
  };

  function renderFase3Panel(summary) {
    document.getElementById("fase3-export-panel")?.remove();
    const aprovado = summary.veredito === "APROVADO";
    const bg = aprovado ? "#1b5e20" : "#b00020";
    const { json } = getFase3ExportPayload(summary);

    const panel = document.createElement("div");
    panel.id = "fase3-export-panel";
    panel.style.cssText = `position:fixed;bottom:16px;right:16px;z-index:2147483647;background:#111;color:#fff;border:1px solid #333;border-radius:10px;padding:12px 14px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.4);min-width:260px;`;
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px">
        <span style="background:${bg};padding:2px 8px;border-radius:4px;font-weight:700">${summary.veredito} ${summary.passed}/${summary.total}</span>
        <button id="fase3-close" style="background:transparent;color:#aaa;border:0;cursor:pointer;font-size:16px">✕</button>
      </div>
      <div style="margin-bottom:10px;color:#bbb">Fase 3 · ${summary.perfil || "-"}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="fase3-copy" style="flex:1;background:#2962ff;color:#fff;border:0;padding:8px 10px;border-radius:6px;cursor:pointer;font-weight:600">Copiar JSON</button>
        <button id="fase3-download" style="flex:1;background:#00897b;color:#fff;border:0;padding:8px 10px;border-radius:6px;cursor:pointer;font-weight:600">Baixar .json</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <button id="fase3-select" style="flex:1;background:#424242;color:#fff;border:0;padding:8px 10px;border-radius:6px;cursor:pointer;font-weight:600">Selecionar JSON</button>
      </div>
      <textarea id="fase3-json-box" readonly style="display:none;margin-top:8px;width:100%;height:140px;background:#050505;color:#e0e0e0;border:1px solid #444;border-radius:6px;padding:8px;font:11px/1.35 monospace;box-sizing:border-box"></textarea>
      <div id="fase3-feedback" style="margin-top:8px;color:#9ccc65;min-height:16px"></div>`;
    document.body.appendChild(panel);
    const jsonBox = panel.querySelector("#fase3-json-box");
    jsonBox.value = json;

    const feedback = (msg, color = "#9ccc65") => {
      const el = panel.querySelector("#fase3-feedback");
      el.textContent = msg; el.style.color = color;
      setTimeout(() => { el.textContent = ""; }, 2500);
    };
    panel.querySelector("#fase3-close").onclick = () => panel.remove();
    panel.querySelector("#fase3-copy").onclick = async () => {
      try { await copyTextWithFallback(json); feedback("JSON copiado ✓"); }
      catch (e) { feedback("Falha ao copiar. Use Selecionar JSON.", "#ef5350"); }
    };
    panel.querySelector("#fase3-download").onclick = () => {
      try {
        const result = downloadJsonWithFallback(summary);
        feedback(`Download solicitado: ${result.fname} ✓`);
      } catch (e) {
        feedback("Falha no download. Use Selecionar JSON.", "#ef5350");
      }
    };
    panel.querySelector("#fase3-select").onclick = () => {
      jsonBox.style.display = "block";
      jsonBox.focus();
      jsonBox.select();
      feedback("JSON selecionado: Ctrl+C para copiar");
    };
  }
  window.renderFase3Panel = renderFase3Panel;
  // Reabrir o painel manualmente: renderFase3Panel(__fase3Validation)
  // Baixar manualmente: baixarFase3Validation()

  console.log("validateFase3U5 carregado. Rode: validateFase3U5(__fase3Report)");
})();
