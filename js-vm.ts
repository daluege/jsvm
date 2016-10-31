import Replacer from 'script-replace'

const Context = Symbol('context')
const Eval = Symbol('eval')
const BuiltIns = ['Array', 'ArrayBuffer', 'Atomics', 'Boolean', 'DataView', 'Date', 'Error', 'EvalError', 'Float32Array', 'Float64Array', 'Function', 'Generator', 'GeneratorFunction', 'Infinity', 'Int16Array', 'Int32Array', 'Int8Array', 'InternalError', 'Iterator', 'JSON', 'Map', 'Math', 'NaN', 'Number', 'Object', 'ParallelArray', 'Promise', 'Proxy', 'RangeError', 'ReferenceError', 'Reflect', 'RegExp', 'Set', 'SharedArrayBuffer', 'StopIteration', 'String', 'Symbol', 'SyntaxError', 'TypeError', 'URIError', 'Uint16Array', 'Uint32Array', 'Uint8Array', 'Uint8ClampedArray', 'WeakMap', 'WeakSet', 'clearImmediate', 'clearInterval', 'clearTimeout', 'decodeURI', 'decodeURIComponent', 'encodeURI', 'encodeURIComponent', 'escape', 'eval', 'isFinite', 'isNaN', 'parseFloat', 'parseInt', 'setImmediate', 'setInterval', 'setTimeout', 'undefined', 'unescape']
const GlobalSymbols = []

for (let name of BuiltIns) BuiltIns[name] = true

let scope = null

function createScope () {
  let scope

  if (typeof document !== 'undefined') {
    let iframe = document.createElement('iframe')
    if (!iframe.style) (iframe as any).style = {}
    iframe.style.display = 'none'

    document.documentElement.appendChild(iframe)

    scope = iframe.contentWindow
  }
  if (!scope) {
    scope = (new Function('return this'))() // Access the global object from strict mode
  }
  initScope(scope)

  return scope
}

function initScope (scope: any) {
  for (let object = scope; object; object = Object.getPrototypeOf(object)) {
    let propertyNames = Object.getOwnPropertyNames(object)

    for (let name of propertyNames) {
      if (BuiltIns.hasOwnProperty(name) || name === 'arguments') continue
      if (!/^[\w$]*$/.test(name)) throw new TypeError('Unexpected global variable ' + name)
      GlobalSymbols.push(name)
    }
  }

  scope.Object.seal(scope)

  for (let name of BuiltIns) {
    let object = scope[name]

    scope.Object.freeze(object)
    if (typeof object === 'function') Object.freeze(object.prototype)
  }
}

export interface Context { }

export function createContext(object: any = {}): Context {
  if (Context in object) return object.context
  if (scope == null) scope = createScope()

  let context = object[Context] = scope.Object.create(object)
  let symbols = Object.keys(object).concat(GlobalSymbols)
  let initializer = `var ${symbols.join(', ')};`
  let run = context[Eval] =
    (new scope.Function(initializer + ' return function () { return eval(arguments[0]) }'))().bind(context)

  function proxy () {
    Object.defineProperty(arguments[1], arguments[2], {
      get: function () { return eval(arguments[0]) }.bind(null, arguments[2]),
      set: function () { eval(arguments[0] + ' = ' + arguments[1]) }.bind(null, arguments[2]),
      enumerable: true,
    })
  }
  let definer = `(${proxy}).apply(this, arguments)`

  for (let name in object) {
    let value = object[name]
    run(definer, context, name)
    context[name] = value
  }

  return context
}

export function isContext(context: any): context is Context {
  return Context in context
}

export function runInContext(code: string, context: Context, options?: any): any {
  let script = new Script(code, options)
  return script.runInContext(context)
}

export function runInNewContext(code: string, context?: any, options?: any): any {
  return runInContext(code, createContext(context), options)
}

export function runInThisContext(code: string, options?: any): any {
  return (new Function('return eval(arguments[0])'))(code)
}

export class Script {
  constructor(private code: string, private options: any = {}) {
    const strict = (function () { return this }) === undefined

    if (!strict) {
      let script = new Replacer(code)

      script.replace(/[^\x20-\x7E]+/g, '')

      script.replace(/\bthis\b(?=\s*[^\s\w;,)\]])/g,
        () => '(function () { return this }() === this ? undefined : this)')

      code = script.toString()
    }
  }

  runInContext(context: Context, options?: any) {
    options = (options == null) ?
      this.options :
      Object.assign(Object.create(this.options), options)

    return context[Eval].call(context, this.code)
  }

  runInNewContext(context?: any, options?: any) {
    return this.runInContext(createContext(context), options)
  }

  runInThisContext(options?: any) {
    return runInThisContext(this.code, options)
  }
}
