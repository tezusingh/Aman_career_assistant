/**
 * Activity log route — paginated viewer over the JSONL audit trail.
 *
 *   GET /api/activity?limit=N&type=<prefix> → { events: ActivityEvent[] }
 *
 * The activity middleware (lib/activity-log.mjs) appends every state-
 * changing request to data/activity.jsonl with secret-key redaction;
 * this endpoint reads the tail.
 */
import { readActivity } from '../activity-log.mjs';

export function registerActivityRoutes(app) {
  app.get('/api/activity', (req, res) => {
    const limit = Number.parseInt(req.query.limit, 10) || 200;
    const prefix = typeof req.query.type === 'string' ? req.query.type : undefined;
    res.json({ events: readActivity({ limit, actionPrefix: prefix }) });
  });
}
