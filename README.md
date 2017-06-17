# VirtualFS

VirtualFS is a fork of https://github.com/webpack/memory-fs. It a virtual posix like filesystem that runs completely in memory. It is intended to work in browsers and in NodeJS. For browser deployment, make sure to use browserify, the library will automatically load shims for browser usage.

It completely reworks the architecture to include:

* Proper stat metadata with proper MAC time handling
* Symlink support
* Hardlink support
* Virtual INodes
* Removal of all Windows path support
* Better compatibility with Node's FileSystem API

This package will be maintained as long as the Polykey project is maintained. All tests are passing in this fork.

---

Todo:

File descriptor support with open, close, read and write calls

Make a more comprehensive and granular test suite.
