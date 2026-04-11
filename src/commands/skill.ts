import { defineCommand } from "citty";
import { SKILL } from "../embedded-skill.js";
import { writeTextOutput } from "../io.js";

export const skillCommand = defineCommand({
  meta: {
    name: "skill",
    description:
      "Print the makesPDF template-author skill file to stdout. Pipe it into your AI assistant's context directory (e.g. `makespdf skill > .cursor/rules/makespdf.md`).",
  },
  args: {
    out: {
      type: "string",
      description: "Write the skill to this file instead of stdout.",
      alias: "o",
    },
  },
  run({ args }) {
    writeTextOutput(SKILL, args.out || undefined);
  },
});
