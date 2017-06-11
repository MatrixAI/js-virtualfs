# VirtualFS

VirtualFS is a fork of https://github.com/webpack/memory-fs. It adds stat metadata and symlink support while removing all the Windows support. It strives to be posix compatible, but it is not fully the same as a real Unix filesystem.

This package will be maintained as long as the Polykey project is maintained. All tests are passing in this fork.

---

Todo:

Properly model and implement the MAC times.

Properly model and implement inodes (and hence support hardlinks).

Make a more comprehensive and granular test suite.
