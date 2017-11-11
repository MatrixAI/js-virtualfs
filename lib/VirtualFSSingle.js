//@flow
/** @module VirtualFSSingleton */

import VirtualFS from './VirtualFS';
import { DeviceManager } from './Devices.js';
import constants from './constants.js';
import nullDev from './Devices/null.js';
import zeroDev from './Devices/zero.js';
import fullDev from './Devices/full.js';
import randomDev from './Devices/random.js';
import ttyDev from './Devices/tty.js';

const devMgr = new DeviceManager;

devMgr.registerChr(nullDev, 1, 3);
devMgr.registerChr(zeroDev, 1, 5);
devMgr.registerChr(fullDev, 1, 7);
devMgr.registerChr(randomDev, 1, 8);
devMgr.registerChr(randomDev, 1, 9);
devMgr.registerChr(ttyDev, 4, 0);
devMgr.registerChr(ttyDev, 5, 0);
devMgr.registerChr(ttyDev, 5, 1);

const fs = new VirtualFS(undefined, undefined, devMgr);

fs.mkdirSync('/dev');
fs.chmodSync('/dev', 0o775);

fs.mknodSync('/dev/null', constants.S_IFCHR, 1, 3);
fs.mknodSync('/dev/zero', constants.S_IFCHR, 1, 5);
fs.mknodSync('/dev/full', constants.S_IFCHR, 1, 7);
fs.mknodSync('/dev/random', constants.S_IFCHR, 1, 8);
fs.mknodSync('/dev/urandom', constants.S_IFCHR, 1, 9);
fs.chmodSync('/dev/null', 0o666);
fs.chmodSync('/dev/zero', 0o666);
fs.chmodSync('/dev/full', 0o666);
fs.chmodSync('/dev/random', 0o666);
fs.chmodSync('/dev/urandom', 0o666);

// tty0 points to the currently active virtual console (on linux this is usually tty1 or tty7)
// tty points to the currently active console (physical, virtual or pseudo)
// console points to the system console (it defaults to tty0)
// refer to the tty character device to understand its implementation
fs.mknodSync('/dev/tty0', constants.S_IFCHR, 4, 0);
fs.mknodSync('/dev/tty', constants.S_IFCHR, 5, 0);
fs.mknodSync('/dev/console', constants.S_IFCHR, 5, 1);
fs.chmodSync('/dev/tty0', 0o600);
fs.chmodSync('/dev/tty', 0o666);
fs.chmodSync('/dev/console', 0o600);

fs.mkdirSync('/tmp');
fs.chmodSync('/tmp', 0o777);

fs.mkdirSync('/root');
fs.chmodSync('/root', 0o700);

export default fs;
