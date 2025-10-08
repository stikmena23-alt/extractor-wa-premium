const el = s => document.querySelector(s);
    const dedupe = arr => Array.from(new Set(arr.map(s => s.trim()).filter(Boolean)));

    // Etiquetas de tipo en español
    const TYPE_LABELS = {
      FIXED_LINE:'Fijo', MOBILE:'Móvil', FIXED_LINE_OR_MOBILE:'Fijo o Móvil', TOLL_FREE:'Llamada gratuita',
      PREMIUM_RATE:'Tarifa premium', SHARED_COST:'Costo compartido', VOIP:'VoIP', PERSONAL_NUMBER:'Personal',
      PAGER:'Buscapersonas', UAN:'UAN', VOICEMAIL:'Buzón de voz', UNKNOWN:'Desconocido'
    };

    // Parse telefónico offline (mejorado)
    const parsePhone = (raw, country) => {
      try{
        const { parsePhoneNumberFromString } = libphonenumber;
        const p = parsePhoneNumberFromString(String(raw), country);
        if(!p) return null;
        const valid = p.isValid();
        const possible = p.isPossible();
        const e164 = p.format('E.164');
        const international = p.formatInternational();
        const national = p.formatNational();
        const digits = (e164 || String(raw)).replace(/\D/g,'');
        const nationalDigits = String(p.nationalNumber || '').replace(/\D/g,'');
        const uri = (p.getURI && p.getURI()) || null; // RFC 3966
        const type = (p.getType && p.getType()) || null;
        const typeLabel = TYPE_LABELS[type] || (type || null);
        const variants = dedupe([
          e164, international, national, `+${digits}`, digits
        ].filter(Boolean));
        return {
          input: String(raw),
          country: p.country || country || null,
          valid, possible, type, typeLabel,
          e164, international, national, uri,
          digits, nationalDigits, variants
        };
      }catch(e){ return null; }
    };

    // Análisis por lotes (rápido, robusto)
    function analyzeOffline(numbers, country){
      const out = [];
      for(const n of numbers){
        const r = parsePhone(n, country);
        out.push({ input:n, ...(r || { valid:false, possible:false, error:'No se pudo parsear' }) });
      }
      return out;
    }

    function renderResults(rows){
      const root = el('#results');
      const rawOut = el('#rawOut');
      root.innerHTML = rows.map((r,i)=>`
        <div class="cardline">
          <div class="kv"><div>#</div><div>${i+1}</div></div>
          <div class="kv"><div>Entrada</div><div class="mono">${r.input||'—'}</div></div>
          <div class="kv"><div>Válido</div><div>${r.valid?'<span class="pill">Sí</span>':'<span class="pill">No</span>'}</div></div>
          <div class="kv"><div>Posible (long./formato)</div><div>${r.possible?'<span class="pill">Sí</span>':'<span class="pill">No</span>'}</div></div>
          <div class="kv"><div>País (detectado)</div><div>${r.country||'—'}</div></div>
          <div class="kv"><div>Tipo</div><div>${r.typeLabel||r.type||'—'}</div></div>
          <div class="kv"><div>E.164</div><div class="mono">${r.e164||'—'}</div></div>
          <div class="kv"><div>Internacional</div><div class="mono">${r.international||'—'}</div></div>
          <div class="kv"><div>Nacional</div><div class="mono">${r.national||'—'}</div></div>
          <div class="kv"><div>Solo dígitos</div><div class="mono">${r.digits||'—'}</div></div>
          ${r.uri?`<div class="kv"><div>URI</div><div class="mono">${r.uri}</div></div>`:''}
          ${r.error?`<div class="kv"><div>Error</div><div>${r.error}</div></div>`:''}
        </div>
      `).join('');
      rawOut.textContent = JSON.stringify(rows, null, 2);
    }

    // Construcción de dorks y enlaces (avanzado, sin APIs)
    function buildOSINTLinks(input){
      const box = el('#osintLinks');
      box.innerHTML = '';
      const link = (txt,url) => `<a href="${url}" target="_blank" rel="noopener">${txt}</a>`;

      // Normaliza: acepta filas completas o solo números
      const list = Array.isArray(input) ? input : [];
      const rows = list.length && typeof list[0] === 'object'
        ? list
        : list.map(n => ({ input:n, e164:n, digits:String(n).replace(/\D/g,'') }));

      const defaultCountry = (el('#country')?.value || 'CO').toLowerCase();
      const groups = [];
      rows.forEach(r => {
        const base = r.e164 || r.input || '';
        const digits = (r.digits || String(base).replace(/\D/g,'')).slice(0,32);
        const plusDigits = digits ? `+${digits}` : '';
        const quoted = s => `"${s}"`;
        const variants = dedupe([
          base,
          r.international,
          r.national,
          plusDigits,
          digits
        ].filter(Boolean));
        const orQuery = encodeURIComponent(variants.map(v => quoted(v)).join(' OR '));
        const qBase = encodeURIComponent(base);
        const qDigits = encodeURIComponent(digits);

        const general = [
          link('Google', `https://www.google.com/search?q=${orQuery}`),
          link('Bing', `https://www.bing.com/search?q=${orQuery}`),
          link('DuckDuckGo', `https://duckduckgo.com/?q=${orQuery}`)
        ];
        const socials = [
          link('X/Twitter', `https://x.com/search?q=${encodeURIComponent(variants.join(' OR '))}`),
          link('Facebook', `https://www.facebook.com/search/top?q=${qBase}`),
          link('Instagram', `https://www.instagram.com/explore/search/keyword/?q=${qBase}`),
          link('TikTok', `https://www.tiktok.com/search?q=${qBase}`),
          link('LinkedIn', `https://www.linkedin.com/search/results/all/?keywords=${qBase}`)
        ];
        const messaging = [
          link('WhatsApp wa.me', `https://wa.me/${digits}`),
          link('WhatsApp API', `https://api.whatsapp.com/send?phone=${digits}`),
          link('Telegram (t.me)', `https://t.me/${digits}`),
          link('Skype', `skype:${digits}?call`)
        ];
        const dorksGoogle = [
          link('site:facebook.com', `https://www.google.com/search?q=site%3Afacebook.com+${orQuery}`),
          link('site:instagram.com', `https://www.google.com/search?q=site%3Ainstagram.com+${orQuery}`),
          link('site:twitter.com', `https://www.google.com/search?q=site%3Atwitter.com+${orQuery}`),
          link('site:t.me / telegram', `https://www.google.com/search?q=site%3At.me+OR+site%3Atelegram.org+${orQuery}`),
          link('site:pastebin.com', `https://www.google.com/search?q=site%3Apastebin.com+${orQuery}`),
          link('site:github.com (code)', `https://www.google.com/search?q=site%3Agithub.com+${orQuery}`)
        ];
        const countrySlug = (r.country || defaultCountry).toLowerCase();
        const natDigits = (r.nationalDigits && String(r.nationalDigits)) || (r.national ? String(r.national).replace(/\D/g,'') : '') || digits;
        const intel = [
          link('Truecaller (web)', `https://www.truecaller.com/search/${countrySlug}/${natDigits}`),
          link('Sync.me', `https://sync.me/search/?number=${qDigits}`)
        ];

        const copyBtn = `<button class="btn small" data-copy="${variants.join('\n').replace(/"/g,'&quot;')}">Copiar variantes</button>`;

        groups.push(`
          <div class="cardline">
            <div class="kv"><div>Número</div><div class="mono">${base}</div></div>
            <div class="links">${general.join('')}${socials.join('')}${messaging.join('')}</div>
            <details style="margin-top:8px"><summary class="mono">Dorks avanzados (Google)</summary>
              <div class="links">${dorksGoogle.join('')}</div>
            </details>
            <details style="margin-top:8px"><summary class="mono">Inteligencia (externo)</summary>
              <div class="links">${intel.join('')}</div>
            </details>
            <div style="margin-top:8px">${copyBtn}</div>
          </div>`);
      });
      box.innerHTML = groups.join('');
    }

    // CSV
    function csvEscape(v){ if(v==null) return ''; const s=String(v); return /[",\n]/.test(s)?('"'+s.replace(/"/g,'""')+'"'):s; }
    function exportCSV(rows){
      const header=['index','input','valid','possible','country','type','e164','international','national','digits'];
      const lines=[header.join(',')];
      rows.forEach((r,i)=>{
        lines.push([
          i+1,
          r.input||'',
          r.valid?'1':'0',
          r.possible?'1':'0',
          r.country||'',
          r.type||'',
          r.e164||'',
          r.international||'',
          r.national||'',
          r.digits||''
        ].map(csvEscape).join(','));
      });
      const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8;'});
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='open_phone_osint.csv'; a.click();
    }

    // PDF
    async function exportPDF(rows){
      if(!rows?.length){ alert('No hay resultados para exportar'); return; }
      const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit:'pt', format:'a4' });
      const margin=40, lineH=16; let y=margin;
      doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.text('Open Phone OSINT — Reporte', margin, y); y+=lineH;
      doc.setFont('helvetica','normal'); doc.setFontSize(10);
      doc.text(`Generado: ${new Date().toLocaleString()}`, margin, y); y+=lineH;
      const note='Validación y formato con libphonenumber-js (offline). No se usan APIs.';
      const lines=doc.splitTextToSize(note, 515); doc.text(lines, margin, y); y+=lines.length*12+8;
      doc.setFontSize(12);
      rows.forEach((r,idx)=>{
        const block=[
          `#${idx+1}`,
          `Entrada: ${r.input||'—'}`,
          `Válido: ${r.valid?'Sí':'No'}`,
          `Posible: ${r.possible?'Sí':'No'}`,
          `País: ${r.country||'—'}`,
          `Tipo: ${r.typeLabel||r.type||'—'}`,
          `E.164: ${r.e164||'—'}`,
          `Intern.: ${r.international||'—'}`,
          `Nacional: ${r.national||'—'}`,
          `Dígitos: ${r.digits||'—'}`
        ].join('\n');
        const bl=doc.splitTextToSize(block, 515);
        if(y+bl.length*lineH>(842-margin)){ doc.addPage(); y=margin; }
        doc.text(bl, margin, y); y+=bl.length*lineH+8;
      });
      doc.save('open_phone_osint.pdf');
    }

    // Eventos
    el('#btnAnalyze').addEventListener('click', ()=>{
      const raw=(el('#numbers').value||'').split(/\n+/).map(s=>s.trim()).filter(Boolean);
      const numbers=dedupe(raw);
      const country=el('#country').value || 'CO';
      const rows=analyzeOffline(numbers, country);
      window.__rows=rows; renderResults(rows); buildOSINTLinks(rows);
    });

    el('#btnClear').addEventListener('click', ()=>{
      el('#numbers').value=''; el('#results').innerHTML=''; el('#rawOut').textContent=''; el('#osintLinks').innerHTML=''; window.__rows=[];
    });

    el('#btnExportCSV').addEventListener('click', ()=>{ exportCSV(window.__rows||[]); });
    el('#btnExportPDF').addEventListener('click', ()=>{ exportPDF(window.__rows||[]); });

    // Copiado rápido de variantes/dorks
    document.addEventListener('click', (ev)=>{
      const btn = ev.target.closest('[data-copy]');
      if(!btn) return;
      const payload = btn.getAttribute('data-copy') || '';
      navigator.clipboard?.writeText(payload).then(()=>{
        btn.textContent = 'Copiado';
        setTimeout(()=>{ btn.textContent = 'Copiar variantes'; }, 1200);
      }).catch(()=>{
        alert('No se pudo copiar al portapapeles');
      });
    });
