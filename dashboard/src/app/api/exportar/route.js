import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
      return NextResponse.json({ error: `Missing env: url=${!!url}, key=${!!key}` }, { status: 500 });
    }

    const supabase = createClient(url, key);

    // Primeiro tenta buscar tudo para debug
    const { data: all, error: errAll } = await supabase
      .from("simulacoes")
      .select("cpf, status")
      .limit(5);

    // Agora busca consultados
    const { data, error } = await supabase
      .from("simulacoes")
      .select("*")
      .eq("status", "CONSULTADO")
      .order("criado_em", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message, debug: { all_sample: all, all_error: errAll?.message } }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        error: "Nenhum registro CONSULTADO encontrado",
        debug: {
          total_amostra: all?.length || 0,
          amostra: all,
          all_error: errAll?.message,
        }
      }, { status: 404 });
    }

    // Formata JSON para o script Python
    const exportData = data.map((r) => ({
      cpf: r.cpf,
      nome: r.nome,
      data_nascimento: r.data_nascimento,
      telefone: r.telefone || "",
      email: r.email || "",
      uf: r.uf,
      cidade_uf: r.cidade_uf,
    }));

    return NextResponse.json(exportData);
  } catch (e) {
    return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
}
