//@flow
export { default } from './VirtualFSSingle.js';
export { default as VirtualFS } from './VirtualFS.js';
export { default as Stat } from './Stat.js';
export { default as constants } from './constants.js';
export { default as nullDev } from './Devices/null.js';
export { default as zeroDev } from './Devices/zero.js';
export { default as fullDev } from './Devices/full.js';
export { default as randomDev } from './Devices/random.js';
export * from './VirtualFSError.js';
export * from './Devices.js';
export * from './INodes.js';
export * from './FileDescriptors.js';
export * from './Streams.js';
export * from './permissions.js';

// polyfills to be exported
// $FlowFixMe: Buffer exists
export { Buffer } from 'buffer';
export { nextTick } from 'process';
