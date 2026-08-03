/**
 * GDB Remote Serial Protocol (RSP) client for RPCS3.
 *
 * Implements the wire protocol used by RPCS3's GDB server (rpcs3/Emu/GDB.cpp).
 * All commands documented in RPCS3_Debugger_Research.md are supported.
 */

import net from 'net';

// PPU register name → GDB register ID mapping (from GDB.cpp get_reg())
export const REG_NAMES = {
  // General Purpose Registers (0-31)
  r0: 0, r1: 1, r2: 2, r3: 3, r4: 4, r5: 5, r6: 6, r7: 7,
  r8: 8, r9: 9, r10: 10, r11: 11, r12: 12, r13: 13, r14: 14, r15: 15,
  r16: 16, r17: 17, r18: 18, r19: 19, r20: 20, r21: 21, r22: 22, r23: 23,
  r24: 24, r25: 25, r26: 26, r27: 27, r28: 28, r29: 29, r30: 30, r31: 31,
  // Floating Point Registers (32-63)
  f0: 32, f1: 33, f2: 34, f3: 35, f4: 36, f5: 37, f6: 38, f7: 39,
  f8: 40, f9: 41, f10: 42, f11: 43, f12: 44, f13: 45, f14: 46, f15: 47,
  f16: 48, f17: 49, f18: 50, f19: 51, f20: 52, f21: 53, f22: 54, f23: 55,
  f24: 56, f25: 57, f26: 58, f27: 59, f28: 60, f29: 61, f30: 62, f31: 63,
  // Special registers (64-70)
  pc: 64, cia: 64,
  msr: 65,
  cr: 66,
  lr: 67,
  ctr: 68,
  xer: 69,
  fpscr: 70,
};

export const REG_SIZES = {
  // 8-byte registers
  r0:8,r1:8,r2:8,r3:8,r4:8,r5:8,r6:8,r7:8,r8:8,r9:8,r10:8,r11:8,r12:8,r13:8,
  r14:8,r15:8,r16:8,r17:8,r18:8,r19:8,r20:8,r21:8,r22:8,r23:8,r24:8,r25:8,
  r26:8,r27:8,r28:8,r29:8,r30:8,r31:8,
  f0:8,f1:8,f2:8,f3:8,f4:8,f5:8,f6:8,f7:8,f8:8,f9:8,f10:8,f11:8,f12:8,f13:8,
  f14:8,f15:8,f16:8,f17:8,f18:8,f19:8,f20:8,f21:8,f22:8,f23:8,f24:8,f25:8,
  f26:8,f27:8,f28:8,f29:8,f30:8,f31:8,
  pc:8, msr:8, lr:8, ctr:8,
  // 4-byte registers
  cr:4, xer:4, fpscr:4,
};

/** Resolve register name or numeric ID to numeric GDB register ID */
export function resolveRegId(nameOrId) {
  if (typeof nameOrId === 'number') return nameOrId;
  const lower = String(nameOrId).toLowerCase();
  if (lower in REG_NAMES) return REG_NAMES[lower];
  // Try parsing as hex or decimal number
  const num = lower.startsWith('0x') ? parseInt(lower, 16) : parseInt(lower, 10);
  if (!isNaN(num) && num >= 0 && num <= 70) return num;
  throw new Error(`Unknown register: ${nameOrId}`);
}

/** Get register size in bytes by name or ID */
export function getRegSize(nameOrId) {
  const lower = String(nameOrId).toLowerCase();
  if (lower in REG_SIZES) return REG_SIZES[lower];
  const id = resolveRegId(nameOrId);
  // IDs 66 (CR), 69 (XER), 70 (FPSCR) are 4 bytes; rest up to 70 are 8 bytes
  if (id === 66 || id === 69 || id === 70) return 4;
  if (id > 70) return 0;
  return 8;
}

/** Convert a buffer to hex string */
export function bufToHex(buf) {
  return Buffer.from(buf).toString('hex');
}

/** Convert hex string to Buffer */
export function hexToBuf(hex) {
  return Buffer.from(hex, 'hex');
}

/** Convert a BigInt to padded hex string (big-endian, as GDB expects) */
export function bigIntToPaddedHex(value, byteSize) {
  const hexSize = byteSize * 2;
  let hex = BigInt(value).toString(16);
  // Pad to full size
  hex = hex.padStart(hexSize, '0');
  // GDB expects big-endian byte order for registers
  return hex;
}

/** Parse a padded hex string (big-endian) to BigInt */
export function paddedHexToBigInt(hex) {
  if (!hex || hex.includes('x')) return null; // Unreadable register (xxxxxxxx)
  return BigInt('0x' + hex);
}

/**
 * GDB RSP Client class.
 * Manages a persistent TCP connection to RPCS3's GDB server.
 */
export class GdbClient {
  constructor(host = '127.0.0.1', port = 2345) {
    this.host = host;
    this.port = port;
    this.socket = null;
    this.connected = false;
    this._recvBuffer = '';
    this._byteBuffer = [];
    this._waitResolvers = [];
    this._commandInFlight = null;
    this._ackResolver = null;
    this._interruptResolver = null;
  }

  /** Connect to the GDB server */
  async connect() {
    if (this.connected) return;

    return new Promise((resolve, reject) => {
      this.socket = net.createConnection({
        host: this.host,
        port: this.port,
      }, () => {
        this.connected = true;
        resolve();
      });

      this.socket.on('error', (err) => {
        if (!this.connected) {
          reject(err);
        }
      });

      this.socket.on('data', (data) => {
        this._handleData(data);
      });

      this.socket.on('close', () => {
        this.connected = false;
        // Reject any pending waiters
        for (const resolver of this._waitResolvers) {
          if (resolver.onClose) resolver.onClose();
        }
        this._waitResolvers = [];
      });

      this.socket.on('end', () => {
        this.connected = false;
      });
    });
  }

  /** Disconnect from the GDB server */
  async disconnect() {
    if (!this.socket) return;
    this.connected = false;
    this.socket.end();
    this.socket = null;
    // Clear all pending state so stale data doesn't corrupt the next session
    this._recvBuffer = '';
    this._waitResolvers = [];
    this._commandInFlight = null;
    this._ackResolver = null;
    this._interruptResolver = null;
  }

  /** Handle incoming data, dispatch to waiters */
  _handleData(data) {
    const str = data.toString('latin1');
    this._recvBuffer += str;

    // Process acknowledgements and packets
    while (this._recvBuffer.length > 0) {
      // Check for ack/nack
      if (this._recvBuffer[0] === '+' || this._recvBuffer[0] === '-') {
        const ack = this._recvBuffer[0];
        this._recvBuffer = this._recvBuffer.slice(1);

        // If we have a pending ack waiter, resolve it
        if (ack === '+' && this._ackResolver) {
          const r = this._ackResolver;
          this._ackResolver = null;
          r(true);
        }
        continue;
      }

      // Check for interrupt (0x03)
      if (this._recvBuffer.charCodeAt(0) === 0x03) {
        this._recvBuffer = this._recvBuffer.slice(1);
        // Notify any interrupt waiter
        if (this._interruptResolver) {
          const r = this._interruptResolver;
          this._interruptResolver = null;
          r();
        }
        continue;
      }

      // Check for packet start
      if (this._recvBuffer[0] === '$') {
        // Find packet end
        const endIdx = this._recvBuffer.indexOf('#');
        if (endIdx === -1) break; // Not enough data yet

        // Need 2 more chars for checksum
        if (this._recvBuffer.length < endIdx + 3) break;

        const packetData = this._recvBuffer.slice(1, endIdx);
        const checksum = this._recvBuffer.slice(endIdx + 1, endIdx + 3);
        this._recvBuffer = this._recvBuffer.slice(endIdx + 3);

        // Verify checksum
        let calcChecksum = 0;
        for (let i = 0; i < packetData.length; i++) {
          calcChecksum = (calcChecksum + packetData.charCodeAt(i)) % 256;
        }
        const expectedChecksum = parseInt(checksum, 16);

        if (calcChecksum === expectedChecksum) {
          // Send positive ack
          this.socket.write('+');
          // Deliver to waiter
          if (this._waitResolvers.length > 0) {
            const resolver = this._waitResolvers.shift();
            resolver.resolve(packetData);
          }
        } else {
          // Send negative ack
          this.socket.write('-');
        }
        continue;
      }

      // Unknown byte, skip
      this._recvBuffer = this._recvBuffer.slice(1);
    }
  }

  /**
   * Send a GDB command and wait for response.
   * Handles the $<cmd>#<checksum> framing and + ack.
   *
   * GDB RSP is strictly sequential: one command → one response.
   * Do NOT pipeline multiple commands.
   */
  async sendCommand(command) {
    if (!this.connected) {
      throw new Error('Not connected to GDB server');
    }

    // Enforce sequential command execution
    while (this._commandInFlight) {
      await this._commandInFlight;
    }

    // Compute checksum
    let checksum = 0;
    for (let i = 0; i < command.length; i++) {
      checksum = (checksum + command.charCodeAt(i)) % 256;
    }
    const packet = `$${command}#${checksum.toString(16).padStart(2, '0')}`;

    // Create a waiter entry we can reference for cleanup
    let resolverEntry;
    let timeoutHandle;

    const responsePromise = new Promise((resolve, reject) => {
      resolverEntry = { resolve, reject, onClose: () => reject(new Error('Connection closed')) };
      this._waitResolvers.push(resolverEntry);
    });

    const commandPromise = responsePromise.finally(() => {
      clearTimeout(timeoutHandle);
      this._commandInFlight = null;
    });

    // Timeout wrapper — RPCS3 should respond within 10s
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        // Remove the stale waiter so it doesn't swallow a future response
        const idx = this._waitResolvers.indexOf(resolverEntry);
        if (idx !== -1) this._waitResolvers.splice(idx, 1);
        reject(new Error('GDB command timed out (10s): ' + command));
      }, 10000);
    });

    // Send packet
    this.socket.write(packet, 'latin1');

    this._commandInFlight = commandPromise.catch(() => {});

    return Promise.race([commandPromise, timeoutPromise]);
  }

  /** Send raw byte (for interrupt) */
  sendInterrupt() {
    if (this.connected) {
      this.socket.write(Buffer.from([0x03]));
    }
  }

  // ===================== High-level GDB Commands =====================

  /** `!` - Extended mode (no-op in RPCS3, returns OK) */
  async extendedMode() {
    return this.sendCommand('!');
  }

  /** `?` - Get stop reason (always S05 in RPCS3) */
  async getStopReason() {
    const resp = await this.sendCommand('?');
    return { raw: resp, signal: resp.startsWith('S') ? parseInt(resp.slice(1), 16) : null };
  }

  /** `qSupported` - Query supported features */
  async querySupported() {
    const resp = await this.sendCommand('qSupported');
    return { raw: resp, packetSize: resp.match(/PacketSize=([0-9a-f]+)/i)?.[1] };
  }

  /** `qfThreadInfo` - Get list of all PPU thread IDs */
  async getThreadList() {
    const resp = await this.sendCommand('qfThreadInfo');
    if (resp.startsWith('m')) {
      const ids = resp.slice(1, -1).split(',').filter(s => s).map(h => parseInt(h, 16));
      return ids;
    }
    return [];
  }

  /** `qC` - Get current thread ID */
  async getCurrentThread() {
    const resp = await this.sendCommand('qC');
    if (resp.startsWith('QC')) {
      return parseInt(resp.slice(2), 16);
    }
    return null;
  }

  /** `H` - Set thread for operations (type: 'c' for continue, 'g' for general ops) */
  async setThread(type, threadId) {
    // threadId -1 means ALL_THREADS
    const idStr = threadId === -1 ? '-1' : threadId.toString(16);
    return this.sendCommand(`H${type}${idStr}`);
  }

  /** `g` - Read all registers */
  async readAllRegisters() {
    const resp = await this.sendCommand('g');
    return this._parseAllRegisters(resp);
  }

  /** `G` - Write all registers */
  async writeAllRegisters(hexData) {
    return this.sendCommand(`G${hexData}`);
  }

  /** `p` - Read single register by name or ID */
  async readRegister(regNameOrId) {
    const rid = resolveRegId(regNameOrId);
    const resp = await this.sendCommand(`p${rid.toString(16)}`);
    if (resp.startsWith('E')) {
      throw new Error(`Error reading register ${regNameOrId} (id=${rid}): ${resp}`);
    }
    return resp;
  }

  /** `P` - Write single register by name or ID */
  async writeRegister(regNameOrId, hexValue) {
    const rid = resolveRegId(regNameOrId);
    const resp = await this.sendCommand(`P${rid.toString(16)}=${hexValue}`);
    if (resp.startsWith('E')) {
      throw new Error(`Error writing register ${regNameOrId} (id=${rid}): ${resp}`);
    }
    return resp;
  }

  /** `m` - Read memory */
  async readMemory(address, length) {
    const addrHex = address.toString(16);
    const lenHex = length.toString(16);
    const resp = await this.sendCommand(`m${addrHex},${lenHex}`);
    if (resp.startsWith('E')) {
      throw new Error(`Error reading memory at 0x${addrHex} len ${length}: ${resp}`);
    }
    return resp; // hex string
  }

  /** `M` - Write memory */
  async writeMemory(address, hexData) {
    const addrHex = address.toString(16);
    const lenHex = (hexData.length / 2).toString(16);
    const resp = await this.sendCommand(`M${addrHex},${lenHex}:${hexData}`);
    if (resp.startsWith('E')) {
      throw new Error(`Error writing memory at 0x${addrHex}: ${resp}`);
    }
    return resp;
  }

  /** `qAttached` - Query if attached to existing process (always 1) */
  async queryAttached() {
    return this.sendCommand('qAttached');
  }

  /** `k` - Kill (graceful shutdown of emulation) */
  async kill() {
    return this.sendCommand('k');
  }

  /** `vCont?` - Query supported vCont actions */
  async queryContinueSupport() {
    return this.sendCommand('vCont?');
  }

  /** `vCont;c` - Continue execution */
  async continue() {
    const resp = await this.sendCommand('vCont;c');
    return { raw: resp, signal: resp.startsWith('S') ? parseInt(resp.slice(1), 16) : null };
  }

  /** `vCont;s` - Single step (step into) */
  async step() {
    const resp = await this.sendCommand('vCont;s');
    return { raw: resp, signal: resp.startsWith('S') ? parseInt(resp.slice(1), 16) : null };
  }

  /** `Z0,<addr>` - Set software breakpoint */
  async setBreakpoint(address) {
    const addrHex = address.toString(16);
    const resp = await this.sendCommand(`Z0,${addrHex},4`);
    if (resp.startsWith('E')) {
      throw new Error(`Error setting breakpoint at 0x${addrHex}: ${resp}`);
    }
    return resp;
  }

  /** `z0,<addr>` - Remove software breakpoint */
  async removeBreakpoint(address) {
    const addrHex = address.toString(16);
    const resp = await this.sendCommand(`z0,${addrHex},4`);
    if (resp.startsWith('E')) {
      throw new Error(`Error removing breakpoint at 0x${addrHex}: ${resp}`);
    }
    return resp;
  }

  /** Send interrupt (0x03 raw byte) - breaks running emulation */
  interrupt() {
    this.sendInterrupt();
  }

  // ===================== Helper Methods =====================

  /**
   * Parse the `g` response into individual registers.
   * Layout (from GDB.cpp cmd_read_all_registers):
   *   regs 0-63: 8 bytes each (64 registers × 16 hex chars = 1024 chars)
   *   regs 64-68: 8 bytes each (5 registers × 16 hex chars = 80 chars)
   *   regs 66, 69, 70: 4 bytes (3 registers × 8 hex chars = 24 chars)
   * Total: 68×16 + 3×8 = 1088 + 24 = 1112 hex chars
   */
  _parseAllRegisters(hexStr) {
    const regs = {};
    let offset = 0;

    // The GDB.cpp code iterates i=0..70 and calls get_reg(ppu, i)
    // get_reg_size returns:
    //   66, 69, 70 -> 4 bytes
    //   everything else <= 70 -> 8 bytes
    // So the layout is:
    //   r0-r31 (0-31): 8 bytes each = 32 * 16 = 512 hex chars
    //   f0-f31 (32-63): 8 bytes each = 32 * 16 = 512 hex chars
    //   pc (64): 8 bytes = 16 hex chars
    //   msr (65): 8 bytes = 16 hex chars
    //   cr (66): 4 bytes = 8 hex chars
    //   lr (67): 8 bytes = 16 hex chars
    //   ctr (68): 8 bytes = 16 hex chars
    //   xer (69): 4 bytes = 8 hex chars
    //   fpscr (70): 4 bytes = 8 hex chars
    // Total: 512 + 512 + 16 + 16 + 8 + 16 + 16 + 8 + 8 = 1112 hex chars

    for (let id = 0; id <= 70; id++) {
      const size = (id === 66 || id === 69 || id === 70) ? 4 : 8;
      const hexLen = size * 2;
      const hexVal = hexStr.slice(offset, offset + hexLen);
      offset += hexLen;

      let name;
      if (id <= 31) name = `r${id}`;
      else if (id <= 63) name = `f${id - 32}`;
      else if (id === 64) name = 'pc';
      else if (id === 65) name = 'msr';
      else if (id === 66) name = 'cr';
      else if (id === 67) name = 'lr';
      else if (id === 68) name = 'ctr';
      else if (id === 69) name = 'xer';
      else if (id === 70) name = 'fpscr';

      regs[name] = hexVal;
      regs[`reg${id}`] = hexVal;

      // Also store as BigInt if readable
      const bigVal = paddedHexToBigInt(hexVal);
      if (bigVal !== null) {
        regs[`${name}_int`] = bigVal.toString();
      }
    }

    return regs;
  }

  /** Read register and return as integer (BigInt) */
  async readRegisterInt(regNameOrId) {
    const hex = await this.readRegister(regNameOrId);
    return paddedHexToBigInt(hex);
  }

  /** Read memory and return as Buffer */
  async readMemoryBuf(address, length) {
    const hex = await this.readMemory(address, length);
    return hexToBuf(hex);
  }

  /** Write memory from Buffer */
  async writeMemoryBuf(address, buf) {
    return this.writeMemory(address, bufToHex(buf));
  }

  /** Convenience: read a u32 from memory (big-endian, as PS3 memory is) */
  async readU32(address) {
    const buf = await this.readMemoryBuf(address, 4);
    return buf.readUInt32BE(0);
  }

  /** Convenience: read a u64 from memory */
  async readU64(address) {
    const buf = await this.readMemoryBuf(address, 8);
    return buf.readBigUInt64BE(0);
  }

  /** Convenience: write a u32 to memory */
  async writeU32(address, value) {
    const buf = Buffer.alloc(4);
    buf.writeUInt32BE(value >>> 0, 0);
    return this.writeMemoryBuf(address, buf);
  }
}