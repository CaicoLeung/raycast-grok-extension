import { getSelectedText, LaunchProps, showToast, Toast, Clipboard } from "@raycast/api";
import DetailUI from "./ui/DetailUI";
import { useGrok } from "./hooks/useGrok";
import { useEffect, useRef } from "react";

const prompt = `
Please provide a detailed explanation of the user-provided text, including the following aspects:
1. Etymology: Explain the origin, root words, and how it evolved.
2. Pronunciation: Describe the pronunciation, including any phonetic nuances.
3. Definition: Provide the main meaning and any secondary meanings.
4. Usage: Give sentence examples using the word and demonstrate its usage in different contexts.
5. Synonyms and Antonyms: List synonyms and antonyms, and explain their differences in meaning or usage.
6. Related Words: Mention any related words or derivatives, and explain their connection to the original word.
7. Cultural or Historical Context: Provide any relevant cultural or historical information to help understand the word's usage or meaning.
`;

export default function Lookup({ launchContext }: LaunchProps) {
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
