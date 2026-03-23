# TioPato - Simulador Santander Financiamentos

Sistema de automação que consulta dados de clientes via API, simula financiamento no Santander e exibe resultados em um dashboard web.

## Estrutura

```
TioPato/
├── automacao/          # Script Python com Playwright
│   ├── simulador.py    # Script principal
│   ├── .env            # Credenciais (NÃO versionar)
│   ├── requirements.txt
│   └── clientes_exemplo.json
├── dashboard/          # Next.js + Tailwind + Supabase
│   ├── src/app/        # Páginas do dashboard
│   ├── src/lib/        # Cliente Supabase
│   └── .env.local      # Credenciais (NÃO versionar)
├── sql/
│   └── create_table.sql
└── README.md
```

## Classificação dos Clientes

| Classificação | Entrada        | Cor  |
|---------------|----------------|------|
| ÓTIMO         | 0% a 10%       | 🟢   |
| BOM           | 10% a 20%      | 🟡   |
| RUIM          | acima de 20%   | 🔴   |
| BLOQUEADO     | não aprovado   | ⚫   |

## 1. Criar tabela no Supabase

Acesse o **SQL Editor** do Supabase e execute o conteúdo de `sql/create_table.sql`.

## 2. Instalar a automação Python

```bash
cd automacao
pip install -r requirements.txt
playwright install chromium
```

## 3. Rodar o simulador

**CPF único:**
```bash
python simulador.py --cpf 12345678901
```

**Lote de CPFs (arquivo JSON):**
```bash
python simulador.py --arquivo clientes_exemplo.json
```

**Modo headless (sem abrir navegador):**
```bash
python simulador.py --arquivo clientes_exemplo.json --headless
```

## 4. Rodar o dashboard localmente

```bash
cd dashboard
npm install
npm run dev
```

Acesse: http://localhost:3000

## 5. Deploy no Vercel

1. Crie um repositório no GitHub e faça push do projeto
2. No Vercel, importe o repositório
3. Defina o **Root Directory** como `dashboard`
4. Adicione as variáveis de ambiente:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy!

## Veículo padrão da simulação

- **Marca:** GM - CHEVROLET
- **Ano:** 2025 GASOLINA
- **Modelo:** EQUINOX ACTIV 1.5 TURBO 177CV AUT.
- **Valor:** R$ 200.000,00
