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
  `;
  document.body.appendChild(div);

  chrome.runtime.onMessage.addListener(request => {
    if (request.method === 'close-me') {
      const iframe = document.querySelector(`iframe[src="${request.src}"]`);
      if (iframe) {
        iframe.remove();
        if (div.children.length === 0) {
          div.style.display = 'none';
        }
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
  iframe.src = chrome.runtime.getURL('/data/ui/index.html?id=' + Math.random());
  div.style.display = 'flex';
  div.appendChild(iframe);
}
