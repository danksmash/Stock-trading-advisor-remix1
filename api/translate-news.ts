import type { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const titles = Array.isArray(req.body?.titles) ? req.body.titles.map(String).slice(0, 6) : [];
  if (!titles.length) return res.status(200).json({ translations: [] });
  if (!process.env.GEMINI_API_KEY) return res.status(200).json({ translations: titles });
  try {
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `次の英語ニュース見出しを、意味を要約・一般化・追加せず、自然で正確な日本語のニュース見出しに翻訳してください。固有名詞、企業名、数値、疑問形、肯定・否定のニュアンスを保持してください。入力と同じ順番・同じ件数のJSON文字列配列だけを返してください。\n\n${JSON.stringify(titles)}`;
    const response = await client.models.generateContent({ model: 'gemini-3.7-flash', contents: prompt, config: { responseMimeType: 'application/json' } });
    const parsed = JSON.parse(response.text || '[]');
    const translations = Array.isArray(parsed) && parsed.length === titles.length ? parsed.map(String) : titles;
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
    return res.status(200).json({ translations });
  } catch (error) {
    console.warn('[news translation] failed', error);
    return res.status(200).json({ translations: titles });
  }
}
