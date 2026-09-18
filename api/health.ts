import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.json({ status: 'ok', service: 'Flow Prompt Forge API - TikTok Shop & 3 Agents' });
}
