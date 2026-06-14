import { AssertionError } from "node:assert";
import { describe, it } from "node:test";
import { isDeepStrictEqual } from "node:util";

export { describe, it };

function messageWithContext(message, fallback) {
  return message ? `${message}: ${fallback}` : fallback;
}

function fail(message, actual, expected, operator) {
  throw new AssertionError({
    message,
    actual,
    expected,
    operator,
  });
}

function errorMatches(error, expected) {
  if (expected === undefined) return true;
  const message = error instanceof Error ? error.message : String(error);
  if (expected instanceof RegExp) return expected.test(message);
  if (typeof expected === "string") return message.includes(expected);
  if (typeof expected === "function") return error instanceof expected;
  return false;
}

function containsValue(actual, expected) {
  if (typeof actual === "string") return actual.includes(String(expected));
  if (Array.isArray(actual)) return actual.includes(expected);
  if (actual && typeof actual.has === "function") return actual.has(expected);
  return false;
}

function makeMatchers(actual, message, negate = false) {
  function assertResult(pass, expected, operator, fallback) {
    const effectivePass = negate ? !pass : pass;
    if (!effectivePass) {
      fail(messageWithContext(message, fallback), actual, expected, negate ? `not.${operator}` : operator);
    }
  }

  return {
    get not() {
      return makeMatchers(actual, message, !negate);
    },

    get rejects() {
      if (!actual || typeof actual.then !== "function") {
        fail(messageWithContext(message, "expected a Promise for rejects"), actual, undefined, "rejects");
      }
      return {
        async toThrow(expected) {
          try {
            await actual;
          } catch (error) {
            const matches = errorMatches(error, expected);
            if (negate ? matches : !matches) {
              fail(
                messageWithContext(message, "promise rejected with an unexpected error"),
                error instanceof Error ? error.message : String(error),
                expected,
                negate ? "rejects.not.toThrow" : "rejects.toThrow",
              );
            }
            return;
          }
          if (!negate) {
            fail(
              messageWithContext(message, "expected promise to reject"),
              "resolved",
              expected,
              "rejects.toThrow",
            );
          }
        },
      };
    },

    toBe(expected) {
      assertResult(Object.is(actual, expected), expected, "toBe", "values are not identical");
    },

    toEqual(expected) {
      assertResult(isDeepStrictEqual(actual, expected), expected, "toEqual", "values are not deeply equal");
    },

    toContain(expected) {
      assertResult(containsValue(actual, expected), expected, "toContain", "value was not contained");
    },

    toMatch(expected) {
      const text = String(actual);
      const pass = expected instanceof RegExp ? expected.test(text) : text.includes(String(expected));
      assertResult(pass, expected, "toMatch", "value did not match");
    },

    toThrow(expected) {
      if (typeof actual !== "function") {
        fail(messageWithContext(message, "toThrow expects a function"), actual, expected, "toThrow");
      }
      try {
        actual();
      } catch (error) {
        const matches = errorMatches(error, expected);
        if (negate ? matches : !matches) {
          fail(
            messageWithContext(message, "function threw an unexpected error"),
            error instanceof Error ? error.message : String(error),
            expected,
            negate ? "not.toThrow" : "toThrow",
          );
        }
        return;
      }
      if (!negate) {
        fail(messageWithContext(message, "expected function to throw"), "no error", expected, "toThrow");
      }
    },

    toBeGreaterThan(expected) {
      assertResult(actual > expected, expected, "toBeGreaterThan", "value was not greater than expected");
    },

    toBeGreaterThanOrEqual(expected) {
      assertResult(
        actual >= expected,
        expected,
        "toBeGreaterThanOrEqual",
        "value was not greater than or equal to expected",
      );
    },
  };
}

export function expect(actual, message) {
  return makeMatchers(actual, message);
}
