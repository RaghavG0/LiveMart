// Internationalization utilities
import en from '../i18n/en.json';
import es from '../i18n/es.json';

type Translations = typeof en;
type Language = 'en' | 'es';

const translations: Record<Language, Translations> = {
  en,
  es
};

let currentLanguage: Language = 'en';

export function setLanguage(lang: Language) {
  currentLanguage = lang;
  if (typeof window !== 'undefined') {
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang;
  }
}

export function getCurrentLanguage(): Language {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('language') as Language;
    if (stored && translations[stored]) {
      return stored;
    }
    // Detect from browser
    const browserLang = navigator.language.split('-')[0] as Language;
    if (translations[browserLang]) {
      return browserLang;
    }
  }
  return currentLanguage;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const keys = key.split('.');
  let value: any = translations[currentLanguage];
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }
  }
  
  if (typeof value !== 'string') {
    console.warn(`Translation value is not a string: ${key}`);
    return key;
  }
  
  // Replace parameters
  if (params) {
    return value.replace(/\{(\w+)\}/g, (match, param) => {
      return params[param]?.toString() || match;
    });
  }
  
  return value;
}

// React hook
export function useTranslation() {
  const [language, setLang] = React.useState<Language>(getCurrentLanguage());
  
  React.useEffect(() => {
    setLanguage(language);
  }, [language]);
  
  return {
    t,
    language,
    setLanguage: setLang
  };
}

// Initialize on load
if (typeof window !== 'undefined') {
  currentLanguage = getCurrentLanguage();
}
