// Detects if a transaction description matches installment or subscription patterns

const SUBSCRIPTION_KEYWORDS = [
  'netflix','spotify','apple','youtube','amazon','disney','hbo','paramount',
  'globoplay','deezer','ifood','openai','chatgpt','microsoft','google','canva',
  'adobe','dropbox','github','notion','slack','zoom','assinatura','subscription',
  'recorrente','mensal','annual','yearly','prime','plus','premium','club',
];

const KNOWN_SUBSCRIPTIONS = {
  'netflix': { name: 'Netflix', icon_emoji: '🎬' },
  'spotify': { name: 'Spotify', icon_emoji: '🎵' },
  'apple': { name: 'Apple', icon_emoji: '🍎' },
  'youtube': { name: 'YouTube Premium', icon_emoji: '▶️' },
  'amazon': { name: 'Amazon Prime', icon_emoji: '📦' },
  'disney': { name: 'Disney+', icon_emoji: '🏰' },
  'openai': { name: 'OpenAI', icon_emoji: '🤖' },
  'ifood': { name: 'iFood Club', icon_emoji: '🍔' },
  'canva': { name: 'Canva', icon_emoji: '🎨' },
  'adobe': { name: 'Adobe', icon_emoji: '📐' },
  'microsoft': { name: 'Microsoft', icon_emoji: '🖥️' },
  'google': { name: 'Google', icon_emoji: '🔍' },
  'deezer': { name: 'Deezer', icon_emoji: '🎵' },
};

// Match: "3/12", "03/12", "parc 3 de 12", "3x", "12x", "parcela"
const INSTALLMENT_REGEX = [
  /\b(\d{1,2})\s*\/\s*(\d{1,2})\b/,
  /parcela\s*(\d+)\s*de\s*(\d+)/i,
  /parc\.?\s*(\d+)\/(\d+)/i,
  /\b(\d+)\s*x\b/i,
];

export function detectTransactionType(description = '') {
  const desc = description.toLowerCase();

  // Check installment
  for (const regex of INSTALLMENT_REGEX) {
    const match = desc.match(regex);
    if (match) {
      const current = parseInt(match[1]) || 1;
      const total = parseInt(match[2]) || parseInt(match[1]) || 1;
      return {
        type: 'installment',
        current_installment: current,
        total_installments: total > current ? total : current,
      };
    }
  }

  // Check subscription
  for (const keyword of SUBSCRIPTION_KEYWORDS) {
    if (desc.includes(keyword)) {
      const known = Object.entries(KNOWN_SUBSCRIPTIONS).find(([k]) => desc.includes(k));
      return {
        type: 'subscription',
        suggestedName: known ? known[1].name : null,
        icon_emoji: known ? known[1].icon_emoji : '📱',
      };
    }
  }

  return { type: 'transaction' };
}

export function parseInstallmentName(description = '') {
  // Remove the "X/Y" part and clean up the name
  return description
    .split(' | ')[0]
    .replace(/\b\d{1,2}\/\d{1,2}\b/g, '')
    .replace(/parcela\s*\d+\s*de\s*\d+/gi, '')
    .replace(/parc\.?\s*\d+\/\d+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
