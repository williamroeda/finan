"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

const STATUS_CONFIG = {
  PENDENTE: { emoji: "⏳", label: "Pendente", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  CONSULTADO: { emoji: "🔍", label: "Consultado", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  CONCLUIDO: { emoji: "✅", label: "Concluído", color: "bg-green-500/20 text-green-400 border-green-500/30" },
};

const CLASS_CONFIG = {
  OTIMO: { emoji: "🟢", label: "ÓTIMO", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  BOM: { emoji: "🟡", label: "BOM", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  RUIM: { emoji: "🔴", label: "RUIM", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  BLOQUEADO: { emoji: "⚫", label: "BLOQUEADO", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
};

function formatCPF(cpf) {
  if (!cpf) return "";
  const c = cpf.replace(/\D/g, "");
  return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatCurrency(value) {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatRenda(value) {
  if (!value || value === 0) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

function ScoreBadge({ score }) {
  if (!score) return <span className="text-slate-600">—</span>;
  let color = "text-red-400";
  if (score >= 700) color = "text-emerald-400";
  else if (score >= 500) color = "text-yellow-400";
  else if (score >= 300) color = "text-orange-400";
  return <span className={`font-bold ${color}`}>{score}</span>;
}

function Badge({ type, value }) {
  const config = type === "status" ? STATUS_CONFIG[value] : CLASS_CONFIG[value];
  if (!config) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
      {config.emoji} {config.label}
    </span>
  );
}

function DecisaoBadge({ decisao }) {
  if (!decisao) return null;
  if (decisao === "APROVADO") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">✅ Usar</span>;
  if (decisao === "RECUSADO") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-red-500/20 text-red-400 border-red-500/30">❌ Recusado</span>;
  return null;
}

function StatCard({ title, value, icon, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className={`text-left bg-slate-800/50 border rounded-xl p-4 transition-colors ${
        active ? "border-blue-500 bg-blue-500/10" : "border-slate-700/50 hover:border-slate-600"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{icon}</span>
        <span className="text-slate-400 text-xs">{title}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </button>
  );
}

// Modal de detalhes do cliente
function ClienteModal({ cliente, onClose, onDecidir }) {
  if (!cliente) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-white">{cliente.nome || "—"}</h3>
            <p className="text-slate-400 text-sm font-mono">{formatCPF(cliente.cpf)}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        {/* Decisão atual */}
        {cliente.decisao && (
          <div className={`rounded-lg p-3 mb-4 border ${cliente.decisao === "APROVADO" ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"}`}>
            <p className={`text-sm font-medium ${cliente.decisao === "APROVADO" ? "text-emerald-400" : "text-red-400"}`}>
              {cliente.decisao === "APROVADO" ? "✅ Marcado para USAR" : "❌ Marcado como RECUSADO"}
            </p>
            {cliente.decidido_em && <p className="text-slate-500 text-xs mt-1">em {new Date(cliente.decidido_em).toLocaleString("pt-BR")}</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-slate-900/50 rounded-lg p-3">
            <p className="text-slate-500 text-xs">Status</p>
            <div className="mt-1"><Badge type="status" value={cliente.status} /></div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3">
            <p className="text-slate-500 text-xs">Classificação</p>
            <div className="mt-1">{cliente.classificacao ? <Badge type="class" value={cliente.classificacao} /> : <span className="text-slate-600">—</span>}</div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3">
            <p className="text-slate-500 text-xs">Score</p>
            <div className="mt-1"><ScoreBadge score={cliente.score} /></div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3">
            <p className="text-slate-500 text-xs">Renda</p>
            <p className="text-white font-medium mt-1">{formatRenda(cliente.renda)}</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3">
            <p className="text-slate-500 text-xs">UF</p>
            <p className="text-white font-medium mt-1">{cliente.uf || "—"}</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3">
            <p className="text-slate-500 text-xs">Profissão</p>
            <p className="text-white font-medium mt-1 text-xs">{cliente.profissao || "—"}</p>
          </div>
        </div>

        {/* Pré-Aprovado */}
        {cliente.pre_aprovado_valor > 0 && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mb-4">
            <p className="text-emerald-400 text-xs font-medium mb-1">💰 Pré-Aprovado</p>
            <p className="text-white font-bold text-lg">{formatCurrency(cliente.pre_aprovado_valor)}</p>
            <p className="text-slate-400 text-xs mt-1">
              Entrada mín: {cliente.pre_aprovado_entrada_min || "—"}% | Prazo máx: {cliente.pre_aprovado_prazo_max || "—"} meses
            </p>
          </div>
        )}

        {/* Resultado da Simulação */}
        {cliente.status === "CONCLUIDO" && cliente.classificacao !== "BLOQUEADO" && (
          <div className="bg-slate-900/50 rounded-lg p-3 mb-4">
            <p className="text-slate-500 text-xs mb-2">Resultado da Simulação</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-slate-500 text-xs">Entrada</p>
                <p className="text-white font-bold">{formatCurrency(cliente.entrada_valor)}</p>
                <p className="text-slate-400 text-xs">{cliente.entrada_percentual}%</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Parcela</p>
                <p className="text-white font-bold">{formatCurrency(cliente.parcela_valor)}</p>
                <p className="text-slate-400 text-xs">{cliente.parcela_qtd}x</p>
              </div>
            </div>
          </div>
        )}

        <div className="text-slate-500 text-xs space-y-1 mb-5">
          {cliente.data_nascimento && <p>Nascimento: {cliente.data_nascimento}</p>}
          {cliente.email && <p>Email: {cliente.email}</p>}
          {cliente.telefone && <p>Tel: {cliente.telefone}</p>}
          {cliente.cidade_uf && <p>Cidade: {cliente.cidade_uf}</p>}
          {cliente.poder_aquisitivo && <p>Poder aquisitivo: {cliente.poder_aquisitivo}</p>}
          {cliente.criado_em && <p>Importado: {new Date(cliente.criado_em).toLocaleString("pt-BR")}</p>}
        </div>

        {/* Botões de decisão */}
        <div className="flex gap-3">
          <button
            onClick={() => onDecidir(cliente.cpf, "APROVADO")}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
              cliente.decisao === "APROVADO"
                ? "bg-emerald-600 text-white ring-2 ring-emerald-400"
                : "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white"
            }`}
          >
            ✅ Usar este cliente
          </button>
          <button
            onClick={() => onDecidir(cliente.cpf, "RECUSADO")}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
              cliente.decisao === "RECUSADO"
                ? "bg-red-600 text-white ring-2 ring-red-400"
                : "bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600 hover:text-white"
            }`}
          >
            ❌ Não usar
          </button>
        </div>
        {cliente.decisao && (
          <button
            onClick={() => onDecidir(cliente.cpf, null)}
            className="w-full mt-2 py-2 rounded-lg text-slate-500 text-xs hover:text-white hover:bg-slate-700/50 transition-colors"
          >
            Desfazer decisão
          </button>
        )}
      </div>
    </div>
  );
}

const CLASS_ORDER = { OTIMO: 1, BOM: 2, RUIM: 3, BLOQUEADO: 4 };

function SortHeader({ label, campo, ordenacao, setOrdenacao, align }) {
  const ativo = ordenacao.campo === campo;
  const dir = ativo ? ordenacao.dir : null;
  return (
    <th
      className={`${align === "right" ? "text-right" : "text-left"} px-3 py-3 text-slate-400 font-medium cursor-pointer hover:text-white select-none transition-colors`}
      onClick={() => setOrdenacao({ campo, dir: ativo && dir === "desc" ? "asc" : "desc" })}
    >
      {label} {ativo ? (dir === "desc" ? "▼" : "▲") : ""}
    </th>
  );
}

export default function Home() {
  const [simulacoes, setSimulacoes] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [filtroClass, setFiltroClass] = useState("TODOS");
  const [filtroUF, setFiltroUF] = useState("TODOS");
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [importando, setImportando] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const [importandoResultado, setImportandoResultado] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [ordenacao, setOrdenacao] = useState({ campo: null, dir: "desc" });
  const [abaAtiva, setAbaAtiva] = useState("simulacoes"); // "simulacoes" | "docs"
  const fileInputRef = useRef(null);
  const resultFileRef = useRef(null);

  useEffect(() => {
    fetchSimulacoes();
  }, []);

  async function fetchSimulacoes() {
    setLoading(true);
    const { data, error } = await supabase
      .from("simulacoes")
      .select("*")
      .order("criado_em", { ascending: false });

    if (!error && data) setSimulacoes(data);
    setLoading(false);
  }

  // DECIDIR (aprovar/recusar)
  async function handleDecidir(cpf, decisao) {
    const updateData = {
      decisao: decisao,
      decidido_em: decisao ? new Date().toISOString() : null,
    };

    const { error } = await supabase
      .from("simulacoes")
      .update(updateData)
      .eq("cpf", cpf);

    if (!error) {
      // Atualizar local
      setSimulacoes((prev) =>
        prev.map((s) => s.cpf === cpf ? { ...s, ...updateData } : s)
      );
      // Atualizar modal
      setClienteSelecionado((prev) => prev ? { ...prev, ...updateData } : null);
    }
  }

  // IMPORTAR TXT
  async function handleImportTxt(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportando(true);
    setProgresso("Lendo arquivo...");

    const texto = await file.text();
    const resp = await fetch("/api/importar-txt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto }),
    });
    const result = await resp.json();

    if (result.error) {
      setProgresso(`Erro: ${result.error}`);
    } else {
      setProgresso(`${result.importados} importados, ${result.duplicados} duplicados`);
      await fetchSimulacoes();
    }
    setImportando(false);
    fileInputRef.current.value = "";
    setTimeout(() => setProgresso(""), 5000);
  }

  // CONSULTAR API
  async function handleConsultar() {
    const pendentes = simulacoes.filter((s) => s.status === "PENDENTE");
    if (pendentes.length === 0) {
      setProgresso("Nenhum CPF pendente para consultar");
      setTimeout(() => setProgresso(""), 3000);
      return;
    }

    setConsultando(true);
    const total = pendentes.length;
    let concluidos = 0;
    let erros = 0;

    for (const item of pendentes) {
      concluidos++;
      setProgresso(`Consultando ${concluidos}/${total} — ${item.nome || item.cpf}...`);

      try {
        const resp = await fetch("/api/consultar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cpfs: [item.cpf] }),
        });
        await resp.json();

        setSimulacoes((prev) =>
          prev.map((s) =>
            s.cpf === item.cpf
              ? { ...s, status: "CONSULTADO", consultado_em: new Date().toISOString() }
              : s
          )
        );
      } catch (e) {
        erros++;
      }
    }

    setProgresso(`✅ ${total} consultados${erros > 0 ? ` (${erros} erros)` : ""}!`);
    await fetchSimulacoes();
    setConsultando(false);
    setTimeout(() => setProgresso(""), 5000);
  }

  // EXPORTAR
  async function handleExportar() {
    setProgresso("Exportando...");
    const resp = await fetch("/api/exportar");
    const data = await resp.json();

    if (data.error || data.length === 0) {
      setProgresso(data.error || "Nenhum CPF consultado para exportar");
      setTimeout(() => setProgresso(""), 3000);
      return;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cpfs_para_simular.json";
    a.click();
    URL.revokeObjectURL(url);

    setProgresso(`${data.length} CPFs exportados!`);
    setTimeout(() => setProgresso(""), 5000);
  }

  // IMPORTAR RESULTADO
  async function handleImportarResultado(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportandoResultado(true);
    setProgresso("Importando resultados...");

    const texto = await file.text();
    let resultados;
    try {
      resultados = JSON.parse(texto);
    } catch {
      setProgresso("Erro: arquivo JSON inválido");
      setImportandoResultado(false);
      return;
    }

    const resp = await fetch("/api/importar-resultado", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultados: Array.isArray(resultados) ? resultados : [resultados] }),
    });
    const result = await resp.json();

    if (result.error) {
      setProgresso(`Erro: ${result.error}`);
    } else {
      setProgresso(`${result.atualizados} concluídos, ${result.bloqueados} bloqueados`);
      await fetchSimulacoes();
    }

    setImportandoResultado(false);
    resultFileRef.current.value = "";
    setTimeout(() => setProgresso(""), 5000);
  }

  // UFs únicas
  const ufsDisponiveis = [...new Set(simulacoes.map((s) => s.uf).filter(Boolean))].sort();

  // Docs usados
  const docsAprovados = simulacoes.filter((s) => s.decisao === "APROVADO");
  const docsRecusados = simulacoes.filter((s) => s.decisao === "RECUSADO");

  // FILTROS + ORDENAÇÃO
  let filtradas = simulacoes.filter((s) => {
    const matchStatus = filtroStatus === "TODOS" || s.status === filtroStatus;
    const matchClass = filtroClass === "TODOS" || s.classificacao === filtroClass;
    const matchUF = filtroUF === "TODOS" || s.uf === filtroUF;
    const matchBusca =
      !busca ||
      s.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      s.cpf?.includes(busca);
    return matchStatus && matchClass && matchUF && matchBusca;
  });

  if (ordenacao.campo) {
    filtradas = [...filtradas].sort((a, b) => {
      let va, vb;
      switch (ordenacao.campo) {
        case "score": va = a.score || 0; vb = b.score || 0; break;
        case "renda": va = a.renda || 0; vb = b.renda || 0; break;
        case "pre_aprovado": va = a.pre_aprovado_valor || 0; vb = b.pre_aprovado_valor || 0; break;
        case "classificacao": va = CLASS_ORDER[a.classificacao] || 99; vb = CLASS_ORDER[b.classificacao] || 99; break;
        case "entrada": va = a.entrada_percentual || 0; vb = b.entrada_percentual || 0; break;
        case "parcela": va = a.parcela_valor || 0; vb = b.parcela_valor || 0; break;
        case "nome": va = a.nome || ""; vb = b.nome || ""; return ordenacao.dir === "desc" ? vb.localeCompare(va) : va.localeCompare(vb);
        default: va = 0; vb = 0;
      }
      return ordenacao.dir === "desc" ? vb - va : va - vb;
    });
  }

  const stats = {
    total: simulacoes.length,
    pendente: simulacoes.filter((s) => s.status === "PENDENTE").length,
    consultado: simulacoes.filter((s) => s.status === "CONSULTADO").length,
    concluido: simulacoes.filter((s) => s.status === "CONCLUIDO").length,
    otimo: simulacoes.filter((s) => s.classificacao === "OTIMO").length,
    bom: simulacoes.filter((s) => s.classificacao === "BOM").length,
    ruim: simulacoes.filter((s) => s.classificacao === "RUIM").length,
    bloqueado: simulacoes.filter((s) => s.classificacao === "BLOQUEADO").length,
  };

  // Tabela de docs reutilizável
  function DocsTable({ items, titulo, emptyMsg }) {
    return (
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/50">
          <h3 className="text-white font-medium">{titulo} ({items.length})</h3>
        </div>
        {items.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">{emptyMsg}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left px-3 py-2 text-slate-400 font-medium text-xs">Nome</th>
                  <th className="text-left px-3 py-2 text-slate-400 font-medium text-xs">CPF</th>
                  <th className="text-left px-3 py-2 text-slate-400 font-medium text-xs">UF</th>
                  <th className="text-right px-3 py-2 text-slate-400 font-medium text-xs">Score</th>
                  <th className="text-right px-3 py-2 text-slate-400 font-medium text-xs">Renda</th>
                  <th className="text-left px-3 py-2 text-slate-400 font-medium text-xs">Class.</th>
                  <th className="text-right px-3 py-2 text-slate-400 font-medium text-xs">Entrada</th>
                  <th className="text-right px-3 py-2 text-slate-400 font-medium text-xs">Parcela</th>
                  <th className="text-right px-3 py-2 text-slate-400 font-medium text-xs">Decidido</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 cursor-pointer" onClick={() => setClienteSelecionado(s)}>
                    <td className="px-3 py-2 text-white font-medium text-xs">{s.nome || "—"}</td>
                    <td className="px-3 py-2 text-slate-300 font-mono text-[10px]">{formatCPF(s.cpf)}</td>
                    <td className="px-3 py-2 text-slate-300 text-xs">{s.uf || "—"}</td>
                    <td className="px-3 py-2 text-right"><ScoreBadge score={s.score} /></td>
                    <td className="px-3 py-2 text-right text-slate-300 text-xs">{formatRenda(s.renda)}</td>
                    <td className="px-3 py-2">{s.classificacao ? <Badge type="class" value={s.classificacao} /> : "—"}</td>
                    <td className="px-3 py-2 text-right text-slate-300 text-xs">{s.entrada_valor != null ? `${s.entrada_percentual}%` : "—"}</td>
                    <td className="px-3 py-2 text-right text-slate-300 text-xs">{s.parcela_valor ? formatCurrency(s.parcela_valor) : "—"}</td>
                    <td className="px-3 py-2 text-right text-slate-500 text-[10px]">{s.decidido_em ? new Date(s.decidido_em).toLocaleString("pt-BR") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="max-w-[1400px] mx-auto px-4 py-8">
      {/* Modal */}
      <ClienteModal
        cliente={clienteSelecionado}
        onClose={() => setClienteSelecionado(null)}
        onDecidir={handleDecidir}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">🦆 TioPato Dashboard</h1>
          <p className="text-slate-400 text-sm">Simulações Santander Financiamentos</p>
        </div>
        <button onClick={fetchSimulacoes} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 transition-colors text-sm">
          🔄 Atualizar
        </button>
      </div>

      {/* Abas */}
      <div className="flex gap-1 mb-6 bg-slate-800/50 border border-slate-700/50 rounded-xl p-1">
        <button
          onClick={() => setAbaAtiva("simulacoes")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            abaAtiva === "simulacoes" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-700/50"
          }`}
        >
          📊 Simulações ({stats.total})
        </button>
        <button
          onClick={() => setAbaAtiva("docs")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            abaAtiva === "docs" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-700/50"
          }`}
        >
          📋 Docs Usados ({docsAprovados.length + docsRecusados.length})
        </button>
      </div>

      {/* ===== ABA SIMULAÇÕES ===== */}
      {abaAtiva === "simulacoes" && (
        <>
          {/* Ações */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 mb-6">
            <h2 className="text-white font-semibold mb-4">Ações</h2>
            <div className="flex flex-wrap gap-3">
              <label className="cursor-pointer px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors flex items-center gap-2">
                📄 Importar TXT
                <input ref={fileInputRef} type="file" accept=".txt" className="hidden" onChange={handleImportTxt} disabled={importando} />
              </label>
              <button
                onClick={handleConsultar}
                disabled={consultando || stats.pendente === 0}
                className="px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium transition-colors flex items-center gap-2"
              >
                {consultando ? "⏳ Consultando..." : `🔍 Consultar API (${stats.pendente})`}
              </button>
              <button
                onClick={handleExportar}
                disabled={stats.consultado === 0}
                className="px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium transition-colors flex items-center gap-2"
              >
                📥 Exportar CPFs ({stats.consultado})
              </button>
              <label className="cursor-pointer px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors flex items-center gap-2">
                📊 Importar Resultado
                <input ref={resultFileRef} type="file" accept=".json" className="hidden" onChange={handleImportarResultado} disabled={importandoResultado} />
              </label>
            </div>
            {progresso && (
              <div className="mt-3 px-3 py-2 bg-slate-900/50 rounded-lg text-sm text-slate-300">{progresso}</div>
            )}
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <span>📄 TXT</span><span>→</span><span>⏳ Pendente</span><span>→</span><span>🔍 API</span><span>→</span><span>📥 Exportar</span><span>→</span><span>🐍 Python</span><span>→</span><span>📊 Resultado</span><span>→</span><span>✅ Concluído</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatCard title="Total" value={stats.total} icon="📊" onClick={() => { setFiltroStatus("TODOS"); setFiltroClass("TODOS"); }} active={filtroStatus === "TODOS" && filtroClass === "TODOS"} />
            <StatCard title="Pendentes" value={stats.pendente} icon="⏳" onClick={() => { setFiltroStatus("PENDENTE"); setFiltroClass("TODOS"); }} active={filtroStatus === "PENDENTE"} />
            <StatCard title="Consultados" value={stats.consultado} icon="🔍" onClick={() => { setFiltroStatus("CONSULTADO"); setFiltroClass("TODOS"); }} active={filtroStatus === "CONSULTADO"} />
            <StatCard title="Concluídos" value={stats.concluido} icon="✅" onClick={() => { setFiltroStatus("CONCLUIDO"); setFiltroClass("TODOS"); }} active={filtroStatus === "CONCLUIDO"} />
          </div>

          {stats.concluido > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatCard title="Ótimo (0-10%)" value={stats.otimo} icon="🟢" onClick={() => { setFiltroClass("OTIMO"); setFiltroStatus("CONCLUIDO"); }} active={filtroClass === "OTIMO"} />
              <StatCard title="Bom (10-20%)" value={stats.bom} icon="🟡" onClick={() => { setFiltroClass("BOM"); setFiltroStatus("CONCLUIDO"); }} active={filtroClass === "BOM"} />
              <StatCard title="Ruim (20%+)" value={stats.ruim} icon="🔴" onClick={() => { setFiltroClass("RUIM"); setFiltroStatus("CONCLUIDO"); }} active={filtroClass === "RUIM"} />
              <StatCard title="Bloqueado" value={stats.bloqueado} icon="⚫" onClick={() => { setFiltroClass("BLOQUEADO"); setFiltroStatus("CONCLUIDO"); }} active={filtroClass === "BLOQUEADO"} />
            </div>
          )}

          {/* Busca + UF */}
          <div className="mb-6 flex gap-3">
            <input
              type="text"
              placeholder="Buscar por nome ou CPF..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <select
              value={filtroUF}
              onChange={(e) => setFiltroUF(e.target.value)}
              className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="TODOS">Todas UFs</option>
              {ufsDisponiveis.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>

          {/* Tabela */}
          {loading ? (
            <div className="text-center py-12 text-slate-400">Carregando...</div>
          ) : filtradas.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 text-lg">Nenhuma simulação encontrada</p>
              <p className="text-slate-500 text-sm mt-2">Importe um arquivo TXT para começar</p>
            </div>
          ) : (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <SortHeader label="Nome" campo="nome" ordenacao={ordenacao} setOrdenacao={setOrdenacao} />
                      <th className="text-left px-3 py-3 text-slate-400 font-medium">CPF</th>
                      <th className="text-left px-3 py-3 text-slate-400 font-medium">UF</th>
                      <SortHeader label="Score" campo="score" ordenacao={ordenacao} setOrdenacao={setOrdenacao} align="right" />
                      <SortHeader label="Renda" campo="renda" ordenacao={ordenacao} setOrdenacao={setOrdenacao} align="right" />
                      <th className="text-left px-3 py-3 text-slate-400 font-medium">Status</th>
                      <SortHeader label="Class." campo="classificacao" ordenacao={ordenacao} setOrdenacao={setOrdenacao} />
                      <SortHeader label="Pré-Aprov." campo="pre_aprovado" ordenacao={ordenacao} setOrdenacao={setOrdenacao} align="right" />
                      <SortHeader label="Entrada" campo="entrada" ordenacao={ordenacao} setOrdenacao={setOrdenacao} align="right" />
                      <SortHeader label="Parcela" campo="parcela" ordenacao={ordenacao} setOrdenacao={setOrdenacao} align="right" />
                      <th className="text-center px-3 py-3 text-slate-400 font-medium">Decisão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map((s) => (
                      <tr
                        key={s.id}
                        className={`border-b border-slate-700/30 hover:bg-slate-700/20 cursor-pointer ${
                          s.decisao === "APROVADO" ? "bg-emerald-500/5" : s.decisao === "RECUSADO" ? "bg-red-500/5" : ""
                        }`}
                        onClick={() => setClienteSelecionado(s)}
                      >
                        <td className="px-3 py-3 text-white font-medium">{s.nome || "—"}</td>
                        <td className="px-3 py-3 text-slate-300 font-mono text-xs">{formatCPF(s.cpf)}</td>
                        <td className="px-3 py-3 text-slate-300">{s.uf || "—"}</td>
                        <td className="px-3 py-3 text-right"><ScoreBadge score={s.score} /></td>
                        <td className="px-3 py-3 text-right text-slate-300 text-xs">{formatRenda(s.renda)}</td>
                        <td className="px-3 py-3"><Badge type="status" value={s.status} /></td>
                        <td className="px-3 py-3">{s.classificacao ? <Badge type="class" value={s.classificacao} /> : <span className="text-slate-600">—</span>}</td>
                        <td className="px-3 py-3 text-right">
                          {s.pre_aprovado_valor > 0 ? (
                            <div>
                              <div className="text-emerald-400 font-medium text-xs">{formatCurrency(s.pre_aprovado_valor)}</div>
                              <div className="text-slate-500 text-[10px]">{s.pre_aprovado_entrada_min}% / {s.pre_aprovado_prazo_max}m</div>
                            </div>
                          ) : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-300">
                          {s.entrada_valor != null && s.status === "CONCLUIDO" && s.classificacao !== "BLOQUEADO" ? (
                            <div>
                              <div className="text-xs">{formatCurrency(s.entrada_valor)}</div>
                              <div className="text-[10px] text-slate-500">{s.entrada_percentual}%</div>
                            </div>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-300">
                          {s.parcela_valor != null && s.status === "CONCLUIDO" && s.classificacao !== "BLOQUEADO" ? (
                            <div>
                              <div className="text-xs">{formatCurrency(s.parcela_valor)}</div>
                              <div className="text-[10px] text-slate-500">{s.parcela_qtd}x</div>
                            </div>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-3 text-center"><DecisaoBadge decisao={s.decisao} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-slate-700/50 text-slate-500 text-xs">
                {filtradas.length} resultado(s)
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== ABA DOCS USADOS ===== */}
      {abaAtiva === "docs" && (
        <div className="space-y-6">
          <DocsTable
            items={docsAprovados}
            titulo="✅ Aprovados para Usar"
            emptyMsg="Nenhum cliente aprovado ainda. Clique em um cliente na aba Simulações e escolha 'Usar este cliente'."
          />
          <DocsTable
            items={docsRecusados}
            titulo="❌ Recusados"
            emptyMsg="Nenhum cliente recusado ainda."
          />
        </div>
      )}
    </main>
  );
}
