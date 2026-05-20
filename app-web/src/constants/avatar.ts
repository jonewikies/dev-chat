const createSvgAvatarDataUri = (emoji: string, background: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
      <rect width="128" height="128" rx="32" fill="${background}"/>
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-size="68">` +
        `${emoji}</text>
    </svg>`
  )}`;

export const DEFAULT_AVATAR_URL =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="32" fill="%23DBEAFE"/><circle cx="64" cy="48" r="22" fill="%236B7280"/><path d="M28 108c6-18 22-30 36-30s30 12 36 30" fill="%236B7280"/></svg>';

export const GROUP_CHAT_AVATAR_URL =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="32" fill="%23D1FAE5"/><circle cx="47" cy="48" r="18" fill="%23059669"/><circle cx="82" cy="53" r="16" fill="%2310B981"/><path d="M20 104c4-16 18-28 33-28s29 12 33 28" fill="%23059669"/><path d="M58 104c4-14 16-24 29-24s25 10 29 24" fill="%2310B981"/></svg>';

const animalEmojis = [
  '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯',
  '🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧',
  '🐦','🐤','🐣','🦆','🦅','🦉','🦇','🐺','🐗','🐴',
  '🦄','🐝','🪲','🐛','🦋','🐌','🐞','🐜','🪰','🪱',
  '🐢','🐍','🦎','🦂','🦀','🦞','🦐','🦑','🐙','🐠',
  '🐟','🐡','🦈','🐬','🐳','🐋','🦭','🐊','🐅','🐆',
  '🦓','🦍','🦧','🐘','🦛','🦏','🐪','🐫','🦒','🦘',
  '🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐',
  '🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🪿','🦚','🦜',
  '🪽','🐇','🦝','🦨','🦡','🦔','🐓','🦃','🕊️','🐿️',
];

const avatarBackgrounds = [
  '#FDE68A', '#FDBA74', '#FCA5A5', '#F9A8D4', '#C4B5FD',
  '#A5B4FC', '#93C5FD', '#67E8F9', '#5EEAD4', '#86EFAC',
];

export const PRESET_ANIMAL_AVATARS = animalEmojis.map((emoji, index) => ({
  id: `animal-${index + 1}`,
  emoji,
  label: `动物头像 ${index + 1}`,
  url: createSvgAvatarDataUri(emoji, avatarBackgrounds[index % avatarBackgrounds.length]),
}));

export const getAvatarUrl = (avatarUrl?: string | null): string => {
  const normalized = avatarUrl?.trim();
  return normalized || DEFAULT_AVATAR_URL;
};
