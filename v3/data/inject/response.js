/* global service */
'use strict';

{
  const em = document.createElement('ocr-result');
  em.dataset.page = chrome.runtime.getManifest().homepage_url + '#faq8';
  em.controllers = new Set();
  document.body.append(em);
  try {
    em.scrollIntoViewIfNeeded();
  }
  catch (e) {}

  const command = em.command = (name, ...args) => em[name](...args);

  const ocr = (lang, src) => {
    // if accuracy changed, kill old engines
    if (em.controllers.accuracy) {
      if (em.controllers.accuracy !== em.dataset.accuracy) {
        for (const controller of em.controllers) {
          controller.abort();
        }
        em.controllers.clear();
        command('progress', 0);
        command('clear');
      }
    }
    em.controllers.accuracy = em.dataset.accuracy;

    const report = report => {
      command('message', report.status);

      if (report.status === 'recognizing text') {
        command('progress', report.progress);
      }
      else if (report.status.startsWith('Streaming')) {
        command('progress', report.progress);
      }
      else if (
        report.status.startsWith('Loading') ||
        report.status.startsWith('loading') ||
        report.status.startsWith('loaded')
      ) {
        command('progress', report.progress, 'lang');
      }
    };
    const controller = new AbortController();
    em.controllers.add(controller);
    em.addEventListener('closed', () => controller.abort());
    return self.execute({
      lang,
      src,
      accuracy: em.dataset.accuracy,
      signal: controller.signal
    }, report);
  };

  // chrome.i18n.detectLanguage reports BCP-47 tags ("ja", "pt", "zh-CN"...)
  // while Tesseract uses ISO 639-2 codes ("jpn", "por", "chi_sim"...);
  // prefix-matching the two only works by coincidence and misfires elsewhere
  // ("ja" would match "jav"/Javanese, "es" would match "est"/Estonian)
  const LANGS = {
    'af': 'afr', 'am': 'amh', 'ar': 'ara', 'as': 'asm', 'az': 'aze',
    'be': 'bel', 'bg': 'bul', 'bn': 'ben', 'bo': 'bod', 'bs': 'bos',
    'ca': 'cat', 'ceb': 'ceb', 'chr': 'chr', 'cs': 'ces', 'cy': 'cym',
    'da': 'dan', 'de': 'deu', 'dz': 'dzo', 'el': 'ell', 'en': 'eng',
    'eo': 'epo', 'es': 'spa', 'et': 'est', 'eu': 'eus', 'fa': 'fas',
    'fi': 'fin', 'fr': 'fra', 'ga': 'gle', 'gl': 'glg', 'gu': 'guj',
    'he': 'heb', 'hi': 'hin', 'hr': 'hrv', 'ht': 'hat', 'hu': 'hun',
    'id': 'ind', 'in': 'ind', 'is': 'isl', 'it': 'ita', 'iu': 'iku',
    'iw': 'heb', 'ja': 'jpn', 'jv': 'jav', 'ka': 'kat', 'kk': 'kaz',
    'km': 'khm', 'kn': 'kan', 'ko': 'kor', 'ku': 'kur', 'ky': 'kir',
    'la': 'lat', 'lo': 'lao', 'lt': 'lit', 'lv': 'lav', 'mk': 'mkd',
    'ml': 'mal', 'mr': 'mar', 'ms': 'msa', 'mt': 'mlt', 'my': 'mya',
    'ne': 'nep', 'nl': 'nld', 'nb': 'nor', 'nn': 'nor', 'no': 'nor',
    'or': 'ori', 'pa': 'pan', 'pl': 'pol', 'ps': 'pus', 'pt': 'por',
    'ro': 'ron', 'ru': 'rus', 'sa': 'san', 'si': 'sin', 'sk': 'slk',
    'sl': 'slv', 'sq': 'sqi', 'sr': 'srp', 'sv': 'swe', 'sw': 'swa',
    'syr': 'syr', 'ta': 'tam', 'te': 'tel', 'tg': 'tgk', 'th': 'tha',
    'ti': 'tir', 'tl': 'tgl', 'fil': 'tgl', 'tr': 'tur', 'ug': 'uig',
    'uk': 'ukr', 'ur': 'urd', 'uz': 'uzb', 'vi': 'vie', 'yi': 'yid'
  };
  // map a BCP-47 tag to a Tesseract language code; the Chinese region/
  // script subtag decides between chi_sim and chi_tra, and the Serbian
  // script subtag between srp (Cyrillic) and srp_latn
  const mapping = tag => {
    const [base, ...subtags] = tag.toLowerCase().split('-');
    if (base === 'zh') {
      return subtags.some(s => ['hant', 'tw', 'hk', 'mo'].includes(s)) ?
        'chi_tra' : 'chi_sim';
    }
    if (base === 'sr') {
      return subtags.includes('latn') ? 'srp_latn' : 'srp';
    }
    return LANGS[base];
  };

  // if there is oResult object, run in inverted colors
  const run = em.run = async (oResult, mode = 'normal') => {
    const lang = oResult?.lang || em.dataset.language || 'eng';

    let o;
    // true when this invocation only scheduled a retry; the queue release
    // is then handed over to the rerun
    let retry = false;

    try {
      // must live inside the try: a rejected crop (bad href) surfaces as an
      // error message instead of an eternal "Please wait..."
      const src = await self.crop(em.href, em.box, mode);

      command('progress', 0);
      command('clear');

      if (lang !== 'detect') {
        o = await ocr(lang, src);
      }
      else {
        await Promise.all([
          ocr('eng', src).then(o => {
            return new Promise(resolve => chrome.i18n.detectLanguage(o.text, r => {
              resolve({
                lang: 'eng',
                o,
                r
              });
            }));
          }),
          ocr('ara', src).then(o => {
            return new Promise(resolve => chrome.i18n.detectLanguage(o.text, r => {
              resolve({
                lang: 'ara',
                o,
                r
              });
            }));
          }),
          ocr('jpn', src).then(o => {
            return new Promise(resolve => chrome.i18n.detectLanguage(o.text, r => {
              resolve({
                lang: 'jpn',
                o,
                r
              });
            }));
          })
        ]).then(async a => {
          const r = a.sort((a, b) => {
            return b.o.confidence - a.o.confidence;
          })[0];
          if (r.r.languages.length) {
            // walk the detected candidates until one maps to an available
            // language; the matching seed's result is reused when possible
            const langs = em.dataset.languages.split(', ');
            const e = r.r.languages.map(c => mapping(c.language))
              .find(c => c && langs.includes(c));

            if (e) {
              if (a.some(o => o.lang === e)) {
                o = a.filter(o => o.lang === e).shift().o;
              }
              else {
                o = await ocr(e, src);
              }
              o.lang = e;
            }
            command('rename', `Auto Detect (${e || r.lang})`);
            command('message', `Detected language is "${e || r.lang}". Please wait...`);
          }
          o = o || r.o;
        });
      }
      command('progress', 1);

      // in case "confidence" is not acceptable, rerun with inverted colors
      if (o.confidence < 50 && !oResult) {
        command('message', `Low confidence (${o.confidence}%). Trying with inverted colors. Please wait...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        retry = true;
        run(o, 'invert');
      }
      else if (mode === 'invert' && o.confidence < 20 && oResult.confidence < 20) {
        command('message', `Low confidence (${o.confidence}%) again! Trying with inverted colors. Please wait...`);

        retry = true;
        run(o, 'gray');
      }
      else {
        if (oResult && oResult.confidence > o.confidence) {
          o = oResult;
        }

        if (o.text.trim() === '') {
          command('build', {
            hocr: '<span style="color: red">No text was detected! Edit the image and drop it here to retry!</span>'
          });
        }
        else {
          command('build', o);
          command('enable');
        }
      }
    }
    catch (e) {
      console.warn(e);
      command('message', e.message || e);
    }
    finally {
      // release the queue on terminal states only; a scheduled retry hands
      // the release to its own completion (the early "return"s used to
      // skip this and leak the busy flag)
      if (retry === false) {
        service.next();
      }
    }
  };

  // events
  em.addEventListener('open-link', e => chrome.runtime.sendMessage({
    method: 'open-link',
    href: e.detail
  }));
  em.addEventListener('fetch-resource', async e => {
    const {href, options} = e.detail;
    const t = (msg, timeout = 3000) => command('toast', 'post', {
      new: msg,
      old: 'Post Result'
    }, timeout);

    try {
      const r = await fetch(href, options);
      if (r.ok || r.status === 0) {
        t('Done');
      }
      else {
        throw Error('Error ' + r.status);
      }
    }
    catch (e) {
      console.warn(e);
      t(e.message);
    }
  });
  em.addEventListener('open-options', () => {
    if (chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
    else {
      chrome.runtime.sendMessage({
        method: 'open-options'
      });
    }
  });
  em.addEventListener('language-changed', () => run());
  em.addEventListener('accuracy-changed', () => {
    chrome.runtime.sendMessage({
      method: 'remove-indexeddb'
    }, run);
  });
  em.addEventListener('save-preference', e => {
    const prefs = e.detail;
    if ('auto-clipboard' in prefs && prefs['auto-clipboard']) {
      chrome.runtime.sendMessage({
        method: 'clipboard-permission'
      }, granted => {
        if (granted === undefined) {
          alert(`Please enable the "Input data to the clipboard" permission for this extension in the browser's extensions manager.`);
        }
      });
    }

    chrome.storage.local.set(prefs);
  });
  em.addEventListener('closed', e => {
    if (e.metaKey || e.ctrlKey) {
      chrome.runtime.sendMessage({
        method: 'remove-indexeddb'
      });
    }
  });

  // Drag and drop support
  em.addEventListener('dragover', e => {
    const types = [...e.dataTransfer.items].map(e => e.type);
    if (types.some(s => s.startsWith('image/'))) {
      e.preventDefault();
    }
  });
  em.addEventListener('drop', async e => {
    e.preventDefault();
    for (const entry of [...e.dataTransfer.files].filter(e => e.type && e.type.startsWith('image/'))) {
      await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => {
          service.add({
            method: 'add-job',
            href: reader.result,
            request: {
              left: 0,
              top: 0,
              width: 0,
              height: 0
            }
          });
          resolve();
        };
        reader.readAsDataURL(entry);
      });
    }
  });
}
