import React, { useState, useRef } from 'react';
import { parseOFX, parseCSV } from '../utils/parser';
import { supabase } from '../supabaseClient';

const CATS = ['Geral','Alimentação','Moradia','Transporte','Saúde','Lazer','Salário','Investimentos','Educação','Outros'];
const ICONS = {'Alimentação':'🛒','Moradia':'🏠','Transporte':'🚗','Saúde':'💊','Lazer':'🎮','Salário':'💰','Investimentos':'📈','Educação':'📚','Outros':'📦','Geral':'📋'};

export default function Transacoes({ transactions, setTransactions, accounts, setAccounts, formatCurrency, isSupabaseConfigured }) {
  const now = new Date();
  const [month, setMonth] = useState(now.toISOString().slice(0,7));
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [formDesc, setFormDesc] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(now.toISOString().split('T')[0]);
  const [formCat, setFormCat] = useState('Geral');
  const [formType, setFormType] = useState('expense');
  const [formRecurring, setFormRecurring] = useState(false);
  const [conciliationData, setConciliationData] = useState(null);
  const [conciliatingId, setConciliatingId] = useState(null);
  const fileRef = useRef(null);

  const safe = Array.isArray(transactions) ? transactions : [];
  const safeAcc = Array.isArray(accounts) ? accounts : [];

  const handleMonth = (offset) => {
    const [y,m] = month.split('-').map(Number);
    const d = new Date(y, m-1+offset, 1);
    setMonth(d.toISOString().slice(0,7));
  };

  const monthLabel = () => {
    const [y,m] = month.split('-');
    return new Date(y,m-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  };

  let filtered = safe.filter(t=>t?.date?.startsWith(month));
  if (filter==='income') filtered = filtered.filter(t=>t.amount>0);
  if (filter==='expense') filtered = filtered.filter(t=>t.amount<0);

  const income = safe.filter(t=>t?.date?.startsWith(month)&&t.amount>0).reduce((a,b)=>a+b.amount,0);
  const expense = safe.filter(t=>t?.date?.startsWith(month)&&t.amount<0).reduce((a,b)=>a+Math.abs(b.amount),0);

  const openModal = (tx=null, type='expense') => {
    if (tx?.id) {
      setEditingTx(tx); setFormDesc(tx.description?.split(' | ')[0]||'');
      setFormAmount(Math.abs(tx.amount).toString()); setFormDate(tx.date?.split('T')[0]||now.toISOString().split('T')[0]);
      setFormCat(tx.category||'Geral'); setFormType(tx.amount>=0?'income':'expense');
      setFormRecurring(tx.isRecurring||tx.isrecurring||false);
    } else {
      setEditingTx(null); setFormDesc(''); setFormAmount('');
      setFormDate(now.toISOString().split('T')[0]); setFormCat('Geral'); setFormType(type); setFormRecurring(false);
    }
    setIsModalOpen(true);
  };

  const saveTx = async (e) => {
    e.preventDefault();
    if (!isSupabaseConfigured) { alert('Configure o Supabase!'); return; }
    const amt = formType==='expense' ? -Math.abs(parseFloat(formAmount)) : Math.abs(parseFloat(formAmount));
    if (editingTx) {
      const upd = {description:formDesc,amount:amt,date:new Date(formDate).toISOString(),category:formCat,isrecurring:formRecurring};
      const {error} = await supabase.from('transactions').update(upd).eq('id',editingTx.id);
      if (!error) setTransactions(safe.map(t=>t.id===editingTx.id?{...t,...upd,isRecurring:formRecurring}:t).sort((a,b)=>new Date(b.date)-new Date(a.date)));
      else alert('Erro ao atualizar.');
    } else {
      const newTx = {id:Math.random().toString(36).substring(7),description:formDesc,amount:amt,date:new Date(formDate).toISOString(),category:formCat,isrecurring:formRecurring};
      const {error} = await supabase.from('transactions').insert([newTx]);
      if (!error) setTransactions([...safe,{...newTx,isRecurring:formRecurring}].sort((a,b)=>new Date(b.date)-new Date(a.date)));
      else alert('Erro ao salvar.');
    }
    setIsModalOpen(false);
  };

  const deleteTx = async () => {
    if (!editingTx||!window.confirm('Excluir?')) return;
    const {error} = await supabase.from('transactions').delete().eq('id',editingTx.id);
    if (!error) { setTransactions(safe.filter(t=>t.id!==editingTx.id)); setIsModalOpen(false); }
    else alert('Erro ao excluir.');
  };

  const handleFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setLoading(true);
    try {
      const text = await file.text();
      let parsed = file.name.toLowerCase().endsWith('.ofx') ? parseOFX(text) : await parseCSV(text);
      if (parsed.length > 0) {
        const mapped = parsed.map(tx => {
          const match = safe.find(s=>s.amount===tx.amount&&s.date?.split('T')[0]===tx.date?.split('T')[0]);
          return {...tx, action:match?'match':null, matchedTx:match||null};
        });
        setConciliationData({fileName:file.name,transactions:mapped});
      } else alert('Nenhuma transação encontrada.');
    } catch(err) { alert('Erro ao processar arquivo.'); }
    finally { setLoading(false); if(fileRef.current) fileRef.current.value=''; }
  };

  const setTxAction = (id,action,matchedTx=null) => {
    setConciliationData(prev=>({...prev,transactions:prev.transactions.map(t=>t.id===id?{...t,action,matchedTx}:t)}));
    setConciliatingId(null);
  };

  const updateTxField = (id,field,value) => setConciliationData(prev=>({...prev,transactions:prev.transactions.map(t=>t.id===id?{...t,[field]:value}:t)}));

  const toggleConcil = (id) => setConciliationData(prev=>({...prev,transactions:prev.transactions.map(t=>{
    if(t.id!==id)return t;
    return t.action&&t.action!=='ignore'?{...t,action:'ignore'}:{...t,action:'add'};
  })}));

  const confirmConcil = async () => {
    const toImport = conciliationData.transactions.filter(t=>t.action==='add');
    if (!toImport.length) { setConciliationData(null); return; }
    setLoading(true);
    try {
      const rows = toImport.map(({action,matchedTx,customDesc,customCategory,isRecurring,description,category,...rest})=>({
        ...rest,description:customDesc||description?.split(' | ')[0],category:customCategory||category||'Geral',isrecurring:isRecurring||false
      }));
      const {error} = await supabase.from('transactions').insert(rows);
      if(error) throw error;
      const forState = rows.map(t=>({...t,isRecurring:t.isrecurring}));
      setTransactions([...safe,...forState].sort((a,b)=>new Date(b.date)-new Date(a.date)));
      const acc = {id:Math.random().toString(36).substring(7),name:'Conta Importada',number:conciliationData.fileName,balance:forState.reduce((a,t)=>a+t.amount,0)};
      await supabase.from('accounts').insert([acc]);
      setAccounts([...safeAcc,acc]);
      alert(`✅ ${rows.length} transações importadas!`);
    } catch(err) { alert('Erro ao salvar.'); }
    finally { setLoading(false); setConciliationData(null); }
  };

  const seedDB = async () => {
    if (!window.confirm('Apagar tudo e inserir 5 exemplos?')) return;
    setLoading(true);
    await supabase.from('transactions').delete().neq('id','x');
    const today = new Date();
    const samples = [
      {id:Math.random().toString(36).substring(7),description:'Salário',amount:4500,date:new Date(today.getFullYear(),today.getMonth(),5).toISOString(),category:'Salário',isrecurring:false},
      {id:Math.random().toString(36).substring(7),description:'Aluguel',amount:-1500,date:new Date(today.getFullYear(),today.getMonth(),10).toISOString(),category:'Moradia',isrecurring:true},
      {id:Math.random().toString(36).substring(7),description:'Supermercado',amount:-450.75,date:new Date(today.getFullYear(),today.getMonth(),12).toISOString(),category:'Alimentação',isrecurring:false},
      {id:Math.random().toString(36).substring(7),description:'Uber',amount:-35.5,date:new Date(today.getFullYear(),today.getMonth(),15).toISOString(),category:'Transporte',isrecurring:false},
      {id:Math.random().toString(36).substring(7),description:'Conta de Luz',amount:-120,date:new Date(today.getFullYear(),today.getMonth(),20).toISOString(),category:'Moradia',isrecurring:true},
    ];
    await supabase.from('transactions').insert(samples);
    setTransactions(samples.map(t=>({...t,isRecurring:t.isrecurring})));
    setLoading(false);
    alert('Banco resetado!');
  };

  if (conciliationData) {
    const count = conciliationData.transactions.filter(t=>t.action==='add'||t.action==='match').length;
    return (
      <div className="concil-page">
        <div className="card"><div className="card-body">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
            <div>
              <h2 style={{fontSize:18,fontWeight:700}}>Conciliação Bancária</h2>
              <p style={{color:'var(--text-muted)',fontSize:13,marginTop:4}}>Arquivo: {conciliationData.fileName} · {count} processados</p>
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:12,maxHeight:'55vh',overflowY:'auto',paddingRight:4}}>
            {conciliationData.transactions.map(tx=>(
              <div className="concil-row" key={tx.id}>
                <input type="checkbox" checked={tx.action==='add'||tx.action==='match'} onChange={()=>toggleConcil(tx.id)} style={{width:18,height:18,flexShrink:0,cursor:'pointer'}}/>
                <div className="concil-box-left" style={{opacity:(!tx.action||tx.action==='ignore')?0.5:1}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontWeight:600,fontSize:14}}>{tx.description?.split(' | ')[0]}</span>
                    <span style={{fontWeight:700,color:tx.amount>0?'var(--green)':'var(--red)'}}>{formatCurrency(tx.amount)}</span>
                  </div>
                  <span style={{fontSize:12,color:'var(--text-muted)'}}>{new Date(tx.date).toLocaleDateString('pt-BR')}</span>
                </div>
                <span style={{color:'var(--text-dim)'}}>→</span>
                <div style={{flex:1}}>
                  {(!tx.action||tx.action==='ignore') ? (
                    <div className="concil-dashed" style={{background:tx.action==='ignore'?'var(--surface-2)':'transparent'}}>
                      {tx.action==='ignore' ? (<><span style={{color:'var(--text-muted)'}}>Ignorado</span><span className="concil-sep">|</span><button className="concil-action" onClick={()=>setTxAction(tx.id,null)}>Desfazer</button></>)
                      : (<><button className="concil-action" onClick={()=>setTxAction(tx.id,'add')}>+ adicionar</button><span className="concil-sep">|</span>
                        {conciliatingId===tx.id?(<select autoFocus style={{padding:'4px 8px',borderRadius:6,border:'1px solid var(--green)',background:'var(--surface-2)',color:'var(--text)',fontSize:13}} onChange={e=>{if(!e.target.value)return;const m=safe.find(t=>t.id===e.target.value);setTxAction(tx.id,'match',m);}} onBlur={()=>setConciliatingId(null)}>
                          <option value="">Selecione...</option>{safe.slice(0,100).map(s=><option key={s.id} value={s.id}>{s.description?.split(' | ')[0]} — {formatCurrency(s.amount)}</option>)}</select>)
                        :(<button className="concil-action" onClick={()=>setConciliatingId(tx.id)}>conciliar com...</button>)}
                        <span className="concil-sep">|</span><button className="concil-action danger" onClick={()=>setTxAction(tx.id,'ignore')}>ignorar</button></>)}
                    </div>
                  ) : tx.action==='add' ? (
                    <div className="concil-green">
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{color:'var(--green)',fontWeight:600,fontSize:13}}>Novo Lançamento</span>
                        <button className="concil-action danger" style={{fontSize:12}} onClick={()=>setTxAction(tx.id,null)}>Desfazer</button>
                      </div>
                      <div style={{display:'flex',gap:8}}>
                        <input type="text" className="form-control" style={{padding:'6px 10px',fontSize:13,flex:1}} value={tx.customDesc!==undefined?tx.customDesc:tx.description?.split(' | ')[0]} onChange={e=>updateTxField(tx.id,'customDesc',e.target.value)} placeholder="Descrição"/>
                        <select className="form-control" style={{padding:'6px 10px',fontSize:13,width:130}} value={tx.customCategory||tx.category||'Geral'} onChange={e=>updateTxField(tx.id,'customCategory',e.target.value)}>
                          {CATS.map(c=><option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="concil-green">
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}><span style={{color:'var(--green)',fontWeight:600,fontSize:12}}>Conciliado com:</span><button className="concil-action danger" style={{fontSize:12}} onClick={()=>setTxAction(tx.id,null)}>Desfazer</button></div>
                      <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontWeight:600,fontSize:14}}>{tx.matchedTx?.description?.split(' | ')[0]}</span><span style={{fontWeight:700,color:tx.matchedTx?.amount>0?'var(--green)':'var(--red)'}}>{formatCurrency(tx.matchedTx?.amount)}</span></div>
                      <span style={{fontSize:12,color:'var(--text-muted)'}}>{new Date(tx.matchedTx?.date).toLocaleDateString('pt-BR')} · {tx.matchedTx?.category}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:12,marginTop:20,paddingTop:16,borderTop:'1px solid var(--border)'}}>
            <button className="btn btn-secondary" onClick={()=>setConciliationData(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={confirmConcil} disabled={loading||count===0}>{loading?'Importando...':`Confirmar (${count})`}</button>
          </div>
        </div></div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="tx-header">
        <div className="month-nav">
          <button className="month-btn" onClick={()=>handleMonth(-1)}>‹</button>
          <span className="month-label">{monthLabel()}</span>
          <button className="month-btn" onClick={()=>handleMonth(1)}>›</button>
        </div>
        <div className="tx-actions">
          <input type="file" accept=".ofx,.csv" style={{display:'none'}} ref={fileRef} onChange={handleFile}/>
          <button className="btn btn-secondary btn-sm" onClick={()=>fileRef.current.click()} disabled={loading}>📥 Importar</button>
          <button className="btn btn-primary" onClick={()=>openModal(null,'expense')}>➕ Lançar</button>
          <button className="btn btn-danger btn-sm" onClick={seedDB} title="Demo">🔄</button>
        </div>
      </div>

      <div style={{display:'flex',gap:12,marginBottom:20}}>
        {[['all','Todos'],['income','Receitas'],['expense','Despesas']].map(([v,l])=>(
          <button key={v} className={`btn btn-sm ${filter===v?'btn-primary':'btn-secondary'}`} onClick={()=>setFilter(v)}>{l}</button>
        ))}
        <div style={{marginLeft:'auto',display:'flex',gap:12}}>
          <div style={{textAlign:'center',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 20px'}}>
            <div style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',marginBottom:2}}>Receitas</div>
            <div style={{fontSize:16,fontWeight:700,color:'var(--green)'}}>{formatCurrency(income)}</div>
          </div>
          <div style={{textAlign:'center',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 20px'}}>
            <div style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',marginBottom:2}}>Despesas</div>
            <div style={{fontSize:16,fontWeight:700,color:'var(--red)'}}>{formatCurrency(expense)}</div>
          </div>
          <div style={{textAlign:'center',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 20px'}}>
            <div style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',marginBottom:2}}>Saldo</div>
            <div style={{fontSize:16,fontWeight:700,color:income-expense>=0?'var(--green)':'var(--red)'}}>{formatCurrency(income-expense)}</div>
          </div>
        </div>
      </div>

      <div className="card">
        {filtered.length===0 ? <div className="empty-state"><div className="icon">📭</div><h3>Nenhum lançamento</h3><p>Importe um extrato ou adicione um lançamento.</p></div>
        : filtered.map(tx=>(
          <div className="list-item" key={tx.id} style={{padding:'14px 20px',cursor:'pointer'}} onClick={()=>openModal(tx)}>
            <div className="item-icon">{ICONS[tx.category]||'📋'}</div>
            <div className="item-info">
              <div className="item-name">{(tx.isRecurring||tx.isrecurring)?'🔄 ':''}{tx.description?.split(' | ')[0]}</div>
              <div className="item-sub"><span className="badge gray" style={{marginRight:6}}>{tx.category}</span>{new Date(tx.date).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}</div>
            </div>
            <div className={`item-amount ${tx.amount>0?'income':''}`}>{tx.amount>0?'+':''}{formatCurrency(tx.amount)}</div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={()=>setIsModalOpen(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-head"><h3>{editingTx?'Editar':'Novo Lançamento'}</h3><button className="modal-close" onClick={()=>setIsModalOpen(false)}>×</button></div>
            <form onSubmit={saveTx}>
              <div className="modal-body">
                <div className="form-group">
                  <div className="type-toggle">
                    <div className={`type-btn expense${formType==='expense'?' active':''}`} onClick={()=>setFormType('expense')}>💸 Despesa</div>
                    <div className={`type-btn income${formType==='income'?' active':''}`} onClick={()=>setFormType('income')}>💰 Receita</div>
                  </div>
                </div>
                <div className="form-group"><label>Descrição</label><input required className="form-control" value={formDesc} onChange={e=>setFormDesc(e.target.value)} placeholder="Ex: Supermercado"/></div>
                <div className="form-group"><label>Valor (R$)</label><input required className="form-control" type="number" step="0.01" value={formAmount} onChange={e=>setFormAmount(e.target.value)} placeholder="0,00"/></div>
                <div className="form-group"><label>Data</label><input required className="form-control" type="date" value={formDate} onChange={e=>setFormDate(e.target.value)}/></div>
                <div className="form-group"><label>Categoria</label><select className="form-control" value={formCat} onChange={e=>setFormCat(e.target.value)}>{CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                <div className="form-group"><label style={{display:'flex',alignItems:'center',gap:8,textTransform:'none',letterSpacing:0,fontSize:13,cursor:'pointer'}}><input type="checkbox" checked={formRecurring} onChange={e=>setFormRecurring(e.target.checked)}/> Lançamento recorrente</label></div>
              </div>
              <div className="modal-footer">
                {editingTx&&<button type="button" className="btn btn-danger" onClick={deleteTx} style={{marginRight:'auto'}}>Excluir</button>}
                <button type="button" className="btn btn-secondary" onClick={()=>setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
