onmessage = e => {
  if (e.data && e.data.method === 'proceed') {
    const {href, request} = e.data;

    chrome.storage.local.get({
      'post-method': 'POST',
      'post-href': '',
      'post-body': '',
      'lang': 'eng',
      'frequently-used': ['eng', 'fra', 'deu', 'rus', 'ara'],
      'accuracy': '4.0.0'
    }, prefs => {
      const s = document.createElement('script');
      s.src = '/data/inject/response.js';
      s.onload = () => {
        const resize = () => chrome.runtime.sendMessage({
          method: 'resize',
          height: `min(100vh, ${document.body.scrollHeight }px)`
        });
        resize();

        const em = document.querySelector('ocr-result:last-of-type');
        em.command('configure', prefs);
        em.command('prepare');
        em.addEventListener('mode-changed', resize);
        em.addEventListener('closed', e => {
          if (document.querySelector('ocr-result') && !e.shiftKey) {
            resize();
          }
          else {
            chrome.runtime.sendMessage({
              method: 'remove-iframe'
            });
          }
        });

        const {devicePixelRatio, left, top, width, height} = request;

        em.href = href;
        em.box = {
          width: width * devicePixelRatio,
          height: height * devicePixelRatio,
          left: left * devicePixelRatio,
          top: top * devicePixelRatio
        };

        em.run();
      };
      document.body.append(s);
    });
  }
};
