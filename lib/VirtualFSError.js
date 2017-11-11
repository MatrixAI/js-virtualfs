//@flow
/** @module VirtualFSError */

/**
 * Class representing a file system error.
 * @extends Error
 */
class VirtualFSError extends Error {

  errno: number;
  code: string;
  errnoDescription: string;
  syscall: ?string;

  /**
   * Creates VirtualFSError.
   */
  constructor (
    errnoObj: {|errno: number, code: string, description: string|},
    path: ?string,
    dest: ?string,
    syscall: ?string
  ) {
    let message = errnoObj.code + ': ' + errnoObj.description;
    if (path != null) {
      message += ', ' + path;
      if (dest != null) message += ' -> ' + dest;
    }
    super(message);
    this.errno = errnoObj.errno;
    this.code = errnoObj.code;
    this.errnoDescription = errnoObj.description;
    if (syscall != null) {
      this.syscall = syscall;
    }
  }

  setPaths (src: string, dst: ?string) {
    let message = this.code + ': ' + this.errnoDescription + ', ' + src;
    if (dst != null) message += ' -> ' + dst;
    this.message = message;
    return;
  }

  setSyscall (syscall: string) {
    this.syscall = syscall;
  }

}

export { VirtualFSError };
export { code as errno } from 'errno';
