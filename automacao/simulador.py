"""
Simulador Santander Financiamentos - Automação com Playwright
Recebe JSON exportado do dashboard, simula no Santander,
e gera arquivo de resultado para importar de volta.
"""

import asyncio
import json
import os
import re
import sys
import unicodedata
import argparse
from dotenv import load_dotenv
from playwright.async_api import async_playwright

load_dotenv()

VEICULO = {
    "marca": "GM - CHEVROLET",
    "ano": "2025 GASOLINA",
    "modelo": "EQUINOX ACTIV 1.5 TURBO 177CV AUT.",
    "valor": "200000",
}

SITE_URL = "https://cliente.santanderfinanciamentos.com.br/originacaocliente/?int_source=portalSF&int_medium=c2c&int_campaign=simular-agora&mathts=nonpaid#/dados-pessoais"


def remover_acentos(texto: str) -> str:
    nfkd = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def gerar_email(nome: str) -> str:
    partes = nome.strip().split()
    primeiro = partes[0].lower() if partes else ""
    sobrenome = partes[-1].lower() if len(partes) >= 2 else ""
    return remover_acentos(f"{primeiro}{sobrenome}@gmail.com")


async def simular_financiamento(page, cliente: dict) -> dict | None:
    """Preenche o formulário do Santander e coleta o resultado."""
    try:
        print(f"  [NAV] Abrindo site...")
        await page.goto(SITE_URL, wait_until="networkidle", timeout=60000)
        await page.wait_for_timeout(3000)

        # 1. Pessoa Física
        print(f"  [FORM] Clicando em Pessoa Física...")
        pf_btn = page.locator("text=Pessoa Física").first
        if await pf_btn.is_visible():
            await pf_btn.click()
        await page.wait_for_timeout(2000)

        # 2. Dados pessoais
        print(f"  [FORM] Preenchendo dados pessoais...")

        # Data de nascimento
        nascimento_input = page.locator('input[placeholder*="nascimento"], input[name*="nascimento"], input[name*="birth"], input[id*="nascimento"]').first
        if not await nascimento_input.is_visible():
            nascimento_input = page.locator('input[type="text"], input[type="tel"]').first
        await nascimento_input.click()
        await nascimento_input.fill(cliente.get("data_nascimento", ""))

        # CPF
        cpf_input = page.locator('input[placeholder*="CPF"], input[name*="cpf"], input[id*="cpf"]').first
        if not await cpf_input.is_visible():
            cpf_input = page.locator('input[type="text"], input[type="tel"]').nth(1)
        await cpf_input.click()
        await cpf_input.fill(cliente["cpf"])

        # Email
        email = cliente.get("email") or gerar_email(cliente.get("nome", ""))
        email_input = page.locator('input[type="email"], input[placeholder*="mail"], input[name*="email"]').first
        await email_input.click()
        await email_input.fill(email)

        # Celular
        tel = cliente.get("telefone", "")
        tel_input = page.locator('input[placeholder*="celular"], input[placeholder*="telefone"], input[name*="celular"], input[type="tel"]').first
        await tel_input.click()
        await tel_input.fill(tel)

        # CNH = Sim
        cnh_sim = page.locator('text=Sim').first
        if await cnh_sim.is_visible():
            await cnh_sim.click()
        await page.wait_for_timeout(1000)

        # 3. Quero simular
        print(f"  [FORM] Clicando em Quero simular...")
        simular_btn = page.locator('button:has-text("Quero simular"), a:has-text("Quero simular")').first
        await simular_btn.click()
        await page.wait_for_timeout(3000)

        # 4. Carro
        print(f"  [FORM] Escolhendo Carro...")
        carro_btn = page.locator('text=Carro').first
        if await carro_btn.is_visible():
            await carro_btn.click()
        await page.wait_for_timeout(2000)

        # 5. Dados do veículo
        print(f"  [FORM] Preenchendo veículo...")

        # Marca
        marca_select = page.locator('select[name*="marca"], select[id*="marca"]').first
        if await marca_select.is_visible():
            await marca_select.select_option(label=VEICULO["marca"])
        else:
            await page.locator('text=Marca').first.click()
            await page.wait_for_timeout(1000)
            await page.locator(f'text={VEICULO["marca"]}').first.click()
        await page.wait_for_timeout(2000)

        # Ano
        ano_select = page.locator('select[name*="ano"], select[id*="ano"]').first
        if await ano_select.is_visible():
            await ano_select.select_option(label=VEICULO["ano"])
        else:
            await page.locator('text=Ano').first.click()
            await page.wait_for_timeout(1000)
            await page.locator(f'text={VEICULO["ano"]}').first.click()
        await page.wait_for_timeout(2000)

        # Modelo
        modelo_select = page.locator('select[name*="modelo"], select[id*="modelo"]').first
        if await modelo_select.is_visible():
            await modelo_select.select_option(label=VEICULO["modelo"])
        else:
            await page.locator('text=Modelo').first.click()
            await page.wait_for_timeout(1000)
            await page.locator(f'text={VEICULO["modelo"]}').first.click()
        await page.wait_for_timeout(2000)

        # UF
        uf = cliente.get("uf", "SP")
        uf_select = page.locator('select[name*="uf"], select[name*="estado"], select[id*="uf"]').first
        if await uf_select.is_visible():
            try:
                await uf_select.select_option(label=uf)
            except:
                await uf_select.select_option(value=uf)
        await page.wait_for_timeout(1000)

        # Valor
        valor_input = page.locator('input[name*="valor"], input[id*="valor"], input[placeholder*="valor"]').first
        await valor_input.click()
        await valor_input.fill(VEICULO["valor"])
        await page.wait_for_timeout(1000)

        # 6. Ver simulação
        print(f"  [FORM] Clicando em Ver simulação...")
        ver_btn = page.locator('button:has-text("Ver simulação"), button:has-text("Ver simulacao")').first
        await ver_btn.click()
        await page.wait_for_timeout(5000)

        # 7. Coletar resultados
        print(f"  [RESULT] Coletando resultados...")
        page_text = await page.inner_text("body")
        valor_veiculo = 200000.00

        entrada_match = re.search(r"[Ee]ntrada[:\s]*R?\$?\s*([\d.,]+)", page_text)
        entrada_valor = 0.0
        if entrada_match:
            entrada_str = entrada_match.group(1).replace(".", "").replace(",", ".")
            entrada_valor = float(entrada_str)

        parcela_match = re.search(r"[Pp]arcela[s]?[:\s]*R?\$?\s*([\d.,]+)", page_text)
        parcela_valor = 0.0
        if parcela_match:
            parcela_str = parcela_match.group(1).replace(".", "").replace(",", ".")
            parcela_valor = float(parcela_str)

        qtd_match = re.search(r"(\d+)\s*(?:[xX]|vezes|parcelas|meses)", page_text)
        parcela_qtd = 0
        if qtd_match:
            parcela_qtd = int(qtd_match.group(1))

        entrada_pct = (entrada_valor / valor_veiculo) * 100 if valor_veiculo > 0 else 0

        print(f"  [RESULT] Entrada: R$ {entrada_valor:.2f} ({entrada_pct:.1f}%)")
        print(f"  [RESULT] Parcela: R$ {parcela_valor:.2f} x {parcela_qtd}")

        return {
            "cpf": cliente["cpf"],
            "entrada_valor": round(entrada_valor, 2),
            "entrada_percentual": round(entrada_pct, 2),
            "parcela_valor": round(parcela_valor, 2),
            "parcela_qtd": parcela_qtd,
            "bloqueado": False,
        }

    except Exception as e:
        print(f"  [ERRO] Falha: {e}")
        try:
            await page.screenshot(path=f"erro_{cliente['cpf']}.png")
            print(f"  [DEBUG] Screenshot: erro_{cliente['cpf']}.png")
        except:
            pass
        return {
            "cpf": cliente["cpf"],
            "bloqueado": True,
        }


async def main():
    parser = argparse.ArgumentParser(description="Simulador Santander Financiamentos")
    parser.add_argument("--arquivo", type=str, required=True, help="JSON exportado do dashboard (cpfs_para_simular.json)")
    parser.add_argument("--saida", type=str, default="resultado_simulacao.json", help="Arquivo de saída com resultados")
    parser.add_argument("--headless", action="store_true", help="Rodar sem abrir o navegador")
    args = parser.parse_args()

    with open(args.arquivo, "r", encoding="utf-8") as f:
        clientes = json.load(f)

    print(f"Total de clientes para simular: {len(clientes)}")
    resultados = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=args.headless)

        for i, cliente in enumerate(clientes):
            print(f"\n{'='*60}")
            print(f"[{i+1}/{len(clientes)}] {cliente.get('nome', 'N/A')} - CPF: {cliente['cpf']}")
            print(f"{'='*60}")

            context = await browser.new_context(
                viewport={"width": 1280, "height": 800},
                locale="pt-BR",
            )
            page = await context.new_page()

            resultado = await simular_financiamento(page, cliente)
            resultados.append(resultado)

            await context.close()
            await asyncio.sleep(3)

        await browser.close()

    # Salvar resultados
    with open(args.saida, "w", encoding="utf-8") as f:
        json.dump(resultados, f, ensure_ascii=False, indent=2)

    # Resumo
    aprovados = [r for r in resultados if not r.get("bloqueado")]
    bloqueados = [r for r in resultados if r.get("bloqueado")]
    print(f"\n{'='*60}")
    print(f"RESULTADO FINAL")
    print(f"{'='*60}")
    print(f"Aprovados: {len(aprovados)}")
    print(f"Bloqueados: {len(bloqueados)}")
    print(f"Arquivo salvo: {args.saida}")
    print(f"Importe o arquivo '{args.saida}' no dashboard para concluir.")


if __name__ == "__main__":
    asyncio.run(main())
