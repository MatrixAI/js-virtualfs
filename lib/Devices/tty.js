//@flow
/** @module Tty */

import type { DeviceInterface } from '../Devices.js';
import type { CharacterDev } from '../INodes.js';
import type { FileDescriptor } from '../FileDescriptors.js';

// $FlowFixMe: Buffer exists
import { Buffer } from 'buffer';
import process from 'process';
import { VirtualFSError, errno } from '../VirtualFSError.js';

let fds = 0;
let fs = null;
let ttyInFd = null;
let ttyOutFd = null;

const ttyDev: DeviceInterface<CharacterDev> = {
  open: (fd: FileDescriptor<CharacterDev>) => {
    if (fds === 0) {
      if (process.release && process.release.name === 'node') {
        fs = require('fs');
        ttyOutFd = process.stdout.fd;
        if (process.platform === 'win32') {
          // on windows, stdin is in blocking mode
          // NOTE: on windows node repl environment, stdin is in raw mode
          //       make sure to set process.stdin.setRawMode(false)
          ttyInFd = process.stdin.fd;
        } else {
          // on non-windows, stdin is in non-blocking mode
          // to get blocking semantics we need to reopen stdin
          try {
            // if there are problems opening this
            // we assume there is no stdin
            ttyInFd = fs.openSync('/dev/fd/0', 'rs');
          } catch (e) {}
        }
      }
    }
    ++fds;
  },
  close: (fd: FileDescriptor<CharacterDev>) => {
    --fds;
    if (fds === 0) {
      if (ttyInFd && fs) {
        fs.closeSync(ttyInFd);
      }
    }
  },
  read: (
    fd: FileDescriptor<CharacterDev>,
    buffer: Buffer,
    position: number
  ) => {
    if (ttyInFd !== null && fs) {
      // $FlowFixMe: position parameter allows null
      return fs.readSync(ttyInFd, buffer, 0, buffer.length, null);
    } else {
      if (window && window.prompt) {
        return Buffer.from(window.prompt()).copy(buffer);
      }
      throw new VirtualFSError(errno.ENXIO);
    }
  },
  write: (
    fd: FileDescriptor<CharacterDev>,
    buffer: Buffer,
    position: number,
    extraFlags: number
  ) => {
    if (ttyOutFd !== null && fs) {
      return fs.writeSync(ttyOutFd, buffer);
    } else {
      console.log(buffer.toString());
      return buffer.length;
    }
  }
};

export default ttyDev;
