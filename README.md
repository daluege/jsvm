# jsvm

[![NPM](https://img.shields.io/npm/v/jsvm.svg?maxAge=2592000&style=flat-square)](https://www.npmjs.com/package/jsvm)
[![Dependencies](https://img.shields.io/david/daluege/jsvm.svg?maxAge=2592000&style=flat-square)](https://david-dm.org/daluege/jsvm)
[![Build status](https://img.shields.io/travis/daluege/jsvm/master.svg?style=flat-square)](https://travis-ci.org/daluege/jsvm)
[![Coding style](https://img.shields.io/badge/code%20style-standard-blue.svg?style=flat-square)](http://standardjs.com/)

`jsvm` is a highly secure, fully compatible implementation of the [Node.js VM API](https://nodejs.org/api/vm.html) in pure ECMAScript 5. It may be used as a `vm` shim in [webpack](http://webpack.github.io/). It has a footprint of 7KB and does not depend on browser technologies such as the DOM.

`jsvm` is designed with high demands in efficiency and security in mind:

* Code is transpiled only on the basis of native `RegExp` tokenization
  and no AST is created, increasing speed by a huge factor. The cost
  of initialization is minimal, no `iframe` or similar is created at runtime.
* Security measures are designed to be immune to
  extensions of the ECMAScript grammar (non-standard
  extensions, future extensions). The package
  works with standardized ES5 features only, making results
  predictable and security best assessable.

## Installation

Install this package using NPM:

    npm install jsvm

## Usage

```javascript
var vm = require('jsvm');
var sandbox = { console };

vm.runInNewContext('console.log("Hello world")', sandbox);
```

See the Node.js `vm` [documentation](https://nodejs.org/api/vm.html).

## Method

`jsvm` executes scripts subsequently in the same global scope. No
`iframe` or Web Worker is instantiated at runtime and execution is
carried out solely by means of `eval` execution of `RegExp`-transpiled
code.

To achieve this, from the perspective of an executed script, built-in
[global objects](https://es5.github.io/#x15.1) (not the global object itself) are
frozen. Any modifications on properties or sub-properties of built-in
objects (such as `Object.prototype.toString`)
will be discarded (see the behavior of [`Object.freeze()`](https://developer.mozilla.org/de/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze)).

`jsvm` will not freeze any objects of the host script but create a
separate global scope for execution of virtualized scripts as long as
the executing environment makes it technically viable to create such a
separate global scope. This is the case in Node.js and in a browser.

## Comparison

`jsvm` differs from `vm` in the following points:

### Limitations

* All scripts run in _strict mode_ (or a superset, depending on browser support).
* Built-in objects (`Object`, `Array`, `Date` etc.) and their prototypes are immutable.
  This includes properties such as `RegExp.lastMatch`, which would normally change dynamically.

### Intentional differences

* The `timeout` option limits the execution time of the script itself but also of functions defined in the script that are called once the main script has terminated, such as events, timeouts etc.

## License

© 2016 Filip Dalüge, all rights reserved.
