# Assets públicos

## Ícones PWA / App móvel

Os ícones em alta resolução para PWA e "Adicionar à tela inicial" são gerados a partir de `pig.png`:

```bash
npm run generate-icons
```

Gera: `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180×180).

## Imagem Open Graph / Twitter Card

Para compartilhamento em redes sociais (Facebook, LinkedIn, Twitter, WhatsApp etc.), adicione:

- **Arquivo:** `og-image.jpg`
- **Dimensões:** 1200 × 630 px
- **Conteúdo sugerido:** logo/marca do Lumyf ou hero da landing page, com texto legível.

A URL será resolvida automaticamente via `metadataBase` (ex.: `https://seu-dominio.com/og-image.jpg`). Se o arquivo não existir, os cards sociais podem não exibir imagem.
