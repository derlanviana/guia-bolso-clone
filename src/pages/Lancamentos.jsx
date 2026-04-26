import React, { useState, useRef } from 'react';
import { parseOFX, parseCSV } from '../utils/parser';
import { supabase } from '../supabaseClient';

const CATEGORIES = ['Geral','Alimentação','Moradia','Transporte','Saúde','Lazer','Salário','Investimentos','Educação','Outros'];
const CATEGORY_ICONS = {
  'Alimentação':'🛒','Moradia':'🏠','Transporte':'🚗','Saúde':'💊','Lazer':'🎮',
  'Salário':'💰','Investimentos':'📈','Educação':'📚','Outros':'📦','Geral':'📋'
};

export default function Lancamentos({
  transactions, setTransactions, accounts, setAccounts,
  formatCurrency, isSupabaseConfigured, initialModal
}) {
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.toISOString().slice(0,7));
  const [loading, setLoading] = useState(false);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(!!initialModal);
  const [editingTx, setEditingTx] = useState(null);
  const [formDesc, setFormDesc] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(now.toISOString().split('T')[0]);
  const [formCategory, setFormCategory] = useState('Geral');
  const [formType, setFormType] = useState(initialModal||'expense');
  const [isRecurring, setIsRecurring] = useState(false);

  // Conciliation
  const [conciliationData, setConciliationData] = useState(null);
  const [conciliatingTxId, setConciliatingTxId] = useState(null);
  const fileInputRef = useRef(null);

  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const safeAccounts = Array.isArray(accounts) ? accounts : [];

  const handleMonthChange = (offset) => {
    const [y,m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m-1+offset, 1);
    setCurrentMonth(d.toISOString().slice(0,7));
  };

  const getMonthLabel = (yyyymm) => {
    if (!yyyymm) return '';
    const [y,m] = yyyymm.split('-');
    return new Date(y,m-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  };

  const filtered = safeTransactions.filter(tx => tx?.date?.startsWith(currentMonth));
  const income = filtered.filter(t=>t.amount>0).reduce((a,b)=>a+b.amount,0);
  const expense = filtered.filter(t=>t.amount<0).reduce((a,b)=>a+Math.abs(b.amount),0);

  // ── Modal helpers ──
  const openModal = (tx=null, type='expense') => {
    if (tx && tx.id) {
      setEditingTx(tx);
      setFormDesc(tx.description?.split(' | ')[0]||'');
      setFormAmount(Math.abs(tx.amount).toString());
      setFormDate(tx.date?.split('T')[0]||now.toISOString().split('T')[0]);
      setFormCategory(tx.category||'Geral');
      setFormType(tx.amount>=0?'income':'expense');
      setIsRecurring(tx.isRecurring||tx.isrecurring||false);
    } else {
      setEditingTx(null);
      setFormDesc(''); setFormAmount('');
      setFormDate(now.toISOString().split('T')[0]);
      setFormCategory('Geral');
      setFormType(type);
      setIsRecurring(false);
    }
    setIsModalOpen(true);
  };

  const saveTransaction = async (e) => {
    e.preventDefault();
    if (!isSupabaseConfigured) { alert('Configure o Supabase primeiro!'); return; }
    const finalAmount = formType==='expense' ? -Math.abs(parseFloat(formAmount)) : Math.abs(parseFloat(formAmount));
    if (editingTx) {
      const upd = { description:formDesc, amount:finalAmount, date:new Date(formDate).toISOString(), category:formCategory, isrecurring:isRecurring };
      const { error } = await supabase.from('transactions').update(upd).eq('id',editingTx.id);
      if (!error) setTransactions(safeTransactions.map(t=>t.id===editingTx.id?{...t,...upd,isRecurring}:t).sort((a,b)=>new Date(b.date)-new Date(a.date)));
      else alert('Erro ao atualizar.');
    } else {
      const newTx = { id:Math.random().toString(36).substring(7), description:formDesc, amount:finalAmount, date:new Date(formDate).toISOString(), category:formCategory, isrecurring:isRecurring };
      const { error } = await supabase.from('transactions').insert([newTx]);
      if (!error) setTransactions([...safeTransactions,{...newTx,isRecurring}].sort((a,b)=>new Date(b.date)-new Date(a.date)));
      else alert('Erro ao salvar.');
    }
    setIsModalOpen(false);
  };

  const deleteTransaction = async () => {
    if (!editingTx||!window.confirm('Excluir este lançamento?')) return;
    const { error } = await supabase.from('transactions').delete().eq('id',editingTx.id);
    if (!error) { setTransactions(safeTransactions.filter(t=>t.id!==editingTx.id)); setIsModalOpen(false); }
    else alert('Erro ao excluir.');
  };

  // ── File upload / Conciliation ──
  const handleFileUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (!isSupabaseConfigured) { alert('Configure o Supabase primeiro!'); return; }
    setLoading(true);
    try {
      const text = await file.text();
      let parsed = [];
      if (file.name.toLowerCase().endsWith('.ofx')) parsed = parseOFX(text);
      else if (file.name.toLowerCase().endsWith('.csv')) parsed = await parseCSV(text);
      else { alert('Formato não suportado. Use .ofx ou .csv'); return; }
      if (parsed.length > 0) {
        const mapped = parsed.map(tx => {
          const match = safeTransactions.find(e => e.amount===tx.amount && e.date?.split('T')[0]===tx.date?.split('T')[0]);
          return { ...tx, action: match?'match':null, matchedTx: match||null };
        });
        setConciliationData({ fileName:file.name, transactions:mapped });
      } else alert('Nenhuma transação encontrada.');
    } catch(err) { console.error(err); alert('Erro ao processar o arquivo.'); }
    finally { setLoading(false); if(fileInputRef.current) fileInputRef.current.value=''; }
  };

  const setTxAction = (id, actionType, matchedTx=null) => {
    setConciliationData(prev=>({...prev, transactions:prev.transactions.map(t=>t.id===id?{...t,action:actionType,matchedTx}:t)}));
    setConciliatingTxId(null);
  };

  const updateTxField = (id, field, value) => {
    setConciliationData(prev=>({...prev, transactions:prev.transactions.map(t=>t.id===id?{...t,[field]:value}:t)}));
  };

  const toggleConciliationItem = (id) => {
    setConciliationData(prev=>({...prev, transactions:prev.transactions.map(t=>{
      if(t.id!==id) return t;
      if(t.action && t.action!=='ignore') return {...t,action:'ignore'};
      return {...t,action:'add'};
    })}));
  };

  const confirmConciliation = async () => {
    const toImport = conciliationData.transactions.filter(t=>t.action==='add');
    if (toImport.length>0) {
      setLoading(true);
      try {
        const dbRows = toImport.map(({action,matchedTx,customDesc,customCategory,isRecurring,description,category,...rest})=>({
          ...rest, description:customDesc||description?.split(' | ')[0], category:customCategory||category||'Geral', isrecurring:isRecurring||false
        }));
        const { error } = await supabase.from('transactions').insert(dbRows);
        if (error) throw error;
        const forState = dbRows.map(tx=>({...tx,isRecurring:tx.isrecurring}));
        setTransactions([...safeTransactions,...forState].sort((a,b)=>new Date(b.date)-new Date(a.date)));
        const newAcc = { id:Math.random().toString(36).substring(7), name:'Conta Importada', number:conciliationData.fileName, balance:forState.reduce((a,t)=>a+t.amount,0) };
        await supabase.from('accounts').insert([newAcc]);
        setAccounts([...safeAccounts,newAcc]);
        alert(`✅ ${dbRows.length} transações importadas!`);
      } catch(err) { console.error(err); alert('Erro ao salvar no Supabase.'); }
      finally { setLoading(false); setConciliationData(null); }
    } else setConciliationData(null);
  };

  const seedDatabase = async () => {
    if (!isSupabaseConfigured) { alert('Supabase não configurado.'); return; }
    if (!window.confirm('Isso vai APAGAR TODOS os lançamentos e inserir 5 de exemplo. Continuar?')) return;
    setLoading(true);
    try {
      await supabase.from('transactions').delete().neq('id','impossivel');
      const today = new Date();
      const samples = [
        {id:Math.random().toString(36).substring(7),description:'Salário da Empresa',amount:4500,date:new Date(today.getFullYear(),today.getMonth(),5).toISOString(),category:'Salário',isrecurring:false},
        {id:Math.random().toString(36).substring(7),description:'Aluguel',amount:-1500,date:new Date(today.getFullYear(),today.getMonth(),10).toISOString(),category:'Moradia',isrecurring:true},
        {id:Math.random().toString(36).substring(7),description:'Supermercado Extra',amount:-450.75,date:new Date(today.getFullYear(),today.getMonth(),12).toISOString(),category:'Alimentação',isrecurring:false},
        {id:Math.random().toString(36).substring(7),description:'Uber',amount:-35.5,date:new Date(today.getFullYear(),today.getMonth(),15).toISOString(),category:'Transporte',isrecurring:false},
        {id:Math.random().toString(36).substring(7),description:'Conta de Luz',amount:-120,date:new Date(today.getFullYear(),today.getMonth(),20).toISOString(),category:'Moradia',isrecurring:true},
      ];
      await supabase.from('transactions').insert(samples);
      setTransactions(samples.map(t=>({...t,isRecurring:t.isrecurring})).sort((a,b)=>new Date(b.date)-new Date(a.date)));
      alert('Banco de dados resetado!');
    } catch(err) { console.error(err); alert('Erro ao resetar.'); }
    finally { setLoading(false); }
  };

  // ── Conciliation View ──
  if (conciliationData) {
    const selectedCount = conciliationData.transactions.filter(t=>t.action==='add'||t.action==='match').length;
    return (
      <div className="concil-page">
        <div className="concil-card">
          <div className="concil-header">
            <div>
              <div className="concil-title">Conciliação Bancária</div>
              <div className="concil-sub">Arquivo: {conciliationData.fileName} — revise cada lançamento</div>
            </div>
            <span style={{fontSize:13,color:'var(--text-muted)'}}>{selectedCount} processados</span>
          </div>
          <div className="concil-list">
            {conciliationData.transactions.map(tx => (
              <div className="concil-row" key={tx.id}>
                <input type="checkbox" checked={tx.action==='add'||tx.action==='match'} onChange={()=>toggleConciliationItem(tx.id)} style={{width:18,height:18,flexShrink:0,cursor:'pointer'}}/>
                <div className="concil-left" style={{opacity:(!tx.action||tx.action==='ignore')?0.55:1}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontWeight:600,fontSize:14}}>{tx.description?.split(' | ')[0]}</span>
                    <span style={{fontWeight:700,color:tx.amount>0?'var(--green)':'var(--red)'}}>{formatCurrency(tx.amount)}</span>
                  </div>
                  <span style={{fontSize:12,color:'var(--text-muted)'}}>{new Date(tx.date).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="concil-arrow">➜</div>
                <div style={{flex:1}}>
                  {(!tx.action||tx.action==='ignore') ? (
                    <div className="concil-right-dashed" style={{background:tx.action==='ignore'?'#f5f5f5':'transparent'}}>
                      {tx.action==='ignore' ? (<>
                        <span style={{color:'var(--text-muted)',fontSize:13}}>Ignorado</span>
                        <span className="concil-sep">|</span>
                        <button className="concil-action-btn" onClick={()=>setTxAction(tx.id,null)}>Desfazer</button>
                      </>) : (<>
                        <button className="concil-action-btn" onClick={()=>setTxAction(tx.id,'add')}>+ adicionar</button>
                        <span className="concil-sep">|</span>
                        {conciliatingTxId===tx.id ? (
                          <select autoFocus style={{padding:'4px 8px',borderRadius:4,border:'1px solid var(--green)',fontSize:13}} onChange={e=>{if(!e.target.value)return;const m=safeTransactions.find(t=>t.id===e.target.value);setTxAction(tx.id,'match',m);}} onBlur={()=>setConciliatingTxId(null)}>
                            <option value="">Selecione...</option>
                            {safeTransactions.slice(0,100).map(etx=><option key={etx.id} value={etx.id}>{etx.description?.split(' | ')[0]} — {formatCurrency(etx.amount)}</option>)}
                          </select>
                        ) : (
                          <button className="concil-action-btn" onClick={()=>setConciliatingTxId(tx.id)}>conciliar com...</button>
                        )}
                        <span className="concil-sep">|</span>
                        <button className="concil-action-btn danger" onClick={()=>setTxAction(tx.id,'ignore')}>ignorar</button>
                      </>)}
                    </div>
                  ) : tx.action==='add' ? (
                    <div className="concil-right-green">
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{color:'var(--green)',fontWeight:600,fontSize:13}}>Novo Lançamento</span>
                        <button className="concil-action-btn danger" style={{fontSize:12}} onClick={()=>setTxAction(tx.id,null)}>Desfazer</button>
                      </div>
                      <div style={{display:'flex',gap:8}}>
                        <input type="text" className="form-control" style={{padding:'6px 10px',fontSize:13,flex:1}} value={tx.customDesc!==undefined?tx.customDesc:tx.description?.split(' | ')[0]} onChange={e=>updateTxField(tx.id,'customDesc',e.target.value)} placeholder="Descrição"/>
                        <select className="form-control" style={{padding:'6px 10px',fontSize:13,width:130}} value={tx.customCategory||tx.category||'Geral'} onChange={e=>updateTxField(tx.id,'customCategory',e.target.value)}>
                          {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="concil-right-green">
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                        <span style={{color:'var(--green)',fontWeight:600,fontSize:12}}>Conciliado com:</span>
                        <button className="concil-action-btn danger" style={{fontSize:12}} onClick={()=>setTxAction(tx.id,null)}>Desfazer</button>
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between'}}>
                        <span style={{fontWeight:600,fontSize:14}}>{tx.matchedTx?.description?.split(' | ')[0]}</span>
                        <span style={{fontWeight:700,color:tx.matchedTx?.amount>0?'var(--green)':'var(--red)'}}>{formatCurrency(tx.matchedTx?.amount)}</span>
                      </div>
                      <span style={{fontSize:12,color:'var(--text-muted)'}}>{new Date(tx.matchedTx?.date).toLocaleDateString('pt-BR')} · {tx.matchedTx?.category}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="concil-footer">
            <button className="btn secondary" onClick={()=>setConciliationData(null)}>Cancelar</button>
            <button className="btn" onClick={confirmConciliation} disabled={loading||selectedCount===0}>
              {loading?'Importando...':`Confirmar Importação (${selectedCount})`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Lancamentos View ──
  return (
    <div className="page">
      <div className="tx-page-header">
        <div className="tx-page-title">Lançamentos</div>
        <div className="tx-month-nav">
          <button className="tx-month-btn" onClick={()=>handleMonthChange(-1)}>‹</button>
          <span className="tx-month-label">{getMonthLabel(currentMonth)}</span>
          <button className="tx-month-btn" onClick={()=>handleMonthChange(1)}>›</button>
        </div>
        <div className="tx-actions">
          <input type="file" accept=".ofx,.csv" style={{display:'none'}} ref={fileInputRef} onChange={handleFileUpload}/>
          <button className="btn secondary" onClick={()=>fileInputRef.current.click()} disabled={loading||!isSupabaseConfigured}>
            📥 Importar
          </button>
          <button className="btn" onClick={()=>openModal(null,'expense')} disabled={!isSupabaseConfigured}>
            ➕ Lançar
          </button>
          <button className="btn danger" style={{fontSize:12,padding:'8px 12px'}} onClick={seedDatabase} title="Resetar banco com exemplos">🔄 Demo</button>
        </div>
      </div>

      <div className="tx-summary">
        <div className="tx-summary-item">
          <label>Receitas</label>
          <div className="val income">{formatCurrency(income)}</div>
        </div>
        <div className="tx-summary-item">
          <label>Despesas</label>
          <div className="val expense">{formatCurrency(expense)}</div>
        </div>
        <div className="tx-summary-item">
          <label>Saldo do Mês</label>
          <div className={`val ${income-expense>=0?'income':'expense'}`}>{formatCurrency(income-expense)}</div>
        </div>
      </div>

      <div className="tx-list-card">
        {filtered.length===0 ? (
          <div className="tx-empty">
            <div style={{fontSize:32,marginBottom:8}}>📭</div>
            <p>Nenhum lançamento encontrado neste mês.</p>
          </div>
        ) : filtered.map(tx=>(
          <div className="tx-item" key={tx.id} onClick={()=>openModal(tx)}>
            <div className={`tx-icon ${tx.amount>0?'income':'expense'}`}>{CATEGORY_ICONS[tx.category]||'📋'}</div>
            <div className="tx-details">
              <div className="tx-name">
                {(tx.isRecurring||tx.isrecurring)&&<span title="Recorrente">🔄 </span>}
                {tx.description?.split(' | ')[0]}
              </div>
              <div className="tx-meta">
                <span className="category-badge">{tx.category}</span>
                {new Date(tx.date).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}
              </div>
            </div>
            <div className={`tx-amount ${tx.amount>0?'income':'expense'}`}>
              {tx.amount>0?'+':''}{formatCurrency(tx.amount)}
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={()=>setIsModalOpen(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-head">
              <h3>{editingTx?'Editar Lançamento':'Novo Lançamento'}</h3>
              <button className="modal-close" onClick={()=>setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={saveTransaction}>
              <div className="modal-body">
                <div className="form-group">
                  <div className="form-radio-group">
                    <div className={`form-radio expense${formType==='expense'?' active':''}`} onClick={()=>setFormType('expense')}>💸 Despesa</div>
                    <div className={`form-radio income${formType==='income'?' active':''}`} onClick={()=>setFormType('income')}>💰 Receita</div>
                  </div>
                </div>
                <div className="form-group">
                  <label>Descrição</label>
                  <input required className="form-control" type="text" value={formDesc} onChange={e=>setFormDesc(e.target.value)} placeholder="Ex: Supermercado"/>
                </div>
                <div className="form-group">
                  <label>Valor (R$)</label>
                  <input required className="form-control" type="number" step="0.01" value={formAmount} onChange={e=>setFormAmount(e.target.value)} placeholder="0,00"/>
                </div>
                <div className="form-group">
                  <label>Data</label>
                  <input required className="form-control" type="date" value={formDate} onChange={e=>setFormDate(e.target.value)}/>
                </div>
                <div className="form-group">
                  <label>Categoria</label>
                  <select className="form-control" value={formCategory} onChange={e=>setFormCategory(e.target.value)}>
                    {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',textTransform:'none',letterSpacing:0}}>
                    <input type="checkbox" checked={isRecurring} onChange={e=>setIsRecurring(e.target.checked)}/>
                    Lançamento recorrente (mensal)
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                {editingTx&&<button type="button" className="btn danger" onClick={deleteTransaction} style={{marginRight:'auto'}}>Excluir</button>}
                <button type="button" className="btn secondary" onClick={()=>setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
