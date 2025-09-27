const $ = (selector, parent = document) => parent.querySelector(selector);

// --- Typewriter message
const msg = "WF TOOLS se encuentra en mantenimiento. Pronto estaremos de regreso. Gracias por tu paciencia.😊";
const typeEl = $("#type");
let typeIndex = 0;
let typing;

function type(){
  if(typeIndex <= msg.length){
    typeEl.innerHTML = msg.slice(0, typeIndex) + "<span class=\"caret\">&nbsp;</span>";
    typeIndex++;
    typing = setTimeout(type, 28);
  }else{
    typeEl.textContent = msg;
  }
}

type();

// --- Status widgets
const checkEl = $("#check");
const progEl = $("#prog");

function stamp(){
  const now = new Date();
  checkEl.textContent = now.toLocaleString();
}

stamp();

$("#refresh").addEventListener("click", () =>{
  stamp();
  const current = Number(progEl.textContent.replace("%", ""));
  const next = Math.min(100, Math.floor(Math.random() * 18) + current);
  progEl.textContent = next + "%";
  flash("#refresh");
});

function flash(sel){
  const el = $(sel);
  if(!el) return;
  el.animate([
    {transform:"scale(1)"},
    {transform:"scale(1.04)"},
    {transform:"scale(1)"}
  ],{
    duration:240,
    easing:"ease-out"
  });
}

// --- High contrast and effects toggles
const contrast = $("#contrast");
const fx = $("#fx");

const originalFg = getComputedStyle(document.documentElement).getPropertyValue("--fg");

contrast.checked = true;
document.documentElement.style.setProperty("--fg", "#ffffff");
document.body.style.filter = "contrast(1.2) saturate(1.1)";

contrast.addEventListener("change", ()=>{
  const active = contrast.checked;
  document.documentElement.style.setProperty("--fg", active ? "#ffffff" : originalFg.trim());
  document.body.style.filter = active ? "contrast(1.2) saturate(1.1)" : "";
});

addEventListener("keydown", (e)=>{
  const key = e.key.toLowerCase();
  if(key === "h"){
    contrast.checked = !contrast.checked;
    contrast.dispatchEvent(new Event("change"));
  }
  if(key === "m"){
    fx.checked = !fx.checked;
    fx.dispatchEvent(new Event("change"));
  }
  if(key === "b"){
    toggleBg();
  }
});

// --- Background particles
const canvas = document.getElementById("bg");
const ctx = canvas.getContext("2d");
let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
let W;
let H;
let particles = [];
let running = true;
let altBg = false;

function resize(){
  W = canvas.width = Math.floor(innerWidth * dpr);
  H = canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  const area = Math.max(W * H, 1);
  const count = Math.max(24, Math.floor(area / (14000 * dpr)));
  particles = new Array(count).fill(0).map(()=>makeParticle());
}

function makeParticle(){
  return {
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 1.6 + 0.3,
    vx: (Math.random() - 0.5) * 0.25 * dpr,
    vy: (Math.random() - 0.5) * 0.25 * dpr,
    a: Math.random() * 360
  };
}

function draw(){
  if(!running) return;

  const gradient = ctx.createRadialGradient(W * 0.5, H * -0.1, 100 * dpr, W * 0.5, H * 0.2, Math.max(W, H));
  if(!altBg){
    gradient.addColorStop(0, "rgba(24, 47, 79, .6)");
    gradient.addColorStop(1, "rgba(2, 8, 23, 1)");
  }else{
    gradient.addColorStop(0, "rgba(12, 36, 68, .6)");
    gradient.addColorStop(1, "rgba(2, 10, 24, 1)");
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for(const p of particles){
    p.x += p.vx;
    p.y += p.vy;
    p.a += 0.6;
    if(p.x < 0) p.x = W;
    if(p.x > W) p.x = 0;
    if(p.y < 0) p.y = H;
    if(p.y > H) p.y = 0;
    const glow = 0.25 + 0.75 * Math.abs(Math.sin(p.a * Math.PI / 180));
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(56,189,248," + (0.06 + glow * 0.12) + ")";
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,.04)";
  ctx.lineWidth = dpr;
  const step = 64 * dpr;
  const offset = (performance.now() / 40) % step;

  for(let x = offset; x < W; x += step){
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for(let y = offset; y < H; y += step){
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  requestAnimationFrame(draw);
}

function toggleBg(){
  altBg = !altBg;
  flash("body");
}

fx.addEventListener("change", ()=>{
  running = fx.checked;
  if(running){
    draw();
  }
});

document.addEventListener("visibilitychange", ()=>{
  if(document.hidden){
    running = false;
  }else if(fx.checked){
    running = true;
    draw();
  }
});

addEventListener("resize", resize, {passive:true});
resize();
draw();

// --- Uptime counter
const start = Date.now();
const uptime = document.getElementById("uptime");
setInterval(()=>{
  const seconds = Math.floor((Date.now() - start) / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  const minuteText = minutes ? minutes + "m " : "";
  uptime.textContent = "Tiempo en pagina: " + minuteText + remainder + "s";
}, 1000);
