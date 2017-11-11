//@flow
/** @module Permissions */

import type Stat from './Stat';

import constants from './constants';

/**
 * Default root uid.
 */
const DEFAULT_ROOT_UID = 0;

/**
 * Default root gid.
 */
const DEFAULT_ROOT_GID = 0;

/**
 * Default root directory permissions of `rwxr-xr-x`.
 */
const DEFAULT_ROOT_PERM = (constants.S_IRWXU |
                           constants.S_IRGRP |
                           constants.S_IXGRP |
                           constants.S_IROTH |
                           constants.S_IXOTH);

/**
 * Default file permissions of `rw-rw-rw-`.
 */
const DEFAULT_FILE_PERM = (constants.S_IRUSR |
                           constants.S_IWUSR |
                           constants.S_IRGRP |
                           constants.S_IWGRP |
                           constants.S_IROTH |
                           constants.S_IWOTH);

/**
 * Default directory permissions of `rwxrwxrwx`.
 */
const DEFAULT_DIRECTORY_PERM = constants.S_IRWXU | constants.S_IRWXG | constants.S_IRWXO;

/**
 * Default symlink permissions of `rwxrwxrwx`.
 */
const DEFAULT_SYMLINK_PERM = constants.S_IRWXU | constants.S_IRWXG | constants.S_IRWXO;

/**
 * Applies umask to default set of permissions.
 */
function applyUmask (perms: number, umask: number): number {
  return (perms & (~umask));
}

/**
 * Permission checking relies on ownership details of the iNode.
 * If the accessing user is the same as the iNode user, then only user permissions are used.
 * If the accessing group is the same as the iNode group, then only the group permissions are used.
 * Otherwise the other permissions are used.
 */
function resolveOwnership (uid: number, gid: number, stat: Stat): number {
  if (uid === stat.uid) {
    return (stat.mode & constants.S_IRWXU) >> 6;
  } else if (gid === stat.gid) {
    return (stat.mode & constants.S_IRWXG) >> 3;
  } else {
    return stat.mode & constants.S_IRWXO;
  }
}

/**
 * Checks the desired permissions with user id and group id against the metadata of an iNode.
 * The desired permissions can be bitwise combinations of constants.R_OK, constants.W_OK and constants.X_OK.
 */
function checkPermissions (access: number, uid: number, gid: number, stat: Stat): boolean {
  return (access & resolveOwnership(uid, gid, stat)) === access;
}

export {
  DEFAULT_ROOT_UID,
  DEFAULT_ROOT_GID,
  DEFAULT_ROOT_PERM,
  DEFAULT_FILE_PERM,
  DEFAULT_DIRECTORY_PERM,
  DEFAULT_SYMLINK_PERM,
  applyUmask,
  checkPermissions
};
