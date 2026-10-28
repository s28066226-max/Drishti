// UI phrases spoken by deterministic features (Find guidance, quality checks, totals).
// Everything else is spoken in the user's language by Gemini directly.

export const LANGS = {
  en: { name: 'English', speech: 'en-IN' },
  hi: { name: 'हिन्दी', speech: 'hi-IN' },
  mr: { name: 'मराठी', speech: 'mr-IN' },
  ta: { name: 'தமிழ்', speech: 'ta-IN' },
  te: { name: 'తెలుగు', speech: 'te-IN' },
  bn: { name: 'বাংলা', speech: 'bn-IN' },
  kn: { name: 'ಕನ್ನಡ', speech: 'kn-IN' },
  gu: { name: 'ગુજરાતી', speech: 'gu-IN' },
};

const PHRASES = {
  en: { left: 'Turn left', right: 'Turn right', ahead: 'Straight ahead, keep going', reach: 'Within reach! Stretch your hand forward.', notFound: 'Not in view. Turn slowly.', tooDark: 'Too dark. Please turn on a light.', blurry: 'Blurry. Hold the phone steady.', total: 'Total', rupees: 'rupees', guideOn: 'Guide mode on. I will warn you about obstacles.', guideOff: 'Guide mode off.', looking: 'Looking for', stopped: 'Stopped.', ready: 'Drishti is ready. Press Look or the space bar.' },
  hi: { left: 'बाएँ मुड़ें', right: 'दाएँ मुड़ें', ahead: 'सीधे सामने, आगे बढ़ें', reach: 'हाथ की पहुँच में है! हाथ आगे बढ़ाएँ।', notFound: 'दिखाई नहीं दे रहा। धीरे-धीरे घूमें।', tooDark: 'बहुत अंधेरा है। कृपया लाइट जलाएँ।', blurry: 'तस्वीर धुंधली है। फ़ोन स्थिर रखें।', total: 'कुल', rupees: 'रुपये', guideOn: 'गाइड मोड चालू। मैं रुकावटों के बारे में बताऊँगा।', guideOff: 'गाइड मोड बंद।', looking: 'ढूँढ रहा हूँ', stopped: 'रोक दिया।', ready: 'दृष्टि तैयार है। देखें बटन या स्पेस बार दबाएँ।' },
  mr: { left: 'डावीकडे वळा', right: 'उजवीकडे वळा', ahead: 'सरळ समोर, पुढे चला', reach: 'हाताच्या अंतरावर आहे! हात पुढे करा.', notFound: 'दिसत नाही. हळूहळू फिरा.', tooDark: 'खूप अंधार आहे. कृपया दिवा लावा.', blurry: 'चित्र अस्पष्ट आहे. फोन स्थिर धरा.', total: 'एकूण', rupees: 'रुपये' },
  ta: { left: 'இடது பக்கம் திரும்புங்கள்', right: 'வலது பக்கம் திரும்புங்கள்', ahead: 'நேராக முன்னால் செல்லுங்கள்', reach: 'கை எட்டும் தூரத்தில்! கையை நீட்டுங்கள்.', notFound: 'தெரியவில்லை. மெதுவாக திரும்புங்கள்.', tooDark: 'மிகவும் இருட்டாக உள்ளது. விளக்கை போடுங்கள்.', blurry: 'மங்கலாக உள்ளது. போனை அசையாமல் பிடியுங்கள்.', total: 'மொத்தம்', rupees: 'ரூபாய்' },
  te: { left: 'ఎడమ వైపు తిరగండి', right: 'కుడి వైపు తిరగండి', ahead: 'నేరుగా ముందుకు వెళ్ళండి', reach: 'చేతికి అందేంత దూరంలో ఉంది! చేయి ముందుకు చాపండి.', notFound: 'కనిపించడం లేదు. నెమ్మదిగా తిరగండి.', tooDark: 'చాలా చీకటిగా ఉంది. లైట్ వేయండి.', blurry: 'అస్పష్టంగా ఉంది. ఫోన్ కదలకుండా పట్టుకోండి.', total: 'మొత్తం', rupees: 'రూపాయలు' },
  bn: { left: 'বাঁ দিকে ঘুরুন', right: 'ডান দিকে ঘুরুন', ahead: 'সোজা সামনে এগিয়ে যান', reach: 'হাতের নাগালে! হাত বাড়ান।', notFound: 'দেখা যাচ্ছে না। ধীরে ধীরে ঘুরুন।', tooDark: 'খুব অন্ধকার। আলো জ্বালান।', blurry: 'ঝাপসা। ফোন স্থির রাখুন।', total: 'মোট', rupees: 'টাকা' },
  kn: { left: 'ಎಡಕ್ಕೆ ತಿರುಗಿ', right: 'ಬಲಕ್ಕೆ ತಿರುಗಿ', ahead: 'ನೇರವಾಗಿ ಮುಂದೆ ಹೋಗಿ', reach: 'ಕೈಗೆ ಸಿಗುವಷ್ಟು ಹತ್ತಿರ! ಕೈ ಚಾಚಿ.', notFound: 'ಕಾಣುತ್ತಿಲ್ಲ. ನಿಧಾನವಾಗಿ ತಿರುಗಿ.', tooDark: 'ತುಂಬಾ ಕತ್ತಲೆ. ದೀಪ ಹಾಕಿ.', blurry: 'ಮಸುಕಾಗಿದೆ. ಫೋನ್ ಅಲುಗಾಡದಂತೆ ಹಿಡಿಯಿರಿ.', total: 'ಒಟ್ಟು', rupees: 'ರೂಪಾಯಿ' },
  gu: { left: 'ડાબી બાજુ વળો', right: 'જમણી બાજુ વળો', ahead: 'સીધા આગળ વધો', reach: 'હાથની પહોંચમાં! હાથ આગળ કરો.', notFound: 'દેખાતું નથી. ધીમે ધીમે ફરો.', tooDark: 'ખૂબ અંધારું છે. લાઇટ ચાલુ કરો.', blurry: 'ઝાંખું છે. ફોન સ્થિર રાખો.', total: 'કુલ', rupees: 'રૂપિયા' },
};

export function t(lang, key) {
  return PHRASES[lang]?.[key] ?? PHRASES.en[key] ?? key;
}

export const clockLabel = (n) => `${n} o'clock`;
export const PROXIMITY = { near: 'within reach', mid: 'a few steps', far: 'far' };
