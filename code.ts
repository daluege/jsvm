import Syntax from './syntax'
import {isReservedWord} from './syntax'
import {Context} from './jsvm'

const INTERNAL = '\\u17a3'

export default class Code extends Syntax {
  hasTimer = false

  constructor (code: string) {
    super(code)

    // Create a global internal reference to a context object
    this.addInternal()

    // Mask the global object as this argument if not in strict mode
    this.addGlobal()
  }

  replace (pattern: string | RegExp, replacement: string | ((substring: string, ...args: string[]) => string)) {
    // For convenience, replace the identifier `internal` with a name unreachable for user code
    if (typeof replacement === 'string') {
      replacement = replacement.replace(/\binternal\b(?!\\)/, INTERNAL)
    }

    return super.replace(pattern, replacement)
  }

  eval (callback: Function, options?: any): any {
    if (options) {
      // Let code call internal.time() at least on every jump instruction if a timer exists
      if (typeof options['time'] === 'function' && !this.hasTimer) {
        this.hasTimer = true
        this.addTimer()
      }
    }

    // Set an internal pointer to the context object
    return callback(this.toString(), options)
  }

  private addTimer () {
    // Insert a time() instruction before the condition statement of a for structure and before any other indistinguishable statements
    this.replace(/;(\s*(\w+)[\s({]|\s*([^\s;\]})]))/g,
      (match: string, suffix: string, keyword: string, next: string) => {
        return keyword && isReservedWord(keyword) ? match : `; ${INTERNAL}.time()` + (next ? ',' : '') + suffix
      })

    // Insert a time() instruction inside the condition statement of a while structure
    this.replace(/\bwhile\s*\(/g, '$&internal.time() && ')
  }

  private addGlobal () {
    // Test if strict mode is supported
    const strict = (function() { 'use strict'; return this })() === undefined
    if (strict) return

    // Replace references to the real global scope caused by function calls in non-strict mode with undefined as in strict mode
    this.replace(/([^\w$])this\b(?=\s*[^\s=]|\s*$)/g,
      (input, left) => {
        return left + `(this === internal.global ? undefined : this)`
      })
  }

  private addInternal () {
    // Reserve the deprecated Unicode character 'Khmer' as a magic character and ensure it will not appear in virtual code
    this.replace(/${INTERNAL}/gi, '$1\\u17a2')

    this.replace('', `var ${INTERNAL} = arguments[1]; [].splice.call(arguments, 0); `)
  }
}
