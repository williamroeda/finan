-- Dropar tabela antiga se existir
DROP TABLE IF EXISTS simulacoes;

-- Tabela de simulações do Santander Financiamentos
CREATE TABLE simulacoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cpf VARCHAR(14) NOT NULL,
    nome VARCHAR(255),
    data_nascimento VARCHAR(20),
    profissao VARCHAR(255),
    bairro VARCHAR(255),
    cidade_uf VARCHAR(100),
    uf VARCHAR(2),
    telefone VARCHAR(20),
    email VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    entrada_percentual DECIMAL(5,2),
    entrada_valor DECIMAL(12,2),
    parcela_valor DECIMAL(12,2),
    parcela_qtd INTEGER,
    classificacao VARCHAR(20),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    consultado_em TIMESTAMP WITH TIME ZONE,
    concluido_em TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_simulacoes_cpf ON simulacoes(cpf);
CREATE INDEX idx_simulacoes_status ON simulacoes(status);
CREATE INDEX idx_simulacoes_classificacao ON simulacoes(classificacao);

-- RLS
ALTER TABLE simulacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura publica" ON simulacoes FOR SELECT USING (true);
CREATE POLICY "Permitir insercao" ON simulacoes FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualizacao" ON simulacoes FOR UPDATE USING (true);
CREATE POLICY "Permitir delecao" ON simulacoes FOR DELETE USING (true);
