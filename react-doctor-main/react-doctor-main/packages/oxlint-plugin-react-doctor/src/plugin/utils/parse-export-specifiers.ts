export interface ExportSpecifier {
  localName: string;
  exportedName: string;
  isTypeOnly: boolean;
}

const getSpecifierName = (rawName: string): string => rawName.replace(/^type\s+/, "").trim();

export const parseExportSpecifiers = (
  specifiersText: string,
  declarationIsTypeOnly: boolean,
): ExportSpecifier[] =>
  specifiersText
    .split(",")
    .map((specifierText) => specifierText.trim())
    .filter(Boolean)
    .map((specifierText) => {
      const isTypeOnly = declarationIsTypeOnly || specifierText.startsWith("type ");
      const [rawLocalName, rawExportedName] = specifierText.split(/\s+as\s+/);
      const localName = getSpecifierName(rawLocalName ?? "");
      return {
        localName,
        exportedName: getSpecifierName(rawExportedName ?? localName),
        isTypeOnly,
      };
    });
