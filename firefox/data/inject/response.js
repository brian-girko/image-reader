'use strict';

var div = window.div;
if (!div) {
  div = document.createElement('div');
  div.style = `
    position: fixed;
    bottom: 10px;
    right: 30px;
    z-index: 10000000000;
    box-shadow: 0 0 2px #ccc;
    display: flex;
    flex-direction: column;
    background-color: #fff;
    max-height: calc(100vh - 20px);
  `;
  document.body.appendChild(div);

  chrome.runtime.onMessage.addListener(request => {
    if (request.method === 'close-me') {
      const f = document.getElementById(request.id);
      if (f) {
        f.remove();
        if (div.children.length === 0) {
          div.style.display = 'none';
        }
      }
    }
    else if (request.method === 'resize') {
      const f = document.getElementById(request.id);
      if (f) {
        f.style.height = request.value;
      }
    }
  });
}

{
  const iframe = document.createElement('iframe');
  iframe.style = `
    border: none;
    max-width: 80vw;
    width: 400px;
    background-color: #f1f1f1;
    margin: 5px;
  `;
  const id = 'ocr-' + Math.random();
  iframe.src = chrome.runtime.getURL('/data/ui/index.html?id=' + id);
  iframe.id = id;
  div.style.display = 'flex';
  div.appendChild(iframe);
}
