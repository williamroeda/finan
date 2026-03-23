-- Tabela de simulações do Santander Financiamentos
CREATE TABLE IF NOT EXISTS simulacoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cpf VARCHAR(14) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    uf VARCHAR(2) NOT NULL,
    entrada_percentual DECIMAL(5,2),
    entrada_valor DECIMAL(12,2),
    parcela_valor DECIMAL(12,2),
    parcela_qtd INTEGER,
    classificacao VARCHAR(20) NOT NULL DEFAULT 'BLOQUEADO',
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index para busca por CPF
CREATE INDEX idx_simulacoes_cpf ON simulacoes(cpf);

-- Index para filtro por classificação
CREATE INDEX idx_simulacoes_classificacao ON simulacoes(classificacao);

-- RLS (Row Level Security) - desabilitado para acesso via service_role
ALTER TABLE simulacoes ENABLE ROW LEVEL SECURITY;

-- Policy para leitura pública (dashboard)
CREATE POLICY "Permitir leitura publica" ON simulacoes
    FOR SELECT USING (true);

-- Policy para inserção via service_role
CREATE POLICY "Permitir insercao service_role" ON simulacoes
    FOR INSERT WITH CHECK (true);
