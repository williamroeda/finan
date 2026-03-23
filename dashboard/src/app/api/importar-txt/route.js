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
      // Formato: "03/01/1984 / 42 anos" -> extrair "03/01/1984"
      const dataRaw = partes[2]?.trim() || "";
      const dataMatch = dataRaw.match(/(\d{2}\/\d{2}\/\d{4})/);
      const dataNascimento = dataMatch ? dataMatch[1] : dataRaw;
      const profissao = partes[3]?.trim() || "";
      // Formato: CPF | Nome | Data | Profissão | (vazio) | Bairro | Cidade/UF | Consultar
      const bairro = partes[5]?.trim() || partes[4]?.trim() || "";
      const cidadeUf = partes[6]?.trim() || partes[5]?.trim() || "";

      // Extrair UF da cidade/UF (ex: "Taubaté/SP" -> "SP", "Rio de Janeiro/RJ" -> "RJ")
      let uf = "";
      // Tenta achar UF no formato Cidade/UF em todas as colunas
      for (let j = partes.length - 1; j >= 0; j--) {
        const m = partes[j]?.trim().match(/\/([A-Z]{2})$/);
        if (m) {
          uf = m[1];
          break;
        }
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
