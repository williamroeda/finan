"""
Simulador Santander Financiamentos - Automação com Playwright
Seletores reais do site do Santander (Março 2026)
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

# Mapa UF sigla -> nome completo (para o select do site)
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
    """Garante que o telefone tenha 11 dígitos (DDD + 9 + 8 dígitos)."""
    num = re.sub(r"\D", "", tel)
    if not num:
        return "11999999999"  # fallback
    # Se tem 10 dígitos, adiciona 9 após o DDD
    if len(num) == 10:
        num = num[:2] + "9" + num[2:]
    # Se tem menos de 10, gera um válido com o DDD
    if len(num) < 10:
        ddd = num[:2] if len(num) >= 2 else "11"
        num = ddd + "9" + "9" * 8
    # Se tem mais de 11, corta
    if len(num) > 11:
        num = num[:11]
    return num


async def preencher_combobox(page, index, texto):
    """Preenche um ng-select combobox pelo índice na página."""
    # Clica no ng-select para abrir
    ng_selects = page.locator("ng-select")
    await ng_selects.nth(index).click()
    await page.wait_for_timeout(500)

    # Digita no input do combobox
    input_combo = ng_selects.nth(index).locator("input[role='combobox']")
    await input_combo.fill("")
    await input_combo.type(texto, delay=50)
    await page.wait_for_timeout(1500)

    # Clica na primeira opção do dropdown
    dropdown_option = page.locator("div.ng-option").first
    if await dropdown_option.is_visible():
        await dropdown_option.click()
    else:
        # Tenta via texto parcial
        await page.locator(f"div.ng-option:has-text('{texto[:20]}')").first.click()

    await page.wait_for_timeout(1000)


async def simular_financiamento(page, cliente: dict) -> dict:
    """Preenche o formulário do Santander e coleta o resultado."""
    try:
        # 1. Abrir site
        print(f"  [1/8] Abrindo site...")
        await page.goto(SITE_URL, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(5000)

        # 2. Clicar em Pessoa Física
        print(f"  [2/8] Clicando em Pessoa Física...")
        await page.locator("button.btn-person").click()
        await page.wait_for_timeout(2000)

        # 3. Preencher dados pessoais
        print(f"  [3/8] Preenchendo dados pessoais...")

        # Data de nascimento (formato DD/MM/AAAA)
        nascimento = cliente.get("data_nascimento", "")
        input_nascimento = page.locator('input[formcontrolname="dateOfBirth"]')
        await input_nascimento.click()
        await input_nascimento.type(nascimento, delay=50)
        await page.wait_for_timeout(500)

        # CPF
        cpf = cliente["cpf"]
        input_cpf = page.locator('input[formcontrolname="cpf"]')
        await input_cpf.click()
        await input_cpf.type(cpf, delay=30)
        await page.wait_for_timeout(500)

        # Email
        email = cliente.get("email") or gerar_email(cliente.get("nome", ""))
        input_email = page.locator('input[formcontrolname="email"]')
        await input_email.click()
        await input_email.type(email, delay=30)
        await page.wait_for_timeout(500)

        # Celular (garantir 11 dígitos)
        telefone = formatar_telefone(cliente.get("telefone", ""))
        input_cel = page.locator('input[formcontrolname="cellNumber"]')
        await input_cel.click()
        await input_cel.type(telefone, delay=30)
        await page.wait_for_timeout(500)

        # CNH = Sim (se existir)
        try:
            cnh_sim = page.locator("text=Sim").first
            if await cnh_sim.is_visible(timeout=2000):
                await cnh_sim.click()
                await page.wait_for_timeout(500)
        except:
            pass

        # 4. Clicar em "Quero simular"
        print(f"  [4/8] Clicando em Quero simular...")
        await page.locator("button.btn-simulate").click()
        await page.wait_for_timeout(4000)

        # Inicializar pré-aprovado
        pre_aprovado = ""
        pre_aprovado_valor = 0.0
        pre_aprovado_entrada_min = 0
        pre_aprovado_prazo_max = 0

        # 5. Clicar em "Carro"
        print(f"  [5/8] Escolhendo Carro...")
        await page.locator("button.btn-vehicle").click()
        await page.wait_for_timeout(3000)

        # 6. Clicar em "Você e o dono" (C2C)
        print(f"  [6/8] Clicando em 'Você e o dono'...")
        await page.locator("button.btn-c2c-financing").click()
        await page.wait_for_timeout(3000)

        # 6.5 Capturar Pré-Aprovado (aparece na tela de detalhes do veículo)
        await page.wait_for_timeout(2000)
        try:
            # Tentar múltiplos seletores
            advice_el = page.locator("p.advice").first
            if not await advice_el.is_visible(timeout=2000):
                advice_el = page.locator("div.advice, .pre-approved, .pre-aprovado, [class*='advice']").first

            if await advice_el.is_visible(timeout=3000):
                pre_aprovado = await advice_el.inner_text()
                pre_aprovado = pre_aprovado.replace("\xa0", " ").strip()
                print(f"  [PRÉ-APROVADO] {pre_aprovado}")

                # Extrair valor pré-aprovado (ex: "R$ 150.000,00")
                valor_match = re.search(r"R\$\s*([\d.,]+)", pre_aprovado)
                if valor_match:
                    v = valor_match.group(1).replace(".", "").replace(",", ".")
                    pre_aprovado_valor = float(v)

                # Extrair entrada mínima (ex: "30%")
                entrada_match = re.search(r"[Ee]ntrada\s+m[ií]nima\s+de\s+(\d+)%", pre_aprovado)
                if entrada_match:
                    pre_aprovado_entrada_min = int(entrada_match.group(1))

                # Extrair prazo máximo (ex: "48 meses")
                prazo_match = re.search(r"[Pp]razo\s+m[áa]ximo\s+de\s+(\d+)", pre_aprovado)
                if prazo_match:
                    pre_aprovado_prazo_max = int(prazo_match.group(1))
            else:
                # Tenta capturar qualquer texto que contenha "Pré Aprovado" na página
                body_text = await page.inner_text("body")
                pre_match = re.search(r"R\$\s*([\d.,]+)\s*Pr[ée]\s*Aprovado", body_text, re.IGNORECASE)
                if pre_match:
                    v = pre_match.group(1).replace(".", "").replace(",", ".")
                    pre_aprovado_valor = float(v)
                    pre_aprovado = pre_match.group(0)
                    print(f"  [PRÉ-APROVADO via texto] {pre_aprovado}")

                    entrada_match = re.search(r"[Ee]ntrada\s+m[ií]nima\s+de\s+(\d+)%", body_text)
                    if entrada_match:
                        pre_aprovado_entrada_min = int(entrada_match.group(1))
                    prazo_match = re.search(r"[Pp]razo\s+m[áa]ximo\s+de\s+(\d+)", body_text)
                    if prazo_match:
                        pre_aprovado_prazo_max = int(prazo_match.group(1))
                else:
                    print(f"  [INFO] Sem pré-aprovado detectado")
        except Exception as e:
            print(f"  [INFO] Erro ao capturar pré-aprovado: {e}")

        # 7. Preencher detalhes do veículo
        print(f"  [7/8] Preenchendo veículo...")

        # Marca (1º combobox - index 0)
        await preencher_combobox(page, 0, VEICULO["marca"])
        print(f"    Marca: {VEICULO['marca']}")

        # Ano/modelo (2º combobox - index 1)
        await preencher_combobox(page, 1, VEICULO["ano"])
        print(f"    Ano: {VEICULO['ano']}")

        # Modelo (3º combobox - index 2)
        await preencher_combobox(page, 2, VEICULO["modelo"][:15])
        print(f"    Modelo: {VEICULO['modelo']}")

        # UF (4º combobox - index 3)
        uf_sigla = cliente.get("uf", "SP")
        uf_nome = UF_NOME.get(uf_sigla, "São Paulo")
        await preencher_combobox(page, 3, uf_nome)
        print(f"    UF: {uf_nome}")

        # Valor do veículo (campo com máscara monetária - digitar centavos)
        input_valor = page.locator("input#valor-veiculo")
        await input_valor.click()
        await input_valor.fill("")
        # Limpar campo completamente
        await input_valor.press("Control+a")
        await input_valor.press("Backspace")
        await page.wait_for_timeout(300)
        # Digitar 20000000 = R$ 200.000,00 (valor em centavos)
        await input_valor.type("20000000", delay=30)
        await page.wait_for_timeout(1000)
        print(f"    Valor: R$ 200.000,00")

        # 8. Clicar em "Ver simulação"
        print(f"  [8/8] Clicando em Ver simulação...")
        btn_simular = page.locator("button.btn-simulate")
        # Esperar botão ficar habilitado
        await btn_simular.wait_for(state="visible", timeout=5000)
        await page.wait_for_timeout(1000)

        # Verificar se está disabled
        is_disabled = await btn_simular.get_attribute("disabled")
        if is_disabled is not None:
            print(f"  [AVISO] Botão ainda desabilitado, aguardando...")
            await page.wait_for_timeout(3000)

        await btn_simular.click()
        await page.wait_for_timeout(8000)

        # 9. Coletar resultados
        print(f"  [RESULT] Coletando resultados...")

        # Entrada em % (ex: "30%")
        entrada_pct = 0.0
        try:
            entrada_el = page.locator("strong").first
            entrada_text = await entrada_el.inner_text(timeout=10000)
            entrada_match = re.search(r"(\d+)", entrada_text)
            if entrada_match:
                entrada_pct = float(entrada_match.group(1))
        except:
            pass

        # Valor da entrada
        entrada_valor = (entrada_pct / 100) * 200000

        # Valor da parcela (ex: "R$ 4.196,39")
        parcela_valor = 0.0
        try:
            parcela_el = page.locator("#installmentValue")
            parcela_text = await parcela_el.inner_text(timeout=5000)
            parcela_match = re.search(r"[\d.,]+", parcela_text.replace("R$", "").replace("\xa0", ""))
            if parcela_match:
                parcela_str = parcela_match.group(0).replace(".", "").replace(",", ".")
                parcela_valor = float(parcela_str)
        except:
            pass

        # Quantidade de parcelas - tentar vários métodos
        parcela_qtd = 0
        try:
            page_text = await page.inner_text("body")
            # Tentar "48x", "48 x", "48 vezes", "48 meses", "48 parcelas"
            qtd_match = re.search(r"(\d+)\s*(?:x|X|vezes|parcelas|meses)", page_text)
            if qtd_match:
                parcela_qtd = int(qtd_match.group(1))
            else:
                # Tentar pegar do combobox de parcelas (valor selecionado)
                combo_el = page.locator("ng-select .ng-value-label, .ng-value span").first
                if await combo_el.is_visible(timeout=2000):
                    combo_text = await combo_el.inner_text()
                    qtd_combo = re.search(r"(\d+)", combo_text)
                    if qtd_combo:
                        parcela_qtd = int(qtd_combo.group(1))
        except:
            pass

        # Se ainda 0, default 48 (prazo padrão do Santander)
        if parcela_qtd == 0 and parcela_valor > 0:
            parcela_qtd = 48

        # Se não achou entrada, pode ser bloqueado
        if entrada_pct == 0 and parcela_valor == 0:
            # Tenta ver se tem mensagem de erro
            page_text = await page.inner_text("body")
            if "não foi possível" in page_text.lower() or "tente novamente" in page_text.lower() or "indisponível" in page_text.lower():
                print(f"  [RESULT] BLOQUEADO - simulação não passou")
                await page.screenshot(path=f"bloqueado_{cliente['cpf']}.png")
                return {"cpf": cliente["cpf"], "bloqueado": True}

        print(f"  [RESULT] Entrada: {entrada_pct}% = R$ {entrada_valor:,.2f}")
        print(f"  [RESULT] Parcela: R$ {parcela_valor:,.2f} x {parcela_qtd}")
        if pre_aprovado_valor > 0:
            print(f"  [RESULT] Pré-aprovado: R$ {pre_aprovado_valor:,.2f} | Entrada mín: {pre_aprovado_entrada_min}% | Prazo máx: {pre_aprovado_prazo_max} meses")

        await page.screenshot(path=f"resultado_{cliente['cpf']}.png")

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
    parser.add_argument("--inicio", type=int, default=0, help="Índice inicial (para continuar de onde parou)")
    args = parser.parse_args()

    with open(args.arquivo, "r", encoding="utf-8") as f:
        clientes = json.load(f)

    # Carregar resultados anteriores se existirem
    resultados = []
    try:
        with open(args.saida, "r", encoding="utf-8") as f:
            resultados = json.load(f)
            print(f"Resultados anteriores carregados: {len(resultados)}")
    except:
        pass

    # Pular CPFs já processados
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

            # Salvar parcial a cada cliente (para não perder progresso)
            with open(args.saida, "w", encoding="utf-8") as f:
                json.dump(resultados, f, ensure_ascii=False, indent=2)

            await context.close()
            await asyncio.sleep(2)

        await browser.close()

    # Resumo
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
