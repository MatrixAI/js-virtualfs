declare module 'virtualfs' {
  import type { PathLike } from 'fs';
  import type Counter from 'resource-counter';
  type NoParamCallback = (err: VirtualFSError | null) => void;
  export default class VirtualFSSingle {}
  export class VirtualFSError extends Error {
    public errno: number;
    public code: string;
    public errnoDescription: string;
    public syscall?: string;
    constructor (
      errnoObj: {errno: number, code: string, description: string},
      path?: string | null,
      dest?: string | null,
      syscall?: string | null
    );
    public setPaths(src: string, dst?: string): void;
    public setSyscall(syscall: string): void;
  }
  export class VirtualFS {
    public _uid: number;
    public _gid: number;
    public _umask: number;
    public _devMgr: DeviceManager;
    public _iNodeMgr: INodeManager;
    public _fdMgr: FileDescriptorManager;
    constructor (
      umask?: number,
      rootIndex?: number|null,
      devMgr?: DeviceManager,
      iNodeMgr?: INodeManager,
      fdMgr?: FileDescriptorManager
    );
    public getUmask(): number;
    public setUmask(umask: number): void;
    public getUid(): number;
    public setUid(uid: number): void;
    public getGid(): number;
    public setGid(gid: number): void;
    public getCwd(): string;
    public chdir (path: string): void;
    public access(path: PathLike, ...args: Array<any>): void;
    public accessSync(path: PathLike, mode: number): void;
    public exists(path: PathLike, callback?: (exists: boolean) => void): void;
    public existsSync(path: PathLike): boolean;
    public open (path: PathLike, flags: string|number, ...args: Array<any>): void;
    public openSync(path: PathLike, flags: string|number, mode?: number): number;
    public mkdirp(path: PathLike, ...args: Array<any>): void;
    public mkdirpSync(path: PathLike, mode?: number): void;
    public read(fdIndex: number, buffer: Buffer | Uint8Array, ...args: Array<any>): void;
    public readSync(fdIndex: number, buffer: Buffer | Uint8Array, offset?: number, length?: number, position?: number|null): number;
    public write(fdIndex: number, buffer: Buffer | Uint8Array, ...args: Array<any>): void;
    public writeSync(fdIndex: number, buffer: Buffer | Uint8Array | string, offsetOrPos?: number, lengthOrEncoding?: number|string, position?: number|null): number;
    public close(fdIndex: number, callback?: NoParamCallback): void;
    public closeSync(fdIndex: number): void;
    public _getPath(p: PathLike): string;
    public _getBuffer(data: Buffer | Uint8Array | string, encoding?: string | null): Buffer;
  }
  export class Stat {
    public dev: number;
    public ino: number;
    public mode: number;
    public nlink: number;
    public uid: number;
    public gid: number;
    public rdev: number;
    public size: number;
    public blksize?: number;
    public blocks?: number;
    public atime: Date;
    public mtime: Date;
    public ctime: Date;
    public birthtime: Date;
    constructor (props: {
      dev?: number,
      ino: number,
      mode: number,
      nlink: number,
      uid: number,
      gid: number,
      rdev?: number,
      size: number,
      atime: Date,
      mtime: Date,
      ctime: Date,
      birthtime: Date
    });
    public isFile(): boolean;
    public isDirectory(): boolean;
    public isBlockDevice(): boolean;
    public isCharacterDevice(): boolean;
    public isSymbolicLink(): boolean;
    public isFIFO(): boolean;
    public isSocket(): boolean;
  }
  export namespace constants {
    const O_RDONLY: number;
    const O_WRONLY: number;
    const O_RDWR: number;
    const O_ACCMODE: number;
    const S_IFMT: number;
    const S_IFREG: number;
    const S_IFDIR: number;
    const S_IFCHR: number;
    const S_IFBLK: number;
    const S_IFIFO: number;
    const S_IFLNK: number;
    const S_IFSOCK: number;
    const O_CREAT: number;
    const O_EXCL: number;
    const O_NOCTTY: number;
    const O_TRUNC: number;
    const O_APPEND: number;
    const O_DIRECTORY: number;
    const O_NOATIME: number;
    const O_NOFOLLOW: number;
    const O_SYNC: number;
    const O_DIRECT: number;
    const O_NONBLOCK: number;
    const S_IRWXU: number;
    const S_IRUSR: number;
    const S_IWUSR: number;
    const S_IXUSR: number;
    const S_IRWXG: number;
    const S_IRGRP: number;
    const S_IWGRP: number;
    const S_IXGRP: number;
    const S_IRWXO: number;
    const S_IROTH: number;
    const S_IWOTH: number;
    const S_IXOTH: number;
    const F_OK: number;
    const R_OK: number;
    const W_OK: number;
    const X_OK: number;
    const COPYFILE_EXCL: number;
    const SEEK_SET: number;
    const SEEK_CUR: number;
    const SEEK_END: number;
    const MAP_SHARED: number;
    const MAP_PRIVATE: number;
  }
  export class FileDescriptor<I extends INode> {
    constructor(iNode: I, flags: number);
    public _pos: number
    public getINode(): I;
    public getFlags(): number;
    public setFlags(flags: number): void;
    public getPos(): number;
    public setPos(pos: number, flags?: number): void;
  }
  export class FileDescriptorManager {
    constructor (
      iNodeMgr: INodeManager
    );
    public getFd<I extends INode>(index: number): FileDescriptor<I>|undefined;
  }
  export class INode {
    public _metadata: Stat;
    public getMetadata(): Stat;
  }
  export class File extends INode {
    public getData(): Buffer;
    public setData(data: Buffer): void;
  }
  export class Directory extends INode { }
  export class Symlink extends INode { }
  export class CharacterDev extends INode { }
  export class INodeManager {
    protected _counter: Counter;
    protected _iNodes: Map<number,INode>;
    protected _iNodeRefs: WeakMap<INode,number>;
    protected _devMgr: DeviceManager;
    constructor (
      devMgr: DeviceManager
    );
  }
  export type INodeDevices = CharacterDev;
  export interface DeviceInterface<I extends INodeDevices> {
    open?(fd: FileDescriptor<I>): void;
    close?(fd: FileDescriptor<I>): void;
    setPos?(fd: FileDescriptor<I>, position: number, flags: number): void;
    read?(fd: FileDescriptor<I>, buffer: Buffer, position: number): number;
    write?(fd: FileDescriptor<I>, buffer: Buffer, position: number, extraFlags: number): number;
  }
  const DEFAULT_ROOT_UID: number;
  const DEFAULT_ROOT_GID: number;
  const DEFAULT_ROOT_PERM: number;
  const DEFAULT_FILE_PERM: number;
  const DEFAULT_DIRECTORY_PERM: number;
  const DEFAULT_SYMLINK_PERM: number;
  export function applyUmask(perms: number, umask: number): number;
  export function checkPermissions(access: number, uid: number, gid: number, stat: Stat): boolean;
  const MAJOR_BITSIZE: number;
  const MINOR_BITSIZE: number;
  const MAJOR_MAX: number;
  const MINOR_MAX: number;
  const MAJOR_MIN: number;
  const MINOR_MIN: number;
  export class DeviceManager {
    public getChr(major: number, minor: number): DeviceInterface<CharacterDev> | undefined;
    public registerChr(device: DeviceInterface<CharacterDev>, major?: number, minor?: number): void;
    public deregisterChr(major: number, minor: number): void;
  }
  export class DeviceError extends Error {}
  const nullDev: DeviceInterface<CharacterDev>;
  const zeroDev: DeviceInterface<CharacterDev>;
  const fullDev: DeviceInterface<CharacterDev>;
  const randomDev: DeviceInterface<CharacterDev>;
  export function unmkDev(dev: number): [number, number];
  export function mkDev(major: number, minor: number): number;
}
