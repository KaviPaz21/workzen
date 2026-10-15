const pyodideUrl = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js'
const runSeconds = 20

const figureHarness = `import sys, io, base64
figures = []
if 'matplotlib.pyplot' in sys.modules:
    import matplotlib.pyplot as plt
    for number in plt.get_fignums():
        buffer = io.BytesIO()
        plt.figure(number).savefig(buffer, format='png', bbox_inches='tight', dpi=110)
        figures.append(base64.b64encode(buffer.getvalue()).decode())
    plt.close('all')
figures`

const workerSource = `importScripts(${JSON.stringify(pyodideUrl)});
let ready = null;
const harness = ${JSON.stringify(figureHarness)};
onmessage = async (event) => {
  const id = event.data.id;
  const code = event.data.code;
  const post = (type, extra) => postMessage(Object.assign({ pythonRun: true, id: id, type: type }, extra || {}));
  try {
    if (!ready) {
      post('status', { text: 'Starting Python. The first run downloads about 10 MB.' });
      ready = loadPyodide().then((py) => {
        py.runPython("import os, warnings\\nos.environ['MPLBACKEND'] = 'AGG'\\nwarnings.filterwarnings('ignore', message='FigureCanvasAgg is non-interactive')");
        return py;
      });
    }
    const py = await ready;
    post('status', { text: 'Loading packages' });
    await py.loadPackagesFromImports(code);
    py.setStdout({ batched: (text) => post('stdout', { text: text }) });
    py.setStderr({ batched: (text) => post('stderr', { text: text }) });
    post('running');
    const globals = py.globals.get('dict')();
    let result;
    try {
      result = await py.runPythonAsync(code, { globals: globals });
    } finally {
      globals.destroy();
    }
    const figureProxy = py.runPython(harness);
    const figures = figureProxy.toJs();
    figureProxy.destroy();
    let text = null;
    if (result !== undefined && result !== null) {
      text = String(result);
      if (typeof result.destroy === 'function') result.destroy();
    }
    post('done', { result: text, figures: figures });
  } catch (error) {
    post('error', { text: String((error && error.message) || error) });
  }
};`

const frameDocument = `<!DOCTYPE html><html><body><script>
const source = ${JSON.stringify(workerSource)};
let worker = null;
function start() {
  worker = new Worker(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })));
  worker.onmessage = (event) => parent.postMessage(event.data, '*');
  worker.onerror = (event) => parent.postMessage({ pythonRun: true, id: currentId, type: 'error', text: event.message || 'The Python engine failed to start.' }, '*');
}
let currentId = 0;
window.addEventListener('message', (event) => {
  if (!event.data || !event.data.pythonRun) return;
  currentId = event.data.id;
  if (!worker) start();
  worker.postMessage({ id: event.data.id, code: event.data.code });
});
parent.postMessage({ pythonRun: true, id: 0, type: 'ready' }, '*');
</script></body></html>`

export interface PythonEvent {
  type: 'status' | 'stdout' | 'stderr' | 'running' | 'done' | 'error' | 'stopped'
  text?: string
  result?: string | null
  figures?: string[]
}

interface Frame {
  element: HTMLIFrameElement
  ready: Promise<void>
}

let frame: Frame | null = null
let nextRunId = 0
let handler: ((event: PythonEvent) => void) | null = null
let activeId = 0
let timer: number | null = null
let listening = false

function clearTimer() {
  if (timer !== null) {
    window.clearTimeout(timer)
    timer = null
  }
}

function destroyFrame() {
  frame?.element.remove()
  frame = null
}

function finish(event: PythonEvent) {
  clearTimer()
  const callback = handler
  handler = null
  callback?.(event)
}

function listen() {
  if (listening) return
  listening = true
  window.addEventListener('message', (event: MessageEvent) => {
    const data = event.data
    if (!frame || event.source !== frame.element.contentWindow || !data || data.pythonRun !== true) return
    if (data.type === 'ready' || data.id !== activeId || !handler) return
    if (data.type === 'running') {
      clearTimer()
      timer = window.setTimeout(() => {
        destroyFrame()
        finish({ type: 'error', text: `Stopped: the code ran for more than ${runSeconds} seconds.` })
      }, runSeconds * 1000)
    }
    if (data.type === 'done' || data.type === 'error') finish({ type: data.type, text: data.text, result: data.result, figures: data.figures })
    else handler({ type: data.type, text: data.text })
  })
}

function ensureFrame(): Frame {
  if (frame) return frame
  listen()
  const element = document.createElement('iframe')
  element.setAttribute('sandbox', 'allow-scripts')
  element.setAttribute('aria-hidden', 'true')
  element.tabIndex = -1
  element.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden'
  const ready = new Promise<void>((resolve) => {
    function onReady(event: MessageEvent) {
      if (event.source === element.contentWindow && event.data?.pythonRun === true && event.data.type === 'ready') {
        window.removeEventListener('message', onReady)
        resolve()
      }
    }
    window.addEventListener('message', onReady)
  })
  element.srcdoc = frameDocument
  document.body.append(element)
  frame = { element, ready }
  return frame
}

export function runPython(code: string, onEvent: (event: PythonEvent) => void) {
  if (handler) finish({ type: 'stopped' })
  const target = ensureFrame()
  const id = ++nextRunId
  activeId = id
  handler = onEvent
  void target.ready.then(() => {
    if (activeId === id && frame === target) target.element.contentWindow?.postMessage({ pythonRun: true, id, code }, '*')
  })
  return {
    stop() {
      if (activeId !== id || !handler) return
      destroyFrame()
      finish({ type: 'stopped' })
    },
  }
}
