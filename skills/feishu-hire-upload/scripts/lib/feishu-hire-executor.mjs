import { existsSync, lstatSync, realpathSync } from "node:fs";
import path from "node:path";

import { FeishuHireClient, FeishuHireError } from "./feishu-hire.mjs";

function safeArchiveFile(archiveRoot, relativePath) {
  const root = path.resolve(archiveRoot);
  const relative = String(relativePath ?? "").trim();
  const absolute = path.resolve(root, relative);
  const fromRoot = path.relative(root, absolute);
  if (
    !relative ||
    !fromRoot ||
    fromRoot.startsWith("..") ||
    path.isAbsolute(fromRoot)
  ) {
    throw new FeishuHireError("resume attachment is outside the archive root", {
      subtype: "unsafe_file_path",
    });
  }
  if (!existsSync(absolute)) {
    throw new FeishuHireError("resume attachment is missing", {
      subtype: "missing_file",
    });
  }
  const actualRelative = path.relative(realpathSync(root), realpathSync(absolute));
  if (!actualRelative || actualRelative.startsWith("..") || path.isAbsolute(actualRelative)) {
    throw new FeishuHireError("archive symlink escapes its root", { subtype: "unsafe_file_path" });
  }
  const stat = lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new FeishuHireError("resume attachment must be a regular file", {
      subtype: "unsafe_file_type",
    });
  }
  return {
    cwd: root,
    relativePath: fromRoot,
    absolutePath: absolute,
  };
}

export function createFeishuHirePlanTransport({
  client = new FeishuHireClient({ identity: "bot" }),
  archiveRoot = "",
  uiExecutor = null,
} = {}) {
  return async (operation) => {
    if (operation.surface) {
      if (operation.surface !== "feishu_hire_ui" || !uiExecutor) {
        throw new FeishuHireError(
          `write surface is unavailable: ${operation.surface}`,
          { subtype: "ui_executor_unavailable" },
        );
      }
      return uiExecutor(operation);
    }
    if (!operation.method || !operation.path) {
      throw new FeishuHireError("operation is missing method or path", {
        subtype: "invalid_operation",
      });
    }
    if (operation.multipart) {
      if (!archiveRoot || Object.keys(operation.multipart).length !== 1) {
        throw new FeishuHireError("multipart operation requires one archive file", {
          subtype: "invalid_multipart",
        });
      }
      const [field, relativePath] = Object.entries(operation.multipart)[0];
      const file = safeArchiveFile(archiveRoot, relativePath);
      return client.rawRequest({
        method: operation.method,
        path: operation.path,
        params: operation.params ?? {},
        file: { field, path: file.relativePath },
        cwd: file.cwd,
      });
    }
    return client.rawRequest({
      method: operation.method,
      path: operation.path,
      params: operation.params ?? {},
      ...(operation.data === undefined ? {} : { data: operation.data }),
    });
  };
}

export { safeArchiveFile };
