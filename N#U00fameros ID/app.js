const el = s => document.querySelector(s);
    const dedupe = arr => Array.from(new Set(arr.map(s => s.trim()).filter(Boolean)));

    // Parse telefónico offline
    const parsePhone = (raw, country) => {
      try{
        const { parsePhoneNumberFromString } = libphonenumber;
        const p = parsePhoneNumberFromString(String(raw), country);
        if(!p) return null;
        return {
          input: String(raw),
          country: p.country || country || null,
          valid: p.isValid(),
          type: p.getType && p.getType() || null,
          e164: p.format('E.164'),
          international: p.formatInternational(),
          national: p.formatNational(),
          uri: p.getURI && p.getURI() || null
        };
      }catch(e){ return null; }
    };

    function analyzeOffline(numbers, country){
      const out = [];
      for(const n of numbers){
        const r = parsePhone(n, country);
        out.push({ input:n, ...(r || { valid:false, error:'No se pudo parsear' }) });
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
          <div class="kv"><div>País (detectado)</div><div>${r.country||'—'}</div></div>
          <div class="kv"><div>Tipo</div><div>${r.type||'—'}</div></div>
          <div class="kv"><div>E.164</div><div class="mono">${r.e164||'—'}</div></div>
          <div class="kv"><div>Internacional</div><div class="mono">${r.international||'—'}</div></div>
          <div class="kv"><div>Nacional</div><div class="mono">${r.national||'—'}</div></div>
          ${r.error?`<div class="kv"><div>Error</div><div>${r.error}</div></div>`:''}
        </div>
      `).join('');
      rawOut.textContent = JSON.stringify(rows, null, 2);
    }

    function buildOSINTLinks(numbers){
      const box = el('#osintLinks');
      box.innerHTML = '';
      const link = (txt,url) => `<a href="${url}" target="_blank" rel="noopener">${txt}</a>`;
      const uniq = dedupe(numbers);
      const groups = [];
      uniq.forEach(n => {
        const q = encodeURIComponent(n);
        const clean = String(n).replace(/\D/g,'');
        const links = [
          link('Google', `https://www.google.com/search?q=%22${q}%22`),
          link('Bing', `https://www.bing.com/search?q=%22${q}%22`),
          link('X/Twitter', `https://x.com/search?q=${q}`),
          link('Facebook', `https://www.facebook.com/search/top?q=${q}`),
          link('Instagram', `https://www.instagram.com/explore/search/keyword/?q=${q}`),
          link('TikTok', `https://www.tiktok.com/search?q=${q}`),
          link('LinkedIn', `https://www.linkedin.com/search/results/all/?keywords=${q}`),
          link('Telegram', `https://t.me/${clean}`),
          link('Skype', `skype:${clean}?call`),
          link('WhatsApp wa.me', `https://wa.me/${clean}`),
          link('DuckDuckGo', `https://duckduckgo.com/?q=%22${q}%22`)
        ];
        groups.push(`
          <div class="cardline">
            <div class="kv"><div>Número</div><div class="mono">${n}</div></div>
            <div class="links">${links.join('')}</div>
          </div>`);
      });
      box.innerHTML = groups.join('');
    }

    // CSV
    function csvEscape(v){ if(v==null) return ''; const s=String(v); return /[",\n]/.test(s)?('"'+s.replace(/"/g,'""')+'"'):s; }
    function exportCSV(rows){
      const header=['index','input','valid','country','type','e164','international','national'];
      const lines=[header.join(',')];
      rows.forEach((r,i)=>{
        lines.push([i+1,r.input||'',r.valid?'1':'0',r.country||'',r.type||'',r.e164||'',r.international||'',r.national||''].map(csvEscape).join(','));
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
        const block=[`#${idx+1}`,`Entrada: ${r.input||'—'}`,`Válido: ${r.valid?'Sí':'No'}`,`País: ${r.country||'—'}`,`Tipo: ${r.type||'—'}`,`E.164: ${r.e164||'—'}`,`Intern.: ${r.international||'—'}`,`Nacional: ${r.national||'—'}`].join('\n');
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
      window.__rows=rows; renderResults(rows); buildOSINTLinks(rows.map(r=>r.e164||r.input));
    });

    el('#btnClear').addEventListener('click', ()=>{
      el('#numbers').value=''; el('#results').innerHTML=''; el('#rawOut').textContent=''; el('#osintLinks').innerHTML=''; window.__rows=[];
    });

    el('#btnExportCSV').addEventListener('click', ()=>{ exportCSV(window.__rows||[]); });
    el('#btnExportPDF').addEventListener('click', ()=>{ exportPDF(window.__rows||[]); });
