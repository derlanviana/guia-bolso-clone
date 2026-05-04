import React from 'react';

const COLORS = ['#22C55E','#3B82F6','#F97316','#8B5CF6','#EAB308','#EF4444','#06B6D4','#EC4899'];
const ICONS = {'Alimentação':'🛒','Moradia':'🏠','Transporte':'🚗','Saúde':'💊','Lazer':'🎮','Salário':'💰','Investimentos':'📈','Educação':'📚','Outros':'📦','Geral':'📋','Transferências':'↔️'};

export default function Categorias({ transactions, formatCurrency }) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const prevMonth = (() => { const d = new Date(now.getFullYear(), now.getMonth()-1, 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; })();

  const safe = Array.isArray(transactions) ? transactions : [];
  const monthTx = safe.filter(t=>t?.date?.startsWith(currentMonth)&&t.amount<0);
  const prevTx = safe.filter(t=>t?.date?.startsWith(prevMonth)&&t.amount<0);

  const buildCatMap = (txList) => {
    const map = {};
    txList.forEach(t=>{ const c=t.category||'Outros'; map[c]=(map[c]||0)+Math.abs(t.amount); });
    return map;
  };

  const catMap = buildCatMap(monthTx);
  const prevMap = buildCatMap(prevTx);
  const total = Object.values(catMap).reduce((a,b)=>a+b,0);
  const cats = Object.entries(catMap).sort((a,b)=>b[1]-a[1]);

  return (
    <div className="page">
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:22,fontWeight:700,marginBottom:4}}>Categorias</h1>
        <p style={{color:'var(--text-muted)',fontSize:14}}>Distribuição de gastos — {now.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</p>
      </div>

      <div className="grid-2" style={{marginBottom:16}}>
        <div className="card">
          <div className="card-body">
            <div className="card-title">Total de Despesas</div>
            <div style={{fontSize:28,fontWeight:700,color:'var(--red)',marginBottom:16}}>{formatCurrency(total)}</div>
            {cats.map(([cat,amt],i)=>{
              const pct = total>0?(amt/total*100):0;
              const prev = prevMap[cat]||0;
              const diff = prev>0?((amt-prev)/prev*100):null;
              return (
                <div key={cat} style={{marginBottom:16}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                    <div style={{width:12,height:12,borderRadius:'50%',background:COLORS[i%COLORS.length],flexShrink:0}}/>
                    <span style={{fontSize:16}}>{ICONS[cat]||'📦'}</span>
                    <span style={{flex:1,fontSize:14,fontWeight:500}}>{cat}</span>
                    <span style={{fontWeight:700,fontSize:15}}>{formatCurrency(amt)}</span>
                    {diff!==null&&<span className={`badge ${parseInt(diff)<=0?'green':'red'}`}>{parseInt(diff)<=0?'▼':'▲'}{Math.abs(diff).toFixed(0)}%</span>}
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{width:`${Math.min(pct,100)}%`,background:COLORS[i%COLORS.length]}}/>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text-muted)',marginTop:4}}>
                    <span>{pct.toFixed(0)}% do total</span>
                    {prev>0&&<span>vs {formatCurrency(prev)} mês anterior</span>}
                  </div>
                </div>
              );
            })}
            {cats.length===0&&<div className="empty-state" style={{padding:32}}><div className="icon">🏷️</div><h3>Sem despesas este mês</h3></div>}
          </div>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          {/* Receitas */}
          <div className="card">
            <div className="card-body">
              <div className="card-title" style={{marginBottom:12}}>Receitas por Categoria</div>
              {(() => {
                const incMap = {};
                safe.filter(t=>t?.date?.startsWith(currentMonth)&&t.amount>0).forEach(t=>{const c=t.category||'Outros';incMap[c]=(incMap[c]||0)+t.amount;});
                const incTotal = Object.values(incMap).reduce((a,b)=>a+b,0);
                const incCats = Object.entries(incMap).sort((a,b)=>b[1]-a[1]);
                if(incCats.length===0) return <p style={{color:'var(--text-muted)',fontSize:13}}>Sem receitas este mês.</p>;
                return incCats.map(([cat,amt],i)=>(
                  <div key={cat} style={{marginBottom:12}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                      <span>{ICONS[cat]||'💰'}</span>
                      <span style={{flex:1,fontSize:13}}>{cat}</span>
                      <span style={{fontWeight:600,color:'var(--green)'}}>{formatCurrency(amt)}</span>
                    </div>
                    <div className="progress-bar"><div className="progress-fill green" style={{width:`${incTotal>0?amt/incTotal*100:0}%`}}/></div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Month compare */}
          <div className="card">
            <div className="card-body">
              <div className="card-title" style={{marginBottom:12}}>Comparativo Mensal</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div style={{padding:16,background:'var(--surface-2)',borderRadius:8,textAlign:'center'}}>
                  <div style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',marginBottom:4}}>Este mês</div>
                  <div style={{fontSize:20,fontWeight:700,color:'var(--red)'}}>{formatCurrency(total)}</div>
                </div>
                <div style={{padding:16,background:'var(--surface-2)',borderRadius:8,textAlign:'center'}}>
                  <div style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',marginBottom:4}}>Mês anterior</div>
                  <div style={{fontSize:20,fontWeight:700,color:'var(--text-muted)'}}>{formatCurrency(Object.values(prevMap).reduce((a,b)=>a+b,0))}</div>
                </div>
              </div>
              {total > 0 && Object.values(prevMap).reduce((a,b)=>a+b,0) > 0 && (
                <div style={{marginTop:12,padding:12,background:total<=Object.values(prevMap).reduce((a,b)=>a+b,0)?'var(--green-bg)':'var(--red-bg)',borderRadius:8,textAlign:'center'}}>
                  <span style={{color:total<=Object.values(prevMap).reduce((a,b)=>a+b,0)?'var(--green)':'var(--red)',fontWeight:600,fontSize:14}}>
                    {total<=Object.values(prevMap).reduce((a,b)=>a+b,0)?'▼ Você gastou menos este mês!':'▲ Você gastou mais este mês'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
