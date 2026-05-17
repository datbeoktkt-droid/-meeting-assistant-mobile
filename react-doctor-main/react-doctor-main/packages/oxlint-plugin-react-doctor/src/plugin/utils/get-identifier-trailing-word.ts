export const getIdentifierTrailingWord = (identifierName: string): string => {
  const words = identifierName.match(/[A-Z]+(?=[A-Z][a-z]|\b)|[A-Z]?[a-z]+|\d+/g);
  return words?.at(-1)?.toLowerCase() ?? identifierName.toLowerCase();
};
