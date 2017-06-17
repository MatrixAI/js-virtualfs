var bl = require("bl");
var should = require("should");

var File = require('../lib/INodes').File;
var Directory = require('../lib/INodes').Directory;
var Symlink = require('../lib/INodes').Symlink;
var VirtualFS = require('../lib/VirtualFS').FS;

describe("directory", function() {

	it("should have a empty root directory as startup", function(done) {
		let fs = new VirtualFS();
		fs.readdirSync("/").should.be.eql([]);
		let stat = fs.statSync("/");
		stat.isFile().should.be.eql(false);
		stat.isDirectory().should.be.eql(true);
		fs.readdir("/", function(err, files) {
			if(err) throw err;
			files.should.be.eql([]);
			done();
		});
	});

  it("it should make directories", function () {
		let fs = new VirtualFS();
		fs.mkdirSync("/first");
		fs.mkdirSync("/first//sub/");
		fs.mkdirpSync("/first/sub2");
		fs.mkdirSync("/backslash\\dir");
		fs.mkdirpSync("/");
		fs.readdirSync("/").should.be.eql(["first", "backslash\\dir"]);
		fs.readdirSync("/first/").should.be.eql(["sub", "sub2"]);
		fs.mkdirpSync("/a/depth/sub/dir");
		fs.existsSync("/a/depth/sub").should.be.eql(true);
		var stat = fs.statSync("/a/depth/sub");
		stat.isFile().should.be.eql(false);
		stat.isDirectory().should.be.eql(true);
  });

  it("it should not make the root directory", function () {
		let fs = new VirtualFS();
		(function () {
			fs.mkdirSync("/");
		}).should.throw();
  });

	it("should remove directories", function() {
		let fs = new VirtualFS();
		fs.mkdirSync("/first");
		fs.mkdirSync("/first//sub/");
		fs.mkdirpSync("/first/sub2");
		fs.mkdirSync("/backslash\\dir");
		fs.rmdirSync("/first/sub//");
		fs.readdirSync("//first").should.be.eql(["sub2"]);
		fs.rmdirSync("/first/sub2");
		fs.rmdirSync('/first');
		fs.existsSync("/first").should.be.eql(false);
		(function() {
			fs.readdirSync("/first");
		}).should.throw();
		fs.readdirSync("/").should.be.eql(["backslash\\dir"]);
	});

	it("should call a mkdir callback when passed as the third argument", function(done) {
		var fs = new VirtualFS();
		fs.mkdir('/test', {}, function(err) {
			if (err) throw err;
			done();
		});
	});

});

describe("files", function() {

	it("should make and remove files", function() {
		var fs = new VirtualFS();
		fs.mkdirSync("/test");
		var buf = new Buffer("Hello World", "utf-8");
		fs.writeFileSync("/test/hello-world.txt", buf);
		fs.readFileSync("/test/hello-world.txt").should.be.eql(buf);
		fs.readFileSync("/test/hello-world.txt", "utf-8").should.be.eql("Hello World");
		fs.readFileSync("/test/hello-world.txt", {encoding: "utf-8"}).should.be.eql("Hello World");
		(function() {
			fs.readFileSync("/test/other-file");
		}).should.throw();
		(function() {
			fs.readFileSync("/test/other-file", "utf-8");
		}).should.throw();
		fs.writeFileSync("/a", "Test", "utf-8");
		fs.readFileSync("/a", "utf-8").should.be.eql("Test");
		var stat = fs.statSync("/a");
		stat.isFile().should.be.eql(true);
		stat.isDirectory().should.be.eql(false);
		fs.writeFileSync("/b", "Test", {encoding: "utf-8"});
		fs.readFileSync("/b", "utf-8").should.be.eql("Test");
	});

});

describe('hardlinks', function () {

  it('should create multiple hardlinks to the same file', function () {
		var fs = new VirtualFS();
		fs.mkdirSync("/test");
    fs.writeFileSync('/test/a');
    fs.linkSync('/test/a', '/test/b');
    let indexA = fs.statSync('/test/a').ino;
    let indexB = fs.statSync('/test/b').ino;
    indexA.should.be.eql(indexB);
    fs.readFileSync('/test/a').should.be.eql(fs.readFileSync('/test/b'));
  });

  it('should not create hardlinks to directories', function () {
		var fs = new VirtualFS();
		fs.mkdirSync("/test");
	  (function () {
      fs.linkSync('/test', '/hardlinktotest');
	  }).should.throw(/EPERM/);
  });

});

describe("symlinks", function() {

	it("should add and traverse symlinks", function() {
		var fs = new VirtualFS();
		fs.mkdirSync("/test");
		var buf = new Buffer("Hello World", "utf-8");
		fs.writeFileSync("/test/hello-world.txt", buf);
    fs.symlinkSync('/test', '/linktotestdir');
    fs.readlinkSync('/linktotestdir'). should.be.eql('/test');
		fs.readdirSync("/linktotestdir").should.be.eql(['hello-world.txt']);
    fs.symlinkSync('/linktotestdir/hello-world.txt', '/linktofile');
    fs.readFileSync('/linktofile', 'utf-8').should.be.eql('Hello World');
	});

	it("should traverse relative symlinks", function() {
		var fs = new VirtualFS();
		fs.mkdirSync("/test");
		var buf = new Buffer("Hello World", "utf-8");
    fs.writeFileSync('/a', buf);
    fs.symlinkSync('../a', '/test/linktoa');
    fs.readFileSync('/test/linktoa', 'utf-8').should.be.eql('Hello World');
	});

  it ("it should delete only the symlink", function () {
		var fs = new VirtualFS();
		fs.mkdirSync("/test");
		var buf = new Buffer("Hello World", "utf-8");
		fs.writeFileSync("/test/hello-world.txt", buf);
    fs.symlinkSync('/test', '/linktotestdir');
    fs.symlinkSync('/linktotestdir/hello-world.txt', '/linktofile');
    fs.unlinkSync('/linktotestdir');
    fs.unlinkSync('/linktofile');
    fs.readdirSync('/test').should.be.eql(['hello-world.txt']);
  });

});

describe("errors", function() {
	it("should fail on invalid paths", function() {
		var fs = new VirtualFS();
		fs.mkdirpSync("/test/a/b/c");
		fs.mkdirpSync("/test/a/bc");
		fs.mkdirpSync("/test/abc");
		(function() {
			fs.readdirSync("/test/abc/a/b/c");
		}).should.throw();
		(function() {
			fs.readdirSync("/abc");
		}).should.throw();
		(function() {
			fs.statSync("/abc");
		}).should.throw();
		(function() {
			fs.mkdirSync("/test/a/d/b/c");
		}).should.throw();
		(function() {
			fs.writeFileSync("/test/a/d/b/c", "Hello");
		}).should.throw();
		(function() {
			fs.readFileSync("/test/a/d/b/c");
		}).should.throw();
		(function() {
			fs.readFileSync("/test/abcd");
		}).should.throw();
		(function() {
			fs.mkdirSync("/test/abcd/dir");
		}).should.throw();
		(function() {
			fs.unlinkSync("/test/abcd");
		}).should.throw();
		(function() {
			fs.unlinkSync("/test/abcd/file");
		}).should.throw();
		(function() {
			fs.statSync("/test/a/d/b/c");
		}).should.throw();
		(function() {
			fs.statSync("/test/abcd");
		}).should.throw();
		fs.mkdir("/test/a/d/b/c", function(err) {
			err.should.be.instanceof(Error);
		});
	});
	it("should fail on wrong type", function() {
		var fs = new VirtualFS();
		fs.mkdirpSync("/test/dir");
		fs.mkdirpSync("/test/dir");
		fs.writeFileSync("/test/file", "Hello");
		(function() {
			fs.writeFileSync("/test/dir", "Hello");
		}).should.throw();
		(function() {
			fs.readFileSync("/test/dir");
		}).should.throw();
		(function() {
			fs.writeFileSync("/", "Hello");
		}).should.throw();
		(function() {
			fs.rmdirSync("/");
		}).should.throw();
		(function() {
			fs.unlinkSync("/");
		}).should.throw();
		(function() {
			fs.mkdirSync("/test/dir");
		}).should.throw();
		(function() {
			fs.mkdirSync("/test/file");
		}).should.throw();
		(function() {
			fs.mkdirpSync("/test/file");
		}).should.throw();
		(function() {
			fs.readdirSync("/test/file");
		}).should.throw();
		fs.readdirSync("/test/").should.be.eql(["dir", "file"]);
	});
	it("should throw on readlink", function() {
		var fs = new VirtualFS();
		fs.mkdirpSync("/test/dir");
		(function() {
			fs.readlinkSync("/");
		}).should.throw();
		(function() {
			fs.readlinkSync("/link");
		}).should.throw();
		(function() {
			fs.readlinkSync("/test");
		}).should.throw();
		(function() {
			fs.readlinkSync("/test/dir");
		}).should.throw();
		(function() {
			fs.readlinkSync("/test/dir/link");
		}).should.throw();
	});
});
describe("async", function() {
	["stat", "readdir", "mkdirp", "rmdir", "unlink", "readlink"].forEach(function(methodName) {
		it("should call " + methodName + " callback in a new event cycle", function(done) {
			var fs = new VirtualFS();
			var isCalled = false;
			fs[methodName]('/test', function() {
				isCalled = true;
				done();
			});
			should(isCalled).be.eql(false);
		});
	});
	["mkdir", "readFile"].forEach(function(methodName) {
		it("should call " + methodName + " a callback in a new event cycle", function(done) {
			var fs = new VirtualFS();
			var isCalled = false;
			fs[methodName]('/test', {}, function() {
				isCalled = true;
				done();
			});
			should(isCalled).eql(false);
		});
	});
	it("should be able to use the async versions", function(done) {
		var fs = new VirtualFS();
		fs.mkdirp("/test/dir", function(err) {
			if(err) throw err;
			fs.writeFile("/test/dir/a", "Hello", function(err) {
				if(err) throw err;
				fs.writeFile("/test/dir/b", "World", "utf-8", function(err) {
					if(err) throw err;
					fs.readFile("/test/dir/a", "utf-8", function(err, content) {
						if(err) throw err;
						content.should.be.eql("Hello");
						fs.readFile("/test/dir/b", function(err, content) {
							if(err) throw err;
							content.should.be.eql(new Buffer("World"));
							fs.exists("/test/dir/b", function(exists) {
								exists.should.be.eql(true);
								done();
							});
						});
					});
				});
			});
		});
	});
	it("should return errors", function(done) {
		var fs = new VirtualFS();
		fs.readFile("/fail/file", function(err, content) {
			err.should.be.instanceof(Error);
			fs.writeFile("/fail/file", "", function(err) {
				err.should.be.instanceof(Error);
				done();
			});
		});
	});
});
describe("streams", function() {
	describe("writable streams", function() {
		it("should write files", function() {
			var fs = new VirtualFS();
			fs.createWriteStream("/file").end("Hello");
			fs.readFileSync("/file", "utf8").should.be.eql("Hello");
		});
		it("should zero files", function() {
			var fs = new VirtualFS();
			fs.createWriteStream("/file").end();
			fs.readFileSync("/file", "utf8").should.be.eql("");
		});
		it("should accept pipes", function(done) {
			// TODO: Any way to avoid the asyncness of this?
			var fs = new VirtualFS();
			bl(new Buffer("Hello"))
				.pipe(fs.createWriteStream("/file"))
				.once('finish', function() {
					fs.readFileSync("/file", "utf8").should.be.eql("Hello");
					done();
				});
		});
		it("should propagate errors", function(done) {
			var fs = new VirtualFS();
			var stream = fs.createWriteStream("/file/unknown");
			var err = false;
			stream.once('error', function() {
				err = true;
			}).once('finish', function() {
				err.should.eql(true);
				done();
			});
			stream.end();
		});
	});
	describe("readable streams", function() {
		it("should read files", function(done) {
			var fs = new VirtualFS();
			fs.writeFileSync("/file", "Hello");
			fs.createReadStream("/file").pipe(bl(function(err, data) {
				data.toString('utf8').should.be.eql("Hello");
				done();
			}));
		});
		it("should respect start/end", function(done) {
			var fs = new VirtualFS();
			fs.writeFileSync("/file", "Hello");
			fs.createReadStream("/file", {
				start: 1,
				end: 3
			}).pipe(bl(function(err, data) {
				data.toString('utf8').should.be.eql("el");
				done();
			}));
		});
		it("should propagate errors", function(done) {
			var fs = new VirtualFS();
			var stream = fs.createReadStream("file");
			var err = false;
			// Why does this dummy event need to be here? It looks like it
			// either has to be this or data before the stream will actually
			// do anything.
			stream.on('readable', function() { }).on('error', function() {
				err = true;
			}).on('end', function() {
				err.should.eql(true);
				done();
			});
			stream.read(0);
		});
	});
});
