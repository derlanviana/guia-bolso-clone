import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Assinaturas({ subscriptions, setSubscriptions, formatCurrency }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formNext, setFormNext] = useState('');
  const [formAccount, setFormAccount] = useState('Nubank');
  const [formEmoji, setFormEmoji] = useState('📱');

  const safe = Array.isArray(subscriptions) ? subscriptions : [];
  const monthly = safe.reduce((a,b)=>a+b.amount,0);
  const annual = monthly * 12;
  const avg = safe.length > 0 ? monthly / safe.length : 0;

  const openModal = (item=null) => {
    if (item) {
      setEditingItem(item); setFormName(item.name); setFormDesc(item.description||'');
      setFormAmount(item.amount?.toString()||''); setFormNext(item.next_payment||'');
      setFormAccount(item.account_name||'Nubank'); setFormEmoji(item.icon_emoji||'📱');
    } else {
      setEditingItem(null); setFormName(''); setFormDesc(''); setFormAmount(''); setFormNext('');
      setFormAccount('Nubank'); setFormEmoji('📱');
    }
    setIsModalOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    const row = {name:formName,description:formDesc,amount:parseFloat(formAmount)||0,next_payment:formNext||null,account_name:formAccount,icon_emoji:formEmoji};
    if (editingItem) {
      await supabase.from('subscriptions').update(row).eq('id',editingItem.id);
      setSubscriptions(safe.map(s=>s.id===editingItem.id?{...s,...row}:s));
    } else {
      const newRow = {...row,id:Math.random().toString(36).substring(7),payment_count:0};
      await supabase.from('subscriptions').insert([newRow]);
      setSubscriptions([...safe,newRow]);
    }
    setIsModalOpen(false);
  };

  const del = async () => {
    if (!editingItem||!window.confirm('Excluir?')) return;
    await supabase.from('subscriptions').delete().eq('id',editingItem.id);
    setSubscriptions(safe.filter(s=>s.id!==editingItem.id));
    setIsModalOpen(false);
  };

  return (
    <div className="page">
      {/* Summary */}
      <div className="card" style={{marginBottom:24}}>
        <div className="card-body">
          <div style={{display:'flex',gap:48,flexWrap:'wrap',alignItems:'flex-end'}}>
            <div>
              <div style={{fontSize:12,color:'var(--text-muted)',textTransform:'uppercase',marginBottom:4}}>Assinaturas</div>
              <div style={{fontSize:40,fontWeight:700}}>{safe.length}</div>
              <div style={{fontSize:12,color:'var(--text-muted)'}}>ativas</div>
            </div>
            <div>
              <div style={{fontSize:12,color:'var(--text-muted)',textTransform:'uppercase',marginBottom:4}}>Gasto Mensal</div>
              <div style={{fontSize:28,fontWeight:700,color:'var(--text)'}}>{formatCurrency(monthly)}</div>
            </div>
            <div>
              <div style={{fontSize:12,color:'var(--text-muted)',textTransform:'uppercase',marginBottom:4}}>Projeção Anual</div>
              <div style={{fontSize:28,fontWeight:700,color:'var(--orange)'}}>{formatCurrency(annual)}</div>
            </div>
            <div>
              <div style={{fontSize:12,color:'var(--text-muted)',textTransform:'uppercase',marginBottom:4}}>Média/Serviço</div>
              <div style={{fontSize:28,fontWeight:700,color:'var(--blue)'}}>{formatCurrency(avg)}</div>
            </div>
            <div style={{marginLeft:'auto'}}>
              <button className="btn btn-primary" onClick={()=>openModal()}>+ Adicionar</button>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="card">
        {safe.length===0 ? (
          <div className="empty-state"><div className="icon">📅</div><h3>Nenhuma assinatura cadastrada</h3><p>Adicione suas assinaturas para controlar os gastos recorrentes.</p><button className="btn btn-primary" style={{marginTop:16}} onClick={()=>openModal()}>+ Adicionar</button></div>
        ) : safe.map(sub=>(
          <div className="list-item" key={sub.id} style={{padding:'16px 20px'}}>
            <div className="item-icon" style={{fontSize:24,background:'var(--surface-2)',borderRadius:12}}>{sub.icon_emoji||'📱'}</div>
            <div className="item-info">
              <div className="item-name" style={{fontSize:15,fontWeight:600}}>{sub.name}</div>
              <div className="item-sub">
                {sub.description && <span>{sub.description} · </span>}
                {sub.next_payment && <span>📅 Próximo: {new Date(sub.next_payment).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})} · </span>}
                {sub.payment_count>0&&<span>{sub.payment_count} pagamentos · </span>}
                <span>💳 {sub.account_name}</span>
              </div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:16,fontWeight:700}}>{formatCurrency(sub.amount)}</div>
              <div style={{fontSize:12,color:'var(--text-muted)'}}>/mês</div>
            </div>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>openModal(sub)} title="Editar" style={{marginLeft:8}}>✏️</button>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={()=>setIsModalOpen(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-head"><h3>{editingItem?'Editar':'Nova Assinatura'}</h3><button className="modal-close" onClick={()=>setIsModalOpen(false)}>×</button></div>
            <form onSubmit={save}>
              <div className="modal-body">
                <div style={{display:'flex',gap:8,marginBottom:16}}>
                  <div className="form-group" style={{marginBottom:0,flex:1}}><label>Emoji</label><input className="form-control" value={formEmoji} onChange={e=>setFormEmoji(e.target.value)} style={{fontSize:20,textAlign:'center'}}/></div>
                  <div className="form-group" style={{marginBottom:0,flex:4}}><label>Nome</label><input required className="form-control" value={formName} onChange={e=>setFormName(e.target.value)} placeholder="Ex: Netflix"/></div>
                </div>
                <div className="form-group"><label>Descrição</label><input className="form-control" value={formDesc} onChange={e=>setFormDesc(e.target.value)} placeholder="Ex: Netflix Standard"/></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div className="form-group"><label>Valor/mês (R$)</label><input required className="form-control" type="number" step="0.01" value={formAmount} onChange={e=>setFormAmount(e.target.value)} placeholder="0,00"/></div>
                  <div className="form-group"><label>Próximo vencimento</label><input className="form-control" type="date" value={formNext} onChange={e=>setFormNext(e.target.value)}/></div>
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
