import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Lancamentos from './pages/Lancamentos';

function App() {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(false);
  const [page, setPage] = useState('dashboard');
  const [pendingModal, setPendingModal] = useState(null);

  useEffect(() => {
    const load = async () => {
      if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
        setIsSupabaseConfigured(true);
        try {
          const { data: txData } = await supabase.from('transactions').select('*').order('date', { ascending: false });
          if (txData) setTransactions(txData.map(tx => ({ ...tx, isRecurring: tx.isrecurring })));
          const { data: accData } = await supabase.from('accounts').select('*');
          if (accData) setAccounts(accData);
        } catch (err) {
          console.error('Erro Supabase:', err.message);
        }
      }
    };
    load();
  }, []);

  const formatCurrency = (value) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const openModal = (type) => {
    setPendingModal(type);
    setPage('lancamentos');
  };

  return (
    <>
      <Navbar page={page} setPage={setPage} />

      {!isSupabaseConfigured && (
        <div style={{ background: '#E74C3C', color: 'white', padding: '12px 24px', textAlign: 'center', fontSize: 13 }}>
          ⚠️ Configure <strong>VITE_SUPABASE_URL</strong> e <strong>VITE_SUPABASE_ANON_KEY</strong> na Vercel para ativar o banco de dados.
        </div>
      )}

      {page === 'dashboard' && (
        <Dashboard
          transactions={transactions}
          accounts={accounts}
          formatCurrency={formatCurrency}
          setPage={setPage}
          openModal={openModal}
        />
      )}

      {page === 'lancamentos' && (
        <Lancamentos
          transactions={transactions}
          setTransactions={setTransactions}
          accounts={accounts}
          setAccounts={setAccounts}
          formatCurrency={formatCurrency}
          isSupabaseConfigured={isSupabaseConfigured}
          initialModal={pendingModal}
        />
      )}

      {page === 'relatorios' && (
        <div className="page" style={{ textAlign: 'center', paddingTop: 80 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <h2 style={{ color: 'var(--text)', marginBottom: 8 }}>Relatórios</h2>
          <p style={{ color: 'var(--text-muted)' }}>Em breve disponível.</p>
        </div>
      )}
    </>
  );
}

export default App;
