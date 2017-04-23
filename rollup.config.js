import commonjs from 'rollup-plugin-commonjs'
import nodeGlobals from 'rollup-plugin-node-globals'
import nodeResolve from 'rollup-plugin-node-resolve'
import typescript from 'rollup-plugin-typescript'

export default {
  entry: 'src/index.ts',
  dest: 'dist/bundle.js',
  format: 'es',
  sourceMap: true,
  plugins: [
    typescript(),
    nodeResolve({
      jsnext: true,
      main: true,
      browser: true
    }),
    commonjs(),
    nodeGlobals(),
  ],
}
