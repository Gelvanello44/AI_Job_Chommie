import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpApi from 'i18next-http-backend';

// Import all language files
import en from './locales/en/translation.json';
import zu from './locales/zu/translation.json';
import xh from './locales/xh/translation.json';
import af from './locales/af/translation.json';
import st from './locales/st/translation.json';
import tn from './locales/tn/translation.json';
import ts from './locales/ts/translation.json';
import ss from './locales/ss/translation.json';
import ve from './locales/ve/translation.json';
import nr from './locales/nr/translation.json';
import nso from './locales/nso/translation.json';

const resources = {
  en: { translation: en },
  zu: { translation: zu },
  xh: { translation: xh },
  af: { translation: af },
  st: { translation: st },
  tn: { translation: tn },
  ts: { translation: ts },
  ss: { translation: ss },
  ve: { translation: ve },
  nr: { translation: nr },
  nso: { translation: nso },
};

i18n
  .use(HttpApi)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    
    supportedLngs: ['en', 'zu', 'xh', 'af', 'st', 'tn', 'ts', 'ss', 've', 'nr', 'nso'],
    
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    
    detection: {
      order: ['localStorage', 'cookie', 'htmlTag', 'path', 'subdomain'],
      caches: ['localStorage', 'cookie'],
    },
    
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    },
  });

export const languages = [
  { code: 'en', name: 'English', flag: '' },
  { code: 'zu', name: 'isiZulu', flag: '' },
  { code: 'xh', name: 'isiXhosa', flag: '' },
  { code: 'af', name: 'Afrikaans', flag: '' },
  { code: 'st', name: 'Sesotho', flag: '' },
  { code: 'tn', name: 'Setswana', flag: '' },
  { code: 'ts', name: 'Xitsonga', flag: '' },
  { code: 'ss', name: 'siSwati', flag: '' },
  { code: 've', name: 'Tshivenda', flag: '' },
  { code: 'nr', name: 'isiNdebele', flag: '' },
  { code: 'nso', name: 'Sepedi', flag: '' },
];

export default i18n;
