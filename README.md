# memory-fs (with stat metadata!)

A simple in-memory filesystem. Holds data in a javascript object. This is forked from https://github.com/webpack/memory-fs It adds stat metadata to each file and directory created within the filesystem. This however means it is not a drop in replacement due to changing from single export to multiple export, and the data parameter of `MemoryFileSystem` constructor. However everything else remains the same, and if you need extra stat data, then you can use this. This package will be maintained as long as the Polykey project is maintained. All tests are passing in this fork.

``` javascript
var MemoryFileSystem = require("memory-fs").MemoryFileSystem;
var fs = new MemoryFileSystem();

fs.mkdirpSync("/a/test/dir");
fs.writeFileSync("/a/test/dir/file.txt", "Hello World");
fs.readFileSync("/a/test/dir/file.txt"); // returns Buffer("Hello World")

// Async variants too
fs.unlink("/a/test/dir/file.txt", function(err) {
	// ...
});

fs.readdirSync("/a/test"); // returns ["dir"]
fs.statSync("/a/test/dir").isDirectory(); // returns true
fs.rmdirSync("/a/test/dir");

fs.mkdirpSync("C:\\use\\windows\\style\\paths");
```
