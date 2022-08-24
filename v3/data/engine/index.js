/* global Tesseract */

const args = new URLSearchParams(location.search);
const id = args.get('id');

window.addEventListener('message', async e => {
  const worker = Tesseract.createWorker({
    'workerBlobURL': false,
    'workerPath': 'worker-overwrites.js',
    'corePath': 'tesseract/tesseract-core.wasm.js',
    logger(report) {
      parent.postMessage({
        command: 'report',
        id,
        report
      }, '*');
    }
  });

  try {
    const request = e.data;

    await worker.load();
    await worker.loadLanguage(request.lang);
    await worker.initialize(request.lang);

    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
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
      message: e.message
    }, '*');
  }

  worker.terminate();
});
