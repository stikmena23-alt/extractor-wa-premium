// Año en footer
document.getElementById('y').textContent = new Date().getFullYear();

// Utilidades formato
const fmtCOP = (n)=> new Intl.NumberFormat('es-CO').format(n);
const parseDigits = (str)=> Number((str||'').toString().replace(/\D+/g,'') || 0);

const CREDITO_VALOR = 10000;

// Modal "Cómo funciona"
const howBtn = document.getElementById('openHowWorks');
const howModal = document.getElementById('howWorksModal');
howBtn?.addEventListener('click', () => howModal.showModal());

// Modal Detalles
const detailsModal = document.getElementById('detailsModal');
const detailsTitle = document.getElementById('detailsTitle');
const detailsBody = document.getElementById('detailsBody');

const detailsMap = {
  'Mini': { title: 'Paquete Mini – Detalles',
    body: ['Precio: $100,000 COP','Incluye: 10 créditos + 1 de regalo (11 en total)','Ahorro equivalente: $10,000','Ideal para empezar.'] },
  'Inicial': { title: 'Paquete Inicial – Detalles',
    body: ['Precio: $300,000 COP','Incluye: 30 créditos + 3 de regalo (33 en total)','Ahorro equivalente: $30,000','Ideal para comenzar en WF TOOLS con margen extra.'] },
  'Pro': { title: 'Paquete Pro – Detalles',
    body: ['Precio: $500,000 COP','Incluye: 50 créditos + 10 de regalo (60 en total)','Ahorro equivalente: $100,000','Uso continuo en WF TOOLS con equilibrio costo/volumen.'] },
  'Plus': { title: 'Paquete Plus – Detalles',
    body: ['Precio: $700,000 COP','Incluye: 70 créditos + 14 de regalo (84 en total)','Ahorro equivalente: $140,000','Excelente para operación diaria.'] },
  'Premium': { title: 'Paquete Premium – Detalles',
    body: ['Precio: $1,000,000 COP','Incluye: 100 créditos + 30 de regalo (130 en total)','Ahorro equivalente: $300,000','Máximo poder al mejor precio.'] },
  'Titán': { title: 'Paquete Titán – Detalles',
    body: ['Precio: $2,000,000 COP','Incluye: 200 créditos + 80 de regalo (280 en total)','Ahorro equivalente: $800,000','Para equipos grandes y alta demanda.'] }
};

document.querySelectorAll('[data-details]').forEach(btn => {
  btn.addEventListener('click', () => {
    const plan = btn.getAttribute('data-details');
    const info = detailsMap[plan] || { title: 'Detalles del plan', body: [] };
    detailsTitle.textContent = info.title;
    detailsBody.innerHTML = '<ul>' + info.body.map(x => `<li>${x}</li>`).join('') + '</ul>';
    detailsModal.showModal();
  });
});

// Modal Checkout (simulado)
const checkoutModal = document.getElementById('checkoutModal');
const checkoutText = document.getElementById('checkoutText');
const checkoutAction = document.getElementById('checkoutAction');

document.querySelectorAll('[data-plan]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const plan = link.getAttribute('data-plan');
    const amount = +link.getAttribute('data-amount');
    const credits = +link.getAttribute('data-credits');
    const waMsg = encodeURIComponent(`Hola, quiero comprar el plan ${plan} por $${fmtCOP(amount)} (${fmtCOP(credits)} créditos).`);
    checkoutText.textContent = `Plan ${plan}: $${fmtCOP(amount)} · ${fmtCOP(credits)} créditos`;
    checkoutAction.href = `https://wa.me/573126461216?text=${waMsg}`;
    checkoutAction.textContent = 'Pagar por WhatsApp';
    checkoutModal.showModal();
  });
});

// Tema (oscuro/clarito)
const toggleTheme = document.getElementById('toggleTheme');
toggleTheme?.addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme !== 'light';
  document.documentElement.dataset.theme = dark ? 'light' : 'dark';
  toggleTheme.setAttribute('aria-pressed', String(!dark));
});

// Mostrar/Ocultar MÁS PLANES (bloque inferior)
const morePlans   = document.getElementById('morePlans');
const moreDivider = document.getElementById('moreDivider');
const toggleMore  = document.getElementById('toggleMore');

toggleMore?.addEventListener('click', () => {
  const isHidden = morePlans.hasAttribute('hidden');
  if (isHidden) {
    morePlans.removeAttribute('hidden');
    moreDivider.removeAttribute('hidden');
    toggleMore.textContent = 'Ver menos planes';
    toggleMore.setAttribute('data-state','less');
    morePlans.scrollIntoView({ behavior:'smooth', block:'start' });
  } else {
    morePlans.setAttribute('hidden','');
    moreDivider.setAttribute('hidden','');
    toggleMore.textContent = 'Ver más planes';
    toggleMore.setAttribute('data-state','more');
    toggleMore.scrollIntoView({ behavior:'smooth', block:'center' });
  }
});

/* =========================
   Personaliza tu plan
   ========================= */
const modeButtons = document.querySelectorAll('.seg-btn');
const byCreditsRow = document.querySelector('.by-credits');
const byAmountRow  = document.querySelector('.by-amount');
const creditsInput = document.getElementById('creditsInput');
const amountInput  = document.getElementById('amountInput');

const rBase  = document.getElementById('rBase');
const rBonus = document.getElementById('rBonus');
const rTotal = document.getElementById('rTotal');
const rEff   = document.getElementById('rEff');

const recommendBox = document.getElementById('recommendBox');
const recText      = document.getElementById('recText');

const customBuy     = document.getElementById('customBuy');
const customDetails = document.getElementById('customDetails');

const PLANES = [
  { nombre:'Mini',    base:10,  bono:1 },
  { nombre:'Inicial', base:30,  bono:3 },
  { nombre:'Pro',     base:50,  bono:10 },
  { nombre:'Plus',    base:70,  bono:14 },
  { nombre:'Premium', base:100, bono:30 },
  { nombre:'Titán',   base:200, bono:80 },
];

function calcularBonoPorCreditos(baseCreds){
  if (baseCreds >= 200) return 80;
  if (baseCreds >= 100) return 30;
  if (baseCreds >= 70)  return 14;
  if (baseCreds >= 50)  return 10;
  if (baseCreds >= 30)  return 3;
  if (baseCreds >= 10)  return 1;
  return 0;
}

function planSugeridoPorCreditos(creds){
  let candidato = PLANES[0];
  for (const p of PLANES){ if (creds >= p.base) candidato = p; }
  const siguiente = PLANES.find(p => p.base > candidato.base);
  return { candidato, siguiente };
}

function setMode(mode){
  modeButtons.forEach(b=>{
    const active = b.dataset.mode === mode;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', String(active));
    b.setAttribute('aria-pressed', String(active));
  });
  if(!byCreditsRow || !byAmountRow || !creditsInput || !amountInput){
    console.warn('setMode: faltan elementos de personalización');
    return;
  }
  if (mode === 'credits'){
    byCreditsRow.classList.remove('hidden'); byCreditsRow.removeAttribute('aria-hidden');
    byAmountRow.classList.add('hidden');     byAmountRow.setAttribute('aria-hidden','true');
    creditsInput.disabled = false; creditsInput.setAttribute('aria-disabled','false');
    amountInput.disabled  = true;  amountInput.setAttribute('aria-disabled','true');
    updateFromCredits();
  } else {
    byAmountRow.classList.remove('hidden');  byAmountRow.removeAttribute('aria-hidden');
    byCreditsRow.classList.add('hidden');    byCreditsRow.setAttribute('aria-hidden','true');
    amountInput.disabled  = false; amountInput.setAttribute('aria-disabled','false');
    creditsInput.disabled = true;  creditsInput.setAttribute('aria-disabled','true');
    updateFromAmount();
  }
}

const fmtNumberInput = (el)=>{
  const digits = Number((el.value||'').replace(/\D+/g,'') || 0);
  el.value = digits ? new Intl.NumberFormat('es-CO').format(digits) : '';
  // Mueve el cursor al final
  try { el.setSelectionRange(el.value.length, el.value.length); } catch(e){}
  return digits;
};

function updateRecommendation(baseCredits){
  const { candidato, siguiente } = planSugeridoPorCreditos(baseCredits);
  const bonoCandidato = calcularBonoPorCreditos(candidato.base);
  const totalCandidato = candidato.base + bonoCandidato;
  const effCandidato = (candidato.base * CREDITO_VALOR) / totalCandidato;

  let msg = `Con ${fmtCOP(baseCredits)} créditos, el plan similar es <strong>${candidato.nombre}</strong> (${fmtCOP(candidato.base)} + ${bonoCandidato} de bono). Precio efectivo aprox: <strong>$${fmtCOP(Math.round(effCandidato))}</strong> por crédito.`;

  if (siguiente){
    const falta = Math.max(0, siguiente.base - baseCredits);
    msg += `<br>Si aumentas <strong>${fmtCOP(falta)}</strong> créditos (o <strong>$${fmtCOP(falta*CREDITO_VALOR)}</strong>), alcanzas <strong>${siguiente.nombre}</strong>.`;
  }

  recommendBox.hidden = false;
  recText.innerHTML = msg;
}

function updateFromCredits(){
  const baseCredits = fmtNumberInput(creditsInput) || 0;
  const basePrice = baseCredits * CREDITO_VALOR;
  const bonus = calcularBonoPorCreditos(baseCredits);
  const total = baseCredits + bonus;
  const eff = total ? basePrice / total : 0;

  rBase.textContent  = `$${fmtCOP(basePrice)}`;
  rBonus.textContent = `${fmtCOP(bonus)} créditos`;
  rTotal.textContent = `${fmtCOP(total)}`;
  rEff.textContent   = total ? `$${fmtCOP(Math.round(eff))}` : '$0';

  const waMsg = encodeURIComponent(
    `Hola, quiero comprar un plan personalizado de ${fmtCOP(baseCredits)} créditos (+${fmtCOP(bonus)} de bono = ${fmtCOP(total)} créditos) por $${fmtCOP(basePrice)}.`
  );
  document.getElementById('customBuy').href = `https://wa.me/573126461216?text=${waMsg}`;

  updateRecommendation(baseCredits);
}

function updateFromAmount(){
  const amountRaw = fmtNumberInput(document.getElementById('amountInput')) || 0;
  const normAmount = Math.floor(amountRaw / CREDITO_VALOR) * CREDITO_VALOR;
  if (normAmount !== amountRaw) document.getElementById('amountInput').value = normAmount ? fmtCOP(normAmount) : '';

  const baseCredits = Math.floor(normAmount / CREDITO_VALOR);
  const bonus = calcularBonoPorCreditos(baseCredits);
  const total = baseCredits + bonus;
  const eff = total ? normAmount / total : 0;

  rBase.textContent  = `$${fmtCOP(normAmount)}`;
  rBonus.textContent = `${fmtCOP(bonus)} créditos`;
  rTotal.textContent = `${fmtCOP(total)}`;
  rEff.textContent   = total ? `$${fmtCOP(Math.round(eff))}` : '$0';

  const waMsg = encodeURIComponent(
    `Hola, quiero comprar un plan personalizado por $${fmtCOP(normAmount)} (${fmtCOP(baseCredits)} créditos + ${fmtCOP(bonus)} de bono = ${fmtCOP(total)} créditos).`
  );
  document.getElementById('customBuy').href = `https://wa.me/573126461216?text=${waMsg}`;

  updateRecommendation(baseCredits);
}

// Alternar modo (Por créditos / Por monto)
document.querySelectorAll('.seg-btn').forEach(btn=>{
  btn.addEventListener('click', ()=> setMode(btn.dataset.mode));
});

// Inputs
document.getElementById('creditsInput')?.addEventListener('input', updateFromCredits);
document.getElementById('amountInput')?.addEventListener('input', updateFromAmount);

// Detalles del plan personalizado
document.getElementById('customDetails')?.addEventListener('click', ()=>{
  const activeMode = document.querySelector('.seg-btn.active')?.dataset.mode;
  let baseCredits = 0, amount = 0;

  if (activeMode === 'credits'){
    baseCredits = parseDigits(document.getElementById('creditsInput').value);
    amount = baseCredits * CREDITO_VALOR;
  } else {
    amount = Math.floor(parseDigits(document.getElementById('amountInput').value) / CREDITO_VALOR) * CREDITO_VALOR;
    baseCredits = Math.floor(amount / CREDITO_VALOR);
  }
  const bonus = calcularBonoPorCreditos(baseCredits);
  const total = baseCredits + bonus;

  detailsTitle.textContent = 'Plan personalizado – Detalles';
  detailsBody.innerHTML = `
    <ul>
      <li>Créditos base: <strong>${fmtCOP(baseCredits)}</strong></li>
      <li>Bono promocional: <strong>${fmtCOP(bonus)}</strong> créditos</li>
      <li>Créditos totales: <strong>${fmtCOP(total)}</strong></li>
      <li>Precio: <strong>$${fmtCOP(amount)}</strong> COP</li>
      <li>Precio efectivo por crédito: <strong>$${fmtCOP(total ? Math.round(amount/total) : 0)}</strong></li>
    </ul>
    <p class="tiny">* Bonos sujetos a disponibilidad y vigencia de campaña.</p>
  `;
  detailsModal.showModal();
});

// Estado inicial
if (
  modeButtons.length &&
  byCreditsRow &&
  byAmountRow &&
  creditsInput &&
  amountInput
) {
  setMode('credits');
  creditsInput.value = new Intl.NumberFormat('es-CO').format(30);
  updateFromCredits();

  // Estado inicial (Por monto)
  setMode('amount');
  amountInput.value = new Intl.NumberFormat('es-CO').format(300000);
  updateFromAmount();
} else {
  // Fallback: rellena los campos si existen sin depender del modo
  if (creditsInput) {
    creditsInput.value = new Intl.NumberFormat('es-CO').format(30);
    updateFromCredits();
  }
  if (amountInput) {
    amountInput.value = new Intl.NumberFormat('es-CO').format(300000);
    updateFromAmount();
  }
}
