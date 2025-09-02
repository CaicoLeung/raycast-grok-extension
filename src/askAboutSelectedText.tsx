import { getSelectedText, LaunchProps, showToast, Toast, Clipboard } from "@raycast/api";
import DetailUI from "./ui/DetailUI";
import { useGrok } from "./hooks/useGrok";
import { useEffect, useRef } from "react";

const prompt = "You are a helpful assistant, answer the question based on the selected text";

export default function AskAboutSelectedText({ launchContext }: LaunchProps) {
  const { textStream, isLoading, lastQuery, submit } = useGrok(prompt, launchContext);
  const hasInitialized = useRef(false);

  // Get selected text or clipboard text
  useEffect(() => {
    // Prevent duplicate execution
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const acquireText = async () => {
      try {
        // First try to get selected text
        let text = "";
        try {
          text = await getSelectedText();
          console.debug("Acquired selected text:", text);
        } catch {
          // If no text is selected, get the most recent text from clipboard
          const clipboardText = await Clipboard.readText();
          text = clipboardText || "";
          console.debug("Acquired clipboard text:", text);
        }

        if (text) {
          submit(text);
        } else {
          throw new Error("No text available");
        }
      } catch (error) {
        console.error("Acquired text failed:", error);
        showToast({
          style: Toast.Style.Failure,
          title: "Acquired text failed",
          message: "Please ensure that text is selected or available in clipboard",
        });
      }
    };

    acquireText();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array, only execute once when component mounts

  return <DetailUI textStream={textStream} isLoading={isLoading} lastQuery={lastQuery} />;
}
