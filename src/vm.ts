import Code from './code'
import {createGlobalObject, isBuiltIn} from './object'
import {isReservedWord} from './syntax'

const CONTEXT = Symbol('context')
const TIMER_INTERRUPT = 10000

let globalObject = null

function createTimer (timeout: number) {
  let start
  let steps = 0

  return (): any => {
    if (start == null) {
      start = Date.now()

      setTimeout(
        () => {
          start = null
          steps = 0
        }, 0)
      return true
    }
    if (steps++ < TIMER_INTERRUPT) return true
    if (Date.now() - start < timeout) return true

    throw new Error('Script execution timed out')
  }
}

export class Context {
  eval: Function
  time: Function

  constructor (public sandbox: Sandbox, public global: any) {
    // Create a context scope and return a function to eval code in the context scope
    this.eval = (
      new global.Function(`'use strict'; return function () { return eval(arguments[0]) }`))()
  }

  // A function that evaluates code in the context target scope and returns a resulting new scope on top of the previous one
  exec (code: string, global?: any): void {
    this.eval = this.eval.call(global, `${code}\n;\n(function () { return eval(arguments[0]) })`)
  }
}

export interface Sandbox { }

export function createContext <T> (sandbox: T = {} as T): T & Sandbox {
  if (sandbox.hasOwnProperty(CONTEXT)) throw TypeError('The sandbox has already been contextified')

  if (globalObject == null) globalObject = createGlobalObject()

  let context = new Context(sandbox, globalObject)
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

export class Script extends String {
  code: Code = new Code(this.valueOf())

  constructor (code: string, protected options: any = {}) {
    super(code)
  }

  runInContext(sandbox: Sandbox, options?: any) {
    if (!sandbox.hasOwnProperty(CONTEXT)) throw new ReferenceError('Object is not a context')

    options = (options == null) ?
      this.options :
      Object.assign(Object.create(this.options), options)

    const context: Context = sandbox[CONTEXT]

    // Collect possibly variable-referencing words on any level
    const identifiers = {}
    const pattern = /(?:\\.)?(\w+|\u.{4})+/g
    let match
    while ((match = pattern.exec(this.code.toString()))) identifiers[match[1]] = true

    const definitions = []
    for (let identifier in identifiers) {
      if (!identifiers.hasOwnProperty(identifier)) continue
      if (isReservedWord(identifier) || isBuiltIn(identifier)) continue

      definitions.push(identifier)
    }

    // Initialize possible identifiers present in the script in the context scope
    if (definitions.length) context.exec(`var ${definitions.join(', ')}`)

    // Defines a property on the passed context attaching its value to the local variable counterpart inside the scope
    let attachProperty = function () {
      // Initialize value
      eval(arguments[0] + ' = this[arguments[0]]')

      // Define getter and setter bound to the variable with the same name on the context object
      Object.defineProperty(this, arguments[0], {
        get: function () {
          return eval(arguments[0])
        }.bind(this, arguments[0]),
        set: function () {
          eval(arguments[0] + ' = arguments[1]')

          // Make property enumerable once it has been set
          if (!this.propertyIsEnumerable(arguments[0])) {
            let descriptor = Object.getOwnPropertyDescriptor(this, arguments[0])
            descriptor.enumerable = true
            Object.defineProperty(this, arguments[0], descriptor)
          }
        }.bind(this, arguments[0]),
        enumerable: this.hasOwnProperty(arguments[0]),
        configurable: true,
      })
    }

    // Initialize function in context scope
    attachProperty = context.eval(`(${attachProperty})`)

    for (let name of definitions) {
      let descriptor = Object.getOwnPropertyDescriptor(sandbox, name)
      if (descriptor && (!descriptor.writable || !descriptor.configurable)) continue

      attachProperty.call(sandbox, name)
    }

    options = {
      time: options.timeout && createTimer(options.timeout)
    }

    // Execute code
    return this.code.eval(function () { return context.eval.apply(sandbox, arguments) }, options)
  }

  runInNewContext(context?: any, options?: any) {
    return this.runInContext(createContext(context), options)
  }

  runInThisContext(options?: any) {
    return runInThisContext(this.code.toString(), options)
  }
}
