const $ = (s) => document.querySelector(s);
const token = localStorage.getItem('expenseToken');
const money = (n) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format((n||0)/100);
const api = async (url, options={}) => {
  const r = await fetch(url,{...options,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...(options.headers||{})}});
  const data = await r.json().catch(()=>({message:'Unexpected server response'}));
  if(!r.ok) throw new Error(data.message||'Request failed'); return data;
};
const today = new Date();
$('#month').value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
$('#transactionForm [name=date]').value = today.toISOString().slice(0,10);
function message(text){$('#message').textContent=text;}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function load(){
  try{
    if(!token){location.href='/';return;}
    const d=await api(`/api/personal/summary?month=${encodeURIComponent($('#month').value)}`);
    $('#income').textContent=money(d.totals.incomePaise);$('#expenses').textContent=money(d.totals.expensePaise);$('#savings').textContent=money(d.totals.savingsPaise);$('#available').textContent=money(d.totals.availablePaise);
    $('#budgetList').innerHTML=d.budgets.length?d.budgets.map(b=>{const pct=b.limitPaise?Math.min(100,Math.round(b.spentPaise/b.limitPaise*100)):0;return `<div class="budget-item"><div class="budget-item-head"><b>${escapeHtml(b.category)}${b.category==='Savings'?' · protected':''}</b><span>${money(b.spentPaise)} / ${money(b.limitPaise)}</span></div><div class="budget-track"><div class="budget-fill ${b.spentPaise>b.limitPaise?'over':''}" style="width:${pct}%"></div></div><small class="muted">${b.category==='Savings'?`Reserved target: ${money(b.limitPaise)}`:`${money(Math.max(0,b.limitPaise-b.spentPaise))} remaining`}</small></div>`}).join(''):'<p class="muted">No budget limits yet. Add a category limit above.</p>';
    $('#transactionList').innerHTML=d.transactions.length?d.transactions.map(t=>`<div class="transaction-row"><div class="transaction-meta"><b>${escapeHtml(t.title)}</b><small>${escapeHtml(t.category)} · ${new Date(t.date).toLocaleDateString('en-IN')}</small></div><strong class="${t.type==='income'?'income-amount':'expense-amount'}">${t.type==='income'?'+':'−'}${money(t.amountPaise)}</strong><button class="delete-transaction" data-delete="${t.id}" title="Delete transaction" aria-label="Delete transaction">×</button></div>`).join(''):'<p class="muted">No transactions recorded for this month.</p>';
  }catch(e){message(e.message);if(e.message.toLowerCase().includes('token'))location.href='/';}
}
$('#month').addEventListener('change',load);
$('#budgetForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await api('/api/personal/budgets',{method:'POST',body:JSON.stringify({month:$('#month').value,category:f.get('category'),amount:Number(f.get('amount'))})});e.currentTarget.reset();message('Budget limit saved.');await load();}catch(err){message(err.message)}});
$('#transactionForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await api('/api/personal/transactions',{method:'POST',body:JSON.stringify({title:f.get('title'),type:f.get('type'),category:f.get('category'),amount:Number(f.get('amount')),date:f.get('date')})});const date=f.get('date');e.currentTarget.reset();e.currentTarget.elements.date.value=date;message('Transaction added.');await load();}catch(err){message(err.message)}});
$('#transactionList').addEventListener('click',async e=>{const b=e.target.closest('[data-delete]');if(!b)return;if(!confirm('Delete this transaction?'))return;try{await api(`/api/personal/transactions/${b.dataset.delete}`,{method:'DELETE'});await load();}catch(err){message(err.message)}});
$('#logout').addEventListener('click',()=>{localStorage.removeItem('expenseToken');location.href='/'});
load();
