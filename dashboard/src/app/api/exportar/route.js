import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from("simulacoes")
      .select("*")
      .eq("status", "CONSULTADO")
      .order("criado_em", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Formata JSON para o script Python
    const exportData = (data || []).map((r) => ({
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
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
