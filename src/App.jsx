import React, { useState, useRef, useEffect } from 'react';
import { parseOFX, parseCSV } from './utils/parser';
import { supabase } from './supabaseClient';

const CATEGORIES = [
  'Geral', 'Alimentação', 'Moradia', 'Transporte', 'Saúde', 
  'Lazer', 'Salário', 'Investimentos', 'Educação', 'Outros'
];

function App() {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(false);
  
  // Load from Supabase on mount
  useEffect(() => {
    const checkAndFetchData = async () => {
      if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
        setIsSupabaseConfigured(true);
        try {
          const { data: txData, error: txError } = await supabase.from('transactions').select('*').order('date', { ascending: false });
          if (txError) throw txError;
          if (txData) {
            setTransactions(txData.map(tx => ({
              ...tx,
              isRecurring: tx.isrecurring
            })));
          }

          const { data: accData, error: accError } = await supabase.from('accounts').select('*');
          if (accError) throw accError;
          if (accData) setAccounts(accData);
        } catch (error) {
          console.error('Erro ao buscar dados do Supabase. Verifique se as tabelas existem:', error.message);
          alert('Erro de conexão com o banco de dados. Verifique as configurações do Supabase.');
        }
      } else {
        // Fallback or warning if no env
        console.warn('Supabase não configurado no .env.local');
      }
    };

    checkAndFetchData();
  }, []);

  // View State
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [loading, setLoading] = useState(false);
  
  // Modals State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState(null); // null = new
  
  // Form State
  const [formDesc, setFormDesc] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formCategory, setFormCategory] = useState('Geral');
  const [formType, setFormType] = useState('expense'); // income or expense
  const [isRecurring, setIsRecurring] = useState(false);

  const fileInputRef = useRef(null);

  // Computed Data
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const safeAccounts = Array.isArray(accounts) ? accounts : [];

  const filteredTransactions = safeTransactions.filter(tx => tx?.date?.startsWith(currentMonth));
  
  let income = 0;
  let expense = 0;
  filteredTransactions.forEach(tx => {
    if (tx.amount > 0) income += tx.amount;
    if (tx.amount < 0) expense += Math.abs(tx.amount);
  });

  const balance = safeAccounts.reduce((acc, curr) => acc + curr.balance, 0) + 
                  safeTransactions.reduce((acc, curr) => acc + curr.amount, 0);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const handleMonthChange = (offset) => {
    const [year, month] = currentMonth.split('-').map(Number);
    let newDate = new Date(year, month - 1 + offset, 1);
    setCurrentMonth(newDate.toISOString().slice(0, 7));
  };

  const getMonthName = (yyyyMM) => {
    if (!yyyyMM) return '';
    const [year, month] = yyyyMM.split('-');
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(' de ', ' ');
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!isSupabaseConfigured) {
      alert("Configure as chaves do Supabase primeiro!");
      return;
    }

    setLoading(true);
    try {
      const text = await file.text();
      let newTransactions = [];

      if (file.name.toLowerCase().endsWith('.ofx')) {
        newTransactions = parseOFX(text);
      } else if (file.name.toLowerCase().endsWith('.csv')) {
        newTransactions = await parseCSV(text);
      } else {
        alert('Formato não suportado. Use .ofx ou .csv');
        return;
      }

      if (newTransactions.length > 0) {
        // Conciliation: prevent duplicates by ID or identical match
        const existingIds = new Set(safeTransactions.map(t => t.id));
        const imported = [];
        let ignored = 0;

        newTransactions.forEach(tx => {
          const isDuplicate = safeTransactions.some(etx => etx.amount === tx.amount && etx.date.split('T')[0] === tx.date.split('T')[0]);
          
          if (!existingIds.has(tx.id) && !isDuplicate) {
            imported.push(tx);
            existingIds.add(tx.id);
          } else {
            ignored++;
          }
        });

        if (imported.length > 0) {
          // Insert into Supabase (Map isRecurring to isrecurring for Postgres)
          const dbImported = imported.map(({ isRecurring, ...rest }) => ({
            ...rest,
            isrecurring: isRecurring || false
          }));
          const { error } = await supabase.from('transactions').insert(dbImported);
          if (error) throw error;

          const allTransactions = [...safeTransactions, ...imported].sort((a, b) => new Date(b.date) - new Date(a.date));
          setTransactions(allTransactions);

          // Save account reference
          const newAccount = {
            id: Math.random().toString(36).substring(7),
            name: 'Conta Importada',
            number: file.name,
            balance: imported.reduce((acc, tx) => acc + tx.amount, 0)
          };
          const { error: accError } = await supabase.from('accounts').insert([newAccount]);
          if (!accError) {
             setAccounts([...safeAccounts, newAccount]);
          }

          alert(`Conciliação concluída!\n✅ ${imported.length} novas transações salvas na nuvem.\n⚠️ ${ignored} ignoradas (já existiam).`);
        } else {
          alert(`Todas as ${ignored} transações do arquivo já existiam no sistema. Nenhuma novidade.`);
        }

      } else {
        alert('Nenhuma transação encontrada no arquivo.');
      }
    } catch (error) {
      console.error(error);
      alert('Houve um erro ao salvar os dados no Supabase.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openModal = (tx = null) => {
    if (tx) {
      setEditingTx(tx);
      setFormDesc(tx.description);
      setFormAmount(Math.abs(tx.amount).toString());
      setFormDate(tx.date.split('T')[0]);
      setFormCategory(tx.category || 'Geral');
      setFormType(tx.amount >= 0 ? 'income' : 'expense');
      setIsRecurring(tx.isRecurring || false);
    } else {
      setEditingTx(null);
      setFormDesc('');
      setFormAmount('');
      setFormDate(new Date().toISOString().split('T')[0]);
      setFormCategory('Geral');
      setFormType('expense');
      setIsRecurring(false);
    }
    setIsModalOpen(true);
  };

  const saveTransaction = async (e) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      alert("Configure as chaves do Supabase primeiro!");
      return;
    }

    const finalAmount = formType === 'expense' ? -Math.abs(parseFloat(formAmount)) : Math.abs(parseFloat(formAmount));
    
    if (editingTx) {
      const updatedTx = {
        description: formDesc,
        amount: finalAmount,
        date: new Date(formDate).toISOString(),
        category: formCategory,
        isrecurring: isRecurring
      };

      const { error } = await supabase.from('transactions').update(updatedTx).eq('id', editingTx.id);
      
      if (!error) {
        const updated = safeTransactions.map(t => t.id === editingTx.id ? { ...t, ...updatedTx, isRecurring } : t);
        setTransactions(updated.sort((a, b) => new Date(b.date) - new Date(a.date)));
      } else {
        alert('Erro ao atualizar no banco de dados.');
      }
    } else {
      const newTx = {
        id: Math.random().toString(36).substring(7),
        description: formDesc,
        amount: finalAmount,
        date: new Date(formDate).toISOString(),
        category: formCategory,
        isrecurring: isRecurring
      };
      
      const { error } = await supabase.from('transactions').insert([newTx]);
      
      if (!error) {
        setTransactions([...safeTransactions, { ...newTx, isRecurring }].sort((a, b) => new Date(b.date) - new Date(a.date)));
      } else {
        alert('Erro ao salvar no banco de dados.');
      }
    }
    setIsModalOpen(false);
  };

  const deleteTransaction = async () => {
    if (!editingTx) return;
    if (window.confirm('Tem certeza que deseja excluir este lançamento?')) {
      const { error } = await supabase.from('transactions').delete().eq('id', editingTx.id);
      if (!error) {
        setTransactions(safeTransactions.filter(t => t.id !== editingTx.id));
        setIsModalOpen(false);
      } else {
        alert('Erro ao excluir do banco de dados.');
      }
    }
  };

  return (
    <div className="app-container">
      {!isSupabaseConfigured && (
        <div style={{ background: 'var(--danger-color)', color: 'white', padding: '16px', borderRadius: '12px', marginBottom: '24px', textAlign: 'center' }}>
          <strong>Atenção:</strong> Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY na Vercel para ativar o banco de dados em nuvem.
        </div>
      )}

      <header className="dashboard-header">
        <div>
          <h1>Minhas Finanças (Cloud)</h1>
          <div className="month-selector">
            <button onClick={() => handleMonthChange(-1)}>◄</button>
            <span style={{textTransform: 'capitalize'}}>{getMonthName(currentMonth)}</span>
            <button onClick={() => handleMonthChange(1)}>►</button>
          </div>
        </div>
        
        <div className="header-actions">
          <input type="file" accept=".ofx,.csv,.pdf" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileUpload} />
          <button className="btn secondary" onClick={() => fileInputRef.current.click()} disabled={loading || !isSupabaseConfigured}>
            <span>📥</span> Importar (Nuvem)
          </button>
          <button className="btn" onClick={() => openModal()} disabled={!isSupabaseConfigured}>
            <span>➕</span> Lançar Manual
          </button>
        </div>
      </header>

      <div className="dashboard-grid">
        <div className="dashboard-col">
          <div className="glass-panel">
            <h2>Balanço do Mês</h2>
            <div className="currency">{formatCurrency(income - expense)}</div>
            
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
            <h2>Resumo por Categoria</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {CATEGORIES.map(cat => {
                const totalCat = filteredTransactions.filter(t => t.category === cat && t.amount < 0).reduce((a, b) => a + Math.abs(b.amount), 0);
                if (totalCat === 0) return null;
                return (
                  <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span>{cat}</span>
                    <span style={{fontWeight: 'bold'}}>{formatCurrency(totalCat)}</span>
                  </div>
                )
              })}
              {filteredTransactions.filter(t => t.amount < 0).length === 0 && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Nenhuma despesa neste mês.</p>
              )}
            </div>
          </div>
        </div>

        <div className="dashboard-col">
          <div className="glass-panel">
            <h2>Lançamentos de {getMonthName(currentMonth)}</h2>
            
            <div className="transaction-list">
              {filteredTransactions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                  <p>Nenhum lançamento encontrado neste mês.</p>
                </div>
              ) : (
                filteredTransactions.map(tx => (
                  <div key={tx.id} className="transaction-item" onClick={() => openModal(tx)}>
                    <div className="transaction-info">
                      <div className="transaction-icon">{tx.amount >= 0 ? '💰' : '🛒'}</div>
                      <div className="transaction-details">
                        <h4>
                          {tx.isRecurring && <span title="Recorrente">🔄 </span>}
                          {tx.description}
                        </h4>
                        <p>
                          <span className="category-badge">{tx.category}</span>
                          {new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </p>
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

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingTx ? 'Editar Lançamento' : 'Novo Lançamento'}</h3>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            
            <form onSubmit={saveTransaction}>
              <div className="form-group" style={{ flexDirection: 'row', gap: '16px', display: 'flex', marginBottom: '24px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" name="type" checked={formType === 'expense'} onChange={() => setFormType('expense')} /> Despesa
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" name="type" checked={formType === 'income'} onChange={() => setFormType('income')} /> Receita
                </label>
              </div>

              <div className="form-group">
                <label>Descrição</label>
                <input required className="form-control" type="text" value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Ex: Supermercado" />
              </div>

              <div className="form-group">
                <label>Valor (R$)</label>
                <input required className="form-control" type="number" step="0.01" value={formAmount} onChange={e => setFormAmount(e.target.value)} placeholder="0.00" />
              </div>

              <div className="form-group">
                <label>Data</label>
                <input required className="form-control" type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
              </div>

              <div className="form-group">
                <label>Categoria</label>
                <select className="form-control" value={formCategory} onChange={e => setFormCategory(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '16px' }}>
                  <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} /> 
                  É um lançamento recorrente (mensal)?
                </label>
              </div>

              <div className="form-actions">
                {editingTx && (
                  <button type="button" className="btn danger" onClick={deleteTransaction} style={{ marginRight: 'auto' }}>
                    Excluir
                  </button>
                )}
                <button type="button" className="btn secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn">Salvar (Nuvem)</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
