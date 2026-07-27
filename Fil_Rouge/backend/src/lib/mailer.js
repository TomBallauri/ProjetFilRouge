// API HTTP de Resend plutôt qu'un SMTP (nodemailer + Gmail) — évite le blocage des ports SMTP
// sortants sur les plans Render gratuits (qui obligeait à payer le plan Starter), et n'a besoin
// que d'un domaine vérifié chez Resend, pas d'un compte Gmail dédié.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_URL = 'https://api.resend.com/emails';

export const mailer = {
  async sendMail({ from, to, subject, html }) {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Resend a refusé l'envoi (HTTP ${res.status}): ${detail}`);
    }
    return res.json();
  },
};
