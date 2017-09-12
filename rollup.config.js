import fs from 'fs';
import babel from 'rollup-plugin-babel';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

export default [
  {
    input: 'lib/index.js',
    output: {
      file: 'dist/index.node.es.js',
      format: 'es'
    },
    external: (id) => {
      return Object.keys(packageJson.dependencies)
        .map((dep) => new RegExp('^' + dep))
        .concat([/^babel-runtime/])
        .some((pattern) => pattern.test(id));
    },
    plugins: [
      babel({
        babelrc: false,
        exclude: 'node_modules/**',
        runtimeHelpers: true,
        plugins: ['transform-object-rest-spread', 'transform-runtime'],
        presets: [
          'flow',
          ['env', {
            modules: false,
            targets: {
              node: '6.0.0'
            }
          }]
        ]
      })
    ]
  },
  {
    input: 'lib/index.js',
    output: {
      file: 'dist/index.node.cjs.js',
      format: 'cjs'
    },
    external: (id) => {
      return Object.keys(packageJson.dependencies)
        .map((dep) => new RegExp('^' + dep))
        .concat([/^babel-runtime/])
        .some((pattern) => pattern.test(id));
    },
    plugins: [
      babel({
        babelrc: false,
        exclude: 'node_modules/**',
        runtimeHelpers: true,
        plugins: ['transform-object-rest-spread', 'transform-runtime'],
        presets: [
          'flow',
          ['env', {
            modules: false,
            targets: {
              node: '6.0.0'
            }
          }]
        ]
      })
    ]
  },
  {
    input: 'lib/index.js',
    output: {
      file: 'dist/index.browser.umd.js',
      format: 'umd',
      name: 'VirtualFS'
    },
    plugins: [
      babel({
        babelrc: false,
        exclude: 'node_modules/**',
        runtimeHelpers: true,
        plugins: ['transform-object-rest-spread', 'transform-runtime', 'transform-class-properties'],
        presets: [
          'flow',
          ['env', {
            modules: false,
            targets: {
              browsers: ['last 2 versions']
            }
          }]
        ]
      }),
      resolve({
        preferBuiltins: false,
        browser: true
      }),
      commonjs()
    ]
  }
];
