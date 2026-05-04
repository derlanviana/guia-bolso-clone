import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Parcelamentos({ installments, setInstallments, formatCurrency, isSupabaseConfigured }) {
  const [tab, setTab] = useState('active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formName, setFormName] = useState('');
  const [formTotal, setFormTotal] = useState('');
  const [formCurrent, setFormCurrent] = useState('1');
  const [formInstAmt, setFormInstAmt] = useState('');
  const [formTotalInst, setFormTotalInst] = useState('');
  const [formAccount, setFormAccount] = useState('Nubank');
  const [formEmoji, setFormEmoji] = useState('📋');

  const safe = Array.isArray(installments) ? installments : [];
  const active = safe.filter(i=>i.status==='active');
  const done = safe.filter(i=>i.status==='completed');
  const displayed = tab==='active' ? active : done;

  const totalOnTime = active.reduce((a,b)=>a+(b.total_amount||0),0);
  const totalMonthly = active.reduce((a,b)=>a+(b.installment_amount||0),0);
  const totalPaid = active.reduce((a,b)=>a+((b.current_installment-1)*(b.installment_amount||0)),0);
  const progress = totalOnTime>0 ? (totalPaid/totalOnTime*100) : 0;

  const openModal = (item=null) => {
    if (item) {
      setEditingItem(item); setFormName(item.name); setFormTotal(item.total_amount?.toString()||'');
      setFormCurrent(item.current_installment?.toString()||'1'); setFormInstAmt(item.installment_amount?.toString()||'');
      setFormTotalInst(item.total_installments?.toString()||''); setFormAccount(item.account_name||'Nubank');
      setFormEmoji(item.icon_emoji||'📋');
    } else {
      setEditingItem(null); setFormName(''); setFormTotal(''); setFormCurrent('1');
      setFormInstAmt(''); setFormTotalInst(''); setFormAccount('Nubank'); setFormEmoji('📋');
    }
    setIsModalOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    const row = {
      name: formName,
      total_amount: parseFloat(formTotal)||0,
      installment_amount: parseFloat(formInstAmt)||0,
      current_installment: parseInt(formCurrent)||1,
      total_installments: parseInt(formTotalInst)||1,
      account_name: formAccount,
      icon_emoji: formEmoji,
      status: 'active',
    };
    if (editingItem) {
      await supabase.from('installments').update(row).eq('id', editingItem.id);
      setInstallments(safe.map(i=>i.id===editingItem.id?{...i,...row}:i));
    } else {
      const newRow = {...row, id: Math.random().toString(36).substring(7)};
      await supabase.from('installments').insert([newRow]);
      setInstallments([...safe, newRow]);
    }
    setIsModalOpen(false);
  };

  const del = async () => {
    if (!editingItem||!window.confirm('Excluir?')) return;
    await supabase.from('installments').delete().eq('id', editingItem.id);
    setInstallments(safe.filter(i=>i.id!==editingItem.id));
    setIsModalOpen(false);
  };

  const markDone = async (item) => {
    await supabase.from('installments').update({status:'completed'}).eq('id',item.id);
    setInstallments(safe.map(i=>i.id===item.id?{...i,status:'completed'}:i));
  };

  return (
    <div className="page">
      {/* Summary stats */}
      <div className="card" style={{marginBottom:16}}>
        <div className="card-body">
          <div style={{display:'flex',gap:40,flexWrap:'wrap',marginBottom:20}}>
            <div><div style={{fontSize:12,color:'var(--text-muted)',textTransform:'uppercase',marginBottom:4}}>Em andamento</div><div style={{fontSize:32,fontWeight:700}}>{active.length}</div><div style={{fontSize:12,color:'var(--text-muted)'}}>contas parceladas</div></div>
            <div><div style={{fontSize:12,color:'var(--text-muted)',textTransform:'uppercase',marginBottom:4}}>No Cartão</div><div style={{fontSize:32,fontWeight:700,color:'var(--red)'}}>{formatCurrency(totalOnTime)}</div></div>
            <div><div style={{fontSize:12,color:'var(--text-muted)',textTransform:'uppercase',marginBottom:4}}>Em Prazo</div><div style={{fontSize:32,fontWeight:700,color:'var(--green)'}}>{formatCurrency(totalMonthly)}/mês</div></div>
            <div style={{marginLeft:'auto',display:'flex',alignItems:'center'}}><button className="btn btn-primary" onClick={()=>openModal()}>+ Adicionar</button></div>
          </div>
          <div style={{marginBottom:8}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--text-muted)',marginBottom:6}}>
              <span>Progresso geral</span><span style={{color:'var(--green)',fontWeight:600}}>{progress.toFixed(0)}% pago</span>
            </div>
            <div className="progress-bar" style={{height:10}}>
              <div className="progress-fill green" style={{width:`${Math.min(progress,100)}%`}}/>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <div className="tabs">
          <button className={`tab-btn${tab==='active'?' active':''}`} onClick={()=>setTab('active')}>Em andamento ({active.length})</button>
          <button className={`tab-btn${tab==='done'?' active':''}`} onClick={()=>setTab('done')}>Finalizadas ({done.length})</button>
        </div>
      </div>

      {/* List */}
      <div className="card">
        {displayed.length===0 ? (
          <div className="empty-state"><div className="icon">📋</div><h3>Nenhum parcelamento {tab==='active'?'em andamento':'finalizado'}</h3></div>
        ) : displayed.map(item => {
          const pct = item.total_installments>0?(item.current_installment-1)/item.total_installments*100:0;
          return (
            <div className="inst-row" key={item.id} style={{padding:'16px 20px'}}>
              <div className="inst-header-row">
                <div className="item-icon">{item.icon_emoji||'📋'}</div>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span className="inst-name">{item.name}</span>
                    <span className="badge green">Ativo</span>
                  </div>
                  <div className="inst-meta">{item.current_installment}x · {formatCurrency(item.installment_amount)}/mês · {item.account_name}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div className="inst-amount">{formatCurrency(item.total_amount)}</div>
                  <div className="inst-sub">total</div>
                </div>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>openModal(item)} title="Editar">✏️</button>
              </div>
              <div style={{marginLeft:56}}>
                <div className="progress-bar">
                  <div className="progress-fill green" style={{width:`${Math.min(pct,100)}%`}}/>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text-muted)',marginTop:4}}>
                  <span>{item.current_installment-1}/{item.total_installments} parcelas pagas</span>
                  <span>{item.total_installments-(item.current_installment-1)} restantes</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={()=>setIsModalOpen(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-head"><h3>{editingItem?'Editar':'Novo Parcelamento'}</h3><button className="modal-close" onClick={()=>setIsModalOpen(false)}>×</button></div>
            <form onSubmit={save}>
              <div className="modal-body">
                <div style={{display:'flex',gap:8,marginBottom:16}}>
                  <div className="form-group" style={{marginBottom:0,flex:1}}><label>Emoji</label><input className="form-control" value={formEmoji} onChange={e=>setFormEmoji(e.target.value)} style={{fontSize:20,textAlign:'center'}}/></div>
                  <div className="form-group" style={{marginBottom:0,flex:4}}><label>Nome</label><input required className="form-control" value={formName} onChange={e=>setFormName(e.target.value)} placeholder="Ex: TV Samsung"/></div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div className="form-group"><label>Valor Total (R$)</label><input required className="form-control" type="number" step="0.01" value={formTotal} onChange={e=>setFormTotal(e.target.value)} placeholder="0,00"/></div>
                  <div className="form-group"><label>Valor da Parcela (R$)</label><input required className="form-control" type="number" step="0.01" value={formInstAmt} onChange={e=>setFormInstAmt(e.target.value)} placeholder="0,00"/></div>
                  <div className="form-group"><label>Parcela Atual</label><input required className="form-control" type="number" min="1" value={formCurrent} onChange={e=>setFormCurrent(e.target.value)}/></div>
                  <div className="form-group"><label>Total de Parcelas</label><input required className="form-control" type="number" min="1" value={formTotalInst} onChange={e=>setFormTotalInst(e.target.value)}/></div>
                </div>
                <div className="form-group"><label>Conta/Cartão</label><input className="form-control" value={formAccount} onChange={e=>setFormAccount(e.target.value)} placeholder="Nubank"/></div>
              </div>
              <div className="modal-footer">
                {editingItem&&<button type="button" className="btn btn-danger" onClick={del} style={{marginRight:'auto'}}>Excluir</button>}
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
