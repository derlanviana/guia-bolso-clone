import React, { useState, useRef, useEffect } from 'react';
import { parseOFX, parseCSV } from './utils/parser';
import { supabase } from './supabaseClient';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

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

  // Conciliation State
  const [conciliationData, setConciliationData] = useState(null);
  const [selectedConciliationIds, setSelectedConciliationIds] = useState(new Set());

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
        // Map matches to open Conciliation View
        const mappedData = newTransactions.map(tx => {
          const match = safeTransactions.find(etx => 
            etx.amount === tx.amount && 
            etx.date.split('T')[0] === tx.date.split('T')[0]
          );
          return {
            ...tx,
            isMatch: !!match,
            matchedTx: match
          }
        });
        
        setConciliationData({ fileName: file.name, transactions: mappedData });
        
        // Select only new transactions by default
        const newIds = mappedData.filter(t => !t.isMatch).map(t => t.id);
        setSelectedConciliationIds(new Set(newIds));
        
      } else {
        alert('Nenhuma transação encontrada no arquivo.');
      }
    } catch (error) {
      console.error(error);
      alert('Houve um erro ao processar o arquivo.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmConciliation = async () => {
    const toImportRaw = conciliationData.transactions.filter(t => selectedConciliationIds.has(t.id));
    if (toImportRaw.length === 0) {
      setConciliationData(null);
      return;
    }

    setLoading(true);
    try {
      // Map isRecurring to isrecurring for Postgres
      const dbImported = toImportRaw.map(({ isMatch, matchedTx, isRecurring, ...rest }) => ({
        ...rest,
        isrecurring: isRecurring || false
      }));
      
      const { error } = await supabase.from('transactions').insert(dbImported);
      if (error) throw error;

      // Ensure we restore the camelCase for the frontend state
      const importedForState = dbImported.map(tx => ({...tx, isRecurring: tx.isrecurring}));
      
      const allTransactions = [...safeTransactions, ...importedForState].sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(allTransactions);

      // Save account reference
      const newAccount = {
        id: Math.random().toString(36).substring(7),
        name: 'Conta Importada',
        number: conciliationData.fileName,
        balance: importedForState.reduce((acc, tx) => acc + tx.amount, 0)
      };
      await supabase.from('accounts').insert([newAccount]);
      setAccounts([...safeAccounts, newAccount]);

      alert(`✅ ${dbImported.length} transações importadas com sucesso!`);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar no Supabase.');
    } finally {
      setLoading(false);
      setConciliationData(null);
    }
  };

  const toggleConciliationItem = (id) => {
    const newSet = new Set(selectedConciliationIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedConciliationIds(newSet);
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

  if (conciliationData) {
    return (
      <div className="app-container" style={{ maxWidth: '800px' }}>
        <div className="glass-panel" style={{ padding: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <div>
              <h2 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>Conciliação Bancária</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Arquivo: {conciliationData.fileName}</p>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent-color)' }}></span>
                Novo Lançamento
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-secondary)' }}></span>
                Já Existente
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '8px' }}>
            {conciliationData.transactions.map((tx) => (
              <label 
                key={tx.id} 
                style={{
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '16px', 
                  padding: '16px', 
                  background: 'var(--bg-color)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '12px',
                  cursor: 'pointer',
                  opacity: tx.isMatch && !selectedConciliationIds.has(tx.id) ? 0.6 : 1
                }}
              >
                <input 
                  type="checkbox" 
                  checked={selectedConciliationIds.has(tx.id)}
                  onChange={() => toggleConciliationItem(tx.id)}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
                
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{tx.description.split(' | ')[0]}</span>
                    <span style={{ fontWeight: '600', color: tx.amount > 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                      {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {new Date(tx.date).toLocaleDateString('pt-BR')} • {tx.category}
                    </span>
                    {tx.isMatch ? (
                      <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--text-secondary)' }}></span>
                        Já Existente
                      </span>
                    ) : (
                      <span style={{ color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-color)' }}></span>
                        Novo Lançamento
                      </span>
                    )}
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
            <button className="btn secondary" onClick={() => setConciliationData(null)}>Cancelar</button>
            <button className="btn" onClick={confirmConciliation} disabled={loading || selectedConciliationIds.size === 0}>
              {loading ? 'Importando...' : `Confirmar Importação (${selectedConciliationIds.size})`}
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            <h2>Despesas por Categoria</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(() => {
                const chartData = CATEGORIES.map(cat => {
                  const value = filteredTransactions.filter(t => t.category === cat && t.amount < 0).reduce((a, b) => a + Math.abs(b.amount), 0);
                  return { name: cat, value };
                }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

                const COLORS = ['#129E3F', '#006A33', '#454843', '#8E918B', '#3498db', '#e67e22', '#9b59b6', '#f1c40f', '#e74c3c', '#1abc9c'];

                if (chartData.length === 0) {
                  return <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Nenhuma despesa neste mês.</p>;
                }

                return (
                  <>
                    <div style={{ width: '100%', height: 200 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => formatCurrency(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                      {chartData.map((entry, index) => (
                        <div key={entry.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: COLORS[index % COLORS.length] }}></div>
                            <span style={{ color: 'var(--text-primary)' }}>{entry.name}</span>
                          </div>
                          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(entry.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
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
                          {tx.description.split(' | ')[0]}
                        </h4>
                        {tx.description.includes(' | ') && (
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 4px 0', opacity: 0.8 }}>
                            {tx.description.split(' | ')[1]}
                          </p>
                        )}
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
