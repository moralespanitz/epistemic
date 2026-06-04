import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, appendFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { createRequire } from "node:module";
import { parseHypotheses, getHypothesisSpend, fileExists } from "../state/repo.js";
import { buildGraphData } from "./state.js";
import { makeEventReader, type EventReader } from "./events.js";

export interface GraphServer {
  port: number;
  url: string;
  close: () => void;
  eventReader: EventReader;
}

const ALLOWED_EVENT_TYPES = new Set(["open-hypothesis", "new-research", "dismiss-proposal", "fork-node"]);
const MAX_BODY_BYTES = 64 * 1024;

// Resolve cytoscape from node_modules — navigate from the resolved main entry
// to the dist bundle (cytoscape's exports map blocks ./package.json).
const req = createRequire(import.meta.url);
const CYTOSCAPE_PATH = join(dirname(req.resolve("cytoscape")), "cytoscape.min.js");

// Embedded client HTML — Cytoscape.js graph, bundled locally (no CDN).
const CLIENT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Ξ epistemic · graph</title>
<script>/* CYTOSCAPE_PLACEHOLDER */</script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d0a04;color:#f59e0b;font-family:'SF Mono','Fira Code',ui-monospace,monospace;font-size:13px;height:100vh;overflow:hidden}
#header{padding:14px 22px;display:flex;align-items:center;gap:14px;border-bottom:1px solid #1c1408;background:linear-gradient(180deg,#140e06,#0d0a04)}
#header .mark{font-size:15px;color:#fbbf24;font-weight:600;letter-spacing:.5px}
#header .title{font-size:13px;color:#c9a25e}
#header .stats{margin-left:auto;display:flex;gap:14px;font-size:11px}
#header .stats span{display:flex;align-items:center;gap:5px;color:#8a7a5a}
#header .dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.dot-run{background:#f59e0b}.dot-ok{background:#22c55e}.dot-kill{background:#ef4444}
#cy{width:100vw;height:calc(100vh - 51px);background:radial-gradient(circle at 50% 35%,#161009 0%,#0d0a04 70%)}
#card{position:fixed;top:70px;right:22px;width:280px;background:rgba(26,18,6,.97);border:1px solid #f59e0b;border-radius:12px;padding:18px;display:none;z-index:100;box-shadow:0 8px 32px rgba(0,0,0,.5);backdrop-filter:blur(8px)}
#card .cid{color:#fbbf24;font-size:15px;font-weight:600;letter-spacing:.5px}
#card .cstatuspill{display:inline-block;margin-left:8px;font-size:10px;padding:2px 8px;border-radius:10px;vertical-align:middle}
#card .claim{color:#cbb48a;font-size:12px;margin:10px 0 14px;line-height:1.55}
#card .row{display:flex;justify-content:space-between;font-size:11px;color:#8a7a5a;padding:4px 0;border-top:1px solid #2a2010}
#card .row b{color:#f59e0b;font-weight:500}
#card .gates{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}
#card .gate{font-size:10px;padding:3px 8px;border-radius:6px;background:#241a0a;color:#6b5d40}
#card .gate.on{background:#10301a;color:#22c55e}
#card .costbar{height:6px;border-radius:3px;background:#241a0a;margin-top:10px;overflow:hidden}
#card .costbar>i{display:block;height:100%;background:linear-gradient(90deg,#22c55e,#f59e0b);border-radius:3px}
#card .open-btn{display:block;width:100%;margin-top:14px;padding:10px;background:#f59e0b;color:#0d0a04;border:none;border-radius:8px;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;transition:.15s}
#card .open-btn:hover{background:#fbbf24;transform:translateY(-1px)}
#card .forkrow{display:flex;gap:8px;margin-top:8px}
#card .fork-btn{flex:1;padding:8px 6px;background:transparent;color:#c9a25e;border:1px solid #5a4a2a;border-radius:8px;font-family:inherit;font-size:10px;cursor:pointer;transition:.15s}
#card .fork-btn:hover{border-color:#f59e0b;color:#f59e0b;background:rgba(245,158,11,.08)}
#card .dismiss-btn{display:block;width:100%;margin-top:8px;padding:8px;background:transparent;color:#6b5d40;border:1px solid #2a2010;border-radius:8px;font-family:inherit;font-size:11px;cursor:pointer}
#card .dismiss-btn:hover{border-color:#ef4444;color:#ef4444}
#card .x{position:absolute;top:14px;right:16px;color:#6b5d40;cursor:pointer;font-size:14px}
#card .x:hover{color:#f59e0b}
#new-btn{position:fixed;bottom:24px;right:24px;background:rgba(20,14,6,.9);border:1.5px dashed #f59e0b;color:#f59e0b;border-radius:10px;padding:12px 22px;font-family:inherit;font-size:13px;font-weight:500;cursor:pointer;opacity:.85;transition:.2s}
#new-btn:hover{opacity:1;background:#f59e0b;color:#0d0a04;border-style:solid}
#empty{display:none;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;color:#3a3018}
#empty .o{font-size:40px;opacity:.4}
#empty p{margin-top:10px;font-size:13px;color:#6b5d40}
#hint{position:fixed;bottom:24px;left:24px;font-size:10px;color:#3a3018}
</style>
</head>
<body>
<div id="header">
  <span class="mark">Ξ epistemic</span>
  <span class="title" id="ht"></span>
  <span class="stats" id="hs"></span>
</div>
<div id="cy"></div>
<div id="card">
  <span class="x" onclick="closeCard()">✕</span>
  <div><span class="cid" id="cid"></span><span class="cstatuspill" id="cpill"></span></div>
  <div class="claim" id="cclaim"></div>
  <div class="row"><span>Stage</span><b id="cstage"></b></div>
  <div class="row"><span>Cost</span><b id="ccost"></b></div>
  <div class="costbar"><i id="cbar"></i></div>
  <div class="gates" id="cgates"></div>
  <button class="open-btn" onclick="openInTerminal()">Open terminal →</button>
  <div class="forkrow" id="cforkrow" style="display:none">
    <button class="fork-btn" onclick="forkNode('hypothesis')">⑂ Sub-hypothesis</button>
    <button class="fork-btn" onclick="forkNode('ablation')">⊟ Ablation</button>
  </div>
  <button class="dismiss-btn" id="cdismiss" onclick="dismissProposal()" style="display:none">Dismiss proposal</button>
</div>
<div id="empty"><div class="o">○</div><p>No research document yet.</p><p>Type <span style="color:#f59e0b">/research</span> in the terminal</p></div>
<button id="new-btn" onclick="send({type:'new-research'})">+ New Research</button>
<div id="hint">scroll to zoom · drag to pan</div>
<script>
const COLORS={
  proposed:{border:'#f59e0b',bg:'rgba(245,158,11,.06)',text:'#c9a25e'},
  OPEN:    {border:'#f59e0b',bg:'rgba(245,158,11,.10)',text:'#f59e0b'},
  RUNNING: {border:'#f59e0b',bg:'rgba(245,158,11,.20)',text:'#fbbf24'},
  CONFIRMED:{border:'#22c55e',bg:'rgba(34,197,94,.18)',text:'#22c55e'},
  FALSIFIED:{border:'#ef4444',bg:'rgba(239,68,68,.10)',text:'#ef4444'},
  KILLED:  {border:'#ef4444',bg:'rgba(239,68,68,.22)',text:'#b45252'},
};
const STATUS_LABEL={proposed:'proposed',OPEN:'open',RUNNING:'running',CONFIRMED:'confirmed',FALSIFIED:'falsified',KILLED:'killed'};
let cy=null, sel=null, lastSig='';

async function send(ev){try{await fetch('/api/event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(ev)})}catch{}}
function openInTerminal(){if(sel)send({type:'open-hypothesis',id:sel.id});closeCard()}
function dismissProposal(){if(sel)send({type:'dismiss-proposal',id:sel.id});closeCard()}
function forkNode(kind){if(sel)send({type:'fork-node',id:sel.id,kind:kind});closeCard()}
function closeCard(){document.getElementById('card').style.display='none';sel=null}

function showCard(n){
  sel=n;
  const c=COLORS[n.status]||COLORS.proposed;
  document.getElementById('cid').textContent=n.id;
  const pill=document.getElementById('cpill');
  pill.textContent=STATUS_LABEL[n.status]||n.status;
  pill.style.background=c.bg;pill.style.color=c.text;pill.style.border='1px solid '+c.border;
  document.getElementById('cclaim').textContent=n.label;
  document.getElementById('cstage').textContent=n.stage>0?n.stage+' / 9':'—';
  document.getElementById('ccost').textContent=n.costCap>0?'$'+n.spent.toFixed(2)+' / $'+n.costCap:'—';
  const pct=n.costCap>0?Math.min(100,n.spent/n.costCap*100):0;
  document.getElementById('cbar').style.width=pct+'%';
  const g=n.gates;
  document.getElementById('cgates').innerHTML=g
    ?[['prereg','prereg'],['judge','judgeLock'],['baseline','baseline'],['falsif','falsif']]
       .map(([lbl,k])=>'<span class="gate '+(g[k]?'on':'')+'">'+(g[k]?'✓':'○')+' '+lbl+'</span>').join('')
    :'<span class="gate">not registered yet</span>';
  document.getElementById('cdismiss').style.display=n.isProposal?'block':'none';
  // A node that's still in flight can spawn sub-hypotheses / ablations.
  document.getElementById('cforkrow').style.display=n.forkable?'flex':'none';
  document.getElementById('card').style.display='block';
}

// Node kind → cytoscape shape. Hypotheses are circles; ablations are
// hexagons; forks are diamonds; baselines are tags (rounded rectangles).
const KIND_SHAPE={hypothesis:'ellipse',ablation:'hexagon',fork:'diamond',baseline:'round-tag'};

function buildElements(data){
  const els=[{data:{id:'root',label:data.root.label,kind:'root'}}];
  for(const n of data.nodes){
    els.push({data:{id:n.id,label:n.id,kind:'hyp',shape:KIND_SHAPE[n.kind]||'ellipse',status:n.status,node:n}});
    els.push({data:{id:'e-'+n.id,source:(n.parent||'root'),target:n.id}});
  }
  return els;
}

function nodeStyle(){
  return [
    {selector:'node[kind="root"]',style:{
      'shape':'round-rectangle','background-color':'#1a1206','border-color':'#5a4a2a','border-width':1.5,
      'label':'data(label)','color':'#d4a85e','font-size':13,'font-weight':600,'font-family':"'SF Mono',monospace",
      'text-valign':'center','text-halign':'center','text-wrap':'wrap','text-max-width':'180px',
      'width':210,'height':54,'padding':'12px'
    }},
    {selector:'node[kind="hyp"]',style:{
      'shape':'data(shape)','width':70,'height':70,'border-width':3,
      'label':'data(label)','color':'#f5ecd8','font-size':13,'font-weight':700,'font-family':"'SF Mono',monospace",
      'text-valign':'center','text-halign':'center','text-outline-color':'#0d0a04','text-outline-width':2
    }},
    // Ablations and forks render a touch smaller than primary hypotheses.
    {selector:'node[shape="hexagon"]',style:{'width':56,'height':56,'font-size':11}},
    {selector:'node[shape="diamond"]',style:{'width':62,'height':62,'font-size':11}},
    // Status only drives border + fill — the ID label stays high-contrast.
    ...Object.entries(COLORS).map(([st,c])=>({
      selector:'node[status="'+st+'"]',
      style:{'background-color':c.bg,'border-color':c.border}
    })),
    {selector:'node[status="proposed"]',style:{'border-style':'dashed','opacity':.8}},
    {selector:'node[status="KILLED"]',style:{'opacity':.55}},
    {selector:'node:selected',style:{'border-width':4,'overlay-opacity':0}},
    {selector:'edge',style:{
      'width':1.5,'line-color':'#3a2e16','curve-style':'bezier',
      'target-arrow-shape':'none','opacity':.6
    }}
  ];
}

function render(data){
  const hasNodes=data.nodes.length>0;
  document.getElementById('empty').style.display=hasNodes?'none':'block';
  document.getElementById('cy').style.display=hasNodes?'block':'none';
  if(!hasNodes){document.getElementById('ht').textContent='';document.getElementById('hs').textContent='';return;}
  document.getElementById('ht').textContent=data.root.label;
  const r=data.nodes.filter(n=>n.status==='RUNNING').length,
        c=data.nodes.filter(n=>n.status==='CONFIRMED').length,
        k=data.nodes.filter(n=>n.status==='KILLED').length;
  document.getElementById('hs').innerHTML=
    '<span><i class="dot dot-run"></i>'+r+' running</span>'+
    '<span><i class="dot dot-ok"></i>'+c+' confirmed</span>'+
    '<span><i class="dot dot-kill"></i>'+k+' killed</span>';

  // Signature: only rebuild the graph when topology/status actually changes,
  // so live polling doesn't reset zoom/pan every 2s.
  const sig=data.nodes.map(n=>n.id+':'+n.status).join('|')+'#'+data.root.label;
  if(cy && sig===lastSig){
    // update node payloads in place (cost/gates/stage may have changed)
    for(const n of data.nodes){const el=cy.getElementById(n.id);if(el)el.data('node',n);}
    if(sel){const fresh=data.nodes.find(n=>n.id===sel.id);if(fresh)showCard(fresh);}
    return;
  }
  lastSig=sig;

  if(cy)cy.destroy();
  cy=cytoscape({
    container:document.getElementById('cy'),
    elements:buildElements(data),
    style:nodeStyle(),
    layout:{name:'breadthfirst',directed:true,spacingFactor:1.6,padding:60,roots:['root']},
    minZoom:.3,maxZoom:2.5,wheelSensitivity:.3
  });
  cy.on('tap','node[kind="hyp"]',ev=>{showCard(ev.target.data('node'))});
  cy.on('tap',ev=>{if(ev.target===cy)closeCard()});
}

async function poll(){try{const r=await fetch('/api/state');if(r.ok)render(await r.json())}catch{}}
poll();setInterval(poll,2000);
</script>
</body>
</html>`;

async function safeRead(path: string): Promise<string> {
  try { return await readFile(path, "utf8"); } catch { return ""; }
}

function isLocalOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin ?? "";
  return !origin || origin === "null" || /^https?:\/\/localhost(:\d+)?$/.test(origin);
}

async function handleState(cwd: string, res: ServerResponse): Promise<void> {
  const [researchMd, hypothesesMd, resultsMd] = await Promise.all([
    safeRead(join(cwd, "RESEARCH.md")),
    safeRead(join(cwd, "HYPOTHESES.md")),
    safeRead(join(cwd, "RESULTS.md")),
  ]);

  const hypotheses = hypothesesMd ? parseHypotheses(hypothesesMd) : [];
  const spendMap: Record<string, number> = {};
  await Promise.all(
    hypotheses.map(async h => {
      spendMap[h.id] = await getHypothesisSpend(cwd, h.id);
    })
  );

  const data = buildGraphData(researchMd, hypothesesMd, spendMap, resultsMd);

  // Enrich registered nodes with gate data from disk
  for (const node of data.nodes) {
    if (node.isProposal) continue;
    const expDir = join(cwd, "experiments", node.id);
    const [prereg, judgeLock, baseline] = await Promise.all([
      fileExists(join(expDir, "prereg.md")),
      fileExists(join(expDir, "judge.lock")),
      fileExists(join(expDir, "baseline.md")),
    ]);
    node.gates = {
      prereg,
      judgeLock,
      baseline,
      falsif: resultsMd.includes(node.id),
    };
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

async function handleEvent(cwd: string, request: IncomingMessage, res: ServerResponse): Promise<void> {
  let body = "";
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) { res.writeHead(413); res.end("Request too large"); return; }
    body += chunk;
  }
  let event: Record<string, unknown>;
  try { event = JSON.parse(body); } catch { res.writeHead(400); res.end("Invalid JSON"); return; }
  if (!ALLOWED_EVENT_TYPES.has(String(event.type))) {
    res.writeHead(400); res.end("Unknown event type"); return;
  }
  await mkdir(join(cwd, ".epistemic"), { recursive: true });
  await appendFile(
    join(cwd, ".epistemic/graph-events.jsonl"),
    JSON.stringify({ ...event, timestamp: Date.now() }) + "\n"
  );
  res.writeHead(204); res.end();
}

export async function startGraphServer(cwd: string, serverStartTime: number): Promise<GraphServer> {
  const cytoscapeSource = await readFile(CYTOSCAPE_PATH, "utf8");
  // Use a replacement FUNCTION, not a string: minified bundles contain
  // "$&" (and other $-patterns) which String.replace would interpret as
  // match-insertion specials, corrupting the bundle and breaking the graph.
  const html = CLIENT_HTML.replace("/* CYTOSCAPE_PLACEHOLDER */", () => cytoscapeSource);

  const server: Server = createServer(async (request, res) => {
    const url = new URL(request.url ?? "/", "http://localhost");

    if (!isLocalOrigin(request)) { res.writeHead(403); res.end("Forbidden"); return; }
    res.setHeader("Access-Control-Allow-Origin", request.headers.origin ?? "null");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (request.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    try {
      if ((url.pathname === "/" || url.pathname === "/index.html") && request.method === "GET") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html); return;
      }
      if (url.pathname === "/api/state" && request.method === "GET") {
        await handleState(cwd, res); return;
      }
      if (url.pathname === "/api/event" && request.method === "POST") {
        await handleEvent(cwd, request, res); return;
      }
      res.writeHead(404); res.end("Not found");
    } catch (err) {
      res.writeHead(500); res.end(String(err));
    }
  });

  const port = await new Promise<number>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      typeof addr === "object" && addr ? resolve(addr.port) : reject(new Error("No port"));
    });
  });

  const eventReader = makeEventReader(cwd, serverStartTime);
  return { port, url: `http://localhost:${port}`, close: () => server.close(), eventReader };
}
