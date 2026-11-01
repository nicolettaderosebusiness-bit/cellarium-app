# Caveau — l'interfaccia dell'app

Questo repository contiene **solo il vestito** di Caveau: la pagina, il
foglio di stile, il codice che disegna le schede. È pubblico perché lo è
comunque: qualunque app web consegna al browser il proprio HTML e il proprio
JavaScript, e chi apre gli strumenti da sviluppatore li legge. Nasconderlo
sarebbe una finzione, non una misura di sicurezza.

**Qui dentro non c'è nulla di riservato.**

| Cosa | Dove vive |
|---|---|
| Interfaccia (questo repository) | pubblica, per forza di cose |
| Dati delle cantine | database privato, una riga per proprietario |
| Foto | archivio privato, aperto solo da link firmati che scadono |
| Motore di lettura e riquotazione | funzioni sul server |
| Chiavi dei modelli | segreti del progetto, mai nel browser |
| Elenco degli invitati | database, gestito da chi amministra |

La chiave che compare in `dati.js` è la **chiave pubblicabile**: è fatta per
stare nel browser. Da sola non apre niente — è il database, riga per riga, a
decidere che cosa può vedere chi la usa. Una copia di questo repository è un
guscio vuoto: nessuna cantina, nessuna foto, nessuno storico.

## Struttura

    index.html              la porta: iscrizione con email e password, oppure ingresso
    app.js                  l'applicazione
    dati.js                 l'unico file che parla col database
    supabase.js             la libreria del database
    sw.js                   il guardiano dell'involucro (installazione e rete lenta)
    manifest.webmanifest    quello che rende l'app installabile
    icona-*.png             il marchio

## Pubblicare una versione nuova

1. Sostituisci i file.
2. Cambia `VERSIONE` in `sw.js` (es. `caveau-16.1`).

Senza il passo 2 chi ha già installato l'app continua a vedere la versione
vecchia: il guardiano serve la copia che ha in cache finché il nome non cambia.

## Piani

Ogni persona si iscrive da sola e ha la sua cantina (piano `private`). Il piano `club` apre la stanza Speakeasy: lo imposta il desk con `select desk_imposta('email', 'club');` dal database, dopo colloquio e quota. La modalità di iscrizione (`aperta` o `invito`) sta nella tabella `configurazione`.
