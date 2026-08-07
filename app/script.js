/* ══════════════════════════════════════════════════════════════
   CURRICULAB — script.js
   
   MODIFICHE PRINCIPALI rispetto alla versione precedente:
   - generaPDF(): rimosso html2pdf (PDF-immagine) → blob URL +
     window.print() = PDF con testo selezionabile, leggibile dagli ATS
   - Aggiunte sezioni: Formazione, Lingue, Certificazioni
   - ATS Score in tempo reale (7 check)
   - salvaCandidato(): fix bug (supabase → supabaseClient)
   - testDatabase() e banner TEST DATABASE: rimossi
   ══════════════════════════════════════════════════════════════ */


/* ── Costanti ─────────────────────────────────────────────────── */
const LIVELLI_QCER = [
    'Madrelingua',
    'C2 – Padronanza',
    'C1 – Autonomia',
    'B2 – Indipendenza',
    'B1 – Soglia',
    'A2 – Sopravvivenza',
    'A1 – Contatto'
];

/* Contatori per le sezioni dinamiche */
let expCount  = 0;
let forCount  = 0;
let linCount  = 0;
let certCount = 0;

/* Shorthand — dichiarati prima di tutto: il resto dell'app (form,
   anteprima, export PDF) non deve mai dipendere dal caricamento di
   Supabase per funzionare. */
const g = id => document.getElementById(id);
const esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');


/* ── Supabase ─────────────────────────────────────────────────────
   Se lo script esterno di Supabase non si carica (rete, ad-blocker,
   CDN irraggiungibile) supabaseClient resta null: salvaCandidato()
   fallisce in silenzio invece di bloccare il resto dello script. */
const supabaseUrl = 'https://tpjqblsrdcnqlxqdztql.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwanFibHNyZGNucWx4cWR6dHFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MjkyOTksImV4cCI6MjA5NjMwNTI5OX0.Fso3AZHVaWgjLWp7Pq5CKLx9nkvoGlFVBCj4r1N3gr8';
let supabaseClient = null;
try {
    supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
} catch (err) {
    console.error('Supabase non disponibile, il salvataggio del profilo sarà disattivato:', err);
}

/* Salva il profilo nel database Tipak.
   Lancia un errore se il salvataggio fallisce (Supabase non
   disponibile, RLS che blocca la scrittura, ecc.) — chi chiama
   questa funzione deve sapere se ha davvero funzionato, non deve
   mai dare per scontato il successo. */
async function salvaCandidato(datiUtente) {
    if (!supabaseClient) throw new Error('Supabase non disponibile');

    const { data, error } = await supabaseClient
        .from('candidati')
        .upsert([{
            email: datiUtente.email,
            nome: datiUtente.nome,
            cognome: datiUtente.cognome,
            dati_cv: datiUtente
        }]);

    if (error) throw error;
    console.log('Profilo salvato su Tipak:', data);
}


/* ══════════════════════════════════════════════════════════════
   INIT — chiamato da onload
   ══════════════════════════════════════════════════════════════ */
function init() {
    try {
        const saved = localStorage.getItem('cv_builder_autosave');
        if (!saved) {
            /* Prima visita: aggiungi un box vuoto per le sezioni principali */
            aggiungiEsperienza();
            aggiungiFormazione();
            aggiungiLingua();
            aggiornaCV();
            return;
        }

        const data = JSON.parse(saved);

        /* Campi statici */
        const sv = (id, val) => { const el = g(id); if (el && val !== undefined) el.value = val; };
        sv('input-nome',     data.nome);
        sv('input-cognome',  data.cognome);
        sv('input-titolo',   data.titolo);
        sv('input-email',    data.email);
        sv('input-tel',      data.tel);
        sv('input-citta',    data.citta);
        sv('input-linkedin', data.linkedin);
        sv('input-bio',      data.bio);
        sv('input-skills',   data.skills);

        /* Esperienze */
        const espC = g('esperienze-container');
        espC.innerHTML = '';
        expCount = 0;
        if (data.esperienze && data.esperienze.length) {
            data.esperienze.forEach(e => {
                expCount++;
                const box = creaBoxEsperienza(expCount);
                box.querySelector('.in-ruolo').value   = e.ruolo   || '';
                box.querySelector('.in-azienda').value = e.azienda || '';
                box.querySelector('.in-date').value    = e.date    || '';
                box.querySelector('.in-desc').value    = e.desc    || '';
                espC.appendChild(box);
            });
        } else {
            aggiungiEsperienza();
        }

        /* Formazione */
        const forC = g('formazione-container');
        forC.innerHTML = '';
        forCount = 0;
        if (data.formazione && data.formazione.length) {
            data.formazione.forEach(f => {
                forCount++;
                const box = creaBoxFormazione(forCount);
                box.querySelector('.in-for-titolo').value   = f.titolo   || '';
                box.querySelector('.in-for-istituto').value = f.istituto || '';
                box.querySelector('.in-for-da').value       = f.da       || '';
                box.querySelector('.in-for-a').value        = f.a        || '';
                box.querySelector('.in-for-voto').value     = f.voto     || '';
                forC.appendChild(box);
            });
        } else {
            aggiungiFormazione();
        }

        /* Lingue */
        const linC = g('lingue-container');
        linC.innerHTML = '';
        linCount = 0;
        if (data.lingue && data.lingue.length) {
            data.lingue.forEach(l => {
                linCount++;
                const box = creaBoxLingua(linCount);
                box.querySelector('.in-lingua').value  = l.lingua  || '';
                box.querySelector('.in-livello').value = l.livello || 'Madrelingua';
                linC.appendChild(box);
            });
        } else {
            aggiungiLingua();
        }

        /* Certificazioni (opzionale: non aggiungere box vuoto di default) */
        const certC = g('certificazioni-container');
        certC.innerHTML = '';
        certCount = 0;
        if (data.certificazioni && data.certificazioni.length) {
            data.certificazioni.forEach(c => {
                certCount++;
                const box = creaBoxCertificazione(certCount);
                box.querySelector('.in-cert-nome').value = c.nome  || '';
                box.querySelector('.in-cert-ente').value = c.ente  || '';
                box.querySelector('.in-cert-anno').value = c.anno  || '';
                certC.appendChild(box);
            });
        }

    } catch (err) {
        console.error('Errore caricamento dati salvati:', err);
        localStorage.removeItem('cv_builder_autosave');
        aggiungiEsperienza();
        aggiungiFormazione();
        aggiungiLingua();
    }

    aggiornaCV();
}


/* ══════════════════════════════════════════════════════════════
   CREATORI DI BOX DINAMICI
   ══════════════════════════════════════════════════════════════ */

/* ── Esperienza ── */
function creaBoxEsperienza(n) {
    const div = document.createElement('div');
    div.className = 'exp-input-box dyn-card';
    div.innerHTML = `
        <button class="rm-btn" onclick="rimuoviBox(this)" title="Rimuovi">✕</button>
        <div class="dyn-num">Esperienza ${n}</div>
        <div class="row-2">
            <div class="field">
                <label class="lbl">Ruolo / Posizione</label>
                <input type="text" class="in-ruolo" placeholder="Progettista Meccanico" oninput="aggiornaCV()">
            </div>
            <div class="field">
                <label class="lbl">Azienda</label>
                <input type="text" class="in-azienda" placeholder="Ferrari S.p.A." oninput="aggiornaCV()">
            </div>
        </div>
        <div class="field">
            <label class="lbl">Periodo</label>
            <input type="text" class="in-date" placeholder="03/2021 – Presente" oninput="aggiornaCV()">
        </div>
        <div class="field">
            <label class="lbl">Descrizione attività (una riga = un risultato)</label>
            <textarea class="in-desc" rows="3"
                placeholder="Progettato componenti in acciaio per linea di assemblaggio automotive&#10;Ridotto i tempi di produzione del 15% tramite ottimizzazione DFM&#10;Coordinato team di 3 tecnici junior per collaudi periodici"
                oninput="aggiornaCV()"></textarea>
            <div class="tip">✦ Verbo al passato · Dati numerici · Keyword dell'annuncio</div>
        </div>
    `;
    return div;
}

function aggiungiEsperienza() {
    expCount++;
    g('esperienze-container').appendChild(creaBoxEsperienza(expCount));
    aggiornaCV();
}

/* ── Formazione ── */
function creaBoxFormazione(n) {
    const div = document.createElement('div');
    div.className = 'for-input-box dyn-card';
    div.innerHTML = `
        <button class="rm-btn" onclick="rimuoviBox(this)" title="Rimuovi">✕</button>
        <div class="dyn-num">Titolo ${n}</div>
        <div class="row-2">
            <div class="field">
                <label class="lbl">Titolo di Studio</label>
                <input type="text" class="in-for-titolo" placeholder="Laurea Magistrale in Ingegneria Meccanica" oninput="aggiornaCV()">
            </div>
            <div class="field">
                <label class="lbl">Istituto / Università</label>
                <input type="text" class="in-for-istituto" placeholder="Università di Bologna" oninput="aggiornaCV()">
            </div>
        </div>
        <div class="row-3">
            <div class="field">
                <label class="lbl">Da (YYYY)</label>
                <input type="text" class="in-for-da" placeholder="2017" oninput="aggiornaCV()">
            </div>
            <div class="field">
                <label class="lbl">A (YYYY)</label>
                <input type="text" class="in-for-a" placeholder="2019" oninput="aggiornaCV()">
            </div>
            <div class="field">
                <label class="lbl">Voto (opz.)</label>
                <input type="text" class="in-for-voto" placeholder="110/110L" oninput="aggiornaCV()">
            </div>
        </div>
    `;
    return div;
}

function aggiungiFormazione() {
    forCount++;
    g('formazione-container').appendChild(creaBoxFormazione(forCount));
    aggiornaCV();
}

/* ── Lingue ── */
function creaBoxLingua(n) {
    const opts = LIVELLI_QCER.map(l =>
        `<option value="${l}"${l === 'Madrelingua' ? ' selected' : ''}>${l}</option>`
    ).join('');

    const div = document.createElement('div');
    div.className = 'lin-input-box dyn-card';
    div.style.padding = '10px 12px';
    div.innerHTML = `
        <button class="rm-btn" onclick="rimuoviBox(this)" title="Rimuovi">✕</button>
        <div class="row-2">
            <div class="field">
                <label class="lbl">Lingua</label>
                <input type="text" class="in-lingua" placeholder="Inglese" oninput="aggiornaCV()">
            </div>
            <div class="field">
                <label class="lbl">Livello QCER</label>
                <select class="in-livello" onchange="aggiornaCV()">${opts}</select>
            </div>
        </div>
    `;
    return div;
}

function aggiungiLingua() {
    linCount++;
    g('lingue-container').appendChild(creaBoxLingua(linCount));
    aggiornaCV();
}

/* ── Certificazioni ── */
function creaBoxCertificazione(n) {
    const div = document.createElement('div');
    div.className = 'cert-input-box dyn-card';
    div.style.padding = '10px 12px';
    div.innerHTML = `
        <button class="rm-btn" onclick="rimuoviBox(this)" title="Rimuovi">✕</button>
        <div class="row-3">
            <div class="field">
                <label class="lbl">Certificazione</label>
                <input type="text" class="in-cert-nome" placeholder="PMP, ISO 9001…" oninput="aggiornaCV()">
            </div>
            <div class="field">
                <label class="lbl">Ente Rilasciante</label>
                <input type="text" class="in-cert-ente" placeholder="PMI, Bureau Veritas…" oninput="aggiornaCV()">
            </div>
            <div class="field">
                <label class="lbl">Anno</label>
                <input type="text" class="in-cert-anno" placeholder="2024" oninput="aggiornaCV()">
            </div>
        </div>
    `;
    return div;
}

function aggiungiCertificazione() {
    certCount++;
    g('certificazioni-container').appendChild(creaBoxCertificazione(certCount));
    aggiornaCV();
}

/* Rimozione generica (funziona per tutti i tipi di box) */
function rimuoviBox(btn) {
    btn.closest('.dyn-card').remove();
    aggiornaCV();
}


/* ══════════════════════════════════════════════════════════════
   AGGIORNA CV — live preview in tempo reale
   ══════════════════════════════════════════════════════════════ */
function aggiornaCV() {

    /* Valori dai campi statici */
    const nome     = g('input-nome')?.value     || '';
    const cognome  = g('input-cognome')?.value  || '';
    const titolo   = g('input-titolo')?.value   || '';
    const email    = g('input-email')?.value    || '';
    const tel      = g('input-tel')?.value      || '';
    const citta    = g('input-citta')?.value    || '';
    const linkedin = g('input-linkedin')?.value || '';
    const bio      = g('input-bio')?.value      || '';
    const skills   = g('input-skills')?.value   || '';

    /* ── Nome ── */
    const nomeCompleto = `${nome} ${cognome}`.trim();
    const cvNome = g('cv-nome');
    cvNome.textContent = nomeCompleto || 'Nome Cognome';
    cvNome.className = 'cv-name' + (nomeCompleto ? '' : ' cv-ph');

    /* ── Titolo ── */
    const cvTitolo = g('cv-titolo-role');
    cvTitolo.textContent = titolo;

    /* ── Contatti ── */
    const contactParts = [email, tel, citta, linkedin].filter(Boolean);
    const cvContacts = g('cv-contacts-line');
    if (contactParts.length) {
        cvContacts.textContent = contactParts.join('  ·  ');
        cvContacts.classList.remove('cv-ph');
    } else {
        cvContacts.textContent = 'email  ·  telefono  ·  città  ·  linkedin';
        cvContacts.classList.add('cv-ph');
    }

    /* ── Profilo ── */
    const cvBio = g('cv-bio');
    cvBio.textContent = bio;
    g('cv-profilo-section').style.display = bio.trim() ? '' : 'none';

    /* ── Esperienze ── */
    const cvExpList = g('cv-exp-list');
    cvExpList.innerHTML = '';
    let hasEsp = false;
    document.querySelectorAll('.exp-input-box').forEach(box => {
        const ruolo   = box.querySelector('.in-ruolo')?.value   || '';
        const azienda = box.querySelector('.in-azienda')?.value || '';
        const date    = box.querySelector('.in-date')?.value    || '';
        const desc    = box.querySelector('.in-desc')?.value    || '';
        if (!ruolo && !azienda && !desc) return;

        hasEsp = true;
        const block = document.createElement('div');
        block.className = 'cv-exp-block';
        block.innerHTML = `
            <div class="cv-exp-top">
                <span class="cv-exp-role">${esc(ruolo) || '—'}</span>
                ${date ? `<span class="cv-exp-date">${esc(date)}</span>` : ''}
            </div>
            ${azienda ? `<div class="cv-exp-company">${esc(azienda)}</div>` : ''}
            ${desc    ? `<div class="cv-exp-desc">${esc(desc)}</div>` : ''}
        `;
        cvExpList.appendChild(block);
    });
    g('cv-esp-section').style.display = hasEsp ? '' : 'none';

    /* ── Formazione ── */
    const cvForList = g('cv-for-list');
    cvForList.innerHTML = '';
    let hasFor = false;
    document.querySelectorAll('.for-input-box').forEach(box => {
        const titolo_s  = box.querySelector('.in-for-titolo')?.value   || '';
        const istituto  = box.querySelector('.in-for-istituto')?.value || '';
        const da        = box.querySelector('.in-for-da')?.value       || '';
        const a         = box.querySelector('.in-for-a')?.value        || '';
        const voto      = box.querySelector('.in-for-voto')?.value     || '';
        if (!titolo_s && !istituto) return;

        hasFor = true;
        const dateRange = [da, a].filter(Boolean).join(' – ');
        const block = document.createElement('div');
        block.className = 'cv-for-block';
        block.innerHTML = `
            <div class="cv-for-top">
                <div class="cv-for-main">
                    <span class="cv-for-title">${esc(titolo_s)}</span>
                    ${istituto ? `<span class="cv-for-meta"> · ${esc(istituto)}</span>` : ''}
                    ${voto     ? `<span class="cv-for-meta"> · ${esc(voto)}</span>` : ''}
                </div>
                ${dateRange ? `<span class="cv-for-date">${esc(dateRange)}</span>` : ''}
            </div>
        `;
        cvForList.appendChild(block);
    });
    g('cv-for-section').style.display = hasFor ? '' : 'none';

    /* ── Competenze ── */
    const tags = skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : [];
    const cvSkillsWrap = g('cv-skills-wrap');
    cvSkillsWrap.innerHTML = tags.map(t => `<span class="cv-tag">${esc(t)}</span>`).join('');
    g('cv-skills-section').style.display = tags.length ? '' : 'none';

    /* ── Lingue ── */
    const cvLinList = g('cv-lin-list');
    cvLinList.innerHTML = '';
    let hasLin = false;
    document.querySelectorAll('.lin-input-box').forEach(box => {
        const lingua  = box.querySelector('.in-lingua')?.value  || '';
        const livello = box.querySelector('.in-livello')?.value || '';
        if (!lingua) return;
        hasLin = true;
        const span = document.createElement('span');
        span.innerHTML = `<span class="cv-lang-name">${esc(lingua)}</span> <span class="cv-lang-lvl">${esc(livello)}</span>`;
        cvLinList.appendChild(span);
    });
    g('cv-lin-section').style.display = hasLin ? '' : 'none';

    /* ── Certificazioni ── */
    const cvCertList = g('cv-cert-list');
    cvCertList.innerHTML = '';
    let hasCert = false;
    document.querySelectorAll('.cert-input-box').forEach(box => {
        const nome_c = box.querySelector('.in-cert-nome')?.value || '';
        const ente   = box.querySelector('.in-cert-ente')?.value || '';
        const anno   = box.querySelector('.in-cert-anno')?.value || '';
        if (!nome_c) return;
        hasCert = true;
        const div = document.createElement('div');
        div.className = 'cv-cert-block';
        div.innerHTML = `
            <span class="cv-cert-name">${esc(nome_c)}</span>
            ${ente ? `<span class="cv-cert-meta"> · ${esc(ente)}</span>` : ''}
            ${anno ? `<span class="cv-cert-anno"> (${esc(anno)})</span>` : ''}
        `;
        cvCertList.appendChild(div);
    });
    g('cv-cert-section').style.display = hasCert ? '' : 'none';

    /* ATS Score + Auto-save */
    calcolaATS(nome, cognome, titolo, email, tel, bio, hasEsp, hasFor, tags, hasLin);
    salvaLavoroAutomatico();
}


/* ══════════════════════════════════════════════════════════════
   ATS SCORE — 7 check, aggiorna badge e barra checks
   ══════════════════════════════════════════════════════════════ */
function calcolaATS(nome, cognome, titolo, email, tel, bio, hasEsp, hasFor, tags, hasLin) {
    const checks = [
        { label: 'Nome & qualifica', ok: !!(nome && cognome && titolo) },
        { label: 'Contatti',          ok: !!(email && tel) },
        { label: 'Profilo',           ok: bio.trim().length > 30 },
        { label: 'Esperienza',        ok: hasEsp },
        { label: 'Formazione',        ok: hasFor },
        { label: 'Competenze',        ok: tags.length >= 3 },
        { label: 'Lingue',            ok: hasLin },
    ];

    const score = Math.round(checks.filter(c => c.ok).length / checks.length * 100);

    /* Badge nell'header */
    const scoreEl = g('ats-score');
    scoreEl.textContent = score + '%';
    scoreEl.style.color = score >= 80 ? '#16a34a' : score >= 50 ? '#ff6a00' : '#e11d48';

    /* Check bar nell'anteprima */
    const checksEl = g('ats-checks');
    if (checksEl) {
        checksEl.innerHTML = checks.map(c =>
            `<span class="ck${c.ok ? ' ok' : ''}" title="${c.label}">${c.ok ? '✓' : '○'} ${c.label}</span>`
        ).join('');
    }
}


/* ══════════════════════════════════════════════════════════════
   RACCOLTA DATI FORM — usata sia per l'autosave che per il
   salvataggio del profilo su Supabase
   ══════════════════════════════════════════════════════════════ */
function raccogliDatiForm() {
    const data = {
        nome:      g('input-nome')?.value      || '',
        cognome:   g('input-cognome')?.value   || '',
        titolo:    g('input-titolo')?.value     || '',
        email:     g('input-email')?.value     || '',
        tel:       g('input-tel')?.value       || '',
        citta:     g('input-citta')?.value     || '',
        linkedin:  g('input-linkedin')?.value  || '',
        bio:       g('input-bio')?.value       || '',
        skills:    g('input-skills')?.value    || '',
        esperienze: [],
        formazione: [],
        lingue: [],
        certificazioni: []
    };

    document.querySelectorAll('.exp-input-box').forEach(box => {
        data.esperienze.push({
            ruolo:   box.querySelector('.in-ruolo')?.value   || '',
            azienda: box.querySelector('.in-azienda')?.value || '',
            date:    box.querySelector('.in-date')?.value    || '',
            desc:    box.querySelector('.in-desc')?.value    || ''
        });
    });

    document.querySelectorAll('.for-input-box').forEach(box => {
        data.formazione.push({
            titolo:   box.querySelector('.in-for-titolo')?.value   || '',
            istituto: box.querySelector('.in-for-istituto')?.value || '',
            da:       box.querySelector('.in-for-da')?.value       || '',
            a:        box.querySelector('.in-for-a')?.value        || '',
            voto:     box.querySelector('.in-for-voto')?.value     || ''
        });
    });

    document.querySelectorAll('.lin-input-box').forEach(box => {
        data.lingue.push({
            lingua:  box.querySelector('.in-lingua')?.value  || '',
            livello: box.querySelector('.in-livello')?.value || ''
        });
    });

    document.querySelectorAll('.cert-input-box').forEach(box => {
        data.certificazioni.push({
            nome:  box.querySelector('.in-cert-nome')?.value || '',
            ente:  box.querySelector('.in-cert-ente')?.value || '',
            anno:  box.querySelector('.in-cert-anno')?.value || ''
        });
    });

    return data;
}


/* ══════════════════════════════════════════════════════════════
   SALVATAGGIO AUTOMATICO (localStorage)
   ══════════════════════════════════════════════════════════════ */
function salvaLavoroAutomatico() {
    try {
        localStorage.setItem('cv_builder_autosave', JSON.stringify(raccogliDatiForm()));
    } catch (e) {
        console.error('Errore salvataggio localStorage:', e);
    }
}


/* ══════════════════════════════════════════════════════════════
   GENERA CV HTML (output ATS-safe per l'export)
   Testo vero, colonna singola, leggibile da Taleo / SuccessFactors
   ══════════════════════════════════════════════════════════════ */
function buildCVHTML() {
    const nome     = esc((`${g('input-nome')?.value || ''} ${g('input-cognome')?.value || ''}`).trim()) || 'Nome Cognome';
    const titolo   = esc(g('input-titolo')?.value   || '');
    const email    = esc(g('input-email')?.value    || '');
    const tel      = esc(g('input-tel')?.value      || '');
    const citta    = esc(g('input-citta')?.value    || '');
    const linkedin = esc(g('input-linkedin')?.value || '');
    const bio      = esc(g('input-bio')?.value      || '');
    const skills   = g('input-skills')?.value   || '';

    const contacts = [email, tel, citta, linkedin].filter(Boolean).join(' &nbsp;·&nbsp; ');
    const tags     = skills ? skills.split(',').map(s => esc(s.trim())).filter(Boolean) : [];

    /* Esperienze */
    let espHTML = '';
    document.querySelectorAll('.exp-input-box').forEach(box => {
        const ruolo   = esc(box.querySelector('.in-ruolo')?.value   || '');
        const azienda = esc(box.querySelector('.in-azienda')?.value || '');
        const date    = esc(box.querySelector('.in-date')?.value    || '');
        const desc    = esc(box.querySelector('.in-desc')?.value    || '');
        if (!ruolo && !azienda && !desc) return;
        espHTML += `
        <div class="item">
            <div class="row">
                <span class="main"><b>${ruolo}</b>${azienda ? ` &nbsp;·&nbsp; <span class="m">${azienda}</span>` : ''}</span>
                ${date ? `<span class="d">${date}</span>` : ''}
            </div>
            ${desc ? `<div class="desc">${desc.replace(/\n/g, '<br>')}</div>` : ''}
        </div>`;
    });

    /* Formazione */
    let forHTML = '';
    document.querySelectorAll('.for-input-box').forEach(box => {
        const titolo_s  = esc(box.querySelector('.in-for-titolo')?.value   || '');
        const istituto  = esc(box.querySelector('.in-for-istituto')?.value || '');
        const da        = esc(box.querySelector('.in-for-da')?.value       || '');
        const a_        = esc(box.querySelector('.in-for-a')?.value        || '');
        const voto      = esc(box.querySelector('.in-for-voto')?.value     || '');
        if (!titolo_s && !istituto) return;
        const dr = [da, a_].filter(Boolean).join(' – ');
        forHTML += `
        <div class="item">
            <div class="row">
                <span class="main"><b>${titolo_s}</b>${istituto ? ` &nbsp;·&nbsp; <span class="m">${istituto}</span>` : ''}${voto ? ` &nbsp;·&nbsp; <span class="m">${voto}</span>` : ''}</span>
                ${dr ? `<span class="d">${dr}</span>` : ''}
            </div>
        </div>`;
    });

    /* Lingue */
    let linHTML = '';
    document.querySelectorAll('.lin-input-box').forEach(box => {
        const lingua  = esc(box.querySelector('.in-lingua')?.value  || '');
        const livello = esc(box.querySelector('.in-livello')?.value || '');
        if (!lingua) return;
        linHTML += `<span class="lp"><b>${lingua}</b> <span class="m">${livello}</span></span>`;
    });

    /* Certificazioni */
    let certHTML = '';
    document.querySelectorAll('.cert-input-box').forEach(box => {
        const nome_c = esc(box.querySelector('.in-cert-nome')?.value || '');
        const ente   = esc(box.querySelector('.in-cert-ente')?.value || '');
        const anno   = esc(box.querySelector('.in-cert-anno')?.value || '');
        if (!nome_c) return;
        certHTML += `<div class="item" style="margin-bottom:5px"><b>${nome_c}</b>${ente ? ` &nbsp;·&nbsp; <span class="m">${ente}</span>` : ''}${anno ? ` <span class="d">(${anno})</span>` : ''}</div>`;
    });

    /* Sezione helper */
    const sec = (titolo_h, body) => body.trim()
        ? `<div class="s"><h2>${titolo_h}</h2>${body}</div>`
        : '';

    return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="author" content="${nome}">
<title>Curriculum Vitae – ${nome}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Calibri,'Segoe UI',Arial,sans-serif;font-size:12px;line-height:1.55;color:#2d3748;background:#fff;max-width:794px;margin:0 auto;padding:52px 60px}
a{color:inherit;text-decoration:none}
header{border-bottom:2px solid #edf2f7;padding-bottom:18px;margin-bottom:24px}
h1{font-size:28px;font-weight:700;color:#1a202c;letter-spacing:-0.3px;margin-bottom:4px;line-height:1.1}
.jt{font-size:14px;font-weight:600;color:#ff6a00;margin-bottom:10px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.ct{font-size:11px;color:#4a5568;line-height:1.7}
.s{margin-bottom:20px}
h2{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#ff6a00;border-bottom:1px solid #fed7aa;padding-bottom:5px;margin-bottom:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact;break-after:avoid;page-break-after:avoid}
.item{margin-bottom:12px;break-inside:avoid;page-break-inside:avoid}.item:last-child{margin-bottom:0}
.row{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.main{flex:1;font-size:12px;color:#1a202c}.m{color:#4a5568;font-weight:400}
.d{font-size:10.5px;color:#718096;white-space:nowrap;flex-shrink:0}
.desc{font-size:11.5px;color:#4a5568;margin-top:5px;line-height:1.55}
.prof{font-size:12px;color:#2d3748;line-height:1.65}
.tags{display:flex;flex-wrap:wrap;gap:5px}
.tag{font-size:11px;color:#2d3748;background:#f7fafc;border:1px solid #e2e8f0;border-radius:3px;padding:2px 9px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.lg{line-height:2.2;font-size:12px}.lp{margin-right:8px}
.prv{margin-top:28px;padding-top:12px;border-top:1px solid #edf2f7;font-size:8.5px;color:#a0aec0;line-height:1.45}
.credit{margin-top:10px;font-size:8px;color:#cbd5e0;text-align:center}
.print-hint{position:sticky;top:0;background:#fff7ed;border-bottom:1px solid #fed7aa;color:#9a3412;font-size:12.5px;font-weight:600;text-align:center;padding:12px 16px;margin:-52px -60px 24px}
.print-hint button{margin-left:10px;background:#ff6a00;color:#fff;border:none;padding:6px 14px;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit}
@media print{.print-hint{display:none}body{padding:0;max-width:100%}@page{size:A4;margin:1.5cm 2cm}}
</style>
</head>
<body>
<div class="print-hint">Il tuo CV è pronto. Si sta aprendo la finestra di stampa — scegli "Salva come PDF" come destinazione. Prima di salvare, apri "Altre impostazioni" e <strong>disattiva "Intestazioni e piè di pagina"</strong> per un PDF pulito, senza data e indirizzo. <button onclick="window.print()">Stampa / Salva PDF</button></div>
<header>
    <h1>${nome}</h1>
    ${titolo ? `<div class="jt">${titolo}</div>` : ''}
    <div class="ct">${contacts || ''}</div>
</header>
${sec('Profilo Professionale', bio ? `<p class="prof">${bio.replace(/\n/g, '<br>')}</p>` : '')}
${sec('Esperienze Professionali', espHTML)}
${sec('Formazione', forHTML)}
${sec('Competenze', tags.length ? `<div class="tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : '')}
${sec('Lingue', linHTML ? `<div class="lg">${linHTML}</div>` : '')}
${sec('Certificazioni', certHTML)}
<div class="prv">Autorizzo il trattamento dei miei dati personali ai sensi dell'art. 13 D.Lgs. 196/2003 come modificato dal D.Lgs. 101/2018, e dell'art. 13 del Regolamento UE 679/2016 (GDPR).</div>
<div class="credit">Creato con Tipak — tipak.me</div>
<script>window.addEventListener('load', () => setTimeout(() => window.print(), 300));</script>
</body>
</html>`;
}


/* ══════════════════════════════════════════════════════════════
   TOAST — conferma visiva in fondo alla pagina
   ══════════════════════════════════════════════════════════════ */
let toastTimer = null;
function mostraToast(msg, tipo = 'ok') {
    let toast = g('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        document.body.appendChild(toast);
    }
    const icona = tipo === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check';
    toast.className = 'toast show' + (tipo === 'error' ? ' toast-error' : '');
    toast.innerHTML = `<i class="fa-solid ${icona}"></i><span>${esc(msg)}</span>`;

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 4000);
}


/* ══════════════════════════════════════════════════════════════
   GENERA PDF — blob URL + window.print()

   Il PDF generato con questo metodo ha TESTO VERO, non un'immagine.
   È selezionabile, copiabile, e leggibile da Taleo, SuccessFactors
   e qualsiasi altro ATS. La vecchia funzione html2pdf() generava
   un'immagine JPEG — invisibile ai parser automatici.
   ══════════════════════════════════════════════════════════════ */
function generaPDF() {
    const html  = buildCVHTML();
    const blob  = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url   = URL.createObjectURL(blob);

    /* Salva il profilo su Tipak in parallelo — non deve mai bloccare
       né ritardare il download del PDF, anche se fallisce. */
    const datiForm = raccogliDatiForm();
    if (datiForm.email) {
        salvaCandidato(datiForm)
            .then(() => mostraToast('Profilo salvato su Tipak ✓'))
            .catch(err => {
                console.error('Errore salvataggio profilo:', err);
                mostraToast('CV scaricato, ma il profilo non è stato salvato su Tipak.', 'error');
            });
    }

    /* Prova ad aprire in una nuova scheda per la stampa */
    const win = window.open(url, '_blank');

    if (win) {
        mostraToast('CV generato! Nella nuova scheda scegli "Salva come PDF".');
    } else {
        /* Popup bloccato: fallback — scarica direttamente il file HTML */
        const nome    = g('input-nome')?.value    || 'Curriculab';
        const cognome = g('input-cognome')?.value || '';
        const a = document.createElement('a');
        a.href     = url;
        a.download = `CV_${nome}_${cognome}.html`.replace(/\s+/g, '_');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        mostraToast('Popup bloccato dal browser: il file è stato scaricato. Aprilo e usa Ctrl+P → "Salva come PDF".', 'error');
    }

    /* Libera memoria dopo 60 secondi */
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}
