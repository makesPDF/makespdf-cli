import { defineCommand } from "citty";
import { CLIENT_VERSION } from "./client-info.js";
import { authCommand } from "./commands/auth.js";
import { loginCommand } from "./commands/login.js";
import { mdCommand } from "./commands/md.js";
import { previewCommand } from "./commands/preview.js";
import { renderCommand } from "./commands/render.js";
import { skillCommand } from "./commands/skill.js";
import { validateCommand } from "./commands/validate.js";

export const main = defineCommand({
  meta: {
    name: "makespdf",
    version: CLIENT_VERSION,
    description:
      "Command-line interface for makesPDF — convert markdown and templates to PDF from the terminal.",
  },
  subCommands: {
    md: mdCommand,
    preview: previewCommand,
    render: renderCommand,
    validate: validateCommand,
    login: loginCommand,
    auth: authCommand,
    skill: skillCommand,
  },
});
