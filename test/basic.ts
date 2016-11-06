import * as test from 'tape'

import * as vm from '../jsvm'

test('basic', (t) => {
  t.test('runInNewContext()', (t) => {
    let sandbox = { }
    let result = vm.runInNewContext(
      'this.foo = "bar"; this.typeofProcess = typeof process; typeof Object',
      sandbox
    )
    t.deepEqual(sandbox, {
      foo: 'bar',
      typeofProcess: 'undefined',
    })
    t.equal(result, 'function')

    t.end()
  })

  t.test('runInContext()', (t) => {
    let sandbox = { foo: 'bar' }
    let context = vm.createContext(sandbox)
    let result = vm.runInContext(
      'baz = foo; this.typeofProcess = typeof process; typeof Object',
      context
    )
    t.deepEqual(sandbox, {
      foo: 'bar',
      baz: 'bar',
      typeofProcess: 'undefined'
    })
    t.equal(result, 'function')

    t.end()
  })

  t.test('runInThisContext()', (t) => {
    let result = vm.runInThisContext(
      'this.vmResult = "foo"; Object.prototype.toString.call(process)'
    )
    t.equal(global['vmResult'], 'foo')
    t.equal(result, '[object process]')
    delete global['vmResult']

    t.end()
  })

  t.test('runInNewContext()', (t) => {
    let result = vm.runInNewContext(
      'this.vmResult = "foo"; typeof process'
    )
    t.equal(global['vmResult'], undefined)
    t.equal(result, 'undefined')

    t.end()
  })

  t.test('createContext()', (t) => {
    let sandbox = {}
    let context = vm.createContext(sandbox)
    t.equal(sandbox, context)

    t.end()
  })

  t.end()
})
