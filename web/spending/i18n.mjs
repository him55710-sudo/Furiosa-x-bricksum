import {messages} from './i18n-catalog.mjs';

export const languages = {en: 'English', ko: '한국어', 'zh-CN': '简体中文'};
const storageKey = 'accord-language';
const normalize = value => String(value).replace(/\s+/g, ' ').trim();
const escapeRE = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exact = new Map(messages.map(row => [normalize(row[0]), row]));
const templates = messages.filter(row => /\{\d+\}/.test(row[0])).map(row => ({
  row, regex: new RegExp('^' + normalize(row[0]).split(/(\{\d+\})/).map(part => /^\{\d+\}$/.test(part) ? '(.+?)' : escapeRE(part)).join('') + '$'),
  keys: [...row[0].matchAll(/\{(\d+)\}/g)].map(match => match[1])
}));
export function translate(value, language = 'en') {
  if (language === 'en' || !languages[language]) return String(value);
  const text = normalize(value), index = language === 'ko' ? 1 : 2;
  const row = exact.get(text);
  if (row) return row[index];
  for (const template of templates) {
    const match = template.regex.exec(text);
    if (match) {
      const args = Object.fromEntries(template.keys.map((key, i) => [key, match[i + 1]]));
      return template.row[index].replace(/\{(\d+)\}/g, (_, key) => args[key]);
    }
  }
  // Keep icons, monetary expressions, and navigation arrows outside translation keys.
  const decorated = text.match(/^([＋+◌⌘◇◈↗↙○←✓Ⅱ⤢↙▷◉●↶!\s]*)(.*?)([→↗↓\s]*)$/);
  if (decorated && decorated[2] && decorated[2] !== text) {
    const inner = translate(decorated[2], language);
    if (inner !== decorated[2]) return decorated[1] + inner + decorated[3];
  }
  if (text.includes(' · ')) return text.split(' · ').map(part => translate(part, language)).join(' · ');
  return String(value);
}

// Localize the presentation only. Never write translated text into application state,
// form values, model requests, signed terms, downloaded receipts, or source records.
export function installLanguageUI() {
  let language = 'en';
  try { const saved = localStorage.getItem(storageKey); if (languages[saved]) language = saved; } catch {}
  const originals = new WeakMap();
  const attributes = new WeakMap();
  const excluded = 'script,style,pre,code,textarea,input,option,[translate="no"],.hash,.original-content';
  const labels = {en:'Language', ko:'언어', 'zh-CN':'语言'};
  const description=document.querySelector('meta[name="description"]');
  const originalDescription=description?.content;
  const remember = (map, node, value) => {
    const prior = map.get(node);
    return prior && prior.output === value ? prior.original : value;
  };
  function apply() {
    observer.disconnect();
    try {
      document.documentElement.lang = language;
      document.title = translate('Accord Lock — The agreement decides what gets paid.', language);
      if(description)description.content=translate(originalDescription,language);
      const header = document.querySelector('.home-nav,.purchase-top,.topbar,.story-topbar') ?? document.querySelector('.boot');
      if (header && !header.querySelector('[data-language-picker]')) {
        const label = document.createElement('label');
        label.className = 'language-picker'; label.dataset.languagePicker = ''; label.setAttribute('translate','no');
        const icon = document.createElement('span'); icon.textContent = '◎'; icon.setAttribute('aria-hidden','true');
        const select = document.createElement('select'); select.dataset.language = '';
        for (const [code,name] of Object.entries(languages)) { const option = document.createElement('option'); option.value=code; option.textContent=name; select.append(option); }
        label.append(icon,select); header.append(label);
      }
      document.querySelectorAll('[data-language]').forEach(select => { select.value=language; select.setAttribute('aria-label',labels[language]); });
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node=walker.currentNode, parent=node.parentElement;
        if (!parent || parent.closest(excluded) || !normalize(node.nodeValue)) continue;
        const original=remember(originals,node,node.nodeValue), rendered=translate(original,language);
        const output=rendered===original?original:original.match(/^\s*/)[0]+rendered+original.match(/\s*$/)[0];
        originals.set(node,{original,output}); if(node.nodeValue!==output)node.nodeValue=output;
      }
      document.querySelectorAll('[placeholder],[aria-label],[title]').forEach(element => {
        if(element.closest('[translate="no"],.original-content'))return;
        const saved=attributes.get(element)??{};
        for(const name of ['placeholder','aria-label','title']) {
          if(!element.hasAttribute(name))continue;
          const value=element.getAttribute(name), prior=saved[name], original=prior?.output===value?prior.original:value;
          const output=translate(original,language);saved[name]={original,output};if(output!==value)element.setAttribute(name,output);
        }
        attributes.set(element,saved);
      });
      document.querySelectorAll('[data-original-label]').forEach(element=>{element.textContent=translate('Original message · preserved as received',language);});
    } finally { observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title']}); }
  }
  const observer = new MutationObserver(apply);
  document.addEventListener('change',event=>{
    if(!event.target.matches('[data-language]')||!languages[event.target.value])return;
    language=event.target.value;try{localStorage.setItem(storageKey,language);}catch{}
    apply();
  });
  apply();
}
