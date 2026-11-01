/**
 * LIVING CLAY OF INDIA — the 21 traditions the grand pavilion stages (GRAND §4, CRAFTS.md).
 *
 * A, B and C are the drawing's three deep dives (Bankura, Molela, Longpi); the other eighteen
 * are a survey, gathered mostly in the Red Room's five regional bays. Every record is a
 * placeholder until the workshop confirms it: names, places and captions show only in curator
 * review (`?review`) or once `CRAFTS_CONFIRMED` is set (content/review.ts). Region bay headers
 * always show. Map pins are never drawn for these (CONTRACT §8: pins only for confirmed places).
 *
 * Captions are the researcher's, checked against the sources in CRAFTS.md: calm, concrete, no
 * origin legends, no GI years. Hindi and Bengali are working translations awaiting a native
 * speaker's review (CRAFTS §0).
 */
import type { ContentI18n } from '../i18n/core'

export type CraftRegion = 'north' | 'west' | 'east' | 'ne' | 'south'

export type CraftSlug =
  | 'bankura'
  | 'molela'
  | 'longpi'
  | 'khurja'
  | 'chinhat'
  | 'nizamabad'
  | 'gorakhpur'
  | 'kumartuli'
  | 'bishnupur'
  | 'asharikandi'
  | 'andro'
  | 'majuli'
  | 'khavda'
  | 'lippan'
  | 'pokaran'
  | 'blue-pottery'
  | 'manamadurai'
  | 'ayyanar'
  | 'villianur'
  | 'odisha'
  | 'studio'

export interface CraftRecord {
  id: `craft-${CraftSlug}`
  slug: CraftSlug
  kind: 'tradition'
  placeholder: true
  region: CraftRegion
  /** The drawing's deep-dive ring, for A/B/C. */
  ring?: 'a' | 'b' | 'c'
  state: string
  /** Placeholder pin (town or cluster level); never drawn until confirmed. */
  pin: { lat: number; lon: number; placeholder: true }
  gi: 'registered' | 'applied' | 'none' | 'unverified'
  name: string
  place: string
  caption: string
  i18n: ContentI18n<'name' | 'place' | 'caption'>
}

/** Region bay headers (always shown). */
export const REGIONS: Record<CraftRegion, { en: string; hi: string; bn: string }> = {
  north: { en: 'North', hi: 'उत्तर', bn: 'উত্তর' },
  west: { en: 'West', hi: 'पश्चिम', bn: 'পশ্চিম' },
  east: { en: 'East', hi: 'पूर्व', bn: 'পূর্ব' },
  ne: { en: 'North-East', hi: 'पूर्वोत्तर', bn: 'উত্তর-পূর্ব' },
  south: { en: 'South', hi: 'दक्षिण', bn: 'দক্ষিণ' },
}

type R = Omit<CraftRecord, 'id' | 'kind' | 'placeholder' | 'pin'> & { pin: [number, number] }
const rec = (r: R): CraftRecord => ({ ...r, id: `craft-${r.slug}`, kind: 'tradition', placeholder: true, pin: { lat: r.pin[0], lon: r.pin[1], placeholder: true } })

export const CRAFTS: readonly CraftRecord[] = [
  rec({
    slug: 'bankura',
    ring: 'a',
    region: 'east',
    state: 'West Bengal',
    pin: [22.97, 87.15],
    gi: 'registered',
    name: 'Bankura terracotta',
    place: 'Panchmura, Bankura, West Bengal',
    caption:
      'In Panchmura, potters throw the legs, neck and body of a horse as separate cylinders on the wheel, then join them while the clay is still leather-hard. The long neck and upright ears are a local signature. Families offer such horses at village shrines; the same form has become a familiar emblem of Indian craft.',
    i18n: {
      hi: {
        name: 'बांकुड़ा टेराकोटा',
        place: 'पाँचमुड़ा, बांकुड़ा, पश्चिम बंगाल',
        caption:
          'पाँचमुड़ा में कुम्हार घोड़े की टाँगें, गर्दन और धड़ चाक पर अलग-अलग बेलनों की तरह गढ़ते हैं, और मिट्टी के अधसूखे रहते ही उन्हें जोड़ देते हैं। लंबी गर्दन और खड़े कान यहाँ की पहचान हैं। परिवार ऐसे घोड़े गाँव के थानों पर चढ़ाते हैं; यही रूप आज भारतीय शिल्प का एक जाना-पहचाना प्रतीक भी है।',
      },
      bn: {
        name: 'বাঁকুড়ার টেরাকোটা',
        place: 'পাঁচমুড়া, বাঁকুড়া, পশ্চিমবঙ্গ',
        caption:
          'পাঁচমুড়ায় কুমোররা ঘোড়ার পা, গলা আর দেহ চাকে আলাদা আলাদা নল হিসেবে গড়েন, তারপর মাটি আধশুকনো থাকতেই সেগুলি জোড়েন। লম্বা গলা আর খাড়া কান এখানকার নিজস্ব চিহ্ন। পরিবারগুলি এমন ঘোড়া গ্রামের থানে মানত করে দেয়; একই রূপ আজ ভারতীয় কারুশিল্পের এক পরিচিত প্রতীকও।',
      },
    },
  }),
  rec({
    slug: 'molela',
    ring: 'b',
    region: 'west',
    state: 'Rajasthan',
    pin: [24.95, 73.83],
    gi: 'registered',
    name: 'Molela clay plaques',
    place: 'Molela, Rajsamand, Rajasthan',
    caption:
      'Molela potters model gods in relief on a flat slab of river clay, building limbs, horses and canopies by hand. The plaques are fired, then painted. Devotees from Rajasthan and neighbouring states buy them and install them in small village shrines, where a priest’s rite turns a fired panel into an object of worship.',
    i18n: {
      hi: {
        name: 'मोलेला की मृण्मूर्ति पट्टिकाएँ',
        place: 'मोलेला, राजसमंद, राजस्थान',
        caption:
          'मोलेला के कुम्हार नदी की मिट्टी की चपटी पटिया पर देवताओं को उभार में गढ़ते हैं — अंग, घोड़े और छत्र, सब हाथ से। पट्टिकाएँ पकाई जाती हैं, फिर रँगी जाती हैं। राजस्थान और पड़ोसी राज्यों के श्रद्धालु इन्हें ख़रीदकर गाँव के छोटे देवरों में स्थापित करते हैं, जहाँ पुजारी का अनुष्ठान पकी पट्टिका को पूजा की वस्तु बना देता है।',
      },
      bn: {
        name: 'মোলেলার মাটির ফলক',
        place: 'মোলেলা, রাজসমন্দ, রাজস্থান',
        caption:
          'মোলেলার কুমোররা নদীর মাটির চ্যাপ্টা পাটার ওপর দেবতাদের রিলিফে গড়েন — হাত-পা, ঘোড়া আর চাঁদোয়া, সবই হাতে। ফলকগুলি পোড়ানো হয়, তারপর রং করা হয়। রাজস্থান ও পাশের রাজ্যের ভক্তরা সেগুলি কিনে গ্রামের ছোট থানে বসান, যেখানে পুরোহিতের আচার পোড়া ফলককে পুজোর বস্তু করে তোলে।',
      },
    },
  }),
  rec({
    slug: 'longpi',
    ring: 'c',
    region: 'ne',
    state: 'Manipur',
    pin: [24.97, 94.25],
    gi: 'unverified',
    name: 'Longpi pottery',
    place: 'Longpi, Ukhrul, Manipur',
    caption:
      'Longpi pots are not thrown on a wheel. Tangkhul Naga makers grind a black serpentine rock, knead it with a local clay, and shape the paste by hand on a board. After firing in an open fire, each pot is rubbed with leaves while still hot, which seals the surface and gives the grey-black sheen.',
    i18n: {
      hi: {
        name: 'लोंगपी काली मृद्भांड',
        place: 'लोंगपी, उखरुल, मणिपुर',
        caption:
          'लोंगपी के बर्तन चाक पर नहीं बनते। तांगखुल नागा कारीगर एक काला सर्पेन्टाइन पत्थर पीसते हैं, उसे स्थानीय मिट्टी के साथ गूँधते हैं, और उस लेप को एक पटरे पर हाथ से आकार देते हैं। खुली आग में पकाने के बाद हर बर्तन को गरम रहते ही पत्तियों से रगड़ा जाता है, जिससे सतह बंद हो जाती है और उसमें धूसर-काली चमक आती है।',
      },
      bn: {
        name: 'লংপি কালো মৃৎপাত্র',
        place: 'লংপি, উখরুল, মণিপুর',
        caption:
          'লংপির পাত্র চাকে গড়া হয় না। তাংখুল নাগা কারিগররা একটি কালো সার্পেন্টাইন পাথর গুঁড়ো করেন, স্থানীয় মাটির সঙ্গে মেখে নেন, আর সেই মণ্ড একটি তক্তার ওপর হাতে আকার দেন। খোলা আগুনে পোড়ানোর পরে গরম থাকতেই প্রতিটি পাত্র পাতা দিয়ে ঘষা হয়, তাতে তল বন্ধ হয় আর ধূসর-কালো আভা আসে।',
      },
    },
  }),
  rec({
    slug: 'khurja',
    region: 'north',
    state: 'Uttar Pradesh',
    pin: [28.25, 77.85],
    gi: 'registered',
    name: 'Khurja pottery',
    place: 'Khurja, Bulandshahr, Uttar Pradesh',
    caption:
      'Khurja is a town of kilns. Its workshops make glazed pots, plates and planters in quantity, fired twice: once to harden the body and again to melt the glaze. The older Khurja style raised white flowers in slip on a coloured ground, so the pattern stands slightly off the surface.',
    i18n: {
      hi: {
        name: 'खुर्जा पॉटरी',
        place: 'खुर्जा, बुलंदशहर, उत्तर प्रदेश',
        caption:
          'खुर्जा भट्ठियों का शहर है। यहाँ की कार्यशालाएँ चमकीले शीशे वाले बर्तन, प्लेटें और गमले बड़ी संख्या में बनाती हैं, जिन्हें दो बार पकाया जाता है: एक बार देह को सख़्त करने के लिए, और फिर शीशे को पिघलाने के लिए। पुरानी खुर्जा शैली में रंगीन ज़मीन पर गाढ़ी मिट्टी से सफ़ेद फूल उभारे जाते थे, जिससे नक़्श सतह से हल्का ऊपर उठा रहता है।',
      },
      bn: {
        name: 'খুরজার মৃৎশিল্প',
        place: 'খুরজা, বুলন্দশহর, উত্তরপ্রদেশ',
        caption:
          'খুরজা ভাটির শহর। এখানকার কারখানায় চকচকে প্রলেপের পাত্র, থালা আর টব প্রচুর পরিমাণে তৈরি হয়, দু-বার পোড়ানো হয়: একবার দেহ শক্ত করতে, আরেকবার প্রলেপ গলাতে। পুরোনো খুরজা ধরনে রঙিন জমির ওপর ঘন মাটির গোলা দিয়ে সাদা ফুল তোলা হত, তাই নকশা তল থেকে সামান্য উঁচু হয়ে থাকে।',
      },
    },
  }),
  rec({
    slug: 'chinhat',
    region: 'north',
    state: 'Uttar Pradesh',
    pin: [26.88, 81.05],
    gi: 'none',
    name: 'Chinhat pottery',
    place: 'Chinhat, Lucknow, Uttar Pradesh',
    caption:
      'On the road out of Lucknow, the potters’ quarter at Chinhat makes glazed cups, plates and vases alongside plain terracotta. Painted blue-and-white and geometric patterns sit under a clear glaze, and a second firing gives a hard, glossy finish.',
    i18n: {
      hi: {
        name: 'चिनहट पॉटरी',
        place: 'चिनहट, लखनऊ, उत्तर प्रदेश',
        caption:
          'लखनऊ से बाहर जाती सड़क पर चिनहट का कुम्हार-मोहल्ला सादे टेराकोटा के साथ-साथ शीशे वाले प्याले, प्लेटें और फूलदान बनाता है। नीले-सफ़ेद और ज्यामितीय नक़्श एक पारदर्शी शीशे के नीचे रहते हैं, और दूसरी बार पकाने से सख़्त, चमकदार सतह मिलती है।',
      },
      bn: {
        name: 'চিনহাটের মৃৎশিল্প',
        place: 'চিনহাট, লখনউ, উত্তরপ্রদেশ',
        caption:
          'লখনউ থেকে বেরোনোর রাস্তায় চিনহাটের কুমোরপাড়া সাধারণ টেরাকোটার পাশাপাশি চকচকে প্রলেপের কাপ, থালা আর ফুলদানি তৈরি করে। নীল-সাদা আর জ্যামিতিক নকশা স্বচ্ছ প্রলেপের নিচে থাকে, আর দ্বিতীয়বার পোড়ানোয় তল শক্ত ও চকচকে হয়।',
      },
    },
  }),
  rec({
    slug: 'nizamabad',
    region: 'north',
    state: 'Uttar Pradesh',
    pin: [26.05, 83.0],
    gi: 'registered',
    name: 'Nizamabad black pottery',
    place: 'Nizamabad, Azamgarh, Uttar Pradesh',
    caption:
      'Nizamabad pots are thrown from a fine local clay, coated with a slip called kabiz and rubbed with mustard oil. The potter scratches flowers and lattices into the surface with a twig. Firing in a closed kiln packed with husk drives smoke into the clay and turns it black, and the cut lines are filled to shine silver.',
    i18n: {
      hi: {
        name: 'निज़ामाबाद की काली मिट्टी के बर्तन',
        place: 'निज़ामाबाद, आज़मगढ़, उत्तर प्रदेश',
        caption:
          'निज़ामाबाद के बर्तन स्थानीय महीन मिट्टी से चाक पर बनते हैं, उन पर काबिज़ नाम का घोल चढ़ाया जाता है और सरसों के तेल से रगड़ा जाता है। कुम्हार एक टहनी से सतह पर फूल और जालियाँ खुरचता है। भूसे से भरी बंद भट्ठी में पकाने से धुआँ मिट्टी में समा जाता है और उसे काला कर देता है, और खुरची रेखाएँ भरकर चाँदी-सी चमकाई जाती हैं।',
      },
      bn: {
        name: 'নিজামাবাদের কালো মৃৎপাত্র',
        place: 'নিজামাবাদ, আজমগড়, উত্তরপ্রদেশ',
        caption:
          'নিজামাবাদের পাত্র স্থানীয় মিহি মাটি থেকে চাকে গড়া হয়, তার ওপর কাবিজ নামের গোলা মাখানো হয় আর সরষের তেল দিয়ে ঘষা হয়। কুমোর একটি ডাল দিয়ে তলে ফুল আর জালি আঁচড়ান। তুষে ঠাসা বন্ধ ভাটিতে পোড়ানোয় ধোঁয়া মাটিতে ঢুকে তাকে কালো করে, আর আঁচড়ের রেখা ভরে রুপোলি চকচকে করা হয়।',
      },
    },
  }),
  rec({
    slug: 'gorakhpur',
    region: 'north',
    state: 'Uttar Pradesh',
    pin: [26.87, 83.28],
    gi: 'registered',
    name: 'Gorakhpur terracotta',
    place: 'Aurangabad, Gorakhpur, Uttar Pradesh',
    caption:
      'Potters in the villages around Bhathat build horses and elephants from wheel-thrown parts, then dress them in pressed and applied clay ornament like a festival costume. A local clay, dug in the hot months, fires to a bright, lasting red. Lamps, bells and hanging lights come from the same yards.',
    i18n: {
      hi: {
        name: 'गोरखपुर टेराकोटा',
        place: 'औरंगाबाद, गोरखपुर, उत्तर प्रदेश',
        caption:
          'भटहट के आसपास के गाँवों के कुम्हार चाक पर बने हिस्सों से घोड़े और हाथी बनाते हैं, फिर उन्हें दबाकर और चिपकाकर लगाए मिट्टी के गहनों से त्योहार की पोशाक की तरह सजाते हैं। गर्मियों में खोदी गई स्थानीय मिट्टी पकने पर चटक, टिकाऊ लाल रंग देती है। दीये, घंटियाँ और लटकने वाले दीपदान भी इन्हीं आँगनों से आते हैं।',
      },
      bn: {
        name: 'গোরখপুরের টেরাকোটা',
        place: 'আওরঙ্গাবাদ, গোরখপুর, উত্তরপ্রদেশ',
        caption:
          'ভটহটের আশপাশের গ্রামের কুমোররা চাকে গড়া অংশ দিয়ে ঘোড়া আর হাতি বানান, তারপর চেপে ও জুড়ে লাগানো মাটির গয়নায় উৎসবের পোশাকের মতো সাজান। গরমের মাসে খোঁড়া স্থানীয় মাটি পুড়ে উজ্জ্বল, টেকসই লাল হয়। প্রদীপ, ঘণ্টা আর ঝোলানো বাতিও একই উঠোন থেকে আসে।',
      },
    },
  }),
  rec({
    slug: 'kumartuli',
    region: 'east',
    state: 'West Bengal',
    pin: [22.6, 88.36],
    gi: 'none',
    name: 'Kumartuli clay images',
    place: 'Kumartuli, Kolkata, West Bengal',
    caption:
      'In the lanes of Kumartuli, images begin as bamboo frames bound with straw. Workers press on a coarse clay mixed with husk, then a fine river clay, and smooth the seams with wet cloth. The images are dried in the sun, not fired. After the festival most return to the river, and the clay comes back as silt.',
    i18n: {
      hi: {
        name: 'कुमारटुली की मिट्टी की प्रतिमाएँ',
        place: 'कुमारटुली, कोलकाता, पश्चिम बंगाल',
        caption:
          'कुमारटुली की गलियों में प्रतिमाएँ पुआल से बँधे बाँस के ढाँचों के रूप में शुरू होती हैं। कारीगर पहले भूसा मिली मोटी मिट्टी चढ़ाते हैं, फिर नदी की महीन मिट्टी, और जोड़ों को गीले कपड़े से चिकना करते हैं। प्रतिमाएँ धूप में सुखाई जाती हैं, पकाई नहीं जातीं। त्योहार के बाद अधिकतर नदी में लौट जाती हैं, और मिट्टी गाद बनकर फिर लौट आती है।',
      },
      bn: {
        name: 'কুমোরটুলির মাটির প্রতিমা',
        place: 'কুমোরটুলি, কলকাতা, পশ্চিমবঙ্গ',
        caption:
          'কুমোরটুলির গলিতে প্রতিমা শুরু হয় খড়ে বাঁধা বাঁশের কাঠামো হিসেবে। কারিগররা প্রথমে তুষ মেশানো মোটা মাটি চাপান, তারপর নদীর মিহি মাটি, আর ভেজা কাপড়ে জোড় মসৃণ করেন। প্রতিমা রোদে শুকোনো হয়, পোড়ানো হয় না। উৎসবের পরে বেশিরভাগই নদীতে ফিরে যায়, আর মাটি পলি হয়ে আবার ফিরে আসে।',
      },
    },
  }),
  rec({
    slug: 'bishnupur',
    region: 'east',
    state: 'West Bengal',
    pin: [23.07, 87.32],
    gi: 'none',
    name: 'Bishnupur temple terracotta',
    place: 'Bishnupur, Bankura, West Bengal',
    caption:
      'Not every clay object is a pot. In seventeenth-century Bishnupur, the Malla kings built temples of brick and covered them in fired clay panels. Scenes from the epics, Krishna’s life, processions and boats run in bands across the walls. The same clay country produces the Bankura horse today.',
    i18n: {
      hi: {
        name: 'बिष्णुपुर के टेराकोटा मंदिर',
        place: 'बिष्णुपुर, बांकुड़ा, पश्चिम बंगाल',
        caption:
          'मिट्टी की हर वस्तु बर्तन नहीं होती। सत्रहवीं सदी के बिष्णुपुर में मल्ल राजाओं ने ईंटों के मंदिर बनवाए और उन्हें पकी मिट्टी के फलकों से ढक दिया। महाकाव्यों के दृश्य, कृष्ण का जीवन, शोभायात्राएँ और नावें दीवारों पर पट्टियों में चलती हैं। यही मिट्टी का इलाक़ा आज बांकुड़ा का घोड़ा बनाता है।',
      },
      bn: {
        name: 'বিষ্ণুপুরের টেরাকোটা মন্দির',
        place: 'বিষ্ণুপুর, বাঁকুড়া, পশ্চিমবঙ্গ',
        caption:
          'মাটির সব জিনিসই পাত্র নয়। সপ্তদশ শতকের বিষ্ণুপুরে মল্ল রাজারা ইটের মন্দির গড়ে পোড়ামাটির ফলকে মুড়ে দিয়েছিলেন। মহাকাব্যের দৃশ্য, কৃষ্ণের জীবন, শোভাযাত্রা আর নৌকো দেয়াল জুড়ে সারি সারি চলে। একই মাটির দেশ আজ বাঁকুড়ার ঘোড়া গড়ে।',
      },
    },
  }),
  rec({
    slug: 'asharikandi',
    region: 'ne',
    state: 'Assam',
    pin: [26.08, 89.97],
    gi: 'registered',
    name: 'Asharikandi terracotta',
    place: 'Asharikandi, Dhubri, Assam',
    caption:
      'Asharikandi, in western Assam, works with hiramati, a fine clay from nearby riverbanks. Its best-known figure is the Hatima putul, a mother elephant carrying her young, modelled by hand. Potter families here have passed the work down for more than a century.',
    i18n: {
      hi: {
        name: 'आशारीकांदी टेराकोटा',
        place: 'आशारीकांदी, धुबरी, असम',
        caption:
          'पश्चिमी असम का आशारीकांदी पास के नदी-किनारों की महीन मिट्टी, हीरामाटी, से काम करता है। इसकी सबसे जानी-मानी आकृति हतिमा पुतुल है — अपने बच्चे को लिए हथिनी, हाथ से गढ़ी हुई। यहाँ के कुम्हार परिवार यह काम सौ से अधिक बरसों से पीढ़ी-दर-पीढ़ी करते आए हैं।',
      },
      bn: {
        name: 'আশারিকান্দির টেরাকোটা',
        place: 'আশারিকান্দি, ধুবড়ি, অসম',
        caption:
          'পশ্চিম অসমের আশারিকান্দি কাছের নদীর পাড়ের মিহি মাটি, হিরামাটি, দিয়ে কাজ করে। এর সবচেয়ে পরিচিত মূর্তি হাতিমা পুতুল — বাচ্চাকে নিয়ে মা-হাতি, হাতে গড়া। এখানকার কুমোর পরিবারগুলি এক শতাব্দীরও বেশি ধরে এই কাজ বংশপরম্পরায় করে আসছে।',
      },
    },
  }),
  rec({
    slug: 'andro',
    region: 'ne',
    state: 'Manipur',
    pin: [24.75, 94.05],
    gi: 'none',
    name: 'Andro pottery',
    place: 'Andro, Imphal East, Manipur',
    caption:
      'At Andro, near Imphal, pots are built from rings of clay laid one above another, then pressed and shaped with a wooden bat. There is no wheel. The work is done by married women, who learn it in their husband’s family. The finished pots are red, coated a dark maroon.',
    i18n: {
      hi: {
        name: 'आंद्रो की कुंडल मृद्भांड',
        place: 'आंद्रो, इंफाल पूर्व, मणिपुर',
        caption:
          'इंफाल के पास आंद्रो में बर्तन एक के ऊपर एक रखे मिट्टी के छल्लों से बनते हैं, फिर लकड़ी की थापी से दबाकर आकार दिए जाते हैं। चाक नहीं होता। यह काम विवाहित स्त्रियाँ करती हैं, जो इसे अपने पति के परिवार में सीखती हैं। तैयार बर्तन लाल होते हैं, उन पर गहरे कत्थई रंग की परत चढ़ी होती है।',
      },
      bn: {
        name: 'আন্দ্রোর কুণ্ডলী মৃৎপাত্র',
        place: 'আন্দ্রো, ইম্ফল পূর্ব, মণিপুর',
        caption:
          'ইম্ফলের কাছে আন্দ্রোয় পাত্র তৈরি হয় একটির ওপর আরেকটি রাখা মাটির বেড় দিয়ে, তারপর কাঠের পিটুনি দিয়ে চেপে আকার দেওয়া হয়। চাক নেই। কাজটি করেন বিবাহিত মেয়েরা, যাঁরা স্বামীর পরিবারে এটি শেখেন। তৈরি পাত্র লাল, ওপরে গাঢ় খয়েরি প্রলেপ।',
      },
    },
  }),
  rec({
    slug: 'majuli',
    region: 'ne',
    state: 'Assam',
    pin: [26.95, 94.17],
    gi: 'registered',
    name: 'Majuli masks',
    place: 'Samaguri Satra, Majuli, Assam',
    caption:
      'In Majuli’s monasteries, masks for sacred theatre start as a woven bamboo frame. Cloth soaked in potter’s clay is pressed over it, then smoothed with a mix of clay and cow dung and painted. Clay here is a skin, not a body: light enough for an actor to wear through a long night’s performance.',
    i18n: {
      hi: {
        name: 'माजुली मुखौटे',
        place: 'सामागुड़ी सत्र, माजुली, असम',
        caption:
          'माजुली के सत्रों में धार्मिक नाटक के मुखौटे बाँस के बुने ढाँचे से शुरू होते हैं। कुम्हार की मिट्टी में भिगोया कपड़ा उस पर दबाया जाता है, फिर मिट्टी और गोबर के मिश्रण से चिकना करके रँगा जाता है। यहाँ मिट्टी देह नहीं, त्वचा है: इतनी हल्की कि अभिनेता इसे रात भर के लंबे प्रदर्शन में पहन सके।',
      },
      bn: {
        name: 'মাজুলির মুখোশ',
        place: 'সামাগুড়ি সত্র, মাজুলি, অসম',
        caption:
          'মাজুলির সত্রে ধর্মীয় নাটকের মুখোশ শুরু হয় বাঁশের বোনা কাঠামো হিসেবে। কুমোরের মাটিতে ভেজানো কাপড় তার ওপর চাপানো হয়, তারপর মাটি আর গোবরের মিশ্রণে মসৃণ করে রং করা হয়। এখানে মাটি দেহ নয়, চামড়া: এত হালকা যে অভিনেতা সারা রাতের দীর্ঘ অভিনয়ে পরে থাকতে পারেন।',
      },
    },
  }),
  rec({
    slug: 'khavda',
    region: 'west',
    state: 'Gujarat',
    pin: [23.85, 69.72],
    gi: 'none',
    name: 'Khavda pottery',
    place: 'Khavda, Kutch, Gujarat',
    caption:
      'At Khavda, on the edge of the Rann of Kutch, men throw the pots and women paint them. Each piece is dipped in red ochre, then patterned with dots and lines of white, black and red clay paint applied with a bamboo twig, and fired with wood and dung.',
    i18n: {
      hi: {
        name: 'खावड़ा पॉटरी',
        place: 'खावड़ा, कच्छ, गुजरात',
        caption:
          'कच्छ के रण के किनारे खावड़ा में पुरुष चाक पर बर्तन बनाते हैं और स्त्रियाँ उन्हें रँगती हैं। हर बर्तन गेरू में डुबोया जाता है, फिर बाँस की तीली से सफ़ेद, काले और लाल मिट्टी के रंग से बिंदुओं और रेखाओं के नक़्श बनाए जाते हैं, और लकड़ी और गोबर की आग में पकाया जाता है।',
      },
      bn: {
        name: 'খাভড়ার মৃৎশিল্প',
        place: 'খাভড়া, কচ্ছ, গুজরাট',
        caption:
          'কচ্ছের রণের ধারে খাভড়ায় পুরুষরা চাকে পাত্র গড়েন আর মেয়েরা রং করেন। প্রতিটি পাত্র গেরিমাটিতে ডোবানো হয়, তারপর বাঁশের কাঠি দিয়ে সাদা, কালো আর লাল মাটির রঙে বিন্দু আর রেখার নকশা আঁকা হয়, আর কাঠ ও ঘুঁটের আগুনে পোড়ানো হয়।',
      },
    },
  }),
  rec({
    slug: 'lippan',
    region: 'west',
    state: 'Gujarat',
    pin: [23.5, 69.75],
    gi: 'unverified',
    name: 'Lippan (mud-mirror) work',
    place: 'Banni and Bhuj, Kutch, Gujarat',
    caption:
      'In Kutch, women press thin coils of clay and dung onto the walls of round houses, drawing lattices, peacocks and flowers in low relief. Small mirrors set into the pattern catch lamplight in dim rooms. The layer also protects the mud wall underneath, so decoration and repair are the same task.',
    i18n: {
      hi: {
        name: 'लिप्पन काम',
        place: 'बन्नी और भुज, कच्छ, गुजरात',
        caption:
          'कच्छ में स्त्रियाँ मिट्टी और गोबर की पतली डोरियाँ गोल घरों की दीवारों पर दबाकर जालियाँ, मोर और फूल हल्के उभार में बनाती हैं। नक़्श में जड़े छोटे शीशे धुँधले कमरों में दीये की रोशनी पकड़ते हैं। यह परत नीचे की कच्ची दीवार की रक्षा भी करती है, इसलिए सजावट और मरम्मत एक ही काम है।',
      },
      bn: {
        name: 'কচ্ছের লিপ্পন কাজ',
        place: 'বান্নি ও ভুজ, কচ্ছ, গুজরাট',
        caption:
          'কচ্ছে মেয়েরা মাটি আর গোবরের সরু দড়ি গোল বাড়ির দেয়ালে চেপে চেপে জালি, ময়ূর আর ফুল অল্প-উঁচু রিলিফে আঁকেন। নকশায় বসানো ছোট আয়না আবছা ঘরে প্রদীপের আলো ধরে। এই প্রলেপ নিচের মাটির দেয়ালকেও রক্ষা করে, তাই সাজানো আর মেরামত একই কাজ।',
      },
    },
  }),
  rec({
    slug: 'pokaran',
    region: 'west',
    state: 'Rajasthan',
    pin: [26.92, 71.92],
    gi: 'registered',
    name: 'Pokaran pottery',
    place: 'Pokaran, Jaisalmer, Rajasthan',
    caption:
      'In the desert town of Pokaran, the local clay fires to a pale pink, almost white, unlike the deep red of most Indian terracotta. Potters beat and sieve the hard clay before working it, and paint fine geometric patterns in red and white.',
    i18n: {
      hi: {
        name: 'पोकरण पॉटरी',
        place: 'पोकरण, जैसलमेर, राजस्थान',
        caption:
          'रेगिस्तानी कस्बे पोकरण की स्थानीय मिट्टी पककर हल्की गुलाबी, लगभग सफ़ेद हो जाती है — अधिकांश भारतीय टेराकोटा के गहरे लाल से अलग। कुम्हार इस सख़्त मिट्टी को काम से पहले कूटते और छानते हैं, और लाल और सफ़ेद में महीन ज्यामितीय नक़्श रँगते हैं।',
      },
      bn: {
        name: 'পোখরানের মৃৎশিল্প',
        place: 'পোখরান, জয়সলমের, রাজস্থান',
        caption:
          'মরুশহর পোখরানের স্থানীয় মাটি পুড়ে ফিকে গোলাপি, প্রায় সাদা হয় — বেশিরভাগ ভারতীয় টেরাকোটার গাঢ় লালের থেকে আলাদা। কুমোররা এই শক্ত মাটি কাজের আগে পিটিয়ে ছেঁকে নেন, আর লাল ও সাদায় সূক্ষ্ম জ্যামিতিক নকশা আঁকেন।',
      },
    },
  }),
  rec({
    slug: 'blue-pottery',
    region: 'west',
    state: 'Rajasthan',
    pin: [26.91, 75.79],
    gi: 'registered',
    name: 'Jaipur blue pottery',
    place: 'Jaipur, Rajasthan',
    caption:
      'Jaipur’s blue pottery is the exception on this shelf: it contains almost no clay. Makers press a dough of ground quartz, glass, fuller’s earth and gum into moulds, paint it in cobalt and turquoise, and glaze it. We include it to show where clay stops and a ceramic made from stone begins.',
    i18n: {
      hi: {
        name: 'जयपुर ब्लू पॉटरी',
        place: 'जयपुर, राजस्थान',
        caption:
          'जयपुर की ब्लू पॉटरी इस टाँड़ पर अपवाद है: इसमें मिट्टी लगभग नहीं होती। कारीगर पिसे क्वार्ट्ज़, काँच, मुल्तानी मिट्टी और गोंद का आटा साँचों में दबाते हैं, उसे कोबाल्ट और फ़िरोज़ी रंग में रँगते हैं, और शीशा चढ़ाते हैं। हमने इसे यह दिखाने के लिए रखा है कि मिट्टी कहाँ रुकती है और पत्थर से बना सिरेमिक कहाँ शुरू होता है।',
      },
      bn: {
        name: 'জয়পুরের নীল মৃৎশিল্প',
        place: 'জয়পুর, রাজস্থান',
        caption:
          'জয়পুরের নীল মৃৎশিল্প এই তাকে ব্যতিক্রম: এতে মাটি প্রায় নেই। কারিগররা গুঁড়ো কোয়ার্টজ, কাচ, মুলতানি মাটি আর আঠার মণ্ড ছাঁচে চাপেন, কোবাল্ট আর ফিরোজা রঙে আঁকেন, আর প্রলেপ দেন। মাটি কোথায় শেষ হয় আর পাথরের তৈরি সেরামিক কোথায় শুরু, তা দেখাতেই এটি রাখা।',
      },
    },
  }),
  rec({
    slug: 'manamadurai',
    region: 'south',
    state: 'Tamil Nadu',
    pin: [9.7, 78.45],
    gi: 'registered',
    name: 'Manamadurai pottery',
    place: 'Manamadurai, Sivaganga, Tamil Nadu',
    caption:
      'Manamadurai potters blend clays from the Vaigai river and nearby tanks into a dense body that fires hard. Water and cooking pots come from the same wheels as the ghatam, the clay pot played as a drum in Carnatic concerts. A good ghatam is judged by ear, tapped at every stage.',
    i18n: {
      hi: {
        name: 'मानामदुरै पॉटरी',
        place: 'मानामदुरै, शिवगंगा, तमिलनाडु',
        caption:
          'मानामदुरै के कुम्हार वैगई नदी और पास के तालाबों की मिट्टियाँ मिलाकर एक घनी देह बनाते हैं जो पककर सख़्त हो जाती है। पानी और खाना पकाने के बर्तन उन्हीं चाकों से निकलते हैं जिनसे घटम — कर्नाटक संगीत में ढोल की तरह बजाया जाने वाला मिट्टी का घड़ा। अच्छा घटम कान से परखा जाता है, हर चरण पर ठोककर।',
      },
      bn: {
        name: 'মানামাদুরাইয়ের মৃৎশিল্প',
        place: 'মানামাদুরাই, শিবগঙ্গা, তামিলনাড়ু',
        caption:
          'মানামাদুরাইয়ের কুমোররা ভাইগাই নদী আর কাছের পুকুরের মাটি মিশিয়ে একটি ঘন দেহ তৈরি করেন যা পুড়ে শক্ত হয়। জল আর রান্নার পাত্র সেই একই চাক থেকে আসে যেখানে গড়া হয় ঘটম — কর্ণাটকী সংগীতে ঢাকের মতো বাজানো মাটির কলসি। ভালো ঘটম কানে বিচার হয়, প্রতিটি ধাপে টোকা দিয়ে।',
      },
    },
  }),
  rec({
    slug: 'ayyanar',
    region: 'south',
    state: 'Tamil Nadu',
    pin: [10.38, 78.82],
    gi: 'none',
    name: 'Ayyanar horses',
    place: 'Pudukkottai region, Tamil Nadu',
    caption:
      'At the edges of many Tamil villages, huge clay horses stand before the shrine of Ayyanar, a guardian deity who rides out at night. Families vow a horse when a prayer is answered and commission the village potter, who builds it in sections and fires it. Old horses are left to weather where they stand.',
    i18n: {
      hi: {
        name: 'अय्यनार के घोड़े',
        place: 'पुदुक्कोट्टई क्षेत्र, तमिलनाडु',
        caption:
          'तमिलनाडु के कई गाँवों की सीमा पर अय्यनार के थान के आगे मिट्टी के विशाल घोड़े खड़े रहते हैं — अय्यनार एक रक्षक देवता हैं जो रात में सवारी पर निकलते हैं। मन्नत पूरी होने पर परिवार घोड़े का वचन देते हैं और गाँव के कुम्हार से बनवाते हैं, जो उसे हिस्सों में गढ़कर पकाता है। पुराने घोड़े जहाँ खड़े हैं, वहीं मौसम के साथ घिसने को छोड़ दिए जाते हैं।',
      },
      bn: {
        name: 'আইয়ানারের ঘোড়া',
        place: 'পুদুক্কোট্টাই অঞ্চল, তামিলনাড়ু',
        caption:
          'তামিলনাড়ুর বহু গ্রামের সীমানায় আইয়ানারের থানের সামনে মাটির বিশাল ঘোড়া দাঁড়িয়ে থাকে — আইয়ানার এক রক্ষাকর্তা দেবতা, যিনি রাতে ঘোড়ায় চড়ে বেরোন। মানত পূর্ণ হলে পরিবারগুলি ঘোড়ার প্রতিশ্রুতি দেয় আর গ্রামের কুমোরকে দিয়ে গড়ায়, যিনি সেটি খণ্ডে খণ্ডে গড়ে পোড়ান। পুরোনো ঘোড়া যেখানে দাঁড়িয়ে, সেখানেই রোদ-জলে ক্ষয়ে যেতে রাখা হয়।',
      },
    },
  }),
  rec({
    slug: 'villianur',
    region: 'south',
    state: 'Puducherry',
    pin: [11.92, 79.76],
    gi: 'registered',
    name: 'Villianur terracotta',
    place: 'Villianur, Puducherry',
    caption:
      'Potters of the Kulalar community in Villianur, near Puducherry, model figures from a green clay tempered with fine sand. They work at every scale, from small lamps to temple-sized horses and deities built in sections. Pieces are left plain or glazed.',
    i18n: {
      hi: {
        name: 'विल्लियनूर टेराकोटा',
        place: 'विल्लियनूर, पुदुच्चेरी',
        caption:
          'पुदुच्चेरी के पास विल्लियनूर में कुलालर समुदाय के कुम्हार महीन रेत मिली हरी मिट्टी से आकृतियाँ गढ़ते हैं। वे हर पैमाने पर काम करते हैं — छोटे दीयों से लेकर हिस्सों में बने, मंदिर जितने बड़े घोड़ों और देवताओं तक। कुछ टुकड़े सादे छोड़े जाते हैं, कुछ पर शीशा चढ़ता है।',
      },
      bn: {
        name: 'ভিল্লিয়ানুরের টেরাকোটা',
        place: 'ভিল্লিয়ানুর, পুদুচেরি',
        caption:
          'পুদুচেরির কাছে ভিল্লিয়ানুরে কুলালার সম্প্রদায়ের কুমোররা মিহি বালি মেশানো সবুজ মাটি দিয়ে মূর্তি গড়েন। তাঁরা সব মাপে কাজ করেন — ছোট প্রদীপ থেকে খণ্ডে খণ্ডে গড়া মন্দির-সমান ঘোড়া আর দেবতা পর্যন্ত। কিছু জিনিস সাদামাটা রাখা হয়, কিছুতে প্রলেপ পড়ে।',
      },
    },
  }),
  rec({
    slug: 'odisha',
    region: 'east',
    state: 'Odisha',
    pin: [20.83, 83.92],
    gi: 'none',
    name: 'Odisha terracotta',
    place: 'Sonepur and Barpali, western Odisha',
    caption:
      'In western Odisha, clay goes on the roof as well as on the shrine. Barpali potters make half-round roof tiles, some crowned with small animals and birds. Nearby in Sonepur, horses and elephants are fired in pits of smouldering chaff and come out red with dark smoke marks.',
    i18n: {
      hi: {
        name: 'ओडिशा टेराकोटा',
        place: 'सोनपुर और बरपाली, पश्चिमी ओडिशा',
        caption:
          'पश्चिमी ओडिशा में मिट्टी थान पर ही नहीं, छत पर भी जाती है। बरपाली के कुम्हार अर्धगोल खपरैल बनाते हैं, जिनमें से कुछ पर छोटे पशु और पक्षी बैठे होते हैं। पास ही सोनपुर में घोड़े और हाथी सुलगते भूसे के गड्ढों में पकाए जाते हैं और गहरे धुएँ के निशानों के साथ लाल निकलते हैं।',
      },
      bn: {
        name: 'ওড়িশার টেরাকোটা',
        place: 'সোনপুর ও বরপালি, পশ্চিম ওড়িশা',
        caption:
          'পশ্চিম ওড়িশায় মাটি থানে যেমন যায়, ছাদেও যায়। বরপালির কুমোররা আধখানা গোল খোলা টালি বানান, কিছুর মাথায় ছোট পশু-পাখি বসানো। কাছেই সোনপুরে ঘোড়া আর হাতি ধিকিধিকি তুষের গর্তে পোড়ানো হয়, বেরোয় লাল, গায়ে গাঢ় ধোঁয়ার দাগ।',
      },
    },
  }),
  rec({
    slug: 'studio',
    region: 'north',
    state: 'Himachal Pradesh and Puducherry',
    pin: [32.07, 76.58],
    gi: 'none',
    name: 'Studio pottery',
    place: 'Andretta, Kangra; Golden Bridge Pottery, Puducherry',
    caption:
      'Alongside hereditary potters, studio potters have shaped a modern Indian clay. In 1983 Mansimran and Mary Singh set up a pottery in the Kangra village of Andretta, making slipware. In Pondicherry, Golden Bridge Pottery, founded in 1971 by Deborah Smith and Ray Meeker, wood-fires stoneware. Both have taught generations of students.',
    i18n: {
      hi: {
        name: 'स्टूडियो पॉटरी',
        place: 'अंद्रेटा, कांगड़ा; गोल्डन ब्रिज पॉटरी, पुदुच्चेरी',
        caption:
          'पुश्तैनी कुम्हारों के साथ-साथ स्टूडियो कुम्हारों ने भी आधुनिक भारतीय मिट्टी-कला को आकार दिया है। 1983 में मनसिमरन और मैरी सिंह ने कांगड़ा के गाँव अंद्रेटा में स्लिपवेयर बनाने वाली एक पॉटरी शुरू की। पुदुच्चेरी में 1971 में डेबोरा स्मिथ और रे मीकर की स्थापित गोल्डन ब्रिज पॉटरी लकड़ी की आग में स्टोनवेयर पकाती है। दोनों ने विद्यार्थियों की कई पीढ़ियों को सिखाया है।',
      },
      bn: {
        name: 'স্টুডিও মৃৎশিল্প',
        place: 'আন্দ্রেত্তা, কাংড়া; গোল্ডেন ব্রিজ পটারি, পুদুচেরি',
        caption:
          'বংশানুক্রমিক কুমোরদের পাশাপাশি স্টুডিও কুমোররাও আধুনিক ভারতীয় মাটির কাজকে গড়েছেন। ১৯৮৩ সালে মনসিমরন ও মেরি সিং কাংড়ার গ্রাম আন্দ্রেত্তায় স্লিপওয়্যারের একটি কারখানা গড়েন। পুদুচেরিতে ১৯৭১ সালে ডেবোরা স্মিথ ও রে মীকরের প্রতিষ্ঠিত গোল্ডেন ব্রিজ পটারি কাঠের আগুনে স্টোনওয়্যার পোড়ায়। দুটিই বহু প্রজন্মের ছাত্রছাত্রীকে শিখিয়েছে।',
      },
    },
  }),
]

export const craft = (slug: CraftSlug): CraftRecord => CRAFTS.find((c) => c.slug === slug)!
