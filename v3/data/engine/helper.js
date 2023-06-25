if (typeof self.execute === 'undefined') {
  const methods = {};

  const observe = e => {
    if (e.data) {
      const {command, id, report, result, message} = e.data;
      if (methods[id]) {
        if (command === 'report') {
          methods[id].report(report);
        }
        else if (command === 'result') {
          methods[id].resolve(result);
        }
        else if (command === 'error') {
          methods[id].reject(Error(message));
        }

        if (command === 'result' || command === 'error') {
          methods[id].frame.remove();
          delete methods[id];
        }
      }
    }
  };
  addEventListener('message', observe);

  self.execute = ({
    signal,
    lang,
    src,
    accuracy = '4.0.0'
  }, report) => new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    const id = 'worker-' + Math.random();
    methods[id] = {report, resolve, reject, frame};
    frame.src = chrome.runtime.getURL('/data/engine/index.html?id=' + id);
    frame.style.display = 'none';
    frame.onload = () => frame.contentWindow.postMessage({
      lang,
      src,
      accuracy
    }, '*');
    document.documentElement.append(frame);

    signal.addEventListener('abort', () => frame.remove());
  });
}

self.crop = (href, {width, height, left, top}, mode = 'normal') => new Promise(resolve => {
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
    if (mode === 'invert' || mode === 'gray') {
      ctx.globalCompositeOperation = mode === 'gray' ? 'saturation' : 'difference';
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    resolve(canvas.toDataURL());
  };
  img.src = href;
});
