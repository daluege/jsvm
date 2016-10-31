import Replacer from 'script-replace'

const Context = Symbol('context')
const Eval = Symbol('eval')
const BuiltIns = ['Array', 'ArrayBuffer', 'Atomics', 'Boolean', 'DataView', 'Date', 'Error', 'EvalError', 'Float32Array', 'Float64Array', 'Function', 'Generator', 'GeneratorFunction', 'Infinity', 'Int16Array', 'Int32Array', 'Int8Array', 'InternalError', 'Iterator', 'JSON', 'Map', 'Math', 'NaN', 'Number', 'Object', 'ParallelArray', 'Promise', 'Proxy', 'RangeError', 'ReferenceError', 'Reflect', 'RegExp', 'Set', 'SharedArrayBuffer', 'StopIteration', 'String', 'Symbol', 'SyntaxError', 'TypeError', 'URIError', 'Uint16Array', 'Uint32Array', 'Uint8Array', 'Uint8ClampedArray', 'WeakMap', 'WeakSet', 'clearImmediate', 'clearInterval', 'clearTimeout', 'decodeURI', 'decodeURIComponent', 'encodeURI', 'encodeURIComponent', 'escape', 'eval', 'isFinite', 'isNaN', 'parseFloat', 'parseInt', 'setImmediate', 'setInterval', 'setTimeout', 'undefined', 'unescape']
const GlobalSymbols = []

for (let name of BuiltIns) BuiltIns[name] = true

let scope = null

function createScope () {
  let scope

  // Create iframe if a DOM exists
  if (typeof document !== 'undefined') {
    let iframe = document.createElement('iframe')
    if (!iframe.style) (iframe as any).style = {}
    iframe.style.display = 'none'

    document.documentElement.appendChild(iframe)

    scope = iframe.contentWindow
  }

  // Otherwise, target the global scope
  if (!scope) {
    scope = (new Function('return this'))() // Access the global object in strict mode
  }

  initScope(scope)

  return scope
}

function initScope (scope: any) {
  for (let object = scope; object; object = Object.getPrototypeOf(object)) {
    let propertyNames = Object.getOwnPropertyNames(object)

    for (let name of propertyNames) {
      // Exempt from exclusion: built-ins (explicitly secured hereinafter) and the `arguments` variable, which be overridden by a local variable of the same name in any function
      if (BuiltIns.hasOwnProperty(name) || name === 'arguments') continue

      // Variable names spanning non-trivial character sets are an exemption and will not be treated
      if (!/^[\w$]*$/.test(name)) throw new TypeError('Unexpected global variable ' + name)

      GlobalSymbols.push(name)
    }
  }

  // Seal the global scope: existing properties can be re-set but no new ones can be added
  // Is applied on the scope of a hidden iframe in the browser, or on the global scope of Node.js, however note that undeclared variable assignments are forbidden anyways in strict mode and are an anti-pattern in a module world
  Object.seal(scope)

  // Deep-freeze all built-ins so in theory, no run script will ever affect the globally shared objects nor can it leak memory by leaving references behind
  for (let name of BuiltIns) {
    freezeObject(scope[name])
  }
}

function freezeObject (object: any): any {
  if (object == null || Object.isFrozen(object)) return

  let properties = Object.getOwnPropertyNames(object)

  // Callables occur in large numbers and can be completely frozen as they never act as prototypes
  if (typeof object === 'function') {
    Object.freeze(object)
    return
  }

  // A frozen property in the prototype chain will prevent a property of the same name on an inheriting object from being set (e.g., `toString`) so circumvent this
  for (let name of properties) {
    let descriptor = Object.getOwnPropertyDescriptor(object, name)
    if (descriptor.writable && descriptor.configurable) {
      Object.defineProperty(object, name, {
        get () {
          return descriptor.value
        },
        set (value) {
          if (this === object) return

          // Defines a property on the inheritor, preventing the frozen parent from being set
          Object.defineProperty(this, name, { value, writable: true, configurable: true, enumerable: descriptor.enumerable })
        },
        enumerable: descriptor.enumerable,
      })
    }
  }

  // Shallow freeze object
  Object.freeze(object)

  // Drop out as soon as any non-standard behavior is observed
  if (!Object.isFrozen(object)) {
    throw new ReferenceError('Unexpected built-in')
  }

  // Recurse to parent
  freezeObject(Object.getPrototypeOf(object))

  // Freeze properties
  for (let name of properties) {
    // As a getter might be triggered which in fact does throw an error in certain contexts, errors have to be catched
    let value
    try { value = object[name] }
    catch (error) { continue }
    freezeObject(value)
  }
}

export interface Context { }

export function createContext(object: any = {}): Context {
  if (Context in object) return object.context
  if (scope == null) scope = createScope()

  // Contexts are created by extension
  let context = object[Context] = Object.create(object)
  let symbols = Object.keys(object).concat(GlobalSymbols)
  let initializer = `var ${symbols.join(', ')};`

  // A function that initializes all variables locally undefined that are present on the global scope and evals code in this context
  let run = context[Eval] =
    (new scope.Function(initializer + ' return function () { return eval(arguments[0]) }'))().bind(context)

  // Function code template
  function proxy() {
    Object.defineProperty(arguments[1], arguments[2], {
      get: function () { return eval(arguments[0]) }.bind(null, arguments[2]),
      set: function () { eval(arguments[0] + ' = ' + arguments[1]) }.bind(null, arguments[2]),
      enumerable: true,
    })
  }
  // Code that defines a property on the passed context attaching its value to the local variable counterpart inside the scope
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
    const strict = (function() { return this }) === undefined
    const script = new Replacer(code) // Tokenize

    // Strip non-ASCII-text characters (e.g., Unicode) from code portions, string literals not affected
    script.replace(/[^\x20-\x7E]+/g, '')

    // Replace references to the real global scope caused by function calls in non-strict mode with undefined, just as in strict mode
    if (!strict) {
      script.replace(/\bthis\b/g,
        () => '(function () { return this }() === this ? undefined : this)')
    }

    code = script.toString()
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
