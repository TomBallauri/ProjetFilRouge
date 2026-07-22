import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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

function buildSteps(t: TFunction): DriveStep[] {
  const step = (key: string) => ({
    title: t(`onboarding.steps.${key}.title`),
    description: t(`onboarding.steps.${key}.description`),
  });

  // Étape où l'action attendue est un vrai clic sur l'élément (navigation) plutôt que "Suivant".
  const clickStep = (
    key: string,
    element: DriveStep['element'],
    popoverExtra: Partial<NonNullable<DriveStep['popover']>> = {},
    opts: StepOpts = {},
  ): DriveStep => {
    const { noPrevious, ...driverOpts } = opts;
    const { title, description } = step(key);
    return {
      element,
      ...driverOpts,
      advanceOnClick: true,
      onHighlighted: (el) => showPulse(el),
      onDeselected: () => hidePulse(),
      popover: {
        title, ...popoverExtra,
        description: `${description} ${t('onboarding.clickToAdvance')}`,
        showButtons: noPrevious ? ['close'] : ['previous', 'close'],
      },
    };
  };

  // Étape purement informative (le contenu de la page suffit, pas besoin de cliquer pour voir).
  // L'élément reste désactivé pendant l'étape (disableActiveInteraction) — sinon cliquer dessus
  // (ex: la cloche de notifs) déclenche sa vraie action et perturbe l'affichage du tuto.
  const infoStep = (
    key: string,
    element?: DriveStep['element'],
    popoverExtra: Partial<NonNullable<DriveStep['popover']>> = {},
    opts: StepOpts = {},
  ): DriveStep => {
    const { noPrevious, ...driverOpts } = opts;
    let buttons: NonNullable<DriveStep['popover']>['showButtons'] = ['next', 'close'];
    if (element) buttons = noPrevious ? ['next', 'close'] : ['next', 'previous', 'close'];
    return {
      element,
      ...driverOpts,
      disableActiveInteraction: true,
      popover: { ...step(key), ...popoverExtra, showButtons: buttons },
    };
  };

  return [
    infoStep('welcome'),
    infoStep('home', () => resolveVisible('[data-tour="nav-accueil"]'), { side: 'bottom', align: 'start' }),
    infoStep('notifications', () => resolveVisible('[data-tour="home-notif"]'), { side: 'left', align: 'start' }, { waitForElement: 1500 }),
    infoStep('progress', () => resolveVisible('[data-tour="home-xp"]'), { side: 'bottom', align: 'start' }, { waitForElement: 1500 }),
    infoStep('streak', () => resolveVisible('[data-tour="home-streak"]'), { side: 'bottom', align: 'start' }, { waitForElement: 1500 }),
    infoStep('today', () => resolveVisible('[data-tour="home-today"]'), { side: 'bottom', align: 'start' }, { waitForElement: 1500 }),
    infoStep('leaderboard', () => resolveVisible('[data-tour="home-leaderboard"], [data-tour="nav-classement"]'), { side: 'top', align: 'start' }, { waitForElement: 1500 }),
    infoStep('dailySuggestion', () => resolveVisible('[data-tour="home-daily"]'), { side: 'top', align: 'start' }, { waitForElement: 1500 }),
    clickStep('challengesNav', () => resolveVisible('[data-tour="nav-defis"]'), { side: 'bottom', align: 'start' }),
    infoStep('challengesIntro', () => resolveVisible('[data-tour="page-defis"]'), { side: 'bottom', align: 'start' }, { waitForElement: 2000, noPrevious: true }),
    {
      ...infoStep('existingChallenges', () => resolveVisible('[data-tour="page-defis-available"]'), { side: 'top', align: 'start' }),
      skipMissingElement: true,
    },
    clickStep('createChallengeNav', () => resolveVisible('[data-tour="create-challenge"]'), { side: 'bottom', align: 'end' }),
    infoStep('title', () => resolveVisible('[data-tour="create-title"]'), { side: 'bottom', align: 'start' }, { waitForElement: 2000, noPrevious: true }),
    infoStep('description', () => resolveVisible('[data-tour="create-description"]'), { side: 'top', align: 'start' }),
    infoStep('category', () => resolveVisible('[data-tour="create-category"]'), { side: 'top', align: 'start' }),
    infoStep('aiHint', () => resolveVisible('[data-tour="create-ai"]'), { side: 'left', align: 'start' }),
    clickStep('friendsNav', () => resolveVisible('[data-tour="nav-amis"]'), { side: 'bottom', align: 'start' }, { waitForElement: 2000 }),
    clickStep('searchPlayers', () => resolveVisible('[data-tour="friends-search"]'), { side: 'bottom', align: 'start' }, { waitForElement: 2000, noPrevious: true }),
    {
      // Le champ n'existe que sous l'onglet "Rechercher" — s'il est encore en train de
      // s'afficher juste après le clic sur l'onglet, on patiente un peu.
      ...infoStep('searchBar', () => resolveVisible('[data-tour="friends-search-input"]'), { side: 'bottom', align: 'start' }, { waitForElement: 1000 }),
      skipMissingElement: true,
    },
    clickStep('pendingRequests', () => resolveVisible('[data-tour="friends-requests"]'), { side: 'bottom', align: 'start' }, { noPrevious: true }),
    clickStep('shopNav', () => resolveVisible('[data-tour="nav-boutique"]'), { side: 'bottom', align: 'start' }, { waitForElement: 2000 }),
    infoStep('shopIntro', () => resolveVisible('[data-tour="page-boutique"]'), { side: 'bottom', align: 'end' }, { waitForElement: 2000, noPrevious: true }),
    {
      ...infoStep('shopItems', () => resolveVisible('[data-tour="shop-items"]'), { side: 'top', align: 'start' }),
      // Cette grille peut dépasser la hauteur de l'écran (beaucoup d'articles) — contrairement
      // aux autres étapes "info", on laisse l'interaction active pour que la page reste
      // scrollable/cliquable même quand la zone mise en avant dépasse le viewport.
      disableActiveInteraction: false,
    },
    clickStep('profileNav', () => resolveVisible('[data-tour="nav-profil"], [data-tour="nav-avatar"]'), { side: 'bottom', align: 'end' }, { waitForElement: 2000, skipMissingElement: true }),
    {
      ...infoStep('profileLevel', () => resolveVisible('[data-tour="profile-level"]'), { side: 'bottom', align: 'start' }, { waitForElement: 2000, noPrevious: true }),
      // Sur desktop, l'avatar ouvre un menu au lieu de naviguer directement vers /profile :
      // on ne bloque pas le tuto si cette étape ne trouve jamais son élément.
      skipMissingElement: true,
    },
    {
      // Toujours présent une fois la page chargée (pas de wait nécessaire : l'attente s'est
      // déjà faite à l'étape "Ton niveau" juste avant, sur le même chargement de page).
      ...infoStep('profileEdit', () => resolveVisible('[data-tour="profile-edit"]'), { side: 'bottom', align: 'start' }),
      skipMissingElement: true,
    },
    {
      ...infoStep('profileCosmetics', () => resolveVisible('[data-tour="profile-cosmetics"]'), { side: 'top', align: 'start' }),
      skipMissingElement: true,
    },
    {
      // Celui-ci PEUT être réellement absent (compte sans aucun défi complété) — un wait court
      // suffit largement (la page est déjà chargée), pas besoin des 2s des étapes cross-page :
      // avec 2000ms ici, "Suivant" restait bloqué 2 secondes avant de sauter l'étape.
      ...infoStep('profileHistory', () => resolveVisible('[data-tour="profile-history"]'), { side: 'top', align: 'start' }, { waitForElement: 300 }),
      skipMissingElement: true,
    },
    {
      ...infoStep('profileSettings', () => resolveVisible('[data-tour="profile-settings"]'), { side: 'top', align: 'start' }),
      skipMissingElement: true,
    },
    {
      ...infoStep('appearance', () => resolveVisible('[data-tour="settings-appearance"]'), { side: 'top', align: 'start' }),
      skipMissingElement: true,
    },
    {
      ...infoStep('notificationsSettings', () => resolveVisible('[data-tour="settings-notifications"]'), { side: 'top', align: 'start' }),
      skipMissingElement: true,
    },
    {
      ...infoStep('accessibility', () => resolveVisible('[data-tour="settings-accessibility"]'), { side: 'top', align: 'start' }),
      skipMissingElement: true,
    },
    infoStep('done'),
  ];
}

// Composant purement imperatif : driver.js gère lui-même son DOM (overlay + popover
// montés sur document.body), donc ce composant ne rend rien — il pilote juste la lib
// en fonction de l'état `tourOpen` du store.
const OnboardingTour: React.FC = () => {
  const { tourOpen, closeTour } = useStore();
  const { t } = useTranslation();

  useEffect(() => {
    if (!tourOpen) return;

    // Remise en haut de page explicite, indépendante de l'effet de scroll de Layout.tsx :
    // les effets des composants enfants (celui-ci) s'exécutent avant ceux du parent (Layout),
    // donc se reposer uniquement sur Layout laissait parfois la 1ère étape du tuto s'afficher
    // pendant que la page était encore scrollée au point où on avait cliqué "Revoir le tutoriel".
    // On réinitialise tous les conteneurs de scroll possibles (le vrai est <main>, mais on ne
    // prend pas de risque si html/body défilent aussi dans certains contextes).
    const resetScroll = () => {
      // Sélecteur indépendant de la langue (l'aria-label de <main> est maintenant traduit) —
      // il n'y a qu'un seul <main> sur la page, pas besoin de le qualifier davantage.
      document.querySelector<HTMLElement>('main')?.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo(0, 0);
    };
    resetScroll();
    // Un 2e passage après le prochain paint, au cas où le contenu de la page (données
    // chargées en async) décale le scroll juste après ce premier appel.
    requestAnimationFrame(resetScroll);

    const driverObj = driver({
      steps: buildSteps(t),
      showProgress: true,
      progressText: '{{current}} / {{total}}',
      animate: true,
      smoothScroll: true,
      overlayOpacity: 0.65,
      stageRadius: 12,
      popoverClass: 'q-tour-popover',
      nextBtnText: t('onboarding.nextButton'),
      prevBtnText: t('onboarding.prevButton'),
      doneBtnText: t('onboarding.doneButton'),
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
