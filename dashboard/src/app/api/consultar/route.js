import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

function removerAcentos(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function gerarEmail(nome) {
  const partes = nome.trim().split(/\s+/);
  const primeiro = partes[0]?.toLowerCase() || "";
  const sobrenome = partes[partes.length - 1]?.toLowerCase() || "";
  return removerAcentos(`${primeiro}${sobrenome}@gmail.com`);
}

export async function POST(request) {
  try {
    const { cpfs } = await request.json();
    const supabase = getSupabaseServer();
    const apiToken = process.env.API_TOKEN;
    const apiUrl = process.env.API_URL;

    const resultados = [];

    for (const cpf of cpfs) {
      try {
        const resp = await fetch(
          `${apiUrl}?token=${apiToken}&modulo=cpf&consulta=${cpf}`,
          { signal: AbortSignal.timeout(15000) }
        );
        const dados = await resp.json();

        // Extrair dados da resposta (a API pode retornar em formatos variados)
        let info = dados;
        if (Array.isArray(dados) && dados.length > 0) info = dados[0];
        if (info?.data) info = Array.isArray(info.data) ? info.data[0] : info.data;
        if (info?.result) info = Array.isArray(info.result) ? info.result[0] : info.result;
        if (info?.dados) info = Array.isArray(info.dados) ? info.dados[0] : info.dados;

        const nome = info?.nome || info?.NOME || info?.name || info?.nomeCompleto || "";
        let telefone = info?.telefone || info?.celular || info?.TELEFONE || info?.phone || "";
        if (Array.isArray(telefone)) {
          telefone = typeof telefone[0] === "object" ? telefone[0]?.numero || "" : telefone[0] || "";
        }

        const email = nome ? gerarEmail(nome) : "";

        const updateData = {
          status: "CONSULTADO",
          consultado_em: new Date().toISOString(),
        };

        // Só atualiza campos se a API retornou dados úteis
        if (telefone) updateData.telefone = String(telefone).replace(/\D/g, "");
        if (email) updateData.email = email;

        await supabase
          .from("simulacoes")
          .update(updateData)
          .eq("cpf", cpf);

        resultados.push({ cpf, status: "ok", nome });
      } catch (e) {
        resultados.push({ cpf, status: "erro", erro: e.message });
      }

      // Delay entre consultas (evitar rate limit)
      await new Promise((r) => setTimeout(r, 200));
    }

    return NextResponse.json({ resultados });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
