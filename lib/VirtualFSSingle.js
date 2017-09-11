/** @module VirtualFS */

import { VirtualFS } from './VirtualFS';

// singleton version of VirtualFS
// useful for sharing a single VirtualFS instance across modules
// without directly passing VirtualFS
export default new VirtualFS;
