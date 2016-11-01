# js-vm

[![NPM](https://img.shields.io/npm/v/js-vm.svg?maxAge=2592000&style=flat-square)](https://www.npmjs.com/package/js-vm)
[![License](https://img.shields.io/npm/l/js-vm.svg?style=flat-square)](./LICENSE)
[![Coding style](https://img.shields.io/badge/code%20style-standard-blue.svg?style=flat-square)](http://standardjs.com/)

## Installation

Install this package using NPM:

    npm install js-vm

## Introduction

`js-vm` implements the [Node.js VM](https://nodejs.org/api/vm.html) API
in ECMAScript 5. It is designed with security in mind and compiles and
executes code in an efficient manner. Transpiling comes out with only
tokenization based on native regular expressions and no AST is created.
Security measures are intended to be future-proof with respect to
extensions of the ECMAScript language and to the set supported by an
unkown environment. The module's range of operations is intentionally
limited to a standard ES5 set making security aspects best predictable
and assessible.

## Modes of operation

When run in an environment where a DOM is available, execution will be
carried out in a hidden iframe that will be created once and then be
reused. Otherwise (i.e., in Node.js or a Web Worker), execution will be
applied on the global scope. In this case, the secure mode used by
`js-vm` is entered also on the global scope. As a result, the limitations
listed hereinafter apply to the executed script in a browser and also to
the calling environment in Node.js.

## Limitations

* Built-in objects (`Object`, `Array`, `Date` etc.) and their prototypes are immutable.
* Global variables cannot be created by assignment (consistent with [strict mode](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Strict_mode)).
* `this` equals `undefined` instead of the global object when a function is called without an explicit `thisArg` passed (consistent with [strict mode](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Strict_mode)).
* Dynamic properties on built-ins such as `RegExp.lastMatch` are not set.

## Usage

```javascript
var vm = require('js-vm');
var sandbox = { console };

vm.runInNewContext('console.log("Hello world")', sandbox);
```

See the Node.js `vm` [documentation](https://nodejs.org/api/vm.html).

## License

MIT © 2016 Filip Dalüge ([see full text](./LICENSE))
