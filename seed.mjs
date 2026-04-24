import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

function parseEnv(path) {
  if (!fs.existsSync(path)) return {};
  const content = fs.readFileSync(path, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let val = match[2] || '';
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      env[match[1]] = val;
    }
  });
  return env;
}

const env = parseEnv('.env.prod');
const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.prod");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log("Deletando todas as transações atuais...");
  const { error: delError } = await supabase.from('transactions').delete().neq('id', 'impossivel');
  
  if (delError) {
    console.error("Erro ao deletar transações:", delError);
    return;
  }
  
  console.log("Criando 5 lançamentos de exemplo...");
  
  const today = new Date();
  
  const sampleTransactions = [
    {
      id: Math.random().toString(36).substring(7),
      description: "Salário da Empresa",
      amount: 4500.00,
      date: new Date(today.getFullYear(), today.getMonth(), 5).toISOString(),
      category: "Salário",
      isrecurring: true
    },
    {
      id: Math.random().toString(36).substring(7),
      description: "Aluguel",
      amount: -1500.00,
      date: new Date(today.getFullYear(), today.getMonth(), 10).toISOString(),
      category: "Moradia",
      isrecurring: true
    },
    {
      id: Math.random().toString(36).substring(7),
      description: "Supermercado Extra",
      amount: -450.75,
      date: new Date(today.getFullYear(), today.getMonth(), 12).toISOString(),
      category: "Alimentação",
      isrecurring: false
    },
    {
      id: Math.random().toString(36).substring(7),
      description: "Uber",
      amount: -35.50,
      date: new Date(today.getFullYear(), today.getMonth(), 15).toISOString(),
      category: "Transporte",
      isrecurring: false
    },
    {
      id: Math.random().toString(36).substring(7),
      description: "Conta de Luz",
      amount: -120.00,
      date: new Date(today.getFullYear(), today.getMonth(), 20).toISOString(),
      category: "Moradia",
      isrecurring: true
    }
  ];

  const { error: insError } = await supabase.from('transactions').insert(sampleTransactions);
  if (insError) {
    console.error("Erro ao inserir transações de exemplo:", insError);
  } else {
    console.log("Banco de dados resetado com sucesso! 5 lançamentos criados.");
  }
}

seed();
