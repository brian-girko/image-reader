/* globals Tesseract */
'use strict';

const isFirefox = /Firefox/.test(navigator.userAgent) || typeof InstallTrigger !== 'undefined';
const args = new URLSearchParams(location.search);
let worker;

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

chrome.storage.local.get({
  lang: 'eng'
}, prefs => {
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
      run(canvas.toDataURL());
    };
    img.src = href;


    const run = async src => {
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
        console.warn(e);
        document.getElementById('result').textContent = 'Error: ' + e.message;
      }
    };

    document.getElementById('language').onchange = e => {
      chrome.storage.local.set({
        lang: e.target.value
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
  post({
    method: 'resize',
    value: e.target.dataset.mode === 'expand' ? '70vh' : 'unset',
    id: args.get('id')
  });
});
