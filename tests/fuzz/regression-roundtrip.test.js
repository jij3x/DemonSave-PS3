/**
 * Fuzzing regression guard for the read→write→read round-trip.
 *
 * Jest half of the round-trip fuzzing story (Jazzer half: fuzz/roundtrip.fuzz.js).
 * Both share fuzz/oracle.js. Inputs are built in-memory so `npm test` stays
 * deterministic.
 *
 * The oracle checks writer idempotency (read→write→read→write→read is a fixed
 * point), which is immune to the writer's intentional first-write normalizations
 * (deposit flags[0]/sortOrder/durability, spell/deposit region overlap) while
 * still catching genuine serialization bugs.
 */
import { assertRoundTripStable } from '../../fuzz/oracle.js';
import { createPopulatedUserDat } from '../../test-fixtures/save-factory.js';

describe('round-trip fuzz regression — writer idempotency', () => {
  test('a valid seed is stable under read→write→read→write→read', () => {
    expect(() => assertRoundTripStable(createPopulatedUserDat(1))).not.toThrow();
    expect(() => assertRoundTripStable(createPopulatedUserDat(2))).not.toThrow();
  });

  test('garbage / too-small input is handled cleanly (no TypeError)', () => {
    expect(() => assertRoundTripStable(new Uint8Array(8))).not.toThrow();
    expect(() => assertRoundTripStable(new Uint8Array(0x40000))).not.toThrow();
  });
});
