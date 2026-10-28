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
  en: { left: 'Turn left', right: 'Turn right', ahead: 'Straight ahead, keep going', reach: 'Within reach! Stretch your hand forward.', notFound: 'Not in view. Turn slowly.', tooDark: 'Too dark. Please turn on a light.', blurry: 'Blurry. Hold the phone steady.', total: 'Total', rupees: 'rupees', guideOn: 'Guide mode on. I will warn you about obstacles.', guideOff: 'Guide mode off.', looking: 'Looking for', stopped: 'Stopped.', ready: 'Drishti is ready. Press Space to look, A to ask a question, and R to repeat the last response.' },
  hi: { left: 'बाएँ मुड़ें', right: 'दाएँ मुड़ें', ahead: 'सीधे सामने, आगे बढ़ें', reach: 'हाथ की पहुँच में है! हाथ आगे बढ़ाएँ।', notFound: 'दिखाई नहीं दे रहा। धीरे-धीरे घूमें।', tooDark: 'बहुत अंधेरा है। कृपया लाइट जलाएँ।', blurry: 'तस्वीर धुंधली है। फ़ोन स्थिर रखें।', total: 'कुल', rupees: 'रुपये', guideOn: 'गाइड मोड चालू। मैं रुकावटों के बारे में बताऊँगा।', guideOff: 'गाइड मोड बंद।', looking: 'ढूँढ रहा हूँ', stopped: 'रोक दिया।', ready: 'दृष्टि तैयार है। स्पेस दबाएँ देखने के लिए, A दबाएँ सवाल पूछने के लिए, और R दबाएँ पिछला जवाब दोहराने के लिए।' },
  mr: { left: 'डावीकडे वळा', right: 'उजवीकडे वळा', ahead: 'सरळ समोर, पुढे चला', reach: 'हाताच्या अंतरावर आहे! हात पुढे करा.', notFound: 'दिसत नाही. हळूहळू फिरा.', tooDark: 'खूप अंधार आहे. कृपया दिवा लावा.', blurry: 'चित्र अस्पष्ट आहे. फोन स्थिर धरा.', total: 'एकूण', rupees: 'रुपये', ready: 'दृष्टी तयार आहे. Space दाबा बघण्यासाठी, A दाबा प्रश्न विचारण्यासाठी, आणि R दाबा शेवटचे उत्तर पुन्हा ऐकण्यासाठी.' },
  ta: { left: 'இடது பக்கம் திரும்புங்கள்', right: 'வலது பக்கம் திரும்புங்கள்', ahead: 'நேராக முன்னால் செல்லுங்கள்', reach: 'கை எட்டும் தூரத்தில்! கையை நீட்டுங்கள்.', notFound: 'தெரியவில்லை. மெதுவாக திரும்புங்கள்.', tooDark: 'மிகவும் இருட்டாக உள்ளது. விளக்கை போடுங்கள்.', blurry: 'மங்கலாக உள்ளது. போனை அசையாமல் பிடியுங்கள்.', total: 'மொத்தம்', rupees: 'ரூபாய்', ready: 'திருஷ்டி தயாராக உள்ளது. Space அழுத்தவும் பார்க்க, A அழுத்தவும் கேள்வி கேட்க, R அழுத்தவும் கடைசி பதிலை மீண்டும் கேட்க.' },
  te: { left: 'ఎడమ వైపు తిరగండి', right: 'కుడి వైపు తిరగండి', ahead: 'నేరుగా ముందుకు వెళ్ళండి', reach: 'చేతికి అందేంత దూరంలో ఉంది! చేయి ముందుకు చాపండి.', notFound: 'కనిపించడం లేదు. నెమ్మదిగా తిరగండి.', tooDark: 'చాలా చీకటిగా ఉంది. లైట్ వేయండి.', blurry: 'అస్పష్టంగా ఉంది. ఫోన్ కదలకుండా పట్టుకోండి.', total: 'మొత్తం', rupees: 'రూపాయలు', ready: 'దృష్టి సిద్ధంగా ఉంది. Space నొక్కండి చూడటానికి, A నొక్కండి ప్రశ్న అడగటానికి, R నొక్కండి చివరి సమాధానాన్ని మళ్ళీ వినడానికి.' },
  bn: { left: 'বাঁ দিকে ঘুরুন', right: 'ডান দিকে ঘুরুন', ahead: 'সোজা সামনে এগিয়ে যান', reach: 'হাতের নাগালে! হাত বাড়ান।', notFound: 'দেখা যাচ্ছে না। ধীরে ধীরে ঘুরুন।', tooDark: 'খুব অন্ধকার। আলো জ্বালান।', blurry: 'ঝাপসা। ফোন স্থির রাখুন।', total: 'মোট', rupees: 'টাকা', ready: 'দৃষ্টি প্রস্তুত। Space চাপুন দেখতে, A চাপুন প্রশ্ন করতে, এবং R চাপুন শেষ উত্তর আবার শুনতে।' },
  kn: { left: 'ಎಡಕ್ಕೆ ತಿರುಗಿ', right: 'ಬಲಕ್ಕೆ ತಿರುಗಿ', ahead: 'ನೇರವಾಗಿ ಮುಂದೆ ಹೋಗಿ', reach: 'ಕೈಗೆ ಸಿಗುವಷ್ಟು ಹತ್ತಿರ! ಕೈ ಚಾಚಿ.', notFound: 'ಕಾಣುತ್ತಿಲ್ಲ. ನಿಧಾನವಾಗಿ ತಿರುಗಿ.', tooDark: 'ತುಂಬಾ ಕತ್ತಲೆ. ದೀಪ ಹಾಕಿ.', blurry: 'ಮಸುಕಾಗಿದೆ. ಫೋನ್ ಅಲುಗಾಡದಂತೆ ಹಿಡಿಯಿರಿ.', total: 'ಒಟ್ಟು', rupees: 'ರೂಪಾಯಿ', ready: 'ದೃಷ್ಟಿ ಸಿದ್ಧವಾಗಿದೆ. Space ಒತ್ತಿ ನೋಡಲು, A ಒತ್ತಿ ಪ್ರಶ್ನೆ ಕೇಳಲು, ಮತ್ತು R ಒತ್ತಿ ಕೊನೆಯ ಉತ್ತರ ಮತ್ತೆ ಕೇಳಲು.' },
  gu: { left: 'ડાબી બાજુ વળો', right: 'જમણી બાજુ વળો', ahead: 'સીધા આગળ વધો', reach: 'હાથની પહોંચમાં! હાથ આગળ કરો.', notFound: 'દેખાતું નથી. ધીમે ધીમે ફરો.', tooDark: 'ખૂબ અંધારું છે. લાઇટ ચાલુ કરો.', blurry: 'ઝાંખું છે. ફોન સ્થિર રાખો.', total: 'કુલ', rupees: 'રૂપિયા', ready: 'દૃષ્ટિ તૈયાર છે. Space દબાવો જોવા માટે, A દબાવો પ્રશ્ન પૂછવા માટે, અને R દબાવો છેલ્લો જવાબ ફરીથી સાંભળવા માટે.' },
};

export function t(lang, key) {
  return PHRASES[lang]?.[key] ?? PHRASES.en[key] ?? key;
}

export const clockLabel = (n) => `${n} o'clock`;
export const PROXIMITY = { near: 'within reach', mid: 'a few steps', far: 'far' };
