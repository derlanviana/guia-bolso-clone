import React, { useState } from 'react';
import { PluggyConnect } from 'react-pluggy-connect';

function App() {
  const [balance, setBalance] = useState(0);
  const [income, setIncome] = useState(0);
  const [expense, setExpense] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);

  const [loading, setLoading] = useState(false);
  const [connectionSuccess, setConnectionSuccess] = useState(false);
  const [pluggyToken, setPluggyToken] = useState(null);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleConnectBank = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/pluggy-token', {
        method: 'POST',
      });
      const data = await res.json();
      
      if (data.accessToken) {
        setPluggyToken(data.accessToken);
      } else {
        alert('Erro ao gerar o token de acesso da Pluggy.');
      }
    } catch (error) {
      console.error(error);
      alert('Falha na comunicação com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handlePluggySuccess = async (itemData) => {
    console.log('Conexão com Pluggy bem-sucedida:', itemData);
    setConnectionSuccess(true);
    setPluggyToken(null);
    setLoading(true);

    try {
      const res = await fetch('/api/pluggy-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: itemData.item.id })
      });
      const data = await res.json();
      
      if (data.accounts) {
        setAccounts(data.accounts);
        const totalBalance = data.accounts.reduce((acc, curr) => acc + curr.balance, 0);
        setBalance(totalBalance);
      }
      if (data.transactions) {
        setTransactions(data.transactions);
        let totalInc = 0;
        let totalExp = 0;
        data.transactions.forEach(tx => {
          if (tx.amount > 0) totalInc += tx.amount;
          if (tx.amount < 0) totalExp += Math.abs(tx.amount);
        });
        setIncome(totalInc);
        setExpense(totalExp);
      }
    } catch (e) {
      console.error('Erro ao buscar dados:', e);
      alert('Não foi possível carregar os dados reais. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handlePluggyError = (error) => {
    console.error('Erro na Pluggy:', error);
    setPluggyToken(null);
    alert('A conexão bancária foi cancelada ou falhou.');
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="app-container">
      {pluggyToken && (
        <PluggyConnect
          connectToken={pluggyToken}
          includeSandbox={false}
          onSuccess={handlePluggySuccess}
          onError={handlePluggyError}
        />
      )}

      <header className="dashboard-header">
        <div>
          <h1>Olá, Derlan</h1>
          <h2>Seu resumo financeiro de Abril</h2>
        </div>
        <button className="btn" onClick={handleConnectBank} disabled={loading || pluggyToken}>
          <span>{loading ? '⏳' : '🏦'}</span> 
          {loading ? 'Processando...' : 'Conectar Banco'}
        </button>
      </header>

      {connectionSuccess && (
        <div style={{ background: 'var(--success-color)', color: 'white', padding: '16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>✅</span> Contas conectadas! Seus dados já estão aparecendo abaixo.
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
            <h2>Contas Conectadas</h2>
            {accounts.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>Nenhuma conta conectada ainda.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {accounts.map(acc => (
                  <div key={acc.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h4 style={{ margin: 0 }}>{acc.name}</h4>
                      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{acc.subtype || acc.type} • {acc.number}</p>
                    </div>
                    <div style={{ fontWeight: 'bold' }}>{formatCurrency(acc.balance)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Transactions */}
        <div className="dashboard-col">
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0 }}>Últimas Transações</h2>
            </div>

            <div className="transaction-list">
              {transactions.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>Conecte seu banco para ver as transações.</p>
              ) : (
                transactions.map(tx => (
                  <div key={tx.id} className="transaction-item">
                    <div className="transaction-info">
                      <div className="transaction-icon">💳</div>
                      <div className="transaction-details">
                        <h4>{tx.description}</h4>
                        <p>{tx.category || 'Geral'} • {formatDate(tx.date)}</p>
                      </div>
                    </div>
                    <div className={`transaction-amount ${tx.amount > 0 ? 'amount-positive' : 'amount-negative'}`}>
                      {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
