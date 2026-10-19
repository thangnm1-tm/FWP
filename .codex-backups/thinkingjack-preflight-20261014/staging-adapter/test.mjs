import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const upstream = http.createServer(async (req, res) => {
  assert.equal(req.url, "/v1/chat/completions");
  assert.equal(req.headers.authorization, "Bearer mock-secret");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks));
  assert.equal(body.model, "thinkingJack4_stateless");
  assert.equal(body.messages[0].content, "Use tools when asked.");
  if (body.stream) {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"echo","arguments":"{\\"value\\":\\"ok\\"}"}}]}}]}\n\n');
    res.end("data: [DONE]\n\n");
  } else {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: "mock-ok" } }] }));
  }
});

await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
const upstreamPort = upstream.address().port;
const adapterPort = upstreamPort + 1;
const child = spawn(process.execPath, [fileURLToPath(new URL("./server.mjs", import.meta.url))], {
  env: { ...process.env, TJ_ADAPTER_PORT: String(adapterPort), THINKINGJACK_BASE_URL: `http://127.0.0.1:${upstreamPort}/v1` },
  stdio: ["ignore", "pipe", "inherit"],
});
await new Promise((resolve, reject) => {
  child.stdout.once("data", resolve);
  child.once("exit", (code) => reject(new Error(`adapter exited ${code}`)));
});

try {
  const nonStream = await fetch(`http://127.0.0.1:${adapterPort}/v1/responses`, {
    method: "POST", headers: { authorization: "Bearer mock-secret", "content-type": "application/json" },
    body: JSON.stringify({ model: "thinkingJack4_stateless", instructions: "Use tools when asked.", input: "hello", stream: false }),
  });
  assert.equal(nonStream.status, 200);
  const nonStreamBody = await nonStream.json();
  assert.equal(nonStreamBody.output[0].content[0].text, "mock-ok");

  const stream = await fetch(`http://127.0.0.1:${adapterPort}/v1/responses`, {
    method: "POST", headers: { authorization: "Bearer mock-secret", "content-type": "application/json" },
    body: JSON.stringify({ model: "thinkingJack4_stateless", instructions: "Use tools when asked.", input: "call echo", stream: true, tools: [{ type: "function", name: "echo", parameters: { type: "object" } }] }),
  });
  assert.equal(stream.status, 200);
  const events = await stream.text();
  assert.match(events, /response\.function_call_arguments\.done/);
  assert.match(events, /"call_id":"call_1"/);
  assert.match(events, /response\.completed/);

  const rejected = await fetch(`http://127.0.0.1:${adapterPort}/v1/responses`, {
    method: "POST", headers: { authorization: "Bearer mock-secret", "content-type": "application/json" },
    body: JSON.stringify({ model: "thinkingJack1", input: "hello" }),
  });
  assert.equal(rejected.status, 400);
  console.log("staging adapter mock tests passed");
} finally {
  child.kill();
  upstream.close();
}

