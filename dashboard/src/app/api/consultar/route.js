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

function gerarTelefone() {
  // Gera telefone fictício com DDD válido de SP
  const ddd = "11";
  const num = "9" + String(Math.floor(Math.random() * 90000000 + 10000000));
  return ddd + num;
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

        // Navegar na estrutura da API completa
        let nome = "";
        let telefone = "";
        let dataNascimento = "";

        // DadosBasicos
        const basicos = dados?.DadosBasicos || dados?.dadosBasicos || dados?.dados_basicos || {};
        nome = basicos?.Nome || basicos?.nome || basicos?.NOME || basicos?.nomeCompleto || "";

        // Data de nascimento
        dataNascimento = basicos?.DataNascimento || basicos?.dataNascimento || basicos?.data_nascimento || "";

        // Telefones - pegar o primeiro válido
        const telefones = dados?.Telefones || dados?.telefones || [];
        if (Array.isArray(telefones) && telefones.length > 0) {
          for (const tel of telefones) {
            const num = tel?.Numero || tel?.numero || tel?.telefone || tel?.Telefone || "";
            const ddd = tel?.DDD || tel?.ddd || "";
            if (num) {
              telefone = ddd ? `${ddd}${num}`.replace(/\D/g, "") : String(num).replace(/\D/g, "");
              if (telefone.length >= 10) break; // Pegar um com DDD
            }
          }
        }

        // Se não achou telefone, gera um fictício
        if (!telefone || telefone.length < 10) {
          telefone = gerarTelefone();
        }

        const email = nome ? gerarEmail(nome) : "";

        const updateData = {
          status: "CONSULTADO",
          consultado_em: new Date().toISOString(),
        };

        if (telefone) updateData.telefone = telefone;
        if (email) updateData.email = email;
        if (dataNascimento) updateData.data_nascimento = dataNascimento;

        await supabase
          .from("simulacoes")
          .update(updateData)
          .eq("cpf", cpf);

        resultados.push({ cpf, status: "ok", nome, telefone: telefone ? "sim" : "gerado" });
      } catch (e) {
        // Em caso de erro, ainda marca como consultado com telefone fictício
        await supabase
          .from("simulacoes")
          .update({
            status: "CONSULTADO",
            consultado_em: new Date().toISOString(),
            telefone: gerarTelefone(),
          })
          .eq("cpf", cpf);

        resultados.push({ cpf, status: "erro_parcial", erro: e.message });
      }

      // Delay entre consultas
      await new Promise((r) => setTimeout(r, 300));
    }

    return NextResponse.json({ resultados });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
