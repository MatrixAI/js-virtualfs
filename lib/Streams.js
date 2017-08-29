//@flow
/** @module Streams */

import { Buffer } from 'buffer';
import { Readable, Writable } from 'readable-stream';
import typeof { VirtualFS } from './VirtualFS';

/**
 * Class representing a ReadStream.
 * @extends Readable
 */
class ReadStream extends Readable {

  _fs: VirtualFS;
  bytesRead: number;
  path: string;
  flags: string;
  autoClose: boolean;
  start: ?number;
  end: ?number;
  done: boolean;

  /**
   * Creates ReadStream.
   * It will asynchronously open the file descriptor if a file path was passed in.
   * It will automatically close the opened file descriptor by default.
   */
  constructor (path: string, options: Object, fs: VirtualFS) {
    super({
      encoding: options.encoding
    });
    this._fs = fs;
    this.bytesRead = 0;
    this.path = path;
    this.fd = options.fd === undefined ? null : options.fd;
    this.flags = options.flags === undefined ? 'r' : options.flags;
    this.autoClose = options.autoClose === undefined ? true : options.autoClose;
    this.start = options.start;
    this.end = options.end;
    this.done = false;
    if (typeof this.fd !== 'number') {
      this._open();
    }
    super.on('end', () => {
      if (this.autoClose) {
        super.destroy();
      }
    });
  }

  /**
   * Open file descriptor if ReadStream was constructed from a file path.
   * @private
   */
  _open () {
    this._fs.open(this.path, this.flags, (e, fd) => {
      if (e) {
        if (this.autoClose) {
          super.destroy();
        }
        super.emit('error', e);
        return;
      }
      this.fd = fd;
      super.emit('open', fd);
      super.read();
    });
  }

  /**
   * Read hook for stream implementation.
   * Because this is an in memory filesystem, we can push the entire buffer once on the first read.
   * This does not get affected by the highwater mark.
   * @private
   */
  _read (size: ?number) {
    if (typeof this.fd !== 'number') {
      return super.once('open', () => {
        this._read(size);
      });
    }
    if (this.destroyed) return;
    if (this.done) return;
    let buffer;
    try {
      buffer = this._fs.readFileSync(this.fd);
      this.done = true;
    } catch (e) {
      super.emit('error', e);
      if (this.autoClose) {
        super.destroy();
      }
      return;
    }
    if (typeof this.start === 'number') {
      buffer = buffer.slice(this.start, this.end + 1);
    }
    super.push(buffer);
    super.push(null);
    this.bytesRead = buffer.length;
    return;
  }

  /**
   * Destroy hook for stream implementation.
   * @private
   */
  _destroy (e: ?Error, cb: Function) {
    this._close((e_) => {
      cb(e || e_);
    });
  }

  /**
   * Close file descriptor if ReadStream was constructed from a file path.
   * @private
   */
  _close (cb: ?Function) {
    if (cb) {
      super.once('close', cb);
    }
    if (typeof this.fd !== 'number') {
      super.once('open', () => {
        this._close();
      });
      return;
    }
    if (this.closed) {
      return setImmediate(() => super.emit('close'));
    }
    this.closed = true;
    this._fs.close(this.fd, (e) => {
      if (e) {
        this.emit('error', e);
      } else {
        this.emit('close');
      }
    });
    this.fd = null;
  }

}

/**
 * Class representing a WriteStream.
 * @extends Writable
 */
class WriteStream extends Writable {

  _fs: VirtualFS;
  bytesWritten: number;
  path: string;
  flags: string;
  autoClose: boolean;
  start: ?number;
  pos: ?number;

  /**
   * Creates WriteStream.
   */
  constructor (path: string, options: Object, fs: VirtualFS) {
    super();
    this._fs = fs;
    this.bytesWritten = 0;
    this.path = path;
    this.fd = options.fd === undefined ? null : options.fd;
    this.flags = options.flags === undefined ? 'w' : options.flags;
    this.autoClose = options.autoClose === undefined ? true : options.autoClose;
    this.start = options.start;
    this.pos = this.start; // WriteStream maintains its own position
    this.destroySoon = super.end;
    if (options.encoding) {
      super.setDefaultEncoding(options.encoding);
    }
    if (typeof this.fd !== 'number') {
      this._open();
    }
    super.on('finish', () => {
      if (this.autoClose) {
        super.destroy();
      }
    });
  }

  /**
   * Open file descriptor if WriteStream was constructed from a file path.
   * @private
   */
  _open () {
    this._fs.open(this.path, this.flags, (e, fd) => {
      if (e) {
        if (this.autoClose) {
          super.destroy();
        }
        super.emit('error', e);
        return;
      }
      this.fd = fd;
      super.emit('open', fd);
    });
  }

  /**
   * Write hook for stream implementation.
   * @private
   */
  _write (data: Buffer, encoding: ?string, cb: Function) {
    if (typeof this.fd !== 'number') {
      return super.once('open', () => {
        this._write(data, encoding, cb);
      });
    }
    try {
      this.bytesWritten += this._fs.writeSync(this.fd, data, 0, data.length, this.pos);
    } catch (e) {
      if (this.autoClose) {
        super.destroy();
      }
      return cb(e);
    }
    if (this.pos !== undefined) {
      this.pos += data.length;
    }
    return cb();
  }

  /**
   * Vectorised write hook for stream implementation.
   * @private
   */
  _writev (chunks:Array<{chunk: Buffer}>, cb: Function) {
    this._write(
      Buffer.concat(chunks.map((chunk) => chunk.chunk)),
      undefined,
      cb
    );
    return;
  }

  /**
   * Destroy hook for stream implementation.
   * @private
   */
  _destroy (e: ?Error, cb: Function) {
    this._close((e_) => {
      cb(e || e_);
    });
  }

  /**
   * Close file descriptor if WriteStream was constructed from a file path.
   * @private
   */
  _close (cb: ?Function) {
    if (cb) {
      super.once('close', cb);
    }
    if (typeof this.fd !== 'number') {
      super.once('open', () => {
        this._close();
      });
      return;
    }
    if (this.closed) {
      return setImmediate(() => super.emit('close'));
    }
    this.closed = true;
    this._fs.close(this.fd, (e) => {
      if (e) {
        this.emit('error', e);
      } else {
        this.emit('close');
      }
    });
    this.fd = null;
  }

  /**
   * Final hook for stream implementation.
   * @private
   */
  _final (cb: Function) {
    cb();
    return;
  }

}

export { ReadStream, WriteStream };
