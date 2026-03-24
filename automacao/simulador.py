"""
Simulador Santander Financiamentos - Automação com Playwright
Seletores reais do site do Santander (Março 2026)
VERSÃO RÁPIDA - tempos otimizados
"""

import asyncio
import json
import re
import sys
import unicodedata
import argparse
from playwright.async_api import async_playwright

VEICULO = {
    "marca": "GM - CHEVROLET",
    "ano": "2025 GASOLINA",
    "modelo": "EQUINOX ACTIV 1.5 TURBO 177CV AUT.",
    "valor": "200000",
}

SITE_URL = "https://www.cliente.santanderfinanciamentos.com.br/originacaocliente/?ori=SF&int_source=menu-simule-ja#/dados-pessoais"

UF_NOME = {
    "AC": "Acre", "AL": "Alagoas", "AP": "Amapá", "AM": "Amazonas",
    "BA": "Bahia", "CE": "Ceará", "DF": "Distrito Federal", "ES": "Espírito Santo",
    "GO": "Goiás", "MA": "Maranhão", "MT": "Mato Grosso", "MS": "Mato Grosso do Sul",
    "MG": "Minas Gerais", "PA": "Pará", "PB": "Paraíba", "PR": "Paraná",
    "PE": "Pernambuco", "PI": "Piauí", "RJ": "Rio de Janeiro", "RN": "Rio Grande do Norte",
    "RS": "Rio Grande do Sul", "RO": "Rondônia", "RR": "Roraima", "SC": "Santa Catarina",
    "SP": "São Paulo", "SE": "Sergipe", "TO": "Tocantins",
}


def remover_acentos(texto: str) -> str:
    nfkd = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def gerar_email(nome: str) -> str:
    partes = nome.strip().split()
    primeiro = partes[0].lower() if partes else ""
    sobrenome = partes[-1].lower() if len(partes) >= 2 else ""
    return remover_acentos(f"{primeiro}{sobrenome}@gmail.com")


def formatar_telefone(tel: str) -> str:
    num = re.sub(r"\D", "", tel)
    if not num:
        return "11999999999"
    if len(num) == 10:
        num = num[:2] + "9" + num[2:]
    if len(num) < 10:
        ddd = num[:2] if len(num) >= 2 else "11"
        num = ddd + "9" + "9" * 8
    if len(num) > 11:
        num = num[:11]
    return num


async def preencher_combobox(page, index, texto):
    """Preenche um ng-select combobox - VERSÃO RÁPIDA."""
    ng_selects = page.locator("ng-select")
    await ng_selects.nth(index).click()
    await page.wait_for_timeout(200)

    input_combo = ng_selects.nth(index).locator("input[role='combobox']")
    await input_combo.fill("")
    await input_combo.type(texto, delay=20)
    await page.wait_for_timeout(800)

    dropdown_option = page.locator("div.ng-option").first
    if await dropdown_option.is_visible():
        await dropdown_option.click()
    else:
        await page.locator(f"div.ng-option:has-text('{texto[:20]}')").first.click()

    await page.wait_for_timeout(500)


async def simular_financiamento(page, cliente: dict) -> dict:
    """Preenche o formulário do Santander e coleta o resultado."""
    try:
        # 1. Abrir site
        print(f"  [1/8] Abrindo site...")
        await page.goto(SITE_URL, wait_until="domcontentloaded", timeout=60000)
        # Esperar o botão Pessoa Física aparecer em vez de tempo fixo
        await page.locator("button.btn-person").wait_for(state="visible", timeout=15000)
        await page.wait_for_timeout(500)

        # 2. Pessoa Física
        print(f"  [2/8] Clicando em Pessoa Física...")
        await page.locator("button.btn-person").click()
        await page.locator('input[formcontrolname="dateOfBirth"]').wait_for(state="visible", timeout=5000)
        await page.wait_for_timeout(300)

        # 3. Dados pessoais
        print(f"  [3/8] Preenchendo dados pessoais...")

        nascimento = cliente.get("data_nascimento", "")
        input_nascimento = page.locator('input[formcontrolname="dateOfBirth"]')
        await input_nascimento.click()
        await input_nascimento.type(nascimento, delay=20)

        cpf = cliente["cpf"]
        input_cpf = page.locator('input[formcontrolname="cpf"]')
        await input_cpf.click()
        await input_cpf.type(cpf, delay=15)

        email = cliente.get("email") or gerar_email(cliente.get("nome", ""))
        input_email = page.locator('input[formcontrolname="email"]')
        await input_email.click()
        await input_email.type(email, delay=15)

        telefone = formatar_telefone(cliente.get("telefone", ""))
        input_cel = page.locator('input[formcontrolname="cellNumber"]')
        await input_cel.click()
        await input_cel.type(telefone, delay=15)
        await page.wait_for_timeout(200)

        # CNH = Sim
        try:
            cnh_sim = page.locator("text=Sim").first
            if await cnh_sim.is_visible(timeout=1000):
                await cnh_sim.click()
        except:
            pass

        # 4. Quero simular
        print(f"  [4/8] Clicando em Quero simular...")
        await page.locator("button.btn-simulate").click()
        # Esperar a próxima tela carregar
        await page.locator("button.btn-vehicle").wait_for(state="visible", timeout=15000)
        await page.wait_for_timeout(500)

        # Pré-aprovado
        pre_aprovado = ""
        pre_aprovado_valor = 0.0
        pre_aprovado_entrada_min = 0
        pre_aprovado_prazo_max = 0

        # Função para capturar pré-aprovado em qualquer tela
        async def capturar_pre_aprovado():
            nonlocal pre_aprovado, pre_aprovado_valor, pre_aprovado_entrada_min, pre_aprovado_prazo_max
            if pre_aprovado_valor > 0:
                return  # Já capturou
            try:
                # Tentar múltiplos seletores
                for seletor in ["p.advice", ".advice", "[class*='advice']", ".pre-approved", ".alert-success", ".info-box"]:
                    el = page.locator(seletor).first
                    if await el.is_visible(timeout=500):
                        texto = await el.inner_text()
                        texto = texto.replace("\xa0", " ").strip()
                        if "Pr" in texto and "Aprovado" in texto:
                            pre_aprovado = texto
                            break

                # Se não achou por seletor, busca no body
                if not pre_aprovado:
                    body_text = await page.inner_text("body")
                    # Procurar "Pré Aprovado" ou "Pré-Aprovado"
                    pre_match = re.search(r"(Voc[êe]\s+tem\s+R\$\s*[\d.,]+.*?(?:cr[ée]dito|an[áa]lise)\.?)", body_text, re.IGNORECASE | re.DOTALL)
                    if pre_match:
                        pre_aprovado = pre_match.group(1).strip()
                    elif "Pré Aprovado" in body_text or "Pré-Aprovado" in body_text:
                        pre_match2 = re.search(r"R\$\s*[\d.,]+.*?Pr[ée].?Aprovad", body_text, re.IGNORECASE)
                        if pre_match2:
                            # Pegar contexto ao redor
                            start = max(0, pre_match2.start() - 20)
                            end = min(len(body_text), pre_match2.end() + 200)
                            pre_aprovado = body_text[start:end].strip()

                if pre_aprovado:
                    print(f"  [PRÉ-APROVADO] {pre_aprovado[:120]}...")

                    valor_match = re.search(r"R\$\s*([\d.,]+)", pre_aprovado)
                    if valor_match:
                        v = valor_match.group(1).replace(".", "").replace(",", ".")
                        pre_aprovado_valor = float(v)

                    entrada_match = re.search(r"[Ee]ntrada\s+m[ií]nima\s+de\s+(\d+)%", pre_aprovado)
                    if entrada_match:
                        pre_aprovado_entrada_min = int(entrada_match.group(1))

                    prazo_match = re.search(r"[Pp]razo\s+m[áa]ximo\s+de\s+(\d+)", pre_aprovado)
                    if prazo_match:
                        pre_aprovado_prazo_max = int(prazo_match.group(1))

                    print(f"  [PRÉ-APROVADO] Valor: R$ {pre_aprovado_valor:,.2f} | Entrada mín: {pre_aprovado_entrada_min}% | Prazo máx: {pre_aprovado_prazo_max}m")
                else:
                    print(f"  [INFO] Sem pré-aprovado detectado")
            except Exception as e:
                print(f"  [INFO] Erro pré-aprovado: {e}")

        # 5. Carro
        print(f"  [5/8] Escolhendo Carro...")
        await page.locator("button.btn-vehicle").click()
        await page.locator("button.btn-c2c-financing").wait_for(state="visible", timeout=10000)
        await page.wait_for_timeout(300)

        # Tentar capturar pré-aprovado AQUI (tela do tipo de veículo)
        await capturar_pre_aprovado()

        # 6. Você e o dono
        print(f"  [6/8] Clicando em 'Você e o dono'...")
        await page.locator("button.btn-c2c-financing").click()
        # Esperar formulário de veículo carregar
        await page.locator("ng-select").first.wait_for(state="visible", timeout=10000)
        await page.wait_for_timeout(500)

        # Tentar capturar pré-aprovado AQUI também (tela de detalhes)
        await capturar_pre_aprovado()

        # 7. Veículo
        print(f"  [7/8] Preenchendo veículo...")

        await preencher_combobox(page, 0, VEICULO["marca"])
        print(f"    Marca: {VEICULO['marca']}")

        await preencher_combobox(page, 1, VEICULO["ano"])
        print(f"    Ano: {VEICULO['ano']}")

        await preencher_combobox(page, 2, VEICULO["modelo"][:15])
        print(f"    Modelo: {VEICULO['modelo']}")

        uf_sigla = cliente.get("uf", "SP")
        uf_nome = UF_NOME.get(uf_sigla, "São Paulo")
        await preencher_combobox(page, 3, uf_nome)
        print(f"    UF: {uf_nome}")

        # Valor
        input_valor = page.locator("input#valor-veiculo")
        await input_valor.click()
        await input_valor.press("Control+a")
        await input_valor.press("Backspace")
        await input_valor.type("20000000", delay=15)
        await page.wait_for_timeout(300)
        print(f"    Valor: R$ 200.000,00")

        # 8. Ver simulação
        print(f"  [8/8] Clicando em Ver simulação...")
        btn_simular = page.locator("button.btn-simulate")
        await btn_simular.wait_for(state="visible", timeout=5000)

        is_disabled = await btn_simular.get_attribute("disabled")
        if is_disabled is not None:
            print(f"  [AVISO] Botão desabilitado, aguardando...")
            await page.wait_for_timeout(2000)

        await btn_simular.click()

        # Esperar resultado carregar (espera o elemento de parcela aparecer)
        try:
            await page.locator("#installmentValue").wait_for(state="visible", timeout=15000)
            await page.wait_for_timeout(1000)
        except:
            await page.wait_for_timeout(5000)

        # 9. Resultados
        print(f"  [RESULT] Coletando resultados...")

        entrada_pct = 0.0
        try:
            entrada_el = page.locator("strong").first
            entrada_text = await entrada_el.inner_text(timeout=5000)
            entrada_match = re.search(r"(\d+)", entrada_text)
            if entrada_match:
                entrada_pct = float(entrada_match.group(1))
        except:
            pass

        entrada_valor = (entrada_pct / 100) * 200000

        parcela_valor = 0.0
        try:
            parcela_el = page.locator("#installmentValue")
            parcela_text = await parcela_el.inner_text(timeout=3000)
            parcela_match = re.search(r"[\d.,]+", parcela_text.replace("R$", "").replace("\xa0", ""))
            if parcela_match:
                parcela_str = parcela_match.group(0).replace(".", "").replace(",", ".")
                parcela_valor = float(parcela_str)
        except:
            pass

        parcela_qtd = 0
        try:
            page_text = await page.inner_text("body")
            qtd_match = re.search(r"(\d+)\s*(?:x|X|vezes|parcelas|meses)", page_text)
            if qtd_match:
                parcela_qtd = int(qtd_match.group(1))
            else:
                combo_el = page.locator("ng-select .ng-value-label, .ng-value span").first
                if await combo_el.is_visible(timeout=1000):
                    combo_text = await combo_el.inner_text()
                    qtd_combo = re.search(r"(\d+)", combo_text)
                    if qtd_combo:
                        parcela_qtd = int(qtd_combo.group(1))
        except:
            pass

        if parcela_qtd == 0 and parcela_valor > 0:
            parcela_qtd = 48

        if entrada_pct == 0 and parcela_valor == 0:
            page_text = await page.inner_text("body")
            if "não foi possível" in page_text.lower() or "tente novamente" in page_text.lower() or "indisponível" in page_text.lower():
                print(f"  [RESULT] BLOQUEADO")
                return {"cpf": cliente["cpf"], "bloqueado": True}

        print(f"  [RESULT] Entrada: {entrada_pct}% = R$ {entrada_valor:,.2f}")
        print(f"  [RESULT] Parcela: R$ {parcela_valor:,.2f} x {parcela_qtd}")
        if pre_aprovado_valor > 0:
            print(f"  [RESULT] Pré-aprovado: R$ {pre_aprovado_valor:,.2f} | Entrada mín: {pre_aprovado_entrada_min}% | Prazo máx: {pre_aprovado_prazo_max}m")

        return {
            "cpf": cliente["cpf"],
            "entrada_valor": round(entrada_valor, 2),
            "entrada_percentual": round(entrada_pct, 2),
            "parcela_valor": round(parcela_valor, 2),
            "parcela_qtd": parcela_qtd,
            "pre_aprovado_valor": round(pre_aprovado_valor, 2),
            "pre_aprovado_entrada_min": pre_aprovado_entrada_min,
            "pre_aprovado_prazo_max": pre_aprovado_prazo_max,
            "pre_aprovado_texto": pre_aprovado,
            "bloqueado": False,
        }

    except Exception as e:
        print(f"  [ERRO] {e}")
        try:
            await page.screenshot(path=f"erro_{cliente['cpf']}.png")
        except:
            pass
        return {"cpf": cliente["cpf"], "bloqueado": True}


async def main():
    parser = argparse.ArgumentParser(description="Simulador Santander Financiamentos")
    parser.add_argument("--arquivo", type=str, required=True, help="JSON exportado do dashboard")
    parser.add_argument("--saida", type=str, default="resultado_simulacao.json", help="Arquivo de saída")
    parser.add_argument("--headless", action="store_true", help="Rodar sem abrir o navegador")
    parser.add_argument("--inicio", type=int, default=0, help="Índice inicial")
    args = parser.parse_args()

    with open(args.arquivo, "r", encoding="utf-8") as f:
        clientes = json.load(f)

    resultados = []
    try:
        with open(args.saida, "r", encoding="utf-8") as f:
            resultados = json.load(f)
            print(f"Resultados anteriores carregados: {len(resultados)}")
    except:
        pass

    cpfs_ja_feitos = {r["cpf"] for r in resultados}
    clientes_pendentes = [c for c in clientes if c["cpf"] not in cpfs_ja_feitos]
    print(f"Total no arquivo: {len(clientes)}")
    print(f"Já processados: {len(cpfs_ja_feitos)}")
    print(f"Restantes para simular: {len(clientes_pendentes)}")

    if len(clientes_pendentes) == 0:
        print("\nTodos os CPFs já foram processados!")
        print(f"Arquivo de resultados: {args.saida}")
        return

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=args.headless,
            args=["--disable-blink-features=AutomationControlled"]
        )

        for i, cliente in enumerate(clientes_pendentes):
            num = i + 1
            total = len(clientes_pendentes)
            print(f"\n{'='*60}")
            print(f"[{num}/{total}] {cliente.get('nome', 'N/A')} - CPF: {cliente['cpf']}")
            print(f"{'='*60}")

            context = await browser.new_context(
                viewport={"width": 1280, "height": 900},
                locale="pt-BR",
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            )
            page = await context.new_page()

            resultado = await simular_financiamento(page, cliente)
            resultados.append(resultado)

            with open(args.saida, "w", encoding="utf-8") as f:
                json.dump(resultados, f, ensure_ascii=False, indent=2)

            await context.close()
            await asyncio.sleep(1)

        await browser.close()

    aprovados = [r for r in resultados if not r.get("bloqueado")]
    bloqueados = [r for r in resultados if r.get("bloqueado")]
    print(f"\n{'='*60}")
    print(f"RESULTADO FINAL")
    print(f"{'='*60}")
    print(f"Aprovados: {len(aprovados)}")
    print(f"Bloqueados: {len(bloqueados)}")
    print(f"Arquivo salvo: {args.saida}")
    print(f"\nImporte '{args.saida}' no dashboard para concluir.")


if __name__ == "__main__":
    asyncio.run(main())
