"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const CLASSIFICACAO_CONFIG = {
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

function Badge({ classificacao }) {
  const config = CLASSIFICACAO_CONFIG[classificacao] || CLASSIFICACAO_CONFIG.BLOQUEADO;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${config.color}`}>
      {config.emoji} {config.label}
    </span>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-slate-400 text-sm">{title}</span>
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
    </div>
  );
}

function ClienteCard({ cliente }) {
  const config = CLASSIFICACAO_CONFIG[cliente.classificacao] || CLASSIFICACAO_CONFIG.BLOQUEADO;
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 hover:border-slate-600 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-white font-semibold text-lg">{cliente.nome}</h3>
          <p className="text-slate-400 text-sm">{formatCPF(cliente.cpf)} • {cliente.uf}</p>
        </div>
        <Badge classificacao={cliente.classificacao} />
      </div>

      {cliente.classificacao !== "BLOQUEADO" ? (
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-slate-900/50 rounded-lg p-3">
            <p className="text-slate-400 text-xs mb-1">Entrada</p>
            <p className="text-white font-semibold">{formatCurrency(cliente.entrada_valor)}</p>
            <p className="text-slate-500 text-xs">{cliente.entrada_percentual}%</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3">
            <p className="text-slate-400 text-xs mb-1">Parcela</p>
            <p className="text-white font-semibold">{formatCurrency(cliente.parcela_valor)}</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3">
            <p className="text-slate-400 text-xs mb-1">Parcelas</p>
            <p className="text-white font-semibold">{cliente.parcela_qtd}x</p>
          </div>
        </div>
      ) : (
        <div className="mt-4 bg-slate-900/50 rounded-lg p-3">
          <p className="text-slate-500 text-sm">Simulação não aprovada</p>
        </div>
      )}

      <p className="text-slate-500 text-xs mt-3">
        {new Date(cliente.criado_em).toLocaleString("pt-BR")}
      </p>
    </div>
  );
}

export default function Home() {
  const [simulacoes, setSimulacoes] = useState([]);
  const [filtro, setFiltro] = useState("TODOS");
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSimulacoes();
  }, []);

  async function fetchSimulacoes() {
    setLoading(true);
    const { data, error } = await supabase
      .from("simulacoes")
      .select("*")
      .order("criado_em", { ascending: false });

    if (!error && data) {
      setSimulacoes(data);
    }
    setLoading(false);
  }

  const filtradas = simulacoes.filter((s) => {
    const matchFiltro = filtro === "TODOS" || s.classificacao === filtro;
    const matchBusca =
      !busca ||
      s.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      s.cpf?.includes(busca);
    return matchFiltro && matchBusca;
  });

  const stats = {
    total: simulacoes.length,
    otimo: simulacoes.filter((s) => s.classificacao === "OTIMO").length,
    bom: simulacoes.filter((s) => s.classificacao === "BOM").length,
    ruim: simulacoes.filter((s) => s.classificacao === "RUIM").length,
    bloqueado: simulacoes.filter((s) => s.classificacao === "BLOQUEADO").length,
  };

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">
          🦆 TioPato Dashboard
        </h1>
        <p className="text-slate-400">Simulações Santander Financiamentos</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatCard title="Total" value={stats.total} icon="📊" />
        <StatCard title="Ótimo" value={stats.otimo} icon="🟢" />
        <StatCard title="Bom" value={stats.bom} icon="🟡" />
        <StatCard title="Ruim" value={stats.ruim} icon="🔴" />
        <StatCard title="Bloqueado" value={stats.bloqueado} icon="⚫" />
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="Buscar por nome ou CPF..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        <div className="flex gap-2 flex-wrap">
          {["TODOS", "OTIMO", "BOM", "RUIM", "BLOQUEADO"].map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filtro === f
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 border border-slate-700/50"
              }`}
            >
              {f === "TODOS" ? "Todos" : CLASSIFICACAO_CONFIG[f]?.label || f}
            </button>
          ))}
        </div>

        <button
          onClick={fetchSimulacoes}
          className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:bg-slate-700/50 transition-colors"
          title="Atualizar"
        >
          🔄
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Carregando...</div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400 text-lg">Nenhuma simulação encontrada</p>
          <p className="text-slate-500 text-sm mt-2">
            Execute o script Python para processar CPFs
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtradas.map((cliente) => (
            <ClienteCard key={cliente.id} cliente={cliente} />
          ))}
        </div>
      )}
    </main>
  );
}
