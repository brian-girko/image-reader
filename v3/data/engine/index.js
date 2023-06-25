/* global Tesseract */

const args = new URLSearchParams(location.search);
const id = args.get('id');

window.addEventListener('message', e => {
  const request = e.data;

  Tesseract.createWorker({
    'workerBlobURL': false,
    'workerPath': 'worker-overwrites.js',
    'corePath': 'tesseract/tesseract-core.wasm.js',
    'cacheMethod': 'none',
    'langPath': 'https://tessdata.projectnaptha.com/' + request.accuracy,
    logger(report) {
      parent.postMessage({
        command: 'report',
        id,
        report
      }, '*');
    },
    errorHandler(e) {
      console.warn(e);
      parent.postMessage({
        command: 'error',
        id,
        message: e.message || e.toString()
      }, '*');
    }
  }).then(async worker => {
    try {
      // await worker.load();
      await worker.loadLanguage(request.lang);
      await worker.initialize(request.lang);

      await worker.setParameters({
        tessedit_pageseg_mode: request.lang === 'jpn_vert' ? Tesseract.PSM.SINGLE_BLOCK_VERT_TEXT : Tesseract.PSM.SINGLE_BLOCK,
        tessedit_ocr_engine_mode: Tesseract.DEFAULT
      });

      const result = (await worker.recognize(request.src)).data;
      parent.postMessage({
        command: 'result',
        id,
        result
      }, '*');
    }
    catch (e) {
      console.warn(e);
      parent.postMessage({
        command: 'error',
        id,
        message: e.message || e.toString()
      }, '*');
    }

    worker.terminate();
  });
});
