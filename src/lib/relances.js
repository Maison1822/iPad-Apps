// Relances : prospects à rappeler, notes de visite à traiter, fournisseurs restés trop longtemps à la même étape.
// Une seule logique de calcul, utilisée par l'écran « Relances » et par le compteur de l'onglet.
import { supabase } from './supabase';

export const JOURS_FOURNISSEUR = 10; // un fournisseur sans mouvement depuis ce nombre de jours est à relancer
const ETAPES_TERMINEES = ['integration', 'refuse', 'suspendu'];
const STATUTS_PROSPECT_CLOS = ['Client', 'Perdu', 'Suspendu'];

export function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Nombre de jours entre une date AAAA-MM-JJ (ou ISO) et aujourd'hui (positif = date passée)
export function joursDepuis(dateIso) {
  if (!dateIso) return null;
  const [a, m, j] = String(dateIso).slice(0, 10).split('-').map(Number);
  if (!a || !m || !j) return null;
  const debut = new Date(a, m - 1, j).getTime();
  const fin = new Date(); fin.setHours(0, 0, 0, 0);
  return Math.round((fin.getTime() - debut) / 86400000);
}

function dateLimiteFournisseur() {
  const d = new Date();
  d.setDate(d.getDate() - JOURS_FOURNISSEUR);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Retourne { prospects, notes, fournisseurs } ; lève une erreur si une requête échoue (pas de résultat partiel trompeur).
export async function chargerRelances() {
  const today = aujourdhui();

  const [pr, no, su, et] = await Promise.all([
    supabase.from('Prospects')
      .select('id, nom_contact, prenom_contact, nom_etablissement, pays, statut, date_prochaine_relance, telephone_portable, telephone_fixe, whatsapp, email')
      .not('date_prochaine_relance', 'is', null)
      .lte('date_prochaine_relance', today)
      .order('date_prochaine_relance'),
    supabase.from('Notes de Visite')
      .select('id, prospect_id, client_id, fournisseur_id, date_visite, resume, prochaine_action, date_relance')
      .eq('fait', false)
      .not('date_relance', 'is', null)
      .lte('date_relance', today)
      .order('date_relance'),
    supabase.from('Suivi Fournisseurs').select('fournisseur_id, etape_code, date_etape, maj'),
    supabase.from('Etapes Fournisseurs').select('code, libelle'),
  ]);
  const erreur = pr.error || no.error || su.error || et.error;
  if (erreur) throw new Error(erreur.message);

  const prospects = (pr.data || []).filter((p) => !STATUTS_PROSPECT_CLOS.includes(p.statut));

  // Noms des fiches rattachées aux notes (prospect, client ou fournisseur)
  const notes = no.data || [];
  const idsDe = (cle) => [...new Set(notes.map((n) => n[cle]).filter(Boolean))];
  const idsFournisseursNotes = idsDe('fournisseur_id');

  // Fournisseurs restés trop longtemps à la même étape
  const limite = dateLimiteFournisseur();
  const libelles = Object.fromEntries((et.data || []).map((e) => [e.code, e.libelle]));
  const suivisEnRetard = (su.data || [])
    .filter((x) => x.etape_code && !ETAPES_TERMINEES.includes(x.etape_code))
    .map((x) => {
      const dates = [x.date_etape, x.maj ? String(x.maj).slice(0, 10) : null].filter(Boolean).sort();
      return { ...x, derniere: dates.length ? dates[dates.length - 1] : null };
    })
    .filter((x) => x.derniere && x.derniere <= limite)
    .sort((a, b) => a.derniere.localeCompare(b.derniere));

  const idsFournisseurs = [...new Set([...suivisEnRetard.map((x) => x.fournisseur_id), ...idsFournisseursNotes])];
  const idsProspectsNotes = idsDe('prospect_id');
  const idsClientsNotes = idsDe('client_id');

  const [fo, ct, pn, cn] = await Promise.all([
    idsFournisseurs.length ? supabase.from('Fournisseurs').select('id, Domaine, Pays').in('id', idsFournisseurs) : { data: [] },
    suivisEnRetard.length
      ? supabase.from('Contacts Fournisseurs').select('fournisseur_id, nom, telephone, whatsapp, email, principal').in('fournisseur_id', suivisEnRetard.map((x) => x.fournisseur_id)).order('principal', { ascending: false })
      : { data: [] },
    idsProspectsNotes.length ? supabase.from('Prospects').select('id, nom_contact, prenom_contact, nom_etablissement').in('id', idsProspectsNotes) : { data: [] },
    idsClientsNotes.length ? supabase.from('Clients').select('id, Nom, Société').in('id', idsClientsNotes) : { data: [] },
  ]);
  const erreur2 = fo.error || ct.error || pn.error || cn.error;
  if (erreur2) throw new Error(erreur2.message);

  const parId = (liste) => Object.fromEntries((liste || []).map((x) => [x.id, x]));
  const fournisseursParId = parId(fo.data);
  const prospectsParId = parId(pn.data);
  const clientsParId = parId(cn.data);
  const contactParFournisseur = {};
  (ct.data || []).forEach((c) => { if (!contactParFournisseur[c.fournisseur_id]) contactParFournisseur[c.fournisseur_id] = c; });

  const nomProspect = (p) => `${p?.prenom_contact || ''} ${p?.nom_contact || ''}`.trim() || p?.nom_etablissement || 'Prospect';

  const notesAffichees = notes.map((n) => {
    let cible = 'Fiche';
    if (n.prospect_id) cible = nomProspect(prospectsParId[n.prospect_id]);
    else if (n.client_id) { const c = clientsParId[n.client_id]; cible = c?.Société || c?.Nom || 'Client'; }
    else if (n.fournisseur_id) cible = fournisseursParId[n.fournisseur_id]?.Domaine || 'Fournisseur';
    return { ...n, cible };
  });

  const fournisseurs = suivisEnRetard.map((x) => {
    const f = fournisseursParId[x.fournisseur_id];
    return { ...x, nom: f?.Domaine || 'Fournisseur', pays: f?.Pays || null, etape: libelles[x.etape_code] || x.etape_code, contact: contactParFournisseur[x.fournisseur_id] || null };
  });

  return {
    prospects: prospects.map((p) => ({ ...p, nom: nomProspect(p) })),
    notes: notesAffichees,
    fournisseurs,
  };
}

export function totalRelances(r) {
  return r ? r.prospects.length + r.notes.length + r.fournisseurs.length : 0;
}

// ---- Compteur partagé (badge de l'onglet) ----
let dernierNombre = 0;
const ecouteurs = new Set();

export function surNombreRelances(rappel) {
  ecouteurs.add(rappel);
  rappel(dernierNombre);
  return () => ecouteurs.delete(rappel);
}

export function publierNombreRelances(n) {
  dernierNombre = n;
  ecouteurs.forEach((cb) => { try { cb(n); } catch (e) { /* silencieux */ } });
}

export async function rafraichirNombreRelances() {
  try {
    const r = await chargerRelances();
    publierNombreRelances(totalRelances(r));
    return r;
  } catch (e) {
    return null; // hors réseau : on garde le dernier compteur connu
  }
}
