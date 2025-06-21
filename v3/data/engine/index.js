/* global Tesseract */

const args = new URLSearchParams(location.search);
const id = args.get('id');

addEventListener('message', async e => {
  const request = e.data;

  try {
    const worker = await Tesseract.createWorker(request.lang, 1, { // 1: Tesseract LSTM, 0: Tesseract Legacy
      'workerBlobURL': false,
      'workerPath': 'worker-overwrites.js',
      // tesseract-core-simd.wasm.js has significantly faster recognition speeds (for Tesseract LSTM, the default model)
      // compared to the build without SIMD support
      'corePath': 'tesseract/tesseract-core-simd-lstm.wasm.js',
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
    });
    // https://github.com/tesseract-ocr/tesseract/blob/main/src/ccmain/tesseractclass.cpp
    const params = {};
    if (request.lang.endsWith('_vert')) {
      params['tessedit_pageseg_mode'] = Tesseract.PSM.SINGLE_BLOCK_VERT_TEXT;
    }
    if (['chi_sim', 'chi_tra', 'jpn', 'jpn_vert', 'tha'].includes(request.lang)) {
      params['preserve_interword_spaces'] = '1';
    }
    await worker.setParameters(params);

    const result = (await worker.recognize(request.src, {}, {
      hocr: true
    })).data;

    if (['chi_sim', 'chi_tra', 'jpn', 'jpn_vert', 'tha'].includes(request.lang)) {
      if (result.hocr) {
        result.hocr = result.hocr.replace(/>\s+</g, '><');
      }
    }

    parent.postMessage({
      command: 'result',
      id,
      result
    }, '*');
    worker.terminate();
  }
  catch (e) {
    console.warn(e);
    parent.postMessage({
      command: 'error',
      id,
      message: e?.message || e?.toString() || 'Unknown Error'
    }, '*');
  }
});
