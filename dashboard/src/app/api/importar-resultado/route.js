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
        const updateBloq = {
          status: "CONCLUIDO",
          classificacao: "BLOQUEADO",
          concluido_em: new Date().toISOString(),
        };
        // Mesmo bloqueado pode ter pré-aprovado
        if (r.pre_aprovado_valor) updateBloq.pre_aprovado_valor = parseFloat(r.pre_aprovado_valor);
        if (r.pre_aprovado_entrada_min) updateBloq.pre_aprovado_entrada_min = parseInt(r.pre_aprovado_entrada_min);
        if (r.pre_aprovado_prazo_max) updateBloq.pre_aprovado_prazo_max = parseInt(r.pre_aprovado_prazo_max);
        if (r.pre_aprovado_texto) updateBloq.pre_aprovado_texto = r.pre_aprovado_texto;

        await supabase
          .from("simulacoes")
          .update(updateBloq)
          .eq("cpf", cpf);
        bloqueados++;
      } else {
        let entradaPct = parseFloat(r.entrada_percentual) || 0;
        let entradaValor = parseFloat(r.entrada_valor) || 0;

        // Se a simulação retornou 0% mas o pré-aprovado tem entrada mínima, usar o pré-aprovado
        const preAprovEntradaMin = parseInt(r.pre_aprovado_entrada_min) || 0;
        if (entradaPct === 0 && preAprovEntradaMin > 0) {
          entradaPct = preAprovEntradaMin;
          entradaValor = (preAprovEntradaMin / 100) * 200000;
        }

        // Se tem valor mas não tem %, calcular
        if (entradaPct === 0 && entradaValor > 0) {
          entradaPct = (entradaValor / 200000) * 100;
        }

        const classificacao = classificar(entradaPct);

        const updateData = {
          status: "CONCLUIDO",
          entrada_valor: Math.round(entradaValor * 100) / 100,
          entrada_percentual: Math.round(entradaPct * 100) / 100,
          parcela_valor: parseFloat(r.parcela_valor) || 0,
          parcela_qtd: parseInt(r.parcela_qtd) || 0,
          classificacao,
          concluido_em: new Date().toISOString(),
        };

        // Pré-aprovado
        if (r.pre_aprovado_valor) updateData.pre_aprovado_valor = parseFloat(r.pre_aprovado_valor);
        if (r.pre_aprovado_entrada_min) updateData.pre_aprovado_entrada_min = parseInt(r.pre_aprovado_entrada_min);
        if (r.pre_aprovado_prazo_max) updateData.pre_aprovado_prazo_max = parseInt(r.pre_aprovado_prazo_max);
        if (r.pre_aprovado_texto) updateData.pre_aprovado_texto = r.pre_aprovado_texto;

        await supabase
          .from("simulacoes")
          .update(updateData)
          .eq("cpf", cpf);
        atualizados++;
      }
    }

    return NextResponse.json({ atualizados, bloqueados });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
