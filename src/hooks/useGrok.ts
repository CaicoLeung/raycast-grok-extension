import type { PreferenceModel } from "@/models/preference.model";
import { getPreferenceValues, LaunchProps, showToast, Toast } from "@raycast/api";
import { createXai } from "@ai-sdk/xai";
import { smoothStream, streamText } from "ai";
import { useChatHistory } from "./useChatHistory";
import { showFailureToast } from "@raycast/utils";
import { useState, useCallback } from "react";
import { useBoolean } from "usehooks-ts";

export function useGrok(launchContext?: LaunchProps["launchContext"]) {
  const start = Date.now();
  const { addToHistory } = useChatHistory();
  const { value: isLoading, setTrue: startLoading, setFalse: stopLoading } = useBoolean(false);
  const { apiKey, defaultModel, customModel } = getPreferenceValues<PreferenceModel>();
  const [textStream, setTextStream] = useState<string>("");
  const [prompt, setPrompt] = useState<string>(launchContext?.context || launchContext?.fallbackText || "");

  const model = customModel.trim() || defaultModel;
  const xai = createXai({
    apiKey,
  });

  const submit = useCallback(
    (prompt: string) => {
      startLoading();
      setTextStream("");
      setPrompt(prompt);
      streamText({
        model: xai(model),
        prompt: prompt,
        experimental_transform: smoothStream(),
        onError: error => {
          showFailureToast(error);
          stopLoading();
        },
        onChunk: ({ chunk }) => {
          if (chunk.type === "text-delta" || chunk.type === "reasoning") {
            setTextStream(text => text + chunk.textDelta!);
          }
        },
        onFinish: async value => {
          const end = Date.now();
          const duration = end - start;
          await addToHistory(prompt, value.text, model);
          stopLoading();
          await showToast({
            style: Toast.Style.Success,
            title: "Response Finished",
            message: `Completed in ${duration / 1000}s`,
          });
        },
      });
    },
    [addToHistory, launchContext?.context, launchContext?.buffer, model, prompt, start, startLoading, stopLoading]
  );

  return {
    textStream,
    isLoading,
    prompt,
    submit,
  };
}
