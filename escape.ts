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

export default function escape (code: string) {
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
