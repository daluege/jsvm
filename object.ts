const BuiltIns = ['Array', 'ArrayBuffer', 'Atomics', 'Boolean', 'DataView', 'Date', 'Error', 'EvalError',
  'Float32Array', 'Float64Array', 'Function', 'Generator', 'GeneratorFunction', 'Infinity', 'Int16Array', 'Int32Array',
  'Int8Array', 'InternalError', 'Iterator', 'JSON', 'Map', 'Math', 'NaN', 'Number', 'Object', 'ParallelArray',
  'Promise', 'Proxy', 'RangeError', 'ReferenceError', 'Reflect', 'RegExp', 'Set', 'SharedArrayBuffer', 'StopIteration',
  'String', 'Symbol', 'SyntaxError', 'TypeError', 'URIError', 'Uint16Array', 'Uint32Array', 'Uint8Array',
  'Uint8ClampedArray', 'WeakMap', 'WeakSet', 'decodeURI', 'decodeURIComponent', 'encodeURI', 'encodeURIComponent',
  'escape', 'eval', 'isFinite', 'isNaN', 'parseFloat', 'parseInt', 'undefined', 'unescape']

export function isBuiltIn (name: string): boolean {
  if (BuiltIns.hasOwnProperty(name)) return BuiltIns[name]
  if (BuiltIns[name] = BuiltIns.indexOf(name) !== -1) {
    return BuiltIns[name] = true
  }
  return false
}

export function createGlobalObject () {
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

  // Deep-freeze all built-ins so no memory-leaking references may be left behind by a script
  for (let name of BuiltIns) {
    freeze(globalObject[name])
  }

  return globalObject
}

export function freeze (object: any): any {
  if (object === global) new TypeError('Cannot freeze the global scope')
  if (object == null || Object.isFrozen(object)) return object

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
          if (this === object) return object

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

  return object
}
