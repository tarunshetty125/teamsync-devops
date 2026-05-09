import fs from "fs";

const path = "./file.txt"; // Backend file
const linkloc = "../client/public/kanban/public/file.txt";

// Write and then copy
export const filewrite = (content: string) => {
  fs.writeFile(path, content, "utf8", (err: any) => {
    if (err) {
      console.error("Error writing file:", err);
      return;
    }
    console.log(`File '${path}' has been created/overwritten successfully.`);

    // Now copy after write finishes
    fs.copyFile(path, linkloc, (err: any) => {
      if (err) {
        console.error("Error copying file:", err);
      } else {
        console.log(`File copied to '${linkloc}' successfully!`);
      }
    });
  });
};
