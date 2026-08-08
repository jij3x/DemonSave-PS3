#!/usr/bin/env node
/**
 * RPCS3 MCP Server - Model Context Protocol server for RPCS3 debugging.
 *
 * Exposes all RPCS3 GDB debug operations as MCP tools, allowing AI assistants
 * to control PS3 emulation: continue, step, set breakpoints, read/write
 * memory and registers, list threads, etc.
 *
 * Based on the GDB Remote Serial Protocol implementation in rpcs3/Emu/GDB.cpp.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  GdbClient,
  resolveRegId,
  getRegSize,
  hexToBuf,
  paddedHexToBigInt,
  bigIntToPaddedHex,
} from './gdb-client.js';

// Global GDB client instance - persists across tool calls
let gdb = null;
const DEFAULT_HOST = process.env.RPCS3_GDB_HOST || '127.0.0.1';
const DEFAULT_PORT = parseInt(process.env.RPCS3_GDB_PORT || '2345', 10);

/** Get or create the GDB client connection */
async function getClient(host, port) {
  const h = host || DEFAULT_HOST;
  const p = port || DEFAULT_PORT;
  if (!gdb || gdb.host !== h || gdb.port !== p) {
    if (gdb) await gdb.disconnect();
    gdb = new GdbClient(h, p);
    await gdb.connect();
  }
  return gdb;
}

/** Format a tool result as MCP content */
function result(text, isError = false) {
  return {
    content: [
      { type: 'text', text: typeof text === 'string' ? text : JSON.stringify(text, null, 2) },
    ],
    isError,
  };
}

/** Parse an address string (hex with 0x prefix or decimal) */
function parseAddr(addrStr) {
  if (typeof addrStr === 'number') return addrStr;
  const s = String(addrStr).trim();
  if (s.startsWith('0x') || s.startsWith('0X')) return parseInt(s, 16);
  return parseInt(s, 10);
}

// ============================ MCP Server ============================

const server = new McpServer({
  name: 'rpcs3-debugger',
  version: '1.0.0',
});

/**
 * Register an MCP tool. Wraps server.registerTool() (the non-deprecated API);
 * the SDK's generic overloads don't infer the zod-v4 Args under checkJs, so the
 * schema/handler are intentionally loosely typed here and the call needs a
 * suppression.
 *
 * @param {string} name
 * @param {string} description
 * @param {Record<string, any>} schema
 * @param {(args: any, extra: any) => unknown} handler
 */
function registerMcpTool(name, description, schema, handler) {
  // @ts-expect-error SDK registerTool() overloads don't infer zod-v4 Args under checkJs (TS2769)
  server.registerTool(name, { description, inputSchema: schema }, handler);
}

// -------------------- Connection Management --------------------

registerMcpTool(
  'connect',
  'Connect to RPCS3 GDB server (default 127.0.0.1:2345). Must be called before other debug commands.',
  {
    host: z.string().default('127.0.0.1').describe('GDB server host IP'),
    port: z.number().int().default(2345).describe('GDB server port'),
  },
  async ({ host, port }) => {
    try {
      const client = await getClient(host, port);
      const supported = await client.querySupported();
      const attached = await client.queryAttached();
      return result({
        status: 'connected',
        host: client.host,
        port: client.port,
        supportedFeatures: supported.raw,
        packetSize: supported.packetSize,
        attached: attached,
      });
    } catch (e) {
      return result(`Failed to connect: ${e.message}`, true);
    }
  },
);

registerMcpTool('disconnect', 'Disconnect from RPCS3 GDB server.', {}, async () => {
  if (gdb) {
    await gdb.disconnect();
    gdb = null;
  }
  return result({ status: 'disconnected' });
});

// -------------------- Status & Info --------------------

registerMcpTool(
  'get_stop_reason',
  'Get the reason the target stopped (GDB `?` command). Returns signal number (5=SIGTRAP/breakpoint).',
  {},
  async () => {
    try {
      const client = await getClient();
      const reason = await client.getStopReason();
      return result(reason);
    } catch (e) {
      return result(e.message, true);
    }
  },
);

registerMcpTool(
  'query_supported',
  'Query GDB server supported features (qSupported).',
  {},
  async () => {
    try {
      const client = await getClient();
      const supported = await client.querySupported();
      return result(supported);
    } catch (e) {
      return result(e.message, true);
    }
  },
);

registerMcpTool(
  'query_attached',
  'Query if attached to an existing process (qAttached). RPCS3 always returns 1.',
  {},
  async () => {
    try {
      const client = await getClient();
      const attached = await client.queryAttached();
      return result({ attached: attached });
    } catch (e) {
      return result(e.message, true);
    }
  },
);

// -------------------- Thread Management --------------------

registerMcpTool(
  'list_threads',
  'List all PPU thread IDs (qfThreadInfo). Returns hex thread IDs.',
  {},
  async () => {
    try {
      const client = await getClient();
      const threads = await client.getThreadList();
      return result({ threads: threads.map((t) => `0x${t.toString(16)}`), count: threads.length });
    } catch (e) {
      return result(e.message, true);
    }
  },
);

registerMcpTool(
  'get_current_thread',
  'Get the currently selected thread ID (qC).',
  {},
  async () => {
    try {
      const client = await getClient();
      const tid = await client.getCurrentThread();
      return result({ threadId: tid !== null ? `0x${tid.toString(16)}` : null });
    } catch (e) {
      return result(e.message, true);
    }
  },
);

registerMcpTool(
  'set_thread',
  'Set which thread to use for subsequent operations (H command). Use type "c" for continue/step ops, "g" for general (register/memory) ops. Use threadId -1 for all threads.',
  {
    type: z
      .enum(['c', 'g'])
      .describe('"c" for continue/step operations, "g" for general operations'),
    threadId: z
      .union([z.string(), z.number(), z.literal(-1)])
      .describe('Thread ID (hex string like "0x123" or number, -1 for all threads)'),
  },
  async ({ type, threadId }) => {
    try {
      let tid;
      if (threadId === -1) {
        tid = -1;
      } else if (typeof threadId === 'string') {
        tid = parseAddr(threadId);
      } else {
        tid = threadId;
      }
      const client = await getClient();
      const resp = await client.setThread(type, tid);
      return result({ response: resp, threadId: tid === -1 ? 'ALL' : `0x${tid.toString(16)}` });
    } catch (e) {
      return result(e.message, true);
    }
  },
);

// -------------------- Execution Control --------------------

registerMcpTool(
  'continue',
  'Continue execution (vCont;c). Runs until a breakpoint is hit or an interrupt is received. This is a blocking call.',
  {},
  async () => {
    try {
      const client = await getClient();
      const result_ = await client.continue();
      return result({
        status: 'stopped',
        signal: result_.signal,
        signalName: result_.signal === 5 ? 'SIGTRAP' : `signal ${result_.signal}`,
      });
    } catch (e) {
      return result(e.message, true);
    }
  },
);

registerMcpTool(
  'step',
  'Step one instruction (vCont;s / step into). Executes a single PPU instruction and stops.',
  {},
  async () => {
    try {
      const client = await getClient();
      const result_ = await client.step();
      return result({
        status: 'stopped',
        signal: result_.signal,
        signalName: result_.signal === 5 ? 'SIGTRAP' : `signal ${result_.signal}`,
      });
    } catch (e) {
      return result(e.message, true);
    }
  },
);

registerMcpTool(
  'interrupt',
  'Send interrupt (0x03 / Ctrl-C) to break running emulation. Use this to pause a running game.',
  {},
  async () => {
    try {
      const client = await getClient();
      client.interrupt();
      return result({ status: 'interrupt_sent' });
    } catch (e) {
      return result(e.message, true);
    }
  },
);

registerMcpTool(
  'kill',
  'Kill the emulated process (k command). Gracefully shuts down emulation in RPCS3.',
  {},
  async () => {
    try {
      const client = await getClient();
      const resp = await client.kill();
      return result({ status: 'killed', response: resp });
    } catch (e) {
      return result(e.message, true);
    }
  },
);

registerMcpTool(
  'query_continue_support',
  'Query what vCont actions the server supports (vCont?).',
  {},
  async () => {
    try {
      const client = await getClient();
      const resp = await client.queryContinueSupport();
      return result({ supported: resp, actions: resp.split(';').filter((a) => a) });
    } catch (e) {
      return result(e.message, true);
    }
  },
);

// -------------------- Breakpoints --------------------

registerMcpTool(
  'set_breakpoint',
  'Set a software breakpoint at an address (Z0 command). Address must be 4-byte aligned. PPU decoder must be set to Interpreter (not LLVM).',
  {
    address: z
      .union([z.string(), z.number()])
      .describe('Breakpoint address (hex like "0x12345678" or decimal number)'),
  },
  async ({ address }) => {
    try {
      const addr = parseAddr(address);
      const client = await getClient();
      const resp = await client.setBreakpoint(addr);
      return result({
        status: 'breakpoint_set',
        address: `0x${addr.toString(16)}`,
        response: resp,
      });
    } catch (e) {
      return result(e.message, true);
    }
  },
);

registerMcpTool(
  'remove_breakpoint',
  'Remove a software breakpoint at an address (z0 command).',
  {
    address: z
      .union([z.string(), z.number()])
      .describe('Breakpoint address (hex like "0x12345678" or decimal number)'),
  },
  async ({ address }) => {
    try {
      const addr = parseAddr(address);
      const client = await getClient();
      const resp = await client.removeBreakpoint(addr);
      return result({
        status: 'breakpoint_removed',
        address: `0x${addr.toString(16)}`,
        response: resp,
      });
    } catch (e) {
      return result(e.message, true);
    }
  },
);

// -------------------- Register Access --------------------

registerMcpTool(
  'read_register',
  'Read a single PPU register by name or ID (p command). Names: r0-r31, f0-f31, pc, msr, cr, lr, ctr, xer, fpscr. Returns hex value.',
  {
    register: z.string().describe('Register name (e.g. "r3", "pc", "lr") or numeric ID (0-70)'),
  },
  async ({ register }) => {
    try {
      const client = await getClient();
      const hex = await client.readRegister(register);
      const bigVal = paddedHexToBigInt(hex);
      return result({
        register: register,
        hex: hex,
        value: bigVal !== null ? bigVal.toString() : null,
        address:
          (register.toLowerCase() === 'pc' || register.toLowerCase() === 'cia') && bigVal
            ? `0x${BigInt(bigVal).toString(16)}`
            : undefined,
      });
    } catch (e) {
      return result(e.message, true);
    }
  },
);

registerMcpTool(
  'write_register',
  'Write a single PPU register by name or ID (P command). Value can be hex string or integer.',
  {
    register: z.string().describe('Register name (e.g. "r3", "pc", "lr") or numeric ID (0-70)'),
    value: z
      .union([z.string(), z.number()])
      .describe('Value to write (hex string like "0x12345678" or integer)'),
  },
  async ({ register, value }) => {
    try {
      const rid = resolveRegId(register);
      const size = getRegSize(rid);
      let hexVal;
      if (typeof value === 'string' && (value.startsWith('0x') || value.startsWith('0X'))) {
        const bigVal = BigInt(value);
        hexVal = bigIntToPaddedHex(bigVal, size);
      } else if (
        typeof value === 'string' &&
        /^[0-9a-fA-F]+$/.test(value) &&
        value.length === size * 2
      ) {
        hexVal = value;
      } else {
        const bigVal = BigInt(value);
        hexVal = bigIntToPaddedHex(bigVal, size);
      }
      const client = await getClient();
      const resp = await client.writeRegister(register, hexVal);
      return result({ status: 'ok', register: register, value: hexVal, response: resp });
    } catch (e) {
      return result(e.message, true);
    }
  },
);

registerMcpTool(
  'read_all_registers',
  'Read all 71 PPU registers at once (g command). Returns GPR0-31, FPR0-31, PC, MSR, CR, LR, CTR, XER, FPSCR.',
  {},
  async () => {
    try {
      const client = await getClient();
      const regs = await client.readAllRegisters();
      return result(regs);
    } catch (e) {
      return result(e.message, true);
    }
  },
);

registerMcpTool(
  'read_pc',
  'Convenience: Read the current Program Counter (PC/CIA). Returns the address of the next instruction to execute.',
  {},
  async () => {
    try {
      const client = await getClient();
      const hex = await client.readRegister('pc');
      const pc = paddedHexToBigInt(hex);
      return result({ pc: `0x${BigInt(pc).toString(16)}`, raw: hex });
    } catch (e) {
      return result(e.message, true);
    }
  },
);

// -------------------- Memory Access --------------------

registerMcpTool(
  'read_memory',
  'Read memory as hex (m command). Returns hex-encoded bytes from PS3 virtual memory.',
  {
    address: z
      .union([z.string(), z.number()])
      .describe('Memory address (hex like "0x12345678" or decimal)'),
    length: z.union([z.string(), z.number()]).describe('Number of bytes to read (hex or decimal)'),
  },
  async ({ address, length }) => {
    try {
      const addr = parseAddr(address);
      const len = typeof length === 'string' ? parseAddr(length) : length;
      const client = await getClient();
      const hex = await client.readMemory(addr, len);
      return result({ address: `0x${addr.toString(16)}`, length: len, hex: hex });
    } catch (e) {
      return result(e.message, true);
    }
  },
);

registerMcpTool(
  'read_memory_ascii',
  'Read memory and decode as ASCII string.',
  {
    address: z.union([z.string(), z.number()]).describe('Memory address'),
    length: z.union([z.string(), z.number()]).describe('Number of bytes to read'),
  },
  async ({ address, length }) => {
    try {
      const addr = parseAddr(address);
      const len = typeof length === 'string' ? parseAddr(length) : length;
      const client = await getClient();
      const hex = await client.readMemory(addr, len);
      const buf = hexToBuf(hex);
      // Filter to printable ASCII
      const ascii = buf.toString('ascii').replace(/[^\x20-\x7E]/g, '.');
      return result({ address: `0x${addr.toString(16)}`, length: len, ascii: ascii, hex: hex });
    } catch (e) {
      return result(e.message, true);
    }
  },
);

registerMcpTool(
  'read_memory_u32',
  'Read a 32-bit big-endian unsigned integer from memory (PS3 is big-endian).',
  {
    address: z.union([z.string(), z.number()]).describe('Memory address'),
  },
  async ({ address }) => {
    try {
      const addr = parseAddr(address);
      const client = await getClient();
      const val = await client.readU32(addr);
      return result({
        address: `0x${addr.toString(16)}`,
        value: val,
        hex: `0x${val.toString(16).padStart(8, '0')}`,
      });
    } catch (e) {
      return result(e.message, true);
    }
  },
);

registerMcpTool(
  'read_memory_u64',
  'Read a 64-bit big-endian unsigned integer from memory.',
  {
    address: z.union([z.string(), z.number()]).describe('Memory address'),
  },
  async ({ address }) => {
    try {
      const addr = parseAddr(address);
      const client = await getClient();
      const val = await client.readU64(addr);
      return result({
        address: `0x${addr.toString(16)}`,
        value: val.toString(),
        hex: `0x${BigInt(val).toString(16).padStart(16, '0')}`,
      });
    } catch (e) {
      return result(e.message, true);
    }
  },
);

registerMcpTool(
  'write_memory',
  'Write hex data to memory (M command). Data must be hex-encoded bytes.',
  {
    address: z.union([z.string(), z.number()]).describe('Memory address'),
    hexData: z.string().describe('Hex-encoded bytes to write (e.g. "48656c6c6f" for "Hello")'),
  },
  async ({ address, hexData }) => {
    try {
      const addr = parseAddr(address);
      const client = await getClient();
      const resp = await client.writeMemory(addr, hexData);
      return result({
        status: 'ok',
        address: `0x${addr.toString(16)}`,
        bytesWritten: hexData.length / 2,
        response: resp,
      });
    } catch (e) {
      return result(e.message, true);
    }
  },
);

registerMcpTool(
  'write_memory_u32',
  'Write a 32-bit big-endian value to memory.',
  {
    address: z.union([z.string(), z.number()]).describe('Memory address'),
    value: z
      .union([z.string(), z.number()])
      .describe('Value to write (hex string like "0x12345678" or integer)'),
  },
  async ({ address, value }) => {
    try {
      const addr = parseAddr(address);
      let val;
      if (typeof value === 'string' && (value.startsWith('0x') || value.startsWith('0X'))) {
        val = parseInt(value, 16);
      } else {
        val = typeof value === 'string' ? parseInt(value, 10) : value;
      }
      const client = await getClient();
      await client.writeU32(addr, val);
      return result({
        status: 'ok',
        address: `0x${addr.toString(16)}`,
        value: `0x${(val >>> 0).toString(16).padStart(8, '0')}`,
      });
    } catch (e) {
      return result(e.message, true);
    }
  },
);

// -------------------- Extended Mode --------------------

registerMcpTool(
  'extended_mode',
  'Switch to extended mode (! command). No-op in RPCS3, always returns OK.',
  {},
  async () => {
    try {
      const client = await getClient();
      const resp = await client.extendedMode();
      return result({ response: resp });
    } catch (e) {
      return result(e.message, true);
    }
  },
);

// -------------------- Raw Command --------------------

registerMcpTool(
  'send_raw_command',
  'Send a raw GDB RSP command. For advanced use when a specific command is not covered by other tools. The command string should NOT include the $ and # framing.',
  {
    command: z
      .string()
      .describe('Raw GDB command (e.g. "m1234,10" to read memory, "g" for all registers)'),
  },
  async ({ command }) => {
    try {
      const client = await getClient();
      const resp = await client.sendCommand(command);
      return result({ command: command, response: resp });
    } catch (e) {
      return result(e.message, true);
    }
  },
);

// -------------------- Dump State --------------------

registerMcpTool(
  'dump_state',
  'Convenience: Dump current debug state - stop reason, current thread, PC, and all registers. Great for getting a snapshot of the current state.',
  {},
  async () => {
    try {
      const client = await getClient();
      // GDB RSP is strictly sequential — must await each command separately
      const reason = await client.getStopReason();
      const threads = await client.getThreadList();
      const currentThread = await client.getCurrentThread();
      const regs = await client.readAllRegisters();

      return result({
        stopReason: reason,
        threads: threads.map((t) => `0x${t.toString(16)}`),
        threadCount: threads.length,
        currentThread: currentThread !== null ? `0x${currentThread.toString(16)}` : null,
        pc: regs.pc_int ? `0x${BigInt(regs.pc_int).toString(16)}` : regs.pc,
        lr: regs.lr_int ? `0x${BigInt(regs.lr_int).toString(16)}` : regs.lr,
        registers: regs,
      });
    } catch (e) {
      return result(e.message, true);
    }
  },
);

// -------------------- Start Server --------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('RPCS3 MCP Server started on stdio');
  console.error(`Default GDB target: ${DEFAULT_HOST}:${DEFAULT_PORT}`);
  console.error('Use the "connect" tool to connect to RPCS3\'s GDB server.');
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
