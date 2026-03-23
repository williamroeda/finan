"""
Simulador Santander Financiamentos - Automação com Playwright
Consulta dados do cliente via API OwnData, preenche o formulário do Santander,
coleta o resultado e salva no Supabase.
"""

import asyncio
import json
import os
import re
import sys
import time
import unicodedata
import argparse
import requests
from dotenv import load_dotenv
from playwright.async_api import async_playwright
from supabase import create_client

load_dotenv()

API_TOKEN = os.getenv("API_TOKEN")
API_URL = os.getenv("API_URL")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

VEICULO = {
    "marca": "GM - CHEVROLET",
    "ano": "2025 GASOLINA",
    "modelo": "EQUINOX ACTIV 1.5 TURBO 177CV AUT.",
    "valor": "200000",
}

SITE_URL = "https://cliente.santanderfinanciamentos.com.br/originacaocliente/?int_source=portalSF&int_medium=c2c&int_campaign=simular-agora&mathts=nonpaid#/dados-pessoais"


def remover_acentos(texto: str) -> str:
    """Remove acentos de uma string."""
    nfkd = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def gerar_email(nome: str) -> str:
    """Gera email no formato primeironomesobrenome@gmail.com sem acentos."""
    partes = nome.strip().split()
    if len(partes) >= 2:
        primeiro = partes[0].lower()
        sobrenome = partes[-1].lower()
    else:
        primeiro = partes[0].lower()
        sobrenome = ""
    email = remover_acentos(f"{primeiro}{sobrenome}@gmail.com")
    return email


def formatar_cpf(cpf: str) -> str:
    """Garante que o CPF tem 11 dígitos."""
    cpf = re.sub(r"\D", "", cpf)
    return cpf.zfill(11)


def classificar(entrada_pct: float) -> str:
    """Classifica o cliente baseado no percentual de entrada."""
    if entrada_pct <= 10:
        return "OTIMO"
    elif entrada_pct <= 20:
        return "BOM"
    else:
        return "RUIM"


def consultar_api(cpf: str) -> dict | None:
    """Consulta a API OwnData para obter dados do cliente."""
    cpf_limpo = re.sub(r"\D", "", cpf)
    url = f"{API_URL}?token={API_TOKEN}&modulo=cpf&consulta={cpf_limpo}"
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        dados = resp.json()
        print(f"  [API] Resposta recebida para CPF {cpf_limpo}")
        return dados
    except Exception as e:
        print(f"  [API] Erro ao consultar CPF {cpf_limpo}: {e}")
        return None


def salvar_supabase(registro: dict):
    """Salva o resultado da simulação no Supabase."""
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    try:
        supabase.table("simulacoes").insert(registro).execute()
        print(f"  [DB] Salvo no Supabase: {registro['nome']} - {registro['classificacao']}")
    except Exception as e:
        print(f"  [DB] Erro ao salvar: {e}")


def extrair_dados_cliente(dados_api: dict) -> dict | None:
    """Extrai nome, nascimento, telefone e UF da resposta da API."""
    try:
        # A API pode retornar em diferentes formatos, tentamos os mais comuns
        if isinstance(dados_api, list) and len(dados_api) > 0:
            dados = dados_api[0]
        elif isinstance(dados_api, dict):
            # Pode ter uma chave 'data', 'result', 'dados' ou ser direto
            dados = dados_api.get("data", dados_api.get("result", dados_api.get("dados", dados_api)))
            if isinstance(dados, list) and len(dados) > 0:
                dados = dados[0]
        else:
            return None

        # Tenta extrair os campos com nomes variados
        nome = (
            dados.get("nome")
            or dados.get("NOME")
            or dados.get("name")
            or dados.get("nomeCompleto")
            or ""
        )
        cpf = (
            dados.get("cpf")
            or dados.get("CPF")
            or dados.get("documento")
            or ""
        )
        nascimento = (
            dados.get("data_nascimento")
            or dados.get("dataNascimento")
            or dados.get("DATA_NASCIMENTO")
            or dados.get("nascimento")
            or dados.get("dt_nascimento")
            or ""
        )
        telefone = (
            dados.get("telefone")
            or dados.get("celular")
            or dados.get("TELEFONE")
            or dados.get("phone")
            or ""
        )
        # Telefone pode vir como lista
        if isinstance(telefone, list) and len(telefone) > 0:
            telefone = telefone[0]
            if isinstance(telefone, dict):
                telefone = telefone.get("numero", telefone.get("telefone", ""))

        uf = (
            dados.get("uf")
            or dados.get("UF")
            or dados.get("estado")
            or dados.get("sigla_uf")
            or ""
        )

        if not nome:
            print("  [PARSE] Nome não encontrado na resposta da API")
            print(f"  [PARSE] Chaves disponíveis: {list(dados.keys()) if isinstance(dados, dict) else 'N/A'}")
            return None

        return {
            "nome": nome.strip(),
            "cpf": re.sub(r"\D", "", str(cpf)),
            "nascimento": nascimento.strip() if isinstance(nascimento, str) else str(nascimento),
            "telefone": re.sub(r"\D", "", str(telefone)),
            "uf": uf.strip().upper() if isinstance(uf, str) else str(uf),
        }
    except Exception as e:
        print(f"  [PARSE] Erro ao extrair dados: {e}")
        return None


async def simular_financiamento(page, cliente: dict) -> dict | None:
    """
    Preenche o formulário do Santander e coleta o resultado.
    Retorna dict com entrada_valor, entrada_percentual, parcela_valor, parcela_qtd.
    """
    try:
        print(f"  [NAV] Abrindo site do Santander...")
        await page.goto(SITE_URL, wait_until="networkidle", timeout=60000)
        await page.wait_for_timeout(3000)

        # 1. Clica em "Pessoa Física"
        print(f"  [FORM] Clicando em Pessoa Física...")
        pf_btn = page.locator("text=Pessoa Física").first
        if await pf_btn.is_visible():
            await pf_btn.click()
        else:
            # Tenta alternativas
            pf_btn = page.locator('[data-testid*="fisica"], [class*="fisica"], button:has-text("Pessoa Física")').first
            await pf_btn.click()
        await page.wait_for_timeout(2000)

        # 2. Preenche dados pessoais
        print(f"  [FORM] Preenchendo dados pessoais...")

        # Data de nascimento
        nascimento_input = page.locator('input[placeholder*="nascimento"], input[name*="nascimento"], input[name*="birth"], input[id*="nascimento"], input[id*="birth"]').first
        if not await nascimento_input.is_visible():
            nascimento_input = page.locator('input[type="text"], input[type="tel"]').first
        await nascimento_input.click()
        await nascimento_input.fill(cliente["nascimento"])

        # CPF
        cpf_input = page.locator('input[placeholder*="CPF"], input[name*="cpf"], input[id*="cpf"]').first
        if not await cpf_input.is_visible():
            cpf_input = page.locator('input[type="text"], input[type="tel"]').nth(1)
        await cpf_input.click()
        await cpf_input.fill(cliente["cpf"])

        # Email
        email = gerar_email(cliente["nome"])
        email_input = page.locator('input[type="email"], input[placeholder*="mail"], input[name*="email"], input[id*="email"]').first
        await email_input.click()
        await email_input.fill(email)

        # Celular
        tel_input = page.locator('input[placeholder*="celular"], input[placeholder*="telefone"], input[name*="celular"], input[name*="phone"], input[id*="celular"], input[type="tel"]').first
        await tel_input.click()
        await tel_input.fill(cliente["telefone"])

        # CNH = Sim
        print(f"  [FORM] Marcando CNH = Sim...")
        cnh_sim = page.locator('text=Sim').first
        if await cnh_sim.is_visible():
            await cnh_sim.click()
        await page.wait_for_timeout(1000)

        # 3. Clica "Quero simular"
        print(f"  [FORM] Clicando em Quero simular...")
        simular_btn = page.locator('button:has-text("Quero simular"), a:has-text("Quero simular"), [data-testid*="simular"]').first
        await simular_btn.click()
        await page.wait_for_timeout(3000)

        # 4. Escolhe "Carro"
        print(f"  [FORM] Escolhendo Carro...")
        carro_btn = page.locator('text=Carro').first
        if await carro_btn.is_visible():
            await carro_btn.click()
        await page.wait_for_timeout(2000)

        # 5. Preenche dados do veículo
        print(f"  [FORM] Preenchendo dados do veículo...")

        # Marca
        marca_select = page.locator('select[name*="marca"], select[id*="marca"], [data-testid*="marca"]').first
        if await marca_select.is_visible():
            await marca_select.select_option(label=VEICULO["marca"])
        else:
            # Pode ser um dropdown customizado
            marca_trigger = page.locator('text=Marca').first
            await marca_trigger.click()
            await page.wait_for_timeout(1000)
            await page.locator(f'text={VEICULO["marca"]}').first.click()
        await page.wait_for_timeout(2000)

        # Ano/combustível
        ano_select = page.locator('select[name*="ano"], select[id*="ano"], [data-testid*="ano"]').first
        if await ano_select.is_visible():
            await ano_select.select_option(label=VEICULO["ano"])
        else:
            ano_trigger = page.locator('text=Ano').first
            await ano_trigger.click()
            await page.wait_for_timeout(1000)
            await page.locator(f'text={VEICULO["ano"]}').first.click()
        await page.wait_for_timeout(2000)

        # Modelo
        modelo_select = page.locator('select[name*="modelo"], select[id*="modelo"], [data-testid*="modelo"]').first
        if await modelo_select.is_visible():
            await modelo_select.select_option(label=VEICULO["modelo"])
        else:
            modelo_trigger = page.locator('text=Modelo').first
            await modelo_trigger.click()
            await page.wait_for_timeout(1000)
            await page.locator(f'text={VEICULO["modelo"]}').first.click()
        await page.wait_for_timeout(2000)

        # UF
        uf_select = page.locator('select[name*="uf"], select[name*="estado"], select[id*="uf"], [data-testid*="uf"]').first
        if await uf_select.is_visible():
            await uf_select.select_option(label=cliente["uf"])
        else:
            uf_select = page.locator('select[name*="uf"], select[name*="estado"]').first
            await uf_select.select_option(value=cliente["uf"])
        await page.wait_for_timeout(1000)

        # Valor do veículo
        valor_input = page.locator('input[name*="valor"], input[id*="valor"], input[placeholder*="valor"]').first
        await valor_input.click()
        await valor_input.fill(VEICULO["valor"])
        await page.wait_for_timeout(1000)

        # 6. Clica "Ver simulação"
        print(f"  [FORM] Clicando em Ver simulação...")
        ver_btn = page.locator('button:has-text("Ver simulação"), button:has-text("Ver simulacao"), a:has-text("Ver simulação")').first
        await ver_btn.click()
        await page.wait_for_timeout(5000)

        # 7. Coleta resultados
        print(f"  [RESULT] Coletando resultados da simulação...")
        await page.wait_for_timeout(3000)

        # Tenta capturar o conteúdo da página de resultado
        page_text = await page.inner_text("body")

        # Extrai valores usando regex
        valor_veiculo = 200000.00

        # Entrada
        entrada_match = re.search(r"[Ee]ntrada[:\s]*R?\$?\s*([\d.,]+)", page_text)
        entrada_valor = 0.0
        if entrada_match:
            entrada_str = entrada_match.group(1).replace(".", "").replace(",", ".")
            entrada_valor = float(entrada_str)

        # Parcela
        parcela_match = re.search(r"[Pp]arcela[s]?[:\s]*R?\$?\s*([\d.,]+)", page_text)
        parcela_valor = 0.0
        if parcela_match:
            parcela_str = parcela_match.group(1).replace(".", "").replace(",", ".")
            parcela_valor = float(parcela_str)

        # Quantidade de parcelas
        qtd_match = re.search(r"(\d+)\s*(?:[xX]|vezes|parcelas|meses)", page_text)
        parcela_qtd = 0
        if qtd_match:
            parcela_qtd = int(qtd_match.group(1))

        entrada_percentual = (entrada_valor / valor_veiculo) * 100 if valor_veiculo > 0 else 0

        print(f"  [RESULT] Entrada: R$ {entrada_valor:.2f} ({entrada_percentual:.1f}%)")
        print(f"  [RESULT] Parcela: R$ {parcela_valor:.2f} x {parcela_qtd}")

        return {
            "entrada_valor": entrada_valor,
            "entrada_percentual": round(entrada_percentual, 2),
            "parcela_valor": parcela_valor,
            "parcela_qtd": parcela_qtd,
        }

    except Exception as e:
        print(f"  [ERRO] Falha na simulação: {e}")
        # Tira screenshot para debug
        try:
            await page.screenshot(path=f"erro_{cliente['cpf']}.png")
            print(f"  [DEBUG] Screenshot salvo: erro_{cliente['cpf']}.png")
        except:
            pass
        return None


async def processar_cpf(cpf: str, browser):
    """Processa um único CPF: consulta API, simula, salva."""
    cpf_limpo = formatar_cpf(cpf)
    print(f"\n{'='*60}")
    print(f"Processando CPF: {cpf_limpo}")
    print(f"{'='*60}")

    # 1. Consulta API
    dados_api = consultar_api(cpf_limpo)
    if not dados_api:
        print(f"  [SKIP] Não foi possível consultar o CPF {cpf_limpo}")
        return

    # 2. Extrai dados
    cliente = extrair_dados_cliente(dados_api)
    if not cliente:
        print(f"  [SKIP] Dados insuficientes para o CPF {cpf_limpo}")
        print(f"  [DEBUG] Resposta da API: {json.dumps(dados_api, ensure_ascii=False, indent=2)[:500]}")
        return

    print(f"  [INFO] Nome: {cliente['nome']}")
    print(f"  [INFO] UF: {cliente['uf']}")
    print(f"  [INFO] Nascimento: {cliente['nascimento']}")

    # 3. Simula no Santander
    context = await browser.new_context(
        viewport={"width": 1280, "height": 800},
        locale="pt-BR",
    )
    page = await context.new_page()

    resultado = await simular_financiamento(page, cliente)

    await context.close()

    # 4. Classifica e salva
    if resultado:
        classificacao = classificar(resultado["entrada_percentual"])
        registro = {
            "cpf": cpf_limpo,
            "nome": cliente["nome"],
            "uf": cliente["uf"],
            "entrada_percentual": resultado["entrada_percentual"],
            "entrada_valor": resultado["entrada_valor"],
            "parcela_valor": resultado["parcela_valor"],
            "parcela_qtd": resultado["parcela_qtd"],
            "classificacao": classificacao,
        }
        salvar_supabase(registro)
        print(f"  [OK] {cliente['nome']} -> {classificacao}")
    else:
        # Bloqueado
        registro = {
            "cpf": cpf_limpo,
            "nome": cliente["nome"],
            "uf": cliente["uf"],
            "entrada_percentual": None,
            "entrada_valor": None,
            "parcela_valor": None,
            "parcela_qtd": None,
            "classificacao": "BLOQUEADO",
        }
        salvar_supabase(registro)
        print(f"  [BLOQUEADO] {cliente['nome']}")


async def main():
    parser = argparse.ArgumentParser(description="Simulador Santander Financiamentos")
    parser.add_argument("--cpf", type=str, help="CPF único para simular")
    parser.add_argument("--arquivo", type=str, help="Arquivo JSON com lista de CPFs")
    parser.add_argument("--headless", action="store_true", help="Rodar sem abrir o navegador")
    args = parser.parse_args()

    if not args.cpf and not args.arquivo:
        print("Uso: python simulador.py --cpf 12345678901")
        print("     python simulador.py --arquivo clientes.json")
        print("     python simulador.py --arquivo clientes.json --headless")
        sys.exit(1)

    # Lista de CPFs
    cpfs = []
    if args.cpf:
        cpfs = [args.cpf]
    elif args.arquivo:
        with open(args.arquivo, "r") as f:
            cpfs = json.load(f)

    print(f"Total de CPFs para processar: {len(cpfs)}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=args.headless)

        for cpf in cpfs:
            await processar_cpf(cpf, browser)
            # Intervalo entre simulações para não sobrecarregar
            await asyncio.sleep(3)

        await browser.close()

    print(f"\n{'='*60}")
    print(f"Processamento finalizado! {len(cpfs)} CPF(s) processado(s).")
    print(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(main())
