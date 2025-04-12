import { Action, ActionPanel, Form, getSelectedText, Icon } from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import React, { useCallback, useMemo, useState } from "react";

export interface AskUIProps {
  onSubmit: (values: AslFormData) => void;
  buffer?: string[];
}

export interface AslFormData {
  query: string;
  files?: string[];
}

export default function AskUI(props: AskUIProps) {
  const [textarea, setTextarea] = useState("");

  const hasBuffer = useMemo(() => props.buffer && props.buffer.length > 0, [props.buffer]);

  const handleClipboardAction = useCallback(async () => {
    try {
      const selectedText = await getSelectedText();
      setTextarea(text => text + selectedText);
    } catch (error) {
      await showFailureToast("Could not get the selected text");
    }
  }, []);

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm onSubmit={props.onSubmit} />
          <Action
            icon={Icon.Clipboard}
            title="Append Selected Text"
            onAction={handleClipboardAction}
            shortcut={{ modifiers: ["ctrl", "shift"], key: "v" }}
          />
        </ActionPanel>
      }
    >
      <Form.TextArea
        title="Prompt"
        id="query"
        value={textarea}
        onChange={value => setTextarea(value)}
        placeholder="Ask Gemini a question..."
      />
      {!hasBuffer && (
        <>
          <Form.Description title="Image" text="Image that you want Gemini to analyze along with your prompt." />
          <Form.FilePicker id="files" title="" allowMultipleSelection={false} />
          <Form.Description text="Note that image data will not be carried over if you continue in Chat." />
        </>
      )}
    </Form>
  );
}
