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

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error(`Missing env: url=${!!url}, key=${!!key}`);
  return createClient(url, key);
}

export async function POST(request) {
  try {
    const { cpfs } = await request.json();
    const supabase = getSupabase();
    const apiToken = process.env.API_TOKEN;
    const apiUrl = process.env.API_URL;

    const resultados = [];

    for (const cpf of cpfs) {
      const updateData = {
        status: "CONSULTADO",
        consultado_em: new Date().toISOString(),
      };

      try {
        const resp = await fetch(
          `${apiUrl}?token=${apiToken}&modulo=cpf&consulta=${cpf}`,
          { signal: AbortSignal.timeout(30000) }
        );

        if (!resp.ok) {
          throw new Error(`API HTTP ${resp.status}`);
        }

        const dados = await resp.json();

        // DadosBasicos (chaves minúsculas na API)
        const basicos = dados?.DadosBasicos || {};
        const nome = basicos?.nome || basicos?.Nome || "";
        const dataNascimento = basicos?.dataNascimento || basicos?.DataNascimento || "";

        // DadosEconomicos
        const economicos = dados?.DadosEconomicos || {};

        // Renda - campo direto "renda"
        let renda = 0;
        const rendaRaw = economicos?.renda || economicos?.Renda || "";
        if (rendaRaw) {
          const rendaStr = String(rendaRaw).replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
          renda = parseFloat(rendaStr) || 0;
        }

        // Score - é um OBJETO: { scoreCSB: "789", scoreCSBFaixaRisco: "...", scoreCSBA: "..." }
        let score = 0;
        const scoreObj = economicos?.score || economicos?.Score || {};
        if (typeof scoreObj === "object" && scoreObj !== null) {
          score = parseInt(scoreObj?.scoreCSB || scoreObj?.scoreCSBA || scoreObj?.Valor || scoreObj?.valor || 0) || 0;
        } else {
          score = parseInt(scoreObj) || 0;
        }

        // Poder Aquisitivo - é um OBJETO: { poderAquisitivoDescricao: "MUITO ALTO", ... }
        let poderAquisitivo = "";
        const paObj = economicos?.poderAquisitivo || economicos?.PoderAquisitivo || {};
        if (typeof paObj === "object" && paObj !== null) {
          poderAquisitivo = paObj?.poderAquisitivoDescricao || paObj?.faixaPoderAquisitivo || "";
        } else {
          poderAquisitivo = String(paObj) || "";
        }

        // Telefones - campo é "telefone" (não "Numero"/"DDD")
        const telefones = dados?.telefones || dados?.Telefones || [];
        let telefone = "";
        if (Array.isArray(telefones) && telefones.length > 0) {
          for (const tel of telefones) {
            // Campo "telefone" contém o número completo com DDD
            const num = String(tel?.telefone || tel?.Telefone || tel?.numero || tel?.Numero || "").replace(/\D/g, "");
            if (num.length >= 10) {
              telefone = num;
              break;
            }
          }
        }
        if (!telefone || telefone.length < 10) {
          telefone = gerarTelefone();
        }

        const email = nome ? gerarEmail(nome) : "";

        if (telefone) updateData.telefone = telefone;
        if (email) updateData.email = email;
        if (dataNascimento) updateData.data_nascimento = dataNascimento;
        if (renda > 0) updateData.renda = renda;
        if (score > 0) updateData.score = score;
        if (poderAquisitivo) updateData.poder_aquisitivo = poderAquisitivo;

        resultados.push({ cpf, status: "ok", nome, renda, score, poder: poderAquisitivo });
      } catch (e) {
        updateData.telefone = gerarTelefone();
        resultados.push({ cpf, status: "erro_api", erro: e.message });
      }

      // SEMPRE salvar no banco
      const { error: dbError } = await supabase
        .from("simulacoes")
        .update(updateData)
        .eq("cpf", cpf);

      if (dbError) {
        resultados[resultados.length - 1].db_error = dbError.message;
      }

      await new Promise((r) => setTimeout(r, 300));
    }

    return NextResponse.json({ resultados });
  } catch (e) {
    return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
}
