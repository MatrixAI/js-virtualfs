import { URL } from 'url';
import test from 'ava';
import bl from 'bl';
import { File, Directory, Symlink } from '../lib/INodes.js';
import {
  DEFAULT_ROOT_UID,
  DEFAULT_ROOT_GID,
  DEFAULT_FILE_PERM,
  DEFAULT_DIRECTORY_PERM,
  DEFAULT_SYMLINK_PERM
} from '../lib/permissions.js';
import Stat from '../lib/Stat.js';
import VirtualFS from '../lib/VirtualFS.js';
import vfs from '../lib/VirtualFSSingle.js';

////////////////////
// various errors //
////////////////////

test('navigating invalid paths - sync', t => {
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

test('various failure situations - sync', t => {
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

test.cb('asynchronous errors are passed to callbacks - async', t => {
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

///////////////
// stat type //
///////////////

test('file stat makes sense - sync', t => {
  const fs = new VirtualFS;
  fs.writeFileSync('/test', 'test data');
  const stat = fs.statSync('/test');
  t.true(stat.isFile());
  t.false(stat.isDirectory());
  t.false(stat.isBlockDevice());
  t.false(stat.isCharacterDevice());
  t.false(stat.isSocket());
  t.false(stat.isSymbolicLink());
  t.false(stat.isFIFO());
});

test('dir stat makes sense - sync', t => {
  const fs = new VirtualFS;
  fs.mkdirSync('/dir');
  const stat = fs.statSync('/dir');
  t.false(stat.isFile());
  t.true(stat.isDirectory());
  t.false(stat.isBlockDevice());
  t.false(stat.isCharacterDevice());
  t.false(stat.isSocket());
  t.false(stat.isSymbolicLink());
  t.false(stat.isFIFO());
});

test('symlink stat makes sense - sync', t => {
  const fs = new VirtualFS;
  fs.writeFileSync('/a', 'data');
  fs.symlinkSync('/a', '/link-to-a');
  const stat = fs.lstatSync('/link-to-a');
  t.false(stat.isFile());
  t.false(stat.isDirectory());
  t.false(stat.isBlockDevice());
  t.false(stat.isCharacterDevice());
  t.false(stat.isSocket());
  t.true(stat.isSymbolicLink());
  t.false(stat.isFIFO());
});

///////////
// files //
///////////

test('can make and remove files - sync', t => {
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
  t.true(stat.isFile());
  t.false(stat.isDirectory());
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
  t.true(stat.isDirectory());
  t.false(stat.isSymbolicLink());
});

test.cb('has an empty root directory at startup - async', t => {
  const fs = new VirtualFS;
  fs.readdir('/', (err, list) => {
    t.deepEqual(list, []);
    fs.stat('/', (err, stat) => {
      t.false(stat.isFile());
      t.true(stat.isDirectory());
      t.false(stat.isSymbolicLink());
      t.end();
    });
  });
});

test('is able to make directories - sync', t => {
  const fs = new VirtualFS;
  fs.mkdirSync('/first');
  fs.mkdirSync('/first//sub/');
  fs.mkdirSync('/first/sub/subsub');
  fs.mkdirpSync('/first/sub2');
  fs.mkdirSync('/backslash\\dir');
  fs.mkdirpSync('/');
  t.deepEqual(fs.readdirSync('/'), ['first', 'backslash\\dir']);
  t.deepEqual(fs.readdirSync('/first/'), ['sub', 'sub2']);
  fs.mkdirpSync('/a/depth/sub/dir');
  t.is(fs.existsSync('/a/depth/sub'), true);
  const stat = fs.statSync('/a/depth/sub');
  t.false(stat.isFile());
  t.true(stat.isDirectory());
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
                      t.false(stat.isFile());
                      t.true(stat.isDirectory());
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

test('should be able to navigate before root - sync', t => {
  const fs = new VirtualFS;
  const buf = Buffer.from('Hello World');
  fs.mkdirSync('/first');
  fs.writeFileSync('/hello-world.txt', buf);
  let stat;
  stat = fs.statSync('/first/../../../../first');
  t.false(stat.isFile());
  t.true(stat.isDirectory());
  stat = fs.statSync('/first/../../../../hello-world.txt');
  t.true(stat.isFile());
  t.false(stat.isDirectory());
});

test('should be able to remove directories - sync', t => {
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

test('rmdir does not traverse the last symlink', t => {
  const fs = new VirtualFS;
  fs.mkdirSync('/directory');
  fs.symlinkSync('/directory', '/linktodirectory');
  const error = t.throws(() => {
    fs.rmdirSync('/linktodirectory');
  });
  t.is(error.code, 'ENOTDIR');
});

test('creating temporary directories - sync', t => {
  const fs = new VirtualFS;
  const tempDir = fs.mkdtempSync('/dir');
  const buf = Buffer.from('abc');
  fs.writeFileSync(tempDir + '/test', buf);
  t.is(fs.readFileSync(tempDir + '/test', 'utf8'), buf.toString());
});

test('trailing slash refers to the directory instead of a file - sync', t => {
  const fs = new VirtualFS;
  fs.writeFileSync('/abc');
  let error;
  error = t.throws(() => {
    fs.accessSync('/abc/');
  });
  t.is(error.code, 'ENOTDIR');
  error = t.throws(() => {
    fs.accessSync('/abc/.');
  });
  t.is(error.code, 'ENOTDIR');
  error = t.throws(() => {
    fs.mkdirSync('/abc/.');
  });
  t.is(error.code, 'ENOTDIR');
  error = t.throws(() => {
    fs.mkdirSync('/abc/');
  });
  t.is(error.code, 'EEXIST');
});

test('trailing slash works for non-existent directories when intending to create them - sync', t => {
  const fs = new VirtualFS;
  fs.mkdirSync('/abc/');
  const stat = fs.statSync('/abc/');
  t.true(stat.isDirectory());
});

test('trailing `/.` for mkdirSync should result in errors', t => {
  const fs = new VirtualFS;
  let error;
  error = t.throws(() => {
    fs.mkdirSync('/abc/.');
  });
  t.is(error.code, 'ENOENT');
  fs.mkdirSync('/abc');
  error = t.throws(() => {
    fs.mkdirSync('/abc/.');
  });
  t.is(error.code, 'EEXIST');
});

test('trailing `/.` for mkdirpSync should not result in any errors', t => {
  const fs = new VirtualFS;
  fs.mkdirpSync('/abc/.');
  const stat = fs.statSync('/abc');
  t.true(stat.isDirectory());
});

///////////////
// hardlinks //
///////////////

test('multiple hardlinks to the same file - sync', t => {
  const fs = new VirtualFS;
  fs.mkdirSync('/test');
  fs.writeFileSync('/test/a');
  fs.linkSync('/test/a', '/test/b');
  const inoA = fs.statSync('/test/a').ino;
  const inoB = fs.statSync('/test/b').ino;
  t.is(inoA, inoB);
  t.deepEqual(fs.readFileSync('/test/a'), fs.readFileSync('/test/b'));
});

test('should not create hardlinks to directories - sync', t => {
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

test('symlink paths can contain multiple slashes', t => {
  const fs = new VirtualFS;
  fs.mkdirSync('/dir');
  fs.writeFileSync('/dir/test', 'hello');
  fs.symlinkSync('////dir////test', '/linktodirtest');
  t.deepEqual(fs.readFileSync('/dir/test'), fs.readFileSync('/linktodirtest'));
});

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
  fs.mkdirSync('/dirtolink');
  fs.symlinkSync('/dirtolink/test', '/test');
  fs.symlinkSync('/test', '/dirtolink/test');
  const error = t.throws(() => {
    fs.readFileSync('/test/non-existent');
  });
  t.is(error.code, 'ELOOP');
});

test('is able to add and traverse symlinks transitively - sync', t => {
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

test('is able to traverse relative symlinks - sync', t => {
  const fs = new VirtualFS;
  fs.mkdirSync('/test');
  const buf = Buffer.from('Hello World');
  fs.writeFileSync('/a', buf);
  fs.symlinkSync('../a', '/test/linktoa');
  t.is(fs.readFileSync('/test/linktoa', 'utf-8'), 'Hello World');
});

test('unlink does not traverse symlinks - sync', t => {
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

test('realpath expands symlinks - sync', t => {
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

test.cb('readstream options start and end are both inclusive - async', t => {
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

test.cb('readstreams respect start and end options - async', t => {
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

test.cb('readstream respects the start option - async', t => {
  const fs = new VirtualFS;
  const str = 'Hello';
  fs.writeFileSync('file', str);
  const offset = 1;
  const readable = fs.createReadStream('file', {encoding: 'utf8', start: offset});
  readable.on('readable', () => {
    t.is(readable.read(), str.slice(offset));
    t.end();
  });
});

test.cb('readstream end option is ignored without the start option - async', t => {
  const fs = new VirtualFS;
  const str = 'Hello';
  fs.writeFileSync('file', str);
  const readable = fs.createReadStream('file', {encoding: 'utf8', end: 1});
  readable.on('readable', () => {
    t.is(readable.read(), str);
    t.end();
  });
});

test.cb('readstream can use a file descriptor - async', t => {
  const fs = new VirtualFS;
  const str = 'Hello';
  fs.writeFileSync('file', str);
  const fd = fs.openSync('file', 'r');
  const offset = 1;
  fs.lseekSync(fd, offset);
  const readable = fs.createReadStream('', {encoding: 'utf8', fd: fd});
  readable.on('readable', () => {
    t.is(readable.read(), str.slice(offset));
    t.end();
  });
});

test.cb('readstream with start option overrides the file descriptor position - async', t => {
  const fs = new VirtualFS;
  const str = 'Hello';
  fs.writeFileSync('file', str);
  const fd = fs.openSync('file', 'r');
  const offset = 1;
  const readable = fs.createReadStream('', {encoding: 'utf8', fd: fd, start: offset});
  readable.on('readable', () => {
    t.is(readable.read(), str.slice(offset));
    const buf = Buffer.allocUnsafe(1);
    fs.readSync(fd, buf, 0, buf.length);
    t.is(buf.toString('utf8'), str.slice(0, buf.length));
    t.end();
  });
});

test.cb('readstreams handle errors asynchronously - async', t => {
  const fs = new VirtualFS;
  let stream = fs.createReadStream('/file');
  stream.on('error', (e) => {
    t.true(e instanceof Error);
    t.is(e.code, 'ENOENT');
    t.end();
  });
  stream.read(0);
});

test.cb('readstreams can compose with pipes - async', t => {
  const fs = new VirtualFS;
  const str = 'Hello';
  fs.writeFileSync('/file', str);
  fs.createReadStream('/file').pipe(bl((err, data) => {
    t.is(data.toString('utf8'), str);
    t.end();
  }));
});

test.cb('writestream can create and truncate files - async', t => {
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

test.cb('writestream can be piped into - async', t => {
  const fs = new VirtualFS;
  const str = 'Hello';
  bl(new Buffer(str))
    .pipe(fs.createWriteStream('/file'))
    .once('finish', () => {
      t.is(fs.readFileSync('/file', 'utf-8'), str);
      t.end();
    });
});

test.cb('writestreams handle errors asynchronously - async', t => {
  const fs = new VirtualFS;
  const writable = fs.createWriteStream('/file/unknown');
  // note that it is possible to have the finish event occur before the error event
  writable.once('error', (e) => {
    t.true(e instanceof Error);
    t.is(e.code, 'ENOENT');
    t.end();
  });
  writable.end();
});

test.cb('writestreams allow ignoring of the drain event, temporarily ignoring resource usage control - async', t => {
  const fs = new VirtualFS;
  const waterMark = 10;
  const writable = fs.createWriteStream('file', {highWaterMark: waterMark});
  const buf = Buffer.allocUnsafe(waterMark).fill(97);
  const times = 4;
  for (let i = 0; i < 4; ++i) {
    t.false(writable.write(buf));
  }
  writable.end(() => {
    t.is(fs.readFileSync('file', 'utf8'), buf.toString().repeat(times));
    t.end();
  });
});

test.cb('writestreams can use the drain event to manage resource control - async', t => {
  const fs = new VirtualFS;
  const waterMark = 10;
  const writable = fs.createWriteStream('file', {highWaterMark: waterMark});
  const buf = Buffer.allocUnsafe(waterMark).fill(97);
  let times = 10;
  const timesOrig  = times;
  const writing = () => {
    let status;
    do {
      status = writable.write(buf);
      times -= 1;
      if (times === 0) {
        writable.end(() => {
          t.is(
            fs.readFileSync('file', 'utf8'),
            buf.toString().repeat(timesOrig)
          );
          t.end();
        });
      }
    } while (times > 0 && status);
    if (times > 0) {
      writable.once('drain', writing);
    }
  };
  writing();
});

///////////////////////
// stat time changes //
///////////////////////

test.cb('truncate and ftruncate will change mtime and ctime - async', t => {
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

test.cb('fallocate will only change ctime - async', t => {
  const fs = new VirtualFS;
  const fd = fs.openSync('allocate', 'w');
  fs.writeSync(fd, 'abcdef');
  const stat = fs.statSync('allocate');
  setTimeout(() => {
    const offset = 0;
    const length = 100;
    fs.fallocate(fd, offset, length, (e) => {
      t.ifError(e);
      const stat2 = fs.statSync('allocate');
      t.is(stat2.size, offset + length);
      t.true(stat2.ctime > stat.ctime);
      t.true(stat2.mtime === stat.mtime);
      t.true(stat2.atime === stat.atime);
      fs.closeSync(fd);
      t.end();
    });
  }, 10);
});

//////////////////////////////////////
// directory file descriptors tests //
//////////////////////////////////////

test.cb('directory file descriptors capabilities - async', t => {
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

test('directory file descriptor errors - sync', t => {
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

test('directory file descriptor\'s inode nlink becomes 0 after deletion of the directory', t => {
  const fs = new VirtualFS;
  fs.mkdirSync('/dir');
  const fd = fs.openSync('/dir', 'r');
  fs.rmdirSync('/dir');
  const stat = fs.fstatSync(fd);
  t.is(stat.nlink, 1);
  fs.closeSync(fd);
});

//////////////////////
// file descriptors //
//////////////////////

test('appendFileSync moves with the fd position - sync', t => {
  const fs = new VirtualFS;
  const fd = fs.openSync('/fdtest', 'w+');
  fs.appendFileSync(fd, 'a');
  fs.appendFileSync(fd, 'a');
  fs.appendFileSync(fd, 'a');
  t.is(fs.readFileSync('/fdtest', 'utf8'), 'aaa');
  fs.closeSync(fd);
});

test('ftruncateSync truncates the fd position - sync', t => {
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

test('readSync moves with the fd position - sync', t => {
  const fs = new VirtualFS;
  const str = 'abc';
  const buf = Buffer.from(str).fill(0);
  fs.writeFileSync('/fdtest', str);
  const fd = fs.openSync('/fdtest', 'r+');
  fs.readSync(fd, buf, 0, 1, null);
  fs.readSync(fd, buf, 1, 1, null);
  fs.readSync(fd, buf, 2, 1, null);
  t.deepEqual(buf, Buffer.from(str));
  fs.closeSync(fd);
});

test('writeSync moves with the fd position - sync', t => {
  const fs = new VirtualFS;
  const fd = fs.openSync('/fdtest', 'w+');
  fs.writeSync(fd, 'a');
  fs.writeSync(fd, 'a');
  fs.writeSync(fd, 'a');
  t.is(fs.readFileSync('/fdtest', 'utf8'), 'aaa');
  fs.closeSync(fd);
});

test('readSync does not change fd position according to position parameter - sync', t => {
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

test('writeSync does not change fd position according to position parameter - sync', t => {
  const fs = new VirtualFS;
  const buf = Buffer.alloc(3);
  const fd = fs.openSync('./testy', 'w+');
  fs.writeSync(fd, 'abcdef');
  fs.writeSync(fd, 'ghi', 0);
  fs.writeSync(fd, 'jkl');
  t.deepEqual(fs.readFileSync('./testy', 'utf8'), 'ghidefjkl');
  fs.closeSync(fd);
});

test('readFileSync moves with fd position - sync', t => {
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

test('writeFileSync writes from the beginning, and does not move the fd position - sync', t => {
  const fs = new VirtualFS;
  const fd = fs.openSync('/fdtest', 'w+');
  fs.writeSync(fd, 'a');
  fs.writeSync(fd, 'a');
  fs.writeFileSync(fd, 'b');
  fs.writeSync(fd, 'c');
  t.is(fs.readFileSync('/fdtest', 'utf8'), 'bac');
  fs.closeSync(fd);
});

test('O_APPEND makes sure that writes always set their fd position to the end - sync', t => {
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

test('can seek and overwrite parts of a file - sync', t => {
  const fs = new VirtualFS;
  const fd = fs.openSync('/fdtest', 'w+');
  fs.writeSync(fd, 'abc');
  fs.lseekSync(fd, -1, fs.constants.SEEK_CUR);
  fs.writeSync(fd, 'd');
  fs.closeSync(fd);
  const str = fs.readFileSync('/fdtest', 'utf8');
  t.is(str, 'abd');
});

test('can seek beyond the file length and create a zeroed "sparse" file - sync', t => {
  const fs = new VirtualFS;
  fs.writeFileSync('/fdtest', Buffer.from([0x61, 0x62, 0x63]));
  const fd = fs.openSync('/fdtest', 'r+');
  fs.lseekSync(fd, 1, fs.constants.SEEK_END);
  fs.writeSync(fd, Buffer.from([0x64]));
  fs.closeSync(fd);
  const buf = fs.readFileSync('/fdtest');
  t.deepEqual(buf, Buffer.from([0x61, 0x62, 0x63, 0x00, 0x64]));
});

test('fallocateSync can extend the file length - sync', t => {
  const fs = new VirtualFS;
  const fd = fs.openSync('allocate', 'w');
  const offset = 10;
  const length = 100;
  fs.fallocateSync(fd, offset, length);
  const stat = fs.statSync('allocate');
  t.is(stat.size, offset + length);
  fs.closeSync(fd);
});

test('fallocateSync does not touch existing data - sync', t => {
  const fs = new VirtualFS;
  const fd = fs.openSync('allocate', 'w+');
  const str = 'abcdef';
  fs.writeSync(fd, str);
  const offset = 100;
  const length = 100;
  fs.fallocateSync(fd, offset, length);
  fs.lseekSync(fd, 0);
  const buf = Buffer.alloc(str.length);
  fs.readSync(fd, buf, 0, buf.length);
  t.is(buf.toString(), str);
  fs.closeSync(fd);
});

test.cb('mmap with MAP_PRIVATE on a file descriptor gives me an immediate copy on the file buffer - async', t => {
  const fs = new VirtualFS;
  const buf1 = Buffer.from('abcdef');
  const length = 4;
  const offset = 1;
  fs.writeFileSync('file', buf1);
  const fd = fs.openSync('file', 'r');
  fs.mmap(length, fs.constants.MAP_PRIVATE, fd, offset, (e, buf2) => {
    t.ifError(e);
    t.is(buf2.length, length);
    t.deepEqual(buf2, buf1.slice(offset, offset + length));
    buf2[0] = 'z'.charCodeAt();
    t.notDeepEqual(buf2, buf1.slice(offset, offset + length));
    fs.closeSync(fd);
    t.end();
  });
});

test('mmapSync with MAP_SHARED on a file descriptor gives me a persistent reference to the inode buffer', t => {
  const fs = new VirtualFS;
  const buf1 = Buffer.from('abcdef');
  const length = 4;
  const offset = 1;
  fs.writeFileSync('file', buf1);
  const fd = fs.openSync('file', 'r+');
  const buf2 = fs.mmapSync(length, fs.constants.MAP_SHARED, fd, offset);
  buf2[0] = 'z'.charCodeAt();
  // changes to the mmaped buffer propragate to the file
  t.deepEqual(fs.readFileSync('file').slice(offset, offset + length), buf2);
  // changes to the file propagate to the mmaped buffer
  fs.writeFileSync(fd, buf1);
  t.deepEqual(buf1.slice(offset, offset + length), buf2);
  fs.closeSync(fd);
});

//////////////////////////////////////////////////////////////////////////
// function calling styles (involving intermediate optional parameters) //
//////////////////////////////////////////////////////////////////////////

test('openSync calling styles work - sync', t => {
  const fs = new VirtualFS;
  t.notThrows(() => {
    let fd;
    fd = fs.openSync('/test', 'w+');
    fs.closeSync(fd);
    fd = fs.openSync('/test2', 'w+', 0o666);
    fs.closeSync(fd);
  });
});

test.cb('open calling styles work - async', t => {
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

test('readSync calling styles work - sync', t => {
  // fs.readSync has undocumented optional parameters
  const fs = new VirtualFS;
  const str = 'Hello World';
  const buf = Buffer.from(str).fill(0);
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

test.cb('read calling styles work - async', t => {
  // fs.read does not have intermediate optional parameters
  const fs = new VirtualFS;
  const str = 'Hello World';
  const buf = Buffer.from(str).fill(0);
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

test('writeSync calling styles work - sync', t => {
  const fs = new VirtualFS;
  const fd = fs.openSync('/test', 'w');
  const str = 'Hello World';
  const buf = Buffer.from(str);
  let bytesWritten;
  bytesWritten = fs.writeSync(fd, buf);
  t.is(bytesWritten, 11);
  bytesWritten = fs.writeSync(fd, buf, 0);
  t.is(bytesWritten, 11);
  fs.writeSync(fd, buf, 0, buf.length);
  fs.writeSync(fd, buf, 0, buf.length, null);
  fs.writeSync(fd, str);
  fs.writeSync(fd, str, null);
  fs.writeSync(fd, str, null, 'utf-8');
  fs.closeSync(fd);
  t.is(fs.readFileSync('/test', 'utf-8'), str.repeat(7));
});

test.cb('write calling styles work - async', t => {
  // fs.write has intermediate optional parameters
  const fs = new VirtualFS;
  const fd = fs.openSync('/test', 'w+');
  const str = 'Hello World';
  const buf = Buffer.from(str);
  fs.write(fd, buf, (err, bytesWritten, buffer) => {
    t.ifError(err);
    t.is(bytesWritten, buf.length);
    t.deepEqual(buffer, buf);
    fs.write(fd, buf, 0, (err, bytesWritten, buffer) => {
      t.ifError(err);
      t.is(bytesWritten, buf.length);
      t.deepEqual(buffer, buf);
      fs.write(fd, buf, 0, buf.length, (err, bytesWritten, buffer) => {
        t.ifError(err);
        t.is(bytesWritten, buf.length);
        t.deepEqual(buffer, buf);
        fs.write(fd, buf, 0, buf.length, 0, (err, bytesWritten, buffer) => {
          t.ifError(err);
          t.is(bytesWritten, buf.length);
          t.deepEqual(buffer, buf);
          fs.write(fd, str, (err, bytesWritten, string) => {
            t.ifError(err);
            t.is(bytesWritten, buf.length);
            t.is(string, str);
            fs.write(fd, str, 0, (err, bytesWritten, string) => {
              t.ifError(err);
              t.is(bytesWritten, buf.length);
              t.is(string, str);
              fs.write(fd, str, 0, 'utf-8', (err, bytesWritten, string) => {
                t.ifError(err);
                t.is(bytesWritten, buf.length);
                t.is(string, str);
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

test('readFileSync calling styles work - sync', t => {
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

test.cb('readFile calling styles work - async', t => {
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

test('writeFileSync calling styles work - sync', t => {
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

test.cb('writeFile calling styles work - async', t => {
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

////////////////////////////////////
// current directory side effects //
////////////////////////////////////

test('getCwd returns the absolute fully resolved path - sync', t => {
  const fs = new VirtualFS;
  fs.mkdirpSync('/a/b');
  fs.symlinkSync('/a/b', '/c');
  fs.chdir('/c');
  const cwd = fs.getCwd();
  t.is(cwd, '/a/b');
});

test('getCwd still works if the current directory is deleted - sync', t => {
  // nodejs process.cwd() will actually throw ENOENT
  // but making it work in VFS is harmless
  const fs = new VirtualFS;
  fs.mkdirSync('/removed');
  fs.chdir('/removed');
  fs.rmdirSync('../removed');
  t.is(fs.getCwd(), '/removed');
});

test('deleted current directory can still use . and .. for traversal - sync', t => {
  const fs = new VirtualFS;
  fs.mkdirSync('/removed');
  const statRoot = fs.statSync('/');
  fs.chdir('/removed');
  const statCurrent1 = fs.statSync('.');
  fs.rmdirSync('../removed');
  const statCurrent2 = fs.statSync('.');
  const statParent = fs.statSync('..');
  t.is(statCurrent1.ino, statCurrent2.ino);
  t.is(statRoot.ino, statParent.ino);
  t.is(statCurrent2.nlink, 1);
  t.is(statParent.nlink, 3);
  const dentryCurrent = fs.readdirSync('.');
  const dentryParent = fs.readdirSync('..');
  t.deepEqual(dentryCurrent, []);
  t.deepEqual(dentryParent, []);
});

test('cannot create inodes within a deleted current directory - sync', t => {
  const fs = new VirtualFS;
  fs.writeFileSync('/dummy', 'hello');
  fs.mkdirSync('/removed');
  fs.chdir('/removed');
  fs.rmdirSync('../removed');
  let error;
  error = t.throws(() => {
    fs.writeFileSync('./a', 'abc');
  });
  t.is(error.code, 'ENOENT');
  error = t.throws(() => {
    fs.mkdirSync('./b');
  });
  t.is(error.code, 'ENOENT');
  error = t.throws(() => {
    fs.symlinkSync('../dummy', 'c');
  });
  t.is(error.code, 'ENOENT');
  error = t.throws(() => {
    fs.linkSync('../dummy', 'd');
  });
  t.is(error.code, 'ENOENT');
});

test('can still chdir when both current and parent directories are deleted', t => {
  const fs = new VirtualFS;
  fs.mkdirpSync('/removeda/removedb');
  fs.chdir('/removeda/removedb');
  fs.rmdirSync('../removedb');
  fs.rmdirSync('../../removeda');
  fs.chdir('..');
  fs.chdir('..');
  const path = fs.getCwd();
  t.is(path, '/');
});

test('cannot chdir into a directory without execute permissions', t => {
  const fs = new VirtualFS;
  fs.mkdirSync('/dir');
  fs.chmodSync('/dir', 0o666);
  fs.setUid(1000);
  const error = t.throws(() => {
    fs.chdir('/dir');
  });
  t.is(error.code, 'EACCES');
});

test('cannot delete current directory using .', t => {
  const fs = new VirtualFS;
  fs.mkdirSync('/removed');
  fs.chdir('/removed');
  const error = t.throws(() => {
    fs.rmdirSync('.');
  });
  t.is(error.code, 'EINVAL');
});

test('cannot delete parent directory using .. even when current directory is deleted', t => {
  const fs = new VirtualFS;
  fs.mkdirpSync('/removeda/removedb');
  fs.chdir('/removeda/removedb');
  fs.rmdirSync('../removedb');
  fs.rmdirSync('../../removeda');
  const error = t.throws(() => {
    fs.rmdirSync('..');
  });
  // linux reports this as ENOTEMPTY, but EINVAL makes more sense
  t.is(error.code, 'EINVAL');
});

test('cannot rename the current or parent directory to a subdirectory', t => {
  const fs = new VirtualFS;
  fs.mkdirSync('/cwd');
  fs.chdir('/cwd');
  let error;
  error = t.throws(() => {
    fs.renameSync('.', 'subdir');
  });
  t.is(error.code, 'EBUSY');
  fs.mkdirSync('/cwd/cwd');
  fs.chdir('/cwd/cwd');
  error = t.throws(() => {
    fs.renameSync('..', 'subdir');
  });
  t.is(error.code, 'EBUSY');
});

test('cannot rename where the old path is a strict prefix of the new path', t => {
  const fs = new VirtualFS;
  fs.mkdirpSync('/cwd1/cwd2');
  fs.chdir('/cwd1/cwd2');
  let error;
  error = t.throws(() => {
    fs.renameSync('../cwd2', 'subdir');
  });
  t.is(error.code, 'EINVAL');
  fs.mkdirSync('/cwd1/cwd2/cwd3');
  error = t.throws(() => {
    fs.renameSync('./cwd3', './cwd3/cwd4');
  });
  t.is(error.code, 'EINVAL');
});

/////////////////
// permissions //
/////////////////

test('chown changes uid and gid - sync', t => {
  const fs = new VirtualFS;
  fs.mkdirSync('/test');
  fs.chownSync('/test', 1000, 2000);
  const stat = fs.statSync('/test');
  t.is(stat.uid, 1000);
  t.is(stat.gid, 2000);
});

test('chmod with 0 wipes out all permissions - sync', t => {
  const fs = new VirtualFS;
  fs.writeFileSync('/a', 'abc');
  fs.chmodSync('/a', 0o000);
  const stat = fs.statSync('/a');
  t.is(stat.mode, fs.constants.S_IFREG);
});

test.cb('mkdir and chmod affects the mode - callback', t => {
  const fs = new VirtualFS;
  fs.mkdir('/test', 0o644, (err) => {
    fs.accessSync(
      '/test',
      (fs.constants.F_OK |
       fs.constants.R_OK |
       fs.constants.W_OK)
    );
    fs.chmod('/test', 0o444, (err) => {
      fs.accessSync(
        '/test',
        (fs.constants.F_OK |
         fs.constants.R_OK)
      );
      t.end();
    });
  });
});

test('umask is correctly applied', t => {
  const umask = 0o127;
  const fs = new VirtualFS(umask);
  fs.writeFileSync('/file', 'hello world');
  fs.mkdirSync('/dir');
  fs.symlinkSync('/file', '/symlink');
  let stat;
  stat = fs.statSync('/file');
  t.is(
    (stat.mode & (fs.constants.S_IRWXU | fs.constants.S_IRWXG | fs.constants.S_IRWXO)),
    DEFAULT_FILE_PERM & (~umask)
  );
  stat = fs.statSync('/dir');
  t.is(
    (stat.mode & (fs.constants.S_IRWXU | fs.constants.S_IRWXG | fs.constants.S_IRWXO)),
    DEFAULT_DIRECTORY_PERM & (~umask)
  );
  // umask is not applied to symlinks
  stat = fs.lstatSync('/symlink');
  t.is(
    (stat.mode & (fs.constants.S_IRWXU | fs.constants.S_IRWXG | fs.constants.S_IRWXO)),
    DEFAULT_SYMLINK_PERM
  );
});

test('non-root users can only chown uid if they own the file and they are chowning to themselves', t => {
  const fs = new VirtualFS;
  fs.writeFileSync('file', 'hello');
  fs.chownSync('file', 1000, 1000);
  fs.setUid(1000);
  fs.setGid(1000);
  fs.chownSync('file', 1000, 1000);
  let error;
  // you cannot give away files
  error = t.throws(() => {
    fs.chownSync('file', 2000, 2000);
  });
  t.is(error.code, 'EPERM');
  // if you don't own the file, you also cannot change (even if your change is noop)
  fs.setUid(3000);
  error = t.throws(() => {
    fs.chownSync('file', 1000, 1000);
  });
  t.is(error.code, 'EPERM');
  fs.setUid(1000);
  fs.chownSync('file', 1000, 2000);
});

test('chown can change groups without any problem because we do not have a user group hierarchy', t => {
  const fs = new VirtualFS;
  fs.writeFileSync('file', 'hello');
  fs.chownSync('file', 1000, 1000);
  fs.setUid(1000);
  fs.setGid(1000);
  fs.chownSync('file', 1000, 2000);
  t.pass();
});

test('chmod only works if you are the owner of the file', t => {
  const fs = new VirtualFS;
  fs.writeFileSync('file', 'hello');
  fs.chownSync('file', 1000, 1000);
  fs.setUid(1000);
  fs.chmodSync('file', 0o000);
  fs.setUid(2000);
  const error = t.throws(() => {
    fs.chmodSync('file', 0o777);
  });
  t.is(error.code, 'EPERM');
});

test('permissions are checked in stages of user, group then other - sync', t => {
  const fs = new VirtualFS;
  fs.mkdirpSync('/home/1000');
  fs.chownSync('/home/1000', 1000, 1000);
  fs.chdir('/home/1000');
  fs.setUid(1000);
  fs.setGid(1000);
  fs.writeFileSync('testfile', 'hello');
  fs.mkdirSync('dir');
  fs.chmodSync('testfile', 0o764);
  fs.chmodSync('dir', 0o764);
  fs.accessSync(
    'testfile',
    (fs.constants.R_OK |
     fs.constants.W_OK |
     fs.constants.X_OK)
  );
  fs.accessSync(
    'dir',
    (fs.constants.R_OK |
     fs.constants.W_OK |
     fs.constants.X_OK)
  );
  fs.setUid(2000);
  fs.accessSync(
    'testfile',
    (fs.constants.R_OK |
     fs.constants.W_OK)
  );
  fs.accessSync(
    'dir',
    (fs.constants.R_OK |
     fs.constants.W_OK)
  );
  let error;
  error = t.throws(() => {
    fs.accessSync('testfile', fs.constants.X_OK);
  });
  t.is(error.code, 'EACCES');
  error = t.throws(() => {
    fs.accessSync('dir', fs.constants.X_OK);
  });
  t.is(error.code, 'EACCES');
  fs.setGid(2000);
  fs.accessSync('testfile', fs.constants.R_OK);
  fs.accessSync('dir', fs.constants.R_OK);
  error = t.throws(() => {
    fs.accessSync(
      'testfile',
      (fs.constants.W_OK |
       fs.constants.X_OK)
    );
  });
  t.is(error.code, 'EACCES');
  error = t.throws(() => {
    fs.accessSync(
      'dir',
      (fs.constants.W_OK |
       fs.constants.X_OK)
    );
  });
  t.is(error.code, 'EACCES');
});

test('permissions are checked in stages of user, group then other (using chownSync) - sync', t => {
  const fs = new VirtualFS;
  fs.mkdirpSync('/home/1000');
  fs.chownSync('/home/1000', 1000, 1000);
  fs.chdir('/home/1000');
  fs.setUid(1000);
  fs.setGid(1000);
  fs.writeFileSync('testfile', 'hello');
  fs.mkdirSync('dir');
  fs.chmodSync('testfile', 0o764);
  fs.chmodSync('dir', 0o764);
  fs.accessSync(
    'testfile',
    (fs.constants.R_OK |
     fs.constants.W_OK |
     fs.constants.X_OK)
  );
  fs.accessSync(
    'dir',
    (fs.constants.R_OK |
     fs.constants.W_OK |
     fs.constants.X_OK)
  );
  fs.setUid(DEFAULT_ROOT_UID);
  fs.setUid(DEFAULT_ROOT_GID);
  fs.chownSync('testfile', 2000, 1000);
  fs.chownSync('dir', 2000, 1000);
  fs.setUid(1000);
  fs.setGid(1000);
  fs.accessSync(
    'testfile',
    (fs.constants.R_OK |
     fs.constants.W_OK)
  );
  fs.accessSync(
    'dir',
    (fs.constants.R_OK |
     fs.constants.W_OK)
  );
  let error;
  error = t.throws(() => {
    fs.accessSync('testfile', fs.constants.X_OK);
  });
  t.is(error.code, 'EACCES');
  error = t.throws(() => {
    fs.accessSync('dir', fs.constants.X_OK);
  });
  t.is(error.code, 'EACCES');
  fs.setUid(DEFAULT_ROOT_UID);
  fs.setUid(DEFAULT_ROOT_GID);
  fs.chownSync('testfile', 2000, 2000);
  fs.chownSync('dir', 2000, 2000);
  fs.setUid(1000);
  fs.setGid(1000);
  fs.accessSync('testfile', fs.constants.R_OK);
  fs.accessSync('dir', fs.constants.R_OK);
  error = t.throws(() => {
    fs.accessSync(
      'testfile',
      (fs.constants.W_OK |
       fs.constants.X_OK)
    );
  });
  t.is(error.code, 'EACCES');
  error = t.throws(() => {
    fs.accessSync(
      'dir',
      (fs.constants.W_OK |
       fs.constants.X_OK)
    );
  });
  t.is(error.code, 'EACCES');
});

test('--x-w-r-- do not provide read write and execute to the user due to permission staging', t => {
  const fs = new VirtualFS;
  fs.mkdirpSync('/home/1000');
  fs.chownSync('/home/1000', 1000, 1000);
  fs.chdir('/home/1000');
  fs.setUid(1000);
  fs.setGid(1000);
  fs.writeFileSync('file', 'hello');
  fs.mkdirSync('dir');
  fs.chmodSync('file', 0o124);
  fs.chmodSync('dir', 0o124);
  let error;
  error = t.throws(() => {
    fs.accessSync(
      'file',
      (fs.constants.R_OK |
       fs.constants.W_OK)
    );
  });
  t.is(error.code, 'EACCES');
  error = t.throws(() => {
    fs.accessSync(
      'dir',
      (fs.constants.R_OK |
       fs.constants.W_OK)
    );
  });
  t.is(error.code, 'EACCES');
  fs.accessSync('file', fs.constants.X_OK);
  fs.accessSync('dir', fs.constants.X_OK);
});

test('file permissions --- - sync', t => {
  const fs = new VirtualFS;
  fs.mkdirpSync('/home/1000');
  fs.chownSync('/home/1000', 1000, 1000);
  fs.chdir('/home/1000');
  fs.setUid(1000);
  fs.setGid(1000);
  fs.writeFileSync('file', 'hello');
  fs.chmodSync('file', 0o000);
  let error;
  error = t.throws(() => {
    fs.accessSync('file', fs.constants.X_OK);
  });
  t.is(error.code, 'EACCES');
  error = t.throws(() => {
    fs.openSync('file', 'r');
  });
  t.is(error.code, 'EACCES');
  error = t.throws(() => {
    fs.openSync('file', 'w');
  });
  t.is(error.code, 'EACCES');
  const stat = fs.statSync('file');
  t.true(stat.isFile());
});

test('file permissions r-- - sync', t => {
  const fs = new VirtualFS;
  fs.mkdirpSync('/home/1000');
  fs.chownSync('/home/1000', 1000, 1000);
  fs.chdir('/home/1000');
  fs.setUid(1000);
  fs.setGid(1000);
  const str = 'hello';
  fs.writeFileSync('file', str);
  fs.chmodSync('file', 0o400);
  let error;
  error = t.throws(() => {
    fs.accessSync('file', fs.constants.X_OK);
  });
  t.is(error.code, 'EACCES');
  t.is(fs.readFileSync('file', 'utf8'), str);
  error = t.throws(() => {
    fs.openSync('file', 'w');
  });
  t.is(error.code, 'EACCES');
});

test('file permissions rw- - sync', t => {
  const fs = new VirtualFS;
  fs.mkdirpSync('/home/1000');
  fs.chownSync('/home/1000', 1000, 1000);
  fs.chdir('/home/1000');
  fs.setUid(1000);
  fs.setGid(1000);
  fs.writeFileSync('file', 'world');
  fs.chmodSync('file', 0o600);
  let error;
  error = t.throws(() => {
    fs.accessSync('file', fs.constants.X_OK);
  });
  t.is(error.code, 'EACCES');
  const str = 'hello';
  fs.writeFileSync('file', str);
  t.is(fs.readFileSync('file', 'utf8'), str);
});

test('file permissions rwx - sync', t => {
  const fs = new VirtualFS;
  fs.mkdirpSync('/home/1000');
  fs.chownSync('/home/1000', 1000, 1000);
  fs.chdir('/home/1000');
  fs.setUid(1000);
  fs.setGid(1000);
  fs.writeFileSync('file', 'world');
  fs.chmodSync('file', 0o700);
  fs.accessSync('file', fs.constants.X_OK);
  const str = 'hello';
  fs.writeFileSync('file', str);
  t.is(fs.readFileSync('file', 'utf8'), str);
});

test('file permissions r-x - sync', t => {
  const fs = new VirtualFS;
  fs.mkdirpSync('/home/1000');
  fs.chownSync('/home/1000', 1000, 1000);
  fs.chdir('/home/1000');
  fs.setUid(1000);
  fs.setGid(1000);
  const str = 'hello';
  fs.writeFileSync('file', str);
  fs.chmodSync('file', 0o500);
  fs.accessSync('file', fs.constants.X_OK);
  t.is(fs.readFileSync('file', 'utf8'), str);
});

test('file permissions -w- - sync', t => {
  const fs = new VirtualFS;
  fs.mkdirpSync('/home/1000');
  fs.chownSync('/home/1000', 1000, 1000);
  fs.chdir('/home/1000');
  fs.setUid(1000);
  fs.setGid(1000);
  const str = 'hello';
  fs.writeFileSync('file', str);
  fs.chmodSync('file', 0o200);
  let error;
  error = t.throws(() => {
    fs.accessSync('file', fs.constants.X_OK);
  });
  t.is(error.code, 'EACCES');
  fs.writeFileSync('file', str);
  error = t.throws(() => {
    const fd = fs.openSync('file', 'r');
  });
  t.is(error.code, 'EACCES');
});

test('file permissions -wx - sync', t => {
  const fs = new VirtualFS;
  fs.mkdirpSync('/home/1000');
  fs.chownSync('/home/1000', 1000, 1000);
  fs.chdir('/home/1000');
  fs.setUid(1000);
  fs.setGid(1000);
  const str = 'hello';
  fs.writeFileSync('file', str);
  fs.chmodSync('file', 0o300);
  fs.accessSync('file', fs.constants.X_OK);
  fs.writeFileSync('file', str);
  const error = t.throws(() => {
    const fd = fs.openSync('file', 'r');
  });
  t.is(error.code, 'EACCES');
});

test('file permissions --x - sync', t => {
  const fs = new VirtualFS;
  fs.mkdirpSync('/home/1000');
  fs.chownSync('/home/1000', 1000, 1000);
  fs.chdir('/home/1000');
  fs.setUid(1000);
  fs.setGid(1000);
  fs.writeFileSync('file', 'hello');
  fs.chmodSync('file', 0o100);
  fs.accessSync('file', fs.constants.X_OK);
  let error;
  let fd;
  error = t.throws(() => {
    fd = fs.openSync('file', 'w');
  });
  t.is(error.code, 'EACCES');
  error = t.throws(() => {
    fd = fs.openSync('file', 'r');
  });
  t.is(error.code, 'EACCES');
});

test('directory permissions --- - sync', t => {
  const fs = new VirtualFS;
  fs.mkdirpSync('/home/1000');
  fs.chownSync('/home/1000', 1000, 1000);
  fs.chdir('/home/1000');
  fs.setUid(1000);
  fs.setGid(1000);
  fs.mkdirSync('---');
  fs.chmodSync('---', 0o000);
  const stat = fs.statSync('---');
  t.true(stat.isDirectory());
  let error;
  error = t.throws(() => {
    fs.writeFileSync('---/a', 'hello');
  });
  t.is(error.code, 'EACCES');
  error = t.throws(() => {
    fs.chdir('---');
  });
  t.is(error.code, 'EACCES');
  error = t.throws(() => {
    fs.readdirSync('---');
  });
  t.is(error.code, 'EACCES');
});

test('directory permissions r-- - sync', t => {
  // allows listing entries
  const fs = new VirtualFS;
  fs.mkdirpSync('/home/1000');
  fs.chownSync('/home/1000', 1000, 1000);
  fs.chdir('/home/1000');
  fs.setUid(1000);
  fs.setGid(1000);
  fs.mkdirSync('r--');
  fs.writeFileSync('r--/a', 'hello');
  fs.chmodSync('r--', 0o400);
  let error;
  error = t.throws(() => {
    fs.writeFileSync('r--/b', 'hello');
  });
  t.is(error.code, 'EACCES');
  error = t.throws(() => {
    fs.chdir('r--');
  });
  t.is(error.code, 'EACCES');
  t.deepEqual(fs.readdirSync('r--'), ['a']);
  // you can always change metadata even without write permissions
  fs.utimesSync('r--', new Date, new Date);
  // you cannot access the properties of the children
  error = t.throws(() => {
    fs.statSync('r--/a');
  });
  t.is(error.code, 'EACCES');
});

test('directory permissions rw- - sync', t => {
  // allows listing entries
  const fs = new VirtualFS;
  fs.mkdirpSync('/home/1000');
  fs.chownSync('/home/1000', 1000, 1000);
  fs.chdir('/home/1000');
  fs.setUid(1000);
  fs.setGid(1000);
  fs.mkdirSync('rw-');
  fs.writeFileSync('rw-/a', 'hello');
  fs.chmodSync('rw-', 0o600);
  let error;
  // you cannot write into a file
  error = t.throws(() => {
    fs.writeFileSync('rw-/a', 'world');
  });
  t.is(error.code, 'EACCES');
  // you cannot create a new file
  error = t.throws(() => {
    fs.writeFileSync('rw-/b', 'hello');
  });
  t.is(error.code, 'EACCES');
  // you cannot remove files
  error = t.throws(() => {
    fs.unlinkSync('rw-/a');
  });
  t.is(error.code, 'EACCES');
  // you cannot traverse into it
  error = t.throws(() => {
    fs.chdir('rw-');
  });
  t.is(error.code, 'EACCES');
  t.deepEqual(fs.readdirSync('rw-'), ['a']);
  fs.utimesSync('rw-', new Date, new Date);
  // you cannot access the properties of the children
  error = t.throws(() => {
    fs.statSync('rw-/a');
  });
  t.is(error.code, 'EACCES');
});

test('directory permissions rwx - sync', t => {
  // allows listing entries, creation of children and traversal
  const fs = new VirtualFS;
  fs.mkdirpSync('/home/1000');
  fs.chownSync('/home/1000', 1000, 1000);
  fs.chdir('/home/1000');
  fs.setUid(1000);
  fs.setGid(1000);
  fs.mkdirSync('rwx');
  fs.chmodSync('rwx', 0o700);
  const str = 'abc';
  fs.writeFileSync('rwx/a', str);
  t.is(fs.readFileSync('rwx/a', 'utf8'), str);
  t.deepEqual(fs.readdirSync('rwx'), ['a']);
  fs.chdir('rwx');
  const stat = fs.statSync('./a');
  t.true(stat.isFile());
  fs.unlinkSync('./a');
  fs.rmdirSync('../rwx');
});

test('directory permissions r-x - sync', t => {
  // allows listing entries and traversal
  const fs = new VirtualFS;
  fs.mkdirpSync('/home/1000');
  fs.chownSync('/home/1000', 1000, 1000);
  fs.chdir('/home/1000');
  fs.setUid(1000);
  fs.setGid(1000);
  fs.mkdirSync('r-x');
  fs.mkdirSync('r-x/dir');
  fs.writeFileSync('r-x/a', 'hello');
  fs.chmodSync('r-x', 0o500);
  const str = 'world';
  // you can write to the file
  fs.writeFileSync('r-x/a', str);
  let error;
  // you cannot create new files
  error = t.throws(() => {
    fs.writeFileSync('r-x/b', str);
  });
  t.is(error.code, 'EACCES');
  // you can read the directory
  t.deepEqual(fs.readdirSync('r-x'), ['dir', 'a']);
  // you can read the file
  t.is(fs.readFileSync('r-x/a', 'utf8'), str);
  // you can traverse into the directory
  fs.chdir('r-x');
  const stat = fs.statSync('dir');
  t.true(stat.isDirectory());
  // you cannot delete the file
  error = t.throws(() => {
    fs.unlinkSync('./a');
  });
  t.is(error.code, 'EACCES');
  // cannot delete the directory
  error = t.throws(() => {
    fs.rmdirSync('dir');
  });
  t.is(error.code, 'EACCES');
});

test('directory permissions -w- - sync', t => {
  // allows nothing
  const fs = new VirtualFS;
  fs.mkdirpSync('/home/1000');
  fs.chownSync('/home/1000', 1000, 1000);
  fs.chdir('/home/1000');
  fs.setUid(1000);
  fs.setGid(1000);
  fs.mkdirSync('-w-');
  fs.chmodSync('-w-', 0o000);
  let error;
  error = t.throws(() => {
    fs.writeFileSync('-w-/a', 'hello');
  });
  t.is(error.code, 'EACCES');
  error = t.throws(() => {
    fs.chdir('-w-');
  });
  t.is(error.code, 'EACCES');
  error = t.throws(() => {
    fs.readdirSync('-w-');
  });
  t.is(error.code, 'EACCES');
});

test('directory permissions -wx - sync', t => {
  // creation of children and allows traversal
  const fs = new VirtualFS;
  fs.mkdirpSync('/home/1000');
  fs.chownSync('/home/1000', 1000, 1000);
  fs.chdir('/home/1000');
  fs.setUid(1000);
  fs.setGid(1000);
  fs.mkdirSync('-wx');
  fs.chmodSync('-wx', 0o300);
  const str = 'hello';
  fs.writeFileSync('-wx/a', str);
  t.is(fs.readFileSync('-wx/a', 'utf8'), str);
  fs.unlinkSync('-wx/a');
  fs.chdir('-wx');
  fs.mkdirSync('./dir');
  let error;
  error = t.throws(() => {
    fs.readdirSync('.');
  });
  t.is(error.code, 'EACCES');
  const stat = fs.statSync('./dir');
  t.true(stat.isDirectory());
  fs.rmdirSync('./dir');
});

test('directory permissions --x - sync', t => {
  // allows traversal
  const fs = new VirtualFS;
  fs.mkdirpSync('/home/1000');
  fs.chownSync('/home/1000', 1000, 1000);
  fs.chdir('/home/1000');
  fs.setUid(1000);
  fs.setGid(1000);
  fs.mkdirSync('--x');
  const str = 'hello';
  fs.writeFileSync('--x/a', str);
  fs.chmodSync('--x', 0o100);
  fs.chdir('--x');
  let error;
  error = t.throws(() => {
    fs.writeFileSync('./b', 'world');
  });
  t.is(error.code, 'EACCES');
  error = t.throws(() => {
    fs.unlinkSync('./a');
  });
  t.is(error.code, 'EACCES');
  error = t.throws(() => {
    fs.readdirSync('.');
  });
  t.is(error.code, 'EACCES');
  t.is(fs.readFileSync('./a', 'utf8'), str);
});

test('changing file permissions does not affect already opened file descriptor', t => {
  const fs = new VirtualFS;
  fs.mkdirpSync('/home/1000');
  fs.chownSync('/home/1000', 1000, 1000);
  fs.chdir('/home/1000');
  fs.setUid(1000);
  fs.setGid(1000);
  const str = 'hello';
  fs.writeFileSync('file', str);
  fs.chmodSync('file', 0o777);
  const fd = fs.openSync('file', 'r+');
  fs.chmodSync('file', 0o000);
  t.is(fs.readFileSync(fd, 'utf8'), str);
  const str2 = 'world';
  fs.writeFileSync(fd, str2);
  fs.lseekSync(fd, 0);
  t.is(fs.readFileSync(fd, 'utf8'), str2);
  fs.closeSync(fd);
});

test('writeFileSync and appendFileSync respects the mode', t => {
  const fs = new VirtualFS;
  let stat;
  let error;
  // allow others to read only
  fs.writeFileSync('/test1', '', { mode: 0o004 });
  fs.appendFileSync('/test2', '', { mode: 0o004 });
  // become the other
  fs.setUid(1000);
  fs.setGid(1000);
  fs.accessSync('/test1', fs.constants.R_OK);
  error = t.throws(() => {
    fs.accessSync('/test1', fs.constants.W_OK);
  });
  t.is(error.code, 'EACCES');
  fs.accessSync('/test2', fs.constants.R_OK);
  error = t.throws(() => {
    fs.accessSync('/test1', fs.constants.W_OK);
  });
  t.is(error.code, 'EACCES');
});

/////////////////////////////
// Uint8Array data support //
/////////////////////////////

test('Uint8Array data support - sync', t => {
  const fs = new VirtualFS;
  const buf = Buffer.from('abc');
  const array = new Uint8Array(buf);
  fs.writeFileSync('/a', array);
  t.deepEqual(fs.readFileSync('/a'), buf);
  const fd = fs.openSync('/a', 'r+');
  fs.writeSync(fd, array);
  fs.lseekSync(fd, 0);
  const array2 = new Uint8Array(array.length);
  fs.readSync(fd, array2, 0, array2.length);
  t.deepEqual(array2, array);
  fs.closeSync(fd);
});

//////////////////////
// URL path support //
//////////////////////

test('URL path support - sync', t => {
  const fs = new VirtualFS;
  let url;
  url = new URL('file:///file');
  const str = 'Hello World';
  fs.writeFileSync(url, str);
  t.is(fs.readFileSync(url, 'utf8'), str);
  const fd = fs.openSync(url, 'a+');
  const str2 = 'abc';
  fs.writeSync(fd, str2);
  const buf = Buffer.allocUnsafe(str.length + str2.length);
  fs.lseekSync(fd, 0);
  fs.readSync(fd, buf, 0, buf.length);
  t.deepEqual(buf, Buffer.from(str + str2));
  url = new URL('file://hostname/file');
  const error = t.throws(() => {
    fs.openSync(url, 'w');
  });
  t.is(error.message, 'ERR_INVALID_FILE_URL_HOST');
  fs.closeSync(fd);
});

///////////////////
// vfs singleton //
///////////////////

test('vfs singleton contains /tmp', t => {
  t.deepEqual(vfs.readdirSync('/tmp'), []);
  vfs.setUid(1000);
  vfs.setGid(1000);
  const tmpDir = vfs.mkdtempSync('/tmp/');
  const stat = vfs.statSync(tmpDir);
  t.true(stat.isDirectory());
  vfs.chdir('/tmp');
  vfs.rmdirSync(tmpDir);
  vfs.setUid(0);
  vfs.setGid(0);
});

test('vfs singleton contains /root', t => {
  t.deepEqual(vfs.readdirSync('/root'), []);
  vfs.setUid(1000);
  vfs.setGid(1000);
  const error = t.throws(() => {
    vfs.chdir('/root');
  });
  t.is(error.code, 'EACCES');
  vfs.setUid(0);
  vfs.setGid(0);
});

test('vfs singleton contains /dev', t => {
  const stat = vfs.statSync('/dev');
  t.true(stat.isDirectory());
});

/////////////////////////////////////////////
// character devices (using vfs singleton) //
/////////////////////////////////////////////

test('/dev/null works - sync', t => {
  let fd;
  fd = vfs.openSync('/dev/null', 'w');
  const str = 'Hello World';
  const bytesWritten = vfs.writeSync(fd, str);
  t.is(bytesWritten, Buffer.from(str).length);
  vfs.lseekSync(fd, 10);
  const buf = Buffer.from(str);
  vfs.closeSync(fd);
  fd = vfs.openSync('/dev/null', 'r');
  const bytesRead = vfs.readSync(fd, buf, 0, buf.length);
  t.is(bytesRead, 0);
  t.deepEqual(buf, Buffer.from(str));
  vfs.closeSync(fd);
});

test('/dev/full works - sync', t => {
  const error = t.throws(() => {
    vfs.writeFileSync('/dev/full', 'Hello World');
  });
  t.is(error.code, 'ENOSPC');
  const fd = vfs.openSync('/dev/full', 'r');
  vfs.lseekSync(fd, 10);
  const buf = Buffer.allocUnsafe(10);
  const bytesRead = vfs.readSync(fd, buf, 0, buf.length);
  t.is(bytesRead, buf.length);
  for (let i = 0; i < buf.length; ++i) {
    t.is(buf[i], 0);
  }
});

test('/dev/zero works - sync', t => {
  let fd;
  fd = vfs.openSync('/dev/zero', 'w');
  const str = 'Hello World';
  const bytesWritten = vfs.writeSync(fd, str);
  t.is(bytesWritten, Buffer.from(str).length);
  vfs.closeSync(fd);
  fd = vfs.openSync('/dev/zero', 'r');
  vfs.lseekSync(fd, 10);
  const bufLength = 10;
  const buf = Buffer.allocUnsafe(bufLength);
  const bytesRead = vfs.readSync(fd, buf, 0, buf.length);
  t.is(bytesRead, buf.length);
  t.deepEqual(buf, Buffer.alloc(bufLength));
  vfs.closeSync(fd);
});

test('/dev/random and /dev/urandom works - sync', t => {
  let fdRandom;
  let fdUrandom;
  fdRandom = vfs.openSync('/dev/random', 'w');
  fdUrandom = vfs.openSync('/dev/urandom', 'w');
  const str = 'Hello World';
  let bytesWritten;
  bytesWritten = vfs.writeSync(fdRandom, str);
  t.is(bytesWritten, Buffer.from(str).length);
  bytesWritten = vfs.writeSync(fdUrandom, str);
  t.is(bytesWritten, Buffer.from(str).length);
  vfs.closeSync(fdRandom);
  vfs.closeSync(fdUrandom);
  fdRandom = vfs.openSync('/dev/random', 'r');
  fdUrandom = vfs.openSync('/dev/urandom', 'r');
  let buf;
  buf = Buffer.alloc(10);
  vfs.readSync(fdRandom, buf, 0, buf.length);
  t.notDeepEqual(buf, Buffer.alloc(10));
  buf = Buffer.alloc(10);
  vfs.readSync(fdUrandom, buf, 0, buf.length);
  t.notDeepEqual(buf, Buffer.alloc(10));
  vfs.closeSync(fdRandom);
  vfs.closeSync(fdUrandom);
});

test('/dev/tty0, /dev/tty, and /dev/console', t => {
  const tty0Fd = vfs.openSync('/dev/tty0', 'w');
  const ttyFd = vfs.openSync('/dev/tty', 'w');
  const consoleFd = vfs.openSync('/dev/console', 'w');
  const message = '\tTESTING TTY MESSAGE\n';
  let bytesWritten;
  bytesWritten = vfs.writeSync(tty0Fd, message);
  t.is(bytesWritten, message.length);
  bytesWritten = vfs.writeSync(ttyFd, message);
  t.is(bytesWritten, message.length);
  bytesWritten = vfs.writeSync(consoleFd, message);
  t.is(bytesWritten, message.length);
  // unlike other character devices, tty does not allow seeking
  let error;
  error = t.throws(() => {
    vfs.lseekSync(tty0Fd, 10);
  });
  t.is(error.code, 'ESPIPE');
  error = t.throws(() => {
    vfs.lseekSync(ttyFd, 10);
  });
  t.is(error.code, 'ESPIPE');
  error = t.throws(() => {
    vfs.lseekSync(consoleFd, 10);
  });
  t.is(error.code, 'ESPIPE');
  // we cannot test reading without blocking the thread
  // so reading must be tested manually
  // you need to test sequential reads like this
  // const fd = fs.openSync('/dev/tty', 'r');
  // const buf = Buffer.alloc(10);
  // console.log(fs.readSync(fd, buf, 0, buf.length));
  // console.log(buf.toString());
  // console.log(fs.readSync(fd, buf, 0, buf.length));
  // console.log(buf.toString());
  // pipe 20 characters into the program, and you should see
  // the first 10 characters and then the second 10 characters
});
