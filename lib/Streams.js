//@flow
/** @module Streams */

import type VirtualFS from './VirtualFS';

// $FlowFixMe: Buffer exists
import { Buffer } from 'buffer';
import { nextTick } from 'process';
import { Readable, Writable } from 'readable-stream';
import { DEFAULT_FILE_PERM } from './permissions.js';

type optionsStream = {
  highWaterMark?: number,
  flags?: string,
  encoding?: string,
  fd?: number,
  mode?: number,
  autoClose?: boolean,
  start?: number,
  end?: number
};

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
  end: number;
  pos: ?number;

  /**
   * Creates ReadStream.
   * It will asynchronously open the file descriptor if a file path was passed in.
   * It will automatically close the opened file descriptor by default.
   */
  constructor (path: string, options: optionsStream, fs: VirtualFS) {
    super({
      highWaterMark: options.highWaterMark,
      encoding: options.encoding
    });
    this._fs = fs;
    this.bytesRead = 0;
    this.path = path;
    this.fd = (options.fd === undefined) ? null : options.fd;
    this.flags = (options.flags === undefined) ? 'r' : options.flags;
    this.mode = (options.mode === undefined) ? DEFAULT_FILE_PERM : options.mode;
    this.autoClose = (options.autoClose === undefined) ? true : options.autoClose;
    this.start = options.start;
    this.end = (options.end === undefined) ? Infinity : options.end;
    this.pos = options.start;
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
    this._fs.open(this.path, this.flags, this.mode, (e, fd) => {
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
   * Asynchronous read hook for stream implementation.
   * The size passed into this function is not the requested size, but the high watermark.
   * It's just a heuristic buffering size to avoid sending to many syscalls.
   * However since this is an in-memory filesystem, the size itself is irrelevant.
   * @private
   */
  _read (size: number) {
    if (typeof this.fd !== 'number') {
      super.once('open', () => {
        this._read(size);
      });
      return;
    }
    if (this.destroyed) return;
    // this.pos is only ever used if this.start is specified
    if (this.pos != null) {
      size = Math.min(this.end - this.pos + 1, size);
    }
    if (size <= 0) {
      this.push(null);
      return;
    }
    this._fs.read(
      this.fd,
      Buffer.allocUnsafe(size),
      0,
      size,
      this.pos,
      (e, bytesRead, buf) => {
        if (e) {
          if (this.autoClose) {
            this.destroy();
          }
          super.emit('error', e);
          return;
        }
        if (bytesRead > 0) {
          this.bytesRead += bytesRead;
          this.push(buf.slice(0, bytesRead));
        } else {
          this.push(null);
        }
      }
    );
    if (this.pos != null) {
      this.pos += size;
    }
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
      return nextTick(() => super.emit('close'));
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
  constructor (path: string, options: optionsStream, fs: VirtualFS) {
    super({
      highWaterMark: options.highWaterMark
    });
    this._fs = fs;
    this.bytesWritten = 0;
    this.path = path;
    this.fd = options.fd === undefined ? null : options.fd;
    this.flags = options.flags === undefined ? 'w' : options.flags;
    this.mode = options.mode === undefined ? DEFAULT_FILE_PERM : options.mode;
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
    this._fs.open(this.path, this.flags, this.mode, (e, fd) => {
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
   * Asynchronous write hook for stream implementation.
   * @private
   */
  _write (data: Buffer, encoding: ?string, cb: Function) {
    if (typeof this.fd !== 'number') {
      return super.once('open', () => {
        this._write(data, encoding, cb);
      });
    }
    this._fs.write(this.fd, data, 0, data.length, this.pos, (e, bytesWritten) => {
      if (e) {
        if (this.autoClose) {
          super.destroy();
        }
        cb(e);
        return;
      }
      this.bytesWritten += bytesWritten;
      cb();
    });
    if (this.pos !== undefined) {
      this.pos += data.length;
    }
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
      return nextTick(() => super.emit('close'));
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

export type { optionsStream };
