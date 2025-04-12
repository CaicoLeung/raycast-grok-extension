import { getPreferenceValues, LaunchProps, showToast, Toast } from "@raycast/api";
import OpenAI from "openai";
import { useChatHistory } from "./useChatHistory";
import { showFailureToast } from "@raycast/utils";
import { useState, useCallback } from "react";
import { PreferenceModel } from "../models/preference.model";
import { useBoolean } from "usehooks-ts";

const { defaultModel, customModel, prompt: systemPrompt, apiKey } = getPreferenceValues<PreferenceModel>();
const model = customModel?.trim() || defaultModel;

const client = new OpenAI({
  apiKey: apiKey,
  baseURL: "https://api.x.ai/v1",
});

export function useGrok(launchContext?: LaunchProps["launchContext"]) {
  const { addToHistory } = useChatHistory();
  const { value: isLoading, setTrue: startLoading, setFalse: stopLoading } = useBoolean(false);
  const [textStream, setTextStream] = useState<string>("");
  const [lastQuery, setLastQuery] = useState<string>(launchContext?.context || launchContext?.fallbackText || "");

  const submit = useCallback(
    async (query: string) => {
      if (query.trim() === "") {
        return;
      }
      try {
        const start = Date.now();
        startLoading();
        setTextStream("");
        setLastQuery(query);
        const completion = await client.chat.completions.create({
          model: model,
          stream: true,
          max_completion_tokens: 1024 * 10,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: query },
          ],
        });
        for await (const chunk of completion) {
          console.log(chunk);
          const content = chunk.choices[0].delta.content;
          if (content) {
            stopLoading();
            setTextStream(text => text + content);
          }
        }
        const end = Date.now();
        const duration = end - start;

        await addToHistory(query, textStream, model);
        await showToast({
          style: Toast.Style.Success,
          title: "Response Finished",
          message: `Completed in ${duration / 1000}s`,
        });
      } catch (error) {
        showFailureToast(error);
        stopLoading();
      }
    },
    [addToHistory, startLoading, stopLoading, textStream]
  );

  return {
    textStream,
    isLoading,
    lastQuery,
    submit,
  };
}
