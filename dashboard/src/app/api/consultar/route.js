import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
  const ddd = "11";
  const num = "9" + String(Math.floor(Math.random() * 90000000 + 10000000));
  return ddd + num;
}

export async function POST(request) {
  try {
    const { cpfs } = await request.json();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
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

        // DadosBasicos
        const basicos = dados?.DadosBasicos || dados?.dadosBasicos || {};
        const nome = basicos?.Nome || basicos?.nome || "";
        const dataNascimento = basicos?.DataNascimento || basicos?.dataNascimento || "";

        // DadosEconomicos
        const economicos = dados?.DadosEconomicos || dados?.dadosEconomicos || {};
        const renda = parseFloat(
          String(economicos?.Renda || economicos?.renda || economicos?.RendaPresumida || "0")
            .replace(/[R$\s.]/g, "").replace(",", ".")
        ) || 0;
        const poderAquisitivo = economicos?.PoderAquisitivo || economicos?.poderAquisitivo || "";

        // Score - pode estar em vários lugares
        let score = 0;
        const scoreVal = economicos?.Score || economicos?.score ||
          economicos?.ScoreCredito || economicos?.scoreCredito ||
          economicos?.ScoreSerasa || dados?.Score || 0;
        if (typeof scoreVal === "object") {
          score = parseInt(scoreVal?.Valor || scoreVal?.valor || scoreVal?.Score || 0) || 0;
        } else {
          score = parseInt(scoreVal) || 0;
        }

        // Telefones
        const telefones = dados?.Telefones || dados?.telefones || [];
        let telefone = "";
        if (Array.isArray(telefones) && telefones.length > 0) {
          for (const tel of telefones) {
            const num = tel?.Numero || tel?.numero || "";
            const ddd = tel?.DDD || tel?.ddd || "";
            if (num) {
              telefone = ddd ? `${ddd}${num}`.replace(/\D/g, "") : String(num).replace(/\D/g, "");
              if (telefone.length >= 10) break;
            }
          }
        }
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
        if (renda > 0) updateData.renda = renda;
        if (score > 0) updateData.score = score;
        if (poderAquisitivo) updateData.poder_aquisitivo = poderAquisitivo;

        await supabase
          .from("simulacoes")
          .update(updateData)
          .eq("cpf", cpf);

        resultados.push({ cpf, status: "ok", nome, renda, score });
      } catch (e) {
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

      await new Promise((r) => setTimeout(r, 300));
    }

    return NextResponse.json({ resultados });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
