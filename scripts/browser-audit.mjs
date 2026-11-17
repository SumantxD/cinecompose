import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import fs from 'node:fs'

export async function connect(session, prefix = 'http://localhost:4173/', fresh = false) {
  const socket = new WebSocket(execFileSync('agent-browser', ['--session', session, 'get', 'cdp-url'], { encoding: 'utf8' }).trim())
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  let next = 0
  const pending = new Map(), downloads = new Map(), requests = new Map()
  const listeners = new Map()
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data)
    if (message.method === 'Browser.downloadWillBegin') downloads.set(message.params.guid, { ...message.params, state: 'started' })
    if (message.method === 'Browser.downloadProgress') downloads.set(message.params.guid, { ...downloads.get(message.params.guid), ...message.params })
    for (const callback of listeners.get(message.method) ?? []) callback(message.params, message.sessionId)
    if (!message.id) return
    const task = pending.get(message.id)
    if (!task) return
    pending.delete(message.id)
    message.error ? task.reject(new Error(`${task.method}: ${JSON.stringify(message.error)}`)) : task.resolve(message.result)
  }
  function send(method, params = {}, sessionId) {
    const id = ++next
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject, method })
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
    })
  }
  let target = fresh ? undefined : (await send('Target.getTargets')).targetInfos.find(t => t.type === 'page' && t.url.startsWith(prefix))
  const owned = !target
  let targetId = target?.targetId
  if (!target) {
    targetId = (await send('Target.createTarget', { url: prefix })).targetId
    target = (await send('Target.getTargets')).targetInfos.find(t => t.targetId === targetId)
  }
  assert(target, `Browser page: ${prefix}`)
  const { sessionId } = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true })
  const call = (method, params = {}) => send(method, params, sessionId)
  if (owned) {
    await call('Page.enable')
    await call('Page.navigate', { url: prefix })
  }
  async function evaluate(expression) {
    const response = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails))
    return response.result?.value
  }
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
  async function until(expression, label = expression, attempts = 140) {
    for (let i = 0; i < attempts; i++) {
      if (await evaluate(`Boolean(${expression})`)) return
      await wait(100)
    }
    throw new Error(`Wait failed: ${label}; ${await evaluate('document.querySelector(".char-status")?.textContent')}`)
  }
  async function click(selector) {
    const layout = await evaluate(`(()=>{
      const element=document.querySelector(${JSON.stringify(selector)});
      if(!element)throw new Error('Missing button: '+${JSON.stringify(selector)});
      element.scrollIntoView({block:'center',inline:'nearest'});
      const r=element.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
      const hit=document.elementFromPoint(x,y);
      if(hit!==element&&!element.contains(hit))throw new Error('Obscured button: '+${JSON.stringify(selector)}+' '+JSON.stringify({rect:r.toJSON(),hit:hit?.outerHTML?.slice(0,160)}));
      return {x,y,width:r.width,height:r.height,text:element.textContent};
    })()`)
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: layout.x, y: layout.y, button: 'left', clickCount: 1 })
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: layout.x, y: layout.y, button: 'left', clickCount: 1 })
    return layout
  }
  async function fill(selector, value) {
    await evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});if(!input)throw new Error('Missing input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(String(value))});input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));})()`)
  }
  const documentJSON = () => evaluate('localStorage.getItem("kr-character-lab-v1")')
  async function screenshot(file) {
    const shot = await call('Page.captureScreenshot', { format: 'png', fromSurface: true })
    fs.writeFileSync(file, Buffer.from(shot.data, 'base64'))
  }
  async function upload(selector, file) {
    const { root } = await call('DOM.getDocument', { depth: -1 })
    const { nodeId } = await call('DOM.querySelector', { nodeId: root.nodeId, selector })
    assert(nodeId, `File input: ${selector}`)
    await call('DOM.setFileInputFiles', { nodeId, files: [file] })
  }
  return {
    send, call, evaluate, wait, until, click, fill, documentJSON, downloads, requests, screenshot, upload,
    on(method, callback) { const list = listeners.get(method) ?? []; list.push(callback); listeners.set(method, list) },
    close() { owned ? send('Target.closeTarget', { targetId }).finally(() => socket.close()) : socket.close() },
  }
}
