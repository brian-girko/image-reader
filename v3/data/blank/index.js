/* global guide, capture, monitor */

const args = new URLSearchParams(location.search);
const f = document.querySelector('iframe');

document.title = args.get('title');

if (args.get('mode') === 'standalone') {
  if (args.has('message')) {
    document.getElementById('toast').textContent = args.get('message').trim();
  }
  else {
    document.getElementById('toast').textContent = `Double-click or drag and drop local images into this view to perform OCR`;
  }
  document.body.classList.add('standalone');

  self.standby = args.get('selector') !== 'true';
}
else {
  document.getElementById('toast').textContent = `This is a read-only copy of the viewport.
The original tab was internal, so the extension couldn't access it. Use this copy for OCR, then close it to return to the original tab.`
  self.standby = false;
}

const dpr = window.devicePixelRatio || 1;

// ask for image
chrome.runtime.sendMessage({
  method: 'get-image'
}).then(href => {
  if (href) {
    // since we cannot capture anymore we need to make sure image is the original size
    const div = document.querySelector('div');
    const img = new Image();
    img.onload = () => {
      img.width = img.naturalWidth / dpr;
      img.height = img.naturalHeight / dpr;
      div.appendChild(img);
    };
    img.src = href;

    // proceed the whole image
    if (args.get('proceed') === 'true') {
      f.onload = () => {
        f.classList.remove('hidden');
        f.contentWindow.postMessage({
          method: 'proceed',
          href,
          report: args.get('agent') === 'true',
          request: {
            method: 'proceed',
            left: 0,
            top: 0,
            width: 0,
            height: 0
          }
        }, '*');
      };
    }
  }
});

const handleImages = files => {
  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      console.info('Not an image', file);
      continue;
    }
    const reader = new FileReader();
    reader.onload = () => {
      f.classList.remove('hidden');
      f.contentWindow.postMessage({
        method: 'proceed',
        href: reader.result,
        report: args.get('agent') === 'true',
        request: {
          method: 'proceed',
          left: 0,
          top: 0,
          width: 0,
          height: 0
        }
      }, '*');
    };
    reader.readAsDataURL(file);
  }
};

document.addEventListener('dblclick', () => {
  const input = document.createElement('input');

  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.style.display = 'none';

  input.onchange = () => {
    const files = [...input.files];
    handleImages(files);

    input.remove();
  };

  document.body.appendChild(input);
  input.click();
});

document.addEventListener('dragover', e => {
  e.preventDefault();
});
document.addEventListener('drop', e => {
  e.preventDefault();

  const files = e.dataTransfer.files;
  handleImages(files);
});

chrome.runtime.onMessage.addListener((request, sender) => {
  if (sender.tab) {
    return;
  }

  if (request.method === 'proceed') {
    // in case window is moved to another window with a new dpr
    request.request.devicePixelRatio = dpr;
    f.classList.remove('hidden');
    f.contentWindow.postMessage({
      method: 'proceed',
      href: request.href,
      report: args.get('agent') === 'true',
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
