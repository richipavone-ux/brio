# Improve Brio

_Started 2026-10-11 19:02 UTC_

---

## User

improve brio

## Assistant



## Assistant

_[tool: ask_user]_

I've put up a short form. I need to know what Brio is, and screenshots or code help most, before I can start improving it.

## User

Answered — what: is an app that helps you manage your diabetes; screens: v2.5 BrioSalute.html; problems: try to improve it.; scope: Onboarding, Home / dashboard, Navigation, Core flow, Settings, Visual polish; platform: iOS; variations: Both: explore, then prototype the winner

## Assistant

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: update_todos]_

_[tool: dc_write]_

_[tool: ready_for_verification]_

I've put three directions for Brio's home screen and navigation on one canvas, each with its matching meal-plan screen. They all use the same example: pizza at 13:10, with the second dose due at 14:40.

- **1a Clear tabs:** a standard four-tab bar, a glucose card with a 24-hour chart, and a "Next up" card for the meal in progress.
- **1b One thing now:** keeps Brio's "what matters now" focus, but the hidden orb gestures become a labeled dock (Glucose, New meal, Ask Brio).
- **1c Day feed:** your day as a timeline, with the next steps at the top. You tell Brio what you're eating in a chat-style box.
- **1d Onboarding and settings:** works with any of the three. Onboarding asks one number per screen, and Settings keeps your treatment numbers separate from appearance options.

The icons are placeholder shapes, and the screens are static for now. Pick a direction, or mix parts from different ones, and I'll turn it into a working prototype.

## User

Found issues — fixing…

## Assistant

_[tool: run_script]_

_[tool: ready_for_verification]_

I fixed the glucose charts in 1a and 1c. They were blank because the page's support file isn't loading, so I wrote the chart values straight into the screens and they no longer depend on that file.

That file still shows a load error in the preview. Nothing on the current screens needs it, but the working prototype will, so I'll check it again before building.

Pick 1a, 1b or 1c, or a mix, and I'll make it the prototype.

## User

secondo me non hai capito niente. l'idea dell'orb è il concetto chiave, futuristico. cambia il modo di interagire, non è più un app ma un buddy che ti aiuta

## User

Found issues — fixing…

## User

Found issues — fixing…

## Assistant

_[tool: run_script]_

_[tool: ready_for_verification]_

Nelle schermate del giro 2 gli orb non comparivano: al loro posto si vedevano codici di testo, come "{{ ringsA }}", perché il file di supporto della pagina non si carica. Li ho riscritti direttamente nelle schermate. Dopo la correzione non restano codici di testo nella pagina, ma non l'ho ancora guardata renderizzata dopo questa modifica.

L'errore sul file di supporto resta e servirà per il prototipo interattivo, quindi lo ricontrollo prima di costruirlo. Dimmi quale direzione prendere tra 2a, 2b e 2c, o cosa mescolare.

## User

L'idea è lavorare sulla versione due. A mi piace ovviamente tieni l'orbe che avevi prima mi piace molto di più quello quello che ho inventato io sull'applicazione però l'idee proprio quella vorrei cominciare magari da un concetto un po' più semplice di io che creo tutti i log, li posso modificare manualmente, dicendo e poi piano piano, lasciare la possibilità comunque di interagire solo col l'orb. Prova a darmi idee su come può essere questa cosa magari da me dammi più slide ed idee anche di notification fuori dall'App, anche di com interagisce dentro il proprio iPhone

## Assistant

_[tool: grep]_

_[tool: read_file]_

_[tool: run_script]_

_[tool: ready_for_verification]_

Ho aggiunto in cima alla pagina il giro 3, con 11 schermate: Brio cresce con te, dal registrare da solo fino al solo orb. Ho usato il tuo orb con gli occhi e lo stesso gradiente blu-viola-rosa dell'app. La pagina ci ha messo più del solito a caricarsi e non l'ho ancora guardata renderizzata.

**Dentro l'app, tre livelli:**
- **3a · Livello 1, registro io:** la lista dei log di oggi, con l'orb tra "+ Meal" e "+ Glucose". Ogni log si modifica a mano, oppure dici all'orb cosa è cambiato.
- **3b · Livello 2, lo dico:** tieni premuto l'orb su un log, dici "era solo mezza pizza" e Brio mostra il prima e il dopo, ricalcola le dosi e aspetta il tuo OK.
- **3c · Livello 3, solo orb:** schermata vuota con l'orb e i gesti scritti sotto, più la scelta del livello. È l'orb stesso a proporti di passare al livello successivo quando vede che usi molto la voce.

**Fuori dall'app:**
- **3d:** Live Activity sulla schermata di blocco con il conto alla rovescia per la dose. Tenendo premuta la notifica confermi, cambi le unità o rispondi senza aprire Brio.
- **3e:** Dynamic Island aperta, widget interattivi e gli stati dell'isola: compatta, minima, "ha bisogno di te", notte.
- **3f:** tasto Azione o Siri. L'orb sale dal basso sopra qualsiasi app e registri il pasto senza uscire, per esempio, da Messaggi.
- **3g:** StandBy di notte. L'orb dorme in rosso per non disturbare e ti sveglia solo se serve.

Testi dell'interfaccia e note sul canvas sono in inglese, come nell'app. Se vuoi, li traduco in italiano.

Possibili prossimi passi: un prototipo cliccabile del percorso 3a → 3b → 3c, gli stati di allarme della Live Activity (ipoglicemia, dose saltata) o una versione per Apple Watch.

## User

mi piace la prima versione prototipala

## User

mi piace la prima versione prototipala

## User

Found issues — fixing…

## User

Found issues — fixing…

## Assistant

_[tool: read_file]_

_[tool: read_file]_

_[tool: show_html]_

_[tool: show_html]_

The page's runtime file won't load here, so I'm rebuilding the prototype as a standalone page.

_[tool: write_file]_

_[tool: delete_file]_

_[tool: ready_for_verification]_

Il primo prototipo non funzionava: si vedevano i codici di testo e tutte le schede erano aperte insieme. Il file di supporto della pagina non si carica in questo ambiente, quindi ho rifatto il prototipo come pagina autonoma, `Brio Prototype.html`, che non ne ha bisogno, e ho cancellato la versione che non funzionava. È in corso un controllo automatico che mi segnala eventuali problemi.

Le funzioni sono le stesse: Today, modifica dei log, + Meal con la dose divisa per i pasti grassi, + Glucose, e l'orb con la voce simulata che mostra il prima e il dopo.

Con questa versione si perdono le regolazioni (soglia dei grassi, percentuale della prima dose, suggerimento "Tap to talk"): ora quei valori sono fissi nel codice.

## User

torna alle proposte

## Assistant

_[tool: show_to_user]_

Ti ho riaperto le proposte, `Brio Redesign.dc.html`: il giro 3 è in cima e sotto ci sono i giri precedenti. Il prototipo resta in `Brio Prototype.html`.

## User

aggiungi i comandi manuali sull'orb come nell'artefatto.

l'esperienza deve essere full customizable se voglio altrimenti di base deve essere semplice quasi ridicola

i meal log dell'artefatto hanno info utili. trova il modo di semplificare e farlo star bene nell'app, senza complicare l'esperienza

## Assistant

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: run_script]_

_[tool: ready_for_verification]_

Ho aggiunto il giro 4 in cima alle proposte, con 7 schermate. Non l'ho ancora visto renderizzato: c'è un controllo automatico in corso.

- **4a · Home semplice (default):** solo l'orb, una frase e la glicemia. Toccando l'orb si apre la scheda "what matters now" con la prossima azione e i pulsanti "Took it" / "Change".
- **4b · Comandi manuali sull'orb, come in v2.5:** tap per la prossima cosa da fare, doppio tap per un nuovo pasto, tenere premuto per la settimana (con l'anello che si riempie), swipe su per Memory. Sotto l'orb ci sono i suggerimenti, solo per le prime volte.
- **4c · Meal log semplificato:** le sezioni di v2.5 (Mission, Curve, Brio remembers, On the plate, Logs) diventano un solo grafico, con la tua glicemia contro la previsione di Brio e sotto dosi e controlli. Il ricordo di Brio è una riga ("Third pizza this month…"), il resto sta chiuso in tre righe da aprire. In Memory ogni pasto ha l'anello di avanzamento dei controlli.
- **4d · Personalizzazione:** tre preset (Simple di default, Balanced, Everything), interruttori per cosa mostrare in home, e ogni gesto dell'orb si può riassegnare.

Il prototipo cliccabile (`Brio Prototype.html`) è ancora la versione con la lista, non questa. Se la direzione ti convince, posso prototipare 4a e 4b con i gesti veri.

## User

Check didn’t complete

## User

Check didn’t complete

## User

Found issues — fixing…

## Assistant

_[tool: run_script]_

_[tool: ready_for_verification]_

Ho sistemato la 4b: le quattro schede dei gesti si sovrapponevano e ora ognuna resta nella sua colonna. Non l'ho riguardata dopo la correzione. Il resto del giro 4 era già stato controllato ed era a posto.

L'errore sul file di supporto resta, ma non tocca queste schermate statiche, che si vedono comunque per intero.

## User

perfetto, mi piace molto! mantieni questa versione ed spiega piu in dettaglio come si fa il meal log.

## Assistant

_[tool: write_file]_

_[tool: run_script]_

_[tool: run_script]_

_[tool: delete_file]_

_[tool: ready_for_verification]_

Ho aggiunto il giro 5 in cima: il meal log passo per passo, dal doppio tap alla chiusura del pasto. Il giro 4 resta com'era. Non ho ancora visto le schermate renderizzate: c'è un controllo automatico in corso.

**5a · Prima di mangiare**
1. **Doppio tap sull'orb:** scegli foto, voce o testo, e sotto ci sono i pasti abituali con "Repeat".
2. **Foto del piatto:** l'orb la legge in diretta.
3. **Controlla cosa ha letto Brio:** una riga per ogni alimento, la quantità che mangerai (da ¼ a tutto) e i totali che si aggiornano.
4. **La dose:** il totale, la divisione in due per i pasti grassi con il motivo in una frase, e il calcolo completo sotto. Confermi tu quanto hai fatto davvero.

**5b · Dopo aver mangiato**
5. **Home:** l'orb mostra una frase e in basso c'è una piccola timeline di dosi e controlli.
6. **Notifica del controllo:** alle 15:10 Brio ti chiede la glicemia. Con il sensore confermi, senza lo scrivi direttamente nella notifica.
7. **Pasto chiuso:** picco, tempo in range e differenza rispetto alla previsione. Brio se lo ricorda per la prossima volta.

Tu intervieni solo in quattro passi (1, 3, 4 e 6); il resto lo fa Brio da solo.

## User

aggiungi anche l'iob e gli avvisi ipo e poi siamo pronti per andare online.

## Assistant

_[tool: write_file]_

_[tool: run_script]_

_[tool: run_script]_

_[tool: delete_file]_

_[tool: ready_for_verification]_

Ho aggiunto il giro 6 in cima, con IOB e avvisi ipo. Non ho ancora visto le schermate renderizzate: c'è un controllo automatico in corso.

**6a · Insulina attiva (IOB)**
- **Anello accanto alla glicemia:** è piccolo e non occupa spazio. Toccandolo si apre una scheda con quanta insulina sta ancora lavorando, quando finisce, la dose prevista e da dove arriva ogni unità.
- **Protezione dall'accumulo:** se vuoi correggere un valore alto, Brio sottrae l'insulina ancora attiva. Se basta già quella, ti suggerisce di aspettare e ti dice quando ricontrolla.

**6b · Avvisi ipo**
- **"Stai scendendo":** l'orb diventa arancione con la previsione a 20 minuti e ti dice cosa mangiare e quanto.
- **Ipo urgente:** è un avviso critico che suona anche in silenzioso e di notte. Se non rispondi, Brio scrive al tuo contatto.
- **Regola dei 15:** dopo lo zucchero parte un timer di 15 minuti. Brio ti chiede di nuovo il valore e si ferma da solo quando sei tornato in range.
- **Impostazioni avvisi:** soglie, modalità notte e contatto di emergenza. L'avviso urgente resta sempre attivo.

Prima di andare online:
- **Sono schermate statiche:** l'unica parte cliccabile è `Brio Prototype.html`, che usa ancora la vecchia versione con la lista.
- **Numeri di esempio:** soglie, rapporti, durata dell'insulina e il contatto "Giulia" li ho inventati io. Vanno decisi con un medico.

Se vuoi, preparo un file unico da condividere o un pacchetto per lo sviluppatore.

