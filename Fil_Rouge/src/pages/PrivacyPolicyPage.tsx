import React from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { ArrowLeft } from 'lucide-react';

// Politique de confidentialité statique (pas de traduction i18n) : c'est un document légal
// dont le contenu doit rester maîtrisé par celui qui en a la responsabilité, pas dérivé
// automatiquement — accessible sans connexion, route publiée telle quelle sur le Play Store.
const LAST_UPDATED = '6 août 2026';
const CONTACT_EMAIL = 'tom.ballauri@gmail.com';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section style={{ marginTop: 28 }}>
    <h2 style={{ fontSize: 17, fontFamily: 'var(--q-display)', color: 'var(--q-text)', marginBottom: 8 }}>
      {title}
    </h2>
    <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--q-text2)' }}>
      {children}
    </div>
  </section>
);

const PrivacyPolicyPage: React.FC = () => {
  const { darkMode } = useStore();

  return (
    <div className={darkMode ? 'dark' : ''} style={{ minHeight: '100vh', background: 'var(--q-bg)' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px 80px', fontFamily: 'var(--q-font)' }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--q-accent)', fontSize: 13, fontWeight: 700, textDecoration: 'none', marginBottom: 20 }}>
          <ArrowLeft size={15} aria-hidden="true" /> Retour à U-Quail
        </Link>

        <h1 style={{ fontSize: 28, fontFamily: 'var(--q-display)', color: 'var(--q-text)', marginBottom: 4 }}>
          Politique de confidentialité — U-Quail
        </h1>
        <p style={{ fontSize: 13, color: 'var(--q-text3)' }}>Dernière mise à jour : {LAST_UPDATED}</p>

        <Section title="Qui sommes-nous">
          <p>
            U-Quail est un projet personnel/étudiant développé par Tom Ballauri. Pour toute question
            relative à tes données personnelles, contacte : <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--q-accent)' }}>{CONTACT_EMAIL}</a>.
          </p>
        </Section>

        <Section title="Données que nous collectons">
          <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li><strong>Compte</strong> : email, pseudo, mot de passe (stocké haché, jamais en clair).</li>
            <li><strong>Profil</strong> : bio, avatar et bannière que tu choisis d'ajouter.</li>
            <li><strong>Activité dans l'app</strong> : défis créés/complétés/en cours, série de jours (streak), XP, niveau, pièces virtuelles, cosmétiques possédés.</li>
            <li><strong>Réseau social</strong> : liste d'amis, demandes d'ami, messages échangés dans les groupes de discussion liés aux défis.</li>
            <li><strong>Contenu généré par IA</strong> : si tu utilises la génération de défi par IA, le texte que tu saisis est transmis à Groq (fournisseur tiers) pour traitement.</li>
          </ul>
        </Section>

        <Section title="Pourquoi nous utilisons ces données">
          <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>Fournir le service : compte, défis, classement, amis, boutique de cosmétiques.</li>
            <li>Sécuriser ton compte (mot de passe haché, jetons de réinitialisation à usage unique).</li>
            <li>T'envoyer des emails liés à ton compte : confirmation, réinitialisation de mot de passe, changement d'adresse email.</li>
            <li>Générer du contenu personnalisé quand tu utilises la fonctionnalité de défi par IA.</li>
            <li>Traduire certains contenus de défis entre le français et l'anglais.</li>
          </ul>
        </Section>

        <Section title="Partage avec des tiers">
          <p style={{ marginBottom: 8 }}>
            Nous ne vendons aucune donnée. Certains prestataires techniques traitent des données pour
            notre compte, dans le seul but de faire fonctionner l'app :
          </p>
          <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li><strong>Hébergement</strong> : Vercel (frontend), Render (backend), Neon (base de données).</li>
            <li><strong>Email transactionnel</strong> : Resend.</li>
            <li><strong>Génération de défis par IA</strong> : Groq — uniquement le texte que tu saisis pour cette fonctionnalité.</li>
            <li><strong>Traduction</strong> : DeepL — pour certains contenus de défis.</li>
          </ul>
        </Section>

        <Section title="Conservation des données">
          <p>
            Tes données sont conservées tant que ton compte existe. Tu peux demander la suppression de
            ton compte et de l'ensemble de tes données à tout moment en écrivant à l'adresse ci-dessus.
          </p>
        </Section>

        <Section title="Tes droits">
          <p>
            Si tu résides dans l'Union européenne, tu disposes d'un droit d'accès, de rectification, de
            suppression, d'opposition et de portabilité sur tes données personnelles (RGPD). Pour exercer
            ces droits, contacte-nous à l'adresse indiquée en haut de cette page.
          </p>
        </Section>

        <Section title="Sécurité">
          <p>
            Les mots de passe sont hachés et jamais stockés en clair. Les échanges entre l'app et nos
            serveurs sont chiffrés (HTTPS).
          </p>
        </Section>

        <Section title="Stockage local">
          <p>
            L'app utilise le stockage local de ton navigateur/appareil (localStorage) pour garder ta
            session connectée. Nous n'utilisons pas de cookies de suivi publicitaire tiers.
          </p>
        </Section>

        <Section title="Âge minimum">
          <p>
            U-Quail n'est pas destiné aux enfants de moins de 13 ans. Si tu penses qu'un enfant de moins
            de 13 ans nous a fourni des données personnelles, contacte-nous pour que nous les supprimions.
          </p>
        </Section>

        <Section title="Modifications de cette politique">
          <p>
            Cette politique peut être mise à jour ; la date en haut de page indique la dernière
            modification.
          </p>
        </Section>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
