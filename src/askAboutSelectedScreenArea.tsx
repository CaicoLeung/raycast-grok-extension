import { useCallback, useEffect, useState } from "react";
import { showToast, Toast, closeMainWindow, environment, launchCommand, LaunchType } from "@raycast/api";
import fs from "node:fs";
import util from "node:util";
import { exec } from "child_process";
import DetailUI from "./ui/DetailUI";
import { showFailureToast } from "@raycast/utils";

export default function AskAboutSelectedScreenArea() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureCompleted, setCaptureCompleted] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const captureScreenArea = useCallback(async () => {
    // Prevent multiple concurrent captures
    if (isCapturing || captureCompleted) {
      return;
    }

    try {
      setIsCapturing(true);

      // Close the Raycast window so users can see the screen.
      await closeMainWindow();

      // Wait for a longer time to ensure the window is fully closed to avoid concurrency issues.
      await new Promise(resolve => setTimeout(resolve, 1000));

      const execPromise = util.promisify(exec);
      const screenshotPath = `${environment.assetsPath}/screenshot_${Date.now()}.png`;

      // First check if there is a running screenshot process.
      try {
        await execPromise("pgrep screencapture");
        // If there is a process running, wait for it to complete.
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch {
        // If there is no process running, continue.
      }

      // Add timeout and more detailed error handling.
      const screencaptureCmd = `/usr/sbin/screencapture -s "${screenshotPath}"`;

      try {
        // Set timeout to 30 seconds to give users enough time to complete the screenshot.
        await Promise.race([
          execPromise(screencaptureCmd),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Screenshot timeout")), 30000)),
        ]);

        // Check if the screenshot file really exists.
        if (!fs.existsSync(screenshotPath)) {
          throw new Error("Screenshot file not created - user may have cancelled");
        }

        await showToast({
          style: Toast.Style.Success,
          title: "Screenshot completed",
          message: "Starting Ask AI...",
        });

        // Launch the askAI command, passing the screenshot file path.
        await launchCommand({
          name: "askAI",
          type: LaunchType.UserInitiated,
          context: {
            files: [screenshotPath],
            useSelected: false,
            allowPaste: false,
          },
        });

        setCaptureCompleted(true);
      } catch (error) {
        console.error("Screenshot error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        if (errorMessage.includes("cannot run two interactive screen captures")) {
          await showFailureToast(error, {
            title: "Screenshot conflict",
            message: "Please wait for other screenshots to complete and try again.",
          });
        } else if (errorMessage.includes("timeout")) {
          await showFailureToast(error, {
            title: "Screenshot timeout",
            message: "Please try again.",
          });
        } else {
          await showFailureToast(error, {
            title: "Screenshot cancelled",
            message: "The user cancelled the screenshot operation.",
          });
        }
      }
    } catch (error) {
      console.error("Screenshot failed:", error);
      await showFailureToast(error, {
        title: "Screenshot failed",
        message: "Please try again.",
      });
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, captureCompleted]);

  // Automatically start capturing the screen when the component loads, but only once.
  useEffect(() => {
    if (!hasStarted && !isCapturing && !captureCompleted) {
      setHasStarted(true);
      captureScreenArea();
    }
  }, [hasStarted, isCapturing, captureCompleted, captureScreenArea]);

  // If the screenshot is completed, display the success message.
  if (captureCompleted) {
    return <DetailUI textStream="Screenshot completed, Ask AI command started." isLoading={false} lastQuery="" />;
  }

  // If the screenshot is in progress, display the loading state.
  return <DetailUI textStream="Waiting for screenshot..." isLoading={true} lastQuery="" />;
}
