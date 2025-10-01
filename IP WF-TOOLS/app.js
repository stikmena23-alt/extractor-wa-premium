/* ===== Tema ===== */
    (function(){
      const key="wf_theme";
      const saved=localStorage.getItem(key);
      const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
      const initial = saved || (prefersLight ? "light" : "dark");
      document.documentElement.setAttribute("data-theme", initial);
      const themeBtn = document.getElementById("themeBtn");
      const applyLabel=()=> themeBtn.textContent = (document.documentElement.getAttribute("data-theme")==="dark" ? "🌙 Tema" : "☀️ Tema");
      applyLabel();
      themeBtn.addEventListener("click", ()=>{
        const cur=document.documentElement.getAttribute("data-theme");
        const next= cur==="dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem(key, next);
        applyLabel();
      });
    })();

    /* ===== Utils ===== */
    const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const escapeHTML=s=>String(s).replace(/[&<>\"']/g,m=>({"&":"&amp;","<":"&lt;","&gt;":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
    const safe=v=>(v===undefined||v===null||v==="")?null:v;
    const fmtLatLon=(lat,lon)=> (lat==null||lon==null)?null:`${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}`;
    const firstNonNull=(...vals)=> vals.find(v=>v!==undefined && v!==null && v!=='');
    const overlay=$("#overlay"), progBar=$("#progBar"), stepsBox=$("#steps");

    async function fetchJSON(url, opts={}, ms=9000){
      const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(),ms);
      try{ const r=await fetch(url,{signal:ctrl.signal,...opts}); if(!r.ok) throw new Error("HTTP "+r.status); return await r.json(); }
      catch{ return null; } finally{ clearTimeout(t); }
    }

    /* ===== Heurísticas base ===== */
    const HOSTING_HINTS=[/amazon|aws|google|gcp|microsoft|azure|cloudflare|ovh|digitalocean|linode|akamai|oracle|hivelocity|leaseweb|hetzner|contabo|vultr|cloudsigma|datacenter|colo|hosting|servers|compute|1e100\.net|fastly/i];
    const isLikelyHosting=(asnName,org)=> HOSTING_HINTS.some(rx=>rx.test([asnName,org].filter(Boolean).join(" ")));

    /* ===== Listas robustas tipo/IP ===== */
    const FIXED_ONLY_ISPS=["etb","emcali","internexa","anditel","metrotel","azteca comunicaciones","media commerce","telebucaramanga","ibague telecom","columbus","telmex","axtel","totalplay","izzi","megacable","telecentro","iplan","fibertel","flow fibra","cooperativa electrica","vtr","gtd","mundo pacifico","mundo fibra","telsur","win peru","optical networks","wow peru","americatel peru","antel fibra","copaco","entel bolivia fibra","cnt fibra","comcast","xfinity","charter","spectrum","cox","frontier","centurylink","lumen","consolidated communications","windstream","mediacom","optimum","suddenlink","rcn","astound broadband","grande communications","wave broadband","wow internet cable","breezeline","atlantic broadband","google fiber","sonic.net","metronet","ziply fiber","epb fiber optics","altafiber","cincinnati bell","utopia fiber","sparklight","cable one","midco","gci","alaska communications","tds telecom","armstrong","northstate","hargray","allegiance communications","valley fiber","point broadband","tachus","fidium","brightspeed","rcn telecom services","teksavvy","distributel","oxio","start.ca","ebox","novus","cogeco","eastlink","openreach","cityfibre","community fibre","hyperoptic","gigaclear","giganet","toob","trooli","f&w networks","lightspeed broadband","brsk","zzoomm","swish fibre","grain connect","kcom","kcom lightstream","zen internet","origin broadband","plusnet broadband","sky broadband","talktalk broadband","eir fibre","siro","deutsche glasfaser","m-net","netcologne","pyur","tele columbus","wilhelm.tel","willy.tel","ewetel","swb","deutsche giga netz","deutsche glasnetz","orange fibre","freebox fibre","sfr fibre","bouygues fibre","k-net","wibox","videofutur","open fiber","eolo","linkem","tiscali fibra","fastweb fibra","adamo","digi fibra","pepephone fibra","finetwork fibra","avatel","mundo r","euskaltel","nowo","vodafone fibra pt","meo fibra","nos fibra","delta fiber","caiway","glasvezel buitenaf","odido thuis","kpn netwerk","bahnhof","bredband2","ownit","open universe","fibianet","fibia","stadsnat","stadsnät","tampnet","altibox","lyse fiber","nornett","telenet cable","proximus fiber","init7","quickline","green.ch","ewz zurinet","liwest","netia","inea","vectra","multimedia polska","upc polska","rcs rds","digi fiber ro","telekom romania fija","romtelecom","tet latvia","telia lietuva fiber","sbb","telekom srbije fiber"];
    const MIXED_BRANDS=["claro","comcel","movistar","tigo","une"];
    const MOBILE_BRANDS=["claro","comcel","telcel","movistar","entel","tigo","personal","vivo","tim brasil","wom","bitel","cnt movil","antel celular","virgin mobile","tuenti","flash mobile","verizon wireless","t-mobile","at&t mobility","us cellular","cricket wireless","boost mobile","metro by t-mobile","tracfone","straight talk","visible","google fi","xfinity mobile","spectrum mobile","rogers wireless","bell mobility","telus mobility","freedom mobile","videotron mobile","fido","koodo","public mobile","chatr","lucky mobile","ee","o2","three","3","vodafone","giffgaff","lebara","lycamobile","tesco mobile","sky mobile","bt mobile","virgin mobile uk","id mobile","orange","sfr","bouygues telecom","free mobile","iliad","yoigo","masmovil","pepephone","simyo","lowi","o2 españa","jazztel movil","finetwork","digi movil","nos movel","vodafone pt","moche","meo movel","deutsche telekom","telekom","t-mobile de","o2 de","telefonica de","vodafone de","magenta at","a1 telekom austria","drei at","swisscom","sunrise","salt","telia","telenor","tele2","elisa","dna","bite","lmt","proximus","base","telenet mobile","vodafone nl","kpn mobile","odido mobile","ben","lebara nl","tim","vodafone it","windtre","iliad it","poste mobile","coopvoce","ho. mobile","very mobile","kena mobile","orange polska","plus","play","t-mobile pl","heyah","nju mobile","o2 czech","vodafone cz","o2 slovensko","telekom sk","4ka","vodafone hu","telekom hu","yettel hu","orange romania","vodafone romania","telekom romania mobil","digi mobil","a1","vip mobile","mt:s","telenor srbija","one telecom mk","m:tel","bh telecom","turkcell","turk telekom","vodafone tr","cosmote","vodafone gr","wind hellas","cyta","epic cy","primetel","mtn","airtel","glo mobile","9mobile","vodacom","cell c","rain","telkom mobile","safaricom","ooredoo","stc","zain","mobily","du","etisalat","e&","ntt docomo","docomo","kddi","au","softbank","rakuten mobile","china mobile","china unicom","china telecom","reliance jio","jio","airtel india","vi india","bsnl","mtnl","dtac","ais","true move h","telkomsel","xl axiata","indosat ooredoo","smartfren","viettel","mobifone","vinaphone","sk telecom","kt","lg u+","chunghwa telecom","taiwan mobile","far eastone","t star","telstra","optus","vodafone au","tpg mobile","boost au","spark","2degrees","skinny"];

    function normalizeStr(s){ return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }
    function ispMatch(haystack, list){ const s=normalizeStr(haystack); return list.some(x=> s.includes(normalizeStr(x))); }
    function classifyType(baseType, ispOrg, hints){
      const isp=normalizeStr(ispOrg);
      const txt=normalizeStr([baseType,ispOrg,hints].filter(Boolean).join(" "));
      const isFixedOnly=ispMatch(isp, FIXED_ONLY_ISPS);
      const isMixed=ispMatch(isp, MIXED_BRANDS);
      const isMobileBrand=ispMatch(isp, MOBILE_BRANDS);
      const hasMobileClues=/\b(apn|epc|ims|3gpp|mnc\d{2,3}|mcc\d{2,3}|lte|4g|5g|umts|hspa|gprs|edge|wap|cell|celular|movil|mobile)\b/.test(txt);
      const hasHostingClues=/\b(aws|amazon|ec2|compute|gcp|1e100\.net|cloudflare|azure|microsoft|digitalocean|ovh|kimsufi|soyoustart|hetzner|contabo|linode|vultr|oracle|oci|akamai|fastly|leaseweb|scaleway|aruba|rackspace|colo|colocation|datacenter|vps|server|cloud|cdn|dc-)\b/.test(txt);
      const hasResidentialClues=/\b(residential|residencial|home|hogar|ftth|hfc|adsl|xdsl|cable|fiber|fibra|pppoe|pool|dynamic|dhcp|customer|cust|subscriber|user)\b/.test(txt);
      const hasEnterpriseClues=/\b(business|empresa|corporate|corp|empresarial|b2b|static[-\s]?ip|ip\s*fija|ip\s*fixa|dedicated|enlace\s*de\s*datos|metroethernet|mpls)\b/.test(txt);

      if(isMobileBrand || hasMobileClues) return "Móvil / Datos";
      if(hasEnterpriseClues && !hasResidentialClues) return "Empresa";
      if(isFixedOnly && !hasMobileClues) return "Residencial";
      if(isMixed){ if(hasMobileClues) return "Móvil / Datos"; if(hasResidentialClues) return "Residencial"; return "Residencial"; }
      if(hasHostingClues || isLikelyHosting(ispOrg, ispOrg)) return "Hosting / CDN / Corporativo";
      if(hasResidentialClues) return "Residencial";
      return "Residencial";
    }

    /* ISP → sitio (genérico) */
    const ISP_MAP=[
      [/claro|telmex|americamovil/i,"https://www.claro.com/"], [/movistar|telefonica/i,"https://www.movistar.com/"],
      [/tigo|millicom|une/i,"https://www.tigo.com/"], [/wom/i,"https://www.wom.co/"], [/etb/i,"https://www.etb.com/"],
      [/liberty|vtr/i,"https://www.libertylatinamerica.com/"], [/megacable/i,"https://www.megacable.com.mx/"],
      [/starlink|spacex/i,"https://www.starlink.com/"], [/vodafone/i,"https://www.vodafone.com/"], [/orange/i,"https://www.orange.com/"],
      [/verizon/i,"https://www.verizon.com/"], [/at&t|att/i,"https://www.att.com/"], [/comcast|xfinity/i,"https://www.xfinity.com/"],
      [/bt /i,"https://www.bt.com/"], [/telstra/i,"https://www.telstra.com.au/"], [/google llc|google cloud|google fiber/i,"https://about.google/"],
      [/cloudflare/i,"https://www.cloudflare.com/"], [/microsoft|azure/i,"https://azure.microsoft.com/"], [/amazon|aws/i,"https://aws.amazon.com/"],
      [/ovh/i,"https://www.ovhcloud.com/"], [/digitalocean/i,"https://www.digitalocean.com/"], [/hetzner/i,"https://www.hetzner.com/"],
      [/oracle/i,"https://www.oracle.com/cloud/"]
    ];
    const ispHomepage=(orgLike)=>{ if(!orgLike) return null; for(const [rx,url] of ISP_MAP){ if(rx.test(orgLike)) return url; } return "https://www.google.com/search?q="+encodeURIComponent(String(orgLike)); };

    /* ===== Estado global ===== */
    let map, marker, circle, lastLat=null, lastLon=null, currentIP=null, lastSummary=null;
    let lastRiskLine = null, lastPingLine = null, lastScanLines = null;
    let lastRiskMs = null, lastScanMs = null, lastPingMs = null;

    /* ===== Helpers de red avanzada (PTR, RDAP) ===== */
    function ipv4ToArpa(ip){
      const p=ip.split('.').map(Number); if(p.length!==4||p.some(n=>!Number.isFinite(n)||n<0||n>255)) return null;
      return `${p[3]}.${p[2]}.${p[1]}.${p[0]}.in-addr.arpa`;
    }
    function expandIPv6(ip){
      if(!ip.includes(':')) return null;
      const parts = ip.split('::');
      let left = parts[0].split(':').filter(Boolean);
      let right = (parts[1]||'').split(':').filter(Boolean);
      const fill = 8 - (left.length + right.length);
      if(fill<0) return null;
      const mid = Array(fill).fill('0');
      const full = [...left, ...mid, ...right].map(h=>h.padStart(4,'0'));
      return full.join(':');
    }
    function ipv6ToArpa(ip){
      const full = expandIPv6(ip); if(!full) return null;
      const hex = full.replace(/:/g,'').toLowerCase();
      return hex.split('').reverse().join('.').concat('.ip6.arpa');
    }
    async function reverseDNS(ip){
      const arpa = ip.includes(':') ? ipv6ToArpa(ip) : ipv4ToArpa(ip);
      if(!arpa) return null;
      const r = await fetchJSON(`https://dns.google/resolve?name=${encodeURIComponent(arpa)}&type=PTR`, {}, 8000);
      return r?.Answer?.[0]?.data?.replace(/\.$/,'') || null;
    }
    function extractAbuseEmailFromEntities(entities=[]){
      let email=null;
      for(const e of entities){
        const v = e?.vcardArray?.[1];
        if(Array.isArray(v)){
          for(const f of v){
            if(Array.isArray(f) && f[0]==='email'){ email = f[3]; }
          }
        }
      }
      return email;
    }
    async function rdapInfo(ip){
      const r = await fetchJSON(`https://rdap.org/ip/${encodeURIComponent(ip)}`, {}, 9000);
      if(!r) return null;
      const cidr = r.cidr || r.handle || r.startAddress && r.endAddress ? `${r.startAddress}-${r.endAddress}` : null;
      const name = r.name || r.handle || r.remarks?.[0]?.description?.[0] || null;
      const country = r.country || null;
      const abuse = extractAbuseEmailFromEntities(r.entities||[]) || null;
      return {cidr, name, country, abuse, raw:r};
    }

    /* ===== Distancias & Confianza ===== */
    function toRad(d){ return d*Math.PI/180; }
    function haversine(a,b){
      const R=6371; // km
      const dLat=toRad((b.lat||0)-(a.lat||0)), dLon=toRad((b.lon||0)-(a.lon||0));
      const s1=Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat||0))*Math.cos(toRad(b.lat||0))*Math.sin(dLon/2)**2;
      return 2*R*Math.asin(Math.sqrt(s1));
    }
    function computeConfidence(parts,sum,rdap,ptr){
      let score=100;
      const okParts = parts.filter(Boolean);
      if(okParts.length<2) score-=10;
      const countries = okParts.map(p=>String(p.country||'').toLowerCase()).filter(Boolean);
      const uniqueC = new Set(countries).size;
      if(uniqueC>1) score -= Math.min(25,(uniqueC-1)*10);
      if(sum.cityRepeatCount>=2) score += 5; else score -= 8;
      const pts = okParts.filter(p=>p.lat!=null && p.lon!=null).map(p=>({lat:+p.lat,lon:+p.lon}));
      if(pts.length>=2){
        let maxD=0; for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){ maxD=Math.max(maxD, haversine(pts[i],pts[j])); }
        if(maxD>500) score-=20; else if(maxD>100) score-=8;
      }else score-=6;
      if(sum.proxy===true) score-=25;
      if(sum.hosting===true || isLikelyHosting(sum.asname,sum.org)) score-=12;
      if(rdap?.country && sum.country && String(rdap.country).toLowerCase()!==String(sum.country).toLowerCase()) score-=8;
      if(ptr) score+=3;
      score = Math.max(0, Math.min(100, Math.round(score)));
      let label = score>=80 ? "alto" : score>=60 ? "medio" : "bajo";
      return {score, label};
    }

    /* ===== Nodos (APIs gratuitas) ===== */
    async function n1(ip){ const r=await fetchJSON(`https://ipwho.is/${encodeURIComponent(ip)}`); if(!r||r.success===false) return null; return { alias:"Nodo A", provider:"ipwho.is", raw:r, ip:r.ip, country:r.country, region:r.region, city:r.city, lat:r.latitude, lon:r.longitude, asn:r.connection?.asn, asname:r.connection?.org, org:r.connection?.org || r.connection?.isp, timezone:r.timezone?.id, proxy:r.security?.is_proxy ?? null, hosting:r.security?.is_datacenter ?? null }; }
    async function n2(ip){ const r=await fetchJSON(`https://ipapi.co/${encodeURIComponent(ip)}/json/`); if(!r||r.error) return null; return { alias:"Nodo B", provider:"ipapi.co", raw:r, ip:r.ip, country:r.country_name, region:r.region, city:r.city, lat:r.latitude, lon:r.longitude, asn:r.asn, asname:r.org, org:r.org, timezone:r.timezone, proxy:null, hosting:null }; }
    async function n3(ip){ const r=await fetchJSON(`https://ipwhois.app/json/${encodeURIComponent(ip)}`); if(!r||r.success===false) return null; return { alias:"Nodo C", provider:"ipwhois.app", raw:r, ip:r.ip, country:r.country, region:r.region, city:r.city, lat:r.latitude, lon:r.longitude, asn:r.as, asname:r.isp||r.org, org:r.org||r.isp, timezone:r.timezone_gmt, proxy:safe(r.proxy)??null, hosting:safe(r.hosting)??null }; }
    async function n4(ip){ const r=await fetchJSON(`https://get.geojs.io/v1/ip/geo/${encodeURIComponent(ip)}.json`); if(!r||r.status==="fail") return null; return { alias:"Nodo D", provider:"GeoJS", raw:r, ip:r.ip, country:r.country, region:r.region, city:r.city, lat:r.latitude, lon:r.longitude, asn:null, asname:null, org:r.organization, timezone:r.timezone, proxy:null, hosting:null }; }
    const NODES=[n1,n2,n3,n4];

    /* ===== Overlay/progreso ===== */
    let stepState={};
    function showOverlay(){ stepState={}; stepsBox.innerHTML=""; ["A","B","C","D"].forEach((tag,i)=>{ const id="p"+i; stepState[id]={el:null}; const row=document.createElement("div"); row.className="step"; row.innerHTML=`<span class="dot run"></span><span>Nodo ${tag}</span>`; stepsBox.appendChild(row); stepState[id].el=row.querySelector(".dot"); }); progBar.style.width="0%"; overlay.style.display="flex"; }
    function hideOverlay(){ overlay.style.display="none"; }
    function markStep(i,ok){ const st=stepState["p"+i]; if(!st?.el) return; st.el.className="dot "+(ok?"ok":"fail"); const total=Object.values(stepState).filter(s=>/ok|fail/.test(s.el?.className||"")).length; progBar.style.width=Math.round((total/NODES.length)*100)+"%"; }

    /* ===== Consenso & Merge ===== */
    function mostFrequent(arr){ const map=new Map(); for(const v of arr){ if(!v) continue; const k=String(v).toLowerCase(); map.set(k,(map.get(k)||0)+1); } let best=null,c=0; for(const [k,v] of map){ if(v>c){c=v; best=k;} } return {value:best, count:c}; }
    function pickConsensusCity(parts){ const cities=parts.map(p=>p?.city||null).filter(Boolean); const {value,count}=mostFrequent(cities); if(value && count>=2) return {city:cities.find(c=>c && c.toLowerCase()===value) || value, count}; const order=["ipwho.is","ipapi.co","ipwhois.app","GeoJS"]; for(const o of order){ const hit=parts.find(p=>p && p.provider===o && p.city); if(hit) return {city:hit.city, count:1}; } return {city:null,count:0}; }
    function mergeResults(parts){
      const order=["ipwho.is","ipapi.co","ipwhois.app","GeoJS"];
      const byProv={}; parts.forEach(p=>{ if(p) byProv[p.provider]=p; });
      const pick=map=>{ for(const n of order){ const s=byProv[n]; if(s){ const v=map(s); if(v!=null && v!=="") return v; } } return null; };
      const lat=pick(p=>p.lat), lon=pick(p=>p.lon); const {city, count}=pickConsensusCity(parts);
      return { ip:pick(p=>p.ip), country:pick(p=>p.country), region:pick(p=>p.region), city, cityRepeatCount:count,
        coords:(lat!=null&&lon!=null)?fmtLatLon(lat,lon):null, lat, lon, asn:pick(p=>p.asn),
        asname:pick(p=>p.asname), org:pick(p=>p.org), timezone:pick(p=>p.timezone),
        proxy:firstNonNull(byProv["ipwho.is"]?.proxy, byProv["ipwhois.app"]?.proxy),
        hosting:firstNonNull(byProv["ipwho.is"]?.hosting, byProv["ipwhois.app"]?.hosting),
        _parts:parts
      };
    }

    /* ===== Render ===== */
    function metricHTML(label,val,mono=false){ return `<div class="metric"><b>${label}</b><div class="val ${mono?'mono':''}">${val ?? '—'}</div></div>`; }
    function renderSummary(sum, typeLabel, extras={}){
      const ptr = extras.ptr || '—';
      const cidr = extras.rdap?.cidr || '—';
      const abuse = extras.rdap?.abuse || '—';
      const confLine = extras.confidence ? `${extras.confidence.score}/100 (${extras.confidence.label})` : '—';
      $("#summary").innerHTML=[
        metricHTML("IP", sum.ip, true),
        metricHTML("País", sum.country),
        metricHTML("Región", sum.region),
        metricHTML("Ciudad (consenso 2+)", sum.city),
        metricHTML("Coordenadas", sum.coords, true),
        metricHTML("ASN", sum.asn, true),
        metricHTML("Organización", sum.org || sum.asname),
        metricHTML("Hostname (PTR)", ptr, true),
        metricHTML("CIDR (RDAP)", cidr, true),
        metricHTML("Abuse (RDAP)", abuse, true),
        metricHTML("Zona horaria", sum.timezone),
        metricHTML("Tipo de IP (clasificación)", typeLabel),
        metricHTML("Confidence Score", confLine)
      ].join("");
      const badges=[];
      if(sum.proxy===true) badges.push(`<span class="badge" style="border-color:var(--danger);color:#fff;background:color-mix(in oklab, var(--danger) 30%, #000 70%)">Proxy/VPN</span>`);
      if(sum.hosting===true || isLikelyHosting(sum.asname, sum.org)) badges.push(`<span class="badge" style="border-color:var(--warn);color:#111;background:var(--warn)">Hosting/CDN</span>`);
      if(extras.ptr) badges.push(`<span class="badge">PTR</span>`);
      if(extras.rdap?.country) badges.push(`<span class="badge">RDAP: ${escapeHTML(extras.rdap.country)}</span>`);
      $("#badges").innerHTML=badges.join("");
    }

    function renderNodes(parts, consensusCity){
      const box=$("#providers");
      if(parts.length===0){ box.innerHTML=`<div class="muted">Sin datos</div>`; return; }
      box.innerHTML = parts.map((p,i)=>{
        const name = p? p.alias : `Nodo ${["A","B","C","D"][i]}`;
        if(!p) return `<div class="pCard"><div class="pHead"><div class="pName">${name}</div><div class="pStatus">falló</div></div><div class="muted">Sin datos</div></div>`;
        const coord = fmtLatLon(p.lat,p.lon) || "—";
        const flags = [p.proxy===true?`<span class="tag">Proxy/VPN</span>`:"", p.hosting===true?`<span class="tag">Hosting</span>`:""].join("");
        const repeatCls = consensusCity && p.city && String(p.city).toLowerCase()===String(consensusCity).toLowerCase() ? "repeat" : "";
        return `<div class="pCard ${repeatCls}">
          <div class="pHead"><div class="pName">${p.alias}</div><div class="pStatus">${flags||"ok"}</div></div>
          <div class="pGrid">
            <div class="item"><b>IP</b><div class="mono wrap">${p.ip||"—"}</div></div>
            <div class="item"><b>País</b><div class="wrap">${p.country||"—"}</div></div>
            <div class="item"><b>Región</b><div class="wrap">${p.region||"—"}</div></div>
            <div class="item"><b>Ciudad</b><div class="wrap">${p.city||"—"}</div></div>
            <div class="item"><b>Coordenadas</b><div class="mono wrap">${coord}</div></div>
            <div class="item"><b>Org/ASN</b>
              <div class="wrap">
                <span class="orgVal">${escapeHTML(p.org||"—")}</span>
                ${p.asn ? `<span class="mono asnVal"> (${escapeHTML(p.asn)})</span>` : ""}
              </div>
            </div>
          </div>
        </div>`;
      }).join("");
    }

    function renderJSON(parts){
      $("#jsonGrid").innerHTML = parts.map((p,i)=>{
        const label = p ? p.alias : `Nodo ${["A","B","C","D"][i]}`;
        const content = p ? JSON.stringify(p.raw,null,2) : "—";
        return `<div class="jsonCard"><h4>${label}</h4><pre class="mono">${escapeHTML(content)}</pre></div>`;
      }).join("");
    }

    function renderISP(sum){
      const label=sum.org||sum.asname||"—"; $("#ispVal").textContent=label;
      const url=ispHomepage(label); const a=$("#ispLink");
      if(url){ a.href=url; a.style.display="inline-block"; } else { a.style.display="none"; }
    }

    function buildAnalysis(sum, typeLabel, extras){
      const parts=sum._parts.filter(Boolean);
      const countries=parts.map(p=>p.country).filter(Boolean);
      const cCount=new Set(countries.map(x=>x.toLowerCase())).size;
      const msgs=[];
      msgs.push(`• País: ${cCount<=1 ? "consistente" : "inconsistente entre nodos"}${sum.country?` (${sum.country})`:""}.`);
      msgs.push(`• Ciudad (consenso): ${sum.city ? sum.city : "sin consenso claro"}${sum.cityRepeatCount>=2?" (repetida en 2+ nodos)":""}.`);
      if(sum.asn || sum.org) msgs.push(`• ASN/Org: ${sum.asn ? sum.asn+" · " : ""}${sum.org || sum.asname || ""}.`);
      if(extras.ptr) msgs.push(`• PTR: ${escapeHTML(extras.ptr)}.`);
      if(extras.rdap?.cidr) msgs.push(`• RDAP CIDR: ${escapeHTML(extras.rdap.cidr)}${extras.rdap.country?` · país RDAP: ${escapeHTML(extras.rdap.country)}`:""}${extras.rdap.abuse?` · abuse: ${escapeHTML(extras.rdap.abuse)}`:""}.`);
      if(extras.confidence) msgs.push(`• Confidence Score: ${extras.confidence.score}/100 (${extras.confidence.label}).`);
      msgs.push(`• Clasificación: <strong>${typeLabel}</strong>.`);

      let verdict="Riesgo bajo: acceso residencial/corporativo sin señales fuertes.";
      if(typeLabel==="Móvil / Datos") verdict="Trazabilidad variable: IP móvil con CGNAT/cambios de celda; correlaciona por tiempo/frecuencia.";
      if(typeLabel==="Hosting / CDN / Corporativo") verdict="Atención: IP de infraestructura (datacenter/CDN). Valida reputación e IOC.";
      if(sum.proxy===true) verdict="Advertencia: Nodo reportó Proxy/VPN. Revisa reputación.";
      return msgs.join("<br>")+"<br><br><strong>Veredicto</strong><br>"+verdict;
    }

    /* ===== Historial ===== */
    function pushHistory(ip){ const key="hist_wf_tool"; const arr=JSON.parse(localStorage.getItem(key)||"[]"); const idx=arr.indexOf(ip); if(idx>-1) arr.splice(idx,1); arr.unshift(ip); if(arr.length>12) arr.pop(); localStorage.setItem(key, JSON.stringify(arr)); renderHistory(); }
    function renderHistory(){ const key="hist_wf_tool"; const arr=JSON.parse(localStorage.getItem(key)||"[]"); $("#historyBox").innerHTML = arr.map(ip=>`<span class="pill mono" data-ip="${ip}" title="Consultar de nuevo">${ip}</span>`).join("") || `<div class="muted">Sin consultas recientes</div>`; $$("#historyBox .pill").forEach(el=> el.addEventListener("click", ()=>{ $("#ipInput").value=el.dataset.ip; lookup(); })); }

    /* ===== Mapa (Leaflet en la UI) ===== */
    function ensureMap(){ if(map) return map; map=L.map('map'); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19, attribution:'© OSM'}).addTo(map); map.setView([0,0],2); return map;}
    function updateMap(lat,lon){
      ensureMap(); if(lat==null||lon==null){ $("#mapInfo").textContent="Sin coordenadas confiables (consenso)."; return; }
      lastLat=Number(lat); lastLon=Number(lon); const ll=[lastLat,lastLon];
      if(!marker){ marker=L.marker(ll).addTo(map); } else { marker.setLatLng(ll); }
      if(!circle){ circle=L.circle(ll,{radius:1000,color:'#38bdf8',fillColor:'#38bdf8',fillOpacity:0.12,weight:1}).addTo(map); } else { circle.setLatLng(ll); }
      map.flyTo(ll,10,{duration:.9}); $("#mapInfo").textContent=`Centro: ${lastLat.toFixed(5)}, ${lastLon.toFixed(5)} (zoom 10)`;
    }
    $("#btnOSM").addEventListener("click", ()=>{ if(lastLat==null) return; window.open(`https://www.openstreetmap.org/#map=12/${lastLat}/${lastLon}`,'_blank'); });
    $("#btnCopy").addEventListener("click", async ()=>{ if(lastLat==null) return; const txt=`${lastLat}, ${lastLon}`; try{ await navigator.clipboard.writeText(txt); $("#mapInfo").textContent=`Copiado: ${txt}`; }catch{} });
    ensureMap();

    /* ===== Verificación Tor/VPN/VPS ===== */
    async function checkTor(ip){ try{ const r=await fetchJSON(`https://onionoo.torproject.org/details?search=${encodeURIComponent(ip)}`,{},8000); const relays=r?.relays?.length||0; const bridges=r?.bridges?.length||0; return {tor:(relays+bridges)>0, relays, bridges}; }catch{ return {tor:false, relays:0, bridges:0}; } }
    function vpnVpsHeuristics(org, asn){ const s=(org||""+" "+(asn||"")).toLowerCase(); const vpnBrands=[/vpn/,/nordvpn|surfshark|expressvpn|private internet access|mullvad|proton vpn|windscribe|hidemyass|cyberghost/i]; const vpsBrands=[/digitalocean|linode|vultr|ovh|hetzner|contabo|aws|amazon|ec2|azure|google|gcp|oracle|oci|scaleway|upcloud|leaseweb|hivelocity|ovhcloud/i]; return {vpn:vpnBrands.some(rx=>rx.test(s)), vps:vpsBrands.some(rx=>rx.test(s))}; }
    async function checkRisk(ip, sum){ const tor=await checkTor(ip); const hv=vpnVpsHeuristics(sum.org||sum.asname||"", sum.asn||""); const hosting=isLikelyHosting(sum.asname,sum.org)||!!sum.hosting; const proxy=!!sum.proxy; return { tor:tor.tor, tor_meta:tor, vpn:hv.vpn, vps:hv.vps, hosting, proxy }; }

    /* ===== Ping ===== */
    async function pingBestEffort(ip){
      const start=performance.now(); let ok=false;
      try{ await fetch(`https://${ip}`, {mode:'no-cors'}); ok=true; }catch{}
      if(!ok){
        try{ await new Promise(res=>{ const im=new Image(); im.onload=()=>res(); im.onerror=()=>res(); im.src=`http://${ip}/favicon.ico?x=`+Math.random(); setTimeout(res,3500); }); ok=true; }catch{}
      }
      const ms=Math.round(performance.now()-start); return {alive:ok, rtt_ms:ms};
    }

    /* ===== Puertos ===== */
    const COMMON_PORT_SERVICES={7:"Echo",9:"Discard",20:"FTP-data",21:"FTP",22:"SSH/SFTP",23:"Telnet",25:"SMTP",37:"Time",53:"DNS",67:"DHCP server",68:"DHCP client",69:"TFTP",80:"HTTP",88:"Kerberos",110:"POP3",111:"RPCbind/portmap",119:"NNTP",123:"NTP",135:"RPC/EPMAP",137:"NetBIOS-ns",138:"NetBIOS-dgm",139:"SMB/CIFS",143:"IMAP",161:"SNMP",389:"LDAP",443:"HTTPS",445:"SMB over TCP",465:"SMTPS",500:"IPsec/IKE",514:"Syslog",515:"LPD",587:"SMTP submission",631:"IPP/Impresión",993:"IMAPS",995:"POP3S",1080:"SOCKS proxy",1194:"OpenVPN",1433:"MS SQL Server",1521:"Oracle DB",1723:"PPTP",1883:"MQTT",2049:"NFS",2083:"cPanel SSL",2375:"Docker (no TLS)",2376:"Docker TLS",2483:"Oracle DB",2484:"Oracle DB SSL",25565:"Minecraft",2601:"Zebra",3000:"Dev web",3128:"Proxy",3268:"Global Catalog LDAP",3306:"MySQL",3389:"RDP",3690:"SVN",4369:"Erlang epmd",5000:"Dev web",5432:"PostgreSQL",5632:"pcAnywhere",5672:"AMQP",5900:"VNC",5985:"WinRM",5986:"WinRM SSL",6379:"Redis",7001:"WebLogic",7002:"WebLogic SSL",7007:"Plex",8000:"HTTP-alt",8008:"HTTP-alt",8080:"HTTP-proxy",8081:"HTTP-alt",8083:"Vestacp",8086:"InfluxDB",8181:"Nginx alt",8333:"Bitcoin",8443:"HTTPS-alt/Tomcat",8500:"Consul",853:"DNS over TLS",8530:"WSUS",8531:"WSUS SSL",8649:"Ganglia",8888:"HTTP-alt",9000:"SonarQube",9042:"Cassandra",9092:"Kafka",9100:"Impresoras",9200:"Elasticsearch",9300:"Elastic node",9418:"Git",11211:"Memcached",27017:"MongoDB",27018:"MongoDB",32400:"Plex",37777:"DVR Dahua",50000:"SAP/UPnP"};
    const UNSAFE_PORTS=new Set([1,7,9,11,13,15,17,19,20,21,25,69,110,111,119,135,137,138,139,143,161,179,389,427,465,512,513,514,515,526,530,531,532,533,540,548,556,563,587,601,636,989,990,992,993,995,2049,4045,6000,8080]);
    function portName(port){ return COMMON_PORT_SERVICES[port] || "Puerto desconocido o uso no estándar"; }

    async function probePort(ip, port, tls){
      if(UNSAFE_PORTS.has(port)) return {port, tls, open:false, rtt_ms:null, blocked:true};
      const url = `${tls?'https':'http'}://${ip}:${port}/favicon.ico?x=${Math.random()}`;
      const t0=performance.now();
      return new Promise((resolve)=>{
        const img=new Image(); let settled=false;
        const done=(ok)=>{ if(settled) return; settled=true; const ms=Math.round(performance.now()-t0); resolve({port,tls,open:ok,rtt_ms:ms,blocked:false}); };
        img.onload=()=>done(true); img.onerror=()=>done(true);
        try{ img.src=url; }catch{ done(false); }
        setTimeout(()=>done(false), 3500);
      });
    }
    async function portScan(ip, ports){
      const tasks=ports.map(p=>{ p=Number(p);
        if([80,8080,8000,8008,8081,8888].includes(p)) return [probePort(ip,p,false)];
        if([443,8443].includes(p)) return [probePort(ip,p,true)];
        return [probePort(ip,p,false)];
      }).flat();
      return Promise.all(tasks);
    }

    /* ===== Buscador de puerto (online) ===== */
    async function portLookupOnline(port){
      const out={tips:[], desc:null, src:null};
      const tryWiki=async (base,title)=>{
        const r=await fetchJSON(`${base}/page/summary/${encodeURIComponent(title)}`, {}, 7000);
        if(r?.extract){ out.desc=r.extract; out.src=r.content_urls?.desktop?.page||r.content_urls?.mobile?.page; return true; }
        return false;
      };
      if(await tryWiki("https://es.wikipedia.org/api/rest_v1", `Puerto ${port}`)) return out;
      if(await tryWiki("https://en.wikipedia.org/api/rest_v1", `Port ${port}`)) return out;
      try{
        const txt=await (await fetch(`https://www.iana.org/assignments/service-names-port-numbers/service-names-port-numbers.csv`)).text();
        const hits=txt.split(/\r?\n/).filter(l=> new RegExp(`,(?:tcp|udp),${port}(?:,|$)`).test(l));
        if(hits.length){ out.desc = "Referencia IANA encontrada para este puerto."; out.src="https://www.iana.org/assignments/service-names-port-numbers/service-names-port-numbers.xhtml"; }
      }catch{}
      out.tips = [
        {label:"IANA", url:`https://www.iana.org/assignments/service-names-port-numbers/service-names-port-numbers.xhtml?search=${port}`},
        {label:"Wikipedia (ES)", url:`https://es.wikipedia.org/wiki/Puerto_${port}`},
        {label:"Wikipedia (EN)", url:`https://en.wikipedia.org/wiki/Port_${port}`},
        {label:"Google", url:`https://www.google.com/search?q=port+${port}`},
        {label:"Shodan", url:`https://www.shodan.io/search?query=port%3A${port}`},
        {label:"Censys", url:`https://search.censys.io/search?resource=hosts&q=services.port%3A${port}`}
      ];
      return out;
    }

    /* ===== Flujo principal ===== */
    async function getMyIP(){ const r=await fetchJSON("https://api.ipify.org?format=json"); return r?.ip||null; }

    async function lookup(){
      const ipRaw=$("#ipInput").value.trim();
      showOverlay(); progBar.style.width="5%";
      const ip = ipRaw || await getMyIP();
      if(!ip){ hideOverlay(); alert("No pude detectar tu IP pública. Escribe una IP manualmente."); return; }

      const tasks = [n1,n2,n3,n4].map((fn,i)=> fn(ip).then(v=>{markStep(i, !!v); return v;}).catch(_=>{markStep(i,false); return null;}));
      const parts = await Promise.all(tasks); await sleep(120); progBar.style.width="90%";

      const okParts = parts.filter(Boolean);
      if(okParts.length===0){
        hideOverlay();
        $("#summary").innerHTML=""; $("#providers").innerHTML=`<div class="muted">Sin respuesta de nodos.</div>`;
        $("#analysis").innerHTML=`No fue posible analizar la IP.`; $("#jsonGrid").innerHTML="";
        $("#ispVal").textContent="—"; $("#ispLink").style.display="none"; updateMap(null,null);
        lastRiskLine = lastPingLine = lastScanLines = null; lastRiskMs = lastScanMs = lastPingMs = null;
        return;
      }

      const sum = mergeResults(okParts); currentIP = sum.ip || ip; lastSummary=sum;
      // PTR + RDAP
      const [ptr, rdap] = await Promise.all([ reverseDNS(currentIP), rdapInfo(currentIP) ]);
      const typeLabel = classifyType("base", sum.org || sum.asname || (ptr||""), `${sum.asn||''} ${sum.country||''}`);
      const confidence = computeConfidence(okParts, sum, rdap, ptr);

      progBar.style.width="100%"; await sleep(160); hideOverlay();

      renderSummary(sum, typeLabel, {ptr, rdap, confidence});
      renderNodes(parts, sum.cityRepeatCount>=2? sum.city : null);
      renderJSON(parts);
      renderISP(sum);
      $("#analysis").innerHTML = buildAnalysis(sum, typeLabel, {ptr, rdap, confidence});
      pushHistory(currentIP);
      updateMap(sum.lat, sum.lon);

      $("#riskOut").textContent="—"; $("#pingOut").textContent="—"; $("#scanOut").textContent="—";
      lastRiskLine = lastPingLine = lastScanLines = null;
      lastRiskMs = lastScanMs = lastPingMs = null;

      // Guarda extras para PDF
      lastExtras = {ptr, rdap, confidence, typeLabel};
    }

    /* ===== PDF (SIN MAPA; coordenadas + aviso en rojo) ===== */
    let lastExtras = null;

    function textFromMetric(label){
      const cards=$$("#summary .metric");
      for(const c of cards){
        const b=c.querySelector("b");
        if(b && b.textContent.trim().toLowerCase()===label.toLowerCase())
          return (c.querySelector(".val")?.textContent||"—");
      }
      return "—";
    }
    function collectSummaryForPDF(){
      return {
        ip: textFromMetric("IP"),
        pais: textFromMetric("País"),
        region: textFromMetric("Región"),
        ciudad: textFromMetric("Ciudad (consenso 2+)"),
        coords: textFromMetric("Coordenadas"),
        asn: textFromMetric("ASN"),
        org: textFromMetric("Organización"),
        ptr: textFromMetric("Hostname (PTR)"),
        cidr: textFromMetric("CIDR (RDAP)"),
        abuse: textFromMetric("Abuse (RDAP)"),
        tz: textFromMetric("Zona horaria"),
        tipo: textFromMetric("Tipo de IP (clasificación)"),
        conf: textFromMetric("Confidence Score"),
        badges: $("#badges")?.innerText || "",
        analisis: $("#analysis")?.innerText || ""
      };
    }

    async function generatePDF(){
      try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit:'pt', format:'a4' });
        const pad=40; let y=pad;
        const now=new Date().toLocaleString();

        // Encabezado
        doc.setFont('helvetica','bold'); doc.setFontSize(16);
        doc.text("IP Analyzer Pro de WF TOOL", pad, y); y+=20;
        doc.setFont('helvetica','normal'); doc.setFontSize(11);
        doc.text("Tarjetas por nodo, consenso de ciudad, tipo de IP (residencial/móvil/hosting) y mapa avanzado", pad, y); y+=22;

        // Resumen
        const s=collectSummaryForPDF();
        const lines = [
          `Fecha/Hora: ${now}`,
          `IP: ${s.ip}`,
          `País: ${s.pais}   Región: ${s.region}`,
          `Ciudad (consenso 2+): ${s.ciudad}`,
          `Coordenadas: ${s.coords}`,
          `ASN: ${s.asn}`,
          `Organización: ${s.org}`,
          `Hostname (PTR): ${s.ptr}`,
          `CIDR (RDAP): ${s.cidr}`,
          `Abuse (RDAP): ${s.abuse}`,
          `Zona horaria: ${s.tz}`,
          `Tipo de IP: ${s.tipo}`,
          `Confidence Score: ${s.conf}`,
          `Riesgos (badges): ${s.badges || "—"}`
        ];
        lines.forEach(t=>{ doc.text(t, pad, y); y+=16; });

        // Aviso en rojo sobre coordenadas/ISP
        y += 8;
        doc.setFont('helvetica','bold'); doc.setTextColor(239,68,68); // rojo
        doc.text("IMPORTANTE:", pad, y); y += 14;
        doc.setFont('helvetica','normal');
        const aviso = "Las coordenadas presentadas están basadas en la ubicación del PROVEEDOR DE INTERNET (ISP), NO en el usuario final de la IP.";
        const wrappedAviso = doc.splitTextToSize(aviso, 515);
        doc.text(wrappedAviso, pad, y); y += 16 * wrappedAviso.length;
        doc.setTextColor(0,0,0); // restaurar negro

        // Herramientas
        y+=6; doc.setFont('helvetica','bold'); doc.text("Herramientas de verificación:", pad, y); y+=16; doc.setFont('helvetica','normal');
        if(lastRiskLine || lastPingLine || (lastScanLines && lastScanLines.length)){
          if(lastRiskLine){ doc.text(`• ${lastRiskLine}`, pad, y); y+=16; }
          if(lastPingLine){ doc.text(`• Ping (best-effort): ${lastPingLine}`, pad, y); y+=16; }
          if(lastScanLines && lastScanLines.length){
            doc.text("• Escaneo de puertos (resumen):", pad, y); y+=16;
            const first = lastScanLines.slice(0,8).join(" | ");
            const wrapped = doc.splitTextToSize(first, 515);
            doc.text(wrapped, pad, y); y += 16 * wrapped.length;
            if(lastScanLines.length>8){ doc.text(`(+${lastScanLines.length-8} más)`, pad, y); y+=16; }
            if(typeof lastScanMs === 'number'){ doc.text(`Duración del escaneo: ${lastScanMs} ms`, pad, y); y+=16; }
          }
        } else {
          doc.text("• (No se ejecutaron verificaciones en esta sesión)", pad, y); y+=16;
        }

        // Análisis
        y+=6; doc.setFont('helvetica','bold'); doc.text("Análisis:", pad, y); y+=16; doc.setFont('helvetica','normal');
        const wrapped = doc.splitTextToSize(s.analisis || "—", 515);
        doc.text(wrapped, pad, y); y += 16 * wrapped.length;

        // Definiciones
        y+=12; doc.setFont('helvetica','bold'); doc.text("Notas y definiciones:", pad, y); y+=16; doc.setFont('helvetica','normal');
        const defs = [
          "Ping (best-effort): medición aproximada desde el navegador (sin ICMP real). Usa peticiones HTTP/imagen para inferir latencia. Puede fallar por bloqueos o CORS.",
          "CORS/MixedContent: políticas del navegador que bloquean peticiones cruzadas o contenido inseguro (HTTP) cuando navegas en HTTPS. Puede afectar scans/‘ping’.",
          "Tor: ‘sí’ indica que la IP coincide con un nodo Tor (relé o bridge) reportado por la red Tor.",
          "VPN (heurística): ‘sí’/‘no’ estimado por marcas de proveedores y patrones; no es 100% determinista.",
          "VPS/Cloud (heurística): inferido por nombres de proveedores/datacenter; indica infraestructura de servidor.",
          "Hosting reportado/sospechado: detectado por proveedor o heurística (ASN/Org típicos de centros de datos)."
        ];
        const defsWrapped = defs.flatMap(d=> doc.splitTextToSize("• "+d, 515).concat([""]));
        doc.text(defsWrapped, pad, y);

        doc.save('lp.pdf');
      } catch(e) {
        alert("No se pudo generar el PDF en este navegador.");
      }
    }

    /* ===== Eventos ===== */
    $("#btnLookup").addEventListener("click", lookup);
    $("#ipInput").addEventListener("keydown", e=>{ if(e.key==="Enter") lookup(); });
    $("#btnPDF").addEventListener("click", ()=>{ generatePDF(); });

    $("#btnCheckRisk").addEventListener('click', async ()=>{
      if(!currentIP){ $("#riskOut").textContent="Primero analiza una IP arriba."; return; }
      $("#riskOut").textContent="Verificando…";
      const isp=$("#ispVal").textContent||"";
      const sum={ org:isp, asname:isp, asn:undefined, hosting: $("#badges").textContent.includes('Hosting'), proxy: $("#badges").textContent.includes('Proxy') };
      const t0 = performance.now();
      const r = await checkRisk(currentIP, sum);
      const elapsed = Math.round(performance.now() - t0);
      const chips=[];
      chips.push(`Tor: ${r.tor? "sí":"no"}`);
      chips.push(`VPN (heurística): ${r.vpn? "sí":"no"}`);
      chips.push(`VPS/Cloud (heurística): ${r.vps? "sí":"no"}`);
      if(r.hosting) chips.push("Hosting reportado/sospechado");
      if(r.proxy) chips.push("Proxy reportado");
      const line = chips.join(" · ") + ` · Verificación: ${elapsed} ms`;
      $("#riskOut").innerHTML = line;
      lastRiskLine = line; lastRiskMs = elapsed;
    });

    $("#btnPing").addEventListener('click', async ()=>{
      if(!currentIP){ $("#pingOut").textContent="Primero analiza una IP arriba."; return; }
      $("#pingOut").textContent="Haciendo ping (best-effort)…";
      const t0 = performance.now();
      const r = await pingBestEffort(currentIP);
      const elapsed = Math.round(performance.now() - t0);
      const txt = r.alive
        ? `IP activa (≈${r.rtt_ms} ms; estimado) · Verificación: ${elapsed} ms`
        : `No responde (posible bloqueo CORS/MixedContent o apagada) · Verificación: ${elapsed} ms`;
      $("#pingOut").textContent = txt;
      lastPingLine = txt; lastPingMs = elapsed;
    });

    $("#btnScan").addEventListener('click', async ()=>{
      if(!currentIP){ $("#scanOut").textContent="Primero analiza una IP arriba."; return; }
      const raw=$("#portsInput").value.trim();
      const ports=raw.split(/[, \s]+/).map(x=>parseInt(x,10)).filter(x=>Number.isFinite(x)&&x>0&&x<65536);
      if(ports.length===0){ $("#scanOut").textContent="Sin puertos válidos."; return; }
      $("#scanOut").textContent="Escaneando… (best-effort desde navegador)";
      const t0 = performance.now();
      const res=await portScan(currentIP, ports);
      const elapsed = Math.round((performance.now() - t0));
      lastScanMs = elapsed;
      const lines=res.map(o=>{
        if(o.blocked) return `⛔ ${currentIP}:${o.port}${o.tls?"/TLS":""} — bloqueado por navegador (puerto inseguro)`;
        return `${o.open?"🟢":"⚫"} ${currentIP}:${o.port}${o.tls?"/TLS":""} — ${o.open?"posible ABIERTO":"cerrado/bloqueado"} ${o.open?`«${portName(o.port)}»`:""} ${o.rtt_ms?`~${o.rtt_ms}ms`:``}`;
      });
      $("#scanOut").innerHTML =
        lines.join("<br>") +
        `<br><span class="muted">Nota: resultados orientativos; CORS/MixedContent puede afectar.</span>` +
        `<br><span class="muted">Verificación total: ${elapsed} ms</span>`;
      lastScanLines = lines;
    });

    $("#btnPortInfo").addEventListener('click', async ()=>{
      const p = parseInt($("#portQuery").value,10);
      if(!Number.isFinite(p) || p<1 || p>65535){ $("#portInfo").textContent="Introduce un puerto válido (1–65535)."; $("#portLinks").innerHTML=""; return; }
      $("#portInfo").textContent="Buscando…";
      const local = portName(p);
      let lines=[`Servicio conocido: ${local}`];
      const web = await portLookupOnline(p);
      if(web.desc){ lines.push("", escapeHTML(web.desc)); }
      $("#portInfo").innerHTML = lines.join("<br>");
      const links = (web.tips||[]).map(t=> `<a target="_blank" rel="noopener" href="${t.url}">${t.label}</a>`).join("");
      const extra = web.src ? `<a target="_blank" rel="noopener" href="${web.src}">Fuente</a>` : "";
      $("#portLinks").innerHTML = links+" "+extra;
    });

    /* ===== Inicial ===== */
    renderHistory();
    ensureMap();

    /* ===== Deep link ?ip= ===== */
    (function(){
      const u=new URL(location.href); const q=u.searchParams.get('ip');
      if(q){ $("#ipInput").value=q; lookup(); }
    })();
