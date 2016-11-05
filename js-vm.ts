import BaseScript from 'script-transform'

const CONTEXT = Symbol('context')

const BuiltIns = ['Array', 'ArrayBuffer', 'Atomics', 'Boolean', 'DataView', 'Date', 'Error', 'EvalError', 'Float32Array', 'Float64Array', 'Function', 'Generator', 'GeneratorFunction', 'Infinity', 'Int16Array', 'Int32Array', 'Int8Array', 'InternalError', 'Iterator', 'JSON', 'Map', 'Math', 'NaN', 'Number', 'Object', 'ParallelArray', 'Promise', 'Proxy', 'RangeError', 'ReferenceError', 'Reflect', 'RegExp', 'Set', 'SharedArrayBuffer', 'StopIteration', 'String', 'Symbol', 'SyntaxError', 'TypeError', 'URIError', 'Uint16Array', 'Uint32Array', 'Uint8Array', 'Uint8ClampedArray', 'WeakMap', 'WeakSet', 'decodeURI', 'decodeURIComponent', 'encodeURI', 'encodeURIComponent', 'escape', 'eval', 'isFinite', 'isNaN', 'parseFloat', 'parseInt', 'undefined', 'unescape']
const ReservedWords = {} // ECMA-262 Section 7.6.1

let globalObject = null

function isReservedWord (keyword: string): boolean {
  if (ReservedWords.hasOwnProperty(keyword)) return ReservedWords[keyword]
  try {
    eval('var ' + keyword)
  } catch (error) {
    return (ReservedWords[keyword] = true)
  }
  return (ReservedWords[keyword] = false)
}

function isBuiltIn (name: string): boolean {
  if (BuiltIns.hasOwnProperty(name)) return BuiltIns[name]
  if (BuiltIns[name] = BuiltIns.indexOf(name) !== -1) {
    return BuiltIns[name] = true
  }
  return false
}

function Timer (timeout: number): Function {
  let start
  let steps = 0

  return () => {
    if (start == null) {
      start = Date.now()

      setTimeout(() => {
        start = null
        steps = 0
      }, 0)
      return true
    }
    if (steps++ < 10000) return true
    if (Date.now() - start < timeout) return true

    throw new Error('Script execution timed out')
  }
}

export class Context {
  // Create a context scope and return a function to eval code in the context scope
  run: Function
  timer: Function

  constructor (public sandbox: Sandbox) {
    if (globalObject == null) globalObject = createGlobalScope()

    let run = (new globalObject.Function(`'use strict'; var \\u17a3; return function run () { return eval(arguments[0]) }`))()
    this.run = run.bind(this.sandbox)
  }
}

export interface Sandbox { }

export function createContext(sandbox: Sandbox = {}): Sandbox {
  if (sandbox.hasOwnProperty(CONTEXT)) throw TypeError('The sandbox has already been contextified')

  if (globalObject == null) globalObject = createGlobalScope()

  let context = new Context(sandbox)
  sandbox[CONTEXT] = context
  return sandbox
}

export function isContext(sandbox: any): sandbox is Sandbox {
  return CONTEXT in sandbox
}

export function runInContext(code: string, sandbox: Sandbox, options?: any): any {
  let script = new Script(code, options)
  return script.runInContext(sandbox)
}

export function runInNewContext(code: string, sandbox?: Sandbox, options?: any): any {
  return runInContext(code, createContext(sandbox), options)
}

export function runInThisContext(code: string, options?: any): any {
  return (new Function('return eval(arguments[0])'))(code)
}

export class Script extends BaseScript {
  constructor(code: string, protected options: any = {}) {
    super(code)

    this.applyMagic()
    this.applyTimer()
    this.applyGlobal()
  }

  private applyMagic () {
    // Reserve the deprecated Unicode character 'Khmer' as a magic character that will never form part of functional code
    this.replace(/(^|[^\\])\\u17a3/gi, '$1\\u17a2', true)
  }

  private applyGlobal () {
    // Test if strict mode is supported
    const strict = (function() { 'use strict'; return this }) === undefined
    if (strict) return

    // Replace references to the real global scope caused by function calls in non-strict mode with undefined as in strict mode
    this.replace(/([^\w$])this\b(?=\s*[^\s=]|\s*$)/g,
      (input, left) => {
        return left + `(this === (function () { return this })() ? undefined : this)`
      })
  }

  private applyTimer () {
    // Insert a timer() instruction before the condition statement of a for structure and before any other indistinguishable statements
    this.replace(/;(\s*(\w+)[\s({]|\s*([^\s;\]})]))/g,
      (match: string, suffix: string, keyword: string, next: string) => {
        return keyword && isReservedWord(keyword) ? match : '; \\u17a3.timer()' + (next ? ',' : '') + suffix
      })

    // Insert a timer() instruction inside the condition statement of a while structure
    this.replace(/\bwhile\s*\(/g, '$&\\u17a3.timer() && ')
  }

  runInContext(sandbox: Sandbox, options?: any) {
    if (!sandbox.hasOwnProperty(CONTEXT)) throw new ReferenceError('Object is not a context')

    options = (options == null) ?
      this.options :
      Object.assign(Object.create(this.options), options)

    let context: Context = sandbox[CONTEXT]

    context.timer = options.timeout ? Timer(options.timeout) : () => {}

    // Collect possibly variable-referencing words on any level
    let identifiers = {}
    this.match(/(?:^|[^.\s\w$\\])\s*([\w$\\]+)/g, (match, identifier) => {
      identifiers[identifier] = identifier
    })

    let definitions = []
    for (let identifier in identifiers) {
      if (!identifiers.hasOwnProperty(identifier)) continue
      if (isReservedWord(identifier) || isBuiltIn(identifier)) continue

      definitions.push(identifier)
    }

    let initializer = definitions.length ? `var ${definitions.join(', ')};` : ''

    // A function that initializes in a scope within the context scope possible identifiers present in the script and then evals code
    context.run = (context.run(`${initializer} (function run () { return eval(arguments[0]) })`))

    // Defines a property on the passed context attaching its value to the local variable counterpart inside the scope
    let attachProperty = function () {
      // Initialize value
      eval(arguments[0] + ' = this[arguments[0]]')

      // Define getter and setter bound to the variable with the same name on the context object
      Object.defineProperty(this, arguments[0], {
        get: function () {
          return eval(arguments[0])
        }.bind(null, arguments[0]),
        set: function () {
          eval(arguments[0] + ' = arguments[1]')
        }.bind(null, arguments[0]),
        enumerable: true,
      })
    }

    // Initialize function in context scope
    attachProperty = context.run(`(${attachProperty})`)

    for (let name of definitions) {
      let descriptor = Object.getOwnPropertyDescriptor(sandbox, name)
      if (!descriptor || !descriptor.writable || !descriptor.configurable) continue

      attachProperty.call(sandbox, name)
    }

    // Set the context object
    context.run.call(context, '\\u17a3 = this')

    // Execute code
    return context.run(this.toString())
  }

  runInNewContext(context?: any, options?: any) {
    return this.runInContext(createContext(context), options)
  }

  runInThisContext(options?: any) {
    return runInThisContext(this.code, options)
  }
}

function createGlobalScope () {
  let globalObject

  // Create iframe if a DOM exists
  if (typeof document !== 'undefined') {
    let iframe = document.createElement('iframe')
    if (!iframe.style) (iframe as any).style = {}
    iframe.style.display = 'none'

    document.documentElement.appendChild(iframe)

    globalObject = iframe.contentWindow
  }

  // Otherwise, target the current global scope
  if (!globalObject) {
    globalObject = (new Function('return this'))() // Access the global object in strict mode
  }

  initGlobalScope(globalObject)

  return globalObject
}

function initGlobalScope (globalObject: any) {
  for (let object = globalObject; object; object = Object.getPrototypeOf(object)) {
    let propertyNames = Object.getOwnPropertyNames(object)

    for (let name of propertyNames) {
      // Non-trivial property names shall not be present initially in the global scope as these are not handled by the parser for the sake of simplicity
      if (!/^[\w$]*$/.test(name)) throw new TypeError('Unexpected global variable ' + name)
    }
  }

  // Deep-freeze all built-ins so no memory-leaking references may be left behind by a script
  for (let name of BuiltIns) {
    freeze(globalObject[name])
  }
}

export function freeze (object: any): any {
  if (object == null || Object.isFrozen(object)) return

  let properties = Object.getOwnPropertyNames(object)

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
  freeze(Object.getPrototypeOf(object))

  // Freeze properties
  for (let name of properties) {
    // As a getter might be triggered which in fact does throw an error in certain contexts, errors have to be catched
    let value
    try { value = object[name] }
    catch (error) { continue }
    freeze(value)
  }
}
