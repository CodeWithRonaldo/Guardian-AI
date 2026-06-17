import Anthropic from '@anthropic-ai/sdk';
import { log } from './logger.js';

let client = null;

function getClient() {
  if (!client && process.env.ANTHROPIC_API_KEY) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

// Calls Claude Haiku to produce a single-sentence risk explanation.
// Returns null if the API key is not set or the call fails — callers
// must fall back to the rule-based reason string.
export async function generateAiReason(score, action, signals) {
  const c = getClient();
  if (!c) return null;

  const signalList = signals.length > 0 ? signals.join('; ') : 'no specific anomalies detected';
  const actionLabel = {
    pause:       'emergency protocol pause',
    tighten_ltv: 'LTV ratio tightening',
    notify:      'risk notification',
  }[action] ?? action;

  try {
    const msg = await c.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 80,
      messages: [{
        role:    'user',
        content: `You are an autonomous DeFi risk guardian on the Sui blockchain. You just triggered a ${actionLabel} at risk score ${score}/100 based on these signals: ${signalList}. Write exactly ONE sentence (max 25 words) explaining why this action is necessary. Be technical and precise. Reply with only the sentence.`,
      }],
    });

    const text = msg.content[0]?.text?.trim();
    if (text) log.info(`AI reason: ${text}`);
    return text ?? null;
  } catch (err) {
    log.warn(`AI reason generation failed: ${err.message}`);
    return null;
  }
}
