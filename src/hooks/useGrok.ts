import { getPreferenceValues, LaunchProps, showToast, Toast } from "@raycast/api";
import OpenAI from "openai";
import { useChatHistory } from "./useChatHistory";
import { showFailureToast } from "@raycast/utils";
import { useState, useCallback } from "react";
import { PreferenceModel } from "../models/preference.model";
import { useBoolean } from "usehooks-ts";
import { ChatCompletionContentPart, ChatCompletionMessageParam } from "openai/resources/chat";
import { isVisionModel } from "../utils";

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
    async (query: string, imageFiles?: Buffer[]) => {
      if (query.trim() === "") {
        return;
      }

      // Check if images are provided but model doesn't support vision
      if (imageFiles && imageFiles.length > 0 && !isVisionModel(model)) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Model doesn't support images",
          message: `${model} is a text-only model. Please use a vision model like grok-2-vision-1212, grok-vision-beta, or grok-beta to analyze images.`,
        });
        return;
      }

      try {
        const start = Date.now();
        startLoading();
        let delta = "";
        setLastQuery(query);

        // Prepare messages with image support
        const messages: ChatCompletionMessageParam[] = [{ role: "system", content: prompt || systemPrompt }];

        // If we have images, create a message with both text and images
        if (imageFiles && imageFiles.length > 0) {
          const content: ChatCompletionContentPart[] = [{ type: "text", text: query }];

          // Add images to the content
          imageFiles.forEach(imageBuffer => {
            const base64Image = imageBuffer.toString("base64");
            content.push({
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            });
          });

          messages.push({
            role: "user",
            content: content,
          });
        } else {
          // Text-only message
          messages.push({
            role: "user",
            content: query,
          });

          console.debug(messages);
        }

        const completion = await client.chat.completions.create({
          model: model,
          stream: true,
          max_completion_tokens: 1024 * 10,
          messages: messages,
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
