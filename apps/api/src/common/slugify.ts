export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[ё]/g, 'e')
    .replace(/[а-яəğıöüşç]/gi, (ch) => {
      const map: Record<string, string> = {
        а: 'a',
        б: 'b',
        в: 'v',
        г: 'g',
        д: 'd',
        е: 'e',
        ж: 'zh',
        з: 'z',
        и: 'i',
        й: 'y',
        к: 'k',
        л: 'l',
        м: 'm',
        н: 'n',
        о: 'o',
        п: 'p',
        р: 'r',
        с: 's',
        т: 't',
        у: 'u',
        ф: 'f',
        х: 'h',
        ц: 'ts',
        ч: 'ch',
        ш: 'sh',
        щ: 'sch',
        ъ: '',
        ы: 'y',
        ь: '',
        э: 'e',
        ю: 'yu',
        я: 'ya',
        ə: 'e',
        ğ: 'g',
        ı: 'i',
        ö: 'o',
        ü: 'u',
        ş: 'sh',
        ç: 'c',
      };
      return map[ch.toLowerCase()] ?? '';
    })
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
