import test from 'ava';
import bl from 'bl';
import { File, Directory, Symlink } from '../lib/INodes';
import Stat from '../lib/Stat';
import { VirtualFS } from '../lib/VirtualFS';

////////////////////
// various errors //
////////////////////

test('navigating invalid paths - sync', (t) => {
  const fs = new VirtualFS;
  fs.mkdirpSync('/test/a/b/c');
  fs.mkdirpSync('/test/a/bc');
  fs.mkdirpSync('/test/abc');
  t.throws(() => {
    fs.readdirSync('/test/abc/a/b/c');
  });
  t.throws(() => {
    fs.readdirSync('/abc');
  });
  t.throws(() => {
    fs.statSync('/abc');
  });
  t.throws(() => {
    fs.mkdirSync('/test/a/d/b/c');
  });
  t.throws(() => {
    fs.writeFileSync('/test/a/d/b/c', 'Hello');
  });
  t.throws(() => {
    fs.readFileSync('/test/a/d/b/c');
  });
  t.throws(() => {
    fs.readFileSync('/test/abcd');
  });
  t.throws(() => {
    fs.mkdirSync('/test/abcd/dir');
  });
  t.throws(() => {
    fs.unlinkSync('/test/abcd');
  });
  t.throws(() => {
    fs.unlinkSync('/test/abcd/file');
  });
  t.throws(() => {
    fs.statSync('/test/a/d/b/c');
  });
  t.throws(() => {
    fs.statSync('/test/abcd');
  });
});

test('various failure situations - sync', (t) => {
  const fs = new VirtualFS;
  fs.mkdirpSync('/test/dir');
  fs.mkdirpSync('/test/dir');
  fs.writeFileSync('/test/file', 'Hello');
  t.throws(() => {
    fs.writeFileSync("/test/dir", "Hello");
  });
  t.throws(() => {
    fs.writeFileSync('/', 'Hello');
  });
  t.throws(() => {
    fs.rmdirSync('/');
  });
  t.throws(() => {
    fs.unlinkSync('/');
  });
  t.throws(() => {
    fs.mkdirSync('/test/dir');
  });
  t.throws(() => {
    fs.mkdirSync('/test/file');
  });
  t.throws(() => {
    fs.mkdirpSync('/test/file');
  });
  t.throws(() => {
    fs.readdirSync('/test/file');
  });
  t.throws(() => {
    fs.readlinkSync('/test/dir');
  });
  t.throws(() => {
    fs.readlinkSync('/test/file');
  });
});

test.cb('asynchronous errors are passed to callbacks - async', (t) => {
  const fs = new VirtualFS;
  fs.readFile('/nonexistent/', (err, content) => {
    t.true(err instanceof Error);
    fs.writeFile('/fail/file', '', (err) => {
      t.true(err instanceof Error);
      fs.mkdir('/cannot/do/this', (err) => {
        t.true(err instanceof Error);
        fs.readlink('/nolink', (err) => {
          t.true(err instanceof Error);
          t.end();
        });
      });
    });
  });
});

///////////
// files //
///////////

test.cb('calls with mode are ignored, mode is always 777 - callback', (t) => {
  const fs = new VirtualFS;
  fs.mkdir('/test', 0o644, (err) => {
    fs.accessSync(
      '/test',
      (fs.constants.F_OK |
       fs.constants.R_OK |
       fs.constants.W_OK |
       fs.constants.X_OK)
    );
    fs.chmod('/test', 0o444, (err) => {
      fs.accessSync(
        '/test',
        (fs.constants.F_OK |
         fs.constants.R_OK |
         fs.constants.W_OK |
         fs.constants.X_OK)
      );
      t.end();
    });
  });
});

test('chown does nothing - sync', (t) => {
  const fs = new VirtualFS;
  fs.mkdirSync('/test');
  fs.chownSync('/test', 1000, 1000);
  const stat = fs.statSync('/test');
  t.is(stat.uid, 0);
  t.is(stat.gid, 0);
});

test('can make and remove files - sync', (t) => {
  const fs = new VirtualFS;
  fs.mkdirSync('/test');
  const buf = new Buffer('Hello World', 'utf8');
  fs.writeFileSync('/test/hello-world.txt', buf);
  t.deepEqual(fs.readFileSync('/test/hello-world.txt'), buf);
  t.is(fs.readFileSync('/test/hello-world.txt', 'utf8'), 'Hello World');
  t.is(fs.readFileSync('/test/hello-world.txt', { encoding: 'utf8' }), 'Hello World');
  fs.writeFileSync('/a', 'Test', 'utf-8');
  t.is(fs.readFileSync('/a', 'utf-8'), 'Test');
  const stat = fs.statSync('/a');
  t.is(stat.isFile(), true);
  t.is(stat.isDirectory(), false);
  fs.writeFileSync('/b', 'Test', { encoding: 'utf8' });
  t.is(fs.readFileSync('/b', 'utf-8'), 'Test');
  t.throws(() => {
    fs.readFileSync('/test/other-file');
  });
  t.throws(() => {
    fs.readFileSync('/test/other-file', 'utf8');
  });
});

/////////////////
// directories //
/////////////////

test('has an empty root directory at startup - sync', t => {
  const fs = new VirtualFS;
  t.deepEqual(fs.readdirSync('/'), []);
  const stat = fs.statSync('/');
  t.is(stat.isFile(), false);
  t.is(stat.isDirectory(), true);
  t.is(stat.isSymbolicLink(), false);
});

test.cb('has an empty root directory at startup - async', t => {
  const fs = new VirtualFS;
  fs.readdir('/', (err, list) => {
    t.deepEqual(list, []);
    fs.stat('/', (err, stat) => {
      t.is(stat.isFile(), false);
      t.is(stat.isDirectory(), true);
      t.is(stat.isSymbolicLink(), false);
      t.end();
    });
  });
});

test('is able to make directories - sync', t => {
  const fs = new VirtualFS;
  fs.mkdirSync('/first');
  fs.mkdirSync('/first//sub/');
  fs.mkdirpSync('/first/sub2');
  fs.mkdirSync('/backslash\\dir');
  fs.mkdirpSync('/');
  t.deepEqual(fs.readdirSync('/'), ['first', 'backslash\\dir']);
  t.deepEqual(fs.readdirSync('/first/'), ['sub', 'sub2']);
  fs.mkdirpSync('/a/depth/sub/dir');
  t.is(fs.existsSync('/a/depth/sub'), true);
  const stat = fs.statSync('/a/depth/sub');
  t.is(stat.isFile(), false);
  t.is(stat.isDirectory(), true);
});

test.cb('is able to make directories - async', t => {
  const fs = new VirtualFS;
  fs.mkdir('/first', (err) => {
    fs.mkdir('/first//sub/', (err) => {
      fs.mkdir('/first/sub2/', (err) => {
        fs.mkdir('/backslash\\dir', (err) => {
          fs.mkdirp('/', (err) => {
            fs.readdir('/', (err, list) => {
              t.deepEqual(list, ['first', 'backslash\\dir']);
              fs.readdir('/first/', (err, list) => {
                t.deepEqual(list, ['sub', 'sub2']);
                fs.mkdirp('/a/depth/sub/dir', (err) => {
                  fs.exists('/a/depth/sub', (exists) => {
                    t.is(exists, true);
                    fs.stat('/a/depth/sub', (err, stat) => {
                      t.is(stat.isFile(), false);
                      t.is(stat.isDirectory(), true);
                      t.end();
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

test('should not make the root directory - sync', t => {
  const fs = new VirtualFS;
  const error = t.throws(() => {
    fs.mkdirSync('/');
  });
  t.is(error.code, 'EEXIST');
});

test('should be able to navigate before root - sync', (t) => {
  const fs = new VirtualFS;
  const buf = Buffer.from('Hello World');
  fs.mkdirSync('/first');
  fs.writeFileSync('/hello-world.txt', buf);
  let stat;
  stat = fs.statSync('/first/../../../../first');
  t.is(stat.isFile(), false);
  t.is(stat.isDirectory(), true);
  stat = fs.statSync('/first/../../../../hello-world.txt');
  t.is(stat.isFile(), true);
  t.is(stat.isDirectory(), false);
});

test('should be able to remove directories - sync', (t) => {
  const fs = new VirtualFS;
  fs.mkdirSync("/first");
  fs.mkdirSync("/first//sub/");
  fs.mkdirpSync("/first/sub2");
  fs.mkdirSync("/backslash\\dir");
  fs.rmdirSync("/first/sub//");
  const firstlist = fs.readdirSync("//first");
  t.deepEqual(firstlist, ['sub2']);
  fs.rmdirSync("/first/sub2");
  fs.rmdirSync('/first');
  const exists = fs.existsSync('/first');
  t.is(exists, false);
  const errorAccess = t.throws(() => {
    fs.accessSync('/first');
  });
  t.is(errorAccess.code, 'ENOENT');
  const errorReadDir = t.throws(() => {
    fs.readdirSync('/first');
  });
  t.is(errorReadDir.code, 'ENOENT');
  const rootlist = fs.readdirSync('/');
  t.deepEqual(rootlist, ['backslash\\dir']);
});

test('creating temporary directories - sync', (t) => {
  const fs = new VirtualFS;
  const tempDir = fs.mkdtempSync('/dir');
  const buf = Buffer.from('abc');
  fs.writeFileSync(tempDir + '/test', buf);
  t.is(fs.readFileSync(tempDir + '/test', 'utf8'), buf.toString());
});

///////////////
// hardlinks //
///////////////

test('multiple hardlinks to the same file - sync', (t) => {
  const fs = new VirtualFS;
  fs.mkdirSync('/test');
  fs.writeFileSync('/test/a');
  fs.linkSync('/test/a', '/test/b');
  const inoA = fs.statSync('/test/a').ino;
  const inoB = fs.statSync('/test/b').ino;
  t.is(inoA, inoB);
  t.deepEqual(fs.readFileSync('/test/a'), fs.readFileSync('/test/b'));
});

test('should not create hardlinks to directories - sync', (t) => {
  const fs = new VirtualFS;
  fs.mkdirSync('/test');
  const error = t.throws(() => {
    fs.linkSync('/test', '/hardlinkttotest');
  });
  t.is(error.code, 'EPERM');
});

//////////////
// symlinks //
//////////////

test('resolves symlink loops 1 - sync', t => {
  const fs = new VirtualFS;
  fs.symlinkSync('/test', '/test');
  let error;
  error = t.throws(() => {
    fs.readFileSync('/test');
  });
  t.is(error.code, 'ELOOP');
});

test('resolves symlink loops 2 - sync', t => {
  const fs = new VirtualFS;
  fs.mkdir('/dirtolink');
  fs.symlinkSync('/dirtolink/test', '/test');
  fs.symlinkSync('/test', '/dirtolink/test');
  const error = t.throws(() => {
    fs.readFileSync('/test/non-existent');
  });
  t.is(error.code, 'ELOOP');
});

test('is able to add and traverse symlinks transitively - sync', (t) => {
  const fs = new VirtualFS;
  fs.mkdirSync('/test');
  const buf = Buffer.from('Hello World');
  fs.writeFileSync('/test/hello-world.txt', buf);
  fs.symlinkSync('/test', '/linktotestdir');
  t.is(fs.readlinkSync('/linktotestdir'), '/test');
  t.deepEqual(fs.readdirSync('/linktotestdir'), ['hello-world.txt']);
  fs.symlinkSync('/linktotestdir/hello-world.txt', '/linktofile');
  fs.symlinkSync('/linktofile', '/linktolink');
  t.is(fs.readFileSync('/linktofile', 'utf-8'), 'Hello World');
  t.is(fs.readFileSync('/linktolink', 'utf-8'), 'Hello World');
});

test('is able to traverse relative symlinks - sync', (t) => {
  const fs = new VirtualFS;
  fs.mkdirSync('/test');
  const buf = Buffer.from('Hello World');
  fs.writeFileSync('/a', buf);
  fs.symlinkSync('../a', '/test/linktoa');
  t.is(fs.readFileSync('/test/linktoa', 'utf-8'), 'Hello World');
});

test('unlink does not traverse symlinks - sync', (t) => {
  const fs = new VirtualFS;
  fs.mkdirSync('/test');
  const buf = Buffer.from('Hello World');
  fs.writeFileSync('/test/hello-world.txt', buf);
  fs.symlinkSync('/test', '/linktotestdir');
  fs.symlinkSync('/linktotestdir/hello-world.txt', '/linktofile');
  fs.unlinkSync('/linktofile');
  fs.unlinkSync('/linktotestdir');
  t.deepEqual(fs.readdirSync('/test'), ['hello-world.txt']);
});

test('realpath expands symlinks - sync', (t) => {
  const fs = new VirtualFS;
  fs.writeFileSync('/test', Buffer.from('Hello'));
  fs.symlinkSync('./test', '/linktotest');
  fs.mkdirSync('/dirwithlinks');
  fs.symlinkSync('../linktotest', '/dirwithlinks/linktolink');
  const realPath = fs.realpathSync('/dirwithlinks/linktolink');
  t.is(realPath, '/test');
});

/////////////
// streams //
/////////////

test.cb('readstream options start and end are both inclusive - async', (t) => {
  const fs = new VirtualFS;
  const str = 'Hello';
  fs.writeFileSync('/test', str);
  const readable = fs.createReadStream(
    '/test',
    {encoding: 'utf8', start: 0, end: str.length - 1}
  );
  readable.on('readable', () => {
    t.is(readable.read(), str);
    t.end();
  });
});

test.cb('writestream can create and truncate files - async', (t) => {
  const fs = new VirtualFS;
  const str = 'Hello';
  fs.createWriteStream('/file').end(str, () => {
    t.is(fs.readFileSync('/file', 'utf8'), str);
    fs.createWriteStream('/file').end(() => {
      t.is(fs.readFileSync('/file', 'utf-8'), '');
      t.end();
    });
  });
});

test.cb('writestream can be piped into - async', (t) => {
  const fs = new VirtualFS;
  const str = 'Hello';
  bl(new Buffer(str))
    .pipe(fs.createWriteStream('/file'))
    .once('finish', () => {
      t.is(fs.readFileSync('/file', 'utf-8'), str);
      t.end();
    });
});

test.cb('writestreams handle errors asynchronously - async', (t) => {
  const fs = new VirtualFS;
  let stream = fs.createWriteStream('/file/unknown');
  // note that it is possible to have the finish event occur before the error event
  stream.once('error', (e) => {
    t.true(e instanceof Error);
    t.is(e.code, 'ENOENT');
    t.end();
  });
  stream.end();
});

test.cb('readstreams handle errors asynchronously - async', (t) => {
  const fs = new VirtualFS;
  let stream = fs.createReadStream('/file');
  stream.on('error', (e) => {
    t.true(e instanceof Error);
    t.is(e.code, 'ENOENT');
    t.end();
  });
  stream.read(0);
});

test.cb('readstreams can compose with pipes - async', (t) => {
  const fs = new VirtualFS;
  const str = 'Hello';
  fs.writeFileSync('/file', str);
  fs.createReadStream('/file').pipe(bl((err, data) => {
    t.is(data.toString('utf8'), str);
    t.end();
  }));
});

test.cb('readstreams respect start and end options - async', (t) => {
  const fs = new VirtualFS;
  const str = 'Hello';
  fs.writeFileSync('/file', str);
  fs.createReadStream('/file', {
    start: 1,
    end: 3
  }).pipe(bl((err, data) => {
    t.is(data.toString('utf8'), str.slice(1, 4));
    t.end();
  }));
});

///////////////////////
// stat time changes //
///////////////////////

test.cb('truncate and ftruncate will change mtime and ctime - async', (t) => {
  const fs = new VirtualFS;
  const str = 'abcdef';
  fs.writeFileSync('/test', str);
  const stat = fs.statSync('/test');
  setTimeout(() => {
    fs.truncateSync('/test', str.length);
    const stat2 = fs.statSync('/test');
    t.true(stat.mtime < stat2.mtime && stat.ctime < stat2.ctime);
    setTimeout(() => {
      const fd = fs.openSync('/test', 'r+');
      fs.ftruncateSync(fd, str.length);
      const stat3 = fs.statSync('/test');
      t.true(stat2.mtime < stat3.mtime && stat2.ctime < stat3.ctime);
      setTimeout(() => {
        fs.truncateSync(fd, str.length);
        const stat4 = fs.statSync('/test');
        t.true(stat3.mtime < stat4.mtime && stat3.ctime < stat4.ctime);
        fs.closeSync(fd);
        t.end();
      }, 10);
    }, 10);
  }, 10);
});

//////////////////////////////////////
// directory file descriptors tests //
//////////////////////////////////////

test.cb('directory file descriptors capabilities - async', (t) => {
  const fs = new VirtualFS;
  fs.mkdirSync('/dir');
  const dirfd = fs.openSync('/dir', 'r');
  fs.fsyncSync(dirfd);
  fs.fdatasyncSync(dirfd);
  fs.fchmodSync(dirfd, 0o666);
  fs.fchownSync(dirfd, 0, 0);
  const date = new Date;
  setTimeout(() => {
    fs.futimesSync(dirfd, date, date);
    const stats = fs.fstatSync(dirfd);
    t.true(stats instanceof Stat);
    t.deepEqual(stats.atime, date);
    t.deepEqual(stats.mtime, date);
    fs.closeSync(dirfd);
    t.end();
  }, 100);
});

test('directory file descriptor errors - sync', (t) => {
  const fs = new VirtualFS;
  fs.mkdirSync('/dir');
  // opening it without fs.constants.O_RDONLY would result in EISDIR
  const dirfd = fs.openSync('/dir', fs.constants.O_RDONLY | fs.constants.O_DIRECTORY);
  let error;
  const buf = Buffer.alloc(10);
  error = t.throws(() => {
    fs.ftruncateSync(dirfd);
  });
  t.is(error.code, 'EINVAL');
  error = t.throws(() => {
    fs.readSync(dirfd, buf, 0, 10, null);
  });
  t.is(error.code, 'EISDIR');
  error = t.throws(() => {
    fs.writeSync(dirfd, buf);
  });
  t.is(error.code, 'EBADF');
  error = t.throws(() => {
    fs.readFileSync(dirfd);
  });
  t.is(error.code, 'EISDIR');
  error = t.throws(() => {
    fs.writeFileSync(dirfd, 'test');
  });
  t.is(error.code, 'EBADF');
  fs.closeSync(dirfd);
});

///////////////////////////////////////
// file descriptor positioning tests //
///////////////////////////////////////

test('appendFileSync moves with the fd position - sync', (t) => {
  const fs = new VirtualFS;
  const fd = fs.openSync('/fdtest', 'w+');
  fs.appendFileSync(fd, 'a');
  fs.appendFileSync(fd, 'a');
  fs.appendFileSync(fd, 'a');
  t.is(fs.readFileSync('/fdtest', 'utf8'), 'aaa');
  fs.closeSync(fd);
});

test('ftruncateSync truncates the fd position - sync', (t) => {
  const fs = new VirtualFS;
  let fd;
  fd = fs.openSync('/fdtest', 'w+');
  fs.writeSync(fd, 'abcdef');
  fs.ftruncateSync(fd, 3);
  fs.writeSync(fd, 'ghi');
  t.deepEqual(fs.readFileSync('/fdtest', 'utf8'), 'abcghi');
  fs.closeSync(fd);
  fs.writeFileSync('/fdtest', 'abcdef');
  fd = fs.openSync('/fdtest', 'r+');
  const buf = Buffer.allocUnsafe(3);
  fs.readSync(fd, buf, 0, buf.length);
  fs.ftruncateSync(fd, 4);
  fs.readSync(fd, buf, 0, buf.length);
  t.deepEqual(buf, Buffer.from('dbc'));
  fs.closeSync(fd);
});

test('readSync moves with the fd position - sync', (t) => {
  const fs = new VirtualFS;
  const str = 'abc';
  const buf = Buffer.from(str).fill('\0');
  fs.writeFileSync('/fdtest', str);
  const fd = fs.openSync('/fdtest', 'r+');
  fs.readSync(fd, buf, 0, 1, null);
  fs.readSync(fd, buf, 1, 1, null);
  fs.readSync(fd, buf, 2, 1, null);
  t.deepEqual(buf, Buffer.from(str));
  fs.closeSync(fd);
});

test('writeSync moves with the fd position - sync', (t) => {
  const fs = new VirtualFS;
  const fd = fs.openSync('/fdtest', 'w+');
  fs.writeSync(fd, 'a');
  fs.writeSync(fd, 'a');
  fs.writeSync(fd, 'a');
  t.is(fs.readFileSync('/fdtest', 'utf8'), 'aaa');
  fs.closeSync(fd);
});

test('readSync does not change fd position according to position parameter - sync', (t) => {
  const fs = new VirtualFS;
  let buf = Buffer.alloc(3);
  let fd;
  let bytesRead;
  // reading from position 0 doesn't move the fd from the end
  fd = fs.openSync('/fdtest', 'w+');
  fs.writeSync(fd, 'abcdef');
  buf = Buffer.alloc(3);
  bytesRead = fs.readSync(fd, buf, 0, buf.length);
  t.is(bytesRead, 0);
  bytesRead = fs.readSync(fd, buf, 0, buf.length, 0);
  t.is(bytesRead, 3);
  t.deepEqual(buf, Buffer.from('abc'));
  fs.writeSync(fd, 'ghi');
  t.deepEqual(fs.readFileSync('/fdtest', 'utf8'), 'abcdefghi');
  fs.closeSync(fd);
  // reading with position null does move the fd
  fs.writeFileSync('/fdtest', 'abcdef');
  fd = fs.openSync('/fdtest', 'r+');
  bytesRead = fs.readSync(fd, buf, 0, buf.length);
  t.is(bytesRead, 3);
  fs.writeSync(fd, 'ghi');
  t.deepEqual(fs.readFileSync('/fdtest', 'utf8'), 'abcghi');
  fs.closeSync(fd);
  // reading with position 0 doesn't move the fd from the start
  fs.writeFileSync('/fdtest', 'abcdef');
  fd = fs.openSync('/fdtest', 'r+');
  buf = Buffer.alloc(3);
  bytesRead = fs.readSync(fd, buf, 0, buf.length, 0);
  t.is(bytesRead, 3);
  fs.writeSync(fd, 'ghi');
  t.deepEqual(fs.readFileSync('/fdtest', 'utf8'), 'ghidef');
  fs.closeSync(fd);
  // reading with position 3 doesn't move the fd from the start
  fs.writeFileSync('/fdtest', 'abcdef');
  fd = fs.openSync('/fdtest', 'r+');
  buf = Buffer.alloc(3);
  bytesRead = fs.readSync(fd, buf, 0, buf.length, 3);
  t.is(bytesRead, 3);
  fs.writeSync(fd, 'ghi');
  t.deepEqual(fs.readFileSync('/fdtest', 'utf8'), 'ghidef');
  fs.closeSync(fd);
});

test('writeSync does not change fd position according to position parameter - sync', (t) => {
  const fs = new VirtualFS;
  const buf = Buffer.alloc(3);
  const fd = fs.openSync('./testy', 'w+');
  fs.writeSync(fd, 'abcdef');
  fs.writeSync(fd, 'ghi', 0);
  fs.writeSync(fd, 'jkl');
  t.deepEqual(fs.readFileSync('./testy', 'utf8'), 'ghidefjkl');
  fs.closeSync(fd);
});

test('readFileSync moves with fd position - sync', (t) => {
  const fs = new VirtualFS;
  let fd;
  fd = fs.openSync('/fdtest', 'w+');
  fs.writeSync(fd, 'starting');
  t.is(fs.readFileSync(fd, 'utf-8'), '');
  fs.closeSync(fd);
  fd = fs.openSync('/fdtest', 'r+');
  t.is(fs.readFileSync(fd, 'utf-8'), 'starting');
  fs.writeSync(fd, 'ending');
  t.is(fs.readFileSync('/fdtest', 'utf-8'), 'startingending');
  fs.closeSync(fd);
});

test('writeFileSync writes from the beginning, and does not move the fd position - sync', (t) => {
  const fs = new VirtualFS;
  const fd = fs.openSync('/fdtest', 'w+');
  fs.writeSync(fd, 'a');
  fs.writeSync(fd, 'a');
  fs.writeFileSync(fd, 'b');
  fs.writeSync(fd, 'c');
  t.is(fs.readFileSync('/fdtest', 'utf8'), 'bac');
  fs.closeSync(fd);
});

test('O_APPEND makes sure that writes always set their fd position to the end - sync', (t) => {
  const fs = new VirtualFS;
  fs.writeFileSync('/fdtest', 'abc');
  let buf;
  let fd;
  let bytesRead;
  buf = Buffer.alloc(3);
  // there's only 1 fd position both writes and reads
  fd = fs.openSync('/fdtest', 'a+');
  fs.writeSync(fd, 'def');
  bytesRead = fs.readSync(fd, buf, 0, buf.length);
  t.is(bytesRead, 0);
  fs.writeSync(fd, 'ghi');
  t.deepEqual(fs.readFileSync('/fdtest', 'utf8'), 'abcdefghi');
  fs.closeSync(fd);
  // even if read moves to to position 3, write will jump the position to the end
  fs.writeFileSync('/fdtest', 'abcdef');
  fd = fs.openSync('/fdtest', 'a+');
  buf = Buffer.alloc(3);
  bytesRead = fs.readSync(fd, buf, 0, buf.length);
  t.is(bytesRead, 3);
  t.deepEqual(buf, Buffer.from('abc'));
  fs.writeSync(fd, 'ghi');
  t.deepEqual(fs.readFileSync('/fdtest', 'utf8'), 'abcdefghi');
  bytesRead = fs.readSync(fd, buf, 0, buf.length);
  t.is(bytesRead, 0);
  fs.closeSync(fd);
});

//////////////////////////////////////////////////////////////////////////
// function calling styles (involving intermediate optional parameters) //
//////////////////////////////////////////////////////////////////////////

test('openSync calling styles work - sync', (t) => {
  const fs = new VirtualFS;
  t.notThrows(() => {
    let fd;
    fd = fs.openSync('/test', 'w+');
    fs.closeSync(fd);
    fd = fs.openSync('/test2', 'w+', 0o666);
    fs.closeSync(fd);
  });
});

test.cb('open calling styles work - async', (t) => {
  const fs = new VirtualFS;
  fs.open('/test', 'w+', (err, fd) => {
    t.ifError(err);
    fs.closeSync(fd);
    fs.open('/test2', 'w+', 0o666, (err, fd) => {
      t.ifError(err);
      fs.close(fd, (err) => {
        t.ifError(err);
        t.end();
      });
    });
  });
});

test('readSync calling styles work - sync', (t) => {
  // fs.readSync has undocumented optional parameters
  const fs = new VirtualFS;
  const str = 'Hello World';
  const buf = Buffer.from(str).fill('\0');
  fs.writeFileSync('/test', str);
  const fd = fs.openSync('/test', 'r+');
  let bytesRead;
  bytesRead = fs.readSync(fd, buf);
  t.is(bytesRead, 0);
  bytesRead = fs.readSync(fd, buf, 0);
  t.is(bytesRead, 0);
  bytesRead = fs.readSync(fd, buf, 0, 0);
  t.is(bytesRead, 0);
  bytesRead = fs.readSync(fd, buf, 0, 1);
  t.is(bytesRead, 1);
  bytesRead = fs.readSync(fd, buf, 0, 0, null);
  t.is(bytesRead, 0);
  bytesRead = fs.readSync(fd, buf, 0, 1, null);
  t.is(bytesRead, 1);
  fs.closeSync(fd);
});

test.cb('read calling styles work - async', (t) => {
  // fs.read does not have intermediate optional parameters
  const fs = new VirtualFS;
  const str = 'Hello World';
  const buf = Buffer.from(str).fill('\0');
  fs.writeFileSync('/test', str);
  const fd = fs.openSync('/test', 'r+');
  fs.read(fd, buf, 0, buf.length, null, (err, bytesRead, buffer) => {
    t.ifError(err);
    t.deepEqual(buffer, Buffer.from(str));
    t.is(bytesRead, Buffer.from(str).length);
    fs.closeSync(fd);
    t.end();
  });
});

test('writeSync calling styles work - sync', (t) => {
  const fs = new VirtualFS;
  const fd = fs.openSync('/test', 'w');
  const str = 'Hello World';
  const buf = Buffer.from(str);
  let bytesWritten;
  bytesWritten = fs.writeSync(fd, buf);
  t.is(bytesWritten, 0);
  bytesWritten = fs.writeSync(fd, buf, 0);
  t.is(bytesWritten, 0);
  fs.writeSync(fd, buf, 0, buf.length);
  fs.writeSync(fd, buf, 0, buf.length, null);
  fs.writeSync(fd, str);
  fs.writeSync(fd, str, null);
  fs.writeSync(fd, str, null, 'utf-8');
  fs.closeSync(fd);
  t.is(fs.readFileSync('/test', 'utf-8'), str.repeat(5));
});

test.cb('write calling styles work - async', (t) => {
  // fs.write has intermediate optional parameters
  const fs = new VirtualFS;
  const fd = fs.openSync('/test', 'w+');
  const str = 'Hello World';
  const buf = Buffer.from(str);
  fs.write(fd, buf, (err, bytesWritten, buffer) => {
    // this callback isn't called when using node's filesystem
    // but it's backwards compatible with node behaviour
    t.ifError(err);
    t.deepEqual(buffer, buf);
    t.is(bytesWritten, 0);
    fs.write(fd, buf, 0, (err, bytesWritten, buffer) => {
      // this callback isn't called when using node's filesystem
      // but it's backwards compatible with node behaviour
      t.ifError(err);
      t.deepEqual(buffer, buf);
      t.is(bytesWritten, 0);
      fs.write(fd, buf, 0, buf.length, (err, bytesWritten, buffer) => {
        t.ifError(err);
        t.deepEqual(buffer, buf);
        t.is(bytesWritten, buf.length);
        fs.write(fd, buf, 0, buf.length, 0, (err, bytesWritten, buffer) => {
          t.ifError(err);
          t.deepEqual(buffer, buf);
          t.is(bytesWritten, buf.length);
          fs.write(fd, str, (err, bytesWritten, string) => {
            t.ifError(err);
            t.is(string, str);
            t.is(bytesWritten, str.length);
            fs.write(fd, str, 0, (err, bytesWritten, string) => {
              t.ifError(err);
              t.is(string, str);
              t.is(bytesWritten, str.length);
              fs.write(fd, str, 0, 'utf-8', (err, bytesWritten, string) => {
                t.ifError(err);
                t.is(string, str);
                t.is(bytesWritten, str.length);
                fs.closeSync(fd);
                t.end();
              });
            });
          });
        });
      });
    });
  });
});

test('readFileSync calling styles work - sync', (t) => {
  const fs = new VirtualFS;
  const str = 'Hello World';
  const buf = Buffer.from(str);
  fs.writeFileSync('/test', buf);
  const fd = fs.openSync('/test', 'r+');
  let contents;
  contents = fs.readFileSync('/test');
  t.deepEqual(contents, buf);
  contents = fs.readFileSync('/test', { encoding: 'utf8', flag: 'r' });
  t.is(contents, str);
  contents = fs.readFileSync(fd);
  t.deepEqual(contents, buf);
  contents = fs.readFileSync(fd, { encoding: 'utf8', flag: 'r' });
  t.is(contents, '');
  fs.closeSync(fd);
});

test.cb('readFile calling styles work - async', (t) => {
  const fs = new VirtualFS;
  const str = 'Hello World';
  const buf = Buffer.from(str);
  fs.writeFileSync('/test', buf);
  const fd = fs.openSync('/test', 'r+');
  fs.readFile('/test', (err, data) => {
    t.ifError(err);
    t.deepEqual(data, buf);
    fs.readFile('/test', { encoding: 'utf8', flag: 'r' }, (err, data) => {
      t.ifError(err);
      t.is(data, str);
      fs.readFile(fd, (err, data) => {
        t.ifError(err);
        t.deepEqual(data, buf);
        fs.readFile(fd, { encoding: 'utf8', flag: 'r' }, (err, data) => {
          t.ifError(err);
          t.is(data, '');
          t.end();
        });
      });
    });
  });
});

test('writeFileSync calling styles work - sync', (t) => {
  const fs = new VirtualFS;
  const fd = fs.openSync('/test', 'w+');
  const str = 'Hello World';
  const buf = Buffer.from(str);
  fs.writeFileSync('/test', str);
  t.deepEqual(fs.readFileSync('/test'), buf);
  fs.writeFileSync('/test', str, { encoding: 'utf8', mode: 0o666, flag: 'w' });
  t.deepEqual(fs.readFileSync('/test'), buf);
  fs.writeFileSync('/test', buf);
  t.deepEqual(fs.readFileSync('/test'), buf);
  fs.writeFileSync(fd, str);
  t.deepEqual(fs.readFileSync('/test'), buf);
  fs.writeFileSync(fd, str, { encoding: 'utf8', mode: 0o666, flag: 'w' });
  t.deepEqual(fs.readFileSync('/test'), buf);
  fs.writeFileSync(fd, buf);
  t.deepEqual(fs.readFileSync('/test'), buf);
  fs.closeSync(fd);
});

test.cb('writeFile calling styles work - async', (t) => {
  const fs = new VirtualFS;
  const fd = fs.openSync('/test', 'w+');
  const str = 'Hello World';
  const buf = Buffer.from(str);
  fs.writeFile('/test', str, (err) => {
    t.ifError(err);
    fs.writeFile('/test', str, { encoding: 'utf8', mode: 0o666, flag: 'w' }, (err) => {
      t.ifError(err);
      fs.writeFile('/test', buf, (err) => {
        t.ifError(err);
        fs.writeFile(fd, str, (err) => {
          t.ifError(err);
          fs.writeFile(fd, str, { encoding: 'utf8', mode: 0o666, flag: 'w' }, (err) => {
            t.ifError(err);
            fs.writeFile(fd, buf, (err) => {
              t.ifError(err);
              fs.closeSync(fd);
              t.end();
            });
          });
        });
      });
    });
  });
});
