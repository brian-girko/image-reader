import {env, AutoProcessor, AutoModelForVision2Seq, TextStreamer, load_image} from './transformers.js';
import {doclingToHtml} from './parser.js';

env.useBrowserCache = false;
env.useFSCache = false;
env.useCustomCache = true;
env.telemetry = false;
env.backends.onnx.wasm = {
  wasmPaths: {
    'ort-wasm-simd-threaded.jsep.wasm': 'ort-wasm-simd-threaded.jsep.wasm',
    'ort-wasm-simd-threaded.jsep.js': 'ort-wasm-simd-threaded.jsep.js'
  }
};

const progresses = new Map();

env.customCache = {
  async match(request) {
    const cache = await caches.open('hf-model-cache');
    const key = typeof request === 'string' ? request : request.url;
    const fixedUrl = key.replace(/^\/models\/([^/]+\/[^/]+)\/(.*)$/, 'https://huggingface.co/$1/resolve/main/$2');

    const cached = await cache.match(fixedUrl);
    if (cached) {
      const response = cached.clone();

      self.postMessage({
        type: 'PROGRESS',
        progress: 1,
        status: 'Loading ' + fixedUrl
      });
      return response;
    }

    const response = await fetch(fixedUrl);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

    const contentLength = response.headers.get('Content-Length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    let loaded = 0;

    const reader = response.body.getReader();
    const chunks = [];

    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      progresses.set(fixedUrl, {loaded, total});

      let a = 0;
      let b = 0;
      for (const {loaded, total} of progresses.values()) {
        if (total) {
          a += loaded;
          b += total;
        }
      }
      self.postMessage({
        type: 'PROGRESS',
        progress: a / b,
        status: 'Loading ' + fixedUrl
      });
    }

    const blob = new Blob(chunks);
    const finalResponse = new Response(blob, {headers: response.headers});
    await cache.put(fixedUrl, finalResponse.clone());
    return finalResponse;
  },
  put() {}
};

let processor = null;
let model = null;

// Function to lazy-load model & processor
async function loadModel() {
  if (!processor) {
    processor = await AutoProcessor.from_pretrained('onnx-community/granite-docling-258M-ONNX');
  }
  if (!model) {
    model = await AutoModelForVision2Seq.from_pretrained('onnx-community/granite-docling-258M-ONNX', {
      dtype: {
        embed_tokens: 'fp16',
        vision_encoder: 'fp32',
        decoder_model_merged: 'fp32'
      },
      device: 'webgpu'
    });
  }
}
self.onmessage = async event => {
  const {type, src} = event.data;


  if (type === 'PROCESS_FILE') {
    try {
      // Load model lazily on first request
      await loadModel();

      self.postMessage({
        type: 'REPORT',
        status: 'Constructing Prompt...'
      });

      const image = await load_image(src);

      const messages = [{
        role: 'user',
        content: [{
          type: 'image'
        },
        {
          type: 'text',
          text: 'Convert this page to docling.'
        }]
      }];

      const text = processor.apply_chat_template(messages, {add_generation_prompt: true});
      const inputs = await processor(text, [image], {do_image_splitting: true});

      self.postMessage({
        type: 'REPORT',
        status: 'Processing...'
      });

      let content = '';
      let tokens = 0;
      await model.generate({
        ...inputs,
        max_new_tokens: 4096,
        streamer: new TextStreamer(processor.tokenizer, {
          skip_prompt: true,
          skip_special_tokens: false,
          callback_function(streamedText) {
            tokens += 1;
            self.postMessage({
              type: 'STREAM',
              chunk: streamedText,
              progress: Math.min(tokens / 4096, 1)
            });
            content += streamedText;
          }
        })
      });

      self.postMessage({
        type: 'DONE',
        text: content,
        html: doclingToHtml(content.replace(/<\|end_of_text\|>$/, ''))
      });
    }
    catch (err) {
      self.postMessage({type: 'ERROR', error: err.message});
    }
  }
};
