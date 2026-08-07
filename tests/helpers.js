/**
 * Shared type-escape helpers for negative tests.
 *
 * This is the single sanctioned location for the `@type {never}` escape in
 * the test suite. `npm run lint:types` should show zero `@type {never}`
 * outside this module — test call sites use `bad()` / `setBad()` instead.
 */

/**
 * Mark a value as intentionally wrong-typed for negative tests (bad
 * arguments, bad literal property values). Returns `never`, which is
 * assignable to every type, so the value can be used anywhere the type
 * system would otherwise reject it.
 * @param {unknown} v
 * @returns {never}
 */
export function bad(v) {
  return /** @type {never} */ (v);
}

/**
 * Intentionally assign a wrong-typed value to an object field for
 * sanitization tests. Widens the object to a string-keyed record so the
 * assignment typechecks without per-site casts.
 * @param {unknown} model  the object to mutate
 * @param {string} key     field name to overwrite
 * @param {unknown} value  intentionally bad-typed value
 */
export function setBad(model, key, value) {
  (/** @type {Record<string, unknown>} */ (model))[key] = value;
}
