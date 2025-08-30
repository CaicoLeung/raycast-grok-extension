import { useCallback, useEffect, useMemo, useState } from "react";
import { getPreferenceValues, getSelectedText, LaunchProps, showToast, Toast } from "@raycast/api";
import { useGrok } from "./hooks/useGrok";
import AskUI, { AslFormData } from "./ui/AskUI";
import DetailUI from "./ui/DetailUI";
import fs from "node:fs";
import { ACCEPT_IMAGE_TYPES } from "./constants/accept";

export default function AskAI({ launchContext }: LaunchProps) {
  const { prompt } = getPreferenceValues();
  const { textStream, isLoading, lastQuery, submit } = useGrok(prompt, launchContext);
  const [selected, setSelected] = useState("");

  const argQuery = useMemo<string>(
    () => launchContext?.args || launchContext?.fallbackText || "",
    [launchContext?.args, launchContext?.fallbackText]
  );

  const onSubmit = useCallback(
    (values: AslFormData) => {
      console.log("onSubmit", values);

      // Process image files
      let imageFiles: Buffer[] = [];
      if (values?.files && values.files.length > 0) {
        imageFiles = values.files
          .filter((file: string) => {
            if (!fs.existsSync(file) || !fs.lstatSync(file).isFile()) {
              return false;
            }
            // Check if it's an image file
            const ext = file.toLowerCase().split(".").pop();
            return ACCEPT_IMAGE_TYPES.includes(ext || "");
          })
          .map((file: string) => fs.readFileSync(file));
      }

      const queryText = selected ? `${values.query}\n${selected}` : values.query;
      submit(queryText, imageFiles);
    },
    [selected, submit]
  );

  useEffect(() => {
    (async () => {
      if (launchContext?.useSelected) {
        try {
          const selectedText = await getSelectedText();
          setSelected(selectedText);
          if (!argQuery) {
            submit(`${launchContext?.context}\n${selectedText}`);
          } else {
            submit(`${launchContext?.context}\n${argQuery}\n${selectedText}`);
          }
          return;
        } catch (_error) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Could not get the selected text. Continue without it.",
          });
        }
      }
      if (argQuery) {
        submit(argQuery);
      }
    })();
  }, [argQuery, launchContext?.context, launchContext?.useSelected, selected, submit]);

  return isLoading || textStream ? (
    <DetailUI
      isLoading={isLoading}
      allowPaste={launchContext?.allowPaste}
      textStream={textStream}
      lastQuery={lastQuery}
    />
  ) : (
    <AskUI onSubmit={onSubmit} />
  );
}
