# VirtualFS

VirtualFS is a fork of https://github.com/webpack/memory-fs. It a virtual posix-like filesystem that runs completely in memory. It is intended to work in browsers and in NodeJS. For browser deployment, make sure to use browserify, the library will automatically load shims for browser usage.

It completely reworks the architecture to include:

* Proper stat metadata with MAC time handling
* Symlink support
* Hardlink support
* Virtual inodes
* File descriptor support
* Proper streams implementation
* Simulates POSIX filesystem errors
* Removal of all Windows path support
* Almost complete compatibility with Node's FileSystem API

This package will be maintained as long as the Polykey project is maintained. All tests are passing in this fork.

Documentation
--------------

Documentation is located in the `doc` folder. You can also view the [rendered HTML](https://cdn.rawgit.com/MatrixAI/js-virtualfs/23a494a0/doc/index.html).

The VirtualFS API does not need to be documented here. Just refer to Node's FS API https://nodejs.org/api/fs.html.

Development
-------------

To run flow type checks:

```
flow init # this is already done
flow status # launches background process
flow stop # stops background process
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

Note that currently the browser target in rollup does not work: https://github.com/rollup/rollup-plugin-babel/issues/161
