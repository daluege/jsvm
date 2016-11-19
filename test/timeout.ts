import * as test from 'tape'

import * as vm from '../jsvm'

test('timeout', (t) => {
  t.test('infinite loops', (t) => {
    t.timeoutAfter(150)

    const time = Date.now()

    t.throws(() => {
      vm.runInNewContext('while (true);', {}, { timeout: 100 })
    }, null, 'should raise an exception')

    const duration = Date.now() - time

    t.ok(Math.abs(duration - 100) < 20, 'should exit close to the timeout limit')
    t.end()
  })

  t.test('timeout exceptions', (t) => {
    t.timeoutAfter(150)

    t.throws(() => {
      vm.runInNewContext('try { while (true); } catch (e) {  } for (var i = 0; i < 10; i++)', {}, { timeout: 100 })
    }, null, 'should not be catchable')

    t.end()
  })

  t.end()
})
