//@flow
/** @module Random */

import type { DeviceInterface } from '../Devices.js';
import type { CharacterDev } from '../INodes.js';
import type { FileDescriptor } from '../FileDescriptors.js';

import randomBytes from 'secure-random-bytes';

const randomDev: DeviceInterface<CharacterDev> = {
  setPos: (
    fd: FileDescriptor<CharacterDev>,
    position: number,
    flags: number
  ) => {
    fd._pos = 0;
    return;
  },
  read: (
    fd: FileDescriptor<CharacterDev>,
    buffer: Buffer,
    position: number
  ) => {
    const randomBuf = Buffer.from(randomBytes(buffer.length), 'ascii');
    randomBuf.copy(buffer);
    return randomBuf.length;
  },
  write: (
    fd: FileDescriptor<CharacterDev>,
    buffer: Buffer,
    position: number,
    extraFlags: number
  ) => {
    return buffer.length;
  }
};

export default randomDev;
