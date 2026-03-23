import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

function classificar(entradaPct) {
  if (entradaPct == null) return "BLOQUEADO";
  if (entradaPct <= 10) return "OTIMO";
  if (entradaPct <= 20) return "BOM";
  return "RUIM";
}

export async function POST(request) {
  try {
    const { resultados } = await request.json();
    const supabase = getSupabaseServer();

    let atualizados = 0;
    let bloqueados = 0;

    for (const r of resultados) {
      const cpf = r.cpf?.replace(/\D/g, "");
      if (!cpf) continue;

      if (r.bloqueado) {
        await supabase
          .from("simulacoes")
          .update({
            status: "CONCLUIDO",
            classificacao: "BLOQUEADO",
            concluido_em: new Date().toISOString(),
          })
          .eq("cpf", cpf);
        bloqueados++;
      } else {
        const entradaValor = parseFloat(r.entrada_valor) || 0;
        const entradaPct = parseFloat(r.entrada_percentual) || (entradaValor / 200000) * 100;
        const classificacao = classificar(entradaPct);

        await supabase
          .from("simulacoes")
          .update({
            status: "CONCLUIDO",
            entrada_valor: entradaValor,
            entrada_percentual: Math.round(entradaPct * 100) / 100,
            parcela_valor: parseFloat(r.parcela_valor) || 0,
            parcela_qtd: parseInt(r.parcela_qtd) || 0,
            classificacao,
            concluido_em: new Date().toISOString(),
          })
          .eq("cpf", cpf);
        atualizados++;
      }
    }

    return NextResponse.json({ atualizados, bloqueados });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
