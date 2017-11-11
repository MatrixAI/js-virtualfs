# VirtualFS

VirtualFS is a virtual posix-like filesystem that runs completely in memory. It is intended to work in browsers and in NodeJS. For browser usage, make use of a bundler like Webpack, Browserify or Rollup.

It includes:

* Proper stat metadata with MAC time handling
* Symlink support
* Hardlink support
* Virtual inodes
* File descriptor support
* Proper streams implementation
* Character device support (/dev/null, /dev/full, /dev/tty...)
* Current working directory support
* Simulation of Unix file permissions
* Umask is considered when creating new iNodes
* Simulates POSIX filesystem errors
* Emulates `mmap` with `MAP_PRIVATE` and `MAP_SHARED`
* Usage of Flow types
* Removal of all Windows path support
* Practically complete compatibility with Node's FileSystem API

This package will be maintained as long as the Polykey project is maintained. All tests are passing in this fork.

Documentation
--------------

Documentation is located in the `doc` folder. You can also view the [rendered HTML](https://cdn.rawgit.com/MatrixAI/js-virtualfs/23a494a0/doc/index.html).

The VirtualFS API extends Node's `fs` API, while also leaving out functions that are not emulatable in-memory. For the functions that have the same name, you can just refer to Node's FS API: https://nodejs.org/api/fs.html. For the functions that don't have the name, refer to the generated API documentation that uses flow types. The source code is understandable so you can just read that as well.

To use VirtualFS as a global polyfill for `fs`, all you need to do is:

```js
import vfs from 'virtualfs';
(typeof self === 'undefined' ? typeof global === 'undefined' ? this : global : self).fs = vfs;
// alternatively use the global package `import global from 'global'; global.fs = vfs;`
```

All subsequent uses of `fs` in the current module, subsequently imported modules, and __any module that imports the current module__ will also use the same `fs`. The above monkeypatch works in Node, Browsers and Web Workers. However this will also make `/dev/tty` not work because it uses Node's real `fs`. Instead you should rely on a per-module override. Unless of course you're not using `/dev/tty` in Node.

In order to only override on a per-module basis you'll need to use the rewire package or the https://github.com/speedskater/babel-plugin-rewire babel plugin.

When using this in a CommonJS environment, you can gain access to the default `fs` replacement by using `var fs = require('virtualfs').default;`.

Development
-------------

To run flow type checks:

```
flow status
flow stop
```

To build this package for release:

```
npm run build
```

It will run tests, generate documentation and output multiple targets. One for browsers and one for nodejs. See `rollup.config.js` to see the target specification.

If your bundler is aware of the module field in `package.json`, you'll get the ES6 module directly.

Once you've updated the package run this:

```
npm version <update_type>
npm publish
```

The browser target makes use of these polyfill `devDependencies`:

* buffer - Used everywhere.
* events - Used by streams dependency.
* path - Used for `join`.
* process - Used for `nextTick` and `stdin` and `stdout` streams.

Todo
-----

* Investigate mounting implementation
