export interface PageBounds {
  start: string
  end: string
}

export interface PageContent extends PageBounds {
  text: string
}

const fallback: Record<number, PageContent> = {
  1: { start: 'الفاتحة ١', end: 'الفاتحة ٧', text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ الرَّحْمَٰنِ الرَّحِيمِ مَالِكِ يَوْمِ الدِّينِ إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ' },
  2: { start: 'البقرة ١', end: 'البقرة ٥', text: 'الم ذَٰلِكَ الْكِتَابُ لَا رَيْبَ فِيهِ هُدًى لِّلْمُتَّقِينَ الَّذِينَ يُؤْمِنُونَ بِالْغَيْبِ وَيُقِيمُونَ الصَّلَاةَ وَمِمَّا رَزَقْنَاهُمْ يُنفِقُونَ وَالَّذِينَ يُؤْمِنُونَ بِمَا أُنزِلَ إِلَيْكَ وَمَا أُنزِلَ مِن قَبْلِكَ وَبِالْآخِرَةِ هُمْ يُوقِنُونَ أُولَٰئِكَ عَلَىٰ هُدًى مِّن رَّبِّهِمْ وَأُولَٰئِكَ هُمُ الْمُفْلِحُونَ' },
  3: { start: 'البقرة ٦', end: 'البقرة ١٦', text: 'إِنَّ الَّذِينَ كَفَرُوا سَوَاءٌ عَلَيْهِمْ أَأَنذَرْتَهُمْ أَمْ لَمْ تُنذِرْهُمْ لَا يُؤْمِنُونَ' },
  4: { start: 'البقرة ١٧', end: 'البقرة ٢٤', text: 'مَثَلُهُمْ كَمَثَلِ الَّذِي اسْتَوْقَدَ نَارًا فَلَمَّا أَضَاءَتْ مَا حَوْلَهُ ذَهَبَ اللَّهُ بِنُورِهِمْ' },
  5: { start: 'البقرة ٢٥', end: 'البقرة ٢٩', text: 'وَبَشِّرِ الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ أَنَّ لَهُمْ جَنَّاتٍ تَجْرِي مِن تَحْتِهَا الْأَنْهَارُ' },
}

export async function getPageContent(page: number, language: 'ar' | 'en'): Promise<PageContent> {
  try {
    const response = await fetch(`https://api.quran.com/api/v4/verses/by_page/${page}?language=${language}&words=false&fields=text_uthmani,verse_key`)
    if (!response.ok) throw new Error('Unable to load page')
    const payload = await response.json() as { verses?: { verse_key: string, text_uthmani?: string }[] }
    const verses = payload.verses ?? []
    if (!verses.length) throw new Error('No verses')
    const [first, last] = [verses[0], verses[verses.length - 1]]
    return { start: first.verse_key, end: last.verse_key, text: verses.map(verse => verse.text_uthmani).filter(Boolean).join(' ') }
  } catch {
    return fallback[page] ?? (language === 'ar'
      ? { start: `بداية الصفحة ${page}`, end: `نهاية الصفحة ${page}`, text: 'تعذر تحميل نص الصفحة. اتصل بالإنترنت ثم حاول مرة أخرى.' }
      : { start: `Start of page ${page}`, end: `End of page ${page}`, text: 'Unable to load this page’s text. Connect to the internet and try again.' })
  }
}

export function concealArabicLetters(text: string): string {
  return text.replace(/[\u0621-\u064A]/g, 'ـ')
}
