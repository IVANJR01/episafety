const fs=require("fs"), XLSX=require("xlsx");
require("esbuild-register/dist/node").register({target:"node18"});
const { lerInventarioDaPlanilha } = require("./src/lib/importarPgrPlanilha.ts");
const wb=XLSX.read(fs.readFileSync(process.argv[2]),{type:"buffer"});
const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:""});
const r=lerInventarioDaPlanilha(rows);
console.log("[lib nova] riscos", r.itens.length, "| setores", new Set(r.itens.map(i=>i.setor)).size,
  "| sem prob", r.itens.filter(i=>i.probabilidade==null).length,
  "| com classificação", r.itens.filter(i=>i.classificacao).length);
