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

function Badge({ type, value }) {
  const config = type === "status" ? STATUS_CONFIG[value] : CLASS_CONFIG[value];
  if (!config) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
      {config.emoji} {config.label}
    </span>
  );
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

export default function Home() {
  const [simulacoes, setSimulacoes] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [filtroClass, setFiltroClass] = useState("TODOS");
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [importando, setImportando] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const [importandoResultado, setImportandoResultado] = useState(false);
  const [progresso, setProgresso] = useState("");
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

  // CONSULTAR API (pendentes) - 1 por 1 com atualização em tempo real
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
        const result = await resp.json();

        // Atualiza o item localmente na tabela em tempo real
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
    await fetchSimulacoes(); // refresh final para pegar dados completos
    setConsultando(false);
    setTimeout(() => setProgresso(""), 5000);
  }

  // EXPORTAR CPFs consultados (para rodar no Python)
  async function handleExportar() {
    setProgresso("Exportando...");
    const resp = await fetch("/api/exportar");
    const data = await resp.json();

    if (data.length === 0) {
      setProgresso("Nenhum CPF consultado para exportar");
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

  // IMPORTAR RESULTADO do Python
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

  // FILTROS
  const filtradas = simulacoes.filter((s) => {
    const matchStatus = filtroStatus === "TODOS" || s.status === filtroStatus;
    const matchClass = filtroClass === "TODOS" || s.classificacao === filtroClass;
    const matchBusca =
      !busca ||
      s.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      s.cpf?.includes(busca);
    return matchStatus && matchClass && matchBusca;
  });

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

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
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

      {/* Ações */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 mb-6">
        <h2 className="text-white font-semibold mb-4">Ações</h2>
        <div className="flex flex-wrap gap-3">
          {/* Importar TXT */}
          <label className="cursor-pointer px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors flex items-center gap-2">
            📄 Importar TXT
            <input ref={fileInputRef} type="file" accept=".txt" className="hidden" onChange={handleImportTxt} disabled={importando} />
          </label>

          {/* Consultar API */}
          <button
            onClick={handleConsultar}
            disabled={consultando || stats.pendente === 0}
            className="px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium transition-colors flex items-center gap-2"
          >
            {consultando ? "⏳ Consultando..." : `🔍 Consultar API (${stats.pendente})`}
          </button>

          {/* Exportar */}
          <button
            onClick={handleExportar}
            disabled={stats.consultado === 0}
            className="px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium transition-colors flex items-center gap-2"
          >
            📥 Exportar CPFs ({stats.consultado})
          </button>

          {/* Importar Resultado */}
          <label className="cursor-pointer px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors flex items-center gap-2">
            📊 Importar Resultado
            <input ref={resultFileRef} type="file" accept=".json" className="hidden" onChange={handleImportarResultado} disabled={importandoResultado} />
          </label>
        </div>

        {/* Progresso */}
        {progresso && (
          <div className="mt-3 px-3 py-2 bg-slate-900/50 rounded-lg text-sm text-slate-300">
            {progresso}
          </div>
        )}

        {/* Fluxo */}
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <span>📄 Importar TXT</span>
          <span>→</span>
          <span>⏳ Pendente</span>
          <span>→</span>
          <span>🔍 Consultar API</span>
          <span>→</span>
          <span>📥 Exportar</span>
          <span>→</span>
          <span>🐍 Python</span>
          <span>→</span>
          <span>📊 Importar Resultado</span>
          <span>→</span>
          <span>✅ Concluído</span>
        </div>
      </div>

      {/* Stats por Status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard title="Total" value={stats.total} icon="📊" onClick={() => { setFiltroStatus("TODOS"); setFiltroClass("TODOS"); }} active={filtroStatus === "TODOS" && filtroClass === "TODOS"} />
        <StatCard title="Pendentes" value={stats.pendente} icon="⏳" onClick={() => { setFiltroStatus("PENDENTE"); setFiltroClass("TODOS"); }} active={filtroStatus === "PENDENTE"} />
        <StatCard title="Consultados" value={stats.consultado} icon="🔍" onClick={() => { setFiltroStatus("CONSULTADO"); setFiltroClass("TODOS"); }} active={filtroStatus === "CONSULTADO"} />
        <StatCard title="Concluídos" value={stats.concluido} icon="✅" onClick={() => { setFiltroStatus("CONCLUIDO"); setFiltroClass("TODOS"); }} active={filtroStatus === "CONCLUIDO"} />
      </div>

      {/* Stats por Classificação */}
      {stats.concluido > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard title="Ótimo (0-10%)" value={stats.otimo} icon="🟢" onClick={() => { setFiltroClass("OTIMO"); setFiltroStatus("CONCLUIDO"); }} active={filtroClass === "OTIMO"} />
          <StatCard title="Bom (10-20%)" value={stats.bom} icon="🟡" onClick={() => { setFiltroClass("BOM"); setFiltroStatus("CONCLUIDO"); }} active={filtroClass === "BOM"} />
          <StatCard title="Ruim (20%+)" value={stats.ruim} icon="🔴" onClick={() => { setFiltroClass("RUIM"); setFiltroStatus("CONCLUIDO"); }} active={filtroClass === "RUIM"} />
          <StatCard title="Bloqueado" value={stats.bloqueado} icon="⚫" onClick={() => { setFiltroClass("BLOQUEADO"); setFiltroStatus("CONCLUIDO"); }} active={filtroClass === "BLOQUEADO"} />
        </div>
      )}

      {/* Busca */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar por nome ou CPF..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
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
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Nome</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">CPF</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">UF</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Classificação</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Entrada</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Parcela</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((s) => (
                  <tr key={s.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                    <td className="px-4 py-3 text-white font-medium">{s.nome || "—"}</td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">{formatCPF(s.cpf)}</td>
                    <td className="px-4 py-3 text-slate-300">{s.uf || "—"}</td>
                    <td className="px-4 py-3"><Badge type="status" value={s.status} /></td>
                    <td className="px-4 py-3">{s.classificacao ? <Badge type="class" value={s.classificacao} /> : <span className="text-slate-600">—</span>}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {s.entrada_valor != null ? (
                        <div>
                          <div>{formatCurrency(s.entrada_valor)}</div>
                          <div className="text-xs text-slate-500">{s.entrada_percentual}%</div>
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {s.parcela_valor != null ? (
                        <div>
                          <div>{formatCurrency(s.parcela_valor)}</div>
                          <div className="text-xs text-slate-500">{s.parcela_qtd}x</div>
                        </div>
                      ) : "—"}
                    </td>
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
    </main>
  );
}
