import React, { useState, useRef } from 'react';
import { parseOFX, parseCSV } from './utils/parser';

function App() {
  const [balance, setBalance] = useState(0);
  const [income, setIncome] = useState(0);
  const [expense, setExpense] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    
    try {
      const text = await file.text();
      let newTransactions = [];

      if (file.name.toLowerCase().endsWith('.ofx')) {
        newTransactions = parseOFX(text);
      } else if (file.name.toLowerCase().endsWith('.csv')) {
        newTransactions = await parseCSV(text);
      } else if (file.name.toLowerCase().endsWith('.pdf')) {
        alert('Atenção: A leitura de PDFs bancários é muito instável porque cada banco desenha o PDF de um jeito diferente. Por favor, exporte seu extrato no formato OFX ou CSV direto no app do seu banco para uma leitura perfeita!');
        setLoading(false);
        return;
      } else {
        alert('Formato não suportado. Por favor, envie um arquivo .ofx ou .csv');
        setLoading(false);
        return;
      }

      if (newTransactions.length > 0) {
        // Create a mock account representing the imported file
        const newAccount = {
          id: Math.random().toString(36).substring(7),
          name: 'Conta Importada',
          number: file.name,
          balance: newTransactions.reduce((acc, tx) => acc + tx.amount, 0)
        };

        const allTransactions = [...transactions, ...newTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));
        const allAccounts = [...accounts, newAccount];

        setTransactions(allTransactions);
        setAccounts(allAccounts);

        // Recalculate totals
        const totalBalance = allAccounts.reduce((acc, curr) => acc + curr.balance, 0);
        setBalance(totalBalance);

        let totalInc = 0;
        let totalExp = 0;
        allTransactions.forEach(tx => {
          if (tx.amount > 0) totalInc += tx.amount;
          if (tx.amount < 0) totalExp += Math.abs(tx.amount);
        });
        
        setIncome(totalInc);
        setExpense(totalExp);
      } else {
        alert('Nenhuma transação encontrada no arquivo.');
      }
    } catch (error) {
      console.error('Erro ao ler arquivo:', error);
      alert('Houve um erro ao tentar processar o seu extrato.');
    } finally {
      setLoading(false);
      // Reset input so the same file can be uploaded again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="app-container">
      <header className="dashboard-header">
        <div>
          <h1>Olá, Derlan</h1>
          <h2>Seu resumo financeiro offline</h2>
        </div>
        
        <input 
          type="file" 
          accept=".ofx,.csv,.pdf" 
          style={{ display: 'none' }} 
          ref={fileInputRef}
          onChange={handleFileUpload}
        />
        
        <button className="btn" onClick={() => fileInputRef.current.click()} disabled={loading}>
          <span>{loading ? '⏳' : '📥'}</span> 
          {loading ? 'Lendo Arquivo...' : 'Importar Extrato (OFX/CSV)'}
        </button>
      </header>

      <div className="dashboard-grid">
        {/* Left Column: Balance & Summary */}
        <div className="dashboard-col">
          <div className="glass-panel">
            <h2>Saldo Atualizado</h2>
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
            <h2>Arquivos Importados</h2>
            {accounts.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>Nenhum extrato importado ainda.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {accounts.map(acc => (
                  <div key={acc.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ overflow: 'hidden' }}>
                      <h4 style={{ margin: 0 }}>{acc.name}</h4>
                      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '150px' }}>
                        {acc.number}
                      </p>
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
              <h2 style={{ margin: 0 }}>Histórico de Transações</h2>
            </div>

            <div className="transaction-list">
              {transactions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📄</div>
                  <p>Arraste ou importe o arquivo <b>.ofx</b> do seu banco para ver as transações aqui.</p>
                </div>
              ) : (
                transactions.map(tx => (
                  <div key={tx.id} className="transaction-item">
                    <div className="transaction-info">
                      <div className="transaction-icon">💳</div>
                      <div className="transaction-details">
                        <h4>{tx.description}</h4>
                        <p>{tx.category} • {formatDate(tx.date)}</p>
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
