// @flow
import babel from 'rollup-plugin-babel';
import commonjs from 'rollup-plugin-commonjs';
import replace from 'rollup-plugin-replace';

const input = 'src/index.js';

export default [
  // Universal module definition (UMD) build
  {
    input,
    output: {
      file: 'dist/raf-stub.js',
      format: 'umd',
      name: 'rafStub',
    },
    plugins: [
      // Setting development env before running babel etc
      replace({ 'process.env.NODE_ENV': JSON.stringify('development') }),
      babel(),
      commonjs({ include: 'node_modules/**' }),
    ],
  },
  // ESM build
  {
    input,
    output: {
      file: 'dist/raf-stub.esm.js',
      format: 'esm',
    },
    plugins: [babel()],
  },
  // CommonJS build
  {
    input,
    output: {
      file: 'dist/raf-stub.cjs.js',
      format: 'cjs',
    },
    plugins: [babel()],
  },
];
