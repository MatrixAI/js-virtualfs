//@flow
/** @module Devices */

import type { CharacterDev } from './INodes.js';
import type { FileDescriptor } from './FileDescriptors.js';

import Counter from 'resource-counter';

const MAJOR_BITSIZE = 12;
const MINOR_BITSIZE = 20;
const MAJOR_MAX = (2 ** MAJOR_BITSIZE) - 1;
const MINOR_MAX = (2 ** MINOR_BITSIZE) - 1;
const MAJOR_MIN = 0;
const MINOR_MIN = 0;

class DeviceError extends Error {

  static ERROR_RANGE: number;
  static ERROR_CONFLICT: number;
  code: number;

  constructor (code: number, message: ?string) {
    super(message);
    this.code = code;
  }

}

Object.defineProperty(
  DeviceError,
  'ERROR_RANGE',
  {value: 1}
);

Object.defineProperty(
  DeviceError,
  'ERROR_CONFLICT',
  {value: 2}
);

type INodeDevices = CharacterDev;

interface DeviceInterface<I: INodeDevices> {
  open?: (FileDescriptor<I>) => void;
  close?: (FileDescriptor<I>) => void;
  setPos?: (FileDescriptor<I>, number, number) => void;
  read?: (FileDescriptor<I>, Buffer, number) => number;
  write?: (FileDescriptor<I>, Buffer, number, number) => number;
}

class DeviceManager {

  _chrCounterMaj: Counter;
  _chrDevices: Map<number, [Map<number, DeviceInterface<CharacterDev>>, Counter]>;

  constructor () {
    this._chrCounterMaj = new Counter(MAJOR_MIN);
    this._chrDevices = new Map;
  }

  getChr (major: number, minor: number): ?DeviceInterface<CharacterDev> {
    const devicesAndCounterMin = this._chrDevices.get(major);
    if (devicesAndCounterMin) {
      const [devicesMin] = devicesAndCounterMin;
      return devicesMin.get(minor);
    }
    return;
  }

  registerChr (
    device: DeviceInterface<CharacterDev>,
    major: number|void,
    minor: number|void
  ): void {
    let autoAllocMaj: ?number;
    let autoAllocMin: ?number;
    let counterMin: Counter;
    let devicesMin: Map<number, DeviceInterface<CharacterDev>>;
    try {
      if (major === undefined) {
        major = this._chrCounterMaj.allocate();
        autoAllocMaj = major;
      } else {
        const devicesCounterMin = this._chrDevices.get(major);
        if (!devicesCounterMin) {
          this._chrCounterMaj.allocate(major);
          autoAllocMaj = major;
        } else {
          [devicesMin, counterMin] = devicesCounterMin;
        }
      }
      if (!devicesMin || !counterMin) {
        counterMin = new Counter(MINOR_MIN);
        devicesMin = new Map;
      }
      if (minor === undefined) {
        minor = counterMin.allocate();
        autoAllocMin = minor;
      } else {
        if (!devicesMin.has(minor)) {
          counterMin.allocate(minor);
          autoAllocMin = minor;
        } else {
          throw new DeviceError(DeviceError.ERROR_CONFLICT);
        }
      }
      if (major > MAJOR_MAX ||
          major < MAJOR_MIN ||
          minor > MINOR_MAX ||
          minor < MINOR_MIN)
      {
        throw new DeviceError(DeviceError.ERROR_RANGE);
      }
      devicesMin.set(minor, device);
      this._chrDevices.set(major, [devicesMin, counterMin]);
      return;
    } catch (e) {
      if (autoAllocMaj != null) {
        this._chrCounterMaj.deallocate(autoAllocMaj);
      }
      if (autoAllocMin != null && counterMin) {
        counterMin.deallocate(autoAllocMin);
      }
      throw e;
    }
  }

  deregisterChr (major: number, minor: number): void {
    const devicesCounterMin = this._chrDevices.get(major);
    if (devicesCounterMin) {
      const [devicesMin, counterMin] = devicesCounterMin;
      if (devicesMin.delete(minor)) {
        counterMin.deallocate(minor);
      }
      if (!devicesMin.size) {
        this._chrDevices.delete(major);
        this._chrCounterMaj.deallocate(major);
      }
    }
    return;
  }

}

function mkDev (major: number, minor: number): number {
  return ((major << MINOR_BITSIZE) | minor);
}

function unmkDev (dev: number): [number, number] {
  const major = dev >> MINOR_BITSIZE;
  const minor = dev & ((1 << MINOR_BITSIZE) - 1);
  return [major, minor];
}

export {
  MAJOR_BITSIZE,
  MINOR_BITSIZE,
  MAJOR_MAX,
  MINOR_MAX,
  MAJOR_MIN,
  MINOR_MIN,
  DeviceManager,
  DeviceError,
  mkDev,
  unmkDev
};

export type { INodeDevices, DeviceInterface };
