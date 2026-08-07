/* ══════════════════════════════════════════════════════════════
   TIPAK — landing page script
   Salva le email della waitlist su Supabase (tabella: waitlist)
   ══════════════════════════════════════════════════════════════ */

const supabaseUrl = 'https://tpjqblsrdcnqlxqdztql.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwanFibHNyZGNucWx4cWR6dHFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MjkyOTksImV4cCI6MjA5NjMwNTI5OX0.Fso3AZHVaWgjLWp7Pq5CKLx9nkvoGlFVBCj4r1N3gr8';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

async function salvaEmailWaitlist(email) {
    return supabaseClient
        .from('waitlist')
        .insert([{ email, idea: 'aziende-locali' }]);
}

function isEmailValida(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function collegaForm(formId, inputId, noteId) {
    const form = document.getElementById(formId);
    const input = document.getElementById(inputId);
    const note = document.getElementById(noteId);
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = input.value.trim();

        if (!isEmailValida(email)) {
            input.classList.add('invalid');
            note.textContent = 'Inserisci un\'email valida.';
            note.className = 'form-note error';
            return;
        }

        input.classList.remove('invalid');
        const btn = form.querySelector('button');
        btn.disabled = true;

        const { error } = await salvaEmailWaitlist(email);

        if (error) {
            if (error.code === '23505') {
                note.textContent = 'Questa email è già in lista. Ci sei già!';
                note.className = 'form-note success';
            } else {
                console.error('Errore salvataggio waitlist:', error);
                note.textContent = 'Qualcosa è andato storto, riprova tra poco.';
                note.className = 'form-note error';
                btn.disabled = false;
            }
            return;
        }

        input.value = '';
        note.textContent = 'Fatto! Ti scriviamo appena Tipak è pronto.';
        note.className = 'form-note success';
    });
}

collegaForm('form-waitlist-hero', 'email-hero', 'note-hero');
collegaForm('form-waitlist', 'email-final', 'note-final');


/* ══════════════════════════════════════════════════════════════
   DEMO MAPPA — dati finti, nessuna chiamata a Supabase
   ══════════════════════════════════════════════════════════════ */
const AZIENDE_DEMO = [
    { nome: 'Trattoria Da Marco',       settore: 'Ristorazione',      dimensione: 'Piccola · 1-49 dipendenti',  distanza: '350 m da te',   icona: 'fa-utensils',         cerca: true  },
    { nome: 'GreenBuild Costruzioni',   settore: 'Edilizia',          dimensione: 'Media · 50-249 dipendenti',  distanza: '900 m da te',   icona: 'fa-helmet-safety',    cerca: false },
    { nome: 'LogiExpress Nord',         settore: 'Logistica',         dimensione: 'Grande · 250+ dipendenti',   distanza: '1,4 km da te',  icona: 'fa-truck',            cerca: true  },
    { nome: 'Studio Dentistico Aurora', settore: 'Sanità',            dimensione: 'Piccola · 1-49 dipendenti',  distanza: '600 m da te',   icona: 'fa-briefcase-medical', cerca: false },
    { nome: 'Retail Point',             settore: 'Retail',            dimensione: 'Media · 50-249 dipendenti',  distanza: '750 m da te',   icona: 'fa-store',            cerca: true  },
    { nome: 'NovaTech Uffici',          settore: 'Ufficio / Tech',    dimensione: 'Piccola · 1-49 dipendenti',  distanza: '1,1 km da te',  icona: 'fa-laptop-code',      cerca: false },
];

function mostraAzienda(index) {
    const azienda = AZIENDE_DEMO[index];
    if (!azienda) return;

    document.querySelectorAll('.map-pin').forEach(pin => {
        pin.classList.toggle('active', pin.dataset.company === String(index));
    });

    document.getElementById('detail-placeholder').hidden = true;
    const content = document.getElementById('detail-content');
    content.hidden = false;

    document.getElementById('detail-icon').innerHTML = `<i class="fa-solid ${azienda.icona}"></i>`;
    document.getElementById('detail-name').textContent = azienda.nome;
    document.getElementById('detail-meta').textContent = azienda.settore;
    document.getElementById('detail-size').textContent = azienda.dimensione;
    document.getElementById('detail-distance').textContent = azienda.distanza;
    document.getElementById('detail-future').textContent =
        `Nella versione finale ti porterebbe dritto sul sito di ${azienda.nome}.`;

    const status = document.getElementById('detail-status');
    status.textContent = azienda.cerca ? 'Cerca personale' : 'Candidature spontanee aperte';
    status.className = azienda.cerca ? 'badge badge-open' : 'badge';
}

document.querySelectorAll('.map-pin').forEach(pin => {
    pin.addEventListener('click', () => mostraAzienda(Number(pin.dataset.company)));
});

const detailCta = document.getElementById('detail-cta');
if (detailCta) {
    detailCta.addEventListener('click', () => {
        document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' });
        document.getElementById('email-final')?.focus();
    });
}
