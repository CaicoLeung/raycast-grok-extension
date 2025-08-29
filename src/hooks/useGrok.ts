import { getPreferenceValues, LaunchProps, showToast, Toast } from "@raycast/api";
import OpenAI from "openai";
import { useChatHistory } from "./useChatHistory";
import { showFailureToast } from "@raycast/utils";
import { useState, useCallback, useRef } from "react";
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
  const textStreamRef = useRef<string>("");

  const submit = useCallback(
    async (query: string) => {
      if (query.trim() === "") {
        return;
      }
      try {
        const start = Date.now();
        startLoading();
        setTextStream("");
        textStreamRef.current = "";
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
            case "stop":
              // 正常结束，返回完整的翻译结果
              stopLoading();
              break;
            case "length":
              // 达到最大长度限制
              setTextStream(prev => {
                const newValue = prev + "\n[翻译被截断：达到最大长度限制]";
                textStreamRef.current = newValue;
                return newValue;
              });
              break;
            case "content_filter":
              // 内容被过滤
              setTextStream(prev => {
                const newValue = prev + "\n[翻译被过滤：可能包含不适当内容]";
                textStreamRef.current = newValue;
                return newValue;
              });
              break;
            case "tool_calls":
            case "function_call":
              // API调用相关，一般不会在翻译中出现
              setTextStream(prev => {
                const newValue = prev + "\n[不支持的响应类型]";
                textStreamRef.current = newValue;
                return newValue;
              });
              break;
            default:
              // 继续累积翻译内容
              setTextStream(prev => {
                const newValue = prev + content;
                textStreamRef.current = newValue;
                return newValue;
              });
              break;
          }
        }
        const end = Date.now();
        const duration = end - start;

        await addToHistory(query, textStreamRef.current, model);
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
    [addToHistory, prompt, startLoading, stopLoading]
  );

  return {
    textStream,
    isLoading,
    lastQuery,
    submit,
  };
}
