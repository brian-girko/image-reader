/* globals Tesseract */
'use strict';


const worker = new Tesseract.TesseractWorker({
  'workerPath': chrome.runtime.getURL('/libraries/tesseract/worker.min.js'),
  'corePath': chrome.runtime.getURL('/libraries/tesseract/tesseract-core.wasm.js')
});


chrome.runtime.sendMessage({
  method: 'image'
}, src => {
  const img = document.getElementById('img');
  console.log(src);
  img.onload = () => {
    worker.recognize(img).progress(report => {
      if (report.status === 'recognizing text') {
        document.getElementById('recognize').value = report.progress;
      }
      else if (report.status === 'loaded language traineddata') {
        document.getElementById('lang').value = report.progress;
      }
    }).then(data => {
      document.getElementById('recognize').value = 1;
      const parser = new DOMParser();
      const doc = parser.parseFromString(data.html, 'text/html');
      const result = document.getElementById('result');
      for (const child of [...doc.childNodes]) {
        result.appendChild(child);
      }
      result.value = data.text;

      if (data.text.trim() === '') {
        result.textContent = 'No text was detected';
      }
    }, e => {
      console.log(e);
      document.getElementById('result').textContent = 'Error: ' + e.message;
    });
  };
  img.src = src;
});

document.getElementById('close').addEventListener('click', () => chrome.runtime.sendMessage({
  method: 'close-me',
  src: location.href
}));

document.getElementById('copy').addEventListener('click', () => {
  const el = document.createElement('textarea');
  el.value = document.getElementById('result').value;
  el.setAttribute('readonly', '');
  el.style.position = 'absolute';
  el.style.left = '-9999px';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
});
