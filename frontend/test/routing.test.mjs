import assert from "node:assert/strict";
import test from "node:test";
import { parseRoute } from "../src/app/routing.ts";

test("parseRoute recognizes every supported route", () => {
  assert.deepEqual(parseRoute("/"), { kind: "home" });
  assert.deepEqual(parseRoute("/answers"), { kind: "answers" });
  assert.deepEqual(parseRoute("/setup/poll1234"), { kind: "setup", id: "poll1234" });
  assert.deepEqual(parseRoute("/polls/poll1234"), { kind: "poll", id: "poll1234" });
  assert.deepEqual(parseRoute("/polls/poll1234/results"), { kind: "results", id: "poll1234" });
});

test("parseRoute sends unknown paths home", () => {
  assert.deepEqual(parseRoute("/unknown"), { kind: "home" });
});
