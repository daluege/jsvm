const Literal = [
  /'(?:(?!'|\\).|\\(?:\r\n|[\s\S]))*'/,
  /"(?:(?!"|\\).|\\(?:\r\n|[\s\S]))*"/,
  /`(?:[^`\\]+|\\[\s\S])*`/,
  /\/(?:[^/\\\n]+|\\.|\[.*?\])*\//,
  // '`(?:[^`\\$]|\\[\s\S]|\$(?!\{)*`', // Template // TODO: support
].map(re => re.source).join('|')

const Sign = /[-[\](){}+*%&|^<>!=?;,:.~#!@]/.source

const Identifier = /[\w\\]+/.source

const Comment = [
  '//.*', // Single-line comment
  '/\\*(?:[^*]|\\*(?!/))*\\*/', // Multi-line comment
].join('|')

const ReservedWords = {} // ECMA-262 Section 7.6.1

export function isReservedWord (keyword: string): boolean {
  if (ReservedWords.hasOwnProperty(keyword)) return ReservedWords[keyword]
  try {
    eval('var ' + keyword)
  } catch (error) {
    return (ReservedWords[keyword] = true)
  }
  return (ReservedWords[keyword] = false)
}

export function normalize (code: string) {
  // Strip comments but maintain line breaks in order to preserve line numbers
  code = code.replace(new RegExp(Comment, 'g'), (match: string) => match.replace(/[^\n]+/g, ''))

  // Encode special characters
  const sequence = code.replace(/(?='|\n|\\(?![^ux\d\\]))/g, '\\')
  code = eval(`'${sequence}'`)

  const pattern = new RegExp(`(^\\s*|[\\s\\S]*?${Sign}\\s*(${Identifier})?\\s*|[\\s\\S]+)(${Literal}|\$)`, 'g')
  code = code.replace(pattern, (match: string, code: string, keyword: string, literal: string): string => {
    if (literal[0] === '/') {
      // A slash preceeded by any identifier is not a regular expression but a division operator
      if (keyword && !isReservedWord(keyword)) return match
    }

    literal = literal.replace(/((?:\\.)?)([a-zA-Z_])/g, (match: string, prefix: string, character: string) => prefix + '\\x' + character.charCodeAt(0).toString(16))

    return `${code}${literal}`
  })

  // Normalize non-ASCII characters and the dollar sign
  code = code.replace(/\\?([^\x20-\x7f]|\$)/g,
    (match: string, character: string) => '\\u' + (character > '\u00ff' ? '' : '0') + (character > '\u0fff' ? '' : '0') + character.charCodeAt(0).toString(16))

  return code
}

export default class Syntax {
  private value: string

  constructor(code: string | Syntax, options?: any) {
    if (code instanceof Syntax) this.value = code.value
    else this.value = normalize(code)
  }

  toString () {
    return this.value
  }

  replace (pattern: string | RegExp, replacement: string | ((substring: string, ...args: string[]) => string)) {
    this.value = this.value.replace(pattern as any, replacement as any)
  }

  match (pattern: string | RegExp): RegExpMatchArray {
    return this.value.match(pattern as any)
  }
}
