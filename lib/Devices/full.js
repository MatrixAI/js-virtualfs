//@flow
/** @module Full */

import type { DeviceInterface } from '../Devices.js';
import type { CharacterDev } from '../INodes.js';
import type { FileDescriptor } from '../FileDescriptors.js';

import { VirtualFSError, errno } from '../VirtualFSError.js';

const fullDev: DeviceInterface<CharacterDev> = {
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
    buffer.fill(0);
    return buffer.length;
  },
  write: (
    fd: FileDescriptor<CharacterDev>,
    buffer: Buffer,
    position: number,
    extraFlags: number
  ) => {
    throw new VirtualFSError(errno.ENOSPC);
  }
};

export default fullDev;
