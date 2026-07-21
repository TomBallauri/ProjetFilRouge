import { useEffect } from 'react';
import { driver } from 'driver.js';
import type { DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import '../styles/tour.css';
import { useStore } from '../lib/store';

// Renvoie l'élément visible parmi les doublons desktop/mobile qui partagent le même
// data-tour (sidebar desktop vs barre d'onglets mobile) — querySelector prendrait toujours
// le premier du DOM même s'il est caché (display:none) sur ce breakpoint.
//
// Ne JAMAIS retomber sur document.body quand rien ne correspond : driver.js considère toute
// valeur renvoyée comme "élément trouvé" (voir son helper interne `f()`), donc un fallback sur
// document.body rend `waitForElement` et `skipMissingElement` inopérants — au lieu d'attendre
// ou de sauter l'étape, il surlignerait toute la page (et la désactiverait entièrement avec
// disableActiveInteraction). Le typage de driver.js exige `Element` non-optionnel, mais son
// comportement réel tolère très bien `undefined` — le cast reflète ce contrat réel.
function resolveVisible(selector: string): Element {
  const candidates = Array.from(document.querySelectorAll(selector));
  const visible = candidates.find(el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  return (visible ?? candidates[0]) as Element;
}

// Anneau blanc qui pulse autour de l'élément à cliquer — le surlignage seul de driver.js
// ne rendait pas assez évident qu'il fallait cliquer (retour utilisateur).
// Repositionné en continu (requestAnimationFrame) plutôt qu'une seule fois : driver.js scrolle
// l'élément en vue juste après l'avoir surligné, et un calcul figé laissait l'anneau décalé
// (position figée au moment du highlight, avant la fin du scroll fluide).
let pulseEl: HTMLDivElement | null = null;
let pulseRaf: number | null = null;
let pulseTarget: Element | null = null;

function positionPulse() {
  if (!pulseEl || !pulseTarget) return;
  const rect = pulseTarget.getBoundingClientRect();
  const pad = 4;
  pulseEl.style.left = `${rect.left - pad}px`;
  pulseEl.style.top = `${rect.top - pad}px`;
  pulseEl.style.width = `${rect.width + pad * 2}px`;
  pulseEl.style.height = `${rect.height + pad * 2}px`;
  pulseEl.style.borderRadius = rect.width < 60 && Math.abs(rect.width - rect.height) < 20 ? '50%' : '16px';
}

function showPulse(el?: Element) {
  if (!el) return;
  if (!pulseEl) {
    pulseEl = document.createElement('div');
    pulseEl.className = 'q-tour-pulse-ring';
    document.body.appendChild(pulseEl);
  }
  pulseTarget = el;
  const loop = () => {
    positionPulse();
    pulseRaf = requestAnimationFrame(loop);
  };
  if (pulseRaf) cancelAnimationFrame(pulseRaf);
  loop();
}

function hidePulse() {
  if (pulseRaf) cancelAnimationFrame(pulseRaf);
  pulseRaf = null;
  pulseTarget = null;
  pulseEl?.remove();
  pulseEl = null;
}

// noPrevious : à mettre sur le tout premier pas d'une nouvelle page (juste après une
// navigation par clic). "Précédent" y ramènerait vers un pas dont l'élément vit sur la page
// d'AVANT — puisqu'aucune navigation ne se déclenche en arrière, l'élément est introuvable et
// le tuto reste bloqué dessus (soft lock : plus de bouton "Suivant" sur les pas "clique ici",
// juste "Précédent"/"×", qui rebouclent sur le même problème plus loin en arrière).
type StepOpts = { waitForElement?: number; skipMissingElement?: boolean; noPrevious?: boolean };

// Étape où l'action attendue est un vrai clic sur l'élément (navigation) plutôt que "Suivant".
const clickStep = (
  popover: Omit<NonNullable<DriveStep['popover']>, 'showButtons'>,
  element: DriveStep['element'],
  opts: StepOpts = {},
): DriveStep => {
  const { noPrevious, ...driverOpts } = opts;
  return {
    element,
    ...driverOpts,
    advanceOnClick: true,
    onHighlighted: (el) => showPulse(el),
    onDeselected: () => hidePulse(),
    popover: { ...popover, description: `${popover.description} Clique sur le bouton pour passer à la prochaine étape.`, showButtons: noPrevious ? ['close'] : ['previous', 'close'] },
  };
};

// Étape purement informative (le contenu de la page suffit, pas besoin de cliquer pour voir).
// L'élément reste désactivé pendant l'étape (disableActiveInteraction) — sinon cliquer dessus
// (ex: la cloche de notifs) déclenche sa vraie action et perturbe l'affichage du tuto.
const infoStep = (
  popover: Omit<NonNullable<DriveStep['popover']>, 'showButtons'>,
  element?: DriveStep['element'],
  opts: StepOpts = {},
): DriveStep => {
  const { noPrevious, ...driverOpts } = opts;
  let buttons: NonNullable<DriveStep['popover']>['showButtons'] = ['next', 'close'];
  if (element) buttons = noPrevious ? ['next', 'close'] : ['next', 'previous', 'close'];
  return {
    element,
    ...driverOpts,
    disableActiveInteraction: true,
    popover: { ...popover, showButtons: buttons },
  };
};

const STEPS: DriveStep[] = [
  infoStep({
    title: 'Bienvenue sur U-Quail !',
    description: "Transforme tes objectifs en défis, gagne des coins et de l'XP en les complétant, et fais grimper ta série de jours (streak). On te montre rapidement comment ça marche.",
  }),
  infoStep(
    { title: 'Accueil', description: "Ta page d'accueil résume ta progression : niveau, XP, streak actuelle, et le défi du jour.", side: 'bottom', align: 'start' },
    () => resolveVisible('[data-tour="nav-accueil"]'),
  ),
  infoStep(
    { title: 'Notifications', description: 'Demandes d\'amis, invitations de groupe, nouveaux messages et alertes de streak arrivent ici.', side: 'left', align: 'start' },
    () => resolveVisible('[data-tour="home-notif"]'),
    { waitForElement: 1500 },
  ),
  infoStep(
    { title: 'Ta progression', description: "Ton niveau, l'XP qu'il te reste avant le prochain, et le nombre de défis en cours — tout est résumé ici.", side: 'bottom', align: 'start' },
    () => resolveVisible('[data-tour="home-xp"]'),
    { waitForElement: 1500 },
  ),
  infoStep(
    { title: 'Ta streak', description: "Complète au moins un défi chaque jour pour la faire grimper — plus elle est haute, plus tes récompenses sont multipliées.", side: 'bottom', align: 'start' },
    () => resolveVisible('[data-tour="home-streak"]'),
    { waitForElement: 1500 },
  ),
  infoStep(
    { title: 'Ta journée', description: 'Les défis que tu as commencés et pas encore terminés apparaissent ici, pour y revenir facilement.', side: 'bottom', align: 'start' },
    () => resolveVisible('[data-tour="home-today"]'),
    { waitForElement: 1500 },
  ),
  infoStep(
    { title: 'Classement', description: 'Le podium des joueurs les mieux classés — tu peux le consulter en entier plus tard, pas besoin d\'y aller maintenant.', side: 'top', align: 'start' },
    () => resolveVisible('[data-tour="home-leaderboard"], [data-tour="nav-classement"]'),
    { waitForElement: 1500 },
  ),
  infoStep(
    { title: 'Suggestion du jour', description: 'Un défi mis en avant chaque jour, avec un bonus de récompense (+50%) si tu le complètes aujourd\'hui.', side: 'top', align: 'start' },
    () => resolveVisible('[data-tour="home-daily"]'),
    { waitForElement: 1500 },
  ),
  clickStep(
    { title: 'Défis', description: 'Parcours les défis disponibles, rejoins-en un, et complète-le pour gagner des récompenses.', side: 'bottom', align: 'start' },
    () => resolveVisible('[data-tour="nav-defis"]'),
  ),
  infoStep(
    { title: 'Voici tes défis', description: 'Ta progression (coins, niveau, défis complétés) est résumée ici.', side: 'bottom', align: 'start' },
    () => resolveVisible('[data-tour="page-defis"]'),
    { waitForElement: 2000, noPrevious: true },
  ),
  {
    ...infoStep(
      { title: 'Choisis parmi les défis existants', description: 'Rejoins directement un défi déjà proposé par la communauté — pas besoin de créer le tien pour commencer.', side: 'top', align: 'start' },
      () => resolveVisible('[data-tour="page-defis-available"]'),
    ),
    skipMissingElement: true,
  },
  clickStep(
    { title: 'Créer un défi', description: 'Ou crée le tien depuis ce bouton — on va détailler le formulaire.', side: 'bottom', align: 'end' },
    () => resolveVisible('[data-tour="create-challenge"]'),
  ),
  infoStep(
    { title: 'Le titre', description: 'Un titre court et clair pour ton défi (ex: "Courir 5km sans s\'arrêter").', side: 'bottom', align: 'start' },
    () => resolveVisible('[data-tour="create-title"]'),
    { waitForElement: 2000, noPrevious: true },
  ),
  infoStep(
    { title: 'La description', description: "Explique précisément ce qu'il faut accomplir pour valider le défi.", side: 'top', align: 'start' },
    () => resolveVisible('[data-tour="create-description"]'),
  ),
  infoStep(
    { title: 'La catégorie', description: 'Classe ton défi (Gaming, Sport, Cuisine...) pour que les autres joueurs le retrouvent facilement.', side: 'top', align: 'start' },
    () => resolveVisible('[data-tour="create-category"]'),
  ),
  infoStep(
    { title: "Pas d'inspiration ?", description: "L'assistant IA peut générer une série entière de défis personnalisés à partir de ton objectif — plus besoin de tout remplir à la main.", side: 'left', align: 'start' },
    () => resolveVisible('[data-tour="create-ai"]'),
  ),
  clickStep(
    { title: 'Amis', description: 'Ajoute des amis, suis leur progression et défie-les.', side: 'bottom', align: 'start' },
    () => resolveVisible('[data-tour="nav-amis"]'),
    { waitForElement: 2000 },
  ),
  clickStep(
    { title: 'Recherche des joueurs', description: 'Trouve n\'importe qui par pseudo et envoie-lui une demande d\'ami.', side: 'bottom', align: 'start' },
    () => resolveVisible('[data-tour="friends-search"]'),
    { waitForElement: 2000, noPrevious: true },
  ),
  {
    // Le champ n'existe que sous l'onglet "Rechercher" — s'il est encore en train de
    // s'afficher juste après le clic sur l'onglet, on patiente un peu.
    ...infoStep(
      { title: 'La barre de recherche', description: 'Tape un pseudo ici pour trouver un joueur et lui envoyer une demande d\'ami.', side: 'bottom', align: 'start' },
      () => resolveVisible('[data-tour="friends-search-input"]'),
      { waitForElement: 1000 },
    ),
    skipMissingElement: true,
  },
  clickStep(
    { title: 'Demandes en attente', description: 'Les demandes d\'amis reçues (et un badge quand il y en a de nouvelles) apparaissent dans cet onglet.', side: 'bottom', align: 'start' },
    () => resolveVisible('[data-tour="friends-requests"]'),
    { noPrevious: true },
  ),
  clickStep(
    { title: 'Boutique', description: 'Dépense tes coins pour débloquer cadres, bannières, titres et badges.', side: 'bottom', align: 'start' },
    () => resolveVisible('[data-tour="nav-boutique"]'),
    { waitForElement: 2000 },
  ),
  infoStep(
    { title: 'Voici la boutique', description: 'Ton solde de coins est affiché ici en permanence.', side: 'bottom', align: 'end' },
    () => resolveVisible('[data-tour="page-boutique"]'),
    { waitForElement: 2000, noPrevious: true },
  ),
  {
    ...infoStep(
      { title: 'Ce que tu peux acheter', description: 'Cadres d\'avatar, bannières, titres et badges de différentes raretés — dépense tes coins pour personnaliser ton profil. Fais défiler pour tout voir.', side: 'top', align: 'start' },
      () => resolveVisible('[data-tour="shop-items"]'),
    ),
    // Cette grille peut dépasser la hauteur de l'écran (beaucoup d'articles) — contrairement
    // aux autres étapes "info", on laisse l'interaction active pour que la page reste
    // scrollable/cliquable même quand la zone mise en avant dépasse le viewport.
    disableActiveInteraction: false,
  },
  clickStep(
    { title: 'Profil', description: 'Retrouve ici tes réglages, ton historique de défis, et la personnalisation de ton compte.', side: 'bottom', align: 'end' },
    () => resolveVisible('[data-tour="nav-profil"], [data-tour="nav-avatar"]'),
    { waitForElement: 2000, skipMissingElement: true },
  ),
  {
    ...infoStep(
      { title: 'Ton niveau', description: 'Ton pseudo, ton niveau et ta progression sont affichés en haut de ton profil.', side: 'bottom', align: 'start' },
      () => resolveVisible('[data-tour="profile-level"]'),
      { waitForElement: 2000, noPrevious: true },
    ),
    // Sur desktop, l'avatar ouvre un menu au lieu de naviguer directement vers /profile :
    // on ne bloque pas le tuto si cette étape ne trouve jamais son élément.
    skipMissingElement: true,
  },
  {
    // Toujours présent une fois la page chargée (pas de wait nécessaire : l'attente s'est
    // déjà faite à l'étape "Ton niveau" juste avant, sur le même chargement de page).
    ...infoStep(
      { title: 'Personnalise ton compte', description: 'Change ta photo, ta bannière, ta bio et ton pseudo — et retrouve juste en dessous le changement de mot de passe et d\'adresse email.', side: 'bottom', align: 'start' },
      () => resolveVisible('[data-tour="profile-edit"]'),
    ),
    skipMissingElement: true,
  },
  {
    ...infoStep(
      { title: 'Tes cosmétiques', description: "Les objets achetés en boutique (cadres, bannières, titres, badges) se gèrent et s'équipent ici.", side: 'top', align: 'start' },
      () => resolveVisible('[data-tour="profile-cosmetics"]'),
    ),
    skipMissingElement: true,
  },
  {
    // Celui-ci PEUT être réellement absent (compte sans aucun défi complété) — un wait court
    // suffit largement (la page est déjà chargée), pas besoin des 2s des étapes cross-page :
    // avec 2000ms ici, "Suivant" restait bloqué 2 secondes avant de sauter l'étape.
    ...infoStep(
      { title: 'Ton historique', description: 'Tous les défis que tu as complétés ou en cours, avec le détail de chacun.', side: 'top', align: 'start' },
      () => resolveVisible('[data-tour="profile-history"]'),
      { waitForElement: 300 },
    ),
    skipMissingElement: true,
  },
  {
    ...infoStep(
      { title: 'Tes réglages', description: 'Thème, notifications et langue se configurent dans cette section. Tu peux aussi revoir ce tutoriel à tout moment depuis ici.', side: 'top', align: 'start' },
      () => resolveVisible('[data-tour="profile-settings"]'),
    ),
    skipMissingElement: true,
  },
  {
    ...infoStep(
      { title: 'Apparence', description: 'Bascule entre thème clair et sombre.', side: 'top', align: 'start' },
      () => resolveVisible('[data-tour="settings-appearance"]'),
    ),
    skipMissingElement: true,
  },
  {
    ...infoStep(
      { title: 'Notifications', description: 'Choisis quelles notifications tu veux recevoir : rappels de défis, nouveaux messages, mises à jour...', side: 'top', align: 'start' },
      () => resolveVisible('[data-tour="settings-notifications"]'),
    ),
    skipMissingElement: true,
  },
  {
    ...infoStep(
      { title: 'Accessibilité', description: 'Change la langue de l\'appli ou réduis les animations.', side: 'top', align: 'start' },
      () => resolveVisible('[data-tour="settings-accessibility"]'),
    ),
    skipMissingElement: true,
  },
  infoStep({
    title: "C'est tout bon !",
    description: "Tu sais maintenant comment fonctionne U-Quail. Tu peux revoir ce tutoriel à tout moment depuis Profil → Paramètres → Revoir le tutoriel. Bon défis !",
  }),
];

// Composant purement imperatif : driver.js gère lui-même son DOM (overlay + popover
// montés sur document.body), donc ce composant ne rend rien — il pilote juste la lib
// en fonction de l'état `tourOpen` du store.
const OnboardingTour: React.FC = () => {
  const { tourOpen, closeTour } = useStore();

  useEffect(() => {
    if (!tourOpen) return;

    // Remise en haut de page explicite, indépendante de l'effet de scroll de Layout.tsx :
    // les effets des composants enfants (celui-ci) s'exécutent avant ceux du parent (Layout),
    // donc se reposer uniquement sur Layout laissait parfois la 1ère étape du tuto s'afficher
    // pendant que la page était encore scrollée au point où on avait cliqué "Revoir le tutoriel".
    // On réinitialise tous les conteneurs de scroll possibles (le vrai est <main>, mais on ne
    // prend pas de risque si html/body défilent aussi dans certains contextes).
    const resetScroll = () => {
      document.querySelector<HTMLElement>('main[aria-label="Contenu principal"]')?.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo(0, 0);
    };
    resetScroll();
    // Un 2e passage après le prochain paint, au cas où le contenu de la page (données
    // chargées en async) décale le scroll juste après ce premier appel.
    requestAnimationFrame(resetScroll);

    const driverObj = driver({
      steps: STEPS,
      showProgress: true,
      progressText: '{{current}} / {{total}}',
      animate: true,
      smoothScroll: true,
      overlayOpacity: 0.65,
      stageRadius: 12,
      popoverClass: 'q-tour-popover',
      nextBtnText: 'Suivant',
      prevBtnText: 'Précédent',
      doneBtnText: 'Terminer',
      // Un clic à côté ne doit pas fermer le tuto par accident (retour utilisateur) —
      // seuls le bouton × / "Terminer" / un vrai clic sur l'élément indiqué font avancer.
      overlayClickBehavior: () => {},
      onDestroyed: () => { hidePulse(); closeTour(); },
    });

    driverObj.drive();

    return () => { hidePulse(); driverObj.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourOpen]);

  return null;
};

export default OnboardingTour;
