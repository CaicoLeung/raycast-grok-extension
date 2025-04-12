import { useCallback, useEffect, useMemo, useState } from "react";
import { getPreferenceValues, getSelectedText, LaunchProps, showToast, Toast } from "@raycast/api";
import { useGrok } from "./hooks/useGrok";
import AskUI, { AslFormData } from "./ui/AskUI";
import DetailUI from "./ui/DetailUI";
import fs from "node:fs";

export default function AskAI({ launchContext }: LaunchProps) {
  const { prompt } = getPreferenceValues();
  const { textStream, isLoading, lastQuery, submit } = useGrok({
    ...launchContext,
    context: launchContext?.buffer ?? prompt,
  });
  const [selected, setSelected] = useState("");

  const argQuery = useMemo<string>(
    () => launchContext?.args || launchContext?.fallbackText || "",
    [launchContext?.args, launchContext?.fallbackText]
  );

  const onSubmit = useCallback(
    (values: AslFormData) => {
      console.log("onSubmit", values);
      const _files = values?.files
        ?.filter((file: string) => fs.existsSync(file) && fs.lstatSync(file).isFile())
        .map((file: string) => fs.readFileSync(file));

      submit(`${values.query}\n${selected}`);
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
