/* globals Tesseract */
'use strict';

const isFirefox = /Firefox/.test(navigator.userAgent) || typeof InstallTrigger !== 'undefined';
const args = new URLSearchParams(location.search);
let worker;

chrome.storage.local.get({
  lang: 'eng'
}, prefs => {
  document.getElementById('language').value = prefs.lang;
  chrome.runtime.sendMessage({
    method: 'image'
  }, src => {
    const run = async () => {
      document.getElementById('recognize').value = 0;
      document.getElementById('lang').value = 0;
      document.getElementById('result').textContent = '';
      try {
        await worker.terminate();
      }
      catch (e) {}
      try {
        worker = Tesseract.createWorker({
          'workerBlobURL': isFirefox ? false : true,
          'workerPath': chrome.runtime.getURL('/libraries/tesseract/worker.min.js'),
          'corePath': chrome.runtime.getURL('/libraries/tesseract/tesseract-core.wasm.js'),
          logger(report) {
            if (report.status === 'recognizing text') {
              document.getElementById('recognize').value = report.progress;
            }
            else if (report.status === 'loaded language traineddata') {
              document.getElementById('lang').value = report.progress;
            }
          }
        });

        const lang = document.getElementById('language').value;
        await worker.load();
        await worker.loadLanguage(lang);
        await worker.initialize(lang);
        await worker.setParameters({
          tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
          tessedit_ocr_engine_mode: Tesseract.DEFAULT
        });
        const o = (await worker.recognize(src)).data;

        document.getElementById('recognize').value = 1;
        const parser = new DOMParser();
        const doc = parser.parseFromString(o.hocr, 'text/html');
        const result = document.getElementById('result');
        for (const child of [...doc.body.childNodes]) {
          result.appendChild(child);
        }
        result.value = o.text;

        if (o.text.trim() === '') {
          result.textContent = 'No text was detected';
        }
        else {
          document.getElementById('copy').disabled = false;
        }
        await worker.terminate();
      }
      catch (e) {
        console.log(e);
        document.getElementById('result').textContent = 'Error: ' + e.message;
      }
    };
    run();
    document.getElementById('language').onchange = e => {
      chrome.storage.local.set({
        lang: e.target.value
      });
      run();
    };
  });
});


document.getElementById('close').addEventListener('click', () => chrome.runtime.sendMessage({
  method: 'close-me',
  id: args.get('id')
}));

document.getElementById('copy').addEventListener('click', e => {
  const value = document.getElementById('result').value;

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
  chrome.runtime.sendMessage({
    method: 'resize',
    value: e.target.dataset.mode === 'expand' ? '70vh' : 'unset',
    id: args.get('id')
  });
});
