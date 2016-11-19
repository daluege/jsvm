import * as test from 'tape'

import * as vm from '../jsvm'

test('timeout', (t) => {
  t.test('while ()', (t) => {
    t.timeoutAfter(120)

    const time = Date.now()

    try {
      vm.runInNewContext('while (true);', {}, { timeout: 100 })
    } catch (e) { }

    const duration = Date.now() - time

    t.ok(Math.abs(duration - 100) < 20, 'infinite loops should exit close to the timeout limit')
    t.end()
  })

  t.test('catch ()', (t) => {
    t.timeoutAfter(120)

    try {
      vm.runInNewContext('while (true) try { while (true); } catch (e) {  }', {}, { timeout: 100 })
    } catch (e) { }

    t.ok(true, 'timeout exceptions should not be catchable')
    t.end()
  })

  t.end()
})
