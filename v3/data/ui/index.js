/* globals Tesseract */
'use strict';

const args = new URLSearchParams(location.search);

const post = (request, c) => {
  try {
    chrome.runtime.sendMessage(request, c);
  }
  catch (e) {
    console.warn(e);

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>
      <span style="color: red">Something went wrong. Please reload the extension...</span>
      <br>
      <br>
      ${e.message}
    </div>`, 'text/html');
    document.getElementById('result').textContent = '';
    document.getElementById('result').appendChild(doc.querySelector('div'));
  }
};

const ocr = async (lang, src) => {
  const worker = Tesseract.createWorker({
    'workerBlobURL': false,
    'workerPath': '/data/ui/worker-overwrites.js',
    'corePath': '/libraries/tesseract/tesseract-core.asm.js',
    logger(report) {
      document.getElementById('result').dataset.msg = report.status;

      if (report.status === 'recognizing text') {
        document.getElementById('recognize').value = report.progress;
      }
      else if (
        report.status === 'loading language traineddata' ||
        report.status === 'loaded language traineddata'
      ) {
        document.getElementById('lang').value = report.progress;
      }
    }
  });
  await worker.load();
  await worker.loadLanguage(lang);
  await worker.initialize(lang);

  await worker.setParameters({
    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
    tessedit_ocr_engine_mode: Tesseract.DEFAULT
  });
  const o = (await worker.recognize(src)).data;

  worker.terminate();

  return o;
};

chrome.storage.local.get({
  'lang': 'eng',
  'frequently-used': ['eng', 'fra', 'deu', 'rus', 'ara']
}, prefs => {
  // frequently used
  for (const lang of prefs['frequently-used']) {
    const e = document.querySelector(`option[value="${lang}"]`).cloneNode(true);
    document.getElementById('frequently-used').appendChild(e);
  }

  document.getElementById('language').value = prefs.lang;
  post({
    method: 'image'
  }, ({width, height, left, top, href}) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = width || img.width;
      canvas.height = height || img.height;
      if (width && height) {
        ctx.drawImage(img, left, top, width, height, 0, 0, width, height);
      }
      else {
        ctx.drawImage(img, 0, 0);
      }
      run();
    };
    img.src = href;


    const run = async () => {
      const src = canvas.toDataURL();

      document.getElementById('recognize').value = 0;
      document.getElementById('result').textContent = '';

      const result = document.getElementById('result');
      const lang = document.getElementById('language').value;

      let o;
      try {
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
              const ln = r.r.languages[0].language;
              const e = [...document.querySelectorAll('#language option')].filter(o => {
                return o.value !== 'detect' && o.value.startsWith(ln);
              }).shift();
              if (e) {
                document.querySelector('option[value=detect]').textContent = `Auto Detect (${ln})`;
                result.dataset.msg = `Detected language is "${ln}". Please wait...`;
                if (a.some(o => o.lang === e.value)) {
                  console.log('skipped!');
                  o = a.filter(o => o.lang === e.value).shift().o;
                }
                else {
                  o = await ocr(e.value, src);
                }
              }
            }
            o = o || r.o;
          });
        }
        document.getElementById('recognize').value = 1;
        const parser = new DOMParser();
        const doc = parser.parseFromString(o.hocr, 'text/html');

        for (const child of [...doc.body.childNodes]) {
          result.appendChild(child);
        }
        result.value = o.text;

        if (o.text.trim() === '') {
          result.textContent = 'No text was detected';
        }
        else {
          document.getElementById('copy').disabled = false;
          document.getElementById('post').disabled = false;
          result.setAttribute('contenteditable', true);
        }
      }
      catch (e) {
        console.warn(e);
        result.dataset.msg = e.message || e;
      }
    };

    document.getElementById('language').onchange = e => {
      chrome.storage.local.get({
        'frequently-used': ['eng', 'fra', 'deu', 'rus', 'ara']
      }, prefs => {
        prefs['frequently-used'].unshift(e.target.value);
        chrome.storage.local.set({
          'lang': e.target.value,
          'frequently-used': prefs['frequently-used'].filter((s, i, l) => s && l.indexOf(s) === i).slice(0, 10)
        });
      });

      run();
    };
  });
});

document.getElementById('close').addEventListener('click', () => post({
  method: 'close-me',
  id: args.get('id')
}));

document.getElementById('copy').addEventListener('click', e => {
  const value = document.getElementById('result').innerText;

  navigator.clipboard.writeText(value).catch(() => {
    const el = document.createElement('textarea');
    el.value = value;
    el.setAttribute('readonly', '');
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }).then(() => {
    e.target.value = 'Done';
    setTimeout(() => e.target.value = 'Copy Text', 1000);
  });
});

document.getElementById('expand').addEventListener('click', e => {
  e.target.dataset.mode = e.target.dataset.mode === 'expand' ? 'collapse' : 'expand';
  e.target.value = e.target.dataset.mode === 'expand' ? 'Collapse' : 'Expand';
  post({
    method: 'resize',
    value: e.target.dataset.mode === 'expand' ? '70vh' : 'unset',
    id: args.get('id')
  });
});


document.getElementById('post').addEventListener('click', e => {
  chrome.storage.local.get({
    'post-method': 'POST',
    'post-href': '',
    'post-body': ''
  }, prefs => {
    if (prefs['post-href'] === '' || e.shiftKey) {
      const m = prompt(`Where do you want the data to get posted:
Server Example:
${chrome.runtime.getManifest().homepage_url + '#faq8'}

Post Example:
POST|http://127.0.0.1:8080|&content;
POST|http://127.0.0.1:8080|{"body":"&content;"}

Put Example:
PUT|http://127.0.0.1:8080|&content;

Get Example:
GET|http://127.0.0.1:8080?data=&content;|

Open in Browser Tab Example:
OPEN|http://127.0.0.1:8080?data=&content;|`, [prefs['post-method'], prefs['post-href'], prefs['post-body']].join('|'));

      const [method, href, body] = m.split('|');

      Object.assign(prefs, {
        'post-method': (method || 'POST').toUpperCase(),
        'post-href': href || '',
        'post-body': body || ''
      });
      chrome.storage.local.set(prefs);
    }

    const value = document.getElementById('result').innerText.trim();
    const options = {
      method: prefs['post-method'],
      mode: 'no-cors'
    };
    if (prefs['post-body'] && prefs['post-method'] !== 'GET') {
      options.body = prefs['post-body']
        .replaceAll('&content;', value)
        .replaceAll('&href;', args.get('href'));
      // If this is a JSON, try builder
      if (prefs['post-body'].startsWith('{') && prefs['post-body'].endsWith('}')) {
        try {
          const o = JSON.parse(prefs['post-body']);
          for (const [key, holder] of Object.entries(o)) {
            if (typeof holder === 'string') {
              o[key] = holder
                .replaceAll('&content;', value)
                .replaceAll('&href;', args.get('href'));
            }
          }
          options.body = JSON.stringify(o);
        }
        catch (e) {
          console.warn('Cannot use the JSON Builder', e);
        }
      }
    }

    const t = msg => {
      clearTimeout(t.id);
      e.target.value = msg;
      t.id = setTimeout(() => e.target.value = 'Post Result', 3000);
    };

    if (prefs['post-href'] === '') {
      return t('Empty Server');
    }

    e.target.value = '...';
    const href = prefs['post-href']
      .replaceAll('&content;', encodeURIComponent(value))
      .replaceAll('&href;', encodeURIComponent(args.get('href')));

    if (options.method === 'OPEN') {
      chrome.tabs.create({
        url: href
      }, () => t('Done'));
    }
    else {
      fetch(href, options).then(r => {
        if (r.ok || r.status === 0) {
          t('Done');
        }
        else {
          throw Error('Error ' + r.status);
        }
      }).catch(error => {
        console.warn(error);
        t(error.message);
      });
    }
  });
});
