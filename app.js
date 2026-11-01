(function () {

  /* ============================================================
     CAVEAU — direzione "Elettrico"
     Max fotografa (fronte/retro) → la bottiglia entra in CODA →
     Claude legge l'etichetta e compila ogni campo → CATALOGATA.
     Ciclo di vita: in coda · in cantina · bevuta · venduta.
     Mondo visivo scuro per scelta: nessuno swap di tema, ogni
     colore dichiarato. Il colore è luce di contorno, non campo
     pieno: bordi, basi luminose e aloni, tutti verificati sopra
     4,5:1 sul pannello.
     ============================================================ */

  /* Lo stato non nasce più dentro la pagina: arriva dal database, e questo
     file non sa come. Riceve un oggetto con la stessa forma di prima. */
  var STATE = { meta: {}, bottles: [] };
  function idrata(s) {
    STATE = s && typeof s === 'object' ? s : { meta: {}, bottles: [] };
    if (!STATE.meta) STATE.meta = {};
    if (!STATE.bottles) STATE.bottles = [];
    if (!STATE.meta.titolo) STATE.meta.titolo = 'La mia cantina';
    if (!STATE.meta.valuta) STATE.meta.valuta = 'EUR';
    if (!STATE.meta.mappa || !Array.isArray(STATE.meta.mappa.sezioni)) STATE.meta.mappa = { sezioni: [] };
    applicaStandard();
  }

  var isReadOnly = false, saving = false, attesa = null, firstPaint = true;

  var TIPI = ['Vino', 'Spumante', 'Whisky', 'Rum', 'Gin', 'Grappa', 'Liquore', 'Altro'];
  var COLORI = ['Rosso', 'Bianco', 'Rosé'];
  var TIPI_CON_COLORE = { 'Vino': 1, 'Spumante': 1 };
  var STATI = { da_analizzare: 'In coda', catalogata: 'In cantina', bevuta: 'Bevuta', venduta: 'Venduta', regalata: 'Regalata' };

  var FOTO_MAX_DIM = 1000, FOTO_QUALITA = 0.68;
  // le foto non stanno più nell'elenco: si aprono solo col pulsante,
  // quindi vanno conservate abbastanza grandi da essere davvero guardabili
  var THUMB_MAX_DIM = 520, THUMB_QUALITA = 0.62;
  var SOGLIA_CODA_MB = 5;

  var filters = {
    q: '', ambito: 'cantina', tipi: [], colori: [],
    annataMin: '', annataMax: '', gradMin: '', gradMax: '',
    prezzoBase: 'attuale', prezzoMin: '', prezzoMax: '', segnale: '',
    cantina: '', produttore: '', provenienza: '', vitigno: '', zona: '', scaffale: '',
    soloPlus: false, sort: 'valore-desc', view: 'grid'   // grid | dossier | posizione | table
  };
  var editingId = null, shooting = false, bulk = false, viewing = null;
  var stanza = 'catalogo';   // 01 catalogo · 02 mercato · 03 panoramica
  var railOpen = window.innerWidth > 1000;
  var formPhotos = { fronte: '', retro: '' };
  var bulkPhotos = [], bulkPaired = true;

  function ensureStyle() {
    if (document.getElementById('app-style')) return;
    var st = document.createElement('style');
    st.id = 'app-style'; st.textContent = CSS_TEXT();
    document.head.appendChild(st);
  }
  /* ============================ CSS ============================ */
  function CSS_TEXT() {
    return [
'*,*::before,*::after{box-sizing:border-box}',
':root{',
/* inchiostro, pannelli e filetti presi dal Caveau Private Exchange */
'  --bg:#1C1815; --pan:rgba(44,37,32,.62); --pan2:rgba(54,46,40,.68); --pan3:rgba(64,55,48,.74); --sunk:#120F0D;',
'  --acc:#C9A06A; --acc2:#DDB784; --acc-s:rgba(201,160,106,.28); --bronze:#AA825B; --bronze2:#C9A06A; --wine:#71192D; --wine2:#8E2238; --paper:#F1EEE6;',
'  --glass:rgba(44,37,32,.58); --glass2:rgba(28,24,21,.78); --blur:blur(16px) saturate(1.3);',
'  --ed:rgba(232,224,209,.14); --ed2:rgba(232,224,209,.27);',
'  --t1:#F1EBE0; --t2:#B3A695; --t3:#807469;',
'  --carta:#F2ECE1; --carta2:#E8E0D1;',
/* cinque famiglie, tinte validate sul fondo scuro (CVD + contrasto >= 4,5:1).
   Qui il colore è LUCE DI CONTORNO: bordo, base accesa, alone. La tipologia
   esatta resta comunque scritta su ogni scheda. */
'  --cremisi:#E0556A;  --cremisi-s:rgba(224,85,106,.26);',
'  --ambra:#C99A4B;    --ambra-s:rgba(201,154,75,.26);',
'  --teal:#25A896;     --teal-s:rgba(37,168,150,.26);',
'  --violetto:#9A89EE; --violetto-s:rgba(154,137,238,.26);',
'  --lime:#8FBF4A;     --lime-s:rgba(143,191,74,.26);',
'  --neutro:#8A7F72;   --neutro-s:rgba(138,127,114,.24);',
/* i due colori di casa Caveau: il vino riempie, il bronzo scrive */
'  --vino:#71192D;     --vino-s:rgba(113,25,45,.30);   --vino-d:#4A111E; --vino-n:#351018;',
'  --bronzo:#AA825B;   --bronzo-s:rgba(170,130,91,.22); --bronzo2:#D4AD86;',
'  --pos:#8FA882; --neg:#D08A8A; --warn:#C99A4B;',
'  --sans:Figtree,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;',
'  --mono:"IBM Plex Mono",ui-monospace,Menlo,Consolas,"Courier New",monospace;',
'}',
'html{background:var(--bg)}',
/* la vinaccia non sta solo nella testata: bagna tutta la pagina, e resta
   ferma mentre si scorre, come la luce di una cantina */
'body{background:radial-gradient(130% 70% at 50% 0%,rgba(74,17,30,.42),transparent 62%),radial-gradient(1100px 640px at 6% -8%,rgba(201,160,106,.17),transparent 62%),radial-gradient(900px 620px at 104% 14%,rgba(142,34,56,.22),transparent 60%),radial-gradient(760px 520px at 48% 112%,rgba(14,154,140,.08),transparent 60%),var(--bg);',
'  background-attachment:fixed;color:var(--t1)}',
'body{margin:0;font-family:var(--sans);font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased}',
'h1,h2,h3{margin:0;text-wrap:balance}',
'p{margin:0}',
'button,input,select,textarea{font:inherit;color:inherit}',
'button{cursor:pointer;background:none;border:none;padding:0;color:inherit}',
'.tab{font-variant-numeric:tabular-nums}',
'.mono{font-family:var(--mono)}',
':focus-visible{outline:2px solid var(--bronzo);outline-offset:2px;border-radius:6px}',

/* ---------------- testata ---------------- */
'.mast{position:relative;overflow:hidden;padding:36px 30px 26px}',
'.mast::before{content:"";position:absolute;inset:0;pointer-events:none;',
'  background:linear-gradient(104deg,rgba(142,34,56,.34),transparent 42%),',
'             linear-gradient(256deg,rgba(198,154,108,.15),transparent 40%),',
'             radial-gradient(64% 92% at 50% 128%,rgba(224,85,106,.13),transparent 72%)}',
'.mast::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;',
'  background:linear-gradient(90deg,var(--vino),var(--cremisi) 26%,var(--ambra) 50%,var(--bronzo) 74%,var(--teal))}',
'.mast-in{max-width:1500px;margin:0 auto;position:relative;z-index:1}',
'.eb{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--bronzo)}',
'.mast h1{font-weight:700;font-size:clamp(36px,6.2vw,68px);line-height:.94;letter-spacing:-.038em;margin:12px 0 0}',
'.mast .sub{color:var(--t2);font-size:13.5px;margin:12px 0 24px;max-width:54ch}',
'.mast .ren{font-family:var(--mono);color:var(--t3);font-size:11.5px;text-decoration:underline;text-underline-offset:3px}',
'.mast .ren:hover{color:var(--bronzo)}',
'.lgrid{display:flex;gap:9px;flex-wrap:wrap}',
'.lc{border:1px solid var(--ed);background:var(--pan);padding:12px 16px 13px;min-width:136px;flex:1 1 136px;position:relative;overflow:hidden}',
'.lc::after{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--ac);box-shadow:0 0 12px 0 var(--ac)}',
'.lc .n{font-weight:700;font-size:clamp(22px,2.6vw,29px);line-height:1;letter-spacing:-.032em}',
'.lc .c{font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--t3);margin-top:8px}',
'.lc .up{font-family:var(--mono);font-size:12px;margin-left:7px;letter-spacing:-.02em}',
'.up.pos{color:var(--pos)} .up.neg{color:var(--neg)}',

/* composizione: magnitudo a tinta unica, ogni riga etichettata */
'.compo{margin-top:22px;padding-top:18px;border-top:1px solid var(--ed)}',
'.compo.bare{margin-top:0;padding-top:0;border-top:none}',
'.compo h3{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--t3);margin-bottom:12px}',
'.crow{display:grid;grid-template-columns:104px 1fr 34px;align-items:center;gap:12px;padding:3px 0;position:relative}',
'.clab{font-family:var(--mono);font-size:11.5px;color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'.ctrack{height:8px;background:var(--pan2);border-radius:4px;overflow:hidden}',
'.cbar{height:100%;background:var(--bronzo);border-radius:4px;box-shadow:0 0 14px -2px var(--bronzo);transform-origin:left;animation:gx .6s cubic-bezier(.2,.8,.3,1) both}',
'@keyframes gx{from{transform:scaleX(0)}to{transform:scaleX(1)}}',
'.cnum{font-family:var(--mono);font-size:11.5px;text-align:right;color:var(--t2)}',
'.ctip{position:absolute;left:116px;bottom:15px;background:var(--sunk);border:1px solid var(--ed2);color:var(--t1);font-family:var(--mono);font-size:11px;padding:5px 9px;border-radius:6px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .12s;z-index:8}',
'.crow:hover .ctip,.crow:focus-within .ctip{opacity:1}',

/* ---------------- impianto ---------------- */
'.app{display:flex;align-items:flex-start;max-width:1500px;margin:0 auto}',
'.rail{width:270px;flex:0 0 270px;border-right:1px solid var(--ed);padding:18px 18px 50px;position:sticky;top:0;max-height:100vh;overflow-y:auto;background:var(--bg)}',
'.rsec{padding-bottom:15px;margin-bottom:15px;border-bottom:1px solid var(--ed)}',
'.rsec:last-of-type{border-bottom:none}',
'.rhd{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px}',
'.rhd h2{font-weight:700;font-size:20px;letter-spacing:-.03em}',
'.flab{display:block;font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--t3);margin-bottom:9px}',
'.chips{display:flex;flex-wrap:wrap;gap:5px}',
'.chip{border:1px solid var(--ed);background:var(--pan);border-radius:8px;padding:5px 11px;font-family:var(--mono);font-size:11.5px;letter-spacing:.02em;color:var(--t2);transition:border-color .14s,color .14s,box-shadow .14s}',
'.chip:hover{border-color:var(--ed2);color:var(--t1)}',
'.chip.on{border-color:var(--bronzo);color:var(--bronzo);box-shadow:0 0 0 1px rgba(198,154,108,.25),0 0 18px -5px var(--bronzo)}',
'.duo{display:flex;gap:6px}.duo>*{width:100%;min-width:0}',
'input[type=text],input[type=number],input[type=date],input[type=search],select,textarea{width:100%;background:var(--pan2);border:1px solid var(--ed);border-radius:8px;padding:8px 10px;font-size:13px;color:var(--t1)}',
'input[type=number],input[type=date]{font-family:var(--mono)}',
'input::placeholder{color:var(--t3)}',
'select{cursor:pointer}',
'textarea{resize:vertical}',
'.chk{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--t2);margin-top:10px;cursor:pointer}',
'.lnk{font-family:var(--mono);font-size:11.5px;color:var(--bronzo);text-decoration:underline;text-underline-offset:3px}',
'.main{flex:1;min-width:0}',

/* barra strumenti */
'.tools{position:sticky;top:0;z-index:20;background:rgba(8,7,10,.9);backdrop-filter:blur(12px);border-bottom:1px solid var(--ed);padding:11px 24px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
'.btn{border:1px solid var(--ed);background:var(--pan);border-radius:9px;padding:8px 14px;font-size:12.5px;font-weight:600;display:inline-flex;align-items:center;gap:7px;white-space:nowrap;transition:border-color .14s,box-shadow .14s,transform .1s}',
'.btn:hover{border-color:var(--ed2)}',
'.btn:active{transform:translateY(1px)}',
'.btn.pri{background:var(--bronzo);border-color:var(--bronzo);color:#191110;box-shadow:0 0 26px -10px var(--bronzo)}',
'.btn.pri:hover{background:#9789E6;border-color:#9789E6}',
'.btn.gho{background:none}',
'.btn.sm{padding:6px 11px;font-size:11.5px;border-radius:7px}',
'.btn.dgr{color:var(--neg);border-color:#3B2530}',
'.btn.dgr:hover{border-color:var(--neg);box-shadow:0 0 20px -10px var(--neg)}',
'.search{flex:1;min-width:150px}',
'.seg{display:flex;border:1px solid var(--ed);border-radius:9px;overflow:hidden}',
'.seg button{padding:8px 13px;font-family:var(--mono);font-size:11.5px;color:var(--t2)}',
'.seg button.on{background:var(--bronzo);color:#191110}',
'.content{padding:22px 24px 70px}',

/* avvisi */
'.note{border:1px solid var(--ed);border-radius:12px;padding:16px 18px;margin-bottom:15px;display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;background:var(--pan);position:relative;overflow:hidden}',
'.note::after{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--ac,var(--ed2))}',
'.note.demo{--ac:var(--bronzo)}',
'.note.queue{--ac:var(--ambra)}',
'.note.warn{--ac:var(--neg)}',
'.note .big{font-weight:700;font-size:40px;line-height:.9;letter-spacing:-.04em;color:var(--ambra)}',
'.note .nb{flex:1;min-width:210px}',
'.note h3{font-weight:700;font-size:17.5px;letter-spacing:-.025em;margin-bottom:6px}',
'.note p{font-size:13.2px;color:var(--t2)}',
'.cmd{display:inline-block;margin-top:10px;border:1px dashed var(--ambra);border-radius:7px;color:var(--ambra);padding:5px 11px;font-family:var(--mono);font-size:11.5px}',
'.ro{background:var(--pan2);border-bottom:1px solid var(--ed);padding:9px 24px;font-family:var(--mono);font-size:11.5px;color:var(--warn)}',
'details.help{border:1px solid var(--ed);border-radius:12px;padding:13px 18px;margin-bottom:18px;background:var(--pan)}',
'details.help summary{cursor:pointer;font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--t3)}',
'details.help ol{margin:12px 0 0;padding-left:19px;font-size:13.2px;color:var(--t2)}',
'details.help li{margin-bottom:7px}',
'details.help strong{color:var(--t1)}',

/* ---------------- schede ---------------- */
'.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:15px}',
'.card{background:var(--pan);border:1px solid var(--ed);border-radius:14px;display:flex;flex-direction:column;text-align:left;overflow:hidden;position:relative;transition:transform .18s cubic-bezier(.2,.8,.3,1),border-color .18s,box-shadow .18s}',
'.card:hover{transform:translateY(-4px);border-color:var(--ac);box-shadow:0 0 34px -14px var(--ac)}',
'.card.gone{opacity:.5}.card.gone:hover{opacity:1}',
'.card.coda{border-style:dashed}',
'.fade{animation:fu .38s cubic-bezier(.2,.8,.3,1) both}',
'@keyframes fu{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
'.vit{position:relative;aspect-ratio:1/1.12;display:flex;align-items:flex-end;justify-content:center;overflow:hidden;',
'  background:radial-gradient(70% 44% at 50% 108%,var(--acs),transparent 70%),var(--pan2)}',
'.vit::after{content:"";position:absolute;left:14%;right:14%;bottom:0;height:1px;background:var(--ac);box-shadow:0 0 14px 1px var(--ac)}',
'.vit svg{position:relative;height:85%;width:auto;filter:drop-shadow(0 -3px 18px var(--acs))}',
'.vit img{width:100%;height:100%;object-fit:cover}',
'.stamp{position:absolute;top:9px;left:9px;font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;padding:3.5px 8px;border-radius:6px;border:1px solid var(--ac);color:var(--ac);background:rgba(8,7,10,.76)}',
'.stamp.dem{top:9px;left:auto;right:9px;border-color:var(--ed2);color:var(--t3)}',
'.bd{padding:13px 14px 14px;display:flex;flex-direction:column;gap:6px;flex:1}',
'.mt{display:flex;gap:5px;flex-wrap:wrap;align-items:center}',
'.pl{font-family:var(--mono);font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;padding:3px 7px;border-radius:5px;border:1px solid var(--ed);color:var(--t2)}',
'.pl.ac{border-color:var(--ac);color:var(--ac)}',
'.nm{font-weight:700;font-size:17.5px;letter-spacing:-.028em;line-height:1.14}',
'.mk{font-family:var(--mono);font-size:11px;color:var(--t2);letter-spacing:-.01em}',
'.ft{margin-top:auto;padding-top:9px;border-top:1px solid var(--ed);display:flex;justify-content:space-between;align-items:baseline;gap:8px}',
'.vl{font-weight:700;font-size:16.5px;letter-spacing:-.03em}',
'.dl{font-family:var(--mono);font-size:11.5px}',
'.dl.pos{color:var(--pos)}.dl.neg{color:var(--neg)}.dl.flat{color:var(--t3)}',

/* tabella */
'.tw{overflow-x:auto;border:1px solid var(--ed);border-radius:12px;background:var(--pan)}',
'table{width:100%;border-collapse:collapse;font-size:13px;min-width:1080px}',
'th{position:sticky;top:0;background:var(--pan2);text-align:left;padding:11px 12px;font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--t3);border-bottom:1px solid var(--ed);white-space:nowrap}',
'td{padding:9px 12px;border-bottom:1px solid var(--ed);vertical-align:middle}',
'td.tab{font-family:var(--mono)}',
'tr.r{cursor:pointer}tr.r:hover td{background:var(--pan2)}',
'tr.r.gone td{opacity:.55}',
'td .tnm{font-weight:700;font-size:14.5px;letter-spacing:-.025em}',
'.swatch{display:inline-block;width:7px;height:7px;border-radius:99px;background:var(--ac);box-shadow:0 0 8px 0 var(--ac);margin-right:8px}',
'.rart{width:32px;height:40px;object-fit:cover;border-radius:5px;background:var(--pan2);display:block}',
'.rbox{width:32px;height:40px;border-radius:5px;background:radial-gradient(70% 44% at 50% 108%,var(--acs),transparent 70%),var(--pan2);display:flex;align-items:flex-end;justify-content:center;overflow:hidden}',
'.rbox svg{height:36px;width:auto}',

'.empty{text-align:center;padding:74px 20px;color:var(--t2)}',
'.empty h2{font-weight:700;font-size:27px;letter-spacing:-.035em;color:var(--t1);margin-bottom:11px}',
'.empty p{max-width:46ch;margin:0 auto}',
'.empty .btn{margin-top:20px}',

/* ---------------- schede modali ---------------- */
'.ov{position:fixed;inset:0;background:rgba(4,3,6,.74);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:18px;z-index:100;animation:fd .15s ease}',
'@keyframes fd{from{opacity:0}to{opacity:1}}',
'.sheet{background:var(--pan);border:1px solid var(--ed2);border-radius:16px;max-width:660px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 40px 90px -40px #000;animation:rs .22s cubic-bezier(.2,.8,.3,1) both}',
'.sheet.wide{max-width:800px}',
'@keyframes rs{from{opacity:0;transform:translateY(12px) scale(.99)}to{opacity:1;transform:none}}',
'@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}',
'.shd{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:21px 22px 0}',
'.shd h2{font-weight:700;font-size:25px;line-height:1.08;letter-spacing:-.035em}',
'.shd .ss{font-size:12.8px;color:var(--t2);margin-top:7px}',
'.x{border:1px solid var(--ed);background:var(--pan2);border-radius:9px;width:34px;height:34px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;font-size:15px;color:var(--t2)}',
'.x:hover{border-color:var(--ed2);color:var(--t1)}',
'.shb{padding:18px 22px 0}',
'.shf{display:flex;justify-content:space-between;gap:9px;flex-wrap:wrap;padding:15px 22px 18px;margin-top:18px;border-top:1px solid var(--ed);position:sticky;bottom:0;background:var(--pan)}',
'.grp{display:flex;gap:7px;flex-wrap:wrap}',
'.fg{display:grid;grid-template-columns:1fr 1fr;gap:12px 14px}',
'.fg .full{grid-column:1/-1}',
'.lbl{display:block;font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--t3);margin-bottom:6px}',
'.lbl .fl{color:var(--warn);text-transform:none;letter-spacing:0;font-size:10px;margin-left:6px}',
'label.warned input,label.warned select{border-color:var(--warn);background:#221A10}',
'.dg{display:grid;grid-template-columns:1fr 1fr;gap:0}',
'.dc{padding:9px 0;border-bottom:1px solid var(--ed)}',
'.dc:nth-child(odd){padding-right:16px}',
'.dk{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--t3);margin-bottom:3px}',
'.dv{font-size:13.5px}',
'.dph{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;align-items:flex-end}',
'.dph img{height:200px;width:auto;max-width:100%;object-fit:cover;border-radius:10px;background:var(--pan2)}',
'.dph .ab{height:200px;border-radius:10px;padding:12px 24px 0;display:flex;align-items:flex-end;position:relative;overflow:hidden;',
'  background:radial-gradient(70% 44% at 50% 108%,var(--acs),transparent 70%),var(--pan2)}',
'.dph .ab::after{content:"";position:absolute;left:16%;right:16%;bottom:0;height:1px;background:var(--ac);box-shadow:0 0 14px 1px var(--ac)}',
'.dph .ab svg{height:100%;width:auto;position:relative}',
'.nbox{background:var(--pan2);border-radius:9px;padding:11px 13px;font-size:13.2px;white-space:pre-wrap;margin-top:14px;border-left:2px solid var(--ed2)}',

/* scatto */
'.slots{display:grid;grid-template-columns:1fr 1fr;gap:11px}',
'.slot{border:2px dashed var(--ed2);border-radius:12px;background:var(--pan2);position:relative;min-height:158px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;overflow:hidden;text-align:center;padding:14px 10px}',
'.slot:hover{border-color:var(--bronzo)}',
'.slot.full{border-style:solid;border-color:var(--bronzo);padding:0;box-shadow:0 0 26px -14px var(--bronzo)}',
'.slot img{width:100%;height:100%;min-height:158px;object-fit:cover;display:block}',
'.slot .sc{font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--t2)}',
'.slot .sh{font-size:11.5px;color:var(--t3)}',
'.slot input[type=file]{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}',
'.slot .redo{position:absolute;top:7px;right:7px;background:rgba(8,7,10,.82);border:1px solid var(--ed2);color:var(--t1);border-radius:7px;padding:4px 9px;font-family:var(--mono);font-size:10.5px;z-index:2}',
'.drop{border:2px dashed var(--bronzo);border-radius:12px;padding:26px 18px;text-align:center;background:#241614;position:relative}',
'.drop strong{font-weight:700;font-size:17px;letter-spacing:-.028em}',
'.drop input[type=file]{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}',
'.bg2{display:grid;grid-template-columns:repeat(auto-fill,minmax(68px,1fr));gap:6px;margin-top:14px;max-height:220px;overflow-y:auto}',
'.bg2 figure{margin:0;position:relative}',
'.bg2 img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:7px;display:block}',
'.bg2 figcaption{position:absolute;bottom:3px;left:3px;background:rgba(8,7,10,.82);color:var(--t1);font-family:var(--mono);font-size:9px;padding:1.5px 5px;border-radius:4px}',
'.hint{color:var(--t3);font-size:11.5px;margin-top:6px}',
'.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--t1);color:var(--bg);padding:10px 18px;border-radius:10px;font-size:12.5px;font-weight:600;z-index:300;max-width:min(440px,90vw);text-align:center}',


/* ---------- cruscotto ---------- */
'.dash{border:1px solid var(--ed);border-radius:12px;background:var(--pan);padding:15px 17px 16px;margin-bottom:15px}',
'.dash-hd{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:12px}',
'.dash-hd h3{font-weight:700;font-size:17px;letter-spacing:-.028em}',
'.dash-note{font-family:var(--mono);font-size:10.5px;color:var(--t3)}',
'.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(122px,1fr));gap:8px}',
'.tile{border:1px solid var(--ed);border-radius:10px;background:var(--pan2);padding:11px 12px 12px;text-align:left;display:flex;flex-direction:column;gap:3px;position:relative;overflow:hidden;transition:border-color .14s,box-shadow .14s}',
'.tile::after{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--ac)}',
'.tile:hover{border-color:var(--ac)}',
'.tile.on{border-color:var(--ac);box-shadow:0 0 22px -10px var(--ac),inset 0 0 0 1px var(--ac)}',
'.tile .tn{font-weight:700;font-size:23px;line-height:1;letter-spacing:-.03em;color:var(--ac)}',
'.tile .tl{font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--t1)}',
'.tile .tv{font-family:var(--mono);font-size:10.5px;color:var(--t3)}',
'.dash-x{font-size:13px;color:var(--t2);margin-top:12px;padding-top:11px;border-top:1px solid var(--ed)}',
'.dash-x strong{color:var(--t1)}',
/* ---------- segnale e sparkline ---------- */
'.sg{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;padding:3px 7px;border-radius:5px;border:1px solid var(--ac);color:var(--ac);background:color-mix(in srgb,var(--ac) 12%,transparent)}',
'.spk{width:56px;height:16px;flex:0 0 auto;opacity:.9}',
'.ft .spk{margin:0 auto}',
/* ---------- pannello quotazione ---------- */
'.quot{border:1px solid var(--ed);border-radius:11px;background:var(--pan2);padding:14px 15px;margin-bottom:16px}',
'.qhd{display:flex;gap:10px;align-items:flex-start;margin-bottom:13px}',
'.qhd p{font-size:13px;color:var(--t2);flex:1;min-width:0}',
'.qgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:10px}',
'.qc{border-left:2px solid var(--ed2);padding-left:10px}',
'.qk{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--t3)}',
'.qv{font-weight:700;font-size:17px;letter-spacing:-.03em;margin-top:3px}',
'.qs{font-family:var(--mono);font-size:10px;color:var(--t3);margin-top:2px}',
'.qs .pos,.qm .pos,.qhd .pos{color:var(--pos)} .qs .neg,.qm .neg,.qhd .neg{color:var(--neg)}',
'.qm{font-size:12.5px;color:var(--t2);margin-top:12px}',
'.qst{list-style:none;margin:10px 0 0;padding:0;border-top:1px solid var(--ed)}',
'.qst li{display:flex;gap:10px;align-items:baseline;padding:5px 0;border-bottom:1px solid var(--ed);font-size:12px}',
'.qst .qd{font-family:var(--mono);font-size:11px;color:var(--t3);min-width:92px}',
'.qst .qp{font-weight:600;min-width:60px}',
'.qst .qf{font-family:var(--mono);font-size:10.5px;color:var(--t3);flex:1;text-align:right}',
'.qnote{font-size:11.5px;color:var(--t3);margin-top:11px;line-height:1.45}',
'.qlab{display:block;font-family:var(--mono);font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--t3);margin-bottom:5px}',
/* ---------- registro a due scenari ---------- */
'.lc.due{flex:1 1 260px}',
'.duen{display:flex;gap:18px;flex-wrap:wrap}',
'.duen .n{font-size:clamp(19px,2.2vw,24px)}',
'.duen .c{margin-top:5px}',
/* ---------- matrice ---------- */
'.mwrap{border:1px solid var(--ed);border-radius:12px;background:var(--pan);padding:14px 16px 16px}',
'.mbox{position:relative}',
'.mx{width:100%;height:auto;display:block;overflow:visible}',
'.mfr{fill:none;stroke:var(--ed);stroke-width:1}',
'.max{stroke:var(--ed2);stroke-width:1;stroke-dasharray:3 4}',
'.mq{font-family:var(--mono);font-size:11px;letter-spacing:.14em;fill:var(--t3)}',
'.mal{font-family:var(--mono);font-size:10.5px;fill:var(--t3)}',
'.mat{font-family:var(--mono);font-size:10px;fill:var(--t3);letter-spacing:.06em}',
'.mdot{fill:var(--bronzo);stroke:var(--pan);stroke-width:2;cursor:pointer;transition:fill .12s}',
'.mdot:hover,.mdot:focus{fill:#A99BF0;outline:none}',
'.mdl{font-size:11px;fill:var(--t2);pointer-events:none}',
'.mq,.mal,.mat{pointer-events:none}',
'.mtip{position:absolute;transform:translate(-50%,-100%);background:var(--sunk);border:1px solid var(--ed2);border-radius:8px;padding:7px 10px;font-size:11.5px;line-height:1.4;color:var(--t1);pointer-events:none;white-space:nowrap;z-index:9;box-shadow:0 10px 30px -12px #000}',
'.mtip.sotto{transform:translate(-50%,0)}',
'.mtip strong{font-weight:700}',
'.mleg{font-size:11.5px;color:var(--t3);margin-top:10px;line-height:1.5}',
'.mout{margin-top:11px;padding-top:11px;border-top:1px solid var(--ed);font-size:12px;color:var(--t2)}',
'.mout strong{color:var(--t1)}',

/* ---------- ricerca in testata ---------- */
'.cerca{position:relative;display:flex;align-items:center;margin:0 0 22px;max-width:620px}',
'.cerca svg{position:absolute;left:14px;width:17px;height:17px;fill:none;stroke:var(--t3);stroke-width:2;stroke-linecap:round;pointer-events:none}',
'.cerca input{flex:1;min-width:0;padding:13px 42px 13px 41px;font-size:15px;border-radius:11px;background:var(--pan);border-color:var(--ed2)}',
'.cerca input:hover{border-color:var(--t3)}',
'.cerca input:focus{border-color:var(--bronzo);box-shadow:0 0 0 1px var(--bronzo),0 0 26px -10px var(--bronzo);outline:none}',
'.cerca input::-webkit-search-cancel-button{display:none}',
'.cerca .cx{position:absolute;right:11px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:6px;color:var(--t3);font-size:13px}',
'.cerca .cx:hover{color:var(--t1);background:var(--pan2)}',
'.qres{font-size:13px;color:var(--t2);margin-bottom:14px}',
'.qres strong{color:var(--t1);font-weight:700}',
'.qres.pos{display:inline-flex;align-items:center;gap:9px;flex-wrap:wrap;border:1px solid var(--ed2);border-left:2px solid var(--bronzo);border-radius:9px;background:var(--pan);padding:9px 14px}',
/* ---------- pulsante "guarda la bottiglia" ---------- */
'.foto-btn{align-self:stretch;justify-content:center;font-family:var(--mono);font-size:10px;letter-spacing:.04em;padding:7px 10px;border-radius:7px;border:1px solid var(--ac,var(--ed2));background:var(--acs,transparent);color:var(--ac,var(--t2));transition:background .14s,color .14s,border-color .14s;display:inline-flex;align-items:center;gap:7px}',
'.foto-btn svg{width:13px;height:13px;flex:0 0 auto;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linejoin:round}',
'.foto-btn .fn{font-size:9px;padding:1px 5px;border-radius:99px;border:1px solid currentColor;opacity:.75}',
'.foto-btn:hover{background:var(--ac,var(--pan2));border-color:var(--ac);color:#0B0910}',
'.dph-side .foto-btn{align-self:flex-start;font-size:11.5px;padding:10px 14px}',
'.dph-side .foto-btn svg{width:15px;height:15px}',
'.foto-btn:hover{border-color:var(--ac,var(--bronzo));color:var(--t1)}',
'.bd .foto-btn{margin-top:2px}',
'.foto-btn.tiny{padding:3px 7px;font-size:9px;vertical-align:middle;margin-left:4px}',
'.dph-side{display:flex;flex-direction:column;justify-content:flex-end;gap:2px;min-width:0;flex:1}',
'.dph-side .foto-btn{position:static;align-self:flex-start;font-size:11px;padding:7px 12px}',
'.dph-side .hint{margin-top:0}',
/* ---------- la pagina della foto ---------- */
'.lb{background:rgba(4,3,6,.9)}',
'.lbx{background:var(--pan);border:1px solid var(--ed2);border-radius:16px;max-width:960px;width:100%;max-height:92vh;overflow-y:auto;padding:20px 22px 20px;box-shadow:0 40px 90px -40px #000;animation:rs .22s cubic-bezier(.2,.8,.3,1) both}',
'.lbhd{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:16px}',
'.lbhd h2{font-weight:700;font-size:23px;line-height:1.1;letter-spacing:-.035em}',
'.lbhd .ss{font-family:var(--mono);font-size:11.5px;color:var(--t2);margin-top:6px}',
'.lbimgs{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}',
'.lbimgs figure{margin:0;position:relative;flex:1 1 300px;max-width:460px}',
'.lbimgs img{width:100%;max-height:62vh;object-fit:contain;border-radius:10px;background:var(--sunk);display:block}',
'.lbimgs figcaption{position:absolute;left:8px;bottom:8px;font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--t2);background:rgba(8,7,10,.8);padding:3px 8px;border-radius:6px}',
'.lbnote{font-size:11.5px;color:var(--t3);margin-top:15px;line-height:1.5;text-align:center;max-width:70ch;margin-left:auto;margin-right:auto}',
'.rtog{display:none}.rx{display:none}',
'.scrim{display:none;position:fixed;inset:0;background:rgba(4,3,6,.62);z-index:40}',
'.scrim.on{display:block}',
/* ---------------- la barra delle tre stanze ---------------- */
'.nav{position:sticky;top:0;z-index:60;background:rgba(8,7,10,.9);backdrop-filter:blur(14px);border-bottom:1px solid var(--ed)}',
'.nav-in{max-width:1500px;margin:0 auto;padding:0 24px;display:flex;align-items:center;gap:18px;min-height:46px}',
'.nav-br{font-family:var(--mono);font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--t3);white-space:nowrap}',
'.nav-l{display:flex;gap:2px;margin-left:auto}',
'.nvb.esci{margin-left:14px;color:var(--t3);font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;padding:6px 0}',
'.nvb.esci:hover{color:var(--t1)}',
'.nvb{font-family:var(--mono);font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--t2);',
'  padding:14px 13px 13px;border-bottom:2px solid transparent;display:flex;align-items:baseline;gap:7px;transition:color .14s,border-color .14s}',
'.nvb:hover{color:var(--t1)}',
'.nvb.on{color:var(--t1);border-bottom-color:var(--bronzo)}',
'.nvn{font-size:9.5px;color:var(--t3)}',
'.nvb.on .nvn{color:var(--bronzo)}',

/* ---------------- intestazione di capitolo ---------------- */
'.cap{display:flex;gap:16px;align-items:flex-start;margin:4px 0 22px;padding-bottom:18px;border-bottom:1px solid var(--ed)}',
'.capn{font-weight:700;font-size:clamp(30px,4vw,44px);line-height:.9;letter-spacing:-.05em;color:var(--ed2);flex:0 0 auto}',
'.cap h2{font-weight:700;font-size:clamp(21px,2.6vw,29px);letter-spacing:-.035em;line-height:1.05;margin:0}',
'.cap p{color:var(--t2);font-size:13.6px;margin-top:7px;max-width:62ch}',

/* blocco titolato, usato da mercato e panoramica */
'.blk{margin-top:26px}',
'.blkh{margin-bottom:14px}',
'.blkh h3{font-weight:700;font-size:17px;letter-spacing:-.028em}',
'.blkh p{color:var(--t2);font-size:12.8px;margin-top:5px;max-width:74ch}',

/* ---------------- tag del liquido, cantina, annata ---------------- */
'.pl.liq{border-color:transparent;border-radius:99px;color:var(--ac);background:var(--acs);letter-spacing:.11em;padding:3.5px 9px}',
'.can{display:flex;align-items:center;gap:7px;font-family:var(--mono);font-size:10px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:#C7BFD5;min-width:0}',
'.can::before{content:"";width:12px;height:2px;border-radius:2px;background:var(--ac);flex:0 0 auto}',
'.can span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'.anx{display:inline-flex;align-items:baseline;gap:4px;font-weight:700;font-size:13px;letter-spacing:-.02em;color:var(--ac);',
'  border:1px solid var(--ac);background:var(--acs);border-radius:7px;padding:2px 7px 3px;margin-right:7px}',
'.anx i{font-style:normal;font-family:var(--mono);font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;opacity:.75}',
'.card .mk{display:flex;align-items:center;flex-wrap:wrap;gap:2px}',

/* ---------------- vista dossier ---------------- */
'.dossiers{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:16px}',
'.dossier{background:var(--pan);border:1px solid var(--ed);border-radius:14px;overflow:hidden;position:relative;display:flex;flex-direction:column;transition:border-color .16s,box-shadow .16s,transform .16s}',
'.dossier::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--ac);z-index:2}',
'.dossier:hover{transform:translateY(-3px);border-color:var(--ac);box-shadow:0 0 34px -14px var(--ac)}',
'.dossier.gone{opacity:.62}',
'.d-top{display:flex;align-items:center;gap:9px;padding:11px 13px 11px 17px;border-bottom:1px solid var(--ed)}',
'.d-icon{width:17px;height:34px;flex:0 0 auto;display:flex;align-items:flex-end;justify-content:center}',
'.d-icon svg{height:100%;width:auto;display:block}',
'.d-kind{font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--t3);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'.d-qty{font-family:var(--mono);font-size:10px;color:var(--t3);border-left:1px solid var(--ed);padding-left:9px;white-space:nowrap}',
'.d-name{padding:18px 17px 17px;display:flex;gap:13px;align-items:flex-start;border-bottom:1px solid var(--ed);background:linear-gradient(104deg,var(--acw),transparent 60%)}',
'.d-name .who{flex:1;min-width:0}',
'.d-maker{display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:10.5px;font-weight:500;letter-spacing:.11em;text-transform:uppercase;color:#C7BFD5;margin-bottom:10px}',
'.d-maker::before{content:"";width:15px;height:2px;border-radius:2px;background:var(--ac);flex:0 0 auto}',
'.d-maker span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'.d-title{font-weight:700;font-size:clamp(20px,2.2vw,26px);line-height:1.02;letter-spacing:-.042em;color:var(--t1)}',
'.d-title::after{content:"";display:block;width:34px;height:2.5px;border-radius:2px;background:var(--ac);margin-top:11px}',
'.d-year{flex:0 0 auto;text-align:center;padding:8px 11px 7px;border:1px solid var(--ac);border-radius:10px;background:var(--acs);color:var(--ac);font-weight:700;font-size:23px;letter-spacing:-.03em;line-height:1}',
'.d-year small{display:block;font-family:var(--mono);font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;font-weight:400;color:var(--ac);opacity:.72;margin-top:6px}',
'.d-why{padding:10px 17px;border-bottom:1px solid var(--ed);font-size:12.4px;color:var(--t2);background:var(--pan2)}',
'.d-grid{display:grid;grid-template-columns:1fr 1fr}',
'.d-cell{padding:11px 14px 12px 17px;border-bottom:1px solid var(--ed);min-width:0}',
'.d-cell:nth-child(odd){border-right:1px solid var(--ed)}',
'.d-k{font-family:var(--mono);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--t3);margin-bottom:4px}',
'.d-v{font-size:13px;line-height:1.35;overflow-wrap:anywhere}',
'.d-val{padding:14px 17px 15px;border-bottom:1px solid var(--ed)}',
'.d-valtop{display:flex;justify-content:space-between;align-items:flex-end;gap:12px}',
'.d-big{font-weight:700;font-size:28px;letter-spacing:-.04em;line-height:1}',
'.d-trend{display:flex;align-items:center;gap:9px}',
'.d-net{display:flex;gap:16px;flex-wrap:wrap;margin-top:11px;padding-top:10px;border-top:1px dashed var(--ed)}',
'.d-net div{font-family:var(--mono);font-size:10.5px;color:var(--t3)}',
'.d-net b{display:block;font-family:var(--sans);font-size:14px;font-weight:600;color:var(--t1);letter-spacing:-.02em;margin-top:3px}',
'.d-acts{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid var(--ed)}',
'.d-act{padding:13px 14px 13px 17px;font-family:var(--mono);font-size:11px;color:var(--t2);display:flex;align-items:center;justify-content:space-between;gap:8px;transition:background .14s,color .14s}',
'.d-act:first-child{border-right:1px solid var(--ed)}',
'.d-act:hover{background:var(--acs);color:var(--t1)}',
'.d-act svg{width:14px;height:14px;flex:0 0 auto}',
'.d-act.off{opacity:.4;cursor:default}',
'.dossier .foto-btn{position:static;border-radius:0;padding:13px 14px;justify-content:space-between;width:100%;background:none;border:none;font-size:11px}',
'.dossier .foto-btn:hover{background:var(--acs)}',
'.d-state{display:flex;align-items:center;justify-content:space-between;padding:11px 14px 11px 17px;background:var(--pan2)}',
'.d-state .k{font-family:var(--mono);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--t3)}',
'.d-state .v{font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--t1)}',

/* ---------------- vista per posizione ---------------- */
'.zsec{margin-bottom:26px}',
'.scf.vuoto{opacity:.5}', '.scf.vuoto .scf-h{border-bottom:none}',
'.zhd .zsub{font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--t3)}',
'.mcta{border:1px dashed var(--acc-s);border-radius:12px;padding:16px 18px;margin-bottom:18px;background:var(--pan)}',
'.mcta strong{display:block;font-size:16px;letter-spacing:-.02em;margin-bottom:4px}', '.mcta .btn{margin-top:10px}',
'.mrow{display:grid;grid-template-columns:26px minmax(0,1.6fr) 92px 150px 52px 34px;gap:10px;align-items:end;padding:10px 0;border-bottom:1px solid var(--ed)}',
'.mrow label{display:block;min-width:0}', '.mrow .lbl{display:block;margin-bottom:4px}', '.mrow input{width:100%}',
'.mnum{font-family:var(--mono);font-size:11px;color:var(--t3);padding-bottom:11px}',
'.mbt{font-family:var(--mono);font-size:10px;color:var(--t3);padding-bottom:11px;white-space:nowrap}',
'.mrow .x{margin-bottom:4px}', '.mtools{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 8px}',
'.mcat{grid-column:2/-1;display:flex;flex-wrap:wrap;gap:6px;align-items:center}', '.mcat .lbl{margin:0 6px 0 0}',
'.mcat button{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--t3);border:1px solid var(--ed2);border-radius:99px;padding:3px 9px;transition:color .13s,border-color .13s}',
'.mcat button:hover{color:var(--t1);border-color:var(--t3)}', '.mcat button.on{color:var(--bronzo);border-color:var(--bronzo)}',
'.posprop{grid-column:1/-1;display:flex;gap:10px;align-items:center;flex-wrap:wrap}',
'.speak{display:grid;gap:18px}', '.sp-tabs{width:max-content;max-width:100%}', '.sp-tabs button{padding:9px 16px;font-size:12px}',
'.sp-filtri{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:14px}', '.sp-filtri .btn{margin-left:auto}',
'.sp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px}', '.sp-lista{display:grid;gap:12px}',
'.sp-card h4,.sp-prop h4{font-size:19px;letter-spacing:-.03em;margin:8px 0 4px}', '.sp-sub{font-family:var(--mono);font-size:10.5px;color:var(--t2);margin:0 0 10px}',
'.sp-top{display:flex;justify-content:space-between;align-items:center;gap:8px}', '.sp-when{font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--t3)}',
'.sp-stato{font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--acc);margin-left:6px}',
'.sp-prezzo{margin:8px 0 10px;padding:10px 12px;border:1px solid var(--ed);border-radius:10px;background:var(--pan2)}',
'.sp-prezzo .k{display:block;font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--t3);margin-bottom:3px}', '.sp-prezzo b{font-size:18px;letter-spacing:-.02em}',
'.sp-dl{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:0 0 10px;font-size:12.5px}', '.sp-dl dt{font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--t3);padding-top:3px}', '.sp-dl dd{margin:0;color:var(--t2)}',
'.sp-chi{display:flex;justify-content:space-between;align-items:center;gap:10px;border-top:1px solid var(--ed);padding-top:10px;font-size:13px;color:var(--t2);flex-wrap:wrap}',
'.sp-form{margin-top:10px;display:grid;gap:10px}', '.sp-form textarea,.sp-form input[type=text],.sp-form input[type=number],.sp-form select{width:100%}',
'.sp-recapiti{display:grid;gap:8px;padding:10px 12px;border:1px dashed var(--ed);border-radius:10px}',
'.sp-foto{margin:-16px -18px 10px;max-height:220px;overflow:hidden;border-bottom:1px solid var(--ed)}', '.sp-foto img{width:100%;height:220px;object-fit:cover;display:block}',
'.sp-next{font-size:13px;color:var(--t1);margin:8px 0}', '.sp-msg{font-size:13px;color:var(--t2);border-left:2px solid var(--ed);padding:4px 10px;margin:4px 0 8px}',
'.sp-contatti{border:1px solid var(--acc-s);border-radius:10px;padding:10px 12px;margin:8px 0;background:var(--glass)}', '.sp-contatti b{display:block;margin-bottom:6px}',
'.sp-foot{margin:6px 0 0;text-align:right}', '.sp-foot .lnk{font-size:11px;color:var(--t3)}', '.sp-profilo h4{font-size:22px;margin:0 0 4px}', '.sp-scheda{display:grid;gap:8px}', '.posprop .hint{margin:0}',
'.posgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:8px}', '.posgrid label{display:block;min-width:0}', '.posgrid .lbl{display:block;margin-bottom:4px}', '.posgrid input,.posgrid select{width:100%}',
'@media(max-width:640px){.mrow{grid-template-columns:22px minmax(0,1fr) minmax(0,1fr) 34px;row-gap:8px}.mrow label:nth-of-type(1){grid-column:2/span 2}.mrow label:nth-of-type(2){grid-column:2}.mrow label:nth-of-type(3){grid-column:3}.mrow .x{grid-column:4;grid-row:1}.mnum{grid-row:1}.mbt{display:none}.posgrid{grid-template-columns:1fr}}',
'.zhd{display:flex;align-items:baseline;gap:12px;padding-bottom:9px;border-bottom:1px solid var(--ed2);margin-bottom:12px}',
'.zhd h3{font-weight:700;font-size:19px;letter-spacing:-.03em}',
'.zmeta{font-family:var(--mono);font-size:10.5px;color:var(--t3);margin-left:auto;white-space:nowrap}',
'.scf{margin-bottom:11px;border:1px solid var(--ed);border-radius:11px;background:var(--pan);overflow:hidden}',
'.scf-h{display:flex;align-items:center;gap:9px;padding:9px 14px;background:var(--pan2);border-bottom:1px solid var(--ed)}',
'.scf-n{font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--t2)}',
'.scf-b{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--t3);border:1px solid var(--ed2);border-radius:99px;padding:3px 9px;margin-left:10px;transition:color .13s,border-color .13s}',
'.scf-b:hover{color:var(--t1);border-color:var(--t3)}',
'.scf-b.on{color:var(--bronzo);border-color:var(--bronzo)}',
'.scf-c{font-family:var(--mono);font-size:10px;color:var(--t3);margin-left:auto}',
'.prow{display:grid;grid-template-columns:68px minmax(0,1.1fr) minmax(0,1fr) auto auto;align-items:center;gap:12px;text-align:left;',
'  width:100%;padding:10px 14px;border-bottom:1px solid var(--ed);position:relative;transition:background .13s}',
'.scf-l .prow:last-child{border-bottom:none}',
'.prow::before{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--ac);opacity:.85}',
'.prow:hover{background:var(--pan2)}',
'.prip{font-family:var(--mono);font-size:10px;color:var(--t3);white-space:nowrap}',
'.pnm{font-weight:600;font-size:14px;letter-spacing:-.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'.pmk{font-family:var(--mono);font-size:10.5px;color:var(--t2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'.pq{font-family:var(--mono);font-size:10px;color:var(--t3)}',
'.pv{font-weight:600;font-size:14px;letter-spacing:-.02em;text-align:right;white-space:nowrap;min-width:72px}',

/* ---------------- mercato: le azioni ---------------- */
'.asec{margin-bottom:22px;border:1px solid var(--ed);border-radius:12px;background:var(--pan);overflow:hidden;position:relative}',
'.asec::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--ac)}',
'.ahd{display:flex;align-items:baseline;gap:12px;padding:14px 16px 0 19px}',
'.ahd h3{font-weight:700;font-size:18px;letter-spacing:-.03em;color:var(--ac)}',
'.ameta{font-family:var(--mono);font-size:10.5px;color:var(--t3);margin-left:auto;white-space:nowrap}',
'.anote{padding:6px 16px 13px 19px;color:var(--t2);font-size:12.6px;border-bottom:1px solid var(--ed)}',
'.arow{display:flex;align-items:center;gap:14px;width:100%;padding:12px 16px 12px 19px;border-bottom:1px solid var(--ed);text-align:left;transition:background .13s}',
'.arows .arow:last-child{border-bottom:none}',
'.arow:hover{background:var(--pan2)}',
'.aic{width:16px;height:38px;flex:0 0 auto;display:flex;align-items:flex-end}',
'.aic svg{height:100%;width:auto}',
'.atxt{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}',
'.anm{font-weight:600;font-size:15px;letter-spacing:-.025em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'.amk{font-family:var(--mono);font-size:10.5px;color:var(--t3)}',
'.awhy{font-size:12.4px;color:var(--t2);margin-top:2px}',
'.aval{flex:0 0 auto;text-align:right;display:flex;flex-direction:column;gap:2px;align-items:flex-end}',
'.av1{font-weight:700;font-size:17px;letter-spacing:-.03em}',
'.av2{font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--t3)}',

/* ---------------- panoramica: il grafico ---------------- */
'.chart{border:1px solid var(--ed);border-radius:12px;background:var(--pan);padding:14px 12px 8px}',
'.chart svg{width:100%;height:auto;display:block}',
'.axl{font-family:var(--mono);font-size:9.5px;fill:var(--t3)}',
'.lgn{display:flex;gap:18px;flex-wrap:wrap;margin-top:11px}',
'.lg{display:flex;align-items:center;gap:7px;font-family:var(--mono);font-size:10.5px;color:var(--t2)}',
'.lg i{width:14px;height:3px;border-radius:2px;display:block}',
'.lg i.lgd{background:repeating-linear-gradient(90deg,var(--t3) 0 4px,transparent 4px 7px)}',
/* ---------------- panoramica: l'inventario ---------------- */
'.invg{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));gap:10px}',
'.invc{border:1px solid var(--ed);border-radius:12px;background:var(--pan);padding:14px 16px 15px;position:relative;overflow:hidden}',
'.invc::after{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--ed2)}',
'.invn{font-weight:700;font-size:clamp(23px,2.7vw,30px);line-height:1;letter-spacing:-.035em}',
'.invl{font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--t3);margin-top:9px}',
'.invs{font-size:11.5px;color:var(--t2);margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'.cbar.liq{box-shadow:none}',
'.atl{border:1px solid var(--ed);border-radius:12px;background:var(--pan);overflow:hidden}',
'.atr{display:grid;grid-template-columns:150px 1fr 40px;grid-template-areas:"k b n" "l l l";align-items:center;gap:6px 12px;padding:11px 15px;border-bottom:1px solid var(--ed)}',
'.atl .atr:last-child{border-bottom:none}',
'.atk{grid-area:k;font-weight:600;font-size:14px;letter-spacing:-.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'.atb{grid-area:b;height:8px;background:var(--pan2);border-radius:4px;overflow:hidden}',
'.atb span{display:block;height:100%;background:var(--bronzo);border-radius:4px}',
'.atn{grid-area:n;font-family:var(--mono);font-size:11.5px;color:var(--t2);text-align:right}',
'.atl2{grid-area:l;font-family:var(--mono);font-size:10.5px;color:var(--t3);overflow-wrap:anywhere}',
'.ych{display:flex;align-items:flex-end;gap:7px;border:1px solid var(--ed);border-radius:12px;background:var(--pan);padding:16px 15px 12px;min-height:180px;overflow-x:auto}',
'.yb{flex:1 0 34px;display:flex;flex-direction:column;align-items:center;gap:6px;height:140px;justify-content:flex-end}',
'.ybn{font-family:var(--mono);font-size:10.5px;color:var(--t2)}',
'.ybar{width:100%;max-width:44px;background:var(--bronzo);border-radius:5px 5px 0 0;opacity:.72;transition:opacity .14s}',
'.yb.top .ybar{background:var(--ambra);opacity:1}',
'.yb:hover .ybar,.yb:focus .ybar{opacity:1}',
'.ybl{font-family:var(--mono);font-size:10px;color:var(--t3);white-space:nowrap}',
'.vch{display:flex;flex-wrap:wrap;gap:8px}',
'.vc{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--ed);border-radius:99px;background:var(--pan);padding:6px 8px 6px 13px;font-size:12.5px;color:var(--t1)}',
'.vc b{font-family:var(--mono);font-size:10.5px;font-weight:400;color:var(--t3);background:var(--pan2);border-radius:99px;padding:2px 7px}',
'.prg{border:1px solid var(--ed);border-radius:12px;background:var(--pan);overflow:hidden}',
'.pgr{display:flex;align-items:center;gap:13px;width:100%;padding:11px 15px;border-bottom:1px solid var(--ed);text-align:left;position:relative;transition:background .13s}',
'.prg .pgr:last-child{border-bottom:none}',
'.pgr::before{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--ac)}',
'.pgr:hover{background:var(--pan2)}',
'.pgn{font-family:var(--mono);font-size:11px;color:var(--t3);width:16px;flex:0 0 auto}',
'.pgi{width:15px;height:36px;flex:0 0 auto;display:flex;align-items:flex-end}',
'.pgi svg{height:100%;width:auto}',
'.pgt{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}',
'.pgnm{font-weight:600;font-size:14.5px;letter-spacing:-.025em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'.pgmk{font-family:var(--mono);font-size:10.5px;color:var(--t3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'.pgv{font-weight:700;font-size:16px;letter-spacing:-.03em;white-space:nowrap;text-align:right}',
'.pgq{display:block;font-family:var(--mono);font-size:9.5px;font-weight:400;color:var(--t3);margin-top:3px}',
'.tools{top:46px}',
'@media (max-width:1000px){',
'  .rail{position:fixed;left:0;top:0;bottom:0;z-index:50;transform:translateX(-100%);transition:transform .2s cubic-bezier(.2,.8,.3,1);box-shadow:0 0 60px #000;max-height:none}',
'  .rail.open{transform:none}',
'  .rtog,.rx{display:inline-flex}',
'}',
'@media (max-width:640px){',
'  .mast{padding:24px 15px 22px}',
'  .content{padding:16px 14px 70px}',
'  .tools{padding:10px 14px}',
'  .fg,.dg{grid-template-columns:1fr}',
'  .dc:nth-child(odd){padding-right:0}',
'  .grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:11px}',
'  .nm{font-size:16px}',
'  .lc{min-width:0;flex:1 1 calc(50% - 5px)}',
'  .dph img,.dph .ab{height:150px}',
'  .shd{padding:18px 15px 0}.shb{padding:15px 15px 0}.shf{padding:13px 15px 15px}',
'  .btn.wide{flex:1 1 100%;justify-content:center}',
'  .note .btn{width:100%;justify-content:center}',
'  .shf .grp{flex:1 1 100%}.shf .grp .btn{flex:1 1 auto;justify-content:center}',
'  .cerca{margin-bottom:18px}.cerca input{font-size:14px;padding:11px 38px 11px 38px}',
'  .lbx{padding:16px 15px}.lbimgs{gap:9px}.lbimgs img{max-height:46vh}',
'  .foto-btn{font-size:9px;padding:4px 7px;right:6px;bottom:6px}',
'  .crow{grid-template-columns:84px 1fr 30px;gap:9px}',
'  .ctip{left:94px}',
'  .tiles{grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:6px}',
'  .tile{padding:9px 10px}.tile .tn{font-size:19px}',
'  .qgrid{grid-template-columns:1fr 1fr}',
'  .mwrap{padding:10px 10px 12px}',
'  .duen{gap:14px}',
'  .invg{grid-template-columns:1fr 1fr;gap:8px}',
'  .invc{padding:12px 13px 13px}',
'  .atr{grid-template-columns:1fr 42px;grid-template-areas:"k n" "b b" "l l";gap:5px 10px}',
'  .ych{gap:5px;padding:14px 12px 10px}.yb{flex:1 0 26px;height:120px}',
'  .pgv{font-size:14px}.pgi{display:none}',
'  .nav-in{padding:0 14px;gap:10px}',
'  .nav-br{display:none}',
'  .nav-l{margin-left:0;width:100%;justify-content:space-between}',
'  .nvb{padding:13px 6px 11px;font-size:10px;letter-spacing:.06em}',
'  .tools{top:44px}',
'  .cap{gap:11px;margin-bottom:18px}',
'  .dossiers{grid-template-columns:1fr;gap:13px}',
'  .d-acts{grid-template-columns:1fr}',
'  .d-act:first-child{border-right:none;border-bottom:1px solid var(--ed)}',
'  .prow{grid-template-columns:52px minmax(0,1fr) auto;grid-template-areas:"rip nome val" "rip mk val";gap:2px 9px}',
'  .prip{grid-area:rip}.pnm{grid-area:nome}.pmk{grid-area:mk;font-size:10px}.pv{grid-area:val}',
'  .pq{display:none}',
'  .arow{gap:10px;padding-left:15px}',
'  .aic{display:none}',
'  .av1{font-size:15px}',
'}',

/* ============================================================
   L'ABITO: solo font e colori del Caveau Private Exchange.
   Nessun componente spostato, nessuna sezione aggiunta,
   nessuna geometria cambiata. Solo come si scrive e di che
   colore e'.
   ============================================================ */

/* -------- pesi e spaziature del sito -------- */
'h1,h2,h3{font-weight:500}',
'.mast h1{font-weight:500;letter-spacing:-.038em}',
'.nm,.d-title,.tnm,.anm,.pgnm,.pnm,.vl,.av1,.pgv,.pv,.qv,.d-net b,',
'.blkh h3,.note h3,.cap h2,.rhd h2,.zhd h3,.ahd h3,.shd h2,.lbhd h2,',
'.empty h2,.dash-hd h3,.drop strong,.qres strong,.qst .qp,.btn{font-weight:500}',
'.lc .n,.tile .tn,.invn,.d-big,.note .big,.capn,.d-year{font-weight:300}',
'.lc .n{letter-spacing:-.042em}',
'.tile .tn{letter-spacing:-.04em}',
'.invn{letter-spacing:-.042em}',
'.d-big{letter-spacing:-.045em}',
'.d-year{letter-spacing:-.04em}',
'.capn{letter-spacing:-.055em}',
'.mast .sub{font-weight:300;font-size:14.5px;line-height:1.6}',
'.cap p,.blkh p,.note p,.anote,.awhy,.d-why{font-weight:300}',

/* il maiuscoletto mono del sito respira di piu' */
'.eb{letter-spacing:.2em}',
'.nav-br,.flab,.lbl,.dk,.d-k,.qk,.qlab,.invl,.tile .tl,.scf-n,.d-state .k,',
'.av2,.stamp,.slot .sc,.lbimgs figcaption{letter-spacing:.17em}',
'.nvb{letter-spacing:.15em}',
'.pl,.sg,.pl.liq{letter-spacing:.13em}',
'.can,.d-maker{letter-spacing:.16em}',

/* -------- colori: via gli aloni, il sito non ne ha -------- */
'.mast::after{background:var(--ed2)}',
'.card:hover{box-shadow:none;border-color:var(--ac)}',
'.dossier:hover{box-shadow:none;border-color:var(--ac)}',
'.cbar{box-shadow:none}',
'.swatch{box-shadow:none}',
'.slot.full{box-shadow:none}',
'.tile.on{box-shadow:inset 0 0 0 1px var(--ac)}',
'.chip.on{box-shadow:inset 0 0 0 1px var(--bronzo-s)}',
'.vit::after{box-shadow:none;height:2px}',
'.dph .ab::after{box-shadow:none;height:2px}',
'.btn.pri{box-shadow:none;color:#191512}',
'.btn.dgr:hover{box-shadow:none}',
'.cerca input:focus{box-shadow:0 0 0 1px var(--bronzo)}',
'.foto-btn:hover{color:#171412}',

/* -------- i tre violetti rimasti fuori palette -------- */
'.btn.pri:hover{background:var(--bronzo2);border-color:var(--bronzo2)}',
'.mdot{fill:var(--bronzo);stroke:var(--pan)}',
'.mdot:hover,.mdot:focus{fill:var(--bronzo2)}',
'.can,.d-maker{color:var(--t2)}',
'.btn.dgr{border-color:var(--ed)}',
'.drop{background:#241417}',
'label.warned input,label.warned select{background:#221B11}',

/* -------- accenti di casa: vino e bronzo dove prima erano neutri -------- */
'.seg button.on{background:var(--bronzo);color:#191512}',
'.ybar{background:var(--vino);opacity:1}',
'.yb.top .ybar{background:var(--bronzo)}',
'.ro{background:var(--vino-d);color:var(--bronzo2)}',
'.toast{background:var(--t1);color:#171412}',
'.btn,.chip,.vc,.pl,.sg,.stamp,.scf-b,.x,.cmd,.foto-btn,.qres.pos,.toast{border-radius:999px}',
'.seg,.seg button{border-radius:0}',
'.btn.sm{border-radius:999px}',
'.brand{display:flex;align-items:center;gap:18px;margin-top:12px}',
'.brand h1{margin:0}',
'.mk{width:auto;height:.74em;flex:0 0 auto;color:var(--bronzo2);display:block}',
'.brand .mk{height:clamp(44px,7vw,80px)}',
'.nav-br{display:flex;align-items:center;gap:10px;color:var(--t2)}',
'.nav-br .mk{height:20px;color:var(--bronzo)}',
'.nav-br b{font-weight:500;letter-spacing:.16em;text-transform:uppercase;font-size:11px}',
/* le striscioline: piu larghe e con cinque tinte separate a colpo d'occhio */
'.lc::after{width:3px;opacity:1}',
'.lc .c{color:var(--t2)}',
'@media (max-width:640px){.brand{gap:11px}.nav-br{display:none}}',

'.btn.pri{background:var(--bronzo);border-color:var(--bronzo);color:#1C1815}',
'.btn.pri:hover{background:var(--bronzo2);border-color:var(--bronzo2);color:#1C1815}',
'.seg button.on{background:var(--vino);color:var(--t1)}',
'.chip.on{border-color:var(--bronzo);color:var(--bronzo2);box-shadow:inset 0 0 0 1px var(--bronzo-s)}',
'.scf-b.on{color:var(--bronzo2);border-color:var(--bronzo)}',
'.nvb.on{border-bottom-color:var(--bronzo)}',
'.nvb.on .nvn{color:var(--bronzo2)}',
'.cbar,.atb span{background:var(--bronzo)}',
'.ybar{background:var(--vino)}',
'.yb.top .ybar{background:var(--bronzo)}',
'.mdot{fill:var(--bronzo)}',
'.mdot:hover,.mdot:focus{fill:var(--bronzo2)}',
'.ro{background:var(--vino-d);color:var(--bronzo2)}',
'.cmd{border-color:var(--bronzo);color:var(--bronzo2)}',
'.toast{background:var(--carta2);color:#1C1815}',
'.cerca input:focus{box-shadow:0 0 0 1px var(--bronzo);border-color:var(--bronzo)}',
'@media (max-width:640px){.btn{border-radius:999px}}',
'@media (max-width:640px){.nvb.esci{margin-left:8px;font-size:9.5px;letter-spacing:.05em}}',


'.card,.dash,.dossier,.tile,.quot,.lc,.scf,.sheet,.nbox,.note,.chart,.mwrap,.asec,.tw,.lbx,.invc,.vc,.prg,.rart,.ctrack,.atl,.atb,details.help,th,.shf,.kbox,.ccard,.lot,.d-state,.d-why{backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur)}',
'.card,.tile,.lc,.sheet,.quot,.dossier,.ccard,.lot,.nbox{border-color:rgba(241,235,224,.16)}',
'.rail{background:var(--glass2);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur)}',
'.tools,.nav{background:rgba(28,24,21,.80);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur)}',
'.nvb.club .nvn{color:var(--acc)}',
'.nav-br{gap:10px}.nav-br b{color:var(--t1);font-size:12px;letter-spacing:.14em}',
'.nav-br .piano{font-family:var(--mono);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--acc);border-left:1px solid var(--ed);padding-left:10px;margin-left:2px}',
'.nav-br .piano.club{color:var(--t1);background:var(--wine);border:0;border-radius:999px;padding:3px 9px}',
'.porta-club{display:grid;gap:14px;max-width:760px}',
'.porta-club .ccard h4{font-size:22px;letter-spacing:-.03em;margin:0 0 8px}',
'.porta-club .ccard p{margin:0 0 10px}',
'.porta-club .quota{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--acc);margin:10px 0}',
'.porta-club .stato{font-family:var(--mono);font-size:12px;color:var(--t2);border-left:2px solid var(--acc);padding:8px 12px;background:var(--glass)}',
'.demo-band{display:flex;gap:12px;align-items:center;font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#1C1815;background:var(--acc);padding:8px 14px;border-radius:999px;margin:0 0 16px;width:max-content;max-width:100%}',
'.porta-club textarea{width:100%;min-height:80px;background:var(--sunk);border:1px solid var(--ed);border-radius:10px;color:var(--t1);padding:10px 12px;font:inherit}',
'@media (prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}',
'.disc{font-size:12px;line-height:1.55;color:var(--t3);margin:12px 0 0;max-width:72ch}',
'.desk table{min-width:760px}.desk td{vertical-align:top}.dk-az{display:flex;flex-wrap:wrap;gap:6px;min-width:260px}',
'.dk-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}',
'.dk-sw{display:flex;justify-content:space-between;align-items:center;gap:14px;border:1px solid var(--ed);border-radius:12px;padding:14px 16px;background:var(--glass);backdrop-filter:var(--blur)}',
'.dk-sw b{display:block;font-weight:600;margin-bottom:3px}.dk-sw small{display:block;color:var(--t3);font-size:12px;line-height:1.45}',
'.dk-num{width:110px;background:var(--sunk);border:1px solid var(--ed);border-radius:999px;color:var(--t1);padding:8px 12px;font-family:var(--mono)}',
'.nvb.desk .nvn{color:var(--wine2)}',
'/* ---------------- Caveau Club ---------------- */',
'.kbox{display:flex;gap:14px;align-items:flex-start;border:1px solid var(--ed);border-radius:3px;background:var(--glass);backdrop-filter:var(--blur);padding:14px 16px;margin-bottom:18px;font-size:13px;color:var(--t2)}',
'.kbox .k{font-family:var(--mono);font-size:24px;font-weight:600;color:var(--bronze2);letter-spacing:-.03em;line-height:1;flex:0 0 auto}',
'.cgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}',
'.ccard{border:1px solid var(--ed);border-radius:3px;background:var(--glass);backdrop-filter:var(--blur);padding:16px 18px;display:flex;flex-direction:column;gap:8px;position:relative;overflow:hidden}',
'.ccard::before{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--ac,var(--bronze))}',
'.ccard.paper{background:var(--paper);color:var(--bg);border-color:var(--paper)}',
'.ccard.paper .mono,.ccard.paper .hint{color:rgba(28,24,21,.6)}',
'.ccard h4{margin:0;font-weight:600;font-size:18px;letter-spacing:-.035em;line-height:1.1}',
'.ccard p{font-size:12.8px;color:var(--t2)}',
'.ccard.paper p{color:rgba(28,24,21,.72)}',
'.ccard .row{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:auto;padding-top:10px;border-top:1px solid var(--ed)}',
'.ccard.paper .row{border-color:rgba(28,24,21,.15)}',
'.ccard.paper .btn{color:var(--bg);border-color:rgba(28,24,21,.3);background:transparent;backdrop-filter:none}',
'.cmpr{display:flex;flex-direction:column;gap:9px}',
'.cmpr .r{display:grid;grid-template-columns:110px 1fr 120px;gap:12px;align-items:center;font-size:12.5px}',
'.cmpr .tr{height:12px;background:rgba(232,224,209,.08);position:relative;border-radius:1px}',
'.cmpr .tr b{position:absolute;left:0;top:0;bottom:0;background:var(--t1);border-radius:1px}',
'.cmpr .tr i{position:absolute;top:-3px;bottom:-3px;width:2px;background:var(--bronze2)}',
'.cmpr .v{font-family:var(--mono);font-size:10.5px;text-align:right;color:var(--t2)}',
'.bars{display:flex;align-items:flex-end;gap:6px;height:110px;border-bottom:1px solid var(--ed);padding-bottom:6px}',
'.bars i{flex:1;background:var(--wine2);display:block;border-radius:1px 1px 0 0}',
'.bars i.b{background:var(--bronze2)}',
'.xlab{display:flex;justify-content:space-between;font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--t3);margin-top:6px}',
'.lot{border:1px solid var(--ed);border-radius:3px;background:var(--glass);backdrop-filter:var(--blur);padding:16px 18px;display:flex;flex-direction:column;gap:6px}',
'.lot .y{font-size:34px;font-weight:700;letter-spacing:-.05em;color:var(--bronze2);line-height:.9}',
'.lot .n{font-size:17px;font-weight:600;letter-spacing:-.03em}',
'.lot .m{display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--ed);padding-top:10px;margin-top:auto;font-family:var(--mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--t3)}',
'.lot .m b{font-family:var(--sans);font-size:17px;letter-spacing:-.03em;color:var(--t1);text-transform:none}',
'.feed{display:flex;flex-direction:column}',
'.feed .it{display:grid;grid-template-columns:70px 1fr auto;gap:14px;padding:10px 0;border-bottom:1px solid var(--ed);font-size:12.5px;align-items:center}',
'.feed .it:last-child{border-bottom:none}',
'.feed .t{font-family:var(--mono);font-size:10.5px;color:var(--t3)}',
'.feed .kk{font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--bronze2)}',
'.ev{display:grid;grid-template-columns:80px 1fr auto;gap:14px;padding:12px 0;border-bottom:1px solid var(--ed);align-items:center}',
'.ev:last-child{border-bottom:none}',
'.ev .d{font-family:var(--mono);font-size:10.5px;color:var(--bronze2)}',
'.ev b{display:block;font-weight:600;letter-spacing:-.02em}',
'.ev small{color:var(--t3);font-size:12px}',
'.hidden-row td{color:var(--t3);font-style:italic}',
'.vis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:6px}',
'.vis button{border:1px solid var(--ed);padding:10px 11px;text-align:left;border-radius:2px;display:flex;flex-direction:column;gap:5px;background:transparent}',
'.vis button.on{border-color:var(--t1);background:rgba(232,224,209,.06)}',
'.vis .vt{font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--t1);display:flex;align-items:center;gap:6px}',
'.vis .vt i{width:7px;height:7px;border-radius:50%;display:inline-block;background:var(--t3)}',
'.vis .seg .vt i{background:var(--bronze2)} .vis .ven .vt i{background:var(--wine2)}',
'.vis small{font-size:11px;color:var(--t3);line-height:1.35}',
'@media (max-width:1000px){',
'  .rail{position:fixed;left:0;top:0;bottom:0;z-index:50;transform:translateX(-100%);transition:transform .2s cubic-bezier(.2,.8,.3,1);box-shadow:0 0 60px #000;max-height:none;background:rgba(28,24,21,.94)}',
'  .rail.open{transform:none}',
'  .rtog,.rx{display:inline-flex}',
'}',
'@media (max-width:640px){',
'  .mast{padding:24px 15px 22px}',
'  .content{padding:16px 14px 70px}',
'  .tools{padding:10px 14px}',
'  .fg,.dg{grid-template-columns:1fr}',
'  .dc:nth-child(odd){padding-right:0}',
'  .grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:11px}',
'  .nm{font-size:16px}',
'  .lc{min-width:0;flex:1 1 calc(50% - 5px)}',
'  .dph img,.dph .ab{height:150px}',
'  .shd{padding:18px 15px 0}.shb{padding:15px 15px 0}.shf{padding:13px 15px 15px}',
'  .btn.wide{flex:1 1 100%;justify-content:center}',
'  .note .btn{width:100%;justify-content:center}',
'  .shf .grp{flex:1 1 100%}.shf .grp .btn{flex:1 1 auto;justify-content:center}',
'  .cerca{margin-bottom:18px}.cerca input{font-size:14px;padding:11px 38px 11px 38px}',
'  .lbx{padding:16px 15px}.lbimgs{gap:9px}.lbimgs img{max-height:46vh}',
'  .foto-btn{font-size:9px;padding:4px 7px}',
'  .crow{grid-template-columns:84px 1fr 30px;gap:9px}',
'  .ctip{left:94px}',
'  .tiles{grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:6px}',
'  .tile{padding:9px 10px}.tile .tn{font-size:19px}',
'  .qgrid{grid-template-columns:1fr 1fr}',
'  .mwrap{padding:10px 10px 12px}',
'  .duen{gap:14px}',
'  .invg{grid-template-columns:1fr 1fr;gap:8px}',
'  .invc{padding:12px 13px 13px}',
'  .atr{grid-template-columns:1fr 42px;grid-template-areas:"k n" "b b" "l l";gap:5px 10px}',
'  .ych{gap:5px;padding:14px 12px 10px}.yb{flex:1 0 26px;height:120px}',
'  .pgv{font-size:14px}.pgi{display:none}',
'  .nav-in{padding:0 14px;gap:10px}',
'  .nav-br span{display:none}',
'  .nav-l{margin-left:auto}',
'  .nvb{padding:13px 6px 11px;font-size:9.5px;letter-spacing:.06em}',
'  .tools{top:50px}',
'  .cap{gap:11px;margin-bottom:18px}',
'  .dossiers{grid-template-columns:1fr;gap:13px}',
'  .d-acts{grid-template-columns:1fr}',
'  .d-act:first-child{border-right:none;border-bottom:1px solid var(--ed)}',
'  .prow{grid-template-columns:52px minmax(0,1fr) auto;grid-template-areas:"rip nome val" "rip mk val";gap:2px 9px}',
'  .prip{grid-area:rip}.pnm{grid-area:nome}.pmk{grid-area:mk;font-size:10px}.pv{grid-area:val}',
'  .pq{display:none}',
'  .arow{gap:10px;padding-left:15px}',
'  .aic{display:none}',
'  .av1{font-size:15px}',
'  .vis{grid-template-columns:1fr}',
'  .cmpr .r{grid-template-columns:80px 1fr 90px}',
'}'
,
'/* ---- scatto rapido e stato di lettura (tutti gli schermi) ---- */',
'.fab{display:none;position:fixed;right:16px;bottom:calc(18px + env(safe-area-inset-bottom));z-index:90;align-items:center;gap:10px;padding:0 20px 0 16px;height:56px;border-radius:999px;background:var(--bronzo);color:#191110;border:1px solid var(--bronzo);box-shadow:0 14px 34px -10px rgba(0,0,0,.8),0 0 0 1px rgba(255,255,255,.06) inset;font-weight:700;font-size:15px;letter-spacing:-.01em;transition:transform .12s,box-shadow .12s}',
'.fab:active{transform:scale(.97)}',
'.fab svg{width:22px;height:22px;flex:0 0 auto}',
'.fab .fab-n{position:absolute;top:-6px;right:-4px;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:var(--t1);color:var(--bg);font-family:var(--mono);font-size:11px;display:flex;align-items:center;justify-content:center;border:2px solid var(--bg)}',
'.rapido-in{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden}',
'.pl.lett{color:var(--bronzo2);border-color:var(--bronzo);animation:pulsa 1.1s ease-in-out infinite}',
'.pl.ko{color:#F0A3AE;border-color:rgba(224,85,106,.5)}',
'@keyframes pulsa{50%{opacity:.4}}',
'.card.coda .mk{line-height:1.35}',
'.card .bd .mk{height:auto}',
'.btn.retro{align-self:stretch;justify-content:center;font-size:12px;padding:8px 10px;margin-top:2px}',
'@media (max-width:640px){',
'  html{-webkit-text-size-adjust:100%}',
'  body{font-size:16px}',
'  button,[role=button],a,.card,.tile{-webkit-tap-highlight-color:transparent;touch-action:manipulation}',
'  input,select,textarea,.cerca input{font-size:16px}',
'  .nav-in{overflow-x:auto;overflow-y:hidden;flex-wrap:nowrap;gap:0;padding:0 6px;scrollbar-width:none;-webkit-overflow-scrolling:touch;min-height:50px}',
'  .nav-in::-webkit-scrollbar{display:none}',
'  .nav-l{width:auto;flex:0 0 auto;justify-content:flex-start;gap:0}',
'  .nvb{font-size:11.5px;letter-spacing:.07em;padding:16px 11px 13px;white-space:nowrap;flex:0 0 auto}',
'  .nvb.esci{font-size:11.5px;margin-left:4px}',
'  .mast{padding:16px 16px 14px}',
'  .mast h1{font-size:clamp(30px,9vw,40px);margin-top:8px}',
'  .cap{gap:10px;margin:2px 0 12px;padding-bottom:12px}',
'  .eb{font-size:10.5px;letter-spacing:.14em}',
'  .cerca{margin-bottom:12px}',
'  .tile{padding:10px 11px 11px}.tile .tn{font-size:21px}.tile .tl{font-size:10.5px;letter-spacing:.05em}',
'  .tools{position:static;top:auto;padding:10px 14px;gap:8px;backdrop-filter:none;background:transparent}',
'  .tools #shoot{display:none}',
'  .tools #bulkbtn{flex:1 1 auto;justify-content:center}',
'  .tools .search{flex:1 1 100%;min-width:0!important}',
'  .seg{flex:1 1 100%;overflow-x:auto;scrollbar-width:none}.seg::-webkit-scrollbar{display:none}',
'  .seg button{flex:1 0 auto;padding:12px 13px;font-size:12.5px}',
'  .btn{padding:11px 15px;font-size:14px;min-height:42px}',
'  .btn.sm{min-height:38px;font-size:13px;padding:8px 13px}',
'  .btn.retro{min-height:40px}',
'  .chip{min-height:36px;padding:7px 12px;font-size:12.5px}',
'  .rtog{min-height:42px;padding:9px 15px;font-size:14px}',
'  .rail{width:min(86vw,340px);flex-basis:auto;padding:16px 16px 70px}',
'  .flab{font-size:11px}',
'  .content{padding:14px 14px calc(112px + env(safe-area-inset-bottom))}',
'  .grid{grid-template-columns:1fr 1fr;gap:10px}',
'  .vit{aspect-ratio:1/.92}',
'  .bd{padding:11px 12px 12px;gap:6px}',
'  .nm{font-size:15.5px;line-height:1.18}',
'  .mk{font-size:11.5px}.can{font-size:10.5px}',
'  .pl{font-size:10.5px;padding:4px 8px}',
'  .stamp{font-size:10.5px;padding:4px 9px}',
'  .c{font-size:11px;padding:4px 8px}',
'  .foto-btn{font-size:11px;padding:8px 10px;right:auto;bottom:auto}',
'  .ov{padding:0;align-items:flex-end}',
'  .sheet,.sheet.wide{max-width:none;border-radius:20px 20px 0 0;max-height:calc(100dvh - 8px);animation:sale .22s cubic-bezier(.2,.8,.3,1) both}',
'  .shd{padding:16px 16px 0}.shb{padding:14px 16px 0}.shf{padding:12px 16px calc(14px + env(safe-area-inset-bottom));margin-top:14px}',
'  .shf .btn{min-height:46px}',
'  .slots{grid-template-columns:1fr}.slot{min-height:132px}',
'  .lbl{font-size:11px}',
'  .lbx{padding:12px 12px calc(16px + env(safe-area-inset-bottom))}',
'  .toast{bottom:calc(86px + env(safe-area-inset-bottom));font-size:14px;padding:12px 18px;max-width:92vw}',
'  .fab{display:flex}',
'  .nav::after{content:\'\';position:absolute;right:0;top:0;bottom:0;width:38px;background:linear-gradient(90deg,rgba(8,7,10,0),rgba(8,7,10,.92));pointer-events:none}',
'  .lgrid{display:flex;flex-wrap:nowrap;align-items:flex-start;overflow-x:auto;gap:8px;scroll-snap-type:x mandatory;scrollbar-width:none;margin:0 -16px;padding:0 16px 6px;-webkit-overflow-scrolling:touch}',
'  .lgrid::-webkit-scrollbar{display:none}',
'  .lc{flex:0 0 min(60%,236px)!important;min-width:0;height:auto;align-self:flex-start;scroll-snap-align:start}',
'  .mast:not(.st-catalogo) .cerca,.mast:not(.st-catalogo) .rtog{display:none}',
'  .lc:has(.duen){flex-basis:min(92%,360px)!important}',
'  .lc .duen{display:flex;flex-wrap:nowrap;gap:16px;align-items:flex-start}',
'  .card .foto-btn{position:static;width:100%;margin-top:2px}',
'  .lc .c{font-size:11px;letter-spacing:.06em}',
'  .chk{min-height:40px;font-size:14px}.chk input{width:20px;height:20px;accent-color:var(--bronzo);flex:0 0 auto}',
'  .lnk{font-size:13px;padding:8px 0;display:inline-block}',
'  .nvb.esci{padding:16px 12px 13px}',
'  .x{width:40px;height:40px;border-radius:999px}',
'  #sp-ricarica{min-height:38px;padding:8px 12px}',
'  .sp-tabs{overflow-x:auto;scrollbar-width:none;flex-wrap:nowrap}.sp-tabs::-webkit-scrollbar{display:none}',
'  .sp-tabs button{flex:0 0 auto;min-height:42px}',
'}',
'@keyframes sale{from{transform:translateY(28px);opacity:0}to{transform:none;opacity:1}}'
    ].join('\n');
  }

  /* ======================= utilità ======================= */
  function escHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  /* L'identificativo lo decide il client e il database lo accetta così com'è:
     una bottiglia ha lo stesso nome in memoria e su disco, sempre. */
  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = crypto.getRandomValues(new Uint8Array(1))[0] % 16;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
  function num(v) { if (v === '' || v == null) return null; var n = Number(v); return isNaN(n) ? null : n; }
  function fmtM(n) {
    if (n == null) return '—';
    try { return n.toLocaleString('it-IT', { style: 'currency', currency: STATE.meta.valuta || 'EUR', maximumFractionDigits: 0 }); }
    catch (e) { return Math.round(n) + ' €'; }
  }
  function grad(b) { return b.gradazione ? String(b.gradazione).replace('.', ',') : ''; }
  function fmtD(iso) {
    if (!iso) return '—';
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function inCoda(b) { return b.stato === 'da_analizzare'; }
  function uscita(b) { return b.stato === 'bevuta' || b.stato === 'venduta' || b.stato === 'regalata'; }
  function inCantina(b) { return !uscita(b); }
  function qty(b) { return Math.max(1, Number(b.quantita) || 1); }
  // Per decidere conta quello che entra in tasca: il netto d'asta.
  function delta(b) {
    var a = num(b.prezzo_acquisto), c = nettoAsta(b);
    if (a == null || c == null || a === 0) return null;
    return ((c - a) / a) * 100;
  }
  /* Sulla scheda la cifra grande è il prezzo di vetrina e accanto c'è la
     linea dell'andamento: la percentuale deve dire la stessa cosa della
     linea, cioè come si muove il mercato. Il confronto con quanto è stato
     pagato sta nella scheda aperta, dove il prezzo pagato è lì a fianco. */
  function uniq(f, arr) {
    var s = {};
    STATE.bottles.forEach(function (b) {
      if (arr) (b[f] || []).forEach(function (v) { if (v) s[v] = true; });
      else if (b[f]) s[b[f]] = true;
    });
    return Object.keys(s).sort(function (a, b) { return a.localeCompare(b, 'it'); });
  }
  function incerto(b, c) { return (b.campi_incerti || []).indexOf(c) !== -1; }
  /* Dove sta fisicamente. Con centinaia di bottiglie è la differenza fra
     sapere che ce l'hai e riuscire ad andartela a prendere. */
  function posizione(b) {
    var k = nInt(b.scaffale);
    var p = [b.zona, b.scaffale ? (k != null ? 'scaff. ' + k : b.scaffale) : '', b.ripiano ? 'rip. ' + b.ripiano : ''].filter(Boolean);
    return p.length ? p.join(' · ') : '';
  }
  function zonaDi(b) { return (b.zona || '').trim() || 'Senza posizione'; }
  function scaffaleDi(b) { return (b.scaffale || '').trim() || '—'; }
  function codaBytes() {
    var t = 0;
    STATE.bottles.filter(inCoda).forEach(function (b) { t += (b.foto_fronte || '').length + (b.foto_retro || '').length; });
    return t * 0.75;
  }
  function esempi() { return STATE.bottles.filter(function (b) { return b.esempio; }); }

  /* colore del blocco: per famiglia, non per tipologia esatta.
     Cinque tinte distinguibili valgono più di otto che si somigliano —
     la tipologia precisa è scritta su ogni scheda. */
  /* ============ il colore del liquido ============
     Una sola tinta per bottiglia, e dice cosa c'e' dentro: rosso, bianco,
     rose', whisky, rum, gin, grappa, liquore, altro. Guida il tag in alto,
     la striscia della scheda, il filetto sotto il nome e la targhetta
     dell'annata. Ogni tinta e' verificata per contrasto sul fondo scuro
     (>= 4,5:1 anche dentro la pastiglia). Sette categorie sono piu' di
     quante il colore da solo possa distinguere in sicurezza: per questo la
     parola resta sempre scritta accanto alla tinta, mai al posto suo. */
  var LIQ = {
    rosso:   { hex: '#E2536A', et: 'Rosso' },
    rose:    { hex: '#E08FAB', et: 'Ros\u00e9' },
    bianco:  { hex: '#D9BE5A', et: 'Bianco' },
    whisky:  { hex: '#D08F26', et: 'Whisky' },
    rum:     { hex: '#C87947', et: 'Rum' },
    gin:     { hex: '#16AC9A', et: 'Gin' },
    grappa:  { hex: '#9C93B8', et: 'Grappa' },
    liquore: { hex: '#8E7CE8', et: 'Liquore' },
    altro:   { hex: '#8C84A6', et: 'Altro' },
    coda:    { hex: '#5A5370', et: 'In coda' }
  };
  function liquido(b) {
    if (inCoda(b)) return 'coda';
    var t = b.tipologia;
    if (t === 'Vino' || t === 'Spumante') {
      if (b.colore === 'Rosso') return 'rosso';
      if (b.colore === 'Ros\u00e9') return 'rose';
      if (b.colore === 'Bianco') return 'bianco';
      return 'altro';
    }
    if (t === 'Whisky') return 'whisky';
    if (t === 'Rum') return 'rum';
    if (t === 'Gin') return 'gin';
    if (t === 'Grappa') return 'grappa';
    if (t === 'Liquore') return 'liquore';
    return 'altro';
  }
  function famiglia(b) { return liquido(b); }
  function rgba(hex, a) {
    return 'rgba(' + parseInt(hex.substr(1, 2), 16) + ',' + parseInt(hex.substr(3, 2), 16) +
      ',' + parseInt(hex.substr(5, 2), 16) + ',' + a + ')';
  }
  function blkVars(b) {
    var h = LIQ[liquido(b)].hex;
    return '--ac:' + h + ';--acs:' + rgba(h, .17) + ';--acw:' + rgba(h, .08);
  }
  function tagLiquido(b) { return '<span class="pl liq">' + LIQ[liquido(b)].et + '</span>'; }

  /* Annata, eta' dichiarata, o nessuna delle due.
     NAS = "No Age Statement": l'etichetta non dichiara quanti anni ha il
     distillato. Non e' un difetto ed e' normalissimo su gin e rum. */
  function eta(b) {
    if (b.eta) return { big: escHtml(b.eta), lab: 'anni', tip: 'Invecchiamento dichiarato in etichetta' };
    if (b.annata && b.annata !== 'NAS') return { big: escHtml(b.annata), lab: 'annata', tip: '' };
    if (b.annata === 'NAS' || (spirito(b) && !b.annata)) {
      return { big: 'NAS', lab: 'senza et\u00e0', tip: 'No Age Statement: l\u2019etichetta non dichiara l\u2019et\u00e0. Normale su gin, rum e molti whisky.' };
    }
    return null;
  }
  function etaTesto(b) {
    var e = eta(b);
    if (!e) return '';
    return e.lab === 'anni' ? e.big + ' anni' : e.big;
  }


  /* ==================================================================
     MOTORE DELLE QUOTAZIONI
     Nessun listino si lascia leggere in diretta: i valori arrivano da
     ricerche periodiche su più fonti, ognuna datata. Ogni rilevazione
     è un punto dello storico — è la serie, non il singolo numero, a
     dire se una bottiglia sta salendo.
     ================================================================== */

  function serie(b) {
    var s = (b.storico || []).filter(function (p) { return p && p.data && num(p.vetrina) != null; });
    return s.sort(function (x, y) { return (x.data || '').localeCompare(y.data || ''); });
  }
  function vetrina(b) {                       // prezzo chiesto dai negozi
    var s = serie(b);
    return s.length ? num(s[s.length - 1].vetrina) : num(b.valore_attuale);
  }
  function dataQuot(b) { var s = serie(b); return s.length ? s[s.length - 1].data : (b.valore_data || ''); }
  function fonteQuot(b) { var s = serie(b); return s.length ? (s[s.length - 1].fonte || '') : (b.valore_fonte || ''); }
  function resaPriv() { var r = num(STATE.meta.resa_privata); return r == null ? 0.85 : r; }
  function resaAsta() { var r = num(STATE.meta.resa_asta); return r == null ? 0.60 : r; }
  function nettoPriv(b) { var v = vetrina(b); return v == null ? null : v * resaPriv(); }
  function nettoAsta(b) { var v = vetrina(b); return v == null ? null : v * resaAsta(); }

  function giorniFra(a, b) {
    var d1 = new Date(a + 'T00:00:00'), d2 = new Date(b + 'T00:00:00');
    if (isNaN(d1) || isNaN(d2)) return null;
    return Math.round((d2 - d1) / 86400000);
  }
  function giorniDaQuot(b) {
    var d = dataQuot(b);
    return d ? giorniFra(d, today()) : null;
  }
  // variazione annualizzata fra la prima e l'ultima rilevazione utile
  function momentum(b) {
    var s = serie(b);
    if (s.length < 2) return null;
    var a = s[0], z = s[s.length - 1];
    var gg = giorniFra(a.data, z.data);
    if (gg == null || gg < 14) return null;
    var v0 = num(a.vetrina), v1 = num(z.vetrina);
    if (!v0) return null;
    return (Math.pow(v1 / v0, 365 / gg) - 1) * 100;
  }

  /* Finestra di bevuta → un solo numero: gli ANNI CHE RESTANO prima che
     si chiuda. Alto = hai tempo. Basso o negativo = decidi adesso.
     I distillati in bottiglia sigillata non decadono: stanno in cima
     alla scala e li decide solo il mercato. */
  var SPIRITI = { Whisky: 1, Rum: 1, Gin: 1, Grappa: 1, Liquore: 1 };
  function spirito(b) { return !!SPIRITI[b.tipologia]; }
  // anni che restano prima che la finestra si chiuda. null per i distillati
  // (in bottiglia sigillata non scadono) e per le finestre ignote.
  function anniResidui(b) {
    if (spirito(b)) return null;
    var anno = new Date().getFullYear();
    var t = String(b.annata_migliore || '');
    var anni = (t.match(/\d{4}/g) || []).map(Number);
    if (anni.length >= 2) return anni[anni.length - 1] - anno;
    if (anni.length === 1) return anni[0] + 4 - anno;
    if (/pronta|adesso|ora/i.test(t)) return 2;
    return null;
  }
  function statoFinestra(b) {
    if (spirito(b)) return 'distillato';
    var a = anniResidui(b);
    if (a == null) return 'ignota';
    if (a < 0) return 'oltre';
    if (a <= 3) return 'in chiusura';
    return 'ampia';
  }

  var SOGLIA_VENDITA = 50;    // euro netti d'asta sotto cui vendere non vale la pena
  function sogliaVendita() { var v = num(STATE.meta.soglia_vendita); return v == null ? SOGLIA_VENDITA : v; }
  function vendibile(b) { var n = nettoAsta(b); return n == null || n >= sogliaVendita(); }
  var SOGLIA_VECCHIA = 120;   // giorni oltre i quali la quotazione è da rifare
  var SOGLIA_FORTE = 15;      // %/anno oltre cui la crescita è "forte"

  /* Il segnale: cosa conviene fare con questa bottiglia, oggi. */
  function segnale(b) {
    if (inCoda(b) || uscita(b)) return null;
    var v = vetrina(b), gg = giorniDaQuot(b);
    if (v == null || gg == null || gg > SOGLIA_VECCHIA) return 'quotare';
    var m = momentum(b), a = anniResidui(b);
    if (spirito(b) || a == null) return (m == null || m >= 0) ? 'tieni' : 'osserva';
    if (a <= 3) {
      var sg = (m == null || m >= 0) ? 'vendi' : 'bevi';
      // Vendere costa fatica: trovare il compratore, imballare, spedire.
      // Sotto la soglia non ripaga, e il consiglio onesto diventa: stappala.
      return (sg === 'vendi' && !vendibile(b)) ? 'bevi' : sg;
    }
    return (m == null || m >= 0) ? 'tieni' : 'osserva';
  }
  function rinforza(b) {
    var m = momentum(b);
    return segnale(b) === 'tieni' && m != null && m >= SOGLIA_FORTE;
  }
  var SEGNALI = {
    vendi:   { et: 'Finestra di uscita',   col: 'ambra' },
    tieni:   { et: 'Tieni',   col: 'teal' },
    bevi:    { et: 'Bevi',    col: 'cremisi' },
    osserva: { et: 'Osserva', col: 'neutro' },
    quotare: { et: 'Da quotare', col: 'violetto' }
  };

  /* Perché, in una riga. Senza motivo un consiglio non serve a niente. */
  function perche(b) {
    var s = segnale(b);
    if (!s) return '';
    var m = momentum(b), a = anniResidui(b), gg = giorniDaQuot(b);
    var mv = m == null ? null : (m >= 0 ? '+' : '') + m.toFixed(0) + '%/anno';
    var np = nettoAsta(b), pg = num(b.prezzo_acquisto);
    var esito = (np != null && pg) ? (np >= pg ? 'in guadagno anche al netto' : 'sotto il prezzo pagato, al netto') : '';
    if (s === 'quotare') {
      if (vetrina(b) == null) return 'Non è mai stata quotata.';
      return 'Ultima quotazione ' + (gg == null ? 'senza data' : 'di ' + gg + ' giorni fa') + ': troppo vecchia per fidarsi.';
    }
    if (s === 'vendi') {
      return 'La finestra si chiude ' + (a < 0 ? 'è già chiusa' : 'fra ' + a + (a === 1 ? ' anno' : ' anni')) +
        ' e il mercato ' + (m == null ? 'non è ancora misurabile' : 'tiene (' + mv + ')') + (esito ? ' — ' + esito : '') + '.';
    }
    if (s === 'bevi') {
      if (!vendibile(b)) {
        return 'Finestra ' + (a < 0 ? 'già chiusa' : 'in chiusura') + ', ma venderla lascerebbe ' + fmtM(np) +
          ' netti: sotto i ' + fmtM(sogliaVendita()) + ' la vendita non ripaga la fatica. Stappala.';
      }
      return 'Finestra ' + (a < 0 ? 'già chiusa' : 'quasi chiusa') + ' e mercato in calo (' + mv + '): aspettare non paga più.';
    }
    if (s === 'tieni') {
      return 'Hai ancora ' + (spirito(b) || a == null ? 'tutto il tempo che vuoi' : a + (a === 1 ? ' anno' : ' anni') + ' di finestra') +
        ' e il mercato sale' + (mv ? ' (' + mv + ')' : '') + (rinforza(b) ? '. Crescita forte: varrebbe la pena averne altre.' : '.');
    }
    if (s === 'osserva') {
      return 'Mercato in calo (' + mv + ') ma ' + (spirito(b) || a == null ? 'non c’è fretta: in bottiglia non si rovina' : 'la finestra è ancora lontana') + '. Nessuna urgenza.';
    }
    return '';
  }
  function conSegnale(s) {
    return STATE.bottles.filter(function (b) { return segnale(b) === s; })
      .sort(function (x, y) { return (nettoAsta(y) || 0) * qty(y) - (nettoAsta(x) || 0) * qty(x); });
  }

  /* ============ illustrazione della bottiglia ============ */
  var SAG = {
    bordolese: 'M30,236 V112 C30,97 38,90 40,81 V22 H60 V81 C62,90 70,97 70,112 V236 Z',
    borgognotta: 'M27,236 V124 C27,101 40,93 40,76 V22 H60 V76 C60,93 73,101 73,124 V236 Z',
    spumante: 'M25,236 V128 C25,103 40,95 40,74 V24 H60 V74 C60,95 75,103 75,128 V236 Z',
    tozza: 'M27,236 V136 C27,120 40,114 40,104 V32 H60 V104 C60,114 73,120 73,136 V236 Z',
    slanciata: 'M33,236 V128 L33,122 L44,97 V24 H56 V97 L67,122 V236 Z'
  };
  function sagoma(b) {
    if (b.tipologia === 'Spumante') return 'spumante';
    if (b.tipologia === 'Gin' || b.tipologia === 'Grappa') return 'slanciata';
    if (b.tipologia === 'Whisky' || b.tipologia === 'Rum' || b.tipologia === 'Liquore') return 'tozza';
    if (b.tipologia === 'Vino') return b.colore === 'Rosso' ? 'bordolese' : 'borgognotta';
    return 'bordolese';
  }
  /* Il colore del vetro è quello del liquido: due toni, il fondo scuro e la
     luce che lo attraversa. Rosso, rosé, bianco paglierino, ambra del whisky,
     bruno del rum, verde del gin, grigio della grappa, ruggine dei liquori. */
  function vetro(b) {
    if (b.tipologia === 'Vino' || b.tipologia === 'Spumante') {
      if (b.colore === 'Rosso') return ['#43121C', '#8A2438'];
      if (b.colore === 'Rosé') return ['#8A485C', '#D08296'];
      return ['#665C1C', '#AE9D48'];
    }
    if (b.tipologia === 'Whisky') return ['#4E2A0E', '#A66224'];
    if (b.tipologia === 'Rum') return ['#3B2210', '#84501E'];
    if (b.tipologia === 'Gin') return ['#173028', '#3E7A64'];
    if (b.tipologia === 'Grappa') return ['#2C2C31', '#6A6A72'];
    if (b.tipologia === 'Liquore') return ['#4C2323', '#8E4A3E'];
    if (!b.tipologia) return ['#26232E', '#4A4560'];
    return ['#2C2A26', '#5C564C'];
  }
  var sid = 0;
  function bottleSVG(b) {
    var n = sid++, g = 'bs' + n, s = SAG[sagoma(b)], v = vetro(b);
    var cap = b.tipologia === 'Spumante' ? '#A6821F' : (b.colore === 'Rosso' ? '#43121C' : '#2A2724');
    /* Tutto quello che sta "sul vetro" — riflesso, ombra, capsula, etichetta —
       viene ritagliato sulla sagoma. Cosi nessuna bottiglia, per quanto
       stretta, si porta dietro una striscia che le esce dai fianchi. */
    var cl = 'bc' + n, hl = 'bh' + n, om = 'bo' + n, fd = 'bf' + n;
    return '<svg viewBox="0 0 100 240" role="img" aria-label="Illustrazione della bottiglia">' +
      '<defs>' +
      '<clipPath id="' + cl + '"><path d="' + s + '"/></clipPath>' +
      '<linearGradient id="' + g + '" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0%" stop-color="' + v[0] + '"/><stop offset="34%" stop-color="' + v[1] + '"/>' +
      '<stop offset="64%" stop-color="' + v[0] + '"/><stop offset="100%" stop-color="' + v[1] + '" stop-opacity=".82"/>' +
      '</linearGradient>' +
      /* il riflesso: una banda morbida, non un rettangolo bianco */
      '<linearGradient id="' + hl + '" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0%" stop-color="#fff" stop-opacity="0"/>' +
      '<stop offset="42%" stop-color="#fff" stop-opacity=".30"/>' +
      '<stop offset="68%" stop-color="#fff" stop-opacity=".10"/>' +
      '<stop offset="100%" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
      /* il fianco in ombra, che da rotondita */
      '<linearGradient id="' + om + '" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0%" stop-color="#000" stop-opacity="0"/>' +
      '<stop offset="100%" stop-color="#000" stop-opacity=".34"/></linearGradient>' +
      /* la sfumatura verticale che spegne riflesso e ombra alle estremita */
      '<linearGradient id="' + fd + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#fff" stop-opacity="0"/>' +
      '<stop offset="14%" stop-color="#fff" stop-opacity="1"/>' +
      '<stop offset="86%" stop-color="#fff" stop-opacity="1"/>' +
      '<stop offset="100%" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
      '<mask id="' + fd + 'm"><rect x="0" y="18" width="100" height="220" fill="url(#' + fd + ')"/></mask>' +
      '</defs>' +
      '<path d="' + s + '" fill="url(#' + g + ')"/>' +
      '<g clip-path="url(#' + cl + ')">' +
        '<g mask="url(#' + fd + 'm)">' +
          '<rect x="26" y="18" width="24" height="220" fill="url(#' + hl + ')"/>' +
          '<rect x="58" y="18" width="20" height="220" fill="url(#' + om + ')"/>' +
        '</g>' +
        /* capsula: ritagliata, quindi larga esattamente quanto il collo */
        '<rect x="30" y="18" width="40" height="21" fill="' + cap + '"/>' +
        '<rect x="30" y="37" width="40" height="1.2" fill="#000" opacity=".28"/>' +
        /* etichetta: mai piu larga della bottiglia */
        '<rect x="30" y="150" width="40" height="58" fill="#F2EDE0" opacity=".96"/>' +
        '<rect x="30" y="150" width="40" height="1" fill="#000" opacity=".12"/>' +
        '<rect x="30" y="207" width="40" height="1" fill="#000" opacity=".12"/>' +
        '<rect x="36" y="160" width="28" height="2.6" fill="#4A4438" opacity=".85"/>' +
        '<rect x="39" y="169" width="22" height="1.8" fill="#7E7563" opacity=".8"/>' +
        '<rect x="36" y="183" width="28" height="1.5" fill="#7E7563" opacity=".6"/>' +
        '<rect x="36" y="189" width="21" height="1.5" fill="#7E7563" opacity=".6"/>' +
        '<rect x="36" y="197" width="25" height="1.5" fill="#7E7563" opacity=".6"/>' +
        /* il fondo: un velo scuro, come il culo di bottiglia */
        '<ellipse cx="50" cy="238" rx="26" ry="7" fill="#000" opacity=".30"/>' +
      '</g>' +
      '<path d="' + s + '" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="1"/>' +
      '</svg>';
  }

  /* Le foto sono scatti veloci fatti mentre si mette in ordine la cantina:
     utilissimi da consultare, pessimi da guardare tutti insieme. In vista
     resta il disegno della bottiglia — stessa luce, stessa scala, stesso
     passo — e la foto vera sta dietro un pulsante. */
  function haFoto(b) { return !!(b.foto_fronte || b.foto_retro); }
  function art(b) { return bottleSVG(b); }
  /* Le foto che Max scatta bottiglia per bottiglia non stanno nell'elenco —
     confonderebbero l'occhio — ma sono sempre a un clic di distanza, da ogni
     scheda e dalla scheda aperta. */
  function bottoneFoto(b, testo) {
    if (!haFoto(b)) return '';
    var n = (b.foto_fronte ? 1 : 0) + (b.foto_retro ? 1 : 0);
    return '<button type="button" class="foto-btn" data-foto="' + b.id + '">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5.5" width="19" height="14" rx="2.5"/><circle cx="12" cy="12.5" r="4"/><path d="M8 5.5 9.5 3h5L16 5.5"/></svg>' +
      (testo || 'Guarda le foto') + '<span class="fn">' + n + '</span></button>';
  }


  /* ================= CRUSCOTTO: cosa conviene fare oggi ================= */
  var ORD_SEGNALI = ['vendi', 'bevi', 'tieni', 'osserva', 'quotare'];
  var SPIEGA = {
    vendi: 'La finestra di bevuta sta per chiudersi e il mercato regge: se vuoi uscire da questa bottiglia, il momento è ora. Venderla è una scelta tua, non un consiglio.',
    bevi: 'Finestra agli sgoccioli e niente da guadagnare a venderle — o perché il mercato non premia più, o perché al netto resterebbe troppo poco. Il valore migliore che puoi ricavarne è stapparle.',
    tieni: 'Tempo davanti e prezzi in salita: aspettare guadagna su entrambi i fronti. Quelle segnate “rinforza” crescono così in fretta che varrebbe la pena averne altre.',
    osserva: 'Prezzi in calo ma nessuna urgenza: niente da fare adesso, si ricontrolla al prossimo giro.',
    quotare: 'Senza una quotazione recente qualsiasi consiglio sarebbe inventato. Queste vanno riquotate.'
  };
  function cruscotto() {
    var utili = STATE.bottles.filter(function (b) { return segnale(b); });
    if (!utili.length) return '';
    var tiles = ORD_SEGNALI.map(function (k) {
      var l = conSegnale(k);
      var tot = l.reduce(function (s, b) { return s + (nettoAsta(b) || 0) * qty(b); }, 0);
      var on = filters.segnale === k;
      return '<button type="button" class="tile' + (on ? ' on' : '') + '" data-seg="' + k + '" style="--ac:var(--' + SEGNALI[k].col + ')" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        '<span class="tn tab">' + l.length + '</span>' +
        '<span class="tl">' + SEGNALI[k].et + '</span>' +
        '<span class="tv tab">' + (tot ? fmtM(tot) + ' netti' : '—') + '</span></button>';
    }).join('');
    var sel = filters.segnale;
    return '<section class="dash"><div class="dash-hd"><h3>Cosa conviene fare oggi</h3>' +
      '<span class="dash-note">Valori al netto: stima d’asta, ' + Math.round(resaAsta() * 100) + '% del prezzo di vetrina</span></div>' +
      '<div class="tiles">' + tiles + '</div>' +
      (sel ? '<p class="dash-x"><strong>' + SEGNALI[sel].et + '.</strong> ' + SPIEGA[sel] + ' <button type="button" class="lnk" id="seg-off">mostra tutte</button></p>' : '') +
      '<p class="disc">Il segnale dice quando una bottiglia è al meglio, non cosa fare dei tuoi soldi. La vendita, se la vuoi, la decidi tu: puoi metterla in bacheca nello Speakeasy e parlarne direttamente con un altro membro. Caveau non compra mai per conto proprio.</p>' +
      '</section>';
  }

  /* ================= MATRICE DECISIONALE =================
     Due assi soltanto: quanto tempo resta prima che la finestra di bevuta
     si chiuda, e come si sta muovendo il mercato. La posizione È il
     consiglio, quindi i punti hanno un colore solo: cinque tinte come
     puntini piccoli non si distinguono (ambra e lime risultano identiche
     per chi ha daltonismo), e qui il colore sarebbe comunque ridondante.
     La grandezza dice quanto valore rappresenta quella riga in cantina. */
  function matrice(l) {
    var vivi = l.filter(function (b) { return segnale(b) && segnale(b) !== 'quotare' && momentum(b) != null; });
    var vini = vivi.filter(function (b) { return !spirito(b) && anniResidui(b) != null; });
    var dist = vivi.filter(function (b) { return spirito(b) || anniResidui(b) == null; });
    var fuori = l.filter(function (b) { return segnale(b) && vivi.indexOf(b) === -1; });
    if (!vivi.length) {
      return '<div class="empty"><h2>Non c’è ancora abbastanza storia</h2><p>La matrice ha bisogno di almeno due quotazioni per bottiglia, a settimane di distanza: solo così si può dire se una bottiglia sta salendo. Arriveranno con i prossimi aggiornamenti mensili.</p></div>';
    }
    var W = 760, H = 470, L = 66, R = 26, T = 26, Bo = 54;
    var FASCIA = 52;                      // fascia dei distillati, sopra la scala
    var PT = T + FASCIA;                  // inizio del piano dei vini
    var xmin = -30, xmax = 40, ymin = -5, ymax = 34, ysplit = 3;
    // radice quadrata con segno: dà spazio agli anni vicini allo zero,
    // dove si decide, e comprime la coda lunga delle bottiglie giovani
    function sq(v) { return (v < 0 ? -1 : 1) * Math.sqrt(Math.abs(v)); }
    var sy0 = sq(ymin), sy1 = sq(ymax);
    function X(v) { return L + (Math.max(xmin, Math.min(xmax, v)) - xmin) / (xmax - xmin) * (W - L - R); }
    function Y(v) {
      var t = (sq(Math.max(ymin, Math.min(ymax, v))) - sy0) / (sy1 - sy0);
      return PT + (1 - t) * (H - PT - Bo);
    }
    var x0 = X(0), y0 = Y(ysplit);
    var tutti = vini.concat(dist);
    var maxV = Math.max.apply(null, tutti.map(function (b) { return (nettoAsta(b) || 0) * qty(b); }).concat([1]));
    function raggio(b) { return 5.5 + 9 * Math.sqrt(((nettoAsta(b) || 0) * qty(b)) / maxV); }
    function zona(xa, xb, ya, yb, col) {
      return '<rect x="' + xa + '" y="' + ya + '" width="' + (xb - xa) + '" height="' + (yb - ya) + '" fill="var(--' + col + ')" opacity=".055"/>';
    }
    function dot(b, cx, cy) {
      var info = (momentum(b) >= 0 ? '+' : '') + momentum(b).toFixed(0) + '%/anno · ' +
        (spirito(b) ? 'non scade' : anniResidui(b) + (anniResidui(b) === 1 ? ' anno' : ' anni') + ' di finestra') +
        ' · ' + fmtM((nettoAsta(b) || 0) * qty(b)) + ' netti';
      return '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + raggio(b).toFixed(1) + '" class="mdot" tabindex="0" role="button" ' +
        'data-mid="' + b.id + '" data-nome="' + escHtml(b.nome || 'Senza nome') + '" data-info="' + escHtml(info) + '">' +
        '<title>' + escHtml(b.nome || '') + '</title></circle>';
    }
    // i distillati si distribuiscono nella fascia solo sull'asse del mercato
    var yDist = T + FASCIA / 2 + 4;
    var puntiDist = dist.slice().sort(function (a, b) { return X(momentum(a)) - X(momentum(b)); })
      .map(function (b) { return dot(b, X(momentum(b)), yDist); }).join('');
    var puntiVini = vini.slice().sort(function (a, b) { return ((nettoAsta(b) || 0) * qty(b)) - ((nettoAsta(a) || 0) * qty(a)); })
      .map(function (b) { return dot(b, X(momentum(b)), Y(anniResidui(b))); }).join('');
    var top = vini.slice().sort(function (a, b) { return ((nettoAsta(b) || 0) * qty(b)) - ((nettoAsta(a) || 0) * qty(a)); }).slice(0, 3);

    var tacche = [0, 1, 3, 6, 12, 24].map(function (v) {
      return '<text x="' + (L - 10) + '" y="' + (Y(v) + 4) + '" class="mal" text-anchor="end">' + v + '</text>';
    }).join('');

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="mx" role="img" aria-label="Matrice: anni di finestra residui contro andamento del mercato">' +
      zona(x0, W - R, PT, y0, 'teal') + zona(x0, W - R, y0, H - Bo, 'ambra') +
      zona(L, x0, y0, H - Bo, 'cremisi') + zona(L, x0, PT, y0, 'neutro') +
      '<rect x="' + L + '" y="' + T + '" width="' + (W - L - R) + '" height="' + FASCIA + '" fill="var(--pan2)" opacity=".55"/>' +
      '<line x1="' + L + '" y1="' + PT + '" x2="' + (W - R) + '" y2="' + PT + '" class="max"/>' +
      '<line x1="' + L + '" y1="' + y0 + '" x2="' + (W - R) + '" y2="' + y0 + '" class="max"/>' +
      '<line x1="' + x0 + '" y1="' + PT + '" x2="' + x0 + '" y2="' + (H - Bo) + '" class="max"/>' +
      '<rect x="' + L + '" y="' + PT + '" width="' + (W - L - R) + '" height="' + (H - PT - Bo) + '" class="mfr"/>' +
      '<text x="' + (L + 9) + '" y="' + (T + 16) + '" class="mq" text-anchor="start">DISTILLATI · NON SCADONO</text>' +
      '<text x="' + (W - R - 9) + '" y="' + (PT + 20) + '" class="mq" text-anchor="end">TIENI</text>' +
      '<text x="' + (W - R - 9) + '" y="' + (y0 + 21) + '" class="mq" text-anchor="end">USCITA</text>' +
      '<text x="' + (L + 9) + '" y="' + (y0 + 21) + '" class="mq" text-anchor="start">BEVI</text>' +
      '<text x="' + (L + 9) + '" y="' + (PT + 20) + '" class="mq" text-anchor="start">OSSERVA</text>' +
      tacche +
      '<text x="' + L + '" y="' + (H - 22) + '" class="mal" text-anchor="start">← mercato in calo</text>' +
      '<text x="' + (W - R) + '" y="' + (H - 22) + '" class="mal" text-anchor="end">mercato in crescita →</text>' +
      '<text x="' + ((L + W - R) / 2) + '" y="' + (H - 6) + '" class="mat" text-anchor="middle">variazione annualizzata del prezzo</text>' +
      '<text transform="translate(15,' + ((PT + H - Bo) / 2) + ') rotate(-90)" class="mat" text-anchor="middle">anni di finestra che restano</text>' +
      puntiVini + puntiDist +
      top.map(function (b) {
        var cx = X(momentum(b)), cy = Y(anniResidui(b)), r = raggio(b);
        var destra = cx < W / 2;
        return '<text x="' + (cx + (destra ? r + 7 : -(r + 7))).toFixed(1) + '" y="' + (cy + 4).toFixed(1) + '" class="mdl" text-anchor="' + (destra ? 'start' : 'end') + '">' + escHtml((b.nome || '').slice(0, 22)) + '</text>';
      }).join('') +
      '</svg>';

    return '<div class="mwrap"><div class="mbox">' + svg + '<div class="mtip" id="mtip" hidden></div></div>' +
      '<p class="mleg">Ogni cerchio è una bottiglia; la grandezza è il valore netto che rappresenta in cantina. La scala verticale è compressa in alto: lo spazio sta dove si decide, cioè vicino alla chiusura della finestra.</p>' +
      (fuori.length ? '<div class="mout"><strong>' + fuori.length + (fuori.length === 1 ? ' bottiglia non collocabile' : ' bottiglie non collocabili') + '</strong> — servono almeno due quotazioni a distanza di settimane per misurare un andamento: ' +
        fuori.slice(0, 8).map(function (b) { return escHtml(b.nome || 'senza nome'); }).join(', ') + (fuori.length > 8 ? '…' : '') + '</div>' : '') +
      '</div>';
  }

  /* grafico minuscolo dell'andamento, sulla scheda */
  function spark(b) {
    var s = serie(b);
    if (s.length < 2) return '';
    var v = s.map(function (p) { return num(p.vetrina); });
    var mn = Math.min.apply(null, v), mx = Math.max.apply(null, v), sp = (mx - mn) || 1;
    var W = 56, H = 16;
    var d = v.map(function (y, i) {
      return (i ? 'L' : 'M') + (i / (v.length - 1) * W).toFixed(1) + ',' + (H - (y - mn) / sp * (H - 3) - 1.5).toFixed(1);
    }).join(' ');
    var su = v[v.length - 1] >= v[0];
    return '<svg class="spk" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><path d="' + d + '" fill="none" stroke="' + (su ? 'var(--pos)' : 'var(--neg)') + '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + W + '" cy="' + (H - (v[v.length - 1] - mn) / sp * (H - 3) - 1.5).toFixed(1) + '" r="2" fill="' + (su ? 'var(--pos)' : 'var(--neg)') + '"/></svg>';
  }
  function badge(b) {
    var s = segnale(b);
    if (!s) return '';
    return '<span class="sg" style="--ac:var(--' + SEGNALI[s].col + ')">' + SEGNALI[s].et + (rinforza(b) ? ' +' : '') + '</span>';
  }


  /* Il pannello che spiega il consiglio: da dove viene il numero, cosa
     resterebbe davvero in tasca, e com'è andato il prezzo finora. */
  function pannelloQuot(b) {
    if (inCoda(b)) return '';
    var sg = segnale(b), v = vetrina(b), m = momentum(b), gg = giorniDaQuot(b);
    var s = serie(b), pg = num(b.prezzo_acquisto);
    function cifra(et, val, sub) {
      return '<div class="qc"><div class="qk">' + et + '</div><div class="qv tab">' + fmtM(val) + '</div>' + (sub ? '<div class="qs">' + sub + '</div>' : '') + '</div>';
    }
    function pct(a, base) { if (a == null || !base) return ''; var d = (a - base) / base * 100; return '<span class="' + (d >= 0 ? 'pos' : 'neg') + '">' + (d >= 0 ? '+' : '') + d.toFixed(0) + '%</span>'; }
    return '<section class="quot">' +
      (sg ? '<div class="qhd">' + badge(b) + '<p>' + escHtml(perche(b)) + '</p></div>' : '') +
      '<div class="qgrid">' +
      cifra('Pagato', pg) +
      cifra('Vetrina oggi', v, gg == null ? 'mai quotata' : (gg === 0 ? 'aggiornata oggi' : gg + ' giorni fa')) +
      cifra('Netto · privato', nettoPriv(b), pct(nettoPriv(b), pg) + ' sul pagato') +
      cifra('Netto · asta', nettoAsta(b), pct(nettoAsta(b), pg) + ' sul pagato') +
      '</div>' +
      (m != null ? '<p class="qm">Andamento <strong class="' + (m >= 0 ? 'pos' : 'neg') + '">' + (m >= 0 ? '+' : '') + m.toFixed(1) + '% all’anno</strong> su ' + s.length + ' rilevazioni.</p>'
                 : '<p class="qm">Serve una seconda quotazione, a settimane di distanza, per misurare l’andamento.</p>') +
      (s.length ? '<ul class="qst">' + s.slice().reverse().map(function (p) {
        return '<li><span class="qd">' + fmtD(p.data) + '</span><span class="qp tab">' + fmtM(num(p.vetrina)) + '</span><span class="qf">' + escHtml(p.fonte || '') + '</span></li>';
      }).join('') + '</ul>' : '') +
      '<p class="qnote">I valori vengono da ricerche periodiche su cataloghi di settore e risultati d’asta: non sono un listino in diretta. Il netto è una stima — privata ' + Math.round(resaPriv() * 100) + '%, asta ' + Math.round(resaAsta() * 100) + '% del prezzo di vetrina — modificabile dai filtri.</p>' +
      '</section>';
  }


  /* ======================= PROFILO E SPEAKEASY =======================
     Lo Speakeasy è la bacheca riservata del club: solo le bottiglie che un
     membro ha scelto di condividere, vino e distillati, in vendita a prezzo
     totale del lotto oppure in scambio. Tre schede: Bacheca, Le mie proposte,
     Membri. Il profilo personale sta nel menu in alto.
     Niente funzioni social: nessun contatore pubblico, like, classifica o
     reputazione. I recapiti si rivelano solo alle due parti, dopo che
     entrambe hanno accettato, e solo quelli che ciascuna ha scelto.
     Tutto ciò che si legge o si scrive passa dalle funzioni del database:
     decidono loro cosa mostrare a chi. */
  var PROFILO = { piano: 'club', stato_candidatura: 'nessuna', nome: '', email: '', fondatore: false, citta: '', citta_visibile: false, paese: '', lingua: 'it', interessi: [], descrizione: '', completo: false };
  function clubAttivo() { return true; }
  var SP = { cfg: null, bacheca: null, proposte: null, membri: null, membro: null, foto: {}, contatti: {}, caricando: false };
  var spTab = 'bacheca', spSub = 'ricevute', spFiltro = { tipo: '', categoria: '' };
  var spForm = null, spInteresse = null, spAzione = null, spMembroId = null, profiloOpen = false, spDopoProfilo = null, spOccupato = false;
  var SP_TIPO = { vendo: 'Vendo', scambio: 'Scambio' };
  var SP_CAT = { vino: 'Vino', distillato: 'Distillato' };
  var SP_SOTTO = { vino: ['Rosso', 'Bianco', 'Rosato', 'Spumante', 'Dolce', 'Fortificato'], distillato: ['Whisky', 'Rum', 'Cognac', 'Armagnac', 'Grappa', 'Gin', 'Altro distillato'] };
  var SP_PAESI = ['Italia', 'Francia', 'Svizzera', 'Regno Unito', 'Germania', 'Spagna', 'Portogallo', 'Austria', 'Belgio', 'Paesi Bassi', 'Stati Uniti', 'Giappone', 'Singapore', 'Emirati Arabi Uniti', 'Monaco'];
  var SP_STATO_ANN = { attivo: 'In bacheca', in_trattativa: 'In trattativa', in_pausa: 'In pausa · decidi tu', ritirato: 'Ritirato', scaduto: 'Scaduto', concluso: 'Concluso' };
  var SP_STATO_INT = { inviato: 'Inviata', controproposto: 'Controproposta', accettato: 'Contatti disponibili', chiuso: 'Chiusa', declinato: 'Declinata', rifiutato: 'Rifiutata', ritirato: 'Ritirata', superato: 'Superata · i termini sono cambiati', in_attesa: 'In attesa · un’altra proposta è in trattativa', da_riconfermare: 'Da riconfermare', decaduto: 'Decaduta' };
  var SP_ESITO = { venduta: 'Venduta', scambiata: 'Scambiata', non_conclusa: 'Non conclusa' };

  function spReset() { SP.bacheca = null; SP.proposte = null; SP.membri = null; SP.membro = null; SP.contatti = {}; }
  function caricaSpeakeasy() {
    if (!window.CELL || SP.caricando) return;
    SP.caricando = true;
    CELL.speakeasy().then(function (r) {
      SP.cfg = r.cfg || {}; SP.bacheca = r.bacheca || []; SP.proposte = r.proposte || { miei_annunci: [], ricevute: [], inviate: [] }; SP.membri = r.membri || [];
      PROFILO.completo = !!(SP.cfg && SP.cfg.profilo_completo);
      SP.caricando = false; render(); spFirmaFoto();
    }).catch(function (e) {
      SP.caricando = false; SP.cfg = SP.cfg || { stato: 'aperto' }; SP.bacheca = SP.bacheca || []; SP.proposte = SP.proposte || { miei_annunci: [], ricevute: [], inviate: [] }; SP.membri = SP.membri || [];
      toast((e && e.message) || 'Speakeasy non raggiungibile'); render();
    });
  }
  function spFirmaFoto() {
    var p = [];
    function agg(a) { if (a && a.foto_percorso && !SP.foto[a.foto_percorso] && p.indexOf(a.foto_percorso) < 0) p.push(a.foto_percorso); }
    (SP.bacheca || []).forEach(agg);
    if (SP.proposte) { (SP.proposte.miei_annunci || []).forEach(agg); (SP.proposte.ricevute || []).concat(SP.proposte.inviate || []).forEach(function (i) { agg(i.annuncio); }); }
    if (SP.membro) (SP.membro.annunci || []).forEach(agg);
    if (!p.length || !window.CELL) return;
    CELL.spFotoUrl(p).then(function (m) { var n = 0; Object.keys(m || {}).forEach(function (k) { SP.foto[k] = m[k]; n++; }); if (n) render(); }).catch(function () {});
  }
  function spStato() { return (SP.cfg && SP.cfg.stato) || 'aperto'; }
  function spAperto() { return spStato() === 'aperto'; }
  function mieiAnnunci() { return (SP.proposte && SP.proposte.miei_annunci) || []; }
  function annuncioDiBottiglia(id) { return mieiAnnunci().filter(function (a) { return a.bottiglia_id === id && (a.stato === 'attivo' || a.stato === 'in_trattativa' || a.stato === 'in_pausa'); })[0] || null; }
  function tagAnnuncio(b) {
    if (inCoda(b) || uscita(b)) return '';
    var a = annuncioDiBottiglia(b.id);
    return a ? '<span class="clubtag' + (a.tipo === 'vendo' ? ' vend' : '') + '">' + (a.stato === 'in_trattativa' ? 'In trattativa' : 'In bacheca') + '</span>' : '';
  }
  function giorniFa(iso) {
    if (!iso) return '';
    var g = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    return g <= 0 ? 'oggi' : g === 1 ? 'ieri' : g + ' giorni fa';
  }
  function giorniA(iso) { return iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000) : null; }
  function fmtE(n) { return n == null ? '—' : fmtM(Number(n)); }
  function spNomeAnnuncio(a) { return escHtml(a.nome || 'Senza nome') + (a.annata ? ' ' + escHtml(a.annata) : ''); }
  function spSotto(a) { return [a.produttore, SP_CAT[a.categoria], a.sottotipo, a.formato].filter(Boolean).map(escHtml).join(' · '); }
  function spLotto(a) { return (a.lotto_quantita > 1 ? a.lotto_quantita + ' bottiglie' : '1 bottiglia') + (a.lotto_descrizione ? ' · ' + escHtml(a.lotto_descrizione) : ''); }
  function spPrezzoRiga(a) {
    return a.tipo === 'vendo'
      ? '<div class="sp-prezzo"><span class="k">Prezzo totale del lotto</span><b>' + fmtE(a.prezzo_totale) + '</b></div>'
      : '<div class="sp-prezzo"><span class="k">Cerca in cambio</span><b>' + (a.cerco ? escHtml(a.cerco) : 'aperto a proposte') + '</b></div>';
  }
  function spFoto(a, cls) {
    var u = a.foto_percorso && SP.foto[a.foto_percorso];
    return u ? '<div class="sp-foto' + (cls ? ' ' + cls : '') + '"><img src="' + u + '" alt="" loading="lazy"></div>' : '';
  }
  function daGestire() {
    if (!SP.proposte) return 0;
    var n = 0;
    (SP.proposte.ricevute || []).forEach(function (i) { if (i.stato === 'inviato' || (i.stato === 'accettato' && !i.esito)) n++; });
    (SP.proposte.inviate || []).forEach(function (i) { if (i.stato === 'controproposto' || i.stato === 'da_riconfermare' || (i.stato === 'accettato' && !i.esito)) n++; });
    mieiAnnunci().forEach(function (a) { if (a.stato === 'in_pausa') n++; });
    return n;
  }
  function pendenteSu(annuncioId) {
    return ((SP.proposte && SP.proposte.inviate) || []).filter(function (i) { return i.annuncio_id === annuncioId && ['inviato', 'controproposto', 'in_attesa', 'da_riconfermare', 'accettato'].indexOf(i.stato) >= 0; })[0] || null;
  }
  function richiedeProfilo(fn) {
    if (PROFILO.completo) { fn(); return; }
    spDopoProfilo = fn; profiloOpen = true; render();
  }
  function spBanner() {
    var st = spStato();
    if (st === 'sospeso') return '<div class="kbox"><span class="k">⏸</span><span>Lo Speakeasy è in pausa: per ora niente nuove pubblicazioni né nuove proposte. I contatti già condivisi e le tue proposte restano dove sono.</span></div>';
    if (st === 'chiuso') return '<div class="kbox"><span class="k">●</span><span>Lo Speakeasy è chiuso. Trovi ancora le tue proposte e i contatti già condivisi in Le mie proposte.</span></div>';
    return '';
  }
  function recapitiCampi(pref, valori) {
    var v = valori || {};
    return '<div class="sp-recapiti"><span class="lbl">Come può raggiungerti l’altro membro</span>' +
      '<label class="chk"><input type="checkbox" id="' + pref + '-email"' + (v.email_ok === false ? '' : ' checked') + '> La mia email</label>' +
      '<div class="posgrid"><label><span class="lbl">Telefono o messaggistica</span><input type="text" id="' + pref + '-tel" value="' + escHtml(v.telefono || '') + '" placeholder="facoltativo" autocomplete="off"></label>' +
      '<label><span class="lbl">Altro recapito</span><input type="text" id="' + pref + '-altro" value="' + escHtml(v.altro || '') + '" placeholder="facoltativo"></label></div>' +
      '<p class="hint">Li vede soltanto l’altro membro, e solo se accettate entrambi. Caveau non li mostra a nessun altro e non li mette in nessuna email.</p></div>';
  }
  function leggiRecapiti(pref) {
    var e = document.getElementById(pref + '-email'), t = document.getElementById(pref + '-tel'), a = document.getElementById(pref + '-altro');
    return { email_ok: e ? !!e.checked : true, telefono: t ? t.value.trim() : '', altro: a ? a.value.trim() : '' };
  }

  /* ----------------------------------------------------------- la stanza */
  function stanzaClub() {
    var z = STANZE[3];
    if (!SP.proposte) { caricaSpeakeasy(); return capitolo(z, 'La bacheca riservata dei membri.') + '<p class="disc">Apro lo Speakeasy…</p>'; }
    var intro = 'Le bottiglie che i membri hanno scelto di condividere, vino e distillati, in vendita o in scambio. Si parla fra persone che il club conosce: accordo, consegna e pagamento sono fra voi. Caveau non compra, non vende, non incassa.';
    var n = daGestire();
    var tabs = '<div class="seg sp-tabs">' +
      '<button type="button"' + (spTab === 'bacheca' ? ' class="on"' : '') + ' data-sp-tab="bacheca">Bacheca</button>' +
      '<button type="button"' + (spTab === 'proposte' ? ' class="on"' : '') + ' data-sp-tab="proposte">Le mie proposte' + (n ? ' · ' + n : '') + '</button>' +
      '<button type="button"' + (spTab === 'membri' ? ' class="on"' : '') + ' data-sp-tab="membri">Membri</button></div>';
    return capitolo(z, intro) + spBanner() + '<div class="speak">' + tabs +
      (spTab === 'bacheca' ? tabBacheca() : spTab === 'proposte' ? tabProposte() : tabMembri()) +
      '<p class="disc"><button type="button" class="lnk" id="sp-ricarica">Aggiorna</button></p></div>';
  }

  /* ------------------------------------------------------------- bacheca */
  function tabBacheca() {
    var tutti = SP.bacheca || [];
    var l = tutti.filter(function (a) { return (!spFiltro.tipo || a.tipo === spFiltro.tipo) && (!spFiltro.categoria || a.categoria === spFiltro.categoria); });
    var filtri = '<div class="sp-filtri">' +
      '<div class="seg"><button type="button"' + (!spFiltro.tipo ? ' class="on"' : '') + ' data-sp-filtro="tipo:">Tutte</button><button type="button"' + (spFiltro.tipo === 'vendo' ? ' class="on"' : '') + ' data-sp-filtro="tipo:vendo">In vendita</button><button type="button"' + (spFiltro.tipo === 'scambio' ? ' class="on"' : '') + ' data-sp-filtro="tipo:scambio">In scambio</button></div>' +
      '<div class="seg"><button type="button"' + (!spFiltro.categoria ? ' class="on"' : '') + ' data-sp-filtro="categoria:">Vino e distillati</button><button type="button"' + (spFiltro.categoria === 'vino' ? ' class="on"' : '') + ' data-sp-filtro="categoria:vino">Vino</button><button type="button"' + (spFiltro.categoria === 'distillato' ? ' class="on"' : '') + ' data-sp-filtro="categoria:distillato">Distillati</button></div>' +
      (spAperto() ? '<button type="button" class="btn sm pri" data-sp-pubblica="">Metti una bottiglia</button>' : '') + '</div>';
    var corpo;
    if (!tutti.length) {
      corpo = '<div class="ccard"><h4>La bacheca è vuota, per ora.</h4><p>Qui compaiono soltanto le bottiglie che un membro decide di condividere: niente inventari, niente valori di cantina. Apri la scheda di una tua bottiglia e scegli <strong>Metti in bacheca</strong>, oppure parti da qui.</p>' +
        (spAperto() ? '<div><button type="button" class="btn pri" data-sp-pubblica="">Metti una bottiglia</button></div>' : '') + '</div>';
    } else if (!l.length) {
      corpo = '<p class="disc">Nessuna bottiglia con questi filtri.</p>';
    } else {
      corpo = '<div class="sp-grid">' + l.map(function (a) { return cardAnnuncio(a); }).join('') + '</div>';
    }
    return '<section class="blk">' + filtri + corpo + '</section>';
  }
  function cardAnnuncio(a) {
    var pend = a.mia ? null : pendenteSu(a.id), aperto = spInteresse === a.id;
    var chi = a.mia ? 'La tua bottiglia' : escHtml(a.membro_nome || 'Membro') + (a.membro_paese ? ' · ' + escHtml(a.membro_paese) : '');
    var azione;
    if (a.mia) azione = '<button type="button" class="lnk" data-sp-tab="proposte">gestiscila in Le mie proposte</button>';
    else if (pend) azione = '<span class="sp-when">' + (pend.stato === 'accettato' ? 'Contatti disponibili' : 'Proposta inviata') + '</span>';
    else if (!spAperto()) azione = '';
    else if (!aperto) azione = '<button type="button" class="btn sm pri" data-sp-interessa="' + a.id + '">Mi interessa</button>';
    else azione = '';
    return '<div class="ccard sp-card">' + spFoto(a) +
      '<div class="sp-top"><span><span class="clubtag' + (a.tipo === 'vendo' ? ' vend' : '') + '">' + SP_TIPO[a.tipo] + '</span> <span class="clubtag">' + SP_CAT[a.categoria] + '</span></span><span class="sp-when">' + giorniFa(a.pubblicato_il) + '</span></div>' +
      '<h4>' + spNomeAnnuncio(a) + '</h4><p class="sp-sub">' + spSotto(a) + '</p>' +
      spPrezzoRiga(a) +
      '<dl class="sp-dl"><dt>Lotto</dt><dd>' + spLotto(a) + '</dd>' +
      (a.condizioni ? '<dt>Condizioni</dt><dd>' + escHtml(a.condizioni) + '</dd>' : '') +
      (a.provenienza ? '<dt>Provenienza</dt><dd>' + escHtml(a.provenienza) + '</dd>' : '') +
      '<dt>Si trova in</dt><dd>' + escHtml(a.paese) + ' · consegna da concordare fra voi</dd></dl>' +
      '<div class="sp-chi"><span>' + chi + '</span>' + azione + '</div>' +
      (aperto ? formInteresse(a) : '') + '</div>';
  }
  function formInteresse(a) {
    return '<div class="sp-form">' +
      (a.tipo === 'vendo' ? '<label><span class="lbl">Il tuo prezzo per il lotto (€) · lascia vuoto per accettare ' + fmtE(a.prezzo_totale) + '</span><input type="number" min="1" step="1" id="sp-int-prezzo" placeholder="' + escHtml(String(Math.round(a.prezzo_totale || 0))) + '"></label>' : '<p class="hint">Scambio: l’altro membro cerca ' + (a.cerco ? '<strong>' + escHtml(a.cerco) + '</strong>' : 'proposte') + '. Scrivi cosa offri.</p>') +
      '<label><span class="lbl">Due righe, se vuoi</span><textarea id="sp-int-msg" rows="2" maxlength="400" placeholder="' + (a.tipo === 'scambio' ? 'Cosa offri in cambio' : 'Facoltativo') + '"></textarea></label>' +
      recapitiCampi('sp-int') +
      '<p class="hint">Una proposta non è un contratto: se l’altro membro accetta, vi scambiate i recapiti scelti e il resto lo decidete voi.</p>' +
      '<div class="row" style="margin-top:8px"><button type="button" class="btn sm gho" data-sp-annulla>Annulla</button><button type="button" class="btn sm pri" data-sp-invia-interesse="' + a.id + '">Invia la proposta</button></div></div>';
  }

  /* ---------------------------------------------------- le mie proposte */
  function tabProposte() {
    var P = SP.proposte, miei = mieiAnnunci();
    var mieHtml = miei.length ? '<div class="sp-grid">' + miei.map(cardAnnuncioMio).join('') + '</div>' :
      '<p class="disc">Non hai bottiglie in bacheca. Apri la scheda di una bottiglia e scegli <strong>Metti in bacheca</strong>.</p>';
    var lista = spSub === 'ricevute' ? (P.ricevute || []) : (P.inviate || []);
    var vuoto = spSub === 'ricevute' ? 'Nessuna proposta ricevuta. Arrivano qui quando un membro si interessa a una tua bottiglia in bacheca.' : 'Nessuna proposta inviata. Dalla Bacheca, su una bottiglia che ti interessa, premi <strong>Mi interessa</strong>.';
    return '<section class="blk"><header class="blkh"><h3>Le tue bottiglie in bacheca</h3><p>Massimo ' + ((SP.cfg && SP.cfg.max_annunci) || 5) + ' alla volta, una pubblicazione per bottiglia, ' + ((SP.cfg && SP.cfg.scadenza_giorni) || 60) + ' giorni poi si rinnova a mano.</p></header>' + mieHtml + '</section>' +
      '<section class="blk"><header class="blkh"><h3>Proposte</h3><p>Un ciclo solo: proposta, eventuale controproposta, risposta. Accettare vuol dire rendersi raggiungibili, non concludere.</p></header>' +
      '<div class="seg" style="margin-bottom:14px"><button type="button"' + (spSub === 'ricevute' ? ' class="on"' : '') + ' data-sp-sub="ricevute">Ricevute</button><button type="button"' + (spSub === 'inviate' ? ' class="on"' : '') + ' data-sp-sub="inviate">Inviate</button></div>' +
      (lista.length ? '<div class="sp-lista">' + lista.map(cardProposta).join('') + '</div>' : '<p class="disc">' + vuoto + '</p>') + '</section>';
  }
  function cardAnnuncioMio(a) {
    var g = giorniA(a.scade_il), stato = SP_STATO_ANN[a.stato] || a.stato;
    if (a.stato === 'attivo' && g != null) stato += g <= 0 ? ' · scade oggi' : ' · scade fra ' + g + (g === 1 ? ' giorno' : ' giorni');
    var az = '';
    if (a.stato === 'attivo' && spAperto()) az += '<button type="button" class="btn sm" data-sp-modifica="' + a.id + '">Modifica</button>';
    if ((a.stato === 'scaduto' || (a.stato === 'attivo' && g != null && g <= 14)) && spAperto()) az += '<button type="button" class="btn sm pri" data-sp-rinnova="' + a.id + '">Rinnova</button>';
    if (a.stato === 'in_pausa' && spAperto()) az += '<button type="button" class="btn sm pri" data-sp-riapri="' + a.id + '">Rimetti in bacheca</button>';
    if (a.stato === 'attivo' || a.stato === 'scaduto' || a.stato === 'in_pausa') az += '<button type="button" class="btn sm gho" data-sp-ritira="' + a.id + '">Ritira</button>';
    if (a.stato === 'in_trattativa') az += '<span class="sp-when">decidi l’esito dalla proposta accettata</span>';
    if (a.stato === 'in_pausa') stato = 'In pausa · la trattativa non si è conclusa: rimettila in bacheca o ritirala';
    return '<div class="ccard sp-card">' + spFoto(a) +
      '<div class="sp-top"><span><span class="clubtag' + (a.tipo === 'vendo' ? ' vend' : '') + '">' + SP_TIPO[a.tipo] + '</span> <span class="clubtag">' + SP_CAT[a.categoria] + '</span></span><span class="sp-when">' + escHtml(stato) + '</span></div>' +
      '<h4>' + spNomeAnnuncio(a) + '</h4><p class="sp-sub">' + spSotto(a) + '</p>' + spPrezzoRiga(a) +
      '<div class="sp-chi"><span>' + spLotto(a) + '</span><span class="grp">' + az + '</span></div></div>';
  }
  function prossimaAzione(i) {
    var mio = i.sono_proprietario, s = i.stato, A = i.annuncio || {}, apertoForm = spAzione && spAzione.id === i.id ? spAzione.tipo : null;
    function b(t, cls, et) { return '<button type="button" class="btn sm ' + cls + '" data-sp-azione="' + t + ':' + i.id + '">' + et + '</button>'; }
    var h = '';
    var contro = A.tipo === 'vendo' ? fmtE(i.controprezzo) + ' per il lotto' : '«' + escHtml(i.controtesto || '') + '»';
    if (s === 'inviato') {
      h = mio ? (spAperto() ? '<p class="sp-next">Tocca a te.</p><div class="grp">' + b('accetta', 'pri', 'Accetta') + b('contro', '', 'Controproponi') + b('declina', 'gho', 'Declina') + '</div>' : '<p class="sp-next">In pausa: nessuna nuova accettazione finché lo Speakeasy non riapre.</p>')
              : '<p class="sp-next">In attesa della risposta di ' + escHtml(i.controparte_nome || 'un membro') + '.</p><div class="grp">' + b('ritira', 'gho', 'Ritira') + '</div>';
    } else if (s === 'controproposto') {
      h = mio ? '<p class="sp-next">Hai controproposto ' + contro + '. In attesa della risposta di ' + escHtml(i.controparte_nome || '') + '.</p>'
              : '<p class="sp-next">Tocca a te: ' + escHtml(i.controparte_nome || '') + ' propone ' + contro + '.</p>' + (spAperto() ? '<div class="grp">' + b('accetta', 'pri', 'Accetta') + b('rifiuta', 'gho', 'Rifiuta') + '</div>' : '');
    } else if (s === 'da_riconfermare') {
      h = mio ? '<p class="sp-next">La trattativa precedente non si è conclusa: ' + escHtml(i.controparte_nome || '') + ' deve confermare se è ancora interessato.</p>'
              : '<p class="sp-next">La bottiglia è di nuovo disponibile. Ti interessa ancora?</p>' + (spAperto() ? '<div class="grp">' + b('riconferma', 'pri', 'Sì, confermo') + b('ritira', 'gho', 'No, lascio') + '</div>' : '');
    } else if (s === 'superato') {
      h = mio ? '<p class="sp-next">Hai cambiato i termini: la proposta va rifatta dall’altro membro.</p>'
              : '<p class="sp-next">I termini sono cambiati. Se ti interessa ancora, rifai la proposta dalla Bacheca.</p>';
    } else if (s === 'in_attesa') {
      h = '<p class="sp-next">Un’altra proposta è in trattativa. Se non si conclude, ' + (mio ? 'potrai riprendere questa.' : 'ti verrà chiesto se sei ancora interessato.') + '</p>' + (!mio ? '<div class="grp">' + b('ritira', 'gho', 'Ritira') + '</div>' : '');
    } else if (s === 'accettato') {
      h = boxContatti(i) + '<p class="sp-next">Quando avete deciso, dite com’è andata. Serve a liberare la bottiglia o a chiuderla, niente di più.</p><div class="grp">' +
          b('esito:' + (A.tipo === 'vendo' ? 'venduta' : 'scambiata'), 'pri', A.tipo === 'vendo' ? 'Venduta' : 'Scambiata') + b('esito:non_conclusa', 'gho', 'Non conclusa') + '</div>';
    } else if (s === 'chiuso') {
      h = (i.accettato_il ? boxContatti(i) : '') +
        '<p class="sp-next">Esito: <strong>' + (i.esito ? SP_ESITO[i.esito.esito] : '—') + '</strong>' + (i.esito && i.esito.nota ? ' · ' + escHtml(i.esito.nota) : '') +
        (i.esito && i.esito.esito === 'non_conclusa' ? (mio ? ' · la bottiglia è in pausa: rimettila in bacheca o ritirala da «Le tue bottiglie in bacheca».' : ' · nessun seguito automatico.') : '') + '</p>' + boxUscita(i);
    }
    if (apertoForm) h += formAzione(apertoForm, i);
    return h;
  }
  function boxContatti(i) {
    var c = SP.contatti[i.id];
    if (!c) return '<div class="sp-contatti"><b>Contatti disponibili</b><p class="hint">' + escHtml(i.controparte_nome || '') + ' ha accettato: potete parlarvi direttamente.</p><button type="button" class="btn sm" data-sp-contatti="' + i.id + '">Mostra i recapiti</button></div>';
    return '<div class="sp-contatti"><b>Contatti disponibili</b><dl class="sp-dl">' +
      '<dt>Nome</dt><dd>' + escHtml(c.nome || '') + (c.paese ? ' · ' + escHtml(c.paese) : '') + (c.citta ? ' · ' + escHtml(c.citta) : '') + '</dd>' +
      (c.email ? '<dt>Email</dt><dd><a href="mailto:' + escHtml(c.email) + '">' + escHtml(c.email) + '</a></dd>' : '') +
      (c.telefono ? '<dt>Telefono</dt><dd>' + escHtml(c.telefono) + '</dd>' : '') +
      (c.altro ? '<dt>Altro</dt><dd>' + escHtml(c.altro) + '</dd>' : '') +
      '</dl><p class="hint">Recapiti scelti dall’altro membro. Restano qui finché il club li conserva.</p></div>';
  }
  function boxUscita(i) {
    var A = i.annuncio || {}, mio = i.sono_proprietario;
    /* vendita: scarica solo chi vende; scambio: ciascuno la propria bottiglia. Chi compra non scarica nulla. */
    var deve = mio || A.tipo === 'scambio';
    if (!deve || !i.esito || i.esito.esito === 'non_conclusa') return '';
    if (i.uscita_confermata_il) return '<p class="sp-next">Uscita dalla cantina confermata il ' + escHtml(new Date(i.uscita_confermata_il).toLocaleDateString('it-IT')) + '.</p>';
    if (mio) return '<p class="sp-next">La bottiglia è ancora nella tua cantina' + (A.lotto_quantita > 1 ? ' (' + A.lotto_quantita + ' pezzi del lotto)' : '') + '. Quando è davvero passata di mano, segnala l’uscita: una volta sola.</p><div class="grp"><button type="button" class="btn sm" data-sp-azione="uscita:' + i.id + '">Segna la bottiglia uscita</button></div>';
    var mie = STATE.bottles.filter(function (b) { return inCantina(b) && !inCoda(b); });
    return '<p class="sp-next">Hai dato una tua bottiglia in cambio? Segnala l’uscita dalla tua cantina, una volta sola.</p><div class="sp-form"><div class="posgrid"><label><span class="lbl">La bottiglia che hai dato</span><select id="sp-uscita-bott-' + i.id + '"><option value="">Scegli</option>' + mie.map(function (b) { return '<option value="' + b.id + '">' + escHtml(b.nome || 'Senza nome') + (b.annata ? ' ' + escHtml(b.annata) : '') + (b.quantita > 1 ? ' · ' + b.quantita + ' pezzi' : '') + '</option>'; }).join('') + '</select></label><label><span class="lbl">Quanti pezzi</span><input type="number" min="1" step="1" value="1" id="sp-uscita-qta-' + i.id + '"></label></div><div class="grp" style="margin-top:8px"><button type="button" class="btn sm" data-sp-azione="uscita:' + i.id + '">Segna la bottiglia uscita</button></div></div>';
  }
  function formAzione(tipo, i) {
    var A = i.annuncio || {}, t = tipo.split(':')[0];
    var testa = { accetta: 'Accetti: vi scambiate i recapiti scelti. Nessun impegno oltre questo.', contro: 'Una sola controproposta: poi decide l’altro membro.', riconferma: 'Confermi l’interesse ai termini attuali.', esito: 'Com’è andata? Resta fra voi; il Desk lo vede solo se non si è conclusa.', segnala: 'Segnala al Desk. Solo il Desk la legge.' }[t] || '';
    var h = '<div class="sp-form"><p class="hint">' + testa + '</p>';
    if (t === 'contro') h += A.tipo === 'vendo'
      ? '<label><span class="lbl">Il tuo prezzo per il lotto (€)</span><input type="number" min="1" step="1" id="sp-az-prezzo" placeholder="' + escHtml(String(Math.round(A.prezzo_totale || 0))) + '"></label>'
      : '<label><span class="lbl">Cosa proponi in cambio, in concreto</span><textarea id="sp-az-testo" rows="2" maxlength="400" placeholder="es. due bottiglie invece di una, oppure un’altra etichetta"></textarea></label>';
    if (t === 'accetta' || t === 'contro' || t === 'riconferma') h += recapitiCampi('sp-az');
    if (t === 'esito') h += '<label><span class="lbl">Una nota, se vuoi</span><input type="text" id="sp-az-nota" maxlength="400" placeholder="facoltativa"></label>';
    if (t === 'segnala') h += '<label><span class="lbl">Cosa non va</span><textarea id="sp-az-motivo" rows="3" maxlength="1000"></textarea></label>';
    h += '<div class="row" style="margin-top:8px"><button type="button" class="btn sm gho" data-sp-annulla>Annulla</button><button type="button" class="btn sm pri" data-sp-conferma="' + tipo + ':' + i.id + '">Conferma</button></div></div>';
    return h;
  }
  function cardProposta(i) {
    var A = i.annuncio || {}, mio = i.sono_proprietario;
    var chi = mio ? 'Da ' + escHtml(i.controparte_nome || 'un membro') : 'A ' + escHtml(i.controparte_nome || 'un membro');
    if (i.controparte_paese) chi += ' · ' + escHtml(i.controparte_paese);
    var termini = A.tipo === 'vendo'
      ? '<span>' + (i.prezzo_proposto != null ? 'Proposto ' + fmtE(i.prezzo_proposto) + ' su ' + fmtE(A.prezzo_totale) : 'Al prezzo esposto · ' + fmtE(A.prezzo_totale)) + '</span>'
      : '<span>Scambio' + (A.cerco ? ' · cerca ' + escHtml(A.cerco) : '') + '</span>';
    return '<div class="ccard sp-prop">' +
      '<div class="sp-top"><span><span class="clubtag' + (A.tipo === 'vendo' ? ' vend' : '') + '">' + (SP_TIPO[A.tipo] || '') + '</span> <span class="sp-stato">' + (SP_STATO_INT[i.stato] || i.stato) + '</span></span><span class="sp-when">' + giorniFa(i.creato_il) + '</span></div>' +
      '<h4>' + spNomeAnnuncio(A) + '</h4><p class="sp-sub">' + chi + ' · ' + termini + '</p>' +
      (i.messaggio ? '<p class="sp-msg">' + escHtml(i.messaggio) + '</p>' : '') +
      prossimaAzione(i) +
      '<p class="sp-foot"><button type="button" class="lnk" data-sp-azione="segnala:' + i.id + '">Segnala al Desk</button></p></div>';
  }

  /* -------------------------------------------------------------- membri */
  function tabMembri() {
    if (spMembroId) return profiloMembro();
    var righe = (SP.membri || []).map(function (m) {
      return '<tr class="r" data-sp-membro="' + escHtml(m.codice) + '" tabindex="0"><td><span class="tnm">' + escHtml(m.nome || '—') + '</span>' + (m.sei_tu ? ' <span class="sp-when">tu</span>' : '') + '</td><td>' + escHtml(m.paese || '—') + (m.citta ? '<br><span class="sp-when">' + escHtml(m.citta) + '</span>' : '') + '</td><td>' + (m.lingua === 'en' ? 'English' : 'Italiano') + '</td><td>' + (m.membro_dal ? fmtD(String(m.membro_dal).slice(0, 10)) : '—') + '</td></tr>';
    }).join('');
    return '<section class="blk"><header class="blkh"><h3>I membri</h3><p>Chi fa parte del club: nome, Paese e da quando. Apri un nome per vedere i suoi interessi e le bottiglie che ha scelto di condividere.</p></header>' +
      '<div class="tw"><table><thead><tr><th>Membro</th><th>Paese</th><th>Lingua</th><th>Membro dal</th></tr></thead><tbody>' + (righe || '<tr><td colspan="4">Ancora nessuno.</td></tr>') + '</tbody></table></div></section>';
  }
  function profiloMembro() {
    var m = SP.membro;
    if (!m || m.codice !== spMembroId) {
      if (window.CELL && !SP.caricando) { SP.caricando = true; CELL.spMembro(spMembroId).then(function (r) { SP.membro = r; SP.caricando = false; render(); spFirmaFoto(); }).catch(function (e) { SP.caricando = false; spMembroId = null; toast((e && e.message) || 'Profilo non disponibile'); render(); }); }
      return '<section class="blk"><p class="disc">Apro il profilo…</p></section>';
    }
    var ann = (m.annunci || []).map(function (a) { return cardAnnuncio(a); }).join('');
    return '<section class="blk"><p><button type="button" class="lnk" data-sp-indietro>← Tutti i membri</button></p>' +
      '<div class="ccard sp-profilo"><h4>' + escHtml(m.nome || '') + '</h4><p class="sp-sub">' + [m.paese, m.citta, m.lingua === 'en' ? 'English' : 'Italiano', m.membro_dal ? 'membro dal ' + fmtD(String(m.membro_dal).slice(0, 10)) : ''].filter(Boolean).map(escHtml).join(' · ') + '</p>' +
      ((m.interessi || []).length ? '<p><span class="lbl">Interessi</span> ' + m.interessi.map(function (x) { return '<span class="clubtag">' + escHtml(x) + '</span>'; }).join(' ') + '</p>' : '') +
      (m.descrizione ? '<p>' + escHtml(m.descrizione) + '</p>' : '') + '</div>' +
      '<header class="blkh" style="margin-top:18px"><h3>In bacheca</h3></header>' + (ann ? '<div class="sp-grid">' + ann + '</div>' : '<p class="disc">Nessuna bottiglia condivisa al momento.</p>') + '</section>';
  }

  /* ---------------------------------------------------- il mio profilo */
  function profiloSheet() {
    var p = PROFILO;
    return '<div class="ov" data-ov><div class="sheet">' +
      head('Il mio profilo', spDopoProfilo ? 'Prima di pubblicare o proporre servono nome, Paese e lingua: è così che gli altri membri sanno con chi parlano.' : 'Quello che gli altri membri vedono di te. Niente numeri, niente classifiche.') +
      '<div class="shb"><div class="posgrid">' +
      '<label><span class="lbl">Nome e cognome</span><input type="text" id="pf-nome" value="' + escHtml(p.nome || '') + '" maxlength="80"></label>' +
      '<label><span class="lbl">Paese</span><input type="text" id="pf-paese" list="pf-paesi" value="' + escHtml(p.paese || '') + '" maxlength="60"><datalist id="pf-paesi">' + SP_PAESI.map(function (x) { return '<option value="' + x + '">'; }).join('') + '</datalist></label>' +
      '<label><span class="lbl">Città · facoltativa</span><input type="text" id="pf-citta" value="' + escHtml(p.citta || '') + '" maxlength="60"></label>' +
      '<label><span class="lbl">Lingua</span><select id="pf-lingua"><option value="it"' + (p.lingua !== 'en' ? ' selected' : '') + '>Italiano</option><option value="en"' + (p.lingua === 'en' ? ' selected' : '') + '>English</option></select></label>' +
      '</div>' +
      '<label class="chk" style="margin-top:10px"><input type="checkbox" id="pf-citta-vis"' + (p.citta_visibile ? ' checked' : '') + '> Mostra la città agli altri membri (altrimenti vedono solo il Paese)</label>' +
      '<label style="display:block;margin-top:12px"><span class="lbl">Interessi · separati da virgola</span><input type="text" id="pf-interessi" value="' + escHtml((p.interessi || []).join(', ')) + '" placeholder="es. Barolo, whisky torbato, Champagne"></label>' +
      '<label style="display:block;margin-top:12px"><span class="lbl">Due righe su di te · facoltative</span><textarea id="pf-desc" rows="2" maxlength="280">' + escHtml(p.descrizione || '') + '</textarea></label>' +
      '<p class="hint">Nel profilo compaiono solo queste righe e le bottiglie che hai in bacheca. La tua cantina, i valori e i tuoi recapiti restano privati.</p></div>' +
      '<div class="shf"><button type="button" class="btn gho" data-shutsheet>Annulla</button><button type="button" class="btn pri" id="pf-salva">Salva il profilo</button></div></div></div>';
  }
  function salvaProfilo() {
    function g(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
    var nome = g('pf-nome'), paese = g('pf-paese'), lingua = g('pf-lingua') || 'it';
    if (!nome) { toast('Serve il nome'); return; }
    if (!paese) { toast('Serve il Paese'); return; }
    var interessi = g('pf-interessi').split(',').map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 12);
    var btn = document.getElementById('pf-salva'); if (btn) btn.disabled = true;
    var vis = !!((document.getElementById('pf-citta-vis') || {}).checked);
    CELL.salvaProfilo({ nome: nome, paese: paese, citta: g('pf-citta'), citta_visibile: vis, lingua: lingua, interessi: interessi, descrizione: g('pf-desc') }).then(function (p) {
      p = p || {};
      PROFILO.nome = p.nome || nome; PROFILO.paese = p.paese || paese; PROFILO.citta = p.citta || ''; PROFILO.citta_visibile = !!p.citta_visibile; PROFILO.lingua = p.lingua || lingua; PROFILO.interessi = p.interessi || interessi; PROFILO.descrizione = p.descrizione || ''; PROFILO.completo = !!p.completo;
      profiloOpen = false; var fn = spDopoProfilo; spDopoProfilo = null; spReset(); render(); toast('Profilo salvato');
      if (fn) fn();
    }).catch(function (e) { if (btn) btn.disabled = false; toast((e && e.message) || 'Non salvato'); });
  }

  /* -------------------------------------------- pubblicare una bottiglia */
  function bottigliePubblicabili() {
    return STATE.bottles.filter(function (b) { return inCantina(b) && !inCoda(b) && !b.esempio && !annuncioDiBottiglia(b.id); });
  }
  function categoriaDi(b) { return (b && (b.tipologia === 'Vino' || b.tipologia === 'Spumante')) ? 'vino' : 'distillato'; }
  function sottotipoDi(b) {
    if (!b) return '';
    if (b.tipologia === 'Spumante') return 'Spumante';
    if (b.tipologia === 'Vino') return b.colore === 'Rosso' ? 'Rosso' : b.colore === 'Bianco' ? 'Bianco' : b.colore === 'Rosé' ? 'Rosato' : '';
    return SP_SOTTO.distillato.indexOf(b.tipologia) >= 0 ? b.tipologia : (b.tipologia === 'Liquore' || b.tipologia === 'Altro' ? 'Altro distillato' : '');
  }
  function apriPubblica(bottigliaId) {
    var b = bottigliaId ? STATE.bottles.find(function (x) { return x.id === bottigliaId; }) : null;
    spForm = { bottiglia_id: b ? b.id : '', tipo: 'vendo', categoria: categoriaDi(b), sottotipo: sottotipoDi(b), nome: b ? b.nome : '', produttore: b ? b.produttore : '', annata: b ? b.annata : '', formato: b ? b.formato : '', lotto_quantita: b ? (b.quantita || 1) : 1, lotto_descrizione: '', prezzo_totale: '', cerco: '', condizioni: '', provenienza: b ? b.provenienza : '', paese: PROFILO.paese || '', foto: null };
    editingId = null; render();
  }
  function apriModifica(a) {
    spForm = { id: a.id, bottiglia_id: a.bottiglia_id || '', tipo: a.tipo, categoria: a.categoria, sottotipo: a.sottotipo || '', nome: a.nome, produttore: a.produttore || '', annata: a.annata || '', formato: a.formato || '', lotto_quantita: a.lotto_quantita || 1, lotto_descrizione: a.lotto_descrizione || '', prezzo_totale: a.prezzo_totale != null ? a.prezzo_totale : '', cerco: a.cerco || '', condizioni: a.condizioni || '', provenienza: a.provenienza || '', paese: a.paese || PROFILO.paese || '', foto_percorso: a.foto_percorso || null, foto: null };
    render();
  }
  function formAnnuncioSheet() {
    var f = spForm, mod = !!f.id;
    var scelta = mod ? '' : '<label class="full"><span class="lbl">Quale bottiglia</span><select id="an-bott">' + '<option value="">Scegli dalla tua cantina</option>' + bottigliePubblicabili().map(function (b) { return '<option value="' + b.id + '"' + (b.id === f.bottiglia_id ? ' selected' : '') + '>' + escHtml(b.nome || 'Senza nome') + (b.annata ? ' ' + escHtml(b.annata) : '') + (b.quantita > 1 ? ' · ' + b.quantita + ' bott.' : '') + '</option>'; }).join('') + '</select></label>';
    var sotto = SP_SOTTO[f.categoria] || [];
    return '<div class="ov" data-ov><div class="sheet wide">' +
      head(mod ? 'Modifica l’annuncio' : 'Metti in bacheca', mod ? 'Se cambi i termini, le proposte già ricevute vanno rifatte: è giusto così.' : 'Solo quello che decidi tu di mostrare. Il resto della cantina non si vede.') +
      '<div class="shb">' + (mod ? '' : '<div class="seg" style="margin-bottom:14px"><button type="button"' + (f.tipo === 'vendo' ? ' class="on"' : '') + ' data-sp-f="tipo:vendo">Vendo</button><button type="button"' + (f.tipo === 'scambio' ? ' class="on"' : '') + ' data-sp-f="tipo:scambio">Scambio</button></div>') +
      '<div class="posgrid">' + scelta +
      '<label><span class="lbl">Vino o distillato</span><select id="an-cat" data-sp-f-cat><option value="vino"' + (f.categoria === 'vino' ? ' selected' : '') + '>Vino</option><option value="distillato"' + (f.categoria === 'distillato' ? ' selected' : '') + '>Distillato</option></select></label>' +
      '<label><span class="lbl">Tipo</span><select id="an-sotto"><option value="">—</option>' + sotto.map(function (s) { return '<option value="' + s + '"' + (s === f.sottotipo ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></label>' +
      '<label><span class="lbl">Etichetta</span><input type="text" id="an-nome" value="' + escHtml(f.nome) + '" maxlength="120"></label>' +
      '<label><span class="lbl">Produttore</span><input type="text" id="an-prod" value="' + escHtml(f.produttore) + '" maxlength="120"></label>' +
      '<label><span class="lbl">Annata</span><input type="text" id="an-annata" value="' + escHtml(f.annata) + '" maxlength="12" placeholder="o NAS"></label>' +
      '<label><span class="lbl">Formato</span><input type="text" id="an-fmt" value="' + escHtml(f.formato) + '" maxlength="24" placeholder="es. 75 cl"></label>' +
      '<label><span class="lbl">Quante bottiglie nel lotto</span><input type="number" min="1" step="1" id="an-qta" value="' + escHtml(String(f.lotto_quantita)) + '"></label>' +
      '<label><span class="lbl">Lotto · nota</span><input type="text" id="an-lotto" value="' + escHtml(f.lotto_descrizione) + '" maxlength="200" placeholder="es. cassa originale, lotto indivisibile"></label>' +
      (f.tipo === 'vendo' ? '<label><span class="lbl">Prezzo totale del lotto (€)</span><input type="number" min="1" step="1" id="an-prezzo" value="' + escHtml(String(f.prezzo_totale)) + '"></label>' : '<label class="full"><span class="lbl">Cosa cerchi in cambio</span><input type="text" id="an-cerco" value="' + escHtml(f.cerco) + '" maxlength="200" placeholder="lascia vuoto se sei aperto a proposte"></label>') +
      '<label><span class="lbl">Condizioni dichiarate</span><input type="text" id="an-cond" value="' + escHtml(f.condizioni) + '" maxlength="200" placeholder="es. livello perfetto, etichetta segnata"></label>' +
      '<label><span class="lbl">Provenienza dichiarata</span><input type="text" id="an-prov" value="' + escHtml(f.provenienza) + '" maxlength="200" placeholder="es. acquistata in cantina nel 2015"></label>' +
      '<label><span class="lbl">Si trova in · Paese</span><input type="text" id="an-paese" list="an-paesi" value="' + escHtml(f.paese) + '" maxlength="60"><datalist id="an-paesi">' + SP_PAESI.map(function (x) { return '<option value="' + x + '">'; }).join('') + '</datalist></label>' +
      '<label><span class="lbl">Foto · facoltativa</span><input type="file" accept="image/*" id="an-foto"></label>' +
      '</div>' +
      (f.foto_percorso ? '<p class="hint">C’è già una foto: caricane una nuova solo se vuoi sostituirla.</p>' : '') +
      '<p class="hint">La foto viene ridotta e ripulita dai dati nascosti prima di partire. Prezzo in euro, totale per il lotto: niente prezzi al pezzo. La consegna la concordate voi.</p></div>' +
      '<div class="shf"><button type="button" class="btn gho" data-shutsheet>Annulla</button><button type="button" class="btn pri" id="an-salva">' + (mod ? 'Salva le modifiche' : 'Pubblica in bacheca') + '</button></div></div></div>';
  }
  function fotoDerivata(file) {
    return new Promise(function (ok, ko) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var M = 1200, w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, M / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? ok(b) : ko(new Error('Foto non leggibile')); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); ko(new Error('Foto non leggibile')); };
      img.src = url;
    });
  }
  function salvaAnnuncio() {
    function g(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
    var f = spForm, p = {
      bottiglia_id: f.id ? undefined : (g('an-bott') || null), tipo: f.tipo, categoria: g('an-cat') || f.categoria, sottotipo: g('an-sotto'),
      nome: g('an-nome'), produttore: g('an-prod'), annata: g('an-annata'), formato: g('an-fmt'),
      lotto_quantita: Math.max(1, Math.round(Number(g('an-qta')) || 1)), lotto_descrizione: g('an-lotto'),
      prezzo_totale: f.tipo === 'vendo' ? num(g('an-prezzo')) : null, cerco: f.tipo === 'scambio' ? g('an-cerco') : null,
      condizioni: g('an-cond'), provenienza: g('an-prov'), paese: g('an-paese'), foto_percorso: f.foto_percorso || null
    };
    if (!f.id && !p.bottiglia_id) { toast('Scegli la bottiglia dalla tua cantina'); return; }
    if (!p.nome) { toast('Serve l’etichetta'); return; }
    if (!p.paese) { toast('Serve il Paese in cui si trova'); return; }
    if (f.tipo === 'vendo' && !(p.prezzo_totale > 0)) { toast('Serve il prezzo totale del lotto'); return; }
    var fi = document.getElementById('an-foto'), file = fi && fi.files && fi.files[0];
    var btn = document.getElementById('an-salva'); if (btn) { btn.disabled = true; btn.textContent = 'Salvo…'; }
    var pronto = file ? fotoDerivata(file).then(function (blob) { return CELL.spFotoCarica(blob); }).then(function (path) { p.foto_percorso = path; }) : Promise.resolve();
    pronto.then(function () { return f.id ? CELL.spModifica(f.id, p) : CELL.spPubblica(p); })
      .then(function () { spForm = null; spReset(); spTab = 'proposte'; stanza = 'club'; render(); toast(f.id ? 'Annuncio aggiornato' : 'In bacheca'); })
      .catch(function (e) { if (btn) { btn.disabled = false; btn.textContent = f.id ? 'Salva le modifiche' : 'Pubblica in bacheca'; } toast((e && e.message) || 'Non riuscito'); });
  }

  /* ------------------------------------------------ il Desk: solo questo */
  function deskSpeakeasyHtml(S) {
    S = S || { segnalazioni: [], esiti_negativi: [] };
    var seg = (S.segnalazioni || []).map(function (s) {
      var a = s.annuncio, i = s.interesse;
      return '<tr><td>' + fmtDT(s.creata_il) + '</td><td>' + escHtml((s.segnalante || {}).nome || '') + '<br><span class="sp-when">' + escHtml((s.segnalante || {}).email || '') + '</span></td><td>' + (a ? escHtml(a.nome || '') + (a.annata ? ' ' + escHtml(a.annata) : '') + '<br><span class="sp-when">di ' + escHtml((a.proprietario || {}).nome || '') + (i ? ' · proposta di ' + escHtml((i.interessato || {}).nome || '') : '') + '</span>' : '—') + '</td><td style="white-space:pre-wrap;max-width:420px">' + escHtml(s.motivo || '') + (s.nota_desk ? '<br><span class="sp-when">nota: ' + escHtml(s.nota_desk) + '</span>' : '') + '</td><td>' + (s.stato === 'aperta' ? '<button type="button" class="btn sm" data-sp-seg-chiudi="' + s.id + '">Chiudi</button>' : 'chiusa') + '</td></tr>';
    }).join('');
    return '<div class="tw"><table><thead><tr><th>Quando</th><th>Chi segnala</th><th>Annuncio</th><th>Motivo</th><th></th></tr></thead><tbody>' + (seg || '<tr><td colspan="5">Nessuna segnalazione.</td></tr>') + '</tbody></table></div>';
  }

  /* ------------------------------------------------------------- eventi */
  function spEsegui(lavoro, dopo, avviso) {
    if (spOccupato) return; spOccupato = true;
    lavoro().then(function (r) { spOccupato = false; spAzione = null; spInteresse = null; spReset(); render(); if (dopo) dopo(r); if (avviso) toast(avviso); })
      .catch(function (e) { spOccupato = false; render(); toast((e && e.message) || 'Non riuscito'); });
  }
  function bindSpeakeasy(root, on) {
    function all(sel, fn) { root.querySelectorAll(sel).forEach(function (e) { e.addEventListener('click', function (ev) { fn(e, ev); }); }); }
    all('[data-sp-tab]', function (e) { spTab = e.getAttribute('data-sp-tab'); spInteresse = null; spAzione = null; spMembroId = null; stanza = 'club'; render(); });
    all('[data-sp-sub]', function (e) { spSub = e.getAttribute('data-sp-sub'); spAzione = null; render(); });
    all('[data-sp-filtro]', function (e) { var kv = e.getAttribute('data-sp-filtro').split(':'); spFiltro[kv[0]] = kv[1] || ''; render(); });
    all('[data-sp-annulla]', function () { spInteresse = null; spAzione = null; render(); });
    all('[data-sp-indietro]', function () { spMembroId = null; SP.membro = null; render(); });
    root.querySelectorAll('[data-sp-membro]').forEach(function (e) {
      function go() { spMembroId = e.getAttribute('data-sp-membro'); render(); }
      e.addEventListener('click', go);
      e.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } });
    });
    all('[data-sp-pubblica]', function (e) { var id = e.getAttribute('data-sp-pubblica'); richiedeProfilo(function () { apriPubblica(id); }); });
    all('[data-sp-modifica]', function (e) { var a = mieiAnnunci().filter(function (x) { return x.id === e.getAttribute('data-sp-modifica'); })[0]; if (a) apriModifica(a); });
    all('[data-sp-riapri]', function (e) { spEsegui(function () { return CELL.spRiapri(e.getAttribute('data-sp-riapri')); }, null, 'Di nuovo in bacheca · chi era in attesa dovrà confermare l’interesse'); });
    all('[data-sp-rinnova]', function (e) { spEsegui(function () { return CELL.spRinnova(e.getAttribute('data-sp-rinnova')); }, null, 'Rinnovato per altri ' + ((SP.cfg && SP.cfg.scadenza_giorni) || 60) + ' giorni'); });
    all('[data-sp-ritira]', function (e) { if (!confirm('Ritirare la bottiglia dalla bacheca? Le proposte in corso decadono.')) return; spEsegui(function () { return CELL.spRitira(e.getAttribute('data-sp-ritira')); }, null, 'Ritirata dalla bacheca'); });
    all('[data-sp-interessa]', function (e) { var id = e.getAttribute('data-sp-interessa'); richiedeProfilo(function () { spInteresse = id; spAzione = null; render(); var t = document.getElementById('sp-int-msg'); if (t) t.focus(); }); });
    all('[data-sp-invia-interesse]', function (e) {
      var id = e.getAttribute('data-sp-invia-interesse'), a = (SP.bacheca || []).concat((SP.membro && SP.membro.annunci) || []).filter(function (x) { return x.id === id; })[0] || {};
      var prezzo = a.tipo === 'vendo' ? num((document.getElementById('sp-int-prezzo') || {}).value) : null;
      var msg = ((document.getElementById('sp-int-msg') || {}).value || '').trim(), r = leggiRecapiti('sp-int');
      if (!r.email_ok && !r.telefono && !r.altro) { toast('Scegli almeno un recapito'); return; }
      e.disabled = true;
      spEsegui(function () { return CELL.spInteressa(id, prezzo, msg, r); }, function (i) { CELL.avvisa('sp_interesse', '', '', i && i.id).catch(function () {}); }, 'Proposta inviata');
    });
    all('[data-sp-contatti]', function (e) {
      var id = e.getAttribute('data-sp-contatti'); e.disabled = true;
      CELL.spContatti(id).then(function (c) { SP.contatti[id] = c || {}; render(); }).catch(function (x) { render(); toast((x && x.message) || 'Recapiti non disponibili'); });
    });
    all('[data-sp-azione]', function (e) {
      var v = e.getAttribute('data-sp-azione'), parti = v.split(':'), id = parti[parti.length - 1], tipo = parti.slice(0, -1).join(':'), t = tipo.split(':')[0];
      if (t === 'declina' || t === 'rifiuta' || t === 'ritira') {
        spEsegui(function () { return CELL.spChiudiInteresse(id); }, null, { declina: 'Proposta declinata', rifiuta: 'Controproposta rifiutata', ritira: 'Proposta ritirata' }[t]);
        return;
      }
      if (t === 'uscita') {
        var sel = document.getElementById('sp-uscita-bott-' + id), bott = sel ? sel.value : null;
        var qel = document.getElementById('sp-uscita-qta-' + id), qta = qel ? Math.max(1, Math.round(Number(qel.value) || 1)) : null;
        if (sel && !bott) { toast('Scegli la bottiglia che hai dato'); return; }
        spEsegui(function () { return CELL.spUscita(id, bott || null, qta); }, function (r) {
          var bid = r && r.bottiglia_id;
          if (bid && !(r && r.gia_confermata)) {
            commit(function (ns) { ns.bottles.forEach(function (b) { if (b.id !== bid) return; if (r.residuo > 0) { b.quantita = r.residuo; } else { b.stato = 'venduta'; b.venduta_il = b.venduta_il || today(); } }); }, false);
          }
        }, 'Uscita dalla cantina registrata');
        return;
      }
      spAzione = { tipo: tipo, id: id }; render();
    });
    all('[data-sp-conferma]', function (e) {
      var v = e.getAttribute('data-sp-conferma'), parti = v.split(':'), id = parti[parti.length - 1], t = parti[0], arg = parti.length > 2 ? parti[1] : '';
      var r = leggiRecapiti('sp-az');
      if ((t === 'accetta' || t === 'contro' || t === 'riconferma') && !r.email_ok && !r.telefono && !r.altro) { toast('Scegli almeno un recapito'); return; }
      e.disabled = true;
      if (t === 'accetta') spEsegui(function () { return CELL.spAccetta(id, r); }, function () { CELL.avvisa('sp_contatti', '', '', id).catch(function () {}); }, 'Contatti disponibili');
      else if (t === 'contro') {
        var pzEl = document.getElementById('sp-az-prezzo'), txEl = document.getElementById('sp-az-testo');
        var pz = pzEl ? num(pzEl.value) : null, tx = txEl ? txEl.value.trim() : '';
        if (pzEl && !(pz > 0)) { e.disabled = false; toast('Serve il prezzo'); return; }
        if (txEl && tx.length < 3) { e.disabled = false; toast('Scrivi cosa proponi in cambio'); return; }
        spEsegui(function () { return CELL.spControproponi(id, pz, tx, r); }, function () { CELL.avvisa('sp_controproposta', '', '', id).catch(function () {}); }, 'Controproposta inviata');
      }
      else if (t === 'riconferma') spEsegui(function () { return CELL.spRiconferma(id, r); }, function () { CELL.avvisa('sp_interesse', '', '', id).catch(function () {}); }, 'Interesse confermato');
      else if (t === 'esito') spEsegui(function () { return CELL.spEsito(id, arg, ((document.getElementById('sp-az-nota') || {}).value || '').trim()); }, null, 'Esito registrato');
      else if (t === 'segnala') { var m = ((document.getElementById('sp-az-motivo') || {}).value || '').trim(); if (m.length < 3) { e.disabled = false; toast('Scrivi cosa non va'); return; } spEsegui(function () { return CELL.spSegnala(null, id, m); }, function () { CELL.avvisa('sp_segnalazione', m, '', id).catch(function () {}); }, 'Segnalazione inviata al Desk'); }
    });
    root.querySelectorAll('[data-sp-f]').forEach(function (e) { e.addEventListener('click', function () { var kv = e.getAttribute('data-sp-f').split(':'); if (spForm) { spForm[kv[0]] = kv[1]; render(); } }); });
    root.querySelectorAll('[data-sp-f-cat]').forEach(function (e) { e.addEventListener('change', function () { if (spForm) { spForm.categoria = e.value; spForm.sottotipo = ''; render(); } }); });
    on('an-bott', 'change', function (ev) { var b = STATE.bottles.find(function (x) { return x.id === ev.target.value; }); if (b && spForm) { spForm.bottiglia_id = b.id; spForm.nome = b.nome; spForm.produttore = b.produttore; spForm.annata = b.annata; spForm.formato = b.formato; spForm.lotto_quantita = b.quantita || 1; spForm.provenienza = b.provenienza; spForm.categoria = categoriaDi(b); spForm.sottotipo = sottotipoDi(b); render(); } });
    on('an-salva', 'click', salvaAnnuncio);
    on('sp-profilo-apri', 'click', function () { profiloOpen = true; render(); });
    on('pf-salva', 'click', salvaProfilo);
    on('sp-ricarica', 'click', function () { spReset(); render(); });
    on('sp-in-bacheca', 'click', function () { editingId = null; spTab = 'proposte'; stanza = 'club'; render(); });
    /* il Desk: interruttori dello Speakeasy e chiusura delle segnalazioni */
    all('[data-sp-cfg]', function (e) { CELL.deskSpConfigura(e.getAttribute('data-sp-cfg'), e.getAttribute('data-val')).then(function () { DESK = null; SP.cfg = null; spReset(); render(); toast('Impostazione salvata'); }).catch(function (x) { toast((x && x.message) || 'Non salvato'); }); });
    root.querySelectorAll('[data-sp-cfg-num]').forEach(function (e) { e.addEventListener('change', function () { var v = e.value.trim(); CELL.deskSpConfigura(e.getAttribute('data-sp-cfg-num'), v === '' ? '' : String(Math.max(1, Math.round(Number(v) || 0)))).then(function () { DESK = null; render(); toast('Impostazione salvata'); }).catch(function (x) { toast((x && x.message) || 'Non salvato'); }); }); });
    all('[data-sp-seg-chiudi]', function (e) { var n = prompt('Nota per il registro del Desk (facoltativa)') || ''; CELL.deskSegnalazioneChiudi(e.getAttribute('data-sp-seg-chiudi'), n).then(function () { DESK = null; render(); }).catch(function (x) { toast((x && x.message) || 'Non riuscito'); }); });
  }

  /* ======================= LA STANZA DEL DESK =======================
     Solo per il ruolo desk. Richieste di account da approvare, persone e piani,
     richieste Speakeasy e messaggi, accessi, notifiche, interruttori del lancio. */
  var DESK = null, deskCaricando = false;
  function stanzeVisibili() { return STANZE.filter(function (z) { return z.k !== 'desk' || PROFILO.ruolo === 'desk'; }); }
  function caricaDesk() {
    if (deskCaricando || !window.CELL) return;
    deskCaricando = true;
    CELL.desk().then(function (d) { DESK = d; deskCaricando = false; render(); })
      .catch(function (e) { deskCaricando = false; toast((e && e.message) || 'Desk non raggiungibile'); });
  }
  function fmtDT(iso) { if (!iso) return '—'; var d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  function stanzaDesk() {
    if (PROFILO.ruolo !== 'desk') return stanzaCatalogo(lista());
    var z = STANZE.filter(function (s) { return s.k === 'desk'; })[0];
    if (!DESK) { caricaDesk(); return capitolo(z, 'La stanza del desk.') + '<p class="disc">Carico…</p>'; }
    var cfg = DESK.configurazione || {};
    function sw(chiave, et, aiuto) {
      var v = cfg[chiave] === 'si';
      return '<div class="dk-sw"><div><b>' + et + '</b><small>' + aiuto + '</small></div><button type="button" class="btn sm' + (v ? ' pri' : '') + '" data-cfg="' + chiave + '" data-val="' + (v ? 'no' : 'si') + '">' + (v ? 'Attivo' : 'Spento') + '</button></div>';
    }
    var attesa = (DESK.persone || []).filter(function (p) { return p.stato_account === 'in_attesa'; });
    var altre = (DESK.persone || []).filter(function (p) { return p.stato_account !== 'in_attesa'; });
    function riga(p) {
      var stato = { approvato: 'approvato', rifiutato: 'rifiutato', sospeso: 'sospeso', in_attesa: 'in attesa' }[p.stato_account] || p.stato_account;
      return '<tr><td><span class="tnm">' + escHtml(p.nome || '—') + '</span><br><span class="mono" style="font-family:var(--mono);font-size:10.5px;color:var(--t3)">' + escHtml(p.email) + (p.ruolo === 'desk' ? ' · desk' : '') + '</span></td>' +
        '<td>' + stato + '</td><td>' + (p.fondatore ? '<b>Fondatore</b>' : 'Membro') + (p.presentato_da ? '<br><span style="font-size:10.5px;color:var(--t3)">presentato da ' + escHtml(p.presentato_da) + '</span>' : '') + (p.paese || p.citta ? '<br><span style="font-size:10.5px;color:var(--t3)">' + escHtml([p.paese, p.citta].filter(Boolean).join(' · ')) + '</span>' : '') + '</td>' +
        '<td>' + (p.pagato_fino_a ? fmtD(p.pagato_fino_a) : '—') + '</td><td>' + fmtDT(p.ultimo_accesso) + '<br><span style="font-size:10.5px;color:var(--t3)">' + (p.accessi || 0) + ' accessi</span></td>' +
        '<td>' + escHtml(p.nota_desk || '') + '</td>' +
        '<td class="dk-az">' +
        (p.stato_account !== 'approvato' ? '<button type="button" class="btn sm pri" data-desk-act="approva" data-email="' + escHtml(p.email) + '">Approva</button>' : '') +
        (p.stato_account === 'in_attesa' ? '<button type="button" class="btn sm" data-desk-act="rifiuta" data-email="' + escHtml(p.email) + '">Rifiuta</button>' : '') +
        (p.stato_account === 'approvato' && p.ruolo !== 'desk' ? '<button type="button" class="btn sm" data-desk-act="sospendi" data-email="' + escHtml(p.email) + '">Sospendi</button>' : '') +
        (p.stato_account === 'approvato' ? (p.fondatore ? '<button type="button" class="btn sm" data-desk-act="nofondatore" data-email="' + escHtml(p.email) + '">Togli fondatore</button>' : '<button type="button" class="btn sm" data-desk-act="fondatore" data-email="' + escHtml(p.email) + '">Fondatore</button>') : '') +
        '<button type="button" class="btn sm" data-desk-act="pagato" data-email="' + escHtml(p.email) + '">Pagato · +12 mesi</button>' +
        '</td></tr>';
    }
    var testaTab = '<thead><tr><th>Persona</th><th>Account</th><th>Membro</th><th>Pagato fino a</th><th>Ultimo accesso</th><th>Nota</th><th>Azioni</th></tr></thead>';
    var rich = (DESK.richieste || []).map(function (r) {
      return '<tr><td>' + fmtDT(r.creata_il) + '</td><td>' + ({ ammissione: 'Ammissione', desk: 'Messaggio', desiderata: 'Desiderata', interesse: 'Interesse' }[r.tipo] || r.tipo) + '</td><td>' + escHtml(r.nome || r.email || '') + '</td><td>' + escHtml(r.testo || '') + '</td><td>' + (r.stato === 'aperta' ? '<button type="button" class="btn sm" data-desk-chiudi="' + r.id + '">Chiudi</button>' : 'chiusa') + '</td></tr>';
    }).join('');
    var acc = (DESK.accessi || []).map(function (a) { return '<tr><td>' + fmtDT(a.quando) + '</td><td>' + escHtml(a.nome || a.email || '') + '</td><td style="color:var(--t3);font-size:11px">' + escHtml(a.dispositivo || '') + '</td></tr>'; }).join('');
    var nots = (DESK.notifiche || []).map(function (n) { return '<tr><td>' + fmtDT(n.creata_il) + '</td><td>' + escHtml(n.tipo) + '</td><td style="white-space:pre-wrap;max-width:520px">' + escHtml(n.testo || '') + '</td><td>' + (n.inviata ? 'email inviata' : '<span style="color:var(--warn)">solo qui</span>' + (n.errore ? '<br><span style="font-size:10.5px;color:var(--t3)">' + escHtml(n.errore) + '</span>' : '')) + '</td></tr>'; }).join('');
    var nonInviate = (DESK.notifiche || []).filter(function (n) { return !n.inviata; }).length;
    return capitolo(z, 'Chi chiede di entrare, chi è dentro, chi scrive. Le decisioni si prendono qui; le email partono quando il servizio di posta è collegato.') +
      '<div class="desk">' +
      (nonInviate ? '<div class="kbox"><span class="k">✉</span><span>' + nonInviate + ' avvisi non sono partiti come email: manca il servizio di posta (segreto RESEND_API_KEY nelle funzioni Supabase). Li vedi comunque qui sotto.</span></div>' : '') +
      '<section class="blk"><header class="blkh"><h3>Richieste di account · ' + attesa.length + '</h3><p>Nessuno entra finché non approvi.</p></header>' +
      (attesa.length ? '<div class="tw"><table>' + testaTab + '<tbody>' + attesa.map(riga).join('') + '</tbody></table></div>' : '<p class="disc">Nessuna richiesta in attesa.</p>') + '</section>' +
      '<section class="blk"><header class="blkh"><h3>Persone · ' + altre.length + '</h3><p>Account, piano, pagamenti e accessi.</p></header><div class="tw"><table>' + testaTab + '<tbody>' + (altre.map(riga).join('') || '<tr><td colspan="7">Nessuna persona.</td></tr>') + '</tbody></table></div></section>' +
      '<section class="blk"><header class="blkh"><h3>Richieste e messaggi</h3><p>Speakeasy, desiderata, messaggi al desk.</p></header><div class="tw"><table><thead><tr><th>Quando</th><th>Tipo</th><th>Chi</th><th>Testo</th><th></th></tr></thead><tbody>' + (rich || '<tr><td colspan="5">Nessuna richiesta.</td></tr>') + '</tbody></table></div></section>' +
      '<section class="blk"><header class="blkh"><h3>Speakeasy · segnalazioni</h3><p>Il Desk vede solo questo: le segnalazioni dei membri e le trattative non concluse. Annunci, proposte e recapiti restano fra i membri.</p></header>' + deskSpeakeasyHtml(DESK.speakeasy) + '</section>' +
      '<section class="blk"><header class="blkh"><h3>Interruttori del lancio</h3><p>Si cambiano qui, senza toccare il codice.</p></header><div class="dk-grid">' +
        sw('approvazione_richiesta', 'Approvazione degli account', 'Ogni nuovo account resta in attesa finché non lo approvi.') +
        sw('avvisa_accessi', 'Avviso a ogni accesso', 'Un avviso ogni volta che una persona entra.') +
        sw('pagamento_richiesto', 'Piano base a pagamento', 'Quando è attivo, entra solo chi ha "Pagato fino a" nel futuro.') +
        '<div class="dk-sw"><div><b>Speakeasy</b><small>Aperto: tutto. In pausa: niente nuove pubblicazioni o proposte; contatti già condivisi e segnalazioni restano. Chiuso: la sezione sparisce, restano Le mie proposte.</small></div><button type="button" class="btn sm' + ((cfg.speakeasy_stato || 'aperto') === 'aperto' ? ' pri' : '') + '" data-sp-cfg="speakeasy_stato" data-val="' + ({ aperto: 'sospeso', sospeso: 'chiuso', chiuso: 'aperto' }[cfg.speakeasy_stato || 'aperto']) + '">' + ({ aperto: 'Aperto', sospeso: 'In pausa', chiuso: 'Chiuso' }[cfg.speakeasy_stato || 'aperto']) + '</button></div>' +
        '<div class="dk-sw"><div><b>Speakeasy · conservazione (giorni)</b><small>Dopo quanti giorni dalla chiusura di una trattativa si cancellano foto e recapiti. Vuoto: nessuna cancellazione automatica. Va deciso prima dell’apertura ai membri.</small></div><input type="number" min="1" step="1" class="dk-num" data-sp-cfg-num="speakeasy_ritenzione_giorni" value="' + escHtml(cfg.speakeasy_ritenzione_giorni || '') + '" placeholder="—"></div>' +
        '<div class="dk-sw"><div><b>Iscrizioni</b><small>Su presentazione di un membro (il club), aperte a tutti, oppure solo agli indirizzi nella lista inviti.</small></div><button type="button" class="btn sm' + (cfg.registrazione === 'presentazione' ? ' pri' : '') + '" data-cfg="registrazione" data-val="' + ({ presentazione: 'aperta', aperta: 'invito', invito: 'presentazione' }[cfg.registrazione] || 'presentazione') + '">' + ({ presentazione: 'Su presentazione', aperta: 'Aperte', invito: 'Solo su invito' }[cfg.registrazione] || 'Aperte') + '</button></div>' +
        '<div class="dk-sw"><div><b>Quota piano base · € l’anno</b><small>Da decidere. Mostrata nella pagina di ingresso quando il pagamento è attivo.</small></div><input type="number" min="0" step="10" class="dk-num" data-cfg-num="quota_private" value="' + escHtml(cfg.quota_private || '0') + '"></div>' +
        '<div class="dk-sw"><div><b>Quota Speakeasy · € l’anno</b><small>Mostrata nella porta dello Speakeasy.</small></div><input type="number" min="0" step="10" class="dk-num" data-cfg-num="quota_club" value="' + escHtml(cfg.quota_club || '900') + '"></div>' +
      '</div></section>' +
      '<section class="blk"><header class="blkh"><h3>Ultimi accessi</h3></header><div class="tw"><table><thead><tr><th>Quando</th><th>Chi</th><th>Dispositivo</th></tr></thead><tbody>' + (acc || '<tr><td colspan="3">Nessun accesso.</td></tr>') + '</tbody></table></div></section>' +
      '<section class="blk"><header class="blkh"><h3>Avvisi</h3><p>Tutto ciò che il desk avrebbe ricevuto per email.</p></header><div class="tw"><table><thead><tr><th>Quando</th><th>Tipo</th><th>Testo</th><th>Email</th></tr></thead><tbody>' + (nots || '<tr><td colspan="4">Nessun avviso.</td></tr>') + '</tbody></table></div></section>' +
      '<p class="disc"><button type="button" class="lnk" id="desk-ricarica">Aggiorna</button></p>' +
      '</div>';
  }
  function deskAzione(az, email) {
    if (az === 'fondatore' || az === 'nofondatore') {
      CELL.deskFondatore(email, az === 'fondatore').then(function () {
        var fine = az === 'fondatore' ? CELL.avvisa('fondatore', '', email).catch(function () {}) : Promise.resolve();
        return fine.then(function () { toast(az === 'fondatore' ? 'Segnato come membro fondatore' : 'Tolto dai fondatori'); DESK = null; render(); });
      }).catch(function (e) { toast((e && e.message) || 'Non riuscito'); });
      return;
    }
    var p = { approva: { stato: 'approvato' }, rifiuta: { stato: 'rifiutato' }, sospendi: { stato: 'sospeso' }, club: { piano: 'club' }, private: { piano: 'private' }, pagato: { pagato: true } }[az];
    if (!p) return;
    CELL.deskAccount(email, p).then(function () {
      var avv = az === 'approva' ? 'approvato' : az === 'rifiuta' ? 'rifiutato' : az === 'club' ? 'club' : null;
      var fine = avv ? CELL.avvisa(avv, '', email).catch(function () {}) : Promise.resolve();
      return fine.then(function () { toast({ approva: 'Account approvato', rifiuta: 'Richiesta rifiutata', sospendi: 'Account sospeso', club: 'Ammesso al Club per 12 mesi', private: 'Tolto dal Club', pagato: 'Pagamento registrato: 12 mesi' }[az]); DESK = null; render(); });
    }).catch(function (e) { toast((e && e.message) || 'Non riuscito'); });
  }

  /* ======================= MAPPA DELLA CANTINA =======================
     Sezioni → scaffali → ripiani. La mappa vive in meta.mappa (colonna
     cantine.mappa). Le bottiglie continuano a portare zona / scaffale /
     ripiano come testo: zona = nome della sezione, scaffale e ripiano =
     numeri. Così CSV, schede e ricerca libera funzionano come prima, e una
     bottiglia la cui zona non è in mappa resta semplicemente "fuori mappa". */
  var mappaOpen = false, mappaDraft = null, ultimaPos = null;
  function mappa() {
    var m = STATE.meta.mappa;
    if (!m || !Array.isArray(m.sezioni)) { m = { sezioni: [] }; STATE.meta.mappa = m; }
    return m;
  }
  function sezioni() { return mappa().sezioni; }
  function normZ(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' '); }
  function nInt(v) { var m = String(v == null ? '' : v).trim().match(/^0*(\d+)$/); return m ? +m[1] : null; }
  function sezioneConNome(nome) {
    var n = normZ(nome); if (!n) return null;
    var sz = sezioni();
    for (var i = 0; i < sz.length; i++) if (normZ(sz[i].nome) === n) return sz[i];
    return null;
  }
  /* "sezione 3": prima una sezione che si chiama davvero così, poi la terza della lista */
  function sezionePerNumero(k) {
    var sz = sezioni(), i;
    for (i = 0; i < sz.length; i++) { var m = normZ(sz[i].nome).match(/^(?:sezione|sez\.?|settore|zona|parete|armadio)\s*(\d+)$/); if (m && +m[1] === k) return sz[i]; }
    return sz[k - 1] || null;
  }
  function sezioneDi(b) { return sezioneConNome(b.zona); }
  function numeroSezione(sz) { var i = sezioni().indexOf(sz); return i < 0 ? 0 : i + 1; }
  function nomeDefault(sz) { return /^sezione\s*\d+$/i.test(String(sz.nome || '').trim()); }
  function etichettaSez(sz) { var k = numeroSezione(sz); return (!k || nomeDefault(sz)) ? sz.nome : 'Sezione ' + k + ' · ' + sz.nome; }
  function stessoNumero(v, k) { var n = nInt(v); return n != null ? n === k : normZ(v) === String(k); }
  function stessoScaffale(b, sc) { var k = nInt(sc); return k != null ? stessoNumero(b.scaffale, k) : scaffaleDi(b).toLowerCase() === String(sc).toLowerCase(); }
  function inSezione(b, sz) {
    if (!sz) return false;
    if (normZ(b.zona) === normZ(sz.nome)) return true;
    if (sz.virtuale) { var k = nInt(b.zona); return k != null && k === sz.k; }
    return false;
  }
  function sezioneTesto(b) { var sz = sezioneDi(b); if (!sz) return ''; var k = numeroSezione(sz); return k ? 'sezione ' + k + ' sez ' + k : ''; }
  function zoneTutte() {   // le sezioni della mappa prima, poi le zone libere trovate sulle bottiglie
    var out = sezioni().map(function (s) { return s.nome; }), viste = {};
    out.forEach(function (z) { viste[normZ(z)] = 1; });
    zoneEsistenti().forEach(function (z) { if (!viste[normZ(z)]) { viste[normZ(z)] = 1; out.push(z); } });
    return out;
  }
  function scaffaliDiZona(zona) {
    var sz = sezioneConNome(zona);
    if (!sz) return scaffaliEsistenti(zona);
    var conta = {};
    STATE.bottles.forEach(function (b) { if (!inSezione(b, sz)) return; var k = nInt(b.scaffale); if (k != null) conta[k] = (conta[k] || 0) + qty(b); });
    var out = [];
    for (var i = 1; i <= (sz.scaffali | 0); i++) out.push({ sc: String(i), n: conta[i] || 0, zone: [sz.nome] });
    return out;
  }
  function contaSezione(nome) { var n = 0; STATE.bottles.forEach(function (b) { if (normZ(b.zona) === normZ(nome)) n += qty(b); }); return n; }

  /* ---- categorie: a ogni sezione si può dire "cosa ci va" ----
     Servono alla mappa standard e alla posizione proposta. */
  var CATEGORIE = [['rosso', 'Rossi'], ['bianco', 'Bianchi'], ['rose', 'Rosati'], ['spumante', 'Bollicine'], ['distillato', 'Distillati e liquori'], ['altro', 'Altro']];
  function etichettaCategoria(k) { for (var i = 0; i < CATEGORIE.length; i++) if (CATEGORIE[i][0] === k) return CATEGORIE[i][1]; return k; }
  function categoriaDi(b) {
    var t = b && b.tipologia;
    if (t === 'Spumante') return 'spumante';
    if (t === 'Vino') return b.colore === 'Rosso' ? 'rosso' : b.colore === 'Bianco' ? 'bianco' : b.colore === 'Rosé' ? 'rose' : 'altro';
    if (t && SPIRITI[t]) return 'distillato';
    return 'altro';
  }
  /* La mappa standard: chi non ha mai ordinato la cantina parte da qui e la adatta. */
  function mappaStandard() {
    return { standard: true, sezioni: [
      { id: 'std-rossi', nome: 'Rossi', scaffali: 8, ripiani: 3, categorie: ['rosso'] },
      { id: 'std-bianchi', nome: 'Bianchi e rosati', scaffali: 6, ripiani: 3, categorie: ['bianco', 'rose'] },
      { id: 'std-bollicine', nome: 'Bollicine', scaffali: 4, ripiani: 2, categorie: ['spumante'] },
      { id: 'std-distillati', nome: 'Distillati e liquori', scaffali: 6, ripiani: 2, categorie: ['distillato', 'altro'] }
    ] };
  }
  function applicaStandard() {
    var m = STATE.meta.mappa;
    if (m && Array.isArray(m.sezioni) && !m.sezioni.length && !m.personalizzata) STATE.meta.mappa = mappaStandard();
  }
  /* Dove la metterei: sezione per categoria; dentro la sezione lo scaffale con
     bottiglie simili (stesso produttore, stessa categoria), altrimenti uno
     vuoto, altrimenti il meno pieno; il ripiano meno carico. */
  function proponiPosizione(b) {
    var sz = sezioni(); if (!sz.length) return null;
    var cat = categoriaDi(b || {});
    var cand = sz.filter(function (s) { return (s.categorie || []).indexOf(cat) !== -1; });
    if (!cand.length) cand = sz.filter(function (s) { return (s.categorie || []).indexOf('altro') !== -1; });
    if (!cand.length) cand = sz.slice();
    var best = null;
    cand.forEach(function (s) {
      var perSc = {}, k;
      for (k = 1; k <= (s.scaffali | 0); k++) perSc[k] = { n: 0, simili: 0, rip: {} };
      STATE.bottles.forEach(function (x) {
        if ((b && x.id === b.id) || !inCantina(x) || !inSezione(x, s)) return;
        var i = nInt(x.scaffale); if (i == null || !perSc[i]) return;
        perSc[i].n += qty(x);
        perSc[i].simili += (b && x.produttore && b.produttore && normZ(x.produttore) === normZ(b.produttore)) ? 2 : (categoriaDi(x) === cat ? 1 : 0);
        var r = nInt(x.ripiano); if (r != null) perSc[i].rip[r] = (perSc[i].rip[r] || 0) + qty(x);
      });
      Object.keys(perSc).forEach(function (i) {
        var c = perSc[i], punti = c.simili * 10 - c.n + (c.n === 0 ? 5 : 0);
        if (!best || punti > best.punti) best = { sez: s, scaffale: +i, punti: punti, rip: c.rip };
      });
    });
    if (!best) return null;
    var ripiano = '';
    if ((best.sez.ripiani | 0) > 0) { var min = null; for (var r = 1; r <= (best.sez.ripiani | 0); r++) { var n = best.rip[r] || 0; if (!min || n < min.n) min = { r: r, n: n }; } ripiano = String(min.r); }
    var motivo = best.punti >= 10 ? 'vicino a bottiglie simili' : (best.punti >= 5 ? 'scaffale libero' : 'scaffale meno pieno');
    return { zona: best.sez.nome, scaffale: String(best.scaffale), ripiano: ripiano, motivo: etichettaCategoria(cat) + ' · ' + motivo };
  }

  /* ---- la ricerca capisce le posizioni ----
     "cosa c'è sullo scaffale 8 della sezione 1", "sez 2 rip 3", "1/8", "1/8/2",
     "sezione frigo". Le parole di contorno (cosa, sullo, della…) vengono tolte. */
  var STOP = ' what is are on the of in at my a an which bottles bottle wine wines show find where there do i have whats s c è cè l d cosa che ce sul sullo sulla sui sugli sulle su nel nello nella nei negli nelle in a al allo alla ai agli alle della del dello dei degli delle di da dal dallo dalla il lo la i gli le un uno una e ed o ho hai abbiamo mi ci si trova trovami cerca cercami mostra mostrami fammi vedere dimmi dammi elenca elencami bottiglie bottiglia vini vino dove sta stanno quali quale quante quanti tutto tutte tutti per con ';
  var _pq = { q: null, r: null };
  function posQuery(q) {
    if (_pq.q === q) return _pq.r;
    var out = { sez: null, k: null, scaff: null, rip: null, parole: [], attiva: false };
    var s = ' ' + String(q).toLowerCase().replace(/[’èé']/g, function (c) { return c === '’' || c === "'" ? ' ' : c; }).replace(/[,;:!?()“”"]/g, ' ') + ' ';
    s = s.replace(/\s(\d{1,2})\/(\d{1,3})(?:\/(\d{1,2}))?\s/, function (_, a, b, c) { out.k = +a; out.scaff = +b; if (c) out.rip = +c; return ' '; });
    s = s.replace(/\s(?:sezione|sezioni|sez\.?|settore|zona|parete|stanza|area|armadio|section|sections|sec\.?|zone|wall|cabinet|bay)\s*(?:n\.?|n°|numero|number|no\.?)?\s*(\d{1,3})\s/, function (_, n) { out.k = +n; return ' '; });
    s = s.replace(/\s(?:scaffale|scaffali|scaff\.?|scaf\.?|sc\.?|mensola|colonna|rack|shelf|shelves|column|col\.?)\s*(?:n\.?|n°|numero|number|no\.?)?\s*(\d{1,3})\s/, function (_, n) { out.scaff = +n; return ' '; });
    s = s.replace(/\s(?:ripiano|ripiani|rip\.?|piano|livello|fila|riga|level|levels|tier|row|slot)\s*(?:n\.?|n°|numero|number|no\.?)?\s*(\d{1,3})\s/, function (_, n) { out.rip = +n; return ' '; });
    s = s.replace(/\s(?:sezione|sez\.?|zona|settore|section|zone)\s+(\S+)\s/, function (m, w) { var sz = sezioneConNome(w); if (sz) { out.sez = sz; return ' '; } return m; });
    if (out.k != null && !out.sez) out.sez = sezionePerNumero(out.k) || { nome: 'Sezione ' + out.k, virtuale: true, k: out.k };
    out.attiva = !!(out.sez || out.scaff != null || out.rip != null);
    var parole = s.split(/\s+/).filter(Boolean);
    var utili = parole.filter(function (w) { return STOP.indexOf(' ' + w + ' ') === -1; });
    if (out.attiva) utili = utili.filter(function (w) { return w.length > 1; });
    out.parole = (utili.length || out.attiva) ? utili : parole;
    _pq = { q: q, r: out };
    return out;
  }
  function descrPos(pq) {
    var p = [];
    if (pq.sez) p.push(pq.sez.virtuale ? 'Sezione ' + pq.sez.k : etichettaSez(pq.sez));
    if (pq.scaff != null) p.push('scaffale ' + pq.scaff);
    if (pq.rip != null) p.push('ripiano ' + pq.rip);
    return p.join(' · ');
  }
  function notaPosQuery(l) {
    if (!filters.q) return '';
    var pq = posQuery(filters.q); if (!pq.attiva) return '';
    var pezzi = l.reduce(function (n, b) { return n + qty(b); }, 0), avviso = '';
    if (pq.sez && !pq.sez.virtuale && pq.scaff != null && pq.scaff > (pq.sez.scaffali | 0)) avviso = ' · attenzione: questa sezione ha solo ' + pq.sez.scaffali + ' scaffali';
    else if (pq.sez && pq.sez.virtuale && sezioni().length) avviso = ' · nessuna sezione con questo numero nella mappa';
    return '<p class="qres pos">Posizione letta dalla ricerca: <strong>' + escHtml(descrPos(pq)) + '</strong> — <strong>' + pezzi + '</strong> ' +
      (pezzi === 1 ? 'bottiglia' : 'bottiglie') + (pezzi ? '' : ' · vuoto') + escHtml(avviso) +
      (pq.parole.length ? ' · filtrate per “' + escHtml(pq.parole.join(' ')) + '”' : '') +
      ' <button type="button" class="lnk" id="q-off3">mostra tutta la cantina</button></p>';
  }

  /* ---- i campi "dove sta": select guidate dalla mappa, testo libero se non c'è mappa ---- */
  function opt(v, et, sel) { return '<option value="' + escHtml(v) + '"' + (sel ? ' selected' : '') + '>' + escHtml(et) + '</option>'; }
  function campiPosizione(b, pfx) {
    b = b || {};
    var sz = sezioneConNome(b.zona), libere = sezioni().length === 0, zonaCtl, scCtl, ripCtl, i;
    if (libere) {
      zonaCtl = '<input type="text" id="' + pfx + '-zona" list="dl-zona" placeholder="es. Cantina bassa" value="' + escHtml(b.zona || '') + '"><datalist id="dl-zona">' + zoneEsistenti().map(function (z) { return '<option value="' + escHtml(z) + '">'; }).join('') + '</datalist>';
    } else {
      var zl = zoneTutte();
      zonaCtl = '<select id="' + pfx + '-zona" data-pos="' + pfx + '">' + opt('', 'Senza posizione', !b.zona) +
        sezioni().map(function (s) { return opt(s.nome, etichettaSez(s), normZ(b.zona) === normZ(s.nome)); }).join('') +
        zl.filter(function (z) { return !sezioneConNome(z); }).map(function (z) { return opt(z, z + ' · fuori mappa', normZ(b.zona) === normZ(z)); }).join('') +
        ((b.zona && !sz && zl.indexOf(b.zona) === -1) ? opt(b.zona, b.zona + ' · fuori mappa', true) : '') + '</select>';
    }
    if (sz) {
      var ks = nInt(b.scaffale), kr = nInt(b.ripiano);
      scCtl = '<select id="' + pfx + '-scaff">' + opt('', '—', !b.scaffale);
      for (i = 1; i <= (sz.scaffali | 0); i++) scCtl += opt(String(i), 'Scaffale ' + i, ks === i);
      if (b.scaffale && (ks == null || ks < 1 || ks > (sz.scaffali | 0))) scCtl += opt(b.scaffale, b.scaffale + ' · fuori numerazione', true);
      scCtl += '</select>';
      if ((sz.ripiani | 0) > 0) {
        ripCtl = '<select id="' + pfx + '-rip">' + opt('', '—', !b.ripiano);
        for (i = 1; i <= (sz.ripiani | 0); i++) ripCtl += opt(String(i), 'Ripiano ' + i, kr === i);
        if (b.ripiano && (kr == null || kr < 1 || kr > (sz.ripiani | 0))) ripCtl += opt(b.ripiano, b.ripiano + ' · fuori numerazione', true);
        ripCtl += '</select>';
      } else ripCtl = '<input type="text" id="' + pfx + '-rip" placeholder="es. 3" value="' + escHtml(b.ripiano || '') + '">';
    } else {
      scCtl = '<input type="text" id="' + pfx + '-scaff" placeholder="es. 8 oppure A1" value="' + escHtml(b.scaffale || '') + '">';
      ripCtl = '<input type="text" id="' + pfx + '-rip" placeholder="es. 3" value="' + escHtml(b.ripiano || '') + '">';
    }
    var proposta = (b.id && incerto(b, 'posizione')) ? '<span class="fl">posizione proposta dalla lettura · confermala o cambiala</span>' : '';
    return '<label' + (proposta ? ' class="warned"' : '') + '><span class="lbl">' + (libere ? 'Zona' : 'Sezione') + proposta + '</span>' + zonaCtl + '</label>' +
      '<label><span class="lbl">Scaffale</span>' + scCtl + '</label>' +
      '<label><span class="lbl">Ripiano</span>' + ripCtl + '</label>' +
      (libere ? '' : '<div class="posprop"><button type="button" class="btn sm gho" data-proponi="' + pfx + '">Proponi un posto</button><span class="hint">In base alla mappa e a quello che c’è già.</span></div>');
  }
  function posDaForm(pfx) {
    var g = function (id) { var e = document.getElementById(id); return e ? String(e.value || '').trim() : ''; };
    return { zona: g(pfx + '-zona'), scaffale: g(pfx + '-scaff'), ripiano: g(pfx + '-rip') };
  }
  function bindPos(root) {
    root.querySelectorAll('[data-proponi]').forEach(function (e) {
      e.addEventListener('click', function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        var pfx = e.getAttribute('data-proponi'), w = document.getElementById('pos-' + pfx); if (!w) return;
        var g = function (id) { var x = document.getElementById(id); return x ? x.value : ''; };
        var base = pfx === 'i' ? { id: editingId, tipologia: g('i-tipo'), colore: g('i-col'), produttore: g('i-prod') } : {};
        var p = proponiPosizione(base);
        if (!p) { toast('Prima disegna la mappa della cantina'); return; }
        w.innerHTML = campiPosizione({ zona: p.zona, scaffale: p.scaffale, ripiano: p.ripiano }, pfx); bindPos(w);
        toast('Proposta: ' + p.zona + ' · scaffale ' + p.scaffale + (p.ripiano ? ' · ripiano ' + p.ripiano : '') + ' (' + p.motivo + ')');
      });
    });
    root.querySelectorAll('select[data-pos]').forEach(function (e) {
      e.addEventListener('change', function () {
        var pfx = e.getAttribute('data-pos'), w = document.getElementById('pos-' + pfx); if (!w) return;
        var cur = posDaForm(pfx); cur.scaffale = ''; cur.ripiano = '';
        w.innerHTML = campiPosizione(cur, pfx); bindPos(w);
        var s = document.getElementById(pfx + '-scaff'); if (s && cur.zona) s.focus();
      });
    });
  }

  /* ---- la vista Posizione guidata dalla mappa: anche gli scaffali vuoti si vedono ---- */
  function rigaPos(b) {
    return '<button type="button" class="prow" data-open="' + b.id + '" style="' + blkVars(b) + '">' +
      '<span class="prip tab">' + (b.ripiano ? 'rip. ' + escHtml(b.ripiano) : '—') + '</span>' +
      '<span class="pnm">' + escHtml(inCoda(b) ? 'Da catalogare' : (b.nome || 'Senza nome')) + '</span>' +
      '<span class="pmk">' + escHtml(b.produttore || b.cantina || '') + (etaTesto(b) ? ' · ' + etaTesto(b) : '') + '</span>' +
      (qty(b) > 1 ? '<span class="pq tab">' + qty(b) + ' bt</span>' : '') +
      '<span class="pv tab">' + fmtM(vetrina(b)) + '</span></button>';
  }
  function scaffaleBox(sc, etich, bs, zonaNome) {
    var solo = sc && filters.scaffale && stessoNumero(filters.scaffale, nInt(sc)) && normZ(filters.zona) === normZ(zonaNome);
    if (!bs.length) return '<div class="scf vuoto"><div class="scf-h"><span class="scf-n">' + escHtml(etich) + '</span><span class="scf-c tab">vuoto</span></div></div>';
    var ord = bs.slice().sort(function (a, b) {
      var ra = nInt(a.ripiano), rb = nInt(b.ripiano);
      if (ra != null && rb != null && ra !== rb) return ra - rb;
      return String(a.ripiano || '').localeCompare(String(b.ripiano || ''), 'it') || (a.nome || '').localeCompare(b.nome || '', 'it');
    });
    var pezzi = ord.reduce(function (n, b) { return n + qty(b); }, 0);
    return '<div class="scf"><div class="scf-h"><span class="scf-n">' + escHtml(etich) + '</span>' +
      (sc ? '<button type="button" class="scf-b' + (solo ? ' on' : '') + '" data-scaff="' + escHtml(sc) + '" data-zona="' + escHtml(zonaNome) + '">' + (solo ? 'mostra tutto' : 'solo questo scaffale') + '</button>' : '') +
      '<span class="scf-c tab">' + pezzi + (pezzi === 1 ? ' bt' : ' bt') + '</span></div>' +
      '<div class="scf-l">' + ord.map(rigaPos).join('') + '</div></div>';
  }
  function ctaMappa() {
    return '<div class="mcta"><strong>Disegna la mappa della tua cantina.</strong>' +
      '<p class="hint">Sezioni (una parete, un armadio, il frigo), scaffali numerati e, se vuoi, ripiani. Ogni bottiglia avrà un posto preciso e alla ricerca potrai chiedere “cosa c’è sullo scaffale 8 della sezione 1”.</p>' +
      (isReadOnly ? '' : '<button type="button" class="btn pri sm" data-mappa-open>Crea la mappa</button>') + '</div>';
  }
  function posizioneView(l) {
    var sz = sezioni();
    if (!sz.length) return ctaMappa() + posizioneViewLibera(l);
    var tuttaLaCantina = !filters.q && !filters.zona && !filters.scaffale;
    var avvisoStd = (mappa().standard && tuttaLaCantina) ? '<div class="mcta"><strong>Questa è la mappa standard di Caveau.</strong><p class="hint">Rossi, Bianchi e rosati, Bollicine, Distillati e liquori: un ordine già pronto per chi parte da zero. Adattala alla tua cantina: rinomina le sezioni, cambia scaffali e ripiani, aggiungine altre.</p>' + (isReadOnly ? '' : '<button type="button" class="btn pri sm" data-mappa-open>Adatta la mappa</button>') + '</div>' : '';
    var fuori = [], perSez = sz.map(function () { return []; });
    l.forEach(function (b) { var i = sz.indexOf(sezioneDi(b)); if (i < 0) fuori.push(b); else perSez[i].push(b); });
    var html = sz.map(function (s, i) {
      var bs = perSez[i];
      if (!bs.length && !tuttaLaCantina) return '';
      var pezzi = bs.reduce(function (n, b) { return n + qty(b); }, 0);
      var val = bs.reduce(function (n, b) { return n + (vetrina(b) || 0) * qty(b); }, 0);
      var perSc = {}, altri = [], corpo = '', k;
      bs.forEach(function (b) { var n = nInt(b.scaffale); if (n != null && n >= 1 && n <= (s.scaffali | 0)) (perSc[n] = perSc[n] || []).push(b); else altri.push(b); });
      for (k = 1; k <= (s.scaffali | 0); k++) { if (!perSc[k] && !tuttaLaCantina) continue; corpo += scaffaleBox(String(k), 'Scaffale ' + k, perSc[k] || [], s.nome); }
      if (altri.length) corpo += scaffaleBox('', 'Senza scaffale o fuori numerazione', altri, s.nome);
      return '<section class="zsec"><header class="zhd"><h3>' + escHtml(s.nome) + '</h3>' +
        (nomeDefault(s) ? '' : '<span class="zsub">Sezione ' + (i + 1) + '</span>') +
        '<span class="zmeta tab">' + (s.scaffali | 0) + ' scaffali' + ((s.ripiani | 0) ? ' · ' + s.ripiani + ' ripiani' : '') + ' · ' + pezzi + ' bt' + (val ? ' · ' + fmtM(val) : '') + '</span></header>' +
        corpo + '</section>';
    }).join('');
    if (fuori.length) html += '<section class="zsec"><header class="zhd"><h3>Fuori mappa</h3><span class="zmeta tab">' + fuori.length + ' da riposizionare</span></header>' + posizioneViewLibera(fuori) + '</section>';
    return avvisoStd + html + (isReadOnly ? '' : '<p class="hint" style="margin-top:6px"><button type="button" class="lnk" data-mappa-open>Modifica la mappa della cantina</button></p>');
  }

  /* ---- l'editor della mappa ---- */
  function apriMappa() { mappaDraft = JSON.parse(JSON.stringify(sezioni())); mappaOpen = true; render(); }
  function leggiDraft() {   // raccoglie i valori digitati prima di ridisegnare
    if (!mappaDraft) return;
    mappaDraft.forEach(function (s, i) {
      var n = document.getElementById('ms-nome-' + i), a = document.getElementById('ms-sc-' + i), r = document.getElementById('ms-rip-' + i);
      if (n) s.nome = n.value; if (a) s.scaffali = a.value; if (r) s.ripiani = r.value;
    });
  }
  function origDi(s) { return sezioni().filter(function (x) { return x.id === s.id; })[0]; }
  function mappaSheet() {
    var d = mappaDraft || [];
    var righe = d.map(function (s, i) {
      var orig = origDi(s), bt = orig ? contaSezione(orig.nome) : 0;
      return '<div class="mrow"><span class="mnum tab">' + (i + 1) + '</span>' +
        '<label><span class="lbl">Nome</span><input type="text" id="ms-nome-' + i + '" value="' + escHtml(String(s.nome || '')) + '" placeholder="Sezione ' + (i + 1) + '"></label>' +
        '<label><span class="lbl">Scaffali</span><input type="number" min="0" max="200" id="ms-sc-' + i + '" value="' + escHtml(String(s.scaffali == null ? '' : s.scaffali)) + '"></label>' +
        '<label><span class="lbl">Ripiani per scaffale</span><input type="number" min="0" max="50" id="ms-rip-' + i + '" value="' + escHtml(String(s.ripiani == null ? '' : s.ripiani)) + '" placeholder="0 = nessuno"></label>' +
        '<span class="mbt tab">' + (bt ? bt + ' bt' : '') + '</span>' +
        '<button type="button" class="x" data-ms-del="' + i + '" aria-label="Elimina sezione" title="Elimina sezione">✕</button>' +
        '<div class="mcat"><span class="lbl">Cosa ci va</span>' + CATEGORIE.map(function (c) { return '<button type="button" class="' + ((s.categorie || []).indexOf(c[0]) !== -1 ? 'on' : '') + '" data-ms-cat="' + i + '|' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div></div>';
    }).join('');
    return '<div class="ov" data-ov><div class="sheet wide">' +
      head('Mappa della cantina', 'Dividi la cantina in sezioni (una parete, un armadio, il frigo), ogni sezione in scaffali numerati e, se vuoi, ogni scaffale in ripiani. Poi ogni bottiglia prende il suo posto.') +
      '<div class="shb">' + (righe || '<p class="hint">Nessuna sezione ancora. Parti da un modello o aggiungine una.</p>') +
      '<div class="mtools"><button type="button" class="btn sm" data-ms-add>+ Aggiungi sezione</button>' +
      (d.length ? '' : '<button type="button" class="btn sm gho" data-ms-modello="std">Modello Caveau: Rossi, Bianchi e rosati, Bollicine, Distillati</button><button type="button" class="btn sm gho" data-ms-modello="4|8|3">Modello: 4 sezioni × 8 scaffali × 3 ripiani</button><button type="button" class="btn sm gho" data-ms-modello="2|6|0">Modello: 2 sezioni × 6 scaffali</button>') + '</div>' +
      '<p class="hint">Rinominare una sezione porta con sé le sue bottiglie. Eliminarla non le cancella: restano “fuori mappa” finché non le riposizioni. Nella ricerca potrai scrivere “sezione 1 scaffale 8”, “sez 2 rip 3” oppure “1/8”.</p></div>' +
      '<div class="shf"><button type="button" class="btn gho" data-shutsheet>Annulla</button><button type="button" class="btn pri" id="ms-save">Salva la mappa</button></div></div></div>';
  }
  function salvaMappa() {
    leggiDraft();
    var vecchie = sezioni(), nuove = [], visti = {}, rinomina = [];
    for (var i = 0; i < mappaDraft.length; i++) {
      var s = mappaDraft[i], nome = String(s.nome || '').trim() || ('Sezione ' + (i + 1));
      if (visti[normZ(nome)]) { toast('Due sezioni si chiamano “' + nome + '”: dai loro nomi diversi'); return; }
      visti[normZ(nome)] = 1;
      var sc = Math.max(0, Math.min(200, parseInt(s.scaffali, 10) || 0)), rp = Math.max(0, Math.min(50, parseInt(s.ripiani, 10) || 0));
      var orig = origDi(s);
      if (orig && normZ(orig.nome) !== normZ(nome)) rinomina.push([orig.nome, nome]);
      nuove.push({ id: String(s.id || uid()), nome: nome.slice(0, 60), scaffali: sc, ripiani: rp, categorie: (s.categorie || []).slice() });
    }
    mappaOpen = false; mappaDraft = null;
    commit(function (ns) {
      ns.meta.mappa = { sezioni: nuove, personalizzata: true };
      if (rinomina.length) ns.bottles.forEach(function (b) { rinomina.forEach(function (p) { if (normZ(b.zona) === normZ(p[0])) b.zona = p[1]; }); });
    }, false);
    toast('Mappa salvata · ' + nuove.length + (nuove.length === 1 ? ' sezione' : ' sezioni'));
  }
  function bindMappa(root, on) {
    root.querySelectorAll('[data-mappa-open]').forEach(function (e) { e.addEventListener('click', function (ev) { ev.stopPropagation(); apriMappa(); }); });
    root.querySelectorAll('[data-ms-add]').forEach(function (e) { e.addEventListener('click', function () { leggiDraft(); mappaDraft.push({ id: uid(), nome: 'Sezione ' + (mappaDraft.length + 1), scaffali: 8, ripiani: 0, categorie: [] }); render(); }); });
    root.querySelectorAll('[data-ms-cat]').forEach(function (e) {
      e.addEventListener('click', function () {
        leggiDraft(); var p = e.getAttribute('data-ms-cat').split('|'), s = mappaDraft[+p[0]]; if (!s) return;
        s.categorie = s.categorie || []; var i = s.categorie.indexOf(p[1]);
        if (i === -1) s.categorie.push(p[1]); else s.categorie.splice(i, 1);
        render();
      });
    });
    root.querySelectorAll('[data-ms-modello]').forEach(function (e) { e.addEventListener('click', function () { var m = e.getAttribute('data-ms-modello'); if (m === 'std') { mappaDraft = mappaStandard().sezioni; render(); return; } var p = m.split('|'); mappaDraft = []; for (var i = 1; i <= +p[0]; i++) mappaDraft.push({ id: uid(), nome: 'Sezione ' + i, scaffali: +p[1], ripiani: +p[2], categorie: [] }); render(); }); });
    root.querySelectorAll('[data-ms-del]').forEach(function (e) {
      e.addEventListener('click', function () {
        leggiDraft();
        var i = +e.getAttribute('data-ms-del'), s = mappaDraft[i], orig = origDi(s), bt = orig ? contaSezione(orig.nome) : 0;
        if (bt && !confirm('La sezione “' + (s.nome || '') + '” contiene ' + bt + ' bottiglie: resteranno fuori mappa finché non le riposizioni. Eliminare la sezione?')) return;
        mappaDraft.splice(i, 1); render();
      });
    });
    on('ms-save', 'click', salvaMappa);
    on('q-off3', 'click', function () { filters.q = ''; render(); });
    bindPos(root);
  }

  /* ======================= persistenza =======================
     Una volta questa pagina si ripubblicava da sola: salvare voleva dire
     riscrivere l'intero documento. Ora il salvataggio è una scrittura
     mirata sul database — solo le bottiglie cambiate, solo i campi
     cambiati — e l'interfaccia se ne accorge soltanto dal messaggio. */
  function persist(ns) {
    if (!window.CELL) { isReadOnly = true; return Promise.resolve(false); }
    if (saving) { attesa = ns; return Promise.resolve(false); }
    saving = true;
    toast('Salvataggio…');
    return CELL.salva(ns).then(function (esiti) {
      saving = false;
      var conFoto = esiti && esiti.indexOf && esiti.indexOf('foto') >= 0;
      if (conFoto) render();              // i link firmati hanno preso il posto delle foto in memoria
      if (attesa) { var p = attesa; attesa = null; return persist(p); }
      return true;
    }).catch(function (err) {
      saving = false;
      var m = (err && err.message) || '';
      toast(m ? 'Non salvato: ' + m : 'Salvataggio non riuscito, riprova');
      return false;
    });
  }


  /* ======================= scatto rapido =======================
     Un tocco, la fotocamera, la foto va in coda e la lettura dell'etichetta
     parte da sola appena il salvataggio è finito. Si può scattare la prossima
     mentre la precedente viene letta: le letture si mettono in fila. */
  var letture = {}, codaLetture = Promise.resolve();
  function rapidoPreferito() {
    return !!(window.matchMedia && (window.matchMedia('(max-width:640px)').matches || window.matchMedia('(pointer:coarse)').matches));
  }
  function rapidoHtml() {
    if (isReadOnly) return '';
    var n = Object.keys(letture).filter(function (k) { return letture[k].stato !== 'ko'; }).length;
    return '<input type="file" accept="image/*" capture="environment" id="rapido-in" class="rapido-in" aria-hidden="true" tabindex="-1">' +
      '<input type="file" accept="image/*" capture="environment" id="retro-in" class="rapido-in" aria-hidden="true" tabindex="-1">' +
      '<button type="button" class="fab" id="fab-scatta" aria-label="Scatta l’etichetta di una bottiglia">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.2-2h5.4l1.2 2h1.6A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.4"/></svg>' +
      '<span>Scatta</span>' + (n ? '<span class="fab-n">' + n + '</span>' : '') + '</button>';
  }
  function statoLettura(b) {
    var l = letture[b.id];
    if (l && l.stato === 'leggo') return '<div class="mt"><span class="pl lett">leggo l’etichetta…</span></div><div class="nm">Un momento</div><div class="mk">Nome, cantina, annata e vitigni stanno arrivando</div>';
    if (l && l.stato === 'salvo') return '<div class="mt"><span class="pl lett">salvo la foto…</span></div><div class="nm">Da catalogare</div><div class="mk">Appena salvata, leggo l’etichetta</div>';
    if (l && l.stato === 'ko') return '<div class="mt"><span class="pl ko">lettura non riuscita</span></div><div class="nm">Da catalogare</div><div class="mk">' + escHtml(l.msg || 'Riprova o compila a mano') + '</div>';
    return '<div class="mt"><span class="pl">in lavorazione</span></div><div class="nm">Da catalogare</div><div class="mk">In attesa della lettura dell’etichetta</div>';
  }
  function azioniCoda(b) {
    if (isReadOnly) return '';
    var l = letture[b.id], occupata = l && (l.stato === 'leggo' || l.stato === 'salvo');
    return (b.foto_retro || occupata ? '' : '<button type="button" class="btn sm retro" data-retro-di="' + b.id + '">Aggiungi il retro</button>') +
      (l && l.stato === 'ko' ? '<button type="button" class="btn sm pri retro" data-rileggi="' + b.id + '">Riprova la lettura</button>' : '');
  }
  function apriRapido() { var i = document.getElementById('rapido-in'); if (i) { i.value = ''; i.click(); } }
  function attendiSalvataggio() {
    return new Promise(function (res) {
      var n = 0;
      (function giro() { if (!saving && !attesa) return res(true); if (++n > 240) return res(false); setTimeout(giro, 250); })();
    });
  }
  function fotoSulServer(b) { return !!b && (!b.foto_fronte || b.foto_fronte.slice(0, 5) !== 'data:') && (!b.foto_retro || b.foto_retro.slice(0, 5) !== 'data:'); }
  function leggiAppena(id) {
    letture[id] = { stato: 'salvo' }; render();
    codaLetture = codaLetture.then(function () {
      return attendiSalvataggio().then(function () {
        var b = STATE.bottles.find(function (x) { return x.id === id; });
        if (!b || !inCoda(b)) { delete letture[id]; render(); return; }
        if (!window.CELL || !CELL.cataloga) { letture[id] = { stato: 'ko', msg: 'Il motore non è raggiungibile da qui' }; render(); return; }
        if (!fotoSulServer(b)) { letture[id] = { stato: 'ko', msg: 'Foto non ancora salvata: riprova fra poco' }; render(); return; }
        letture[id] = { stato: 'leggo' }; render();
        return CELL.cataloga(id).then(function () { return CELL.carica(); }).then(function (nuovo) {
          delete letture[id]; idrata(nuovo); render();
          var l = STATE.bottles.find(function (x) { return x.id === id; });
          toast(l && l.nome ? 'Letta: ' + l.nome : 'Etichetta letta');
        }).catch(function (e) {
          letture[id] = { stato: 'ko', msg: (e && e.message) || 'Lettura non riuscita' }; render();
          toast('Lettura non riuscita: ' + ((e && e.message) || 'riprova'));
        });
      });
    });
  }
  function scattoRapido(file) {
    if (!file) return;
    toast('Preparo la foto…');
    toDataUrl(file, FOTO_MAX_DIM, FOTO_QUALITA).then(function (u) {
      var b = nuova(u, '', null);
      commit(function (ns) { ns.bottles.unshift(b); }, false);
      leggiAppena(b.id);
    }).catch(function () { toast('Immagine illeggibile, riprova'); });
  }
  var retroPer = null;
  function retroRapido(file) {
    var id = retroPer; retroPer = null;
    if (!file || !id) return;
    toast('Preparo il retro…');
    toDataUrl(file, FOTO_MAX_DIM, FOTO_QUALITA).then(function (u) {
      commit(function (ns) { var x = ns.bottles.find(function (y) { return y.id === id; }); if (x) x.foto_retro = u; }, false);
      var b = STATE.bottles.find(function (x) { return x.id === id; });
      if (b && inCoda(b)) leggiAppena(id); else toast('Retro aggiunto');
    }).catch(function () { toast('Immagine illeggibile, riprova'); });
  }
  function bindRapido(root) {
    var on = function (id, ev, fn) { var e = document.getElementById(id); if (e) e.addEventListener(ev, fn); };
    on('fab-scatta', 'click', apriRapido);
    on('rapido-in', 'change', function (e) { scattoRapido(e.target.files && e.target.files[0]); });
    on('retro-in', 'change', function (e) { retroRapido(e.target.files && e.target.files[0]); });
    root.querySelectorAll('[data-retro-di]').forEach(function (btn) {
      btn.addEventListener('click', function (ev) { ev.stopPropagation(); retroPer = btn.getAttribute('data-retro-di'); var i = document.getElementById('retro-in'); if (i) { i.value = ''; i.click(); } });
    });
    root.querySelectorAll('[data-rileggi]').forEach(function (btn) {
      btn.addEventListener('click', function (ev) { ev.stopPropagation(); leggiAppena(btn.getAttribute('data-rileggi')); });
    });
  }
  window.CAVEAU_RAPIDO = { scatta: scattoRapido, letture: function () { return letture; } };

  function toast(m) {
    var o = document.querySelector('.toast'); if (o) o.remove();
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = m;
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 3600);
  }
  function commit(fn, close) {
    var ns = JSON.parse(JSON.stringify(STATE));
    fn(ns); STATE = ns;
    if (close) { editingId = null; shooting = false; bulk = false; }
    render(); persist(ns);
  }

  /* ======================= foto ======================= */
  function toDataUrl(file, maxDim, q) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onerror = function () { rej(new Error('lettura')); };
      r.onload = function (e) {
        var i = new Image();
        i.onerror = function () { rej(new Error('decodifica')); };
        i.onload = function () {
          var w = i.width, h = i.height, s = Math.min(1, maxDim / Math.max(w, h));
          w = Math.max(1, Math.round(w * s)); h = Math.max(1, Math.round(h * s));
          var c = document.createElement('canvas'); c.width = w; c.height = h;
          c.getContext('2d').drawImage(i, 0, 0, w, h);
          res(c.toDataURL('image/jpeg', q));
        };
        i.src = e.target.result;
      };
      r.readAsDataURL(file);
    });
  }

  /* ======================= filtri ======================= */
  function matches(b) {
    if (filters.ambito === 'cantina' && !inCantina(b)) return false;
    if (filters.ambito === 'coda' && !inCoda(b)) return false;
    if (filters.ambito === 'bevuta' && b.stato !== 'bevuta') return false;
    if (filters.ambito === 'venduta' && b.stato !== 'venduta') return false;
    if (filters.ambito === 'regalata' && b.stato !== 'regalata') return false;
    if (filters.zona && zonaDi(b) !== filters.zona) return false;
    if (filters.scaffale && !stessoScaffale(b, filters.scaffale)) return false;
    if (filters.segnale && segnale(b) !== filters.segnale) return false;
    if (filters.tipi.length && filters.tipi.indexOf(b.tipologia) === -1) return false;
    if (filters.colori.length && filters.colori.indexOf(b.colore) === -1) return false;
    var an = parseInt(b.annata, 10);
    if (filters.annataMin && (isNaN(an) || an < parseInt(filters.annataMin, 10))) return false;
    if (filters.annataMax && (isNaN(an) || an > parseInt(filters.annataMax, 10))) return false;
    var gr = num(b.gradazione);
    if (filters.gradMin !== '' && (gr == null || gr < Number(filters.gradMin))) return false;
    if (filters.gradMax !== '' && (gr == null || gr > Number(filters.gradMax))) return false;
    var pv = num(b[filters.prezzoBase === 'acquisto' ? 'prezzo_acquisto' : 'valore_attuale']);
    if (filters.prezzoMin !== '' && (pv == null || pv < Number(filters.prezzoMin))) return false;
    if (filters.prezzoMax !== '' && (pv == null || pv > Number(filters.prezzoMax))) return false;
    if (filters.cantina && (b.cantina || '').toLowerCase().indexOf(filters.cantina.toLowerCase()) === -1) return false;
    if (filters.produttore && (b.produttore || '').toLowerCase().indexOf(filters.produttore.toLowerCase()) === -1) return false;
    if (filters.provenienza && (b.provenienza || '').toLowerCase().indexOf(filters.provenienza.toLowerCase()) === -1) return false;
    if (filters.vitigno && !(b.vitigni || []).some(function (v) { return v.toLowerCase().indexOf(filters.vitigno.toLowerCase()) !== -1; })) return false;
    if (filters.soloPlus) { var d = delta(b); if (d == null || d <= 0) return false; }
    if (filters.q) {
      // la ricerca capisce le posizioni: "scaffale 8 della sezione 1", "sez 2 rip 3", "1/8"
      var pq = posQuery(filters.q);
      if (pq.sez && !inSezione(b, pq.sez)) return false;
      if (pq.scaff != null && !stessoNumero(b.scaffale, pq.scaff)) return false;
      if (pq.rip != null && !stessoNumero(b.ripiano, pq.rip)) return false;
      var hay = testoRicerca(b);
      // più parole = tutte devono comparire, in qualsiasi campo (tolte quelle di contorno)
      var parole = pq.parole;
      for (var i = 0; i < parole.length; i++) if (hay.indexOf(parole[i]) === -1) return false;
    }
    return true;
  }

  /* Tutto quello che si sa di una bottiglia, in un'unica riga cercabile:
     non solo il nome, ma tipologia, colore, annata, zona, vitigni, formato,
     note, stato, fonte della quotazione, segnale e cifre. */
  function testoRicerca(b) {
    var sg = segnale(b);
    return [
      b.nome, b.produttore, b.cantina, b.tipologia, b.colore, b.annata, b.eta, b.annata_migliore,
      b.eta ? b.eta + ' anni' : '', (b.annata === 'NAS' || (!b.annata && !b.eta && spirito(b))) ? 'nas senza et\u00e0' : '',
      b.gradazione, b.provenienza, (b.vitigni || []).join(' '), b.formato,
      b.note, b.note_analisi, b.valore_fonte, fonteQuot(b),
      b.zona, b.scaffale, b.ripiano, b.regalata_a,
      b.scaffale ? 'scaffale ' + b.scaffale : '', b.zona ? 'zona ' + b.zona : '', b.ripiano ? 'ripiano ' + b.ripiano : '', sezioneTesto(b),
      STATI[b.stato] || '', sg ? SEGNALI[sg].et : '', rinforza(b) ? 'rinforza' : '',
      b.esempio ? 'esempio' : '', haFoto(b) ? 'foto' : '',
      (b.campi_incerti || []).length ? 'da verificare' : '',
      b.quantita, b.prezzo_acquisto, vetrina(b), b.prezzo_vendita,
      spirito(b) ? 'distillato' : ''
    ].join(' ').toLowerCase();
  }
  function lista() {
    var l = STATE.bottles.filter(matches);
    function cs(a, b) { return (a || '').localeCompare(b || '', 'it'); }
    var S = {
      'valore-desc': function (a, b) { return (num(b.valore_attuale) == null ? -Infinity : num(b.valore_attuale)) - (num(a.valore_attuale) == null ? -Infinity : num(a.valore_attuale)); },
      'aggiunta-desc': function (a, b) { return cs(b.aggiunta_il, a.aggiunta_il); },
      'nome-asc': function (a, b) { return cs(a.nome, b.nome); },
      'annata-desc': function (a, b) { return (parseInt(b.annata, 10) || -Infinity) - (parseInt(a.annata, 10) || -Infinity); },
      'annata-asc': function (a, b) { return (parseInt(a.annata, 10) || Infinity) - (parseInt(b.annata, 10) || Infinity); },
      'grad-desc': function (a, b) { return (num(b.gradazione) == null ? -Infinity : num(b.gradazione)) - (num(a.gradazione) == null ? -Infinity : num(a.gradazione)); },
      'prezzo-desc': function (a, b) { return (num(b.prezzo_acquisto) == null ? -Infinity : num(b.prezzo_acquisto)) - (num(a.prezzo_acquisto) == null ? -Infinity : num(a.prezzo_acquisto)); },
      'delta-desc': function (a, b) { return (delta(b) == null ? -Infinity : delta(b)) - (delta(a) == null ? -Infinity : delta(a)); },
      'momentum-desc': function (a, b) { return (momentum(b) == null ? -Infinity : momentum(b)) - (momentum(a) == null ? -Infinity : momentum(a)); },
      'quot-vecchia': function (a, b) { return (giorniDaQuot(b) == null ? -Infinity : giorniDaQuot(b)) - (giorniDaQuot(a) == null ? -Infinity : giorniDaQuot(a)); }
    };
    l.sort(function (a, b) {
      if (inCoda(a) !== inCoda(b)) return inCoda(a) ? -1 : 1;
      return (S[filters.sort] || S['nome-asc'])(a, b);
    });
    return l;
  }

  /* ======================= render ======================= */
  function render() {
    var root = document.getElementById('root');
    root.innerHTML = view();
    bind();
    firstPaint = false;
  }
  function view() {
    var cat = stanza === 'catalogo';
    var l = cat ? lista() : [];
    return (isReadOnly ? '<div class="ro">Sola lettura — questo link non può salvare modifiche</div>' : '') +
      '<div class="scrim' + (railOpen && cat && window.innerWidth <= 1000 ? ' on' : '') + '" data-shut></div>' +
      topbar() + mast() + '<div class="app">' + (cat ? rail() : '') +
      '<div class="main">' + (cat ? tools() : '') + '<div class="content">' +
      (cat ? stanzaCatalogo(l) : stanza === 'mercato' ? stanzaMercato() : stanza === 'club' ? stanzaClub() : stanza === 'desk' ? stanzaDesk() : stanzaPanoramica()) +
      '</div></div></div>' + sheets();
  }

  /* ============ le tre stanze ============
     Un archivio, un mercato e una panoramica sono tre mestieri diversi:
     tenerli nella stessa pagina obbligava a scorrere fra cose che non
     c'entrano. Da qui in poi sono tre stanze, e la barra in alto dice
     sempre in quale ti trovi. */
  var STANZE = [
    { k: 'catalogo',   n: '01', t: 'Catalogo' },
    { k: 'mercato',    n: '02', t: 'Mercato' },
    { k: 'panoramica', n: '03', t: 'Panoramica' },
    { k: 'club',       n: '04', t: 'Speakeasy' },
    { k: 'desk',       n: '05', t: 'Desk' }
  ];
  function topbar() {
    return '<nav class="nav"><div class="nav-in">' +
      '<span class="nav-br">' + MARCHIO + '<b>CAVEAU</b><span class="piano' + (clubAttivo() ? ' club' : '') + '">' + (clubAttivo() ? 'Club' : 'Cantina') + '</span></span>' +
      '<div class="nav-l">' + stanzeVisibili().map(function (z) {
        return '<button type="button" class="nvb' + (z.k === 'club' ? ' club' : '') + (stanza === z.k ? ' on' : '') + '" data-stanza="' + z.k + '"' +
          (stanza === z.k ? ' aria-current="page"' : '') + '><span class="nvn tab">' + z.n + '</span>' + z.t + '</button>';
      }).join('') + '</div>' +
      '<button type="button" class="nvb" data-lingua-switch title="Italiano / English">' + (window.CAVEAU_LINGUA === 'en' ? 'IT' : 'EN') + '</button>' +
      '<button type="button" class="nvb" id="sp-profilo-apri" title="Il mio profilo">Profilo</button>' +
      '<button type="button" class="nvb esci" id="esci" title="Chiudi la sessione">Esci</button>' +
      '</div></nav>';
  }
  function capitolo(z, frase) {
    return '<header class="cap"><div class="capn tab">' + z.n + '</div>' +
      '<div><h2>' + z.t + '</h2><p>' + frase + '</p></div></header>';
  }

  function stanzaCatalogo(l) {
    return capitolo(STANZE[0], 'Tutto quello che c\u2019\u00e8 in cantina, bottiglia per bottiglia \u2014 e dove sta.') +
      (filters.q ? '<p class="qres"><strong>' + l.length + '</strong> ' + (l.length === 1 ? 'bottiglia trovata' : 'bottiglie trovate') + ' per \u201c' + escHtml(filters.q) + '\u201d <button type="button" class="lnk" id="q-off2">annulla</button></p>' : '') +
      notaPosizione(l) + demoNote() + queueNote() + help() + body(l);
  }
  /* Con i filtri chiusi (sul telefono lo sono quasi sempre) bisogna vedere
     a colpo d'occhio che si sta guardando un solo scaffale. */
  function notaPosizione(l) {
    if (!filters.scaffale && !filters.zona) return notaPosQuery(l);
    var pezzi = l.reduce(function (n, b) { return n + qty(b); }, 0);
    var et = [filters.scaffale ? 'Scaffale <strong>' + escHtml(filters.scaffale) + '</strong>' : '',
              filters.zona ? escHtml(filters.zona) : ''].filter(Boolean).join(' · ');
    return '<p class="qres pos">' + et + ' — <strong>' + pezzi + '</strong> ' +
      (pezzi === 1 ? 'bottiglia' : 'bottiglie') +
      ' <button type="button" class="lnk" id="pos-off">mostra tutta la cantina</button></p>';
  }
  function stanzaMercato() {
    var l = STATE.bottles.filter(function (b) { return inCantina(b) && !inCoda(b); });
    return capitolo(STANZE[1], 'Cosa conviene fare oggi: cosa vendere, cosa bere, cosa tenere \u2014 e con quali numeri in mano.') +
      cruscotto() + azioni(l) + matriceBox(l) + valoreNelTempo();
  }
  /* La Panoramica e' l'inventario a colpo d'occhio: quante bottiglie, di che
     colore, da dove vengono, di che annate, quali sono le piu' preziose e
     dove stanno. Del mercato qui resta una riga sola: i consigli e gli
     andamenti hanno gia' la loro stanza. */
  function stanzaPanoramica() {
    var inC = STATE.bottles.filter(function (b) { return inCantina(b) && !inCoda(b); });
    if (!inC.length) return capitolo(STANZE[2], 'L\u2019inventario della cantina a colpo d\u2019occhio.') +
      '<div class="empty"><h2>Non c\u2019\u00e8 ancora niente da riassumere</h2><p>Appena le prime bottiglie saranno catalogate, qui comparir\u00e0 il quadro d\u2019insieme.</p></div>';
    return capitolo(STANZE[2], 'L\u2019inventario a colpo d\u2019occhio: quante bottiglie, di che colore, da dove vengono, di che annate \u2014 e quali sono le pi\u00f9 preziose.') +
      inventario(inC) + perColore(inC) + atlante(inC) + annate(inC) +
      vitigniTop(inC) + pregiate(inC) + perZona(inC) + formati(inC) + archivio();
  }

  /* Il marchio: la stessa bottiglietta di Caveau, disegnata come SVG
     cosi resta nitida a ogni dimensione e prende il colore dal contesto. */
  var MARCHIO = '<svg class="mk" viewBox="0 0 30 62" fill="none" aria-hidden="true">' +
    '<path d="M12 2.2h6v10.6c0 2.5 5 4.7 5 9.8v32.2a5.2 5.2 0 0 1-5.2 5.2h-5.6A5.2 5.2 0 0 1 7 54.8V22.6c0-5.1 5-7.3 5-9.8V2.2Z" ' +
    'stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"/>' +
    '<circle cx="15" cy="31.5" r="3.5" stroke="currentColor" stroke-width="2.1"/></svg>';

  function mast() {
    var inC = STATE.bottles.filter(inCantina);
    var pezzi = inC.reduce(function (s, b) { return s + qty(b); }, 0);
    var acq = inC.reduce(function (s, b) { return s + (num(b.prezzo_acquisto) || 0) * qty(b); }, 0);
    var val = inC.reduce(function (s, b) { return s + (vetrina(b) || 0) * qty(b); }, 0);
    var netP = inC.reduce(function (s, b) { return s + (nettoPriv(b) || 0) * qty(b); }, 0);
    var netA = inC.reduce(function (s, b) { return s + (nettoAsta(b) || 0) * qty(b); }, 0);
    var quot = inC.filter(function (b) { return vetrina(b) != null; }).length;
    var dT = (acq > 0 && quot > 0) ? ((netA - acq) / acq * 100) : null;
    var bev = STATE.bottles.filter(function (b) { return b.stato === 'bevuta'; }).length;
    var ven = STATE.bottles.filter(function (b) { return b.stato === 'venduta'; });
    var ric = ven.reduce(function (s, b) { return s + (num(b.prezzo_vendita) || 0); }, 0);
    var ACC = ['--vino', '--cremisi', '--ambra', '--lime', '--teal'];
    var ai = 0;
    function lc(n, c, extra) {
      var a = ACC[ai++ % ACC.length];
      return '<div class="lc" style="--ac:var(' + a + ')"><div class="n tab">' + n + (extra || '') + '</div><div class="c">' + c + '</div></div>';
    }
    return '<header class="mast st-' + stanza + '"><div class="mast-in">' +
      '<button class="rtog btn sm gho" id="rtog" type="button" style="margin-bottom:12px">☰ Filtri</button>' +
      '<div class="eb">Caveau · la tua cantina · solo tu</div>' +
      '<div class="brand">' + MARCHIO + '<h1>' + escHtml(STATE.meta.titolo) + '</h1></div>' +
      '<p class="sub">' + escHtml(STATE.meta.sottotitolo || '') + '</p>' +
      '<div class="cerca"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 21 21"/></svg>' +
      '<input type="search" id="f-q" placeholder="Cerca qualsiasi cosa: Nebbiolo, Islay, 2016, magnum, torbato, da verificare…" value="' + escHtml(filters.q) + '" aria-label="Cerca nell\u2019archivio">' +
      (filters.q ? '<button type="button" class="cx" id="q-off" aria-label="Svuota la ricerca">✕</button>' : '') +
      '</div>' +
      '<div class="lgrid">' +
      lc(pezzi, 'Bottiglie in cantina') +
      lc(fmtM(acq || null), 'Speso') +
      lc(fmtM(val || null), 'Prezzo di vetrina') +
      '<div class="lc due" style="--ac:var(--teal)"><div class="duen">' +
        '<div><div class="n tab">' + fmtM(netP || null) + '</div><div class="c">vendita privata</div></div>' +
        '<div><div class="n tab">' + fmtM(netA || null) + (dT != null ? '<span class="up ' + (dT >= 0 ? 'pos' : 'neg') + '">' + (dT >= 0 ? '+' : '') + dT.toFixed(0) + '%</span>' : '') + '</div><div class="c">asta, netta</div></div>' +
      '</div><div class="c" style="margin-top:9px">Quanto entrerebbe in tasca</div></div>' +
      lc(ven.length ? fmtM(ric) : bev, ven.length ? 'Incassato · ' + ven.length + (ven.length === 1 ? ' vendita' : ' vendite') : (bev === 1 ? 'Bevuta' : 'Bevute')) +
      '</div></div></header>';
  }

  // Composizione: quantità per tipologia. Una sola tinta (è magnitudo, non
  // identità), ogni riga etichettata a vista, nessuna legenda necessaria.
  function compo(inC) {
    var by = {};
    inC.forEach(function (b) { var t = b.tipologia || 'Da catalogare'; by[t] = (by[t] || 0) + qty(b); });
    var rows = Object.keys(by).map(function (k) { return { k: k, v: by[k] }; })
      .sort(function (a, b) { return b.v - a.v; }).slice(0, 6);
    if (!rows.length) return '';
    var max = rows[0].v, tot = rows.reduce(function (s, r) { return s + r.v; }, 0);
    return '<div class="compo"><h3>Composizione della cantina</h3>' +
      rows.map(function (r, i) {
        var pct = tot ? Math.round(r.v / tot * 100) : 0;
        return '<div class="crow" tabindex="0">' +
          '<div class="clab">' + escHtml(r.k) + '</div>' +
          '<div class="ctrack"><div class="cbar" style="width:' + Math.max(3, r.v / max * 100) + '%;animation-delay:' + (i * 50) + 'ms"></div></div>' +
          '<div class="cnum tab">' + r.v + '</div>' +
          '<div class="ctip">' + escHtml(r.k) + ' — ' + r.v + (r.v === 1 ? ' bottiglia' : ' bottiglie') + ' · ' + pct + '%</div>' +
          '</div>';
      }).join('') + '</div>';
  }

  /* Gli scaffali esistenti, con la zona a cui appartengono e quante
     bottiglie ci stanno: cosi' il menu' si legge senza dover ricordare. */
  function scaffaliEsistenti(zona) {
    var m = {};
    STATE.bottles.forEach(function (b) {
      var sc = (b.scaffale || '').trim();
      if (!sc) return;
      if (zona && zonaDi(b) !== zona) return;
      if (!m[sc]) m[sc] = { n: 0, zone: {} };
      m[sc].n += qty(b);
      m[sc].zone[zonaDi(b)] = true;
    });
    return Object.keys(m).sort(function (a, b) { return a.localeCompare(b, 'it', { numeric: true }); })
      .map(function (k) { return { sc: k, n: m[k].n, zone: Object.keys(m[k].zone) }; });
  }
  function zoneEsistenti() {
    var z = {};
    STATE.bottles.forEach(function (b) { if ((b.zona || '').trim()) z[b.zona.trim()] = true; });
    return Object.keys(z).sort(function (a, b) { return a.localeCompare(b, 'it'); });
  }
  function rail() {
    function chips(name, opts) {
      return '<div class="chips">' + opts.map(function (o) {
        return '<button type="button" class="chip' + (filters[name].indexOf(o) !== -1 ? ' on' : '') + '" data-chip="' + name + '" data-v="' + escHtml(o) + '">' + escHtml(o) + '</button>';
      }).join('') + '</div>';
    }
    function dl(id, vs) { return '<datalist id="' + id + '">' + vs.map(function (v) { return '<option value="' + escHtml(v) + '">'; }).join('') + '</datalist>'; }
    return '<aside class="rail' + (railOpen ? ' open' : '') + '" id="rail">' +
      '<div class="rhd"><h2>Filtri</h2><button class="rx btn sm gho" data-shut type="button" aria-label="Chiudi">✕</button></div>' +
      '<div class="rsec"><span class="flab">Ambito</span><select id="f-ambito">' +
      ['cantina|In cantina', 'tutte|Tutte, storico compreso', 'coda|Solo in coda', 'bevuta|Bevute', 'venduta|Vendute', 'regalata|Regalate'].map(function (o) {
        var p = o.split('|');
        return '<option value="' + p[0] + '"' + (filters.ambito === p[0] ? ' selected' : '') + '>' + p[1] + '</option>';
      }).join('') + '</select></div>' +
      '<div class="rsec"><span class="flab">' + (sezioni().length ? 'Sezione della cantina' : 'Zona della cantina') + '</span><select id="f-zona">' +
      '<option value="">' + (sezioni().length ? 'Tutte le sezioni' : 'Tutte le zone') + '</option>' +
      zoneTutte().map(function (z) { var sz = sezioneConNome(z); return '<option value="' + escHtml(z) + '"' + (filters.zona === z ? ' selected' : '') + '>' + escHtml(sz ? etichettaSez(sz) : (sezioni().length ? z + ' \u00b7 fuori mappa' : z)) + '</option>'; }).join('') +
      '</select></div>' +
      (function () {
        var sz = sezioneConNome(filters.zona), sc = scaffaliDiZona(filters.zona);
        if (!sc.length) return '';
        return '<div class="rsec"><span class="flab">Scaffale</span><select id="f-scaff">' +
          '<option value="">Tutti gli scaffali</option>' +
          sc.map(function (x) {
            var et = (sz ? 'Scaffale ' + x.sc : x.sc + (!filters.zona && x.zone.length === 1 ? ' \u00b7 ' + x.zone[0] : '')) + (x.n ? ' (' + x.n + ')' : (sz ? ' \u00b7 vuoto' : ''));
            return '<option value="' + escHtml(x.sc) + '"' + (filters.scaffale.toLowerCase() === x.sc.toLowerCase() ? ' selected' : '') + '>' + escHtml(et) + '</option>';
          }).join('') + '</select>' +
          '<p class="hint">' + (sezioni().length ? 'Oppure scrivilo nella ricerca in alto: \u201csezione 1 scaffale 8\u201d.' : 'Cerchi uno scaffale preciso? Scegli il codice qui, oppure scrivilo nella ricerca in alto.') + '</p></div>';
      })() +
      '<div class="rsec"><span class="flab">Tipologia</span>' + chips('tipi', TIPI) + '</div>' +
      '<div class="rsec"><span class="flab">Colore · vino e spumante</span>' + chips('colori', COLORI) + '</div>' +
      '<div class="rsec"><span class="flab">Annata</span><div class="duo"><input type="number" id="f-anmin" placeholder="da" value="' + escHtml(filters.annataMin) + '"><input type="number" id="f-anmax" placeholder="a" value="' + escHtml(filters.annataMax) + '"></div></div>' +
      '<div class="rsec"><span class="flab">Gradazione · % vol</span><div class="duo"><input type="number" step="0.1" id="f-grmin" placeholder="min" value="' + escHtml(filters.gradMin) + '"><input type="number" step="0.1" id="f-grmax" placeholder="max" value="' + escHtml(filters.gradMax) + '"></div></div>' +
      '<div class="rsec"><span class="flab">Prezzo</span><select id="f-pbase"><option value="attuale"' + (filters.prezzoBase === 'attuale' ? ' selected' : '') + '>Valore di mercato</option><option value="acquisto"' + (filters.prezzoBase === 'acquisto' ? ' selected' : '') + '>Prezzo pagato</option></select>' +
      '<div class="duo" style="margin-top:6px"><input type="number" id="f-pmin" placeholder="min €" value="' + escHtml(filters.prezzoMin) + '"><input type="number" id="f-pmax" placeholder="max €" value="' + escHtml(filters.prezzoMax) + '"></div>' +
      '<label class="chk"><input type="checkbox" id="f-plus"' + (filters.soloPlus ? ' checked' : '') + '> Solo in plusvalenza</label></div>' +
      '<div class="rsec"><span class="flab">Cantina / distilleria</span><input type="text" list="dl-can" id="f-can" placeholder="cerca…" value="' + escHtml(filters.cantina) + '">' + dl('dl-can', uniq('cantina')) + '</div>' +
      '<div class="rsec"><span class="flab">Produttore</span><input type="text" list="dl-pro" id="f-pro" placeholder="cerca…" value="' + escHtml(filters.produttore) + '">' + dl('dl-pro', uniq('produttore')) + '</div>' +
      '<div class="rsec"><span class="flab">Provenienza</span><input type="text" list="dl-prv" id="f-prv" placeholder="cerca…" value="' + escHtml(filters.provenienza) + '">' + dl('dl-prv', uniq('provenienza')) + '</div>' +
      '<div class="rsec"><span class="flab">Vitigno</span><input type="text" list="dl-vit" id="f-vit" placeholder="es. Nebbiolo" value="' + escHtml(filters.vitigno) + '">' + dl('dl-vit', uniq('vitigni', true)) +
      '<div style="margin-top:15px"><button class="lnk" id="reset" type="button">Azzera tutti i filtri</button></div></div>' +
      '<div class="rsec"><span class="flab">Quanto resta vendendo</span>' +
      '<div class="duo"><label style="width:100%"><span class="qlab">privata %</span><input type="number" min="0" max="100" id="f-rpriv" value="' + Math.round(resaPriv() * 100) + '"></label>' +
      '<label style="width:100%"><span class="qlab">asta %</span><input type="number" min="0" max="100" id="f-rasta" value="' + Math.round(resaAsta() * 100) + '"></label></div>' +
      '<p class="hint">Percentuale del prezzo di vetrina che entra davvero in tasca. Un privato non paga il prezzo di negozio; l’asta trattiene commissioni.</p>' +
      '<label style="display:block;margin-top:13px"><span class="qlab">non vendere sotto €</span>' +
      '<input type="number" min="0" step="1" id="f-soglia" value="' + Math.round(sogliaVendita()) + '"></label>' +
      '<p class="hint">Sotto questa cifra netta il consiglio <em>vendi</em> diventa <em>bevi</em>: trovare il compratore, imballare e spedire costa più di quanto la bottiglia rende.</p></div>' +
      '</aside>';
  }

  function tools() {
    return '<div class="tools">' +
      (isReadOnly ? '' : '<button class="btn pri wide" id="shoot" type="button">Fotografa una bottiglia</button><button class="btn" id="bulkbtn" type="button">Più foto</button>') +
      '<select id="f-sort" class="search" style="min-width:170px">' +
      [['valore-desc', 'Valore più alto'], ['aggiunta-desc', 'Aggiunte di recente'], ['nome-asc', 'Nome A-Z'],
       ['annata-desc', 'Annata recente'], ['annata-asc', 'Annata vecchia'], ['grad-desc', 'Gradazione ↓'],
       ['prezzo-desc', 'Prezzo pagato ↓'], ['delta-desc', 'Plusvalenza ↓'],
       ['momentum-desc', 'Crescita di mercato ↓'], ['quot-vecchia', 'Quotazione più vecchia']].map(function (o) {
        return '<option value="' + o[0] + '"' + (filters.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select>' +
      '<div class="seg">' + [['grid', 'Griglia fitta'], ['dossier', 'Schede'], ['posizione', 'Posizione'], ['table', 'Tabella']].map(function (v) {
        return '<button type="button" data-view="' + v[0] + '" class="' + (filters.view === v[0] ? 'on' : '') + '">' + v[1] + '</button>';
      }).join('') + '</div>' +
      '<button class="btn gho sm" id="export" type="button">CSV</button>' +
      (isReadOnly ? '' : '<button class="btn gho sm" id="manual" type="button">Manuale</button><button class="btn gho sm" type="button" data-mappa-open title="Sezioni, scaffali e ripiani della tua cantina">Mappa</button>') +
      '</div>' + rapidoHtml();
  }

  function demoNote() {
    var n = esempi().length;
    if (!n) return '';
    return '<div class="note demo"><div class="nb">' +
      '<h3>Le ' + n + ' bottiglie qui sotto sono esempi</h3>' +
      '<p>Servono a mostrarti l’archivio pieno e navigabile: prova i filtri, apri una scheda, guarda com’è fatta una bottiglia bevuta e una venduta. Non sono bottiglie tue e i valori di mercato sono verosimili ma inventati. Ogni scheda porta la dicitura <strong>esempio</strong>. Spariscono con un clic, appena arrivano le prime foto vere.</p>' +
      '</div>' + (isReadOnly ? '' : '<button class="btn dgr" id="rmdemo" type="button">Rimuovi gli esempi</button>') + '</div>';
  }
  /* Leggere le etichette è l'unica cosa che l'app non fa da sola: la chiave
     del modello sta sul server e lì resta. Si procede una bottiglia alla volta,
     in fila, perché due letture insieme non arrivano prima e un errore a metà
     lascerebbe la coda in uno stato che nessuno saprebbe spiegare. */
  function catalogaCoda() {
    if (!window.CELL) { toast('Il motore non è raggiungibile da qui'); return; }
    var coda = STATE.bottles.filter(inCoda);
    if (!coda.length) return;
    var btn = document.getElementById('cataloga');
    function scrivi(t) { if (btn) { btn.disabled = true; btn.textContent = t; } }
    var fatte = 0, falliti = [];
    scrivi('Leggo 1 di ' + coda.length + '…');
    coda.reduce(function (c, b, i) {
      return c.then(function () {
        scrivi('Leggo ' + (i + 1) + ' di ' + coda.length + '…');
        return CELL.cataloga(b.id)
          .then(function () { fatte++; })
          .catch(function (e) { falliti.push((e && e.message) || 'errore'); });
      });
    }, Promise.resolve()).then(function () {
      return CELL.carica();
    }).then(function (nuovo) {
      idrata(nuovo); render();
      if (fatte && !falliti.length) toast(fatte === 1 ? 'Etichetta letta' : fatte + ' etichette lette');
      else if (fatte) toast(fatte + ' lette, ' + falliti.length + ' no: ' + falliti[0]);
      else toast('Nessuna lettura riuscita: ' + (falliti[0] || 'riprova'));
    }).catch(function (e) {
      render();
      toast((e && e.message) || 'Lettura non riuscita');
    });
  }

  function queueNote() {
    var p = STATE.bottles.filter(inCoda);
    if (!p.length) return '';
    var mb = codaBytes() / 1048576, heavy = mb > SOGLIA_CODA_MB;
    return '<div class="note queue' + (heavy ? ' warn' : '') + '"><div class="big tab">' + p.length + '</div><div class="nb">' +
      '<h3>' + (p.length === 1 ? 'Una bottiglia aspetta di essere catalogata' : p.length + ' bottiglie aspettano di essere catalogate') + '</h3>' +
      '<p>Le foto sono al sicuro. Il lettore di etichette compila nome, cantina, produttore, annata, vitigni, gradazione, colore, provenienza e tipologia. Quello che deduce invece di leggere resta marcato <em>da verificare</em>.</p>' +
      (isReadOnly ? '' : '<button class="btn pri" id="cataloga" type="button">Leggi le etichette' + (p.length > 1 ? ' · ' + p.length + ' bottiglie' : '') + '</button>') +
      (heavy ? '<p style="margin-top:10px;color:var(--neg)"><strong>La coda pesa ' + mb.toFixed(1) + ' MB.</strong> Falla smaltire prima di aggiungere altre foto.</p>' : '') +
      '</div></div>';
  }
  function help() {
    return '<details class="help"><summary>Come si usa</summary><ol>' +
      '<li><strong>In cantina, dal telefono.</strong> Max apre il link, tocca <em>Fotografa una bottiglia</em>, scatta fronte e retro, salva. Non scrive niente: né nome, né annata, né cantina.</li>' +
      '<li><strong>Uno scaffale intero.</strong> <em>Più foto</em> accetta decine di scatti insieme e li accoppia fronte/retro nell’ordine in cui sono stati fatti.</li>' +
      '<li><strong>La catalogazione.</strong> Dal riquadro della coda, <em>Leggi le etichette</em> riempie ogni campo da solo. Ciò che viene dedotto invece che letto resta marcato <em>da verificare</em>: lo correggi in due secondi e la tua correzione non viene più toccata.</li>' +
      '<li><strong>Quando una bottiglia esce.</strong> Aprila e segnala <em>bevuta</em> o <em>venduta</em> (col prezzo incassato): esce dal conteggio della cantina ma resta nello storico. Oppure eliminala del tutto.</li>' +
      '<li><strong>Le quotazioni.</strong> Si aggiornano da sole ogni settimana: il controllo guarda quali bottiglie hanno un valore vecchio e rifà solo quelle. Sotto ogni cifra c’è sempre la data e la fonte: se è vecchia, si vede.</li>' +
      '</ol></details>';
  }

  function body(l) {
    if (!STATE.bottles.length) {
      return '<div class="empty"><h2>L’archivio è vuoto</h2><p>Il modo più veloce per riempirlo: fotografare fronte e retro di una bottiglia. Al nome, all’annata, ai vitigni e alla gradazione pensa l’archivio.</p>' +
        (isReadOnly ? '' : '<button class="btn pri" id="shoot-empty" type="button">Fotografa la prima bottiglia</button>') + '</div>';
    }
    if (!l.length) return '<div class="empty"><h2>' + (filters.q ? 'Nessun risultato per “' + escHtml(filters.q) + '”' : 'Nessuna bottiglia con questi filtri') + '</h2><p>' + (filters.q ? 'La ricerca guarda in tutti i campi: nome, produttore, zona, vitigno, annata, note, perfino la fonte della quotazione. Prova con una parola sola.' : 'Prova ad allargare l’ambito o ad azzerarne qualcuno.') + '</p><button class="btn" id="reset2" type="button">Azzera tutto</button></div>';
    if (filters.view === 'dossier') return dossierView(l);
    if (filters.view === 'posizione') return posizioneView(l);
    return filters.view === 'table' ? tableView(l) : gridView(l);
  }

  function stampOf(b) {
    if (inCoda(b)) return '<span class="stamp">in coda</span>';
    if (b.stato === 'bevuta') return '<span class="stamp">bevuta' + (b.bevuta_il ? ' · ' + fmtD(b.bevuta_il) : '') + '</span>';
    if (b.stato === 'venduta') return '<span class="stamp">venduta' + (b.prezzo_vendita != null ? ' · ' + fmtM(b.prezzo_vendita) : '') + '</span>';
    if (b.stato === 'regalata') return '<span class="stamp">regalata' + (b.regalata_a ? ' · ' + escHtml(b.regalata_a) : '') + '</span>';
    return '';
  }

  function gridView(l) {
    return '<div class="grid">' + l.map(function (b, i) {
      var d = momentum(b), coda = inCoda(b);
      return '<article class="card' + (coda ? ' coda' : '') + (uscita(b) ? ' gone' : '') + (firstPaint ? ' fade' : '') + '" role="button" tabindex="0" data-open="' + b.id + '" style="' + blkVars(b) + (firstPaint ? ';animation-delay:' + Math.min(i * 28, 400) + 'ms' : '') + '">' +
        '<div class="vit">' + art(b) + stampOf(b) + (b.esempio ? '<span class="stamp dem">esempio</span>' : '') + '</div>' +
        '<div class="bd">' +
        (coda
          ? statoLettura(b) + bottoneFoto(b) + azioniCoda(b)
          : '<div class="mt">' + tagLiquido(b) + badge(b) + tagAnnuncio(b) + '</div>' +
            '<div class="can"><span>' + escHtml(b.produttore || b.cantina || '\u2014') + '</span></div>' +
            '<div class="nm">' + escHtml(b.nome || 'Senza nome') + '</div>' +
            '<div class="mk">' + annataChip(b) +
            '<span>' + escHtml(b.tipologia || 'Altro') + (b.gradazione ? ' \u00b7 ' + escHtml(grad(b)) + '%' : '') +
            (qty(b) > 1 ? ' \u00b7 ' + qty(b) + ' bt' : '') + '</span></div>' + bottoneFoto(b)) +
        '<div class="ft"><span class="vl tab">' + fmtM(vetrina(b)) + '</span>' + spark(b) +
        (d != null ? '<span class="dl tab ' + (d > 0 ? 'pos' : d < 0 ? 'neg' : 'flat') + '">' + (d >= 0 ? '+' : '') + d.toFixed(0) + '%/anno</span>' : '<span class="dl flat">—</span>') +
        '</div></div></article>';
    }).join('') + '</div>';
  }

  /* La targhetta dell'annata: e' la prima cosa che si cerca sfogliando. */
  function annataChip(b) {
    var e = eta(b);
    if (!e) return '';
    return '<span class="anx tab"' + (e.tip ? ' title="' + escHtml(e.tip) + '"' : '') + '>' + e.big +
      (e.lab === 'anni' ? '<i>anni</i>' : '') + '</span>';
  }

  /* ============ vista DOSSIER ============
     La stessa bottiglia letta invece che sfogliata: il consiglio in alto,
     il perche' in una riga, i dati in griglia, i tre livelli di prezzo. */
  function dossierView(l) {
    return '<div class="dossiers">' + l.map(function (b) { return dossier(b); }).join('') + '</div>';
  }
  function dossier(b) {
    var coda = inCoda(b), sg = segnale(b), m = momentum(b), e = eta(b);
    var cella = function (k, v) {
      return '<div class="d-cell"><div class="d-k">' + k + '</div><div class="d-v">' + (v ? escHtml(v) : '—') + '</div></div>';
    };
    return '<article class="dossier' + (uscita(b) ? ' gone' : '') + '" style="' + blkVars(b) + '">' +
      '<div class="d-top"><span class="d-icon">' + bottleSVG(b) + '</span>' +
        tagLiquido(b) +
        '<span class="d-kind">' + (coda ? 'da catalogare' : escHtml(b.tipologia || 'Altro') + (b.gradazione ? ' · ' + escHtml(grad(b)) + '%' : '')) + '</span>' +
        (sg ? badge(b) : '') +
        '<span class="d-qty">' + qty(b) + ' bt</span></div>' +

      '<div class="d-name"><div class="who">' +
        '<div class="d-maker"><span>' + escHtml(b.produttore || b.cantina || '—') + '</span></div>' +
        '<h3 class="d-title">' + (coda ? 'Da catalogare' : escHtml(b.nome || 'Senza nome')) + '</h3></div>' +
        (e ? '<div class="d-year tab"' + (e.tip ? ' title="' + escHtml(e.tip) + '"' : '') + '>' + e.big + '<small>' + e.lab + '</small></div>' : '') +
      '</div>' +

      (sg ? '<p class="d-why">' + escHtml(perche(b)) + '</p>' : '') +

      '<div class="d-grid">' +
        cella('Origine', b.provenienza) + cella('Vitigni', (b.vitigni || []).join(', ')) +
        cella('Posizione', posizione(b)) + cella('Finestra di bevuta', b.annata_migliore) +
      '</div>' +

      '<div class="d-val"><div class="d-k">Prezzo di vetrina</div>' +
        '<div class="d-valtop"><span class="d-big tab">' + fmtM(vetrina(b)) + '</span>' +
        '<span class="d-trend">' + spark(b) +
        (m != null ? '<span class="dl tab ' + (m > 0 ? 'pos' : m < 0 ? 'neg' : 'flat') + '">' + (m >= 0 ? '+' : '') + m.toFixed(0) + '%/anno</span>' : '') +
        '</span></div>' +
        '<div class="d-net"><div>netto · vendita privata<b class="tab">' + fmtM(nettoPriv(b)) + '</b></div>' +
        '<div>netto · asta<b class="tab">' + fmtM(nettoAsta(b)) + '</b></div></div></div>' +

      '<div class="d-acts"><button type="button" class="d-act" data-open="' + b.id + '">Apri la scheda' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M7 17 17 7M9 7h8v8"/></svg></button>' +
        (haFoto(b) ? bottoneFoto(b, 'Guarda le foto') : '<span class="d-act off">Nessuna foto</span>') + '</div>' +

      '<div class="d-state"><span class="k">Stato</span><span class="v">' + escHtml(STATI[b.stato] || '—') +
        (b.esempio ? ' · esempio' : '') + (annuncioDiBottiglia(b.id) ? ' · In bacheca' : '') + '</span></div>' +
      '</article>';
  }

  /* ============ vista PER POSIZIONE ============
     Come si guarda una cantina vera: zona per zona, scaffale per scaffale. */
  function posizioneViewLibera(l) {
    var zone = {};
    l.forEach(function (b) {
      var z = zonaDi(b), sc = scaffaleDi(b);
      if (!zone[z]) zone[z] = {};
      (zone[z][sc] = zone[z][sc] || []).push(b);
    });
    var nomi = Object.keys(zone).sort(function (a, b) {
      if (a === 'Senza posizione') return 1;
      if (b === 'Senza posizione') return -1;
      return a.localeCompare(b, 'it');
    });
    return nomi.map(function (z) {
      var scaffali = Object.keys(zone[z]).sort(function (a, b) { return a.localeCompare(b, 'it'); });
      var tutte = scaffali.reduce(function (acc, sc) { return acc.concat(zone[z][sc]); }, []);
      var pezzi = tutte.reduce(function (n, b) { return n + qty(b); }, 0);
      var val = tutte.reduce(function (n, b) { return n + (vetrina(b) || 0) * qty(b); }, 0);
      return '<section class="zsec"><header class="zhd"><h3>' + escHtml(z) + '</h3>' +
        '<span class="zmeta tab">' + pezzi + (pezzi === 1 ? ' bottiglia' : ' bottiglie') + (val ? ' · ' + fmtM(val) + ' di vetrina' : '') + '</span></header>' +
        scaffali.map(function (sc) {
          var bs = zone[z][sc].slice().sort(function (a, b) {
            return String(a.ripiano || '').localeCompare(String(b.ripiano || ''), 'it') || (a.nome || '').localeCompare(b.nome || '', 'it');
          });
          var solo = filters.scaffale.toLowerCase() === sc.toLowerCase();
          return '<div class="scf"><div class="scf-h"><span class="scf-n">' + escHtml(sc) + '</span>' +
            (sc !== '\u2014' ? '<button type="button" class="scf-b' + (solo ? ' on' : '') + '" data-scaff="' + escHtml(sc) + '" data-zona="' + escHtml(z) + '">' +
              (solo ? 'mostra tutto' : 'solo questo scaffale') + '</button>' : '') +
            '<span class="scf-c tab">' + bs.length + '</span></div>' +
            '<div class="scf-l">' + bs.map(function (b) {
              return '<button type="button" class="prow" data-open="' + b.id + '" style="' + blkVars(b) + '">' +
                '<span class="prip tab">' + (b.ripiano ? 'rip. ' + escHtml(b.ripiano) : '—') + '</span>' +
                '<span class="pnm">' + escHtml(inCoda(b) ? 'Da catalogare' : (b.nome || 'Senza nome')) + '</span>' +
                '<span class="pmk">' + escHtml(b.produttore || b.cantina || '') + (etaTesto(b) ? ' · ' + etaTesto(b) : '') + '</span>' +
                (qty(b) > 1 ? '<span class="pq tab">' + qty(b) + ' bt</span>' : '') +
                '<span class="pv tab">' + fmtM(vetrina(b)) + '</span></button>';
            }).join('') + '</div></div>';
        }).join('') + '</section>';
    }).join('');
  }

  /* ============ MERCATO: le azioni, in ordine di valore ============ */
  function azioni(l) {
    var sel = filters.segnale;
    var gruppi = ORD_SEGNALI.filter(function (k) { return !sel || sel === k; }).map(function (k) {
      var bs = l.filter(function (b) { return segnale(b) === k; })
        .sort(function (x, y) { return (nettoAsta(y) || 0) * qty(y) - (nettoAsta(x) || 0) * qty(x); });
      if (!bs.length) return '';
      var tot = bs.reduce(function (n, b) { return n + (nettoAsta(b) || 0) * qty(b); }, 0);
      return '<section class="asec" style="--ac:var(--' + SEGNALI[k].col + ')">' +
        '<header class="ahd"><h3>' + SEGNALI[k].et + '</h3>' +
        '<span class="ameta tab">' + bs.length + (bs.length === 1 ? ' bottiglia' : ' bottiglie') + (tot ? ' · ' + fmtM(tot) + ' netti d’asta' : '') + '</span></header>' +
        '<p class="anote">' + SPIEGA[k] + '</p>' +
        '<div class="arows">' + bs.map(function (b) {
          var m = momentum(b);
          return '<button type="button" class="arow" data-open="' + b.id + '" style="' + blkVars(b) + '">' +
            '<span class="aic">' + bottleSVG(b) + '</span>' +
            '<span class="atxt"><span class="anm">' + escHtml(b.nome || 'Senza nome') + '</span>' +
            '<span class="amk">' + escHtml(b.produttore || b.cantina || '') + (etaTesto(b) ? ' · ' + etaTesto(b) : '') +
            (qty(b) > 1 ? ' · ' + qty(b) + ' bt' : '') + '</span>' +
            '<span class="awhy">' + escHtml(perche(b)) + '</span></span>' +
            '<span class="aval"><span class="av1 tab">' + fmtM(nettoAsta(b)) + '</span>' +
            '<span class="av2">netto d’asta' + (qty(b) > 1 ? ' · ' + fmtM((nettoAsta(b) || 0) * qty(b)) + ' in tutto' : '') + '</span>' +
            (m != null ? '<span class="dl tab ' + (m > 0 ? 'pos' : m < 0 ? 'neg' : 'flat') + '">' + (m >= 0 ? '+' : '') + m.toFixed(0) + '%/anno</span>' : '') +
            '</span></button>';
        }).join('') + '</div></section>';
    }).join('');
    return gruppi || '<div class="empty"><h2>Nessuna bottiglia con questo consiglio</h2><p>Togli la selezione qui sopra per vedere tutte le altre.</p></div>';
  }
  function matriceBox(l) {
    var sel = filters.segnale;
    var f = sel ? l.filter(function (b) { return segnale(b) === sel; }) : l;
    return '<section class="blk"><header class="blkh"><h3>La matrice</h3>' +
      '<p>Due assi soltanto: quanto tempo resta prima che la finestra di bevuta si chiuda, e come si sta muovendo il mercato. La posizione è il consiglio; la grandezza del punto dice quanto vale quella riga in cantina.</p></header>' +
      matrice(f) + '</section>';
  }

  /* ============ PANORAMICA: il valore della cantina nel tempo ============
     Ogni rilevazione e' un punto datato. Sommando, a ogni data, l'ultimo
     valore noto di ogni bottiglia si ottiene quanto valeva la cantina
     allora. La linea tratteggiata e' quanto e' stato speso: sopra o sotto
     quella riga si legge tutto. */
  function valoreNelTempo() {
    var inC = STATE.bottles.filter(function (b) { return inCantina(b) && !inCoda(b); });
    var date = {};
    inC.forEach(function (b) { serie(b).forEach(function (pt) { date[pt.data] = true; }); });
    var dd = Object.keys(date).sort();
    if (dd.length < 2) return '';
    var speso = inC.reduce(function (n, b) { return n + (num(b.prezzo_acquisto) || 0) * qty(b); }, 0);
    var pts = dd.map(function (d) {
      var vet = 0, net = 0;
      inC.forEach(function (b) {
        var s = serie(b), ult = null;
        for (var i = 0; i < s.length; i++) { if (s[i].data <= d) ult = s[i]; }
        if (ult) { vet += num(ult.vetrina) * qty(b); net += num(ult.vetrina) * resaAsta() * qty(b); }
      });
      return { d: d, v: vet, n: net };
    });
    var W = 760, H = 260, L = 62, R = 18, T = 18, Bo = 34;
    var vals = pts.map(function (p) { return p.v; }).concat(pts.map(function (p) { return p.n; })).concat([speso]);
    var mx = Math.max.apply(null, vals), mn = Math.min.apply(null, vals.concat([0]));
    var top = mx * 1.08, bot = Math.max(0, mn * 0.92);
    function X(i) { return L + (pts.length === 1 ? 0 : i / (pts.length - 1)) * (W - L - R); }
    function Y(v) { return T + (1 - (v - bot) / ((top - bot) || 1)) * (H - T - Bo); }
    function linea(key) { return pts.map(function (p, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(p[key]).toFixed(1); }).join(' '); }
    var area = linea('v') + ' L' + X(pts.length - 1).toFixed(1) + ',' + Y(bot).toFixed(1) + ' L' + X(0).toFixed(1) + ',' + Y(bot).toFixed(1) + ' Z';
    var tick = [bot, bot + (top - bot) / 2, top];
    var ultimo = pts[pts.length - 1];
    return '<section class="blk"><header class="blkh"><h3>Quanto vale la cantina, nel tempo</h3>' +
      '<p>Ogni punto è una rilevazione datata. La linea piena è il prezzo di vetrina, quella sotto il netto d’asta, la tratteggiata quanto è stato speso.</p></header>' +
      '<div class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Valore della cantina nel tempo">' +
      '<defs><linearGradient id="vgrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="var(--bronzo)" stop-opacity=".32"/><stop offset="100%" stop-color="var(--bronzo)" stop-opacity="0"/></linearGradient></defs>' +
      tick.map(function (t) {
        return '<line x1="' + L + '" y1="' + Y(t).toFixed(1) + '" x2="' + (W - R) + '" y2="' + Y(t).toFixed(1) + '" stroke="var(--ed)" stroke-width="1"/>' +
          '<text class="axl" x="' + (L - 10) + '" y="' + (Y(t) + 3.5).toFixed(1) + '" text-anchor="end">' + fmtM(Math.round(t)) + '</text>';
      }).join('') +
      '<path d="' + area + '" fill="url(#vgrad)"/>' +
      '<path d="' + linea('v') + '" fill="none" stroke="var(--bronzo)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<path d="' + linea('n') + '" fill="none" stroke="var(--teal)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>' +
      (speso ? '<line x1="' + L + '" y1="' + Y(speso).toFixed(1) + '" x2="' + (W - R) + '" y2="' + Y(speso).toFixed(1) + '" stroke="var(--t3)" stroke-width="1.4" stroke-dasharray="5 4"/>' +
        '<text class="axl" x="' + (W - R - 4) + '" y="' + (Y(speso) - 8).toFixed(1) + '" text-anchor="end">speso ' + fmtM(speso) + '</text>' : '') +
      pts.map(function (p, i) { return '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="3.4" fill="var(--bronzo)"/>'; }).join('') +
      pts.map(function (p, i) {
        return '<text class="axl" x="' + X(i).toFixed(1) + '" y="' + (H - 12) + '" text-anchor="' + (i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle') + '">' + fmtD(p.d) + '</text>';
      }).join('') +
      '</svg></div>' +
      '<div class="lgn"><span class="lg"><i style="background:var(--bronzo)"></i>prezzo di vetrina · ' + fmtM(Math.round(ultimo.v)) + '</span>' +
      '<span class="lg"><i style="background:var(--teal)"></i>netto d’asta · ' + fmtM(Math.round(ultimo.n)) + '</span>' +
      (speso ? '<span class="lg"><i class="lgd"></i>speso · ' + fmtM(speso) + '</span>' : '') + '</div></section>';
  }

  /* ============ PANORAMICA — l'inventario ============ */
  function area(b) {
    var pv = (b.provenienza || '').trim();
    if (!pv) return 'Provenienza da precisare';
    var parti = pv.split(',');
    return parti[parti.length - 1].trim() || pv;
  }
  function luogo(b) {
    var pv = (b.provenienza || '').trim(), parti = pv.split(',');
    return parti.length > 1 ? parti.slice(0, -1).join(',').trim() : '';
  }
  function anno(b) {
    var n = parseInt(b.annata, 10);
    return (n && n > 1800 && n < 2200) ? n : null;
  }
  function scheggia(n, l, sub) {
    return '<div class="invc"><div class="invn tab">' + n + '</div><div class="invl">' + l + '</div>' +
      (sub ? '<div class="invs">' + sub + '</div>' : '') + '</div>';
  }

  function inventario(inC) {
    var pezzi = inC.reduce(function (n, b) { return n + qty(b); }, 0);
    var aree = {}; inC.forEach(function (b) { aree[area(b)] = true; });
    var byAnno = {};
    inC.forEach(function (b) { var a = anno(b); if (a) byAnno[a] = (byAnno[a] || 0) + qty(b); });
    var anni = Object.keys(byAnno).map(Number).sort(function (x, y) { return x - y; });
    var top = anni.slice().sort(function (x, y) { return byAnno[y] - byAnno[x] || y - x; })[0];
    var vecchia = anni.length ? inC.filter(function (b) { return anno(b) === anni[0]; })[0] : null;
    var val = inC.reduce(function (n, b) { return n + (vetrina(b) || 0) * qty(b); }, 0);
    var net = inC.reduce(function (n, b) { return n + (nettoAsta(b) || 0) * qty(b); }, 0);
    var senzAnno = inC.filter(function (b) { return !anno(b); }).reduce(function (n, b) { return n + qty(b); }, 0);
    return '<section class="blk"><div class="invg">' +
      scheggia(pezzi, 'Bottiglie in cantina', inC.length + (inC.length === 1 ? ' etichetta diversa' : ' etichette diverse')) +
      scheggia(Object.keys(aree).length, 'Aree di provenienza', 'da ' + Object.keys(aree).slice(0, 3).join(', ') + (Object.keys(aree).length > 3 ? '…' : '')) +
      (top ? scheggia(top, 'L’annata più presente', byAnno[top] + (byAnno[top] === 1 ? ' bottiglia' : ' bottiglie')) : '') +
      (vecchia ? scheggia(anni[0], 'La più vecchia', escHtml(vecchia.nome || '')) : '') +
      (senzAnno ? scheggia(senzAnno, 'Senza annata', 'distillati e NAS') : '') +
      (val ? scheggia(fmtM(val), 'Prezzo di vetrina', 'netto d’asta ' + fmtM(net)) : '') +
      '</div></section>';
  }

  /* Quanti rossi, quanti bianchi, quanti distillati. Qui il colore non
     decora: e' esattamente la categoria di cui si sta contando. */
  function perColore(inC) {
    var by = {};
    inC.forEach(function (b) { var k = liquido(b); by[k] = (by[k] || 0) + qty(b); });
    var rows = Object.keys(by).map(function (k) { return { k: k, v: by[k] }; })
      .sort(function (a, b) { return b.v - a.v; });
    if (!rows.length) return '';
    var max = rows[0].v, tot = rows.reduce(function (n, r) { return n + r.v; }, 0);
    return '<section class="blk"><header class="blkh"><h3>Di che cosa è fatta</h3>' +
      '<p>Le bottiglie divise per quello che hanno dentro.</p></header>' +
      '<div class="compo bare">' + rows.map(function (r, i) {
        var h = LIQ[r.k].hex, pct = tot ? Math.round(r.v / tot * 100) : 0;
        return '<div class="crow" style="--ac:' + h + '"><div class="clab">' + LIQ[r.k].et + '</div>' +
          '<div class="ctrack"><div class="cbar liq" style="width:' + Math.max(3, r.v / max * 100) + '%;background:' + h + ';animation-delay:' + (i * 50) + 'ms"></div></div>' +
          '<div class="cnum tab">' + r.v + '</div>' +
          '<div class="ctip">' + LIQ[r.k].et + ' — ' + r.v + (r.v === 1 ? ' bottiglia' : ' bottiglie') + ' · ' + pct + '%</div></div>';
      }).join('') + '</div>' + tipiChips(inC) + '</section>';
  }
  /* e, sotto, la stessa cantina divisa per tipologia */
  function tipiChips(inC) {
    var by = {};
    inC.forEach(function (b) { var t = b.tipologia || 'Da catalogare'; by[t] = (by[t] || 0) + qty(b); });
    var rows = Object.keys(by).map(function (k) { return { k: k, v: by[k] }; }).sort(function (a, b) { return b.v - a.v; });
    if (rows.length < 2) return '';
    return '<div class="vch" style="margin-top:15px">' + rows.map(function (r) {
      return '<span class="vc">' + escHtml(r.k) + '<b class="tab">' + r.v + '</b></span>';
    }).join('') + '</div>';
  }

  /* L'atlante: da dove viene la cantina. */
  function atlante(inC) {
    var by = {};
    inC.forEach(function (b) {
      var a = area(b);
      if (!by[a]) by[a] = { n: 0, luoghi: {} };
      by[a].n += qty(b);
      var l = luogo(b); if (l) by[a].luoghi[l] = (by[a].luoghi[l] || 0) + qty(b);
    });
    var rows = Object.keys(by).map(function (k) { return { k: k, v: by[k].n, l: by[k].luoghi }; })
      .sort(function (a, b) { return b.v - a.v || a.k.localeCompare(b.k, 'it'); });
    if (!rows.length) return '';
    var max = rows[0].v;
    return '<section class="blk"><header class="blkh"><h3>Da dove viene</h3>' +
      '<p>Le aree di provenienza, e dentro ciascuna i luoghi precisi che compaiono in etichetta.</p></header>' +
      '<div class="atl">' + rows.map(function (r) {
        var lu = Object.keys(r.l).sort(function (a, b) { return r.l[b] - r.l[a]; });
        return '<div class="atr"><div class="atk">' + escHtml(r.k) + '</div>' +
          '<div class="atb"><span style="width:' + Math.max(4, r.v / max * 100) + '%"></span></div>' +
          '<div class="atn tab">' + r.v + '</div>' +
          '<div class="atl2">' + (lu.length ? lu.map(function (x) { return escHtml(x) + (r.l[x] > 1 ? ' (' + r.l[x] + ')' : ''); }).join(' · ') : '—') + '</div></div>';
      }).join('') + '</div></section>';
  }

  /* Le annate presenti in cantina. */
  function annate(inC) {
    var by = {};
    inC.forEach(function (b) { var a = anno(b); if (a) by[a] = (by[a] || 0) + qty(b); });
    var anni = Object.keys(by).map(Number).sort(function (x, y) { return x - y; });
    if (!anni.length) return '';
    var span = anni[anni.length - 1] - anni[0];
    var perDecennio = span > 26;
    var col = {};
    if (perDecennio) {
      anni.forEach(function (a) { var d = Math.floor(a / 10) * 10; col[d] = (col[d] || 0) + by[a]; });
    } else { col = by; }
    var chiavi = Object.keys(col).map(Number).sort(function (x, y) { return x - y; });
    var max = Math.max.apply(null, chiavi.map(function (k) { return col[k]; }));
    var topAnno = anni.slice().sort(function (x, y) { return by[y] - by[x] || y - x; })[0];
    return '<section class="blk"><header class="blkh"><h3>Le annate</h3>' +
      '<p>Quante bottiglie per ogni annata' + (perDecennio ? ', raggruppate per decennio' : '') + '. ' +
      'La più rappresentata è il <strong>' + topAnno + '</strong> con ' + by[topAnno] + (by[topAnno] === 1 ? ' bottiglia' : ' bottiglie') +
      '; si va dal ' + anni[0] + ' al ' + anni[anni.length - 1] + '.</p></header>' +
      '<div class="ych">' + chiavi.map(function (k) {
        return '<div class="yb' + (!perDecennio && k === topAnno ? ' top' : '') + '" tabindex="0">' +
          '<span class="ybn tab">' + col[k] + '</span>' +
          '<span class="ybar" style="height:' + Math.max(6, col[k] / max * 100) + '%"></span>' +
          '<span class="ybl tab">' + (perDecennio ? "'" + String(k).slice(2) + 's' : k) + '</span></div>';
      }).join('') + '</div></section>';
  }

  function vitigniTop(inC) {
    var by = {};
    inC.forEach(function (b) { (b.vitigni || []).forEach(function (v) { v = (v || '').trim(); if (v) by[v] = (by[v] || 0) + qty(b); }); });
    var rows = Object.keys(by).map(function (k) { return { k: k, v: by[k] }; })
      .sort(function (a, b) { return b.v - a.v || a.k.localeCompare(b.k, 'it'); });
    if (!rows.length) return '';
    return '<section class="blk"><header class="blkh"><h3>I vitigni</h3>' +
      '<p>Che cosa si beve, al di là del nome in etichetta.</p></header>' +
      '<div class="vch">' + rows.map(function (r) {
        return '<span class="vc">' + escHtml(r.k) + '<b class="tab">' + r.v + '</b></span>';
      }).join('') + '</div></section>';
  }

  function formati(inC) {
    var by = {};
    inC.forEach(function (b) { var f = (b.formato || '').trim() || 'Formato da precisare'; by[f] = (by[f] || 0) + qty(b); });
    var rows = Object.keys(by).map(function (k) { return { k: k, v: by[k] }; }).sort(function (a, b) { return b.v - a.v; });
    if (rows.length < 2) return '';
    return '<section class="blk"><header class="blkh"><h3>I formati</h3></header>' +
      '<div class="vch">' + rows.map(function (r) {
        return '<span class="vc">' + escHtml(r.k) + '<b class="tab">' + r.v + '</b></span>';
      }).join('') + '</div></section>';
  }

  /* Le bottiglie piu' preziose: e' la domanda che si fa chiunque apra una
     cantina di qualcun altro. */
  function pregiate(inC) {
    var l = inC.filter(function (b) { return vetrina(b) != null; })
      .sort(function (a, b) { return vetrina(b) - vetrina(a); }).slice(0, 8);
    if (!l.length) return '';
    return '<section class="blk"><header class="blkh"><h3>Le più preziose</h3>' +
      '<p>Le otto bottiglie di maggior valore unitario oggi in cantina, con dove sono.</p></header>' +
      '<div class="prg">' + l.map(function (b, i) {
        return '<button type="button" class="pgr" data-open="' + b.id + '" style="' + blkVars(b) + '">' +
          '<span class="pgn tab">' + (i + 1) + '</span>' +
          '<span class="pgi">' + bottleSVG(b) + '</span>' +
          '<span class="pgt"><span class="pgnm">' + escHtml(b.nome || 'Senza nome') + '</span>' +
          '<span class="pgmk">' + escHtml(b.produttore || b.cantina || '') + (etaTesto(b) ? ' · ' + etaTesto(b) : '') +
          ' · ' + escHtml(area(b)) + (posizione(b) ? ' · ' + escHtml(posizione(b)) : '') + '</span></span>' +
          '<span class="pgv tab">' + fmtM(vetrina(b)) + (qty(b) > 1 ? '<span class="pgq">× ' + qty(b) + '</span>' : '') + '</span></button>';
      }).join('') + '</div></section>';
  }

  function perZona(inC) {
    var by = {};
    inC.forEach(function (b) {
      var z = zonaDi(b);
      if (!by[z]) by[z] = { n: 0, v: 0 };
      by[z].n += qty(b); by[z].v += (vetrina(b) || 0) * qty(b);
    });
    var rows = Object.keys(by).map(function (k) { return { k: k, v: by[k].n, e: by[k].v }; })
      .sort(function (a, b) { return b.v - a.v; });
    if (!rows.length) return '';
    var max = rows[0].v;
    return '<section class="blk"><header class="blkh"><h3>Dov’è la cantina</h3>' +
      '<p>Quante bottiglie per zona, e quanto vale ciascuna zona a prezzo di vetrina.</p></header>' +
      '<div class="compo bare">' + rows.map(function (r, i) {
        return '<div class="crow"><div class="clab">' + escHtml(r.k) + '</div>' +
          '<div class="ctrack"><div class="cbar" style="width:' + Math.max(3, r.v / max * 100) + '%;animation-delay:' + (i * 50) + 'ms"></div></div>' +
          '<div class="cnum tab">' + r.v + '</div>' +
          '<div class="ctip">' + escHtml(r.k) + ' — ' + r.v + (r.v === 1 ? ' bottiglia' : ' bottiglie') + (r.e ? ' · ' + fmtM(r.e) : '') + '</div></div>';
      }).join('') + '</div></section>';
  }

  function archivio() {
    var out = STATE.bottles.filter(uscita).sort(function (a, b) {
      return String(b.venduta_il || b.bevuta_il || b.regalata_il || '').localeCompare(String(a.venduta_il || a.bevuta_il || a.regalata_il || ''));
    });
    if (!out.length) return '';
    var ric = out.filter(function (b) { return b.stato === 'venduta'; })
      .reduce(function (n, b) { return n + (num(b.prezzo_vendita) || 0); }, 0);
    return '<section class="blk"><header class="blkh"><h3>Quello che è già uscito</h3>' +
      '<p>Bevute, vendute e regalate restano nello storico: escono dal conteggio della cantina, non dalla memoria.' +
      (ric ? ' Dalle vendite sono entrati ' + fmtM(ric) + '.' : '') + '</p></header>' +
      '<div class="tw"><table><thead><tr><th>Nome</th><th>Uscita</th><th>Quando</th><th>Pagato</th><th>Incassato</th><th>Vetrina di allora</th></tr></thead><tbody>' +
      out.map(function (b) {
        var d = b.venduta_il || b.bevuta_il || b.regalata_il || '';
        return '<tr class="r" data-open="' + b.id + '" tabindex="0" style="' + blkVars(b) + '">' +
          '<td><span class="tnm">' + escHtml(b.nome || '—') + '</span>' + (b.esempio ? ' <span class="pl">esempio</span>' : '') + '</td>' +
          '<td><span class="pl">' + escHtml(STATI[b.stato]) + '</span>' + (b.regalata_a ? ' ' + escHtml(b.regalata_a) : '') + '</td>' +
          '<td class="tab">' + (d ? fmtD(d) : '—') + '</td>' +
          '<td class="tab">' + fmtM(num(b.prezzo_acquisto)) + '</td>' +
          '<td class="tab">' + (b.stato === 'venduta' ? fmtM(num(b.prezzo_vendita)) : '—') + '</td>' +
          '<td class="tab">' + fmtM(vetrina(b)) + '</td></tr>';
      }).join('') + '</tbody></table></div></section>';
  }

  function tableView(l) {
    return '<div class="tw"><table><thead><tr><th></th><th>Nome</th><th>Stato</th><th>Tipologia</th><th>Produttore</th><th>Annata</th><th>Grad.</th><th>Provenienza</th><th>Vitigni</th><th>Pagato</th><th>Vetrina</th><th>Netto asta</th><th>Segnale</th><th>Δ</th></tr></thead><tbody>' +
      l.map(function (b) {
        var d = delta(b);
        return '<tr class="r' + (uscita(b) ? ' gone' : '') + '" data-open="' + b.id + '" tabindex="0" style="' + blkVars(b) + '">' +
          '<td><div class="rbox">' + bottleSVG(b) + '</div></td>' +
          '<td><span class="tnm">' + (inCoda(b) ? 'Da catalogare' : escHtml(b.nome || '—')) + '</span>' + (b.esempio ? ' <span class="pl">esempio</span>' : '') +
          (haFoto(b) ? ' <button type="button" class="foto-btn tiny" data-foto="' + b.id + '">foto</button>' : '') + '</td>' +
          '<td>' + escHtml(STATI[b.stato] || '—') + '</td>' +
          '<td><span class="swatch"></span>' + escHtml(b.tipologia || '—') + (b.colore ? ' · ' + escHtml(b.colore) : '') + '</td>' +
          '<td>' + escHtml(b.produttore || '—') + '</td>' +
          '<td class="tab">' + escHtml(b.annata || '—') + '</td>' +
          '<td class="tab">' + (b.gradazione ? escHtml(grad(b)) + '%' : '—') + '</td>' +
          '<td>' + escHtml(b.provenienza || '—') + '</td>' +
          '<td>' + escHtml((b.vitigni || []).join(', ') || '—') + '</td>' +
          '<td class="tab">' + fmtM(num(b.prezzo_acquisto)) + '</td>' +
          '<td class="tab">' + fmtM(vetrina(b)) + '</td>' +
          '<td class="tab">' + fmtM(nettoAsta(b)) + '</td>' +
          '<td>' + (segnale(b) ? badge(b) : '—') + '</td>' +
          '<td class="tab">' + (d != null ? '<span class="dl ' + (d > 0 ? 'pos' : d < 0 ? 'neg' : 'flat') + '">' + (d >= 0 ? '+' : '') + d.toFixed(0) + '%</span>' : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }


  /* La pagina della foto: si apre solo se la chiedi. */
  function fotoSheet() {
    var b = STATE.bottles.find(function (x) { return x.id === viewing; });
    if (!b) return '';
    var f = b.foto_fronte, r = b.foto_retro;
    return '<div class="ov lb" data-ovfoto><div class="lbx">' +
      '<div class="lbhd"><div><h2>' + escHtml(b.nome || 'Bottiglia da catalogare') + '</h2>' +
      '<p class="ss">' + escHtml([b.produttore, b.annata].filter(Boolean).join(' · ')) + '</p></div>' +
      '<button type="button" class="x" data-shutfoto aria-label="Chiudi">✕</button></div>' +
      '<div class="lbimgs">' +
      (f ? '<figure><img src="' + f + '" alt="Fronte della bottiglia"><figcaption>fronte</figcaption></figure>' : '') +
      (r ? '<figure><img src="' + r + '" alt="Retro della bottiglia"><figcaption>retro</figcaption></figure>' : '') +
      '</div>' +
      '<p class="lbnote">Scatti fatti al volo mentre si mette in ordine la cantina: servono a controllare l’etichetta, non a fare bella figura. La copia a piena risoluzione è archiviata sul computer.</p>' +
      '</div></div>';
  }

  /* ======================= schede modali ======================= */
  function sheets() {
    if (profiloOpen) return profiloSheet();
    if (spForm) return formAnnuncioSheet();
    if (mappaOpen) return mappaSheet();
    if (viewing) return fotoSheet();
    if (shooting) return shootSheet();
    if (bulk) return bulkSheet();
    if (!editingId) return '';
    var isNew = editingId === 'new';
    var b = isNew ? {} : STATE.bottles.find(function (x) { return x.id === editingId; });
    if (!b) return '';
    return (isReadOnly && !isNew) ? detailSheet(b) : formSheet(b, isNew);
  }
  function head(t, sub) {
    return '<div class="shd"><div><h2>' + t + '</h2>' + (sub ? '<p class="ss">' + sub + '</p>' : '') + '</div>' +
      '<button type="button" class="x" data-shutsheet aria-label="Chiudi">✕</button></div>';
  }
  function slot(w, lab, hint) {
    var v = formPhotos[w];
    return '<div class="slot' + (v ? ' full' : '') + '">' +
      (v ? '<img src="' + v + '" alt=""><button type="button" class="redo" data-redo="' + w + '">Rifai</button>'
         : '<span class="sc">' + lab + '</span><span class="sh">' + hint + '</span><input type="file" accept="image/*" data-shot="' + w + '" aria-label="' + lab + '">') +
      '</div>';
  }
  function shootSheet() {
    return '<div class="ov" data-ov><div class="sheet">' +
      head('Fotografa la bottiglia', 'Fronte e retro, anche di fretta. Nome, cantina, annata, vitigni, gradazione, colore e provenienza vengono letti dall’etichetta.') +
      '<div class="shb"><div class="slots">' + slot('fronte', 'Fronte', 'l’etichetta principale') + slot('retro', 'Retro', 'gradazione, lotto, imbottigliatore') + '</div>' +
      '<p class="hint">Il retro è facoltativo ma conta: gradazione e vitigni spesso stanno solo lì.</p>' +
      '<p class="hint" style="margin-top:14px">Dove la metti? Se lo indichi adesso, la bottiglia nasce gi\u00e0 al suo posto (resta impostato per la prossima).</p><div class="posgrid" id="pos-sh">' + campiPosizione(ultimaPos, 'sh') + '</div>' +
      '<label style="display:block;margin-top:16px"><span class="lbl">Prezzo pagato (€) — facoltativo</span><input type="number" step="0.01" id="sh-prezzo" placeholder="se lo sai, scrivilo adesso"></label></div>' +
      '<div class="shf"><button type="button" class="btn gho" data-shutsheet>Annulla</button>' +
      '<div class="grp"><button type="button" class="btn" id="save-again">Salva e fotografa un’altra</button><button type="button" class="btn pri" id="save-shot">Salva in coda</button></div></div>' +
      '</div></div>';
  }
  function bulkSheet() {
    var n = bulkPaired ? Math.ceil(bulkPhotos.length / 2) : bulkPhotos.length;
    return '<div class="ov" data-ov><div class="sheet wide">' +
      head('Carica più foto insieme', 'Per mettere in ordine un intero scaffale in una sessione sola.') +
      '<div class="shb"><div class="drop"><strong>Scegli le foto</strong><p class="hint">Dal telefono o dal computer, anche decine in una volta</p><input type="file" accept="image/*" multiple id="bulkin" aria-label="Scegli le foto"></div>' +
      '<label class="chk"><input type="checkbox" id="paired"' + (bulkPaired ? ' checked' : '') + '> Le foto sono in coppia fronte/retro, nell’ordine in cui sono state scattate</label>' +
      '<p class="hint" style="margin-top:14px">Stesso posto per tutte le foto di questa sessione: indica la posizione una volta sola.</p><div class="posgrid" id="pos-bk">' + campiPosizione(ultimaPos, 'bk') + '</div>' +
      (bulkPhotos.length ? '<div class="bg2">' + bulkPhotos.map(function (p, i) {
        return '<figure><img src="' + p + '" alt=""><figcaption>' + (bulkPaired ? (Math.floor(i / 2) + 1) + (i % 2 ? ' R' : ' F') : '#' + (i + 1)) + '</figcaption></figure>';
      }).join('') + '</div><p class="hint">' + bulkPhotos.length + ' foto · ' + n + (n === 1 ? ' bottiglia' : ' bottiglie') + '</p>' : '') +
      '</div><div class="shf"><button type="button" class="btn gho" data-shutsheet>Annulla</button>' +
      '<button type="button" class="btn pri" id="save-bulk"' + (bulkPhotos.length ? '' : ' disabled style="opacity:.45"') + '>Metti in coda ' + n + (n === 1 ? ' bottiglia' : ' bottiglie') + '</button></div>' +
      '</div></div>';
  }
  function photosOf(b) {
    return '<div class="dph" style="' + blkVars(b) + '"><div class="ab">' + bottleSVG(b) + '</div>' +
      (haFoto(b)
        ? '<div class="dph-side">' + bottoneFoto(b, 'Guarda le foto di questa bottiglia') +
          '<p class="hint">Gli scatti fatti da Max in cantina: fronte e retro, a tutto schermo.</p></div>'
        : '<div class="dph-side"><p class="hint">Nessuna foto per questa bottiglia. Arriverà con il prossimo scatto in cantina.</p></div>') + '</div>';
  }
  function detailSheet(b) {
    function c(k, v) { return '<div class="dc"><div class="dk">' + k + '</div><div class="dv">' + escHtml(v) + '</div></div>'; }
    var d = delta(b);
    return '<div class="ov" data-ov><div class="sheet">' +
      head(escHtml(b.nome || 'Da catalogare'), escHtml(b.produttore || '')) +
      '<div class="shb">' + photosOf(b) + pannelloQuot(b) + '<div class="dg">' +
      c('Stato', STATI[b.stato] || '—') + c('Tipologia', b.tipologia || '—') +
      c('Colore', b.colore || '—') + c('Annata', b.annata || '—') +
      c('Gradazione', b.gradazione ? b.gradazione + '% vol' : '—') + c('Annata migliore', b.annata_migliore || '—') +
      c('Provenienza', b.provenienza || '—') + c('Vitigni', (b.vitigni || []).join(', ') || '—') +
      c('Posizione', posizione(b) || '—') + c('Formato', b.formato || '—') +
      c('Pagato', fmtM(num(b.prezzo_acquisto))) +
      c('Valore', fmtM(num(b.valore_attuale)) + (d != null ? ' (' + (d >= 0 ? '+' : '') + d.toFixed(0) + '%)' : '')) +
      '</div>' + (b.note ? '<div class="nbox">' + escHtml(b.note) + '</div>' : '') + '</div>' +
      '<div class="shf"><span></span><button class="btn gho" data-shutsheet type="button">Chiudi</button></div></div></div>';
  }
  function formSheet(b, isNew) {
    var coda = inCoda(b), out = uscita(b);
    function fl(c) { return incerto(b, c) ? '<span class="fl">da verificare</span>' : ''; }
    function wc(c) { return incerto(b, c) ? ' class="warned"' : ''; }
    var sub = isNew ? 'Per le bottiglie senza etichetta leggibile, o per aggiungere a mano.'
      : coda ? 'L’etichetta non è ancora stata letta. Puoi compilare tu: i campi lasciati vuoti verranno riempiti comunque.'
      : out ? (b.stato === 'bevuta' ? 'Bevuta il ' + fmtD(b.bevuta_il) + '. Resta nello storico, fuori dal conteggio della cantina.'
              : b.stato === 'regalata' ? 'Regalata il ' + fmtD(b.regalata_il) + (b.regalata_a ? ' a ' + escHtml(b.regalata_a) : '') + '. Resta nello storico.'
                                    : 'Venduta il ' + fmtD(b.venduta_il) + (b.prezzo_vendita != null ? ' per ' + fmtM(b.prezzo_vendita) : '') + '. Resta nello storico.')
      : (b.esempio ? 'Bottiglia di esempio, a scopo dimostrativo.' : (b.note_analisi ? escHtml(b.note_analisi) : 'Correggi qualsiasi campo: quello che scrivi tu resta.'));
    return '<div class="ov" data-ov><div class="sheet">' +
      head(isNew ? 'Inserimento manuale' : (coda ? 'Bottiglia in coda' : escHtml(b.nome || 'Scheda')), sub) +
      '<div class="shb">' + (isNew ? '' : photosOf(b)) + (isNew ? '' : pannelloQuot(b)) +
      '<form id="bform"><div class="fg">' +
      '<label class="full"' + wc('nome') + '><span class="lbl">Nome bottiglia' + fl('nome') + '</span><input type="text" id="i-nome" value="' + escHtml(b.nome) + '" placeholder="es. Barolo Cannubi"></label>' +
      '<label' + wc('tipologia') + '><span class="lbl">Tipologia' + fl('tipologia') + '</span><select id="i-tipo">' + TIPI.map(function (t) { return '<option value="' + t + '"' + ((b.tipologia || 'Vino') === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></label>' +
      '<label id="wcol" style="' + (TIPI_CON_COLORE[b.tipologia || 'Vino'] ? '' : 'display:none') + '"><span class="lbl">Colore' + fl('colore') + '</span><select id="i-col"><option value="">—</option>' + COLORI.map(function (c) { return '<option value="' + c + '"' + (b.colore === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></label>' +
      '<label' + wc('produttore') + '><span class="lbl">Produttore' + fl('produttore') + '</span><input type="text" id="i-prod" value="' + escHtml(b.produttore) + '"></label>' +
      '<label' + wc('cantina') + '><span class="lbl">Cantina / distilleria' + fl('cantina') + '</span><input type="text" id="i-can" value="' + escHtml(b.cantina) + '"></label>' +
      '<label' + wc('annata') + '><span class="lbl">Annata' + fl('annata') + '</span><input type="text" id="i-an" placeholder="es. 2018 · NAS" value="' + escHtml(b.annata) + '"></label>' +
      '<label' + wc('eta') + '><span class="lbl">Età dichiarata · distillati' + fl('eta') + '</span><input type="text" id="i-eta" placeholder="es. 18 — vuoto se NAS" value="' + escHtml(b.eta) + '"></label>' +
      '<label' + wc('gradazione') + '><span class="lbl">Gradazione % vol' + fl('gradazione') + '</span><input type="number" step="0.1" id="i-grad" value="' + (b.gradazione != null ? escHtml(b.gradazione) : '') + '"></label>' +
      '<label' + wc('annata_migliore') + '><span class="lbl">Annata migliore' + fl('annata_migliore') + '</span><input type="text" id="i-anmig" placeholder="es. 2028–2042" value="' + escHtml(b.annata_migliore) + '"></label>' +
      '<label' + wc('provenienza') + '><span class="lbl">Provenienza' + fl('provenienza') + '</span><input type="text" id="i-prv" placeholder="es. Bolgheri · Islay" value="' + escHtml(b.provenienza) + '"></label>' +
      '<label class="full"' + wc('vitigni') + '><span class="lbl">Vitigni · separati da virgola' + fl('vitigni') + '</span><input type="text" id="i-vit" value="' + escHtml((b.vitigni || []).join(', ')) + '"></label>' +
      '<label><span class="lbl">Formato</span><input type="text" id="i-fmt" placeholder="es. 0,75 L · Magnum" value="' + escHtml(b.formato) + '"></label>' +
      '<div id="pos-i" style="display:contents">' + campiPosizione(b, 'i') + '</div>' +
      '<label><span class="lbl">Quantità</span><input type="number" min="1" id="i-qta" value="' + qty(b) + '"></label>' +
      '<label><span class="lbl">Prezzo pagato €</span><input type="number" step="0.01" id="i-pacq" value="' + (b.prezzo_acquisto != null ? b.prezzo_acquisto : '') + '"></label>' +
      '<label><span class="lbl">Valore di mercato €</span><input type="number" step="0.01" id="i-val" value="' + (b.valore_attuale != null ? b.valore_attuale : '') + '"></label>' +
      '<label><span class="lbl">Data quotazione</span><input type="date" id="i-vdata" value="' + escHtml(b.valore_data) + '"></label>' +
      '<label><span class="lbl">Fonte quotazione</span><input type="text" id="i-vfonte" placeholder="es. Wine-Searcher" value="' + escHtml(b.valore_fonte) + '"></label>' +
      '<label class="full"><span class="lbl">Note</span><textarea id="i-note" rows="2">' + escHtml(b.note) + '</textarea></label>' +
      (isNew || out || b.esempio ? '' : '<div class="full sp-scheda"><span class="lbl">Speakeasy · la bacheca del club</span>' + (annuncioDiBottiglia(b.id) ? '<p class="hint">Questa bottiglia è in bacheca' + (annuncioDiBottiglia(b.id).stato === 'in_trattativa' ? ', in trattativa' : '') + '. <button type="button" class="lnk" id="sp-in-bacheca">Gestiscila in Le mie proposte</button></p>' : '<p class="hint">Solo se vuoi: la bottiglia compare ai membri, in vendita a prezzo totale del lotto o in scambio. Il resto della cantina resta privato.</p><span><button type="button" class="btn sm" data-sp-pubblica="' + b.id + '">Metti in bacheca</button></span>') + '</div>') +
      (isNew ? '<label class="full"><span class="lbl">Foto · facoltativa</span><input type="file" accept="image/*" id="i-foto"><p class="hint">Se vuoi che la scheda si compili da sola, usa invece “Fotografa una bottiglia”.</p></label>' : '') +
      '</div></form></div>' +
      '<div class="shf">' +
      '<div class="grp">' + (isNew ? '' :
        (out ? '<button type="button" class="btn sm" id="a-back">Rimetti in cantina</button>'
             : '<button type="button" class="btn sm" id="a-bevuta">Bevuta</button><button type="button" class="btn sm" id="a-venduta">Venduta</button><button type="button" class="btn sm" id="a-regalata">Regalata</button>') +
        '<button type="button" class="btn sm dgr" id="a-del">Elimina</button>') + '</div>' +
      '<div class="grp"><button type="button" class="btn gho" data-shutsheet>Annulla</button><button type="button" class="btn pri" id="a-save">Salva</button></div>' +
      '</div></div></div>';
  }

  /* ======================= eventi ======================= */
  function bind() {
    var root = document.getElementById('root');
    function on(id, ev, fn) { var e = document.getElementById(id); if (e) e.addEventListener(ev, fn); }

    root.querySelectorAll('[data-shut]').forEach(function (e) { e.addEventListener('click', function () { railOpen = false; render(); }); });
    on('rtog', 'click', function () { railOpen = !railOpen; render(); });
    on('esci', 'click', function () {
      if (!window.CELL) return;
      if (!confirm('Chiudere la sessione su questo dispositivo?')) return;
      CELL.esci();
    });
    on('export', 'click', exportCSV);
    on('cataloga', 'click', catalogaCoda);
    on('shoot', 'click', function () { if (rapidoPreferito()) apriRapido(); else openShoot(); });
    on('shoot-empty', 'click', function () { if (rapidoPreferito()) apriRapido(); else openShoot(); });
    bindRapido(root);
    on('bulkbtn', 'click', function () { bulkPhotos = []; bulk = true; render(); });
    on('manual', 'click', function () { editingId = 'new'; render(); });
    on('rmdemo', 'click', function () {
      if (!confirm('Rimuovere le ' + esempi().length + ' bottiglie di esempio? Le bottiglie vere non vengono toccate.')) return;
      commit(function (ns) { ns.bottles = ns.bottles.filter(function (b) { return !b.esempio; }); }, true);
      toast('Esempi rimossi');
    });

    root.querySelectorAll('[data-view]').forEach(function (e) { e.addEventListener('click', function () { filters.view = e.getAttribute('data-view'); render(); }); });

    // le tre stanze
    root.querySelectorAll('[data-stanza]').forEach(function (e) {
      e.addEventListener('click', function () {
        var k = e.getAttribute('data-stanza');
        if (k === stanza) return;
        stanza = k; railOpen = window.innerWidth > 1000 && k === 'catalogo';
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    // cruscotto: la casella filtra l'elenco
    root.querySelectorAll('[data-seg]').forEach(function (e) {
      if (e.tagName !== 'BUTTON') return;
      e.addEventListener('click', function () {
        var k = e.getAttribute('data-seg');
        filters.segnale = (filters.segnale === k) ? '' : k;
        render();
      });
    });
    on('seg-off', 'click', function () { filters.segnale = ''; render(); });

    // matrice: punto -> riquadro informativo, clic -> scheda
    var tip = document.getElementById('mtip');
    root.querySelectorAll('.mdot').forEach(function (c) {
      function mostra() {
        if (!tip) return;
        tip.innerHTML = '<strong>' + c.getAttribute('data-nome') + '</strong><br>' + c.getAttribute('data-info');
        tip.hidden = false;
        var box = c.closest('.mbox').getBoundingClientRect(), p = c.getBoundingClientRect();
        var x = p.left - box.left + p.width / 2, y = p.top - box.top;
        tip.style.left = Math.max(6, Math.min(box.width - 6, x)) + 'px';
        var sopra = y > 64;                       // se sta in cima, il riquadro va sotto
        tip.classList.toggle('sotto', !sopra);
        tip.style.top = (sopra ? y - 12 : y + p.height + 12) + 'px';
      }
      c.addEventListener('mouseenter', mostra);
      c.addEventListener('focus', mostra);
      c.addEventListener('mouseleave', function () { if (tip) tip.hidden = true; });
      c.addEventListener('blur', function () { if (tip) tip.hidden = true; });
      c.addEventListener('click', function () { editingId = c.getAttribute('data-mid'); render(); });
      c.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); editingId = c.getAttribute('data-mid'); render(); }
      });
    });

    // quanto resta vendendo
    function resa(id, chiave) {
      var e = document.getElementById(id); if (!e) return;
      e.addEventListener('change', function () {
        var n = num(e.value);
        if (n == null || n < 0 || n > 100) { toast('Serve una percentuale fra 0 e 100'); render(); return; }
        commit(function (ns) { ns.meta[chiave] = n / 100; }, false);
      });
    }
    resa('f-rpriv', 'resa_privata');
    resa('f-rasta', 'resa_asta');
    (function () {
      var e = document.getElementById('f-soglia'); if (!e) return;
      e.addEventListener('change', function () {
        var n = num(e.value);
        if (n == null || n < 0) { toast('Serve un numero, anche zero'); render(); return; }
        commit(function (ns) { ns.meta.soglia_vendita = n; }, false);
      });
    })();
    root.querySelectorAll('[data-chip]').forEach(function (e) {
      e.addEventListener('click', function () {
        var a = filters[e.getAttribute('data-chip')], v = e.getAttribute('data-v'), i = a.indexOf(v);
        if (i === -1) a.push(v); else a.splice(i, 1);
        render();
      });
    });
    root.querySelectorAll('[data-open]').forEach(function (e) {
      e.addEventListener('click', function () { editingId = e.getAttribute('data-open'); render(); });
      e.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); editingId = e.getAttribute('data-open'); render(); } });
    });
    root.querySelectorAll('[data-shutsheet]').forEach(function (e) { e.addEventListener('click', function (ev) { ev.stopPropagation(); shut(); }); });

    // pagina della foto
    root.querySelectorAll('[data-foto]').forEach(function (e) {
      e.addEventListener('click', function (ev) { ev.stopPropagation(); viewing = e.getAttribute('data-foto'); render(); });
    });
    root.querySelectorAll('[data-shutfoto]').forEach(function (e) {
      e.addEventListener('click', function (ev) { ev.stopPropagation(); viewing = null; render(); });
    });
    root.querySelectorAll('[data-ovfoto]').forEach(function (e) {
      e.addEventListener('click', function (ev) { if (ev.target === e) { viewing = null; render(); } });
    });
    on('q-off', 'click', function () { filters.q = ''; render(); });
    on('q-off2', 'click', function () { filters.q = ''; render(); });
    on('pos-off', 'click', function () { filters.zona = ''; filters.scaffale = ''; render(); });
    root.querySelectorAll('[data-ov]').forEach(function (e) { e.addEventListener('click', function (ev) { if (ev.target === e) shut(); }); });
    document.removeEventListener('keydown', esc); document.addEventListener('keydown', esc);

    live('f-q', function (v) { filters.q = v; if (v && stanza !== 'catalogo') stanza = 'catalogo'; });
    live('f-anmin', function (v) { filters.annataMin = v; });
    live('f-anmax', function (v) { filters.annataMax = v; });
    live('f-grmin', function (v) { filters.gradMin = v; });
    live('f-grmax', function (v) { filters.gradMax = v; });
    live('f-pmin', function (v) { filters.prezzoMin = v; });
    live('f-pmax', function (v) { filters.prezzoMax = v; });
    live('f-can', function (v) { filters.cantina = v; });
    live('f-pro', function (v) { filters.produttore = v; });
    live('f-prv', function (v) { filters.provenienza = v; });
    live('f-vit', function (v) { filters.vitigno = v; });
    on('f-ambito', 'change', function (e) { filters.ambito = e.target.value; render(); });
    on('f-zona', 'change', function (e) {
      filters.zona = e.target.value;
      // lo scaffale scelto potrebbe non esistere nella nuova zona
      if (filters.scaffale && !scaffaliDiZona(filters.zona).some(function (x) { return x.sc.toLowerCase() === filters.scaffale.toLowerCase(); })) filters.scaffale = '';
      render();
    });
    on('f-scaff', 'change', function (e) { filters.scaffale = e.target.value; render(); });
    root.querySelectorAll('[data-scaff]').forEach(function (e) {
      e.addEventListener('click', function () {
        var v = e.getAttribute('data-scaff'), z = e.getAttribute('data-zona') || '';
        if (filters.scaffale.toLowerCase() === v.toLowerCase()) { filters.scaffale = ''; }
        else { filters.scaffale = v; if (z && z !== 'Senza posizione') filters.zona = z; }
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
    on('f-pbase', 'change', function (e) { filters.prezzoBase = e.target.value; render(); });
    on('f-sort', 'change', function (e) { filters.sort = e.target.value; render(); });
    on('f-plus', 'change', function (e) { filters.soloPlus = e.target.checked; render(); });
    on('reset', 'click', reset); on('reset2', 'click', reset);

    root.querySelectorAll('[data-shot]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0]; if (!f) return;
        var w = inp.getAttribute('data-shot');
        toast('Preparo la foto…');
        toDataUrl(f, FOTO_MAX_DIM, FOTO_QUALITA).then(function (u) {
          formPhotos[w] = u; var keep = valOf('sh-prezzo'); render(); setVal('sh-prezzo', keep);
        }).catch(function () { toast('Immagine illeggibile, riprova'); });
      });
    });
    root.querySelectorAll('[data-redo]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var keep = valOf('sh-prezzo'); formPhotos[btn.getAttribute('data-redo')] = ''; render(); setVal('sh-prezzo', keep);
      });
    });
    on('save-shot', 'click', function () { saveShot(false); });
    on('save-again', 'click', function () { saveShot(true); });

    on('bulkin', 'change', function (e) {
      var fs = Array.prototype.slice.call(e.target.files || []);
      if (!fs.length) return;
      toast('Preparo ' + fs.length + ' foto…');
      Promise.all(fs.map(function (f) { return toDataUrl(f, FOTO_MAX_DIM, FOTO_QUALITA).catch(function () { return null; }); }))
        .then(function (us) { bulkPhotos = bulkPhotos.concat(us.filter(Boolean)); render(); });
    });
    on('paired', 'change', function (e) { bulkPaired = e.target.checked; render(); });
    on('save-bulk', 'click', saveBulk);

    on('i-tipo', 'change', function (e) {
      var w = document.getElementById('wcol'); if (w) w.style.display = TIPI_CON_COLORE[e.target.value] ? '' : 'none';
    });
    root.querySelectorAll('[data-vis]').forEach(function (e) {
      e.addEventListener('click', function () {
        var h = document.getElementById('i-club'); if (h) h.value = e.getAttribute('data-vis');
        root.querySelectorAll('[data-vis]').forEach(function (x) { x.classList.toggle('on', x === e); });
      });
    });
    root.querySelectorAll('[data-desk]').forEach(function (e) { e.addEventListener('click', function () { toast('Il desk risponde al richiedente · ' + e.getAttribute('data-desk') + ' · la tua identità resta privata'); }); });
    root.querySelectorAll('[data-toast]').forEach(function (e) { e.addEventListener('click', function () { toast(e.getAttribute('data-toast')); }); });
    on('club-chiedi-vecchio', 'click', function () {
      if (!window.CELL) return;
      var b = document.getElementById('club-chiedi'); if (b) { b.disabled = true; b.textContent = 'Invio…'; }
      CELL.chiediAmmissione().then(function (st) { PROFILO.stato_candidatura = st; render(); toast('Candidatura inviata al desk'); CELL.avvisa('ammissione', '').catch(function () {}); })
        .catch(function (e) { render(); toast((e && e.message) || 'Non inviata, riprova'); });
    });
    on('desk-invia', 'click', function () {
      if (!window.CELL) return;
      var t = (document.getElementById('desk-testo') || {}).value || '';
      if (!t.trim()) { toast('Scrivi prima il messaggio'); return; }
      CELL.scriviAlDesk(t.trim()).then(function () { document.getElementById('desk-testo').value = ''; toast('Messaggio inviato al desk'); CELL.avvisa('messaggio', t.trim()).catch(function () {}); })
        .catch(function (e) { toast((e && e.message) || 'Non inviato, riprova'); });
    });
    root.querySelectorAll('[data-desk-act]').forEach(function (e) { e.addEventListener('click', function () { e.disabled = true; deskAzione(e.getAttribute('data-desk-act'), e.getAttribute('data-email')); }); });
    root.querySelectorAll('[data-desk-chiudi]').forEach(function (e) { e.addEventListener('click', function () { CELL.deskChiudi(e.getAttribute('data-desk-chiudi')).then(function () { DESK = null; render(); }).catch(function (x) { toast((x && x.message) || 'Non riuscito'); }); }); });
    root.querySelectorAll('[data-cfg]').forEach(function (e) { e.addEventListener('click', function () { CELL.deskConfigura(e.getAttribute('data-cfg'), e.getAttribute('data-val')).then(function () { DESK = null; render(); toast('Impostazione salvata'); }).catch(function (x) { toast((x && x.message) || 'Non salvato'); }); }); });
    root.querySelectorAll('[data-cfg-num]').forEach(function (e) { e.addEventListener('change', function () { CELL.deskConfigura(e.getAttribute('data-cfg-num'), String(Math.max(0, Math.round(Number(e.value) || 0)))).then(function () { DESK = null; render(); toast('Quota salvata'); }).catch(function (x) { toast((x && x.message) || 'Non salvato'); }); }); });
    on('desk-ricarica', 'click', function () { DESK = null; render(); });
    bindMappa(root, on);
    bindSpeakeasy(root, on);
    root.querySelectorAll('[data-lingua-switch]').forEach(function (e) { e.addEventListener('click', function () { try { localStorage.setItem('caveau.lingua', window.CAVEAU_LINGUA === 'en' ? 'it' : 'en'); } catch (x) {} location.reload(); }); });
    on('a-save', 'click', submit);
    on('bform', 'submit', function (e) { e.preventDefault(); submit(); });
    on('a-del', 'click', function () { del(editingId); });
    on('a-bevuta', 'click', segnaBevuta);
    on('a-regalata', 'click', segnaRegalata);
    on('a-venduta', 'click', segnaVenduta);
    on('a-back', 'click', rimetti);
  }

  function esc(ev) {
    if (ev.key !== 'Escape') return;
    if (viewing) { ev.preventDefault(); viewing = null; render(); return; }   // la foto si chiude per prima
    if (editingId || shooting || bulk) { ev.preventDefault(); shut(); }
  }
  function shut() { profiloOpen = false; spDopoProfilo = null; spForm = null; editingId = null; shooting = false; bulk = false; viewing = null; mappaOpen = false; mappaDraft = null; formPhotos = { fronte: '', retro: '' }; bulkPhotos = []; render(); }
  function openShoot() { formPhotos = { fronte: '', retro: '' }; shooting = true; render(); }
  function valOf(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function setVal(id, v) { var e = document.getElementById(id); if (e) e.value = v; }
  function live(id, setter) {
    var e = document.getElementById(id); if (!e) return;
    var go = function () { setter(e.value); render(); refocus(id); };
    e.addEventListener('input', go); e.addEventListener('change', go);
  }
  function refocus(id) {
    var e = document.getElementById(id);
    if (e && document.activeElement !== e) { e.focus(); try { e.setSelectionRange(e.value.length, e.value.length); } catch (x) {} }
  }
  function reset() {
    filters = Object.assign(filters, { q: '', ambito: 'cantina', segnale: '', tipi: [], colori: [], annataMin: '', annataMax: '', gradMin: '', gradMax: '', prezzoMin: '', prezzoMax: '', cantina: '', produttore: '', provenienza: '', vitigno: '', zona: '', scaffale: '', soloPlus: false });
    render();
  }

  function nuova(f, r, p, pos) {
    return { id: uid(), stato: 'da_analizzare', aggiunta_il: today(), foto_fronte: f || '', foto_retro: r || '',
      nome: '', tipologia: '', colore: '', produttore: '', cantina: '', annata: '', annata_migliore: '',
      gradazione: '', provenienza: '', vitigni: [], formato: '', quantita: 1,
      zona: (pos && pos.zona) || '', scaffale: (pos && pos.scaffale) || '', ripiano: (pos && pos.ripiano) || '',
      club: 'privata',
      prezzo_acquisto: p != null ? p : null, valore_attuale: null, valore_data: '', valore_fonte: '', note: '', campi_incerti: [] };
  }
  function saveShot(again) {
    if (!formPhotos.fronte && !formPhotos.retro) { toast('Serve almeno una foto'); return; }
    var p = num(valOf('sh-prezzo')), f = formPhotos.fronte, r = formPhotos.retro, pos = posDaForm('sh'); ultimaPos = pos;
    formPhotos = { fronte: '', retro: '' }; shooting = !!again;
    commit(function (ns) { ns.bottles.unshift(nuova(f, r, p, pos)); }, false);
    toast(again ? 'In coda · fotografa la prossima' : 'Bottiglia messa in coda');
  }
  function saveBulk() {
    if (!bulkPhotos.length) return;
    var ph = bulkPhotos.slice(), out = [], pos = posDaForm('bk'); ultimaPos = pos;
    if (bulkPaired) { for (var i = 0; i < ph.length; i += 2) out.push(nuova(ph[i], ph[i + 1] || '', null, pos)); }
    else ph.forEach(function (p) { out.push(nuova(p, '', null, pos)); });
    bulkPhotos = []; bulk = false;
    commit(function (ns) { ns.bottles = out.concat(ns.bottles); }, false);
    toast(out.length + (out.length === 1 ? ' bottiglia in coda' : ' bottiglie in coda'));
  }
  function raccogli() {
    var g = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
    return {
      nome: g('i-nome'), tipologia: g('i-tipo'),
      colore: document.getElementById('i-col') ? document.getElementById('i-col').value : '',
      produttore: g('i-prod'), cantina: g('i-can'), annata: g('i-an'), eta: g('i-eta'), gradazione: g('i-grad'),
      annata_migliore: g('i-anmig'), provenienza: g('i-prv'), formato: g('i-fmt'),
      zona: g('i-zona'), scaffale: g('i-scaff'), ripiano: g('i-rip'),
      vitigni: g('i-vit').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      quantita: Number(g('i-qta')) || 1,
      prezzo_acquisto: num(g('i-pacq')), valore_attuale: num(g('i-val')),
      valore_data: g('i-vdata'), valore_fonte: g('i-vfonte'), note: g('i-note'),
      club: g('i-club') || 'privata'
    };
  }
  function submit() {
    var isNew = editingId === 'new', data = raccogli();
    if (isNew && !data.nome) { toast('Serve almeno il nome'); return; }
    var fi = document.getElementById('i-foto');
    var file = fi && fi.files && fi.files[0];
    var done = function (thumb) {
      if (isNew) {
        commit(function (ns) {
          var b = nuova('', '', data.prezzo_acquisto);
          Object.assign(b, data);
          b.stato = 'catalogata'; b.campi_incerti = [];
          if (thumb) b.foto_fronte = thumb;
          ns.bottles.unshift(b);
        }, true);
        toast('Bottiglia aggiunta');
      } else {
        var id = editingId;
        commit(function (ns) {
          var i = ns.bottles.findIndex(function (x) { return x.id === id; }); if (i < 0) return;
          var p = ns.bottles[i], era = p.stato === 'da_analizzare';
          Object.assign(p, data);
          p.campi_incerti = (p.campi_incerti || []).filter(function (c) {
            var v = c === 'posizione' ? (data.zona || data.scaffale) : data[c];
            return !(Array.isArray(v) ? v.length : v);
          });
          if (era && data.nome) { p.stato = 'catalogata'; p.note_analisi = 'Scheda compilata a mano.'; }
        }, true);
        toast('Scheda aggiornata');
      }
    };
    if (file) toDataUrl(file, THUMB_MAX_DIM, THUMB_QUALITA).then(done).catch(function () { done(''); });
    else done('');
  }
  function patch(id, fn, msg) {
    commit(function (ns) {
      var i = ns.bottles.findIndex(function (x) { return x.id === id; });
      if (i >= 0) fn(ns.bottles[i]);
    }, true);
    if (msg) toast(msg);
  }
  function segnaBevuta() {
    var d = prompt('Quando è stata bevuta? (AAAA-MM-GG)', today());
    if (d == null) return;
    patch(editingId, function (b) { b.stato = 'bevuta'; b.bevuta_il = (d || today()).trim(); }, 'Segnata come bevuta');
  }
  function segnaVenduta() {
    var p = prompt('A quanto è stata venduta? (€, solo il numero)', '');
    if (p == null) return;
    var d = prompt('Quando? (AAAA-MM-GG)', today());
    if (d == null) return;
    patch(editingId, function (b) { b.stato = 'venduta'; b.venduta_il = (d || today()).trim(); b.prezzo_vendita = num(p); }, 'Segnata come venduta');
  }
  function segnaRegalata() {
    var a = prompt('A chi è stata regalata? (facoltativo)', '');
    if (a == null) return;
    var d = prompt('Quando? (AAAA-MM-GG)', today());
    if (d == null) return;
    patch(editingId, function (b) {
      b.stato = 'regalata'; b.regalata_il = (d || today()).trim(); b.regalata_a = (a || '').trim();
    }, 'Segnata come regalata');
  }
  function rimetti() {
    patch(editingId, function (b) {
      b.stato = 'catalogata';
      delete b.bevuta_il; delete b.venduta_il; delete b.prezzo_vendita;
      delete b.regalata_il; delete b.regalata_a;
    }, 'Rimessa in cantina');
  }
  function del(id) {
    var b = STATE.bottles.find(function (x) { return x.id === id; });
    var n = b && b.nome ? '“' + b.nome + '”' : 'questa bottiglia';
    if (!confirm('Eliminare ' + n + ' dall’archivio? L’operazione non si può annullare.')) return;
    commit(function (ns) { ns.bottles = ns.bottles.filter(function (x) { return x.id !== id; }); }, true);
    toast('Bottiglia eliminata');
  }
  function rename() {
    var t = prompt('Nome dell’archivio:', STATE.meta.titolo); if (t == null) return;
    var s = prompt('Sottotitolo:', STATE.meta.sottotitolo || '');
    commit(function (ns) { ns.meta.titolo = t.trim() || 'La mia cantina'; ns.meta.sottotitolo = (s || '').trim(); }, false);
  }
  function exportCSV() {
    var cols = ['stato', 'nome', 'produttore', 'cantina', 'tipologia', 'colore', 'annata', 'annata_migliore', 'gradazione', 'provenienza', 'vitigni', 'formato', 'zona', 'scaffale', 'ripiano', 'quantita', 'prezzo_acquisto', 'valore_attuale', 'valore_data', 'valore_fonte', 'prezzo_vendita', 'venduta_il', 'bevuta_il', 'regalata_il', 'regalata_a', 'esempio', 'note'];
    var rows = [cols.join(',')];
    lista().forEach(function (b) {
      rows.push(cols.map(function (c) {
        var v = b[c];
        if (Array.isArray(v)) v = v.join(' / ');
        if (c === 'stato') v = STATI[v] || v;
        v = (v == null ? '' : String(v)).replace(/"/g, '""');
        return '"' + v + '"';
      }).join(','));
    });
    var csv = '﻿' + rows.join('\r\n');
    try {
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      var u = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = u; link.download = 'caveau-' + today() + '.csv';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
      toast('Archivio esportato');
    } catch (e) { toast('Export non riuscito'); }
  }

  /* ======================= avvio =======================
     L'app non parte da sola: aspetta che qualcuno le porti la cantina.
     Chi la porta è index.html, dopo aver verificato chi sta entrando. */
  window.CAVEAU = {
    avvia: function (stato, profilo) { if (profilo) PROFILO = profilo; idrata(stato); ensureStyle(); render(); },
    ricarica: function (stato, profilo) { if (profilo) PROFILO = profilo; idrata(stato); render(); },
    versione: '20.0'
  };

})();
