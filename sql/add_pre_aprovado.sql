-- Adicionar campos de pré-aprovado à tabela
ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS pre_aprovado_valor DECIMAL(12,2);
ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS pre_aprovado_entrada_min INTEGER;
ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS pre_aprovado_prazo_max INTEGER;
ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS pre_aprovado_texto TEXT;
