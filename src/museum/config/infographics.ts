/**
 * WALL PANELS — the pavilion's interpretation.
 *
 *   annex G (east wall)   the three traditions and the way round
 *   A / B / C             one panel where each tradition begins
 *   hallway D             the making of a clay object, in order: prepare, form, dry, fire, finish
 *   F (court face)        the exhibition statement, under the oculus
 *
 * The copy is deliberately modest: general facts about working clay and the few widely
 * documented facts about each tradition. Every panel stays `placeholder: true` until the
 * workshop has read and confirmed it (set it to false then). Illustrations: only 'map'
 * (an abstract region, explicitly not a real map) and 'process' (numbered `steps`) suit clay;
 * 'dye' and 'block' draw hand block printing.
 */

import type { SurfaceId } from './layout'
import { atAngle, midAt } from './artworks'
import type { AltLang, ContentI18n } from '../i18n/core'

export type InfographicIcon = 'map' | 'dye' | 'block' | 'process'

export interface InfographicConfig {
  id: string
  kicker: string
  title: string
  body: string
  /** Optional numbered steps rendered as a process strip. */
  steps?: string[]
  icon: InfographicIcon
  placement: { surface: SurfaceId; at: number; centerHeight?: number }
  width: number
  height: number
  placeholder?: boolean
  /** Optional Hindi / Bengali overrides (`steps` as a translated list). */
  i18n?: Partial<Record<AltLang, Partial<Record<'kicker' | 'title' | 'body', string>> & { steps?: string[] }>>
}

/** Width / height of a standard panel (the design size the texture is laid out for is 1.45 × 1.95). */
const PANEL = { width: 1.0, height: 1.35 }

/** Placement centred where plan angle `aDeg` meets a drum surface. */
const onDrum = (surface: SurfaceId, aDeg: number, centerHeight = 1.55) => ({ surface, at: atAngle(surface, aDeg), centerHeight })

export const INFOGRAPHICS: InfographicConfig[] = [
  // ── Annex G: the three traditions, read on the way in (east wall, the visitor's right) ──
  {
    id: 'traditions',
    kicker: 'G',
    title: 'Three traditions of clay',
    body: 'Gallery A — Bankura terracotta, West Bengal. Gallery B — the votive plaques of Molela, Rajasthan. Gallery C — the black pottery of Longpi, Manipur. The galleries run round the drum to the right of the inner wall, and the hallway brings you back here.',
    icon: 'map',
    placement: { surface: 'g-east', at: midAt('g-east') + 1.2, centerHeight: 1.65 },
    width: 1.3,
    height: 1.75,
    placeholder: true,
    i18n: {
      hi: {
        title: 'मिट्टी की तीन परंपराएँ',
        body: 'गैलरी A — बाँकुड़ा टेराकोटा, पश्चिम बंगाल। गैलरी B — मोलेला की मन्नत पट्टिकाएँ, राजस्थान। गैलरी C — लोंगपी के काले मृद्भांड, मणिपुर। गैलरियाँ भीतरी दीवार के दाईं ओर से गोलाकार कक्ष में घूमती हैं, और गलियारा आपको वापस यहीं ले आता है।',
      },
      bn: {
        title: 'মাটির তিন ধারা',
        body: 'গ্যালারি A — বাঁকুড়ার টেরাকোটা, পশ্চিমবঙ্গ। গ্যালারি B — মোলেলার মানতের ফলক, রাজস্থান। গ্যালারি C — লংপির কালো মৃৎপাত্র, মণিপুর। গ্যালারিগুলি ভেতরের দেয়ালের ডান দিক দিয়ে গোল কক্ষ ঘিরে এগিয়েছে, আর করিডর আপনাকে আবার এখানেই ফিরিয়ে আনে।',
      },
    },
  },

  // ── One panel at the start of each tradition ─────────────────────────────────────
  {
    id: 'tradition-a',
    kicker: 'A',
    title: 'Bankura terracotta',
    body: 'Potters in the Bankura district of West Bengal make terracotta horses with long, upright necks and alert ears, thrown on the wheel in parts and then joined. The district is also known for its brick temples faced with panels of terracotta relief.',
    icon: 'map',
    placement: { surface: 'e-north-3', at: midAt('e-north-3'), centerHeight: 1.55 },
    ...PANEL,
    placeholder: true,
    i18n: {
      hi: {
        title: 'बाँकुड़ा टेराकोटा',
        body: 'पश्चिम बंगाल के बाँकुड़ा ज़िले के कुम्हार लंबी, सीधी गर्दन और खड़े कानों वाले टेराकोटा घोड़े बनाते हैं, जिनके हिस्से चाक पर अलग-अलग गढ़कर जोड़े जाते हैं। यह ज़िला ईंटों के उन मंदिरों के लिए भी जाना जाता है जिनकी दीवारें टेराकोटा की उभरी पट्टिकाओं से ढकी हैं।',
      },
      bn: {
        title: 'বাঁকুড়ার টেরাকোটা',
        body: 'পশ্চিমবঙ্গের বাঁকুড়া জেলার কুমোররা লম্বা, খাড়া গলা আর সজাগ কানওয়ালা টেরাকোটার ঘোড়া গড়েন; ঘোড়ার অংশগুলি চাকে আলাদা করে গড়ে পরে জোড়া হয়। এই জেলা টেরাকোটার রিলিফ ফলকে মোড়া ইটের মন্দিরের জন্যও পরিচিত।',
      },
    },
  },
  {
    id: 'tradition-b',
    kicker: 'B',
    title: 'The votive plaques of Molela',
    body: 'In the village of Molela, near Nathdwara in Rajasthan, potters model flat relief plaques of local deities in clay, then fire and often paint them. Families come from across the region to take plaques home for their shrines.',
    icon: 'map',
    placement: onDrum('b-outer-1', -27.5),
    ...PANEL,
    placeholder: true,
    i18n: {
      hi: {
        title: 'मोलेला की मन्नत पट्टिकाएँ',
        body: 'राजस्थान में नाथद्वारा के पास मोलेला गाँव के कुम्हार स्थानीय देवताओं की चपटी उभरी पट्टिकाएँ मिट्टी से गढ़ते हैं, फिर उन्हें पकाते हैं और अक्सर रँगते हैं। आसपास के पूरे क्षेत्र से परिवार अपने देवस्थानों के लिए ये पट्टिकाएँ ले जाने आते हैं।',
      },
      bn: {
        title: 'মোলেলার মানতের ফলক',
        body: 'রাজস্থানে নাথদ্বারার কাছে মোলেলা গ্রামের কুমোররা স্থানীয় দেবদেবীর চ্যাপ্টা রিলিফ ফলক মাটি দিয়ে গড়েন, তারপর পুড়িয়ে প্রায়ই রং করেন। আশপাশের গোটা অঞ্চল থেকে পরিবারেরা নিজেদের থানের জন্য এই ফলক নিয়ে যেতে আসেন।',
      },
    },
  },
  {
    id: 'tradition-c',
    kicker: 'C',
    title: 'Longpi black pottery',
    body: 'Longpi pottery comes from the Tangkhul Naga villages of Longpi in the Ukhrul district of Manipur. It is made without a wheel, from ground black stone mixed with clay, shaped by hand and with moulds, fired, and polished with leaves to a dark sheen.',
    icon: 'map',
    placement: onDrum('c-outer-1', -102.5),
    width: 0.72,
    height: 0.97,
    placeholder: true,
    i18n: {
      hi: {
        title: 'लोंगपी के काले मृद्भांड',
        body: 'लोंगपी के बर्तन मणिपुर के उखरुल ज़िले में लोंगपी के तांगखुल नागा गाँवों से आते हैं। ये चाक के बिना बनते हैं — पिसे हुए काले पत्थर को मिट्टी में मिलाकर, हाथ से और साँचों में आकार दिया जाता है, फिर पकाकर पत्तों से गहरी चमक तक घिसा जाता है।',
      },
      bn: {
        title: 'লংপির কালো মৃৎপাত্র',
        body: 'লংপির মৃৎপাত্র আসে মণিপুরের উখরুল জেলার লংপির তাংখুল নাগা গ্রামগুলি থেকে। চাক ছাড়াই তৈরি হয় — গুঁড়ো কালো পাথর মাটির সঙ্গে মিশিয়ে, হাতে আর ছাঁচে আকার দিয়ে, পুড়িয়ে, তারপর পাতা দিয়ে ঘষে গাঢ় আভা আনা হয়।',
      },
    },
  },

  // ── Hallway D: the making of a clay object, in order along the drum wall ──────────
  {
    id: 'process-prepare',
    kicker: '1',
    title: 'Preparing the clay',
    body: 'Clay is dug, dried and broken up, then soaked and sieved to take out stones and roots. Sand, ash or crushed stone may be worked in so the clay holds its shape and survives the fire. It is kneaded, often underfoot, until it is even and free of air.',
    steps: ['Dig', 'Soak', 'Sieve', 'Temper', 'Knead'],
    icon: 'process',
    placement: { surface: 'd-hallway-1', at: midAt('d-hallway-1'), centerHeight: 1.6 },
    ...PANEL,
    placeholder: true,
    i18n: {
      hi: {
        title: 'मिट्टी तैयार करना',
        body: 'मिट्टी खोदी जाती है, सुखाकर तोड़ी जाती है, फिर भिगोकर छानी जाती है ताकि कंकड़ और जड़ें निकल जाएँ। उसमें रेत, राख या पिसा पत्थर मिलाया जा सकता है ताकि मिट्टी आकार थामे रहे और आग में टिक सके। फिर उसे — अक्सर पैरों से — तब तक गूँधा जाता है जब तक वह एकसार और हवा-रहित न हो जाए।',
        steps: ['खोदना', 'भिगोना', 'छानना', 'मिलाना', 'गूँधना'],
      },
      bn: {
        title: 'মাটি তৈরি',
        body: 'মাটি খুঁড়ে, শুকিয়ে ভেঙে নেওয়া হয়, তারপর ভিজিয়ে ছেঁকে নুড়ি আর শিকড় বাদ দেওয়া হয়। মাটি যাতে আকার ধরে রাখে আর আগুনে টেকে, সেজন্য তাতে বালি, ছাই বা গুঁড়ো পাথর মেশানো হতে পারে। তারপর — প্রায়ই পা দিয়ে — মাটি ঠেসে নেওয়া হয়, যতক্ষণ না তা সমান ও বাতাসহীন হয়।',
        steps: ['খোঁড়া', 'ভেজানো', 'ছাঁকা', 'মেশানো', 'ঠাসা'],
      },
    },
  },
  {
    id: 'process-form',
    kicker: '2',
    title: 'Forming',
    body: 'A pot can be thrown on a turning wheel, built up from coils or slabs, beaten into shape with a paddle against a stone held inside, or pressed into a mould. Many pieces combine methods: a body thrown on the wheel, with handles, spouts or figures added by hand.',
    steps: ['Wheel', 'Coil', 'Slab', 'Paddle', 'Mould'],
    icon: 'process',
    placement: { surface: 'd-hallway-2', at: midAt('d-hallway-2'), centerHeight: 1.6 },
    ...PANEL,
    placeholder: true,
    i18n: {
      hi: {
        title: 'आकार देना',
        body: 'बर्तन घूमते चाक पर गढ़ा जा सकता है, मिट्टी की लड़ियों या पट्टियों से बनाया जा सकता है, भीतर पत्थर टिकाकर बाहर से थापी से पीटकर आकार दिया जा सकता है, या साँचे में दबाया जा सकता है। कई कृतियों में कई तरीके मिलते हैं: चाक पर बना ढाँचा, और हाथ से जोड़े गए हत्थे, टोंटियाँ या आकृतियाँ।',
        steps: ['चाक', 'लड़ी', 'पट्टी', 'थापी', 'साँचा'],
      },
      bn: {
        title: 'আকার দেওয়া',
        body: 'পাত্র ঘূর্ণমান চাকে গড়া যায়, মাটির দড়ি বা পাত জুড়ে তৈরি করা যায়, ভেতরে পাথর ধরে বাইরে থেকে পিটনি দিয়ে পিটিয়ে আকার দেওয়া যায়, কিংবা ছাঁচে চেপে বানানো যায়। অনেক কাজে একাধিক পদ্ধতি মেলে: চাকে গড়া দেহ, আর হাতে জোড়া হাতল, নল বা মূর্তি।',
        steps: ['চাক', 'দড়ি', 'পাত', 'পিটনি', 'ছাঁচ'],
      },
    },
  },
  {
    id: 'process-dry',
    kicker: '3',
    title: 'Drying',
    body: 'Shaped clay is left to dry slowly in the shade. If it dries too fast or unevenly, it cracks. As the water leaves, the clay shrinks and turns pale and hard enough to handle — but until it is fired, it would still return to mud in water.',
    steps: ['Shade', 'Turn', 'Leather-hard', 'Bone-dry'],
    icon: 'process',
    placement: { surface: 'd-hallway-3', at: midAt('d-hallway-3'), centerHeight: 1.6 },
    ...PANEL,
    placeholder: true,
    i18n: {
      hi: {
        title: 'सुखाना',
        body: 'आकार दी गई मिट्टी को छाया में धीरे-धीरे सूखने दिया जाता है। बहुत जल्दी या असमान सूखने पर उसमें दरारें पड़ जाती हैं। पानी निकलने के साथ मिट्टी सिकुड़ती है, हल्के रंग की और पकड़ने लायक सख़्त हो जाती है — पर पकाए जाने तक पानी में वह फिर कीचड़ बन जाएगी।',
        steps: ['छाया', 'पलटना', 'अधसूखा', 'पूरा सूखा'],
      },
      bn: {
        title: 'শুকানো',
        body: 'আকার দেওয়া মাটি ছায়ায় ধীরে ধীরে শুকোতে দেওয়া হয়। খুব তাড়াতাড়ি বা অসমান শুকোলে তাতে ফাটল ধরে। জল বেরিয়ে যেতে যেতে মাটি সংকুচিত হয়, ফ্যাকাশে আর হাতে ধরার মতো শক্ত হয় — কিন্তু পোড়ানোর আগে জলে পড়লে তা আবার কাদা হয়ে যাবে।',
        steps: ['ছায়া', 'ওলটানো', 'আধশুকনো', 'খটখটে'],
      },
    },
  },
  {
    id: 'process-fire',
    kicker: '4',
    title: 'Firing',
    body: 'Heat changes clay for good. Pots may be fired in the open, stacked with wood, straw or dung, or in a kiln that holds the heat. Air moving freely through the fire turns iron-rich clay red; a fire starved of air, or smoked at the end, turns it grey or black.',
    steps: ['Stack', 'Heat', 'Hold', 'Cool'],
    icon: 'process',
    placement: { surface: 'd-hallway-4', at: midAt('d-hallway-4'), centerHeight: 1.6 },
    ...PANEL,
    placeholder: true,
    i18n: {
      hi: {
        title: 'पकाना',
        body: 'आँच मिट्टी को हमेशा के लिए बदल देती है। बर्तन खुले में लकड़ी, पुआल या उपलों के साथ जमाकर पकाए जा सकते हैं, या ऐसे भट्ठे में जो गर्मी को थामे रखे। आग में खुलकर बहती हवा लोहे से भरपूर मिट्टी को लाल कर देती है; हवा से वंचित आग, या अंत में दिया गया धुआँ, उसे धूसर या काला कर देता है।',
        steps: ['जमाना', 'तपाना', 'थामना', 'ठंडा करना'],
      },
      bn: {
        title: 'পোড়ানো',
        body: 'আগুন মাটিকে চিরকালের মতো বদলে দেয়। পাত্র খোলা জায়গায় কাঠ, খড় বা ঘুঁটের সঙ্গে সাজিয়ে পোড়ানো যায়, কিংবা এমন ভাটিতে যা তাপ ধরে রাখে। আগুনের মধ্যে অবাধে বাতাস চললে লোহাসমৃদ্ধ মাটি লাল হয়; বাতাস না-পাওয়া আগুন, বা শেষে ধোঁয়া দিলে, তা ধূসর বা কালো হয়।',
        steps: ['সাজানো', 'তাপ', 'ধরে রাখা', 'ঠান্ডা'],
      },
    },
  },
  {
    id: 'process-finish',
    kicker: '5',
    title: 'Finishing',
    body: 'A surface can be coated with slip — fine clay in water — or polished with a smooth stone before firing to give a soft shine. After firing it may be painted, or rubbed with leaves or wax while still warm. Each tradition in this pavilion finishes its work in its own way.',
    steps: ['Slip', 'Burnish', 'Paint', 'Polish'],
    icon: 'process',
    placement: { surface: 'd-hallway-5', at: midAt('d-hallway-5'), centerHeight: 1.6 },
    ...PANEL,
    placeholder: true,
    i18n: {
      hi: {
        title: 'अंतिम रूप',
        body: 'सतह पर स्लिप — पानी में घुली महीन मिट्टी — चढ़ाई जा सकती है, या पकाने से पहले चिकने पत्थर से घिसकर हल्की चमक लाई जा सकती है। पकाने के बाद उसे रँगा जा सकता है, या गर्म रहते ही पत्तों या मोम से रगड़ा जा सकता है। इस मंडप की हर परंपरा अपने काम को अपने ढंग से अंतिम रूप देती है।',
        steps: ['स्लिप', 'घिसाई', 'रँगाई', 'चमक'],
      },
      bn: {
        title: 'শেষ কাজ',
        body: 'তলের ওপর স্লিপ — জলে গোলা মিহি মাটি — লাগানো যায়, বা পোড়ানোর আগে মসৃণ পাথরে ঘষে নরম আভা আনা যায়। পোড়ানোর পরে তা রং করা যায়, বা গরম থাকতেই পাতা বা মোম দিয়ে ঘষা যায়। এই প্যাভিলিয়নের প্রতিটি ধারা নিজের মতো করে কাজ শেষ করে।',
        steps: ['স্লিপ', 'ঘষা', 'রং', 'পালিশ'],
      },
    },
  },

  // ── F: the inner main wall's statement, facing the oculus court ───────────────────
  {
    id: 'statement',
    kicker: 'F',
    title: 'Earth, water, hand and fire',
    body: 'Every piece in this pavilion began as earth. Water makes it soft enough to shape, hands give it form, and fire makes the form last. Round this court are three traditions from three parts of India, each working the same material in its own way.',
    steps: ['Earth', 'Water', 'Hand', 'Fire'],
    icon: 'process',
    placement: { surface: 'f-inner-main', at: midAt('f-inner-main'), centerHeight: 1.75 },
    width: 1.5,
    height: 2.0,
    placeholder: true,
    i18n: {
      hi: {
        title: 'मिट्टी, पानी, हाथ और आग',
        body: 'इस मंडप की हर कृति की शुरुआत मिट्टी से हुई। पानी उसे गढ़ने लायक नरम बनाता है, हाथ उसे रूप देते हैं, और आग उस रूप को टिकाऊ बनाती है। इस प्रांगण के चारों ओर भारत के तीन हिस्सों की तीन परंपराएँ हैं — हर एक इसी सामग्री के साथ अपने ढंग से काम करती है।',
        steps: ['मिट्टी', 'पानी', 'हाथ', 'आग'],
      },
      bn: {
        title: 'মাটি, জল, হাত আর আগুন',
        body: 'এই প্যাভিলিয়নের প্রতিটি কাজের শুরু মাটি থেকে। জল তাকে গড়ার মতো নরম করে, হাত তাকে রূপ দেয়, আর আগুন সেই রূপকে টেকসই করে। এই চত্বর ঘিরে আছে ভারতের তিন প্রান্তের তিনটি ধারা — প্রত্যেকে একই উপাদান নিয়ে নিজের মতো করে কাজ করে।',
        steps: ['মাটি', 'জল', 'হাত', 'আগুন'],
      },
    },
  },
]

/** Wall text on the description wall H ('h-description') — the first focal plane of the exhibition. */
export const EXHIBITION_TITLE: { kicker: string; title: string; subtitle: string; intro: string; i18n?: ContentI18n<'kicker' | 'title' | 'subtitle' | 'intro'> } = {
  kicker: 'A Virtual Pavilion',
  title: 'Clay Traditions',
  subtitle: 'Earth, water, hand and fire',
  intro:
    'Three ways of working clay, from West Bengal, Rajasthan and Manipur, in a round pavilion lit from the sky. Pass the inner wall to the right to begin with the terracotta of Bankura, continue to the votive plaques of Molela and the black pottery of Longpi, and return by the hallway.',
  i18n: {
    hi: {
      kicker: 'एक आभासी मंडप',
      title: 'मिट्टी की परंपराएँ',
      subtitle: 'मिट्टी, पानी, हाथ और आग',
      intro:
        'पश्चिम बंगाल, राजस्थान और मणिपुर से मिट्टी के साथ काम करने के तीन तरीके, आकाश से रोशन एक गोल मंडप में। भीतरी दीवार के दाईं ओर से आगे बढ़कर बाँकुड़ा के टेराकोटा से शुरुआत करें, फिर मोलेला की मन्नत पट्टिकाओं और लोंगपी के काले मृद्भांडों तक जाएँ, और गलियारे से लौटें।',
    },
    bn: {
      kicker: 'একটি ভার্চুয়াল প্যাভিলিয়ন',
      title: 'মাটির ধারা',
      subtitle: 'মাটি, জল, হাত আর আগুন',
      intro:
        'পশ্চিমবঙ্গ, রাজস্থান আর মণিপুর থেকে মাটি নিয়ে কাজের তিনটি ধারা, আকাশের আলোয় আলোকিত এক গোল প্যাভিলিয়নে। ভেতরের দেয়ালের ডান দিক দিয়ে এগিয়ে বাঁকুড়ার টেরাকোটা দিয়ে শুরু করুন, তারপর মোলেলার মানতের ফলক আর লংপির কালো মৃৎপাত্র দেখে করিডর দিয়ে ফিরে আসুন।',
    },
  },
}

/**
 * Welcome text. The pavilion has no reception desk, so nothing in the scene shows it; the
 * text-only guide opens with it.
 */
export const RECEPTION_WELCOME: { title: string; body: string; i18n?: ContentI18n<'title' | 'body'> } = {
  title: 'Welcome',
  body: 'The pavilion is a single round, double-height room. From the entrance hall, the description wall introduces the exhibition; the galleries of the three traditions follow the drum wall round an open court under the oculus, and a curved hallway leads back to the entrance.',
  i18n: {
    hi: {
      title: 'स्वागत',
      body: 'यह मंडप एक ही गोल, दोहरी ऊँचाई वाला कक्ष है। प्रवेश कक्ष से आगे विवरण-दीवार प्रदर्शनी का परिचय देती है; तीनों परंपराओं की गैलरियाँ गोल दीवार के साथ-साथ, ओकुलस (छत के गोल झरोखे) के नीचे के खुले प्रांगण को घेरे हुए हैं, और एक घुमावदार गलियारा वापस प्रवेश तक ले जाता है।',
    },
    bn: {
      title: 'স্বাগতম',
      body: 'প্যাভিলিয়নটি একটিই গোল, দ্বিগুণ উচ্চতার কক্ষ। প্রবেশকক্ষ পেরিয়ে বিবরণ-দেয়াল প্রদর্শনীর পরিচয় দেয়; তিনটি ধারার গ্যালারি গোল দেয়াল ধরে অকুলাসের (ছাদের গোল ফোকর) নিচের খোলা চত্বর ঘিরে আছে, আর একটি বাঁকা করিডর আবার প্রবেশপথে ফিরিয়ে আনে।',
    },
  },
}
