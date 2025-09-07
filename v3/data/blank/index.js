/* global guide, capture, monitor */

const args = new URLSearchParams(location.search);

document.title = args.get('title');
const f = document.querySelector('iframe');

chrome.runtime.sendMessage({
  method: 'get-image'
}).then(r => {
  document.querySelector('div').style['background-image'] = `url(${r})`;
});

chrome.runtime.onMessage.addListener((request, sender) => {
  if (sender.tab) {
    return;
  }

  if (request.method === 'proceed') {
    f.classList.remove('hidden');
    f.contentWindow.postMessage({
      method: 'proceed',
      href: request.href,
      request: request.request
    }, '*');
  }
  else if (request.method === 'resize') {
    f.style.height = request.height;
    f.classList.remove('hidden');
  }
  else if (request.method === 'remove-iframe') {
    f.style.height = '0';
    f.classList.add('hidden');
  }
  else if (request.method === 'capture') {
    guide.install();
    capture.install();
    monitor.install();
  }
});
