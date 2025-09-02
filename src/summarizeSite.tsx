import { LaunchProps, BrowserExtension, showToast, Toast, environment } from "@raycast/api";
import DetailUI from "./ui/DetailUI";
import { useGrok } from "./hooks/useGrok";
import { useEffect, useRef } from "react";

const prompt = `You are a professional content summarizer. Please analyze the provided webpage content and create a comprehensive summary that includes:

1. **Main Topic**: What is this webpage primarily about?
2. **Key Points**: List the most important information, findings, or arguments presented
3. **Structure**: How is the content organized? (sections, categories, etc.)
4. **Target Audience**: Who is this content intended for?
5. **Actionable Insights**: What can readers do with this information?
6. **Conclusion**: Summarize the main takeaway or conclusion

Please provide the summary in Chinese, and make it detailed but concise. Focus on extracting the most valuable information for the reader.`;

export default function SummarizeSite({ launchContext }: LaunchProps) {
  const { textStream, isLoading, lastQuery, submit } = useGrok(prompt, launchContext);
  const hasInitialized = useRef(false);

  // Get content from Chrome browser's current active tab
  useEffect(() => {
    // Prevent duplicate execution
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const getWebContent = async () => {
      try {
        // Check if browser extension API is supported
        if (!environment.canAccess(BrowserExtension)) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Browser extension required",
            message: "Please install Raycast browser extension first to get webpage content",
          });
          return;
        }

        // Get content from current active tab, use markdown format for better structured content
        const webpageContent = await BrowserExtension.getContent({
          format: "markdown",
        });

        if (webpageContent && webpageContent.trim()) {
          // Get tab information to display webpage title and URL
          const tabs = await BrowserExtension.getTabs();
          const activeTab = tabs.find(tab => tab.active);

          let contentToSummarize = webpageContent;
          if (activeTab) {
            contentToSummarize = `Webpage Title: ${activeTab.title || "Unknown Title"}\nWebpage URL: ${activeTab.url || "Unknown URL"}\n\nWebpage Content:\n${webpageContent}`;
          }

          await showToast({
            style: Toast.Style.Success,
            title: "Webpage content acquired",
            message: "Analyzing and summarizing with Grok AI...",
          });

          submit(contentToSummarize);
        } else {
          await showToast({
            style: Toast.Style.Failure,
            title: "Unable to get webpage content",
            message: "Current tab may not have readable content or page is still loading",
          });
        }
      } catch (error) {
        console.error("Failed to get webpage content:", error);
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to get webpage content",
          message: "Please ensure Chrome browser is open with active tabs and Raycast browser extension is installed",
        });
      }
    };

    getWebContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array, only execute once when component mounts

  return <DetailUI textStream={textStream} isLoading={isLoading} lastQuery={lastQuery} />;
}
