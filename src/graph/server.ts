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

const ALLOWED_EVENT_TYPES = new Set(["open-hypothesis", "new-research", "dismiss-proposal"]);
const MAX_BODY_BYTES = 64 * 1024;

// Resolve d3 from node_modules — navigate from package root to dist/
// (d3's exports map blocks ./package.json, so we resolve the main entry and go up)
const req = createRequire(import.meta.url);
const D3_PATH = join(dirname(dirname(req.resolve("d3"))), "dist", "d3.min.js");

// Embedded client HTML — no file path fragility
const CLIENT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Ξ epistemic · graph</title>
<script>/* D3_PLACEHOLDER */</script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0f0a00;color:#f59e0b;font-family:'SF Mono','Fira Code',monospace;font-size:13px;height:100vh;overflow:hidden}
#header{padding:12px 20px;border-bottom:1px solid #1a1000;display:flex;align-items:center;gap:12px}
#header h1{font-size:14px;color:#fbbf24;font-weight:normal}
#header .stats{color:#888;font-size:11px;margin-left:auto}
#graph{width:100vw;height:calc(100vh - 49px)}
.node{cursor:pointer}
.node text{fill:#f59e0b;font-size:11px;pointer-events:none}
.node .sub{fill:#888;font-size:9px}
.link{fill:none;stroke:#333;stroke-width:1.5px}
.status-proposed circle{fill:none;stroke:#f59e0b;stroke-width:1.5;stroke-dasharray:4,2;opacity:.6}
.status-OPEN circle{fill:none;stroke:#f59e0b;stroke-width:2}
.status-RUNNING circle{fill:#f59e0b;fill-opacity:.15;stroke:#f59e0b;stroke-width:2;animation:pulse 2s ease-in-out infinite}
.status-CONFIRMED circle{fill:#22c55e;fill-opacity:.15;stroke:#22c55e;stroke-width:2}
.status-FALSIFIED circle{fill:none;stroke:#ef4444;stroke-width:2}
.status-KILLED circle{fill:#ef4444;fill-opacity:.3;stroke:#ef4444;opacity:.6}
@keyframes pulse{0%,100%{fill-opacity:.1}50%{fill-opacity:.3}}
#card{position:fixed;top:60px;right:20px;width:240px;background:#1a1000;border:1px solid #f59e0b;border-radius:8px;padding:16px;display:none;z-index:100}
#card h3{color:#fbbf24;font-size:12px;margin-bottom:4px}
#card .claim{color:#888;font-size:11px;margin-bottom:12px;line-height:1.5}
#card .meta{font-size:11px;color:#888;line-height:2}
#card .hl{color:#f59e0b}
#card .gates{font-size:10px;color:#555;margin:8px 0;line-height:1.8}
#card .ok{color:#22c55e}
#card .open-btn{display:block;width:100%;margin-top:12px;padding:8px;background:#f59e0b;color:#000;border:none;border-radius:4px;font-family:inherit;font-size:11px;cursor:pointer}
#card .open-btn:hover{background:#fbbf24}
#card .dismiss-btn{display:block;width:100%;margin-top:6px;padding:6px;background:transparent;color:#555;border:1px solid #333;border-radius:4px;font-family:inherit;font-size:11px;cursor:pointer}
#card .x{position:absolute;top:10px;right:12px;color:#555;cursor:pointer}
#new-btn{position:fixed;bottom:20px;right:20px;background:transparent;border:2px dashed #f59e0b;color:#f59e0b;border-radius:8px;padding:12px 20px;font-family:inherit;font-size:13px;cursor:pointer;opacity:.7;transition:opacity .2s}
#new-btn:hover{opacity:1}
#empty{display:none;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;color:#333}
#empty p{margin-top:8px;font-size:12px}
</style>
</head>
<body>
<div id="header">
  <h1>Ξ epistemic</h1>
  <span id="ht" style="color:#888"></span>
  <span class="stats" id="hs"></span>
</div>
<svg id="graph"></svg>
<div id="card">
  <span class="x" onclick="closeCard()">✕</span>
  <h3 id="cid"></h3>
  <div class="claim" id="cclaim"></div>
  <div class="meta">Status:<span class="hl" id="cstatus"></span> Stage:<span class="hl" id="cstage"></span> Cost:<span class="hl" id="ccost"></span></div>
  <div class="gates" id="cgates"></div>
  <button class="open-btn" onclick="openInTerminal()">Open in terminal →</button>
  <button class="dismiss-btn" id="cdismiss" onclick="dismissProposal()" style="display:none">Dismiss proposal</button>
</div>
<div id="empty"><div style="font-size:32px;color:#333">○</div><p>No research document yet.</p><p>Type <span style="color:#f59e0b">/new</span> in the terminal.</p></div>
<button id="new-btn" onclick="send({type:'new-research'})">+ New Research</button>
<script>
let sel=null;
async function send(ev){try{await fetch('/api/event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(ev)})}catch{}}
function openInTerminal(){if(sel)send({type:'open-hypothesis',id:sel.id});closeCard()}
function dismissProposal(){if(sel)send({type:'dismiss-proposal',id:sel.id});closeCard()}
function closeCard(){document.getElementById('card').style.display='none';sel=null}
function showCard(n){
  sel=n;
  document.getElementById('cid').textContent=n.id;
  document.getElementById('cclaim').textContent=n.label;
  document.getElementById('cstatus').textContent=' '+n.status;
  document.getElementById('cstage').textContent=n.stage>0?' '+n.stage+'/9':' —';
  document.getElementById('ccost').textContent=n.costCap>0?' $'+n.spent.toFixed(2)+'/$'+n.costCap:' —';
  const g=n.gates;
  document.getElementById('cgates').innerHTML=g
    ?['prereg','judgeLock','baseline','falsif'].map(k=>'<span class="'+(g[k]?'ok':'')+'">'+(g[k]?'✓':'✗')+' '+k+'</span>').join('  ')
    :'<span style="color:#555">not registered</span>';
  document.getElementById('cdismiss').style.display=n.isProposal?'block':'none';
  document.getElementById('card').style.display='block';
}
function render(data){
  document.getElementById('empty').style.display=(data.nodes.length===0)?'block':'none';
  if(!data.nodes.length)return;
  document.getElementById('ht').textContent=data.root.label;
  const r=data.nodes.filter(n=>n.status==='RUNNING').length,
        c=data.nodes.filter(n=>n.status==='CONFIRMED').length,
        k=data.nodes.filter(n=>n.status==='KILLED').length;
  document.getElementById('hs').textContent=r+' running · '+c+' confirmed · '+k+' killed';
  const svg=d3.select('#graph'),W=svg.node().clientWidth||innerWidth,H=svg.node().clientHeight||(innerHeight-49);
  svg.attr('width',W).attr('height',H).selectAll('*').remove();
  const g=svg.append('g').attr('transform','translate('+W/2+',40)');
  const hier=d3.hierarchy({id:'root',isRoot:true,label:data.root.label,children:data.nodes.map(n=>({...n,children:[]}))});
  d3.tree().size([W-80,H-120])(hier);
  g.selectAll('.link').data(hier.links()).enter().append('path').attr('class','link')
    .attr('d',d3.linkVertical().x(d=>d.x-W/2).y(d=>d.y));
  const node=g.selectAll('.node').data(hier.descendants()).enter().append('g')
    .attr('class',d=>d.data.isRoot?'node':'node status-'+d.data.status)
    .attr('transform',d=>'translate('+(d.x-W/2)+','+d.y+')')
    .on('click',(ev,d)=>{if(!d.data.isRoot){showCard(d.data);ev.stopPropagation()}});
  node.filter(d=>d.data.isRoot).append('rect').attr('x',-65).attr('y',-12).attr('width',130).attr('height',24).attr('rx',6).attr('fill','none').attr('stroke','#555').attr('stroke-width',1.5);
  node.filter(d=>d.data.isRoot).append('text').attr('dy','.35em').attr('text-anchor','middle').attr('fill','#888').attr('font-size',11).text(d=>d.data.label.length>22?d.data.label.slice(0,22)+'…':d.data.label);
  node.filter(d=>!d.data.isRoot).append('circle').attr('r',22);
  node.filter(d=>!d.data.isRoot).append('text').attr('dy','-.15em').attr('text-anchor','middle').attr('font-size',9).attr('font-weight','bold').text(d=>d.data.id);
  node.filter(d=>!d.data.isRoot).append('text').attr('class','sub').attr('dy','1.1em').attr('text-anchor','middle').text(d=>{const l=d.data.label;return l.length>13?l.slice(0,13)+'…':l});
  svg.on('click',()=>closeCard());
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
  const d3Source = await readFile(D3_PATH, "utf8");
  const html = CLIENT_HTML.replace("/* D3_PLACEHOLDER */", d3Source);

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
