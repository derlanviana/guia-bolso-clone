import React, { useState } from 'react';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#22C55E','#3B82F6','#F97316','#8B5CF6','#EAB308','#EF4444','#06B6D4','#EC4899'];
const CATEGORY_ICONS = {
  'Alimentação':'🛒','Moradia':'🏠','Transporte':'🚗','Saúde':'💊','Lazer':'🎮',
  'Salário':'💰','Investimentos':'📈','Educação':'📚','Outros':'📦','Geral':'📋',
  'Transferências':'↔️','Supermercado':'🛒','Farmácia':'💊','Eletricidade':'⚡',
};

export default function Dashboard({ transactions, accounts, cards, subscriptions, formatCurrency, setPage }) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const prevMonth = (() => { const d = new Date(now.getFullYear(), now.getMonth()-1, 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; })();
  const monthName = now.toLocaleDateString('pt-BR',{month:'long'}).replace(/^\w/,c=>c.toUpperCase());

  const safe = Array.isArray(transactions) ? transactions : [];
  const monthTx = safe.filter(t => t?.date?.startsWith(currentMonth));
  const prevTx = safe.filter(t => t?.date?.startsWith(prevMonth));

  const income = monthTx.filter(t=>t.amount>0).reduce((a,b)=>a+b.amount,0);
  const expense = monthTx.filter(t=>t.amount<0).reduce((a,b)=>a+Math.abs(b.amount),0);
  const prevExpense = prevTx.filter(t=>t.amount<0).reduce((a,b)=>a+Math.abs(b.amount),0);
  const pctChange = prevExpense > 0 ? ((expense - prevExpense) / prevExpense * 100).toFixed(0) : 0;

  const accountBalance = (Array.isArray(accounts) ? accounts : []).reduce((a,b)=>a+b.balance,0);
  const totalLimit = (Array.isArray(cards) ? cards : []).reduce((a,b)=>a+(b.card_limit||0),0);
  const usedLimit = (Array.isArray(cards) ? cards : []).reduce((a,b)=>a+(b.used_amount||0),0);
  const available = totalLimit - usedLimit;

  // Category breakdown
  const catMap = {};
  monthTx.filter(t=>t.amount<0).forEach(t => { const c = t.category||'Outros'; catMap[c]=(catMap[c]||0)+Math.abs(t.amount); });
  const topCats = Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const prevCatMap = {};
  prevTx.filter(t=>t.amount<0).forEach(t => { const c = t.category||'Outros'; prevCatMap[c]=(prevCatMap[c]||0)+Math.abs(t.amount); });

  // Spending rhythm chart (daily)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const dailyData = Array.from({length: daysInMonth}, (_,i) => {
    const day = i + 1;
    const dayStr = `${currentMonth}-${String(day).padStart(2,'0')}`;
    const spent = monthTx.filter(t=>t.date?.startsWith(dayStr) && t.amount<0).reduce((a,b)=>a+Math.abs(b.amount),0);
    const prevDay = prevTx.filter(t=>t.date?.slice(8,10)===String(day).padStart(2,'0') && t.amount<0).reduce((a,b)=>a+Math.abs(b.amount),0);
    return { day, atual: spent, anterior: prevDay };
  });

  // Heatmap (30 days)
  const heatCells = Array.from({length:30},(_,i)=>{
    const d = new Date(now.getFullYear(), now.getMonth(), i+1);
    const str = d.toISOString().split('T')[0];
    const amt = safe.filter(t=>t.date?.startsWith(str)&&t.amount<0).reduce((a,b)=>a+Math.abs(b.amount),0);
    return { day: i+1, amt };
  });
  const maxDay = Math.max(...heatCells.map(c=>c.amt), 1);

  const recent = [...safe].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
  const safeSubs = Array.isArray(subscriptions) ? subscriptions : [];
  const subTotal = safeSubs.reduce((a,b)=>a+b.amount,0);

  const maxSpend = heatCells.reduce((a,b)=>b.amt>a.amt?b:a, {day:0,amt:0});

  return (
    <div className="page">
      <div className="grid-2" style={{marginBottom:16}}>
        {/* Insight card */}
        <div className="insight-card">
          <div className="insight-title">Seu dinheiro está te esperando para uma conversa.</div>
          <div className="insight-text">
            {expense > prevExpense
              ? `Você gastou ${Math.abs(pctChange)}% a mais que o mês anterior. Que tal revisar suas despesas?`
              : `Ótimo! Você reduziu seus gastos em ${Math.abs(pctChange)}% em relação ao mês anterior.`}
          </div>
          <div className="insight-stats">
            <div className="insight-stat">
              <label>Gasto em {monthName}</label>
              <div className="val">{formatCurrency(expense)}</div>
            </div>
            <div className="insight-stat">
              <label>vs. mês anterior</label>
              <div className="val" style={{color: expense <= prevExpense ? 'var(--green)' : 'var(--red)'}}>
                {expense <= prevExpense ? '▼' : '▲'} {Math.abs(pctChange)}%
              </div>
            </div>
            <div className="insight-stat">
              <label>Maior gasto</label>
              <div className="val" style={{color:'var(--orange)'}}>
                {topCats[0] ? topCats[0][0] : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Spending rhythm */}
        <div className="card">
          <div className="card-body">
            <div className="section-header" style={{marginBottom:8}}>
              <div>
                <div className="card-title">Ritmo de Gastos</div>
                <div style={{fontSize:22,fontWeight:700}}>{formatCurrency(expense)}</div>
                <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
                  <span style={{color: expense<=prevExpense?'var(--green)':'var(--red)'}}>{expense<=prevExpense?'▼':'▲'} {Math.abs(pctChange)}%</span>
                  {' '}vs {formatCurrency(prevExpense)} mês anterior
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={()=>setPage('transacoes')}>ver todas ↗</button>
            </div>
            <div style={{height:120}}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <XAxis dataKey="day" hide />
                  <Tooltip formatter={(v)=>formatCurrency(v)} labelFormatter={(l)=>`Dia ${l}`} contentStyle={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,fontSize:12}}/>
                  <Line type="monotone" dataKey="atual" stroke="#22C55E" dot={false} strokeWidth={2} name="Este mês"/>
                  <Line type="monotone" dataKey="anterior" stroke="#555" dot={false} strokeWidth={1.5} strokeDasharray="4 4" name="Mês passado"/>
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{display:'flex',gap:16,fontSize:12,color:'var(--text-muted)',marginTop:8}}>
              <span><span style={{color:'var(--green)'}}>—</span> Este mês</span>
              <span><span style={{color:'#555'}}>- -</span> Mês passado</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{marginBottom:16}}>
        {/* Contas */}
        <div className="card">
          <div className="card-body">
            <div className="section-header">
              <div>
                <div className="card-title">Contas Correntes</div>
                <div style={{fontSize:22,fontWeight:700,marginTop:4}}>{formatCurrency(accountBalance)} <span style={{fontSize:14,color:'var(--text-muted)',fontWeight:400}}>saldo total</span></div>
              </div>
            </div>
            {(Array.isArray(accounts)?accounts:[]).slice(0,3).map(acc=>(
              <div className="list-item" key={acc.id}>
                <div className="item-icon" style={{background:'#1a0033',color:'white',fontWeight:700,fontSize:13}}>
                  {acc.name?.slice(0,2).toUpperCase()}
                </div>
                <div className="item-info">
                  <div className="item-name">{acc.name}</div>
                  <div className="item-sub">{acc.number||'Conta manual'}</div>
                </div>
                <div className="item-amount">{formatCurrency(acc.balance||0)}</div>
              </div>
            ))}
            {(Array.isArray(accounts)?accounts:[]).length === 0 && <p style={{color:'var(--text-muted)',fontSize:13}}>Nenhuma conta.</p>}
          </div>
        </div>

        {/* Limite total */}
        <div className="card">
          <div className="card-body">
            <div className="section-header">
              <div>
                <div className="card-title">Limite Total Disponível</div>
                <div style={{fontSize:22,fontWeight:700,marginTop:4,color: available<0?'var(--red)':'var(--text)'}}>
                  {formatCurrency(available)}
                </div>
                <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>de {formatCurrency(totalLimit)} de limite total</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={()=>setPage('cartoes')}>ver detalhes ↗</button>
            </div>
            {(Array.isArray(cards)?cards:[]).map(card=>(
              <div className="list-item" key={card.id}>
                <div className="item-icon" style={{background:'var(--purple-bg)',fontSize:18}}>💳</div>
                <div className="item-info">
                  <div className="item-name">{card.name}</div>
                  <div className="item-sub">••••{card.last_digits} · Vence {card.due_date ? new Date(card.due_date).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) : '—'}</div>
                </div>
                <div className="item-amount" style={{color:'var(--red)'}}>{formatCurrency(-(card.used_amount||0)-(card.card_limit||0)+( card.card_limit||0))} {formatCurrency(available)}</div>
              </div>
            ))}
            {(Array.isArray(cards)?cards:[]).length===0 && <p style={{color:'var(--text-muted)',fontSize:13}}>Nenhum cartão.</p>}
          </div>
        </div>
      </div>

      <div className="grid-2" style={{marginBottom:16}}>
        {/* Mapa de calor */}
        <div className="card">
          <div className="card-body">
            <div className="section-header">
              <div>
                <div className="card-title">Mapa de Calor</div>
                <div style={{fontSize:22,fontWeight:700,marginTop:4}}>{formatCurrency(expense)}</div>
                <div style={{fontSize:12,color:'var(--text-muted)'}}>Média diária: {formatCurrency(expense / Math.max(now.getDate(),1))}</div>
              </div>
            </div>
            <div className="heatmap">
              {heatCells.map(c=>{
                const ratio = c.amt / maxDay;
                const cls = c.amt===0?'':ratio>0.7?'high':ratio>0.3?'mid':'low';
                return <div key={c.day} className={`heatmap-cell ${cls}`} title={`Dia ${c.day}: ${formatCurrency(c.amt)}`}>{c.day}</div>;
              })}
            </div>
            {maxSpend.amt>0 && <div style={{marginTop:8,fontSize:12,color:'var(--text-muted)'}}>Maior gasto: <span style={{color:'var(--red)',fontWeight:600}}>{formatCurrency(maxSpend.amt)}</span> dia {maxSpend.day}</div>}
          </div>
        </div>

        {/* Principais categorias */}
        <div className="card">
          <div className="card-body">
            <div className="section-header">
              <div className="card-title">Principais Categorias</div>
              <button className="btn btn-ghost btn-sm" onClick={()=>setPage('categorias')}>ver mais ↗</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'auto 1fr auto auto auto',gap:'8px 12px',alignItems:'center',fontSize:13}}>
              <span style={{fontSize:11,color:'var(--text-dim)'}}>Categoria</span>
              <span></span>
              <span style={{fontSize:11,color:'var(--text-dim)'}}>Atual</span>
              <span style={{fontSize:11,color:'var(--text-dim)'}}>Variação</span>
              <span style={{fontSize:11,color:'var(--text-dim)'}}>Anterior</span>
              {topCats.map(([cat,amt],i)=>{
                const prev = prevCatMap[cat]||0;
                const diff = prev>0?((amt-prev)/prev*100).toFixed(0):null;
                return (
                  <React.Fragment key={cat}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:10,height:10,borderRadius:'50%',background:COLORS[i],flexShrink:0}}/>
                      <span>{CATEGORY_ICONS[cat]||'📦'}</span>
                    </div>
                    <span style={{color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{cat}</span>
                    <span style={{fontWeight:600}}>{formatCurrency(amt)}</span>
                    {diff!=null?<span className={`badge ${parseInt(diff)<=0?'green':'red'}`}>{parseInt(diff)<=0?'▼':'▲'}{Math.abs(diff)}%</span>:<span className="badge gray">—</span>}
                    <span style={{color:'var(--text-muted)'}}>{formatCurrency(prev)}</span>
                  </React.Fragment>
                );
              })}
              {topCats.length===0&&<div style={{gridColumn:'1/-1',color:'var(--text-muted)',fontSize:13}}>Sem despesas este mês.</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Transações recentes */}
        <div className="card">
          <div className="card-body">
            <div className="section-header">
              <div className="card-title">Transações Recentes</div>
              <button className="btn btn-ghost btn-sm" onClick={()=>setPage('transacoes')}>ver todas ↗</button>
            </div>
            {recent.length===0 ? <div className="empty-state" style={{padding:24}}><p>Sem transações.</p></div>
            : recent.map(tx=>(
              <div className="list-item" key={tx.id}>
                <div className="item-icon">{CATEGORY_ICONS[tx.category]||'📋'}</div>
                <div className="item-info">
                  <div className="item-name">{tx.description?.split(' | ')[0]}</div>
                  <div className="item-sub">
                    <span className="badge gray" style={{marginRight:6}}>{tx.category}</span>
                    {new Date(tx.date).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}
                  </div>
                </div>
                <div className={`item-amount ${tx.amount>0?'income':'expense'}`}>
                  {tx.amount>0?'+':''}{formatCurrency(tx.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Assinaturas */}
        <div className="card">
          <div className="card-body">
            <div className="section-header">
              <div>
                <div className="card-title">Assinaturas</div>
                <div style={{fontSize:22,fontWeight:700,marginTop:4}}>{formatCurrency(subTotal)} <span style={{fontSize:13,fontWeight:400,color:'var(--text-muted)'}}>/mês · {safeSubs.length} ativas</span></div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={()=>setPage('assinaturas')}>ver todas ↗</button>
            </div>
            {safeSubs.slice(0,4).map(sub=>(
              <div className="list-item" key={sub.id}>
                <div className="item-icon">{sub.icon_emoji||'📱'}</div>
                <div className="item-info">
                  <div className="item-name">{sub.name}</div>
                  <div className="item-sub">
                    {sub.next_payment ? `Próximo: ${new Date(sub.next_payment).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}` : ''} · {sub.account_name}
                  </div>
                </div>
                <div className="item-amount" style={{color:'var(--text)'}}>{formatCurrency(sub.amount)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
