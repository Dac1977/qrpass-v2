import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const chat = new Hono();

const SYSTEM_PROMPT = `Sos el asistente de ventas de QRPass. PRECIOS: Barrios $700/vecino/mes, Gimnasios $700 cada 10 usuarios/mes, Coworkings $700 cada 10 usuarios/mes. 30 días gratis. Si el usuario quiere pagar, usa [PAGO:monto] al final. Respondé en español, conciso, sin markdown.`;

chat.post('/', zValidator('json', z.object({
  messages: z.array(z.object({ role: z.string(), content: z.string() })),
})), async (c) => {
  const { messages } = c.req.valid('json');
  const groqKey = process.env.GROQ_API_KEY;
  console.log('GROQ_API_KEY exists:', !!groqKey);
  if (!groqKey) return c.json({ error: 'GROQ_API_KEY not configured' }, 500);

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.7,
      max_tokens: 350,
    }),
  });

  console.log('Groq response status:', groqRes.status);

  if (!groqRes.ok) {
    const errorText = await groqRes.text();
    console.error('Groq API error:', errorText);
    return c.json({ error: 'Groq API error', details: errorText }, 500);
  }

  const groqData = await groqRes.json() as { choices: { message: { content: string } }[] };
  const reply = groqData.choices[0].message.content.trim();
  return c.json({ reply });
});

export default chat;
