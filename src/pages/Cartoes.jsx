import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { supabase } from '../supabaseClient';

export default function Cartoes({ cards, setCards, transactions, formatCurrency }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formName, setFormName] = useState('');
  const [formDigits, setFormDigits] = useState('');
  const [formLimit, setFormLimit] = useState('');
  const [formUsed, setFormUsed] = useState('');
  const [formClosing, setFormClosing] = useState('1');
  const [formDue, setFormDue] = useState('');
  const [formAccount, setFormAccount] = useState('');
  const [formColor, setFormColor] = useState('#8B5CF6');

  const safe = Array.isArray(cards) ? cards : [];
  const totalInvoice = safe.reduce((a,b)=>a+(b.used_amount||0),0);

  // Historical billing data (last 6 months from transactions per card-like amounts)
  const now = new Date();
  const histData = Array.from({length:6},(_,i)=>{
    const d = new Date(now.getFullYear(), now.getMonth()-5+i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = d.toLocaleDateString('pt-BR',{month:'short'}).replace('.','');
    const amt = (Array.isArray(transactions)?transactions:[]).filter(t=>t?.date?.startsWith(key)&&t.amount<0).reduce((a,b)=>a+Math.abs(b.amount),0);
    const isCurrent = i===5;
    return {label,amt,isCurrent};
  });

  const openModal = (item=null) => {
    if(item){setEditingItem(item);setFormName(item.name);setFormDigits(item.last_digits||'');setFormLimit(item.card_limit?.toString()||'');setFormUsed(item.used_amount?.toString()||'');setFormClosing(item.closing_day?.toString()||'1');setFormDue(item.due_date||'');setFormAccount(item.account_name||'');setFormColor(item.color||'#8B5CF6');}
    else{setEditingItem(null);setFormName('');setFormDigits('');setFormLimit('');setFormUsed('');setFormClosing('1');setFormDue('');setFormAccount('');setFormColor('#8B5CF6');}
    setIsModalOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    const row = {name:formName,last_digits:formDigits,card_limit:parseFloat(formLimit)||0,used_amount:parseFloat(formUsed)||0,closing_day:parseInt(formClosing)||1,due_date:formDue||null,account_name:formAccount,color:formColor};
    if(editingItem){
      await supabase.from('cards').update(row).eq('id',editingItem.id);
      setCards(safe.map(c=>c.id===editingItem.id?{...c,...row}:c));
    }else{
      const newRow={...row,id:Math.random().toString(36).substring(7)};
      await supabase.from('cards').insert([newRow]);
      setCards([...safe,newRow]);
    }
    setIsModalOpen(false);
  };

  const del = async () => {
    if(!editingItem||!window.confirm('Excluir cartão?'))return;
    await supabase.from('cards').delete().eq('id',editingItem.id);
    setCards(safe.filter(c=>c.id!==editingItem.id));
    setIsModalOpen(false);
  };

  return (
    <div className="page">
      {/* Hero */}
      <div className="card-hero">
        <div className="card-hero-label">📄 Fatura atual</div>
        <div className="card-hero-value">{formatCurrency(totalInvoice)}</div>
      </div>

      <div style={{marginBottom:20,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <h2 style={{fontSize:16,fontWeight:600}}>Seus cartões ({safe.length})</h2>
        <button className="btn btn-primary" onClick={()=>openModal()}>+ Adicionar cartão</button>
      </div>

      {/* Cards list */}
      {safe.length===0 ? (
        <div className="empty-state"><div className="icon">💳</div><h3>Nenhum cartão cadastrado</h3><p>Adicione seus cartões para controlar os limites e faturas.</p><button className="btn btn-primary" style={{marginTop:16}} onClick={()=>openModal()}>+ Adicionar</button></div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:20}}>
          {safe.map(card=>{
            const used = card.used_amount||0;
            const limit = card.card_limit||1;
            const avail = limit - used;
            const pct = Math.min((used/limit)*100, 100);
            const isOver = used > limit;
            return (
              <div key={card.id}>
                <div className="grid-2" style={{gap:20,alignItems:'start'}}>
                  {/* Card visual */}
                  <div className="credit-card" style={{background:`linear-gradient(135deg, #1a0033 0%, ${card.color||'#8B5CF6'} 100%)`,minHeight:180}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',marginBottom:32}}>
                      <div style={{width:36,height:36,borderRadius:8,background:card.color||'#8B5CF6',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'white',fontSize:13}}>
                        {card.name?.slice(0,2).toUpperCase()}
                      </div>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>openModal(card)} style={{color:'rgba(255,255,255,0.6)',borderColor:'rgba(255,255,255,0.2)'}}>✏️</button>
                    </div>
                    <div style={{fontSize:18,fontWeight:700,color:'white',marginBottom:4}}>{card.name}</div>
                    <div style={{fontSize:13,color:'rgba(255,255,255,0.6)',marginBottom:16}}>•••• {card.last_digits} · Vence {card.due_date?new Date(card.due_date).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}):'—'}</div>
                    <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginBottom:2}}>Fatura atual</div>
                    <div style={{fontSize:24,fontWeight:700,color:'white'}}>{formatCurrency(used)}</div>
                    <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginTop:2}}>Fecha dia {card.closing_day} ✏️</div>
                    <div className="limit-bar-wrap">
                      <div className="limit-bar">
                        <div className="limit-bar-fill" style={{width:`${pct}%`,background:isOver?'var(--red)':'var(--orange)'}}/>
                      </div>
                      <div className="limit-row">
                        <span>Limite total: {formatCurrency(limit)}</span>
                      </div>
                      <div className="limit-row">
                        <span style={{color:'var(--orange)'}}>Usado: {formatCurrency(used)}</span>
                        <span style={{color:isOver?'var(--red)':'var(--green)'}}>Disponível: {formatCurrency(avail)}</span>
                      </div>
                    </div>
                  </div>

                  {/* History chart */}
                  <div className="card">
                    <div className="card-body">
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                        <div className="card-title">Faturas anteriores</div>
                        <span style={{fontSize:13,fontWeight:600}}>{now.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</span>
                      </div>
                      <div style={{height:180}}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={histData} barSize={28}>
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill:'var(--text-muted)',fontSize:11}}/>
                            <YAxis hide/>
                            <Tooltip formatter={v=>formatCurrency(v)} contentStyle={{background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:8,fontSize:12}} labelStyle={{color:'var(--text)'}}/>
                            <Bar dataKey="amt" radius={[4,4,0,0]}>
                              {histData.map((entry,i)=>(
                                <Cell key={i} fill={entry.isCurrent?'white':'var(--surface-3)'}/>
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen&&(
        <div className="modal-overlay" onClick={()=>setIsModalOpen(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-head"><h3>{editingItem?'Editar':'Novo Cartão'}</h3><button className="modal-close" onClick={()=>setIsModalOpen(false)}>×</button></div>
            <form onSubmit={save}>
              <div className="modal-body">
                <div className="form-group"><label>Nome do Cartão</label><input required className="form-control" value={formName} onChange={e=>setFormName(e.target.value)} placeholder="Ex: Nubank Ultraviolet"/></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div className="form-group"><label>4 últimos dígitos</label><input className="form-control" maxLength={4} value={formDigits} onChange={e=>setFormDigits(e.target.value)} placeholder="0000"/></div>
                  <div className="form-group"><label>Cor</label><input className="form-control" type="color" value={formColor} onChange={e=>setFormColor(e.target.value)} style={{height:42,cursor:'pointer',padding:4}}/></div>
                  <div className="form-group"><label>Limite Total (R$)</label><input className="form-control" type="number" step="0.01" value={formLimit} onChange={e=>setFormLimit(e.target.value)} placeholder="0,00"/></div>
                  <div className="form-group"><label>Fatura Atual (R$)</label><input className="form-control" type="number" step="0.01" value={formUsed} onChange={e=>setFormUsed(e.target.value)} placeholder="0,00"/></div>
                  <div className="form-group"><label>Dia de Fechamento</label><input className="form-control" type="number" min="1" max="31" value={formClosing} onChange={e=>setFormClosing(e.target.value)}/></div>
                  <div className="form-group"><label>Vencimento</label><input className="form-control" type="date" value={formDue} onChange={e=>setFormDue(e.target.value)}/></div>
                </div>
                <div className="form-group"><label>Conta Vinculada</label><input className="form-control" value={formAccount} onChange={e=>setFormAccount(e.target.value)} placeholder="Nubank"/></div>
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
