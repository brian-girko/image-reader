// eslint-disable-next-line no-unused-vars
const service = self.service = {
  busy: false,
  jobs: [],
  next() {
    service.busy = false;
    const job = service.jobs.shift();
    if (job) {
      service.run(job);
    }
  },
  add(job) {
    service.jobs.push(job);
    if (service.busy === false) {
      service.next();
    }
  },
  run(o) {
    const {href, report, request} = o;

    service.busy = true;
    chrome.storage.local.get({
      'post-method': 'POST',
      'post-href': '',
      'post-body': '',
      'lang': 'eng',
      'frequently-used': ['eng', 'fra', 'deu', 'rus', 'ara'],
      'accuracy': '4.0.0',
      'close-after': -1,
      'auto-clipboard': false,
      'magnify': false
    }, prefs => {
      const s = document.createElement('script');
      s.src = '/data/inject/response.js';
      // a failed injection must still release the queue, otherwise the busy
      // flag sticks and every queued job waits forever
      s.onerror = () => {
        console.warn('failed to load response.js');
        service.next();
      };
      s.onload = () => {
        const resize = () => {
          // let the browser resize the frame (Chrome 154+), the SW relay is the fallback
          if ('requestResize' in window) {
            window.requestResize();
          }
          else {
            chrome.runtime.sendMessage({
              method: 'resize',
              height: `min(100vh, ${document.body.scrollHeight}px)`
            });
          }
        };
        resize();

        try {
          const em = document.querySelector('ocr-result:last-of-type');
          em.command('configure', prefs);
          em.command('prepare');
          // report to top window
          if (report) {
            em.addEventListener('result', e => {
              parent.postMessage({
                cmd: 'result',
                value: e.detail
              });
            });
          }
          em.addEventListener('mode-changed', resize);
          em.addEventListener('closed', e => {
            // keep the frame alive while jobs are queued: the aborted run
            // settles right after this listener and starts the next job
            if ((document.querySelector('ocr-result') || service.jobs.length) && !e.shiftKey) {
              resize();
            }
            else {
              for (const or of document.querySelectorAll('ocr-result')) {
                or.remove();
              }
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
        }
        catch (e) {
          // a broken panel must not hold the queue hostage
          console.warn(e);
          service.next();
        }
      };
      document.body.append(s);
    });
  }
};

onmessage = e => {
  if (e.data && e.data.method === 'proceed') {
    // captures and blank-page relays funnel through here; queueing them
    // keeps one engine at a time, same as the drag-and-drop path
    service.add(e.data);
  }
};
