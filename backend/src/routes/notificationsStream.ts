import { Router } from "express";
import { verifyToken } from "../lib/tokens.js";
import { EventBus, userChannel } from "../lib/eventBus.js";
import type { Role } from "../types/auth.js";

const HEARTBEAT_MS = 25_000;

interface AccessClaims {
  sub: string;
  role: Role;
  typ: string;
}

export function notificationsStreamRouter(bus: EventBus): Router {
  const router = Router();

  router.get("/stream", (req, res) => {
    try {
      const authorization = req.headers.authorization;

      const token = authorization?.startsWith("Bearer ")
        ? authorization.slice(7)
        : typeof req.query.access_token === "string"
          ? req.query.access_token
          : undefined;

      if (!token) {
        res.status(401).json({ error: "Missing bearer token" });
        return;
      }

      const claims = verifyToken<AccessClaims>(token, "access");

      if (!claims.sub || !claims.role) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      res.flushHeaders?.();
      res.write('event: ready\ndata: {"ok":true}\n\n');

      const unsubscribe = bus.subscribe(userChannel(claims.sub), (event) => {
        res.write(
          `event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`,
        );
      });

      const heartbeat = setInterval(() => {
        res.write(": ping\n\n");
      }, HEARTBEAT_MS);

      let closed = false;

      const close = (): void => {
        if (closed) {
          return;
        }

        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
      };

      req.once("close", close);
      req.once("aborted", close);
      res.once("close", close);
    } catch {
      if (!res.headersSent) {
        res.status(401).json({ error: "Invalid or expired token" });
      }
    }
  });

  return router;
}
