import { doesModuleExportName } from "./does-module-export-name.js";
import { getBarrelIndexModuleInfo } from "./is-barrel-index-module.js";
import { resolveRelativeImportPath } from "./resolve-relative-import-path.js";

const getUniqueFilePath = (filePaths: string[]): string | null => {
  const uniqueFilePaths = new Set(filePaths);
  if (uniqueFilePaths.size !== 1) return null;

  const [filePath] = uniqueFilePaths;
  return filePath ?? null;
};

const resolveStarExportFilePath = (
  barrelFilePath: string,
  exportedName: string,
  source: string,
  visitedFilePaths: Set<string>,
): string | null => {
  const resolvedTargetPath = resolveRelativeImportPath(barrelFilePath, source);
  if (!resolvedTargetPath) return null;

  const nestedTargetPath = resolveBarrelExportFilePath(
    resolvedTargetPath,
    exportedName,
    new Set(visitedFilePaths),
  );
  if (nestedTargetPath) return nestedTargetPath;

  return doesModuleExportName(resolvedTargetPath, exportedName) ? resolvedTargetPath : null;
};

export const resolveBarrelExportFilePath = (
  barrelFilePath: string,
  exportedName: string,
  visitedFilePaths = new Set<string>(),
): string | null => {
  if (visitedFilePaths.has(barrelFilePath)) return null;
  visitedFilePaths.add(barrelFilePath);

  const moduleInfo = getBarrelIndexModuleInfo(barrelFilePath);
  if (!moduleInfo.isBarrel) return null;

  const target = moduleInfo.exportsByName.get(exportedName);
  if (target) {
    const resolvedTargetPath = resolveRelativeImportPath(barrelFilePath, target.source);
    if (!resolvedTargetPath) return null;

    const nestedTargetPath = resolveBarrelExportFilePath(
      resolvedTargetPath,
      target.importedName,
      visitedFilePaths,
    );
    return nestedTargetPath ?? resolvedTargetPath;
  }

  if (exportedName === "default") return null;

  const starExportFilePaths = moduleInfo.starExportSources
    .map((source) =>
      resolveStarExportFilePath(barrelFilePath, exportedName, source, visitedFilePaths),
    )
    .filter((filePath): filePath is string => Boolean(filePath));
  return getUniqueFilePath(starExportFilePaths);
};
