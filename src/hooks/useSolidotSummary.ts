import { useState, useCallback } from "react";
import { getPreferenceValues } from "@raycast/api";
import OpenAI from "openai";
import { PreferenceModel } from "../models/preference.model";

const { defaultModel, customModel, apiKey } = getPreferenceValues<PreferenceModel>();
const model = customModel?.trim() || defaultModel;

const client = new OpenAI({
  apiKey: apiKey,
  baseURL: "https://api.x.ai/v1",
});

export interface SolidotItem {
  title: string;
  link: string;
  pubDate: string;
  isoDate: string;
  content: string;
  contentSnippet: string;
}

export function useSolidotSummary() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateSummary = useCallback(async (date: string, newsItems: SolidotItem[]): Promise<string> => {
    if (newsItems.length === 0) {
      throw new Error("No news items provided");
    }

    setIsGenerating(true);

    try {
      const newsText = newsItems
        .map(item => `Title: ${item.title}\nContent: ${item.contentSnippet || item.content}\nLink: ${item.link}`)
        .join("\n\n---\n\n");

      const systemPrompt = `You are a professional technology news editor. Please categorize the following news by industry domain and generate concise summaries for each category.

Requirements:
1. Categorize by relevant technology domains (such as: Artificial Intelligence, Hardware Technology, Software Development, Cybersecurity, Gaming Entertainment, etc.)
2. Summarize news content in concise bullet points under each category
3. Highlight key points and important information
4. Use Markdown format

Format example:
## Artificial Intelligence
- Concise summary 1: Key information and impact
- Concise summary 2: Important development trends

## Hardware Technology
- Concise summary 1: Technology breakthroughs or product releases
`;

      const userPrompt = `Please generate categorized summaries for the following technology news from ${date}:\n\n${newsText}`;

      const completion = await client.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_completion_tokens: 2048,
        temperature: 0.7,
      });

      const summary = completion.choices[0]?.message?.content;
      if (!summary) {
        throw new Error("No summary generated");
      }

      return `# ${date} Technology News Summary\n\n${summary}`;
    } catch (error) {
      console.error("Failed to generate summary:", error);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return {
    generateSummary,
    isGenerating,
  };
}
