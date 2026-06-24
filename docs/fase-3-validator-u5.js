// Fase 3 — Validador automático do __fase3Report para o perfil U5_RH_ONLY.
//
// Uso no DevTools, logado como homolog.u5@gmail.com, APÓS rodar o script de
// teste que popula window.__fase3Report:
//
//   1. Cole este arquivo inteiro no console.
//   2. Rode: validateFase3U5(__fase3Report)
//   3. No painel flutuante, use os botões para Validation OU Report cru.
//   4. Atalhos no console:
//        imprimirFase3Report()    → imprime report+validation+veredito no console (sem baixar)
//        baixarFase3Validation()  → baixa o resumo validado
//        baixarFase3Report()      → baixa/abre painel com o __fase3Report cru
//        copiarFase3Report()      → copia __fase3Report para o clipboard

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
  // kind = "validation" (resumo validado) | "report" (__fase3Report cru)
  function getFase3ExportPayload(kind = "validation", override) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    if (kind === "report") {
      const src = override || window.__fase3Report;
      if (!src) throw new Error("__fase3Report não encontrado. Rode o script de teste primeiro.");
      return {
        fname: `fase3-report-${src.perfil || "u5"}-${stamp}.json`,
        json: JSON.stringify(src, null, 2),
      };
    }
    const src = override || window.__fase3Validation;
    if (!src) throw new Error("__fase3Validation não encontrado. Rode validateFase3U5(__fase3Report) primeiro.");
    return {
      fname: `fase3-validation-${src.perfil || "u5"}-${stamp}.json`,
      json: JSON.stringify(src, null, 2),
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

  function makeFase3ObjectUrl(json) {
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    return URL.createObjectURL(blob);
  }

  function makeFase3DataUrl(json) {
    return `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
  }

  function renderManualDownloadPanel(kind = "report", override, reason = "") {
    const payload = getFase3ExportPayload(kind, override);
    const old = document.getElementById("fase3-manual-download-panel");
    if (old?._fase3ObjectUrl) URL.revokeObjectURL(old._fase3ObjectUrl);
    old?.remove();

    const objectUrl = makeFase3ObjectUrl(payload.json);
    const dataUrl = makeFase3DataUrl(payload.json);
    const title = kind === "report" ? "Report (__fase3Report cru)" : "Validation (resumo)";
    const panel = document.createElement("div");
    panel.id = "fase3-manual-download-panel";
    panel._fase3ObjectUrl = objectUrl;
    panel.style.cssText = "position:fixed;top:16px;right:16px;z-index:2147483647;background:#101010;color:#fff;border:1px solid #444;border-radius:10px;padding:12px 14px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.45);width:min(520px,calc(100vw - 32px));box-sizing:border-box";
    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
        <strong style="color:#ffb74d">Arquivo pronto: ${title}</strong>
        <button data-act="close" style="background:transparent;color:#aaa;border:0;cursor:pointer;font-size:16px">✕</button>
      </div>
      ${reason ? `<div style="color:#ef9a9a;margin-bottom:8px">${reason}</div>` : ""}
      <div style="color:#bbb;margin-bottom:8px;word-break:break-all">${payload.fname}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
        <a data-act="object-link" href="${objectUrl}" download="${payload.fname}" style="background:#00897b;color:#fff;text-decoration:none;border:0;padding:8px 10px;border-radius:6px;cursor:pointer;font-weight:700">Clique aqui para baixar</a>
        <a data-act="data-link" href="${dataUrl}" download="${payload.fname}" style="background:#455a64;color:#fff;text-decoration:none;border:0;padding:8px 10px;border-radius:6px;cursor:pointer;font-weight:700">Baixar alternativo</a>
        <button data-act="copy" style="background:#2962ff;color:#fff;border:0;padding:8px 10px;border-radius:6px;cursor:pointer;font-weight:700">Copiar JSON</button>
        <button data-act="select" style="background:#424242;color:#fff;border:0;padding:8px 10px;border-radius:6px;cursor:pointer;font-weight:700">Selecionar JSON</button>
      </div>
      <textarea readonly style="width:100%;height:220px;background:#050505;color:#e0e0e0;border:1px solid #444;border-radius:6px;padding:8px;font:11px/1.35 monospace;box-sizing:border-box">${payload.json.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</textarea>
      <div data-feedback style="margin-top:8px;color:#9ccc65;min-height:16px">Se o download automático bloquear, clique no botão verde acima.</div>`;
    document.body.appendChild(panel);

    const ta = panel.querySelector("textarea");
    const feedbackEl = panel.querySelector("[data-feedback]");
    const feedback = (msg, color = "#9ccc65") => { feedbackEl.textContent = msg; feedbackEl.style.color = color; };
    panel.addEventListener("click", async (ev) => {
      const act = ev.target.closest("[data-act]")?.getAttribute("data-act");
      if (!act) return;
      try {
        if (act === "close") {
          URL.revokeObjectURL(objectUrl);
          panel.remove();
        } else if (act === "copy") {
          await copyTextWithFallback(payload.json);
          feedback("JSON copiado ✓");
        } else if (act === "select") {
          ta.focus(); ta.select();
          feedback("JSON selecionado: pressione Ctrl+C");
        } else if (act === "object-link" || act === "data-link") {
          feedback("Download solicitado ✓");
        }
      } catch (e) {
        ta.focus(); ta.select();
        feedback(`Falha: ${e.message || e}. JSON selecionado: pressione Ctrl+C.`, "#ef5350");
      }
    });
    window.__fase3LastDownload = payload;
    return payload;
  }

  function downloadJsonWithFallback(kind, override, opts = {}) {
    const { fname, json } = getFase3ExportPayload(kind, override);
    const url = makeFase3ObjectUrl(json);
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
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 5000);
    if (opts.showManual !== false) {
      renderManualDownloadPanel(kind, override, "Também deixei um link manual caso o navegador bloqueie o download automático.");
    }
    return { fname, json };
  }

  window.baixarFase3Validation = function () {
    const r = downloadJsonWithFallback("validation");
    console.log(`Download solicitado: ${r.fname}`);
    return r.fname;
  };
  window.baixarFase3Report = function () {
    const r = downloadJsonWithFallback("report");
    console.log(`Download solicitado: ${r.fname}`);
    console.log("Se o navegador bloquear, use o painel aberto na tela: botão verde 'Clique aqui para baixar' ou 'Copiar JSON'.");
    return r;
  };
  window.abrirFase3Report = function () {
    return renderManualDownloadPanel("report");
  };
  window.copiarFase3Report = async function () {
    const { json } = getFase3ExportPayload("report");
    await copyTextWithFallback(json);
    console.log("__fase3Report copiado para a área de transferência");
  };

  // Imprime no console o __fase3Report + __fase3Validation já formatados,
  // prontos para copiar e colar no chat. Não baixa arquivo, não abre painel.
  window.imprimirFase3Report = function () {
    const report = window.__fase3Report;
    const validation = window.__fase3Validation;
    if (!report) {
      console.error("__fase3Report não encontrado. Rode primeiro o script de teste da Fase 3.");
      return null;
    }
    const veredito = validation?.veredito
      || (report && !window.__fase3Validation ? "(rode validateFase3U5(__fase3Report) antes)" : "?");

    const reportJson = JSON.stringify(report, null, 2);
    const validationJson = validation ? JSON.stringify(validation, null, 2) : "(sem __fase3Validation — rode validateFase3U5(__fase3Report))";

    console.log("%c===== __fase3Report =====", "color:#80cbc4;font-weight:bold");
    console.log(reportJson);
    console.log("%c===== __fase3Validation =====", "color:#80cbc4;font-weight:bold");
    console.log(validationJson);
    console.log(`%c===== VEREDITO: ${veredito} =====`,
      `background:${veredito === "APROVADO" ? "#1b5e20" : "#b00020"};color:#fff;padding:2px 8px;font-weight:bold`);
    if (validation) {
      console.log(`Total: ${validation.passed}/${validation.total} · falhas: ${validation.failed}`);
    }
    console.log("Selecione o JSON acima no console (clique direito → 'Copy string contents' no Chrome) e cole no chat.");
    return { veredito, report, validation };
  };

  function renderFase3Panel(summary) {
    document.getElementById("fase3-export-panel")?.remove();
    const aprovado = summary.veredito === "APROVADO";
    const bg = aprovado ? "#1b5e20" : "#b00020";
    const validation = getFase3ExportPayload("validation", summary);
    let report = null;
    try { report = getFase3ExportPayload("report"); } catch (e) { /* sem report */ }

    const panel = document.createElement("div");
    panel.id = "fase3-export-panel";
    panel.style.cssText = `position:fixed;bottom:16px;right:16px;z-index:2147483647;background:#111;color:#fff;border:1px solid #333;border-radius:10px;padding:12px 14px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.4);min-width:300px;max-width:360px;`;
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px">
        <span style="background:${bg};padding:2px 8px;border-radius:4px;font-weight:700">${summary.veredito} ${summary.passed}/${summary.total}</span>
        <button id="fase3-close" style="background:transparent;color:#aaa;border:0;cursor:pointer;font-size:16px">✕</button>
      </div>
      <div style="margin-bottom:10px;color:#bbb">Fase 3 · ${summary.perfil || "-"}</div>

      <div style="color:#80cbc4;font-weight:600;margin:6px 0 4px">Validation (resumo)</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button data-act="copy-val" style="flex:1;background:#2962ff;color:#fff;border:0;padding:7px 10px;border-radius:6px;cursor:pointer;font-weight:600">Copiar</button>
        <button data-act="dl-val" style="flex:1;background:#00897b;color:#fff;border:0;padding:7px 10px;border-radius:6px;cursor:pointer;font-weight:600">Baixar .json</button>
        <button data-act="sel-val" style="flex:1;background:#424242;color:#fff;border:0;padding:7px 10px;border-radius:6px;cursor:pointer;font-weight:600">Selecionar</button>
      </div>

      <div style="color:#ffb74d;font-weight:600;margin:12px 0 4px">Report (__fase3Report cru) ${report ? "" : "<span style='color:#ef5350;font-weight:400'>— não encontrado</span>"}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button data-act="copy-rep" ${report?"":"disabled"} style="flex:1;background:#2962ff;color:#fff;border:0;padding:7px 10px;border-radius:6px;cursor:pointer;font-weight:600;opacity:${report?1:.4}">Copiar</button>
        <button data-act="dl-rep" ${report?"":"disabled"} style="flex:1;background:#00897b;color:#fff;border:0;padding:7px 10px;border-radius:6px;cursor:pointer;font-weight:600;opacity:${report?1:.4}">Baixar .json</button>
        <button data-act="sel-rep" ${report?"":"disabled"} style="flex:1;background:#424242;color:#fff;border:0;padding:7px 10px;border-radius:6px;cursor:pointer;font-weight:600;opacity:${report?1:.4}">Selecionar</button>
      </div>

      <textarea id="fase3-json-box" readonly style="display:none;margin-top:8px;width:100%;height:160px;background:#050505;color:#e0e0e0;border:1px solid #444;border-radius:6px;padding:8px;font:11px/1.35 monospace;box-sizing:border-box"></textarea>
      <div id="fase3-feedback" style="margin-top:8px;color:#9ccc65;min-height:16px"></div>`;
    document.body.appendChild(panel);

    const jsonBox = panel.querySelector("#fase3-json-box");
    const feedback = (msg, color = "#9ccc65") => {
      const el = panel.querySelector("#fase3-feedback");
      el.textContent = msg; el.style.color = color;
      setTimeout(() => { el.textContent = ""; }, 2800);
    };
    const showInBox = (json, label) => {
      jsonBox.value = json;
      jsonBox.style.display = "block";
      jsonBox.focus(); jsonBox.select();
      feedback(`${label} selecionado: Ctrl+C para copiar`);
    };

    panel.querySelector("#fase3-close").onclick = () => panel.remove();
    panel.addEventListener("click", async (ev) => {
      const btn = ev.target.closest("button[data-act]");
      if (!btn) return;
      const act = btn.getAttribute("data-act");
      try {
        if (act === "copy-val") { await copyTextWithFallback(validation.json); feedback("Validation copiado ✓"); }
        else if (act === "dl-val") { const r = downloadJsonWithFallback("validation", summary, { showManual: false }); renderManualDownloadPanel("validation", summary); feedback(`Baixando ${r.fname} ✓`); }
        else if (act === "sel-val") { showInBox(validation.json, "Validation"); }
        else if (act === "copy-rep" && report) { await copyTextWithFallback(report.json); feedback("Report copiado ✓"); }
        else if (act === "dl-rep" && report) { const r = downloadJsonWithFallback("report", undefined, { showManual: false }); renderManualDownloadPanel("report"); feedback(`Baixando ${r.fname} ✓`); }
        else if (act === "sel-rep" && report) { showInBox(report.json, "Report"); }
      } catch (e) {
        feedback(`Falha: ${e.message || e}. Use Selecionar.`, "#ef5350");
      }
    });
  }
  window.renderFase3Panel = renderFase3Panel;
  // Reabrir o painel: renderFase3Panel(__fase3Validation)
  // Baixar manualmente:
  //   baixarFase3Validation()  → resumo validado
  //   baixarFase3Report()      → __fase3Report cru + painel manual
  //   abrirFase3Report()       → abre apenas o painel manual
  //   copiarFase3Report()      → copia __fase3Report para o clipboard

  console.log("validateFase3U5 carregado. Rode: validateFase3U5(__fase3Report)");
  console.log("Atalhos: baixarFase3Validation() | baixarFase3Report() | abrirFase3Report() | copiarFase3Report()");
})();
