import { getSelectedText, LaunchProps, showToast, Toast } from "@raycast/api";
import DetailUI from "./ui/DetailUI";
import { useGrok } from "./hooks/useGrok";
import { useAsyncEffect } from "ahooks";

const prompt =
  "You are a translation engine, translate the text to Chinese directly without explanation and any explanatory content";

export default function Translate({ launchContext }: LaunchProps) {
  const { textStream, isLoading, lastQuery, submit } = useGrok(prompt, launchContext);

  // 获取选中的文本
  useAsyncEffect(async () => {
    try {
      const text = await getSelectedText();
      console.debug("Acquired selected text:", text);
      submit(text);
    } catch (error) {
      console.error("Acquired selected text:", error);
      showToast({
        style: Toast.Style.Failure,
        title: "Acquired selected text failed",
        message: "Please ensure that the text to be translated is selected before use",
      });
    }
  }, [submit]);

  return <DetailUI textStream={textStream} isLoading={isLoading} lastQuery={lastQuery} />;
}
