import http from "node:http";
import { randomUUID } from "node:crypto";

const host = process.env.TJ_ADAPTER_HOST || "127.0.0.1";
const port = Number(process.env.TJ_ADAPTER_PORT || "8787");
const upstreamBase = (process.env.THINKINGJACK_BASE_URL || "https://thinkingjack.com/v1").replace(/\/+$/, "");
const allowedModels = new Set(["thinkingJack4_stateless", "thinkingJack4"]);

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(body) });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function textFromContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => part?.text ?? part?.content ?? "").join("");
}

function toMessages(body) {
  const messages = [];
  if (body.instructions) messages.push({ role: "system", content: body.instructions });
  const input = typeof body.input === "string"
    ? [{ role: "user", content: body.input }]
    : Array.isArray(body.input) ? body.input : [];

  for (const item of input) {
    if (item?.type === "function_call") {
      messages.push({
        role: "assistant",
        content: null,
        tool_calls: [{ id: item.call_id || item.id, type: "function", function: { name: item.name, arguments: item.arguments || "{}" } }],
      });
    } else if (item?.type === "function_call_output") {
      messages.push({ role: "tool", tool_call_id: item.call_id, content: textFromContent(item.output) });
    } else if (item?.role) {
      messages.push({ role: item.role === "developer" ? "system" : item.role, content: textFromContent(item.content) });
    }
  }
  return messages;
}

function toTools(tools) {
  if (!Array.isArray(tools)) return undefined;
  const mapped = tools.filter((tool) => tool?.type === "function").map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters || { type: "object", properties: {} },
      ...(tool.strict === undefined ? {} : { strict: tool.strict }),
    },
  }));
  return mapped.length ? mapped : undefined;
}

function upstreamBody(body, stream) {
  const result = {
    model: body.model,
    messages: toMessages(body),
    stream,
  };
  const tools = toTools(body.tools);
  if (tools) result.tools = tools;
  if (body.tool_choice) result.tool_choice = body.tool_choice;
  if (body.temperature !== undefined) result.temperature = body.temperature;
  if (body.max_output_tokens !== undefined) result.max_tokens = body.max_output_tokens;
  return result;
}

function responseEnvelope(id, model, output, status = "completed") {
  return {
    id, object: "response", created_at: Math.floor(Date.now() / 1000), status, model,
    output, parallel_tool_calls: true,
    usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
  };
}

function convertChoice(choice, id) {
  const output = [];
  const content = choice?.message?.content;
  if (content) output.push({
    id: `msg_${randomUUID()}`, type: "message", status: "completed", role: "assistant",
    content: [{ type: "output_text", text: content, annotations: [] }],
  });
  for (const call of choice?.message?.tool_calls || []) output.push({
    id: `fc_${randomUUID()}`, type: "function_call", status: "completed",
    call_id: call.id || `call_${randomUUID()}`, name: call.function?.name,
    arguments: call.function?.arguments || "{}",
  });
  return output;
}

function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function streamResponse(upstream, res, model) {
  const responseId = `resp_${randomUUID()}`;
  const shell = responseEnvelope(responseId, model, [], "in_progress");
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
  sse(res, "response.created", { type: "response.created", response: shell });

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let textOutputIndex = null;
  let nextOutputIndex = 0;
  const calls = new Map();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() || "";
    for (const frame of frames) {
      for (const line of frame.split(/\r?\n/)) {
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === "[DONE]") continue;
        const chunk = JSON.parse(raw);
        const delta = chunk.choices?.[0]?.delta || {};
        if (delta.content) {
          if (textOutputIndex === null) {
            textOutputIndex = nextOutputIndex++;
            const item = { id: `msg_${responseId}`, type: "message", status: "in_progress", role: "assistant", content: [] };
            sse(res, "response.output_item.added", { type: "response.output_item.added", output_index: textOutputIndex, item });
            sse(res, "response.content_part.added", { type: "response.content_part.added", item_id: item.id, output_index: textOutputIndex, content_index: 0, part: { type: "output_text", text: "", annotations: [] } });
          }
          text += delta.content;
          sse(res, "response.output_text.delta", { type: "response.output_text.delta", item_id: `msg_${responseId}`, output_index: textOutputIndex, content_index: 0, delta: delta.content });
        }
        for (const call of delta.tool_calls || []) {
          let current = calls.get(call.index);
          if (!current) {
            current = { call_id: call.id || `call_${randomUUID()}`, name: "", arguments: "", outputIndex: nextOutputIndex++ };
            const item = { id: `fc_${call.index}_${responseId}`, type: "function_call", status: "in_progress", call_id: current.call_id, name: call.function?.name || "", arguments: "" };
            sse(res, "response.output_item.added", { type: "response.output_item.added", output_index: current.outputIndex, item });
          }
          if (call.id) current.call_id = call.id;
          if (call.function?.name) current.name += call.function.name;
          if (call.function?.arguments) {
            current.arguments += call.function.arguments;
            sse(res, "response.function_call_arguments.delta", { type: "response.function_call_arguments.delta", item_id: `fc_${call.index}_${responseId}`, output_index: current.outputIndex, delta: call.function.arguments });
          }
          calls.set(call.index, current);
        }
      }
    }
  }

  const output = [];
  if (textOutputIndex !== null) {
    const part = { type: "output_text", text, annotations: [] };
    const item = { id: `msg_${responseId}`, type: "message", status: "completed", role: "assistant", content: [part] };
    output.push({ outputIndex: textOutputIndex, item });
    sse(res, "response.output_text.done", { type: "response.output_text.done", item_id: item.id, output_index: textOutputIndex, content_index: 0, text });
    sse(res, "response.content_part.done", { type: "response.content_part.done", item_id: item.id, output_index: textOutputIndex, content_index: 0, part });
    sse(res, "response.output_item.done", { type: "response.output_item.done", output_index: textOutputIndex, item });
  }
  for (const [index, call] of calls) {
    const item = { id: `fc_${index}_${responseId}`, type: "function_call", status: "completed", call_id: call.call_id, name: call.name, arguments: call.arguments || "{}" };
    output.push({ outputIndex: call.outputIndex, item });
    sse(res, "response.function_call_arguments.done", { type: "response.function_call_arguments.done", item_id: item.id, output_index: call.outputIndex, name: item.name, arguments: item.arguments });
    sse(res, "response.output_item.done", { type: "response.output_item.done", output_index: call.outputIndex, item });
  }
  output.sort((a, b) => a.outputIndex - b.outputIndex);
  const completed = responseEnvelope(responseId, model, output.map(({ item }) => item));
  sse(res, "response.completed", { type: "response.completed", response: completed });
  res.end();
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") return json(res, 200, { ok: true, upstream: upstreamBase, mode: "session-only" });
    if (req.method !== "POST" || req.url !== "/v1/responses") return json(res, 404, { error: { message: "Not found" } });
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return json(res, 401, { error: { message: "Missing bearer token" } });
    const body = await readJson(req);
    if (!allowedModels.has(body.model)) return json(res, 400, { error: { message: `Unsupported adapter model: ${body.model}` } });
    const wantsStream = body.stream !== false;
    const upstream = await fetch(`${upstreamBase}/chat/completions`, {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify(upstreamBody(body, wantsStream)),
    });
    if (!upstream.ok) {
      const detail = await upstream.text();
      return json(res, upstream.status, { error: { message: "ThinkingJack request failed", upstream_status: upstream.status, detail: detail.slice(0, 2000) } });
    }
    if (wantsStream) return await streamResponse(upstream, res, body.model);
    const completion = await upstream.json();
    return json(res, 200, responseEnvelope(`resp_${randomUUID()}`, body.model, convertChoice(completion.choices?.[0])));
  } catch (error) {
    json(res, 500, { error: { message: error?.message || String(error) } });
  }
});

server.listen(port, host, () => process.stdout.write(`READY http://${host}:${port}/v1\n`));

