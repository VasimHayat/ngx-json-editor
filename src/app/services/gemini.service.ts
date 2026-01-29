import { Injectable } from '@angular/core';
import { GoogleGenAI } from '@google/genai';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: environment.gkey || '' });
  }

  async fixJson(brokenJson: string): Promise<string|any> {
    const model = 'gemini-2.5-flash';
    const prompt = `You are a JSON repair expert. The following JSON string is invalid. Please fix it and return ONLY the valid JSON string. Do not wrap it in markdown or code blocks. Do not add explanations. Just the raw valid JSON.

    Broken JSON:
    ${brokenJson}`;

    try {
      const response = await this.ai.models.generateContent({
        model: model,
        contents: prompt
      });
      return response.text?.trim().replace(/^```json/, '').replace(/```$/, '').trim();
    } catch (error) {
      console.error('Gemini Fix JSON Error:', error);
      throw error;
    }
  }

  async generateJson(description: string): Promise<string|any> {
    const model = 'gemini-2.5-flash';
    const prompt = `Generate a realistic JSON object based on the following description: "${description}".
    Return ONLY the valid JSON string. Do not wrap in markdown.
    Ensure the data is varied and realistic.`;

    try {
      const response = await this.ai.models.generateContent({
        model: model,
        contents: prompt
      });
      return response.text?.trim().replace(/^```json/, '').replace(/```$/, '').trim();
    } catch (error) {
      console.error('Gemini Generate JSON Error:', error);
      throw error;
    }
  }

  async explainJson(jsonSnippet: string): Promise<string|any> {
    const model = 'gemini-2.5-flash';
    const prompt = `Explain the structure and purpose of this JSON data in 2-3 concise sentences. Focus on what entity it represents.

    JSON:
    ${jsonSnippet.substring(0, 1000)} ... (truncated)`; // Truncate to save tokens if huge

    try {
      const response = await this.ai.models.generateContent({
        model: model,
        contents: prompt
      });
      return response.text;
    } catch (error) {
      console.error('Gemini Explain Error:', error);
      throw error;
    }
  }
}