import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function POST(request) {
  try {
    const { texto } = await request.json();
    const supabase = getSupabaseServer();

    const linhas = texto.split("\n").filter((l) => l.trim());
    const registros = [];

    for (const linha of linhas) {
      const partes = linha.split("\t");
      if (partes.length < 2) continue;

      const cpf = partes[0].trim().replace(/\D/g, "");
      if (cpf.length !== 11) continue;

      const nome = partes[1]?.trim() || "";
      const dataNascimento = partes[2]?.split("/")[0]?.trim() || "";
      const profissao = partes[3]?.trim() || "";
      const bairro = partes[4]?.trim() || "";
      const cidadeUf = partes[5]?.trim() || "";

      // Extrair UF da cidade/UF (ex: "Rio de Janeiro/RJ" -> "RJ")
      let uf = "";
      const ufMatch = cidadeUf.match(/\/([A-Z]{2})$/);
      if (ufMatch) {
        uf = ufMatch[1];
      }

      registros.push({
        cpf,
        nome,
        data_nascimento: dataNascimento,
        profissao,
        bairro,
        cidade_uf: cidadeUf,
        uf,
        status: "PENDENTE",
      });
    }

    if (registros.length === 0) {
      return NextResponse.json({ error: "Nenhum CPF válido encontrado" }, { status: 400 });
    }

    // Verificar CPFs duplicados já no banco
    const cpfs = registros.map((r) => r.cpf);
    const { data: existentes } = await supabase
      .from("simulacoes")
      .select("cpf")
      .in("cpf", cpfs);

    const cpfsExistentes = new Set((existentes || []).map((e) => e.cpf));
    const novos = registros.filter((r) => !cpfsExistentes.has(r.cpf));

    if (novos.length === 0) {
      return NextResponse.json({
        importados: 0,
        duplicados: registros.length,
        message: "Todos os CPFs já estavam importados",
      });
    }

    const { error } = await supabase.from("simulacoes").insert(novos);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      importados: novos.length,
      duplicados: registros.length - novos.length,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
