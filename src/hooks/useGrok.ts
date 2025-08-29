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

export function useGrok(prompt: string, launchContext?: LaunchProps["launchContext"]) {
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
        let delta = "";
        setLastQuery(query);
        const completion = await client.chat.completions.create({
          model: model,
          stream: true,
          max_completion_tokens: 1024 * 10,
          messages: [
            { role: "system", content: prompt || systemPrompt },
            { role: "user", content: query },
          ],
        });
        for await (const chunk of completion) {
          const finish_reason = chunk.choices[0].finish_reason;
          const content = chunk.choices[0].delta?.content || "";
          switch (finish_reason) {
            case "stop": {
              // 正常结束，返回完整的翻译结果
              const end = Date.now();
              const duration = end - start;
              await addToHistory(query, delta, model);
              await showToast({
                style: Toast.Style.Success,
                title: "Response Finished",
                message: `Completed in ${duration / 1000}s`,
              });
              stopLoading();
              break;
            }
            case "length":
              // 达到最大长度限制
              delta += "\n[翻译被截断：达到最大长度限制]";
              setTextStream(delta);
              break;
            case "content_filter":
              // 内容被过滤
              delta += "\n[翻译被过滤：可能包含不适当内容]";
              setTextStream(delta);
              break;
            case "tool_calls":
            case "function_call":
              // API调用相关，一般不会在翻译中出现
              delta += "\n[不支持的响应类型]";
              setTextStream(delta);
              break;
            default:
              // 继续累积翻译内容
              delta += content;
              setTextStream(delta);
              break;
          }
        }
      } catch (error) {
        showFailureToast(error);
        stopLoading();
      }
    },
    [addToHistory, prompt, startLoading, stopLoading]
  );

  return {
    textStream,
    isLoading,
    lastQuery,
    submit,
  };
}
