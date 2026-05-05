import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Transacoes from './pages/Transacoes';
import Parcelamentos from './pages/Parcelamentos';
import Assinaturas from './pages/Assinaturas';
import Categorias from './pages/Categorias';
import Cartoes from './pages/Cartoes';

function App() {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [installments, setInstallments] = useState([]);
  const [cards, setCards] = useState([]);
  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('dashboard');

  useEffect(() => {
    const load = async () => {
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        console.warn('Supabase não configurado'); setLoading(false); return;
      }
      setIsSupabaseConfigured(true);
      try {
        const [txRes, accRes, subRes, instRes, cardRes] = await Promise.all([
          supabase.from('transactions').select('*').order('date', { ascending: false }),
          supabase.from('accounts').select('*'),
          supabase.from('subscriptions').select('*').order('amount', { ascending: false }),
          supabase.from('installments').select('*').order('created_at', { ascending: false }),
          supabase.from('cards').select('*'),
        ]);
        if (txRes.data) setTransactions(txRes.data.map(tx => ({ ...tx, isRecurring: tx.isrecurring })));
        if (accRes.data) setAccounts(accRes.data);
        if (subRes.data) setSubscriptions(subRes.data);
        if (instRes.data) setInstallments(instRes.data);
        if (cardRes.data) setCards(cardRes.data);
      } catch (err) {
        console.error('Erro ao carregar dados:', err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const formatCurrency = (value) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const sharedProps = { transactions, setTransactions, accounts, setAccounts, formatCurrency, isSupabaseConfigured };

  return (
    <div className="app-layout">
      <Navbar page={page} setPage={setPage} />

      {!isSupabaseConfigured && !loading && (
        <div style={{ background: '#7F1D1D', color: '#FCA5A5', padding: '12px 24px', textAlign: 'center', fontSize: 13 }}>
          ⚠️ Configure <strong>VITE_SUPABASE_URL</strong> e <strong>VITE_SUPABASE_ANON_KEY</strong> na Vercel para ativar o banco de dados.
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--surface-3)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
          <p style={{ color: 'var(--text-muted)' }}>Carregando dados...</p>
        </div>
      )}

      {!loading && (
        <>
          {page === 'dashboard' && <Dashboard {...sharedProps} cards={cards} subscriptions={subscriptions} setPage={setPage}/>}
          {page === 'transacoes' && <Transacoes {...sharedProps} subscriptions={subscriptions} setSubscriptions={setSubscriptions} installments={installments} setInstallments={setInstallments}/>}
          {page === 'parcelamentos' && <Parcelamentos installments={installments} setInstallments={setInstallments} formatCurrency={formatCurrency} isSupabaseConfigured={isSupabaseConfigured}/>}
          {page === 'assinaturas' && <Assinaturas subscriptions={subscriptions} setSubscriptions={setSubscriptions} formatCurrency={formatCurrency}/>}
          {page === 'categorias' && <Categorias transactions={transactions} formatCurrency={formatCurrency}/>}
          {page === 'cartoes' && <Cartoes cards={cards} setCards={setCards} transactions={transactions} formatCurrency={formatCurrency}/>}
        </>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default App;
