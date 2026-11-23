/**
 * CanvasView live delivery, bound to Claude Code (`delivery.ts` holds the rules).
 *
 * - CanvasView is reached only through this plugin's own CanvasView server (`$.mcp.connect` of its
 *   `.mcp.json` key, which answers with the name the session runs that connection under), with the
 *   sign-in Claude Code holds. No other server is ever taken for CanvasView's.
 * - It delivers only where a person or a host keeps the session: under the REPL, or while a surface
 *   (the desktop app, a phone) is attached. A `-p` run never takes the feed, and a session whose
 *   last surface leaves stops following until one attaches again.
 * - Turns are tracked on the main loop only; subagents receive nothing.
 */
import type { EngineInterface, PluginOptions, Register } from "claude-code";
import { answerOf, defaultTurnGapMillis, defaultTurnsPerHour, Feed, leaseRenewMillis, selfOf, type Delivery, type Host, type Saved, type Settings } from "./delivery";

const command = "canvasview-feed";
/** The key of the CanvasView server in this plugin's `.mcp.json`. */
const bundledServer = "canvasview";
/**
 * The store key: the bundled server is the only CanvasView connection the plugin follows, and
 * `$.mcp.connect` answers every name of that connection as one, so all its sessions share a lease.
 */
const storeKey = "feed:canvasview";
/** The tools whose answer is a message this agent sent, which names it. */
const sendTools = /__(send_message|send_request|add_comment)$/;

const bounded = (value: unknown, fallback: number, min: number, max: number) => {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
};

const settingsOf = (options: PluginOptions): Settings & { readonly off: boolean } => {
  const delivery: Delivery = options["delivery"] === "next-prompt" ? "next-prompt" : "idle";
  return {
    delivery,
    urgent: options["urgent"] === "queue" ? "queue" : "inject",
    turnsPerHour: Math.round(bounded(options["turnsPerHour"], defaultTurnsPerHour, 1, 60)),
    turnGapMillis: bounded(options["turnGapSeconds"], defaultTurnGapMillis / 1000, 10, 3600) * 1000,
    off: options["delivery"] === "off",
  };
};

/** The bundled CanvasView server's name in this session, or null while it is not connected and signed in. */
const serverOf = async ($: EngineInterface): Promise<string | null> => {
  const bundled = await $.mcp.connect(bundledServer);
  return bundled.isConnected ? bundled.server : null;
};

/** The prefix Claude Code gives the server's tools: anything but letters, digits, `_` and `-` made `_`. */
const prefixOf = (server: string) => `mcp__${server.replace(/[^A-Za-z0-9_-]/g, "_")}__`;

const hostOf = ($: EngineInterface, server: string, isLive: () => boolean): Host => ({
  call: async (tool, args) => answerOf(await $.mcp.call(server, tool, { ...args })),
  submit: async (text) => isLive() && !("drop" in (await $.prompt.submit({ text }))),
  inject: async (text) => isLive() && !("deny" in (await $.session.append({ message: { type: "user", content: [{ type: "text", text }] } }))),
  load: () => $.store.get(storeKey),
  save: (record: Saved) => $.store.set(storeKey, record),
  now: () => $.clock.now(),
  sleep: (ms) => $.clock.sleep(ms),
  after: (ms, run) => {
    $.clock.after(ms, () => (isLive() ? run() : Promise.resolve()).catch(() => undefined));
  },
  status: (text) => $.ui.status(text),
});

/** What the hooks share for one session. */
interface Live {
  feed: Feed | null;
  /** The CanvasView server's tool prefix, once known. */
  prefix: string | null;
  /** The main turn in progress, tracked before the feed starts too. */
  running: string | null;
  /** A `-p` run or an SDK host: delivers only while a surface is attached. */
  headless: boolean;
  /** Set once: the command and the timer, however many times session.start runs. */
  started: boolean;
  holder: string;
  /** Why there is no feed now, for the command. */
  waiting: string;
}

const hasSurface = async ($: EngineInterface) => (await $.session.surfaces()).length > 0;

/** Starts following the feed once CanvasView is connected and the session can be delivered to. */
const startFeed = async ($: EngineInterface, live: Live, settings: Settings): Promise<void> => {
  if (live.feed !== null) return;
  if (live.headless && !(await hasSurface($))) {
    live.waiting = "This session has no one to deliver to now (a -p run, or an SDK host with no surface attached).";
    return;
  }
  const server = await serverOf($);
  if (server === null) {
    live.waiting = "CanvasView is not connected in this session. Run /mcp, choose CanvasView and sign in.";
    $.ui.status("CanvasView: sign in with /mcp");
    return;
  }
  $.ui.status(undefined);
  const feed: Feed = new Feed(hostOf($, server, () => live.feed === feed && feed.phase === "ready"), settings, live.holder);
  live.feed = feed;
  live.prefix = prefixOf(server);
  await feed.start();
  if (live.running !== null) feed.onTurnStart(live.running);
};

/** Stops following: the lease is freed for another session, and what waits stays without its text. */
const stopFeed = async (live: Live, why: string): Promise<void> => {
  const feed = live.feed;
  live.feed = null;
  live.waiting = why;
  await feed?.end().catch(() => undefined);
};

export const register: Register = (on, options) => {
  const settings = settingsOf(options);
  const live: Live = { feed: null, prefix: null, running: null, headless: false, started: false, holder: "", waiting: "Delivery is starting." };

  on("session.start", async ($, e, next) => {
    const started = await next(e);
    if (settings.off) {
      live.waiting = "Live delivery is off in this plugin's settings (/config).";
      return started;
    }
    live.headless = !e.isInteractive;
    if (!live.started) {
      live.started = true;
      live.holder = await $.session.id();
      await $.command.register({ name: command, description: "Show whether this session follows your CanvasView feed and what waits." });
      // Renews the lease, takes over a free one, restarts a stopped wait, and retries the sign-in or a surface.
      $.clock.every(leaseRenewMillis, async () => {
        if (live.feed === null) await startFeed($, live, settings).catch(() => undefined);
        else if (live.headless && !(await hasSurface($))) await stopFeed(live, "The last surface left this session.");
        else await live.feed.tick().catch(() => undefined);
      });
    }
    // Off session.start: a claim pauses to read the store back, and the first prompt need not wait for it.
    $.clock.after(0, () => startFeed($, live, settings).catch(() => undefined));
    return started;
  });

  on("session.end", async (_$, e, next) => {
    if (e.reason !== "clear") await stopFeed(live, "The session ended.");
    return next(e);
  });

  // An SDK host's session follows the feed only while someone is attached to it.
  on("session.attach", async ($, e, next) => {
    const attached = await next(e);
    if (live.started && !settings.off) $.clock.after(0, () => startFeed($, live, settings).catch(() => undefined));
    return attached;
  });

  on("session.detach", async ($, e, next) => {
    const detached = await next(e);
    if (live.headless && live.feed !== null && !(await hasSurface($))) await stopFeed(live, "The last surface left this session.");
    return detached;
  });

  on("command.run", { command }, async () => ({
    text: live.feed?.describe() ?? `CanvasView: ${live.waiting}`,
  }));

  on("turn.start", async (_$, e, next) => {
    if (e.agentId === undefined) {
      live.running = e.turnId;
      live.feed?.onTurnStart(e.turnId);
    }
    return next(e);
  });

  on("turn.step", async function* (_$, e, next) {
    if (e.agentId === undefined) live.feed?.onStep(e.turnId);
    return yield* next(e);
  });

  on("turn.complete", async (_$, e, next) => {
    const completed = await next(e);
    if (e.agentId === undefined) {
      if (live.running === e.turnId) live.running = null;
      await live.feed?.onTurnComplete(e.turnId);
    }
    return completed;
  });

  // What waits rides along with the person's own prompt, typed or sent from a phone.
  on("prompt.submit", async (_$, e, next) => {
    const feed = live.feed;
    if (feed === null || e.command !== undefined || (e.origin.kind !== "composer" && e.origin.kind !== "bridge")) return next(e);
    const queued = await feed.takeForPrompt();
    return next(queued === null ? e : { ...e, context: [...(e.context ?? []), queued] });
  }).catch((_$, e, next) => next(e));

  // A message the agent sent names it: its own messages are then never delivered back to it.
  on("tool.call", async (_$, e, next) => {
    const answered = await next(e);
    const prefix = live.prefix;
    if (prefix !== null && e.tool.startsWith(prefix) && sendTools.test(e.tool) && "result" in answered) {
      try {
        const self = selfOf(answerOf(answered.result));
        if (self !== null) await live.feed?.noteSelf(self);
      } catch {
        // A refused send names no one.
      }
    }
    return answered;
  });
};
