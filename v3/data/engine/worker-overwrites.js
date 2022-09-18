/*
  1. Uses an alternative remote repository to download traineddata if fails
  2. Reports the progress
*/

self.fetch = new Proxy(self.fetch, {
  apply(target, self, args) {
    const [href, options] = args;

    const validate = r => {
      if (r.ok) {
        return r;
      }
      throw Error('Cannot download traineddata (' + r.status + ')');
    };

    if (href.includes('.traineddata.gz')) {
      return Reflect.apply(target, self, args).then(validate).catch(e => {
        console.warn('Cannot download the traineddata', href, e);
        const path = /[\d.]+\/.*$/.exec(href)[0];

        return Reflect.apply(target, self, [`https://github.com/naptha/tessdata/blob/gh-pages/${path}?raw=true`, options]).then(validate);
      }).then(r => {
        return Object.assign(r, {
          async arrayBuffer() {
            const reader = r.body.getReader();
            const chunks = [];
            let bytes = 0;

            const length = Number(r.headers.get('Content-Length'));

            // eslint-disable-next-line no-constant-condition
            while (true) {
              const {done, value} = await reader.read();
              if (done) {
                break;
              }

              bytes += value.byteLength;
              postMessage({
                status: 'progress',
                data: {
                  status: 'loading language traineddata',
                  progress: bytes / length
                }
              });

              chunks.push(value);
            }
            const ab = await new Blob(chunks).arrayBuffer();
            return ab;
          }
        });
      });
    }
    else {
      return Reflect.apply(target, self, args);
    }
  }
});

self.importScripts('tesseract/worker.min.js');
