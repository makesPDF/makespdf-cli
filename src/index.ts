import { defineCommand, runMain } from "citty";
import { authCommand } from "./commands/auth.js";
import { loginCommand } from "./commands/login.js";
import { mdCommand } from "./commands/md.js";
import { previewCommand } from "./commands/preview.js";
import { skillCommand } from "./commands/skill.js";
import { validateCommand } from "./commands/validate.js";

const main = defineCommand({
  meta: {
    name: "makespdf",
    version: "0.1.0",
    description:
      "Command-line interface for makesPDF — convert markdown and templates to PDF from the terminal.",
  },
  subCommands: {
    md: mdCommand,
    preview: previewCommand,
    validate: validateCommand,
    login: loginCommand,
    auth: authCommand,
    skill: skillCommand,
  },
});

runMain(main);
