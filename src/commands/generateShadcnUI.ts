import * as vscode from "vscode";
import {
  getMultiplePickableOptions,
  getUserInput,
  joinPath,
  runCommandWithPrompt,
  sanitizePath,
  tryReadDirectory,
  writeToFile,
} from "../utils/vscode";
import { getRootDirPath, tryReadFile } from "../utils/file";
import { getConfig, updateConfig } from "../config";

const availableComponentList = [
  "Accordion",
  "Alert",
  "Alert Dialog",
  "Aspect Ratio",
  "Avatar",
  "Badge",
  "Button",
  "Calendar",
  "Card",
  "Checkbox",
  "Collapsible",
  "Command",
  "Context Menu",
  "Dialog",
  "Dropdown Menu",
  "Form",
  "Hover Card",
  "Input",
  "Label",
  "Menubar",
  "Navigation Menu",
  "Popover",
  "Progress",
  "Radio Group",
  "Scroll-area",
  "Select",
  "Separator",
  "Sheet",
  "Skeleton",
  "Slider",
  "Switch",
  "Table",
  "Tabs",
  "Textarea",
  "Toast",
  "Toggle",
  "Tooltip",
];

const getAvailableComponents = async (rootDirPath: vscode.Uri, outputLocation: string) => {
  const addableComponents = availableComponentList.map((comp) => ({
    key: comp.trim().toLowerCase().replace(/ /g, "-"),
    label: comp.trim(),
    description: `Add ${comp.trim()} component`,
  }));
  const keys = addableComponents.map((comp) => comp.key);
  const files = await tryReadDirectory(joinPath(rootDirPath, outputLocation));

  const existingComponents = files
    .map((file) => (keys.includes(file[0].replace(".tsx", "")) ? file[0].replace(".tsx", "") : undefined))
    .filter(Boolean) as string[];

  const filteredComponents = addableComponents.filter((component) => !existingComponents.includes(component.key));
  return filteredComponents;
};

export const generateShadcnUI = async () => {
  const rootDirPath = getRootDirPath();
  if (!rootDirPath) {
    return;
  }
  const config = getConfig();
  const componentFolder = config.get<string>("componentFolder");
  const location = componentFolder ? componentFolder : "/app/components/ui";
  if (!location) {
    return;
  }
  const loc = await tryReadDirectory(joinPath(rootDirPath, location));
  if (!loc) {
    await vscode.workspace.fs.createDirectory(joinPath(rootDirPath, location));
  }
  const outputLocation = sanitizePath(location);

  // Add the provided component folder path to the config
  updateConfig("componentFolder", outputLocation);

  const availableComponents = await getAvailableComponents(rootDirPath, outputLocation);

  const pickedComponents = await getMultiplePickableOptions(availableComponents, {
    title: "Select components to generate",
  });
  if (!pickedComponents) {
    return;
  }
  // Components the user picked
  const componentsToGenerate = pickedComponents.map((component) => component.key).join(" ");

  await runCommandWithPrompt({
    command: `npx shadcn-ui@latest add ${componentsToGenerate}`,
    title: "Generating shadcn/ui components",
    promptHandler: async (process, resolve) => {
      // Write the output location to the input stream (this gets asked by the CLI)
      process.stdin?.write(`y\n`);
      // End the input stream
      process.stdin?.end();

      // Wait for the command to finish
      process.stdout?.on("end", resolve);
    },
  });
  // Fix up files
  for (const component of pickedComponents) {
    const fileLocation = joinPath(rootDirPath, outputLocation, `${component.key}.tsx`);
    const file = await tryReadFile(fileLocation.path);
    if (!file) {
      continue;
    }
    const fileString = file.toString();
    // Removes use client from the file
    const newFileString = fileString.replace(`"use client"\n\n`, "");
    await writeToFile(fileLocation, newFileString);
  }
};
