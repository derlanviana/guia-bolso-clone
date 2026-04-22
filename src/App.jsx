import React, { useState, useEffect } from 'react';

// Mock data for the initial layout
const MOCK_TRANSACTIONS = [
  { id: 1, name: 'Uber Eats', category: 'Alimentação', date: 'Hoje, 12:30', amount: -45.90, icon: '🍔' },
  { id: 2, name: 'Salário Realiza', category: 'Renda', date: 'Hoje, 09:00', amount: 8500.00, icon: '💰' },
  { id: 3, name: 'Netflix', category: 'Entretenimento', date: 'Ontem, 15:45', amount: -39.90, icon: '🎬' },
  { id: 4, name: 'Posto Ipiranga', category: 'Transporte', date: '20 Abril', amount: -150.00, icon: '⛽' },
  { id: 5, name: 'Supermercado Bretas', category: 'Mercado', date: '19 Abril', amount: -432.50, icon: '🛒' },
];

function App() {
  const [balance] = useState(12450.75);
  const [income] = useState(8500.00);
  const [expense] = useState(2150.30);
  const [loading, setLoading] = useState(false);
  const [connectionSuccess, setConnectionSuccess] = useState(false);

  useEffect(() => {
    // Check if we are returning from Belvo Widget successfully
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      setConnectionSuccess(true);
      // Clean up the URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleConnectBank = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/belvo-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ origin: window.location.origin })
      });
      const data = await res.json();
      
      if (data.access) {
        // Redirect to Belvo Hosted Widget (in Portuguese)
        window.location.href = `https://widget.belvo.io/?access_token=${data.access}&locale=pt`;
      } else {
        alert('Erro ao gerar o token de acesso da Belvo.');
      }
    } catch (error) {
      console.error(error);
      alert('Falha na comunicação com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="dashboard-header">
        <div>
          <h1>Olá, Derlan</h1>
          <h2>Seu resumo financeiro de Abril</h2>
        </div>
        <button className="btn" onClick={handleConnectBank} disabled={loading}>
          <span>{loading ? '⏳' : '🏦'}</span> 
          {loading ? 'Conectando...' : 'Conectar Banco'}
        </button>
      </header>

      {connectionSuccess && (
        <div style={{ background: 'var(--success-color)', color: 'white', padding: '16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>✅</span> Conta conectada com sucesso! Em breve seus dados reais aparecerão aqui.
        </div>
      )}

      <div className="dashboard-grid">
        {/* Left Column: Balance & Summary */}
        <div className="dashboard-col">
          <div className="glass-panel">
            <h2>Saldo Total</h2>
            <div className="currency">{formatCurrency(balance)}</div>
            
            <div className="stats-grid">
              <div className="stat-box">
                <h5>RECEITAS</h5>
                <p className="amount-positive">{formatCurrency(income)}</p>
              </div>
              <div className="stat-box">
                <h5>DESPESAS</h5>
                <p className="amount-negative">{formatCurrency(expense)}</p>
              </div>
            </div>
          </div>
          
          <div className="glass-panel" style={{ marginTop: '24px' }}>
            <h2>Cartões Conectados</h2>
            <div style={{ padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '40px', height: '40px', background: '#8A05BE', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>N</div>
              <div>
                <h4 style={{ margin: 0 }}>Nubank</h4>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Crédito • final 4321</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Transactions */}
        <div className="dashboard-col">
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0 }}>Últimas Transações</h2>
              <a href="#" style={{ color: 'var(--accent-color)', textDecoration: 'none', fontSize: '0.875rem' }}>Ver todas</a>
            </div>

            <div className="transaction-list">
              {MOCK_TRANSACTIONS.map(tx => (
                <div key={tx.id} className="transaction-item">
                  <div className="transaction-info">
                    <div className="transaction-icon">{tx.icon}</div>
                    <div className="transaction-details">
                      <h4>{tx.name}</h4>
                      <p>{tx.category} • {tx.date}</p>
                    </div>
                  </div>
                  <div className={`transaction-amount ${tx.amount > 0 ? 'amount-positive' : 'amount-negative'}`}>
                    {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
