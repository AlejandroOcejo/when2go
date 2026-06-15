import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enCommon from './locales/en/common.json'
import esCommon from './locales/es/common.json'
import frCommon from './locales/fr/common.json'
import deCommon from './locales/de/common.json'

const SUPPORTED_LANGS = ['en', 'es', 'fr', 'de']

function detectLanguage() {
  const lang = (navigator.language || 'en').split('-')[0]
  return SUPPORTED_LANGS.includes(lang) ? lang : 'en'
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: enCommon },
      es: { common: esCommon },
      fr: { common: frCommon },
      de: { common: deCommon },
    },
    lng: detectLanguage(),
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common'],
    interpolation: {
      escapeValue: false,
    },
  })

document.documentElement.lang = i18n.language || 'en'
i18n.on('languageChanged', (lng) => { document.documentElement.lang = lng })

export default i18n
