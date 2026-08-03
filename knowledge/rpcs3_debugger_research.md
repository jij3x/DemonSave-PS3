# RPCS3 External Debugger Deep Research

## Overview

RPCS3 implements an **external debugger interface** via a built-in **GDB Remote Serial Protocol (GDB RSP) server**. This allows any GDB-compatible client (or custom TCP client implementing the GDB RSP protocol) to connect to RPCS3 over TCP and control emulation: set breakpoints, step instructions, read/write memory, read/write registers, and more.

The implementation lives in two files:

| File | Purpose |
|------|---------|
| `rpcs3/Emu/GDB.h` | Class declaration, command handler prototypes |
| `rpcs3/Emu/GDB.cpp` | Full implementation: TCP server, packet parsing, all command handlers |

Supporting files:

| File | Role |
|------|------|
| `rpcs3/Emu/system_config.h` | Config entry `gdb_server` (bind address/port) |
| `rpcs3/Emu/CPU/CPUThread.cpp` | CPU thread debug flags (`dbg_step`, `dbg_pause`), calls `gdb_server::pause_from()` |
| `rpcs3/Emu/Cell/PPUThread.cpp` | `ppu_breakpoint()` function, `ppu_break()` breakpoint handler |

---

## How to Set Up the External Debugger

### Step 1: Configure the GDB Server Address

Edit RPCS3's config file (`config.yml`), under the `Miscellaneous` section:

```yaml
Miscellaneous:
  GDB Server: "127.0.0.1:2345"   # default value
```

- **Format**: `IP:PORT` for TCP (e.g., `127.0.0.1:2345`)
- **Empty string** (`""`): GDB server is **disabled**
- **Non-IP string**: Falls back to a **Unix domain socket** at that path
- **Default**: `127.0.0.1:2345` (localhost, port 2345)

> **Note**: There is no GUI settings dialog entry for the GDB server. It must be configured by editing `config.yml` directly. The config entry is defined at `system_config.h:379`:
> ```cpp
> cfg::string gdb_server{ this, "GDB Server", "127.0.0.1:2345" };
> ```

### Step 2: Boot a Game

The GDB server starts automatically when RPCS3 boots a game. It is created as an FXO (emulated system object) via `g_fxo->get<gdb_server>()` and runs in its own named thread ("GDB Server").

When a client connects, RPCS3 **immediately pauses** the emulator if it's running (`GDB.cpp:948-951`):
```cpp
if (Emu.IsRunning())
{
    Emu.Pause();
}
```

### Step 3: Connect with GDB (or Custom Client)

```bash
# Using powerpc64le target (RPCS3 emulates Cell Broadband Engine PPU)
gdb -ex "target remote 127.0.0.1:2345"
```

Or from within GDB:
```
(gdb) set architecture powerpc:common64
(gdb) target remote 127.0.0.1:2345
```

### Additional Config: "Assume External Debugger"

```yaml
Core:
  Assume External Debugger: true   # config key: "Assume External Debugger"
```

This setting (`system_config.h:98`) controls `is_debugger_present()` in `Utilities/Thread.cpp:201`:
```cpp
bool is_debugger_present()
{
    if (g_cfg.core.external_debugger)
        return true;
    return IsDebuggerPresent();
}
```

When enabled, RPCS3 assumes a debugger is always attached, which affects crash handler behavior (it will wait for the debugger to break rather than auto-recovering).

### PPU Decoder Requirement

Breakpoints only work with the **interpreter** PPU decoder. The `ppu_breakpoint()` function (`PPUThread.cpp:1231`) explicitly checks:
```cpp
if (addr % 4 || !vm::check_addr(addr, vm::page_executable) || g_cfg.core.ppu_decoder == ppu_decoder_type::llvm)
{
    return false;
}
```

So you **must** set `PPU Decoder` to `Interpreter` or `Interpreter (fast)` in config:
```yaml
Core:
  PPU Decoder: 1   # 0 = interpreter, 1 = interpreter fast, 2 = LLVM
```

> **Note**: Values may vary by version; check `ppu_decoder_type` enum. The key point is: **LLVM JIT mode disables GDB breakpoints**.

---

## GDB Remote Serial Protocol Implementation

RPCS3 implements the standard GDB Remote Serial Protocol (RSP). The wire format is:

```
$<packet-data>#<2-hex-checksum>
```

- Packets start with `$`, end with `#`, followed by a 2-character hex checksum (sum of all bytes mod 256)
- Acknowledgement: `+` (accepted) or `-` (rejected, resend)
- **Interrupt**: A raw `0x03` byte (Ctrl-C) sent outside a packet interrupts execution
- **Run-length encoding**: Not explicitly supported, but escaped characters use `}` followed by `char ^ 0x20`

### Packet Parsing (`try_read_cmd`, lines 253-317)

Commands are split into a `cmd` part and `data` part by separators `:`, `.`, or `;`. Single-character commands are parsed as-is. Multi-character commands are only allowed for `q` (query) and `v` (verbose) prefixes.

### Thread Model

- `ALL_THREADS = 0xFFFFFFFFFFFFFFFF` — applies to all threads
- `ANY_THREAD = 0` — any available thread
- `continue_ops_thread_id` — thread for continue/step operations (set via `Hc`)
- `general_ops_thread_id` — thread for register/memory operations (set via `Hg`)
- **All-stop mode**: When any thread stops, all threads are paused

---

## Complete List of Supported GDB Commands

The command dispatch table is at `GDB.cpp:967-984`. Here is the **exhaustive list** of all 18 commands RPCS3 accepts:

### 1. `!` — Extended Mode (`cmd_extended_mode`)

| Field | Value |
|-------|-------|
| **GDB command** | `!` |
| **Handler** | `cmd_extended_mode` (line 555) |
| **Data** | None |
| **Response** | `OK` |
| **Purpose** | Switch to extended mode. RPCS3 always responds `OK` but doesn't actually change behavior. |

### 2. `?` — Get Stop Reason (`cmd_reason`)

| Field | Value |
|-------|-------|
| **GDB command** | `?` |
| **Handler** | `cmd_reason` (line 560) |
| **Data** | None |
| **Response** | `S05` (signal 5 = SIGTRAP) |
| **Purpose** | Returns why the target stopped. Always returns `S05` (trap/breakpoint). |

### 3. `qSupported` — Query Supported Features (`cmd_supported`)

| Field | Value |
|-------|-------|
| **GDB command** | `qSupported` |
| **Handler** | `cmd_supported` (line 565) |
| **Data** | Client capabilities (ignored) |
| **Response** | `PacketSize=1200` |
| **Purpose** | Negotiates protocol features. RPCS3 advertises max packet size of 0x1200 bytes. Does **not** advertise support for multiprocess, no-resume, or other extensions. |

### 4. `qfThreadInfo` — Get Thread List (`cmd_thread_info`)

| Field | Value |
|-------|-------|
| **GDB command** | `qfThreadInfo` |
| **Handler** | `cmd_thread_info` (line 570) |
| **Data** | None |
| **Response** | `m<thread1>,<thread2>,...l` |
| **Purpose** | Returns list of all PPU thread IDs in hex. Format: `m` prefix, comma-separated hex IDs, `l` suffix. SPU threads are commented out (`//idm::select<named_thread<spu_thread>>...`). |

**Example response**: `m000000000000000100000000000002030000000000000004l`

### 5. `qC` — Get Current Thread (`cmd_current_thread`)

| Field | Value |
|-------|-------|
| **GDB command** | `qC` |
| **Handler** | `cmd_current_thread` (line 590) |
| **Data** | None |
| **Response** | `QC<hex-id>` or empty string |
| **Purpose** | Returns the currently selected thread ID. |

### 6. `p` — Read Single Register (`cmd_read_register`)

| Field | Value |
|-------|-------|
| **GDB command** | `p<reg-id>` |
| **Handler** | `cmd_read_register` (line 595) |
| **Data** | Hex register ID |
| **Response** | Hex register value, or `E01` (bad reg), or `E02` (no thread) |
| **Purpose** | Reads a single register from the selected thread. |

### 7. `P` — Write Single Register (`cmd_write_register`)

| Field | Value |
|-------|-------|
| **GDB command** | `P<reg-id>=<hex-value>` |
| **Handler** | `cmd_write_register` (line 623) |
| **Data** | `<hex-reg-id>=<hex-value>` |
| **Response** | `OK`, or `E01` (bad reg), or `E02` (bad format/no thread) |
| **Purpose** | Writes a single register to the selected thread. |

### 8. `m` — Read Memory (`cmd_read_memory`)

| Field | Value |
|-------|-------|
| **GDB command** | `m<addr>,<length>` |
| **Handler** | `cmd_read_memory` (line 656) |
| **Data** | `<hex-addr>,<hex-length>` |
| **Response** | Hex-encoded bytes, or `E01` (nothing readable) |
| **Purpose** | Reads `length` bytes from virtual address `addr`. Stops at first unmapped page. |

### 9. `M` — Write Memory (`cmd_write_memory`)

| Field | Value |
|-------|-------|
| **GDB command** | `M<addr>,<length>:<hex-data>` |
| **Handler** | `cmd_write_memory` (line 683) |
| **Data** | `<hex-addr>,<hex-length>:<hex-bytes>` |
| **Response** | `OK`, or `E01` (malformed), `E02` (bad hex), `E03` (not writable) |
| **Purpose** | Writes bytes to virtual address. Checks `vm::page_writable` for each address. |

### 10. `g` — Read All Registers (`cmd_read_all_registers`)

| Field | Value |
|-------|-------|
| **GDB command** | `g` |
| **Handler** | `cmd_read_all_registers` (line 717) |
| **Data** | None |
| **Response** | Concatenated hex values for all 71 registers |
| **Purpose** | Reads all registers (GPR 0-31, FPR 0-31, PC, MSR, CR, LR, CTR, XER, FPSCR). |

### 11. `G` — Write All Registers (`cmd_write_all_registers`)

| Field | Value |
|-------|-------|
| **GDB command** | `G<hex-data>` |
| **Handler** | `cmd_write_all_registers` (line 742) |
| **Data** | Concatenated hex values for all registers |
| **Response** | `OK`, or `E01` |
| **Purpose** | Writes all registers at once. |

### 12. `H` — Set Thread for Operations (`cmd_set_thread_ops`)

| Field | Value |
|-------|-------|
| **GDB command** | `H<op><thread-id>` |
| **Handler** | `cmd_set_thread_ops` (line 767) |
| **Data** | `<op-type><hex-thread-id>` where op-type is `c` (continue ops) or `g` (general ops) |
| **Response** | `OK`, or `E01` (thread not found) |
| **Purpose** | Selects which thread subsequent operations apply to. `Hc` sets continue/step thread, `Hg` sets general (register/memory) thread. Thread ID `-1` means ALL_THREADS. |

### 13. `qAttached` — Query Attach Status (`cmd_attached_to_what`)

| Field | Value |
|-------|-------|
| **GDB command** | `qAttached` |
| **Handler** | `cmd_attached_to_what` (line 788) |
| **Data** | None |
| **Response** | `1` (attached to existing process) |
| **Purpose** | Always returns `1` (attached). Process creation from client is not supported. |

### 14. `k` — Kill (`cmd_kill`)

| Field | Value |
|-------|-------|
| **GDB command** | `k` |
| **Handler** | `cmd_kill` (line 794) |
| **Data** | None |
| **Response** | None (connection closed) |
| **Purpose** | Gracefully shuts down the emulated process (`Emu.GracefulShutdown()`). |

### 15. `vCont?` — Query Continue Support (`cmd_continue_support`)

| Field | Value |
|-------|-------|
| **GDB command** | `vCont?` |
| **Handler** | `cmd_continue_support` (line 801) |
| **Data** | None |
| **Response** | `vCont;c;s;C;S` |
| **Purpose** | Advertises supported vCont actions: `c` (continue), `s` (step), `C` (continue with signal), `S` (step with signal). |

### 16. `vCont` — Continue/Step (`cmd_vcont`)

| Field | Value |
|-------|-------|
| **GDB command** | `vCont;<action>` |
| **Handler** | `cmd_vcont` (line 806) |
| **Data** | `;<action>` where action is `c` (continue) or `s` (step) |
| **Response** | `S05` (stopped, signal 5 = SIGTRAP) |
| **Purpose** | **This is the main execution control command.** See details below. |

**Implementation detail** (lines 806-857):
- Only `c` (continue) and `s` (step) actions are actually handled. `C` and `S` (with signal) are advertised but not separately processed.
- For **continue** (`vCont;c`):
  - Removes `dbg_pause` flag from the selected thread
  - Resumes emulation (`Emu.Run()` or `Emu.Resume()`)
  - Blocks on `wait_with_interrupts()` until paused (either by breakpoint or interrupt `0x03`)
  - Pauses all threads (all-stop mode)
  - Returns `S05`
- For **step** (`vCont;s`):
  - Sets `cpu_flag::dbg_step` on the selected thread
  - Removes `dbg_pause` flag
  - Resumes emulation
  - Waits for the thread to execute one instruction (the `dbg_step` flag triggers `dbg_pause` after PC changes, see `CPUThread.cpp:907-923`)
  - Returns `S05`

### 17. `z` — Remove Breakpoint (`cmd_remove_breakpoint`)

| Field | Value |
|-------|-------|
| **GDB command** | `z<type>,<addr>,<length>` |
| **Handler** | `cmd_remove_breakpoint` (line 886) |
| **Data** | `<type>,<hex-addr>` (length is ignored) |
| **Response** | `OK`, or `E01` (parse error), or empty (unsupported type) |
| **Purpose** | Removes a breakpoint. Only type `0` (software breakpoint) is supported. |

### 18. `Z` — Set Breakpoint (`cmd_set_breakpoint`)

| Field | Value |
|-------|-------|
| **GDB command** | `Z<type>,<addr>,<length>` |
| **Handler** | `cmd_set_breakpoint` (line 861) |
| **Data** | `<type>,<hex-addr>` (length is ignored) |
| **Response** | `OK`, or `E01` (conditional BP not supported / parse error), `E02` (parse fail), or empty (unsupported type) |
| **Purpose** | Sets a breakpoint. Only type `0` (software breakpoint) is supported. |

**Breakpoint types** (per GDB protocol):
| Type | Meaning | RPCS3 Support |
|------|---------|---------------|
| `0` | Software breakpoint | ✅ Supported (via `ppu_breakpoint()`) |
| `1` | Hardware breakpoint | ❌ Returns empty |
| `2` | Write watchpoint | ❌ Returns empty |
| `3` | Read watchpoint | ❌ Returns empty |
| `4` | Access watchpoint | ❌ Returns empty |

**Conditional breakpoints**: Not supported. If a condition (`;` in data) is present, returns `E01`.

### 19. `0x03` (Ctrl-C) — Interrupt

| Field | Value |
|-------|-------|
| **GDB command** | Raw `0x03` byte (not a packet) |
| **Handler** | `try_read_cmd` (line 257) / `wait_with_interrupts` (line 530) |
| **Response** | None (asynchronous stop) |
| **Purpose** | Interrupts running emulation. During `vCont;c`, the `wait_with_interrupts()` loop monitors for `0x03` and sets `paused = true` when received. |

### Unsupported Commands

Any command not in the list above receives an **empty response** (`""`) with positive acknowledgement, per GDB protocol convention. The code at `GDB.cpp:986-990`:
```cpp
GDB.trace("Unsupported command received: '%s'.", cmd.cmd);
if (!send_cmd_ack(""))
{
    break;
}
```

**Notable GDB commands NOT supported by RPCS3:**

| Command | Purpose | Status |
|---------|---------|--------|
| `D` | Detach | ❌ Not implemented |
| `T` | Check thread alive | ❌ Not implemented |
| `R` | Restart | ❌ Not implemented |
| `X` | Binary memory write | ❌ Not implemented (use `M` instead) |
| `qXfer:` | Extended data transfer (memory maps, target XML) | ❌ Not implemented |
| `qOffsets` | Section offsets | ❌ Not implemented |
| `qSymbol` | Symbol lookup | ❌ Not implemented |
| `qTStatus` | Tracepoint status | ❌ Not implemented |
| `Z1`-`Z4` | Hardware BP / watchpoints | ❌ Not implemented |

---

## Register Map

RPCS3 exposes PPU (PowerPC 64-bit) registers as defined by GDB's `powerpc-64` target. The register IDs are hardcoded in `get_reg()` (`GDB.cpp:437-466`):

| GDB Reg ID | Register | Size | Read | Write |
|------------|----------|------|------|-------|
| 0–31 | GPR0–GPR31 (General Purpose Registers) | 8 bytes | ✅ `thread->gpr[rid]` | ✅ |
| 32–63 | FPR0–FPR31 (Floating Point Registers) | 8 bytes | ✅ `thread->fpr[rid-32]` | ✅ |
| 64 | PC / CIA (Current Instruction Address) | 8 bytes | ✅ `thread->cia` | ✅ |
| 65 | MSR (Machine State Register) | 8 bytes | ✅ Returns `xxxxxxxxxxxxxxxx` (unreadable) | ✅ No-op (accepted, ignored) |
| 66 | CR (Condition Register) | 4 bytes | ✅ `thread->cr.pack()` | ✅ `thread->cr.unpack()` |
| 67 | LR (Link Register) | 8 bytes | ✅ `thread->lr` | ✅ |
| 68 | CTR (Count Register) | 8 bytes | ✅ `thread->ctr` | ✅ |
| 69 | XER (Fixed-Point Exception Register) | 4 bytes | ✅ Returns `xxxxxxxx` (unreadable) | ✅ No-op |
| 70 | FPSCR (Floating Point Status/Control) | 4 bytes | ✅ Returns `xxxxxxxx` (unreadable) | ✅ No-op |
| >70 | Invalid | — | Returns `""` (error) | Returns `false` |

**Total registers**: 71 (read via `g`/`G` commands as 68×16 + 3×8 = 1112 hex chars)

---

## Debug Flow: How Step Into / Step Out / Break Works

### Run / Continue

1. Client sends `vCont;c`
2. `cmd_vcont()` removes `cpu_flag::dbg_pause` from the selected PPU thread
3. Calls `Emu.Resume()` (or `Emu.Run()` if not yet started)
4. Enters `wait_with_interrupts()` — blocks reading the socket for `0x03` (interrupt)
5. When a breakpoint hits, `ppu_break()` sets `cpu_flag::dbg_pause` on the thread
6. `CPUThread::check_state()` (line 1065-1067) detects `dbg_pause` and calls `gdb_server::pause_from(this)`
7. `pause_from()` sets `paused = true` and notifies the GDB thread
8. `wait_with_interrupts()` returns; `cmd_vcont()` pauses all threads (all-stop), returns `S05`

### Step Into (Single Step)

1. Client sends `vCont;s`
2. `cmd_vcont()` sets `cpu_flag::dbg_step` on the selected PPU thread, removes `dbg_pause`
3. Resumes emulation
4. In `CPUThread::check_state()` (lines 906-923), when `dbg_step` is set:
   - After the thread executes one instruction, PC changes
   - `get_pc()` (current PC) != `get_pc2()` (saved `dbg_step_pc`)
   - `dbg_step` is removed, `dbg_pause` is added
   - This causes the thread to stop after one instruction
5. `pause_from()` is called → GDB server is notified → returns `S05`

> **Note**: "Step out" and "step over" are **not natively supported** by RPCS3's GDB server. GDB clients implement these by setting temporary breakpoints at the return address (step out) or next instruction after the current function call (step over), then doing a continue. This works through the `Z0`/`z0` breakpoint commands.

### Breakpoints

1. Client sends `Z0,<addr>` to set a breakpoint
2. `cmd_set_breakpoint()` calls `ppu_breakpoint(addr, true)`
3. `ppu_breakpoint()` (`PPUThread.cpp:1231`):
   - Validates: address must be 4-byte aligned, executable page, and PPU decoder must not be LLVM
   - Replaces the instruction function pointer at `addr` with `ppu_break`
4. When execution reaches `addr`, `ppu_break()` is called:
   - Sets `cpu_flag::dbg_pause` (and optionally `dbg_global_pause` if `g_debugger_pause_all_threads_on_bp` is true)
   - The thread stops in `check_state()`, which calls `pause_from()`
   - GDB server sends `S05` to the client

5. Client sends `z0,<addr>` to remove the breakpoint
6. `cmd_remove_breakpoint()` calls `ppu_breakpoint(addr, false)` to restore the original function pointer

### Break / Interrupt (Pause)

1. While emulation is running (after `vCont;c`), the client sends raw `0x03` byte
2. `wait_with_interrupts()` (line 548-551) detects `0x03`, sets `paused = true`
3. The GDB server main loop wakes up, pauses all threads, returns `S05`

---

## Thread Selection

The GDB protocol uses `H` commands to select threads:

- `Hc<id>` — Set thread for continue/step operations (`continue_ops_thread_id`)
- `Hg<id>` — Set thread for general operations (registers, memory) (`general_ops_thread_id`)
- `Hc-1` / `Hg-1` — ALL_THREADS (any thread will do)

The `select_thread()` function (line 420) searches for a matching PPU thread by ID. Only PPU threads are exposed; SPU threads are commented out.

---

## Configuration Summary

All relevant config keys in `config.yml`:

```yaml
Core:
  PPU Decoder: 0                    # Must be Interpreter (0) or Interpreter Fast (1), NOT LLVM (2)
  Assume External Debugger: false   # If true, is_debugger_present() always returns true

Miscellaneous:
  GDB Server: "127.0.0.1:2345"     # TCP bind address:port. Empty string = disabled.
```

---

## Quick Start: Connecting with GDB

```bash
# 1. Edit ~/.config/rpcs3/config.yml (or equivalent on Windows)
#    Set under Miscellaneous:
#      GDB Server: "127.0.0.1:2345"
#    Set under Core:
#      PPU Decoder: 0   # Interpreter

# 2. Launch RPCS3 and boot a game

# 3. Connect with GDB (install gdb-multiarch or powerpc64le-linux-gnu-gdb)
gdb-multiarch

# In GDB:
(gdb) set architecture powerpc:common64
(gdb) target remote 127.0.0.1:2345
(gdb) info threads
(gdb) thread 1
(gdb) info registers
(gdb) break *0x<address>
(gdb) continue
(gdb) stepi
(gdb) x/16xw 0x<address>
(gdb) detach
```

---

## Quick Start: Custom TCP Client

The GDB RSP protocol is text-based. A minimal Python client:

```python
import socket
import binascii

def connect(host='127.0.0.1', port=2345):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect((host, port))
    return s

def send_cmd(s, cmd):
    checksum = sum(cmd.encode()) % 256
    packet = f'${cmd}#{checksum:02x}'
    s.sendall(packet.encode())
    # Read ack
    ack = s.recv(1)
    # Read response
    resp = b''
    while True:
        c = s.recv(1)
        if c == b'$':
            break
    while True:
        c = s.recv(1)
        if c == b'#':
            break
        resp += c
    s.recv(2)  # checksum
    return resp.decode()

s = connect()
print("Supported:", send_cmd(s, 'qSupported'))
print("Threads:", send_cmd(s, 'qfThreadInfo'))
print("Stop reason:", send_cmd(s, '?'))
print("All regs:", send_cmd(s, 'g'))
# Step one instruction
print("Step:", send_cmd(s, 'vCont;s'))
# Read memory at address 0x10000, length 16
print("Memory:", send_cmd(s, 'm10000,10'))
```

---

## Source File Reference

| File | Lines | Key Content |
|------|-------|-------------|
| `rpcs3/Emu/GDB.h` | 1-104 | Class declaration, all command handler prototypes |
| `rpcs3/Emu/GDB.cpp` | 119-210 | `start_server()` — TCP/Unix socket setup |
| `rpcs3/Emu/GDB.cpp` | 253-317 | `try_read_cmd()` — packet parsing |
| `rpcs3/Emu/GDB.cpp` | 420-435 | `select_thread()` — PPU thread selection |
| `rpcs3/Emu/GDB.cpp` | 437-523 | `get_reg()` / `set_reg()` / `get_reg_size()` — register access |
| `rpcs3/Emu/GDB.cpp` | 530-553 | `wait_with_interrupts()` — run loop with Ctrl-C detection |
| `rpcs3/Emu/GDB.cpp` | 555-905 | All command handlers (`cmd_*` functions) |
| `rpcs3/Emu/GDB.cpp` | 907-996 | `operator()()` — main loop, command dispatch table |
| `rpcs3/Emu/GDB.cpp` | 998-1014 | `pause_from()` — called by CPU thread on breakpoint/step |
| `rpcs3/Emu/system_config.h` | 379 | `gdb_server` config string |
| `rpcs3/Emu/system_config.h` | 98 | `external_debugger` config bool |
| `rpcs3/Emu/CPU/CPUThread.cpp` | 906-923 | `dbg_step` → `dbg_pause` transition logic |
| `rpcs3/Emu/CPU/CPUThread.cpp` | 1063-1067 | `dbg_pause` → `gdb_server::pause_from()` call |
| `rpcs3/Emu/Cell/PPUThread.cpp` | 1200-1215 | `ppu_break()` — breakpoint entry point |
| `rpcs3/Emu/Cell/PPUThread.cpp` | 1231-1320 | `ppu_breakpoint()` — add/remove breakpoint |
| `Utilities/Thread.cpp` | 201-206 | `is_debugger_present()` — `external_debugger` check |

---

## Summary

RPCS3's external debugger is a **standard GDB Remote Serial Protocol server** listening on TCP (default `127.0.0.1:2345`). It supports **18 distinct commands** (plus the raw `0x03` interrupt):

| # | Command | Category | Description |
|---|---------|----------|-------------|
| 1 | `!` | Mode | Extended mode (no-op, returns OK) |
| 2 | `?` | Status | Get stop reason (always S05) |
| 3 | `qSupported` | Negotiation | Advertise PacketSize=1200 |
| 4 | `qfThreadInfo` | Thread | List all PPU thread IDs |
| 5 | `qC` | Thread | Get current thread ID |
| 6 | `p` | Register | Read single register |
| 7 | `P` | Register | Write single register |
| 8 | `m` | Memory | Read memory |
| 9 | `M` | Memory | Write memory |
| 10 | `g` | Register | Read all registers |
| 11 | `G` | Register | Write all registers |
| 12 | `H` | Thread | Set thread for continue/general ops |
| 13 | `qAttached` | Status | Query attach (always returns 1) |
| 14 | `k` | Control | Kill (graceful shutdown) |
| 15 | `vCont?` | Control | Query supported vCont actions |
| 16 | `vCont` | Control | Continue (`c`) or Step (`s`) |
| 17 | `z` | Breakpoint | Remove software breakpoint |
| 18 | `Z` | Breakpoint | Set software breakpoint |
| 19 | `0x03` | Control | Interrupt (Ctrl-C, raw byte, not a packet) |

**Execution control mapping:**

| Debugger Operation | GDB Command | RPCS3 Behavior |
|--------------------|-------------|----------------|
| **Run** | `vCont;c` | Remove `dbg_pause`, resume emulation |
| **Step Into** | `vCont;s` | Set `dbg_step`, resume, stop after 1 instruction |
| **Step Over** | Client-side: set temp BP at next addr, `vCont;c` | Same as continue to breakpoint |
| **Step Out** | Client-side: set temp BP at return addr, `vCont;c` | Same as continue to breakpoint |
| **Break/Pause** | `0x03` raw byte | `wait_with_interrupts()` sets `paused=true` |
| **Break on address** | `Z0,<addr>` | `ppu_breakpoint(addr, true)` replaces instruction |
| **Remove breakpoint** | `z0,<addr>` | `ppu_breakpoint(addr, false)` restores instruction |
| **Kill** | `k` | `Emu.GracefulShutdown()` |