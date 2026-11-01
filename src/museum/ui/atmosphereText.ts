/**
 * Strings of the light and weather controls that the shared dictionaries (i18n/en, hi, bn) do
 * not carry, in the same three languages. Kept with the controls (WP2) so the frozen
 * dictionaries need no edit; the shared `spectacle.*` and `time.*` keys are used where they exist.
 */
import { useLang, type Lang } from '../i18n'

const TEXT = {
  title: { en: 'Light and weather', hi: 'रोशनी और मौसम', bn: 'আলো ও আবহাওয়া' },
  weather: { en: 'Weather', hi: 'मौसम', bn: 'আবহাওয়া' },
  lamps: { en: 'Lamps', hi: 'दीये', bn: 'প্রদীপ' },
  lampsNote: { en: 'Lit at dusk', hi: 'साँझ को जलते हैं', bn: 'সন্ধ্যায় জ্বলে' },
  sunrise: { en: 'Sunrise', hi: 'सूर्योदय', bn: 'সূর্যোদয়' },
  sunset: { en: 'Sunset', hi: 'सूर्यास्त', bn: 'সূর্যাস্ত' },
  istNow: { en: 'Kharagpur time', hi: 'खड़गपुर का समय', bn: 'খড়্গপুরের সময়' },
  dialHelp: {
    en: 'Drag the sun along its path, or use the arrow keys. Home and End go to sunrise and sunset.',
    hi: 'सूरज को उसके पथ पर खींचें, या तीर कुंजियों का उपयोग करें। Home और End सूर्योदय और सूर्यास्त पर ले जाते हैं।',
    bn: 'সূর্যকে তার পথে টানুন, বা তীর-চাবি ব্যবহার করুন। Home আর End সূর্যোদয় ও সূর্যাস্তে নিয়ে যায়।',
  },
  byDay: { en: 'Show daylight', hi: 'दिन का उजाला दिखाएँ', bn: 'দিনের আলো দেখান' },
  stayNight: { en: 'Stay with the night', hi: 'रात ही रहने दें', bn: 'রাতেই থাকুন' },
  petrichor: {
    en: 'Petrichor, the smell of rain on dry earth: in Kannauj it is distilled from baked clay as mitti attar.',
    hi: 'पेट्रिकोर, सूखी धरती पर बारिश की गंध: कन्नौज में इसे पकी मिट्टी से मिट्टी अत्तर के रूप में आसवित किया जाता है।',
    bn: 'পেট্রিকর, শুকনো মাটিতে বৃষ্টির গন্ধ: কনৌজে পোড়া মাটি থেকে একে মিট্টি আতর হিসেবে চোলাই করা হয়।',
  },
  close: { en: 'Close', hi: 'बंद करें', bn: 'বন্ধ করুন' },
} satisfies Record<string, Record<Lang, string>>

export type AtmosKey = keyof typeof TEXT

export function useAtmosText() {
  const lang = useLang()
  return (k: AtmosKey) => TEXT[k][lang] ?? TEXT[k].en
}
