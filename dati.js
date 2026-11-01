/* =============================================================
   CAVEAU — lo strato dati.
   Tutto ciò che tocca il database sta qui dentro e da nessun'altra
   parte. L'interfaccia non sa che esiste un database: continua a
   maneggiare lo stesso oggetto di prima (meta + bottles), e questo
   file si occupa di riempirlo all'apertura e di riscriverlo quando
   cambia. La separazione non è eleganza: è quello che permette di
   cambiare magazzino domani senza toccare una riga di interfaccia.
   ============================================================= */
(function () {
  'use strict';

  var URL_DB = 'https://gyxibjszewysgmbwheuf.supabase.co';
  /* Chiave pubblicabile: è fatta per stare nel browser. Da sola non apre
     nulla — è il database, riga per riga, a decidere cosa può vedere chi
     la usa. La chiave che conta davvero non è mai uscita dal server. */
  var CHIAVE = 'sb_publishable_F1a8mkvvPMdv-UR45ywoZw_OgsGMhjc';

  var sb = window.supabase.createClient(URL_DB, CHIAVE, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
  });

  var FIRMA_SEC = 8 * 3600;      // quanto dura il link firmato di una foto
  var BUCKET = 'foto';

  var STATO_APP = { in_coda: 'da_analizzare', catalogata: 'catalogata', bevuta: 'bevuta', venduta: 'venduta', regalata: 'regalata' };
  var STATO_DB  = { da_analizzare: 'in_coda', catalogata: 'catalogata', bevuta: 'bevuta', venduta: 'venduta', regalata: 'regalata' };

  var TIPI   = ['Vino', 'Spumante', 'Whisky', 'Rum', 'Gin', 'Grappa', 'Liquore', 'Altro'];
  var COLORI = ['Rosso', 'Bianco', 'Rosé'];

  /* ------------------------- convertitori ------------------------- */
  function t(v) { v = (v == null ? '' : String(v)).trim(); return v === '' ? null : v; }
  function n(v) { if (v === '' || v == null) return null; var x = Number(String(v).replace(',', '.')); return isFinite(x) ? x : null; }
  function d(v) { v = t(v); return (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) ? v : null; }
  function a(v) { return Array.isArray(v) ? v.filter(function (x) { return x != null && String(x).trim() !== ''; }).map(String) : []; }
  function uno(v, lista) { v = t(v); return (v && lista.indexOf(v) >= 0) ? v : null; }
  function s(v) { return v == null ? '' : String(v); }

  /* una bottiglia dell'interfaccia → una riga del database */
  function riga(b, cantinaId) {
    return {
      id: b.id,
      cantina_id: cantinaId,
      stato: STATO_DB[b.stato] || 'in_coda',
      nome: t(b.nome),
      produttore: t(b.produttore),
      cantina_vino: t(b.cantina),
      tipologia: uno(b.tipologia, TIPI),
      colore: uno(b.colore, COLORI),
      annata: t(b.annata),
      eta: t(b.eta),
      annata_migliore: t(b.annata_migliore),
      gradazione: n(b.gradazione),
      formato: t(b.formato),
      quantita: Math.max(0, Math.round(n(b.quantita) != null ? n(b.quantita) : 1)),
      provenienza: t(b.provenienza),
      vitigni: a(b.vitigni),
      zona: t(b.zona),
      scaffale: t(b.scaffale),
      ripiano: t(b.ripiano),
      prezzo_acquisto: n(b.prezzo_acquisto),
      prezzo_vendita: n(b.prezzo_vendita),
      valore_attuale: n(b.valore_attuale),
      valore_data: d(b.valore_data),
      valore_fonte: t(b.valore_fonte),
      note: t(b.note),
      note_analisi: t(b.note_analisi),
      campi_incerti: a(b.campi_incerti),
      confidenza: uno(b.confidenza, ['alta', 'media', 'bassa']),
      analizzata_il: d(b.analizzata_il),
      bevuta_il: d(b.bevuta_il),
      venduta_il: d(b.venduta_il),
      regalata_il: d(b.regalata_il),
      regalata_a: t(b.regalata_a),
      esempio: !!b.esempio,
      club: uno(b.club, ['privata', 'segnalata', 'vendita']) || 'privata',
      aggiunta_il: d(b.aggiunta_il) || oggi()
    };
  }

  /* una riga del database → una bottiglia dell'interfaccia */
  function bottiglia(r, storico, foto) {
    return {
      id: r.id,
      stato: STATO_APP[r.stato] || 'catalogata',
      aggiunta_il: s(r.aggiunta_il),
      foto_fronte: (foto && foto.fronte) || '',
      foto_retro: (foto && foto.retro) || '',
      nome: s(r.nome), produttore: s(r.produttore), cantina: s(r.cantina_vino),
      tipologia: s(r.tipologia), colore: s(r.colore),
      annata: s(r.annata), eta: s(r.eta), annata_migliore: s(r.annata_migliore),
      gradazione: r.gradazione == null ? '' : String(r.gradazione),
      provenienza: s(r.provenienza), vitigni: a(r.vitigni), formato: s(r.formato),
      quantita: r.quantita == null ? 1 : Number(r.quantita),
      zona: s(r.zona), scaffale: s(r.scaffale), ripiano: s(r.ripiano),
      prezzo_acquisto: r.prezzo_acquisto == null ? null : Number(r.prezzo_acquisto),
      prezzo_vendita: r.prezzo_vendita == null ? null : Number(r.prezzo_vendita),
      valore_attuale: r.valore_attuale == null ? null : Number(r.valore_attuale),
      valore_data: s(r.valore_data), valore_fonte: s(r.valore_fonte),
      note: s(r.note), note_analisi: s(r.note_analisi),
      campi_incerti: a(r.campi_incerti), confidenza: s(r.confidenza) || undefined,
      analizzata_il: s(r.analizzata_il),
      bevuta_il: s(r.bevuta_il), venduta_il: s(r.venduta_il),
      regalata_il: s(r.regalata_il), regalata_a: s(r.regalata_a),
      esempio: !!r.esempio,
      club: s(r.club) || 'privata',
      storico: storico || []
    };
  }

  function oggi() {
    var x = new Date();
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  }

  /* ------------------------- accesso ------------------------- */
  var utente = null, cantina = null;
  var ombra = {};        // id bottiglia → ultima riga scritta, serializzata
  var percorsi = {};     // id bottiglia → { fronte: percorso, retro: percorso }

  function sessione() {
    return sb.auth.getSession().then(function (r) {
      utente = (r.data && r.data.session && r.data.session.user) || null;
      return utente;
    });
  }

  /* Si entra con email e password. L'iscrizione passa dalla funzione sul
     server, che crea l'account gia' confermato: niente email da aspettare. */
  function entra(email, password) {
    return sb.auth.signInWithPassword({
      email: String(email || '').trim().toLowerCase(), password: String(password || '')
    }).then(function (r) {
      if (r.error) throw tradurre(r.error);
      utente = (r.data && r.data.user) || null;   // da qui in poi la cantina sa di chi e'
      return true;
    });
  }
  var SPIEGA_ISCR = {
    email_non_valida: 'Indirizzo email non valido.',
    password_corta: 'La password deve avere almeno dieci caratteri.',
    gia_registrato: 'Questo indirizzo ha già un accesso: entra, o chiedi una nuova password.',
    non_invitato: 'Le iscrizioni sono su invito: questo indirizzo non è in lista.',
    serve_garante: 'Serve il nome del membro che ti presenta.',
    creazione_fallita: 'Non sono riuscito a creare l’accesso. Riprova fra poco.'
  };
  function iscriviti(nome, email, password, nota, garante, citta) {
    email = String(email || '').trim().toLowerCase();
    return fetch(URL_DB + '/functions/v1/iscriviti', {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: CHIAVE, authorization: 'Bearer ' + CHIAVE },
      body: JSON.stringify({ nome: nome, email: email, password: password, nota: nota || '', garante: garante || '', citta: citta || '' })
    }).then(function (risp) {
      return risp.json().catch(function () { return {}; }).then(function (d) {
        if (!risp.ok || d.errore) throw new Error(SPIEGA_ISCR[d.errore] || d.messaggio || 'Iscrizione non riuscita.');
        return d;
      });
    }).then(function (d) {
      if (d.conferma_richiesta) return { conferma: true };
      return entra(email, password).then(function () { return { conferma: false, in_attesa: !!d.in_attesa }; });
    });
  }
  /* La password dimenticata: il link lo genera e lo manda il nostro server
     (funzione "recupera"), cosi' funziona da qualsiasi dispositivo. La porta
     lo verifica con verificaLink. scambiaCodice resta per i link vecchi. */
  function recupera(email, lingua) {
    return fetch(URL_DB + '/functions/v1/recupera', {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: CHIAVE, authorization: 'Bearer ' + CHIAVE },
      body: JSON.stringify({ email: String(email || '').trim().toLowerCase(), lingua: lingua || 'it' })
    }).then(function (risp) {
      if (!risp.ok) throw new Error('Non sono riuscito a mandare il link. Riprova fra poco.');
      return true;
    });
  }
  function verificaLink(tokenHash, tipo) {
    return sb.auth.verifyOtp({ token_hash: tokenHash, type: tipo || 'recovery' })
      .then(function (r) { if (r.error) throw tradurre(r.error); utente = (r.data && r.data.user) || null; return true; });
  }
  function scambiaCodice(codice) {
    return sb.auth.exchangeCodeForSession(codice)
      .then(function (r) { if (r.error) throw tradurre(r.error); utente = (r.data && r.data.user) || null; return true; });
  }
  function nuovaPassword(password) {
    return sb.auth.updateUser({ password: String(password || '') })
      .then(function (r) { if (r.error) throw tradurre(r.error); return true; });
  }
  /* il profilo: chi sono e che piano ho */
  function profilo() {
    return Promise.all([
      sb.from('profili').select('nome,email,piano,club_fino_a,ruolo,stato_candidatura,fondatore,citta,citta_visibile,paese,lingua,interessi,descrizione').eq('id', utente.id).maybeSingle(),
      sb.from('configurazione').select('valore').eq('chiave', 'quota_club').maybeSingle()
    ]).then(function (r) {
      var p = (r[0] && r[0].data) || {};
      return {
        nome: s(p.nome), email: s(p.email || (utente && utente.email)),
        piano: p.piano || 'private', club_fino_a: s(p.club_fino_a), ruolo: p.ruolo || 'utente',
        stato_candidatura: p.stato_candidatura || 'nessuna', fondatore: !!p.fondatore, citta: s(p.citta), citta_visibile: !!p.citta_visibile,
        paese: s(p.paese), lingua: p.lingua || 'it', interessi: a(p.interessi), descrizione: s(p.descrizione), completo: !!(s(p.nome).trim() && s(p.paese).trim()),
        quota_club: (r[1] && r[1].data && r[1].data.valore) || null
      };
    });
  }
  function mioStato() {
    return sb.rpc('mio_stato').then(function (r) { if (r.error) throw tradurre(r.error); return r.data || {}; });
  }
  function registraAccesso() {
    var disp = (navigator.userAgent || '').replace(/\(KHTML, like Gecko\)/, '').slice(0, 160);
    return sb.rpc('registra_accesso', { dispositivo: disp }).then(function () { return avvisa('accesso', ''); }).catch(function () { return null; });
  }
  function avvisa(tipo, dettaglio, email, riferimento) { return chiama('avvisa', { tipo: tipo, dettaglio: dettaglio || '', email: email || '', interesse_id: riferimento || '' }); }
  /* lo Speakeasy: funzioni del database che decidono loro cosa mostrare a chi.
     Nessuna tabella dello Speakeasy si legge direttamente. */
  function rpc(nome, args) { return sb.rpc(nome, args || {}).then(function (r) { if (r.error) throw tradurre(r.error); return r.data; }); }
  function speakeasy() {
    return Promise.all([rpc('speakeasy_config'), rpc('bacheca'), rpc('le_mie_proposte'), rpc('membri')])
      .then(function (r) { return { cfg: r[0] || {}, bacheca: r[1] || [], proposte: r[2] || {}, membri: r[3] || [] }; });
  }
  function spMembro(codice) { return rpc('membro_profilo', { p_codice: codice }); }
  function mioProfilo() { return rpc('mio_profilo'); }
  function salvaProfilo(p) { return rpc('mio_profilo_salva', { p_nome: p.nome, p_paese: p.paese, p_citta: p.citta || '', p_citta_visibile: !!p.citta_visibile, p_lingua: p.lingua || 'it', p_interessi: p.interessi || [], p_descrizione: p.descrizione || '' }); }
  function spRiapri(id) { return rpc('annuncio_riapri', { p_id: id }); }
  function spPubblica(p) { return rpc('annuncio_pubblica', { p: p }); }
  function spModifica(id, p) { return rpc('annuncio_modifica', { p_id: id, p: p }); }
  function spRinnova(id) { return rpc('annuncio_rinnova', { p_id: id }); }
  function spRitira(id) { return rpc('annuncio_ritira', { p_id: id }); }
  function spInteressa(annuncioId, prezzo, messaggio, r) { return rpc('interesse_invia', { p_annuncio: annuncioId, p_prezzo: prezzo == null ? null : prezzo, p_messaggio: messaggio || '', p_email_ok: !!r.email_ok, p_telefono: r.telefono || '', p_altro: r.altro || '' }); }
  function spControproponi(id, prezzo, testo, r) { return rpc('interesse_controproponi', { p_interesse: id, p_controprezzo: prezzo == null ? null : prezzo, p_controtesto: testo || '', p_email_ok: !!r.email_ok, p_telefono: r.telefono || '', p_altro: r.altro || '' }); }
  function spAccetta(id, r) { return rpc('interesse_accetta', { p_interesse: id, p_email_ok: !!r.email_ok, p_telefono: r.telefono || '', p_altro: r.altro || '' }); }
  function spRiconferma(id, r) { return rpc('interesse_riconferma', { p_interesse: id, p_email_ok: !!r.email_ok, p_telefono: r.telefono || '', p_altro: r.altro || '' }); }
  function spChiudiInteresse(id) { return rpc('interesse_chiudi', { p_interesse: id }); }
  function spContatti(id) { return rpc('contatti_accordo', { p_interesse: id }); }
  function spEsito(id, esito, nota) { return rpc('esito_dichiara', { p_interesse: id, p_esito: esito, p_nota: nota || '' }); }
  function spUscita(id, bottigliaId, quantita) { return rpc('conferma_uscita', { p_interesse: id, p_bottiglia: bottigliaId || null, p_quantita: quantita || null }); }
  function spSegnala(annuncioId, interesseId, motivo) { return rpc('segnala', { p_annuncio: annuncioId || null, p_interesse: interesseId || null, p_motivo: motivo }); }
  function spFotoCarica(blob) {
    var percorso = utente.id + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + '.jpg';
    return sb.storage.from('annunci').upload(percorso, blob, { upsert: false, contentType: 'image/jpeg' }).then(function (r) { if (r.error) throw tradurre(r.error); return percorso; });
  }
  function spFotoUrl(percorsi) {
    if (!percorsi || !percorsi.length) return Promise.resolve({});
    return sb.storage.from('annunci').createSignedUrls(percorsi, FIRMA_SEC).then(function (r) { var m = {}; (r.data || []).forEach(function (x) { if (x && x.path && x.signedUrl) m[x.path] = x.signedUrl; }); return m; }).catch(function () { return {}; });
  }
  function deskSpConfigura(chiave, valore) { return rpc('desk_speakeasy_configura', { p_chiave: chiave, p_valore: valore }); }
  function deskSegnalazioneChiudi(id, nota) { return rpc('desk_segnalazione_chiudi', { p_id: id, p_nota: nota || '' }); }
  function deskFondatore(email, valore) { return rpc('desk_fondatore', { email_socio: email, valore: !!valore }).then(function () { return true; }); }
  function desk() {
    return Promise.all([
      sb.from('profili').select('id,email,nome,piano,ruolo,stato_account,stato_candidatura,pagato_fino_a,club_fino_a,ultimo_accesso,accessi,nota_desk,creato_il,fondatore,presentato_da,citta,paese').order('creato_il', { ascending: false }),
      sb.from('richieste').select('id,tipo,testo,stato,creata_il,profilo_id').order('creata_il', { ascending: false }).limit(100),
      sb.from('accessi').select('quando,dispositivo,profilo_id').order('quando', { ascending: false }).limit(40),
      sb.from('notifiche').select('tipo,testo,inviata,errore,creata_il').order('creata_il', { ascending: false }).limit(40),
      sb.from('configurazione').select('chiave,valore'),
      sb.rpc('desk_segnalazioni').then(function (r) { return { data: r.error ? null : r.data }; })
    ]).then(function (res) {
      res.forEach(function (r) { if (r.error) throw tradurre(r.error); });
      var persone = res[0].data || [], byId = {};
      persone.forEach(function (p) { byId[p.id] = p; });
      var cfg = {}; (res[4].data || []).forEach(function (c) { cfg[c.chiave] = c.valore; });
      return {
        persone: persone,
        richieste: (res[1].data || []).map(function (r) { var p = byId[r.profilo_id] || {}; r.nome = p.nome; r.email = p.email; return r; }),
        accessi: (res[2].data || []).map(function (a) { var p = byId[a.profilo_id] || {}; a.nome = p.nome; a.email = p.email; return a; }),
        notifiche: res[3].data || [],
        configurazione: cfg,
        speakeasy: (res[5] && res[5].data) || null
      };
    });
  }
  function deskAccount(email, p) {
    var args = { p_email: email, p_stato: p.stato || null, p_piano: p.piano || null, p_pagato_fino_a: null, p_club_fino_a: null, p_nota: p.nota || null };
    if (p.pagato) { var d = new Date(); d.setFullYear(d.getFullYear() + 1); args.p_pagato_fino_a = d.toISOString().slice(0, 10); }
    return sb.rpc('desk_account', args).then(function (r) { if (r.error) throw tradurre(r.error); return r.data; });
  }
  function deskChiudi(id) { return sb.from('richieste').update({ stato: 'chiusa' }).eq('id', id).then(function (r) { if (r.error) throw tradurre(r.error); return true; }); }
  function deskConfigura(chiave, valore) { return sb.rpc('desk_configura', { p_chiave: chiave, p_valore: valore }).then(function (r) { if (r.error) throw tradurre(r.error); return true; }); }
  function chiediAmmissione(nota) {
    return sb.rpc('chiedi_ammissione', { nota: nota || null }).then(function (r) {
      if (r.error) throw tradurre(r.error); return r.data;
    });
  }
  function scriviAlDesk(testo) {
    return sb.from('richieste').insert({ profilo_id: utente.id, tipo: 'desk', testo: testo })
      .then(function (r) { if (r.error) throw tradurre(r.error); return true; });
  }

  function esci() {
    ombra = {}; percorsi = {}; cantina = null; utente = null;
    return sb.auth.signOut().then(function () { location.replace(location.pathname); });
  }

  /* Il database parla inglese e per errori di sistema. Qui si traduce una
     volta sola, così l'interfaccia non deve mai indovinare cosa è successo. */
  function tradurre(err) {
    var m = String((err && err.message) || err || '');
    var SP_ERR = {
      sp_non_membro: 'Lo Speakeasy è riservato ai membri approvati.', sp_sospeso: 'Lo Speakeasy è in pausa: per ora niente nuove proposte.', sp_chiuso: 'Lo Speakeasy è chiuso.',
      sp_profilo_incompleto: 'Completa prima il profilo: nome, Paese e lingua.', sp_troppi_annunci: 'Hai già il massimo di bottiglie in bacheca: ritirane una o aspetta che si concluda.',
      sp_bottiglia_non_tua: 'Questa bottiglia non è nella tua cantina.', sp_bottiglia_non_disponibile: 'Questa bottiglia non è più disponibile in cantina.', sp_gia_in_bacheca: 'Questa bottiglia è già in bacheca.',
      sp_annuncio_non_trovato: 'Annuncio non trovato.', sp_annuncio_non_modificabile: 'L’annuncio è in trattativa: prima dichiarate l’esito.', sp_annuncio_non_disponibile: 'Questa bottiglia non è più disponibile.',
      sp_annuncio_non_rinnovabile: 'Questo annuncio non si può rinnovare.', sp_annuncio_non_ritirabile: 'Questo annuncio non si può ritirare.', sp_prima_dichiara_esito: 'C’è una trattativa in corso: prima dite com’è andata.',
      sp_e_tuo: 'È la tua bottiglia.', sp_interesse_gia_inviato: 'Hai già una proposta in corso su questa bottiglia.', sp_prezzo_obbligatorio: 'Serve il prezzo totale del lotto.', sp_prezzo_non_valido: 'Prezzo non valido.',
      sp_prezzo_non_previsto: 'Per lo scambio non si indica un prezzo.', sp_proposta_non_trovata: 'Proposta non trovata.', sp_non_tuo: 'Questa proposta non ti riguarda.', sp_non_tocca_a_te: 'Ora la risposta spetta all’altro membro.',
      sp_proposta_non_modificabile: 'Questa proposta non si può più cambiare.', sp_proposta_superata: 'I termini sono cambiati: la proposta va rifatta.', sp_proposta_non_accettabile: 'Questa proposta non è più accettabile.',
      sp_gia_in_trattativa: 'Un’altra proposta è già in trattativa su questa bottiglia.', sp_serve_un_recapito: 'Scegli almeno un recapito.', sp_recapiti_mancanti: 'Mancano i recapiti di una delle due parti.',
      sp_contatti_non_disponibili: 'I recapiti si vedono solo dopo che entrambi avete accettato.', sp_contatti_scaduti: 'I recapiti di questa trattativa non sono più conservati.',
      sp_esito_non_dichiarabile: 'Non c’è una trattativa da chiudere.', sp_esito_gia_dichiarato: 'L’esito è già stato dichiarato.', sp_esito_non_valido: 'Esito non valido.',
      sp_uscita_non_prevista: 'Nessuna uscita da registrare per questa trattativa.', sp_bottiglia_mancante: 'Indica quale bottiglia è uscita.', sp_motivo_obbligatorio: 'Scrivi il motivo della segnalazione.',
      sp_solo_desk: 'Solo il Desk.', sp_nome_obbligatorio: 'Serve il nome.', sp_paese_obbligatorio: 'Serve il Paese.', sp_tipo_non_modificabile: 'Vendo o scambio non si cambia: ritira e ripubblica.',
      sp_tipo_non_valido: 'Scegli vendo o scambio.', sp_categoria_non_valida: 'Scegli vino o distillato.', sp_nome_bottiglia_obbligatorio: 'Serve l’etichetta.', sp_lotto_non_valido: 'Quantità del lotto non valida.', sp_valore_non_valido: 'Valore non valido.',
      sp_lotto_oltre_giacenza: 'Il lotto supera le bottiglie che hai in cantina.', sp_controproposta_vuota: 'Scrivi cosa proponi in cambio.', sp_annuncio_non_riapribile: 'Questo annuncio non è in pausa.',
      sp_segnalazione_incoerente: 'Segnalazione non coerente con la proposta.', sp_lingua_non_valida: 'Lingua non valida.', sp_chiave_non_modificabile: 'Impostazione non modificabile.'
    };
    var cod = (m.match(/\bsp_[a-z_]+\b/) || [])[0];
    if (cod && SP_ERR[cod]) return new Error(SP_ERR[cod]);
    if (/invalid login credentials|invalid_credentials/i.test(m))
      return new Error('Email o password non corrispondono. Riprova, o chiedi una nuova password.');
    if (/email not confirmed/i.test(m))
      return new Error('Devi ancora confermare l’indirizzo: guarda nella posta.');
    if (/not\s+fra\s+gli\s+invitati|invitati di Caveau/i.test(m))
      return new Error('Questo indirizzo non è fra gli invitati.');
    if (/Database error (saving|creating)/i.test(m))
      return new Error('Questo indirizzo non è fra gli invitati.');
    if (/rate limit|too many/i.test(m))
      return new Error('Troppi tentativi ravvicinati: riprova fra un minuto.');
    if (/Invalid|malformed|email/i.test(m) && /email/i.test(m))
      return new Error('Indirizzo email non valido.');
    if (/Failed to fetch|NetworkError/i.test(m))
      return new Error('Nessuna connessione: l’archivio non risponde.');
    if (/row-level security|violates/i.test(m))
      return new Error('Il database ha rifiutato la scrittura: non è la tua cantina.');
    return new Error(m || 'Qualcosa non ha funzionato.');
  }

  /* ------------------------- lettura ------------------------- */
  function mia() {
    return sb.from('cantine').select('*').eq('proprietario', utente.id).maybeSingle()
      .then(function (r) {
        if (r.error) throw tradurre(r.error);
        if (r.data) return r.data;
        /* Normalmente la cantina nasce da sola all'iscrizione. Questo è il
           paracadute per chi si è iscritto prima che il meccanismo esistesse. */
        return sb.from('cantine').insert({ proprietario: utente.id }).select().single()
          .then(function (x) { if (x.error) throw tradurre(x.error); return x.data; });
      });
  }

  function firma(elenco) {
    if (!elenco.length) return Promise.resolve({});
    return sb.storage.from(BUCKET).createSignedUrls(elenco, FIRMA_SEC).then(function (r) {
      var m = {};
      (r.data || []).forEach(function (x) { if (x && x.path && x.signedUrl) m[x.path] = x.signedUrl; });
      return m;
    }).catch(function () { return {}; });
  }

  function carica() {
    return mia().then(function (c) {
      cantina = c;
      return Promise.all([
        sb.from('bottiglie').select('*').eq('cantina_id', c.id).order('aggiunta_il', { ascending: false }),
        sb.from('quotazioni').select('bottiglia_id,vetrina,fonte,rilevata_il').eq('cantina_id', c.id).order('rilevata_il', { ascending: true }),
        sb.from('foto').select('bottiglia_id,lato,percorso').eq('cantina_id', c.id)
      ]);
    }).then(function (res) {
      res.forEach(function (r) { if (r.error) throw tradurre(r.error); });
      var righe = res[0].data || [], quot = res[1].data || [], fot = res[2].data || [];

      var perBott = {};
      quot.forEach(function (q) {
        (perBott[q.bottiglia_id] = perBott[q.bottiglia_id] || [])
          .push({ data: s(q.rilevata_il), vetrina: q.vetrina == null ? null : Number(q.vetrina), fonte: s(q.fonte) });
      });

      percorsi = {};
      var tutti = [];
      fot.forEach(function (f) {
        if (!f.bottiglia_id) return;
        (percorsi[f.bottiglia_id] = percorsi[f.bottiglia_id] || {})[f.lato] = f.percorso;
        tutti.push(f.percorso);
      });

      return firma(tutti).then(function (url) {
        ombra = {};
        var bottles = righe.map(function (r) {
          ombra[r.id] = JSON.stringify(riga(bottiglia(r, perBott[r.id] || [], null), cantina.id));
          var p = percorsi[r.id] || {};
          return bottiglia(r, perBott[r.id] || [], { fronte: url[p.fronte] || '', retro: url[p.retro] || '' });
        });
        var ultima = quot.length ? quot[quot.length - 1].rilevata_il : '';
        ombra.__meta = JSON.stringify({
          titolo: cantina.titolo || 'La mia cantina',
          sottotitolo: cantina.sottotitolo || '',
          valuta: cantina.valuta || 'EUR',
          resa_privata: n(cantina.resa_privata), resa_asta: n(cantina.resa_asta),
          soglia_vendita: n(cantina.soglia_vendita), mappa: mappaPulita(cantina.mappa)
        });
        return {
          meta: {
            titolo: cantina.titolo || 'La mia cantina',
            sottotitolo: cantina.sottotitolo || 'La tua cantina, ordinata e sotto controllo.',
            valuta: cantina.valuta || 'EUR',
            resa_privata: Number(cantina.resa_privata), resa_asta: Number(cantina.resa_asta),
            soglia_vendita: Number(cantina.soglia_vendita),
            mappa: mappaPulita(cantina.mappa),
            ultimoAggQuotazioni: s(ultima)
          },
          bottles: bottles
        };
      });
    });
  }

  /* ------------------------- scrittura ------------------------- */
  function daDataUrl(u) {
    var i = u.indexOf(','), testa = u.slice(0, i), grezzo = atob(u.slice(i + 1));
    var tipo = (testa.match(/data:([^;]+)/) || [, 'image/jpeg'])[1];
    var buf = new Uint8Array(grezzo.length);
    for (var k = 0; k < grezzo.length; k++) buf[k] = grezzo.charCodeAt(k);
    return new Blob([buf], { type: tipo });
  }

  function mandaFoto(b, lato) {
    var val = b['foto_' + lato];
    if (!val || val.slice(0, 5) !== 'data:') return Promise.resolve(null);
    var blob = daDataUrl(val);
    var percorso = cantina.id + '/' + b.id + '-' + lato + '.jpg';
    return sb.storage.from(BUCKET).upload(percorso, blob, { upsert: true, contentType: blob.type || 'image/jpeg' })
      .then(function (r) {
        if (r.error) throw tradurre(r.error);
        return sb.from('foto').upsert(
          { cantina_id: cantina.id, bottiglia_id: b.id, lato: lato, percorso: percorso, byte: blob.size },
          { onConflict: 'bottiglia_id,lato' });
      })
      .then(function (r) {
        if (r && r.error) throw tradurre(r.error);
        (percorsi[b.id] = percorsi[b.id] || {})[lato] = percorso;
        return sb.storage.from(BUCKET).createSignedUrl(percorso, FIRMA_SEC);
      })
      .then(function (r) {
        var u = r && r.data && r.data.signedUrl;
        if (u) b['foto_' + lato] = u;       // in memoria il link firmato prende il posto del blocco base64
        return percorso;
      });
  }

  /* La mappa della cantina (sezioni → scaffali → ripiani) viaggia come JSON
     nella colonna cantine.mappa: qui la si ripulisce in entrata e in uscita. */
  function mappaPulita(m) {
    var sz = (m && Array.isArray(m.sezioni)) ? m.sezioni : [], CAT = ['rosso', 'bianco', 'rose', 'spumante', 'distillato', 'altro'];
    var out = { sezioni: sz.map(function (x, i) {
      return { id: String(x.id || ('s' + (i + 1))), nome: String(x.nome || ('Sezione ' + (i + 1))).trim().slice(0, 60),
        scaffali: Math.max(0, Math.min(200, parseInt(x.scaffali, 10) || 0)), ripiani: Math.max(0, Math.min(50, parseInt(x.ripiani, 10) || 0)),
        categorie: (Array.isArray(x.categorie) ? x.categorie : []).filter(function (c) { return CAT.indexOf(c) !== -1; }) };
    }) };
    if (m && m.standard) out.standard = true;
    if (m && m.personalizzata) out.personalizzata = true;
    return out;
  }
  function salva(stato) {
    if (!cantina) return Promise.reject(new Error('Cantina non aperta.'));
    var lavori = [];

    /* 1 — le impostazioni della cantina */
    var m = stato.meta || {};
    var nuovaMeta = {
      titolo: m.titolo || 'La mia cantina',
      sottotitolo: m.sottotitolo || '',
      valuta: m.valuta || 'EUR',
      resa_privata: n(m.resa_privata), resa_asta: n(m.resa_asta), soglia_vendita: n(m.soglia_vendita), mappa: mappaPulita(m.mappa)
    };
    var chiaveMeta = JSON.stringify(nuovaMeta);
    if (chiaveMeta !== ombra.__meta) {
      lavori.push(sb.from('cantine').update(nuovaMeta).eq('id', cantina.id).then(function (r) {
        if (r.error) throw tradurre(r.error);
        ombra.__meta = chiaveMeta;
      }));
    }

    /* 2 — le bottiglie: solo quelle cambiate, e solo quelle sparite */
    var righe = (stato.bottles || []).map(function (b) { return riga(b, cantina.id); });
    var vive = {}; righe.forEach(function (r) { vive[r.id] = 1; });
    var cambiate = righe.filter(function (r) { return ombra[r.id] !== JSON.stringify(r); });
    var sparite = Object.keys(ombra).filter(function (k) { return k !== '__meta' && !vive[k]; });

    var scrittura = Promise.resolve();
    if (cambiate.length) {
      scrittura = sb.from('bottiglie').upsert(cambiate).then(function (r) {
        if (r.error) throw tradurre(r.error);
        cambiate.forEach(function (x) { ombra[x.id] = JSON.stringify(x); });
      });
    }

    if (sparite.length) {
      var files = [];
      sparite.forEach(function (id) {
        var p = percorsi[id] || {};
        if (p.fronte) files.push(p.fronte);
        if (p.retro) files.push(p.retro);
        delete percorsi[id];
      });
      scrittura = scrittura
        .then(function () { return files.length ? sb.storage.from(BUCKET).remove(files) : null; })
        .then(function () { return sb.from('bottiglie').delete().in('id', sparite); })
        .then(function (r) {
          if (r && r.error) throw tradurre(r.error);
          sparite.forEach(function (id) { delete ombra[id]; });
        });
    }

    /* 3 — le foto arrivate come blocco base64 vanno nello spazio privato.
           Dopo le righe, mai prima: una foto senza la sua bottiglia il
           database non la accetta. */
    lavori.push(scrittura.then(function () {
      var conFoto = (stato.bottles || []).filter(function (b) {
        return (b.foto_fronte && b.foto_fronte.slice(0, 5) === 'data:') ||
               (b.foto_retro && b.foto_retro.slice(0, 5) === 'data:');
      });
      if (!conFoto.length) return null;
      return conFoto.reduce(function (c, b) {
        return c.then(function () { return mandaFoto(b, 'fronte'); })
                .then(function () { return mandaFoto(b, 'retro'); });
      }, Promise.resolve()).then(function () { return 'foto'; });
    }));

    return Promise.all(lavori);
  }

  /* ------------------------- il motore ------------------------- */
  /* Le funzioni sul server sono l'unica parte che l'app non può fare da sé:
     là dentro vive la chiave del modello, e non esce. Qui si chiamano e basta. */
  var SPIEGA = {
    chiave_mancante: 'Il motore non ha ancora la sua chiave.',
    non_autorizzato: 'Sessione scaduta: esci e rientra.',
    serve_bottiglia_id: 'Bottiglia non indicata.',
    bottiglia_non_trovata: 'Questa bottiglia non è più nella tua cantina.',
    nessuna_foto: 'Questa bottiglia non ha foto da leggere.',
    foto_illeggibili: 'Le foto non si aprono: riprova a scattarle.',
    motore_non_raggiungibile: 'Il motore non risponde. Riprova fra poco.',
    lettura_non_interpretabile: 'L’etichetta non si è lasciata leggere. Compila a mano o rifai la foto.',
    salvataggio_fallito: 'Lettura riuscita, scrittura no. Riprova.'
  };

  function chiama(nome, corpo) {
    return sb.auth.getSession().then(function (r) {
      var tok = r.data && r.data.session && r.data.session.access_token;
      if (!tok) throw new Error('Sessione scaduta: esci e rientra.');
      return fetch(URL_DB + '/functions/v1/' + nome, {
        method: 'POST',
        headers: { 'content-type': 'application/json', apikey: CHIAVE, authorization: 'Bearer ' + tok },
        body: JSON.stringify(corpo || {})
      });
    }).then(function (risp) {
      return risp.json().catch(function () { return {}; }).then(function (d) {
        if (!risp.ok || d.errore) {
          throw new Error(SPIEGA[d.errore] || d.messaggio || ('Il motore ha risposto ' + risp.status + '.'));
        }
        return d;
      });
    });
  }

  function cataloga(bottigliaId) { return chiama('cataloga', { bottiglia_id: bottigliaId, lingua: window.CAVEAU_LINGUA || ((navigator.language || 'it').slice(0, 2) === 'en' ? 'en' : 'it') }); }

  /* ------------------------- fuori ------------------------- */
  window.CELL = {
    sb: sb,
    sessione: sessione,
    entra: entra,
    iscriviti: iscriviti,
    recupera: recupera,
    nuovaPassword: nuovaPassword,
    profilo: profilo,
    mioStato: mioStato,
    registraAccesso: registraAccesso,
    avvisa: avvisa,
    desk: desk, deskAccount: deskAccount, deskChiudi: deskChiudi, deskConfigura: deskConfigura,
    chiediAmmissione: chiediAmmissione,
    scriviAlDesk: scriviAlDesk,
    esci: esci,
    carica: carica,
    salva: salva,
    cataloga: cataloga,
    verificaLink: verificaLink, scambiaCodice: scambiaCodice,
    speakeasy: speakeasy, spMembro: spMembro, mioProfilo: mioProfilo, salvaProfilo: salvaProfilo,
    spPubblica: spPubblica, spModifica: spModifica, spRinnova: spRinnova, spRiapri: spRiapri, spRitira: spRitira,
    spInteressa: spInteressa, spControproponi: spControproponi, spAccetta: spAccetta, spRiconferma: spRiconferma, spChiudiInteresse: spChiudiInteresse,
    spContatti: spContatti, spEsito: spEsito, spUscita: spUscita, spSegnala: spSegnala, spFotoCarica: spFotoCarica, spFotoUrl: spFotoUrl,
    deskSpConfigura: deskSpConfigura, deskSegnalazioneChiudi: deskSegnalazioneChiudi, deskFondatore: deskFondatore,
    utente: function () { return utente; },
    cantina: function () { return cantina; }
  };
})();
