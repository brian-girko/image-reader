/* global Tesseract */

const args = new URLSearchParams(location.search);
const id = args.get('id');

addEventListener('message', async e => {
  const request = e.data;

  if (request.accuracy.startsWith('onnx')) {
    const worker = new Worker('./transformers/worker.mjs', {
      type: 'module'
    });
    worker.onerror = e => parent.postMessage({
      command: 'error',
      id,
      message: e.message || e.error || 'Transformers Worker crashed'
    }, '*');
    worker.onmessage = event => {
      const {type} = event.data;

      if (type === 'STREAM') {
        parent.postMessage({
          command: 'report',
          id,
          report: {
            progress: event.data.progress,
            status: 'Streaming: ' + event.data.chunk
          }
        }, '*');
      }
      else if (type === 'REPORT') {
        parent.postMessage({
          command: 'report',
          id,
          report: event.data
        }, '*');
      }
      else if (type === 'PROGRESS') {
        parent.postMessage({
          command: 'report',
          id,
          report: event.data
        }, '*');
      }
      else if (type === 'DONE') {
        parent.postMessage({
          command: 'result',
          id,
          result: event.data,
          origin: 'onnx'
        }, '*');
        worker.terminate();
      }
      else if (type === 'ERROR') {
        parent.postMessage({
          command: 'error',
          id,
          message: event.data.error
        }, '*');
      }
    };
    // Send file to worker
    worker.postMessage({
      type: 'PROCESS_FILE',
      src: request.src
    });
  }
  else {
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
        result,
        origin: 'tesseract'
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
  }
});
