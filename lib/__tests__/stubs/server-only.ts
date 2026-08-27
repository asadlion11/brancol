/**
 * Test stub for the `server-only` package.
 *
 * `server-only` throws unless it is imported under React's `react-server`
 * condition, which Vitest does not provide. Aliasing it here lets the unit
 * tests import server modules for their *pure* helpers (timeout budgeting).
 * The real guarantee — that these modules can never reach a client bundle — is
 * enforced by the Next.js build, not by this stub.
 */
export {};
