import { Linter } from "eslint";

import raycastConfig from "@raycast/eslint-config";

const linterConfig: Linter.LegacyConfig = {
  root: true,
  extends: [raycastConfig],
};

export default linterConfig;
