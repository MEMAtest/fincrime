import { describe, it, expect } from "vitest";
import { readStreamBounded } from "../bounded-stream";

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(chunks[i++]);
      } else {
        controller.close();
      }
    },
  });
}

describe("readStreamBounded", () => {
  it("reads a small stream fully when under the cap", async () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([4, 5]);
    const result = await readStreamBounded(streamOf([a, b]), 100);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.from(result.bytes)).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it("rejects a stream once the running total exceeds maxBytes, without buffering it all", async () => {
    const chunk = new Uint8Array(10).fill(9);
    // 5 chunks of 10 bytes = 50 bytes total, cap at 25 - must stop partway through.
    const result = await readStreamBounded(streamOf([chunk, chunk, chunk, chunk, chunk]), 25);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("too_large");
  });

  it("accepts a stream exactly at the cap", async () => {
    const chunk = new Uint8Array(10).fill(1);
    const result = await readStreamBounded(streamOf([chunk, chunk]), 20);
    expect(result.ok).toBe(true);
  });

  it("handles an empty stream", async () => {
    const result = await readStreamBounded(streamOf([]), 10);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.bytes.length).toBe(0);
  });
});
