const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://lumyf.com";

const cleanBase = BASE_URL.replace(/\/$/, "");

// Helps Google understand the brand entity and associate the logo
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Lumyf",
  url: cleanBase,
  logo: {
    "@type": "ImageObject",
    url: `${cleanBase}/logo.png`,
    width: 200,
    height: 60,
  },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    availableLanguage: ["Portuguese", "English", "Spanish"],
  },
};

// Enables Google Sitelinks Searchbox appearance in search results
const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Lumyf",
  url: cleanBase,
};

// Core product schema — aggregateRating omitted until real verified reviews exist
const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Lumyf",
  description:
    "App de gestão financeira pessoal com compartilhamento opcional. Controle receitas, despesas, investimentos e metas financeiras para casais e famílias.",
  url: cleanBase,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web, iOS, Android",
  offers: {
    "@type": "Offer",
    name: "Plano Pro — 7 dias grátis",
    price: "9.90",
    priceCurrency: "BRL",
    priceValidUntil: "2026-12-31",
    availability: "https://schema.org/InStock",
    description:
      "Acesso completo por 7 dias grátis. Sem cartão de crédito para começar.",
  },
  publisher: {
    "@type": "Organization",
    name: "Lumyf",
    url: cleanBase,
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "O Lumyf é gratuito?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sim. O Lumyf oferece 7 dias de teste gratuito com acesso a todas as funcionalidades, sem necessidade de cartão de crédito. Após o período de teste, o plano Pro custa R$ 9,90/mês.",
      },
    },
    {
      "@type": "Question",
      name: "Como funciona o compartilhamento com a família?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Cada família cria um workspace e convida membros por e-mail. Todos os membros convidados podem consultar e registrar dados em tempo real. Você define o que é compartilhado e o que permanece privado.",
      },
    },
    {
      "@type": "Question",
      name: "Meus dados financeiros estão seguros?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sim. Utilizamos criptografia e autenticação segura via Supabase. Seus dados financeiros ficam protegidos e apenas as pessoas que você convidar terão acesso ao workspace. O Lumyf não se conecta diretamente a contas bancárias.",
      },
    },
    {
      "@type": "Question",
      name: "Posso cancelar a qualquer momento?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sim. Não há contratos de longo prazo. Você pode cancelar sua assinatura a qualquer momento diretamente nas configurações da conta, sem taxas de cancelamento.",
      },
    },
  ],
};

export function LandingStructuredData() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  );
}
